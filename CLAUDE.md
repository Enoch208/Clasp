# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Clasp** is a secure application-to-wallet session layer for the Fiber Network (a hackathon submission, deadline 2026-07-15 23:59 UTC). It lets any app or AI agent connect to a Fiber wallet with **limited, user-edited, time-boxed, revocable authority** instead of permanent RPC credentials or private keys. The memorable flow: `PAIR → REVIEW → APPROVE → PAY (real Fiber) → BLOCK THE ATTACK → REVOKE`.

**[clasp-prd.md](clasp-prd.md) is the source of truth.** It is the final, build-against-this spec — flow (§5), architecture (§6), permission vocabulary (§7), policy engine (§9), tests (§17), and scope discipline (§20–21). Read the relevant section before implementing that surface; do not re-derive requirements from memory.

## Repo reality vs. the PRD

The PRD describes the *target* — a pnpm monorepo (`packages/{protocol,client,wallet-core,token,gateway}`, `apps/{wallet,demo-dapp,server}`, `tests/`). **None of the backend/protocol packages exist yet.** Current state: no commits, and a single `frontend/` Next.js 16 app (React 19, Tailwind v4, TypeScript, npm) containing the marketing **landing page** (`app/page.tsx` + `components/` + `app/styles/*.css`). Its editorial/neo-brutalist design system was ported from an external template and lives as plain CSS (`landing.css`, `clasp.css`, `hover-grid.css`) under the `.overflow-theme` root class; icons go through the single wrapper `components/icons.ts` (lucide-react). The product surfaces (wallet approval, dashboard, security lab, demo dApp) and all `packages/*` are still to be built — follow the PRD §18 layout and package responsibilities; don't invent a different structure.

## Commands

Run inside `frontend/` (the only buildable code today; uses **npm**, not pnpm yet):

```bash
npm run dev      # dev server on :3000
npm run build    # production build — the real "does it compile" check
npm run lint     # eslint (flat config, React 19 purity rules are strict)
```

The PRD's `pnpm verify` (build all packages + full test suite) is the intended top-level gate once the monorepo exists; it does not run yet.

## Architecture — the trust layering

Authority flows one direction and narrows at every hop. The security properties live in the boundaries, so preserve them:

```
App (@Clasp/client SDK) → Relay (transport only, no keys/RPC)
  → Wallet-core (policy engine · approval · spend accounting · revocation)
  → Gateway (allow-listed FNN adapter: new_invoice, get_invoice, send_payment, get_payment)
  → User FNN node (Fiber testnet, private JSON-RPC — never public)
```

In the hackathon build, relay + wallet-core + gateway run as **one Node service** (`apps/server`); the relay boundary is a *module boundary*, not a separate host. That is a documented honesty choice (`REAL_VS_MOCKED.md`), not a shortcut to paper over — the boundaries are still enforced in code and tests.

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
