import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { ArrowUpRight } from "./icons";

interface LandingActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  tone?: "dark" | "yellow" | "blue";
  size?: "hero" | "follow";
}

export function LandingActionButton({
  children,
  tone = "dark",
  size = "hero",
  className = "",
  type = "button",
  ...props
}: LandingActionButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`of-action-button of-action-button-${tone} of-action-button-${size} ${className}`.trim()}
    >
      <span className="of-action-button-label">{children}</span>
      <span className="of-action-button-icon" aria-hidden="true">
        <ArrowUpRight strokeWidth={3.1} />
      </span>
    </button>
  );
}
