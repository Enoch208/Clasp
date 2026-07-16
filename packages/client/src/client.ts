import {
  ClaspErrorException,
  isClaspError,
  subAmounts,
  type ClaspError,
  type GrantablePermission,
  type OperationResult,
  type SessionState,
  type SessionStatement,
} from "@clasp/protocol";
import {
  generateKeypair,
  signRequest,
  signDelegation,
  verifyResult,
  verifyStatement as verifyStatementToken,
  type Keypair,
} from "@clasp/token";

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

export interface DelegateInput {
  permissions: GrantablePermission[];
  maxSinglePayment: string;
  maxSessionSpend: string;
  asset?: string;
  ttlMs?: number;
  expiresAt?: string;
  childKeypair?: Keypair;
}

export type Receipt = OperationResult;

export interface Capabilities {
  sessionId: string;
  origin: string;
  operations: GrantablePermission[];
  asset: string;
  maxSinglePayment: string;
  sessionRemaining: string;
  expiresAt: string;
  canDelegate: boolean;
  active: boolean;
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
  appPubKey: string;
  request(operation: GrantablePermission, parameters?: Record<string, unknown>): Promise<OperationResult>;
  requestPayment(input: PaymentRequestInput): Promise<OperationResult>;
  delegate(input: DelegateInput): Promise<ClaspSession>;
  getCapabilities(): Promise<Capabilities>;
  verifyReceipt(receipt: Receipt): boolean;
  getStatement(): Promise<SessionStatement>;
  verifyStatement(statement: SessionStatement): boolean;
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

  function buildSession(
    sessionId: string,
    token: string,
    walletPubKey: string,
    signingKeypair: Keypair,
  ): ClaspSession {
    let nonce = 0;

    async function request(operation: GrantablePermission, parameters: Record<string, unknown> = {}): Promise<OperationResult> {
      nonce += 1;
      const unsigned = {
        version: "1" as const,
        sessionId,
        requestId: `req_${globalThis.crypto.randomUUID()}`,
        operation,
        parameters,
        nonce,
        timestamp: Math.floor(now() / 1000),
      };
      const signed = { ...unsigned, signature: signRequest(unsigned, signingKeypair.privateKey) };
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

    async function delegate(input: DelegateInput): Promise<ClaspSession> {
      const childKeypair = input.childKeypair ?? generateKeypair();
      const expiresAt = input.expiresAt ?? new Date(now() + (input.ttlMs ?? sessionTtlMs)).toISOString();
      const unsigned = {
        version: "1" as const,
        parentSessionId: sessionId,
        delegationId: `del_${globalThis.crypto.randomUUID()}`,
        childAppPubKey: childKeypair.publicKey,
        permissions: input.permissions,
        asset: input.asset ?? config.asset,
        maxSinglePayment: input.maxSinglePayment,
        maxSessionSpend: input.maxSessionSpend,
        expiresAt,
        timestamp: Math.floor(now() / 1000),
      };
      const signed = { ...unsigned, signature: signDelegation(unsigned, signingKeypair.privateKey) };
      const res = await doFetch(`${config.serverUrl}/delegations`, {
        method: "POST",
        headers: { ...JSON_HEADERS, "x-clasp-origin": config.origin },
        body: JSON.stringify(signed),
      });
      const body = await res.json();
      if (isClaspError(body)) throw new ClaspErrorException(body);
      const created = body as { childSessionId: string; token: string; walletPubKey: string };
      return buildSession(created.childSessionId, created.token, created.walletPubKey, childKeypair);
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

    async function getCapabilities(): Promise<Capabilities> {
      const snapshot = await getState();
      return {
        sessionId: snapshot.sessionId,
        origin: snapshot.origin,
        operations: snapshot.permissions as GrantablePermission[],
        asset: snapshot.asset,
        maxSinglePayment: snapshot.maxSinglePayment,
        sessionRemaining: subAmounts(snapshot.maxSessionSpend, snapshot.spent),
        expiresAt: snapshot.expiresAt,
        canDelegate: (snapshot.permissions as string[]).includes("payments:auto"),
        active: snapshot.state === "ACTIVE",
      };
    }

    function verifyReceipt(receipt: Receipt): boolean {
      return verifyResult(receipt, walletPubKey);
    }

    async function getStatement(): Promise<SessionStatement> {
      const res = await doFetch(`${config.serverUrl}/sessions/${sessionId}/statement`);
      const body = (await res.json()) as ClaspError | { statement: SessionStatement };
      if (isClaspError(body)) throw new ClaspErrorException(body);
      return body.statement;
    }

    function verifyStatement(statement: SessionStatement): boolean {
      return verifyStatementToken(statement, walletPubKey);
    }

    return {
      sessionId,
      token,
      walletPubKey,
      appPubKey: signingKeypair.publicKey,
      request,
      requestPayment,
      delegate,
      getCapabilities,
      verifyReceipt,
      getStatement,
      verifyStatement,
      revoke,
      getState,
    };
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
    current = buildSession(created.sessionId, created.token, created.walletPubKey, appKeypair);
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
