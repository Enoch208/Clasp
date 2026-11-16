import { describe, it, expect } from "vitest";
import {
  isClaspError,
  type ClaspError,
  type DelegationRequest,
  type HoldView,
  type OperationRequest,
  type SessionApproval,
} from "@clasp/protocol";
import {
  generateKeypair,
  signApproval,
  signDecision,
  signDelegation,
  signRequest,
  verifySession,
} from "@clasp/token";
import { FakeGateway } from "@clasp/gateway";
import { Store } from "./store";
import { evaluate } from "./engine";
import { delegate, type DelegateResult } from "./delegate";
import { createApprovedSession, type ApprovedSession } from "./approve";
import { decideHold } from "./holds";

const NOW = 1_700_000_000_000;

function setup(owners: string[] | null = null) {
  const wallet = generateKeypair();
  const owner = generateKeypair();
  const app = generateKeypair();
  const store = new Store(":memory:");
  const gateway = new FakeGateway();
  let counter = 0;
  const newSessionId = () => `sess_${(counter += 1)}`;
  const ctx = { store, walletKeys: wallet, now: NOW, newSessionId, owners };

  function approval(overrides: Partial<SessionApproval> = {}, signer = owner.privateKey): SessionApproval {
    const unsigned: Omit<SessionApproval, "signature"> = {
      version: "1",
      approvalId: "apr_1",
      origin: "https://good.app",
      permissions: ["payments:auto", "payments:request"],
      asset: "CKB",
      maxSinglePayment: "50000000",
      maxSessionSpend: "100000000",
      expiresAt: String(NOW + 3_600_000),
      appPubKey: app.publicKey,
      approvalThreshold: "20000000",
      rateLimit: { maxPayments: 5, windowSeconds: 3600 },
      ownerPubKey: owner.publicKey,
      walletPubKey: wallet.publicKey,
      timestamp: Math.floor(NOW / 1000),
      ...overrides,
    };
    return { ...unsigned, signature: signApproval(unsigned, signer) };
  }

  return { wallet, owner, app, store, gateway, ctx, approval };
}

function asError(result: unknown): ClaspError {
  expect(isClaspError(result)).toBe(true);
  return result as ClaspError;
}

describe("owner-approved sessions", () => {
  it("creates a session carrying the owner's rules, signed into the token", () => {
    const s = setup();
    const created = createApprovedSession(s.approval(), s.ctx) as ApprovedSession;

    expect(created.session.ownerPubKey).toBe(s.owner.publicKey);
    const facts = verifySession(created.token, s.wallet.publicKey);
    expect(facts.approvalThreshold).toBe("20000000");
    expect(facts.rateLimit).toEqual({ maxPayments: 5, windowSeconds: 3600 });
    expect(facts.ownerPubKey).toBe(s.owner.publicKey);
  });

  it("rejects an approval the app signed for itself under the owner's name", () => {
    const s = setup();
    const forged = s.approval({}, s.app.privateKey);
    expect(asError(createApprovedSession(forged, s.ctx)).code).toBe("invalid_signature");
  });

  it("rejects an approval whose cap was raised after the owner signed", () => {
    const s = setup();
    const widened = { ...s.approval(), maxSessionSpend: "900000000" };
    expect(asError(createApprovedSession(widened, s.ctx)).code).toBe("invalid_signature");
  });

  it("refuses to mint a second session from the same approval", () => {
    const s = setup();
    createApprovedSession(s.approval(), s.ctx);
    expect(asError(createApprovedSession(s.approval(), s.ctx)).code).toBe("replay_detected");
  });

  it("rejects a stale approval", () => {
    const s = setup();
    const stale = s.approval({ timestamp: Math.floor(NOW / 1000) - 600 });
    expect(asError(createApprovedSession(stale, s.ctx)).code).toBe("stale_timestamp");
  });

  it("only accepts listed owners when the wallet has an owner list", () => {
    const listed = setup();
    const ctx = { ...listed.ctx, owners: [listed.owner.publicKey] };
    expect(isClaspError(createApprovedSession(listed.approval(), ctx))).toBe(false);

    const stranger = generateKeypair();
    const err = asError(
      createApprovedSession(listed.approval({ approvalId: "apr_2", ownerPubKey: stranger.publicKey }, stranger.privateKey), ctx),
    );
    expect(err.code).toBe("permission_denied");
    expect(err.reason).toBe("owner_not_allowed");
  });
});

