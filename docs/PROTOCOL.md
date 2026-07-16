# Protocol

Raw FNN method names are never the public protocol. Clasp defines a stable vocabulary and signed wire format. All types live in `@clasp/protocol` (Zod schemas + inferred TypeScript).

## Permission vocabulary

| Tier | Permissions | Rule |
|---|---|---|
| Safe reads | `node:read`, `channels:read`, `payments:read`, `invoices:read` | Grantable in one approval |
| User-approved writes | `invoices:create`, `payments:request`, `payments:auto` | Shown with a plain-language consequence; `payments:auto` requires explicit limits |
| High-risk | `channels:open`, `channels:close`, `peers:connect`, `node:backup` | Defined in the vocabulary; **not grantable in this build** |
| Never exposed | `raw-rpc`, `private-key:export`, `admin:unrestricted` | Structurally impossible — no handler exists |

`GRANTABLE` = safe reads + user writes. An operation whose name isn't in the vocabulary is rejected at the schema boundary.

## Wire formats

**OperationRequest** (the app signs every field except `signature`):
```json
{ "version": "1", "sessionId": "sess_…", "requestId": "req_…", "operation": "payments:request",
  "parameters": { "invoice": "fibt1…", "amount": "100000000", "asset": "CKB", "purpose": "…" },
  "nonce": 4, "timestamp": 1784150100, "signature": "0x…" }
```

**OperationResult** (the wallet signs):
```json
{ "requestId": "req_…", "status": "succeeded", "paymentHash": "0x…", "amount": "100000000",
  "asset": "CKB", "settledAt": "…", "sessionRemaining": "100000000", "signature": "0x…" }
```

**DelegationRequest** (the parent app signs every field except `signature`; `POST /delegations`):
```json
{ "version": "1", "parentSessionId": "sess_…", "delegationId": "del_…", "childAppPubKey": "…",
  "permissions": ["payments:request"], "asset": "CKB", "maxSinglePayment": "50000000",
  "maxSessionSpend": "100000000", "expiresAt": "…", "timestamp": 1784150100, "signature": "0x…" }
```
The wallet replies with the minted child: `{ childSessionId, session, token, walletPubKey }`, or a `ClaspError` (e.g. `attenuation_violation`) if the child is not ⊆ the parent.

**ClaspError** (every rejection): `{ code, message, retryable, nextAction, …fields }`. Codes: `session_not_found`, `session_revoked`, `session_expired`, `invalid_signature`, `permission_denied`, `origin_mismatch`, `replay_detected`, `stale_timestamp`, `nonce_out_of_order`, `invoice_amount_mismatch`, `asset_not_allowed`, `single_payment_limit_exceeded`, `session_spending_limit_exceeded`, `gateway_failure`, `attenuation_violation`.

## Conventions

- **Money** — integer strings in the smallest unit (shannons) everywhere; all arithmetic via BigInt (`@clasp/protocol/money`). No floating point ever touches payment math.
- **Timestamp** — seconds (matches Fiber's wire format); the engine compares against `now` in ms.
- **State machine** — `REQUESTED → REVIEWED → ACTIVE → {EXPIRED | REVOKED}`; illegal transitions throw.

## Gateway ↔ Fiber mapping

Verified live against `nervos/fiber` 0.9.0-rc7 (unprefixed method names, positional `params: [{…}]`, hex-encoded shannon amounts, `Fibt` testnet currency):

| Gateway method | FNN JSON-RPC |
|---|---|
| `newInvoice` | `new_invoice` |
| `getInvoice` | `parse_invoice` |
| `sendPayment` | `send_payment` (+ `get_payment` polling to `Success`/`Failed`) |
| `getPayment` | `get_payment` |
