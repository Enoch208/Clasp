"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { useMockStore } from "@/lib/mockStore";

const LINKS = [
  ["Demo", "/demo"],
  ["Wallet", "/wallet"],
  ["Dashboard", "/dashboard"],
  ["Security Lab", "/lab"],
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { mode } = useMockStore();
  const isReal = mode === "REAL";

  return (
    <div className="overflow-theme app-shell">
      <div className="app-header-fixed">
        <div className={`mode-banner ${isReal ? "real" : "demo"}`}>
          <i /> {isReal ? "Real Fiber testnet" : "Demo mode — no network payment"}
        </div>
        <nav className="app-nav">
          <Link className="app-nav-brand" href="/">
            <span className="clasp-mark" aria-hidden="true" />
            <span>Clasp</span>
          </Link>
          <div className="app-nav-links">
            {LINKS.map(([label, href]) => (
              <Link key={href} href={href} className={pathname === href ? "active" : ""}>
                {label}
              </Link>
            ))}
          </div>
        </nav>
      </div>
      <main className="app-main">{children}</main>
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
