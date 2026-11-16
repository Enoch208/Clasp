import type { SessionSnapshot } from "@useclasp/client";
import { formatCkb } from "@/lib/format";

function perWindow(windowSeconds: number): string {
  if (windowSeconds === 60) return "minute";
  if (windowSeconds === 3600) return "hour";
  return `${windowSeconds}s`;
}

export function RuleRows({ session }: { session: SessionSnapshot }) {
  return (
    <>
      <div className="kv">
        <dt>Ask before paying</dt>
        <dd>{session.approvalThreshold ? `over ${formatCkb(session.approvalThreshold)}` : "never"}</dd>
      </div>
      <div className="kv">
        <dt>Rate cap</dt>
        <dd>
          {session.rateLimit ? `${session.rateLimit.maxPayments} per ${perWindow(session.rateLimit.windowSeconds)}` : "none"}
        </dd>
      </div>
    </>
  );
}
