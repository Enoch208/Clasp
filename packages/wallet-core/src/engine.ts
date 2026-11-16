import {
  paymentParamsSchema,
  claspError,
  cmpAmounts,
  gtAmounts,
  subAmounts,
  type ClaspError,
  type OperationRequest,
  type OperationResult,
  type SessionFacts,
} from "@clasp/protocol";
import { verifySession, verifyRequest, signResult, canonicalize, type Keypair } from "@clasp/token";
import type { Gateway } from "@clasp/gateway";
import type { Store, StoredSession } from "./store";

export const FRESHNESS_WINDOW_MS = 120_000;
export const HOLD_TTL_MS = 600_000;

const PAYMENT_OPERATIONS = new Set<OperationRequest["operation"]>(["payments:request", "payments:auto"]);

export interface EvaluateContext {
  store: Store;
  gateway: Gateway;
  walletKeys: Keypair;
  now: number;
  origin: string;
  token: string;
}

export function sessionToFacts(session: StoredSession): SessionFacts {
  return {
    sessionId: session.id,
    origin: session.origin,
    permissions: session.permissions,
    asset: session.asset,
    maxSinglePayment: session.maxSinglePayment,
    maxSessionSpend: session.maxSessionSpend,
    expiresAt: session.expiresAt,
    appPubKey: session.appPubKey,
    ...(session.ownerPubKey ? { ownerPubKey: session.ownerPubKey } : {}),
    ...(session.approvalThreshold ? { approvalThreshold: session.approvalThreshold } : {}),
    ...(session.rateLimit ? { rateLimit: session.rateLimit } : {}),
  };
}

export function factsMatchSession(facts: SessionFacts, session: StoredSession): boolean {
  return (
    facts.ownerPubKey === (session.ownerPubKey ?? undefined) &&
    facts.approvalThreshold === (session.approvalThreshold ?? undefined) &&
    canonicalize(facts.rateLimit ?? null) === canonicalize(session.rateLimit ?? null) &&
    facts.sessionId === session.id &&
    facts.origin === session.origin &&
    facts.asset === session.asset &&
    facts.maxSinglePayment === session.maxSinglePayment &&
    facts.maxSessionSpend === session.maxSessionSpend &&
    facts.expiresAt === session.expiresAt &&
    facts.appPubKey === session.appPubKey &&
    canonicalize([...facts.permissions].sort()) === canonicalize([...session.permissions].sort())
  );
}

function remaining(session: StoredSession): string {
  return subAmounts(session.maxSessionSpend, session.spent);
}

export interface SettleContext {
  store: Store;
  gateway: Gateway;
  walletKeys: Keypair;
  now: number;
}

export interface SettleInput {
  requestId: string;
  sessionId: string;
  invoice: string;
  amount: string;
  asset: string;
  sessionRemaining: string;
}

export async function settlePayment(input: SettleInput, ctx: SettleContext): Promise<OperationResult | ClaspError> {
  const { store, gateway, walletKeys, now } = ctx;
  const { requestId, sessionId, invoice, amount, asset } = input;
  try {
    const payment = await gateway.sendPayment({ invoice, amount, asset });
    if (payment.status !== "settled") throw new Error(`gateway returned status ${payment.status}`);
    const settledAt = new Date(now).toISOString();
    store.recordPayment({
      requestId,
      sessionId,
      amount,
      asset,
      paymentHash: payment.paymentHash,
      status: "settled",
      settledAt,
    });
    store.appendEvent(sessionId, "payment_settled", { requestId, amount, paymentHash: payment.paymentHash }, now);
    return signResult(
      {
        requestId,
        status: "succeeded",
        paymentHash: payment.paymentHash,
        amount,
        asset,
        settledAt,
        sessionRemaining: input.sessionRemaining,
      },
      walletKeys.privateKey,
    );
  } catch (error) {
    store.refundSpend(sessionId, amount);
    store.appendEvent(sessionId, "payment_failed", { requestId, amount, error: (error as Error).message }, now);
    return claspError("gateway_failure", { requestId });
  }
}

