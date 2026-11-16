import { describe, it, expect } from "vitest";
import {
  isClaspError,
  sessionApprovalSchema,
  type ClaspError,
  type DelegationRequest,
  type PaymentDecision,
  type SessionApproval,
} from "@clasp/protocol";
import {
  generateKeypair,
  signApproval,
  signDecision,
  signDelegation,
  signRequest,
  signSession,
  type Keypair,
} from "@clasp/token";
import type { SendPaymentParams } from "@clasp/gateway";
import { evaluate, HOLD_TTL_MS, sessionToFacts } from "./engine";
import { decideHold } from "./holds";
import { createApprovedSession } from "./approve";
import { delegate } from "./delegate";
import { newHarness, NOW, type Harness } from "./test-harness";

const owner = generateKeypair();

function asError(result: unknown): ClaspError {
  expect(isClaspError(result)).toBe(true);
  return result as ClaspError;
}

function countPayments(h: Harness): () => number {
  let sent = 0;
  const original = h.gateway.sendPayment.bind(h.gateway);
  h.gateway.sendPayment = (params: SendPaymentParams) => {
    sent += 1;
    return original(params);
  };
  return () => sent;
}

function signedDecision(h: Harness, requestId: string, overrides: Partial<PaymentDecision> = {}, signer: Keypair = owner) {
  const hold = h.store.getHold(requestId)!;
  const unsigned = {
    version: "1" as const,
    requestId,
    sessionId: hold.sessionId,
    amount: hold.amount,
    invoice: hold.invoice,
    walletPubKey: h.wallet.publicKey,
    decision: "approve" as const,
    timestamp: Math.floor(NOW / 1000),
    ...overrides,
  };
  return { ...unsigned, signature: signDecision(unsigned, signer.privateKey) };
}

async function hold(h: Harness, amount: string, requestId: string, nonce: number) {
  const err = asError(await evaluate(await h.paymentRequest({ amount, nonce, requestId }), h.ctx()));
  expect(err.code).toBe("approval_required");
}

describe("decisions are bound to the exact payment", () => {
  it("rejects an approval signed for a different amount than the hold (lying relay)", async () => {
    const h = newHarness({ ownerPubKey: owner.publicKey, approvalThreshold: "1000" });
    const sent = countPayments(h);
    await hold(h, "50000000", "req_big", 1);

    const err = asError(
      await decideHold(signedDecision(h, "req_big", { amount: "1000" }), { store: h.store, gateway: h.gateway, walletKeys: h.wallet, now: NOW }),
    );
    expect(err.reason).toBe("decision_mismatch");
    expect(sent()).toBe(0);
  });

  it("rejects an approval meant for another wallet core", async () => {
    const h = newHarness({ ownerPubKey: owner.publicKey, approvalThreshold: "1000" });
    await hold(h, "50000000", "req_big", 1);
    const other = generateKeypair();

    const err = asError(
      await decideHold(signedDecision(h, "req_big", { walletPubKey: other.publicKey }), {
        store: h.store,
        gateway: h.gateway,
        walletKeys: h.wallet,
        now: NOW,
      }),
    );
    expect(err.reason).toBe("decision_mismatch");
  });

  it("stops honouring an owner who was removed from the owner list", async () => {
    const h = newHarness({ ownerPubKey: owner.publicKey, approvalThreshold: "1000" });
    await hold(h, "50000000", "req_big", 1);
    const err = asError(
      await decideHold(signedDecision(h, "req_big"), {
        store: h.store,
        gateway: h.gateway,
        walletKeys: h.wallet,
        now: NOW,
        owners: [generateKeypair().publicKey],
      }),
    );
    expect(err.code).toBe("permission_denied");
  });
});

