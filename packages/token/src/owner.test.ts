import { describe, it, expect } from "vitest";
import type { SessionApproval, PaymentDecision, RevokeRequest } from "@clasp/protocol";
import {
  generateKeypair,
  signApproval,
  verifyApproval,
  signDecision,
  verifyDecision,
  signRevoke,
  verifyRevoke,
} from "./index";

const owner = generateKeypair();
const app = generateKeypair();

const unsignedApproval: Omit<SessionApproval, "signature"> = {
  version: "1",
  approvalId: "apr_1",
  origin: "https://good.app",
  permissions: ["payments:request"],
  asset: "CKB",
  maxSinglePayment: "50000000",
  maxSessionSpend: "100000000",
  expiresAt: "4102444800000",
  appPubKey: app.publicKey,
  approvalThreshold: "20000000",
  rateLimit: { maxPayments: 5, windowSeconds: 3600 },
  ownerPubKey: owner.publicKey,
  walletPubKey: "wallet_pub",
  timestamp: 1_700_000_000,
};

describe("owner session approvals", () => {
  it("verifies an approval signed by the owner key it names", () => {
    const approval = { ...unsignedApproval, signature: signApproval(unsignedApproval, owner.privateKey) };
    expect(verifyApproval(approval)).toBe(true);
  });

  it("rejects an approval whose signer is not the named owner", () => {
    const approval = { ...unsignedApproval, signature: signApproval(unsignedApproval, app.privateKey) };
    expect(verifyApproval(approval)).toBe(false);
  });

  it("rejects an approval whose limits were widened after signing", () => {
    const approval = { ...unsignedApproval, signature: signApproval(unsignedApproval, owner.privateKey) };
    expect(verifyApproval({ ...approval, maxSessionSpend: "900000000" })).toBe(false);
    expect(verifyApproval({ ...approval, approvalThreshold: undefined })).toBe(false);
    expect(verifyApproval({ ...approval, rateLimit: { maxPayments: 50, windowSeconds: 3600 } })).toBe(false);
  });
});

describe("payment decisions", () => {
  const unsigned: Omit<PaymentDecision, "signature"> = {
    version: "1",
    requestId: "req_1",
    sessionId: "sess_1",
    amount: "30000000",
    invoice: "fibt1_invoice",
    walletPubKey: "wallet_pub",
    decision: "approve",
    timestamp: 1_700_000_000,
  };

  it("verifies against the owner key and nothing else", () => {
    const decision = { ...unsigned, signature: signDecision(unsigned, owner.privateKey) };
    expect(verifyDecision(decision, owner.publicKey)).toBe(true);
    expect(verifyDecision(decision, app.publicKey)).toBe(false);
  });

  it("cannot be moved to a different amount, invoice or wallet", () => {
    const decision = { ...unsigned, signature: signDecision(unsigned, owner.privateKey) };
    expect(verifyDecision({ ...decision, amount: "1000" }, owner.publicKey)).toBe(false);
    expect(verifyDecision({ ...decision, invoice: "fibt1_other" }, owner.publicKey)).toBe(false);
    expect(verifyDecision({ ...decision, walletPubKey: "other_wallet" }, owner.publicKey)).toBe(false);
  });

  it("cannot be flipped from deny to approve", () => {
    const deny = { ...unsigned, decision: "deny" as const };
    const signed = { ...deny, signature: signDecision(deny, owner.privateKey) };
    expect(verifyDecision({ ...signed, decision: "approve" }, owner.publicKey)).toBe(false);
  });
});

describe("revoke requests", () => {
  it("binds the signature to one session", () => {
    const unsigned: Omit<RevokeRequest, "signature"> = {
      version: "1",
      sessionId: "sess_1",
      by: "owner",
      timestamp: 1_700_000_000,
    };
    const request = { ...unsigned, signature: signRevoke(unsigned, owner.privateKey) };
    expect(verifyRevoke(request, owner.publicKey)).toBe(true);
    expect(verifyRevoke({ ...request, sessionId: "sess_2" }, owner.publicKey)).toBe(false);
  });
});
