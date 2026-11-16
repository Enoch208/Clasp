import {
  ClaspErrorException,
  expiryToMillis,
  gtAmounts,
  isClaspError,
  type ClaspError,
  type GrantablePermission,
  type HoldView,
  type PaymentDecisionKind,
  type RateLimit,
  type SessionApproval,
} from "@clasp/protocol";
import { generateKeypair, signApproval, signDecision, signRevoke, type Keypair } from "@clasp/token";
import type { SessionSnapshot } from "./client";

export interface ApprovalRequest {
  origin: string;
  app: { name: string; icon?: string };
  permissions: GrantablePermission[];
  asset: string;
  maxSinglePayment: string;
  maxSessionSpend: string;
  expiresAt: string;
  appPubKey: string;
}

export interface Grant {
  permissions: GrantablePermission[];
  maxSinglePayment: string;
  maxSessionSpend: string;
  expiresAt: string;
  approvalThreshold?: string;
  rateLimit?: RateLimit;
}

export interface ClaspWalletConfig {
  serverUrl: string;
  ownerKeypair?: Keypair;
  fetch?: typeof fetch;
  now?: () => number;
}

export interface ClaspWallet {
  ownerPublicKey: string;
  approve(request: ApprovalRequest, grant?: Partial<Grant>): Promise<SessionApproval>;
  listHolds(sessionId: string): Promise<HoldView[]>;
  decide(hold: HoldView, decision: PaymentDecisionKind): Promise<HoldView>;
  revoke(sessionId: string): Promise<SessionSnapshot>;
}

const JSON_HEADERS = { "content-type": "application/json" };

function assertNarrows(request: ApprovalRequest, grant: Grant): void {
  const requested = new Set(request.permissions);
  if (!grant.permissions.every((permission) => requested.has(permission))) {
    throw new Error("clasp: a grant cannot add permissions the app did not request");
  }
  if (gtAmounts(grant.maxSinglePayment, request.maxSinglePayment) || gtAmounts(grant.maxSessionSpend, request.maxSessionSpend)) {
    throw new Error("clasp: a grant cannot raise the limits the app requested");
  }
  if (expiryToMillis(grant.expiresAt) > expiryToMillis(request.expiresAt)) {
    throw new Error("clasp: a grant cannot outlive the expiry the app requested");
  }
}

export function createClaspWallet(config: ClaspWalletConfig): ClaspWallet {
  const owner = config.ownerKeypair ?? generateKeypair();
  const doFetch: typeof fetch = config.fetch ?? ((input, init) => fetch(input, init));
  const now = config.now ?? (() => Date.now());
  const seconds = () => Math.floor(now() / 1000);
  let walletKeyCache: string | null = null;

  async function walletPubKey(): Promise<string> {
    if (walletKeyCache) return walletKeyCache;
    const body = (await (await doFetch(`${config.serverUrl}/health`)).json()) as { walletPubKey?: string };
    if (!body.walletPubKey) throw new Error("clasp: the wallet core did not report its wallet key");
    walletKeyCache = body.walletPubKey;
    return walletKeyCache;
  }

  async function readJson<T>(res: Response): Promise<T> {
    const body = (await res.json()) as T | ClaspError;
    if (isClaspError(body)) throw new ClaspErrorException(body);
    return body as T;
  }

  async function approve(request: ApprovalRequest, edits: Partial<Grant> = {}): Promise<SessionApproval> {
    const grant: Grant = {
      permissions: edits.permissions ?? request.permissions,
      maxSinglePayment: edits.maxSinglePayment ?? request.maxSinglePayment,
      maxSessionSpend: edits.maxSessionSpend ?? request.maxSessionSpend,
      expiresAt: edits.expiresAt ?? request.expiresAt,
      ...(edits.approvalThreshold !== undefined ? { approvalThreshold: edits.approvalThreshold } : {}),
      ...(edits.rateLimit !== undefined ? { rateLimit: edits.rateLimit } : {}),
    };
    assertNarrows(request, grant);
    const unsigned: Omit<SessionApproval, "signature"> = {
      version: "1",
      approvalId: `apr_${globalThis.crypto.randomUUID()}`,
      origin: request.origin,
      asset: request.asset,
      appPubKey: request.appPubKey,
      ownerPubKey: owner.publicKey,
      walletPubKey: await walletPubKey(),
      timestamp: seconds(),
      ...grant,
    };
    return { ...unsigned, signature: signApproval(unsigned, owner.privateKey) };
  }

  async function listHolds(sessionId: string): Promise<HoldView[]> {
    const body = await readJson<{ holds: HoldView[] }>(await doFetch(`${config.serverUrl}/sessions/${sessionId}/holds`));
    return body.holds;
  }

  async function decide(hold: HoldView, decision: PaymentDecisionKind): Promise<HoldView> {
    const unsigned = {
      version: "1" as const,
      requestId: hold.requestId,
      sessionId: hold.sessionId,
      amount: hold.amount,
      invoice: hold.invoice,
      walletPubKey: await walletPubKey(),
      decision,
      timestamp: seconds(),
    };
    const res = await doFetch(`${config.serverUrl}/holds/${hold.requestId}/decision`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ ...unsigned, signature: signDecision(unsigned, owner.privateKey) }),
    });
    return (await readJson<{ hold: HoldView }>(res)).hold;
  }

  async function revoke(sessionId: string): Promise<SessionSnapshot> {
    const unsigned = { version: "1" as const, sessionId, by: "owner" as const, timestamp: seconds() };
    const res = await doFetch(`${config.serverUrl}/sessions/${sessionId}/revoke`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ ...unsigned, signature: signRevoke(unsigned, owner.privateKey) }),
    });
    return (await readJson<{ session: SessionSnapshot }>(res)).session;
  }

  return { ownerPublicKey: owner.publicKey, approve, listHolds, decide, revoke };
}
