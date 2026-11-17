import {
  type LocalAxes,
  type MemberPointLoad,
  type MemberUniformLoad,
  type Model,
  memberLocalAxes,
  type NodalLoad,
  portalFrame,
  type Support,
  simplySupportedBeam,
  type Vec3,
} from "@bridle/model";
import { describe, expect, it } from "vitest";
import { buildingFrame } from "./bench";
import {
  DEFAULT_STATIONS,
  DOFS,
  deflectedShape,
  type LoadCaseResult,
  MAX_STATIONS,
  MEMBER_QUANTITIES,
  type MemberValues,
  memberLoadLocalComponents,
  memberValues,
  type SolveResult,
  solve,
} from "./index";

/**
 * Tolerances. Each test names the one it uses.
 * - REL: |computed - expected| <= 1e-12 · |expected|, for a value with a closed-form expression.
 * - ZERO: a value that is zero in exact arithmetic may be at most 1e-12 times a scale given in the
 *   test (a force, a moment or a deflection of the same case).
 * - Wider tolerances are stated and explained where a test uses them.
 */
const REL = 1e-12;
const ZERO = 1e-12;

/** The fixtures' section and material (packages/model/src/fixtures.ts). */
const E = 2.1e8;
const G = 8.1e7;
const A = 5.4e-3;
const Iy = 8.4e-5;
const Iz = 6.0e-6;
const J = 2.0e-7;

type DofName = (typeof DOFS)[number];
const ALL: readonly DofName[] = DOFS;

function support(nodeId: string, restrained: readonly DofName[]): Support {
  const has = (dof: DofName) => restrained.includes(dof);
  return {
    nodeId,
    ux: has("ux"),
    uy: has("uy"),
    uz: has("uz"),
    rx: has("rx"),
    ry: has("ry"),
    rz: has("rz"),
  };
}

function nodal(id: string, nodeId: string, components: Partial<NodalLoad>): NodalLoad {
  return { id, loadCaseId: "lc1", nodeId, fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0, ...components };
}

function uniform(
  id: string,
  memberId: string,
  axes: "global" | "local",
  direction: "x" | "y" | "z",
  value: number,
): MemberUniformLoad {
  return { id, loadCaseId: "lc1", memberId, axes, direction, value };
}

function point(
  id: string,
  memberId: string,
  axes: "global" | "local",
  direction: "x" | "y" | "z",
  value: number,
  position: number,
): MemberPointLoad {
  return { id, loadCaseId: "lc1", memberId, axes, direction, value, position };
}

/** A model of frame members with the fixtures' section and material and the load case `lc1`. */
function frame(
  nodes: [id: string, x: number, y: number, z: number][],
  members: [id: string, start: string, end: string, rollAngleDeg?: number][],
  supports: Support[],
  loads: { nodal?: NodalLoad[]; uniform?: MemberUniformLoad[]; point?: MemberPointLoad[] } = {},
): Model {
  return {
    version: 1,
    units: { force: "kN", length: "m" },
    nodes: nodes.map(([id, x, y, z]) => ({ id, x, y, z })),
    members: members.map(([id, startNodeId, endNodeId, rollAngleDeg]) => ({
      id,
      startNodeId,
      endNodeId,
      sectionId: "s1",
      materialId: "mat1",
      kind: "frame",
      rollAngleDeg: rollAngleDeg ?? 0,
      releases: {
        start: { rx: false, ry: false, rz: false },
        end: { rx: false, ry: false, rz: false },
      },
    })),
    sections: [{ id: "s1", name: "I 300x150", A, Iy, Iz, J, depthY: 0.15, depthZ: 0.3 }],
    materials: [{ id: "mat1", name: "S355", E, G, fy: 3.55e5, density: 7850 }],
    supports,
    loadCases: [{ id: "lc1", name: "LC1" }],
    nodalLoads: loads.nodal ?? [],
    memberUniformLoads: loads.uniform ?? [],
    memberPointLoads: loads.point ?? [],
  };
}

type Solved = Extract<SolveResult, { ok: true }>;

function solved(model: Model): Solved {
  const result = solve(model);
  if (!result.ok) {
    throw new Error(`test: expected the model to solve, got ${result.reason}`);
  }
  return result;
}

function loadCase(result: Solved, id = "lc1"): LoadCaseResult {
  const found = result.loadCases[id];
  if (!found) {
    throw new Error(`test: no load case ${id}`);
  }
  return found;
}

/** `memberValues` of a freshly solved model, for load case `lc1`. */
function values(model: Model, memberId: string, stations?: number, at?: number[]): MemberValues {
  const found = memberValues(model, solved(model), "lc1", memberId, stations, at);
  if (!found) {
    throw new Error(`test: no values for ${memberId}`);
  }
  return found;
}

function expectRel(actual: number, expected: number, tolerance = REL, what = ""): void {
  expect(Math.abs(actual - expected), `${what}: ${actual} against ${expected}`).toBeLessThanOrEqual(
    tolerance * Math.abs(expected),
  );
}

function expectZero(actual: number, scale: number, what = "", tolerance = ZERO): void {
  expect(Math.abs(actual), `${what}: ${actual} should be zero`).toBeLessThanOrEqual(
    tolerance * scale,
  );
}

/** The first station at exactly `x` ("before" a point load there), or the last one ("after"). */
function station(v: MemberValues, x: number, side: "first" | "last" = "first"): number {
  const index = side === "first" ? v.x.indexOf(x) : v.x.lastIndexOf(x);
  if (index < 0) {
    throw new Error(`test: no station at ${x} in [${Array.from(v.x).join(", ")}]`);
  }
  return index;
}

const local = (v: MemberValues, i: number, k: 0 | 1 | 2) => v.deflectionLocal[3 * i + k] as number;
const global = (v: MemberValues, i: number, k: 0 | 1 | 2) =>
  v.deflectionGlobal[3 * i + k] as number;
const of = (array: Float64Array, i: number) => array[i] as number;
const last = (array: Float64Array) => array[array.length - 1] as number;

/** The simply supported beam fixture with other loads: 6 m along +X, `m1` from `n1` to `n2`. */
function beam(loads: {
  uniform?: MemberUniformLoad[];
  point?: MemberPointLoad[];
  roll?: number;
}): Model {
  const model = simplySupportedBeam();
  model.memberUniformLoads = loads.uniform ?? [];
  model.memberPointLoads = loads.point ?? [];
  (model.members[0] as Model["members"][number]).rollAngleDeg = loads.roll ?? 0;
  return model;
}

/** One member of 6 m along +X with the given supports at its two nodes. */
function span(
  startDofs: readonly DofName[],
  endDofs: readonly DofName[],
  loads: { nodal?: NodalLoad[]; uniform?: MemberUniformLoad[]; point?: MemberPointLoad[] },
  L = 6,
): Model {
  const supports = [support("n1", startDofs)];
  if (endDofs.length > 0) {
    supports.push(support("n2", endDofs));
  }
  return frame(
    [
      ["n1", 0, 0, 0],
      ["n2", L, 0, 0],
    ],
    [["m1", "n1", "n2"]],
    supports,
    loads,
  );
}

const w = 10;
const L = 6;

