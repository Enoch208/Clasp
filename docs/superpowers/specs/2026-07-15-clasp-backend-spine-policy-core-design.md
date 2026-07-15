# Clasp — Spec 1: Backend Spine + Policy Core

**Status:** Approved (2026-07-15) · **Scope:** PRD build-order stages 1–2 · **Source of truth:** [clasp-prd.md](../../../clasp-prd.md)

This spec covers the security heart of Clasp: the shared contracts, the token layer, the allow-listed gateway, the 10-step policy engine with atomic spend accounting, the HTTP server that wires them, and the core-8 security tests. **No UI** (that is Spec 3) and **no real FNN adapter** (Spec 4) — the gateway ships with a deterministic fake behind a real interface.

Definition of done: one signed payment operation flows end-to-end through the full engine and returns a signed result with a payment hash (fake settlement), **and the core-8 tests pass.**

---

## 1. Package graph

```
packages/protocol      pure — zod schemas · permission vocabulary · error codes · money math · state machine. No I/O.
  ├─ packages/token       + @noble/ed25519 — sign / verify scoped session tokens
  ├─ packages/gateway     Gateway interface + FakeGateway (default) + FnnGateway (interface only in Spec 1)
  └─ packages/wallet-core + better-sqlite3 — policy engine (10 steps) · session store · spend accounting. Gateway injected.
apps/server            express — relay(module) → wallet-core → gateway. Holds the wallet keypair (env).
packages/client        thin signed-HTTP client. Minimal in Spec 1 (used by integration tests); fleshed out in Spec 3.
```

**Isolation invariant:** `wallet-core` receives a `Gateway` by constructor injection, so the policy engine is unit-tested against `FakeGateway` with zero network and zero HTTP. The engine never imports express or the real adapter.

Internal packages export TypeScript source directly (`"exports": "./src/index.ts"`); no per-package build step. Consumers resolve them via the pnpm workspace: vitest and `tsx` read TS natively; Next uses `transpilePackages`.

---

## 2. Protocol contracts (`packages/protocol`)

The single source of truth. Only Chat A edits this; Chats B and C treat it as read-only and re-sync via `git merge main` when it changes.

- **`permissions.ts`** — the four tiers from PRD §7. Exports `GRANTABLE` (safe reads + user-approved writes) and `NEVER_EXPOSED` (`raw-rpc`, `private-key:export`, `admin:unrestricted`). High-risk permissions (`channels:*`, `peers:connect`, `node:backup`) are defined but **not in `GRANTABLE`**. Anything outside the vocabulary has no representation.
- **`money.ts`** — `addAmounts`, `subAmounts`, `cmpAmounts`, `isValidAmount` over **BigInt**. Amounts are integer strings in the smallest unit (shannons). Floats never touch payment math.
- **`state.ts`** — session states `REQUESTED → REVIEWED → ACTIVE → {EXPIRED | REVOKED}` and `canTransition(from, to)`. Illegal transitions throw.
- **`errors.ts`** — `ClaspError { code, message, retryable, nextAction, ...fields }` and a `claspError(code, fields)` factory. Codes are a closed union including `permission_denied`, `session_spending_limit_exceeded`, `replay_detected`, `origin_mismatch`, `session_revoked`, `session_expired`, `invalid_signature`, `invoice_amount_mismatch`, `asset_not_allowed`, `single_payment_limit_exceeded`, `nonce_out_of_order`, `stale_timestamp`.
- **`schemas.ts`** — Zod schemas + inferred types: `PairingRequest`, `SessionFacts`, `OperationRequest`, `OperationResult`, `ClaspErrorSchema`.

`SessionFacts` (what the wallet signs into the token):
```
{ sessionId, origin, permissions[], asset, maxSinglePayment, maxSessionSpend, expiresAt, appPubKey }
```

`OperationRequest` (what the app signs, per PRD §9):
```
{ version:"1", sessionId, requestId, operation, parameters, nonce, timestamp, signature }
```

`OperationResult` (what the wallet signs back):
```
{ requestId, status, paymentHash?, amount?, asset?, settledAt?, sessionRemaining, signature }
```

---

## 3. Data model (`packages/wallet-core`, SQLite via `better-sqlite3`)

- **`sessions`** — `id, origin, permissions(JSON), asset, max_single_payment, max_session_spend, spent DEFAULT '0', app_pubkey, expires_at, state, created_at`. All amounts stored as TEXT integers.
- **`consumed_requests`** — `session_id, nonce, request_id, created_at` with **`UNIQUE(session_id, nonce)`** and **`UNIQUE(request_id)`**. Replay protection is a DB constraint, not app logic.
- **`payments`** — `request_id, session_id, amount, asset, payment_hash, status, settled_at`.
- **`session_events`** — append-only `(id, session_id, type, data JSON, created_at)`; feeds the dashboard/security-lab timeline in Spec 3.

Store exposes a narrow interface: `getSession`, `createSession`, `revoke`, `expireIfDue`, `reserveSpend(tx)`, `refundSpend`, `recordPayment`, `appendEvent`, `isConsumed`.

---

## 4. The 10-step policy engine (`packages/wallet-core`)

`evaluate(request, { store, gateway, walletKeys, now })` runs the checks in PRD §9 order and returns `OperationResult` or throws/returns a `ClaspError`.

Steps 1–9 are pure reads/comparisons:

