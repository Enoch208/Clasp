import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { ClaspErrorException } from "@clasp/protocol";
import { createClaspClient } from "@clasp/client";
import { Store } from "@clasp/wallet-core";
import { FakeGateway, encodeFakeInvoice } from "@clasp/gateway";
import { generateKeypair } from "@clasp/token";
import { createApp } from "./app";
import { createWalletCore } from "./clasp-wallet-core";

const ORIGIN = "https://weather.example";
const ASSET = "CKB";
const START = Date.parse("2026-07-15T20:00:00Z");
const fakeInvoice = (asset: string, amount: string) => encodeFakeInvoice(amount, asset);

describe("client SDK drives POST /operations end-to-end", () => {
  let server: Server;
  let base: string;
  let now: number;
  let walletKeys: ReturnType<typeof generateKeypair>;

  beforeEach(async () => {
    now = START;
    walletKeys = generateKeypair();
    const gateway = new FakeGateway();
    const store = new Store();
    const walletCore = createWalletCore({ store, gateway, walletKeys, now: () => now });
    server = createApp(walletCore).listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function newClient() {
    return createClaspClient({
      serverUrl: base,
      origin: ORIGIN,
      app: { name: "Weather Agent" },
      permissions: ["payments:request", "invoices:read"],
      asset: ASSET,
      maxSinglePayment: "100000000",
      maxSessionSpend: "250000000",
      now: () => now,
    });
  }

  it("connects and settles a signed payment", async () => {
    const client = newClient();
    const session = await client.connect();

    expect(session.sessionId).toBeTruthy();
    expect(session.walletPubKey).toBe(walletKeys.publicKey);

    const result = await session.requestPayment({ invoice: fakeInvoice(ASSET, "40000000"), amount: "40000000" });

    expect(result.status).toBe("succeeded");
    expect(result.paymentHash).toMatch(/^[0-9a-f]+$/);
    expect(result.sessionRemaining).toBe("210000000");
  });

  it("increments the nonce across requests so neither is a replay", async () => {
    const client = newClient();
    const session = await client.connect();

    const first = await session.requestPayment({ invoice: fakeInvoice(ASSET, "40000000"), amount: "40000000" });
    const second = await session.requestPayment({ invoice: fakeInvoice(ASSET, "60000000"), amount: "60000000" });

    expect(first.status).toBe("succeeded");
    expect(second.status).toBe("succeeded");
    expect(second.sessionRemaining).toBe("150000000");
  });

  it("throws a structured ClaspError over the per-payment cap", async () => {
    const client = newClient();
    const session = await client.connect();

    await expect(
      session.requestPayment({ invoice: fakeInvoice(ASSET, "200000000"), amount: "200000000" }),
    ).rejects.toMatchObject({ error: { code: "single_payment_limit_exceeded" } });
  });

  it("emits 'revoked' and blocks the next payment after out-of-band revocation", async () => {
    const client = newClient();
    const session = await client.connect();

    const revokedEvents: string[] = [];
    client.on("revoked", (sessionId) => revokedEvents.push(sessionId));

    await fetch(`${base}/sessions/${session.sessionId}/revoke`, { method: "POST" });

    let thrown: unknown;
    try {
      await session.requestPayment({ invoice: fakeInvoice(ASSET, "40000000"), amount: "40000000" });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ClaspErrorException);
    expect((thrown as ClaspErrorException).error.code).toBe("session_revoked");
    expect(revokedEvents).toEqual([session.sessionId]);
  });

  it("reads live session state including accumulated spend", async () => {
    const client = newClient();
    const session = await client.connect();
    await session.requestPayment({ invoice: fakeInvoice(ASSET, "40000000"), amount: "40000000" });

    const state = await session.getState();
    expect(state.spent).toBe("40000000");
    expect(state.state).toBe("ACTIVE");
  });

  it("reports capabilities and decrements the remaining budget as it spends", async () => {
    const client = newClient();
    const session = await client.connect();

    const before = await session.getCapabilities();
    expect(before.operations).toContain("payments:request");
    expect(before.sessionRemaining).toBe("250000000");
    expect(before.canDelegate).toBe(false);
    expect(before.active).toBe(true);

    await session.requestPayment({ invoice: fakeInvoice(ASSET, "40000000"), amount: "40000000" });
    const after = await session.getCapabilities();
    expect(after.sessionRemaining).toBe("210000000");
  });

  it("flags canDelegate for a session granted payments:auto", async () => {
    const client = createClaspClient({
      serverUrl: base,
      origin: ORIGIN,
      app: { name: "Weather Agent" },
      permissions: ["payments:auto", "payments:request"],
      asset: ASSET,
      maxSinglePayment: "100000000",
      maxSessionSpend: "250000000",
      now: () => now,
    });
    const session = await client.connect();
    expect((await session.getCapabilities()).canDelegate).toBe(true);
  });

  it("returns a wallet-signed receipt the app can verify, and rejects a tampered one", async () => {
    const client = newClient();
    const session = await client.connect();

    const receipt = await session.requestPayment({ invoice: fakeInvoice(ASSET, "40000000"), amount: "40000000" });
    expect(session.verifyReceipt(receipt)).toBe(true);

    const tampered = { ...receipt, amount: "1" };
    expect(session.verifyReceipt(tampered)).toBe(false);
  });
});
