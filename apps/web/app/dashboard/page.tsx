"use client";

import Link from "next/link";
import { AppShell, SurfaceHead } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { Meter } from "@/components/ui/Meter";
import { EventList } from "@/components/EventList";
import { Power } from "@/components/icons";
import { useMockStore, revokeSession, type SessionRow } from "@/lib/mockStore";
import { useNow } from "@/lib/useNow";
import { formatCkb, shortId, relativeTime, remaining } from "@/lib/format";

type Display = "ACTIVE" | "REVOKED" | "EXPIRED";

function displayState(session: SessionRow, now: number): Display {
  if (session.state === "REVOKED") return "REVOKED";
  if (now && now > session.createdAt + session.durationMins * 60_000) return "EXPIRED";
  return "ACTIVE";
}

export default function DashboardPage() {
  const store = useMockStore();
  const now = useNow();

  return (
    <AppShell>
      <SurfaceHead
        kicker="Wallet · Active sessions"
        title="Your sessions"
        sub="Every app that holds authority, exactly what it has spent, and one tap to end it."
      />

      {store.sessions.length === 0 ? (
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
            {store.sessions.map((session) => {
              const state = displayState(session, now);
              return (
                <Card
                  key={session.id}
                  title={session.app.name}
                  right={<Tag tone={state === "ACTIVE" ? "ok" : state === "REVOKED" ? "bad" : "muted"}>{state}</Tag>}
                >
                  <p className="sess-origin mono">
                    {session.app.origin} · {shortId(session.id)}
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
                      <dd>{session.paymentCount}</dd>
                    </div>
                    <div className="kv">
                      <dt>Expires</dt>
                      <dd>{now ? remaining(session.durationMins, session.createdAt, now) : "—"}</dd>
                    </div>
                    <div className="kv">
                      <dt>Last activity</dt>
                      <dd>{now ? relativeTime(session.lastActivity, now) : "—"}</dd>
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
                  <Button variant="danger" block disabled={state !== "ACTIVE"} onClick={() => revokeSession(session.id)}>
                    <Power size={16} strokeWidth={2.5} /> Revoke session
                  </Button>
                </Card>
              );
            })}
          </div>

          <Card title="Activity">
            <EventList events={store.events} now={now} empty="No activity yet." />
          </Card>
        </div>
      )}
    </AppShell>
  );
}
