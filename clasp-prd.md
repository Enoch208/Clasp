# PRD — Clasp

**The secure application-to-wallet session layer for Fiber Network**

| | |
|---|---|
| **Document status** | Final — build against this |
| **Version** | 1.0 |
| **Date** | July 15, 2026 |
| **Submission** | Gone in 60ms: Fiber Network Infrastructure Hackathon |
| **Category** | Category 1 — Wallet and Payment UX Infrastructure |
| **Sub-focus** | Wallet connection flows, channel/payment abstraction, drop-in integration SDKs, payment confidence and safety |
| **Deadline** | July 15, 2026, 23:59 UTC — all scoring artifacts (repo, video, hosted link, form) complete by then |

---

## 1. One-line definition

Clasp is open-source infrastructure — a pairing protocol, wallet policy engine, allow-listed FNN gateway, and TypeScript client SDK — that lets any application or AI agent connect to a Fiber wallet with **limited, user-edited, time-boxed, revocable authority**, instead of permanent RPC credentials or private keys.

**Tagline:** *Connect apps to Fiber wallets. Never hand over the keys.*

**The memorable flow (use everywhere):**

```
PAIR → REVIEW → APPROVE → PAY (real Fiber) → BLOCK THE ATTACK → REVOKE
```

---

## 2. The story (this is the video's spine)

**Act 1 — The dangerous default.** Today, an app that wants to make Fiber payments asks for an FNN RPC URL and a credential. That is permanent, unlimited wallet authority — and Fiber's own documentation warns against exposing the JSON-RPC interface to arbitrary machines. The problem isn't "how can an app pay?" It's: **"how can an app request exactly the authority it needs, for a limited time and amount, and lose it the moment the user says so?"**

**Act 2 — The permissioned session.** The app asks to connect. The user sees, in plain language, exactly what is being requested — and *edits it down* before approving. The wallet, not the app, has final control.

**Act 3 — A real payment, inside the rules.** The app requests 1 CKB. The wallet checks permission, origin, nonce, amount, and session budget — then settles a **real Fiber testnet payment** and returns a signed result with the payment hash.

**Act 4 — The wallet fights back.** The same app turns malicious: it tries a forbidden operation, an over-limit spend, a replayed request, a stolen-token cross-origin call. Every attack is **blocked live** with a machine-readable reason on a visible security timeline.

**Act 5 — Control returns to the human.** One tap: *Revoke.* Every further request — even an innocent read — fails with `session_revoked`.

**Close.** Fiber already has payments. What it lacked was a safe relationship between wallets and applications. Clasp is that relationship.

---

## 3. Problem statement

Applications integrating Fiber today need some combination of: an FNN RPC address, a permanent credential, a custom proxy, broad payment authority, and wallet-specific glue code. Every one of those is a liability. There is no standard way for an app to identify itself, request scoped authority, have that authority reduced by the user, operate under enforced spending limits, and be revoked instantly.

**Gap in the ecosystem (positioning, never insults):** Fiber Forge makes Fiber buildable and testable. FiberX gives developers provider-style payment components. Trickle enables budget-capped metered grants. FiberFill makes fresh nodes receivable. **Clasp defines who an application is, what wallet authority it receives, how much it can spend, and how that authority ends.** That is the missing layer — and it is squarely inside Category 1's brief: wallet infrastructure that abstracts complexity while keeping users safe.

---

## 4. Goals and non-goals

### Goals

