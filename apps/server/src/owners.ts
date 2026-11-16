export function parseOwnerKeys(raw: string | undefined): string[] | null {
  const entries = (raw ?? "")
    .split(",")
    .map((entry) => entry.trim().replace(/^["']|["']$/g, "").replace(/^0x/i, "").toLowerCase())
    .filter((entry) => entry.length > 0);
  if (entries.length === 0) return null;
  const invalid = entries.filter((entry) => !/^[0-9a-f]{64}$/.test(entry));
  if (invalid.length > 0) {
    throw new Error(`CLASP_OWNER_PUBKEYS has ${invalid.length} invalid key(s); expected 64-hex Ed25519 public keys`);
  }
  return entries;
}
