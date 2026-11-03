/** Database rows (snake_case) and their mapping to the app's types (camelCase). */
import type {
  ActivityEntry,
  ActivityKind,
  Agent,
  AgentStatus,
  Milestone,
  Project,
  Subtask,
} from "../types";

export interface ProjectRow {
  id: string;
  name: string;
  deadline: string;
  milestones: Milestone[];
  created_at?: string;
}

export interface AgentRow {
  id: string;
  project_id: string;
  name: string;
  role: string;
  color: string;
  status: AgentStatus;
  current_task: string;
  task_description: string;
  progress: number;
  subtasks: Subtask[];
  waiting_on: string | null;
  blocked_reason: string | null;
  next_up: string;
  status_since: string;
  sort_order: number;
  updated_at?: string;
}

export interface ActivityRow {
  id: number;
  agent_id: string;
  time: string;
  text: string;
  kind: ActivityKind | null;
}

export function projectFromRow(row: ProjectRow): Project {
  return {
    name: row.name,
    deadline: row.deadline.slice(0, 10),
    milestones: Array.isArray(row.milestones) ? row.milestones : [],
  };
}

export function activityFromRow(row: ActivityRow): ActivityEntry {
  return { time: row.time, text: row.text, kind: row.kind ?? undefined };
}

export function agentFromRow(row: AgentRow, activity: ActivityEntry[]): Agent {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    color: row.color,
    status: row.status,
    currentTask: row.current_task,
    taskDescription: row.task_description,
    progress: row.progress,
    subtasks: Array.isArray(row.subtasks) ? row.subtasks : [],
    waitingOn: row.waiting_on ?? undefined,
    blockedReason: row.blocked_reason ?? undefined,
    nextUp: row.next_up,
    statusSince: row.status_since,
    activity,
  };
}

/** The inverse mapping, used by the seed script. */
export function rowFromAgent(agent: Agent, projectId: string, sortOrder: number): AgentRow {
  return {
    id: agent.id,
    project_id: projectId,
    name: agent.name,
    role: agent.role,
    color: agent.color,
    status: agent.status,
    current_task: agent.currentTask,
    task_description: agent.taskDescription,
    progress: agent.progress,
    subtasks: agent.subtasks,
    waiting_on: agent.waitingOn ?? null,
    blocked_reason: agent.blockedReason ?? null,
    next_up: agent.nextUp,
    status_since: agent.statusSince,
    sort_order: sortOrder,
  };
}
