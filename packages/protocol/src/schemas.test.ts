import { describe, it, expect } from "vitest";
import { operationRequestSchema, sessionFactsSchema, paymentParamsSchema } from "./schemas";

const validRequest = {
  version: "1",
  sessionId: "sess_01",
  requestId: "req_01",
  operation: "payments:request",
  parameters: { invoice: "fibt1abc", amount: "100000000", asset: "CKB" },
  nonce: 4,
  timestamp: 1784150100,
  signature: "0xdead",
};

describe("operation request schema", () => {
  it("accepts a well-formed request", () => {
    expect(operationRequestSchema.parse(validRequest).nonce).toBe(4);
  });

  it("accepts high-risk operations so the engine can deny them", () => {
    expect(() => operationRequestSchema.parse({ ...validRequest, operation: "channels:open" })).not.toThrow();
  });

  it("rejects never-exposed operations at the schema boundary", () => {
    expect(() => operationRequestSchema.parse({ ...validRequest, operation: "raw-rpc" })).toThrow();
  });

  it("rejects non-integer amounts in payment params", () => {
    expect(() => paymentParamsSchema.parse({ invoice: "x", amount: "1.5", asset: "CKB" })).toThrow();
  });
});

describe("session facts schema", () => {
  it("rejects high-risk permissions in granted facts", () => {
    expect(() =>
      sessionFactsSchema.parse({
        sessionId: "s",
        origin: "https://weather.example",
        permissions: ["channels:open"],
        asset: "CKB",
        maxSinglePayment: "1",
        maxSessionSpend: "2",
        expiresAt: "2026-07-15T21:15:00Z",
        appPubKey: "abcd",
      }),
    ).toThrow();
  });
});
