import { describe, it, expect } from "vitest";
import {
  isClaspError,
  type ClaspError,
  type HoldView,
  type OperationResult,
  type PaymentDecision,
  type RevokeRequest,
  type SessionFacts,
} from "@clasp/protocol";
import { generateKeypair, signDecision, signRevoke, verifyResult, type Keypair } from "@clasp/token";
import type { SendPaymentParams } from "@clasp/gateway";
import { evaluate, HOLD_TTL_MS } from "./engine";
import { decideHold, listSessionHolds } from "./holds";
import { revokeSession } from "./revoke";
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

let current: Harness;

function decision(
  requestId: string,
  kind: PaymentDecision["decision"],
  signer: Keypair,
  at = NOW,
  overrides: Partial<PaymentDecision> = {},
): PaymentDecision {
  const hold = current.store.getHold(requestId)!;
  const unsigned = {
    version: "1" as const,
    requestId,
    sessionId: hold.sessionId,
    amount: hold.amount,
    invoice: hold.invoice,
    walletPubKey: current.wallet.publicKey,
    decision: kind,
    timestamp: Math.floor(at / 1000),
    ...overrides,
  };
  return { ...unsigned, signature: signDecision(unsigned, signer.privateKey) };
}

function settleCtx(h: Harness, now = NOW) {
  return { store: h.store, gateway: h.gateway, walletKeys: h.wallet, now };
}

function withRules(rules: Partial<SessionFacts>): Harness {
  current = newHarness({ ownerPubKey: owner.publicKey, ...rules });
  return current;
}

describe("rate cap", () => {
  it("allows maxPayments per window, then rejects with a retry hint", async () => {
    const h = withRules({ rateLimit: { maxPayments: 2, windowSeconds: 60 } });
    for (const nonce of [1, 2]) {
      const ok = await evaluate(await h.paymentRequest({ amount: "1000", nonce, requestId: `req_${nonce}` }), h.ctx());
      expect(isClaspError(ok)).toBe(false);
    }
    const err = asError(await evaluate(await h.paymentRequest({ amount: "1000", nonce: 3, requestId: "req_3" }), h.ctx()));
    expect(err.code).toBe("rate_limit_exceeded");
    expect(err.retryable).toBe(true);
    expect(err.nextAction).toBe("retry_later");
    expect(err.retryAfterSeconds).toBe(60);
    expect(h.store.getSession("sess_1")?.spent).toBe("2000");
  });

  it("frees capacity once the window has passed", async () => {
    const h = withRules({ rateLimit: { maxPayments: 1, windowSeconds: 60 } });
    await evaluate(await h.paymentRequest({ amount: "1000", nonce: 1, requestId: "req_1" }), h.ctx());
    const later = NOW + 61_000;
    const request = await h.paymentRequest({ amount: "1000", nonce: 2, requestId: "req_2", timestamp: Math.floor(later / 1000) });
    expect(isClaspError(await evaluate(request, h.ctx({ now: later })))).toBe(false);
  });

  it("holds under a concurrent burst: exactly maxPayments get through", async () => {
    const h = withRules({ rateLimit: { maxPayments: 3, windowSeconds: 3600 } });
    const sent = countPayments(h);
    const requests = await Promise.all(
      Array.from({ length: 10 }, (_, i) => h.paymentRequest({ amount: "1000", nonce: i + 1, requestId: `req_${i + 1}` })),
    );
    const results = await Promise.all(requests.map((request) => evaluate(request, h.ctx())));

    expect(results.filter((r) => !isClaspError(r))).toHaveLength(3);
    expect(results.filter(isClaspError).every((r) => (r as ClaspError).code === "rate_limit_exceeded")).toBe(true);
    expect(sent()).toBe(3);
    expect(h.store.getSession("sess_1")?.spent).toBe("3000");
  });

  it("reports the spend cap before the rate cap when both are hit", async () => {
    const h = withRules({ maxSessionSpend: "1000", rateLimit: { maxPayments: 1, windowSeconds: 60 } });
    await evaluate(await h.paymentRequest({ amount: "1000", nonce: 1, requestId: "req_1" }), h.ctx());
    const err = asError(await evaluate(await h.paymentRequest({ amount: "1000", nonce: 2, requestId: "req_2" }), h.ctx()));
    expect(err.code).toBe("session_spending_limit_exceeded");
  });
});

