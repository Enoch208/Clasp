import {
  claspError,
  isClaspError,
  subAmounts,
  type ClaspError,
  type HoldView,
  type OperationResult,
  type PaymentDecision,
} from "@clasp/protocol";
import { verifyDecision } from "@clasp/token";
import { FRESHNESS_WINDOW_MS, settlePayment, type SettleContext } from "./engine";

export interface DecideContext extends SettleContext {
  owners?: readonly string[] | null;
}
import type { Store, StoredHold } from "./store";

export function holdView(hold: StoredHold): HoldView {
  return {
    requestId: hold.requestId,
    sessionId: hold.sessionId,
    amount: hold.amount,
    asset: hold.asset,
    invoice: hold.invoice,
    ...(hold.purpose ? { purpose: hold.purpose } : {}),
    status: hold.status,
    createdAt: new Date(hold.createdAt).toISOString(),
    expiresAt: new Date(hold.expiresAt).toISOString(),
    ...(hold.result ? { result: JSON.parse(hold.result) as OperationResult } : {}),
  };
}

export function expireHoldIfDue(store: Store, requestId: string, now: number): StoredHold | undefined {
  const hold = store.getHold(requestId);
  if (!hold) return undefined;
  if (hold.status === "pending" && now >= hold.expiresAt) {
    if (store.closeHold(requestId, "pending", "expired", { refund: true })) {
      store.appendEvent(hold.sessionId, "payment_expired", { requestId }, now);
    }
    return store.getHold(requestId);
  }
  return hold;
}

export function listSessionHolds(store: Store, sessionId: string, now: number): HoldView[] | null {
  const session = store.getSession(sessionId);
  if (!session) return null;
  const ids = session.parentId ? [session.id] : store.sessionFamily(session.id);
  return store
    .listHolds(ids)
    .map((hold) => expireHoldIfDue(store, hold.requestId, now) ?? hold)
    .map(holdView);
}

function decisionMatches(decision: PaymentDecision, hold: StoredHold, walletPubKey: string): boolean {
  return (
    decision.sessionId === hold.sessionId &&
    decision.amount === hold.amount &&
    decision.invoice === hold.invoice &&
    decision.walletPubKey === walletPubKey
  );
}

export async function decideHold(decision: PaymentDecision, ctx: DecideContext): Promise<HoldView | ClaspError | null> {
  const { store, now, owners } = ctx;
  const found = store.getHold(decision.requestId);
  if (!found) return null;

  let session = store.getSession(found.sessionId);
  if (!session?.ownerPubKey || !verifyDecision(decision, session.ownerPubKey)) {
    return claspError("invalid_signature", { reason: "owner_signature" });
  }
  if (!decisionMatches(decision, found, ctx.walletKeys.publicKey)) {
    return claspError("invalid_signature", { reason: "decision_mismatch" });
  }
  if (owners && !owners.includes(session.ownerPubKey)) {
    return claspError("permission_denied", { reason: "owner_not_allowed" });
  }
  if (Math.abs(now - decision.timestamp * 1000) > FRESHNESS_WINDOW_MS) {
    return claspError("stale_timestamp", { now, timestamp: decision.timestamp });
  }

  const hold = expireHoldIfDue(store, found.requestId, now) ?? found;
  if (hold.status === "expired") return claspError("approval_expired", { requestId: hold.requestId });
  if (hold.status !== "pending") return holdView(hold);

  session = store.expireIfDue(session.id, now) ?? session;
  if (session.state !== "ACTIVE") {
    store.closeHold(hold.requestId, "pending", "cancelled", { refund: true });
    const code = session.state === "EXPIRED" ? "session_expired" : "session_revoked";
    return claspError(code, { sessionId: session.id });
  }

  if (decision.decision === "deny") {
    if (store.closeHold(hold.requestId, "pending", "denied", { refund: true })) {
      store.appendEvent(session.id, "payment_denied", { requestId: hold.requestId, amount: hold.amount }, now);
    }
    return holdView(store.getHold(hold.requestId)!);
  }

  if (!store.closeHold(hold.requestId, "pending", "approving")) return holdView(store.getHold(hold.requestId)!);
  store.appendEvent(session.id, "payment_approved", { requestId: hold.requestId, amount: hold.amount }, now);

  const current = store.getSession(session.id)!;
  const result = await settlePayment(
    {
      requestId: hold.requestId,
      sessionId: hold.sessionId,
      invoice: hold.invoice,
      amount: hold.amount,
      asset: hold.asset,
      sessionRemaining: subAmounts(current.maxSessionSpend, current.spent),
    },
    ctx,
  );
  if (isClaspError(result)) {
    store.closeHold(hold.requestId, "approving", "failed");
    return holdView(store.getHold(hold.requestId)!);
  }
  store.closeHold(hold.requestId, "approving", "settled", { result: JSON.stringify(result) });
  return holdView(store.getHold(hold.requestId)!);
}
