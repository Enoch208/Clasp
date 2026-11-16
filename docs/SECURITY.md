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
10. **Atomic** reserve: `INSERT consumed_requests` (UNIQUE) → check `spent + amount ≤ cap` → `UPDATE spent` → count this session's payments inside its rate window, all inside one `BEGIN IMMEDIATE` transaction → `session_spending_limit_exceeded` / `rate_limit_exceeded` (with `retryAfterSeconds`). A parent session's rate cap counts its delegated children's payments too.

**Reserve-then-settle:** the gateway is called *outside* the transaction. On failure, spend is refunded, the nonce stays consumed, and a `retryable` `gateway_failure` is returned.

**Held above the approval threshold:** if the session carries an `approvalThreshold` and the amount is above it, the reservation from step 10 stands but nothing is sent. The payment becomes a *hold* and the app gets `approval_required` (`nextAction: "await_approval"`, plus `requestId` and `holdExpiresAt`). Only a decision signed by the session's **owner key** can settle it; deny, expiry (10 minutes) and revocation all refund the reservation. Hold status moves with compare-and-set updates (`pending → approving → settled`), so concurrent approvals can never pay twice.

## Owner approval

A session can only be created from a `SessionApproval` signed by an **owner key**: the wallet's user, not the app. The app proposes permissions and limits; the owner signs the (reduced) values plus the two rules (`approvalThreshold`, `rateLimit`), and that signed approval is the only thing `POST /sessions` accepts. Each approval carries a unique `approvalId`, so one signature can never mint two sessions.

The same owner key is the only key that can approve or decline a held payment, and one of the two keys (app or owner) that can revoke a session. Revocation requests are signed and freshness-checked; nobody else can revoke a session by guessing its id.

**Two modes, reported by `GET /health` as `owners`:**
- `allow-list`: set `CLASP_OWNER_PUBKEYS` and only those keys can approve sessions. This is how a self-hosted wallet core should run.
- `open`: any owner key may approve a session and becomes that session's owner. The public demo at useclasp.xyz runs open so every visitor gets a working wallet. In open mode an app could pair itself with a key it controls, so the approval-threshold guarantee only holds where the owner key is genuinely the user's (allow-list mode).

## Threat model

| Threat | Mitigation |
|---|---|
| **Stolen session token** | Origin binding (step 4), per-session nonces (5), signed operation requests (2), short expiry (1), instant revocation |
| **Privilege escalation** | No path: high-risk permissions aren't grantable in this build; `raw-rpc`/key-export/admin have no handler; the signed session carries the user's *reduced* values — an app can never widen them |
| **Double-spending the budget** | Atomic reserve inside a DB transaction with uniqueness constraints (step 10); the concurrency test proves two simultaneous requests can't jointly exceed the cap |
| **Replay** | `UNIQUE(session_id, nonce)` + `UNIQUE(request_id)` — a resent request is rejected and the payment count stays put |
| **App approves its own large payment** | Held payments only settle on a decision signed by the session's owner key; an app-signed decision gets `invalid_signature` and the payment stays held (Security Lab attack) |
| **Agent bursts or spawns sub-agents to dodge limits** | Rate cap is counted inside the atomic reservation; children count against the parent's cap and can only tighten threshold and rate (`attenuation_violation`) |
| **Public RPC exposure** | The gateway exposes only 4 allow-listed methods; the FNN JSON-RPC is bound to `127.0.0.1` and never tunneled. (Fiber's node itself refuses to bind a public RPC without Biscuit auth — the same principle.) |

## Delegation (attenuation-only)

`delegate()` lets an agent holding `payments:auto` mint a child credential for a sub-agent. It is authority that can only *narrow*:

1. The parent session is `ACTIVE`, its stored facts match its signed token, and the delegation request is signed by the parent's app key → `invalid_signature`; the request origin matches the parent's → `origin_mismatch`; the timestamp is fresh → `stale_timestamp`.
2. The parent must actually hold `payments:auto` → `permission_denied`.
3. The child is checked ⊆ the parent on **every** axis — permissions (subset), asset (equal), per-payment cap (≤), session cap (≤), expiry (≤), approval threshold (≤), rate cap (no more payments, no shorter window), origin and owner (inherited, never set by the child). Any widening → `attenuation_violation`.
4. **Nesting is refused** — a child cannot itself delegate → `attenuation_violation`.

The child is a normal session whose facts the wallet signs; it carries a server-side `parent_id`. Its spends run the **same** atomic reservation, additionally drawing down the parent's pool inside the one transaction — so parent + children can never *jointly* exceed the parent's cap, and the child is still bound by its own smaller cap. Revoking the parent **cascades** to every child, so delegated authority never outlives the session it came from.

## Keys

- **Wallet keypair** (server) signs `SessionFacts` into the session token.
- **App keypair** (client SDK) signs every `OperationRequest`; verified against the session's `appPubKey`.
- **Owner keypair** (the wallet's user) signs `SessionApproval`s, held-payment decisions and owner revocations. In the demo it lives in the browser's local storage; passkeys are on the roadmap.

All three are Ed25519 (`@noble/ed25519` + `@noble/hashes`), isomorphic across Node and browser.

## Reporting

This is a testnet build (no mainnet, no custody). For real-world hardening see the roadmap: WebAuthn/passkey owner keys, unforgeable browser-`Origin` binding, the relay on its own host, and recovery for payments whose outcome is unknown.
