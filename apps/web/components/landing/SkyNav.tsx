import Link from "next/link";
import { ClaspLogo, ClaspMark } from "./ClaspMark";
import { SkyButton } from "./SkyButton";

export function SkyNav() {
  return (
    <nav className="sky-nav" aria-label="Main">
      <div className="sky-nav__bg" aria-hidden="true" />
      <div className="sky-nav__spacer" />
      <div className="sky-pad">
        <div className="sky-nav__grid">
          <span className="sky-line sky-line--left" aria-hidden="true" />
          <span className="sky-line sky-line--top" aria-hidden="true" />
          <div className="sky-nav__brand">
            <Link className="sky-nav__logo" href="/" aria-label="Clasp home">
              <ClaspLogo />
            </Link>
            <Link className="sky-nav__icon" href="/" aria-label="Clasp home">
              <ClaspMark />
            </Link>
          </div>
          <div className="sky-nav__cta">
            <SkyButton href="/demo">→ Open the Clasp demo</SkyButton>
          </div>
          <span className="sky-line sky-line--bottom" aria-hidden="true" />
        </div>
      </div>
      <div className="sky-nav__spacer" />
    </nav>
  );
}
