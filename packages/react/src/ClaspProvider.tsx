"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createClaspClient,
  type Capabilities,
  type ClaspClient,
  type ClaspClientConfig,
  type ClaspSession,
  type DelegateInput,
  type PaymentRequestInput,
  type SessionSnapshot,
} from "@clasp/client";
import { isClaspError, type ClaspError } from "@clasp/protocol";
import {
  ClaspContext,
  type ClaspContextValue,
  type ClaspStatus,
  type PayResult,
  type VerifiedReceipt,
} from "./context";

function toClaspError(error: unknown): ClaspError {
  if (error && typeof error === "object" && "error" in error && isClaspError((error as { error: unknown }).error)) {
    return (error as { error: ClaspError }).error;
  }
  if (isClaspError(error)) return error;
  return { code: "gateway_failure", message: "Unexpected client error.", retryable: false, nextAction: "abort" };
}

export function ClaspProvider({ config, children }: { config: ClaspClientConfig; children: ReactNode }) {
  const clientRef = useRef<ClaspClient | null>(null);
  const sessionRef = useRef<ClaspSession | null>(null);
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  const [status, setStatus] = useState<ClaspStatus>("idle");
  const [session, setSession] = useState<ClaspSession | null>(null);
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [error, setError] = useState<ClaspError | null>(null);
  const [lastReceipt, setLastReceipt] = useState<VerifiedReceipt | null>(null);

  const refresh = useCallback(async () => {
    const active = sessionRef.current;
    if (!active) return;
    try {
      const [snap, caps] = await Promise.all([active.getState(), active.getCapabilities()]);
      setSnapshot(snap);
      setCapabilities(caps);
    } catch {
      /* server unreachable; keep last-known state */
    }
  }, []);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  const getClient = useCallback((): ClaspClient => {
    if (clientRef.current === null) {
      const client = createClaspClient(config);
      client.on("revoked", () => {
        void refreshRef.current();
      });
      clientRef.current = client;
    }
    return clientRef.current;
  }, [config]);

  const connect = useCallback(async () => {
    setStatus("connecting");
    setError(null);
    try {
      const active = await getClient().connect();
      sessionRef.current = active;
      setSession(active);
      const [snap, caps] = await Promise.all([active.getState(), active.getCapabilities()]);
      setSnapshot(snap);
      setCapabilities(caps);
      setStatus("connected");
    } catch (err) {
      setError(toClaspError(err));
      setStatus("error");
    }
  }, [getClient]);

  const pay = useCallback(
    async (input: PaymentRequestInput): Promise<PayResult> => {
      const active = sessionRef.current;
      if (!active) {
        const err = toClaspError(null);
        setError(err);
        return { ok: false, error: err };
      }
      try {
        const result = await active.requestPayment(input);
        const receipt: VerifiedReceipt = { result, verified: active.verifyReceipt(result) };
        setLastReceipt(receipt);
        await refresh();
        return { ok: true, receipt };
      } catch (err) {
        const claspError = toClaspError(err);
        setError(claspError);
        return { ok: false, error: claspError };
      }
    },
    [refresh],
  );

  const delegate = useCallback(async (input: DelegateInput): Promise<ClaspSession | null> => {
    const active = sessionRef.current;
    if (!active) return null;
    try {
      return await active.delegate(input);
    } catch (err) {
      setError(toClaspError(err));
      return null;
    }
  }, []);

  const revoke = useCallback(async () => {
    const active = sessionRef.current;
    if (!active) return;
    try {
      await active.revoke();
      await refresh();
    } catch (err) {
      setError(toClaspError(err));
    }
  }, [refresh]);

  const value = useMemo<ClaspContextValue>(
    () => ({ status, session, snapshot, capabilities, error, lastReceipt, connect, pay, delegate, revoke, refresh }),
    [status, session, snapshot, capabilities, error, lastReceipt, connect, pay, delegate, revoke, refresh],
  );

  return <ClaspContext.Provider value={value}>{children}</ClaspContext.Provider>;
}