describe("memberValues: stations and the shape of the result", () => {
  it("has 21 equally spaced stations by default, from 0 to the length exactly, and arrays of that length", () => {
    const v = values(simplySupportedBeam(), "m1");
    expect(DEFAULT_STATIONS).toBe(21);
    expect(v.count).toBe(21);
    expect(v.length).toBe(6);
    expect(Array.from(v.x)).toEqual(Array.from({ length: 21 }, (_, i) => (6 * i) / 20));
    expect(last(v.x)).toBe(6);
    for (const key of ["N", "Vy", "Vz", "T", "My", "Mz"] as const) {
      expect(v[key]).toBeInstanceOf(Float64Array);
      expect(v[key].length).toBe(21);
    }
    expect(v.deflectionLocal.length).toBe(63);
    expect(v.deflectionGlobal.length).toBe(63);
    expect(Object.keys(v.extremes)).toEqual([...MEMBER_QUANTITIES]);
    expect(v.memberId).toBe("m1");
    expect(v.loadCaseId).toBe("lc1");
    expect(v.axes).toEqual(memberLocalAxes({ x: 0, y: 0, z: 0 }, { x: 6, y: 0, z: 0 }, 0));
  });

  it("reads the number of stations: below 2 is 2, a fraction is rounded down, not finite is 21", () => {
    const model = simplySupportedBeam();
    expect(Array.from(values(model, "m1", 1).x)).toEqual([0, 6]);
    expect(Array.from(values(model, "m1", -3).x)).toEqual([0, 6]);
    expect(Array.from(values(model, "m1", 3.9).x)).toEqual([0, 3, 6]);
    expect(values(model, "m1", Number.NaN).count).toBe(21);
    expect(values(model, "m1", Number.POSITIVE_INFINITY).count).toBe(21);
  });

  it("clamps the number of stations to MAX_STATIONS = 1001, in memberValues and in deflectedShape", () => {
    const model = simplySupportedBeam();
    const result = solved(model);
    expect(MAX_STATIONS).toBe(1001);
    expect(values(model, "m1", 1001).count).toBe(1001);
    expect(values(model, "m1", 1002).count).toBe(1001);
    expect(values(model, "m1", 1e9).count).toBe(1001);
    expect(of(values(model, "m1", 1e9).x, 1)).toBe(6 / 1000);
    const shape = deflectedShape(model, result, "lc1", 1, 1e9);
    expect(shape?.stations).toBe(1001);
    expect(shape?.points.length).toBe(3003);
  });

  it("adds two stations at a point load between stations, replaces the station at a point load on one, and merges loads at one position", () => {
    const between = values(beam({ point: [point("p1", "m1", "global", "z", -12, 4)] }), "m1", 4);
    expect(Array.from(between.x)).toEqual([0, 2, 4, 4, 6]);
    const off = values(beam({ point: [point("p1", "m1", "global", "z", -12, 2.5)] }), "m1", 4);
    expect(Array.from(off.x)).toEqual([0, 2, 2.5, 2.5, 4, 6]);
    const two = values(
      beam({
        point: [
          point("p1", "m1", "global", "z", -12, 4),
          point("p2", "m1", "local", "x", 5, 4),
          point("p3", "m1", "local", "y", 1, 1),
        ],
      }),
      "m1",
      4,
    );
    expect(Array.from(two.x)).toEqual([0, 1, 1, 2, 4, 4, 6]);
    // Both loads at 4 m act between the two stations there: the jumps of Vz and of N.
    expectRel(of(two.Vz, 5) - of(two.Vz, 4), -12);
    expectRel(of(two.N, 5) - of(two.N, 4), -5);
  });

  it("adds the positions of `at` once each, clamped to the member; one at a point load adds nothing", () => {
    const model = beam({ point: [point("p1", "m1", "global", "z", -12, 4)] });
    const v = values(model, "m1", 3, [1.25, 1.25, 4, -2, 9, 3, Number.NaN]);
    expect(Array.from(v.x)).toEqual([0, 1.25, 3, 4, 4, 6]);
  });

  it("puts two stations at the end for a point load at position 0, at the length, and within the slack past an end", () => {
    const model = beam({
      point: [
        point("p1", "m1", "global", "z", -12, 0),
        point("p2", "m1", "global", "z", -7, 6),
        point("p3", "m1", "global", "z", -1, 6 + 5e-10),
        point("p4", "m1", "global", "z", -2, -5e-10),
      ],
    });
    const v = values(model, "m1", 3);
    expect(Array.from(v.x)).toEqual([0, 0, 3, 6, 6]);
    // No load between the supports: the loads go straight into the supports, the beam carries nothing.
    for (const i of [1, 2, 3]) {
      expectZero(of(v.Vz, i), 12);
      expectZero(of(v.My, i), 12);
    }
    // The node's side of each end has the end action; the jump is the load on the member there.
    expectRel(of(v.Vz, 0), 14);
    expectRel(of(v.Vz, 4), -8);
  });

  it("is plain data: structuredClone gives an equal object, and the arguments are not changed", () => {
    const model = portalFrame();
    model.memberUniformLoads.push(uniform("u1", "b1", "global", "z", -10));
    model.memberPointLoads.push(point("p1", "b1", "global", "z", -5, 2));
    const result = solved(model);
    const modelBefore = structuredClone(model);
    const resultBefore = structuredClone(result);
    const v = memberValues(model, result, "lc1", "b1");
    const shape = deflectedShape(model, result, "lc1", 50);
    expect(structuredClone(v)).toEqual(v);
    expect(structuredClone(shape)).toEqual(shape);
    expect(model).toEqual(modelBefore);
    expect(result).toEqual(resultBefore);
    expect(memberValues(model, result, "lc1", "b1")).toEqual(v);
  });

  it("returns undefined for a failed solve, an unknown load case or member, and a truss or released member", () => {
    const model = simplySupportedBeam();
    const result = solved(model);
    expect(memberValues(model, result, "lc1", "m1")).toBeDefined();
    expect(memberValues(model, result, "nope", "m1")).toBeUndefined();
    expect(memberValues(model, result, "toString", "m1")).toBeUndefined();
    expect(memberValues(model, result, "lc1", "nope")).toBeUndefined();
    expect(deflectedShape(model, result, "nope", 1)).toBeUndefined();
    const unsupported = simplySupportedBeam();
    unsupported.supports = [];
    const failed = solve(unsupported);
    expect(failed.ok).toBe(false);
    expect(memberValues(unsupported, failed, "lc1", "m1")).toBeUndefined();
    expect(deflectedShape(unsupported, failed, "lc1", 1)).toBeUndefined();
    // `solve` refuses these members, so the result of the plain model is given with a changed model.
    const truss = simplySupportedBeam();
    (truss.members[0] as Model["members"][number]).kind = "truss";
    expect(memberValues(truss, result, "lc1", "m1")).toBeUndefined();
    const released = simplySupportedBeam();
    (released.members[0] as Model["members"][number]).releases.end.ry = true;
    expect(memberValues(released, result, "lc1", "m1")).toBeUndefined();
    // A member whose node the model does not have.
    const broken = simplySupportedBeam();
    broken.nodes.pop();
    expect(memberValues(broken, result, "lc1", "m1")).toBeUndefined();
    expect(deflectedShape(broken, result, "lc1", 1)).toBeUndefined();
  });
});

describe("memberValues: a simply supported beam of one element under a uniform load", () => {
  it("along +X, roll 0, gravity: sagging is a positive My of wL²/8 at mid-span; quarter points, end shears and deflections (tolerance: relative 1e-12; zeros within 1e-12 · 45)", () => {
    const v = values(simplySupportedBeam(), "m1");
    const EI = E * Iy;
    const mid = station(v, 3);
    expectRel(of(v.My, mid), (w * L ** 2) / 8, REL, "My at mid-span");
    expect(of(v.My, mid)).toBeGreaterThan(0);
    for (const x of [1.5, 4.5]) {
      expectRel(of(v.My, station(v, x)), (3 * w * L ** 2) / 32, REL, `My at ${x}`);
    }
    expectZero(of(v.My, 0), 45, "My at the start");
    expectZero(last(v.My), 45, "My at the end");
    expectRel(of(v.Vz, 0), (w * L) / 2, REL, "Vz at the start");
    expectRel(last(v.Vz), (-w * L) / 2, REL, "Vz at the end");
    expectZero(of(v.Vz, mid), 30, "Vz at mid-span");
    // Deflection: downward, 5wL⁴/(384EI) at mid-span and 57wL⁴/(6144EI) at the quarter points.
    expectRel(global(v, mid, 2), (-5 * w * L ** 4) / (384 * EI), REL, "uz at mid-span");
    expectRel(local(v, mid, 2), (-5 * w * L ** 4) / (384 * EI), REL, "local z at mid-span");
    for (const x of [1.5, 4.5]) {
      expectRel(global(v, station(v, x), 2), (-57 * w * L ** 4) / (6144 * EI), REL, `uz at ${x}`);
    }
    expect(global(v, 0, 2)).toBe(0);
    expect(global(v, 20, 2)).toBe(0);
    // Every station: M = w x (L - x)/2, V = w (L/2 - x), d = -w x (L³ - 2Lx² + x³)/(24EI).
    for (let i = 1; i < v.count - 1; i++) {
      const x = of(v.x, i);
      expectRel(of(v.My, i), (w * x * (L - x)) / 2, REL, `My at ${x}`);
      expectRel(
        global(v, i, 2),
        (-w * x * (L ** 3 - 2 * L * x * x + x ** 3)) / (24 * EI),
        REL,
        `uz at ${x}`,
      );
      if (i !== mid) {
        expectRel(of(v.Vz, i), w * (L / 2 - x), REL, `Vz at ${x}`);
      }
    }
    // Nothing in the other plane, no axial force, no torque.
    for (let i = 0; i < v.count; i++) {
      expect(of(v.Mz, i)).toBe(0);
      expect(of(v.Vy, i)).toBe(0);
      expect(of(v.N, i)).toBe(0);
      expect(of(v.T, i)).toBe(0);
      expect(local(v, i, 1)).toBe(0);
    }
    expectRel(v.extremes.My.max, 45);
    expect(v.extremes.My.maxX).toBe(3);
    expectRel(v.extremes.Vz.max, 30);
    expect(v.extremes.Vz.maxX).toBe(0);
    expectRel(v.extremes.Vz.min, -30);
    expect(v.extremes.Vz.minX).toBe(6);
    expectRel(v.extremes.dGlobalZ.min, (-5 * w * L ** 4) / (384 * EI));
    expect(v.extremes.dGlobalZ.minX).toBe(3);
  });

  it("finds the mid-span moment and deflection as extremes when no station is at mid-span (4 stations; tolerance: relative 1e-12, position 1e-9 m)", () => {
    const v = values(simplySupportedBeam(), "m1", 4);
    expect(Array.from(v.x)).toEqual([0, 2, 4, 6]);
    expectRel(v.extremes.My.max, 45);
    expectRel(v.extremes.My.maxX, 3);
    expectRel(v.extremes.dGlobalZ.min, (-5 * w * L ** 4) / (384 * E * Iy));
    expect(Math.abs(v.extremes.dGlobalZ.minX - 3)).toBeLessThan(1e-9);
    expectRel(v.extremes.dLocalZ.min, (-5 * w * L ** 4) / (384 * E * Iy));
  });

  it("the other bending plane: a load along -Y gives a positive Mz of wL²/8 (tension on the -y side), Vy = ±wL/2 and 5wL⁴/(384 E Iz) (tolerance: relative 1e-12; zeros within 1e-12 · 45)", () => {
    const v = values(beam({ uniform: [uniform("u1", "m1", "global", "y", -w)] }), "m1");
    const EI = E * Iz;
    const mid = station(v, 3);
    expectRel(of(v.Mz, mid), (w * L ** 2) / 8, REL, "Mz at mid-span");
    for (const x of [1.5, 4.5]) {
      expectRel(of(v.Mz, station(v, x)), (3 * w * L ** 2) / 32, REL, `Mz at ${x}`);
      expectRel(global(v, station(v, x), 1), (-57 * w * L ** 4) / (6144 * EI), REL, `uy at ${x}`);
    }
    expectRel(of(v.Vy, 0), (w * L) / 2, REL, "Vy at the start");
    expectRel(last(v.Vy), (-w * L) / 2, REL, "Vy at the end");
    expectRel(global(v, mid, 1), (-5 * w * L ** 4) / (384 * EI), REL, "uy at mid-span");
    for (let i = 0; i < v.count; i++) {
      expect(of(v.My, i)).toBe(0);
      expect(of(v.Vz, i)).toBe(0);
      expect(local(v, i, 2)).toBe(0);
    }
    expectRel(v.extremes.Mz.max, 45);
    expect(v.extremes.Mz.maxX).toBe(3);
  });

  it("a load along +Y: the mirror state has a negative Mz (tension on the +y side) and a deflection along +y (tolerance: relative 1e-12)", () => {
    const v = values(beam({ uniform: [uniform("u1", "m1", "local", "y", w)] }), "m1");
    const mid = station(v, 3);
    expectRel(of(v.Mz, mid), (-w * L ** 2) / 8);
    expectRel(of(v.Vy, 0), (-w * L) / 2);
    expectRel(local(v, mid, 1), (5 * w * L ** 4) / (384 * E * Iz));
  });

  it("an upward load on the roll-0 beam: hogging is a negative My (tension on the +z side) (tolerance: relative 1e-12)", () => {
    const v = values(beam({ uniform: [uniform("u1", "m1", "global", "z", w)] }), "m1");
    expectRel(of(v.My, station(v, 3)), (-w * L ** 2) / 8);
    expectRel(of(v.Vz, 0), (-w * L) / 2);
  });

  it("the same beam drawn from right to left (along -X) and along +Y: gravity still gives My = +wL²/8 and Vz = +wL/2 at the member's own start (tolerance: relative 1e-12)", () => {
    const backwards = frame(
      [
        ["n1", 6, 0, 0],
        ["n2", 0, 0, 0],
      ],
      [["m1", "n1", "n2"]],
      [support("n1", ["ux", "uy", "uz", "rx"]), support("n2", ["uy", "uz"])],
      { uniform: [uniform("u1", "m1", "global", "z", -w)] },
    );
    const alongY = frame(
      [
        ["n1", 0, 0, 0],
        ["n2", 0, 6, 0],
      ],
      [["m1", "n1", "n2"]],
      [support("n1", ["ux", "uy", "uz", "ry"]), support("n2", ["ux", "uz"])],
      { uniform: [uniform("u1", "m1", "global", "z", -w)] },
    );
    for (const model of [backwards, alongY]) {
      const v = values(model, "m1");
      expect(v.axes.z.z).toBe(1);
      expectRel(of(v.My, station(v, 3)), (w * L ** 2) / 8);
      expectRel(of(v.Vz, 0), (w * L) / 2);
      expectRel(last(v.Vz), (-w * L) / 2);
      expectRel(global(v, station(v, 3), 2), (-5 * w * L ** 4) / (384 * E * Iy));
    }
  });

  it("sideways bending of a roll-0 beam: under the same load along -Y, Mz at mid-span is +wL²/8 for the member along +X (local y = +Y) and -wL²/8 for the same beam drawn along -X (local y = -Y); the ordinate -Mz · (local y) is on the -Y side for both (tolerance: relative 1e-12)", () => {
    const forwards = values(beam({ uniform: [uniform("u1", "m1", "global", "y", -w)] }), "m1");
    const backwards = values(
      frame(
        [
          ["n1", 6, 0, 0],
          ["n2", 0, 0, 0],
        ],
        [["m1", "n1", "n2"]],
        [support("n1", ["ux", "uy", "uz", "rx"]), support("n2", ["uy", "uz"])],
        { uniform: [uniform("u1", "m1", "global", "y", -w)] },
      ),
      "m1",
    );
    expect(forwards.axes.y.y).toBe(1);
    expect(backwards.axes.y.y).toBe(-1);
    expectRel(of(forwards.Mz, 10), (w * L ** 2) / 8);
    expectRel(of(backwards.Mz, 10), (-w * L ** 2) / 8);
    expectRel(-of(forwards.Mz, 10) * forwards.axes.y.y, (-w * L ** 2) / 8);
    expectRel(-of(backwards.Mz, 10) * backwards.axes.y.y, (-w * L ** 2) / 8);
  });

  it("a roll of 90 degrees: gravity bends about local z with Iz, Mz = +wL²/8 (the bottom is the -y side) and My = 0 (tolerance: relative 1e-12; zeros within 1e-12 · 45)", () => {
    const v = values(beam({ uniform: [uniform("u1", "m1", "global", "z", -w)], roll: 90 }), "m1");
    const mid = station(v, 3);
    expectRel(v.axes.y.z, 1);
    expectRel(v.axes.z.y, -1);
    expectRel(of(v.Mz, mid), (w * L ** 2) / 8, REL, "Mz");
    expectRel(of(v.Vy, 0), (w * L) / 2, REL, "Vy");
    for (let i = 0; i < v.count; i++) {
      expectZero(of(v.My, i), 45, "My");
      expectZero(of(v.Vz, i), 45, "Vz");
    }
    expectRel(global(v, mid, 2), (-5 * w * L ** 4) / (384 * E * Iz), REL, "uz");
    expectRel(local(v, mid, 1), (-5 * w * L ** 4) / (384 * E * Iz), REL, "local y");
    expectZero(global(v, mid, 1), (5 * w * L ** 4) / (384 * E * Iz), "uy");
  });

  it("a roll of 180 degrees: the same sagging state has My = -wL²/8, because the bottom is now the +z side (tolerance: relative 1e-12; zeros within 1e-12 · 45)", () => {
    const v = values(beam({ uniform: [uniform("u1", "m1", "global", "z", -w)], roll: 180 }), "m1");
    const mid = station(v, 3);
    expectRel(v.axes.z.z, -1);
    expectRel(of(v.My, mid), (-w * L ** 2) / 8, REL, "My");
    expectRel(of(v.Vz, 0), (-w * L) / 2, REL, "Vz");
    expectZero(of(v.Mz, mid), 45, "Mz");
    // The drawing rule: the ordinate My towards -z. Here that is downward, the tension side.
    expect(-of(v.My, mid) * v.axes.z.z).toBeLessThan(0);
    expectRel(global(v, mid, 2), (-5 * w * L ** 4) / (384 * E * Iy), REL, "uz");
    expectRel(local(v, mid, 2), (5 * w * L ** 4) / (384 * E * Iy), REL, "local z");
  });
});

