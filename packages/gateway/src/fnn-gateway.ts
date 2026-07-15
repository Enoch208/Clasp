import type { Gateway, Invoice, NewInvoiceParams, Payment, SendPaymentParams } from "./types";

export interface FnnGatewayConfig {
  url: string;
  macaroon?: string;
}

const NOT_WIRED = "FnnGateway is not implemented in Spec 1; the real FNN adapter lands in Spec 4.";

export class FnnGateway implements Gateway {
  constructor(private readonly config: FnnGatewayConfig) {}

  async newInvoice(_params: NewInvoiceParams): Promise<Invoice> {
    throw new Error(NOT_WIRED);
  }

  async getInvoice(_invoice: string): Promise<Invoice> {
    throw new Error(NOT_WIRED);
  }

  async sendPayment(_params: SendPaymentParams): Promise<Payment> {
    throw new Error(NOT_WIRED);
  }

  async getPayment(_paymentHash: string): Promise<Payment> {
    throw new Error(NOT_WIRED);
  }
}
