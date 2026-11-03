import { describe, expect, it } from "vitest";
import type { ActivityRow, AgentRow, ProjectRow } from "./rows";
import {
  applyActivityInsert,
  applyAgentEvent,
  applyProjectEvent,
  buildState,
  MAX_LIVE_ACTIVITY,
  toSnapshot,
} from "./state";

const project: ProjectRow = {
  id: "q4",
  name: "Q4 Launch Campaign",
  deadline: "2026-12-10",
  milestones: [{ name: "Research", status: "done", due: "2026-10-17" }],
};

const agent = (id: string, sort: number, extra: Partial<AgentRow> = {}): AgentRow => ({
  id,
  project_id: "q4",
  name: id.toUpperCase(),
  role: "Tester",
  color: "#fff",
  status: "working",
  current_task: "Task",
  task_description: "",
  progress: 10,
  subtasks: [],
  waiting_on: null,
  blocked_reason: null,
  next_up: "",
  status_since: "2026-11-03T10:00:00.000Z",
  sort_order: sort,
  ...extra,
});

const activity = (id: number, agentId: string, minute: number): ActivityRow => ({
  id,
  agent_id: agentId,
  time: `2026-11-03T10:${minute.toString().padStart(2, "0")}:00.000Z`,
  text: `entry ${id}`,
  kind: "note",
});

describe("live state", () => {
  it("builds a snapshot with agents in sort order and activity oldest first", () => {
    const state = buildState(
      project,
      [agent("b", 2), agent("a", 1)],
      [activity(2, "a", 5), activity(1, "a", 1)],
    );
    const snap = toSnapshot(state);
    expect(snap?.project.name).toBe("Q4 Launch Campaign");
    expect(snap?.agents.map((a) => a.id)).toEqual(["a", "b"]);
    expect(snap?.agents[0]?.activity.map((e) => e.text)).toEqual(["entry 1", "entry 2"]);
  });

  it("applies agent inserts, partial updates and deletes", () => {
    let state = buildState(project, [agent("a", 1)], []);
    state = applyAgentEvent(state, "INSERT", agent("b", 2));
    state = applyAgentEvent(state, "UPDATE", { id: "a", status: "done", progress: 100 });
    let snap = toSnapshot(state);
    expect(snap?.agents.map((a) => a.id)).toEqual(["a", "b"]);
    expect(snap?.agents[0]?.status).toBe("done");
    expect(snap?.agents[0]?.progress).toBe(100);
    expect(snap?.agents[0]?.name).toBe("A");
    state = applyAgentEvent(state, "DELETE", { id: "b" });
    snap = toSnapshot(state);
    expect(snap?.agents.map((a) => a.id)).toEqual(["a"]);
  });

  it("appends activity and caps it", () => {
    let state = buildState(project, [agent("a", 1)], []);
    for (let i = 1; i <= MAX_LIVE_ACTIVITY + 5; i += 1) {
      state = applyActivityInsert(state, activity(i, "a", i % 60));
    }
    const list = toSnapshot(state)?.agents[0]?.activity ?? [];
    expect(list).toHaveLength(MAX_LIVE_ACTIVITY);
    expect((list[list.length - 1]?.time ?? "") >= (list[0]?.time ?? "")).toBe(true);
  });

  it("ignores agents of other projects and tracks project updates", () => {
    let state = buildState(project, [agent("a", 1), agent("x", 0, { project_id: "other" })], []);
    expect(toSnapshot(state)?.agents.map((a) => a.id)).toEqual(["a"]);
    state = applyProjectEvent(state, "UPDATE", { id: "q4", name: "Renamed" });
    expect(toSnapshot(state)?.project.name).toBe("Renamed");
    state = applyProjectEvent(state, "UPDATE", { id: "other", name: "Nope" });
    expect(toSnapshot(state)?.project.name).toBe("Renamed");
    state = applyProjectEvent(state, "DELETE", { id: "q4" });
    expect(toSnapshot(state)).toBeNull();
  });

  it("does not mutate the previous state", () => {
    const state = buildState(project, [agent("a", 1)], [activity(1, "a", 1)]);
    const before = JSON.stringify(toSnapshot(state));
    applyAgentEvent(state, "UPDATE", { id: "a", progress: 99 });
    applyActivityInsert(state, activity(2, "a", 2));
    expect(JSON.stringify(toSnapshot(state))).toBe(before);
  });
});