describe("memberValues: cantilevers", () => {
  const fixedFree = (loads: Parameters<typeof span>[2]) => span(ALL, [], loads);

  it("under a uniform load: M = -w(L - x)²/2 (hogging), V = w(L - x), d = -w x²(6L² - 4Lx + x²)/(24EI) at every station (tolerance: relative 1e-12)", () => {
    const v = values(fixedFree({ uniform: [uniform("u1", "m1", "global", "z", -w)] }), "m1");
    const EI = E * Iy;
    for (let i = 0; i < v.count; i++) {
      const x = of(v.x, i);
      if (i < v.count - 1) {
        expectRel(of(v.My, i), (-w * (L - x) ** 2) / 2, REL, `My at ${x}`);
        expectRel(of(v.Vz, i), w * (L - x), REL, `Vz at ${x}`);
      }
      if (i > 0) {
        const d = (-w * x * x * (6 * L * L - 4 * L * x + x * x)) / (24 * EI);
        expectRel(global(v, i, 2), d, REL, `uz at ${x}`);
      }
    }
    expectZero(last(v.My), 180, "My at the tip");
    expectZero(last(v.Vz), 60, "Vz at the tip");
    expect(global(v, 0, 2)).toBe(0);
    expectRel(v.extremes.My.min, (-w * L * L) / 2);
    expect(v.extremes.My.minX).toBe(0);
    expectRel(v.extremes.dGlobalZ.min, (-w * L ** 4) / (8 * EI));
    expect(v.extremes.dGlobalZ.minX).toBe(6);
  });

  it("under a tip load, as a nodal load and as a point load at the length: M = -P(L - x), V = P, d = -P x²(3L - x)/(6EI) (tolerance: relative 1e-12)", () => {
    const P = 10;
    const EI = E * Iy;
    const asNodal = fixedFree({ nodal: [nodal("f1", "n2", { fz: -P })] });
    const asPoint = fixedFree({ point: [point("p1", "m1", "global", "z", -P, L)] });
    for (const model of [asNodal, asPoint]) {
      const v = values(model, "m1");
      const before = station(v, L, "first");
      for (let i = 0; i <= before; i++) {
        const x = of(v.x, i);
        if (x < L) {
          expectRel(of(v.My, i), -P * (L - x), REL, `My at ${x}`);
        }
        expectRel(of(v.Vz, i), P, REL, `Vz at ${x}`);
        if (i > 0) {
          expectRel(global(v, i, 2), (-P * x * x * (3 * L - x)) / (6 * EI), REL, `uz at ${x}`);
        }
      }
      expectZero(last(v.My), 60, "My at the tip");
    }
    // The point load at the length is on the member: after it, at the node's side, nothing is left.
    const v = values(asPoint, "m1");
    expect(v.count).toBe(22);
    expectZero(last(v.Vz), 10, "Vz after the tip load");
    expectRel(of(v.Vz, 20), P);
  });

  it("in the other plane, a tip load along +Y: Mz = +P(L - x) (tension on the -y side), Vy = -P, uy = +P x²(3L - x)/(6 E Iz) (tolerance: relative 1e-12)", () => {
    const P = 10;
    const v = values(fixedFree({ nodal: [nodal("f1", "n2", { fy: P })] }), "m1");
    for (let i = 0; i < v.count - 1; i++) {
      const x = of(v.x, i);
      expectRel(of(v.Mz, i), P * (L - x), REL, `Mz at ${x}`);
      expectRel(of(v.Vy, i), -P, REL, `Vy at ${x}`);
      if (i > 0) {
        expectRel(global(v, i, 1), (P * x * x * (3 * L - x)) / (6 * E * Iz), REL, `uy at ${x}`);
      }
    }
  });

  it("axial force and torque: a pull of 7 kN and a torque of 5 kN·m about +X on the tip give N = +7 and T = +5 everywhere; a push gives N = -7 (tolerance: relative 1e-12)", () => {
    const pull = values(fixedFree({ nodal: [nodal("f1", "n2", { fx: 7, mx: 5 })] }), "m1");
    const push = values(fixedFree({ nodal: [nodal("f1", "n2", { fx: -7 })] }), "m1");
    for (let i = 0; i < pull.count; i++) {
      expectRel(of(pull.N, i), 7);
      expectRel(of(pull.T, i), 5);
      expectRel(of(push.N, i), -7);
      expectRel(local(pull, i, 0), (7 * of(pull.x, i)) / (E * A), REL);
    }
  });

  it("an axial uniform load p along +x on a bar fixed at its start: N = p(L - x), u = p x(2L - x)/(2EA) (tolerance: relative 1e-12)", () => {
    const p = 4;
    const v = values(fixedFree({ uniform: [uniform("u1", "m1", "local", "x", p)] }), "m1");
    for (let i = 0; i < v.count - 1; i++) {
      const x = of(v.x, i);
      expectRel(of(v.N, i), p * (L - x), REL, `N at ${x}`);
      if (i > 0) {
        expectRel(local(v, i, 0), (p * x * (2 * L - x)) / (2 * E * A), REL, `u at ${x}`);
      }
    }
    expectZero(last(v.N), 24);
    expectRel(v.extremes.N.max, 24);
    expect(v.extremes.N.maxX).toBe(0);
  });
});

