import { Store } from "@clasp/wallet-core";
import { FakeGateway, FnnGateway, type Gateway } from "@clasp/gateway";
import { generateKeypair, publicKeyFromPrivate, type Keypair } from "@clasp/token";
import { createApp } from "./app";
import { createWalletCore } from "./clasp-wallet-core";

function loadWalletKeys(): { keys: Keypair; ephemeral: boolean } {
  const provided = process.env.CLASP_WALLET_PRIVATE_KEY;
  if (provided && /^[0-9a-f]{64}$/i.test(provided)) {
    const privateKey = provided.toLowerCase();
    return { keys: { privateKey, publicKey: publicKeyFromPrivate(privateKey) }, ephemeral: false };
  }
  return { keys: generateKeypair(), ephemeral: true };
}

const now = () => Date.now();
const { keys, ephemeral } = loadWalletKeys();
const store = new Store(process.env.CLASP_DB ?? ":memory:");

const fnnUrl = process.env.CLASP_FNN_URL;
const fnnInvoiceUrl = process.env.CLASP_FNN_INVOICE_URL;
const real = Boolean(fnnUrl);
const gateway: Gateway = real
  ? new FnnGateway({ url: fnnUrl!, invoiceUrl: fnnInvoiceUrl })
  : new FakeGateway();

const walletCore = createWalletCore({ store, gateway, walletKeys: keys, now });
const app = createApp(walletCore, { mode: real ? "REAL" : "DEMO" });

const port = Number(process.env.PORT ?? 8787);

app.listen(port, () => {
  console.log(`clasp server listening on http://127.0.0.1:${port}`);
  console.log(
    real
      ? `mode: REAL TESTNET — settling through FNN at ${fnnUrl}`
      : "mode: DEMO MODE — NO NETWORK PAYMENT (FakeGateway; set CLASP_FNN_URL to settle for real)",
  );
  console.log(`wallet pubkey: ${keys.publicKey}`);
  if (ephemeral) {
    console.log("warning: CLASP_WALLET_PRIVATE_KEY not set — using an ephemeral dev key (sessions do not survive restart)");
  }
});
