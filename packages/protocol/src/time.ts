export function expiryToMillis(expiresAt: string): number {
  return /^\d+$/.test(expiresAt) ? Number(expiresAt) : Date.parse(expiresAt);
}
