import { OutcomeSketch, PermissionSketch, TimelineSketch } from "./FeatureSketches";

const FEATURES = [
  {
    title: "Permissions in plain language",
    art: <PermissionSketch />,
    text: "The app asks for what it wants. You read every permission as a consequence, cut the caps and the duration, and approve only what is left.",
  },
  {
    title: "Limits the wallet enforces",
    art: <OutcomeSketch />,
    text: "Ten checks run on every request, in the same order. Small payments settle, large ones wait for you, and anything outside the rules is refused.",
  },
  {
    title: "Authority you can take back",
    art: <TimelineSketch />,
    text: "Revoke a session from the dashboard and every later request fails, including reads. Sub-agents built on it lose their authority with it.",
  },
];

export function Features() {
  return (
    <section className="sky-features sky-pad" aria-labelledby="sky-features-title">
      <div className="sky-wrap-l sky-section-pad">
        <div className="sky-features__heading">
          <h2 id="sky-features-title">
            <span className="sky-features__kicker">Instead of handing an app your keys,</span>
            Give it a session you can end.
          </h2>
        </div>
        <div className="sky-features__grid">
          {FEATURES.map((feature, index) => (
            <article className={`sky-feature${index === 1 ? " sky-feature--mid" : ""}`} key={feature.title}>
              <h3>{feature.title}</h3>
              <div className="sky-feature__art">{feature.art}</div>
              <p className="sky-feature__text">{feature.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
