import Database from "better-sqlite3";
import {
  addAmounts,
  subAmounts,
  gtAmounts,
  assertTransition,
  expiryToMillis,
  type GrantablePermission,
  type HoldStatus,
  type RateLimit,
  type SessionState,
} from "@clasp/protocol";

export interface StoredSession {
  id: string;
  origin: string;
  permissions: GrantablePermission[];
  asset: string;
  maxSinglePayment: string;
  maxSessionSpend: string;
  spent: string;
  appPubKey: string;
  expiresAt: string;
  state: SessionState;
  parentId: string | null;
  createdAt: number;
  ownerPubKey: string | null;
  approvalThreshold: string | null;
  rateLimit: RateLimit | null;
}

export interface StoredHold {
  requestId: string;
  sessionId: string;
  invoice: string;
  amount: string;
  asset: string;
  purpose: string | null;
  status: HoldStatus;
  result: string | null;
  createdAt: number;
  expiresAt: number;
}

export interface SessionEvent {
  id: number;
  sessionId: string;
  type: string;
  data: unknown;
  createdAt: number;
}

export interface StoredPayment {
  requestId: string;
  sessionId: string;
  amount: string;
  asset: string;
  paymentHash: string;
  status: string;
  settledAt: string;
}

export interface SessionFactsInput {
  sessionId: string;
  origin: string;
  permissions: GrantablePermission[];
  asset: string;
  maxSinglePayment: string;
  maxSessionSpend: string;
  expiresAt: string;
  appPubKey: string;
  parentId?: string | null;
  ownerPubKey?: string;
  approvalThreshold?: string;
  rateLimit?: RateLimit;
  approvalId?: string;
}

export interface ReserveInput {
  sessionId: string;
  nonce: number;
  requestId: string;
  amount: string;
}

export type ReserveResult =
  | { ok: true; spent: string; remaining: string }
  | { ok: false; reason: "replay" | "over_limit" }
  | { ok: false; reason: "inactive"; state: "REVOKED" | "EXPIRED" }
  | { ok: false; reason: "rate_limited"; limit: RateLimit; retryAfterSeconds: number };

class OverLimitError extends Error {}

class InactiveError extends Error {
  constructor(readonly state: "REVOKED" | "EXPIRED") {
    super(`session ${state.toLowerCase()} during reservation`);
  }
}

class RateLimitedError extends Error {
  constructor(
    readonly limit: RateLimit,
    readonly retryAfterSeconds: number,
  ) {
    super("rate limit exceeded");
  }
}

export class DuplicateApprovalError extends Error {}

interface SessionRow {
  id: string;
  origin: string;
  permissions: string;
  asset: string;
  max_single_payment: string;
  max_session_spend: string;
  spent: string;
  app_pubkey: string;
  expires_at: string;
  state: string;
  parent_id: string | null;
  created_at: number;
  owner_pubkey: string | null;
  approval_threshold: string | null;
  rate_max: number | null;
  rate_window_seconds: number | null;
}

interface HoldRow {
  request_id: string;
  session_id: string;
  invoice: string;
  amount: string;
  asset: string;
  purpose: string | null;
  status: string;
  result: string | null;
  created_at: number;
  expires_at: number;
}

const ADDED_SESSION_COLUMNS: [string, string][] = [
  ["parent_id", "TEXT"],
  ["owner_pubkey", "TEXT"],
  ["approval_threshold", "TEXT"],
  ["rate_max", "INTEGER"],
  ["rate_window_seconds", "INTEGER"],
  ["approval_id", "TEXT"],
];

export const expiryToMs = expiryToMillis;

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string }).code;
  return code === "SQLITE_CONSTRAINT_UNIQUE" || code === "SQLITE_CONSTRAINT_PRIMARYKEY";
}

export class Store {
  private readonly db: Database.Database;

