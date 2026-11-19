import { OUTCOMES, POLICY_CHECKS } from "@/lib/landing";
import { ClaspMark } from "./ClaspMark";

function Labels({ order }: { order: readonly string[] }) {
  return (
    <div className="sky-marquee__list">
      {order.map((label) => (
        <span className="sky-marquee__label" key={label}>
          <ClaspMark />
          {label}
        </span>
      ))}
    </div>
  );
}

function Badges() {
  return (
    <div className="sky-marquee__list sky-marquee__badges">
      {OUTCOMES.map((outcome, index) => (
        <span className="sky-badge" key={index}>
          <span className={`sky-badge__amount sky-badge__amount--${outcome.tone}`}>{outcome.amount}</span>
          <span className={`sky-chip sky-chip--${outcome.tone}`}>
            {outcome.glyph} {outcome.code}
          </span>
        </span>
      ))}
    </div>
  );
}

export function ErrorMarquee() {
  const reversed = [...POLICY_CHECKS].reverse();
  return (
    <section className="sky-codes" aria-labelledby="sky-codes-title">
      <div className="sky-pad">
        <div className="sky-wrap-s sky-codes__intro">
          <h2 id="sky-codes-title" data-split="fade">
            Every refusal is data
          </h2>
          <p>
            When a request breaks a rule, the wallet answers with a stable code, whether it is worth retrying, and what to do
            next. An agent can branch on it instead of guessing.
          </p>
          <p>The same ten checks run on every request, in the same order.</p>
          <ol className="sky-sr-only">
            {POLICY_CHECKS.map((check) => (
              <li key={check}>{check}</li>
            ))}
          </ol>
        </div>
      </div>
      <div className="sky-marquee" aria-hidden="true">
        <div className="sky-marquee__row">
          <Labels order={POLICY_CHECKS} />
          <Labels order={POLICY_CHECKS} />
        </div>
        <div className="sky-marquee__row sky-marquee__row--reverse">
          <Badges />
          <Badges />
        </div>
        <div className="sky-marquee__row">
          <Labels order={reversed} />
          <Labels order={reversed} />
        </div>
      </div>
    </section>
  );
}
