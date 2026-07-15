# Going real — Fiber testnet on the VPS

This flips Clasp from `DEMO MODE` (FakeGateway) to `REAL TESTNET` by pointing the Clasp
server at a real Fiber Network Node (FNN). **You run these on the VPS** — no credentials
in chat.

## The security boundary (do not break it)

```
public internet ──▶ Clasp server (:8787, exposed via cloudflared)
                        │  allow-listed gateway — 4 methods only
                        ▼
                     FNN JSON-RPC (:8227, PRIVATE — localhost only, never tunneled)
```

**Only the Clasp server is exposed.** The FNN RPC stays bound to `127.0.0.1` on the VPS —
this is the whole point of Clasp. Do **not** put cloudflared in front of `:8227`.

## 1. Run a Fiber testnet node

This recipe is **verified** — a `nervos/fiber:0.9.0-rc7` node booted and served JSON-RPC,
and the `FnnGateway` was confirmed against it.

```bash
mkdir -p fiber-node/ckb && cd fiber-node
curl -s -o config.yml https://raw.githubusercontent.com/nervosnetwork/fiber/v0.9.0-rc7/config/testnet/config.yml
openssl rand -hex 32 > ckb/key                 # node identity/CKB key; fund THIS node's address later
# RPC must stay private — the node REFUSES to bind 0.0.0.0 without a Biscuit key (its own guard).
# Keep rpc.listening_addr = 127.0.0.1:8227 in config.yml.
docker run -d --name fiber-node -v "$PWD":/fiber \
  -e FIBER_SECRET_KEY_PASSWORD=change-me -e RUST_LOG=info \
  nervos/fiber:0.9.0-rc7 -c /fiber/config.yml -d /fiber
```
The node uses the public CKB testnet RPC (`testnet.ckbapp.dev`) — no local CKB chain needed.

Verify it answers (via a sidecar sharing the node's private netns — never expose :8227):
```bash
docker run --rm --network container:fiber-node curlimages/curl -s http://127.0.0.1:8227 \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"new_invoice","params":[{"amount":"0x5f5e100","currency":"Fibt"}]}'
# → {"result":{"invoice_address":"fibt1...", ...}}
```

## 2. Fund it and open a channel (the gate for a real hash)

A real payment needs testnet CKB **and outbound liquidity in a channel**. Verified: with no
channel, `send_payment` returns exactly `Insufficient balance: max outbound liquidity 0`.
- Fund the node's CKB address at the Pudge faucet: <https://faucet.nervos.org/>
- Connect to a peer and open a channel (`connect_peer`, `open_channel` — testnet bootstrap
  peers are in `config.yml` under `bootnode_addrs`).
- Wait for the channel to reach `CHANNEL_READY` with local (outbound) balance.

## 3. Point Clasp at the node

```bash
export CLASP_FNN_URL=http://127.0.0.1:8227     # the PRIVATE node RPC
export CLASP_WALLET_PRIVATE_KEY=<64-hex>        # stable wallet key (else ephemeral per restart)
pnpm --filter @clasp/server start
# log should read: "mode: REAL TESTNET — settling through FNN at http://127.0.0.1:8227"
```

The gateway maps (method names **verified live** against 0.9.0-rc7 — unprefixed):
`newInvoice → new_invoice`, `getInvoice → parse_invoice`, `sendPayment → send_payment`
(+ `get_payment` polling to `Success`/`Failed`), `getPayment → get_payment`. Amounts are hex
shannons; currency `Fibt`.

## 4. Expose the Clasp server

```bash
cloudflared tunnel --url http://127.0.0.1:8787
# → gives a public https URL that fronts ONLY the Clasp server
```

## 5. Smoke-test a real payment

From a machine with the repo, against the public URL, drive the SDK end-to-end (same shape as
`apps/server/src/operations.integration.test.ts`): `connect()` → have the payee node issue an
invoice → `requestPayment({ invoice, amount })`. A `succeeded` result with a real
`payment_hash` that appears on the node (`payment_get_payment`) is proof. Screenshot it.

## Confirm-on-first-contact checklist

The wire format is built to the Fiber RPC docs (v0.6.x). Two things to verify the first time
we hit a live node, because the docs lacked a verbatim example:
- **Param shape** — the gateway sends params as a positional single-element array
  (`params: [ {…} ]`), the jsonrpsee convention. If the node expects named params, it's a
  one-line change in `packages/gateway/src/fnn-gateway.ts`.
- **Amount encoding** — confirmed as hex strings (`"0x5f5e100"` = 1 CKB) from the docs; the
  codec parses hex/decimal/number tolerantly on read.

Once the node is reachable, send me the **public Clasp server URL** (from cloudflared — not the
node RPC, not any keys) and I'll run the smoke test and reconcile any surprises.
