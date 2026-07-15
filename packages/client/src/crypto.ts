import {
  generateKeyPairSync,
  createPublicKey,
  createPrivateKey,
  sign as nodeSign,
  verify as nodeVerify,
  type KeyObject,
} from "node:crypto";

const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

export interface Keypair {
  publicKey: string;
  privateKey: string;
}

function rawPublic(key: KeyObject): string {
  return key.export({ format: "der", type: "spki" }).subarray(-32).toString("hex");
}

function rawPrivate(key: KeyObject): string {
  return key.export({ format: "der", type: "pkcs8" }).subarray(-32).toString("hex");
}

function publicKeyObject(hex: string): KeyObject {
  return createPublicKey({ key: Buffer.concat([SPKI_PREFIX, Buffer.from(hex, "hex")]), format: "der", type: "spki" });
}

function privateKeyObject(hex: string): KeyObject {
  return createPrivateKey({ key: Buffer.concat([PKCS8_PREFIX, Buffer.from(hex, "hex")]), format: "der", type: "pkcs8" });
}

export function generateKeypair(): Keypair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return { publicKey: rawPublic(publicKey), privateKey: rawPrivate(privateKey) };
}

export function publicFromPrivate(privateKeyHex: string): string {
  return rawPublic(createPublicKey(privateKeyObject(privateKeyHex)));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    return Object.keys(source)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortValue(source[key]);
        return acc;
      }, {});
  }
  return value;
}

export function canonicalize(value: Record<string, unknown>): string {
  const { signature: _signature, ...rest } = value;
  return JSON.stringify(sortValue(rest));
}

function sign(value: Record<string, unknown>, privateKeyHex: string): string {
  return nodeSign(null, Buffer.from(canonicalize(value), "utf8"), privateKeyObject(privateKeyHex)).toString("hex");
}

function verify(value: Record<string, unknown>, publicKeyHex: string): boolean {
  const signature = value.signature;
  if (typeof signature !== "string") return false;
  try {
    return nodeVerify(null, Buffer.from(canonicalize(value), "utf8"), publicKeyObject(publicKeyHex), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

export const signRequest = sign;
export const verifyRequest = verify;
export const signSession = sign;
export const verifySession = verify;
export const signResult = sign;
export const verifyResult = verify;