- **G1 (Real).** A paired application completes a real FNN testnet payment through the session — permission-checked, limit-checked, nonce-checked — with the payment hash displayed. No mocks in the primary path.
- **G2 (User sovereignty).** The permission review screen translates every permission into plain-language consequences, and the user can **reduce** spend caps and duration before approving. The app may request authority; it cannot demand it.
- **G3 (Enforcement, proven live).** A 10-step policy engine validates every operation. Four attacks are demonstrated and blocked on camera: `permission_denied`, `session_spending_limit_exceeded`, `replay_detected`, `origin_mismatch`.
- **G4 (Revocation).** One user action kills the session; all subsequent requests fail with `session_revoked`.
- **G5 (Never raw RPC).** The public protocol is a stable Clasp permission vocabulary. The gateway exposes only allow-listed, high-level operations; `raw-rpc`, key export, and unrestricted admin are structurally impossible.
- **G6 (Reusable).** A TypeScript SDK where `connect()` + `requestPayment()` is the whole integration; a stranger can pair a new app against the hosted wallet in five minutes from QUICKSTART.md.
- **G7 (Judge-provable).** Hosted demo (dApp + wallet + security lab) live through judging, with labeled real-vs-demo modes and a per-event evidence trail.

### Non-goals (documented, not built)

- Custody, key management, balance management, swaps, cross-chain, mainnet.
- Mobile native apps; QR-camera scanning (short pairing code + link instead).
- WebAuthn/passkey ceremony (approval UI models it; roadmap item).
- A standalone production relay service (see §6 honesty note).
- Channel management UI (`channels:open/close` exist in the vocabulary as high-risk permissions but are **not grantable** in the hackathon build).

---

## 5. The complete product flow

### Step 1 — Application creates a pairing request

```ts
import { createClaspClient } from "@Clasp/client";

const fiber = createClaspClient({
  appName: "Weather Agent",
  appUrl: "https://weather.example",
  iconUrl: "https://weather.example/icon.png"
});

const session = await fiber.connect({
  permissions: ["node:read", "channels:read", "invoices:create", "payments:request"],
  limits: {
    asset: "CKB",
    maxSinglePayment: "100000000",   // integer string, smallest unit (shannons)
    maxSessionSpend:  "500000000"
  },
  expiresIn: "1h"
});
```

The SDK produces a signed pairing request:

```json
{
  "version": "1",
  "pairingId": "pair_01...",
  "app": { "name": "Weather Agent", "origin": "https://weather.example", "icon": "..." },
  "requestedPermissions": ["node:read", "channels:read", "invoices:create", "payments:request"],
  "requestedLimits": { "asset": "CKB", "maxSinglePayment": "100000000", "maxSessionSpend": "500000000" },
  "expiresAt": "2026-07-15T22:00:00Z",
  "nonce": "0x..."
}
```

The dApp displays a **short pairing code** (e.g. `FP-7K2M4Q`) and a click-through link to the wallet page. (QR + `Clasp://` deep links: roadmap.)

### Step 2 — Wallet shows the permission review screen

```
Weather Agent wants to:

✓ View node information
✓ View channel readiness
✓ Create invoices
✓ Request Fiber payments        ← "Each payment still requires your approval."

Maximum per payment: 1 CKB
Maximum session spend: 5 CKB
Session duration: 1 hour

This application CANNOT:
✕ Open or close channels
✕ Export wallet secrets
✕ Change node settings
✕ Spend above the approved limit
```

**Design rule:** never show raw operation names alone. Every permission is translated into a consequence. `payments:request` → "This app may ask you to make payments; each one still requires approval." `payments:auto` → "This app may automatically spend up to the approved limit."

### Step 3 — User edits the requested authority

The user reduces before approving: 5 CKB → **2 CKB**, 1 hour → **15 minutes**. The wallet has final control; the approved values — not the requested ones — are what get signed into the session.

### Step 4 — Approval and session issuance

The user confirms via the wallet's approval control (device-PIN model; Touch ID / Face ID / Windows Hello passkey ceremony is a documented roadmap item). The wallet issues a **signed, scoped session token** carrying:

```
session("sess_01...");
origin("https://weather.example");
permission("node:read"); permission("channels:read");
permission("invoices:create"); permission("payments:request");
asset("CKB");
max_single_payment(100000000);
max_session_spend(200000000);        // the user-REDUCED value
expires_at("2026-07-15T21:15:00Z");
```

