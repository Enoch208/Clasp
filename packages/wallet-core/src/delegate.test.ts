import { describe, it, expect } from "vitest";
import {
  isClaspError,
  type ClaspError,
  type DelegationRequest,
  type OperationRequest,
  type SessionFacts,
} from "@clasp/protocol";
import { generateKeypair, signSession, signDelegation, signRequest, verifySession } from "@clasp/token";
import { FakeGateway } from "@clasp/gateway";
import { Store } from "./store";
import { evaluate } from "./engine";
import { delegate, type DelegateContext, type DelegateResult } from "./delegate";

const NOW = 1_700_000_000_000;

function setup(parentOverrides: Partial<SessionFacts> = {}) {
  const wallet = generateKeypair();
  const parentApp = generateKeypair();
  const childApp = generateKeypair();
  const store = new Store(":memory:");
  const gateway = new FakeGateway();

  const parentFacts: SessionFacts = {
    sessionId: "parent_1",
    origin: "https://good.app",
    permissions: ["payments:auto", "payments:request", "payments:read"],
    asset: "BTC",
    maxSinglePayment: "50000000",
    maxSessionSpend: "100000000",
    expiresAt: String(NOW + 3_600_000),
    appPubKey: parentApp.publicKey,
    ...parentOverrides,
  };
  store.createSession(parentFacts, NOW);
  const parentToken = signSession(parentFacts, wallet.privateKey);

  let counter = 0;
  const newSessionId = () => `child_${(counter += 1)}`;
  const ctx = (overrides: Partial<DelegateContext> = {}): DelegateContext => ({
    store,
    walletKeys: wallet,
    now: NOW,
    origin: parentFacts.origin,
    newSessionId,
    ...overrides,
  });

  function delegationRequest(overrides: Partial<DelegationRequest> = {}, signWith = parentApp.privateKey): DelegationRequest {
    const unsigned: Omit<DelegationRequest, "signature"> = {
      version: "1",
      parentSessionId: "parent_1",
      delegationId: "del_1",
      childAppPubKey: childApp.publicKey,
      permissions: ["payments:request"],
      asset: "BTC",
      maxSinglePayment: "20000000",
      maxSessionSpend: "40000000",
      expiresAt: String(NOW + 1_800_000),
      timestamp: Math.floor(NOW / 1000),
      ...overrides,
    };
    return { ...unsigned, signature: signDelegation(unsigned, signWith) };
  }

  async function payFrom(
    sessionId: string,
    token: string,
    appPrivateKey: string,
    options: { amount: string; nonce: number; requestId: string; operation?: OperationRequest["operation"] },
  ) {
    const invoice = (await gateway.newInvoice({ amount: options.amount, asset: "BTC" })).invoice;
    const unsigned: Omit<OperationRequest, "signature"> = {
      version: "1",
      sessionId,
      requestId: options.requestId,
      operation: options.operation ?? "payments:request",
      parameters: { invoice, amount: options.amount, asset: "BTC" },
      nonce: options.nonce,
      timestamp: Math.floor(NOW / 1000),
    };
    const request = { ...unsigned, signature: signRequest(unsigned, appPrivateKey) };
    return evaluate(request, { store, gateway, walletKeys: wallet, now: NOW, origin: "https://good.app", token });
  }

  return { wallet, parentApp, childApp, store, gateway, parentToken, ctx, delegationRequest, payFrom };
}

describe("delegate — happy path", () => {
  it("mints an attenuated child bound to the parent, signed by the wallet", () => {
    const s = setup();
    const result = delegate(s.delegationRequest(), s.parentToken, s.ctx());

    expect(isClaspError(result)).toBe(false);
    const { child, childToken, childSessionId } = result as DelegateResult;
    expect(childSessionId).toBe("child_1");
    expect(child.parentId).toBe("parent_1");
    expect(child.origin).toBe("https://good.app");
    expect(child.appPubKey).toBe(s.childApp.publicKey);
    expect(child.maxSessionSpend).toBe("40000000");
    expect(child.spent).toBe("0");

    const facts = verifySession(childToken, s.wallet.publicKey);
    expect(facts.sessionId).toBe("child_1");
    expect(facts.permissions).toEqual(["payments:request"]);
    expect(s.store.listEvents("parent_1").map((e) => e.type)).toContain("session_delegated");
  });
});

