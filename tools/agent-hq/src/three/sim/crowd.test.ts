import { describe, expect, it } from "vitest";
import { createSeed } from "../../data/agents";
import type { Agent } from "../../data/types";
import { layoutPods } from "../layout";
import { CrowdSim, lineFor } from "./crowd";

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

function make(agents: Agent[], seed = 5): CrowdSim {
  return new CrowdSim(
    layoutPods(agents.length),
    agents.map((a) => a.id),
    seeded(seed),
  );
}

function run(sim: CrowdSim, seconds: number, from = 0, until?: () => boolean): number {
  let t = from;
  const dt = 1 / 60;
  while (t < from + seconds) {
    sim.step(dt, t);
    t += dt;
    if (until?.()) break;
  }
  return t;
}

describe("CrowdSim", () => {
  it("creates a brain per agent, keeps pose identity, and drops agents that leave", () => {
    const { agents } = createSeed(new Date("2026-11-03T10:00:00Z"));
    const sim = make(agents);
    sim.sync(agents);
    expect(sim.brains.size).toBe(agents.length);
    const poses = sim.poses;
    expect(poses.get("atlas")).toBe(sim.brains.get("atlas")?.pose);
    sim.sync(agents.filter((a) => a.id !== "nova"));
    expect(sim.brains.has("nova")).toBe(false);
    expect(sim.poses.has("nova")).toBe(false);
    expect(sim.poses.get("atlas")).toBe(poses.get("atlas"));
  });

  it("re-plans when a status changes and agents walk without overlapping", () => {
    const { agents } = createSeed(new Date("2026-11-03T10:00:00Z"));
    const sim = make(agents);
    sim.sync(agents);
    const changed = agents.map((a) => (a.id === "atlas" ? { ...a, status: "idle" as const } : a));
    sim.sync(changed);
    expect(sim.brains.get("atlas")?.mode).toBe("standing-up");
    let minGap = Number.POSITIVE_INFINITY;
    run(sim, 40, 0, () => {
      const list = [...sim.brains.values()];
      for (const a of list) {
        if (!a.moving) continue;
        for (const b of list) {
          if (a === b) continue;
          minGap = Math.min(minGap, Math.hypot(a.pose.x - b.pose.x, a.pose.z - b.pose.z));
        }
      }
      return sim.brains.get("atlas")?.mode === "sit-cafe";
    });
    expect(sim.brains.get("atlas")?.mode).toBe("sit-cafe");
    expect(minGap).toBeGreaterThan(0.35);
  });

  it("makes tablemates chat, nod and sometimes laugh", () => {
    const { agents } = createSeed(new Date("2026-11-03T10:00:00Z"));
    // Nova (done) and Ledger (idle) start in the cafeteria at the same table.
    const sim = make(agents);
    sim.sync(agents);
    const ledger = sim.brains.get("ledger");
    const nova = sim.brains.get("nova");
    expect(ledger?.mode).toBe("sit-cafe");
    expect(nova?.mode).toBe("sit-cafe");
    let spoke = 0;
    let nodded = false;
    run(sim, 30, 0, () => {
      if (ledger?.pose.bubble || nova?.pose.bubble) spoke += 1;
      if ((ledger?.pose.nod ?? 0) !== 0 || (nova?.pose.nod ?? 0) !== 0) nodded = true;
      return spoke > 60 && nodded;
    });
    expect(spoke).toBeGreaterThan(0);
    expect(nodded).toBe(true);
  });

  it("lists dashed-line pairs for agents waiting on other agents only", () => {
    const { agents } = createSeed(new Date("2026-11-03T10:00:00Z"));
    const sim = make(agents);
    sim.sync(agents);
    const pairs = sim.waitPairs();
    expect(pairs.map((p) => p.id)).toEqual(["echo->pixel"]);
    expect(pairs[0]?.from).toBe(sim.pose("echo"));
  });

  it("builds chatter lines from the latest activity", () => {
    const { agents } = createSeed(new Date("2026-11-03T10:00:00Z"));
    const nova = agents.find((a) => a.id === "nova");
    expect(nova).toBeDefined();
    if (!nova) return;
    expect(lineFor(nova, () => 0)).toBe("Just finished the competitor pricing teardown!");
    expect(lineFor(nova, () => 0.99)).toBe("🍩");
  });
});
