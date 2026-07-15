import { describe, it, expect } from "vitest";
import { isClaspError, type ClaspError, type OperationResult } from "@clasp/protocol";
import { verifyResult } from "@clasp/token";
import { FakeGateway, type Payment, type SendPaymentParams } from "@clasp/gateway";
import { evaluate } from "./engine";
import { newHarness } from "./test-harness";

describe("evaluate — happy path", () => {
  it("flows a signed payment end-to-end and returns a signed result with a payment hash", async () => {
    const h = newHarness();
    const request = await h.paymentRequest({ amount: "10000000", nonce: 1, requestId: "req_1" });

    const result = await evaluate(request, h.ctx());

    expect(isClaspError(result)).toBe(false);
    const res = result as OperationResult;
    expect(res.status).toBe("succeeded");
    expect(res.paymentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(res.amount).toBe("10000000");
    expect(res.sessionRemaining).toBe("90000000");
    expect(verifyResult(res, h.wallet.publicKey)).toBe(true);
  });

  it("persists the spend, the payment, and a settled event", async () => {
    const h = newHarness();
    const request = await h.paymentRequest({ amount: "10000000", nonce: 1, requestId: "req_1" });

    await evaluate(request, h.ctx());

    expect(h.store.getSession("sess_1")?.spent).toBe("10000000");
    expect(h.store.getPayment("req_1")?.status).toBe("settled");
    expect(h.store.listEvents("sess_1").map((e) => e.type)).toContain("payment_settled");
  });
});

describe("evaluate — gateway failure (reserve-then-settle)", () => {
  class FailingGateway extends FakeGateway {
    override async sendPayment(_params: SendPaymentParams): Promise<Payment> {
      throw new Error("network down");
    }
  }

  it("refunds the reservation, keeps the nonce consumed, and returns a retryable error", async () => {
    const h = newHarness();
    const request = await h.paymentRequest({ amount: "10000000", nonce: 1, requestId: "req_1" });

    const result = await evaluate(request, h.ctx({ gateway: new FailingGateway() }));

    expect(isClaspError(result)).toBe(true);
    const err = result as ClaspError;
    expect(err.code).toBe("gateway_failure");
    expect(err.retryable).toBe(true);
    expect(h.store.getSession("sess_1")?.spent).toBe("0");
    expect(h.store.isConsumed("sess_1", 1, "req_1")).toBe(true);
    expect(h.store.listEvents("sess_1").map((e) => e.type)).toContain("payment_failed");
  });
});
