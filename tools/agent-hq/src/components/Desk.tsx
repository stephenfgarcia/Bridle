import { type CSSProperties, useEffect, useId, useRef, useState } from "react";
import type { Agent } from "../data/types";
import type { DeskSlot } from "../lib/layout";
import { DESK_UNIT } from "../lib/layout";
import { STATUS_META } from "../lib/status";
import { AgentAvatar, AvatarDefs } from "./AgentAvatar";
import { AgentTag } from "./AgentTag";

interface Props {
  agent: Agent;
  slot: DeskSlot;
  selected: boolean;
  spotlit: boolean;
  dimmed: boolean;
  onSelect: (id: string) => void;
}

const CODE_LINES = [
  { id: "a", w: 28, c: "#19f5a1" },
  { id: "b", w: 16, c: "#ffffff" },
  { id: "c", w: 34, c: "#ff2bd6" },
  { id: "d", w: 22, c: "#8b5cf6" },
  { id: "e", w: 12, c: "#ffffff" },
  { id: "f", w: 30, c: "#19f5a1" },
  { id: "g", w: 18, c: "#ffffff" },
  { id: "h", w: 26, c: "#ff2bd6" },
  { id: "i", w: 14, c: "#8b5cf6" },
  { id: "j", w: 32, c: "#ffffff" },
];

const SCREEN_SKEW = "translate(214 116) skewY(-11.3) translate(-214 -116)";

interface FurnitureProps {
  gid: string;
  statusColor: string;
}

/** Brushed-steel desk, angled monitor, keyboard and mug, drawn in the 300x300 desk box. */
function Furniture({ gid, statusColor }: FurnitureProps) {
  return (
    <g className="furniture">
      <defs>
        <linearGradient id={`${gid}-steel`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8a93a6" />
          <stop offset="0.35" stopColor="#b7bfcd" />
          <stop offset="1" stopColor="#6c7486" />
        </linearGradient>
        <linearGradient id={`${gid}-front`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3d4454" />
          <stop offset="1" stopColor="#242934" />
        </linearGradient>
        <pattern
          id={`${gid}-brush`}
          width="6"
          height="3"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-3)"
        >
          <rect width="6" height="1" fill="#fff" opacity={0.09} />
        </pattern>
        <linearGradient id={`${gid}-screen`} x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0"
            className="monitor-screen-stop"
            style={{ stopColor: statusColor }}
            stopOpacity={0.6}
          />
          <stop
            offset="1"
            className="monitor-screen-stop"
            style={{ stopColor: statusColor }}
            stopOpacity={0.12}
          />
        </linearGradient>
        <radialGradient id={`${gid}-screenGlow`}>
          <stop offset="0" stopColor={statusColor} stopOpacity={0.5} />
          <stop offset="1" stopColor={statusColor} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${gid}-kb`}>
          <stop offset="0" stopColor="#19f5a1" stopOpacity={0.7} />
          <stop offset="1" stopColor="#19f5a1" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${gid}-floor`}>
          <stop offset="0" stopColor={statusColor} stopOpacity={0.45} />
          <stop offset="1" stopColor={statusColor} stopOpacity={0} />
        </radialGradient>
        <clipPath id={`${gid}-clip`}>
          <polygon points="214,116 264,106 264,166 214,176" />
        </clipPath>
      </defs>

      <ellipse cx={150} cy={274} rx={125} ry={11} fill="#000" opacity={0.5} />
      <ellipse
        className="desk-floorglow"
        cx={150}
        cy={276}
        rx={130}
        ry={16}
        fill={`url(#${gid}-floor)`}
      />

      <rect x={44} y={232} width={7} height={40} fill="#2b3040" />
      <rect x={249} y={232} width={7} height={40} fill="#2b3040" />
      <rect x={44} y={232} width={2} height={40} fill="#4a5164" />
      <rect x={249} y={232} width={2} height={40} fill="#4a5164" />

      <polygon points="46,188 254,188 268,214 32,214" fill={`url(#${gid}-steel)`} />
      <polygon points="46,188 254,188 268,214 32,214" fill={`url(#${gid}-brush)`} />
      <line x1={46} y1={188} x2={254} y2={188} stroke="#d5dbe6" strokeWidth={1.2} opacity={0.8} />
      <rect x={32} y={214} width={236} height={18} fill={`url(#${gid}-front)`} />
      <line x1={32} y1={214.5} x2={268} y2={214.5} stroke="#5d6578" strokeWidth={1} />
      <line x1={32} y1={231.5} x2={268} y2={231.5} stroke="#171a22" strokeWidth={1} />

      <ellipse
        className="monitor-glow"
        cx={240}
        cy={142}
        rx={52}
        ry={46}
        fill={`url(#${gid}-screenGlow)`}
        opacity={0.6}
      />
      <polygon
        points="210,112 268,100 268,170 210,182"
        fill="#0b0b14"
        stroke="#2c2c3e"
        strokeWidth={1.5}
      />
      <polygon points="214,116 264,106 264,166 214,176" fill="#0f1020" />
      <polygon
        className="monitor-screen"
        points="214,116 264,106 264,166 214,176"
        fill={`url(#${gid}-screen)`}
      />
      <g clipPath={`url(#${gid}-clip)`}>
        <g transform={SCREEN_SKEW}>
          <g className="code-lines">
            <g className="code-scroll">
              {[0, 1].map((copy) =>
                CODE_LINES.map((line, i) => (
                  <rect
                    key={`${copy}-${line.id}`}
                    x={219 + (i % 3) * 4}
                    y={121 + (copy * CODE_LINES.length + i) * 7}
                    width={line.w}
                    height={2.5}
                    rx={1}
                    fill={line.c}
                    opacity={0.75}
                  />
                )),
              )}
            </g>
          </g>
          <g className="glitch">
            <rect x={210} y={126} width={60} height={4} fill="#ff4545" opacity={0.85} />
            <rect x={210} y={147} width={60} height={3} fill="#22d3ee" opacity={0.75} />
            <rect x={210} y={160} width={60} height={2} fill="#fff" opacity={0.6} />
          </g>
        </g>
      </g>
      <rect x={236} y={176} width={7} height={13} fill="#2a2f3b" />
      <ellipse cx={239.5} cy={191} rx={17} ry={4.5} fill="#353b49" />

      <ellipse className="kb-glow" cx={150} cy={200} rx={48} ry={10} fill={`url(#${gid}-kb)`} />
      <rect x={116} y={193} width={68} height={11} rx={3} fill="#15151f" stroke="#30304a" />
      <line x1={121} y1={196.5} x2={179} y2={196.5} stroke="#3a3a55" strokeWidth={1.2} />
      <line x1={121} y1={200.5} x2={179} y2={200.5} stroke="#3a3a55" strokeWidth={1.2} />

      <g className="mug">
        <path
          className="steam steam--1"
          d="M66 186c-3-4 3-6 0-10"
          stroke="#b7b3cf"
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
        />
        <path
          className="steam steam--2"
          d="M72 186c-3-4 3-6 0-10"
          stroke="#b7b3cf"
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
        />
        <rect x={60} y={190} width={17} height={15} rx={3} fill="#2e2e40" stroke="#4a4a66" />
        <path d="M77 194q8 0 8 5.5t-8 5.5" fill="none" stroke="#4a4a66" strokeWidth={2} />
      </g>
    </g>
  );
}