describe("memberValues: a beam fixed at both ends (the particular part alone)", () => {
  const fixedFixed = (loads: Parameters<typeof span>[2], length = L) =>
    span(ALL, ALL, loads, length);

  it("under a uniform load: hogging -wL²/12 at the ends, sagging +wL²/24 at mid-span, zero moment at L(1/2 ± √3/6) = 0.2113 L from each end, deflection wL⁴/(384EI) (tolerance: relative 1e-12; zeros within 1e-12 · wL²/12)", () => {
    const c1 = L * (0.5 - Math.sqrt(3) / 6);
    const c2 = L * (0.5 + Math.sqrt(3) / 6);
    expect(Math.abs(c1 / L - 0.2113)).toBeLessThan(5e-5);
    const model = fixedFixed({ uniform: [uniform("u1", "m1", "global", "z", -w)] });
    const v = values(model, "m1", 21, [c1, c2]);
    expect(v.count).toBe(23);
    expectRel(of(v.My, 0), (-w * L * L) / 12, REL, "My at the start");
    expectRel(last(v.My), (-w * L * L) / 12, REL, "My at the end");
    expectRel(of(v.My, station(v, 3)), (w * L * L) / 24, REL, "My at mid-span");
    expectZero(of(v.My, station(v, c1)), (w * L * L) / 12, "My at the first contraflexure");
    expectZero(of(v.My, station(v, c2)), (w * L * L) / 12, "My at the second contraflexure");
    for (let i = 0; i < v.count; i++) {
      const x = of(v.x, i);
      const hogging = x < c1 || x > c2;
      if (x !== c1 && x !== c2) {
        expect(of(v.My, i) < 0, `the sign of My at ${x}`).toBe(hogging);
      }
      if (i > 0 && i < v.count - 1) {
        const d = (-w * x * x * (L - x) ** 2) / (24 * E * Iy);
        expectRel(global(v, i, 2), d, REL, `uz at ${x}`);
      }
    }
    expectRel(global(v, station(v, 3), 2), (-w * L ** 4) / (384 * E * Iy), REL, "uz at mid-span");
    expectRel(v.extremes.My.max, (w * L * L) / 24);
    expectRel(v.extremes.My.min, (-w * L * L) / 12);
    expect(v.extremes.My.minX).toBe(0);
  });

  // With h = 1e-6 · L the next terms of the expansion about the end, V h³/(6EI), are below 1e-5 of
  // M h²/(2EI) for these loads, so the tolerance is relative 1e-5.
  it("the particular deflections are zero with zero slope at both ends: at a small distance h from an end the deflection is M h²/(2EI), with M the end moment, in both planes, for a uniform and a point load (tolerance: relative 1e-5)", () => {
    const h = 1e-6 * L;
    const cases: [MemberUniformLoad[], MemberPointLoad[]][] = [
      [[uniform("u1", "m1", "local", "z", -w)], []],
      [[uniform("u1", "m1", "local", "y", w)], []],
      [[], [point("p1", "m1", "local", "z", 12, 2)]],
      [[], [point("p1", "m1", "local", "y", -12, 4.5)]],
      [[uniform("u1", "m1", "local", "y", 3)], [point("p1", "m1", "local", "y", -12, 0.5)]],
    ];
    for (const [uniformLoads, pointLoads] of cases) {
      const v = values(fixedFixed({ uniform: uniformLoads, point: pointLoads }), "m1", 2, [
        h,
        L - h,
      ]);
      const first = station(v, h);
      const lastButOne = station(v, L - h);
      for (const [k, M, EI] of [
        [1, v.Mz, E * Iz],
        [2, v.My, E * Iy],
      ] as const) {
        expect(local(v, 0, k)).toBe(0);
        expect(local(v, v.count - 1, k)).toBe(0);
        const atStart = (of(M, 0) * h * h) / (2 * EI);
        const atEnd = (last(M) * h * h) / (2 * EI);
        if (atStart === 0) {
          expect(local(v, first, k)).toBe(0);
          expect(local(v, lastButOne, k)).toBe(0);
        } else {
          expectRel(local(v, first, k), atStart, 1e-5, `plane ${k} near the start`);
          expectRel(local(v, lastButOne, k), atEnd, 1e-5, `plane ${k} near the end`);
        }
      }
    }
  });

  it("under an off-centre point load, L = 5, P = 10 down at a = 2: end moments -Pab²/L² and -Pa²b/L², +2Pa²b²/L³ and the deflection Pa³b³/(3EIL³) under the load, and the same in the other plane (tolerance: relative 1e-12)", () => {
    const P = 10;
    const a = 2;
    const b = 3;
    const S = 5;
    const down = values(fixedFixed({ point: [point("p1", "m1", "global", "z", -P, a)] }, S), "m1");
    const i = station(down, a);
    expectRel(of(down.My, 0), (-P * a * b * b) / S ** 2);
    expectRel(last(down.My), (-P * a * a * b) / S ** 2);
    expectRel(of(down.My, i), (2 * P * a * a * b * b) / S ** 3);
    expectRel(of(down.Vz, i), (P * b * b * (3 * a + b)) / S ** 3);
    expectRel(of(down.Vz, i + 1), (-P * a * a * (a + 3 * b)) / S ** 3);
    expectRel(global(down, i, 2), (-P * a ** 3 * b ** 3) / (3 * E * Iy * S ** 3));
    expect(global(down, i + 1, 2)).toBe(global(down, i, 2));
    expectRel(down.extremes.My.max, (2 * P * a * a * b * b) / S ** 3);
    expect(down.extremes.My.maxX).toBe(a);
    const side = values(fixedFixed({ point: [point("p1", "m1", "global", "y", -P, a)] }, S), "m1");
    expectRel(of(side.Mz, 0), (-P * a * b * b) / S ** 2);
    expectRel(of(side.Mz, i), (2 * P * a * a * b * b) / S ** 3);
    expectRel(global(side, i, 1), (-P * a ** 3 * b ** 3) / (3 * E * Iz * S ** 3));
  });

  it("axially, a bar held at both ends: a uniform load p gives N = p(L/2 - x) and u = p x(L - x)/(2EA); a point load P at a gives N = +Pb/L before it and -Pa/L after it and u = Pab/(EAL) at it (tolerance: relative 1e-12)", () => {
    const p = 4;
    const v = values(fixedFixed({ uniform: [uniform("u1", "m1", "local", "x", p)] }), "m1");
    for (let i = 1; i < v.count - 1; i++) {
      const x = of(v.x, i);
      if (x !== 3) {
        expectRel(of(v.N, i), p * (L / 2 - x), REL, `N at ${x}`);
      }
      expectRel(local(v, i, 0), (p * x * (L - x)) / (2 * E * A), REL, `u at ${x}`);
    }
    expect(local(v, 0, 0)).toBe(0);
    expect(local(v, 20, 0)).toBe(0);
    const P = 12;
    const a = 2;
    const b = 4;
    const q = values(fixedFixed({ point: [point("p1", "m1", "local", "x", P, a)] }), "m1");
    const i = station(q, a);
    expectRel(of(q.N, i), (P * b) / L);
    expectRel(of(q.N, i + 1), (-P * a) / L);
    expectRel(local(q, i, 0), (P * a * b) / (E * A * L));
    expectRel(local(q, station(q, 0.9), 0), (P * b * 0.9) / (E * A * L));
    expectRel(local(q, station(q, 5.1), 0), (P * a * (L - 5.1)) / (E * A * L));
    // The axial deflection peaks at the load, where its derivative jumps from + to -.
    expectRel(q.extremes.dLocalX.max, (P * a * b) / (E * A * L));
    expect(q.extremes.dLocalX.maxX).toBe(a);
  });
});

