"use client";

import Link from "next/link";
import { useState } from "react";
import type { ClaspError } from "@clasp/protocol";
import { AppShell, SurfaceHead } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { EventList } from "@/components/EventList";
import { ShieldOff } from "@/components/icons";
import { useClasp, attack as runAttack, activeSession, type AttackKind } from "@/lib/claspClient";
import { useNow } from "@/lib/useNow";

const ATTACKS: { kind: AttackKind; title: string; desc: string }[] = [
  { kind: "channels", title: "Forbidden operation", desc: "Request channels:open — a permission that was never granted." },
  { kind: "overlimit", title: "Over-limit spend", desc: "Request 10 CKB when the remaining allowance is far smaller." },
  { kind: "replay", title: "Replay a payment", desc: "Resend a settled request with the same nonce. Count must stay 1." },
  { kind: "origin", title: "Stolen token", desc: "Present the copied session token from evil.example." },
];

export default function SecurityLabPage() {
  const store = useClasp();
  const now = useNow();
  const session = activeSession(store);
  const [lastError, setLastError] = useState<ClaspError | null>(null);
  const [busy, setBusy] = useState(false);

  const blocked = store.events.filter((event) => event.kind === "blocked");

  const fire = async (kind: AttackKind) => {
    if (!session || busy) return;
    setBusy(true);
    setLastError(await runAttack(kind));
    setBusy(false);
  };

  return (
    <AppShell>
      <SurfaceHead
        kicker="Security lab"
        title="Attack the wallet. Watch it win."
        sub="The paired app turns malicious. Every request hits the real policy engine and comes back with a machine-readable reason. Nothing here is simulated."
      />

      {!session ? (
        <Card>
          <div className="empty-state">
            <p>Approve a session first — then attack it.</p>
            <Link href="/demo">
              <Button variant="accent">Open the demo app</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid-2">
          <div className="stack-cards">
            <Card title="Run an attack" right={<Tag tone="muted">{session.origin}</Tag>}>
              <div className="attack-list">
                {ATTACKS.map((item) => (
                  <div key={item.kind} className="attack-row">
                    <div>
                      <p className="attack-title">{item.title}</p>
                      <p className="attack-desc">{item.desc}</p>
                    </div>
                    <Button variant="danger" disabled={busy} onClick={() => void fire(item.kind)}>
                      Send
                    </Button>
                  </div>
                ))}
              </div>
            </Card>

            {lastError ? (
              <Card title="Structured rejection" right={<Tag tone="bad">Blocked</Tag>}>
                <pre className="codeblock">{JSON.stringify(lastError, null, 2)}</pre>
              </Card>
            ) : null}
          </div>

          <Card
            title="Blocked timeline"
            right={
              <span className="lab-count mono">
                <ShieldOff size={14} strokeWidth={2.5} /> {blocked.length}
              </span>
            }
          >
            <EventList events={blocked} now={now} empty="No attacks yet. Fire one on the left." />
          </Card>
        </div>
      )}
    </AppShell>
  );
}
