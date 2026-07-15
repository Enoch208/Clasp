export function Meter({ value, max }: { value: string; max: string }) {
  const v = BigInt(value);
  const m = BigInt(max);
  const pct = m === 0n ? 0 : Number((v * 1000n) / m) / 10;
  const tone = pct >= 90 ? "bad" : pct >= 66 ? "warn" : "";
  return (
    <div className="meter" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`meter-fill ${tone}`.trim()} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}
