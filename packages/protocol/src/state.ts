export type SessionState = "REQUESTED" | "REVIEWED" | "ACTIVE" | "EXPIRED" | "REVOKED";

const TRANSITIONS: Record<SessionState, readonly SessionState[]> = {
  REQUESTED: ["REVIEWED", "REVOKED"],
  REVIEWED: ["ACTIVE", "REVOKED"],
  ACTIVE: ["EXPIRED", "REVOKED"],
  EXPIRED: [],
  REVOKED: [],
};

export function canTransition(from: SessionState, to: SessionState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: SessionState, to: SessionState): void {
  if (!canTransition(from, to)) {
    throw new Error(`illegal session transition: ${from} -> ${to}`);
  }
}
