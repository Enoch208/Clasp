# Clasp Quickstart — server + SDK (Spec 1)

This is the backend spine of Clasp: an HTTP service that runs the policy engine and a
thin signed-HTTP client SDK. It lets an app or agent open a **limited, time-boxed,
revocable** wallet session and settle payments through it — the app can *request*
authority, but the wallet keeps final control.

> **Mode:** this build ships the deterministic `FakeGateway`, so payments settle
> locally with a derived payment hash. The server banner reads
> `DEMO MODE — NO NETWORK PAYMENT`. The real Fiber adapter (`FnnGateway`) lands in Spec 4.

## What's here

| Package | Role |
|---|---|
| `packages/protocol` | Shared contracts: zod schemas, permission vocabulary, error codes, money math, state machine. Pure, no I/O. |
| `packages/client` | The SDK: `createClaspClient({...})` → `connect()`, `session.request()`, `session.requestPayment()`, `revoke()`. Signs every request with the app key; emits `revoked`. |
| `apps/server` | Express service: `POST /sessions`, `POST /operations`, `POST /sessions/:id/revoke`, `GET /sessions/:id`. Holds the wallet keypair; injects the gateway; runs the engine. |

## Run it

```bash
pnpm install
pnpm --filter @clasp/server dev      # tsx watch, listens on :8787 by default
```

Environment (all optional in dev):

| Var | Meaning |
|---|---|
| `PORT` | Listen port (default `8787`). |
| `CLASP_WALLET_PRIVATE_KEY` | 64-hex Ed25519 wallet key. If unset, an **ephemeral** dev key is generated (sessions reset on restart, and the server says so). |
| `CLASP_FNN_URL` | Reserved for Spec 4. Setting it today logs a note and still uses `FakeGateway`. |

## Use the SDK

```ts
import { createClaspClient } from "@clasp/client";

const client = createClaspClient({
  serverUrl: "http://127.0.0.1:8787",
  origin: "https://weather.example",
  app: { name: "Weather Agent" },
  permissions: ["payments:request", "invoices:read"],
  asset: "CKB",
  maxSinglePayment: "100000000",   // integer strings, smallest unit (shannons)
  maxSessionSpend: "250000000",
});

client.on("revoked", (sessionId) => {
  console.log("session revoked out-of-band:", sessionId);
});

const session = await client.connect();               // POST /sessions (dev/simulated approval)

const result = await session.requestPayment({         // POST /operations, signed with the app key
  invoice: "fibinv1_CKB_40000000",
  amount: "40000000",
});
console.log(result.status, result.paymentHash, result.sessionRemaining);

const state = await session.getState();               // GET /sessions/:id
console.log(state.spent, state.state);
```

Rejections are **data, not exceptions on the wire**: `POST /operations` always returns
HTTP 200, with either a signed `OperationResult` or a structured `ClaspError`
(`{ code, message, retryable, nextAction, ... }`). The SDK turns a `ClaspError` body
into a thrown `ClaspErrorException` you can branch on:

```ts
import { ClaspErrorException } from "@clasp/protocol";

try {
  await session.requestPayment({ invoice: "fibinv1_CKB_200000000", amount: "200000000" });
} catch (e) {
  if (e instanceof ClaspErrorException) {
    console.log(e.error.code);        // "single_payment_limit_exceeded"
    console.log(e.error.nextAction);  // "reduce_amount"
  }
}
```

## The endpoints

| Method / path | Body → response |
|---|---|
| `POST /sessions` | session facts (origin, permissions, asset, limits, `expiresAt`, `appPubKey`) → `201 { sessionId, session, token, walletPubKey }`. Dev/simulated approval creates an `ACTIVE` session; the real approval UI is Spec 3. |
| `POST /operations` | signed `OperationRequest` (+ `x-clasp-origin` header) → `200` signed `OperationResult` **or** `ClaspError`. |
| `POST /sessions/:id/revoke` | → `200 { session }` (state `REVOKED`), or `404` `ClaspError`. |
| `GET /sessions/:id` | → `200 { session }` (state + accumulated spend), or `404` `ClaspError`. |

The declared **origin** travels in the `x-clasp-origin` header (a real browser's
unforgeable `Origin` header wins when present — that hardening is a Spec 3 / real-relay
concern). A copied token replayed from another origin fails with `origin_mismatch`.

## Verify

```bash
pnpm test        # vitest: protocol unit tests, server contract tests, client end-to-end
pnpm typecheck   # tsc --noEmit across every package
```

The end-to-end path (`apps/server/src/operations.integration.test.ts`) drives a real
listening server through the real SDK: connect → sign → settle → revoke → the client
receives the `revoked` event and its next payment is blocked.

## Integration seams (temporary)

Spec 1 is built in parallel with the core engine. Until `packages/{token,gateway,wallet-core}`
merge to `main`, this track carries small stand-ins it will delete on integration:

- `apps/server/src/wallet-core.ts` defines the `WalletCore` interface the server depends on;
  `apps/server/src/stub/` provides a working implementation (policy engine + `FakeGateway` +
  Ed25519 signing via `node:crypto`). After `git merge main`, the stub is replaced by
  `@clasp/wallet-core`'s `evaluate()`, `@clasp/gateway`'s `FakeGateway`, and `@clasp/token`.
- `packages/client/src/crypto.ts` is the client's signing stand-in for `@clasp/token`; it uses
  the same canonical serialization (recursive key sort, `signature` excluded), so signatures
  stay valid across the swap.
