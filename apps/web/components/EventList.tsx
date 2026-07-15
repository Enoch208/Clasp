import { type ComponentType } from "react";
import type { EventKind, EventRow } from "@/lib/claspClient";
import { relativeTime } from "@/lib/format";
import { Check, Coins, ShieldOff, Power } from "@/components/icons";

const META: Record<EventKind, { icon: ComponentType<{ size?: number; strokeWidth?: number }>; tone: string }> = {
  approved: { icon: Check, tone: "ok" },
  settled: { icon: Coins, tone: "ok" },
  blocked: { icon: ShieldOff, tone: "bad" },
  revoked: { icon: Power, tone: "muted" },
};

export function EventList({ events, now, empty }: { events: EventRow[]; now: number; empty?: string }) {
  if (events.length === 0) {
    return <p className="empty-line">{empty ?? "No activity yet."}</p>;
  }
  return (
    <div className="timeline">
      {events.map((event) => {
        const meta = META[event.kind];
        const Icon = meta.icon;
        return (
          <div key={event.id} className="tl-row">
            <span className="tl-time">{now ? relativeTime(event.ts, now) : "—"}</span>
            <span className={`ev-dot ev-${meta.tone}`}>
              <Icon size={13} strokeWidth={2.75} />
            </span>
            <div>
              <span className="tl-label">{event.label}</span>
              {event.code ? <span className="tl-code ev-code"> {event.code}</span> : null}
              {event.kind === "settled" && event.detail ? <div className="tl-detail mono">{event.detail}</div> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
