import { describe, it, expect } from "vitest";
import { FnnGateway } from "./fnn-gateway";

interface CapturedRequest {
  method: string;
  params: unknown;
}

function mockFetch(route: (method: string, params: unknown, callIndex: number) => unknown) {
  const requests: CapturedRequest[] = [];
  const fn = (async (_url: unknown, init: { body: string }) => {
    const body = JSON.parse(init.body) as { id: number; method: string; params: unknown };
    requests.push({ method: body.method, params: body.params });
    const result = route(body.method, body.params, requests.length);
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { fn, requests };
}

const firstParam = (params: unknown) => (params as unknown[])[0] as Record<string, unknown>;

describe("FnnGateway", () => {
  it("creates an invoice with a hex amount and testnet currency", async () => {
    const { fn, requests } = mockFetch(() => ({ invoice_address: "fibt1qxyz" }));
    const gateway = new FnnGateway({ url: "http://node/rpc", fetch: fn });

    const invoice = await gateway.newInvoice({ amount: "100000000", asset: "CKB", memo: "report" });

    expect(requests[0]!.method).toBe("invoice_new_invoice");
    expect(firstParam(requests[0]!.params).amount).toBe("0x5f5e100"); // 100,000,000 shannons = 1 CKB
    expect(firstParam(requests[0]!.params).currency).toBe("Fibt");
    expect(firstParam(requests[0]!.params).description).toBe("report");
    expect(invoice).toEqual({ invoice: "fibt1qxyz", amount: "100000000", asset: "CKB", memo: "report" });
  });

  it("parses an invoice back to a decimal shannon amount", async () => {
    const { fn, requests } = mockFetch(() => ({ invoice: { amount: "0x5f5e100" } }));
    const gateway = new FnnGateway({ url: "http://node/rpc", fetch: fn });

    const invoice = await gateway.getInvoice("fibt1qxyz");

    expect(requests[0]!.method).toBe("invoice_parse_invoice");
    expect(firstParam(requests[0]!.params).invoice).toBe("fibt1qxyz");
    expect(invoice).toEqual({ invoice: "fibt1qxyz", amount: "100000000", asset: "CKB" });
  });

  it("sends a payment and polls get_payment until it settles", async () => {
    const { fn, requests } = mockFetch((method, _params, call) => {
      if (method === "payment_send_payment") return { payment_hash: "0xabc", status: "Inflight" };
      return { payment_hash: "0xabc", status: call >= 3 ? "Success" : "Inflight" };
    });
    const gateway = new FnnGateway({ url: "http://node/rpc", fetch: fn, pollIntervalMs: 0 });

    const payment = await gateway.sendPayment({ invoice: "fibt1qxyz", amount: "40000000", asset: "CKB" });

    expect(requests[0]!.method).toBe("payment_send_payment");
    expect(firstParam(requests[0]!.params).invoice).toBe("fibt1qxyz");
    expect(requests.filter((r) => r.method === "payment_get_payment").length).toBeGreaterThan(0);
    expect(payment.status).toBe("settled");
    expect(payment.paymentHash).toBe("0xabc");
  });

  it("settles immediately when send_payment already reports success", async () => {
    const { fn, requests } = mockFetch(() => ({ payment_hash: "0xdef", status: "Success" }));
    const gateway = new FnnGateway({ url: "http://node/rpc", fetch: fn });

    const payment = await gateway.sendPayment({ invoice: "fibt1qxyz", amount: "40000000", asset: "CKB" });

    expect(payment.status).toBe("settled");
    expect(requests.length).toBe(1);
  });

  it("returns a failed status when the network reports Failed", async () => {
    const { fn } = mockFetch((method) =>
      method === "payment_send_payment" ? { payment_hash: "0x1", status: "Failed" } : {},
    );
    const gateway = new FnnGateway({ url: "http://node/rpc", fetch: fn });

    const payment = await gateway.sendPayment({ invoice: "fibt1qxyz", amount: "40000000", asset: "CKB" });
    expect(payment.status).toBe("failed");
  });

  it("surfaces JSON-RPC errors", async () => {
    const fn = (async (_url: unknown, init: { body: string }) => {
      const body = JSON.parse(init.body) as { id: number };
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, error: { code: -32000, message: "boom" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;
    const gateway = new FnnGateway({ url: "http://node/rpc", fetch: fn });

    await expect(gateway.newInvoice({ amount: "1", asset: "CKB" })).rejects.toThrow(/boom/);
  });

  it("refuses non-CKB assets", async () => {
    const { fn } = mockFetch(() => ({}));
    const gateway = new FnnGateway({ url: "http://node/rpc", fetch: fn });
    await expect(gateway.newInvoice({ amount: "1", asset: "BTC" })).rejects.toThrow(/CKB only/);
  });
});
