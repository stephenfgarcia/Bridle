import { useId } from "react";

interface Props {
  x: number;
  y: number;
}

const MERIDIANS = [0, 1, 2, 3, 4, 5];
const PARALLELS = [-50, -25, 0, 25, 50];
const ORBITS = [
  { id: "o1", lat: 18, delay: -2 },
  { id: "o2", lat: -30, delay: -7 },
  { id: "o3", lat: 42, delay: -11 },
];

const R = 70;
const CX = 120;
const CY = 110;

/** A translucent wireframe globe turning above a round console in the centre aisle. */
export function HoloGlobe({ x, y }: Props) {
  const gid = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg
      className="globe"
      style={{ left: x, top: y }}
      viewBox="0 0 240 300"
      width={240}
      height={300}
      role="img"
      aria-label="Holographic globe"
    >
      <title>Holographic globe</title>
      <defs>
        <radialGradient id={`${gid}-sphere`} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#c4b5fd" stopOpacity={0.35} />
          <stop offset="0.6" stopColor="#8b5cf6" stopOpacity={0.14} />
          <stop offset="1" stopColor="#ff2bd6" stopOpacity={0.05} />
        </radialGradient>
        <radialGradient id={`${gid}-glow`}>
          <stop offset="0" stopColor="#8b5cf6" stopOpacity={0.45} />
          <stop offset="1" stopColor="#8b5cf6" stopOpacity={0} />
        </radialGradient>
        <linearGradient id={`${gid}-beam`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8b5cf6" stopOpacity={0} />
          <stop offset="1" stopColor="#ff2bd6" stopOpacity={0.35} />
        </linearGradient>
        <radialGradient id={`${gid}-floor`}>
          <stop offset="0" stopColor="#ff2bd6" stopOpacity={0.5} />
          <stop offset="1" stopColor="#ff2bd6" stopOpacity={0} />
        </radialGradient>
      </defs>

      <ellipse cx={120} cy={272} rx={110} ry={22} fill={`url(#${gid}-floor)`} />
      <polygon points="80,180 160,180 180,262 60,262" fill={`url(#${gid}-beam)`} />

      <g className="globe-float">
        <circle cx={CX} cy={CY} r={110} fill={`url(#${gid}-glow)`} />
        <circle cx={CX} cy={CY} r={R} fill={`url(#${gid}-sphere)`} />
        {PARALLELS.map((lat) => {
          const rad = (lat * Math.PI) / 180;
          const rx = R * Math.cos(rad);
          return (
            <ellipse
              key={lat}
              cx={CX}
              cy={CY - R * Math.sin(rad)}
              rx={rx}
              ry={rx * 0.16}
              fill="none"
              stroke="#c4b5fd"
              strokeWidth={0.8}
              opacity={0.45}
            />
          );
        })}
        {MERIDIANS.map((k) => (
          <ellipse
            key={k}
            className="meridian"
            style={{ animationDelay: `${(-k * 16) / 12}s` }}
            cx={CX}
            cy={CY}
            rx={R}
            ry={R}
            fill="none"
            stroke="#e9d5ff"
            strokeWidth={0.9}
            opacity={0.5}
          />
        ))}
        {ORBITS.map((o) => {
          const rad = (o.lat * Math.PI) / 180;
          return (
            <g key={o.id} className="orbit" style={{ animationDelay: `${o.delay}s` }}>
              <circle
                cx={CX + R * Math.cos(rad)}
                cy={CY - R * Math.sin(rad)}
                r={3}
                fill="#19f5a1"
              />
              <circle
                cx={CX - R * Math.cos(rad)}
                cy={CY - R * Math.sin(rad)}
                r={2}
                fill="#ff2bd6"
              />
            </g>
          );
        })}
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke="#c4b5fd"
          strokeWidth={1.4}
          opacity={0.8}
        />
        <ellipse cx={CX - 22} cy={CY - 30} rx={22} ry={12} fill="#fff" opacity={0.06} />
      </g>

      <g className="console">
        <ellipse
          cx={120}
          cy={262}
          rx={62}
          ry={16}
          fill="#1a1728"
          stroke="#3a3452"
          strokeWidth={2}
        />
        <ellipse
          className="console-ring"
          cx={120}
          cy={262}
          rx={48}
          ry={11}
          fill="none"
          stroke="#ff2bd6"
          strokeWidth={2}
        />
        <ellipse cx={120} cy={262} rx={30} ry={6} fill="#8b5cf6" opacity={0.5} />
        <rect x={58} y={262} width={124} height={14} fill="#15131f" />
        <ellipse
          cx={120}
          cy={276}
          rx={62}
          ry={16}
          fill="#121020"
          stroke="#2c2840"
          strokeWidth={2}
        />
      </g>
    </svg>
  );
}
