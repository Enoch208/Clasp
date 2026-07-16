# Security model

Clasp's job is to give an application *exactly* the wallet authority a user approved — no more, for no longer — and to make that enforceable, provable, and revocable.

## The 10-step policy engine

Every operation request runs through `evaluate()` (`@clasp/wallet-core`) in this order. The first failure returns a structured `ClaspError`; nothing after it runs.

1. Session exists and is `ACTIVE` (not revoked, not expired) → `session_revoked` / `session_expired`
2. Session-token signature valid **and** its facts equal the stored session; request signature valid → `invalid_signature`
3. Operation ∈ the session's granted permissions → `permission_denied`
4. Request origin == the session's bound origin → `origin_mismatch`
5. `(session, nonce)` / `requestId` not already consumed → `replay_detected`
6. Timestamp within the freshness window → `stale_timestamp`
7. Invoice decodes to the declared amount → `invoice_amount_mismatch`
8. Asset allowed → `asset_not_allowed`
9. `amount ≤ per-payment cap` → `single_payment_limit_exceeded`
10. **Atomic** reserve: `INSERT consumed_requests` (UNIQUE) → check `spent + amount ≤ cap` → `UPDATE spent`, all inside one `BEGIN IMMEDIATE` transaction → `session_spending_limit_exceeded`

**Reserve-then-settle:** the gateway is called *outside* the transaction. On failure, spend is refunded, the nonce stays consumed, and a `retryable` `gateway_failure` is returned.

## Threat model

| Threat | Mitigation |
|---|---|
| **Stolen session token** | Origin binding (step 4), per-session nonces (5), signed operation requests (2), short expiry (1), instant revocation |
| **Privilege escalation** | No path: high-risk permissions aren't grantable in this build; `raw-rpc`/key-export/admin have no handler; the signed session carries the user's *reduced* values — an app can never widen them |
| **Double-spending the budget** | Atomic reserve inside a DB transaction with uniqueness constraints (step 10); the concurrency test proves two simultaneous requests can't jointly exceed the cap |
| **Replay** | `UNIQUE(session_id, nonce)` + `UNIQUE(request_id)` — a resent request is rejected and the payment count stays put |
| **Public RPC exposure** | The gateway exposes only 4 allow-listed methods; the FNN JSON-RPC is bound to `127.0.0.1` and never tunneled. (Fiber's node itself refuses to bind a public RPC without Biscuit auth — the same principle.) |

## Keys

- **Wallet keypair** (server) signs `SessionFacts` into the session token.
- **App keypair** (client SDK) signs every `OperationRequest`; verified against the session's `appPubKey`.

Both are Ed25519 (`@noble/ed25519` + `@noble/hashes`), isomorphic across Node and browser.

## Reporting

This is a hackathon testnet build (no mainnet, no custody). For real-world hardening see the roadmap: standalone encrypted relay, WebAuthn approval, and unforgeable browser-`Origin` binding.
