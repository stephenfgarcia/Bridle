import { validateModel } from "@bridle/model";
import { describe, expect, it } from "vitest";
import { benchCases, buildingFrame, cantilever, formatBench, measure } from "./bench";
import { solve } from "./solve";

describe("speed test models", () => {
  it("the four models are valid and have the sizes the table names", () => {
    const sizes = benchCases().map(({ name, model }) => {
      expect(validateModel(model), name).toEqual([]);
      return [model.members.length, model.nodes.length];
    });
    expect(sizes).toEqual([
      [200, 96],
      [400, 176],
      [200, 201],
      [200, 201],
    ]);
  });

  it("the generators give the same model on every call", () => {
    expect(buildingFrame(3, 3, 5)).toEqual(buildingFrame(3, 3, 5));
    expect(cantilever(200, [2, 3, 6])).toEqual(cantilever(200, [2, 3, 6]));
  });

  it("the building frame is in equilibrium in both load cases (1e-9 of the total load)", () => {
    const model = buildingFrame(3, 3, 5);
    const result = solve(model);
    if (!result.ok) {
      throw new Error(`test: expected the frame to solve, got ${result.reason}`);
    }
    // Gravity: 5 floors, 12 beams of 6 m and 12 beams of 5 m per floor, 12 kN/m.
    const gravity = 5 * 12 * (6 + 5) * 12;
    // Wind: 8 kN on each of the 4 nodes of the face x = 0 at each of 5 floors.
    const wind = 5 * 4 * 8;
    const sum = (loadCaseId: string, component: "fx" | "fz") =>
      Object.values(result.loadCases[loadCaseId]?.reactions ?? {}).reduce(
        (total, reaction) => total + reaction[component],
        0,
      );
    expect(Math.abs(sum("gravity", "fz") - gravity)).toBeLessThan(1e-9 * gravity);
    expect(Math.abs(sum("gravity", "fx"))).toBeLessThan(1e-9 * gravity);
    expect(Math.abs(sum("wind", "fx") + wind)).toBeLessThan(1e-9 * wind);
    expect(Math.abs(sum("wind", "fz"))).toBeLessThan(1e-9 * wind);
  });

  it("the cantilever's tip deflection is P L³/(3 E Iy), along X and along (2, 3, 0) (relative 1e-7)", () => {
    const expected = (-10 * 10 ** 3) / (3 * 2.1e8 * 8.4e-5);
    for (const direction of [
      [1, 0, 0],
      [2, 3, 0],
    ] as const) {
      const result = solve(cantilever(200, direction));
      if (!result.ok) {
        throw new Error("test: expected the cantilever to solve");
      }
      const uz = result.loadCases.tip?.displacements.n200?.uz ?? Number.NaN;
      expect(Math.abs(uz - expected)).toBeLessThan(1e-7 * Math.abs(expected));
    }
  });
});

describe("speed", () => {
  it("measure counts members, nodes, free degrees of freedom and load cases", () => {
    const row = measure("frame", buildingFrame(1, 1, 1), 3, 1);
    expect(row).toMatchObject({ name: "frame", members: 8, nodes: 8, freeDofs: 24, loadCases: 2 });
    expect(row.minMs).toBeLessThanOrEqual(row.medianMs);
    expect(row.medianMs).toBeLessThanOrEqual(row.maxMs);
    expect(row.smallestPivotRatio).toBeGreaterThan(0);
    expect(formatBench([row]).split("\n")).toHaveLength(3);
  });

  it("measure throws for a model that does not solve", () => {
    const model = buildingFrame(1, 1, 1);
    model.supports = [];
    expect(() => measure("no support", model, 1, 0)).toThrow(/did not solve \(invalid-model\)/);
  });

  // A loose bound, far above the measured time (README, "Speed"), so that a slow machine passes.
  it("the 200-member frame solves in under 2 seconds (median of 5 calls)", () => {
    const row = measure("frame", buildingFrame(3, 3, 5), 5, 1);
    expect(row.members).toBe(200);
    expect(row.medianMs).toBeLessThan(2000);
  });
});
