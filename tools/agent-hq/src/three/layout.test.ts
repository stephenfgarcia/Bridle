import { describe, expect, it } from "vitest";
import {
  CAFE,
  CAFE_SEATS,
  cameraForAgent,
  layoutPods,
  placeAgents,
  ROOM,
  WAITING_SPOTS,
} from "./layout";

const dist = (a: readonly number[], b: readonly number[]) =>
  Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[2] ?? 0) - (b[2] ?? 0));

describe("layoutPods", () => {
  it("fits 1 to 24 pods inside the work floor without overlap", () => {
    for (let n = 1; n <= 24; n += 1) {
      const pods = layoutPods(n);
      expect(pods).toHaveLength(n);
      for (const p of pods) {
        expect(p.position[0]).toBeGreaterThan(ROOM.minX + 1.5);
        expect(p.position[0]).toBeLessThan(CAFE.minX - 1.5);
        expect(p.position[2]).toBeGreaterThan(-9.5);
        expect(p.position[2]).toBeLessThan(ROOM.maxZ - 1.5);
      }
      for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
          const a = pods[i];
          const b = pods[j];
          expect(a && b && dist(a.position, b.position)).toBeGreaterThanOrEqual(3.6);
        }
      }
    }
  });

  it("centres small teams and fills clusters of four", () => {
    const four = layoutPods(4);
    expect(new Set(four.map((p) => p.cluster)).size).toBe(1);
    const xs = four.map((p) => p.position[0]);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(-3.3, 5);
    const eight = layoutPods(8);
    expect(new Set(eight.map((p) => p.cluster)).size).toBe(2);
    expect(layoutPods(0)).toEqual([]);
    expect(layoutPods(36)).toHaveLength(36);
  });
});

describe("placeAgents", () => {
  const pods = layoutPods(8);
  const agents = [
    { id: "a", status: "working" as const },
    { id: "b", status: "done" as const },
    { id: "c", status: "working" as const },
    { id: "d", status: "thinking" as const },
    { id: "e", status: "blocked" as const },
    { id: "f", status: "waiting" as const },
    { id: "g", status: "waiting" as const },
    { id: "h", status: "idle" as const },
  ];

  it("seats workers at their pods, parks waiters and sends idle agents to the cafeteria", () => {
    const places = placeAgents(agents, pods);
    expect(places.size).toBe(8);
    expect(places.get("a")?.zone).toBe("work");
    expect(places.get("a")?.seated).toBe(true);
    expect(places.get("d")?.seated).toBe(true);
    expect(places.get("e")?.seated).toBe(false);
    expect(places.get("e")?.zone).toBe("work");
    expect(places.get("f")?.zone).toBe("waiting");
    expect(places.get("g")?.zone).toBe("waiting");
    expect(dist(places.get("f")?.position ?? [], places.get("g")?.position ?? [])).toBeGreaterThan(
      0.8,
    );
    expect(places.get("h")?.zone).toBe("cafeteria");
    expect(places.get("h")?.item).toBe("mug");
    expect(places.get("b")?.item).toBe("donut");
    expect(places.get("b")?.position[0]).toBeGreaterThan(CAFE.minX);
  });

  it("keeps an agent's spot when another agent changes status", () => {
    const before = placeAgents(agents, pods);
    const after = placeAgents(
      agents.map((a) => (a.id === "f" ? { ...a, status: "working" as const } : a)),
      pods,
    );
    expect(after.get("g")?.position).toEqual(before.get("g")?.position);
    expect(after.get("h")?.position).toEqual(before.get("h")?.position);
  });

  it("has distinct waiting spots and seats inside the room", () => {
    for (const s of [...WAITING_SPOTS, ...CAFE_SEATS]) {
      expect(s.position[0]).toBeGreaterThan(ROOM.minX);
      expect(s.position[0]).toBeLessThan(ROOM.maxX);
      expect(s.position[2]).toBeGreaterThan(ROOM.minZ);
      expect(s.position[2]).toBeLessThan(ROOM.maxZ);
    }
    expect(new Set(CAFE_SEATS.map((s) => s.position.join(","))).size).toBe(CAFE_SEATS.length);
  });

  it("puts the agent camera in front of the robot, above the floor", () => {
    const cam = cameraForAgent({
      position: [2, 0, 3],
      rotationY: 0,
      seated: true,
      zone: "work",
    });
    expect(cam.position[2]).toBeGreaterThan(3);
    expect(cam.position[1]).toBeGreaterThan(1);
    expect(cam.target).toEqual([2, 1.2, 3]);
  });
});
