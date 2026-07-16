# Clasp

**Connect apps to Fiber wallets. Never hand over the keys.**

Clasp is open-source infrastructure — a pairing protocol, a wallet **policy engine**, an **allow-listed Fiber gateway**, and a **TypeScript SDK** — that lets any application or AI agent connect to a [Fiber Network](https://www.fiber.world/) wallet with **limited, user-edited, time-boxed, revocable** authority, instead of a permanent RPC URL and credential.

[![MIT](https://img.shields.io/badge/license-MIT-black)](LICENSE) ![tests](https://img.shields.io/badge/tests-104%20passing-2FA46A) ![mode](https://img.shields.io/badge/network-CKB%20testnet-FFCC33) [![live](https://img.shields.io/badge/demo-useclasp.xyz-5BA4FF)](https://useclasp.xyz)

> **Live demo → [useclasp.xyz](https://useclasp.xyz)** — running in **REAL FIBER TESTNET** mode. Payments settle over a real Fiber payment channel.

*Submission — Gone in 60ms: Fiber Network Infrastructure Hackathon · Category 1 (Wallet & Payment UX Infrastructure).*

---

## The problem

To make a Fiber payment today, an app needs an FNN RPC URL plus a credential — which is **permanent, unlimited wallet authority**. Fiber itself refuses to expose this: a node **won't bind its JSON-RPC to a public interface without Biscuit auth** (we hit this guard directly while deploying). There's no standard way for an app to *identify itself*, request *scoped* authority, have the user *reduce* it, operate under *enforced* limits, and be *revoked*.

**Clasp is that missing session/trust layer.** It sits directly on Fiber's payment RPC (`new_invoice` / `parse_invoice` / `send_payment` / `get_payment`) through an allow-listed gateway, so the public internet never touches the node's JSON-RPC and only those four high-level operations are ever reachable.

## Real testnet proof

A payment settled **through the live UI**, verified on the node (`get_payment` → `Success`):

```
payment_hash: 0x3d2c38daf7b4945aacda7fae58348647bb8ad4cb7c65e5786103d0e1f9ccdcfa
```

![Real testnet payment](docs/screenshots/07-real-testnet-payment.png)

## The flow — `PAIR → REVIEW → APPROVE → PAY → BLOCK THE ATTACK → REVOKE`

| Review & reduce | Payment + hash | Attacks blocked |
|---|---|---|
| ![review](docs/screenshots/02-wallet-review.png) | ![pay](docs/screenshots/03-payment-succeeded.png) | ![lab](docs/screenshots/04-security-lab.png) |

1. **Pair** — an app requests scoped permissions + spend limits (no RPC URL, no credential).
2. **Review & reduce** — the wallet translates each permission into a plain-language consequence; the user *lowers* the caps and duration.
3. **Approve** — the wallet signs a scoped **Ed25519 session token** carrying the *reduced* values.
4. **Pay** — each request runs the **10-step policy engine**; a real Fiber payment settles and returns a signed result with the hash.
5. **Block** — a malicious app is stopped live: `permission_denied`, `single_payment_limit_exceeded`, `replay_detected`, `origin_mismatch`.
6. **Revoke** — one tap moves the session to `REVOKED`; every later request fails with `session_revoked`.

## Architecture

```
App (@clasp/client) ─▶ Relay (transport; a module boundary in this build)
      │  signed operation requests
      ▼
   wallet-core ── 10-step policy engine · session store (SQLite) · atomic spend · revocation
      │  allow-listed high-level ops (4 methods only)
      ▼
   gateway ── FnnGateway → private FNN JSON-RPC ── Fiber testnet
```

The hosted deployment runs two Fiber nodes — a **wallet** (payer) and a **merchant** (payee) — connected by a real funded channel, so `Request payment` is a genuine cross-node settlement. See [docs/REAL_VS_MOCKED.md](docs/REAL_VS_MOCKED.md) and [docs/REAL_TESTNET.md](docs/REAL_TESTNET.md).

## Sub-agent delegation

An agent holding `payments:auto` can mint an **attenuated** child credential for a sub-agent — lower caps, an expiry no later than its own, the same origin, **never wider**. Child spends draw from the parent's **shared pool** (one budget for the whole tree, reserved atomically), and revoking the parent **cascades** to every child. Any attempt to widen amount, expiry, permissions, or origin is rejected with `attenuation_violation`, and nesting is refused (one level only). Try it live at **[useclasp.xyz/delegate](https://useclasp.xyz/delegate)**.

![Sub-agent delegation](docs/screenshots/08-delegation.png)

### Packages
| Package | Responsibility |
|---|---|
| `@clasp/protocol` | Zod schemas · permission vocabulary · error codes · BigInt money math · state machine |
| `@clasp/token` | Ed25519 sign/verify for sessions, operations, results (isomorphic Node/browser) |
| `@clasp/gateway` | `Gateway` interface (exactly 4 methods) · `FakeGateway` · real `FnnGateway` |
| `@clasp/wallet-core` | SQLite store + the 10-step `evaluate()` engine with atomic reserve-then-settle |
| `@clasp/client` | The SDK: `createClaspClient()` → `connect()`, `requestPayment()`, `session.delegate()` |
| `apps/server` | Express service wiring relay ⊕ wallet-core ⊕ gateway |
| `apps/web` | Next.js: landing + wallet approval, dashboard, delegation, security lab, demo dApp |

## Security model

- **10-step policy engine** on every operation (PRD §9): session ACTIVE, token + request signatures, permission, **origin binding**, nonce/replay, timestamp freshness, invoice-amount match, asset, per-payment cap, and an **atomic** cumulative-spend reservation (`BEGIN IMMEDIATE` transaction with `UNIQUE(session_id, nonce)` / `UNIQUE(request_id)`).
- **Allow-listed gateway** — only `new_invoice` / `parse_invoice` / `send_payment` / `get_payment` are reachable; `raw-rpc`, key export, and admin have no handler (structural test).
- The signed session carries the **user's reduced values** — an app can never widen what was approved.
- **Delegation is attenuation-only** — a child credential is checked ⊆ its parent on every axis (permissions, per-payment cap, session cap, expiry, origin); it shares the parent's spend pool and dies when the parent is revoked.

## Quickstart (local)

```bash
pnpm install
pnpm --filter @clasp/server start   # http://localhost:8787  (DEMO mode, FakeGateway)
pnpm --filter @clasp/web dev        # http://localhost:3000
```
Open `localhost:3000` → Demo → Connect → Wallet (reduce) → Approve → pay → Dashboard → Security Lab. To settle real testnet payments, set `CLASP_FNN_URL` — see [docs/REAL_TESTNET.md](docs/REAL_TESTNET.md).

## Tests

```bash
pnpm test                        # 104 tests: protocol, token, gateway, wallet-core, client, server
pnpm --filter @clasp/web test    # web logic
pnpm -r --if-present run typecheck
```
The core-8 security tests mirror the demo's claims exactly, including a two-concurrent-spends atomicity test and a no-raw-RPC structural test.

## Docs
[QUICKSTART](docs/QUICKSTART.md) · [PROTOCOL](docs/PROTOCOL.md) · [SECURITY](docs/SECURITY.md) · [REAL_VS_MOCKED](docs/REAL_VS_MOCKED.md) · [REAL_TESTNET (deploy)](docs/REAL_TESTNET.md) · [ROADMAP](docs/ROADMAP.md)

## License
MIT
