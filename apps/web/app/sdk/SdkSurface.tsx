"use client";

import { useState } from "react";
import type { GrantablePermission } from "@clasp/protocol";
import { ConnectFiberWalletButton, useClaspSession } from "@clasp/react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { CheckCircle2, Link2, ShieldCheck } from "@/components/icons";
import { formatCkb, shortId, translatePermission } from "@/lib/format";

const PRICE = "100000000";

const SNIPPET = `import {
  ClaspProvider,
  ConnectFiberWalletButton,
  useClaspSession,
} from "@clasp/react";

<ClaspProvider config={{
  serverUrl, origin, app: { name: "Acme Checkout" },
  permissions: ["payments:request"], asset: "CKB",
  maxSinglePayment: "100000000",
  maxSessionSpend: "300000000",
}}>
  <Checkout />
</ClaspProvider>

// inside <Checkout/>:
const { pay, capabilities } = useClaspSession();

<ConnectFiberWalletButton />
const r = await pay({ invoice, amount: "100000000" });
if (r.ok && r.receipt.verified) unlock();`;

export function SdkSurface({ serverUrl }: { serverUrl: string }) {
  const { status, capabilities, pay, lastReceipt, error } = useClaspSession();
  const [paying, setPaying] = useState(false);

  const connected = status === "connected";

  const onPay = async () => {
    setPaying(true);
    try {
      const res = await fetch(`${serverUrl}/invoices`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: PRICE, asset: "CKB" }),
      });
      const { invoice } = (await res.json()) as { invoice: string };
      await pay({ invoice, amount: PRICE });
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="grid-2">
      <Card title="Integration" right={<Tag tone="muted">@clasp/react</Tag>}>
        <pre className="codeblock">{SNIPPET}</pre>
        <div style={{ marginTop: 18 }}>
          <ConnectFiberWalletButton className="ui-btn ui-btn-accent ui-btn-block">
            <Link2 size={17} strokeWidth={2.5} /> Connect Fiber wallet
          </ConnectFiberWalletButton>
        </div>
        {error ? <p className="pay-error mono">{error.code} — {error.message}</p> : null}
      </Card>

      <Card
        title="Live session"
        right={<Tag tone={connected ? "ok" : "muted"}>{connected ? "Session active" : "Disconnected"}</Tag>}
      >
        {!connected || !capabilities ? (
          <div className="report-locked">
            <p>Connect on the left — the hook exposes the session, its capabilities, and pay().</p>
          </div>
        ) : (
          <div>
            <p className="demo-reqs-label">session.getCapabilities()</p>
            <ul className="cap-list">
              {capabilities.operations.map((permission) => (
                <li key={permission}>
                  <CheckCircle2 size={16} strokeWidth={2.5} className="cap-tick" />
                  <span>{translatePermission(permission as GrantablePermission).title}</span>
                </li>
              ))}
            </ul>
            <dl className="kv-list" style={{ marginTop: 8 }}>
              <div className="kv">
                <dt>Per-payment cap</dt>
                <dd>{formatCkb(capabilities.maxSinglePayment)}</dd>
              </div>
              <div className="kv">
                <dt>Remaining budget</dt>
                <dd>{formatCkb(capabilities.sessionRemaining)}</dd>
              </div>
              <div className="kv">
                <dt>Can delegate</dt>
                <dd>{capabilities.canDelegate ? "yes" : "no"}</dd>
              </div>
            </dl>
            <Button variant="accent" block disabled={paying} onClick={() => void onPay()}>
              {paying ? "Settling…" : `pay({ amount: ${formatCkb(PRICE)} })`}
            </Button>
            {lastReceipt ? (
              <p className="receipt-verified">
                <ShieldCheck size={14} strokeWidth={2.5} />
                {lastReceipt.verified ? "Wallet-signed receipt verified" : "Receipt failed verification"}
                <code className="mono">{shortId(lastReceipt.result.signature, 8, 6)}</code>
              </p>
            ) : null}
          </div>
        )}
      </Card>
    </div>
  );
}
