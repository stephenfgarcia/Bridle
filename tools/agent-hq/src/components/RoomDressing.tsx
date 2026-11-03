import type { CSSProperties } from "react";

/* ---------- Ceiling: cable trays and conduit, drawn in the 1600x44 band above the wall ---------- */

const RUNGS = Array.from({ length: 40 }, (_, i) => 90 + i * 36);
const JUNCTIONS = [310, 800, 1290];

export function CeilingDressing() {
  return (
    <svg className="ceiling-svg" viewBox="0 0 1600 44" aria-hidden="true">
      <line x1={70} y1={4} x2={1530} y2={4} stroke="#3a3650" strokeWidth={1.5} />
      <line x1={70} y1={14} x2={1530} y2={14} stroke="#3a3650" strokeWidth={1.5} />
      {RUNGS.map((x) => (
        <line key={x} x1={x} y1={4} x2={x} y2={14} stroke="#2e2b42" strokeWidth={1.2} />
      ))}
      <line x1={70} y1={9} x2={1530} y2={9} stroke="#4b4664" strokeWidth={2} opacity={0.5} />
      <line x1={120} y1={18} x2={1480} y2={18} stroke="#26233a" strokeWidth={3} />
      {JUNCTIONS.map((x) => (
        <g key={x}>
          <rect x={x - 8} y={2} width={16} height={12} rx={2} fill="#221f33" stroke="#3a3650" />
          <path
            d={`M${x} 14 q 0 10 ${x > 800 ? -14 : 14} 14`}
            fill="none"
            stroke="#2e2b42"
            strokeWidth={2}
          />
        </g>
      ))}
      <line x1={0} y1={0} x2={112} y2={44} stroke="#ff2bd6" strokeWidth={2} opacity={0.5} />
      <line x1={1600} y1={0} x2={1488} y2={44} stroke="#ff2bd6" strokeWidth={2} opacity={0.5} />
    </svg>
  );
}

/* ---------- Server racks along the side walls ---------- */

const RACK_UNITS = [0, 1, 2, 3, 4, 5, 6, 7];
const LED_COLORS = ["#19f5a1", "#ff2bd6", "#ffb020", "#22d3ee"];
const LED_SLOTS = [0, 1, 2];

