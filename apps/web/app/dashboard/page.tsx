"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell, SurfaceHead } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { Meter } from "@/components/ui/Meter";
import { EventList } from "@/components/EventList";
import { Download, Power } from "@/components/icons";
import { useClasp, revoke, exportStatement } from "@/lib/claspClient";
import { useNow } from "@/lib/useNow";
import { formatCkb, formatDuration, shortId } from "@/lib/format";

type Display = "ACTIVE" | "REVOKED" | "EXPIRED";

function expiresIn(expiresAtIso: string, now: number): string {
  const mins = Math.max(0, Math.round((Date.parse(expiresAtIso) - now) / 60_000));
  return mins <= 0 ? "expired" : formatDuration(mins);
}

export default function DashboardPage() {
  const store = useClasp();
  const now = useNow();
  const session = store.session;
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  const onExport = async () => {
    setExporting(true);
    const result = await exportStatement();
    setExporting(false);
    if (result.ok) setExported(true);
  };

  const state: Display = session
    ? session.state === "REVOKED"
      ? "REVOKED"
      : now && now > Date.parse(session.expiresAt)
        ? "EXPIRED"
        : "ACTIVE"
    : "ACTIVE";

  return (
    <AppShell>
      <SurfaceHead
        kicker="Wallet · Active sessions"
        title="Your sessions"
        sub="Every app that holds authority, exactly what it has spent, and one tap to end it."
      />

      {!session ? (
        <Card>
          <div className="empty-state">
            <p>No active sessions yet.</p>
            <Link href="/demo">
              <Button variant="accent">Open the demo app</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid-2">
          <div className="stack-cards">
            <Card
              title="Weather Agent"
              right={<Tag tone={state === "ACTIVE" ? "ok" : state === "REVOKED" ? "bad" : "muted"}>{state}</Tag>}
            >
              <p className="sess-origin mono">
                {session.origin} · {shortId(session.sessionId)}
              </p>
              <dl className="kv-list">
                <div className="kv">
                  <dt>Permissions</dt>
                  <dd>{session.permissions.length}</dd>
                </div>
                <div className="kv">
                  <dt>Per-payment cap</dt>
                  <dd>{formatCkb(session.maxSinglePayment)}</dd>
                </div>
                <div className="kv">
                  <dt>Payments made</dt>
                  <dd>{store.paymentCount}</dd>
                </div>
                <div className="kv">
                  <dt>Expires</dt>
                  <dd>{now ? expiresIn(session.expiresAt, now) : "—"}</dd>
                </div>
              </dl>
              <div className="spend-row">
                <div className="spend-head">
                  <span>Spent</span>
                  <span className="mono">
                    {formatCkb(session.spent)} / {formatCkb(session.maxSessionSpend)}
                  </span>
                </div>
                <Meter value={session.spent} max={session.maxSessionSpend} />
              </div>
              <Button variant="ghost" block disabled={exporting} onClick={() => void onExport()}>
                <Download size={16} strokeWidth={2.5} />{" "}
                {exported ? "Statement downloaded ✓" : exporting ? "Signing…" : "Export signed statement"}
              </Button>
              <Button variant="danger" block disabled={state !== "ACTIVE"} onClick={() => void revoke()}>
                <Power size={16} strokeWidth={2.5} /> Revoke session
              </Button>
            </Card>
          </div>

          <Card title="Activity">
            <EventList events={store.events} now={now} empty="No activity yet." />
          </Card>
        </div>
      )}
    </AppShell>
  );
}
