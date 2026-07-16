# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Clasp** is a secure application-to-wallet session layer for the Fiber Network (a hackathon submission, deadline 2026-07-15 23:59 UTC). It lets any app or AI agent connect to a Fiber wallet with **limited, user-edited, time-boxed, revocable authority** instead of permanent RPC credentials or private keys. The memorable flow: `PAIR → REVIEW → APPROVE → PAY (real Fiber) → BLOCK THE ATTACK → REVOKE`.

**[clasp-prd.md](clasp-prd.md) is the source of truth.** It is the final, build-against-this spec — flow (§5), architecture (§6), permission vocabulary (§7), policy engine (§9), tests (§17), and scope discipline (§20–21). Read the relevant section before implementing that surface; do not re-derive requirements from memory.

## Repo reality vs. the PRD

The pnpm monorepo is scaffolded and Spec 1 (backend spine + policy core) is built and integrated. Present:
- `packages/protocol` — schemas, permission vocab, error codes, BigInt money math, state machine (the single source of truth; everything imports it).
- `packages/token` — Ed25519 (`@noble/ed25519`, sha512 via `node:crypto`): `canonicalize`, `signSession`/`verifySession`, `signRequest`/`verifyRequest`, `signResult`. **Node-only today** (browser needs `@noble/hashes/sha512` — a Spec-4 concern once `apps/web` uses the real client).
- `packages/gateway` — `Gateway` interface (exactly `newInvoice`/`getInvoice`/`sendPayment`/`getPayment`), `FakeGateway` (default), `FnnGateway` (throws until Spec 4).
- `packages/wallet-core` — SQLite `Store` (`better-sqlite3`; `UNIQUE(session_id,nonce)` + `UNIQUE(request_id)`) and `evaluate()` (the 10-step engine, atomic reserve-then-settle).
- `packages/client` — the SDK (`createClaspClient` → `connect()`, `requestPayment()`, `session.delegate()`, `getCapabilities()`, `verifyReceipt()`, `getStatement()`/`verifyStatement()`), signs every request with `@clasp/token`.
- `packages/react` — React bindings (`<ClaspProvider>`, `useClaspSession()`, `<ConnectFiberWalletButton>`) over `@clasp/client`; demonstrated by the `/sdk` surface.
- `apps/server` — Express spine; `createApp(walletCore)` depends only on the `WalletCore` interface, and `clasp-wallet-core.ts` implements it over the real packages. `FnnGateway` (REAL) or `FakeGateway` (DEMO) injected; banner reflects mode.
- `apps/web` — Next.js 16 marketing **landing** + six **product surfaces** (`/wallet`, `/dashboard`, `/lab`, `/demo`, `/delegate`, `/sdk`) on the ported editorial/neo-brutalist design (plain CSS under `.overflow-theme`: `landing.css`, `app.css`, `clasp.css`, `hover-grid.css`; icons via the single `components/icons.ts`). Runs on `lib/claspClient.ts` (the real `@clasp/client`) against the live server; the `/sdk` surface uses `@clasp/react` directly.

Convention reconciled during integration: `OperationRequest.timestamp` is in **seconds** (per PRD §9 wire format); `evaluate` multiplies by 1000 to compare against `now` (ms). Real `FnnGateway` + VPS deploy (Spec 4) and delegation (Spec 5) are both built and live: `delegate()` in `@clasp/wallet-core` (attenuation-only child credentials, shared-root spend pool, cascade revoke), `POST /delegations`, `session.delegate()` in the SDK, and the `/delegate` web surface.

## Commands

Everything runs through the pnpm workspace from the repo root:

```bash
pnpm install                     # links workspace; builds better-sqlite3 (in onlyBuiltDependencies)
pnpm -r --if-present run typecheck   # tsc --noEmit across all packages
pnpm test                        # vitest: protocol/token/gateway/wallet-core/client/server
pnpm --filter @clasp/web test    # apps/web logic tests (its own vitest config)
pnpm --filter @clasp/web build   # Next production build (React 19 purity lint is strict)
pnpm --filter @clasp/server start    # boot the Express server (tsx); reads CLASP_WALLET_PRIVATE_KEY
```

`pnpm verify` (root) chains typecheck + test + web build. Internal packages export TypeScript source (`"exports": "./src/index.ts"`) — no per-package build step; vitest/tsx read TS natively and Next uses `transpilePackages`.

The PRD's `pnpm verify` (build all packages + full test suite) is the intended top-level gate once the monorepo exists; it does not run yet.

## Architecture — the trust layering

Authority flows one direction and narrows at every hop. The security properties live in the boundaries, so preserve them:

```
App (@Clasp/client SDK) → Relay (transport only, no keys/RPC)
  → Wallet-core (policy engine · approval · spend accounting · revocation)
  → Gateway (allow-listed FNN adapter: new_invoice, get_invoice, send_payment, get_payment)
  → User FNN node (Fiber testnet, private JSON-RPC — never public)
```