describe("memberValues: extreme moments and deflections between the stations", () => {
  it("a simply supported beam with an off-centre point load, P = 12 at a = 4 of 6 m: the shear jumps from Pb/L to -Pa/L, the largest moment Pab/L is under the load, and the largest deflection Pb(L² - b²)^1.5/(9√3·L·EI) is at √((L² - b²)/3) from the far end (tolerance: relative 1e-12, position relative 1e-9)", () => {
    const P = 12;
    const a = 4;
    const b = 2;
    const v = values(beam({ point: [point("p1", "m1", "global", "z", -P, a)] }), "m1");
    expect(v.count).toBe(23);
    const i = station(v, a, "first");
    expect(station(v, a, "last")).toBe(i + 1);
    expectRel(of(v.Vz, i), (P * b) / L, REL, "Vz before the load");
    expectRel(of(v.Vz, i + 1), (-P * a) / L, REL, "Vz after the load");
    expectRel(of(v.Vz, i) - of(v.Vz, i + 1), P, REL, "the jump");
    expectRel(of(v.My, i), (P * a * b) / L, REL, "My under the load");
    expect(of(v.My, i + 1)).toBe(of(v.My, i));
    expectRel(v.extremes.My.max, (P * a * b) / L);
    expect(v.extremes.My.maxX).toBe(a);
    // The largest deflection is not at a station (√(32/3) = 3.2660 m; the stations are 0.3 m apart).
    const xMax = Math.sqrt((L * L - b * b) / 3);
    const dMax = (-P * b * (L * L - b * b) ** 1.5) / (9 * Math.sqrt(3) * L * E * Iy);
    expectRel(v.extremes.dGlobalZ.min, dMax, REL, "the largest deflection");
    expectRel(v.extremes.dGlobalZ.minX, xMax, 1e-9, "its position");
    expectRel(v.extremes.dLocalZ.min, dMax, REL, "the largest deflection, local");
    expect(Array.from(v.x)).not.toContain(v.extremes.dGlobalZ.minX);
    // Along the beam: d = -P b x (L² - b² - x²)/(6LEI) before the load.
    for (let k = 1; k <= i; k++) {
      const x = of(v.x, k);
      const d = (-P * b * x * (L * L - b * b - x * x)) / (6 * L * E * Iy);
      expectRel(global(v, k, 2), d, REL, `uz at ${x}`);
    }
  });

  it("the mirror case, P = 12 at a = 2 of 6 m: the largest deflection is beyond the load, at √((L² - a²)/3) from the end node, with the same value (tolerance: relative 1e-12, position relative 1e-9)", () => {
    const P = 12;
    const a = 2;
    const v = values(beam({ point: [point("p1", "m1", "global", "z", -P, a)] }), "m1");
    const fromEnd = Math.sqrt((L * L - a * a) / 3);
    const dMax = (-P * a * (L * L - a * a) ** 1.5) / (9 * Math.sqrt(3) * L * E * Iy);
    expectRel(v.extremes.dGlobalZ.min, dMax, REL, "the largest deflection");
    expectRel(v.extremes.dGlobalZ.minX, L - fromEnd, 1e-9, "its position");
    expect(v.extremes.dGlobalZ.minX).toBeGreaterThan(a);
    expectRel(v.extremes.My.max, (P * a * (L - a)) / L);
    expect(v.extremes.My.maxX).toBe(a);
  });

  // Review of this card, finding 1. The slope is exactly zero at a fixed end, so the sign of the
  // slope at that station says nothing; the extreme between that station and the next must still
  // be found. Expected values by hand: with M0 = My(0) and V0 = Vz(0), before any point load
  // EI·uz' = M0·x + V0·x²/2 + w·x³/6 and EI·uz = M0·x²/2 + V0·x³/6 + w·x⁴/24.
  it("an extreme between a fixed end and the next station: a cantilever with a tip load of 10 down and 3.4 kN/m upward has a local maximum of uz of 6.27785e-7 m at 0.236884 m, found with 21 stations (tolerance: relative 1e-9)", () => {
    const model = span(ALL, [], {
      nodal: [nodal("f1", "n2", { fz: -10 })],
      uniform: [uniform("u1", "m1", "global", "z", 3.4)],
    });
    const EI = E * Iy;
    // M0 = -10·6 + 3.4·18 = 1.2, V0 = 10 - 20.4 = -10.4: the slope is x·(1.2 - 5.2x + 3.4x²/6).
    const q = 3.4 / 6;
    const xMax = (5.2 - Math.sqrt(5.2 ** 2 - 4 * q * 1.2)) / (2 * q);
    const dMax = (0.6 * xMax ** 2 - (10.4 * xMax ** 3) / 6 + (3.4 * xMax ** 4) / 24) / EI;
    expect(Math.abs(xMax - 0.236884)).toBeLessThan(5e-7);
    expect(Math.abs(dMax - 6.27785e-7)).toBeLessThan(5e-13);
    for (const stations of [21, 5, 2]) {
      const v = values(model, "m1", stations);
      expectRel(of(v.My, 0), 1.2, 1e-11);
      expect(local(v, 0, 2)).toBe(0);
      expectRel(v.extremes.dGlobalZ.max, dMax, 1e-9, `the maximum with ${stations} stations`);
      expectRel(v.extremes.dGlobalZ.maxX, xMax, 1e-9, `its position with ${stations} stations`);
      expectRel(v.extremes.dLocalZ.max, dMax, 1e-9);
      expectRel(v.extremes.dLocalZ.maxX, xMax, 1e-9);
      // The smallest value is at the tip: -P L³/(3EI) + w L⁴/(8EI).
      expectRel(v.extremes.dGlobalZ.min, (-10 * 216) / (3 * EI) + (3.4 * 1296) / (8 * EI), 1e-11);
      expect(v.extremes.dGlobalZ.minX).toBe(6);
    }
    // The same member running towards its fixed end: the zero slope is at the last station.
    const reversed = frame(
      [
        ["n1", 6, 0, 0],
        ["n2", 0, 0, 0],
      ],
      [["m1", "n1", "n2"]],
      [support("n2", ALL)],
      {
        nodal: [nodal("f1", "n1", { fz: -10 })],
        uniform: [uniform("u1", "m1", "global", "z", 3.4)],
      },
    );
    const r = values(reversed, "m1");
    expectRel(r.extremes.dGlobalZ.max, dMax, 1e-9, "the maximum, reversed");
    expectRel(r.extremes.dGlobalZ.maxX, 6 - xMax, 1e-9, "its position, reversed");
  });

  it("the same next to the fixed end of a fixed-fixed member: 2 kN/m down and 21.2 kN up at 0.336 m give a maximum of uz of about +7.03e-9 m before the first station at 0.3 m (tolerance: relative 1e-9)", () => {
    const P = 21.2;
    const a = 0.336;
    const b = L - a;
    const model = span(ALL, ALL, {
      uniform: [uniform("u1", "m1", "global", "z", -2)],
      point: [point("p1", "m1", "global", "z", P, a)],
    });
    const EI = E * Iy;
    // Fixed-end values: My(0) = -wL²/12 + P·a·b²/L², Vz(0) = wL/2 - P·b²(3a + b)/L³, with w = 2.
    const M0 = (-2 * L * L) / 12 + (P * a * b * b) / L ** 2;
    const V0 = (2 * L) / 2 - (P * b * b * (3 * a + b)) / L ** 3;
    // The slope x·(M0 + V0·x/2 - 2x²/6) is zero at the smaller root of x²/3 - V0·x/2 - M0 = 0.
    const xMax = (V0 / 2 + Math.sqrt((V0 / 2) ** 2 + (4 * M0) / 3)) / (2 / 3);
    const dMax = ((M0 * xMax ** 2) / 2 + (V0 * xMax ** 3) / 6 - (2 * xMax ** 4) / 24) / EI;
    expect(xMax).toBeGreaterThan(0);
    expect(xMax).toBeLessThan(0.3);
    expect(Math.abs(dMax - 7.03e-9)).toBeLessThan(5e-12);
    const v = values(model, "m1");
    expectRel(of(v.My, 0), M0, 1e-11);
    expectRel(of(v.Vz, 0), V0, 1e-11);
    expectRel(v.extremes.dGlobalZ.max, dMax, 1e-9, "the maximum");
    expectRel(v.extremes.dGlobalZ.maxX, xMax, 1e-9, "its position");
  });

  it("a fixed end that is itself the extreme, with no extreme next to it: the largest uz of a cantilever under a tip load, and of a fixed-fixed beam under a uniform load, is exactly 0 at x = 0, reported at the first position; the smallest is where the closed form puts it (tolerance: relative 1e-12)", () => {
    const tip = values(span(ALL, [], { nodal: [nodal("f1", "n2", { fz: -10 })] }), "m1");
    expect(tip.extremes.dGlobalZ.max).toBe(0);
    expect(tip.extremes.dGlobalZ.maxX).toBe(0);
    expectRel(tip.extremes.dGlobalZ.min, (-10 * L ** 3) / (3 * E * Iy));
    expect(tip.extremes.dGlobalZ.minX).toBe(6);
    const both = values(
      span(ALL, ALL, { uniform: [uniform("u1", "m1", "global", "z", -w)] }),
      "m1",
      4,
    );
    expect(Array.from(both.x)).toEqual([0, 2, 4, 6]);
    expect(both.extremes.dGlobalZ.max).toBe(0);
    expect(both.extremes.dGlobalZ.maxX).toBe(0);
    expectRel(both.extremes.dGlobalZ.min, (-w * L ** 4) / (384 * E * Iy));
    expectRel(both.extremes.dGlobalZ.minX, 3, 1e-9);
    // In the other plane nothing moves: both extremes are 0 at the first position.
    expect(both.extremes.dLocalY).toEqual({ min: 0, minX: 0, max: 0, maxX: 0 });
  });

  it("a propped cantilever under a uniform load (unequal end moments): -wL²/8 at the fixed end, and the largest sagging moment 9wL²/128 at 5L/8 from it, between two stations (tolerance: relative 1e-12; the position of the largest deflection relative 1e-9)", () => {
    const model = span(ALL, ["uy", "uz"], { uniform: [uniform("u1", "m1", "global", "z", -w)] });
    const v = values(model, "m1");
    expectRel(of(v.My, 0), (-w * L * L) / 8);
    expectRel(of(v.Vz, 0), (5 * w * L) / 8);
    expectRel(last(v.Vz), (-3 * w * L) / 8);
    expect(Array.from(v.x)).not.toContain(3.75);
    expectRel(v.extremes.My.max, (9 * w * L * L) / 128);
    expectRel(v.extremes.My.maxX, (5 * L) / 8);
    expectRel(v.extremes.My.min, (-w * L * L) / 8);
    expect(v.extremes.My.minX).toBe(0);
    // The largest deflection wL⁴/(185EI) (more exactly 0.0054161 wL⁴/EI) at 0.4215 L from the roller.
    const xi = (1 + Math.sqrt(33)) / 16; // from the roller, as a fraction of L: 0.42154
    const d = (-w * L ** 4 * (xi - 3 * xi ** 3 + 2 * xi ** 4)) / (48 * E * Iy);
    expectRel(v.extremes.dGlobalZ.min, d, REL, "the largest deflection");
    expectRel(v.extremes.dGlobalZ.minX, L * (1 - xi), 1e-9, "its position");
  });

  it("the same in the other plane, with a load along +Y: Mz = +wL²/8 at the fixed end and -9wL²/128 at 5L/8 (tolerance: relative 1e-12)", () => {
    const model = span(ALL, ["uy", "uz"], { uniform: [uniform("u1", "m1", "global", "y", w)] });
    const v = values(model, "m1", 5);
    expectRel(of(v.Mz, 0), (w * L * L) / 8);
    expectRel(v.extremes.Mz.min, (-9 * w * L * L) / 128);
    expectRel(v.extremes.Mz.minX, (5 * L) / 8);
  });

  it("a uniform load and a point load together: the zero of the shear is found in the right stretch (tolerance: relative 1e-12)", () => {
    // Simply supported, 6 m, w = 10 down and P = 30 down at 1 m. R1 = 30 + 25 = 55. The shear is
    // 55 - 10x before the load and 25 - 10x after it: zero at 2.5 m, where
    // M = 55 · 2.5 - 10 · 2.5²/2 - 30 · 1.5 = 61.25.
    const model = beam({
      uniform: [uniform("u1", "m1", "global", "z", -w)],
      point: [point("p1", "m1", "global", "z", -30, 1)],
    });
    const v = values(model, "m1", 4);
    expect(Array.from(v.x)).toEqual([0, 1, 1, 2, 4, 6]);
    expectRel(of(v.Vz, 1), 45);
    expectRel(of(v.Vz, 2), 15);
    expectRel(v.extremes.My.max, 61.25);
    expectRel(v.extremes.My.maxX, 2.5);
  });
});

