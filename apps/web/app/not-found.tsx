import Link from "next/link";

export default function NotFound() {
  return (
    <main
      className="overflow-theme"
      style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
    >
      <div className="card card-pad" style={{ maxWidth: "540px", textAlign: "center" }}>
        <p className="surface-kicker">Error 404</p>
        <h1 style={{ fontSize: "clamp(3rem, 11vw, 5.5rem)", fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 0.95, margin: "10px 0 0" }}>
          No session here.
        </h1>
        <p style={{ color: "var(--of-muted)", fontWeight: 600, margin: "18px 0 28px", lineHeight: 1.5 }}>
          That page isn&apos;t part of any session — and nothing was granted authority to reach it.
        </p>
        <Link href="/" className="ui-btn ui-btn-primary" style={{ textDecoration: "none", display: "inline-flex" }}>
          Back to Clasp
        </Link>
      </div>
    </main>
  );
}
