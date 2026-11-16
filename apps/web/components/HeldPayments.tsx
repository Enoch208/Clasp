"use client";

import { useState } from "react";
import type { HoldView, PaymentDecisionKind } from "@clasp/protocol";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { decide, type PayOutcome } from "@/lib/claspClient";
import { formatCkb, formatDuration } from "@/lib/format";

function minutesLeft(expiresAt: string, now: number): string {
  const mins = Math.max(1, Math.round((Date.parse(expiresAt) - now) / 60_000));
  return formatDuration(mins);
}

export function HeldPayments({
  holds,
  now,
  onDecided,
}: {
  holds: HoldView[];
  now: number;
  onDecided?: (outcome: PayOutcome) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const pending = holds.filter((hold) => hold.status === "pending" && (!now || Date.parse(hold.expiresAt) > now));
  if (pending.length === 0) return null;

  const act = async (hold: HoldView, decision: PaymentDecisionKind) => {
    setBusy(hold.requestId);
    const outcome = await decide(hold, decision);
    setBusy(null);
    onDecided?.(outcome);
  };

  return (
    <Card title="Waiting for your approval" right={<Tag tone="warn">{pending.length} held</Tag>}>
      <div className="hold-list">
        {pending.map((hold) => (
          <div key={hold.requestId} className="hold-row">
            <div>
              <p className="hold-amount">
                {formatCkb(hold.amount)}
                {hold.purpose ? ` · ${hold.purpose}` : ""}
              </p>
              <p className="hold-desc">
                Above this session&apos;s approval threshold. Nothing has been sent yet; the amount is reserved until
                you decide{now ? `, for up to ${minutesLeft(hold.expiresAt, now)}` : ""}.
              </p>
            </div>
            <div className="hold-actions">
              <Button variant="accent" disabled={busy !== null} onClick={() => void act(hold, "approve")}>
                {busy === hold.requestId ? "Signing…" : "Approve"}
              </Button>
              <Button variant="ghost" disabled={busy !== null} onClick={() => void act(hold, "deny")}>
                Decline
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
