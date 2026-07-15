"use client";

import { type CSSProperties, type RefObject, useEffect, useMemo, useState } from "react";

interface HeroHoverGridProps {
  className?: string;
  squareSize?: number;
  borderColor?: string;
  eventTargetRef?: RefObject<HTMLElement | null>;
}

const columns = 18;
const rows = 14;
const tints = ["var(--of-blue)", "var(--of-violet)", "var(--of-mint)", "var(--of-yellow)", "var(--of-orange)"];

export function HeroHoverGrid({
  className = "",
  squareSize = 48,
  borderColor = "rgba(91, 164, 255, 0.38)",
  eventTargetRef,
}: HeroHoverGridProps) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const cells = useMemo(() => Array.from({ length: columns * rows }, (_, index) => index), []);

  useEffect(() => {
    const target = eventTargetRef?.current;
    if (!target) return;

    const updateCell = (event: PointerEvent) => {
      const rect = target.getBoundingClientRect();
      const x = Math.floor(((event.clientX - rect.left) / rect.width) * columns);
      const y = Math.floor(((event.clientY - rect.top) / rect.height) * rows);
      setActiveIndex(y * columns + x);
    };
    const clearCell = () => setActiveIndex(-1);

    target.addEventListener("pointermove", updateCell);
    target.addEventListener("pointerleave", clearCell);
    return () => {
      target.removeEventListener("pointermove", updateCell);
      target.removeEventListener("pointerleave", clearCell);
    };
  }, [eventTargetRef]);

  const style = {
    "--hero-grid-size": `${squareSize}px`,
    "--hero-grid-border": borderColor,
    "--hero-grid-columns": String(columns),
    "--hero-grid-rows": String(rows),
  } as CSSProperties;

  return (
    <div className={`hero-hover-grid ${className}`.trim()} style={style}>
      {cells.map((index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const active = index === activeIndex;
        const tint = tints[(column + row) % tints.length];

        return (
          <span
            key={index}
            className={active ? "is-active" : undefined}
            style={{ opacity: active ? 1 : undefined, "--hero-grid-active": tint } as CSSProperties}
          />
        );
      })}
    </div>
  );
}
