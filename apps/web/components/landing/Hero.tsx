import Link from "next/link";
import { HERO_CELLS } from "@/lib/landing";

export function Hero() {
  return (
    <div className="sky-hero-wrap">
      <section className="sky-hero sky-pad" aria-labelledby="sky-hero-title">
        <div className="sky-wrap-xl">
          <div className="sky-hero__grid">
            <span className="sky-line sky-line--top" aria-hidden="true" />
            <div className="sky-hero__content">
              <h1 id="sky-hero-title" className="sky-hero__title" data-split="rise">
                <span>Permissions</span>
                <span className="sky-hero__indent">&amp; Spend Limits,</span>
                <span>On Fiber</span>
              </h1>
            </div>
            <div className="sky-hero__cells">
              <span className="sky-line sky-line--left" aria-hidden="true" />
              <span className="sky-line sky-line--top sky-hero__divider" aria-hidden="true" />
              {HERO_CELLS.map((text, index) => (
                <div className="sky-hero__cell" key={text}>
                  <p data-split="para">{text}</p>
                  {index === HERO_CELLS.length - 1 ? (
                    <Link className="sky-hero__more" href="/lab">
                      &gt; Attack the wallet &lt;
                    </Link>
                  ) : (
                    <span className="sky-line sky-line--bottom" aria-hidden="true" />
                  )}
                </div>
              ))}
            </div>
            <span className="sky-line sky-line--left" aria-hidden="true" />
            <span className="sky-line sky-line--right" aria-hidden="true" />
          </div>
        </div>
      </section>
    </div>
  );
}
