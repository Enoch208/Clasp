"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main
      className="overflow-theme"
      style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
    >
      <div className="card card-pad" style={{ maxWidth: "540px", textAlign: "center" }}>
        <p className="surface-kicker">Something broke</p>
        <h1 style={{ fontSize: "clamp(2.4rem, 8vw, 4rem)", fontWeight: 900, letterSpacing: "-0.045em", lineHeight: 0.95, margin: "10px 0 0" }}>
          The wallet stayed shut.
        </h1>
        <p style={{ color: "var(--of-muted)", fontWeight: 600, margin: "18px 0 28px", lineHeight: 1.5 }}>
          An unexpected error interrupted this page. Nothing was signed, spent, or granted — Clasp fails closed.
        </p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
          <button type="button" className="ui-btn ui-btn-primary" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/" className="ui-btn ui-btn-ghost" style={{ textDecoration: "none", display: "inline-flex" }}>
            Back to Clasp
          </Link>
        </div>
      </div>
    </main>
  );
}