  constructor(filename = ":memory:") {
    this.db = new Database(filename);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        origin TEXT NOT NULL,
        permissions TEXT NOT NULL,
        asset TEXT NOT NULL,
        max_single_payment TEXT NOT NULL,
        max_session_spend TEXT NOT NULL,
        spent TEXT NOT NULL DEFAULT '0',
        app_pubkey TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        state TEXT NOT NULL,
        parent_id TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS consumed_requests (
        session_id TEXT NOT NULL,
        nonce INTEGER NOT NULL,
        request_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE (session_id, nonce),
        UNIQUE (request_id)
      );
      CREATE TABLE IF NOT EXISTS payments (
        request_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        amount TEXT NOT NULL,
        asset TEXT NOT NULL,
        payment_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        settled_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS session_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS holds (
        request_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        invoice TEXT NOT NULL,
        amount TEXT NOT NULL,
        asset TEXT NOT NULL,
        purpose TEXT,
        status TEXT NOT NULL,
        result TEXT,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS consumed_requests_window ON consumed_requests (session_id, created_at);
      CREATE INDEX IF NOT EXISTS holds_session ON holds (session_id, status);
    `);
    const columns = new Set(
      (this.db.prepare("PRAGMA table_info(sessions)").all() as { name: string }[]).map((column) => column.name),
    );
    for (const [name, type] of ADDED_SESSION_COLUMNS) {
      if (!columns.has(name)) this.db.exec(`ALTER TABLE sessions ADD COLUMN ${name} ${type}`);
    }
    this.db.exec("CREATE UNIQUE INDEX IF NOT EXISTS sessions_approval_id ON sessions (approval_id)");
  }

  private rowToSession(row: SessionRow): StoredSession {
    return {
      id: row.id,
      origin: row.origin,
      permissions: JSON.parse(row.permissions) as GrantablePermission[],
      asset: row.asset,
      maxSinglePayment: row.max_single_payment,
      maxSessionSpend: row.max_session_spend,
      spent: row.spent,
      appPubKey: row.app_pubkey,
      expiresAt: row.expires_at,
      state: row.state as SessionState,
      parentId: row.parent_id ?? null,
      createdAt: row.created_at,
      ownerPubKey: row.owner_pubkey ?? null,
      approvalThreshold: row.approval_threshold ?? null,
      rateLimit:
        row.rate_max !== null && row.rate_window_seconds !== null
          ? { maxPayments: row.rate_max, windowSeconds: row.rate_window_seconds }
          : null,
    };
  }

  createSession(facts: SessionFactsInput, now: number): StoredSession {
    try {
      this.db
        .prepare(
          `INSERT INTO sessions
            (id, origin, permissions, asset, max_single_payment, max_session_spend, spent, app_pubkey, expires_at, state,
             parent_id, created_at, owner_pubkey, approval_threshold, rate_max, rate_window_seconds, approval_id)
           VALUES (@id, @origin, @permissions, @asset, @maxSingle, @maxSession, '0', @appPubKey, @expiresAt, 'ACTIVE',
             @parentId, @now, @ownerPubKey, @approvalThreshold, @rateMax, @rateWindow, @approvalId)`,
        )
        .run({
          id: facts.sessionId,
          origin: facts.origin,
          permissions: JSON.stringify(facts.permissions),
          asset: facts.asset,
          maxSingle: facts.maxSinglePayment,
          maxSession: facts.maxSessionSpend,
          appPubKey: facts.appPubKey,
          expiresAt: facts.expiresAt,
          parentId: facts.parentId ?? null,
          now,
          ownerPubKey: facts.ownerPubKey ?? null,
          approvalThreshold: facts.approvalThreshold ?? null,
          rateMax: facts.rateLimit?.maxPayments ?? null,
          rateWindow: facts.rateLimit?.windowSeconds ?? null,
          approvalId: facts.approvalId ?? null,
        });
    } catch (error) {
      if (isUniqueViolation(error) && facts.approvalId) throw new DuplicateApprovalError(facts.approvalId);
      throw error;
    }
    this.appendEvent(facts.sessionId, "session_created", { origin: facts.origin }, now);
    return this.getSession(facts.sessionId)!;
  }

  getSession(id: string): StoredSession | undefined {
    const row = this.db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as SessionRow | undefined;
    return row ? this.rowToSession(row) : undefined;
  }

  isConsumed(sessionId: string, nonce: number, requestId: string): boolean {
    const row = this.db
      .prepare("SELECT 1 FROM consumed_requests WHERE (session_id = ? AND nonce = ?) OR request_id = ? LIMIT 1")
      .get(sessionId, nonce, requestId);
    return row !== undefined;
  }

  reserveSpend(input: ReserveInput, now: number): ReserveResult {
    const reserve = this.db.transaction((args: ReserveInput): { spent: string; remaining: string } => {
      this.db
        .prepare("INSERT INTO consumed_requests (session_id, nonce, request_id, created_at) VALUES (?, ?, ?, ?)")
        .run(args.sessionId, args.nonce, args.requestId, now);
      const row = this.db
        .prepare(
          "SELECT spent, max_session_spend, parent_id, rate_max, rate_window_seconds, state, expires_at FROM sessions WHERE id = ?",
        )
        .get(args.sessionId) as
        | {
            spent: string;
            max_session_spend: string;
            parent_id: string | null;
            rate_max: number | null;
            rate_window_seconds: number | null;
            state: string;
            expires_at: string;
          }
        | undefined;
      if (!row) throw new OverLimitError("session not found during reservation");
      this.assertActive(row, now);
      if (row.parent_id) {
        const parentState = this.db
          .prepare("SELECT state, expires_at FROM sessions WHERE id = ?")
          .get(row.parent_id) as { state: string; expires_at: string } | undefined;
        if (!parentState) throw new OverLimitError("parent session not found during reservation");
        this.assertActive(parentState, now);
      }
      const nextSpent = addAmounts(row.spent, args.amount);
      if (gtAmounts(nextSpent, row.max_session_spend)) throw new OverLimitError("session cap exceeded");
      this.db.prepare("UPDATE sessions SET spent = ? WHERE id = ?").run(nextSpent, args.sessionId);
      if (row.parent_id) {
        const parent = this.db
          .prepare("SELECT spent, max_session_spend FROM sessions WHERE id = ?")
          .get(row.parent_id) as { spent: string; max_session_spend: string } | undefined;
        if (!parent) throw new OverLimitError("parent session not found during reservation");
        const nextParentSpent = addAmounts(parent.spent, args.amount);
        if (gtAmounts(nextParentSpent, parent.max_session_spend)) {
          throw new OverLimitError("parent session cap exceeded");
        }
        this.db.prepare("UPDATE sessions SET spent = ? WHERE id = ?").run(nextParentSpent, row.parent_id);
      }
      const rootId = row.parent_id ?? args.sessionId;
      this.enforceRate(row.parent_id ? [args.sessionId] : this.familyIds(rootId), row, now);
      if (row.parent_id) {
        const root = this.db
          .prepare("SELECT rate_max, rate_window_seconds FROM sessions WHERE id = ?")
          .get(rootId) as { rate_max: number | null; rate_window_seconds: number | null } | undefined;
        if (root) this.enforceRate(this.familyIds(rootId), root, now);
      }
      return { spent: nextSpent, remaining: subAmounts(row.max_session_spend, nextSpent) };
    });

    try {
      const { spent, remaining } = reserve.immediate(input);
      return { ok: true, spent, remaining };
    } catch (error) {
      if (isUniqueViolation(error)) return { ok: false, reason: "replay" };
      if (error instanceof OverLimitError) return { ok: false, reason: "over_limit" };
      if (error instanceof InactiveError) return { ok: false, reason: "inactive", state: error.state };
      if (error instanceof RateLimitedError) {
        return { ok: false, reason: "rate_limited", limit: error.limit, retryAfterSeconds: error.retryAfterSeconds };
      }
      throw error;
    }
  }

  private assertActive(row: { state: string; expires_at: string }, now: number): void {
    if (row.state === "REVOKED") throw new InactiveError("REVOKED");
    const expiry = expiryToMs(row.expires_at);
    if (row.state !== "ACTIVE" || !Number.isFinite(expiry) || now >= expiry) throw new InactiveError("EXPIRED");
  }

  private familyIds(rootId: string): string[] {
    const rows = this.db.prepare("SELECT id FROM sessions WHERE id = ? OR parent_id = ?").all(rootId, rootId) as {
      id: string;
    }[];
    return rows.map((row) => row.id);
  }

  private enforceRate(
    sessionIds: string[],
    limits: { rate_max: number | null; rate_window_seconds: number | null },
    now: number,
  ): void {
    if (limits.rate_max === null || limits.rate_window_seconds === null || sessionIds.length === 0) return;
    const windowMs = limits.rate_window_seconds * 1000;
    const placeholders = sessionIds.map(() => "?").join(",");
    const window = this.db
      .prepare(
        `SELECT COUNT(*) AS n, MIN(created_at) AS oldest FROM consumed_requests
         WHERE session_id IN (${placeholders}) AND created_at > ?`,
      )
      .get(...sessionIds, now - windowMs) as { n: number; oldest: number | null };
    if (window.n > limits.rate_max) {
      const oldest = window.oldest ?? now;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      throw new RateLimitedError(
        { maxPayments: limits.rate_max, windowSeconds: limits.rate_window_seconds },
        retryAfterSeconds,
      );
    }
  }

  refundSpend(sessionId: string, amount: string): void {
    const refund = this.db.transaction(() => {
      const row = this.db.prepare("SELECT spent, parent_id FROM sessions WHERE id = ?").get(sessionId) as
        | { spent: string; parent_id: string | null }
        | undefined;
      if (!row) return;
      this.db.prepare("UPDATE sessions SET spent = ? WHERE id = ?").run(subAmounts(row.spent, amount), sessionId);
      if (row.parent_id) {
        const parent = this.db.prepare("SELECT spent FROM sessions WHERE id = ?").get(row.parent_id) as
          | { spent: string }
          | undefined;
        if (parent) {
          this.db
            .prepare("UPDATE sessions SET spent = ? WHERE id = ?")
            .run(subAmounts(parent.spent, amount), row.parent_id);
        }
      }
    });
    refund();
  }

  revoke(id: string, now: number): StoredSession {
    const session = this.getSession(id);
    if (!session) throw new Error(`session not found: ${id}`);
    assertTransition(session.state, "REVOKED");
    this.db.prepare("UPDATE sessions SET state = 'REVOKED' WHERE id = ?").run(id);
    this.appendEvent(id, "session_revoked", {}, now);
    this.cancelPendingHolds(id, now);
    const children = this.db
      .prepare("SELECT id FROM sessions WHERE parent_id = ? AND state = 'ACTIVE'")
      .all(id) as { id: string }[];
    for (const child of children) {
      this.db.prepare("UPDATE sessions SET state = 'REVOKED' WHERE id = ?").run(child.id);
      this.appendEvent(child.id, "session_revoked", { reason: "parent_revoked" }, now);
      this.appendEvent(id, "delegate_revoked", { childSessionId: child.id }, now);
      this.cancelPendingHolds(child.id, now);
    }
    return this.getSession(id)!;
  }

  expireDueHolds(sessionId: string, now: number): void {
    const session = this.getSession(sessionId);
    if (!session) return;
    const ids = this.familyIds(session.parentId ?? session.id);
    const placeholders = ids.map(() => "?").join(",");
    const due = this.db
      .prepare(
        `SELECT request_id, session_id FROM holds WHERE session_id IN (${placeholders}) AND status = 'pending' AND expires_at <= ?`,
      )
      .all(...ids, now) as { request_id: string; session_id: string }[];
    for (const hold of due) {
      if (this.closeHold(hold.request_id, "pending", "expired", { refund: true })) {
        this.appendEvent(hold.session_id, "payment_expired", { requestId: hold.request_id }, now);
      }
    }
  }

  private cancelPendingHolds(sessionId: string, now: number): void {
    const pending = this.db
      .prepare("SELECT request_id FROM holds WHERE session_id = ? AND status = 'pending'")
      .all(sessionId) as { request_id: string }[];
    for (const hold of pending) {
      if (this.closeHold(hold.request_id, "pending", "cancelled", { refund: true })) {
        this.appendEvent(sessionId, "payment_cancelled", { requestId: hold.request_id }, now);
      }
    }
  }

  createHold(hold: Omit<StoredHold, "status" | "result">): StoredHold {
    this.db
      .prepare(
        `INSERT INTO holds (request_id, session_id, invoice, amount, asset, purpose, status, result, created_at, expires_at)
         VALUES (@requestId, @sessionId, @invoice, @amount, @asset, @purpose, 'pending', NULL, @createdAt, @expiresAt)`,
      )
      .run(hold);
    return this.getHold(hold.requestId)!;
  }

  getHold(requestId: string): StoredHold | undefined {
    const row = this.db.prepare("SELECT * FROM holds WHERE request_id = ?").get(requestId) as HoldRow | undefined;
    return row ? this.rowToHold(row) : undefined;
  }

  listHolds(sessionIds: string[]): StoredHold[] {
    if (sessionIds.length === 0) return [];
    const placeholders = sessionIds.map(() => "?").join(",");
    const rows = this.db
      .prepare(`SELECT * FROM holds WHERE session_id IN (${placeholders}) ORDER BY created_at DESC`)
      .all(...sessionIds) as HoldRow[];
    return rows.map((row) => this.rowToHold(row));
  }

  sessionFamily(rootId: string): string[] {
    return this.familyIds(rootId);
  }

  closeHold(
    requestId: string,
    from: HoldStatus,
    to: HoldStatus,
    options: { refund?: boolean; result?: string } = {},
  ): boolean {
    const close = this.db.transaction((): boolean => {
      const changed = this.db
        .prepare("UPDATE holds SET status = ?, result = COALESCE(?, result) WHERE request_id = ? AND status = ?")
        .run(to, options.result ?? null, requestId, from).changes;
      if (changed !== 1) return false;
      if (options.refund) {
        const hold = this.getHold(requestId)!;
        this.refundSpend(hold.sessionId, hold.amount);
      }
      return true;
    });
    return close.immediate();
  }

  private rowToHold(row: HoldRow): StoredHold {
    return {
      requestId: row.request_id,
      sessionId: row.session_id,
      invoice: row.invoice,
      amount: row.amount,
      asset: row.asset,
      purpose: row.purpose,
      status: row.status as HoldStatus,
      result: row.result,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    };
  }

  listChildren(parentId: string): StoredSession[] {
    const rows = this.db
      .prepare("SELECT * FROM sessions WHERE parent_id = ? ORDER BY created_at")
      .all(parentId) as SessionRow[];
    return rows.map((row) => this.rowToSession(row));
  }

  expireIfDue(id: string, now: number): StoredSession | undefined {
    const session = this.getSession(id);
    if (!session) return undefined;
    if (session.state === "ACTIVE" && now >= expiryToMs(session.expiresAt)) {
      assertTransition(session.state, "EXPIRED");
      this.db.prepare("UPDATE sessions SET state = 'EXPIRED' WHERE id = ?").run(id);
      this.appendEvent(id, "session_expired", {}, now);
      return this.getSession(id);
    }
    return session;
  }

  recordPayment(payment: StoredPayment): void {
    this.db
      .prepare(
        `INSERT INTO payments (request_id, session_id, amount, asset, payment_hash, status, settled_at)
         VALUES (@requestId, @sessionId, @amount, @asset, @paymentHash, @status, @settledAt)`,
      )
      .run(payment);
  }

  getPayment(requestId: string): StoredPayment | undefined {
    const row = this.db.prepare("SELECT * FROM payments WHERE request_id = ?").get(requestId) as
      | {
          request_id: string;
          session_id: string;
          amount: string;
          asset: string;
          payment_hash: string;
          status: string;
          settled_at: string;
        }
      | undefined;
    if (!row) return undefined;
    return {
      requestId: row.request_id,
      sessionId: row.session_id,
      amount: row.amount,
      asset: row.asset,
      paymentHash: row.payment_hash,
      status: row.status,
      settledAt: row.settled_at,
    };
  }

  countPayments(sessionId: string): number {
    const row = this.db
      .prepare("SELECT COUNT(*) AS n FROM payments WHERE session_id = ?")
      .get(sessionId) as { n: number };
    return row.n;
  }

  appendEvent(sessionId: string, type: string, data: unknown, now: number): void {
    this.db
      .prepare("INSERT INTO session_events (session_id, type, data, created_at) VALUES (?, ?, ?, ?)")
      .run(sessionId, type, JSON.stringify(data ?? {}), now);
  }

  listEvents(sessionId: string): SessionEvent[] {
    const rows = this.db
      .prepare("SELECT id, session_id, type, data, created_at FROM session_events WHERE session_id = ? ORDER BY id")
      .all(sessionId) as { id: number; session_id: string; type: string; data: string; created_at: number }[];
    return rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      type: row.type,
      data: JSON.parse(row.data),
      createdAt: row.created_at,
    }));
  }

  close(): void {
    this.db.close();
  }
}
