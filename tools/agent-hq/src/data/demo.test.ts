import { describe, expect, it } from "vitest";
import { createSeed } from "./agents";
import { demoIntervalMs, demoStep, demoSwitch, demoSwitchIntervalMs } from "./demo";
import { AGENT_STATUSES, type HqSnapshot } from "./types";

/** Small deterministic PRNG (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function run(seed: number, steps: number): HqSnapshot {
  const rng = seeded(seed);
  let snap = createSeed(new Date("2026-11-03T10:00:00Z"));
  for (let i = 0; i < steps; i += 1) {
    snap = demoStep(snap, rng, new Date(Date.UTC(2026, 10, 3, 10, 0, i * 5)));
  }
  return snap;
}

describe("seed", () => {
  it("has the sample project and eight agents in mixed statuses", () => {
    const snap = createSeed(new Date());
    expect(snap.project.name).toBe("Q4 Launch Campaign");
    expect(snap.project.milestones).toHaveLength(5);
    expect(snap.agents.map((a) => a.name)).toEqual([
      "Atlas",
      "Nova",
      "Quill",
      "Pixel",
      "Byte",
      "Echo",
      "Sentinel",
      "Ledger",
    ]);
    const statuses = new Set(snap.agents.map((a) => a.status));
    expect(statuses.size).toBeGreaterThanOrEqual(5);
  });
});

describe("demoStep", () => {
  it("keeps every invariant over many ticks", () => {
    for (const seed of [1, 7, 42, 1234]) {
      const snap = run(seed, 300);
      const ids = new Set(snap.agents.map((a) => a.id));
      for (const a of snap.agents) {
        expect(AGENT_STATUSES).toContain(a.status);
        expect(a.progress).toBeGreaterThanOrEqual(0);
        expect(a.progress).toBeLessThanOrEqual(100);
        if (a.status === "done") expect(a.progress).toBe(100);
        if (a.status === "waiting")
          expect(a.waitingOn === "human" || ids.has(a.waitingOn ?? "")).toBe(true);
        if (a.status === "blocked") expect(a.blockedReason).toBeTruthy();
        if (a.status !== "waiting") expect(a.waitingOn).toBeUndefined();
        if (a.status !== "blocked") expect(a.blockedReason).toBeUndefined();
        expect(a.activity.length).toBeLessThanOrEqual(40);
        const doneCount = a.subtasks.filter((s) => s.done).length;
        expect(doneCount).toBeLessThanOrEqual(a.subtasks.length);
        if (a.progress === 100 && a.subtasks.length > 0) expect(doneCount).toBe(a.subtasks.length);
      }
    }
  });

  it("changes something and logs activity as it goes", () => {
    const before = createSeed(new Date("2026-11-03T10:00:00Z"));
    const after = run(3, 40);
    const beforeActivity = before.agents.reduce((n, a) => n + a.activity.length, 0);
    const afterActivity = after.agents.reduce((n, a) => n + a.activity.length, 0);
    expect(afterActivity).toBeGreaterThan(beforeActivity);
    const progressBefore = before.agents.reduce((n, a) => n + a.progress, 0);
    const progressAfter = after.agents.reduce((n, a) => n + a.progress, 0);
    expect(progressAfter).not.toBe(progressBefore);
  });

  it("does not mutate the previous snapshot", () => {
    const rng = seeded(9);
    const snap = createSeed(new Date("2026-11-03T10:00:00Z"));
    const frozen = JSON.stringify(snap);
    demoStep(snap, rng, new Date());
    expect(JSON.stringify(snap)).toBe(frozen);
  });

  it("demoSwitch always changes exactly one agent between work and rest", () => {
    const rng = seeded(11);
    let snap = createSeed(new Date("2026-11-03T10:00:00Z"));
    for (let i = 0; i < 60; i += 1) {
      const next = demoSwitch(snap, rng, new Date(Date.UTC(2026, 10, 3, 10, i)));
      const changed = next.agents.filter((a, k) => a.status !== snap.agents[k]?.status);
      expect(changed).toHaveLength(1);
      const was = snap.agents.find((a) => a.id === changed[0]?.id)?.status;
      const isWork = (s: string | undefined) => s === "working" || s === "thinking";
      expect(isWork(was)).not.toBe(isWork(changed[0]?.status));
      snap = next;
    }
    expect(demoSwitchIntervalMs(() => 0)).toBe(10_000);
    expect(demoSwitchIntervalMs(() => 0.999)).toBeLessThan(15_000);
  });

  it("waits four to six seconds between ticks", () => {
    expect(demoIntervalMs(() => 0)).toBe(4000);
    expect(demoIntervalMs(() => 0.999)).toBeLessThan(6000);
  });
});
