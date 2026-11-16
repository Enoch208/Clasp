"use client";

import { useSyncExternalStore } from "react";
import { createClaspClient, type ClaspClient, type ClaspSession, type SessionSnapshot } from "@useclasp/client";
import { generateKeypair, signDecision, signRequest, type Keypair } from "@clasp/token";
import {
  addAmounts,
  claspError,
  gtAmounts,
  isClaspError,
  type ClaspError,
  type GrantablePermission,
  type HoldView,
  type OperationRequest,
  type OperationResult,
  type PaymentDecisionKind,
  type RateLimit,
} from "@clasp/protocol";
import { formatCkb } from "./format";
import { ownerWallet } from "./ownerWallet";
import { SERVER_URL } from "./serverUrl";
import { weatherAgentPairing } from "./fixtures";

const APP_ORIGIN = "https://weather.example";
const APP_NAME = "Weather Agent";
const BURST_AMOUNT = "1000000";

export type EventKind = "approved" | "settled" | "held" | "blocked" | "revoked";
export type AttackKind = "channels" | "overlimit" | "replay" | "origin" | "burst" | "selfapprove";

export interface EventRow {
  id: string;
  ts: number;
  kind: EventKind;
  label: string;
  code?: string;
  detail?: string;
}

interface State {
  serverOnline: boolean | null;
  mode: "REAL" | "DEMO";
  connecting: boolean;
  session: SessionSnapshot | null;
  child: SessionSnapshot | null;
  delegating: boolean;
  childPaymentCount: number;
  events: EventRow[];
  paymentCount: number;
  lastError: ClaspError | null;
  holds: HoldView[];
}

let state: State = {
  serverOnline: null,
  mode: "DEMO",
  connecting: false,
  session: null,
  child: null,
  delegating: false,
  childPaymentCount: 0,
  events: [],
  paymentCount: 0,
  lastError: null,
  holds: [],
};

const listeners = new Set<() => void>();
function set(partial: Partial<State>): void {
  state = { ...state, ...partial };
  for (const listener of listeners) listener();
}

let seq = 0;
function push(event: Omit<EventRow, "id">): void {
  set({ events: [{ id: `evt_${++seq}`, ...event }, ...state.events] });
}

let appKeypair: Keypair | null = null;
let client: ClaspClient | null = null;
let session: ClaspSession | null = null;
let childSession: ClaspSession | null = null;
let attackNonce = 900_000;

export type PayOutcome =
  | { ok: true; paymentHash: string; amount: string; remaining: string; receiptVerified: boolean; signature: string }
  | { ok: false; error: ClaspError };

export async function checkHealth(): Promise<void> {
  try {
    const res = await fetch(`${SERVER_URL}/health`);
    if (!res.ok) throw new Error("health not ok");
    const body = (await res.json()) as { mode?: string };
    set({ serverOnline: true, mode: body.mode === "REAL" ? "REAL" : "DEMO" });
  } catch {
    set({ serverOnline: false });
  }
}

export interface ConnectInput {
  permissions: GrantablePermission[];
  maxSinglePayment: string;
  maxSessionSpend: string;
  durationMins: number;
  approvalThreshold?: string;
  rateLimit?: RateLimit;
}

export async function connect(input: ConnectInput): Promise<void> {
  set({ connecting: true });
  try {
    appKeypair = generateKeypair();
    const requested = weatherAgentPairing.requestedLimits;
    client = createClaspClient({
      serverUrl: SERVER_URL,
      origin: APP_ORIGIN,
      app: { name: APP_NAME },
      permissions: input.permissions,
      asset: "CKB",
      maxSinglePayment: requested.maxSinglePayment,
      maxSessionSpend: requested.maxSessionSpend,
      sessionTtlMs: input.durationMins * 60_000,
      appKeypair,
      approve: (request) =>
        ownerWallet().approve(request, {
          maxSinglePayment: input.maxSinglePayment,
          maxSessionSpend: input.maxSessionSpend,
          ...(input.approvalThreshold ? { approvalThreshold: input.approvalThreshold } : {}),
          ...(input.rateLimit ? { rateLimit: input.rateLimit } : {}),
        }),
    });
    client.on("revoked", () => {
      void refreshState();
    });
    session = await client.connect();
    childSession = null;
    const snapshot = await session.getState();
    set({
      session: snapshot,
      child: null,
      childPaymentCount: 0,
      connecting: false,
      paymentCount: 0,
      events: [],
      lastError: null,
      holds: [],
    });
    push({ ts: Date.now(), kind: "approved", label: `Session approved for ${APP_NAME}` });
  } catch (error) {
    set({ connecting: false, serverOnline: false });
    throw error;
  }
}

async function refreshState(): Promise<void> {
  if (!session) return;
  try {
    set({ session: await session.getState() });
  } catch {
    /* server unreachable; keep last-known state */
  }
}

