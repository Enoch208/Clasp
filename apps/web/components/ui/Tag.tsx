import { type ReactNode } from "react";

type Tone = "ok" | "warn" | "bad" | "muted";

export function Tag({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}
