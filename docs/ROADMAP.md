# Roadmap

Clasp is deliberately scoped for the hackathon's Part 2 (applications on Fiber) — every app built there will need exactly this session layer. Post-hackathon work lives here, not in the submission.

## Shipped
- **Attenuated sub-agent delegation.** A parent agent holding `payments:auto` mints a *weaker* child credential (lower caps, expiry no later than its own, same origin) with shared-root accounting: child spends draw down the parent's total, a child can never widen amount/expiry/permissions/origin (`attenuation_violation`), nesting is refused, and revoking the parent cascades to every child. The agent-economy story — live at `/delegate`.
- **`payments:auto`** — the child spends autonomously under pre-approved, cryptographically enforced limits (humans approve once; agents operate within the envelope).
- **Verifiable payment receipts** — every settled payment returns a wallet-signed result; `session.verifyReceipt()` proves settlement against the wallet key.
- **Capability discovery** — `session.getCapabilities()` reports granted operations, caps, live remaining budget, and whether the session can delegate.
- **React components** — `@useclasp/react`: `<ClaspProvider>`, `useClaspSession()`, `<ConnectFiberWalletButton>`; demonstrated by the `/sdk` surface.
- **Verifiable session statements** — `session.getStatement()` returns a wallet-signed audit snapshot; exportable from the dashboard, verifiable with `verifyStatement()`.
- **Owner-signed approvals** — sessions are created only from an approval signed by the owner key; optional owner allow-list (`CLASP_OWNER_PUBKEYS`).
- **Approval above an amount** — payments over the session's threshold are held until the owner signs a decision (`approval_required` → `waitForApproval()`).
- **Rate caps** — N payments per window, enforced inside the atomic reservation; sub-agents count against the parent.
- **Self-host with Docker** — `docker compose up` runs the wallet core (private) behind the keyless relay.

## Policy rules (from the AMA)
- **Time-of-day windows** — payments only during hours the owner picks.
- **Per-recipient budgets** — separate caps per payee.
- **Step-up on unusual activity** — hold payments that don't match the session's usual pattern, not just large ones.

## Protocol & DX
- **Session activity event stream** — subscribe to server-side `session_events` in real time (the export exists; live streaming does not).

## Hardening
- **Unknown-outcome recovery** — reconcile payments the node never confirmed (`approving` holds, timed-out sends) against `get_payment` so reservations can't stay stuck.
- **Relay on a separate host** — the standalone keyless, content-blind relay ships (`@clasp/relay`, live in front of `/api`; sealed X25519 + XChaCha20-Poly1305). Today it's a separate *process* on the same VPS; the remaining step is moving it to its own host.
- **WebAuthn / passkey** approval ceremony (Touch ID / Face ID / Windows Hello).
- **Unforgeable browser `Origin`** binding in addition to the declared origin.
- **QR + deep-link pairing** (`clasp://`).

## Network
- **Multi-asset (UDT)** payments beyond CKB.
- **High-risk permissions** (`channels:open/close`, `peers:connect`, `node:backup`) — defined in the vocabulary; grantable behind per-grant red-warning approval.
- **Channel liquidity automation** — auto-rebalance the wallet→merchant channel.

## Explicitly out of scope
Custody · key management · mainnet · swaps · cross-chain · balance management.
