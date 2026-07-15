import { randomUUID } from "node:crypto";
import {
  addAmounts,
  canTransition,
  claspError,
  gtAmounts,
  paymentParamsSchema,
  subAmounts,
  type ClaspError,
  type GrantablePermission,
  type OperationRequest,
  type OperationResult,
  type SessionFacts,
  type SessionState,
} from "@clasp/protocol";
import type {
  CreateSessionInput,
  CreateSessionResult,
  EvaluateMeta,
  SessionView,
  WalletCore,
} from "../wallet-core";
import type { Gateway } from "./gateway";
import { signResult, signSession, verifyRequest, type Keypair } from "./crypto";

const FRESHNESS_WINDOW_SECONDS = 300;
const PAYMENT_OPERATIONS = new Set(["payments:request", "payments:auto"]);

interface StoredSession {
  facts: SessionFacts;
  token: string;
  spent: string;
  state: SessionState;
  createdAt: string;
  consumedNonces: Set<number>;
  consumedRequestIds: Set<string>;
  events: Array<{ type: string; data: unknown; at: string }>;
}

interface StubOptions {
  gateway: Gateway;
  walletKeys: Keypair;
  now: () => number;
}

export function createStubWalletCore({ gateway, walletKeys, now }: StubOptions): WalletCore {
  const sessions = new Map<string, StoredSession>();

  function record(stored: StoredSession, type: string, data: unknown): void {
    stored.events.push({ type, data, at: new Date(now()).toISOString() });
  }

  function view(stored: StoredSession): SessionView {
    return {
      sessionId: stored.facts.sessionId,
      origin: stored.facts.origin,
      permissions: stored.facts.permissions,
      asset: stored.facts.asset,
      maxSinglePayment: stored.facts.maxSinglePayment,
      maxSessionSpend: stored.facts.maxSessionSpend,
      spent: stored.spent,
      appPubKey: stored.facts.appPubKey,
      expiresAt: stored.facts.expiresAt,
      state: stored.state,
      createdAt: stored.createdAt,
    };
  }

  function expireIfDue(stored: StoredSession): void {
    if (stored.state === "ACTIVE" && now() >= Date.parse(stored.facts.expiresAt)) {
      stored.state = "EXPIRED";
      record(stored, "expired", { at: new Date(now()).toISOString() });
    }
  }

  function signedResult(fields: Omit<OperationResult, "signature">): OperationResult {
    return { ...fields, signature: signResult(fields, walletKeys.privateKey) };
  }

  function createSession(input: CreateSessionInput): CreateSessionResult {
    const sessionId = `sess_${randomUUID()}`;
    const facts: SessionFacts = {
      sessionId,
      origin: input.origin,
      permissions: input.permissions,
      asset: input.asset,
      maxSinglePayment: input.maxSinglePayment,
      maxSessionSpend: input.maxSessionSpend,
      expiresAt: input.expiresAt,
      appPubKey: input.appPubKey,
    };
    const token = JSON.stringify({ ...facts, signature: signSession(facts, walletKeys.privateKey) });
    const stored: StoredSession = {
      facts,
      token,
      spent: "0",
      state: "ACTIVE",
      createdAt: new Date(now()).toISOString(),
      consumedNonces: new Set(),
      consumedRequestIds: new Set(),
      events: [],
    };
    record(stored, "approved", { permissions: facts.permissions, limits: { maxSinglePayment: facts.maxSinglePayment, maxSessionSpend: facts.maxSessionSpend } });
    sessions.set(sessionId, stored);
    return { sessionId, session: view(stored), token, walletPubKey: walletKeys.publicKey };
  }

  function getSession(sessionId: string): SessionView | null {
    const stored = sessions.get(sessionId);
    if (!stored) return null;
    expireIfDue(stored);
    return view(stored);
  }

  function revoke(sessionId: string): SessionView | null {
    const stored = sessions.get(sessionId);
    if (!stored) return null;
    expireIfDue(stored);
    if (canTransition(stored.state, "REVOKED")) {
      stored.state = "REVOKED";
      record(stored, "revoked", { at: new Date(now()).toISOString() });
    }
    return view(stored);
  }

  async function evaluate(request: OperationRequest, meta: EvaluateMeta): Promise<OperationResult | ClaspError> {
    const stored = sessions.get(request.sessionId);
    if (!stored) return claspError("session_not_found", { sessionId: request.sessionId });

    expireIfDue(stored);
    if (stored.state === "REVOKED") return claspError("session_revoked", { sessionId: request.sessionId });
    if (stored.state === "EXPIRED") return claspError("session_expired", { sessionId: request.sessionId });
    if (stored.state !== "ACTIVE") return claspError("session_revoked", { sessionId: request.sessionId });

    if (!verifyRequest(request, stored.facts.appPubKey)) {
      return claspError("invalid_signature", { requestId: request.requestId });
    }

    if (!stored.facts.permissions.includes(request.operation as GrantablePermission)) {
      return claspError("permission_denied", { requiredPermission: request.operation });
    }

    if (meta.origin !== stored.facts.origin) {
      return claspError("origin_mismatch", { expected: stored.facts.origin, received: meta.origin });
    }

    if (stored.consumedNonces.has(request.nonce) || stored.consumedRequestIds.has(request.requestId)) {
      return claspError("replay_detected", { requestId: request.requestId, nonce: request.nonce });
    }

    if (Math.abs(Math.floor(now() / 1000) - request.timestamp) > FRESHNESS_WINDOW_SECONDS) {
      return claspError("stale_timestamp", { timestamp: request.timestamp });
    }

    if (!PAYMENT_OPERATIONS.has(request.operation)) {
      stored.consumedNonces.add(request.nonce);
      stored.consumedRequestIds.add(request.requestId);
      return signedResult({
        requestId: request.requestId,
        status: "succeeded",
        sessionRemaining: subAmounts(stored.facts.maxSessionSpend, stored.spent),
      });
    }

    const params = paymentParamsSchema.safeParse(request.parameters);
    if (!params.success) return claspError("invoice_amount_mismatch", { requestId: request.requestId });
    const { invoice, amount, asset } = params.data;

    let invoiceView;
    try {
      invoiceView = await gateway.getInvoice(invoice);
    } catch {
      return claspError("invoice_amount_mismatch", { requestId: request.requestId });
    }
    if (invoiceView.amount !== amount) {
      return claspError("invoice_amount_mismatch", { expected: invoiceView.amount, declared: amount });
    }

    if (asset !== stored.facts.asset) {
      return claspError("asset_not_allowed", { expected: stored.facts.asset, received: asset });
    }

    if (gtAmounts(amount, stored.facts.maxSinglePayment)) {
      return claspError("single_payment_limit_exceeded", { limit: stored.facts.maxSinglePayment, amount });
    }

    const projected = addAmounts(stored.spent, amount);
    if (gtAmounts(projected, stored.facts.maxSessionSpend)) {
      return claspError("session_spending_limit_exceeded", {
        remaining: subAmounts(stored.facts.maxSessionSpend, stored.spent),
        amount,
      });
    }
    stored.consumedNonces.add(request.nonce);
    stored.consumedRequestIds.add(request.requestId);
    stored.spent = projected;

    try {
      const receipt = await gateway.sendPayment({ invoice, amount, asset });
      const sessionRemaining = subAmounts(stored.facts.maxSessionSpend, stored.spent);
      record(stored, "payment", { requestId: request.requestId, amount, paymentHash: receipt.paymentHash });
      return signedResult({
        requestId: request.requestId,
        status: "succeeded",
        paymentHash: receipt.paymentHash,
        amount,
        asset,
        settledAt: receipt.settledAt,
        sessionRemaining,
      });
    } catch {
      stored.spent = subAmounts(stored.spent, amount);
      record(stored, "gateway_failure", { requestId: request.requestId, amount });
      return claspError("gateway_failure", { requestId: request.requestId });
    }
  }

  return { createSession, getSession, revoke, evaluate };
}