describe("delegate — shared-root spend accounting", () => {
  it("child spends draw down the parent's pool", async () => {
    const s = setup();
    const { childToken, childSessionId } = delegate(s.delegationRequest(), s.parentToken, s.ctx()) as DelegateResult;

    const result = await s.payFrom(childSessionId, childToken, s.childApp.privateKey, {
      amount: "20000000",
      nonce: 1,
      requestId: "creq_1",
    });

    expect(isClaspError(result)).toBe(false);
    expect(s.store.getSession(childSessionId)?.spent).toBe("20000000");
    expect(s.store.getSession("parent_1")?.spent).toBe("20000000");
  });

  it("a child cannot exceed the parent's remaining pool even within its own cap", async () => {
    const s = setup();
    const { childToken, childSessionId } = delegate(
      s.delegationRequest({ maxSessionSpend: "50000000" }),
      s.parentToken,
      s.ctx(),
    ) as DelegateResult;

    await s.payFrom("parent_1", s.parentToken, s.parentApp.privateKey, {
      amount: "50000000",
      nonce: 1,
      requestId: "preq_1",
    });
    await s.payFrom("parent_1", s.parentToken, s.parentApp.privateKey, {
      amount: "40000000",
      nonce: 2,
      requestId: "preq_2",
    });
    const blocked = await s.payFrom(childSessionId, childToken, s.childApp.privateKey, {
      amount: "20000000",
      nonce: 1,
      requestId: "creq_1",
    });

    expect(isClaspError(blocked)).toBe(true);
    expect((blocked as ClaspError).code).toBe("session_spending_limit_exceeded");
    expect(s.store.getSession("parent_1")?.spent).toBe("90000000");
    expect(s.store.getSession(childSessionId)?.spent).toBe("0");
  });

  it("a child is bound by its own cap even when the parent pool has room", async () => {
    const s = setup();
    const { childToken, childSessionId } = delegate(
      s.delegationRequest({ maxSessionSpend: "30000000" }),
      s.parentToken,
      s.ctx(),
    ) as DelegateResult;

    await s.payFrom(childSessionId, childToken, s.childApp.privateKey, {
      amount: "20000000",
      nonce: 1,
      requestId: "creq_1",
    });
    const blocked = await s.payFrom(childSessionId, childToken, s.childApp.privateKey, {
      amount: "20000000",
      nonce: 2,
      requestId: "creq_2",
    });

    expect((blocked as ClaspError).code).toBe("session_spending_limit_exceeded");
    expect(s.store.getSession(childSessionId)?.spent).toBe("20000000");
    expect(s.store.getSession("parent_1")?.spent).toBe("20000000");
  });
});

describe("delegate — attenuation is enforced on every axis", () => {
  const cases: { name: string; overrides: Partial<DelegationRequest>; reason: string }[] = [
    { name: "widen permissions", overrides: { permissions: ["payments:request", "invoices:create"] }, reason: "permissions_widen" },
    { name: "widen per-payment cap", overrides: { maxSinglePayment: "60000000" }, reason: "single_payment_widen" },
    { name: "widen session cap", overrides: { maxSessionSpend: "120000000" }, reason: "session_spend_widen" },
    { name: "widen expiry", overrides: { expiresAt: String(NOW + 7_200_000) }, reason: "expiry_widen" },
    { name: "change asset", overrides: { asset: "ETH" }, reason: "asset_mismatch" },
  ];

  for (const { name, overrides, reason } of cases) {
    it(`rejects a child that tries to ${name}`, () => {
      const s = setup();
      const result = delegate(s.delegationRequest(overrides), s.parentToken, s.ctx());
      expect(isClaspError(result)).toBe(true);
      const err = result as ClaspError;
      expect(err.code).toBe("attenuation_violation");
      expect(err.reason).toBe(reason);
    });
  }
});

describe("delegate — authority and authenticity", () => {
  it("requires the parent to hold payments:auto", () => {
    const s = setup({ permissions: ["payments:request", "payments:read"] });
    const result = delegate(s.delegationRequest(), s.parentToken, s.ctx());
    expect((result as ClaspError).code).toBe("permission_denied");
  });

  it("rejects a delegation not signed by the parent app key", () => {
    const s = setup();
    const forged = s.delegationRequest({}, s.childApp.privateKey);
    const result = delegate(forged, s.parentToken, s.ctx());
    expect((result as ClaspError).code).toBe("invalid_signature");
  });

  it("rejects a stale delegation", () => {
    const s = setup();
    const result = delegate(s.delegationRequest({ timestamp: Math.floor(NOW / 1000) - 600 }), s.parentToken, s.ctx());
    expect((result as ClaspError).code).toBe("stale_timestamp");
  });

  it("refuses to delegate from a revoked parent", () => {
    const s = setup();
    s.store.revoke("parent_1", NOW);
    const result = delegate(s.delegationRequest(), s.parentToken, s.ctx());
    expect((result as ClaspError).code).toBe("session_revoked");
  });

  it("forbids nesting — a child cannot itself delegate", () => {
    const s = setup();
    const { child, childToken } = delegate(
      s.delegationRequest({ permissions: ["payments:auto", "payments:request"] }),
      s.parentToken,
      s.ctx(),
    ) as DelegateResult;

    const grandchildApp = generateKeypair();
    const unsigned: Omit<DelegationRequest, "signature"> = {
      version: "1",
      parentSessionId: child.id,
      delegationId: "del_2",
      childAppPubKey: grandchildApp.publicKey,
      permissions: ["payments:request"],
      asset: "BTC",
      maxSinglePayment: "10000000",
      maxSessionSpend: "10000000",
      expiresAt: String(NOW + 900_000),
      timestamp: Math.floor(NOW / 1000),
    };
    const nested = { ...unsigned, signature: signDelegation(unsigned, s.childApp.privateKey) };
    const result = delegate(nested, childToken, s.ctx());

    expect((result as ClaspError).code).toBe("attenuation_violation");
    expect((result as ClaspError).reason).toBe("nesting_not_allowed");
  });
});
