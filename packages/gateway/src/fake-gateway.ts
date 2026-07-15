import { createHash } from "node:crypto";
import type { Gateway, Invoice, NewInvoiceParams, Payment, SendPaymentParams } from "./types";

const INVOICE_PREFIX = "fakeinv1_";

function encodeInvoice(params: NewInvoiceParams): string {
  const payload = { amount: params.amount, asset: params.asset, memo: params.memo ?? "" };
  return INVOICE_PREFIX + Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeInvoice(invoice: string): Invoice {
  if (!invoice.startsWith(INVOICE_PREFIX)) {
    throw new Error(`unrecognized invoice: ${invoice}`);
  }
  let payload: { amount?: unknown; asset?: unknown; memo?: unknown };
  try {
    payload = JSON.parse(Buffer.from(invoice.slice(INVOICE_PREFIX.length), "base64url").toString("utf8"));
  } catch {
    throw new Error(`corrupt invoice payload: ${invoice}`);
  }
  if (typeof payload.amount !== "string" || typeof payload.asset !== "string") {
    throw new Error(`invoice missing amount/asset: ${invoice}`);
  }
  const decoded: Invoice = { invoice, amount: payload.amount, asset: payload.asset };
  if (typeof payload.memo === "string" && payload.memo.length > 0) decoded.memo = payload.memo;
  return decoded;
}

function derivePaymentHash(params: SendPaymentParams): string {
  return createHash("sha256").update(`${params.invoice}|${params.amount}|${params.asset}`).digest("hex");
}

export class FakeGateway implements Gateway {
  private readonly payments = new Map<string, Payment>();

  async newInvoice(params: NewInvoiceParams): Promise<Invoice> {
    const invoice = encodeInvoice(params);
    const result: Invoice = { invoice, amount: params.amount, asset: params.asset };
    if (params.memo) result.memo = params.memo;
    return result;
  }

  async getInvoice(invoice: string): Promise<Invoice> {
    return decodeInvoice(invoice);
  }

  async sendPayment(params: SendPaymentParams): Promise<Payment> {
    decodeInvoice(params.invoice);
    const payment: Payment = {
      paymentHash: derivePaymentHash(params),
      invoice: params.invoice,
      amount: params.amount,
      asset: params.asset,
      status: "settled",
    };
    this.payments.set(payment.paymentHash, payment);
    return payment;
  }

  async getPayment(paymentHash: string): Promise<Payment> {
    const payment = this.payments.get(paymentHash);
    if (!payment) throw new Error(`unknown payment: ${paymentHash}`);
    return payment;
  }
}