interface RackProps {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

function Rack({ id, x, y, w, h }: RackProps) {
  const unitH = (h - 16) / RACK_UNITS.length;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={3}
        fill="#13111f"
        stroke="#2c2940"
        strokeWidth={1.5}
      />
      <rect x={x + 4} y={y + 4} width={w - 8} height={h - 8} rx={2} fill="#0c0b16" />
      {RACK_UNITS.map((u) => {
        const uy = y + 8 + u * unitH;
        return (
          <g key={u}>
            <rect
              x={x + 7}
              y={uy}
              width={w - 14}
              height={unitH - 3}
              rx={1.5}
              fill="#191726"
              stroke="#262339"
              strokeWidth={0.8}
            />
            <rect
              x={x + 10}
              y={uy + unitH / 2 - 1}
              width={w * 0.4}
              height={2}
              rx={1}
              fill="#2d2a42"
            />
            {LED_SLOTS.map((i) => {
              const seed = (u * 7 + i * 13 + id.length * 3) % 11;
              const color = LED_COLORS[(u + i) % LED_COLORS.length] ?? "#19f5a1";
              const steady = seed % 4 === 0;
              const style = {
                "--d": `${1.2 + (seed % 5) * 0.45}s`,
                animationDelay: `${-(seed % 7) * 0.35}s`,
              } as CSSProperties;
              return (
                <circle
                  key={i}
                  className={steady ? "led led--steady" : "led"}
                  style={style}
                  cx={x + w - 11 - i * 5}
                  cy={uy + unitH / 2}
                  r={1.6}
                  fill={color}
                />
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

export function ServerRacks({ side }: { side: "left" | "right" }) {
  return (
    <div className={`racks racks--${side}`} aria-hidden="true">
      <svg viewBox="0 0 150 230" width={150} height={230} aria-hidden="true">
        <ellipse cx={75} cy={226} rx={70} ry={6} fill="#000" opacity={0.45} />
        <Rack id="near" x={6} y={14} w={66} h={210} />
        <Rack id="far" x={84} y={36} w={54} h={184} />
      </svg>
    </div>
  );
}

/* ---------- A tall window onto a blurred night city ---------- */

interface Building {
  id: string;
  x: number;
  w: number;
  h: number;
}

const FAR_BUILDINGS: Building[] = [
  { id: "f1", x: 4, w: 22, h: 150 },
  { id: "f2", x: 30, w: 16, h: 190 },
  { id: "f3", x: 52, w: 26, h: 160 },
  { id: "f4", x: 84, w: 18, h: 205 },
  { id: "f5", x: 108, w: 24, h: 170 },
  { id: "f6", x: 138, w: 28, h: 185 },
];

const BUILDINGS: Building[] = [
  { id: "b1", x: 0, w: 14, h: 96 },
  { id: "b2", x: 16, w: 10, h: 140 },
  { id: "b3", x: 28, w: 18, h: 110 },
  { id: "b4", x: 48, w: 12, h: 176 },
  { id: "b5", x: 62, w: 16, h: 128 },
  { id: "b6", x: 80, w: 9, h: 150 },
  { id: "b7", x: 91, w: 20, h: 100 },
  { id: "b8", x: 113, w: 11, h: 164 },
  { id: "b9", x: 126, w: 15, h: 118 },
  { id: "b10", x: 143, w: 12, h: 142 },
  { id: "b11", x: 157, w: 13, h: 92 },
];

const WINDOW_COLORS = ["#ffd9a0", "#9fe8ff", "#f4e8ff", "#ffb6e6"];
const SKY_H = 322;

interface Light {
  id: string;
  x: number;
  y: number;
  color: string;
  blink: boolean;
  delay: number;
}

const LIGHTS: Light[] = BUILDINGS.flatMap((b) => {
  const out: Light[] = [];
  const top = SKY_H - b.h;
  for (let row = 0; top + 6 + row * 9 < SKY_H - 6; row += 1) {
    for (let col = 0; b.x + 3 + col * 6 < b.x + b.w - 3; col += 1) {
      const hash = (row * 31 + col * 17 + b.h) % 13;
      if (hash % 3 === 0) continue;
      out.push({
        id: `${b.id}-${row}-${col}`,
        x: b.x + 3 + col * 6,
        y: top + 6 + row * 9,
        color: WINDOW_COLORS[hash % WINDOW_COLORS.length] ?? "#ffd9a0",
        blink: hash === 7 || hash === 11,
        delay: -(hash % 6) * 1.1,
      });
    }
  }
  return out;
});

const STARS = [12, 37, 58, 71, 96, 118, 141, 160, 24, 85, 133, 50].map((x, i) => ({
  id: `s${x}`,
  x,
  y: 8 + ((i * 29) % 60),
}));

export function CityWindow() {
  return (
    <div className="window" aria-hidden="true">
      <svg
        className="window-sky"
        viewBox={`0 0 170 ${SKY_H}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="sky-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0f0b24" />
            <stop offset="0.55" stopColor="#241347" />
            <stop offset="1" stopColor="#4a1f6e" />
          </linearGradient>
          <radialGradient id="moon-glow">
            <stop offset="0" stopColor="#efe6ff" stopOpacity={0.45} />
            <stop offset="1" stopColor="#efe6ff" stopOpacity={0} />
          </radialGradient>
          <linearGradient id="horizon" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff2bd6" stopOpacity={0} />
            <stop offset="1" stopColor="#ff2bd6" stopOpacity={0.35} />
          </linearGradient>
        </defs>
        <rect width={170} height={SKY_H} fill="url(#sky-grad)" />
        {STARS.map((s) => (
          <circle key={s.id} cx={s.x} cy={s.y} r={0.9} fill="#fff" opacity={0.6} />
        ))}
        <circle cx={122} cy={46} r={30} fill="url(#moon-glow)" />
        <circle cx={122} cy={46} r={12} fill="#efe6ff" />
        <rect y={SKY_H - 220} width={170} height={220} fill="url(#horizon)" />
        {FAR_BUILDINGS.map((b) => (
          <rect key={b.id} x={b.x} y={SKY_H - b.h} width={b.w} height={b.h} fill="#1a1333" />
        ))}
        {BUILDINGS.map((b) => (
          <rect key={b.id} x={b.x} y={SKY_H - b.h} width={b.w} height={b.h} fill="#0b0916" />
        ))}
        <line x1={54} y1={SKY_H - 176} x2={54} y2={SKY_H - 192} stroke="#ff4545" strokeWidth={1} />
        <line
          x1={118.5}
          y1={SKY_H - 164}
          x2={118.5}
          y2={SKY_H - 178}
          stroke="#ff4545"
          strokeWidth={1}
        />
        {LIGHTS.map((l) => (
          <rect
            key={l.id}
            className={l.blink ? "win win--blink" : "win"}
            style={l.blink ? { animationDelay: `${l.delay}s` } : undefined}
            x={l.x}
            y={l.y}
            width={2.6}
            height={3.2}
            fill={l.color}
            opacity={0.75}
          />
        ))}
      </svg>
      <svg
        className="window-frame"
        viewBox={`0 0 170 ${SKY_H}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <polygon points="0,0 170,0 110,60 0,170" fill="#fff" opacity={0.04} />
        <line x1={56} y1={0} x2={56} y2={SKY_H} stroke="#2e2a44" strokeWidth={2.5} />
        <line x1={113} y1={0} x2={113} y2={SKY_H} stroke="#2e2a44" strokeWidth={2.5} />
        <line x1={0} y1={80} x2={170} y2={80} stroke="#2e2a44" strokeWidth={2.5} />
        <line x1={0} y1={161} x2={170} y2={161} stroke="#2e2a44" strokeWidth={2.5} />
        <line x1={0} y1={242} x2={170} y2={242} stroke="#2e2a44" strokeWidth={2.5} />
        <rect x={0} y={0} width={170} height={SKY_H} fill="none" stroke="#3a3450" strokeWidth={4} />
        <rect x={0} y={SKY_H - 7} width={170} height={7} fill="#2a2640" />
      </svg>
    </div>
  );
}

/* ---------- Plants ---------- */

const LEAVES = [
  { id: "l1", rot: -64, len: 0.78 },
  { id: "l2", rot: -38, len: 0.95 },
  { id: "l3", rot: -14, len: 1.05 },
  { id: "l4", rot: 6, len: 1.0 },
  { id: "l5", rot: 28, len: 0.92 },
  { id: "l6", rot: 50, len: 0.8 },
  { id: "l7", rot: 70, len: 0.66 },
];

interface PlantProps {
  x: number;
  y: number;
  scale?: number;
  z?: number;
}

export function Plant({ x, y, scale = 1, z = 5 }: PlantProps) {
  const style = {
    left: x,
    top: y,
    transform: `translate(-50%, -100%) scale(${scale})`,
    zIndex: z,
  } as CSSProperties;
  return (
    <div className="plant" style={style} aria-hidden="true">
      <svg viewBox="0 0 90 130" width={90} height={130} aria-hidden="true">
        <ellipse cx={45} cy={126} rx={30} ry={5} fill="#000" opacity={0.45} />
        <g className="leaves">
          {LEAVES.map((leaf) => (
            <path
              key={leaf.id}
              d="M0 0 C-11 -16 -10 -38 0 -54 C10 -38 11 -16 0 0 Z"
              transform={`translate(45 96) rotate(${leaf.rot}) scale(1 ${leaf.len})`}
              fill="#1f6b48"
              stroke="#19f5a1"
              strokeWidth={1}
              strokeOpacity={0.35}
            />
          ))}
          <path
            d="M0 0 C-7 -12 -6 -30 0 -42 C6 -30 7 -12 0 0 Z"
            transform="translate(45 96) rotate(-4)"
            fill="#2f8a5a"
          />
        </g>
        <path d="M24 96 h42 l-5 30 h-32 z" fill="#2a2638" stroke="#3b3650" strokeWidth={1.5} />
        <rect x={21} y={92} width={48} height={8} rx={3} fill="#3b3650" />
        <ellipse cx={45} cy={97} rx={20} ry={3} fill="#1a1626" />
      </svg>
    </div>
  );
}