async function refreshChild(): Promise<void> {
  if (!childSession) return;
  try {
    set({ child: await childSession.getState() });
  } catch {
    /* server unreachable; keep last-known state */
  }
}

export async function refreshHolds(): Promise<void> {
  if (!session) return;
  try {
    set({ holds: await ownerWallet().listHolds(session.sessionId) });
  } catch {
    return;
  }
}

function recordHeld(error: ClaspError, amount: string, purpose: string, who = ""): void {
  push({ ts: Date.now(), kind: "held", label: `${who}Held for your approval · ${formatCkb(amount)} · ${purpose}`, code: error.code });
  void refreshHolds();
  void refreshState();
  void refreshChild();
}

export async function decide(seen: HoldView, decision: PaymentDecisionKind): Promise<PayOutcome> {
  const requestId = seen.requestId;
  try {
    const hold = await ownerWallet().decide(seen, decision);
    await refreshHolds();
    await refreshState();
    await refreshChild();
    if (hold.status === "settled" && hold.result) {
      push({ ts: Date.now(), kind: "settled", label: `You approved · paid ${formatCkb(hold.amount)}`, detail: hold.result.paymentHash });
      set({ paymentCount: state.paymentCount + 1 });
      return {
        ok: true,
        paymentHash: hold.result.paymentHash ?? "",
        amount: hold.amount,
        remaining: hold.result.sessionRemaining,
        receiptVerified: session?.verifyReceipt(hold.result) ?? false,
        signature: hold.result.signature,
      };
    }
    const error = claspError(hold.status === "denied" ? "approval_denied" : "gateway_failure", { requestId });
    push({ ts: Date.now(), kind: "blocked", label: `You declined ${formatCkb(hold.amount)}`, code: error.code });
    return { ok: false, error };
  } catch (error) {
    const rejection = asClaspError(error);
    push({ ts: Date.now(), kind: "blocked", label: "Approval failed", code: rejection.code, detail: rejection.message });
    await refreshHolds();
    return { ok: false, error: rejection };
  }
}

async function mintInvoice(amount: string): Promise<string> {
  const res = await fetch(`${SERVER_URL}/invoices`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ amount, asset: "CKB" }),
  });
  const body = (await res.json()) as { invoice: string };
  return body.invoice;
}

export async function pay(amount: string, purpose: string): Promise<PayOutcome> {
  if (!session) return { ok: false, error: fallbackError() };
  try {
    const invoice = await mintInvoice(amount);
    const result = await session.requestPayment({ invoice, amount, purpose });
    const receiptVerified = session.verifyReceipt(result);
    await refreshState();
    push({ ts: Date.now(), kind: "settled", label: `Paid ${formatCkb(amount)} · ${purpose}`, detail: result.paymentHash });
    set({ paymentCount: state.paymentCount + 1 });
    return {
      ok: true,
      paymentHash: result.paymentHash ?? "",
      amount,
      remaining: result.sessionRemaining,
      receiptVerified,
      signature: result.signature,
    };
  } catch (error) {
    const rejection = asClaspError(error);
    if (rejection.code === "approval_required") {
      recordHeld(rejection, amount, purpose);
      return { ok: false, error: rejection };
    }
    push({ ts: Date.now(), kind: "blocked", label: "Payment blocked", code: rejection.code, detail: rejection.message });
    set({ lastError: rejection });
    return { ok: false, error: rejection };
  }
}

export async function revoke(): Promise<void> {
  if (!session) return;
  await ownerWallet().revoke(session.sessionId);
  await refreshState();
  await refreshChild();
  await refreshHolds();
  push({ ts: Date.now(), kind: "revoked", label: "Session revoked by the wallet owner" });
}

