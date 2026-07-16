import {
  claspError,
  gtAmounts,
  type ClaspError,
  type DelegationRequest,
  type SessionFacts,
} from "@clasp/protocol";
import { verifySession, verifyDelegation, signSession, type Keypair } from "@clasp/token";
import { FRESHNESS_WINDOW_MS, factsMatchSession, sessionToFacts } from "./engine";
import { expiryToMs, type Store, type StoredSession } from "./store";

export interface DelegateContext {
  store: Store;
  walletKeys: Keypair;
  now: number;
  origin: string;
  newSessionId: () => string;
}

export interface DelegateResult {
  childSessionId: string;
  childToken: string;
  child: StoredSession;
}

export function delegate(
  request: DelegationRequest,
  parentToken: string,
  ctx: DelegateContext,
): DelegateResult | ClaspError {
  const { store, walletKeys, now, origin, newSessionId } = ctx;

  let parent = store.getSession(request.parentSessionId);
  if (!parent) return claspError("session_not_found", { sessionId: request.parentSessionId });
  if (parent.state === "REVOKED") return claspError("session_revoked", { sessionId: parent.id });
  parent = store.expireIfDue(parent.id, now) ?? parent;
  if (parent.state === "EXPIRED") return claspError("session_expired", { sessionId: parent.id });
  if (parent.state !== "ACTIVE") return claspError("session_not_found", { sessionId: parent.id });

  let parentFacts: SessionFacts;
  try {
    parentFacts = verifySession(parentToken, walletKeys.publicKey);
  } catch {
    return claspError("invalid_signature", { reason: "session_token" });
  }
  if (!factsMatchSession(parentFacts, parent)) return claspError("invalid_signature", { reason: "facts_mismatch" });
  if (!verifyDelegation(request, parent.appPubKey)) {
    return claspError("invalid_signature", { reason: "delegation_signature" });
  }

  if (origin !== parent.origin) {
    return claspError("origin_mismatch", { expected: parent.origin, received: origin });
  }
  if (Math.abs(now - request.timestamp * 1000) > FRESHNESS_WINDOW_MS) {
    return claspError("stale_timestamp", { now, timestamp: request.timestamp });
  }

  if (!(parent.permissions as string[]).includes("payments:auto")) {
    return claspError("permission_denied", { requiredPermission: "payments:auto" });
  }
  if (parent.parentId) return claspError("attenuation_violation", { reason: "nesting_not_allowed" });

  const parentPermissions = new Set(parent.permissions as string[]);
  if (!request.permissions.every((permission) => parentPermissions.has(permission))) {
    return claspError("attenuation_violation", { reason: "permissions_widen" });
  }
  if (request.asset !== parent.asset) {
    return claspError("attenuation_violation", { reason: "asset_mismatch" });
  }
  if (gtAmounts(request.maxSinglePayment, parent.maxSinglePayment)) {
    return claspError("attenuation_violation", { reason: "single_payment_widen" });
  }
  if (gtAmounts(request.maxSessionSpend, parent.maxSessionSpend)) {
    return claspError("attenuation_violation", { reason: "session_spend_widen" });
  }
  if (expiryToMs(request.expiresAt) > expiryToMs(parent.expiresAt)) {
    return claspError("attenuation_violation", { reason: "expiry_widen" });
  }

  const childSessionId = newSessionId();
  const child = store.createSession(
    {
      sessionId: childSessionId,
      origin: parent.origin,
      permissions: request.permissions,
      asset: request.asset,
      maxSinglePayment: request.maxSinglePayment,
      maxSessionSpend: request.maxSessionSpend,
      expiresAt: request.expiresAt,
      appPubKey: request.childAppPubKey,
      parentId: parent.id,
    },
    now,
  );
  store.appendEvent(
    parent.id,
    "session_delegated",
    { childSessionId, maxSessionSpend: request.maxSessionSpend, permissions: request.permissions },
    now,
  );
  const childToken = signSession(sessionToFacts(child), walletKeys.privateKey);
  return { childSessionId, childToken, child };
}
