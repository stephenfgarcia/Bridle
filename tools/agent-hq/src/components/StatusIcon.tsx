import type { AgentStatus } from "../data/types";
import { STATUS_META } from "../lib/status";

interface Props {
  status: AgentStatus;
  size?: number;
}

/** A distinct glyph per status, so status never relies on colour alone. */
export function StatusIcon({ status, size = 14 }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    role: "img" as const,
    "aria-label": STATUS_META[status].label,
  };
  switch (status) {
    case "working":
      return (
        <svg {...common}>
          <title>Working</title>
          <path d="M6 4 2.5 8 6 12M10 4l3.5 4L10 12" />
        </svg>
      );
    case "thinking":
      return (
        <svg {...common}>
          <title>Thinking</title>
          <path d="M8 2.5a5.5 5.5 0 0 1 0 11H4.5L2.5 15v-3.2A5.5 5.5 0 0 1 8 2.5Z" />
          <circle cx={5.5} cy={8} r={0.5} fill="currentColor" />
          <circle cx={8} cy={8} r={0.5} fill="currentColor" />
          <circle cx={10.5} cy={8} r={0.5} fill="currentColor" />
        </svg>
      );
    case "waiting":
      return (
        <svg {...common}>
          <title>Waiting</title>
          <path d="M4 2h8M4 14h8M5 2v2.5L8 8l3-3.5V2M5 14v-2.5L8 8l3 3.5V14" />
        </svg>
      );
    case "blocked":
      return (
        <svg {...common}>
          <title>Blocked</title>
          <path d="M8 2.5 14 13H2L8 2.5Z" />
          <path d="M8 6.5v3M8 11.5v.2" />
        </svg>
      );
    case "idle":
      return (
        <svg {...common}>
          <title>Idle</title>
          <path d="M3 6h8v4.5A2.5 2.5 0 0 1 8.5 13h-3A2.5 2.5 0 0 1 3 10.5V6Z" />
          <path d="M11 7.5h1a1.5 1.5 0 0 1 0 3h-1M5.5 2.5v1.5M8.5 2.5v1.5" />
        </svg>
      );
    case "done":
      return (
        <svg {...common}>
          <title>Done</title>
          <circle cx={8} cy={8} r={6} />
          <path d="m5 8 2 2 4-4" />
        </svg>
      );
  }
}
