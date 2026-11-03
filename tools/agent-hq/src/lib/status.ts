import type { AgentStatus } from "../data/types";

export interface StatusMeta {
  label: string;
  color: string;
  /** Short verb phrase for the drawer ("working for 12m"). */
  verb: string;
}

export const STATUS_META: Record<AgentStatus, StatusMeta> = {
  working: { label: "Working", color: "#19F5A1", verb: "working" },
  thinking: { label: "Thinking", color: "#A78BFA", verb: "thinking" },
  waiting: { label: "Waiting", color: "#FFB020", verb: "waiting" },
  blocked: { label: "Blocked", color: "#FF4545", verb: "blocked" },
  idle: { label: "Idle", color: "#64748B", verb: "idle" },
  done: { label: "Done", color: "#F4F2FF", verb: "done" },
};

export const STATUS_ORDER: readonly AgentStatus[] = [
  "working",
  "thinking",
  "waiting",
  "blocked",
  "idle",
  "done",
];