/** One desk: chair, agent, furniture, floating tag, and the status-change flash. */
export function Desk({ agent, slot, selected, spotlit, dimmed, onSelect }: Props) {
  const gid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const meta = STATUS_META[agent.status];
  const [flash, setFlash] = useState<{ color: string; key: string } | null>(null);
  const prevStatus = useRef(agent.status);

  useEffect(() => {
    if (prevStatus.current !== agent.status) {
      prevStatus.current = agent.status;
      setFlash({ color: STATUS_META[agent.status].color, key: agent.statusSince });
    }
  }, [agent.status, agent.statusSince]);

  const classes = [
    "desk",
    `desk--${agent.status}`,
    selected ? "desk--selected" : "",
    spotlit ? "desk--spotlit" : "",
    dimmed ? "desk--dimmed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const style = {
    left: slot.x - DESK_UNIT / 2,
    top: slot.y - DESK_UNIT,
    transform: `scale(${slot.scale})`,
    "--z": slot.z,
    "--accent": agent.color,
    "--status": meta.color,
  } as CSSProperties;

  return (
    <div className={classes} style={style} data-agent={agent.id}>
      {flash && (
        <div
          key={flash.key}
          className="desk-flash"
          style={{ "--flash": flash.color } as CSSProperties}
          onAnimationEnd={() => setFlash(null)}
        />
      )}
      <svg
        className="desk-art"
        viewBox="0 0 300 300"
        width={DESK_UNIT}
        height={DESK_UNIT}
        role="img"
        aria-label={`${agent.name}'s desk`}
      >
        <title>{`${agent.name}'s desk`}</title>
        <AvatarDefs gid={gid} color={agent.color} />
        <defs>
          <radialGradient id={`${gid}-pool`}>
            <stop offset="0" stopColor="#d9d0ff" stopOpacity={0.22} />
            <stop offset="0.6" stopColor="#b9a7ff" stopOpacity={0.08} />
            <stop offset="1" stopColor="#b9a7ff" stopOpacity={0} />
          </radialGradient>
        </defs>
        <ellipse
          className="desk-pool"
          cx={150}
          cy={278}
          rx={185}
          ry={34}
          fill={`url(#${gid}-pool)`}
        />
        <g className="chair">
          <path
            d="M105 216 98 112c-2-26 8-44 20-48l18 4c7-5 14-5 21 0l18-4c12 4 22 22 20 48l-7 104z"
            fill="#15151f"
            stroke="#2b2b3b"
            strokeWidth={2}
          />
          <path d="M118 80v130M182 80v130" stroke={agent.color} strokeWidth={1.5} opacity={0.3} />
          <path d="M126 70q24-12 48 0" fill="none" stroke="#2b2b3b" strokeWidth={2} />
        </g>
        <AgentAvatar agent={agent} gid={gid} part="body" />
        <Furniture gid={gid} statusColor={meta.color} />
        <AgentAvatar agent={agent} gid={gid} part="arms" />
      </svg>
      <AgentTag agent={agent} />
      <button
        type="button"
        className="desk-hit"
        onClick={() => onSelect(agent.id)}
        aria-label={`${agent.name}, ${agent.role}: ${meta.label}. ${agent.currentTask}`}
      />
    </div>
  );
}
