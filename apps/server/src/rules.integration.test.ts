import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { ClaspErrorException, type ClaspError } from "@clasp/protocol";
import { createClaspClient, createClaspWallet, type ApprovalRequest, type ClaspWallet, type Grant } from "@useclasp/client";
import { Store } from "@clasp/wallet-core";
import { FakeGateway, encodeFakeInvoice } from "@clasp/gateway";
import { generateKeypair, signDecision } from "@clasp/token";
import { createApp } from "./app";
import { createWalletCore } from "./clasp-wallet-core";

const ORIGIN = "https://weather.example";
const ASSET = "CKB";
const START = Date.parse("2026-07-15T20:00:00Z");
const invoice = (amount: string) => encodeFakeInvoice(amount, ASSET);

async function rejection(promise: Promise<unknown>): Promise<ClaspError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ClaspErrorException);
    return (error as ClaspErrorException).error;
  }
  throw new Error("expected a rejection");
}

describe("owner rules end-to-end through the SDK", () => {
  let server: Server;
  let base: string;
  let now: number;
  let wallet: ClaspWallet;
  const appKeys = generateKeypair();

  async function start(owners: string[] | null = null) {
    now = START;
    const walletCore = createWalletCore({
      store: new Store(),
      gateway: new FakeGateway(),
      walletKeys: generateKeypair(),
      now: () => now,
      owners,
    });
    server = createApp(walletCore, { owners: owners ? "allow-list" : "open" }).listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  beforeEach(async () => {
    await start();
    wallet = createClaspWallet({ serverUrl: base, now: () => now });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function connect(grant: Partial<Grant> = {}, approver: ClaspWallet = wallet) {
    return createClaspClient({
      serverUrl: base,
      origin: ORIGIN,
      app: { name: "Weather Agent" },
      permissions: ["payments:request"],
      asset: ASSET,
      maxSinglePayment: "100000000",
      maxSessionSpend: "250000000",
      appKeypair: appKeys,
      approve: (request: ApprovalRequest) => approver.approve(request, grant),
      now: () => now,
    }).connect();
  }

  it("holds a large payment until the owner approves, then hands the agent a verified receipt", async () => {
    const session = await connect({ approvalThreshold: "50000000" });

    const held = await rejection(session.requestPayment({ invoice: invoice("80000000"), amount: "80000000" }));
    expect(held.code).toBe("approval_required");
    expect(held.nextAction).toBe("await_approval");
    const requestId = held.requestId as string;

    const [pending] = await wallet.listHolds(session.sessionId);
    expect(pending?.status).toBe("pending");
    expect(pending?.amount).toBe("80000000");

    const waiting = session.waitForApproval(requestId, { intervalMs: 5 });
    const decided = await wallet.decide(pending!, "approve");
    expect(decided.status).toBe("settled");

    const receipt = await waiting;
    expect(receipt.amount).toBe("80000000");
    expect(session.verifyReceipt(receipt)).toBe(true);
  });

  it("tells a waiting agent when the owner declines", async () => {
    const session = await connect({ approvalThreshold: "50000000" });
    const held = await rejection(session.requestPayment({ invoice: invoice("80000000"), amount: "80000000" }));

    const waiting = rejection(session.waitForApproval(held.requestId as string, { intervalMs: 5 }));
    await wallet.decide(await session.getHold(held.requestId as string), "deny");
    expect((await waiting).code).toBe("approval_denied");
    expect((await session.getState()).spent).toBe("0");
  });

  it("rejects an agent that signs its own approval", async () => {
    const session = await connect({ approvalThreshold: "50000000" });
    const held = await rejection(session.requestPayment({ invoice: invoice("80000000"), amount: "80000000" }));
    const requestId = held.requestId as string;

    const seen = await session.getHold(requestId);
    const health = (await (await fetch(`${base}/health`)).json()) as { walletPubKey: string };
    const unsigned = {
      version: "1" as const,
      requestId,
      sessionId: seen.sessionId,
      amount: seen.amount,
      invoice: seen.invoice,
      walletPubKey: health.walletPubKey,
      decision: "approve" as const,
      timestamp: Math.floor(now / 1000),
    };
    const res = await fetch(`${base}/holds/${requestId}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...unsigned, signature: signDecision(unsigned, appKeys.privateKey) }),
    });
    const body = (await res.json()) as ClaspError;
    expect(body.code).toBe("invalid_signature");
    expect((await session.getHold(requestId)).status).toBe("pending");
  });

  it("rejects an approval of an amount the relay misreported", async () => {
    const session = await connect({ approvalThreshold: "50000000" });
    const held = await rejection(session.requestPayment({ invoice: invoice("80000000"), amount: "80000000" }));
    const real = await session.getHold(held.requestId as string);

    const shownByLyingRelay = { ...real, amount: "1000" };
    expect((await rejection(wallet.decide(shownByLyingRelay, "approve"))).reason).toBe("decision_mismatch");
    expect((await session.getHold(real.requestId)).status).toBe("pending");
  });

  it("caps payments per window and says when to retry", async () => {
    const session = await connect({ rateLimit: { maxPayments: 2, windowSeconds: 3600 } });
    await session.requestPayment({ invoice: invoice("1000"), amount: "1000" });
    await session.requestPayment({ invoice: invoice("1000"), amount: "1000" });

    const limited = await rejection(session.requestPayment({ invoice: invoice("1000"), amount: "1000" }));
    expect(limited.code).toBe("rate_limit_exceeded");
    expect(limited.retryAfterSeconds).toBe(3600);
    expect((await session.getCapabilities()).rateLimit).toEqual({ maxPayments: 2, windowSeconds: 3600 });
  });

  it("lets the owner, not the app, revoke from the wallet", async () => {
    const session = await connect();
    const stranger = createClaspWallet({ serverUrl: base, now: () => now });
    expect((await rejection(stranger.revoke(session.sessionId))).code).toBe("invalid_signature");
    expect((await wallet.revoke(session.sessionId)).state).toBe("REVOKED");
  });

  it("refuses an approval that would widen what the app asked for", async () => {
    await expect(connect({ maxSessionSpend: "999000000" })).rejects.toThrow(/cannot raise/);
    await expect(connect({ permissions: ["payments:auto"] })).rejects.toThrow(/cannot add permissions/);
  });

  it("only lets listed owners pair when the wallet core has an owner list", async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const listed = generateKeypair();
    await start([listed.publicKey]);
    const health = (await (await fetch(`${base}/health`)).json()) as { owners: string };
    expect(health.owners).toBe("allow-list");

    const outsider = createClaspWallet({ serverUrl: base, now: () => now });
    expect((await rejection(connect({}, outsider))).code).toBe("permission_denied");

    const ownerWallet = createClaspWallet({ serverUrl: base, ownerKeypair: listed, now: () => now });
    expect((await connect({}, ownerWallet)).sessionId).toBeTruthy();
  });
});
