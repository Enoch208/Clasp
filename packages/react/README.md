# @useclasp/react

React bindings for [`@useclasp/client`](https://www.npmjs.com/package/@useclasp/client): connect a Fiber wallet with limited, owner-approved, revocable authority.

```bash
npm install @useclasp/react @useclasp/client
```

```tsx
import { ClaspProvider, ConnectFiberWalletButton, useClaspSession } from "@useclasp/react";

<ClaspProvider
  config={{
    serverUrl,
    origin,
    app: { name: "Acme Checkout" },
    permissions: ["payments:request"],
    asset: "CKB",
    maxSinglePayment: "100000000",
    maxSessionSpend: "300000000",
    approve: (request) => wallet.approve(request),
    sealed: true,
  }}
>
  <Checkout />
</ClaspProvider>;

function Checkout() {
  const { pay, capabilities, status } = useClaspSession();
  return <ConnectFiberWalletButton />;
}
```

`pay()` resolves to `{ ok: true, receipt }` with a verified wallet-signed receipt, or `{ ok: false, error }` with a structured error such as `approval_required` or `rate_limit_exceeded`. `sealed: true` encrypts every request end to end so the relay in between can't read it.

MIT · [useclasp.xyz](https://useclasp.xyz) · [source](https://github.com/Enoch208/Clasp)
