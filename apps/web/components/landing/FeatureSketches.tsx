type Head = "round" | "square" | "diamond";

function Avatar({ head }: { head: Head }) {
  return (
    <svg className="sky-sketch-avatar" viewBox="0 0 28 36" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
      {head === "round" ? <circle cx="14" cy="10" r="6" /> : null}
      {head === "square" ? <rect x="8" y="4" width="12" height="12" /> : null}
      {head === "diamond" ? <path d="M14 3 21 10 14 17 7 10Z" /> : null}
      <path d="M3 34c0-7 5-12 11-12s11 5 11 12" />
    </svg>
  );
}

const REQUESTS: { head: Head; text: string; status: "ok" | "no"; mark: string }[] = [
  { head: "round", text: "View node information. Read-only.", status: "ok", mark: "+" },
  { head: "square", text: "Create invoices to receive funds", status: "ok", mark: "+" },
  { head: "diamond", text: "Pay up to 1 CKB each, 5 CKB in all", status: "ok", mark: "+" },
  { head: "round", text: "Open channels on your node", status: "no", mark: "!" },
];

export function PermissionSketch() {
  return (
    <>
      {REQUESTS.map((request) => (
        <div className="sky-sketch-row" key={request.text}>
          <span className="sky-sketch-hatch" aria-hidden="true" />
          <Avatar head={request.head} />
          <span className="sky-sketch-bubble">{request.text}</span>
          <span className={`sky-sketch-status sky-sketch-status--${request.status}`} aria-label={request.status === "ok" ? "Granted" : "Never granted"}>
            {request.mark}
          </span>
        </div>
      ))}
    </>
  );
}

const PAYMENTS: { name: string; head: Head; amount: string; chip: string; tone: "ok" | "hold" | "no"; bars: number[] }[] = [
  { name: "Research Agent", head: "square", amount: "1.0", chip: "◆ Settled", tone: "ok", bars: [44, 22, 30] },
  { name: "weather.example", head: "round", amount: "0.8", chip: "◇ Held", tone: "hold", bars: [30, 40] },
  { name: "evil.example", head: "diamond", amount: "10", chip: "▼ Denied", tone: "no", bars: [52, 18] },
];

export function OutcomeSketch() {
  return (
    <>
      {PAYMENTS.map((payment, index) => (
        <div className={`sky-sketch-card${index === 1 ? " sky-sketch-card--shift" : ""}`} key={payment.name}>
          <Avatar head={payment.head} />
          <div>
            <div className="sky-sketch-card__name">{payment.name}</div>
            <div className="sky-sketch-card__bars" aria-hidden="true">
              {payment.bars.map((width, bar) => (
                <i key={bar} style={{ width }} />
              ))}
            </div>
          </div>
          <div className="sky-sketch-card__score">
            <span className="sky-sketch-card__amount">{payment.amount}</span>
            <span className={`sky-chip sky-chip--${payment.tone}`}>{payment.chip}</span>
          </div>
        </div>
      ))}
    </>
  );
}

const EVENTS: { head: Head; chip: string; tone: "ok" | "hold" | "no"; meta: string; bars: number[] }[] = [
  { head: "round", chip: "◆ Active", tone: "ok", meta: "3 payments · 2.6 CKB", bars: [120, 84, 100] },
  { head: "square", chip: "◇ Sub-agent", tone: "hold", meta: "Cap 1 CKB · 30 min", bars: [96, 120] },
  { head: "diamond", chip: "▼ Revoked", tone: "no", meta: "0 requests accepted", bars: [110, 70, 90] },
];

export function TimelineSketch() {
  return (
    <div className="sky-sketch-timeline">
      {EVENTS.map((event) => (
        <div className="sky-sketch-event" key={event.chip}>
          <div className="sky-sketch-event__node">
            <span className="sky-sketch-event__dot">
              <Avatar head={event.head} />
            </span>
            <span className={`sky-chip sky-chip--${event.tone}`}>{event.chip}</span>
          </div>
          <div className="sky-sketch-event__lines">
            {event.bars.map((width, bar) => (
              <i key={bar} style={{ width }} aria-hidden="true" />
            ))}
            <span className="sky-sketch-event__meta">{event.meta}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