The relay is now a **separate keyless service** (`apps/relay`, `@clasp/relay`): on `useclasp.xyz` every `/api` request passes through it (`GET /api/__relay` proves it) before reaching the wallet core. It holds no wallet key and no FNN RPC URL — it's transport-only, and trustless by signature (a malicious relay that tampers with a request is rejected `invalid_signature`; rewriting origin gives `origin_mismatch`). On the VPS: pm2 `clasp-relay` (PORT 8790, `CLASP_CORE_URL=http://127.0.0.1:8787`), Caddy `/api/*` → 8790 → core 8787. wallet-core + gateway still co-reside in `apps/server` (the core). End-to-end payload sealing (content-blind relay) remains the one documented simplification.

## Invariants that determine correctness (not discoverable from code)

- **The 10-step policy engine (PRD §9) runs on every operation request, in order.** Enforcement is the scored artifact — never bypass, reorder, or short-circuit a check. Step 10 (session-spend reservation) must be **atomic** (DB transaction, not check-then-act); `UNIQUE(session_id, nonce)` and `UNIQUE(request_id)` do the safety work.
- **Money is always an integer string in the smallest unit (shannons).** No floating point ever touches payment math anywhere. Display values are presentation-only, derived at the edge.
- **The user's *reduced* values — not the app's requested ones — get signed into the session.** The app may request authority; the wallet has final control.
- **Only the four allow-listed FNN methods are ever reachable.** `raw-rpc`, key export, and unrestricted admin have **no handler** — they are structurally impossible, and a test asserts no code path reaches RPC outside the allow-list. High-risk permissions (`channels:open/close`, etc.) exist in the vocabulary (PRD §7) but are **not grantable** in this build.
- **Structured, machine-readable errors.** Rejections carry a stable `code` (e.g. `permission_denied`, `session_spending_limit_exceeded`, `replay_detected`, `origin_mismatch`, `session_revoked`) plus `retryable` / `nextAction` — agents branch on them. The four security-lab attacks (PRD §10) and the core-8 tests (PRD §17) must match these codes exactly.
- **Session state machine** (PRD §12): `REQUESTED → REVIEWED → APPROVED(ACTIVE) → {EXPIRED | REVOKED}`; every transition is persisted to a `session_events` log; illegal transitions throw; spend accounting survives restart (SQLite).

## Honesty rules (this project treats them as the product)

- **Never fabricate data.** If a live value can't be read, show a real "unavailable"/loading state — never a guessed number. A `REAL TESTNET` vs `DEMO MODE — NO NETWORK PAYMENT` banner must always reflect reality; the deterministic fallback exists only for infrastructure failure and is never silently substituted.
- **Every claim ships with its mechanism** — write the code that makes it true and be able to demonstrate it. Keep every number (test counts, stats, dates) consistent across README, UI, and submission. Report test counts only *after* they pass.

## Framework gotchas — this is NOT the Next.js in your training data

Next.js 16 + React 19 + Tailwind v4 have breaking changes. `frontend/AGENTS.md` says it and means it: **read `frontend/node_modules/next/dist/docs/` before using any Next API.** The ones that ship silently broken:

- Route `params` is a **Promise**: `const { x } = await params;`.
- A page reading `process.env` at request time needs `export const dynamic = "force-dynamic"` — otherwise the value is baked in at build.
- **React 19 purity lint is strict:** no `Date.now()`, `Math.random()`, or `new Date()` during render (move to `useEffect`); no synchronous `setState` in an effect body.
- **Tailwind v4:** no `tailwind.config.js`. Config is `@import "tailwindcss"` + `@theme` in `app/globals.css` (tokens defined once, there). v4 dropped the default `cursor: pointer` on `<button>` — every interactive element must declare its cursor.
- **Server-only env vars must NOT carry a `NEXT_PUBLIC_` prefix** (that ships them to the browser). Backend URLs and keys stay unprefixed, read only in route handlers / server components.

## Working conventions

- **No comments** — names and structure explain the code. Small, single-responsibility components (split past ~180 lines). One icon system through one wrapper file. Reusable primitives in `components/ui/`; never fork a primitive by copy-paste. Match surrounding idiom.
- **Verify before claiming done.** Run the command and read its output — beware `cmd | tail` (exit code is `tail`'s). Screenshot the rendered UI and look at it, including at **390px width** (a `hidden md:flex` nav leaves mobile users with no navigation). Reproduce a bug before claiming a fix.
- **Build order (PRD §21):** gateway + real payment → policy engine + attacks → pairing/approval UI → revocation/dashboard → SDK polish/docs/tests → (only if submitted-quality) delegation. Record each act the moment it works. Scope creep is the enemy — new ideas go to `ROADMAP.md`, not the build (see P0/P1/never in §20).
- **Git:** commit granularly with plain messages, **no commit trailers** unless asked; commit/push only when asked. Don't manufacture commit history. After the deadline, keep the hosted demo live but do not push feature commits.
