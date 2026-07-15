"use client";

interface StepperProps {
  value: string;
  min: string;
  max: string;
  step: string;
  onChange: (value: string) => void;
  format: (value: string) => string;
}

export function Stepper({ value, min, max, step, onChange, format }: StepperProps) {
  const v = BigInt(value);
  const canDecrease = v > BigInt(min);
  const canIncrease = v < BigInt(max);

  const decrease = () => {
    const next = v - BigInt(step);
    onChange((next < BigInt(min) ? BigInt(min) : next).toString());
  };
  const increase = () => {
    const next = v + BigInt(step);
    onChange((next > BigInt(max) ? BigInt(max) : next).toString());
  };

  return (
    <div className="stepper">
      <button type="button" onClick={decrease} disabled={!canDecrease} aria-label="Decrease">
        −
      </button>
      <span className="val">{format(value)}</span>
      <button type="button" onClick={increase} disabled={!canIncrease} aria-label="Increase">
        +
      </button>
    </div>
  );
}