describe("memberValues: inclined members and columns", () => {
  it("an inclined member (3, 0, 4) under a global vertical load of 10 kN/m on a pin and a roller: N runs from -20 at the foot to +20 at the top, My = 15x - 3x², 18.75 at mid-length (tolerance: relative 1e-12)", () => {
    const model = frame(
      [
        ["n1", 0, 0, 0],
        ["n2", 3, 0, 4],
      ],
      [["m1", "n1", "n2"]],
      [support("n1", ["ux", "uy", "uz", "rx", "rz"]), support("n2", ["uy", "uz"])],
      { uniform: [uniform("u1", "m1", "global", "z", -10)] },
    );
    const v = values(model, "m1");
    expect(v.length).toBe(5);
    for (let i = 0; i < v.count; i++) {
      const x = of(v.x, i);
      if (x !== 2.5) {
        expectRel(of(v.N, i), -20 + 8 * x, REL, `N at ${x}`);
        expectRel(of(v.Vz, i), 15 - 6 * x, REL, `Vz at ${x}`);
      }
      if (i > 0 && i < v.count - 1) {
        expectRel(of(v.My, i), 15 * x - 3 * x * x, REL, `My at ${x}`);
      }
    }
    expectZero(of(v.N, station(v, 2.5)), 20, "N at mid-length");
    expectRel(of(v.My, station(v, 2.5)), 18.75);
    expectRel(v.extremes.N.min, -20);
    expect(v.extremes.N.minX).toBe(0);
    expectRel(v.extremes.N.max, 20);
    expect(v.extremes.N.maxX).toBe(5);
    // Global and local deflections are the same vector: local = R · global at every station.
    for (let i = 0; i < v.count; i++) {
      const gx = global(v, i, 0);
      const gz = global(v, i, 2);
      expectZero(local(v, i, 0) - (0.6 * gx + 0.8 * gz), 1e-3, "local x", 1e-12);
      expectZero(local(v, i, 2) - (-0.8 * gx + 0.6 * gz), 1e-3, "local z", 1e-12);
    }
  });

  const H = 4;
  const wind = 3;
  const up = (direction: "x" | "y") =>
    frame(
      [
        ["base", 0, 0, 0],
        ["top", 0, 0, H],
      ],
      [["c", "base", "top"]],
      [support("base", ALL)],
      { uniform: [uniform("u1", "c", "global", direction, wind)] },
    );
  const down = (direction: "x" | "y") =>
    frame(
      [
        ["top", 0, 0, H],
        ["base", 0, 0, 0],
      ],
      [["c", "top", "base"]],
      [support("base", ALL)],
      { uniform: [uniform("u1", "c", "global", direction, wind)] },
    );

  it("a cantilever column under wind along +X, running upward and running downward: the moment wH²/2 at the base has opposite signs of My (local z is -X, then +X), the ordinate drawn towards -z falls on the same side (-X, the tension side) for both, and the sway is the same (tolerance: relative 1e-12)", () => {
    const a = values(up("x"), "c");
    const b = values(down("x"), "c");
    expect(a.axes.z.x).toBe(-1);
    expect(b.axes.z.x).toBe(1);
    expectRel(of(a.My, 0), (-wind * H * H) / 2, REL, "My at the base, upward");
    expectRel(last(b.My), (wind * H * H) / 2, REL, "My at the base, downward");
    expectRel(of(a.Vz, 0), wind * H, REL, "Vz at the base, upward");
    expectRel(last(b.Vz), wind * H, REL, "Vz at the base, downward");
    for (let i = 0; i < a.count; i++) {
      const height = of(a.x, i);
      // The station of the downward column at the same height (H - height, up to rounding).
      const j = a.count - 1 - i;
      expect(Math.abs(of(b.x, j) - (H - height))).toBeLessThan(1e-12);
      // The ordinate of the diagram as a vector in global axes: -My · (local z).
      const sideA = -of(a.My, i) * a.axes.z.x;
      const sideB = -of(b.My, j) * b.axes.z.x;
      if (height < H) {
        expectRel(sideA, (-wind * (H - height) ** 2) / 2, REL, `the ordinate at ${height}, upward`);
        expectRel(sideB, (-wind * (H - height) ** 2) / 2, REL, `the same, downward`);
      }
      if (height > 0) {
        const sway =
          (wind * height ** 2 * (6 * H * H - 4 * H * height + height ** 2)) / (24 * E * Iy);
        expectRel(global(a, i, 0), sway, REL, `the sway at ${height}, upward`);
        expectRel(global(b, j, 0), sway, REL, `the same, downward`);
        expectRel(local(a, i, 2), -sway, REL);
        expectRel(local(b, j, 2), sway, REL);
      }
    }
  });

  it("the same columns under wind along +Y: bending about local z with Iz; Mz = +wH²/2 at the base of both (local y is +Y for both: tension on the -Y side) (tolerance: relative 1e-12)", () => {
    const a = values(up("y"), "c");
    const b = values(down("y"), "c");
    expect(a.axes.y.y).toBe(1);
    expect(b.axes.y.y).toBe(1);
    expectRel(of(a.Mz, 0), (wind * H * H) / 2, REL, "Mz at the base, upward");
    expectRel(last(b.Mz), (wind * H * H) / 2, REL, "Mz at the base, downward");
    expectRel(of(a.Vy, 0), -wind * H, REL, "Vy at the base, upward");
    expectRel(last(b.Vy), wind * H, REL, "Vy at the base, downward");
    expectRel(global(a, 20, 1), (wind * H ** 4) / (8 * E * Iz), REL, "the sway at the top");
    expectRel(global(b, 0, 1), (wind * H ** 4) / (8 * E * Iz), REL, "the sway at the top");
    for (let i = 0; i < a.count; i++) {
      expectZero(of(a.My, i), 24);
      expectZero(of(b.My, i), 24);
    }
  });

  it("a column under its own vertical load and a load on top: N is compression, growing towards the base, whichever way the column runs (tolerance: relative 1e-12)", () => {
    for (const [model, baseFirst] of [
      [up("x"), true],
      [down("x"), false],
    ] as const) {
      model.memberUniformLoads = [uniform("u1", "c", "global", "z", -2)];
      model.nodalLoads = [nodal("f1", "top", { fz: -50 })];
      const v = values(model, "c");
      for (let i = 0; i < v.count; i++) {
        const height = baseFirst ? of(v.x, i) : H - of(v.x, i);
        expectRel(of(v.N, i), -50 - 2 * (H - height), REL, `N at the height ${height}`);
      }
    }
  });
});

/** Local axes helpers for the frame tests. */
function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function globalOf(axes: LocalAxes, c: readonly [number, number, number]): Vec3 {
  return {
    x: axes.x.x * c[0] + axes.y.x * c[1] + axes.z.x * c[2],
    y: axes.x.y * c[0] + axes.y.y * c[1] + axes.z.y * c[2],
    z: axes.x.z * c[0] + axes.y.z * c[1] + axes.z.z * c[2],
  };
}

/**
 * For every station of a member, the largest residual of the equilibrium of the part BEYOND the cut:
 * minus the actions on the positive face, the loads beyond the cut and the end node's end force.
 * `memberValues` computes from the start end force, so this uses what it did not use. The actions
 * on the positive face are R = (N, -Vy, -Vz) and C = (T, -My, Mz).
 */
function largestStationResidual(model: Model, result: Solved, memberId: string): number {
  const v = memberValues(model, result, "lc1", memberId, 7);
  const endForces = loadCase(result).memberEndForces[memberId];
  if (!v || !endForces) {
    throw new Error(`test: no values for ${memberId}`);
  }
  const end = endForces.end;
  const length = v.length;
  let largest = 0;
  for (let i = 0; i < v.count; i++) {
    const x = of(v.x, i);
    const before = i + 1 < v.count && of(v.x, i + 1) === x;
    const force = [end.fx - of(v.N, i), end.fy + of(v.Vy, i), end.fz + of(v.Vz, i)];
    const arm = length - x;
    // (arm, 0, 0) × (fx, fy, fz) = (0, -arm · fz, arm · fy)
    const moment = [
      end.mx - of(v.T, i),
      end.my + of(v.My, i) - arm * end.fz,
      end.mz - of(v.Mz, i) + arm * end.fy,
    ];
    for (const load of model.memberUniformLoads) {
      if (load.memberId !== memberId) {
        continue;
      }
      const [px, py, pz] = memberLoadLocalComponents(load, v.axes);
      force[0] = (force[0] as number) + px * arm;
      force[1] = (force[1] as number) + py * arm;
      force[2] = (force[2] as number) + pz * arm;
      moment[1] = (moment[1] as number) - (arm / 2) * pz * arm;
      moment[2] = (moment[2] as number) + (arm / 2) * py * arm;
    }
    for (const load of model.memberPointLoads) {
      if (load.memberId !== memberId) {
        continue;
      }
      const a = Math.min(Math.max(load.position, 0), length);
      if (!(a > x || (a === x && before))) {
        continue;
      }
      const [px, py, pz] = memberLoadLocalComponents(load, v.axes);
      force[0] = (force[0] as number) + px;
      force[1] = (force[1] as number) + py;
      force[2] = (force[2] as number) + pz;
      moment[1] = (moment[1] as number) - (a - x) * pz;
      moment[2] = (moment[2] as number) + (a - x) * py;
    }
    largest = Math.max(largest, ...force.map(Math.abs), ...moment.map(Math.abs));
  }
  return largest;
}

/** A space frame of three skew members with roll angles, fixed at two bases, loaded on m1 and m2. */
function spaceFrame(): Model {
  return frame(
    [
      ["a", 0, 0, 0],
      ["b", 2, 3, 6],
      ["c", 7, 4, 5],
      ["d", 8, -1, 0],
    ],
    [
      ["m1", "a", "b", 40],
      ["m2", "b", "c", -25],
      ["m3", "d", "c", 110],
    ],
    [support("a", ALL), support("d", ALL)],
    {
      nodal: [nodal("f1", "b", { fx: 4, fy: -6, mz: 3 }), nodal("f2", "c", { mx: -2, fz: -5 })],
      uniform: [
        uniform("u1", "m2", "global", "z", -7),
        uniform("u2", "m2", "local", "y", 3),
        uniform("u3", "m2", "local", "x", 4),
        uniform("u4", "m1", "global", "y", 2),
      ],
      point: [
        point("p1", "m1", "local", "z", 4, 0),
        point("p2", "m1", "global", "z", -3, 7),
        point("p3", "m1", "local", "y", 5, 2),
        point("p4", "m3", "global", "x", 6, 1.5),
      ],
    },
  );
}