describe("approval above an amount", () => {
  async function heldPayment(h: Harness, amount = "30000000", requestId = "req_big") {
    const request = await h.paymentRequest({ amount, nonce: 1, requestId });
    return asError(await evaluate(request, h.ctx()));
  }

  it("settles payments at or under the threshold without asking", async () => {
    const h = withRules({ approvalThreshold: "20000000" });
    const result = await evaluate(await h.paymentRequest({ amount: "20000000", nonce: 1, requestId: "req_1" }), h.ctx());
    expect(isClaspError(result)).toBe(false);
  });

  it("holds a payment above the threshold: reserved, not sent, owner asked", async () => {
    const h = withRules({ approvalThreshold: "20000000" });
    const sent = countPayments(h);
    const err = await heldPayment(h);

    expect(err.code).toBe("approval_required");
    expect(err.nextAction).toBe("await_approval");
    expect(err.requestId).toBe("req_big");
    expect(err.holdExpiresAt).toBe(new Date(NOW + HOLD_TTL_MS).toISOString());
    expect(sent()).toBe(0);
    expect(h.store.getSession("sess_1")?.spent).toBe("30000000");
    expect(listSessionHolds(h.store, "sess_1", NOW)?.map((hold) => hold.status)).toEqual(["pending"]);
  });

  it("settles once the owner approves, with a wallet-signed receipt", async () => {
    const h = withRules({ approvalThreshold: "20000000" });
    const sent = countPayments(h);
    await heldPayment(h);

    const view = (await decideHold(decision("req_big", "approve", owner), settleCtx(h))) as HoldView;
    expect(view.status).toBe("settled");
    expect(sent()).toBe(1);
    expect(verifyResult(view.result as OperationResult, h.wallet.publicKey)).toBe(true);
    expect(view.result?.sessionRemaining).toBe("70000000");
  });

  it("never pays twice, even with concurrent approvals", async () => {
    const h = withRules({ approvalThreshold: "20000000" });
    const sent = countPayments(h);
    await heldPayment(h);

    await Promise.all([
      decideHold(decision("req_big", "approve", owner), settleCtx(h)),
      decideHold(decision("req_big", "approve", owner), settleCtx(h)),
    ]);
    await decideHold(decision("req_big", "approve", owner), settleCtx(h));
    expect(sent()).toBe(1);
    expect(h.store.getSession("sess_1")?.spent).toBe("30000000");
  });

  it("refunds the reservation when the owner declines", async () => {
    const h = withRules({ approvalThreshold: "20000000" });
    const sent = countPayments(h);
    await heldPayment(h);

    const view = (await decideHold(decision("req_big", "deny", owner), settleCtx(h))) as HoldView;
    expect(view.status).toBe("denied");
    expect(sent()).toBe(0);
    expect(h.store.getSession("sess_1")?.spent).toBe("0");
  });

  it("rejects an approval signed by the app itself", async () => {
    const h = withRules({ approvalThreshold: "20000000" });
    const sent = countPayments(h);
    await heldPayment(h);

    const err = asError(await decideHold(decision("req_big", "approve", h.app), settleCtx(h)));
    expect(err.code).toBe("invalid_signature");
    expect(err.reason).toBe("owner_signature");
    expect(sent()).toBe(0);
    expect(listSessionHolds(h.store, "sess_1", NOW)?.[0]?.status).toBe("pending");
  });

  it("expires an unanswered hold and refunds it", async () => {
    const h = withRules({ approvalThreshold: "20000000" });
    await heldPayment(h);
    const later = NOW + HOLD_TTL_MS + 1;

    const err = asError(await decideHold(decision("req_big", "approve", owner, later), settleCtx(h, later)));
    expect(err.code).toBe("approval_expired");
    expect(h.store.getSession("sess_1")?.spent).toBe("0");
  });

  it("cancels pending holds when the session is revoked", async () => {
    const h = withRules({ approvalThreshold: "20000000" });
    await heldPayment(h);
    h.store.revoke("sess_1", NOW);

    expect(listSessionHolds(h.store, "sess_1", NOW)?.[0]?.status).toBe("cancelled");
    expect(h.store.getSession("sess_1")?.spent).toBe("0");
    const view = (await decideHold(decision("req_big", "approve", owner), settleCtx(h))) as HoldView;
    expect(view.status).toBe("cancelled");
  });

  it("counts held amounts against the session cap", async () => {
    const h = withRules({ approvalThreshold: "20000000", maxSinglePayment: "60000000", maxSessionSpend: "100000000" });
    await heldPayment(h, "60000000", "req_a");
    const second = await h.paymentRequest({ amount: "60000000", nonce: 2, requestId: "req_b" });
    expect(asError(await evaluate(second, h.ctx())).code).toBe("session_spending_limit_exceeded");
  });
});

describe("signed revoke", () => {
  function revokeRequest(by: RevokeRequest["by"], signer: Keypair, sessionId = "sess_1"): RevokeRequest {
    const unsigned = { version: "1" as const, sessionId, by, timestamp: Math.floor(NOW / 1000) };
    return { ...unsigned, signature: signRevoke(unsigned, signer.privateKey) };
  }

  it("accepts the app's own key and the owner's key", () => {
    const viaApp = withRules({});
    expect((revokeSession(revokeRequest("app", viaApp.app), viaApp.store, NOW) as { state: string }).state).toBe("REVOKED");
    const viaOwner = withRules({});
    expect((revokeSession(revokeRequest("owner", owner), viaOwner.store, NOW) as { state: string }).state).toBe("REVOKED");
  });

  it("rejects anyone else, and leaves the session active", () => {
    const h = withRules({});
    const stranger = generateKeypair();
    expect(asError(revokeSession(revokeRequest("owner", stranger), h.store, NOW)).code).toBe("invalid_signature");
    expect(asError(revokeSession(revokeRequest("app", stranger), h.store, NOW)).code).toBe("invalid_signature");
    expect(h.store.getSession("sess_1")?.state).toBe("ACTIVE");
  });

  it("rejects an owner revoke on a session that has no owner", () => {
    const h = newHarness();
    expect(asError(revokeSession(revokeRequest("owner", owner), h.store, NOW)).code).toBe("invalid_signature");
  });
});
