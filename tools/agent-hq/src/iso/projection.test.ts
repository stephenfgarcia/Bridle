import { describe, expect, it } from "vitest";
import {
  clampCamera,
  depthOf,
  fitCamera,
  fromScreen,
  ISO_H,
  ISO_X,
  ISO_Y,
  project,
  toScreen,
  unproject,
} from "./projection";

describe("iso projection", () => {
  it("is a 2:1 projection with the back of the room at the top", () => {
    const origin = project(0, 0, 0);
    expect(origin).toEqual({ sx: 0, sy: 0 });
    const right = project(1, 0, 0);
    expect(right.sx).toBe(ISO_X);
    expect(right.sy).toBe(ISO_Y);
    expect(ISO_X / ISO_Y).toBe(2);
    const back = project(0, 0, -10);
    expect(back.sy).toBeLessThan(origin.sy);
    const up = project(0, 2, 0);
    expect(up.sy).toBe(-2 * ISO_H);
  });

  it("unprojects back to the floor and to raised planes", () => {
    const cases: [number, number][] = [
      [0, 0],
      [3.5, -2],
      [-12.25, 15.5],
      [16, -14],
    ];
    for (const [x, z] of cases) {
      const p = project(x, 0, z);
      const u = unproject(p.sx, p.sy);
      expect(u.x).toBeCloseTo(x, 9);
      expect(u.z).toBeCloseTo(z, 9);
      const raised = project(x, 1.2, z);
      const r = unproject(raised.sx, raised.sy, 1.2);
      expect(r.x).toBeCloseTo(x, 9);
      expect(r.z).toBeCloseTo(z, 9);
    }
  });

  it("orders depth so nearer objects draw later", () => {
    expect(depthOf(0, 0)).toBeLessThan(depthOf(1, 0));
    expect(depthOf(0, 0)).toBeLessThan(depthOf(0, 1));
    expect(depthOf(5, -5)).toBe(depthOf(0, 0));
  });

  it("maps through a camera and back, and fits a room", () => {
    const bounds = { minX: -16, maxX: 16, minZ: -14, maxZ: 16, height: 6 };
    const cam = fitCamera(bounds, 1600, 900);
    expect(cam.zoom).toBeGreaterThan(0.3);
    expect(cam.zoom).toBeLessThan(2);
    const corners: [number, number][] = [
      [bounds.minX, bounds.minZ],
      [bounds.maxX, bounds.maxZ],
      [bounds.maxX, bounds.minZ],
      [bounds.minX, bounds.maxZ],
    ];
    for (const [x, z] of corners) {
      const s = toScreen(cam, 1600, 900, x, 0, z);
      expect(s.sx).toBeGreaterThanOrEqual(0);
      expect(s.sx).toBeLessThanOrEqual(1600);
      expect(s.sy).toBeGreaterThanOrEqual(0);
      expect(s.sy).toBeLessThanOrEqual(900);
      const back = fromScreen(cam, 1600, 900, s.sx, s.sy);
      expect(back.x).toBeCloseTo(x, 6);
      expect(back.z).toBeCloseTo(z, 6);
    }
    const clamped = clampCamera({ cx: 99, cz: -99, zoom: 50 }, bounds, 0.4, 3);
    expect(clamped).toEqual({ cx: 16, cz: -14, zoom: 3 });
  });
});
