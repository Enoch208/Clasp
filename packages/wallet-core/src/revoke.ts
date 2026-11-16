import { claspError, type ClaspError, type RevokeRequest } from "@clasp/protocol";
import { verifyRevoke } from "@clasp/token";
import { FRESHNESS_WINDOW_MS } from "./engine";
import type { Store, StoredSession } from "./store";

export function revokeSession(request: RevokeRequest, store: Store, now: number): StoredSession | ClaspError | null {
  const session = store.getSession(request.sessionId);
  if (!session) return null;

  const signer = request.by === "app" ? session.appPubKey : session.ownerPubKey;
  if (!signer || !verifyRevoke(request, signer)) {
    return claspError("invalid_signature", { reason: `${request.by}_signature` });
  }
  if (Math.abs(now - request.timestamp * 1000) > FRESHNESS_WINDOW_MS) {
    return claspError("stale_timestamp", { now, timestamp: request.timestamp });
  }
  if (session.state !== "ACTIVE") return session;
  return store.revoke(session.id, now);
}
