import { Store } from "@clasp/wallet-core";
import { FakeGateway } from "@clasp/gateway";
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
const store = new Store();
const gateway = new FakeGateway();
const walletCore = createWalletCore({ store, gateway, walletKeys: keys, now });
const app = createApp(walletCore);

const port = Number(process.env.PORT ?? 8787);

app.listen(port, () => {
  console.log(`clasp server listening on http://127.0.0.1:${port}`);
  console.log("mode: DEMO MODE — NO NETWORK PAYMENT (FakeGateway; FnnGateway lands in Spec 4)");
  console.log(`wallet pubkey: ${keys.publicKey}`);
  if (process.env.CLASP_FNN_URL) {
    console.log("note: CLASP_FNN_URL is set but the real FnnGateway is not implemented until Spec 4 — using FakeGateway");
  }
  if (ephemeral) {
    console.log("warning: CLASP_WALLET_PRIVATE_KEY not set — using an ephemeral dev key (sessions do not survive restart)");
  }
});
