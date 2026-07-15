"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell, SurfaceHead } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { CheckCircle2, CloudSun, Link2, Lock, ShieldOff } from "@/components/icons";
import { useMockStore, requestPayment, activeSession, type PayOutcome } from "@/lib/mockStore";
import { formatCkb, translatePermission, shortId } from "@/lib/format";
import { weatherAgentPairing, weatherReport } from "@/lib/fixtures";

const REPORT_PRICE = "100000000";

export default function DemoDappPage() {
  const store = useMockStore();
  const session = activeSession(store);
  const [outcome, setOutcome] = useState<PayOutcome | null>(null);

  const pay = () => {
    if (!session) return;
    setOutcome(requestPayment(session.id, REPORT_PRICE, weatherReport.title));
  };

  const unlocked = outcome?.ok === true;

  return (
    <AppShell>
      <SurfaceHead
        kicker="Demo dApp · Weather Agent"
        title="Weather-risk intelligence"
        sub="A third-party app that pays for a premium report — through a Clasp session, never with your keys."
      />

      {!session ? (
        <div className="grid-2">
          <Card title="Weather Agent" right={<Tag tone="muted">Disconnected</Tag>}>
            <p className="demo-lead">
              This app needs to make a small Fiber payment to unlock a premium weather-risk report. It never sees your
              node URL, your credentials, or your keys — it asks the wallet for a scoped session.
            </p>
            <p className="demo-reqs-label">It will request</p>
            <div className="demo-chips">
              {weatherAgentPairing.requestedPermissions.map((permission) => (
                <Tag key={permission} tone="muted">
                  {permission}
                </Tag>
              ))}
            </div>
            <div style={{ marginTop: 20 }}>
              <Link href="/wallet">
                <Button variant="accent" block>
                  <Link2 size={17} strokeWidth={2.5} /> Connect Fiber wallet
                </Button>
              </Link>
            </div>
          </Card>

          <Card title="Premium weather-risk report" right={<Tag tone="warn">Locked</Tag>}>
            <div className="report-locked">
              <Lock size={26} strokeWidth={2} />
              <p>Connect and pay {formatCkb(REPORT_PRICE)} to unlock.</p>
            </div>
          </Card>
        </div>
      ) : (
        <div className="grid-2">
          <Card title="Connected" right={<Tag tone="ok">Session active</Tag>}>
            <p className="sess-origin mono">
              {session.app.origin} · {shortId(session.id)}
            </p>
            <p className="demo-reqs-label">Granted capabilities</p>
            <ul className="cap-list">
              {session.permissions.map((permission) => (
                <li key={permission}>
                  <CheckCircle2 size={16} strokeWidth={2.5} className="cap-tick" />
                  <span>{translatePermission(permission).title}</span>
                </li>
              ))}
            </ul>
            <dl className="kv-list" style={{ marginTop: 8 }}>
              <div className="kv">
                <dt>Per-payment cap</dt>
                <dd>{formatCkb(session.maxSinglePayment)}</dd>
              </div>
              <div className="kv">
                <dt>Session remaining</dt>
                <dd>{formatCkb(session.maxSessionSpend)} − spent {formatCkb(session.spent)}</dd>
              </div>
            </dl>
            <Link href="/lab" className="demo-link">
              <ShieldOff size={14} strokeWidth={2.5} /> Now try to break it in the security lab
            </Link>
          </Card>

          <Card
            title="Premium weather-risk report"
            right={unlocked ? <Tag tone="ok">Unlocked</Tag> : <Tag tone="warn">Locked</Tag>}
          >
            {unlocked && outcome.ok ? (
              <div>
                <div className="pay-result">
                  <p className="pay-result-head">
                    <CheckCircle2 size={16} strokeWidth={2.5} /> Payment succeeded
                  </p>
                  <dl className="kv-list">
                    <div className="kv">
                      <dt>Amount</dt>
                      <dd>{formatCkb(outcome.amount)}</dd>
                    </div>
                    <div className="kv">
                      <dt>Payment hash</dt>
                      <dd className="mono hash">{shortId(outcome.paymentHash, 10, 6)}</dd>
                    </div>
                    <div className="kv">
                      <dt>Session remaining</dt>
                      <dd>{formatCkb(outcome.remaining)}</dd>
                    </div>
                  </dl>
                </div>
                <div className="report">
                  <p className="report-head">
                    <CloudSun size={18} strokeWidth={2.25} /> {weatherReport.location} · {weatherReport.window}
                  </p>
                  <p className="report-headline">{weatherReport.headline}</p>
                  <dl className="kv-list">
                    {weatherReport.rows.map(([k, v]) => (
                      <div className="kv" key={k}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            ) : (
              <div>
                <div className="report-locked">
                  <Lock size={26} strokeWidth={2} />
                  <p>{weatherReport.title}</p>
                </div>
                {outcome && !outcome.ok ? (
                  <p className="pay-error mono">
                    {outcome.error.code} — {outcome.error.message}
                  </p>
                ) : null}
                <Button variant="accent" block onClick={pay}>
                  Request payment · {formatCkb(REPORT_PRICE)}
                </Button>
                <p className="pay-note">Each payment is checked against the session limits and still shown to you.</p>
              </div>
            )}
          </Card>
        </div>
      )}
    </AppShell>
  );
}
