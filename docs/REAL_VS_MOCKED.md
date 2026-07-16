# Real vs. mocked

Clasp's honesty layer, stated plainly. The UI banner always reflects which mode a request ran in: **`REAL FIBER TESTNET`** or **`DEMO MODE — NO NETWORK PAYMENT`**.

## Real (enforced in code, tested, or verified on-chain)

- **The 10-step policy engine** — every operation is checked in order; errors are structured data (`@clasp/wallet-core`). 104 automated tests, including the core-8.
- **Atomic spend accounting** — a single `BEGIN IMMEDIATE` SQLite transaction with `UNIQUE(session_id, nonce)` and `UNIQUE(request_id)`. A two-concurrent-reservations test proves two spends cannot jointly exceed the cap.
- **The four attacks** — `permission_denied`, `single_payment_limit_exceeded`, `replay_detected`, `origin_mismatch` are produced by the real engine on real signed requests. Nothing in the security lab is simulated.
- **Revocation** — moves the session to `REVOKED`; all later requests fail with `session_revoked`. Revoking a parent **cascades** to every delegated child.
- **Attenuated delegation** — an agent with `payments:auto` mints a child credential checked ⊆ its parent on every axis (permissions, per-payment cap, session cap, expiry, origin); widening any of them returns `attenuation_violation`, and nesting is refused. Child spends draw from the parent's pool via the same atomic reservation. Enforced by `delegate()` and exercised in the test suite.
- **Ed25519 tokens** — the wallet signs the session facts; the app signs every operation request; tampering invalidates the signature.
- **Allow-listed gateway** — only `new_invoice` / `parse_invoice` / `send_payment` / `get_payment` are reachable; a structural test asserts no raw-RPC passthrough.
- **Real Fiber testnet settlement** — the deployed site (`useclasp.xyz`) runs the real `FnnGateway` against real `nervos/fiber` nodes and settles over a real funded channel. Verified payment: `0x3d2c38daf7b4945aacda7fae58348647bb8ad4cb7c65e5786103d0e1f9ccdcfa` (`get_payment` → `Success`).

## Simplified in this build (documented, not hidden)

- **Relay is a module boundary, not a separate host.** The relay/transport, wallet-core, and gateway run in one service. The security properties (relay never touches keys/RPC, gateway allow-list, origin binding) are enforced regardless. A standalone encrypted relay is on the roadmap.
- **The "merchant" is a second node we run.** Clasp's demo has the wallet pay a report seller; the seller is a second Fiber node on the same host (`CLASP_FNN_INVOICE_URL`). In production the merchant is any Fiber node on the network. (A single-node self-payment can't route back through one channel — this split is the faithful model.)
- **Origin binding uses the app-declared origin** (`x-clasp-origin`) in this build. A browser's unforgeable `Origin` header is a stronger production hardening (roadmap).
- **Approval is a device-PIN model in the UI.** A WebAuthn/passkey ceremony is a roadmap item.

## Not built (roadmap, never faked)

Signed payment receipts · capability discovery (`session.getCapabilities()`) · standalone encrypted relay · WebAuthn passkeys · QR / deep-link pairing · multi-asset (UDT) · high-risk channel-management permissions.

The mode banner, this document, and the code agree. An honest "not yet" beats a fake green badge.
