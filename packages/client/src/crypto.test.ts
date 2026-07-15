import { describe, it, expect } from "vitest";
import {
  generateKeypair,
  publicFromPrivate,
  canonicalize,
  signRequest,
  verifyRequest,
} from "./crypto";

describe("keypairs", () => {
  it("generates distinct 32-byte hex keys", () => {
    const kp = generateKeypair();
    expect(kp.publicKey).toMatch(/^[0-9a-f]{64}$/);
    expect(kp.privateKey).toMatch(/^[0-9a-f]{64}$/);
    expect(kp.publicKey).not.toBe(kp.privateKey);
  });

  it("derives the same public key from a private key", () => {
    const kp = generateKeypair();
    expect(publicFromPrivate(kp.privateKey)).toBe(kp.publicKey);
  });
});

describe("canonicalize", () => {
  it("is independent of key insertion order", () => {
    const a = canonicalize({ b: 2, a: 1, c: { y: 2, x: 1 } });
    const b = canonicalize({ c: { x: 1, y: 2 }, a: 1, b: 2 });
    expect(a).toBe(b);
  });

  it("ignores the signature field", () => {
    const base = { requestId: "r1", nonce: 4 };
    expect(canonicalize({ ...base, signature: "abc" })).toBe(canonicalize(base));
  });
});

describe("request signatures", () => {
  const request = {
    version: "1",
    sessionId: "sess_1",
    requestId: "req_1",
    operation: "payments:request",
    parameters: { invoice: "fibt1abc", amount: "100000000", asset: "CKB" },
    nonce: 1,
    timestamp: 1784150100,
  };

  it("verifies a signature produced by the matching key", () => {
    const kp = generateKeypair();
    const signature = signRequest(request, kp.privateKey);
    expect(verifyRequest({ ...request, signature }, kp.publicKey)).toBe(true);
  });

  it("rejects a tampered parameter", () => {
    const kp = generateKeypair();
    const signature = signRequest(request, kp.privateKey);
    const tampered = {
      ...request,
      parameters: { ...request.parameters, amount: "999999999" },
      signature,
    };
    expect(verifyRequest(tampered, kp.publicKey)).toBe(false);
  });

  it("rejects a signature from a different key", () => {
    const signer = generateKeypair();
    const other = generateKeypair();
    const signature = signRequest(request, signer.privateKey);
    expect(verifyRequest({ ...request, signature }, other.publicKey)).toBe(false);
  });
});
