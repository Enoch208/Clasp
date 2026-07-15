"use client";

import { type RefObject } from "react";
import { HeroHoverGrid } from "./HeroHoverGrid";

interface HoverGridBackgroundProps {
  className?: string;
  gridClassName?: string;
  squareSize?: number;
  borderColor?: string;
  targetRef?: RefObject<HTMLElement | null>;
}

export function HoverGridBackground({
  className = "",
  gridClassName = "",
  squareSize,
  borderColor,
  targetRef,
}: HoverGridBackgroundProps) {
  return (
    <div className={`hover-grid-background ${className}`.trim()} aria-hidden="true">
      <HeroHoverGrid
        className={`hover-grid-background-canvas ${gridClassName}`.trim()}
        squareSize={squareSize}
        borderColor={borderColor}
        eventTargetRef={targetRef}
      />
    </div>
  );
}
