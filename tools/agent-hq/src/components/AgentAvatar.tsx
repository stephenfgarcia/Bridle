import type { CSSProperties } from "react";
import type { Agent } from "../data/types";

export type AvatarPart = "all" | "body" | "arms";

interface Props {
  agent: Agent;
  /** Unique prefix for gradient ids; pass the same value to AvatarDefs. */
  gid: string;
  /** The desk draws the body behind the desk and the arms in front of it. */
  part?: AvatarPart;
}

const SPARKLE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

/**
 * A friendly robot drawn in the 300x300 desk box: head centred at (150, 95), hands on the
 * keyboard at y=196. Status effects live near the head. Rendered inside a parent <svg>.
 */
export function AgentAvatar({ agent, gid, part = "all" }: Props) {
  const { status, color } = agent;
  const showBody = part !== "arms";
  const showArms = part !== "body";
  const style = { "--accent": color } as CSSProperties;
  return (
    <g className={`robot robot--${status}`} style={style}>
      {showBody && (
        <g className="robot-upper">
          {status === "done" && (
            <ellipse
              className="done-halo"
              cx={150}
              cy={96}
              rx={60}
              ry={54}
              fill={`url(#${gid}-halo)`}
            />
          )}
          <rect x={108} y={136} width={84} height={84} rx={22} className="robot-torso" />
          <rect x={118} y={142} width={48} height={8} rx={4} fill="#fff" opacity={0.05} />
          <rect x={142} y={162} width={16} height={8} rx={3} fill={color} opacity={0.85} />
          <rect x={122} y={180} width={56} height={2} rx={1} fill="#3e3e58" />
          <rect x={141} y={120} width={18} height={18} rx={4} fill="#22222f" />
          <circle cx={106} cy={148} r={13} fill="#33334a" stroke="#46466a" strokeWidth={1.5} />
          <circle cx={194} cy={148} r={13} fill="#33334a" stroke="#46466a" strokeWidth={1.5} />
          <g className="robot-head">
            <line x1={150} y1={66} x2={150} y2={52} stroke="#46466a" strokeWidth={3} />
            <circle cx={150} cy={48} r={4.5} fill={color} className="robot-antenna" />
            <rect x={115} y={66} width={70} height={58} rx={18} className="robot-skull" />
            <rect x={122} y={71} width={30} height={9} rx={4.5} fill="#fff" opacity={0.06} />
            <rect x={107} y={86} width={8} height={20} rx={3} fill="#1a1a28" />
            <rect x={185} y={86} width={8} height={20} rx={3} fill="#1a1a28" />
            <ellipse
              cx={150}
              cy={94}
              rx={32}
              ry={16}
              fill={`url(#${gid}-visorGlow)`}
              opacity={0.7}
            />
            <rect
              x={125}
              y={83}
              width={50}
              height={22}
              rx={10}
              fill={color}
              className="robot-visor"
            />
            <g className="robot-eyes">
              <rect x={135} y={89} width={11} height={9} rx={3.5} fill="#fff" />
              <rect x={154} y={89} width={11} height={9} rx={3.5} fill="#fff" />
            </g>
          </g>
          {status === "thinking" && (
            <g className="fx fx-think">
              <circle cx={186} cy={72} r={3} fill="#a78bfa" opacity={0.8} />
              <circle cx={197} cy={60} r={5} fill="#a78bfa" opacity={0.85} />
              <ellipse
                cx={222}
                cy={42}
                rx={27}
                ry={17}
                fill="rgba(167,139,250,0.16)"
                stroke="#a78bfa"
                strokeWidth={1.5}
              />
              <circle className="fx-dot fx-dot--1" cx={211} cy={42} r={3.2} fill="#a78bfa" />
              <circle className="fx-dot fx-dot--2" cx={222} cy={42} r={3.2} fill="#a78bfa" />
              <circle className="fx-dot fx-dot--3" cx={233} cy={42} r={3.2} fill="#a78bfa" />
            </g>
          )}
          {status === "waiting" && (
            <g className="fx fx-wait">
              <g className="fx-hourglass">
                <path
                  d="M196 40h20v4l-7 9 7 9v4h-20v-4l7-9-7-9z"
                  fill="rgba(255,176,32,0.22)"
                  stroke="#ffb020"
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
                <path d="M201 45h10l-5 6z" fill="#ffb020" />
                <path d="M203 61h6l-3-4z" fill="#ffb020" />
              </g>
              {agent.waitingOn === "human" && (
                <g className="fx-human">
                  <circle cx={236} cy={44} r={5} fill="none" stroke="#ffb020" strokeWidth={2} />
                  <path
                    d="M227 62a9 9 0 0 1 18 0"
                    fill="none"
                    stroke="#ffb020"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                  <text
                    x={236}
                    y={75}
                    textAnchor="middle"
                    fontSize={9}
                    fontFamily="Inter, system-ui, sans-serif"
                    fontWeight={600}
                    fill="#ffb020"
                  >
                    you
                  </text>
                </g>
              )}
            </g>
          )}
          {status === "blocked" && (
            <g className="fx fx-warn">
              <path
                d="M206 36l17 30h-34z"
                fill="rgba(255,69,69,0.25)"
                stroke="#ff4545"
                strokeWidth={2}
                strokeLinejoin="round"
              />
              <rect x={204.5} y={46} width={3} height={10} rx={1.5} fill="#ff4545" />
              <circle cx={206} cy={60.5} r={1.8} fill="#ff4545" />
            </g>
          )}
          {status === "done" && (
            <g className="fx fx-done" key={agent.statusSince}>
              <g className="sparkles">
                {SPARKLE_ANGLES.map((deg) => {
                  const rad = (deg * Math.PI) / 180;
                  return (
                    <line
                      key={deg}
                      x1={208 + Math.cos(rad) * 19}
                      y1={50 + Math.sin(rad) * 19}
                      x2={208 + Math.cos(rad) * 29}
                      y2={50 + Math.sin(rad) * 29}
                      stroke="#19f5a1"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                    />
                  );
                })}
              </g>
              <g className="burst-check">
                <circle cx={208} cy={50} r={14} fill="#19f5a1" />
                <path
                  d="M201 50l5 5 10-11"
                  fill="none"
                  stroke="#07060f"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            </g>
          )}
        </g>
      )}
      {showArms && (
        <g className="robot-arms">
          <g className="arm arm--left">
            <path d="M104 150L90 185 126 196" className="arm-stroke" />
            <circle cx={128} cy={196} r={7} className="arm-hand" />
          </g>
          <g className="arm arm--right">
            <path d="M196 150L210 185 174 196" className="arm-stroke" />
            <circle cx={172} cy={196} r={7} className="arm-hand" />
          </g>
        </g>
      )}
    </g>
  );
}

/** Shared gradients the avatar references; include once per <svg> that draws an avatar. */
export function AvatarDefs({ gid, color }: { gid: string; color: string }) {
  return (
    <defs>
      <radialGradient id={`${gid}-visorGlow`}>
        <stop offset="0" stopColor={color} stopOpacity={0.9} />
        <stop offset="1" stopColor={color} stopOpacity={0} />
      </radialGradient>
      <radialGradient id={`${gid}-halo`}>
        <stop offset="0" stopColor="#f4f2ff" stopOpacity={0.35} />
        <stop offset="1" stopColor="#f4f2ff" stopOpacity={0} />
      </radialGradient>
    </defs>
  );
}
