import { LINKS } from "@/lib/landing";
import { SkyButton } from "./SkyButton";

const ROWS = [
  { label: "Apps", y: 24, boxes: ["AI agents", "dApps", "Sub-agents"] },
  { label: "Clasp", y: 152, boxes: ["SDK", "Keyless relay", "Wallet core"] },
];
const COLUMNS = [140, 250, 360];

function Box({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <g>
      <rect x={x - 50} y={y} width="100" height="34" fill="none" stroke="var(--sky-bone)" />
      <text x={x} y={y + 21} textAnchor="middle" fontSize="9.5" fill="var(--sky-bone)">
        {text}
      </text>
    </g>
  );
}

function Diagram() {
  return (
    <svg viewBox="0 0 420 340" role="img" aria-label="Apps and agents connect through the Clasp SDK, a keyless relay and the wallet core to the Fiber Network.">
      {ROWS.map((row) => (
        <g key={row.label}>
          <text x="0" y={row.y + 21} fontSize="9" fill="var(--sky-bone)" opacity="0.7">
            {row.label}
          </text>
          {row.boxes.map((box, index) => (
            <Box key={box} x={COLUMNS[index]} y={row.y} text={box} />
          ))}
        </g>
      ))}
      <text x="0" y="303" fontSize="9" fill="var(--sky-bone)" opacity="0.7">
        Fiber
      </text>
      <g stroke="var(--sky-bone)" strokeWidth="1" fill="none">
        {COLUMNS.map((x) => (
          <line key={`v-${x}`} className="sky-arch-line" pathLength={1} x1={x} y1="58" x2={x} y2="152" />
        ))}
        <line className="sky-arch-line" pathLength={1} x1="140" y1="58" x2="250" y2="152" />
        <line className="sky-arch-line" pathLength={1} x1="360" y1="58" x2="250" y2="152" />
        <line className="sky-arch-line" pathLength={1} x1="250" y1="58" x2="360" y2="152" />
        {COLUMNS.map((x) => (
          <line key={`d-${x}`} className="sky-arch-line" pathLength={1} x1={x} y1="186" x2="250" y2="282" />
        ))}
      </g>
      <rect x="145" y="282" width="210" height="40" fill="var(--sky-bone)" />
      <text x="250" y="309" textAnchor="middle" fontSize="19" fill="var(--sky-cobalt)" style={{ fontFamily: "var(--sky-font-serif)", textTransform: "none" }}>
        Fiber Network
      </text>
    </svg>
  );
}

export function Architecture() {
  return (
    <section className="sky-arch" aria-labelledby="sky-arch-title">
      <div className="sky-pad">
        <div className="sky-wrap-l sky-section-pad">
          <div className="sky-arch__grid">
            <div className="sky-arch__copy">
              <h2 id="sky-arch-title" data-split="fade">
                We’re building the permission layer for Fiber.
              </h2>
              <p>
                Clasp ships as three pieces: a TypeScript SDK on npm, a relay that holds no keys and cannot read the payments it
                carries, and a wallet core you can run yourself with Docker.
              </p>
              <p>Any Fiber app or agent adopts it with two calls, connect() and requestPayment().</p>
              <SkyButton href={LINKS.quickstart} variant="outline">
                &gt; Developer? Read the quickstart
              </SkyButton>
            </div>
            <div className="sky-arch__diagram">
              <Diagram />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
