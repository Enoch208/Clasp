export function ClaspMarkShapes() {
  return (
    <>
      <rect x="2" y="3" width="11" height="3" />
      <rect x="2" y="3" width="3" height="13" />
      <rect x="2" y="13" width="11" height="3" />
      <rect x="11" y="8" width="11" height="3" />
      <rect x="19" y="8" width="3" height="13" />
      <rect x="11" y="18" width="11" height="3" />
    </>
  );
}

export function ClaspMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <ClaspMarkShapes />
    </svg>
  );
}

export function ClaspLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 150 40" fill="currentColor" role="img" aria-label="Clasp">
      <g transform="translate(0 4) scale(1.33)">
        <ClaspMarkShapes />
      </g>
      <text x="44" y="31" fontSize="38" style={{ fontFamily: "var(--font-instrument-serif), serif" }}>
        Clasp
      </text>
    </svg>
  );
}
