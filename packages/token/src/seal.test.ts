import { describe, it, expect } from "vitest";
import { generateBoxKeypair, boxPublicFromPrivate, sealTo, openSealed } from "./seal";

describe("sealed box (X25519 + XChaCha20-Poly1305)", () => {
  it("round-trips a payload only the recipient private key can open", () => {
    const core = generateBoxKeypair();
    const message = JSON.stringify({ invoice: "fibt1qsecret", amount: "100000000", purpose: "coffee" });

    const envelope = sealTo(core.publicKey, message);
    expect(openSealed(core.privateKey, envelope)).toBe(message);
  });

  it("the envelope never contains the plaintext (relay is blind)", () => {
    const core = generateBoxKeypair();
    const envelope = sealTo(core.publicKey, "invoice=fibt1qsecret amount=100000000");

    expect(envelope).not.toContain("fibt1qsecret");
    expect(envelope).not.toContain("100000000");
    expect(envelope).not.toContain("invoice");
  });

  it("derives the recipient public key from its private key", () => {
    const core = generateBoxKeypair();
    expect(boxPublicFromPrivate(core.privateKey)).toBe(core.publicKey);
  });

  it("rejects a tampered ciphertext", () => {
    const core = generateBoxKeypair();
    const envelope = JSON.parse(sealTo(core.publicKey, "hello")) as { ct: string; epk: string; nonce: string };
    const flipped = envelope.ct.slice(0, -2) + (envelope.ct.endsWith("00") ? "11" : "00");
    const tampered = JSON.stringify({ ...envelope, ct: flipped });

    expect(() => openSealed(core.privateKey, tampered)).toThrow();
  });

  it("cannot be opened by a different key", () => {
    const core = generateBoxKeypair();
    const attacker = generateBoxKeypair();
    const envelope = sealTo(core.publicKey, "hello");

    expect(() => openSealed(attacker.privateKey, envelope)).toThrow();
  });
});