export async function evaluate(
  request: OperationRequest,
  ctx: EvaluateContext,
): Promise<OperationResult | ClaspError> {
  const { store, gateway, walletKeys, now, origin, token } = ctx;

  // Step 1 — session exists and is ACTIVE (not revoked, not expired).
  let session = store.getSession(request.sessionId);
  if (!session) return claspError("session_not_found", { sessionId: request.sessionId });
  if (session.state === "REVOKED") return claspError("session_revoked", { sessionId: session.id });
  session = store.expireIfDue(session.id, now) ?? session;
  if (session.state === "EXPIRED") return claspError("session_expired", { sessionId: session.id });
  if (session.state !== "ACTIVE") return claspError("session_not_found", { sessionId: session.id });
  if (session.parentId) {
    const parent = store.expireIfDue(session.parentId, now);
    if (parent?.state === "REVOKED") return claspError("session_revoked", { sessionId: parent.id });
    if (parent && parent.state !== "ACTIVE") return claspError("session_expired", { sessionId: parent.id });
  }

  // Step 2 — token signature valid, token facts equal the stored session, request signature valid.
  let facts: SessionFacts;
  try {
    facts = verifySession(token, walletKeys.publicKey);
  } catch {
    return claspError("invalid_signature", { reason: "session_token" });
  }
  if (!factsMatchSession(facts, session)) return claspError("invalid_signature", { reason: "facts_mismatch" });
  if (!verifyRequest(request, session.appPubKey)) {
    return claspError("invalid_signature", { reason: "request_signature" });
  }

  // Step 3 — operation is within the session's granted permissions.
  if (!(session.permissions as string[]).includes(request.operation)) {
    return claspError("permission_denied", { requiredPermission: request.operation });
  }

  // Step 4 — the relay-attached origin matches the session origin.
  if (origin !== session.origin) {
    return claspError("origin_mismatch", { expected: session.origin, received: origin });
  }

  // Step 5 — quick replay read (the atomic check in step 10 is authoritative).
  if (store.isConsumed(session.id, request.nonce, request.requestId)) {
    return claspError("replay_detected", { requestId: request.requestId, nonce: request.nonce });
  }

  // Step 6 — timestamp (seconds, per the protocol wire format) within the freshness window.
  if (Math.abs(now - request.timestamp * 1000) > FRESHNESS_WINDOW_MS) {
    return claspError("stale_timestamp", { now, timestamp: request.timestamp });
  }

  if (!PAYMENT_OPERATIONS.has(request.operation)) {
    return signResult(
      { requestId: request.requestId, status: "succeeded", sessionRemaining: remaining(session) },
      walletKeys.privateKey,
    );
  }

  const parsed = paymentParamsSchema.safeParse(request.parameters);
  if (!parsed.success) return claspError("invoice_amount_mismatch", { reason: "invalid_parameters" });
  const { invoice, amount, asset } = parsed.data;

  // Step 7 — the invoice decodes to the declared amount.
  let decoded;
  try {
    decoded = await gateway.getInvoice(invoice);
  } catch {
    return claspError("invoice_amount_mismatch", { reason: "undecodable_invoice" });
  }
  if (cmpAmounts(decoded.amount, amount) !== 0) {
    return claspError("invoice_amount_mismatch", { invoiceAmount: decoded.amount, declaredAmount: amount });
  }

  // Step 8 — the asset is the one the session allows (and the invoice agrees).
  if (asset !== session.asset || decoded.asset !== asset) {
    return claspError("asset_not_allowed", { expected: session.asset, received: asset });
  }

  // Step 9 — the amount is within the per-payment cap.
  if (gtAmounts(amount, session.maxSinglePayment)) {
    return claspError("single_payment_limit_exceeded", { amount, limit: session.maxSinglePayment });
  }

  // Step 10 — atomic reserve (session state, spend and rate cap) inside a single BEGIN IMMEDIATE transaction.
  store.expireDueHolds(session.id, now);
  const reservation = store.reserveSpend(
    { sessionId: session.id, nonce: request.nonce, requestId: request.requestId, amount },
    now,
  );
  if (!reservation.ok) {
    if (reservation.reason === "replay") {
      return claspError("replay_detected", { requestId: request.requestId, nonce: request.nonce });
    }
    if (reservation.reason === "inactive") {
      const code = reservation.state === "REVOKED" ? "session_revoked" : "session_expired";
      return claspError(code, { sessionId: session.id });
    }
    if (reservation.reason === "rate_limited") {
      return claspError("rate_limit_exceeded", {
        maxPayments: reservation.limit.maxPayments,
        windowSeconds: reservation.limit.windowSeconds,
        retryAfterSeconds: reservation.retryAfterSeconds,
      });
    }
    return claspError("session_spending_limit_exceeded", {
      amount,
      spent: session.spent,
      cap: session.maxSessionSpend,
    });
  }

  // Above the approval threshold the reservation stands, but settlement waits for the owner.
  if (session.approvalThreshold && gtAmounts(amount, session.approvalThreshold)) {
    const purpose = typeof request.parameters.purpose === "string" ? request.parameters.purpose : null;
    const hold = store.createHold({
      requestId: request.requestId,
      sessionId: session.id,
      invoice,
      amount,
      asset,
      purpose,
      createdAt: now,
      expiresAt: now + HOLD_TTL_MS,
    });
    store.appendEvent(session.id, "payment_held", { requestId: request.requestId, amount }, now);
    return claspError("approval_required", {
      requestId: request.requestId,
      amount,
      approvalThreshold: session.approvalThreshold,
      holdExpiresAt: new Date(hold.expiresAt).toISOString(),
    });
  }

  // Reserve-then-settle: the gateway is called OUTSIDE the transaction.
  return settlePayment(
    {
      requestId: request.requestId,
      sessionId: session.id,
      invoice,
      amount,
      asset,
      sessionRemaining: reservation.remaining,
    },
    { store, gateway, walletKeys, now },
  );
}