describe("memberValues: the ends against the member end forces", () => {
  it("at the first station N = -fx, Vy = +fy, Vz = +fz, T = -mx, My = +my, Mz = -mz of the start end force (exactly), and at the last N = +fx, Vy = -fy, Vz = -fz, T = +mx, My = -my, Mz = +mz of the end end force, for skew rolled members with point loads at position 0 and at the length (tolerance: 1e-12 · 300 kN·m)", () => {
    const model = spaceFrame();
    const result = solved(model);
    for (const memberId of ["m1", "m2", "m3"]) {
      const v = memberValues(model, result, "lc1", memberId);
      const f = loadCase(result).memberEndForces[memberId];
      if (!v || !f) {
        throw new Error("test: no values");
      }
      const n = v.count - 1;
      expect(of(v.N, 0)).toBe(-f.start.fx);
      expect(of(v.Vy, 0)).toBe(f.start.fy);
      expect(of(v.Vz, 0)).toBe(f.start.fz);
      expect(of(v.T, 0)).toBe(-f.start.mx);
      expect(of(v.My, 0)).toBe(f.start.my);
      expect(of(v.Mz, 0)).toBe(-f.start.mz);
      expectZero(of(v.N, n) - f.end.fx, 300, `${memberId} N`);
      expectZero(of(v.Vy, n) + f.end.fy, 300, `${memberId} Vy`);
      expectZero(of(v.Vz, n) + f.end.fz, 300, `${memberId} Vz`);
      expectZero(of(v.T, n) - f.end.mx, 300, `${memberId} T`);
      expectZero(of(v.My, n) + f.end.my, 300, `${memberId} My`);
      expectZero(of(v.Mz, n) - f.end.mz, 300, `${memberId} Mz`);
    }
    // m1 has a point load at each end: two stations there, and the loads are between them.
    const m1 = memberValues(model, result, "lc1", "m1") as MemberValues;
    expect(m1.length).toBe(7);
    expect(of(m1.x, 1)).toBe(0);
    expect(of(m1.x, m1.count - 2)).toBe(7);
    expectRel(of(m1.Vz, 1) - of(m1.Vz, 0), 4, 1e-11);
    // The size the tolerance is taken from: the largest moment of m1 is between 1 and 300 kN·m.
    expect(Math.abs(m1.extremes.My.min)).toBeGreaterThan(1);
    expect(Math.abs(m1.extremes.My.min)).toBeLessThan(300);
  });

  it("a nodal load on a node is not in the member's values, a point load at position 0 is: the two stations at the start differ by it", () => {
    const withNodal = values(span(ALL, [], { nodal: [nodal("f1", "n1", { fz: -9 })] }), "m1", 3);
    expect(withNodal.count).toBe(3);
    expect(of(withNodal.Vz, 0)).toBe(0);
    const withPoint = values(
      span(ALL, [], { point: [point("p1", "m1", "global", "z", -9, 0)] }),
      "m1",
      3,
    );
    expect(Array.from(withPoint.x)).toEqual([0, 0, 3, 6]);
    expectRel(of(withPoint.Vz, 0), 9);
    expectZero(of(withPoint.Vz, 1), 9);
  });
});

describe("memberValues: frames", () => {
  function loadedPortal(): Model {
    const model = portalFrame();
    model.memberUniformLoads.push(
      uniform("u1", "b1", "global", "z", -10),
      uniform("u2", "c1", "global", "x", 3),
    );
    model.memberPointLoads.push(
      point("p1", "b1", "global", "z", -15, 2),
      point("p2", "c2", "global", "x", -8, 1),
      point("p3", "b1", "local", "x", 5, 6),
    );
    return model;
  }

  it("the portal frame fixture with a beam load, a wind load and point loads: every station of every member is in equilibrium with the END end force and the loads beyond it (tolerance: 1e-12 · 300 kN·m)", () => {
    const model = loadedPortal();
    const result = solved(model);
    for (const memberId of ["c1", "b1", "c2"]) {
      expect(largestStationResidual(model, result, memberId), memberId).toBeLessThan(1e-12 * 300);
    }
  });

  it("this equilibrium check fails for a wrong value: a shear, a moment or an axial force changed by 1e-6", () => {
    const model = loadedPortal();
    const result = solved(model);
    for (const component of ["fx", "fy", "fz", "mx", "my", "mz"] as const) {
      const changed = structuredClone(result);
      const end = loadCase(changed).memberEndForces.b1?.end;
      if (!end) {
        throw new Error("test: no end force");
      }
      end[component] += 1e-6;
      expect(largestStationResidual(model, changed, "b1")).toBeGreaterThan(5e-7);
    }
  });

  it("the same for the space frame of skew rolled members (tolerance: 1e-12 · 300 kN·m)", () => {
    const model = spaceFrame();
    const result = solved(model);
    for (const memberId of ["m1", "m2", "m3"]) {
      expect(largestStationResidual(model, result, memberId), memberId).toBeLessThan(1e-12 * 300);
    }
  });

  it("moment continuity around the rigid joints of the portal: the in-plane moment of the column's top equals the beam's at n2 and is its opposite at n3 (the columns' local z is -X: the inner face of the left column, the outer face of the right one), and as vectors the moments at each joint sum to zero (tolerance: 1e-12 · 300 kN·m)", () => {
    const model = loadedPortal();
    const result = solved(model);
    const c1 = memberValues(model, result, "lc1", "c1") as MemberValues;
    const b1 = memberValues(model, result, "lc1", "b1") as MemberValues;
    const c2 = memberValues(model, result, "lc1", "c2") as MemberValues;
    expectZero(last(c1.My) - of(b1.My, 0), 300, "n2");
    expectZero(last(c2.My) + last(b1.My), 300, "n3");
    expect(Math.abs(of(b1.My, 0))).toBeGreaterThan(1);
    expect(Math.abs(last(b1.My))).toBeGreaterThan(1);
    // As vectors: the moment the joint applies to a member END is (T, -My, Mz) at its last station,
    // and to a member START (-T, My, -Mz) at its first; no moment is applied to these joints.
    const atEnd = (v: MemberValues) => globalOf(v.axes, [last(v.T), -last(v.My), last(v.Mz)]);
    const atStart = (v: MemberValues) => globalOf(v.axes, [-of(v.T, 0), of(v.My, 0), -of(v.Mz, 0)]);
    for (const [p, q] of [
      [atEnd(c1), atStart(b1)],
      [atEnd(b1), atEnd(c2)],
    ] as const) {
      expectZero(p.x + q.x, 300);
      expectZero(p.y + q.y, 300);
      expectZero(p.z + q.z, 300);
    }
  });

  it("the portal under a beam load alone: the beam hogs at both joints and sags at mid-span, and the tension at the top of each column is on its outer face (tolerance: signs; symmetry within 1e-9 · the joint moment)", () => {
    const model = portalFrame();
    model.nodalLoads = [];
    model.memberUniformLoads.push(uniform("u1", "b1", "global", "z", -10));
    const result = solved(model);
    const c1 = memberValues(model, result, "lc1", "c1") as MemberValues;
    const b1 = memberValues(model, result, "lc1", "b1") as MemberValues;
    const c2 = memberValues(model, result, "lc1", "c2") as MemberValues;
    expect(of(b1.My, 0)).toBeLessThan(0);
    expect(last(b1.My)).toBeLessThan(0);
    expect(of(b1.My, station(b1, 3))).toBeGreaterThan(0);
    // The ordinate towards -z, as a global X component: -My · z.x. Left column: outer is -X.
    expect(-last(c1.My) * c1.axes.z.x).toBeLessThan(0);
    // Right column: outer is +X.
    expect(-last(c2.My) * c2.axes.z.x).toBeGreaterThan(0);
    expectZero(of(b1.My, 0) - last(b1.My), Math.abs(of(b1.My, 0)), "symmetry", 1e-9);
    // Both columns are in compression and carry half the load each.
    expectRel(of(c1.N, 0), -30, 1e-9);
    expectRel(of(c2.N, 0), -30, 1e-9);
  });

  // The reference has a node at every eighth of m2, where the solver's displacements are exact for
  // this element, and carries m2's point loads as nodal loads. Tolerance 1e-9 of the largest value:
  // two different systems of equations are solved (the test also passes at 1e-10).
  it("against a finer model: the deflections and the six actions at the eighth points of a skew rolled member with uniform and point loads in local and global axes equal the node displacements and the end forces of the pieces (tolerance: 1e-9 of the largest value)", () => {
    const coarse = spaceFrame();
    const fine = spaceFrame();
    const start = { x: 2, y: 3, z: 6 };
    const end = { x: 7, y: 4, z: 5 };
    const axes = memberLocalAxes(start, end, -25) as LocalAxes;
    const length = Math.hypot(5, 1, 1);
    // Two point loads inside m2, at a quarter and at three quarters, in both models.
    coarse.memberPointLoads.push(
      point("q1", "m2", "local", "z", -9, 0.25 * length),
      point("q2", "m2", "global", "x", 5, 0.75 * length),
      point("q3", "m2", "local", "x", 6, 0.25 * length),
      point("q4", "m2", "local", "y", 2.5, 0.75 * length),
    );
    const pieces = 8;
    fine.members = fine.members.filter((member) => member.id !== "m2");
    fine.memberUniformLoads = fine.memberUniformLoads.filter((load) => load.memberId !== "m2");
    const nodeId = (k: number) => (k === 0 ? "b" : k === pieces ? "c" : `k${k}`);
    for (let k = 1; k < pieces; k++) {
      const t = k / pieces;
      fine.nodes.push({
        id: nodeId(k),
        x: start.x + t * (end.x - start.x),
        y: start.y + t * (end.y - start.y),
        z: start.z + t * (end.z - start.z),
      });
    }
    for (let k = 0; k < pieces; k++) {
      const template = coarse.members.find((member) => member.id === "m2");
      if (!template) {
        throw new Error("test: no m2");
      }
      fine.members.push({
        ...structuredClone(template),
        id: `piece${k}`,
        startNodeId: nodeId(k),
        endNodeId: nodeId(k + 1),
      });
      fine.memberUniformLoads.push(
        uniform(`u1-${k}`, `piece${k}`, "global", "z", -7),
        uniform(`u2-${k}`, `piece${k}`, "local", "y", 3),
        uniform(`u3-${k}`, `piece${k}`, "local", "x", 4),
      );
    }
    const quarter = globalOf(axes, [6, 0, -9]);
    const threeQuarters = globalOf(axes, [0, 2.5, 0]);
    fine.nodalLoads.push(
      nodal("q13", "k2", { fx: quarter.x, fy: quarter.y, fz: quarter.z }),
      nodal("q24", "k6", {
        fx: threeQuarters.x + 5,
        fy: threeQuarters.y,
        fz: threeQuarters.z,
      }),
    );
    const v = values(coarse, "m2", 9);
    expect(v.count).toBe(11);
    const reference = loadCase(solved(fine));
    let largestDeflection = 0;
    let largestAction = 0;
    for (const nodeDisplacement of Object.values(reference.displacements)) {
      largestDeflection = Math.max(
        largestDeflection,
        Math.abs(nodeDisplacement.ux),
        Math.abs(nodeDisplacement.uy),
        Math.abs(nodeDisplacement.uz),
      );
    }
    for (let k = 0; k < pieces; k++) {
      const piece = reference.memberEndForces[`piece${k}`];
      if (!piece) {
        throw new Error("test: no piece");
      }
      for (const value of [...Object.values(piece.start), ...Object.values(piece.end)]) {
        largestAction = Math.max(largestAction, Math.abs(value));
      }
    }
    expect(largestDeflection).toBeGreaterThan(1e-3);
    expect(largestAction).toBeGreaterThan(10);
    for (let k = 0; k <= pieces; k++) {
      const x = k === pieces ? v.length : (v.length * k) / pieces;
      const d = reference.displacements[nodeId(k)];
      if (!d) {
        throw new Error("test: no node");
      }
      for (const side of ["first", "last"] as const) {
        const i = station(v, x, side);
        expectZero(global(v, i, 0) - d.ux, largestDeflection, `ux at ${k}/8`, 1e-9);
        expectZero(global(v, i, 1) - d.uy, largestDeflection, `uy at ${k}/8`, 1e-9);
        expectZero(global(v, i, 2) - d.uz, largestDeflection, `uz at ${k}/8`, 1e-9);
      }
      // After the node: the start of the piece that begins there. Before it: the end of the piece
      // that ends there.
      if (k < pieces) {
        const f = reference.memberEndForces[`piece${k}`]?.start;
        const i = station(v, x, "last");
        if (!f) {
          throw new Error("test: no piece");
        }
        const got = [of(v.N, i), of(v.Vy, i), of(v.Vz, i), of(v.T, i), of(v.My, i), of(v.Mz, i)];
        const expected = [-f.fx, f.fy, f.fz, -f.mx, f.my, -f.mz];
        got.forEach((value, q) => {
          expectZero(
            value - (expected[q] as number),
            largestAction,
            `action ${q} after ${k}/8`,
            1e-9,
          );
        });
      }
      if (k > 0) {
        const f = reference.memberEndForces[`piece${k - 1}`]?.end;
        const i = station(v, x, "first");
        if (!f) {
          throw new Error("test: no piece");
        }
        const got = [of(v.N, i), of(v.Vy, i), of(v.Vz, i), of(v.T, i), of(v.My, i), of(v.Mz, i)];
        const expected = [f.fx, -f.fy, -f.fz, f.mx, -f.my, f.mz];
        got.forEach((value, q) => {
          expectZero(
            value - (expected[q] as number),
            largestAction,
            `action ${q} before ${k}/8`,
            1e-9,
          );
        });
      }
    }
    // The point loads show as jumps at the quarter and at three quarters.
    const i = station(v, 0.25 * length);
    expectRel(of(v.Vz, i + 1) - of(v.Vz, i), -9, 1e-10);
    expectRel(of(v.N, i + 1) - of(v.N, i), -6, 1e-10);
    expect(cross(axes.x, axes.y).x).toBeCloseTo(axes.z.x, 12);
  });

  it("the values of one load case do not hold the loads of another", () => {
    const model = simplySupportedBeam();
    model.loadCases.push({ id: "lc2", name: "LC2" });
    model.memberPointLoads.push({ ...point("p1", "m1", "global", "z", -12, 4), loadCaseId: "lc2" });
    const result = solved(model);
    const one = memberValues(model, result, "lc1", "m1") as MemberValues;
    const two = memberValues(model, result, "lc2", "m1") as MemberValues;
    expect(one.count).toBe(21);
    expectRel(of(one.My, station(one, 3)), 45);
    expect(two.count).toBe(23);
    expectRel(two.extremes.My.max, 16);
    expectRel(of(two.Vz, 0), 4);
  });
});

