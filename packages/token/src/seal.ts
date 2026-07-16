import { x25519 } from "@noble/curves/ed25519";
import { xchacha20poly1305 } from "@noble/ciphers/chacha";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, concatBytes, hexToBytes, randomBytes } from "@noble/hashes/utils";

export interface BoxKeypair {
  publicKey: string;
  privateKey: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function generateBoxKeypair(): BoxKeypair {
  const privateKey = x25519.utils.randomPrivateKey();
  return { privateKey: bytesToHex(privateKey), publicKey: bytesToHex(x25519.getPublicKey(privateKey)) };
}

export function boxPublicFromPrivate(privateKeyHex: string): string {
  return bytesToHex(x25519.getPublicKey(hexToBytes(privateKeyHex)));
}

function deriveKey(shared: Uint8Array, ephemeralPub: Uint8Array, recipientPub: Uint8Array): Uint8Array {
  return sha256(concatBytes(shared, ephemeralPub, recipientPub));
}

export function sealTo(recipientPublicKeyHex: string, plaintext: string): string {
  const recipientPub = hexToBytes(recipientPublicKeyHex);
  const ephemeralPriv = x25519.utils.randomPrivateKey();
  const ephemeralPub = x25519.getPublicKey(ephemeralPriv);
  const shared = x25519.getSharedSecret(ephemeralPriv, recipientPub);
  const key = deriveKey(shared, ephemeralPub, recipientPub);
  const nonce = randomBytes(24);
  const ciphertext = xchacha20poly1305(key, nonce).encrypt(encoder.encode(plaintext));
  return JSON.stringify({ v: 1, epk: bytesToHex(ephemeralPub), nonce: bytesToHex(nonce), ct: bytesToHex(ciphertext) });
}

export function openSealed(recipientPrivateKeyHex: string, envelope: string): string {
  const parsed = JSON.parse(envelope) as { epk: string; nonce: string; ct: string };
  const recipientPriv = hexToBytes(recipientPrivateKeyHex);
  const ephemeralPub = hexToBytes(parsed.epk);
  const shared = x25519.getSharedSecret(recipientPriv, ephemeralPub);
  const key = deriveKey(shared, ephemeralPub, x25519.getPublicKey(recipientPriv));
  const plaintext = xchacha20poly1305(key, hexToBytes(parsed.nonce)).decrypt(hexToBytes(parsed.ct));
  return decoder.decode(plaintext);
}
