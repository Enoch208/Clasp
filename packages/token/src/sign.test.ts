import { describe, it, expect } from "vitest";
import type { SessionFacts, OperationRequest, OperationResult } from "@clasp/protocol";
import {
  generateKeypair,
  signSession,
  verifySession,
  signRequest,
  verifyRequest,
  signResult,
  verifyResult,
} from "./index";

const wallet = generateKeypair();
const app = generateKeypair();

const facts: SessionFacts = {
  sessionId: "sess_1",
  origin: "https://good.app",
  permissions: ["payments:request", "payments:read"],
  asset: "BTC",
  maxSinglePayment: "50000000",
  maxSessionSpend: "100000000",
  expiresAt: "4102444800000",
  appPubKey: app.publicKey,
};

const unsignedRequest: Omit<OperationRequest, "signature"> = {
  version: "1",
  sessionId: "sess_1",
  requestId: "req_1",
  operation: "payments:request",
  parameters: { invoice: "inv_abc", amount: "10000000", asset: "BTC" },
  nonce: 1,
  timestamp: 1_700_000_000_000,
};

describe("keypairs", () => {
  it("generates distinct 64-char hex keypairs", () => {
    expect(wallet.publicKey).toMatch(/^[0-9a-f]{64}$/);
    expect(wallet.privateKey).toMatch(/^[0-9a-f]{64}$/);
    expect(wallet.publicKey).not.toBe(app.publicKey);
  });
});

describe("session tokens", () => {
  it("round-trips SessionFacts through sign/verify", () => {
    const token = signSession(facts, wallet.privateKey);
    expect(verifySession(token, wallet.publicKey)).toEqual(facts);
  });

  it("throws when verified against the wrong wallet key", () => {
    const token = signSession(facts, wallet.privateKey);
    expect(() => verifySession(token, app.publicKey)).toThrow();
  });

  it("throws when the token facts are tampered with", () => {
    const token = signSession(facts, wallet.privateKey);
    const decoded = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
    decoded.facts.maxSessionSpend = "999999999999";
    const forged = Buffer.from(JSON.stringify(decoded), "utf8").toString("base64url");
    expect(() => verifySession(forged, wallet.publicKey)).toThrow();
  });
});

describe("operation request signatures", () => {
  it("round-trips a request signed by the app key", () => {
    const signature = signRequest(unsignedRequest, app.privateKey);
    const request: OperationRequest = { ...unsignedRequest, signature };
    expect(verifyRequest(request, app.publicKey)).toBe(true);
  });

  it("rejects a request signed by a different key", () => {
    const signature = signRequest(unsignedRequest, wallet.privateKey);
    const request: OperationRequest = { ...unsignedRequest, signature };
    expect(verifyRequest(request, app.publicKey)).toBe(false);
  });

  it("rejects a tampered amount even with a valid original signature", () => {
    const signature = signRequest(unsignedRequest, app.privateKey);
    const tampered: OperationRequest = {
      ...unsignedRequest,
      parameters: { ...unsignedRequest.parameters, amount: "99000000" },
      signature,
    };
    expect(verifyRequest(tampered, app.publicKey)).toBe(false);
  });

  it("rejects a tampered nonce even with a valid original signature", () => {
    const signature = signRequest(unsignedRequest, app.privateKey);
    const tampered: OperationRequest = { ...unsignedRequest, nonce: 2, signature };
    expect(verifyRequest(tampered, app.publicKey)).toBe(false);
  });
});

describe("result signatures", () => {
  it("signs and verifies an OperationResult", () => {
    const unsigned: Omit<OperationResult, "signature"> = {
      requestId: "req_1",
      status: "succeeded",
      paymentHash: "hash_1",
      amount: "10000000",
      asset: "BTC",
      settledAt: "2026-07-15T00:00:00.000Z",
      sessionRemaining: "90000000",
    };
    const result = signResult(unsigned, wallet.privateKey);
    expect(result.signature).toMatch(/^[0-9a-f]+$/);
    expect(verifyResult(result, wallet.publicKey)).toBe(true);
    expect(verifyResult({ ...result, sessionRemaining: "0" }, wallet.publicKey)).toBe(false);
  });
});