describe("delegation keeps the owner's rules", () => {
  function withParent() {
    const s = setup();
    const parent = createApprovedSession(s.approval(), s.ctx) as ApprovedSession;
    const child = generateKeypair();
    const delegateCtx = { store: s.store, walletKeys: s.wallet, now: NOW, origin: "https://good.app", newSessionId: () => "child_1" };

    function request(overrides: Partial<DelegationRequest> = {}): DelegationRequest {
      const unsigned: Omit<DelegationRequest, "signature"> = {
        version: "1",
        parentSessionId: parent.sessionId,
        delegationId: "del_1",
        childAppPubKey: child.publicKey,
        permissions: ["payments:request"],
        asset: "CKB",
        maxSinglePayment: "50000000",
        maxSessionSpend: "100000000",
        expiresAt: String(NOW + 1_800_000),
        timestamp: Math.floor(NOW / 1000),
        ...overrides,
      };
      return { ...unsigned, signature: signDelegation(unsigned, s.app.privateKey) };
    }

    return { ...s, parent, child, delegateCtx, request };
  }

  it("inherits the owner, threshold and rate cap when the child omits them", () => {
    const s = withParent();
    const { child } = delegate(s.request(), s.parent.token, s.delegateCtx) as DelegateResult;
    expect(child.ownerPubKey).toBe(s.owner.publicKey);
    expect(child.approvalThreshold).toBe("20000000");
    expect(child.rateLimit).toEqual({ maxPayments: 5, windowSeconds: 3600 });
  });

  it("accepts a stricter threshold and rate cap", () => {
    const s = withParent();
    const result = delegate(
      s.request({ approvalThreshold: "1000", rateLimit: { maxPayments: 1, windowSeconds: 7200 } }),
      s.parent.token,
      s.delegateCtx,
    ) as DelegateResult;
    expect(result.child.approvalThreshold).toBe("1000");
  });

  it("refuses a child that would raise the approval threshold", () => {
    const s = withParent();
    const err = asError(delegate(s.request({ approvalThreshold: "30000000" }), s.parent.token, s.delegateCtx));
    expect(err.code).toBe("attenuation_violation");
    expect(err.reason).toBe("approval_threshold_widen");
  });

  it("refuses a child that would loosen the rate cap", () => {
    const s = withParent();
    for (const rateLimit of [
      { maxPayments: 6, windowSeconds: 3600 },
      { maxPayments: 5, windowSeconds: 60 },
    ]) {
      const err = asError(delegate(s.request({ rateLimit }), s.parent.token, s.delegateCtx));
      expect(err.reason).toBe("rate_limit_widen");
    }
  });

  it("counts sub-agent payments against the parent's rate cap", async () => {
    const s = withParent();
    const created = delegate(s.request(), s.parent.token, s.delegateCtx) as DelegateResult;
    const ctx = { store: s.store, gateway: s.gateway, walletKeys: s.wallet, now: NOW, origin: "https://good.app" };

    async function pay(sessionId: string, token: string, privateKey: string, nonce: number) {
      const invoice = (await s.gateway.newInvoice({ amount: "1000", asset: "CKB" })).invoice;
      const unsigned: Omit<OperationRequest, "signature"> = {
        version: "1",
        sessionId,
        requestId: `req_${sessionId}_${nonce}`,
        operation: "payments:request",
        parameters: { invoice, amount: "1000", asset: "CKB" },
        nonce,
        timestamp: Math.floor(NOW / 1000),
      };
      return evaluate({ ...unsigned, signature: signRequest(unsigned, privateKey) }, { ...ctx, token });
    }

    for (const nonce of [1, 2, 3]) {
      expect(isClaspError(await pay(s.parent.sessionId, s.parent.token, s.app.privateKey, nonce))).toBe(false);
    }
    for (const nonce of [1, 2]) {
      expect(isClaspError(await pay(created.childSessionId, created.childToken, s.child.privateKey, nonce))).toBe(false);
    }
    const err = asError(await pay(created.childSessionId, created.childToken, s.child.privateKey, 3));
    expect(err.code).toBe("rate_limit_exceeded");
    expect(asError(await pay(s.parent.sessionId, s.parent.token, s.app.privateKey, 4)).code).toBe("rate_limit_exceeded");
  });

  it("holds a sub-agent's large payment for the parent's owner", async () => {
    const s = withParent();
    const created = delegate(s.request(), s.parent.token, s.delegateCtx) as DelegateResult;
    const invoice = (await s.gateway.newInvoice({ amount: "30000000", asset: "CKB" })).invoice;
    const unsigned: Omit<OperationRequest, "signature"> = {
      version: "1",
      sessionId: created.childSessionId,
      requestId: "req_child_big",
      operation: "payments:request",
      parameters: { invoice, amount: "30000000", asset: "CKB" },
      nonce: 1,
      timestamp: Math.floor(NOW / 1000),
    };
    const held = asError(
      await evaluate(
        { ...unsigned, signature: signRequest(unsigned, s.child.privateKey) },
        { store: s.store, gateway: s.gateway, walletKeys: s.wallet, now: NOW, origin: "https://good.app", token: created.childToken },
      ),
    );
    expect(held.code).toBe("approval_required");

    const hold = s.store.getHold("req_child_big")!;
    const decision = {
      version: "1" as const,
      requestId: "req_child_big",
      sessionId: hold.sessionId,
      amount: hold.amount,
      invoice: hold.invoice,
      walletPubKey: s.wallet.publicKey,
      decision: "approve" as const,
      timestamp: Math.floor(NOW / 1000),
    };
    const view = (await decideHold(
      { ...decision, signature: signDecision(decision, s.owner.privateKey) },
      { store: s.store, gateway: s.gateway, walletKeys: s.wallet, now: NOW },
    )) as HoldView;
    expect(view.status).toBe("settled");
    expect(s.store.getSession(s.parent.sessionId)?.spent).toBe("30000000");
  });
});
