# Real vs. mocked

Clasp's honesty layer, stated plainly. The UI banner always reflects which mode a request ran in: **`REAL FIBER TESTNET`** or **`DEMO MODE — NO NETWORK PAYMENT`**.

## Real (enforced in code, tested, or verified on-chain)

- **The 10-step policy engine** — every operation is checked in order; errors are structured data (`@clasp/wallet-core`). 110 automated tests, including the core-8.
- **Atomic spend accounting** — a single `BEGIN IMMEDIATE` SQLite transaction with `UNIQUE(session_id, nonce)` and `UNIQUE(request_id)`. A two-concurrent-reservations test proves two spends cannot jointly exceed the cap.
- **The four attacks** — `permission_denied`, `single_payment_limit_exceeded`, `replay_detected`, `origin_mismatch` are produced by the real engine on real signed requests. Nothing in the security lab is simulated.
- **Revocation** — moves the session to `REVOKED`; all later requests fail with `session_revoked`. Revoking a parent **cascades** to every delegated child.
- **Attenuated delegation** — an agent with `payments:auto` mints a child credential checked ⊆ its parent on every axis (permissions, per-payment cap, session cap, expiry, origin); widening any of them returns `attenuation_violation`, and nesting is refused. Child spends draw from the parent's pool via the same atomic reservation. Enforced by `delegate()` and exercised in the test suite.
- **Ed25519 tokens** — the wallet signs the session facts; the app signs every operation request; tampering invalidates the signature.
- **Verifiable receipts** — every settled payment returns a wallet-signed `OperationResult`; `session.verifyReceipt()` checks it against the wallet key, so the app holds cryptographic proof of settlement (tampering flips it to invalid). Shown live on the demo payment card.
- **Capability discovery** — `session.getCapabilities()` reports the granted operations, asset, per-payment cap, live remaining budget, expiry, and whether the session can delegate.
- **Verifiable session statements** — `session.getStatement()` returns a wallet-signed snapshot (spend, payment count, remaining, state) the user can download from the dashboard as a portable audit artifact; `verifyStatement()` proves it against the wallet key.
- **React bindings** — `@clasp/react` (`<ClaspProvider>`, `useClaspSession()`, `<ConnectFiberWalletButton>`) drives the whole `/sdk` surface as a second app (Acme Checkout) on the same policy engine.
- **Allow-listed gateway** — only `new_invoice` / `parse_invoice` / `send_payment` / `get_payment` are reachable; a structural test asserts no raw-RPC passthrough.
- **Real Fiber testnet settlement** — the deployed site (`useclasp.xyz`) runs the real `FnnGateway` against real `nervos/fiber` nodes and settles over a real funded channel. Verified payment: `0x3d2c38daf7b4945aacda7fae58348647bb8ad4cb7c65e5786103d0e1f9ccdcfa` (`get_payment` → `Success`).
- **Standalone relay (separate service).** On `useclasp.xyz` every `/api` request flows through `@clasp/relay` — a distinct keyless process (`GET /api/__relay` → `{ "role": "relay", "holdsKeys": false }`) that forwards to the wallet core. It holds no wallet key and no FNN RPC URL, so it cannot sign sessions or reach the node. It's **trustless by signature**: a test proves a malicious relay that alters the operation body is rejected with `invalid_signature`, and one that rewrites the origin gets `origin_mismatch` — authority lives in the app-signed request, verified end-to-end by the core. Transport is TLS (Cloudflare → Caddy).

## Simplified in this build (documented, not hidden)

- **The relay does not yet content-encrypt payloads.** It is a separate, keyless, trustless service and transport is TLS-encrypted, but it forwards plaintext request bodies (it can read them, it just can't forge or tamper). An end-to-end *sealed* relay that is blind to payload contents is the remaining hardening.
- **The "merchant" is a second node we run.** Clasp's demo has the wallet pay a report seller; the seller is a second Fiber node on the same host (`CLASP_FNN_INVOICE_URL`). In production the merchant is any Fiber node on the network. (A single-node self-payment can't route back through one channel — this split is the faithful model.)
- **Origin binding uses the app-declared origin** (`x-clasp-origin`) in this build. A browser's unforgeable `Origin` header is a stronger production hardening (roadmap).
- **Approval is a device-PIN model in the UI.** A WebAuthn/passkey ceremony is a roadmap item.

## Not built (roadmap, never faked)

End-to-end sealed (content-blind) relay · WebAuthn passkeys · QR / deep-link pairing · multi-asset (UDT) · high-risk channel-management permissions.

The mode banner, this document, and the code agree. An honest "not yet" beats a fake green badge.
