import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import type { DelegationRequest, OperationRequest } from "@clasp/protocol";
import { createApp } from "./app";
import { Store } from "@clasp/wallet-core";
import { FakeGateway, encodeFakeInvoice } from "@clasp/gateway";
import { generateKeypair, signRequest, signDelegation, verifyResult } from "@clasp/token";
import { createWalletCore } from "./clasp-wallet-core";

const ORIGIN = "https://weather.example";
const ASSET = "CKB";
const START = Date.parse("2026-07-15T20:00:00Z");
const fakeInvoice = (asset: string, amount: string) => encodeFakeInvoice(amount, asset);

function facts(appPubKey: string) {
  return {
    origin: ORIGIN,
    permissions: ["payments:request", "invoices:read"],
    asset: ASSET,
    maxSinglePayment: "100000000",
    maxSessionSpend: "250000000",
    expiresAt: new Date(START + 3600_000).toISOString(),
    appPubKey,
  };
}

describe("clasp server", () => {
  let server: Server;
  let base: string;
  let now: number;
  let walletKeys: ReturnType<typeof generateKeypair>;
  let appKeys: ReturnType<typeof generateKeypair>;

  beforeEach(async () => {
    now = START;
    walletKeys = generateKeypair();
    appKeys = generateKeypair();
    const gateway = new FakeGateway();
    const store = new Store();
    const walletCore = createWalletCore({ store, gateway, walletKeys, now: () => now });
    server = createApp(walletCore).listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  async function post(path: string, body: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json()) as any };
  }

  async function createSession() {
    const res = await post("/sessions", facts(appKeys.publicKey));
    return res.body as { sessionId: string; token: string; walletPubKey: string };
  }

  function signedOperation(
    sessionId: string,
    operation: OperationRequest["operation"],
    parameters: Record<string, unknown>,
    nonce: number,
  ) {
    const unsigned = {
      version: "1" as const,
      sessionId,
      requestId: `req_${operation}_${nonce}`,
      operation,
      parameters,
      nonce,
      timestamp: Math.floor(now / 1000),
    };
    return { ...unsigned, signature: signRequest(unsigned, appKeys.privateKey) };
  }

  function payment(sessionId: string, amount: string, nonce: number) {
    return signedOperation(
      sessionId,
      "payments:request",
      { invoice: fakeInvoice(ASSET, amount), amount, asset: ASSET },
      nonce,
    );
  }

  it("creates an active session with a wallet-signed token", async () => {
    const res = await post("/sessions", facts(appKeys.publicKey));
    expect(res.status).toBe(201);
    expect(res.body.sessionId).toBeTruthy();
    expect(res.body.walletPubKey).toBe(walletKeys.publicKey);
    expect(res.body.session.state).toBe("ACTIVE");
    expect(res.body.session.spent).toBe("0");
  });

  it("settles a payment and returns a wallet-signed result", async () => {
    const { sessionId } = await createSession();
    const res = await post("/operations", payment(sessionId, "100000000", 1), { "x-clasp-origin": ORIGIN });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("succeeded");
    expect(res.body.paymentHash).toMatch(/^[0-9a-f]+$/);
    expect(res.body.amount).toBe("100000000");
    expect(res.body.sessionRemaining).toBe("150000000");
    expect(verifyResult(res.body, walletKeys.publicKey)).toBe(true);
  });

  it("denies an operation outside the granted permissions", async () => {
    const { sessionId } = await createSession();
    const op = signedOperation(sessionId, "channels:open", {}, 1);
    const res = await post("/operations", op, { "x-clasp-origin": ORIGIN });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe("permission_denied");
    expect(res.body.requiredPermission).toBe("channels:open");
  });

  it("rejects an amount over the single-payment cap", async () => {
    const { sessionId } = await createSession();
    const res = await post("/operations", payment(sessionId, "200000000", 1), { "x-clasp-origin": ORIGIN });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe("single_payment_limit_exceeded");
  });

  it("enforces the cumulative session-spend cap", async () => {
    const { sessionId } = await createSession();
    await post("/operations", payment(sessionId, "100000000", 1), { "x-clasp-origin": ORIGIN });
    await post("/operations", payment(sessionId, "100000000", 2), { "x-clasp-origin": ORIGIN });
    const third = await post("/operations", payment(sessionId, "100000000", 3), { "x-clasp-origin": ORIGIN });

    expect(third.body.code).toBe("session_spending_limit_exceeded");
  });

  it("rejects a replayed nonce", async () => {
    const { sessionId } = await createSession();
    const op = payment(sessionId, "100000000", 1);
    await post("/operations", op, { "x-clasp-origin": ORIGIN });
    const replay = await post("/operations", op, { "x-clasp-origin": ORIGIN });

    expect(replay.body.code).toBe("replay_detected");
  });

  it("rejects a copied token used from a different origin", async () => {
    const { sessionId } = await createSession();
    const res = await post("/operations", payment(sessionId, "100000000", 1), {
      "x-clasp-origin": "https://evil.example",
    });

    expect(res.body.code).toBe("origin_mismatch");
    expect(res.body.expected).toBe(ORIGIN);
    expect(res.body.received).toBe("https://evil.example");
  });

  it("rejects a tampered request signature", async () => {
    const { sessionId } = await createSession();
    const op = payment(sessionId, "100000000", 1);
    const tampered = { ...op, parameters: { ...op.parameters, amount: "1" } };
    const res = await post("/operations", tampered, { "x-clasp-origin": ORIGIN });

    expect(res.body.code).toBe("invalid_signature");
  });

  it("revokes a session and rejects further operations", async () => {
    const { sessionId } = await createSession();
    const revoke = await post(`/sessions/${sessionId}/revoke`, {});
    expect(revoke.status).toBe(200);
    expect(revoke.body.session.state).toBe("REVOKED");

    const res = await post("/operations", payment(sessionId, "100000000", 1), { "x-clasp-origin": ORIGIN });
    expect(res.body.code).toBe("session_revoked");
  });

  it("rejects operations on an expired session", async () => {
    const { sessionId } = await createSession();
    now = START + 3600_000 + 1000;
    const res = await post("/operations", payment(sessionId, "100000000", 1), { "x-clasp-origin": ORIGIN });

    expect(res.body.code).toBe("session_expired");
  });

  it("reports accumulated spend via GET /sessions/:id", async () => {
    const { sessionId } = await createSession();
    await post("/operations", payment(sessionId, "100000000", 1), { "x-clasp-origin": ORIGIN });

    const res = await fetch(`${base}/sessions/${sessionId}`);
    const body = (await res.json()) as any;
    expect(res.status).toBe(200);
    expect(body.session.spent).toBe("100000000");
  });

  it("returns 404 for an unknown session", async () => {
    const res = await fetch(`${base}/sessions/sess_missing`);
    const body = (await res.json()) as any;
    expect(res.status).toBe(404);
    expect(body.code).toBe("session_not_found");
  });

  it("rejects a malformed operation body with 400", async () => {
    const res = await post("/operations", { version: "1", nonsense: true }, { "x-clasp-origin": ORIGIN });
    expect(res.status).toBe(400);
  });

  function autoFacts(appPubKey: string) {
    return { ...facts(appPubKey), permissions: ["payments:auto", "payments:request"] };
  }

  function signedDelegation(
    parentSessionId: string,
    childAppPubKey: string,
    overrides: Partial<DelegationRequest> = {},
  ) {
    const unsigned: Omit<DelegationRequest, "signature"> = {
      version: "1",
      parentSessionId,
      delegationId: `del_${childAppPubKey.slice(0, 8)}`,
      childAppPubKey,
      permissions: ["payments:request"],
      asset: ASSET,
      maxSinglePayment: "40000000",
      maxSessionSpend: "80000000",
      expiresAt: new Date(START + 1800_000).toISOString(),
      timestamp: Math.floor(now / 1000),
      ...overrides,
    };
    return { ...unsigned, signature: signDelegation(unsigned, appKeys.privateKey) };
  }

  it("mints an attenuated child session that draws from the parent's pool", async () => {
    const parent = (await post("/sessions", autoFacts(appKeys.publicKey))).body as { sessionId: string };
    const childKeys = generateKeypair();

    const del = await post("/delegations", signedDelegation(parent.sessionId, childKeys.publicKey), {
      "x-clasp-origin": ORIGIN,
    });
    expect(del.status).toBe(201);
    expect(del.body.session.state).toBe("ACTIVE");
    expect(del.body.session.maxSessionSpend).toBe("80000000");
    const childId = del.body.childSessionId as string;

    const unsigned = {
      version: "1" as const,
      sessionId: childId,
      requestId: "req_child_1",
      operation: "payments:request" as const,
      parameters: { invoice: fakeInvoice(ASSET, "40000000"), amount: "40000000", asset: ASSET },
      nonce: 1,
      timestamp: Math.floor(now / 1000),
    };
    const childPayment = { ...unsigned, signature: signRequest(unsigned, childKeys.privateKey) };
    const paid = await post("/operations", childPayment, { "x-clasp-origin": ORIGIN });
    expect(paid.body.status).toBe("succeeded");

    const parentState = (await (await fetch(`${base}/sessions/${parent.sessionId}`)).json()) as any;
    expect(parentState.session.spent).toBe("40000000");
  });

  it("rejects a delegation that tries to widen the parent's session cap", async () => {
    const parent = (await post("/sessions", autoFacts(appKeys.publicKey))).body as { sessionId: string };
    const childKeys = generateKeypair();

    const del = await post(
      "/delegations",
      signedDelegation(parent.sessionId, childKeys.publicKey, { maxSessionSpend: "500000000" }),
      { "x-clasp-origin": ORIGIN },
    );
    expect(del.status).toBe(200);
    expect(del.body.code).toBe("attenuation_violation");
    expect(del.body.reason).toBe("session_spend_widen");
  });

  it("refuses to delegate from a session without payments:auto", async () => {
    const parent = await createSession();
    const childKeys = generateKeypair();

    const del = await post("/delegations", signedDelegation(parent.sessionId, childKeys.publicKey), {
      "x-clasp-origin": ORIGIN,
    });
    expect(del.body.code).toBe("permission_denied");
  });
});
