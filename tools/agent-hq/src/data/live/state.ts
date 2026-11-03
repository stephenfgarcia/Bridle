/**
 * Pure state for the live source: the rows we know about, plus reducers for realtime events.
 * Kept free of Supabase so it can be unit tested.
 */
import type { ActivityEntry, HqSnapshot } from "../types";
import {
  type ActivityRow,
  type AgentRow,
  activityFromRow,
  agentFromRow,
  type ProjectRow,
  projectFromRow,
} from "./rows";

export const MAX_LIVE_ACTIVITY = 40;

export type ChangeEvent = "INSERT" | "UPDATE" | "DELETE";

export interface LiveState {
  project: ProjectRow | null;
  agents: Map<string, AgentRow>;
  /** Per agent, oldest first, capped at MAX_LIVE_ACTIVITY. */
  activity: Map<string, ActivityEntry[]>;
}

export function emptyState(): LiveState {
  return { project: null, agents: new Map(), activity: new Map() };
}

function byTime(a: ActivityEntry, b: ActivityEntry): number {
  return a.time < b.time ? -1 : a.time > b.time ? 1 : 0;
}

export function buildState(
  project: ProjectRow | null,
  agents: AgentRow[],
  activity: ActivityRow[],
): LiveState {
  const state = emptyState();
  state.project = project;
  for (const row of agents) state.agents.set(row.id, row);
  for (const row of activity) {
    const list = state.activity.get(row.agent_id) ?? [];
    list.push(activityFromRow(row));
    state.activity.set(row.agent_id, list);
  }
  for (const [id, list] of state.activity) {
    list.sort(byTime);
    state.activity.set(id, list.slice(-MAX_LIVE_ACTIVITY));
  }
  return state;
}

export function applyAgentEvent(
  state: LiveState,
  event: ChangeEvent,
  row: Partial<AgentRow>,
): LiveState {
  if (!row.id) return state;
  const agents = new Map(state.agents);
  const activity = new Map(state.activity);
  if (event === "DELETE") {
    agents.delete(row.id);
    activity.delete(row.id);
  } else {
    const current = agents.get(row.id);
    agents.set(row.id, { ...(current ?? {}), ...row } as AgentRow);
  }
  return { ...state, agents, activity };
}

export function applyActivityInsert(state: LiveState, row: ActivityRow): LiveState {
  const activity = new Map(state.activity);
  const list = [...(activity.get(row.agent_id) ?? []), activityFromRow(row)]
    .sort(byTime)
    .slice(-MAX_LIVE_ACTIVITY);
  activity.set(row.agent_id, list);
  return { ...state, activity };
}

export function applyProjectEvent(
  state: LiveState,
  event: ChangeEvent,
  row: Partial<ProjectRow>,
): LiveState {
  if (!row.id) return state;
  if (event === "DELETE") {
    return state.project?.id === row.id ? { ...state, project: null } : state;
  }
  if (state.project && state.project.id !== row.id) return state;
  return { ...state, project: { ...(state.project ?? {}), ...row } as ProjectRow };
}

/** The app-facing snapshot, or null until a project row is known. */
export function toSnapshot(state: LiveState): HqSnapshot | null {
  if (!state.project) return null;
  const rows = [...state.agents.values()]
    .filter((row) => row.project_id === state.project?.id)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  return {
    project: projectFromRow(state.project),
    agents: rows.map((row) => agentFromRow(row, state.activity.get(row.id) ?? [])),
  };
}
