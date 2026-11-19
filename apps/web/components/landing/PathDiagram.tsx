import type { ReactNode } from "react";
import type { PathId } from "@/lib/landing";

const ORBIT = [
  [300, 70], [430, 108], [520, 210], [540, 330], [490, 450], [380, 525], [250, 530], [140, 470],
  [80, 360], [72, 236], [140, 128], [212, 168], [400, 180], [450, 400], [180, 400], [300, 450],
];
const PLUS = [[350, 140], [470, 290], [200, 250], [420, 470], [120, 300]];
const MINUS = [[250, 100], [520, 400], [150, 200], [330, 560]];

function Node({ x, y, tone, children }: { x: number; y: number; tone: string; children: ReactNode }) {
  return (
    <g>
      <circle cx={x} cy={y} r="26" fill="var(--sky-ink)" stroke={tone} strokeWidth="1.5" />
      <g stroke={tone} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
    </g>
  );
}

function Label({ x, y, tone, children }: { x: number; y: number; tone: string; children: string }) {
  return (
    <text x={x} y={y} fill={tone} fontSize="13" textAnchor="middle">
      {children}
    </text>
  );
}

export function PathDiagram({ state }: { state: PathId }) {
  const green = "var(--sky-green)";
  const blue = "var(--sky-blue)";
  const red = "var(--sky-red)";
  const bone = "var(--sky-bone)";
  return (
    <svg className="sky-diagram" viewBox="0 0 600 600" data-state={state} aria-hidden="true">
      <g className="sky-diagram__orbit">
        {ORBIT.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="6" />
        ))}
      </g>
      <g stroke={green} strokeWidth="1.5" opacity="0.8">
        {PLUS.map(([x, y]) => (
          <path key={`${x}-${y}`} d={`M${x - 5} ${y}h10M${x} ${y - 5}v10`} />
        ))}
      </g>
      <g stroke={red} strokeWidth="1.5" opacity="0.8">
        {MINUS.map(([x, y]) => (
          <path key={`${x}-${y}`} d={`M${x - 5} ${y}h10`} />
        ))}
      </g>

      <g className="sky-diagram__state sky-diagram__state--pay">
        <path d="M374 270 480 196" stroke={green} strokeWidth="1.5" />
        <path d="M368 336 456 420" stroke={green} strokeWidth="1.5" />
        <Label x={474} y={270} tone={green}>−1.0 CKB</Label>
        <Node x={500} y={182} tone={green}>
          <path d="M489 183l7 7 14-15" />
        </Node>
        <Label x={500} y={232} tone={bone}>MERCHANT</Label>
        <Node x={474} y={438} tone={green}>
          <path d="M466 430h16M466 438h16M466 446h10" />
        </Node>
        <Label x={474} y={488} tone={bone}>SIGNED RECEIPT</Label>
      </g>

      <g className="sky-diagram__state sky-diagram__state--hold">
        <path d="M368 262 470 170" stroke={blue} strokeWidth="1.5" strokeDasharray="6 6" />
        <path d="M232 340 152 426" stroke={blue} strokeWidth="1.5" strokeDasharray="6 6" />
        <Label x={528} y={246} tone={blue}>0.8 CKB HELD</Label>
        <Node x={488} y={152} tone={blue}>
          <rect x="478" y="150" width="20" height="14" rx="2" />
          <path d="M482 150v-5a6 6 0 0 1 12 0v5" />
        </Node>
        <Label x={488} y={202} tone={bone}>OWNER KEY</Label>
        <Node x={136} y={444} tone={blue}>
          <path d="M131 434v20M141 434v20" />
        </Node>
        <Label x={136} y={494} tone={bone}>AGENT WAITS</Label>
      </g>

      <g className="sky-diagram__state sky-diagram__state--block">
        <path d="M236 262 196 228l-8 10-8-10-8 10-8-10-16-14" stroke={red} strokeWidth="1.5" fill="none" />
        <path d="M376 276 418 250l8 10 8-10 8 10 8-10 16-10" stroke={red} strokeWidth="1.5" fill="none" />
        <path d="M352 362 382 404l-10 6 10 6-10 6 10 6 20 22" stroke={red} strokeWidth="1.5" fill="none" />
        <Node x={130} y={196} tone={red}>
          <path d="M130 184v14M130 205v1" />
        </Node>
        <Label x={130} y={248} tone={red}>replay_detected</Label>
        <Node x={488} y={226} tone={red}>
          <path d="M488 214v14M488 235v1" />
        </Node>
        <Label x={488} y={278} tone={red}>origin_mismatch</Label>
        <Node x={420} y={474} tone={red}>
          <path d="M420 462v14M420 483v1" />
        </Node>
        <Label x={420} y={526} tone={red}>permission_denied</Label>
      </g>

      <circle cx="300" cy="300" r="88" fill="none" stroke={bone} strokeOpacity="0.35" />
      <circle className="sky-diagram__core" cx="300" cy="300" r="78" fill={green} />
      <g className="sky-diagram__state sky-diagram__state--pay">
        <text x="300" y="306" textAnchor="middle" fontSize="44" fontWeight="700" fill="var(--sky-ink)" style={{ fontFamily: "var(--sky-font-grotesk)" }}>4.0</text>
        <text x="300" y="332" textAnchor="middle" fontSize="12" fill="var(--sky-ink)">CKB LEFT</text>
      </g>
      <g className="sky-diagram__state sky-diagram__state--hold">
        <text x="300" y="306" textAnchor="middle" fontSize="44" fontWeight="700" fill="var(--sky-ink)" style={{ fontFamily: "var(--sky-font-grotesk)" }}>4.0</text>
        <text x="300" y="332" textAnchor="middle" fontSize="12" fill="var(--sky-ink)">0.8 RESERVED</text>
      </g>
      <g className="sky-diagram__state sky-diagram__state--block">
        <text x="300" y="306" textAnchor="middle" fontSize="44" fontWeight="700" fill="var(--sky-ink)" style={{ fontFamily: "var(--sky-font-grotesk)" }}>5.0</text>
        <text x="300" y="332" textAnchor="middle" fontSize="12" fill="var(--sky-ink)">NOTHING SPENT</text>
      </g>
    </svg>
  );
}
