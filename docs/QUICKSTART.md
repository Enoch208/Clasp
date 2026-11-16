# Quickstart

From nothing to an agent paying through a Clasp session in a few minutes: run a wallet core, install the SDK, pair with an owner approval, pay, and handle a payment the owner has to approve.

## 1. Run a wallet core

**With Docker** (core stays private, only the keyless relay is published on `:8790`):

```bash
git clone https://github.com/Enoch208/Clasp && cd Clasp
docker compose up --build
curl http://localhost:8790/health
# {"status":"ok","mode":"DEMO","sealing":true,"owners":"open","walletPubKey":"…"}
```

**Without Docker** (Node 20+, pnpm):

```bash
pnpm install
pnpm --filter @clasp/server start                                  # core on :8787
PORT=8790 CLASP_CORE_URL=http://127.0.0.1:8787 pnpm --filter @clasp/relay start
```

With no Fiber node configured the core runs in `DEMO` mode: payments settle locally and every response says so. Configuration, all optional:

| Variable | Meaning |
|---|---|
| `CLASP_WALLET_PRIVATE_KEY` | 64-hex Ed25519 wallet key. Unset → an ephemeral key, and the server warns you. |
| `CLASP_BOX_PRIVATE_KEY` | 64-hex X25519 key for sealed (relay-blind) requests. Unset → ephemeral. |
| `CLASP_OWNER_PUBKEYS` | Comma-separated owner public keys allowed to approve sessions. Unset → `open` mode (any owner key). A malformed list stops the server instead of falling back to open. |
| `CLASP_FNN_URL` / `CLASP_FNN_INVOICE_URL` | Your Fiber node's JSON-RPC (payer / payee). Set → `REAL` mode. From Docker, use `http://host.docker.internal:8227` for a node on the host. See [REAL_TESTNET.md](REAL_TESTNET.md). |
| `CLASP_DB` | SQLite path (Docker uses the `clasp-data` volume). |

For a wallet you actually use, set `CLASP_OWNER_PUBKEYS` to your owner key so only you can approve sessions and held payments.

## 2. Install the SDK

```bash
npm install @useclasp/client
```

## 3. Pair, pay, and handle a held payment

```ts
import { ClaspErrorException, createClaspClient, createClaspWallet } from "@useclasp/client";

const serverUrl = "http://localhost:8790";
const wallet = createClaspWallet({ serverUrl });

async function mint(amount: string) {
  const res = await fetch(`${serverUrl}/invoices`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ amount, asset: "CKB" }),
  });
  return ((await res.json()) as { invoice: string }).invoice;
}

const client = createClaspClient({
  serverUrl,
  origin: "https://agent.example",
  app: { name: "Research Agent" },
  permissions: ["payments:request"],
  asset: "CKB",
  maxSinglePayment: "100000000",
  maxSessionSpend: "300000000",
  approve: (request) =>
    wallet.approve(request, {
      approvalThreshold: "50000000",
      rateLimit: { maxPayments: 10, windowSeconds: 3600 },
    }),
});

const session = await client.connect();

const small = await session.requestPayment({ invoice: await mint("10000000"), amount: "10000000" });
console.log(small.status, session.verifyReceipt(small));

try {
  await session.requestPayment({ invoice: await mint("80000000"), amount: "80000000" });
} catch (error) {
  if (!(error instanceof ClaspErrorException) || error.error.code !== "approval_required") throw error;
  const waiting = session.waitForApproval(error.error.requestId as string);

  const [hold] = await wallet.listHolds(session.sessionId);
  await wallet.decide(hold!, "approve");

  const receipt = await waiting;
  console.log("approved and settled", receipt.amount, session.verifyReceipt(receipt));
}
```

`approve` is the seam between the app and the user's wallet. Here both halves run in one script so you can see the whole flow; in a real app the request goes to the user's wallet, which holds the owner key and signs. The owner can only **narrow** what the app asked for: `wallet.approve()` refuses to add permissions, raise limits, or extend the expiry.

Amounts are integer strings in shannons (1 CKB = `100000000`).

## 4. Branch on structured errors

Every rejection is data with a stable `code`, plus `retryable` and `nextAction`:

```ts
try {
  await session.requestPayment({ invoice, amount });
} catch (error) {
  if (error instanceof ClaspErrorException) {
    switch (error.error.code) {
      case "approval_required":
        return session.waitForApproval(error.error.requestId as string);
      case "rate_limit_exceeded":
        return retryIn(error.error.retryAfterSeconds as number);
      case "session_spending_limit_exceeded":
        return askForSmallerAmount();
    }
  }
  throw error;
}
```

The full list is in [PROTOCOL.md](PROTOCOL.md).

## 5. React

```bash
npm install @useclasp/react @useclasp/client
```

`<ClaspProvider config={…}>`, `useClaspSession()` and `<ConnectFiberWalletButton />` wrap the same client; `config` takes the same fields, including `approve`. The [`/sdk` page](https://useclasp.xyz/sdk) is a live example.

## Verify the repo

```bash
pnpm verify   # typecheck + full test suite + production web build
```
