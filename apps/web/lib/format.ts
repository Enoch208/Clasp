import type { GrantablePermission } from "@clasp/protocol";
import { cmpAmounts } from "@clasp/protocol";

export const SHANNONS_PER_CKB = 100_000_000n;

export function formatCkb(shannons: string): string {
  const n = BigInt(shannons);
  const whole = n / SHANNONS_PER_CKB;
  const frac = n % SHANNONS_PER_CKB;
  if (frac === 0n) return `${whole} CKB`;
  const fracStr = frac.toString().padStart(8, "0").replace(/0+$/, "");
  return `${whole}.${fracStr} CKB`;
}

export function formatDuration(minutes: number): string {
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

export function shortId(id: string, head = 6, tail = 4): string {
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

export function relativeTime(fromMs: number, nowMs: number): string {
  const secs = Math.max(0, Math.round((nowMs - fromMs) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

export function remaining(minutesTotal: number, createdAtMs: number, nowMs: number): string {
  const endMs = createdAtMs + minutesTotal * 60_000;
  const mins = Math.max(0, Math.round((endMs - nowMs) / 60_000));
  if (mins <= 0) return "expired";
  return formatDuration(mins);
}

interface Translation {
  title: string;
  consequence: string;
}

const PERMISSION_COPY: Record<GrantablePermission, Translation> = {
  "node:read": { title: "View node information", consequence: "Read-only. Sees node status; changes nothing." },
  "channels:read": { title: "View channel readiness", consequence: "Read-only. Sees whether channels can route." },
  "payments:read": { title: "View payment history", consequence: "Read-only. Sees past payments on this node." },
  "invoices:read": { title: "View invoices", consequence: "Read-only. Sees invoices this node has created." },
  "invoices:create": { title: "Create invoices", consequence: "May generate invoices to receive funds. Cannot send." },
  "payments:request": {
    title: "Request Fiber payments",
    consequence: "May ask you to pay — each payment still requires your approval.",
  },
  "payments:auto": {
    title: "Spend automatically within limits",
    consequence: "May pay without asking, up to the approved caps. The wallet enforces every limit.",
  },
};

export function translatePermission(permission: GrantablePermission): Translation {
  return PERMISSION_COPY[permission];
}

export const CANNOT_LIST = [
  "Open or close channels",
  "Export wallet secrets",
  "Change node settings",
  "Spend above the approved limit",
];

export function isReduction(previous: string, next: string): boolean {
  return cmpAmounts(next, previous) <= 0;
}

export function clampToReduction(previous: string, next: string): string {
  return isReduction(previous, next) ? next : previous;
}
