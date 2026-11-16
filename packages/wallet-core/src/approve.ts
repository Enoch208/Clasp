import { claspError, expiryToMillis, type ClaspError, type SessionApproval } from "@clasp/protocol";
import { signSession, verifyApproval, type Keypair } from "@clasp/token";
import { FRESHNESS_WINDOW_MS, sessionToFacts } from "./engine";
import { DuplicateApprovalError, type Store, type StoredSession } from "./store";

export interface ApproveContext {
  store: Store;
  walletKeys: Keypair;
  now: number;
  newSessionId: () => string;
  owners: readonly string[] | null;
}

export interface ApprovedSession {
  sessionId: string;
  token: string;
  session: StoredSession;
}

export function createApprovedSession(approval: SessionApproval, ctx: ApproveContext): ApprovedSession | ClaspError {
  const { store, walletKeys, now, newSessionId, owners } = ctx;

  if (!verifyApproval(approval)) return claspError("invalid_signature", { reason: "owner_signature" });
  if (approval.walletPubKey !== walletKeys.publicKey) {
    return claspError("invalid_signature", { reason: "wallet_mismatch" });
  }
  if (owners && !owners.includes(approval.ownerPubKey)) {
    return claspError("permission_denied", { reason: "owner_not_allowed" });
  }
  if (Math.abs(now - approval.timestamp * 1000) > FRESHNESS_WINDOW_MS) {
    return claspError("stale_timestamp", { now, timestamp: approval.timestamp });
  }
  const expiry = expiryToMillis(approval.expiresAt);
  if (!Number.isFinite(expiry) || expiry <= now) {
    return claspError("session_expired", { reason: "expiry_not_in_future", expiresAt: approval.expiresAt });
  }

  const sessionId = newSessionId();
  let session: StoredSession;
  try {
    session = store.createSession(
      {
        sessionId,
        origin: approval.origin,
        permissions: approval.permissions,
        asset: approval.asset,
        maxSinglePayment: approval.maxSinglePayment,
        maxSessionSpend: approval.maxSessionSpend,
        expiresAt: approval.expiresAt,
        appPubKey: approval.appPubKey,
        ownerPubKey: approval.ownerPubKey,
        approvalThreshold: approval.approvalThreshold,
        rateLimit: approval.rateLimit,
        approvalId: approval.approvalId,
      },
      now,
    );
  } catch (error) {
    if (error instanceof DuplicateApprovalError) {
      return claspError("replay_detected", { approvalId: approval.approvalId });
    }
    throw error;
  }
  store.appendEvent(sessionId, "session_approved", { ownerPubKey: approval.ownerPubKey }, now);
  return { sessionId, token: signSession(sessionToFacts(session), walletKeys.privateKey), session };
}
