import type { ReactNode } from "react";
import { SkyAir } from "./SkyAir";

export function SkyStandalone({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return (
    <main className="sky sky-standalone">
      <SkyAir className="sky-hero-bg" priority />
      <div className="sky-standalone__frame">
        <span className="sky-line sky-line--top" aria-hidden="true" />
        <span className="sky-line sky-line--bottom" aria-hidden="true" />
        <span className="sky-line sky-line--left" aria-hidden="true" />
        <span className="sky-line sky-line--right" aria-hidden="true" />
        <p className="surface-kicker">{kicker}</p>
        <h1>{title}</h1>
        {children}
      </div>
    </main>
  );
}