describe("approvals are bound to one wallet and a real expiry", () => {
  function approval(wallet: Keypair, overrides: Partial<SessionApproval> = {}): SessionApproval {
    const unsigned: Omit<SessionApproval, "signature"> = {
      version: "1",
      approvalId: `apr_${Math.random()}`,
      origin: "https://good.app",
      permissions: ["payments:request"],
      asset: "BTC",
      maxSinglePayment: "1000",
      maxSessionSpend: "5000",
      expiresAt: String(NOW + 3_600_000),
      appPubKey: generateKeypair().publicKey,
      ownerPubKey: owner.publicKey,
      walletPubKey: wallet.publicKey,
      timestamp: Math.floor(NOW / 1000),
      ...overrides,
    };
    return { ...unsigned, signature: signApproval(unsigned, owner.privateKey) };
  }

  it("refuses an approval signed for another wallet core", () => {
    const h = newHarness();
    const ctx = { store: h.store, walletKeys: h.wallet, now: NOW, newSessionId: () => "sess_x", owners: null };
    const err = asError(createApprovedSession(approval(generateKeypair()), ctx));
    expect(err.reason).toBe("wallet_mismatch");
  });

  it("refuses an expiry that never comes, at the schema and in the core", () => {
    const h = newHarness();
    const forever = approval(h.wallet, { expiresAt: "never" });
    expect(sessionApprovalSchema.safeParse(forever).success).toBe(false);
    const ctx = { store: h.store, walletKeys: h.wallet, now: NOW, newSessionId: () => "sess_x", owners: null };
    expect(asError(createApprovedSession(forever, ctx)).code).toBe("session_expired");
  });

  it("refuses a delegation that would never expire", () => {
    const h = newHarness({ permissions: ["payments:auto", "payments:request"] });
    const unsigned: Omit<DelegationRequest, "signature"> = {
      version: "1",
      parentSessionId: "sess_1",
      delegationId: "del_1",
      childAppPubKey: generateKeypair().publicKey,
      permissions: ["payments:request"],
      asset: "BTC",
      maxSinglePayment: "1000",
      maxSessionSpend: "5000",
      expiresAt: "never",
      timestamp: Math.floor(NOW / 1000),
    };
    const request = { ...unsigned, signature: signDelegation(unsigned, h.app.privateKey) };
    const err = asError(
      delegate(request, h.token, { store: h.store, walletKeys: h.wallet, now: NOW, origin: "https://good.app", newSessionId: () => "child_1" }),
    );
    expect(err.reason).toBe("expiry_widen");
  });

  it("refuses an approval threshold on a sub-agent nobody can approve for", () => {
    const h = newHarness({ permissions: ["payments:auto", "payments:request"] });
    const unsigned: Omit<DelegationRequest, "signature"> = {
      version: "1",
      parentSessionId: "sess_1",
      delegationId: "del_1",
      childAppPubKey: generateKeypair().publicKey,
      permissions: ["payments:request"],
      asset: "BTC",
      maxSinglePayment: "1000",
      maxSessionSpend: "5000",
      expiresAt: String(NOW + 60_000),
      approvalThreshold: "500",
      timestamp: Math.floor(NOW / 1000),
    };
    const request = { ...unsigned, signature: signDelegation(unsigned, h.app.privateKey) };
    const err = asError(
      delegate(request, h.token, { store: h.store, walletKeys: h.wallet, now: NOW, origin: "https://good.app", newSessionId: () => "child_1" }),
    );
    expect(err.reason).toBe("threshold_without_owner");
  });
});

describe("reservations see the session as it is at reserve time", () => {
  it("releases expired holds before the next reservation, unread", async () => {
    const h = newHarness({
      ownerPubKey: owner.publicKey,
      approvalThreshold: "1000",
      maxSinglePayment: "50000000",
      maxSessionSpend: "100000000",
    });
    await hold(h, "50000000", "req_a", 1);
    await hold(h, "50000000", "req_b", 2);
    const later = NOW + HOLD_TTL_MS + 1;

    const small = await h.paymentRequest({ amount: "100", nonce: 3, requestId: "req_c", timestamp: Math.floor(later / 1000) });
    expect(isClaspError(await evaluate(small, h.ctx({ now: later })))).toBe(false);
    expect(h.store.getSession("sess_1")?.spent).toBe("100");
    expect(h.store.getHold("req_a")?.status).toBe("expired");
  });

  it("refuses a payment whose session was revoked while it was in flight", async () => {
    const h = newHarness();
    const sent = countPayments(h);
    const decode = h.gateway.getInvoice.bind(h.gateway);
    h.gateway.getInvoice = async (invoice: string) => {
      h.store.revoke("sess_1", NOW);
      return decode(invoice);
    };

    const err = asError(await evaluate(await h.paymentRequest({ amount: "1000", nonce: 1, requestId: "req_1" }), h.ctx()));
    expect(err.code).toBe("session_revoked");
    expect(sent()).toBe(0);
    expect(h.store.getSession("sess_1")?.spent).toBe("0");
  });

  it("refuses a sub-agent payment once its parent has expired", async () => {
    const h = newHarness({ permissions: ["payments:auto", "payments:request"], expiresAt: String(NOW + 60_000) });
    const child = generateKeypair();
    const childFacts = {
      ...sessionToFacts(h.store.getSession("sess_1")!),
      sessionId: "child_1",
      appPubKey: child.publicKey,
      expiresAt: String(NOW + 3_600_000),
    };
    h.store.createSession({ ...childFacts, parentId: "sess_1" }, NOW);
    const later = NOW + 120_000;
    const invoice = (await h.gateway.newInvoice({ amount: "1000", asset: "BTC" })).invoice;
    const unsigned = {
      version: "1" as const,
      sessionId: "child_1",
      requestId: "req_child",
      operation: "payments:request" as const,
      parameters: { invoice, amount: "1000", asset: "BTC" },
      nonce: 1,
      timestamp: Math.floor(later / 1000),
    };
    const request = { ...unsigned, signature: signRequest(unsigned, child.privateKey) };

    const err = asError(
      await evaluate(request, h.ctx({ now: later, token: signSession(childFacts, h.wallet.privateKey) })),
    );
    expect(err.code).toBe("session_expired");
  });
});
