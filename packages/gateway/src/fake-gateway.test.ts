import { describe, it, expect } from "vitest";
import { FakeGateway, GATEWAY_METHODS } from "./index";

describe("FakeGateway invoices", () => {
  it("creates a self-describing invoice carrying its amount and asset", async () => {
    const gw = new FakeGateway();
    const inv = await gw.newInvoice({ amount: "10000000", asset: "BTC", memo: "coffee" });
    expect(inv.amount).toBe("10000000");
    expect(inv.asset).toBe("BTC");
    expect(typeof inv.invoice).toBe("string");
    expect(inv.invoice.length).toBeGreaterThan(0);
  });

  it("decodes an invoice back to its declared amount without prior storage", async () => {
    const encoder = new FakeGateway();
    const inv = await encoder.newInvoice({ amount: "25000000", asset: "BTC" });
    const decoder = new FakeGateway();
    const decoded = await decoder.getInvoice(inv.invoice);
    expect(decoded.amount).toBe("25000000");
    expect(decoded.asset).toBe("BTC");
  });

  it("rejects a malformed invoice", async () => {
    const gw = new FakeGateway();
    await expect(gw.getInvoice("not-a-real-invoice")).rejects.toThrow();
  });
});

describe("FakeGateway payments", () => {
  it("settles synchronously and stores the payment for later lookup", async () => {
    const gw = new FakeGateway();
    const inv = await gw.newInvoice({ amount: "10000000", asset: "BTC" });
    const payment = await gw.sendPayment({ invoice: inv.invoice, amount: "10000000", asset: "BTC" });
    expect(payment.status).toBe("settled");
    expect(payment.paymentHash).toMatch(/^[0-9a-f]{64}$/);
    const fetched = await gw.getPayment(payment.paymentHash);
    expect(fetched).toEqual(payment);
  });

  it("derives the payment hash deterministically from invoice and amount", async () => {
    const a = new FakeGateway();
    const b = new FakeGateway();
    const inv = await a.newInvoice({ amount: "10000000", asset: "BTC" });
    const pa = await a.sendPayment({ invoice: inv.invoice, amount: "10000000", asset: "BTC" });
    const pb = await b.sendPayment({ invoice: inv.invoice, amount: "10000000", asset: "BTC" });
    expect(pa.paymentHash).toBe(pb.paymentHash);
  });

  it("throws for an unknown payment hash", async () => {
    const gw = new FakeGateway();
    await expect(gw.getPayment("deadbeef")).rejects.toThrow();
  });
});

describe("gateway surface is exactly the four allow-listed methods", () => {
  it("exposes only newInvoice/getInvoice/sendPayment/getPayment", () => {
    expect([...GATEWAY_METHODS].sort()).toEqual(["getInvoice", "getPayment", "newInvoice", "sendPayment"]);
    const proto = Object.getPrototypeOf(new FakeGateway());
    const methods = Object.getOwnPropertyNames(proto).filter(
      (name) => name !== "constructor" && typeof proto[name] === "function",
    );
    expect(methods.sort()).toEqual(["getInvoice", "getPayment", "newInvoice", "sendPayment"]);
  });

  it("has no generic passthrough / raw-rpc escape hatch", () => {
    const gw = new FakeGateway() as unknown as Record<string, unknown>;
    for (const forbidden of ["call", "request", "rpc", "raw", "rawRpc", "invoke", "send", "exec"]) {
      expect(gw[forbidden]).toBeUndefined();
    }
  });
});
