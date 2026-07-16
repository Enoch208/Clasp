"use client";

import Link from "next/link";
import { useState } from "react";
import type { ClaspError } from "@clasp/protocol";
import { AppShell, SurfaceHead } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { Meter } from "@/components/ui/Meter";
import { Stepper } from "@/components/ui/Stepper";
import { EventList } from "@/components/EventList";
import { Bot, GitBranch, ShieldCheck, ShieldOff } from "@/components/icons";
import {
  useClasp,
  activeSession,
  delegate,
  payAsChild,
  attemptOverGrant,
  type DelegateOutcome,
} from "@/lib/claspClient";
import { useNow } from "@/lib/useNow";
import { formatCkb, shortId } from "@/lib/format";

const SINGLE_MIN = "25000000";
const SINGLE_STEP = "25000000";
const SESSION_MIN = "50000000";
const SESSION_STEP = "50000000";

function minStr(a: string, b: string): string {
  return BigInt(a) < BigInt(b) ? a : b;
}

export default function DelegatePage() {
  const store = useClasp();
  const now = useNow();
  const parent = activeSession(store);
  const child = store.child;

  const [childSingle, setChildSingle] = useState("50000000");
  const [childCap, setChildCap] = useState("100000000");
  const [busy, setBusy] = useState(false);
  const [overGrant, setOverGrant] = useState<ClaspError | null>(null);

  if (!parent) {
    return (
      <AppShell>
        <SurfaceHead
          kicker="Delegation · Sub-agents"
          title="Delegate to a sub-agent."
          sub="An agent with payments:auto can hand a weaker credential to a sub-agent — lower caps, shorter life, same origin, never wider than itself."
        />
        <Card>
          <div className="empty-state">
            <p>Approve a session with automatic spending first.</p>
            <Link href="/demo">
              <Button variant="accent">Open the demo app</Button>
            </Link>
          </div>
        </Card>
      </AppShell>
    );
  }

  const canDelegate = parent.permissions.includes("payments:auto");
  const single = minStr(childSingle, parent.maxSinglePayment);
  const cap = minStr(childCap, parent.maxSessionSpend);
  const childActive = child?.state === "ACTIVE";

  const onDelegate = async () => {
    setBusy(true);
    setOverGrant(null);
    const outcome: DelegateOutcome = await delegate({
      maxSinglePayment: single,
      maxSessionSpend: cap,
      durationMins: 720,
    });
    if (!outcome.ok) setOverGrant(outcome.error);
    setBusy(false);
  };

  const onPayChild = async () => {
    if (!child) return;
    setBusy(true);
    await payAsChild(child.maxSinglePayment, "Sub-agent task");
    setBusy(false);
  };

  const onOverGrant = async () => {
    setBusy(true);
    setOverGrant(await attemptOverGrant());
    setBusy(false);
  };

  return (
    <AppShell>
      <SurfaceHead
        kicker="Delegation · Sub-agents"
        title="Delegate to a sub-agent."
        sub="An agent with payments:auto can hand a weaker credential to a sub-agent — lower caps, shorter life, same origin, never wider than itself. Child spends draw from the parent's pool."
      />

      <div className="grid-2">
        <div className="stack-cards">
          <Card
            title="Parent session"
            right={<Tag tone={canDelegate ? "ok" : "warn"}>{canDelegate ? "payments:auto" : "no auto-spend"}</Tag>}
          >
            <p className="sess-origin mono">
              {parent.origin} · {shortId(parent.sessionId)}
            </p>
            <div className="spend-row">
              <div className="spend-head">
                <span>Shared pool spent</span>
                <span className="mono">
                  {formatCkb(parent.spent)} / {formatCkb(parent.maxSessionSpend)}
                </span>
              </div>
              <Meter value={parent.spent} max={parent.maxSessionSpend} />
            </div>
            <p className="pay-note">
              The parent&apos;s own payments and every sub-agent&apos;s payments draw down this one pool.
            </p>
          </Card>

          {!childActive ? (
            <Card title="Mint a sub-agent" right={<Tag tone="muted">Attenuated</Tag>}>
              {!canDelegate ? (
                <p className="pay-error mono">
                  This session was not granted payments:auto — reconnect and approve automatic spending to delegate.
                </p>
              ) : null}
              <div className="limit-field">
                <div className="limit-label">
                  <span>Sub-agent per-payment cap</span>
                  <small>Parent {formatCkb(parent.maxSinglePayment)}</small>
                </div>
                <Stepper
                  value={single}
                  min={minStr(SINGLE_MIN, parent.maxSinglePayment)}
                  max={parent.maxSinglePayment}
                  step={SINGLE_STEP}
                  onChange={setChildSingle}
                  format={formatCkb}
                />
              </div>
              <div className="limit-field">
                <div className="limit-label">
                  <span>Sub-agent session cap</span>
                  <small>Parent {formatCkb(parent.maxSessionSpend)}</small>
                </div>
                <Stepper
                  value={cap}
                  min={minStr(SESSION_MIN, parent.maxSessionSpend)}
                  max={parent.maxSessionSpend}
                  step={SESSION_STEP}
                  onChange={setChildCap}
                  format={formatCkb}
                />
              </div>
              <p className="limit-note">
                <ShieldCheck size={15} strokeWidth={2.4} /> Expires with the parent. The wallet rejects any child that tries
                to exceed it.
              </p>
              <Button variant="accent" block disabled={!canDelegate || store.delegating || busy} onClick={() => void onDelegate()}>
                <GitBranch size={16} strokeWidth={2.5} /> {store.delegating ? "Signing sub-agent…" : "Delegate to sub-agent"}
              </Button>
            </Card>
          ) : (
            <Card
              title={
                <span className="del-child-title">
                  <Bot size={16} strokeWidth={2.5} /> Sub-agent
                </span>
              }
              right={<Tag tone="ok">ACTIVE</Tag>}
            >
              <p className="sess-origin mono">{shortId(child!.sessionId)}</p>
              <dl className="kv-list">
                <div className="kv">
                  <dt>Per-payment cap</dt>
                  <dd>{formatCkb(child!.maxSinglePayment)}</dd>
                </div>
                <div className="kv">
                  <dt>Payments made</dt>
                  <dd>{store.childPaymentCount}</dd>
                </div>
              </dl>
              <div className="spend-row">
                <div className="spend-head">
                  <span>Sub-agent spent</span>
                  <span className="mono">
                    {formatCkb(child!.spent)} / {formatCkb(child!.maxSessionSpend)}
                  </span>
                </div>
                <Meter value={child!.spent} max={child!.maxSessionSpend} />
              </div>
              <Button variant="accent" block disabled={busy} onClick={() => void onPayChild()}>
                Pay {formatCkb(child!.maxSinglePayment)} as sub-agent
              </Button>
              <Button variant="danger" block disabled={busy} onClick={() => void onOverGrant()}>
                <ShieldOff size={15} strokeWidth={2.5} /> Try to over-grant the budget
              </Button>
            </Card>
          )}

          {overGrant ? (
            <Card title="Structured rejection" right={<Tag tone="bad">Blocked</Tag>}>
              <pre className="codeblock">{JSON.stringify(overGrant, null, 2)}</pre>
            </Card>
          ) : null}
        </div>

        <Card title="Activity">
          <EventList events={store.events} now={now} empty="No delegation activity yet." />
        </Card>
      </div>
    </AppShell>
  );
}
