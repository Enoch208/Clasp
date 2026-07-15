import { randomUUID } from "node:crypto";
import {
  ClaspErrorException,
  isClaspError,
  type ClaspError,
  type GrantablePermission,
  type OperationResult,
  type SessionState,
} from "@clasp/protocol";
import { generateKeypair, signRequest, type Keypair } from "./crypto";

export type ClaspEvent = "revoked";

export interface ClaspClientConfig {
  serverUrl: string;
  origin: string;
  app: { name: string; icon?: string };
  permissions: GrantablePermission[];
  asset: string;
  maxSinglePayment: string;
  maxSessionSpend: string;
  sessionTtlMs?: number;
  appKeypair?: Keypair;
  fetch?: typeof fetch;
  now?: () => number;
}

export interface PaymentRequestInput {
  invoice: string;
  amount: string;
  asset?: string;
  purpose?: string;
}

export interface SessionSnapshot {
  sessionId: string;
  origin: string;
  permissions: string[];
  asset: string;
  maxSinglePayment: string;
  maxSessionSpend: string;
  spent: string;
  appPubKey: string;
  expiresAt: string;
  state: SessionState;
  createdAt: string;
}

export interface ClaspSession {
  sessionId: string;
  token: string;
  walletPubKey: string;
  request(operation: GrantablePermission, parameters?: Record<string, unknown>): Promise<OperationResult>;
  requestPayment(input: PaymentRequestInput): Promise<OperationResult>;
  revoke(): Promise<SessionSnapshot>;
  getState(): Promise<SessionSnapshot>;
}

export interface ClaspClient {
  appPublicKey: string;
  readonly session: ClaspSession | null;
  connect(): Promise<ClaspSession>;
  on(event: ClaspEvent, listener: (sessionId: string) => void): void;
  off(event: ClaspEvent, listener: (sessionId: string) => void): void;
}

const JSON_HEADERS = { "content-type": "application/json" };

export function createClaspClient(config: ClaspClientConfig): ClaspClient {
  const appKeypair = config.appKeypair ?? generateKeypair();
  const doFetch: typeof fetch = config.fetch ?? ((input, init) => fetch(input, init));
  const now = config.now ?? (() => Date.now());
  const sessionTtlMs = config.sessionTtlMs ?? 3600_000;

  const listeners = new Map<ClaspEvent, Set<(sessionId: string) => void>>();
  let current: ClaspSession | null = null;

  function on(event: ClaspEvent, listener: (sessionId: string) => void): void {
    const set = listeners.get(event) ?? new Set();
    set.add(listener);
    listeners.set(event, set);
  }

  function off(event: ClaspEvent, listener: (sessionId: string) => void): void {
    listeners.get(event)?.delete(listener);
  }

  function emit(event: ClaspEvent, sessionId: string): void {
    listeners.get(event)?.forEach((listener) => listener(sessionId));
  }

  function buildSession(sessionId: string, token: string, walletPubKey: string): ClaspSession {
    let nonce = 0;

    async function request(operation: GrantablePermission, parameters: Record<string, unknown> = {}): Promise<OperationResult> {
      nonce += 1;
      const unsigned = {
        version: "1" as const,
        sessionId,
        requestId: `req_${randomUUID()}`,
        operation,
        parameters,
        nonce,
        timestamp: Math.floor(now() / 1000),
      };
      const signed = { ...unsigned, signature: signRequest(unsigned, appKeypair.privateKey) };
      const res = await doFetch(`${config.serverUrl}/operations`, {
        method: "POST",
        headers: { ...JSON_HEADERS, "x-clasp-origin": config.origin },
        body: JSON.stringify(signed),
      });
      const body = await res.json();
      if (isClaspError(body)) {
        if (body.code === "session_revoked") emit("revoked", sessionId);
        throw new ClaspErrorException(body);
      }
      return body as OperationResult;
    }

    function requestPayment(input: PaymentRequestInput): Promise<OperationResult> {
      const parameters: Record<string, unknown> = {
        invoice: input.invoice,
        amount: input.amount,
        asset: input.asset ?? config.asset,
      };
      if (input.purpose !== undefined) parameters.purpose = input.purpose;
      return request("payments:request", parameters);
    }

    async function revoke(): Promise<SessionSnapshot> {
      const res = await doFetch(`${config.serverUrl}/sessions/${sessionId}/revoke`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: "{}",
      });
      const body = (await res.json()) as ClaspError | { session: SessionSnapshot };
      if (isClaspError(body)) throw new ClaspErrorException(body);
      emit("revoked", sessionId);
      return body.session;
    }

    async function getState(): Promise<SessionSnapshot> {
      const res = await doFetch(`${config.serverUrl}/sessions/${sessionId}`);
      const body = (await res.json()) as ClaspError | { session: SessionSnapshot };
      if (isClaspError(body)) throw new ClaspErrorException(body);
      return body.session;
    }

    return { sessionId, token, walletPubKey, request, requestPayment, revoke, getState };
  }

  async function connect(): Promise<ClaspSession> {
    const body = {
      origin: config.origin,
      permissions: config.permissions,
      asset: config.asset,
      maxSinglePayment: config.maxSinglePayment,
      maxSessionSpend: config.maxSessionSpend,
      expiresAt: new Date(now() + sessionTtlMs).toISOString(),
      appPubKey: appKeypair.publicKey,
    };
    const res = await doFetch(`${config.serverUrl}/sessions`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`clasp: session creation failed (${res.status})`);
    }
    const created = (await res.json()) as { sessionId: string; token: string; walletPubKey: string };
    current = buildSession(created.sessionId, created.token, created.walletPubKey);
    return current;
  }

  return {
    appPublicKey: appKeypair.publicKey,
    get session() {
      return current;
    },
    connect,
    on,
    off,
  };
}
