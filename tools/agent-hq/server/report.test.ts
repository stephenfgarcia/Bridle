import { describe, expect, it } from "vitest";
import type { AgentRow } from "../src/data/live/rows";
import { buildAgentUpdate, checkApiKey, parseReport, presentedKey } from "./report";

const row: AgentRow = {
  id: "byte",
  project_id: "q4",
  name: "Byte",
  role: "Developer",
  color: "#22d3ee",
  status: "working",
  current_task: "Landing page build",
  task_description: "",
  progress: 40,
  subtasks: [],
  waiting_on: null,
  blocked_reason: null,
  next_up: "",
  status_since: "2026-11-03T09:00:00.000Z",
  sort_order: 4,
};

describe("parseReport", () => {
  it("accepts the documented shape", () => {
    const r = parseReport({
      agentId: "byte",
      status: "waiting",
      currentTask: "Deploy",
      progress: 55.4,
      activity: "Byte pushed the deploy",
      waitingOn: "atlas",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.report.progress).toBe(55);
      expect(r.report.activity).toEqual([{ text: "Byte pushed the deploy" }]);
      expect(r.report.waitingOn).toBe("atlas");
    }
  });

  it("accepts activity arrays of strings and objects", () => {
    const r = parseReport({
      agentId: "byte",
      activity: ["one", { text: "two", kind: "done" }, "   "],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.report.activity).toEqual([{ text: "one" }, { text: "two", kind: "done" }]);
  });

  it("rejects bad input with every error listed", () => {
    const r = parseReport({ agentId: "bad id!", status: "sleeping", progress: 140, activity: [1] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.join("\n")).toMatch(/agentId/);
      expect(r.errors.join("\n")).toMatch(/status/);
      expect(r.errors.join("\n")).toMatch(/progress/);
      expect(r.errors.join("\n")).toMatch(/activity/);
    }
    expect(parseReport("nope").ok).toBe(false);
    expect(parseReport(null).ok).toBe(false);
  });
});

describe("checkApiKey", () => {
  it("matches only the exact key", () => {
    expect(checkApiKey("secret-123", "secret-123")).toBe(true);
    expect(checkApiKey("secret-124", "secret-123")).toBe(false);
    expect(checkApiKey("secret", "secret-123")).toBe(false);
    expect(checkApiKey(undefined, "secret-123")).toBe(false);
    expect(checkApiKey("", "")).toBe(false);
  });

  it("reads x-api-key or a bearer token", () => {
    expect(presentedKey({ "x-api-key": "k1" })).toBe("k1");
    expect(presentedKey({ authorization: "Bearer k2" })).toBe("k2");
    expect(presentedKey({ authorization: "Basic abc" })).toBeUndefined();
    expect(presentedKey({})).toBeUndefined();
  });
});

describe("buildAgentUpdate", () => {
  const now = new Date("2026-11-03T10:00:00.000Z");

  it("stamps status_since only when the status changes", () => {
    const same = buildAgentUpdate(row, { agentId: "byte", status: "working", activity: [] }, now);
    expect(same.statusChanged).toBe(false);
    expect(same.patch.status_since).toBeUndefined();
    const changed = buildAgentUpdate(row, { agentId: "byte", status: "done", activity: [] }, now);
    expect(changed.statusChanged).toBe(true);
    expect(changed.patch.status_since).toBe(now.toISOString());
    expect(changed.activity).toEqual([{ text: "Byte finished landing page build", kind: "done" }]);
  });

  it("clears waiting and blocked fields when leaving those statuses", () => {
    const blocked: AgentRow = { ...row, status: "blocked", blocked_reason: "Token missing" };
    const update = buildAgentUpdate(
      blocked,
      { agentId: "byte", status: "working", activity: [] },
      now,
    );
    expect(update.patch.blocked_reason).toBeNull();
    expect(update.patch.waiting_on).toBeNull();
    const waiting = buildAgentUpdate(
      row,
      { agentId: "byte", status: "waiting", waitingOn: "human", activity: [] },
      now,
    );
    expect(waiting.patch.waiting_on).toBe("human");
    expect(waiting.activity[0]?.text).toBe("Byte is waiting on you");
  });

  it("keeps reported activity instead of inventing one", () => {
    const update = buildAgentUpdate(
      row,
      { agentId: "byte", status: "blocked", activity: [{ text: "Byte hit a wall" }] },
      now,
    );
    expect(update.activity).toEqual([{ text: "Byte hit a wall" }]);
    expect(update.patch.progress).toBeUndefined();
  });
});
