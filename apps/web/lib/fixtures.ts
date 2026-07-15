import type { PairingRequest } from "@clasp/protocol";

export const PAIRING_CODE = "FP-7K2M4Q";
export const DEFAULT_DURATION_MINS = 60;

export const weatherAgentPairing: PairingRequest = {
  version: "1",
  pairingId: "pair_01HZX7K2M4Q8",
  app: {
    name: "Weather Agent",
    origin: "https://weather.example",
  },
  requestedPermissions: ["node:read", "channels:read", "invoices:create", "payments:request"],
  requestedLimits: {
    asset: "CKB",
    maxSinglePayment: "100000000",
    maxSessionSpend: "500000000",
  },
  expiresAt: "2026-07-15T22:00:00Z",
  nonce: "0x9f2c",
  appPubKey: "a1b2c3d4e5f6a7b8c9d0",
};

export const weatherReport = {
  title: "Premium weather-risk report",
  location: "Rotterdam Port · 51.95°N 4.14°E",
  window: "Next 72 hours",
  headline: "Elevated crane-downtime risk Thursday 14:00–20:00",
  rows: [
    ["Sustained wind", "gusting 24 m/s (Bft 9)"],
    ["Crane cutoff", "20 m/s — exceeded for 6h"],
    ["Precipitation", "42 mm across the window"],
    ["Recommended", "reschedule high-lift ops to Friday AM"],
  ] as const,
};
