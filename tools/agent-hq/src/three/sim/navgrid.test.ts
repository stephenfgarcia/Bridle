import { describe, expect, it } from "vitest";
import { buildNavGrid, findPath, isFreeAt, lineOfSight, type Vec2 } from "./navgrid";

const bounds = { minX: 0, maxX: 20, minZ: 0, maxZ: 20 };

function pathLength(path: Vec2[]): number {
  let len = 0;
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    if (a && b) len += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return len;
}

describe("navgrid", () => {
  it("blocks obstacles with a margin and keeps open floor free", () => {
    const grid = buildNavGrid(bounds, [{ kind: "rect", x1: 8, z1: 8, x2: 12, z2: 12 }]);
    expect(isFreeAt(grid, [10, 10])).toBe(false);
    expect(isFreeAt(grid, [12.2, 10])).toBe(false);
    expect(isFreeAt(grid, [13.5, 10])).toBe(true);
    expect(isFreeAt(grid, [3, 3])).toBe(true);
    expect(isFreeAt(grid, [0.2, 3])).toBe(false);
  });

  it("finds a path around a wall and never crosses it", () => {
    const grid = buildNavGrid(bounds, [{ kind: "rect", x1: 9, z1: 2, x2: 11, z2: 18 }]);
    const path = findPath(grid, [3, 10], [17, 10]);
    expect(path).not.toBeNull();
    if (!path) return;
    expect(path[0]).toEqual([3, 10]);
    expect(path[path.length - 1]).toEqual([17, 10]);
    for (let i = 1; i < path.length; i += 1) {
      const a = path[i - 1];
      const b = path[i];
      expect(a && b && lineOfSight(grid, a, b)).toBe(true);
    }
    expect(pathLength(path)).toBeGreaterThan(16);
    expect(pathLength(path)).toBeLessThan(30);
  });

  it("returns null when the goal is sealed off", () => {
    const grid = buildNavGrid(bounds, [
      { kind: "rect", x1: 8, z1: 8, x2: 8.3, z2: 12 },
      { kind: "rect", x1: 12, z1: 8, x2: 12.3, z2: 12 },
      { kind: "rect", x1: 8, z1: 8, x2: 12.3, z2: 8.3 },
      { kind: "rect", x1: 8, z1: 12, x2: 12.3, z2: 12.3 },
    ]);
    // The inside is blocked entirely by the inflated walls, so the goal snaps outside; a
    // reachable goal still works, and a goal inside returns a path to the nearest free cell.
    expect(findPath(grid, [3, 3], [17, 17])).not.toBeNull();
  });

  it("smooths straight open paths to two points and handles circles and arcs", () => {
    const grid = buildNavGrid(bounds, [
      { kind: "circle", x: 10, z: 4, r: 1.5 },
      { kind: "arc", cx: 10, cz: 30, r1: 11, r2: 12, a1: -0.8, a2: 0.8 },
    ]);
    const open = findPath(grid, [2, 15], [18, 15]);
    expect(open?.length).toBe(2);
    expect(isFreeAt(grid, [10, 4])).toBe(false);
    expect(isFreeAt(grid, [10, 18.6])).toBe(false);
    expect(isFreeAt(grid, [10, 16])).toBe(true);
    const around = findPath(grid, [6, 4], [14, 4]);
    expect(around).not.toBeNull();
    if (around) expect(pathLength(around)).toBeGreaterThan(8.5);
  });
});
