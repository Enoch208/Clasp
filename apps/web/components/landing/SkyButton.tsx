import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "solid" | "outline" | "large" | "row";

export function SkyButton({ href, variant = "solid", children }: { href: string; variant?: Variant; children: ReactNode }) {
  const className = variant === "solid" ? "sky-btn" : `sky-btn sky-btn--${variant}`;
  const inner = (
    <>
      <span className="sky-btn__bg" aria-hidden="true" />
      <span className="sky-btn__text">{children}</span>
    </>
  );
  if (href.startsWith("/")) {
    return (
      <Link className={className} href={href}>
        {inner}
      </Link>
    );
  }
  return (
    <a className={className} href={href} target="_blank" rel="noreferrer">
      {inner}
    </a>
  );
}
