import Link from "next/link";
import { FOOTER_LINKS } from "@/lib/landing";
import { ClaspMark } from "./ClaspMark";
import { LiveMode } from "./LiveMode";
import { SkyButton } from "./SkyButton";

export function SkyFooter() {
  return (
    <footer className="sky-footer sky-scanlines">
      <div className="sky-pad">
        <div className="sky-wrap-m sky-footer__inner">
          <div className="sky-footer__top">
            <h2 data-split="fade">
              <span className="sky-footer__line-1">Sound interesting?</span>
              <span className="sky-footer__line-2">Break it yourself.</span>
            </h2>
            <SkyButton href="/lab" variant="large">
              Open the Security Lab
            </SkyButton>
          </div>
          <div className="sky-footer__bottom">
            <Link className="sky-footer__mark" href="/" aria-label="Clasp home">
              <ClaspMark />
            </Link>
            <ul className="sky-footer__links">
              {FOOTER_LINKS.map((link) => (
                <li key={link.label}>
                  {link.href.startsWith("/") ? (
                    <Link href={link.href}>{link.label}</Link>
                  ) : (
                    <a href={link.href} target="_blank" rel="noreferrer">
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
            <LiveMode />
          </div>
        </div>
      </div>
      <div className="sky-footer__wordmark" aria-hidden="true">
        Clasp
      </div>
    </footer>
  );
}
