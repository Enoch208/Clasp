import { generateKeypair, signSession, signRequest, type Keypair } from "@clasp/token";
import { FakeGateway } from "@clasp/gateway";
import type { OperationRequest, SessionFacts } from "@clasp/protocol";
import { Store } from "./store";
import type { EvaluateContext } from "./engine";

export const NOW = 1_700_000_000_000;

export interface PaymentRequestOptions {
  amount: string;
  nonce: number;
  requestId: string;
  operation?: OperationRequest["operation"];
  invoice?: string;
  asset?: string;
  timestamp?: number;
  signWith?: string;
}

export interface Harness {
  wallet: Keypair;
  app: Keypair;
  store: Store;
  gateway: FakeGateway;
  facts: SessionFacts;
  token: string;
  ctx(overrides?: Partial<EvaluateContext>): EvaluateContext;
  paymentRequest(options: PaymentRequestOptions): Promise<OperationRequest>;
}

export function newHarness(sessionOverrides: Partial<SessionFacts> = {}): Harness {
  const wallet = generateKeypair();
  const app = generateKeypair();
  const store = new Store(":memory:");
  const gateway = new FakeGateway();

  const facts: SessionFacts = {
    sessionId: "sess_1",
    origin: "https://good.app",
    permissions: ["payments:request", "payments:read"],
    asset: "BTC",
    maxSinglePayment: "50000000",
    maxSessionSpend: "100000000",
    expiresAt: String(NOW + 3_600_000),
    appPubKey: app.publicKey,
    ...sessionOverrides,
  };
  store.createSession(facts, NOW);
  const token = signSession(facts, wallet.privateKey);

  function ctx(overrides: Partial<EvaluateContext> = {}): EvaluateContext {
    return { store, gateway, walletKeys: wallet, now: NOW, origin: facts.origin, token, ...overrides };
  }

  async function paymentRequest(options: PaymentRequestOptions): Promise<OperationRequest> {
    const asset = options.asset ?? "BTC";
    const invoice = options.invoice ?? (await gateway.newInvoice({ amount: options.amount, asset })).invoice;
    const unsigned: Omit<OperationRequest, "signature"> = {
      version: "1",
      sessionId: facts.sessionId,
      requestId: options.requestId,
      operation: options.operation ?? "payments:request",
      parameters: { invoice, amount: options.amount, asset },
      nonce: options.nonce,
      timestamp: options.timestamp ?? Math.floor(NOW / 1000),
    };
    return { ...unsigned, signature: signRequest(unsigned, options.signWith ?? app.privateKey) };
  }

  return { wallet, app, store, gateway, facts, token, ctx, paymentRequest };
}
