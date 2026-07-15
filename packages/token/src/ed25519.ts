import { createHash } from "node:crypto";
import * as ed from "@noble/ed25519";

ed.etc.sha512Sync = (...messages: Uint8Array[]): Uint8Array => {
  const hash = createHash("sha512");
  for (const message of messages) hash.update(message);
  return new Uint8Array(hash.digest());
};

const { bytesToHex, hexToBytes } = ed.etc;
const encoder = new TextEncoder();

export function utf8Bytes(text: string): Uint8Array {
  return encoder.encode(text);
}

export function randomPrivateKey(): string {
  return bytesToHex(ed.utils.randomPrivateKey());
}

export function publicKeyFromPrivate(privateKeyHex: string): string {
  return bytesToHex(ed.getPublicKey(hexToBytes(privateKeyHex)));
}

export function signBytes(message: string, privateKeyHex: string): string {
  return bytesToHex(ed.sign(utf8Bytes(message), hexToBytes(privateKeyHex)));
}

export function verifyBytes(message: string, signatureHex: string, publicKeyHex: string): boolean {
  try {
    return ed.verify(hexToBytes(signatureHex), utf8Bytes(message), hexToBytes(publicKeyHex));
  } catch {
    return false;
  }
}