Token format: Biscuit if integration is clean (Fiber already uses Biscuit-based authorization concepts, making attenuation a natural fit); otherwise an Ed25519-signed token carrying identical facts — the choice is documented, and judges are scored on **enforcement**, which lives in the policy engine either way.

The app receives the session token. It never receives: the FNN admin credential, the wallet's private key, or unrestricted RPC authority.

---

## 6. Architecture

```
┌──────────────────┐
│ Application      │  @Clasp/client SDK
└────────┬─────────┘
         │ signed session request / signed operation requests
         ▼
┌──────────────────┐
│ Clasp Relay  │  message transport only — no keys, no RPC,
│ (transport)      │  cannot spend, modify, approve, or read secrets
└────────┬─────────┘
         ▼
┌──────────────────┐
│ Clasp Wallet │  policy engine · user approval · spend accounting
└────────┬─────────┘
         │ allow-listed high-level operation
         ▼
┌──────────────────┐
│ Local Gateway    │  FNN adapter: new_invoice, get_invoice,
│                  │  send_payment, get_payment — nothing else
└────────┬─────────┘
         │ private JSON-RPC (never public)
         ▼
┌──────────────────┐
│ User FNN Node    │  Fiber testnet
└──────────────────┘
```

**Honesty note (goes in REAL_VS_MOCKED.md and the submission):** in the hackathon build, relay, wallet, and gateway run as one Node service on the VPS; the relay boundary is a module boundary, not a separate host. The *security properties* (relay never touches RPC or keys; gateway allow-list; origin binding) are enforced in code and tests either way. A standalone encrypted relay is the production design, shown in the diagram and roadmap.

**Critical invariant, tested:** the public internet never touches FNN JSON-RPC, and no code path exposes methods outside the allow-list.

---

## 7. The permission vocabulary (the protocol)

Raw FNN method names are never the public protocol. Clasp defines a stable vocabulary:

| Tier | Permissions | Rules |
|---|---|---|
| Safe reads | `node:read`, `channels:read`, `payments:read`, `invoices:read` | Grantable in one approval |
| User-approved writes | `invoices:create`, `payments:request`, `payments:auto` | Shown with plain-language consequence; `payments:auto` requires explicit limits |
| High-risk | `channels:open`, `channels:close`, `peers:connect`, `node:backup` | Defined in the vocabulary; **not grantable in this build**; spec requires separate red-warning approval per grant (and optionally per use) |
| Never exposed | `raw-rpc`, `private-key:export`, `admin:unrestricted` | Structurally impossible — no handler exists; tested |

This table is the answer to "how does the protocol prevent privilege escalation."

---

## 8. Spending modes

**`payments:request` — confirm every payment.** Each payment opens a wallet approval screen showing amount, purpose, destination, session spent/remaining. Best for normal dApps, large payments, new apps.

