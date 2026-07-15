import { createHash } from "node:crypto";

export interface InvoiceView {
  invoice: string;
  amount: string;
  asset: string;
}

export interface PaymentReceipt {
  paymentHash: string;
  status: "succeeded";
  amount: string;
  asset: string;
  settledAt: string;
}

export interface Gateway {
  newInvoice(params: { amount: string; asset: string; memo?: string }): Promise<InvoiceView>;
  getInvoice(invoice: string): Promise<InvoiceView>;
  sendPayment(params: { invoice: string; amount: string; asset: string }): Promise<PaymentReceipt>;
  getPayment(paymentHash: string): Promise<PaymentReceipt | null>;
}

const PREFIX = "fibinv1";

export function fakeInvoice(asset: string, amount: string): string {
  return `${PREFIX}_${asset}_${amount}`;
}

function decodeInvoice(invoice: string): InvoiceView {
  const parts = invoice.split("_");
  if (parts[0] !== PREFIX || parts.length < 3) {
    throw new Error(`unparseable invoice: ${invoice}`);
  }
  return { invoice, asset: parts[1]!, amount: parts[2]! };
}

export function createFakeGateway(options: { now: () => number }): Gateway {
  const receipts = new Map<string, PaymentReceipt>();

  return {
    async newInvoice({ amount, asset }) {
      return { invoice: fakeInvoice(asset, amount), amount, asset };
    },

    async getInvoice(invoice) {
      return decodeInvoice(invoice);
    },

    async sendPayment({ invoice, amount, asset }) {
      const paymentHash = createHash("sha256").update(`${invoice}:${amount}:${asset}`).digest("hex");
      const receipt: PaymentReceipt = {
        paymentHash,
        status: "succeeded",
        amount,
        asset,
        settledAt: new Date(options.now()).toISOString(),
      };
      receipts.set(paymentHash, receipt);
      return receipt;
    },

    async getPayment(paymentHash) {
      return receipts.get(paymentHash) ?? null;
    },
  };
}