1. Session exists and is `ACTIVE` (not expired, not revoked) → else `session_revoked` / `session_expired`.
2. Token signature valid **and** token facts equal the stored session → else `invalid_signature`.
3. Operation ∈ session permissions → else `permission_denied { requiredPermission }`.
4. Request origin == session origin → else `origin_mismatch { expected, received }`.
5. `(session, nonce)` / `requestId` not already consumed (quick read) → else `replay_detected { requestId, nonce }`.
6. Timestamp within freshness window → else `stale_timestamp`.
7. Invoice amount decodes to the declared amount (integer compare) → else `invoice_amount_mismatch`.
8. Asset allowed → else `asset_not_allowed`.
9. `amount ≤ maxSinglePayment` → else `single_payment_limit_exceeded`.

Step 10 is the only stateful check — one `BEGIN IMMEDIATE` transaction in the store:
```
INSERT consumed_requests(session, nonce, requestId)   -- UNIQUE violation ⇒ replay_detected (race-safe)
SELECT spent, max_session_spend                        -- spent + amount > max ⇒ ROLLBACK ⇒ session_spending_limit_exceeded
UPDATE sessions SET spent = spent + amount             -- RESERVE, atomically
COMMIT
```

**Reserve-then-settle:** the gateway is called *outside* the transaction. On settlement → write `payments` + `session_events`, return signed `OperationResult`. On gateway failure → `refundSpend` (`spent -= amount`), keep the nonce consumed, return `ClaspError { retryable: true }`.

This is what makes "two concurrent spends cannot jointly exceed the cap" true: the reservation is inside the serialized `BEGIN IMMEDIATE` transaction, so the second reservation sees the first's updated `spent`.

---

## 5. Tokens & signatures (`packages/token`)

Two keypairs, Ed25519 via `@noble/ed25519`:

- **Wallet keypair** (server, from env) signs `SessionFacts` → the session token. `verifySession(token, walletPub)` → facts or throw. Step 2 checks facts == stored session.
- **App keypair** (client SDK) signs every `OperationRequest` over a canonical serialization of all fields except `signature`. Any tampered parameter invalidates the signature. Step 2/`invalid_signature` covers app-request verification against the session's `app_pubkey`.

`token` exports: `generateKeypair`, `signSession`, `verifySession`, `signRequest`, `verifyRequest`, `signResult`, and a stable `canonicalize()` used by all three.

---

## 6. Gateway (`packages/gateway`)

`Gateway` interface exposes exactly the four allow-listed FNN methods — `newInvoice`, `getInvoice`, `sendPayment`, `getPayment` — and nothing else. No passthrough, no `call(method, params)`.

- **`FakeGateway`** — deterministic: `sendPayment` returns a derived `paymentHash` and settles synchronously. Default in Spec 1; the `DEMO MODE` banner reflects this honestly.
- **`FnnGateway`** — interface + typed skeleton only in Spec 1; real JSON-RPC wired in Spec 4 on the VPS node.

The "no raw RPC reachable" core-8 test is structural: it asserts the `Gateway` surface is exactly those four methods and there is no generic passthrough.

---

## 7. Server (`apps/server`, express)

Spec-1 endpoints:
- `POST /sessions` — **dev/simulated-approval**: create an `ACTIVE` session from provided facts (real pairing UI = Spec 3).
- `POST /operations` — accept a signed `OperationRequest`; run `evaluate`; return signed `OperationResult` or a `ClaspError` (HTTP 200 with the structured body; errors are data, not exceptions).
- `POST /sessions/:id/revoke` — transition to `REVOKED`, append event.
- `GET /sessions/:id` — read session state + spend (for the dashboard later).

The server is the single Node service that is relay(module) + wallet-core + gateway. It reads the wallet keypair from env and injects `FakeGateway` (or `FnnGateway` when `CLASP_FNN_URL` is set).

---

## 8. Errors

Every rejection is a `ClaspError` with a machine-readable `code`, plus `retryable` and `nextAction`, produced by the one factory in `protocol`. The four security-lab attacks (Spec 2 UI, but the engine paths exist here) assert these codes verbatim.

---

## 9. Testing — Vitest, the core-8

Unit tests run against `wallet-core` with an in-memory (`:memory:`) SQLite store — no server:

1. operation without permission → `permission_denied`
2. over per-payment cap → `single_payment_limit_exceeded`
3. **cumulative session spend enforced atomically** — two concurrent reservations cannot jointly exceed the cap
4. duplicate nonce → `replay_detected`
5. copied token on another origin → `origin_mismatch`
6. expired session → `session_expired`
7. revoked session → `session_revoked`
8. **no raw RPC** — the gateway exposes exactly the four methods; no passthrough exists

Plus an integration test (Chat B) driving `POST /operations` through the server. README states counts only after green.

---

## 10. Money

Integer strings in the smallest unit everywhere; all arithmetic via `protocol/money.ts` (BigInt). No floating point in any payment path. Display formatting is presentation-only and lives in the UI (Spec 3).

---

## 11. Out of scope for Spec 1

Pairing-code UX / approval / dashboard / security-lab UI (Spec 3) · real `FnnGateway` + VPS deploy + demo recording (Spec 4) · attenuated delegation (Spec 5). The `FnnGateway` interface is defined now; `FakeGateway` is the default so the mode banner reads `DEMO MODE` honestly until the node is live.

---

## 12. Parallel execution map (3 chats)

`packages/protocol` is built and committed to `main` first; then three chats own disjoint directories:

| Chat | Owns | Depends on |
|------|------|-----------|
| **A — Core engine** | `packages/{protocol,token,gateway,wallet-core}` + tests | none; owns the contracts |
| **B — Server + SDK** | `apps/server`, `packages/client`, integration tests, `QUICKSTART` | `protocol` types + `wallet-core` interface (stub, then integrate) |
| **C — Frontend UIs** | `apps/web` (4 screens on the ported design) | `protocol` types + a mock client |

Coordination rule: only Chat A edits `packages/protocol`; B and C re-sync on change.
