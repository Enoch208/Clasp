import { sha512 } from "@noble/hashes/sha512";
import * as ed from "@noble/ed25519";

// Pure-JS sha512 so the token layer runs identically in Node and the browser.
ed.etc.sha512Sync = (...messages: Uint8Array[]): Uint8Array => {
  const total = messages.reduce((sum, message) => sum + message.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const message of messages) {
    merged.set(message, offset);
    offset += message.length;
  }
  return sha512(merged);
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
