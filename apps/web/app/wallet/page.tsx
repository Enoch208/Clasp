"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { GrantablePermission } from "@clasp/protocol";
import { isGrantable } from "@clasp/protocol";
import { AppShell, SurfaceHead } from "@/components/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { Stepper } from "@/components/ui/Stepper";
import { Check, X, ShieldCheck } from "@/components/icons";
import { weatherAgentPairing, PAIRING_CODE, DEFAULT_DURATION_MINS } from "@/lib/fixtures";
import { formatCkb, formatDuration, translatePermission, CANNOT_LIST } from "@/lib/format";
import { approveSession } from "@/lib/mockStore";

const SINGLE_STEP = "25000000";
const SINGLE_MIN = "25000000";
const SESSION_STEP = "50000000";
const SESSION_MIN = "50000000";

export default function WalletApprovalPage() {
  const router = useRouter();
  const request = weatherAgentPairing;
  const granted = request.requestedPermissions.filter(isGrantable) as GrantablePermission[];

  const [maxSingle, setMaxSingle] = useState(request.requestedLimits.maxSinglePayment);
  const [maxSession, setMaxSession] = useState(request.requestedLimits.maxSessionSpend);
  const [durationMins, setDurationMins] = useState(DEFAULT_DURATION_MINS);

  const reduced =
    maxSession !== request.requestedLimits.maxSessionSpend ||
    maxSingle !== request.requestedLimits.maxSinglePayment ||
    durationMins !== DEFAULT_DURATION_MINS;

  const approve = () => {
    approveSession({ permissions: granted, maxSinglePayment: maxSingle, maxSessionSpend: maxSession, durationMins });
    router.push("/demo");
  };

  return (
    <AppShell>
      <SurfaceHead
        kicker="Wallet · Permission review"
        title="Weather Agent wants to connect"
        sub={`${request.app.origin} · pairing code ${PAIRING_CODE}. The app requests authority — you decide what it actually gets.`}
      />

      <div className="grid-2">
        <Card title="Requested access">
          <ul className="perm-list">
            {granted.map((permission) => {
              const t = translatePermission(permission);
              return (
                <li key={permission} className="perm-row">
                  <span className="perm-check" aria-hidden="true">
                    <Check size={15} strokeWidth={3} />
                  </span>
                  <div>
                    <p className="perm-title">{t.title}</p>
                    <p className="perm-conseq">{t.consequence}</p>
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="perm-divider">This application cannot</p>
          <ul className="perm-list">
            {CANNOT_LIST.map((item) => (
              <li key={item} className="perm-row cannot">
                <span className="perm-x" aria-hidden="true">
                  <X size={15} strokeWidth={3} />
                </span>
                <p className="perm-title muted">{item}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Set the limits" right={reduced ? <Tag tone="ok">Reduced</Tag> : <Tag tone="muted">As requested</Tag>}>
          <div className="limit-field">
            <div className="limit-label">
              <span>Maximum per payment</span>
              <small>Requested {formatCkb(request.requestedLimits.maxSinglePayment)}</small>
            </div>
            <Stepper
              value={maxSingle}
              min={SINGLE_MIN}
              max={request.requestedLimits.maxSinglePayment}
              step={SINGLE_STEP}
              onChange={setMaxSingle}
              format={formatCkb}
            />
          </div>

          <div className="limit-field">
            <div className="limit-label">
              <span>Maximum session spend</span>
              <small>Requested {formatCkb(request.requestedLimits.maxSessionSpend)}</small>
            </div>
            <Stepper
              value={maxSession}
              min={SESSION_MIN}
              max={request.requestedLimits.maxSessionSpend}
              step={SESSION_STEP}
              onChange={setMaxSession}
              format={formatCkb}
            />
          </div>

          <div className="limit-field">
            <div className="limit-label">
              <span>Session duration</span>
              <small>Requested {formatDuration(DEFAULT_DURATION_MINS)}</small>
            </div>
            <Stepper
              value={String(durationMins)}
              min="5"
              max={String(DEFAULT_DURATION_MINS)}
              step="5"
              onChange={(v) => setDurationMins(Number(v))}
              format={(v) => formatDuration(Number(v))}
            />
          </div>

          <p className="limit-note">
            <ShieldCheck size={15} strokeWidth={2.4} /> The wallet signs your reduced values — never the app&apos;s request.
          </p>

          <div className="limit-actions">
            <Button variant="accent" block onClick={approve}>
              Approve — {formatCkb(maxSession)} / {formatDuration(durationMins)}
            </Button>
            <Button variant="ghost" block onClick={() => router.push("/")}>
              Reject
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
