import type {
  Gateway,
  Invoice,
  NewInvoiceParams,
  Payment,
  PaymentStatus,
  SendPaymentParams,
} from "./types";

export type FiberCurrency = "Fibb" | "Fibt" | "Fibd";

export interface FnnGatewayConfig {
  /** Private FNN JSON-RPC endpoint of the payer/wallet node (send_payment, get_payment). Never public. */
  url: string;
  /** Optional payee node used to mint/parse invoices (new_invoice, parse_invoice) — e.g. a merchant.
   *  Defaults to `url`. Splitting it lets the wallet pay a real counterparty instead of itself. */
  invoiceUrl?: string;
  /** Testnet (Fibt) by default. */
  currency?: FiberCurrency;
  pollTimeoutMs?: number;
  pollIntervalMs?: number;
  fetch?: typeof fetch;
}

interface JsonRpcResponse<T> {
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function toHexAmount(decimal: string): string {
  return `0x${BigInt(decimal).toString(16)}`;
}

function fromAmount(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "0";
  return BigInt(value).toString();
}

function normalizeStatus(status: string): PaymentStatus {
  const value = status.toLowerCase();
  if (value === "success") return "settled";
  if (value === "failed") return "failed";
  return "pending"; // Created, Inflight
}

/**
 * Real adapter over the Fiber Network Node JSON-RPC: new_invoice, parse_invoice,
 * send_payment, get_payment. Amounts are hex-encoded shannons; currency Fibt is the
 * CKB testnet.
 *
 * Verified live against a nervos/fiber 0.9.0-rc7 node: unprefixed method names, positional
 * single-element array params (params: [{…}]), hex amounts ("0x5f5e100" = 1 CKB), the
 * invoice_address / invoice.amount response fields, and the Created→Inflight→Success|Failed
 * status enum. (An earlier draft used module-prefixed names — the live node rejected them.)
 */
export class FnnGateway implements Gateway {
  private readonly url: string;
  private readonly invoiceUrl: string;
  private readonly currency: FiberCurrency;
  private readonly pollTimeoutMs: number;
  private readonly pollIntervalMs: number;
  private readonly doFetch: typeof fetch;

  constructor(config: FnnGatewayConfig) {
    this.url = config.url;
    this.invoiceUrl = config.invoiceUrl ?? config.url;
    this.currency = config.currency ?? "Fibt";
    this.pollTimeoutMs = config.pollTimeoutMs ?? 60_000;
    this.pollIntervalMs = config.pollIntervalMs ?? 500;
    this.doFetch = config.fetch ?? ((input, init) => fetch(input, init));
  }

  private async call<T>(url: string, method: string, params: unknown): Promise<T> {
    const response = await this.doFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    if (!response.ok) throw new Error(`FNN RPC ${method}: HTTP ${response.status}`);
    const body = (await response.json()) as JsonRpcResponse<T>;
    if (body.error) throw new Error(`FNN RPC ${method}: ${body.error.code} ${body.error.message}`);
    if (body.result === undefined) throw new Error(`FNN RPC ${method}: empty result`);
    return body.result;
  }

  private currencyFor(asset: string): FiberCurrency {
    if (asset !== "CKB") throw new Error(`FnnGateway supports CKB only (received ${asset})`);
    return this.currency;
  }

  async newInvoice(params: NewInvoiceParams): Promise<Invoice> {
    const currency = this.currencyFor(params.asset);
    const result = await this.call<{ invoice_address: string }>(this.invoiceUrl, "new_invoice", [
      {
        amount: toHexAmount(params.amount),
        currency,
        ...(params.memo ? { description: params.memo } : {}),
      },
    ]);
    const invoice: Invoice = { invoice: result.invoice_address, amount: params.amount, asset: params.asset };
    if (params.memo) invoice.memo = params.memo;
    return invoice;
  }

  async getInvoice(invoice: string): Promise<Invoice> {
    const result = await this.call<{ invoice: { amount?: string | number | null } }>(this.invoiceUrl, "parse_invoice", [
      { invoice },
    ]);
    return { invoice, amount: fromAmount(result.invoice.amount), asset: "CKB" };
  }

  async sendPayment(params: SendPaymentParams): Promise<Payment> {
    this.currencyFor(params.asset);
    const sent = await this.call<{ payment_hash: string; status: string }>(this.url, "send_payment", [
      { invoice: params.invoice },
    ]);
    const status = await this.waitForSettlement(sent.payment_hash, sent.status);
    return {
      paymentHash: sent.payment_hash,
      invoice: params.invoice,
      amount: params.amount,
      asset: params.asset,
      status,
    };
  }

  async getPayment(paymentHash: string): Promise<Payment> {
    const result = await this.call<{ payment_hash: string; status: string }>(this.url, "get_payment", [
      { payment_hash: paymentHash },
    ]);
    return {
      paymentHash: result.payment_hash,
      invoice: "",
      amount: "0",
      asset: "CKB",
      status: normalizeStatus(result.status),
    };
  }

  private async waitForSettlement(paymentHash: string, initialStatus: string): Promise<PaymentStatus> {
    let status = normalizeStatus(initialStatus);
    let waited = 0;
    while (status === "pending") {
      if (waited >= this.pollTimeoutMs) {
        throw new Error(`FNN payment ${paymentHash} did not settle within ${this.pollTimeoutMs}ms`);
      }
      await sleep(this.pollIntervalMs);
      waited += this.pollIntervalMs;
      const result = await this.call<{ status: string }>(this.url, "get_payment", [{ payment_hash: paymentHash }]);
      status = normalizeStatus(result.status);
    }
    return status;
  }
}
