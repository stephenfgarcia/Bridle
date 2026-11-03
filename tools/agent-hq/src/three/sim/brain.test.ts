import { describe, expect, it } from "vitest";
import { layoutPods } from "../layout";
import { AgentBrain } from "./brain";
import { OfficeWorld } from "./world";

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

const ids = ["a", "b", "c", "d"];

function makeWorld() {
  return new OfficeWorld(layoutPods(ids.length), ids, seeded(3));
}

/** Advance the simulation in 1/60 s steps until `done` or the time runs out. */
function run(brain: AgentBrain, world: OfficeWorld, seconds: number, done?: () => boolean): number {
  let t = 0;
  const dt = 1 / 60;
  while (t < seconds) {
    brain.update(dt, world, t);
    t += dt;
    if (done?.()) return t;
  }
  return t;
}

describe("AgentBrain", () => {
  it("places everyone where their status says on first load, without walking", () => {
    const world = makeWorld();
    const working = new AgentBrain("a", 0, "working", world);
    const blocked = new AgentBrain("b", 1, "blocked", world);
    const waiting = new AgentBrain("c", 2, "waiting", world);
    const idle = new AgentBrain("d", 3, "idle", world);
    expect(working.mode).toBe("sit-desk");
    expect(working.pose.seated).toBe(1);
    expect(working.pose).toMatchObject({
      x: world.desk("a")?.chair.pos[0],
      z: world.desk("a")?.chair.pos[1],
    });
    expect(blocked.mode).toBe("stand-desk");
    expect(waiting.mode).toBe("stand");
    expect(idle.mode).toBe("sit-cafe");
    expect(idle.pose.carrying).not.toBeNull();
    expect(world.seatOf("d")).not.toBeNull();
  });

  it("stands up, walks to the cafeteria, queues, picks up a snack and sits with company", () => {
    const world = makeWorld();
    const host = new AgentBrain("d", 3, "idle", world);
    const brain = new AgentBrain("a", 0, "working", world);
    brain.setStatus("idle", world, 0);
    expect(brain.mode).toBe("standing-up");
    run(brain, world, 1.5, () => brain.mode === "queue");
    expect(brain.mode).toBe("queue");
    expect(brain.pose.seated).toBe(0);
    const reached = run(brain, world, 40, () => brain.mode === "pickup");
    expect(reached).toBeLessThan(40);
    const counter = world.queueSpot(0).pos;
    expect(Math.hypot(brain.pose.x - counter[0], brain.pose.z - counter[1])).toBeLessThan(0.2);
    run(brain, world, 40, () => brain.mode === "sit-cafe");
    expect(brain.mode).toBe("sit-cafe");
    expect(brain.pose.carrying).not.toBeNull();
    expect(brain.pose.seated).toBe(1);
    const mine = world.seatOf("a");
    const theirs = world.seatOf("d");
    expect(mine).not.toBeNull();
    expect(mine).not.toBe(theirs);
    // Prefers the table that already has company.
    const seatA = world.seats[mine ?? 0];
    const seatD = world.seats[theirs ?? 0];
    expect(seatA?.table).toEqual(seatD?.table);
    expect(host.mode).toBe("sit-cafe");
  });

  it("walks back to its desk with an On it! bubble, turns and sits down to type", () => {
    const world = makeWorld();
    const brain = new AgentBrain("a", 0, "idle", world);
    brain.setStatus("working", world, 0);
    run(brain, world, 1.2, () => brain.mode === "walk");
    expect(brain.pose.bubble?.text).toBe("On it!");
    expect(world.seatOf("a")).toBeNull();
    expect(brain.pose.carrying).toBeNull();
    const t = run(brain, world, 60, () => brain.mode === "sit-desk");
    expect(t).toBeLessThan(60);
    const chair = world.desk("a")?.chair;
    expect(
      chair && Math.hypot(brain.pose.x - chair.pos[0], brain.pose.z - chair.pos[1]),
    ).toBeLessThan(0.05);
    run(brain, world, 1);
    expect(Math.abs(brain.pose.heading)).toBeLessThan(0.05);
    expect(brain.pose.arms).toBe("type");
  });

  it("blocked stands up at the desk with a hand on its head; done celebrates then leaves", () => {
    const world = makeWorld();
    const brain = new AgentBrain("a", 0, "working", world);
    brain.setStatus("blocked", world, 0);
    run(
      brain,
      world,
      30,
      () => brain.mode === "stand" && brain.pose.speed === 0 && brain.destination === null,
    );
    run(brain, world, 0.5);
    const stand = world.desk("a")?.stand;
    expect(
      stand && Math.hypot(brain.pose.x - stand.pos[0], brain.pose.z - stand.pos[1]),
    ).toBeLessThan(0.2);
    expect(brain.pose.arms).toBe("headhand");
    brain.setStatus("done", world, 10);
    expect(brain.mode).toBe("celebrate");
    expect(brain.pose.bubble?.text).toBe("✓ Done!");
    let maxBob = 0;
    run(brain, world, 3, () => {
      maxBob = Math.max(maxBob, brain.pose.bob);
      return brain.mode === "queue";
    });
    expect(maxBob).toBeGreaterThan(0.1);
    expect(brain.mode).toBe("queue");
  });

  it("waiting strolls between spots and pauses", () => {
    const world = makeWorld();
    const brain = new AgentBrain("a", 0, "working", world);
    brain.setStatus("waiting", world, 0);
    const visited = new Set<string>();
    run(brain, world, 90, () => {
      if (brain.mode === "stand" && brain.pose.speed === 0) {
        visited.add(`${brain.pose.x.toFixed(1)},${brain.pose.z.toFixed(1)}`);
      }
      return visited.size >= 2;
    });
    expect(visited.size).toBeGreaterThanOrEqual(2);
    expect(brain.pose.seated).toBe(0);
  });

  it("never walks through blocked cells", () => {
    const world = makeWorld();
    const brain = new AgentBrain("b", 1, "idle", world);
    brain.setStatus("working", world, 0);
    let violations = 0;
    let samples = 0;
    run(brain, world, 60, () => {
      if (brain.mode === "walk") {
        samples += 1;
        const c = Math.floor((brain.pose.x - world.grid.minX) / world.grid.cell);
        const r = Math.floor((brain.pose.z - world.grid.minZ) / world.grid.cell);
        if (world.grid.blocked[r * world.grid.cols + c] === 1) violations += 1;
      }
      return brain.mode === "sit-desk";
    });
    expect(samples).toBeGreaterThan(30);
    expect(violations / samples).toBeLessThan(0.03);
  });
});
