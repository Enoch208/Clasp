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

## Delegation (attenuation-only)

`delegate()` lets an agent holding `payments:auto` mint a child credential for a sub-agent. It is authority that can only *narrow*:

1. The parent session is `ACTIVE`, its stored facts match its signed token, and the delegation request is signed by the parent's app key → `invalid_signature`; the request origin matches the parent's → `origin_mismatch`; the timestamp is fresh → `stale_timestamp`.
2. The parent must actually hold `payments:auto` → `permission_denied`.
3. The child is checked ⊆ the parent on **every** axis — permissions (subset), asset (equal), per-payment cap (≤), session cap (≤), expiry (≤), origin (inherited, never set by the child). Any widening → `attenuation_violation`.
4. **Nesting is refused** — a child cannot itself delegate → `attenuation_violation`.

The child is a normal session whose facts the wallet signs; it carries a server-side `parent_id`. Its spends run the **same** atomic reservation, additionally drawing down the parent's pool inside the one transaction — so parent + children can never *jointly* exceed the parent's cap, and the child is still bound by its own smaller cap. Revoking the parent **cascades** to every child, so delegated authority never outlives the session it came from.

## Keys

- **Wallet keypair** (server) signs `SessionFacts` into the session token.
- **App keypair** (client SDK) signs every `OperationRequest`; verified against the session's `appPubKey`.

Both are Ed25519 (`@noble/ed25519` + `@noble/hashes`), isomorphic across Node and browser.

## Reporting

This is a hackathon testnet build (no mainnet, no custody). For real-world hardening see the roadmap: standalone encrypted relay, WebAuthn approval, and unforgeable browser-`Origin` binding.
