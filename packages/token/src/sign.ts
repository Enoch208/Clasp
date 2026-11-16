import {
  sessionFactsSchema,
  claspError,
  ClaspErrorException,
  type SessionFacts,
  type OperationRequest,
  type OperationResult,
  type DelegationRequest,
  type SessionStatement,
  type SessionApproval,
  type PaymentDecision,
  type RevokeRequest,
} from "@clasp/protocol";
import { canonicalize } from "./canonicalize";
import { publicKeyFromPrivate, randomPrivateKey, signBytes, verifyBytes } from "./ed25519";

export interface Keypair {
  publicKey: string;
  privateKey: string;
}

export function generateKeypair(): Keypair {
  const privateKey = randomPrivateKey();
  return { privateKey, publicKey: publicKeyFromPrivate(privateKey) };
}

export function signSession(facts: SessionFacts, walletPrivateKey: string): string {
  const signature = signBytes(canonicalize(facts), walletPrivateKey);
  const envelope = JSON.stringify({ facts, signature });
  return Buffer.from(envelope, "utf8").toString("base64url");
}

export function verifySession(token: string, walletPublicKey: string): SessionFacts {
  let facts: unknown;
  let signature: unknown;
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
    facts = decoded.facts;
    signature = decoded.signature;
  } catch {
    throw new ClaspErrorException(claspError("invalid_signature", { reason: "malformed_token" }));
  }
  if (typeof signature !== "string" || !verifyBytes(canonicalize(facts), signature, walletPublicKey)) {
    throw new ClaspErrorException(claspError("invalid_signature", { reason: "session_signature" }));
  }
  return sessionFactsSchema.parse(facts);
}

function requestMessage(request: Omit<OperationRequest, "signature">): string {
  const { signature: _omit, ...rest } = request as OperationRequest;
  return canonicalize(rest);
}

export function signRequest(request: Omit<OperationRequest, "signature">, appPrivateKey: string): string {
  return signBytes(requestMessage(request), appPrivateKey);
}

export function verifyRequest(request: OperationRequest, appPublicKey: string): boolean {
  return verifyBytes(requestMessage(request), request.signature, appPublicKey);
}

function delegationMessage(request: Omit<DelegationRequest, "signature">): string {
  const { signature: _omit, ...rest } = request as DelegationRequest;
  return canonicalize(rest);
}

export function signDelegation(request: Omit<DelegationRequest, "signature">, appPrivateKey: string): string {
  return signBytes(delegationMessage(request), appPrivateKey);
}

export function verifyDelegation(request: DelegationRequest, appPublicKey: string): boolean {
  return verifyBytes(delegationMessage(request), request.signature, appPublicKey);
}

function statementMessage(statement: Omit<SessionStatement, "signature">): string {
  const { signature: _omit, ...rest } = statement as SessionStatement;
  return canonicalize(rest);
}

export function signStatement(
  statement: Omit<SessionStatement, "signature">,
  walletPrivateKey: string,
): SessionStatement {
  return { ...statement, signature: signBytes(statementMessage(statement), walletPrivateKey) };
}

export function verifyStatement(statement: SessionStatement, walletPublicKey: string): boolean {
  const { signature, ...rest } = statement;
  return verifyBytes(canonicalize(rest), signature, walletPublicKey);
}

export function signResult(result: Omit<OperationResult, "signature">, walletPrivateKey: string): OperationResult {
  const signature = signBytes(canonicalize(result), walletPrivateKey);
  return { ...result, signature };
}

export function verifyResult(result: OperationResult, walletPublicKey: string): boolean {
  const { signature, ...rest } = result;
  return verifyBytes(canonicalize(rest), signature, walletPublicKey);
}

function withoutSignature<T extends { signature: string }>(message: Omit<T, "signature"> | T): string {
  const { signature: _omit, ...rest } = message as T;
  return canonicalize(rest);
}

export function signApproval(approval: Omit<SessionApproval, "signature">, ownerPrivateKey: string): string {
  return signBytes(withoutSignature<SessionApproval>(approval), ownerPrivateKey);
}

export function verifyApproval(approval: SessionApproval): boolean {
  return verifyBytes(withoutSignature<SessionApproval>(approval), approval.signature, approval.ownerPubKey);
}

export function signDecision(decision: Omit<PaymentDecision, "signature">, ownerPrivateKey: string): string {
  return signBytes(withoutSignature<PaymentDecision>(decision), ownerPrivateKey);
}

export function verifyDecision(decision: PaymentDecision, ownerPublicKey: string): boolean {
  return verifyBytes(withoutSignature<PaymentDecision>(decision), decision.signature, ownerPublicKey);
}

export function signRevoke(request: Omit<RevokeRequest, "signature">, privateKey: string): string {
  return signBytes(withoutSignature<RevokeRequest>(request), privateKey);
}

export function verifyRevoke(request: RevokeRequest, publicKey: string): boolean {
  return verifyBytes(withoutSignature<RevokeRequest>(request), request.signature, publicKey);
}
