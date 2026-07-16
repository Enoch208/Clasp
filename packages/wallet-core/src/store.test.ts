import { describe, it, expect } from "vitest";
import type { SessionFacts } from "@clasp/protocol";
import { Store } from "./store";

const NOW = 1_700_000_000_000;

function facts(overrides: Partial<SessionFacts> = {}): SessionFacts {
  return {
    sessionId: "sess_1",
    origin: "https://good.app",
    permissions: ["payments:request", "payments:read"],
    asset: "BTC",
    maxSinglePayment: "50000000",
    maxSessionSpend: "100000000",
    expiresAt: String(NOW + 3_600_000),
    appPubKey: "a".repeat(64),
    ...overrides,
  };
}

function freshStore(): Store {
  return new Store(":memory:");
}

describe("Store — sessions", () => {
  it("creates an ACTIVE session with zero spend and round-trips it", () => {
    const store = freshStore();
    const created = store.createSession(facts(), NOW);
    expect(created.state).toBe("ACTIVE");
    expect(created.spent).toBe("0");

    const loaded = store.getSession("sess_1");
    expect(loaded).toBeDefined();
    expect(loaded?.permissions).toEqual(["payments:request", "payments:read"]);
    expect(loaded?.maxSessionSpend).toBe("100000000");
    expect(loaded?.origin).toBe("https://good.app");
  });

  it("returns undefined for an unknown session", () => {
    expect(freshStore().getSession("nope")).toBeUndefined();
  });

  it("logs a session_created event", () => {
    const store = freshStore();
    store.createSession(facts(), NOW);
    const events = store.listEvents("sess_1");
    expect(events.map((e) => e.type)).toContain("session_created");
  });
});

describe("Store — reserveSpend (atomic reserve)", () => {
  it("reserves an in-budget amount and updates spent + remaining", () => {
    const store = freshStore();
    store.createSession(facts(), NOW);
    const result = store.reserveSpend({ sessionId: "sess_1", nonce: 1, requestId: "req_1", amount: "40000000" }, NOW);
    expect(result).toEqual({ ok: true, spent: "40000000", remaining: "60000000" });
    expect(store.getSession("sess_1")?.spent).toBe("40000000");
    expect(store.isConsumed("sess_1", 1, "req_1")).toBe(true);
  });

  it("rejects a duplicate nonce as replay", () => {
    const store = freshStore();
    store.createSession(facts(), NOW);
    store.reserveSpend({ sessionId: "sess_1", nonce: 1, requestId: "req_1", amount: "10000000" }, NOW);
    const dup = store.reserveSpend({ sessionId: "sess_1", nonce: 1, requestId: "req_2", amount: "10000000" }, NOW);
    expect(dup).toEqual({ ok: false, reason: "replay" });
  });

  it("rejects a duplicate requestId as replay even with a new nonce", () => {
    const store = freshStore();
    store.createSession(facts(), NOW);
    store.reserveSpend({ sessionId: "sess_1", nonce: 1, requestId: "req_1", amount: "10000000" }, NOW);
    const dup = store.reserveSpend({ sessionId: "sess_1", nonce: 2, requestId: "req_1", amount: "10000000" }, NOW);
    expect(dup).toEqual({ ok: false, reason: "replay" });
  });

  it("rolls back entirely when the reservation would exceed the session cap", () => {
    const store = freshStore();
    store.createSession(facts(), NOW);
    store.reserveSpend({ sessionId: "sess_1", nonce: 1, requestId: "req_1", amount: "80000000" }, NOW);
    const over = store.reserveSpend({ sessionId: "sess_1", nonce: 2, requestId: "req_2", amount: "30000000" }, NOW);
    expect(over).toEqual({ ok: false, reason: "over_limit" });
    expect(store.getSession("sess_1")?.spent).toBe("80000000");
    expect(store.isConsumed("sess_1", 2, "req_2")).toBe(false);
  });
});

describe("Store — refundSpend", () => {
  it("returns reserved funds while keeping the nonce consumed", () => {
    const store = freshStore();
    store.createSession(facts(), NOW);
    store.reserveSpend({ sessionId: "sess_1", nonce: 1, requestId: "req_1", amount: "40000000" }, NOW);
    store.refundSpend("sess_1", "40000000");
    expect(store.getSession("sess_1")?.spent).toBe("0");
    expect(store.isConsumed("sess_1", 1, "req_1")).toBe(true);
  });
});

describe("Store — state transitions", () => {
  it("revokes an active session and logs the event", () => {
    const store = freshStore();
    store.createSession(facts(), NOW);
    const revoked = store.revoke("sess_1", NOW + 1000);
    expect(revoked.state).toBe("REVOKED");
    expect(store.listEvents("sess_1").map((e) => e.type)).toContain("session_revoked");
  });

  it("throws on an illegal re-revoke", () => {
    const store = freshStore();
    store.createSession(facts(), NOW);
    store.revoke("sess_1", NOW + 1000);
    expect(() => store.revoke("sess_1", NOW + 2000)).toThrow();
  });

  it("expires a session whose deadline has passed", () => {
    const store = freshStore();
    store.createSession(facts({ expiresAt: String(NOW + 1000) }), NOW);
    const stillActive = store.expireIfDue("sess_1", NOW + 500);
    expect(stillActive?.state).toBe("ACTIVE");
    const expired = store.expireIfDue("sess_1", NOW + 2000);
    expect(expired?.state).toBe("EXPIRED");
    expect(store.listEvents("sess_1").map((e) => e.type)).toContain("session_expired");
  });

  it("cascades revocation to delegated children", () => {
    const store = freshStore();
    store.createSession(facts({ sessionId: "parent_1" }), NOW);
    store.createSession({ ...facts({ sessionId: "child_1" }), parentId: "parent_1" }, NOW);

    store.revoke("parent_1", NOW + 1000);

    expect(store.getSession("child_1")?.state).toBe("REVOKED");
    expect(store.listEvents("parent_1").map((e) => e.type)).toContain("delegate_revoked");
    expect(store.listChildren("parent_1").map((c) => c.id)).toEqual(["child_1"]);
  });
});

describe("Store — payments", () => {
  it("records a settled payment retrievable by request id", () => {
    const store = freshStore();
    store.createSession(facts(), NOW);
    store.recordPayment({
      requestId: "req_1",
      sessionId: "sess_1",
      amount: "10000000",
      asset: "BTC",
      paymentHash: "hash_1",
      status: "settled",
      settledAt: "2026-07-15T00:00:00.000Z",
    });
    expect(store.getPayment("req_1")?.paymentHash).toBe("hash_1");
  });
});
