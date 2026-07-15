import {
  sessionFactsSchema,
  claspError,
  ClaspErrorException,
  type SessionFacts,
  type OperationRequest,
  type OperationResult,
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

export function signResult(result: Omit<OperationResult, "signature">, walletPrivateKey: string): OperationResult {
  const signature = signBytes(canonicalize(result), walletPrivateKey);
  return { ...result, signature };
}

export function verifyResult(result: OperationResult, walletPublicKey: string): boolean {
  const { signature, ...rest } = result;
  return verifyBytes(canonicalize(rest), signature, walletPublicKey);
}