export async function exportStatement(): Promise<{ ok: boolean; verified: boolean }> {
  if (!session) return { ok: false, verified: false };
  try {
    const statement = await session.getStatement();
    const verified = session.verifyStatement(statement);
    const blob = new Blob([JSON.stringify(statement, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `clasp-statement-${statement.sessionId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    push({
      ts: Date.now(),
      kind: verified ? "approved" : "blocked",
      label: verified ? "Exported wallet-signed statement (verified)" : "Statement failed verification",
    });
    return { ok: true, verified };
  } catch {
    return { ok: false, verified: false };
  }
}

export interface DelegateChildInput {
  maxSinglePayment: string;
  maxSessionSpend: string;
  durationMins: number;
}

export type DelegateOutcome = { ok: true; child: SessionSnapshot } | { ok: false; error: ClaspError };

function childExpiryIso(durationMins: number): string | undefined {
  const parentExpiry = state.session ? Date.parse(state.session.expiresAt) : NaN;
  const wanted = Date.now() + durationMins * 60_000;
  const bounded = Number.isNaN(parentExpiry) ? wanted : Math.min(wanted, parentExpiry);
  return new Date(bounded).toISOString();
}

export async function delegate(input: DelegateChildInput): Promise<DelegateOutcome> {
  if (!session) return { ok: false, error: fallbackError() };
  set({ delegating: true });
  try {
    childSession = await session.delegate({
      permissions: ["payments:request"],
      maxSinglePayment: input.maxSinglePayment,
      maxSessionSpend: input.maxSessionSpend,
      expiresAt: childExpiryIso(input.durationMins),
    });
    const snapshot = await childSession.getState();
    set({ child: snapshot, delegating: false, childPaymentCount: 0 });
    push({ ts: Date.now(), kind: "approved", label: `Delegated a sub-agent · cap ${formatCkb(input.maxSessionSpend)}` });
    return { ok: true, child: snapshot };
  } catch (error) {
    const claspError = asClaspError(error);
    set({ delegating: false, lastError: claspError });
    push({ ts: Date.now(), kind: "blocked", label: "Delegation blocked", code: claspError.code, detail: claspError.message });
    return { ok: false, error: claspError };
  }
}

export async function payAsChild(amount: string, purpose: string): Promise<PayOutcome> {
  if (!childSession) return { ok: false, error: fallbackError() };
  try {
    const invoice = await mintInvoice(amount);
    const result = await childSession.requestPayment({ invoice, amount, purpose });
    const receiptVerified = childSession.verifyReceipt(result);
    await refreshChild();
    await refreshState();
    push({ ts: Date.now(), kind: "settled", label: `Sub-agent paid ${formatCkb(amount)} · ${purpose}`, detail: result.paymentHash });
    set({ childPaymentCount: state.childPaymentCount + 1 });
    return {
      ok: true,
      paymentHash: result.paymentHash ?? "",
      amount,
      remaining: result.sessionRemaining,
      receiptVerified,
      signature: result.signature,
    };
  } catch (error) {
    const rejection = asClaspError(error);
    if (rejection.code === "approval_required") {
      recordHeld(rejection, amount, purpose, "Sub-agent · ");
      return { ok: false, error: rejection };
    }
    push({ ts: Date.now(), kind: "blocked", label: "Sub-agent payment blocked", code: rejection.code, detail: rejection.message });
    set({ lastError: rejection });
    return { ok: false, error: rejection };
  }
}

export async function attemptOverGrant(): Promise<ClaspError> {
  if (!session || !state.session) return fallbackError();
  const parent = state.session;
  const widened = addAmounts(parent.maxSessionSpend, parent.maxSessionSpend);
  try {
    childSession = await session.delegate({
      permissions: ["payments:request"],
      maxSinglePayment: parent.maxSinglePayment,
      maxSessionSpend: widened,
      expiresAt: parent.expiresAt,
    });
    return { code: "gateway_failure", message: "over-grant was unexpectedly accepted", retryable: false, nextAction: "abort" };
  } catch (error) {
    const claspError = asClaspError(error);
    push({
      ts: Date.now(),
      kind: "blocked",
      label: `Sub-agent tried to widen the budget to ${formatCkb(widened)}`,
      code: claspError.code,
      detail: claspError.message,
    });
    set({ lastError: claspError });
    return claspError;
  }
}

function signOperation(operation: string, parameters: Record<string, unknown>, nonce: number): OperationRequest {
  const unsigned = {
    version: "1" as const,
    sessionId: session!.sessionId,
    requestId: `req_atk_${globalThis.crypto.randomUUID()}`,
    operation: operation as OperationRequest["operation"],
    parameters,
    nonce,
    timestamp: Math.floor(Date.now() / 1000),
  };
  return { ...unsigned, signature: signRequest(unsigned, appKeypair!.privateKey) };
}

async function send(request: OperationRequest, origin: string): Promise<OperationResult | ClaspError> {
  const res = await fetch(`${SERVER_URL}/operations`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-clasp-origin": origin },
    body: JSON.stringify(request),
  });
  return (await res.json()) as OperationResult | ClaspError;
}

export async function attack(kind: AttackKind): Promise<ClaspError> {
  if (!session || !appKeypair) return fallbackError();
  let error: ClaspError;
  let label: string;

  if (kind === "channels") {
    const body = await send(signOperation("channels:open", {}, ++attackNonce), APP_ORIGIN);
    error = asRejection(body);
    label = "Requested channels:open — never granted";
  } else if (kind === "overlimit") {
    const invoice = await mintInvoice("1000000000");
    const body = await send(signOperation("payments:request", { invoice, amount: "1000000000", asset: "CKB" }, ++attackNonce), APP_ORIGIN);
    error = asRejection(body);
    label = "Requested 10 CKB over the cap";
  } else if (kind === "burst") {
    ({ error, label } = await burst());
  } else if (kind === "selfapprove") {
    ({ error, label } = await selfApprove());
  } else if (kind === "origin") {
    const invoice = await mintInvoice("10000000");
    const body = await send(signOperation("payments:request", { invoice, amount: "10000000", asset: "CKB" }, ++attackNonce), "https://evil.example");
    error = asRejection(body);
    label = "Copied token presented from evil.example";
  } else {
    const invoice = await mintInvoice("10000000");
    const request = signOperation("payments:request", { invoice, amount: "10000000", asset: "CKB" }, ++attackNonce);
    const first = await send(request, APP_ORIGIN);
    const body = await send(request, APP_ORIGIN);
    error = asRejection(body);
    label = rateCapped(first) ?? "Replayed a settled payment — count stays 1";
    await refreshState();
  }

  push({ ts: Date.now(), kind: "blocked", label, code: error.code, detail: error.message });
  set({ lastError: error });
  return error;
}

async function burst(): Promise<{ error: ClaspError; label: string }> {
  const limit = state.session?.rateLimit;
  const count = (limit?.maxPayments ?? 3) + 2;
  const requests = await Promise.all(
    Array.from({ length: count }, async () => {
      const invoice = await mintInvoice(BURST_AMOUNT);
      return signOperation("payments:request", { invoice, amount: BURST_AMOUNT, asset: "CKB" }, ++attackNonce);
    }),
  );
  const results = await Promise.all(requests.map((request) => send(request, APP_ORIGIN)));
  const settled = results.filter((result) => !isClaspError(result)).length;
  const limited = results.filter((result): result is ClaspError => isClaspError(result) && result.code === "rate_limit_exceeded");
  set({ paymentCount: state.paymentCount + settled });
  await refreshState();
  return {
    error: limited[0] ?? asRejection(results[results.length - 1]!),
    label: `Fired ${count} payments at once — ${settled} settled, ${limited.length} rate-limited`,
  };
}

async function selfApprove(): Promise<{ error: ClaspError; label: string }> {
  const snapshot = state.session!;
  const amount = snapshot.maxSinglePayment;
  const invoice = await mintInvoice(amount);
  const held = await send(signOperation("payments:request", { invoice, amount, asset: "CKB" }, ++attackNonce), APP_ORIGIN);
  if (!isClaspError(held) || held.code !== "approval_required") {
    return { error: asRejection(held), label: rateCapped(held) ?? "Payment was not held" };
  }
  await refreshState();
  const requestId = held.requestId as string;
  const seen = await session!.getHold(requestId);
  const unsigned = {
    version: "1" as const,
    requestId,
    sessionId: seen.sessionId,
    amount: seen.amount,
    invoice: seen.invoice,
    walletPubKey: session!.walletPubKey,
    decision: "approve" as const,
    timestamp: Math.floor(Date.now() / 1000),
  };
  const res = await fetch(`${SERVER_URL}/holds/${requestId}/decision`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...unsigned, signature: signDecision(unsigned, appKeypair!.privateKey) }),
  });
  await refreshHolds();
  return {
    error: asRejection((await res.json()) as ClaspError),
    label: `Agent signed its own approval for a held ${formatCkb(amount)} — still waiting for you`,
  };
}

function rateCapped(body: OperationResult | ClaspError): string | null {
  if (!isClaspError(body) || body.code !== "rate_limit_exceeded") return null;
  return `Rate cap reached first — wait ${body.retryAfterSeconds as number}s and run it again`;
}

export function attackReady(kind: AttackKind, snapshot: SessionSnapshot): boolean {
  if (kind === "burst") return Boolean(snapshot.rateLimit);
  if (kind === "selfapprove") {
    return Boolean(snapshot.approvalThreshold) && gtAmounts(snapshot.maxSinglePayment, snapshot.approvalThreshold!);
  }
  return true;
}

function asRejection(body: OperationResult | ClaspError): ClaspError {
  if (isClaspError(body)) return body;
  return { code: "gateway_failure", message: "expected a rejection but the request was accepted", retryable: false, nextAction: "abort" };
}

function asClaspError(error: unknown): ClaspError {
  if (error && typeof error === "object" && "error" in error && isClaspError((error as { error: unknown }).error)) {
    return (error as { error: ClaspError }).error;
  }
  if (isClaspError(error)) return error;
  return fallbackError();
}

function fallbackError(): ClaspError {
  return { code: "session_not_found", message: "No active session — connect first.", retryable: false, nextAction: "pair_again" };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function getSnapshot(): State {
  return state;
}

export function useClasp(): State {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function activeSession(snapshot: State): SessionSnapshot | null {
  return snapshot.session && snapshot.session.state === "ACTIVE" ? snapshot.session : null;
}

export function activeChild(snapshot: State): SessionSnapshot | null {
  return snapshot.child && snapshot.child.state === "ACTIVE" ? snapshot.child : null;
}
