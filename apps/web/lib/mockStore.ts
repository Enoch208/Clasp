"use client";

import { useSyncExternalStore } from "react";
import type { ClaspError, GrantablePermission } from "@clasp/protocol";
import { claspError, addAmounts, subAmounts, cmpAmounts } from "@clasp/protocol";
import { formatCkb } from "./format";
import { weatherAgentPairing } from "./fixtures";

export type SessionState = "ACTIVE" | "REVOKED" | "EXPIRED";
export type EventKind = "approved" | "settled" | "blocked" | "revoked";
export type AttackKind = "channels" | "overlimit" | "replay" | "origin";

export interface SessionRow {
  id: string;
  app: { name: string; origin: string };
  permissions: GrantablePermission[];
  asset: string;
  maxSinglePayment: string;
  maxSessionSpend: string;
  spent: string;
  durationMins: number;
  createdAt: number;
  state: SessionState;
  lastActivity: number;
  paymentCount: number;
}

export interface EventRow {
  id: string;
  ts: number;
  sessionId: string;
  kind: EventKind;
  label: string;
  code?: string;
  detail?: string;
}

interface StoreState {
  sessions: SessionRow[];
  events: EventRow[];
  mode: "REAL" | "DEMO";
}

let seq = 0;
const nextId = (prefix: string) => `${prefix}_${(++seq).toString(36).padStart(4, "0")}`;

let state: StoreState = { sessions: [], events: [], mode: "DEMO" };
const listeners = new Set<() => void>();

function set(partial: Partial<StoreState>): void {
  state = { ...state, ...partial };
  for (const listener of listeners) listener();
}

function pseudoHash(seed: string, n: number): string {
  let h = 2166136261 >>> 0;
  const input = `${seed}:${n}`;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0").repeat(5).slice(0, 40);
}

function pushEvent(event: Omit<EventRow, "id">): void {
  set({ events: [{ id: nextId("evt"), ...event }, ...state.events] });
}

function touch(id: string, now: number): void {
  set({ sessions: state.sessions.map((s) => (s.id === id ? { ...s, lastActivity: now } : s)) });
}

export interface ApproveInput {
  permissions: GrantablePermission[];
  maxSinglePayment: string;
  maxSessionSpend: string;
  durationMins: number;
}

export function approveSession(input: ApproveInput): string {
  const now = Date.now();
  const id = nextId("sess");
  const session: SessionRow = {
    id,
    app: { name: weatherAgentPairing.app.name, origin: weatherAgentPairing.app.origin },
    permissions: input.permissions,
    asset: "CKB",
    maxSinglePayment: input.maxSinglePayment,
    maxSessionSpend: input.maxSessionSpend,
    spent: "0",
    durationMins: input.durationMins,
    createdAt: now,
    state: "ACTIVE",
    lastActivity: now,
    paymentCount: 0,
  };
  set({ sessions: [session, ...state.sessions] });
  pushEvent({ ts: now, sessionId: id, kind: "approved", label: `Session approved for ${session.app.name}` });
  return id;
}

export function revokeSession(id: string): void {
  const now = Date.now();
  set({
    sessions: state.sessions.map((s) => (s.id === id ? { ...s, state: "REVOKED", lastActivity: now } : s)),
  });
  pushEvent({ ts: now, sessionId: id, kind: "revoked", label: "Session revoked by the user" });
}

export type PayOutcome =
  | { ok: true; paymentHash: string; amount: string; remaining: string; settledAt: number }
  | { ok: false; error: ClaspError };

export function requestPayment(id: string, amount: string, purpose: string): PayOutcome {
  const now = Date.now();
  const session = state.sessions.find((s) => s.id === id);

  if (!session || session.state !== "ACTIVE") {
    const error = claspError("session_revoked");
    pushEvent({ ts: now, sessionId: id, kind: "blocked", label: "Payment after revoke", code: error.code, detail: error.message });
    return { ok: false, error };
  }
  if (!session.permissions.includes("payments:request") && !session.permissions.includes("payments:auto")) {
    const error = claspError("permission_denied", { requiredPermission: "payments:request" });
    pushEvent({ ts: now, sessionId: id, kind: "blocked", label: "Payment without permission", code: error.code, detail: error.message });
    return { ok: false, error };
  }
  if (cmpAmounts(amount, session.maxSinglePayment) === 1) {
    const error = claspError("single_payment_limit_exceeded", { requested: amount, limit: session.maxSinglePayment });
    pushEvent({ ts: now, sessionId: id, kind: "blocked", label: "Over per-payment cap", code: error.code, detail: error.message });
    return { ok: false, error };
  }
  const projected = addAmounts(session.spent, amount);
  if (cmpAmounts(projected, session.maxSessionSpend) === 1) {
    const error = claspError("session_spending_limit_exceeded", { requested: amount, remaining: subAmounts(session.maxSessionSpend, session.spent) });
    pushEvent({ ts: now, sessionId: id, kind: "blocked", label: "Over session allowance", code: error.code, detail: error.message });
    return { ok: false, error };
  }

  const paymentHash = `0x${pseudoHash(id, session.paymentCount + 1)}`;
  set({
    sessions: state.sessions.map((s) =>
      s.id === id ? { ...s, spent: projected, paymentCount: s.paymentCount + 1, lastActivity: now } : s,
    ),
  });
  pushEvent({ ts: now, sessionId: id, kind: "settled", label: `Paid ${formatCkb(amount)} · ${purpose}`, detail: paymentHash });
  return { ok: true, paymentHash, amount, remaining: subAmounts(session.maxSessionSpend, projected), settledAt: now };
}

export function runAttack(id: string, kind: AttackKind): ClaspError {
  const now = Date.now();
  const session = state.sessions.find((s) => s.id === id);
  let error: ClaspError;
  let label: string;

  switch (kind) {
    case "channels":
      error = claspError("permission_denied", { requiredPermission: "channels:open" });
      label = "Requested channels:open — never granted";
      break;
    case "overlimit":
      error = claspError("session_spending_limit_exceeded", {
        requested: "1000000000",
        remaining: session ? subAmounts(session.maxSessionSpend, session.spent) : "0",
      });
      label = "Requested 10 CKB over the remaining allowance";
      break;
    case "replay":
      error = claspError("replay_detected", { requestId: "req_01", nonce: 4 });
      label = "Replayed a settled payment (nonce 4) — count stays 1";
      break;
    case "origin":
      error = claspError("origin_mismatch", {
        expected: session?.app.origin ?? "https://weather.example",
        received: "https://evil.example",
      });
      label = "Copied token presented from evil.example";
      break;
  }

  touch(id, now);
  pushEvent({ ts: now, sessionId: id, kind: "blocked", label, code: error.code, detail: error.message });
  return error;
}

export function resetStore(): void {
  seq = 0;
  set({ sessions: [], events: [] });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function getSnapshot(): StoreState {
  return state;
}

export function useMockStore(): StoreState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function activeSession(store: StoreState): SessionRow | undefined {
  return store.sessions.find((s) => s.state === "ACTIVE");
}
