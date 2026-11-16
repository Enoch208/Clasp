"use client";

import { Stepper } from "@/components/ui/Stepper";
import { formatCkb } from "@/lib/format";

export const THRESHOLD_STEP = "25000000";
export const RATE_WINDOW_SECONDS = 60;

export function effectiveThreshold(threshold: string, maxSingle: string): string {
  return BigInt(threshold) > BigInt(maxSingle) ? maxSingle : threshold;
}

export function RulesFields({
  threshold,
  maxSingle,
  rate,
  onThreshold,
  onRate,
}: {
  threshold: string;
  maxSingle: string;
  rate: string;
  onThreshold: (value: string) => void;
  onRate: (value: string) => void;
}) {
  const value = effectiveThreshold(threshold, maxSingle);
  return (
    <>
      <div className="limit-field">
        <div className="limit-label">
          <span>Ask me before paying over</span>
          <small>Larger payments wait for your tap</small>
        </div>
        <Stepper
          value={value}
          min={THRESHOLD_STEP}
          max={maxSingle}
          step={THRESHOLD_STEP}
          onChange={onThreshold}
          format={(v) => (BigInt(v) >= BigInt(maxSingle) ? "Never" : formatCkb(v))}
        />
      </div>

      <div className="limit-field">
        <div className="limit-label">
          <span>Payments per minute</span>
          <small>A rate cap the wallet enforces, not the app</small>
        </div>
        <Stepper value={rate} min="1" max="20" step="1" onChange={onRate} format={(v) => `${v} max`} />
      </div>
    </>
  );
}
