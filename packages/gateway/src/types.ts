export interface Invoice {
  invoice: string;
  amount: string;
  asset: string;
  memo?: string;
}

export interface Payment {
  paymentHash: string;
  invoice: string;
  amount: string;
  asset: string;
  status: "settled" | "failed";
}

export interface NewInvoiceParams {
  amount: string;
  asset: string;
  memo?: string;
}

export interface SendPaymentParams {
  invoice: string;
  amount: string;
  asset: string;
}

export interface Gateway {
  newInvoice(params: NewInvoiceParams): Promise<Invoice>;
  getInvoice(invoice: string): Promise<Invoice>;
  sendPayment(params: SendPaymentParams): Promise<Payment>;
  getPayment(paymentHash: string): Promise<Payment>;
}

export const GATEWAY_METHODS = ["newInvoice", "getInvoice", "sendPayment", "getPayment"] as const;
