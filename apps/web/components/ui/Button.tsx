import { type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "accent" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  block?: boolean;
  children: ReactNode;
}

export function Button({ variant = "primary", block = false, className = "", type = "button", children, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`ui-btn ui-btn-${variant} ${block ? "ui-btn-block" : ""} ${className}`.trim()}
    >
      {children}
    </button>
  );
}
