"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";
import { useClasp, checkHealth } from "@/lib/claspClient";
import { FOOTER_LINKS } from "@/lib/landing";
import { ClaspLogo, ClaspMark } from "@/components/landing/ClaspMark";

const LINKS = [
  ["Demo", "/demo"],
  ["Wallet", "/wallet"],
  ["Dashboard", "/dashboard"],
  ["Delegate", "/delegate"],
  ["Security Lab", "/lab"],
  ["SDK", "/sdk"],
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { mode, serverOnline } = useClasp();
  const linksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void checkHealth();
  }, []);

  useEffect(() => {
    linksRef.current?.querySelector<HTMLElement>("a.active")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  const offline = serverOnline === false;
  const isReal = mode === "REAL";
  const bannerClass = offline ? "offline" : isReal ? "real" : "demo";
  const bannerText = offline
    ? "Wallet core unreachable. Actions are paused until it is back"
    : isReal
      ? "Real Fiber testnet"
      : "Demo mode, no network payment";

  return (
    <div className="sky sky-app">
      <header className="app-header-fixed">
        <div className={`mode-banner ${bannerClass}`} role="status">
          <i aria-hidden="true" /> {bannerText}
        </div>
        <nav className="app-nav sky-pad" aria-label="Clasp">
          <div className="app-nav-frame">
            <Link className="app-nav-brand" href="/" aria-label="Clasp home">
              <ClaspLogo className="app-nav-wordmark" />
              <ClaspMark className="app-nav-icon" />
            </Link>
            <div className="app-nav-links" ref={linksRef}>
              {LINKS.map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  className={pathname === href ? "active" : ""}
                  aria-current={pathname === href ? "page" : undefined}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </nav>
      </header>
      <main className="app-main sky-pad">
        <div className="sky-wrap-l">{children}</div>
      </main>
      <footer className="app-foot sky-pad">
        <div className="app-foot__inner">
          <Link className="app-foot__mark" href="/" aria-label="Clasp home">
            <ClaspMark />
          </Link>
          <ul className="app-foot__links">
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
        </div>
      </footer>
    </div>
  );
}

export function SurfaceHead({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <div className="surface-head">
      <span className="surface-kicker">{kicker}</span>
      <h1 className="surface-title">{title}</h1>
      {sub ? <p className="surface-sub">{sub}</p> : null}
    </div>
  );
}
