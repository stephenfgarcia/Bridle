/** The data contract between the data layer (`useAgents`) and the UI. */

export type AgentStatus = "working" | "thinking" | "waiting" | "blocked" | "idle" | "done";

export const AGENT_STATUSES: readonly AgentStatus[] = [
  "working",
  "thinking",
  "waiting",
  "blocked",
  "idle",
  "done",
];

export interface Subtask {
  label: string;
  done: boolean;
}

export type ActivityKind = "done" | "start" | "status" | "note";

export interface ActivityEntry {
  /** ISO timestamp. */
  time: string;
  text: string;
  /** Optional classification; "done" entries feed the tasks-completed chart. */
  kind?: ActivityKind;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  /** Accent colour (visor, tag border, feed dot). */
  color: string;
  status: AgentStatus;
  currentTask: string;
  taskDescription: string;
  /** 0..100 */
  progress: number;
  subtasks: Subtask[];
  /** Agent id, or "human" when waiting on the person running the office. */
  waitingOn?: string;
  blockedReason?: string;
  nextUp: string;
  /** ISO timestamp of the last status change. */
  statusSince: string;
  /** Newest last. */
  activity: ActivityEntry[];
}

export type MilestoneStatus = "done" | "in-progress" | "upcoming";

export interface Milestone {
  name: string;
  status: MilestoneStatus;
  /** ISO date. */
  due: string;
}

export interface Project {
  name: string;
  /** ISO date. */
  deadline: string;
  milestones: Milestone[];
}

/** One consistent picture of the whole office. */
export interface HqSnapshot {
  project: Project;
  agents: Agent[];
}
