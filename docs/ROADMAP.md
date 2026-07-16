# Roadmap

Clasp is deliberately scoped for the hackathon's Part 2 (applications on Fiber) — every app built there will need exactly this session layer. Post-hackathon work lives here, not in the submission.

## Shipped
- **Attenuated sub-agent delegation.** A parent agent holding `payments:auto` mints a *weaker* child credential (lower caps, expiry no later than its own, same origin) with shared-root accounting: child spends draw down the parent's total, a child can never widen amount/expiry/permissions/origin (`attenuation_violation`), nesting is refused, and revoking the parent cascades to every child. The agent-economy story — live at `/delegate`.
- **`payments:auto`** — the child spends autonomously under pre-approved, cryptographically enforced limits (humans approve once; agents operate within the envelope).
- **Verifiable payment receipts** — every settled payment returns a wallet-signed result; `session.verifyReceipt()` proves settlement against the wallet key.
- **Capability discovery** — `session.getCapabilities()` reports granted operations, caps, live remaining budget, and whether the session can delegate.
- **React components** — `@clasp/react`: `<ClaspProvider>`, `useClaspSession()`, `<ConnectFiberWalletButton>`; demonstrated by the `/sdk` surface.
- **Verifiable session statements** — `session.getStatement()` returns a wallet-signed audit snapshot; exportable from the dashboard, verifiable with `verifyStatement()`.

## Protocol & DX
- **Session activity event stream** — subscribe to server-side `session_events` in real time (the export exists; live streaming does not).

## Hardening
- **End-to-end sealed relay** — the standalone keyless relay ships (`@clasp/relay`, live in front of `/api`); the remaining step is sealing payloads so the relay is blind to request contents (it is already trustless by signature, just not content-private).
- **WebAuthn / passkey** approval ceremony (Touch ID / Face ID / Windows Hello).
- **Unforgeable browser `Origin`** binding in addition to the declared origin.
- **QR + deep-link pairing** (`clasp://`).

## Network
- **Multi-asset (UDT)** payments beyond CKB.
- **High-risk permissions** (`channels:open/close`, `peers:connect`, `node:backup`) — defined in the vocabulary; grantable behind per-grant red-warning approval.
- **Channel liquidity automation** — auto-rebalance the wallet→merchant channel.

## Explicitly out of scope
Custody · key management · mainnet · swaps · cross-chain · balance management.