describe("deflectedShape", () => {
  it("the simply supported beam: 5 points per member, each the point of the axis plus scale times the deflection (tolerance: relative 1e-12)", () => {
    const model = simplySupportedBeam();
    const result = solved(model);
    const shape = deflectedShape(model, result, "lc1", 100, 5);
    if (!shape) {
      throw new Error("test: no shape");
    }
    expect(shape.memberIds).toEqual(["m1"]);
    expect(shape.stations).toBe(5);
    expect(shape.scale).toBe(100);
    expect(shape.loadCaseId).toBe("lc1");
    expect(shape.points.length).toBe(15);
    const EI = E * Iy;
    const d = (x: number) => (-w * x * (L ** 3 - 2 * L * x * x + x ** 3)) / (24 * EI);
    [0, 1.5, 3, 4.5, 6].forEach((x, s) => {
      expect(of(shape.points, 3 * s)).toBe(x);
      expect(of(shape.points, 3 * s + 1)).toBe(0);
      if (s === 0 || s === 4) {
        expect(of(shape.points, 3 * s + 2)).toBe(0);
      } else {
        expectRel(of(shape.points, 3 * s + 2), 100 * d(x), REL, `z at ${x}`);
      }
    });
    expectRel(of(shape.points, 8), (-100 * 5 * w * L ** 4) / (384 * EI));
    // With the scale 0 the points are on the undeformed axis.
    const flat = deflectedShape(model, result, "lc1", 0, 3);
    expect(Array.from(flat?.points ?? [])).toEqual([0, 0, 0, 3, 0, 0, 6, 0, 0]);
    expect(deflectedShape(model, result, "lc1", 1)?.stations).toBe(21);
  });

  it("the loaded space frame: members in the model's order; the first and last point of every member are its nodes plus scale times their displacements (tolerance: 1e-12 · 10 m), and the points between agree with memberValues", () => {
    const model = spaceFrame();
    const result = solved(model);
    const scale = 25;
    const n = 6;
    const shape = deflectedShape(model, result, "lc1", scale, n);
    if (!shape) {
      throw new Error("test: no shape");
    }
    expect(shape.memberIds).toEqual(["m1", "m2", "m3"]);
    expect(shape.points.length).toBe(3 * n * 3);
    const displacements = loadCase(result).displacements;
    model.members.forEach((member, m) => {
      const v = memberValues(model, result, "lc1", member.id, n) as MemberValues;
      const ends = [
        [member.startNodeId, 0],
        [member.endNodeId, n - 1],
      ] as const;
      for (const [id, s] of ends) {
        const node = model.nodes.find((candidate) => candidate.id === id);
        const d = displacements[id];
        if (!node || !d) {
          throw new Error("test: no node");
        }
        const to = 3 * (m * n + s);
        expectZero(of(shape.points, to) - (node.x + scale * d.ux), 10, `${member.id} x`);
        expectZero(of(shape.points, to + 1) - (node.y + scale * d.uy), 10, `${member.id} y`);
        expectZero(of(shape.points, to + 2) - (node.z + scale * d.uz), 10, `${member.id} z`);
      }
      const a = model.nodes.find((candidate) => candidate.id === member.startNodeId) as Vec3;
      for (let s = 0; s < n; s++) {
        const x = s === n - 1 ? v.length : (v.length * s) / (n - 1);
        const i = station(v, x);
        const to = 3 * (m * n + s);
        const expected = [
          a.x + v.axes.x.x * x + scale * global(v, i, 0),
          a.y + v.axes.x.y * x + scale * global(v, i, 1),
          a.z + v.axes.x.z * x + scale * global(v, i, 2),
        ];
        expected.forEach((value, k) => {
          expectZero(of(shape.points, to + k) - value, 10, `${member.id} point ${s}`);
        });
      }
    });
  });

  it("the shape of one load case does not hold the member loads of another", () => {
    const model = simplySupportedBeam();
    const alone = deflectedShape(model, solved(model), "lc1", 100, 5);
    model.loadCases.push({ id: "lc2", name: "LC2" });
    model.memberPointLoads.push({ ...point("p1", "m1", "global", "z", -12, 4), loadCaseId: "lc2" });
    model.memberUniformLoads.push({
      ...uniform("u2", "m1", "global", "z", -3),
      loadCaseId: "lc2",
    });
    const result = solved(model);
    expect(deflectedShape(model, result, "lc1", 100, 5)).toEqual(alone);
    // The other case: 3 kN/m and 12 kN at 4 m; the mid-span deflection is the sum of the two.
    const other = deflectedShape(model, result, "lc2", 1, 5);
    const d =
      (-5 * 3 * L ** 4) / (384 * E * Iy) + (-12 * 2 * 3 * (L * L - 4 - 9)) / (6 * L * E * Iy);
    expectRel(of(other?.points ?? new Float64Array(15), 8), d, REL);
  });

  it("a truss or released member is drawn as the straight line between its displaced ends", () => {
    const model = simplySupportedBeam();
    const result = solved(model);
    // `solve` refuses such members, so the plain model's result is given with a changed model. The
    // ends of this beam do not move along Z, so the line is the undeformed axis moved along X.
    const truss = simplySupportedBeam();
    (truss.members[0] as Model["members"][number]).kind = "truss";
    const shape = deflectedShape(truss, result, "lc1", 100, 3);
    const ux2 = loadCase(result).displacements.n2?.ux ?? Number.NaN;
    expect(Array.from(shape?.points ?? [])).toEqual([
      0,
      0,
      0,
      3 + 50 * ux2,
      0,
      0,
      6 + 100 * ux2,
      0,
      0,
    ]);
    const bent = deflectedShape(simplySupportedBeam(), result, "lc1", 100, 3);
    expect(of(bent?.points ?? new Float64Array(9), 5)).toBeLessThan(-0.5);
  });
});

describe("the cost for the interface", () => {
  it("200 members at 21 stations: 7 arrays of 21 and 2 of 63 numbers per member, 436 800 bytes of numbers in all; the deflected shape is one array of 100 800 bytes", () => {
    const model = buildingFrame(3, 3, 5);
    expect(model.members.length).toBe(200);
    const result = solved(model);
    let bytes = 0;
    for (const member of model.members) {
      const v = memberValues(model, result, "gravity", member.id);
      if (!v) {
        throw new Error("test: no values");
      }
      expect(v.count).toBe(21);
      for (const value of Object.values(v)) {
        if (value instanceof Float64Array) {
          bytes += value.byteLength;
        }
      }
    }
    expect(bytes).toBe(200 * (7 * 21 + 2 * 63) * 8);
    expect(bytes).toBe(436800);
    expect(deflectedShape(model, result, "gravity", 100)?.points.byteLength).toBe(100800);
  });

  // A loose bound, far above the measured time (README, "Values along a member"), so that a slow
  // machine passes.
  it("the values of all 200 members and the deflected shape take under 1 second together", () => {
    const model = buildingFrame(3, 3, 5);
    const result = solved(model);
    const started = performance.now();
    for (const member of model.members) {
      memberValues(model, result, "gravity", member.id);
    }
    deflectedShape(model, result, "gravity", 100);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
