import { describe, it, expect } from "vitest";
import { isClaspError, type ClaspError, type OperationResult } from "@clasp/protocol";
import { FakeGateway, GATEWAY_METHODS } from "@clasp/gateway";
import { evaluate } from "./engine";
import { newHarness, NOW } from "./test-harness";

function asError(result: OperationResult | ClaspError): ClaspError {
  expect(isClaspError(result)).toBe(true);
  return result as ClaspError;
}

describe("core-8", () => {
  it("1. rejects an operation the session does not grant → permission_denied", async () => {
    const h = newHarness({ permissions: ["payments:read"] });
    const request = await h.paymentRequest({ amount: "10000000", nonce: 1, requestId: "req_1" });

    const err = asError(await evaluate(request, h.ctx()));
    expect(err.code).toBe("permission_denied");
    expect(err.requiredPermission).toBe("payments:request");
  });

  it("2. rejects an amount over the per-payment cap → single_payment_limit_exceeded", async () => {
    const h = newHarness({ maxSinglePayment: "50000000", maxSessionSpend: "100000000" });
    const request = await h.paymentRequest({ amount: "60000000", nonce: 1, requestId: "req_1" });

    const err = asError(await evaluate(request, h.ctx()));
    expect(err.code).toBe("single_payment_limit_exceeded");
  });

  it("3. enforces cumulative session spend atomically across concurrent reservations", async () => {
    const h = newHarness({ maxSinglePayment: "60000000", maxSessionSpend: "100000000" });
    const reqA = await h.paymentRequest({ amount: "60000000", nonce: 1, requestId: "req_a" });
    const reqB = await h.paymentRequest({ amount: "60000000", nonce: 2, requestId: "req_b" });
    const ctx = h.ctx();

    const results = await Promise.all([evaluate(reqA, ctx), evaluate(reqB, ctx)]);

    const succeeded = results.filter((r) => !isClaspError(r)) as OperationResult[];
    const failed = results.filter(isClaspError) as ClaspError[];
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0]!.code).toBe("session_spending_limit_exceeded");
    expect(h.store.getSession("sess_1")?.spent).toBe("60000000");
  });

  it("4. rejects a reused nonce → replay_detected", async () => {
    const h = newHarness();
    const first = await h.paymentRequest({ amount: "10000000", nonce: 1, requestId: "req_1" });
    await evaluate(first, h.ctx());
    const replay = await h.paymentRequest({ amount: "10000000", nonce: 1, requestId: "req_2" });

    const err = asError(await evaluate(replay, h.ctx()));
    expect(err.code).toBe("replay_detected");
  });

  it("5. rejects a valid token replayed from another origin → origin_mismatch", async () => {
    const h = newHarness();
    const request = await h.paymentRequest({ amount: "10000000", nonce: 1, requestId: "req_1" });

    const err = asError(await evaluate(request, h.ctx({ origin: "https://evil.app" })));
    expect(err.code).toBe("origin_mismatch");
    expect(err.expected).toBe("https://good.app");
    expect(err.received).toBe("https://evil.app");
  });

  it("6. rejects an expired session → session_expired", async () => {
    const h = newHarness({ expiresAt: String(NOW - 1000) });
    const request = await h.paymentRequest({ amount: "10000000", nonce: 1, requestId: "req_1" });

    const err = asError(await evaluate(request, h.ctx()));
    expect(err.code).toBe("session_expired");
  });

  it("7. rejects a revoked session → session_revoked", async () => {
    const h = newHarness();
    h.store.revoke("sess_1", NOW);
    const request = await h.paymentRequest({ amount: "10000000", nonce: 1, requestId: "req_1" });

    const err = asError(await evaluate(request, h.ctx()));
    expect(err.code).toBe("session_revoked");
  });

  it("8. exposes exactly the four allow-listed gateway methods with no raw-RPC passthrough", () => {
    expect([...GATEWAY_METHODS].sort()).toEqual(["getInvoice", "getPayment", "newInvoice", "sendPayment"]);

    const proto = Object.getPrototypeOf(new FakeGateway());
    const methods = Object.getOwnPropertyNames(proto).filter(
      (name) => name !== "constructor" && typeof proto[name] === "function",
    );
    expect(methods.sort()).toEqual(["getInvoice", "getPayment", "newInvoice", "sendPayment"]);

    const gw = new FakeGateway() as unknown as Record<string, unknown>;
    for (const forbidden of ["call", "request", "rpc", "raw", "rawRpc", "invoke", "exec", "send"]) {
      expect(gw[forbidden]).toBeUndefined();
    }
  });
});
