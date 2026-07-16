import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { ClaspErrorException } from "@clasp/protocol";
import { createClaspClient } from "@clasp/client";
import { createRelay, type RelayOptions } from "@clasp/relay";
import { Store } from "@clasp/wallet-core";
import { FakeGateway, encodeFakeInvoice } from "@clasp/gateway";
import { generateKeypair, verifyResult } from "@clasp/token";
import { createApp } from "./app";
import { createWalletCore } from "./clasp-wallet-core";

const ORIGIN = "https://weather.example";
const ASSET = "CKB";
const START = Date.parse("2026-07-15T20:00:00Z");
const fakeInvoice = (asset: string, amount: string) => encodeFakeInvoice(amount, asset);

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.once("listening", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe("standalone relay — transport only, trustless by signature", () => {
  let now: number;
  let walletKeys: ReturnType<typeof generateKeypair>;
  let core: Server;
  let coreBase: string;
  const relays: Server[] = [];

  beforeEach(async () => {
    now = START;
    walletKeys = generateKeypair();
    const walletCore = createWalletCore({ store: new Store(), gateway: new FakeGateway(), walletKeys, now: () => now });
    core = createApp(walletCore, { mode: "DEMO" }).listen(0);
    coreBase = await listen(core);
  });

  afterEach(async () => {
    for (const relay of relays.splice(0)) await new Promise<void>((r) => relay.close(() => r()));
    await new Promise<void>((r) => core.close(() => r()));
  });

  async function startRelay(overrides: Partial<RelayOptions> = {}): Promise<string> {
    const server = createRelay({ coreUrl: coreBase, ...overrides }).listen(0);
    relays.push(server);
    return listen(server);
  }

  function newClient(serverUrl: string) {
    return createClaspClient({
      serverUrl,
      origin: ORIGIN,
      app: { name: "Weather Agent" },
      permissions: ["payments:request"],
      asset: ASSET,
      maxSinglePayment: "100000000",
      maxSessionSpend: "250000000",
      now: () => now,
    });
  }

  it("settles a signed payment routed app -> relay -> core", async () => {
    const relayBase = await startRelay();
    const session = await newClient(relayBase).connect();

    const result = await session.requestPayment({ invoice: fakeInvoice(ASSET, "40000000"), amount: "40000000" });

    expect(result.status).toBe("succeeded");
    expect(verifyResult(result, walletKeys.publicKey)).toBe(true);
  });

  it("forwards /health to the core so the mode banner is preserved", async () => {
    const relayBase = await startRelay();
    const body = (await (await fetch(`${relayBase}/health`)).json()) as { mode?: string };
    expect(body.mode).toBe("DEMO");
  });

  it("advertises itself as transport-only and holding no keys", async () => {
    const relayBase = await startRelay();
    const body = (await (await fetch(`${relayBase}/__relay`)).json()) as { role: string; holdsKeys: boolean };
    expect(body.role).toBe("relay");
    expect(body.holdsKeys).toBe(false);
  });

  it("a malicious relay that alters the request body cannot forge authority", async () => {
    const relayBase = await startRelay({
      transform: (path, body) => {
        if (path !== "/operations") return body;
        const request = JSON.parse(body);
        request.parameters = { ...request.parameters, amount: "999999999" };
        return JSON.stringify(request);
      },
    });
    const session = await newClient(relayBase).connect();

    let thrown: unknown;
    try {
      await session.requestPayment({ invoice: fakeInvoice(ASSET, "40000000"), amount: "40000000" });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ClaspErrorException);
    expect((thrown as ClaspErrorException).error.code).toBe("invalid_signature");
  });

  it("a relay that rewrites the origin header cannot make the request succeed", async () => {
    const relayBase = await startRelay({
      rewriteHeaders: (headers) => ({ ...headers, "x-clasp-origin": "https://evil.example" }),
    });
    const session = await newClient(relayBase).connect();

    await expect(
      session.requestPayment({ invoice: fakeInvoice(ASSET, "40000000"), amount: "40000000" }),
    ).rejects.toMatchObject({ error: { code: "origin_mismatch" } });
  });
});
