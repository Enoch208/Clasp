export const LINKS = {
  github: "https://github.com/Enoch208/Clasp",
  npm: "https://www.npmjs.com/package/@useclasp/client",
  quickstart: "https://github.com/Enoch208/Clasp/blob/main/docs/QUICKSTART.md",
  ownerRules: "https://github.com/Enoch208/Clasp#owner-rules--approval-above-an-amount-rate-caps",
  sealedRelay: "https://github.com/Enoch208/Clasp#the-sealed-content-blind-relay",
  video: "https://youtu.be/HUzFXqXWo-A",
  ama: "https://www.reddit.com/r/NervosNetwork/comments/1xms28r/an_ama_with_drey_clasp_creator_and_gone_in_60ms/",
} as const;

export const SKY_MEDIA = {
  video: "/landing/sky.mp4",
  still: "/landing/sky.jpg",
  phone: "/landing/sky-phone.jpg",
} as const;

export const HERO_CELLS = [
  "Clasp is a session layer that lets apps and AI agents pay from a Fiber wallet without ever holding its keys.",
  "The app asks for authority. You cut the limits down and approve. The wallet signs your values, never the app’s.",
  "Every payment runs ten policy checks before it reaches your node. Large ones wait for your signature.",
  "Revoke a session and every later request fails, even a read. Six attacks run live against the real engine.",
] as const;

export const ATTACKS = [
  { label: "Forbidden operation", code: "permission_denied" },
  { label: "Over-limit spend", code: "session_spending_limit_exceeded" },
  { label: "Replayed request", code: "replay_detected" },
  { label: "Stolen token", code: "origin_mismatch" },
  { label: "Forged signature", code: "invalid_signature" },
  { label: "Payment burst", code: "rate_limit_exceeded" },
  { label: "Agent self-approval", code: "invalid_signature" },
  { label: "Oversized payment", code: "single_payment_limit_exceeded" },
  { label: "Stale request", code: "stale_timestamp" },
  { label: "Widened sub-agent", code: "attenuation_violation" },
  { label: "Revoked session", code: "session_revoked" },
  { label: "Expired session", code: "session_expired" },
  { label: "Wrong asset", code: "asset_not_allowed" },
  { label: "Swapped invoice", code: "invoice_amount_mismatch" },
] as const;

export type StripSlot = "on" | "off" | "wide";

export const STRIPS: { gap: "base" | "wide" | "tight" | "mid"; slots: StripSlot[] }[] = [
  { gap: "base", slots: ["on", "off", "on", "off"] },
  { gap: "wide", slots: ["off", "on", "wide", "on", "off"] },
  { gap: "base", slots: ["on", "off"] },
  { gap: "tight", slots: ["on", "on", "off", "wide"] },
  { gap: "mid", slots: ["off", "wide", "on", "off", "on"] },
  { gap: "wide", slots: ["on", "off", "on"] },
  { gap: "base", slots: ["wide", "on", "off", "on"] },
  { gap: "tight", slots: ["off", "on", "wide"] },
  { gap: "mid", slots: ["on", "off", "on", "off"] },
  { gap: "base", slots: ["off", "on", "on"] },
];

export const POLICY_CHECKS = [
  "Session active",
  "Signatures",
  "Permission",
  "Origin",
  "Nonce",
  "Freshness",
  "Invoice amount",
  "Asset",
  "Per-payment cap",
  "Atomic spend",
] as const;

export type Tone = "ok" | "hold" | "no" | "warn" | "quiet";

export const OUTCOMES: { amount: string; tone: Tone; glyph: string; code: string }[] = [
  { amount: "1.0", tone: "ok", glyph: "◆", code: "settled" },
  { amount: "0.8", tone: "hold", glyph: "◇", code: "approval_required" },
  { amount: "10", tone: "no", glyph: "▼", code: "session_spending_limit_exceeded" },
  { amount: "1.0", tone: "no", glyph: "▼", code: "replay_detected" },
  { amount: "0.1", tone: "warn", glyph: "▼", code: "rate_limit_exceeded" },
  { amount: "0.5", tone: "ok", glyph: "◆", code: "settled" },
  { amount: "2.0", tone: "no", glyph: "▼", code: "single_payment_limit_exceeded" },
  { amount: "1.0", tone: "quiet", glyph: "■", code: "session_revoked" },
];

export const PATHS = [
  {
    id: "pay",
    title: "Pay",
    lead: "Under the per-payment cap and inside the session budget, the payment settles on its own. The agent never stops to ask.",
    weight: "One",
    tail: "signed receipt the app can verify against the wallet key.",
  },
  {
    id: "hold",
    title: "Hold",
    lead: "Above the threshold you set, the amount is reserved and nothing is sent. The agent gets approval_required and waits.",
    weight: "Only",
    tail: "a decision signed by your owner key can release it.",
  },
  {
    id: "block",
    title: "Block",
    lead: "Break any rule and the request is rejected before it reaches your Fiber node, with a code the agent can read.",
    weight: "Zero",
    tail: "shannons move. The session budget stays exactly where it was.",
  },
] as const;

export type PathId = (typeof PATHS)[number]["id"];

export const NEWS: { title: string; date: string; href: string; thumb: string }[] = [
  { title: "The SDK is on npm as @useclasp/client and @useclasp/react", date: "November 19, 2026", href: LINKS.npm, thumb: "/landing/news-npm.jpg" },
  { title: "Payments over a limit you set now wait for your signature", date: "November 16, 2026", href: LINKS.ownerRules, thumb: "/landing/news-hold.jpg" },
  { title: "A sealed relay that cannot read the payments it carries", date: "July 16, 2026", href: LINKS.sealedRelay, thumb: "/landing/news-relay.jpg" },
  { title: "Clasp wins Gone in 60ms, the Fiber infrastructure hackathon", date: "July 2026", href: LINKS.ama, thumb: "/landing/news-60ms.jpg" },
];

export const FOOTER_LINKS = [
  { label: "GitHub", href: LINKS.github },
  { label: "npm", href: LINKS.npm },
  { label: "Quickstart", href: LINKS.quickstart },
  { label: "Security Lab", href: "/lab" },
  { label: "Demo video", href: LINKS.video },
  { label: "AMA", href: LINKS.ama },
] as const;
