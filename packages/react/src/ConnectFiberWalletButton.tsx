"use client";

import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { useClaspSession } from "./useClaspSession";

export interface ConnectFiberWalletButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  connectingLabel?: ReactNode;
  connectedLabel?: ReactNode;
}

export function ConnectFiberWalletButton({
  children,
  connectingLabel = "Connecting…",
  connectedLabel = "Wallet connected",
  disabled,
  onClick,
  ...rest
}: ConnectFiberWalletButtonProps) {
  const { status, connect } = useClaspSession();
  const label =
    status === "connecting" ? connectingLabel : status === "connected" ? connectedLabel : (children ?? "Connect Fiber wallet");

  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || status === "connecting" || status === "connected"}
      onClick={(event) => {
        onClick?.(event);
        if (status === "idle" || status === "error") void connect();
      }}
    >
      {label}
    </button>
  );
}
