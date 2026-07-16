"use client";

import { createContext } from "react";
import type {
  Capabilities,
  ClaspSession,
  DelegateInput,
  PaymentRequestInput,
  SessionSnapshot,
} from "@clasp/client";
import type { ClaspError, OperationResult } from "@clasp/protocol";

export type ClaspStatus = "idle" | "connecting" | "connected" | "error";

export interface VerifiedReceipt {
  result: OperationResult;
  verified: boolean;
}

export type PayResult = { ok: true; receipt: VerifiedReceipt } | { ok: false; error: ClaspError };

export interface ClaspContextValue {
  status: ClaspStatus;
  session: ClaspSession | null;
  snapshot: SessionSnapshot | null;
  capabilities: Capabilities | null;
  error: ClaspError | null;
  lastReceipt: VerifiedReceipt | null;
  connect: () => Promise<void>;
  pay: (input: PaymentRequestInput) => Promise<PayResult>;
  delegate: (input: DelegateInput) => Promise<ClaspSession | null>;
  revoke: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const ClaspContext = createContext<ClaspContextValue | null>(null);
