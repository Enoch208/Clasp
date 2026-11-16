import { CheckCircle2, CloudSun, ShieldCheck } from "@/components/icons";
import type { PayOutcome } from "@/lib/claspClient";
import { weatherReport } from "@/lib/fixtures";
import { formatCkb, shortId } from "@/lib/format";

type Settled = Extract<PayOutcome, { ok: true }>;

export function UnlockedReport({ outcome }: { outcome: Settled }) {
  return (
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
        {outcome.receiptVerified ? (
          <p className="receipt-verified">
            <ShieldCheck size={14} strokeWidth={2.5} /> Wallet-signed receipt verified
            <code className="mono">{shortId(outcome.signature, 8, 6)}</code>
          </p>
        ) : null}
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
  );
}
