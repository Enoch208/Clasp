# @useclasp/client

Give an app or AI agent **limited, owner-approved, revocable** access to a Fiber wallet instead of RPC credentials or keys.

The app asks for permissions and spending limits. The wallet's owner reduces them, adds rules, and signs. Every payment then runs a 10-step policy engine in the wallet core before anything reaches the Fiber node.

```bash
npm install @useclasp/client
```

You need a Clasp wallet core to talk to. Run one with Docker (see the [quickstart](https://github.com/Enoch208/Clasp/blob/main/docs/QUICKSTART.md)), or point at the public demo at `https://useclasp.xyz/api`.

## Pair, pay, and handle a held payment

```ts
import { ClaspErrorException, createClaspClient, createClaspWallet } from "@useclasp/client";

const serverUrl = "http://localhost:8790";
const wallet = createClaspWallet({ serverUrl });

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
      maxSessionSpend: "200000000",
      approvalThreshold: "50000000",
      rateLimit: { maxPayments: 10, windowSeconds: 3600 },
    }),
});

const session = await client.connect();

try {
  const receipt = await session.requestPayment({ invoice, amount: "80000000" });
  session.verifyReceipt(receipt);
} catch (error) {
  if (error instanceof ClaspErrorException && error.error.code === "approval_required") {
    const receipt = await session.waitForApproval(error.error.requestId as string);
  }
}
```

Amounts are integer strings in shannons. In a real deployment `approve` is where your app hands the request to the user's wallet; the wallet half (`createClaspWallet`) runs there, holding the owner key, and is the only thing that can approve a session, approve a held payment, or revoke as the owner.

## What the wallet enforces

- **Caps** — per-payment and per-session, reserved atomically so concurrent requests can't jointly exceed them.
- **Approval above an amount** — payments over `approvalThreshold` are reserved and held; only the owner's signed decision settles them.
- **Rate caps** — `rateLimit` payments per window, counted in the same atomic reservation.
- **Origin binding, replay protection, expiry, revocation** — every request is signed by the app key and checked.
- **Delegation** — `session.delegate()` mints a weaker sub-agent session that can only tighten every limit and rule.

Every rejection is structured: `{ code, message, retryable, nextAction }`, for example `rate_limit_exceeded` with `retryAfterSeconds`, or `approval_required` with `nextAction: "await_approval"`.

## API

| | |
|---|---|
| `createClaspClient(config)` | `connect()` → `ClaspSession`; `on("revoked", fn)` |
| `session.requestPayment({ invoice, amount })` | Signed payment through the policy engine; resolves to a wallet-signed receipt |
| `session.waitForApproval(requestId)` | Waits for the owner's decision on a held payment |
| `session.getCapabilities()` | Granted operations, caps, live remaining budget, rules |
| `session.delegate(input)` | Attenuated sub-agent session |
| `session.verifyReceipt(r)` / `getStatement()` / `verifyStatement(s)` | Wallet-signed proofs |
| `session.revoke()` | Revoke as the app |
| `createClaspWallet({ serverUrl, ownerKeypair })` | `approve()`, `listHolds()`, `decide()`, `revoke()` as the owner |

MIT · [useclasp.xyz](https://useclasp.xyz) · [source](https://github.com/Enoch208/Clasp)
