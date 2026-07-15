import { type ReactNode } from "react";

interface CardProps {
  title?: ReactNode;
  right?: ReactNode;
  pad?: boolean;
  className?: string;
  children: ReactNode;
}

export function Card({ title, right, pad = true, className = "", children }: CardProps) {
  return (
    <section className={`card ${className}`.trim()}>
      {(title || right) && (
        <header className="card-head">
          <span className="card-title">{title}</span>
          {right}
        </header>
      )}
      <div className={pad ? "card-pad" : ""}>{children}</div>
    </section>
  );
}