**`payments:auto` — automatic limited spending.** The user approves once: max per payment, max total, duration, origin. The agent then pays without interruption — but the wallet enforces every limit on every call. This is the agent-economy story: *humans approve individual payments; agents operate under pre-approved, cryptographically limited authority.* (Complementary to Trickle's metered grants — Clasp governs the whole wallet relationship: identity, permissions, limits, revocation.)

---

## 9. The real payment flow

App-side:

```ts
const result = await session.requestPayment({
  invoice: "fibt1...",
  amount: "100000000",
  asset: "CKB",
  purpose: "Premium weather-risk report"
});
```

Wire format (every operation request is signed):

```json
{
  "version": "1",
  "sessionId": "sess_01...",
  "requestId": "req_01...",
  "operation": "payments:request",
  "parameters": { "invoice": "fibt1...", "amount": "100000000", "asset": "CKB", "purpose": "Premium weather-risk report" },
  "nonce": 4,
  "timestamp": 1784150100,
  "signature": "0x..."
}
```

### The 10-step policy engine (every request, in order)

1. Session exists and is `ACTIVE` (not expired, not revoked).
2. Token signature valid; token facts match stored session.
3. Operation is permitted by the session's permission set.
4. Request origin matches the session's bound origin.
5. Nonce is unused (strictly increasing per session; persisted).
6. Timestamp within freshness window.
7. Invoice amount matches declared amount (decoded, integer comparison).
8. Asset is allowed.
9. Amount ≤ per-payment limit.
10. Cumulative session spend + amount ≤ session limit (checked and reserved **atomically** — DB transaction, not check-then-act).

Then (for `payments:request`) the wallet shows:

```
Weather Agent requests a payment
Amount: 1 CKB · Purpose: Premium weather-risk report
Destination: 03ab...91ff
Session spent: 0 CKB · Remaining allowance: 2 CKB
[Reject]  [Pay]
```

On approval, the gateway calls FNN (`send_payment`, then `get_payment` until settled), and the wallet returns a signed result:

```json
{
  "requestId": "req_01...",
  "status": "succeeded",
  "paymentHash": "0x...",
  "amount": "100000000",
  "asset": "CKB",
  "settledAt": "2026-07-15T21:04:31Z",
  "sessionRemaining": "100000000",
  "signature": "0x..."
}
```

**Money rules:** amounts are integer strings in the smallest unit everywhere; no floating point ever touches payment math; display values are presentation-only.

---

## 10. The security lab (the demo's second money shot)

After a successful payment, the same paired app runs four live attacks. Each produces a structured rejection and a visible event on the security timeline. Nothing is simulated — these are real requests hitting the real policy engine.

| # | Attack | Response |
|---|---|---|
| 1 | Requests `channels:open` (never granted) | `{"code":"permission_denied","requiredPermission":"channels:open"}` |
| 2 | Requests 10 CKB with 1 CKB remaining | `{"code":"session_spending_limit_exceeded","requested":"1000000000","remaining":"100000000"}` |
| 3 | Replays the earlier successful payment request (same nonce + requestId) | `{"code":"replay_detected","requestId":"req_01...","nonce":4}` — payment count stays **1** |
| 4 | `https://evil.example` presents the copied session token | `{"code":"origin_mismatch","expected":"https://weather.example","received":"https://evil.example"}` |

Security timeline rendering:

```
21:06:02  BLOCKED  channels:open            permission missing
21:06:14  BLOCKED  payment 10 CKB           exceeds session allowance
21:06:31  BLOCKED  replay of req_01         nonce already consumed
21:06:48  BLOCKED  request from evil.example origin mismatch
```

All error codes are machine-readable with `retryable` and `nextAction` fields — agents branch on failures instead of dying on them.

---

## 11. Revocation

Wallet → **Active sessions**:

```
Weather Agent
Permissions: 4 · Spent: 1 of 2 CKB
Expires in: 11 minutes · Last activity: 8 seconds ago
[Revoke session]
```

On revoke, the session state becomes `REVOKED` (persisted). The app then attempts an innocent `node:read`:

```json
{ "code": "session_revoked", "message": "This wallet session has been revoked." }
```

Most projects demo connection and payment. Almost none demo the user **taking authority back**. This segment is scripted, recorded, and tested.

---

## 12. Session state machine

```
REQUESTED → REVIEWED → APPROVED(ACTIVE) → { EXPIRED | REVOKED }
```

- Every transition persisted to a `session_events` log (renders the dashboard timeline).
- Illegal transitions throw and are tested.
- Spend accounting survives service restart (SQLite persistence).
- DB constraints do the safety work: `UNIQUE(session_id, nonce)`, `UNIQUE(request_id)`, atomic spend reservation in a transaction.

---

## 13. Sub-agent delegation (P1 — the differentiator, built only after P0 is recorded)

A parent agent holding `payments:auto` (1 CKB total, 30 min) mints an **attenuated** child credential: 0.02 CKB per payment, 0.1 CKB total, 5 minutes, same origin. The child cannot increase amounts, extend expiry, add permissions, or remove the origin restriction.

Demo: child attempts 0.2 CKB → `attenuation_violation`. Shared-root accounting: child spends draw down the parent's total, so a 1-CKB parent cannot mint ten 1-CKB children.

If the clock wins: the delegation model ships fully specified in PROTOCOL.md with the enforcement path described, honestly labeled as roadmap — never faked.

---

## 14. Developer experience

The entire integration:

```ts
import { createClaspClient } from "@Clasp/client";

const fiber = createClaspClient({ appName: "Weather Agent", appUrl: "https://weather.example" });
const session = await fiber.connect({ permissions: [...], limits: {...}, expiresIn: "1h" });

const info    = await session.request({ operation: "node:read" });
const payment = await session.requestPayment({ invoice, purpose: "Premium weather data" });

session.on("revoked", () => disablePaidFeatures());
const capabilities = await session.getCapabilities();   // adapt to what was actually granted
```

React wrapper (`<ClaspProvider>` + `<ConnectFiberWalletButton />`) ships if time allows; the plain TS SDK is the scored artifact. QUICKSTART.md gets a stranger from clean clone to a paired app against the hosted wallet in five minutes — verified before submission.

---

## 15. Product surfaces — four screens, no sprawl

1. **Demo dApp** — disconnected state → connect → granted capabilities → payment request → signed result with payment hash.
2. **Wallet approval** — app identity, translated permissions, editable caps/duration, approve/reject.
3. **Session dashboard** — active sessions, spend meters, activity log, revoke button.
4. **Security lab** — four attack buttons, live blocked-event timeline, mode banner.

Persistent UI banner: `REAL TESTNET` vs `DEMO MODE — NO NETWORK PAYMENT` (deterministic fallback exists only for infrastructure failure and is never silently substituted).

---

## 16. The five-minute demo

**0:00–0:35 — The problem.** Show an app form asking for FNN RPC URL + admin token. "Today, integrating a Fiber wallet means handing an application permanent RPC access — which Fiber itself warns against." Delete the fields. "Clasp replaces permanent access with a permissioned session."

**0:35–1:20 — Pair.** Connect → pairing code → wallet review screen → **reduce 5 CKB to 2 CKB, 1 h to 15 min** → approve. The app connects and shows its granted (reduced) capabilities.

**1:20–2:10 — Real payment.** App requests 1 CKB for a weather-risk report → wallet approval sheet → pay → `Payment succeeded · REAL FIBER TESTNET · hash 0x… · settled in <measured> ms · remaining 1 CKB` → unlocked report renders. *(Latency is displayed as measured, never promised.)*

**2:10–3:20 — Attack the wallet.** Four buttons, four live blocks: `channels:open` → blocked · 10 CKB → blocked · replay → blocked, payment count still 1 · evil.example → blocked. "Possessing the session token does not give an application wallet authority."

**3:20–4:05 — Revoke.** Revoke in the wallet → app's innocent `node:read` → `SESSION_REVOKED`.

**4:05–4:35 — Integration.** `connect()` and `requestPayment()` on screen. "This is reusable wallet infrastructure, not a single dApp."

**4:35–5:00 — Close.** "Fiber already has payments. What it lacked was a safe relationship between wallets and applications. Clasp lets any app connect, request limited authority, make real Fiber payments — and lose that authority the moment the user says so. No private keys. No permanent credentials. No unlimited access."

Recording rule: capture each act the moment it works; never let polish block a recording.

---

## 17. Test suite

Core eight (mirror the demo's claims exactly):

```
✓ operation without permission is rejected          (permission_denied)
✓ over-limit payment is rejected                    (per-payment cap)
✓ cumulative session spending is enforced atomically (two concurrent spends cannot exceed cap)
✓ duplicate nonce is rejected                        (replay_detected)
✓ copied token fails on another origin               (origin_mismatch)
✓ expired session is rejected
✓ revoked session is rejected
✓ no raw RPC operation is reachable through any code path
```

Extended (as time allows): wallet may reduce requested authority / app cannot widen it · duplicate requestId rejected · malformed token rejected · modified parameters invalidate signature · invoice amount mismatch rejected · child token cannot widen permissions or limits.

README states test counts **only after they pass**: e.g. `Security tests: 8/8 passing · Real Fiber testnet flow: verified`.

---

## 18. Repository

```
Clasp/
├── packages/
│   ├── protocol/        # pairing, session, operation, result, error schemas; permission vocabulary
│   ├── client/          # createClaspClient, session.request/requestPayment, events
│   ├── wallet-core/     # policy engine (10 steps), session store, spend accounting, revocation
│   ├── token/           # Biscuit or Ed25519 session tokens (documented choice)
│   └── gateway/         # allow-listed FNN adapter: new_invoice, get_invoice, send_payment, get_payment
├── apps/
│   ├── wallet/          # approval screen, dashboard, security timeline
│   ├── demo-dapp/       # Weather Agent
│   └── server/          # hosts relay transport + wallet-core + gateway (one VPS service)
├── docs/
│   ├── QUICKSTART.md · PROTOCOL.md · SECURITY.md
│   ├── REAL_VS_MOCKED.md · DEMO.md · ROADMAP.md
└── tests/
```

README order: one-sentence explanation → live demo → 90-second video → quickstart → architecture image → real testnet proof (payment hash) → real vs mocked → packages → security model → test commands → roadmap. Badges: MIT · CI · tests · live demo · TESTNET-ONLY.

`pnpm verify` = build all packages + run full test suite. Green or it isn't done.

---

## 19. Judge Q&A — prepared answers

**"How is this different from FiberX?"** FiberX provides provider-style payment components for developers. Clasp defines the *trust relationship*: app identity, scoped permissions, user-edited limits, enforced budgets, and revocation. They compose — a FiberX-style component could run on top of a Clasp session.

**"How is this different from Trickle?"** Trickle meters usage under a budget grant. Clasp governs the entire wallet relationship — who the app is, what operations it may perform, its limits, and its termination. Trickle-style grants are exactly the kind of authority a Clasp session could carry.

**"What stops a stolen token?"** Origin binding, per-session nonces, signed operation requests, short expiry, and instant revocation — each demonstrated live in the security lab.

**"What stops double-spending the session budget?"** Atomic spend reservation inside a DB transaction with uniqueness constraints; the concurrency test proves two simultaneous requests cannot jointly exceed the cap.

**"Can the app escalate privileges?"** The vocabulary has no path: high-risk permissions aren't grantable in this build, `raw-rpc`/key-export/admin have no handlers, and the app can never widen what the user approved — the signed session carries the user's reduced values.

**"What's real?"** Real FNN testnet invoices and payments through the gateway; real policy enforcement; real revocation. The relay is a module boundary in this build (documented); passkeys and QR pairing are roadmap. REAL_VS_MOCKED.md and the UI banners say exactly this.

**"Why Fiber?"** Fast off-chain settlement and an RPC surface that explicitly should not be handed to applications — Fiber needs a session layer more than most payment networks do.

---

## 20. Scope control

### P0 — must ship (the recorded demo)
Pairing code flow · review screen with plain-language translation · user-edited caps/duration · signed scoped session · 10-step policy engine · real FNN testnet payment · per-payment and session limits (atomic) · nonce replay protection · origin binding · revocation · security lab (4 attacks) · TS client SDK · hosted demo · REAL_VS_MOCKED.md · core 8 tests.

### P1 — winning additions (only after P0 is deployed AND recorded)
Attenuated sub-agent delegation with shared-root accounting · signed payment receipts · capability discovery · React components · session activity export · extended tests.

### Never tonight (ROADMAP.md)
QR camera scanning + deep links · WebAuthn passkeys · standalone encrypted relay · mobile apps · balance management · swaps · cross-chain · mainnet · channel-management UI · social recovery · analytics · in-app AI assistant.

---

## 21. Build order (record after every stage)

1. **Gateway + real payment.** FNN adapter (allow-list only) → one hardcoded-session payment end-to-end. **→ Record the payment the moment it settles.**
2. **Policy engine + attacks.** Session store, 10 checks, DB constraints, the four rejection paths. **→ Record the security lab.**
3. **Pairing + approval UI.** Pairing code, review screen with translation and editable limits, session issuance.
4. **Revocation + dashboard.** **→ Record the revocation act.**
5. **SDK polish + docs + tests green + video cut + submission fields.**
6. **(Only if all above is submitted-quality) Delegation.** **→ Record act if built.**

A lower stage never blocks a completed recording of a higher one.

### Deadline discipline
Everything judges score — repo, video, hosted link, form answers — must be complete at 23:59 UTC. After the deadline: keep the hosted demo **live and stable** (that's required), fix outages, but do **not** push feature commits; commit timestamps are public and post-deadline feature work can disqualify or discredit a submission. Post-hackathon development belongs in ROADMAP.md and the follow-on grant story (Community Fund DAO), and Clasp is deliberately positioned for Part 2 of this hackathon series (applications on Fiber), where every app built will need exactly this session layer.

---

## 22. Definition of finished

- [ ] A stranger can open the hosted demo, pair the dApp with the wallet, and see the granted (reduced) capabilities.
- [ ] A real testnet payment completes through the session; the payment hash is displayed.
- [ ] The user-edited limits — not the app-requested ones — are what the session enforces.
- [ ] All four attacks are blocked live with structured errors; replay leaves payment count at 1.
- [ ] Two concurrent spends cannot jointly exceed the session cap (test proves it).
- [ ] Revocation immediately kills all access, including reads.
- [ ] No code path reaches FNN RPC outside the four allow-listed methods.
- [ ] Repo installs from a clean clone; `pnpm verify` passes; quickstart works exactly as written.
- [ ] Video shows pair → review/reduce → approve → real pay → four blocks → revoke, uncut through the payment.
- [ ] REAL_VS_MOCKED.md matches the UI banners; every submission claim has a link, test, screenshot, or live proof.

---

## 23. Submission field mapping (CKBoost Quests 2 & 3)

| Field | Answer |
|---|---|
| Category | 1 — Wallet and Payment UX Infrastructure |
| Overview | Secure app-to-wallet session protocol + policy engine + FNN gateway + TS SDK; audience: dApp developers, agent developers, wallet builders |
| Problem | Apps today need permanent FNN RPC credentials, which Fiber's docs warn against; Clasp replaces them with scoped, user-edited, revocable sessions |
| System design | §5 flow + §6 architecture + §9 policy engine + §12 state machine |
| Setup environment | Node 20 / TypeScript pnpm monorepo, Express, SQLite, Dockerized FNN testnet node on ~$4 VPS (receipt kept; AI usage logged for the $20 allowance) |
| Tooling | FNN JSON-RPC via allow-listed gateway (`new_invoice`, `get_invoice`, `send_payment`, `get_payment`), fiber-pay as adapter accelerant, biscuit-auth or @noble/ed25519, CKB testnet + Pudge faucet |
| Current functionality | Exactly what passed `pnpm verify` and §22 — with explicit real-vs-mocked disclosure |
| Future functionality | Passkeys, QR/deep-link pairing, standalone encrypted relay, sub-agent delegation (if not shipped), receipts, capability discovery, wallet simulator, multi-wallet — plus the Part 2 story: every Fiber application will need this session layer |
| GitHub | Monorepo, MIT, README in §18 order, CI badge |
| Video | §16 script, real payment uncut |
| Hosted setup | dApp + wallet + security lab on VPS, live through judging |
| Screenshots | review screen with reduced limits · payment result with hash · four blocked attacks on the timeline · revoked-session error · mode banner |

---

## 24. Positioning statement (use verbatim)

> The ecosystem has payment tools, metering tools, and node tools. **Clasp is the missing trust layer**: it defines who an application is, what wallet authority it receives, how much it can spend, and how that authority ends — enforced by a real policy engine, demonstrated against real attacks, settled with a real Fiber payment, and revocable by the user in one tap. No private keys. No permanent credentials. No unlimited access.
