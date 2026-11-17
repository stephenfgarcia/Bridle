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
import {
  DOFS,
  equivalentNodalLoadsLocal,
  type LoadCaseResult,
  type MemberEndAction,
  type MemberLoad,
  memberLoadLocalComponents,
  REACTION_COMPONENTS,
  solve,
} from "./index";

/**
 * Tolerances. Each test names the one it uses.
 * - REL: |computed - expected| <= 1e-12 · |expected|, for a value with a closed-form expression.
 * - ZERO: a value that is zero in exact arithmetic may be at most 1e-12 times a scale given in the
 *   test (a force, a moment or a displacement of the same case).
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
type Component = (typeof REACTION_COMPONENTS)[number];
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

function nodal(
  id: string,
  nodeId: string,
  components: Partial<Record<Component, number>>,
  loadCaseId = "lc1",
): NodalLoad {
  return { id, loadCaseId, nodeId, fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0, ...components };
}

function uniform(
  id: string,
  memberId: string,
  axes: "global" | "local",
  direction: "x" | "y" | "z",
  value: number,
  loadCaseId = "lc1",
): MemberUniformLoad {
  return { id, loadCaseId, memberId, axes, direction, value };
}

function point(
  id: string,
  memberId: string,
  axes: "global" | "local",
  direction: "x" | "y" | "z",
  value: number,
  position: number,
  loadCaseId = "lc1",
): MemberPointLoad {
  return { id, loadCaseId, memberId, axes, direction, value, position };
}

/**
 * A model of frame members with the fixtures' section `s1` and material `mat1`, and load case `lc1`.
 * A member may carry a roll angle in degrees as its fourth entry.
 */
function frame(
  nodes: [id: string, x: number, y: number, z: number][],
  members: [id: string, start: string, end: string, rollAngleDeg?: number][],
  supports: Support[],
  loads: {
    nodal?: NodalLoad[];
    uniform?: MemberUniformLoad[];
    point?: MemberPointLoad[];
  } = {},
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

/** The result of one load case of a model that must solve. */
function solved(model: Model, loadCaseId = "lc1"): LoadCaseResult {
  const result = solve(model);
  if (!result.ok) {
    throw new Error(`test: expected the model to solve, got ${JSON.stringify(result)}`);
  }
  const loadCase = result.loadCases[loadCaseId];
  if (loadCase === undefined) {
    throw new Error(`test: no result for load case ${loadCaseId}`);
  }
  return loadCase;
}

function get<T>(record: Record<string, T>, key: string): T {
  const value = record[key];
  if (value === undefined) {
    throw new Error(`test: no entry ${key}`);
  }
  return value;
}

function expectRel(actual: number, expected: number, tolerance: number, what?: string): void {
  expect(Math.abs(actual - expected), what).toBeLessThanOrEqual(tolerance * Math.abs(expected));
}

function expectZero(actual: number, scale: number, what?: string, tolerance = ZERO): void {
  expect(Math.abs(actual), what).toBeLessThanOrEqual(tolerance * scale);
}

/**
 * Checks the six components of an entry: `expected` gives the nonzero ones (within `tolerance`,
 * relative), the others must be zero within `tolerance` · `zeroScale`.
 */
function expectSix<K extends string>(
  actual: Record<K, number>,
  keys: readonly K[],
  expected: Partial<Record<K, number>>,
  zeroScale: number,
  tolerance = REL,
  what = "",
): void {
  for (const key of keys) {
    const value = expected[key];
    if (value === undefined) {
      expectZero(actual[key], zeroScale, `${what} ${key}`, tolerance);
    } else {
      expectRel(actual[key], value, tolerance, `${what} ${key}`);
    }
  }
}

const F = REACTION_COMPONENTS;

function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** The vector with the components (cx, cy, cz) along the local axes, in global coordinates. */
function toGlobal(axes: LocalAxes, cx: number, cy: number, cz: number): Vec3 {
  return {
    x: axes.x.x * cx + axes.y.x * cy + axes.z.x * cz,
    y: axes.x.y * cx + axes.y.y * cy + axes.z.y * cz,
    z: axes.x.z * cx + axes.y.z * cy + axes.z.z * cz,
  };
}

interface MemberGeometry {
  start: Vec3;
  end: Vec3;
  length: number;
  axes: LocalAxes;
}

function geometry(model: Model, memberId: string): MemberGeometry {
  const member = model.members.find((item) => item.id === memberId);
  const start = model.nodes.find((node) => node.id === member?.startNodeId);
  const end = model.nodes.find((node) => node.id === member?.endNodeId);
  const axes =
    start && end && member ? memberLocalAxes(start, end, member.rollAngleDeg) : undefined;
  if (!start || !end || !axes) {
    throw new Error(`test: no member ${memberId}`);
  }
  return {
    start,
    end,
    length: Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z),
    axes,
  };
}

/**
 * The loads on one member in one load case as resultants, written here without the solver: each is
 * a force vector in global coordinates and its distance from the start node along the member (a
 * uniform load is its total at mid-length).
 */
function memberLoadResultants(
  model: Model,
  memberId: string,
  loadCaseId: string,
): { force: Vec3; at: number }[] {
  const g = geometry(model, memberId);
  const unitVector = (load: MemberLoad): Vec3 => {
    if (load.axes === "local") {
      return g.axes[load.direction];
    }
    return {
      x: load.direction === "x" ? 1 : 0,
      y: load.direction === "y" ? 1 : 0,
      z: load.direction === "z" ? 1 : 0,
    };
  };
  const scale = (v: Vec3, k: number): Vec3 => ({ x: v.x * k, y: v.y * k, z: v.z * k });
  const out: { force: Vec3; at: number }[] = [];
  for (const load of model.memberUniformLoads) {
    if (load.memberId === memberId && load.loadCaseId === loadCaseId) {
      out.push({ force: scale(unitVector(load), load.value * g.length), at: g.length / 2 });
    }
  }
  for (const load of model.memberPointLoads) {
    if (load.memberId === memberId && load.loadCaseId === loadCaseId) {
      out.push({ force: scale(unitVector(load), load.value), at: load.position });
    }
  }
  return out;
}

/**
 * The equilibrium of one member as a free body, in its local axes: the two end actions and the
 * member's own loads. Returns the three force sums and the three moment sums about the start node;
 * all six are zero for a member in equilibrium.
 */
function memberResidual(model: Model, result: LoadCaseResult, memberId: string): number[] {
  const g = geometry(model, memberId);
  const { start, end } = get(result.memberEndForces, memberId);
  // The end action acts at (L, 0, 0): its force adds (L, 0, 0) × (fx, fy, fz) = (0, -L fz, L fy).
  const sum = [
    start.fx + end.fx,
    start.fy + end.fy,
    start.fz + end.fz,
    start.mx + end.mx,
    start.my + end.my - g.length * end.fz,
    start.mz + end.mz + g.length * end.fy,
  ];
  for (const { force, at } of memberLoadResultants(model, memberId, result.loadCaseId)) {
    const fx = dot(force, g.axes.x);
    const fy = dot(force, g.axes.y);
    const fz = dot(force, g.axes.z);
    sum[0] = (sum[0] as number) + fx;
    sum[1] = (sum[1] as number) + fy;
    sum[2] = (sum[2] as number) + fz;
    sum[4] = (sum[4] as number) - at * fz;
    sum[5] = (sum[5] as number) + at * fy;
  }
  return sum;
}

/**
 * The equilibrium of every node: the nodal loads on it, its reaction, and minus the end actions of
 * the members that meet there (a node applies the end action to the member, so the member applies
 * the opposite to the node), all in global axes. Returns the largest absolute sum found.
 */
function largestNodeResidual(model: Model, result: LoadCaseResult): number {
  const sums = new Map<string, number[]>(model.nodes.map((node) => [node.id, [0, 0, 0, 0, 0, 0]]));
  const add = (nodeId: string, values: number[]): void => {
    const sum = sums.get(nodeId) as number[];
    values.forEach((value, i) => {
      sum[i] = (sum[i] as number) + value;
    });
  };
  for (const load of model.nodalLoads) {
    if (load.loadCaseId === result.loadCaseId) {
      add(load.nodeId, [load.fx, load.fy, load.fz, load.mx, load.my, load.mz]);
    }
  }
  for (const [nodeId, r] of Object.entries(result.reactions)) {
    add(nodeId, [r.fx, r.fy, r.fz, r.mx, r.my, r.mz]);
  }
  for (const member of model.members) {
    const g = geometry(model, member.id);
    const ends = get(result.memberEndForces, member.id);
    const onNode = (nodeId: string, action: MemberEndAction): void => {
      const force = toGlobal(g.axes, action.fx, action.fy, action.fz);
      const moment = toGlobal(g.axes, action.mx, action.my, action.mz);
      add(nodeId, [-force.x, -force.y, -force.z, -moment.x, -moment.y, -moment.z]);
    };
    onNode(member.startNodeId, ends.start);
    onNode(member.endNodeId, ends.end);
  }
  let largest = 0;
  for (const sum of sums.values()) {
    for (const value of sum) {
      largest = Math.max(largest, Math.abs(value));
    }
  }
  return largest;
}

/**
 * The resultant of everything that acts on the structure in one load case: nodal loads, member
 * loads and reactions. Three force sums and three moment sums about the origin, all zero in
 * equilibrium.
 */
function structureResidual(model: Model, result: LoadCaseResult): number[] {
  const sum = [0, 0, 0, 0, 0, 0];
  const add = (r: Vec3, force: Vec3, moment: Vec3 = { x: 0, y: 0, z: 0 }): void => {
    const m = cross(r, force);
    [force.x, force.y, force.z, moment.x + m.x, moment.y + m.y, moment.z + m.z].forEach(
      (value, i) => {
        sum[i] = (sum[i] as number) + value;
      },
    );
  };
  const position = (nodeId: string): Vec3 => {
    const node = model.nodes.find((item) => item.id === nodeId);
    if (!node) {
      throw new Error(`test: no node ${nodeId}`);
    }
    return node;
  };
  for (const load of model.nodalLoads) {
    if (load.loadCaseId === result.loadCaseId) {
      add(
        position(load.nodeId),
        { x: load.fx, y: load.fy, z: load.fz },
        { x: load.mx, y: load.my, z: load.mz },
      );
    }
  }
  for (const [nodeId, r] of Object.entries(result.reactions)) {
    add(position(nodeId), { x: r.fx, y: r.fy, z: r.fz }, { x: r.mx, y: r.my, z: r.mz });
  }
  for (const member of model.members) {
    const g = geometry(model, member.id);
    for (const { force, at } of memberLoadResultants(model, member.id, result.loadCaseId)) {
      add(
        {
          x: g.start.x + g.axes.x.x * at,
          y: g.start.y + g.axes.x.y * at,
          z: g.start.z + g.axes.x.z * at,
        },
        force,
      );
    }
  }
  return sum;
}

const X_AXES: LocalAxes = {
  x: { x: 1, y: 0, z: 0 },
  y: { x: 0, y: 1, z: 0 },
  z: { x: 0, y: 0, z: 1 },
};

describe("equivalentNodalLoadsLocal: one member load alone", () => {
  // Order of the twelve: ux, uy, uz, rx, ry, rz at the start, then at the end.

  it("uniform load along local y: shears wL/2, moments about z +wL²/12 at the start and -wL²/12 at the end (tolerance: exact; w = 6, L = 4)", () => {
    const q = equivalentNodalLoadsLocal(uniform("u", "m", "local", "y", 6), 4, X_AXES);
    expect(Array.from(q)).toEqual([0, 12, 0, 0, 0, 8, 0, 12, 0, 0, 0, -8]);
  });

  it("uniform load along local z: shears wL/2, moments about y -wL²/12 at the start and +wL²/12 at the end, the opposite signs of the other plane (tolerance: exact)", () => {
    const q = equivalentNodalLoadsLocal(uniform("u", "m", "local", "z", 6), 4, X_AXES);
    expect(Array.from(q)).toEqual([0, 0, 12, 0, -8, 0, 0, 0, 12, 0, 8, 0]);
  });

  it("uniform load along local x: wL/2 on each node and nothing else (tolerance: exact)", () => {
    const q = equivalentNodalLoadsLocal(uniform("u", "m", "local", "x", 6), 4, X_AXES);
    expect(Array.from(q)).toEqual([12, 0, 0, 0, 0, 0, 12, 0, 0, 0, 0, 0]);
  });

  it("a downward uniform load reverses every sign (tolerance: exact)", () => {
    const q = equivalentNodalLoadsLocal(uniform("u", "m", "local", "z", -6), 4, X_AXES);
    expect(Array.from(q)).toEqual([0, 0, -12, 0, 8, 0, 0, 0, -12, 0, -8, 0]);
  });

  // P = 27, L = 3, a = 1, b = 2: Pb²(3a+b)/L³ = 20, Pa²(a+3b)/L³ = 7, Pab²/L² = 12, Pa²b/L² = 6.
  it("point load along local y at a = 1 of L = 3: shears 20 and 7, moments about z +12 and -6 (tolerance: relative 1e-12)", () => {
    const q = equivalentNodalLoadsLocal(point("p", "m", "local", "y", 27, 1), 3, X_AXES);
    const expected = [0, 20, 0, 0, 0, 12, 0, 7, 0, 0, 0, -6];
    expected.forEach((value, i) => {
      expectRel(q[i] as number, value, REL, `component ${i}`);
    });
  });

  it("point load along local z at a = 1 of L = 3: shears 20 and 7, moments about y -12 and +6 (tolerance: relative 1e-12)", () => {
    const q = equivalentNodalLoadsLocal(point("p", "m", "local", "z", 27, 1), 3, X_AXES);
    const expected = [0, 0, 20, 0, -12, 0, 0, 0, 7, 0, 6, 0];
    expected.forEach((value, i) => {
      expectRel(q[i] as number, value, REL, `component ${i}`);
    });
  });

  it("point load along local x at a = 1 of L = 3: Pb/L = 18 at the start and Pa/L = 9 at the end (tolerance: relative 1e-12)", () => {
    const q = equivalentNodalLoadsLocal(point("p", "m", "local", "x", 27, 1), 3, X_AXES);
    const expected = [18, 0, 0, 0, 0, 0, 9, 0, 0, 0, 0, 0];
    expected.forEach((value, i) => {
      expectRel(q[i] as number, value, REL, `component ${i}`);
    });
  });

  it("a point load at the start or at the end is that force on that node and nothing else; a position past an end is taken as the end (tolerance: exact)", () => {
    const at = (position: number) =>
      Array.from(equivalentNodalLoadsLocal(point("p", "m", "local", "z", 5, position), 3, X_AXES));
    const start = [0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const end = [0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0];
    expect(at(0)).toEqual(start);
    expect(at(-1e-9)).toEqual(start);
    expect(at(3)).toEqual(end);
    expect(at(3 + 1e-9)).toEqual(end);
  });

  it("a point load 1 µm from an end: nearly the whole force on that node and a moment of P·a (tolerance: relative 1e-5, the size of the terms of the next order in a/L)", () => {
    const a = 1e-6;
    const nearStart = equivalentNodalLoadsLocal(point("p", "m", "local", "y", 5, a), 3, X_AXES);
    expectRel(nearStart[1] as number, 5, 1e-5);
    expectRel(nearStart[5] as number, 5 * a, 1e-5);
    expectRel(nearStart[7] as number, (5 * 3 * a * a) / 9, 1e-5);
    expectRel(nearStart[11] as number, (-5 * a * a) / 3, 1e-5);
    const nearEnd = equivalentNodalLoadsLocal(point("p", "m", "local", "y", 5, 3 - a), 3, X_AXES);
    expectRel(nearEnd[7] as number, 5, 1e-5);
    expectRel(nearEnd[11] as number, -5 * a, 1e-5);
    expectRel(nearEnd[1] as number, (5 * 3 * a * a) / 9, 1e-5);
    expectRel(nearEnd[5] as number, (5 * a * a) / 3, 1e-5);
  });

  it("a global vertical load on a member that rises 4 in 3 resolves into an axial and a transverse part (tolerance: relative 1e-12)", () => {
    // Local x = (0.6, 0, 0.8), local y = (0, 1, 0), local z = (-0.8, 0, 0.6); L = 5. The load
    // (0, 0, -10) per metre of member has the local components (-8, 0, -6).
    const axes = memberLocalAxes({ x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 4 }, 0) as LocalAxes;
    const load = uniform("u", "m", "global", "z", -10);
    const [px, py, pz] = memberLoadLocalComponents(load, axes);
    expectRel(px, -8, REL);
    expect(py).toBe(0);
    expectRel(pz, -6, REL);
    const q = equivalentNodalLoadsLocal(load, 5, axes);
    // Axial -8 · 5/2 = -20, transverse -6 · 5/2 = -15, moments about y -(-6) · 25/12 = +12.5, -12.5.
    const expected = [-20, 0, -15, 0, 12.5, 0, -20, 0, -15, 0, -12.5, 0];
    expected.forEach((value, i) => {
      if (value === 0) {
        expect(Math.abs(q[i] as number)).toBeLessThanOrEqual(ZERO * 20);
      } else {
        expectRel(q[i] as number, value, REL, `component ${i}`);
      }
    });
  });

  it("with a roll of 90 degrees a global vertical load on a beam along X is a load along local y (tolerance: 1e-12 · the load)", () => {
    // Roll 90: local y = global Z, local z = minus global Y.
    const axes = memberLocalAxes({ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, 90) as LocalAxes;
    const [px, py, pz] = memberLoadLocalComponents(uniform("u", "m", "global", "z", -10), axes);
    expect(px).toBe(0);
    expectRel(py, -10, REL);
    expectZero(pz, 10);
    const [qx, qy, qz] = memberLoadLocalComponents(uniform("u", "m", "global", "y", 10), axes);
    expect(qx).toBe(0);
    expectZero(qy, 10);
    expectRel(qz, -10, REL);
  });

  it("is statically equivalent to the load: same force and same moment about the start node, for uniform and point loads in local and global axes on skew members with roll angles (tolerance: 1e-12 · |load| · L)", () => {
    const cases: [end: Vec3, roll: number][] = [
      [{ x: 4, y: 0, z: 0 }, 0],
      [{ x: 0, y: 0, z: 3 }, 0],
      [{ x: 0, y: 0, z: -3 }, 20],
      [{ x: 2, y: 3, z: 6 }, 0],
      [{ x: 2, y: 3, z: 6 }, 40],
      [{ x: -5, y: 1, z: -2 }, -115],
    ];
    for (const [end, roll] of cases) {
      const axes = memberLocalAxes({ x: 0, y: 0, z: 0 }, end, roll) as LocalAxes;
      const L = Math.hypot(end.x, end.y, end.z);
      for (const axesKind of ["local", "global"] as const) {
        for (const direction of ["x", "y", "z"] as const) {
          const loads: [MemberLoad, total: number, at: number][] = [
            [uniform("u", "m", axesKind, direction, -7), -7 * L, L / 2],
            [point("p", "m", axesKind, direction, 9, 0.3 * L), 9, 0.3 * L],
            [point("p", "m", axesKind, direction, 9, 0.999 * L), 9, 0.999 * L],
          ];
          for (const [load, total, at] of loads) {
            const q = equivalentNodalLoadsLocal(load, L, axes);
            const unitVector =
              axesKind === "local"
                ? axes[direction]
                : {
                    x: direction === "x" ? 1 : 0,
                    y: direction === "y" ? 1 : 0,
                    z: direction === "z" ? 1 : 0,
                  };
            const fx = total * dot(unitVector, axes.x);
            const fy = total * dot(unitVector, axes.y);
            const fz = total * dot(unitVector, axes.z);
            const scale = Math.abs(total) * L;
            const what = `${JSON.stringify(end)} roll ${roll} ${axesKind} ${direction}`;
            expectZero((q[0] as number) + (q[6] as number) - fx, scale, what);
            expectZero((q[1] as number) + (q[7] as number) - fy, scale, what);
            expectZero((q[2] as number) + (q[8] as number) - fz, scale, what);
            // Moments about the start node; a force (fx, fy, fz) at (x, 0, 0) gives (0, -x fz, x fy).
            expect(q[3]).toBe(0);
            expect(q[9]).toBe(0);
            expectZero(
              (q[4] as number) + (q[10] as number) - L * (q[8] as number) + at * fz,
              scale,
              what,
            );
            expectZero(
              (q[5] as number) + (q[11] as number) + L * (q[7] as number) - at * fy,
              scale,
              what,
            );
          }
        }
      }
    }
  });
});

describe("solve with member loads: closed-form cases along X", () => {
  const L = 6;
  const w = 10;

  it("simply supported beam with a node at mid-span, uniform load downward: reactions wL/2, deflection 5wL⁴/(384 E Iy), end rotations wL³/(24 E Iy), mid-span moment wL²/8 (tolerance: relative 1e-12; zeros within 1e-12 · wL²/8 or 1e-12 · the deflection)", () => {
    const model = frame(
      [
        ["n1", 0, 0, 0],
        ["n2", L / 2, 0, 0],
        ["n3", L, 0, 0],
      ],
      [
        ["m1", "n1", "n2"],
        ["m2", "n2", "n3"],
      ],
      [support("n1", ["ux", "uy", "uz", "rx"]), support("n3", ["uy", "uz"])],
      { uniform: [uniform("u1", "m1", "global", "z", -w), uniform("u2", "m2", "local", "z", -w)] },
    );
    const result = solved(model);
    const M = (w * L ** 2) / 8;
    const d = (5 * w * L ** 4) / (384 * E * Iy);
    const theta = (w * L ** 3) / (24 * E * Iy);
    expectSix(get(result.reactions, "n1"), F, { fz: (w * L) / 2 }, M);
    expectSix(get(result.reactions, "n3"), F, { fz: (w * L) / 2 }, M);
    // The beam sags: uz < 0 at mid-span, no rotation there. At n1 the slope duz/dx is negative and
    // ry = -slope, so ry > 0; at n3 the opposite.
    expectSix(get(result.displacements, "n2"), DOFS, { uz: -d }, d);
    expectSix(get(result.displacements, "n1"), DOFS, { ry: theta }, theta);
    expectSix(get(result.displacements, "n3"), DOFS, { ry: -theta }, theta);
    // End forces. m1: the support pushes up at its start; at its end (mid-span) there is no shear and
    // the right half applies a moment about y of -wL²/8 (free body of the left half about mid-span:
    // the reaction gives +wL²/4 about y, the load -wL²/8, so the end action is -wL²/8).
    const m1 = get(result.memberEndForces, "m1");
    const m2 = get(result.memberEndForces, "m2");
    expectSix(m1.start, F, { fz: (w * L) / 2 }, M, REL, "m1 start");
    expectSix(m1.end, F, { my: -M }, M, REL, "m1 end");
    expectSix(m2.start, F, { my: M }, M, REL, "m2 start");
    expectSix(m2.end, F, { fz: (w * L) / 2 }, M, REL, "m2 end");
  });

  it("the same beam loaded along -Y, the other bending plane: deflection 5wL⁴/(384 E Iz), and the moments and rotations about z have the opposite signs of those about y (tolerance: relative 1e-12)", () => {
    const model = frame(
      [
        ["n1", 0, 0, 0],
        ["n2", L / 2, 0, 0],
        ["n3", L, 0, 0],
      ],
      [
        ["m1", "n1", "n2"],
        ["m2", "n2", "n3"],
      ],
      [support("n1", ["ux", "uy", "uz", "rx"]), support("n3", ["uy", "uz"])],
      { uniform: [uniform("u1", "m1", "global", "y", -w), uniform("u2", "m2", "local", "y", -w)] },
    );
    const result = solved(model);
    const M = (w * L ** 2) / 8;
    const d = (5 * w * L ** 4) / (384 * E * Iz);
    const theta = (w * L ** 3) / (24 * E * Iz);
    expectSix(get(result.reactions, "n1"), F, { fy: (w * L) / 2 }, M);
    expectSix(get(result.reactions, "n3"), F, { fy: (w * L) / 2 }, M);
    // duy/dx = +rz: the slope is negative at n1, so rz < 0 there.
    expectSix(get(result.displacements, "n2"), DOFS, { uy: -d }, d);
    expectSix(get(result.displacements, "n1"), DOFS, { rz: -theta }, theta);
    expectSix(get(result.displacements, "n3"), DOFS, { rz: theta }, theta);
    const m1 = get(result.memberEndForces, "m1");
    const m2 = get(result.memberEndForces, "m2");
    expectSix(m1.start, F, { fy: (w * L) / 2 }, M, REL, "m1 start");
    expectSix(m1.end, F, { mz: M }, M, REL, "m1 end");
    expectSix(m2.start, F, { mz: -M }, M, REL, "m2 start");
    expectSix(m2.end, F, { fy: (w * L) / 2 }, M, REL, "m2 end");
  });

  it("the simply supported beam fixture of @bridle/model under its own uniform load: reactions 30 kN, end rotations wL³/(24 E Iy), end shears 30 kN and no end moment (tolerance: relative 1e-12; zeros within 1e-12 · 45 kN·m)", () => {
    const model = simplySupportedBeam();
    const result = solved(model);
    const theta = (10 * 6 ** 3) / (24 * E * Iy);
    expectSix(get(result.reactions, "n1"), F, { fz: 30 }, 45);
    expectSix(get(result.reactions, "n2"), F, { fz: 30 }, 45);
    expectSix(get(result.displacements, "n1"), DOFS, { ry: theta }, theta);
    expectSix(get(result.displacements, "n2"), DOFS, { ry: -theta }, theta);
    const m1 = get(result.memberEndForces, "m1");
    expectSix(m1.start, F, { fz: 30 }, 45);
    expectSix(m1.end, F, { fz: 30 }, 45);
  });

  it("fixed-fixed beam, uniform load downward: no displacement at all, reactions wL/2, moments about y -wL²/12 at the start and +wL²/12 at the end, end forces equal to the reactions (tolerance: exact for the displacements, relative 1e-12)", () => {
    const model = frame(
      [
        ["n1", 0, 0, 0],
        ["n2", L, 0, 0],
      ],
      [["m1", "n1", "n2"]],
      [support("n1", ALL), support("n2", ALL)],
      { uniform: [uniform("u1", "m1", "global", "z", -w)] },
    );
    const full = solve(model);
    expect(full.ok && full.smallestPivotRatio).toBe(1);
    const result = solved(model);
    expect(Array.from(result.displacementVector).every((value) => value === 0)).toBe(true);
    const M = (w * L ** 2) / 12;
    // Like the cantilever of the README: a support at the start holds a downward load with a
    // negative moment about y; at the end the mirror image, positive.
    expectSix(get(result.reactions, "n1"), F, { fz: (w * L) / 2, my: -M }, M);
    expectSix(get(result.reactions, "n2"), F, { fz: (w * L) / 2, my: M }, M);
    const m1 = get(result.memberEndForces, "m1");
    expectSix(m1.start, F, { fz: (w * L) / 2, my: -M }, M);
    expectSix(m1.end, F, { fz: (w * L) / 2, my: M }, M);
    expect(result.sensitivity).toBe(0);
  });

  it("fixed-fixed beam, uniform load along -Y: moments about z +wL²/12 at the start and -wL²/12 at the end (tolerance: relative 1e-12)", () => {
    const model = frame(
      [
        ["n1", 0, 0, 0],
        ["n2", L, 0, 0],
      ],
      [["m1", "n1", "n2"]],
      [support("n1", ALL), support("n2", ALL)],
      { uniform: [uniform("u1", "m1", "local", "y", -w)] },
    );
    const result = solved(model);
    const M = (w * L ** 2) / 12;
    expectSix(get(result.reactions, "n1"), F, { fy: (w * L) / 2, mz: M }, M);
    expectSix(get(result.reactions, "n2"), F, { fy: (w * L) / 2, mz: -M }, M);
    const m1 = get(result.memberEndForces, "m1");
    expectSix(m1.start, F, { fy: (w * L) / 2, mz: M }, M);
    expectSix(m1.end, F, { fy: (w * L) / 2, mz: -M }, M);
  });

  it("fixed-fixed beam with a node at mid-span, uniform load downward: deflection wL⁴/(384 E Iy), mid-span moment wL²/24, end moments wL²/12 (tolerance: relative 1e-12)", () => {
    const model = frame(
      [
        ["n1", 0, 0, 0],
        ["n2", L / 2, 0, 0],
        ["n3", L, 0, 0],
      ],
      [
        ["m1", "n1", "n2"],
        ["m2", "n2", "n3"],
      ],
      [support("n1", ALL), support("n3", ALL)],
      { uniform: [uniform("u1", "m1", "global", "z", -w), uniform("u2", "m2", "global", "z", -w)] },
    );
    const result = solved(model);
    const d = (w * L ** 4) / (384 * E * Iy);
    const M = (w * L ** 2) / 12;
    expectSix(get(result.displacements, "n2"), DOFS, { uz: -d }, d);
    expectSix(get(result.reactions, "n1"), F, { fz: (w * L) / 2, my: -M }, M);
    expectSix(get(result.reactions, "n3"), F, { fz: (w * L) / 2, my: M }, M);
    const m1 = get(result.memberEndForces, "m1");
    expectSix(m1.start, F, { fz: (w * L) / 2, my: -M }, M);
    // Sagging at mid-span, as in the simply supported beam: -wL²/24 on the end of the left half.
    expectSix(m1.end, F, { my: -M / 2 }, M);
  });

  it("cantilever, uniform load downward: tip deflection wL⁴/(8 E Iy), tip rotation wL³/(6 E Iy), reaction wL and moment -wL²/2; the free end has no end force (tolerance: relative 1e-12)", () => {
    const model = frame(
      [
        ["n1", 0, 0, 0],
        ["n2", L, 0, 0],
      ],
      [["m1", "n1", "n2"]],
      [support("n1", ALL)],
      { uniform: [uniform("u1", "m1", "global", "z", -w)] },
    );
    const result = solved(model);
    const d = (w * L ** 4) / (8 * E * Iy);
    const theta = (w * L ** 3) / (6 * E * Iy);
    const M = (w * L ** 2) / 2;
    expectSix(get(result.displacements, "n2"), DOFS, { uz: -d, ry: theta }, d);
    expectSix(get(result.reactions, "n1"), F, { fz: w * L, my: -M }, M);
    const m1 = get(result.memberEndForces, "m1");
    expectSix(m1.start, F, { fz: w * L, my: -M }, M);
    expectSix(m1.end, F, {}, M);
  });

  it("cantilever, uniform load along +Y: tip deflection wL⁴/(8 E Iz), tip rotation rz = +wL³/(6 E Iz), reaction -wL and moment about z -wL²/2 (tolerance: relative 1e-12)", () => {
    const model = frame(
      [
        ["n1", 0, 0, 0],
        ["n2", L, 0, 0],
      ],
      [["m1", "n1", "n2"]],
      [support("n1", ALL)],
      { uniform: [uniform("u1", "m1", "local", "y", w)] },
    );
    const result = solved(model);
    const d = (w * L ** 4) / (8 * E * Iz);
    const theta = (w * L ** 3) / (6 * E * Iz);
    const M = (w * L ** 2) / 2;
    expectSix(get(result.displacements, "n2"), DOFS, { uy: d, rz: theta }, d);
    expectSix(get(result.reactions, "n1"), F, { fy: -w * L, mz: -M }, M);
    const m1 = get(result.memberEndForces, "m1");
    expectSix(m1.start, F, { fy: -w * L, mz: -M }, M);
    expectSix(m1.end, F, {}, M);
  });

  it.each([
    ["at 2 m of 6 m", 2],
    ["at mid-span", 3],
    ["1 mm from the fixed end", 0.001],
    ["1 mm from the tip", 5.999],
    ["at the tip", 6],
  ])(
    "cantilever, downward point load %s: tip deflection Pa²(3L - a)/(6 E Iy), tip rotation Pa²/(2 E Iy), reaction P and moment -Pa, in both bending planes (tolerance: relative 1e-12)",
    (_name, a) => {
      const P = 10;
      const beam = (load: MemberPointLoad): Model =>
        frame(
          [
            ["n1", 0, 0, 0],
            ["n2", L, 0, 0],
          ],
          [["m1", "n1", "n2"]],
          [support("n1", ALL)],
          { point: [load] },
        );
      const down = solved(beam(point("p1", "m1", "global", "z", -P, a)));
      const d = (P * a ** 2 * (3 * L - a)) / (6 * E * Iy);
      const theta = (P * a ** 2) / (2 * E * Iy);
      expectSix(get(down.displacements, "n2"), DOFS, { uz: -d, ry: theta }, d);
      expectSix(get(down.reactions, "n1"), F, { fz: P, my: -P * a }, P * a);
      expectSix(get(down.memberEndForces, "m1").start, F, { fz: P, my: -P * a }, P * a);
      expectSix(get(down.memberEndForces, "m1").end, F, {}, P * a);

      // Along +Y: bending about z with E·Iz; the reaction's moment about z is -P·a.
      const side = solved(beam(point("p1", "m1", "local", "y", P, a)));
      const dy = (P * a ** 2 * (3 * L - a)) / (6 * E * Iz);
      const thetaZ = (P * a ** 2) / (2 * E * Iz);
      expectSix(get(side.displacements, "n2"), DOFS, { uy: dy, rz: thetaZ }, dy);
      expectSix(get(side.reactions, "n1"), F, { fy: -P, mz: -P * a }, P * a);
      expectSix(get(side.memberEndForces, "m1").end, F, {}, P * a);
    },
  );

  it("propped cantilever, uniform load downward: reactions 5wL/8 at the fixed end and 3wL/8 at the roller, fixed-end moment -wL²/8, rotation at the roller wL³/(48 E Iy) (tolerance: relative 1e-12)", () => {
    const model = frame(
      [
        ["n1", 0, 0, 0],
        ["n2", L, 0, 0],
      ],
      [["m1", "n1", "n2"]],
      [support("n1", ALL), support("n2", ["uy", "uz"])],
      { uniform: [uniform("u1", "m1", "global", "z", -w)] },
    );
    const result = solved(model);
    const M = (w * L ** 2) / 8;
    const theta = (w * L ** 3) / (48 * E * Iy);
    expectSix(get(result.reactions, "n1"), F, { fz: (5 * w * L) / 8, my: -M }, M);
    expectSix(get(result.reactions, "n2"), F, { fz: (3 * w * L) / 8 }, M);
    // At the roller the beam comes back up to zero: the slope is positive, so ry is negative.
    expectSix(get(result.displacements, "n2"), DOFS, { ry: -theta }, theta);
    const m1 = get(result.memberEndForces, "m1");
    expectSix(m1.start, F, { fz: (5 * w * L) / 8, my: -M }, M);
    expectSix(m1.end, F, { fz: (3 * w * L) / 8 }, M);
  });

  it("fixed-fixed beam, off-centre point load: shears Pb²(3a + b)/L³ and Pa²(a + 3b)/L³, end moments Pab²/L² and Pa²b/L² with their signs, in both bending planes (tolerance: relative 1e-12)", () => {
    const S = 5;
    const a = 2;
    const b = 3;
    const P = 10;
    const beam = (load: MemberPointLoad): Model =>
      frame(
        [
          ["n1", 0, 0, 0],
          ["n2", S, 0, 0],
        ],
        [["m1", "n1", "n2"]],
        [support("n1", ALL), support("n2", ALL)],
        { point: [load] },
      );
    const V1 = (P * b ** 2 * (3 * a + b)) / S ** 3; // 6.48
    const V2 = (P * a ** 2 * (a + 3 * b)) / S ** 3; // 3.52
    const M1 = (P * a * b ** 2) / S ** 2; // 7.2
    const M2 = (P * a ** 2 * b) / S ** 2; // 4.8
    expectRel(V1, 6.48, REL);
    expectRel(V2, 3.52, REL);
    expectRel(M1, 7.2, REL);
    expectRel(M2, 4.8, REL);

    const down = solved(beam(point("p1", "m1", "global", "z", -P, a)));
    expect(Array.from(down.displacementVector).every((value) => value === 0)).toBe(true);
    expectSix(get(down.reactions, "n1"), F, { fz: V1, my: -M1 }, M1);
    expectSix(get(down.reactions, "n2"), F, { fz: V2, my: M2 }, M1);
    expectSix(get(down.memberEndForces, "m1").start, F, { fz: V1, my: -M1 }, M1);
    expectSix(get(down.memberEndForces, "m1").end, F, { fz: V2, my: M2 }, M1);

    const side = solved(beam(point("p1", "m1", "global", "y", -P, a)));
    expectSix(get(side.reactions, "n1"), F, { fy: V1, mz: M1 }, M1);
    expectSix(get(side.reactions, "n2"), F, { fy: V2, mz: -M2 }, M1);
    expectSix(get(side.memberEndForces, "m1").start, F, { fy: V1, mz: M1 }, M1);
    expectSix(get(side.memberEndForces, "m1").end, F, { fy: V2, mz: -M2 }, M1);
  });

  it("axial uniform load on a bar fixed at its start: tip elongation pL²/(2 E A), reaction -pL; the start is in tension (start.fx = -pL) and the free end carries nothing (tolerance: relative 1e-12)", () => {
    const p = 4;
    const model = frame(
      [
        ["n1", 0, 0, 0],
        ["n2", L, 0, 0],
      ],
      [["m1", "n1", "n2"]],
      [support("n1", ALL)],
      { uniform: [uniform("u1", "m1", "local", "x", p)] },
    );
    const result = solved(model);
    const d = (p * L ** 2) / (2 * E * A);
    expectSix(get(result.displacements, "n2"), DOFS, { ux: d }, d);
    expectSix(get(result.reactions, "n1"), F, { fx: -p * L }, p * L);
    expectSix(get(result.memberEndForces, "m1").start, F, { fx: -p * L }, p * L);
    expectSix(get(result.memberEndForces, "m1").end, F, {}, p * L);
  });

  it("axial point load: a bar fixed at its start stretches by Pa/(E A); a bar fixed at both ends shares it as Pb/L and Pa/L, tension before the load and compression after it (tolerance: relative 1e-12)", () => {
    const P = 12;
    const a = 2;
    const b = L - a;
    const bar = (supports: Support[]): Model =>
      frame(
        [
          ["n1", 0, 0, 0],
          ["n2", L, 0, 0],
        ],
        [["m1", "n1", "n2"]],
        supports,
        { point: [point("p1", "m1", "global", "x", P, a)] },
      );
    const free = solved(bar([support("n1", ALL)]));
    const d = (P * a) / (E * A);
    expectSix(get(free.displacements, "n2"), DOFS, { ux: d }, d);
    expectSix(get(free.reactions, "n1"), F, { fx: -P }, P);
    expectSix(get(free.memberEndForces, "m1").start, F, { fx: -P }, P);
    expectSix(get(free.memberEndForces, "m1").end, F, {}, P);

    const held = solved(bar([support("n1", ALL), support("n2", ALL)]));
    expectSix(get(held.reactions, "n1"), F, { fx: (-P * b) / L }, P);
    expectSix(get(held.reactions, "n2"), F, { fx: (-P * a) / L }, P);
    // start.fx < 0: the node pulls the start against local x, tension. end.fx < 0: the node pushes
    // the end against local x, into the member, compression.
    expectSix(get(held.memberEndForces, "m1").start, F, { fx: (-P * b) / L }, P);
    expectSix(get(held.memberEndForces, "m1").end, F, { fx: (-P * a) / L }, P);
  });

  it("the worked example of the README: a cantilever of 3 m along +X fixed at its start with a downward tip force of 10 kN has start { fz: +10, my: -30 } and end { fz: -10, my: 0 }; pulled by 10 kN along +X it has start.fx = -10 and end.fx = +10 (tolerance: relative 1e-12; zeros within 1e-12 · 30)", () => {
    const beam = (load: NodalLoad): Model =>
      frame(
        [
          ["n1", 0, 0, 0],
          ["n2", 3, 0, 0],
        ],
        [["m1", "n1", "n2"]],
        [support("n1", ALL)],
        { nodal: [load] },
      );
    const bent = get(solved(beam(nodal("nl1", "n2", { fz: -10 }))).memberEndForces, "m1");
    expectSix(bent.start, F, { fz: 10, my: -30 }, 30);
    expectSix(bent.end, F, { fz: -10 }, 30);
    const pulled = get(solved(beam(nodal("nl1", "n2", { fx: 10 }))).memberEndForces, "m1");
    expectSix(pulled.start, F, { fx: -10 }, 10);
    expectSix(pulled.end, F, { fx: 10 }, 10);
    // The same force as a member point load at the tip: the node applies nothing to the end.
    const model = beam(nodal("nl1", "n2", {}));
    model.memberPointLoads.push(point("p1", "m1", "global", "z", -10, 3));
    const asMemberLoad = get(solved(model).memberEndForces, "m1");
    expectSix(asMemberLoad.start, F, { fz: 10, my: -30 }, 30);
    expectSix(asMemberLoad.end, F, {}, 30);
  });
});

describe("solve with member loads: inclined, vertical and rolled members", () => {
  it("an inclined member with a global vertical uniform load, on a pin and a roller: the total reaction is w times the member's length, not times its horizontal projection (tolerance: relative 1e-12; zeros within 1e-12 · 50 kN)", () => {
    // From (0, 0, 0) to (3, 0, 4): length 5, horizontal projection 3. w = 10 kN/m: total 50 kN.
    const model = frame(
      [
        ["n1", 0, 0, 0],
        ["n2", 3, 0, 4],
      ],
      [["m1", "n1", "n2"]],
      [support("n1", ["ux", "uy", "uz", "rx", "rz"]), support("n2", ["uy", "uz"])],
      { uniform: [uniform("u1", "m1", "global", "z", -10)] },
    );
    const result = solved(model);
    const r1 = get(result.reactions, "n1");
    const r2 = get(result.reactions, "n2");
    expectRel(r1.fz + r2.fz, 50, REL);
    // The resultant acts at x = 1.5, half-way between the supports in plan: 25 kN each.
    expectSix(r1, F, { fz: 25 }, 50);
    expectSix(r2, F, { fz: 25 }, 50);
    // End forces: the reaction (0, 0, 25) along local x = (0.6, 0, 0.8) and local z = (-0.8, 0, 0.6).
    const m1 = get(result.memberEndForces, "m1");
    expectSix(m1.start, F, { fx: 20, fz: 15 }, 50);
    expectSix(m1.end, F, { fx: 20, fz: 15 }, 50);
    // Mid-span moment of a simply supported beam under the transverse part 6 kN/m: 6 · 5²/8, which
    // shows in the end rotations 6 · 5³/(24 E Iy) about global Y (local y is global Y here).
    const theta = (6 * 5 ** 3) / (24 * E * Iy);
    expectRel(get(result.displacements, "n1").ry, theta, REL);
  });

  it("the same inclined member as a cantilever: tip displacement from the axial part -8 kN/m and the transverse part -6 kN/m, reaction 50 kN and moment -75 kN·m (tolerance: relative 1e-12)", () => {
    const model = frame(
      [
        ["n1", 0, 0, 0],
        ["n2", 3, 0, 4],
      ],
      [["m1", "n1", "n2"]],
      [support("n1", ALL)],
      { uniform: [uniform("u1", "m1", "global", "z", -10)] },
    );
    const result = solved(model);
    const S = 5;
    const axial = (-8 * S ** 2) / (2 * E * A); // along local x = (0.6, 0, 0.8)
    const transverse = (-6 * S ** 4) / (8 * E * Iy); // along local z = (-0.8, 0, 0.6)
    const ux = 0.6 * axial - 0.8 * transverse;
    const uz = 0.8 * axial + 0.6 * transverse;
    // Slope along local z is -6·S³/(6 E Iy), and ry = -slope (local y is global Y).
    const ry = (6 * S ** 3) / (6 * E * Iy);
    expectSix(get(result.displacements, "n2"), DOFS, { ux, uz, ry }, Math.abs(uz));
    // The resultant (0, 0, -50) acts at (1.5, 0, 2): its moment about n1 is (0, +75, 0).
    expectSix(get(result.reactions, "n1"), F, { fz: 50, my: -75 }, 75);
    const m1 = get(result.memberEndForces, "m1");
    expectSix(m1.start, F, { fx: 40, fz: 30, my: -75 }, 75);
    expectSix(m1.end, F, {}, 75);
  });

  it.each([
    ["running upward", "n1", "n2"],
    ["running downward", "n2", "n1"],
  ])(
    "a column %s, fixed at its base, with wind as a global uniform load along +X and along +Y: top displacements wH⁴/(8 E I), base shears -wH, base moments my = -wH²/2 and mx = +wH²/2 (tolerance: relative 1e-12)",
    (_name, start, end) => {
      const H = 4;
      const w = 3;
      const column = (direction: "x" | "y"): Model =>
        frame(
          [
            ["n1", 0, 0, 0],
            ["n2", 0, 0, H],
          ],
          [["m1", start, end]],
          [support("n1", ALL)],
          { uniform: [uniform("u1", "m1", "global", direction, w)] },
        );
      const M = (w * H ** 2) / 2;
      // Along +X the column bends in the X-Z plane with E·Iy (local y is global Y). The top leans
      // towards +X, a rotation from Z towards X, positive about Y. The load's moment about the base
      // is (0, 0, z) × (w, 0, 0) = (0, +z w, 0), so the support's is my = -wH²/2.
      const alongX = solved(column("x"));
      const dx = (w * H ** 4) / (8 * E * Iy);
      expectSix(
        get(alongX.displacements, "n2"),
        DOFS,
        { ux: dx, ry: (w * H ** 3) / (6 * E * Iy) },
        dx,
      );
      expectSix(get(alongX.reactions, "n1"), F, { fx: -w * H, my: -M }, M);
      // Along +Y it bends with E·Iz. The top leans towards +Y, a rotation from Z towards Y, negative
      // about X. The load's moment about the base is (0, 0, z) × (0, w, 0) = (-z w, 0, 0).
      const alongY = solved(column("y"));
      const dy = (w * H ** 4) / (8 * E * Iz);
      expectSix(
        get(alongY.displacements, "n2"),
        DOFS,
        { uy: dy, rx: -(w * H ** 3) / (6 * E * Iz) },
        dy,
      );
      expectSix(get(alongY.reactions, "n1"), F, { fy: -w * H, mx: M }, M);
    },
  );

  it("a cantilever along X with a roll of 90 degrees bends under gravity about its weak axis: tip deflection wL⁴/(8 E Iz); the reactions are those of roll 0 (tolerance: relative 1e-12 for the deflection; zeros within 1e-12 · the deflection)", () => {
    const S = 3;
    const w = 2;
    const model = frame(
      [
        ["n1", 0, 0, 0],
        ["n2", S, 0, 0],
      ],
      [["m1", "n1", "n2", 90]],
      [support("n1", ALL)],
      { uniform: [uniform("u1", "m1", "global", "z", -w)] },
    );
    const result = solved(model);
    const d = (w * S ** 4) / (8 * E * Iz);
    const M = (w * S ** 2) / 2;
    expectSix(
      get(result.displacements, "n2"),
      DOFS,
      { uz: -d, ry: (w * S ** 3) / (6 * E * Iz) },
      d,
    );
    expectSix(get(result.reactions, "n1"), F, { fz: w * S, my: -M }, M);
    // Local y is global Z and local z is minus global Y: the shear is along local y and the moment
    // (0, -M, 0) is +M about local z.
    expectSix(get(result.memberEndForces, "m1").start, F, { fy: w * S, mz: M }, M);
  });

  it("a cantilever along X with a roll of 30 degrees under gravity bends in both planes and moves sideways; the reactions do not depend on the roll (tolerance: relative 1e-12)", () => {
    const S = 3;
    const w = 2;
    const model = frame(
      [
        ["n1", 0, 0, 0],
        ["n2", S, 0, 0],
      ],
      [["m1", "n1", "n2", 30]],
      [support("n1", ALL)],
      { uniform: [uniform("u1", "m1", "global", "z", -w)] },
    );
    const result = solved(model);
    const c = Math.cos(Math.PI / 6);
    const s = Math.sin(Math.PI / 6);
    // Local y = (0, c, s), local z = (0, -s, c). Gravity (0, 0, -w): py = -w s, pz = -w c.
    const dyLocal = (-w * s * S ** 4) / (8 * E * Iz);
    const dzLocal = (-w * c * S ** 4) / (8 * E * Iy);
    const uy = dyLocal * c - dzLocal * s;
    const uz = dyLocal * s + dzLocal * c;
    // Local rotations: rz = +slope of uy, ry = -slope of uz.
    const rzLocal = (-w * s * S ** 3) / (6 * E * Iz);
    const ryLocal = (w * c * S ** 3) / (6 * E * Iy);
    const ry = ryLocal * c - rzLocal * s;
    const rz = ryLocal * s + rzLocal * c;
    expect(Math.abs(uy)).toBeGreaterThan(0.1 * Math.abs(uz));
    expectSix(get(result.displacements, "n2"), DOFS, { uy, uz, ry, rz }, Math.abs(uz));
    const M = (w * S ** 2) / 2;
    expectSix(get(result.reactions, "n1"), F, { fz: w * S, my: -M }, M);
    // End forces at the start: the reaction force (0, 0, wS) and moment (0, -M, 0) in local axes.
    expectSix(
      get(result.memberEndForces, "m1").start,
      F,
      { fy: w * S * s, fz: w * S * c, my: -M * c, mz: M * s },
      M,
    );
    expectSix(get(result.memberEndForces, "m1").end, F, {}, M);
  });

  it("a skew cantilever along (2, 3, 6) with a roll of 40 degrees under a global uniform load, a local point load and a global point load: tip displacement and rotation by superposition of the closed-form terms in its local axes; reaction equal to minus the loads' resultant (tolerance: 1e-11 times the largest component of each kind, wider than 1e-12 for the rotation of axes)", () => {
    const model = frame(
      [
        ["n1", 1, -2, 0.5],
        ["n2", 3, 1, 6.5],
      ],
      [["m1", "n1", "n2", 40]],
      [support("n1", ALL)],
      {
        uniform: [uniform("u1", "m1", "global", "z", -5)],
        point: [point("p1", "m1", "local", "y", 8, 2.5), point("p2", "m1", "global", "x", -6, 6.2)],
      },
    );
    const S = 7;
    const g = geometry(model, "m1");
    expectRel(g.length, S, REL);
    const result = solved(model);
    // Local components of each load, written here from the axes.
    const wLocal = [-5 * g.axes.x.z, -5 * g.axes.y.z, -5 * g.axes.z.z];
    const points: [components: number[], a: number][] = [
      [[0, 8, 0], 2.5],
      [[-6 * g.axes.x.x, -6 * g.axes.y.x, -6 * g.axes.z.x], 6.2],
    ];
    const tip = (I: number, wi: number, i: number): [deflection: number, slope: number] => {
      let deflection = (wi * S ** 4) / (8 * E * I);
      let slope = (wi * S ** 3) / (6 * E * I);
      for (const [components, a] of points) {
        const P = components[i] as number;
        deflection += (P * a ** 2 * (3 * S - a)) / (6 * E * I);
        slope += (P * a ** 2) / (2 * E * I);
      }
      return [deflection, slope];
    };
    let axial = ((wLocal[0] as number) * S ** 2) / (2 * E * A);
    for (const [components, a] of points) {
      axial += ((components[0] as number) * a) / (E * A);
    }
    const [dy, slopeY] = tip(Iz, wLocal[1] as number, 1);
    const [dz, slopeZ] = tip(Iy, wLocal[2] as number, 2);
    const u = toGlobal(g.axes, axial, dy, dz);
    const r = toGlobal(g.axes, 0, -slopeZ, slopeY);
    const n2 = get(result.displacements, "n2");
    const scale = Math.max(Math.abs(u.x), Math.abs(u.y), Math.abs(u.z));
    const rScale = Math.max(Math.abs(r.x), Math.abs(r.y), Math.abs(r.z));
    expectZero(n2.ux - u.x, scale, "ux", 1e-11);
    expectZero(n2.uy - u.y, scale, "uy", 1e-11);
    expectZero(n2.uz - u.z, scale, "uz", 1e-11);
    expectZero(n2.rx - r.x, rScale, "rx", 1e-11);
    expectZero(n2.ry - r.y, rScale, "ry", 1e-11);
    expectZero(n2.rz - r.z, rScale, "rz", 1e-11);
    // No twist: the loads act on the member's axis.
    expectZero(dot(g.axes.x, { x: n2.rx, y: n2.ry, z: n2.rz }), rScale, "twist", 1e-11);

    const residual = structureResidual(model, result);
    residual.forEach((value, i) => {
      expectZero(value, 300, `resultant ${i}`, 1e-11);
    });
    memberResidual(model, result, "m1").forEach((value, i) => {
      expectZero(value, 300, `member ${i}`, 1e-11);
    });
    expectSix(get(result.memberEndForces, "m1").end, F, {}, 300, 1e-11);
  });
});

describe("solve with member loads: frames, equilibrium and comparison with a finer model", () => {
  function loadedPortal(): Model {
    const model = portalFrame();
    model.memberUniformLoads.push(uniform("ul1", "b1", "global", "z", -10));
    model.memberUniformLoads.push(uniform("ul2", "c2", "global", "x", 2));
    model.memberPointLoads.push(point("pl1", "c1", "global", "x", 5, 1.5));
    model.memberPointLoads.push(point("pl2", "b1", "local", "z", -7, 4.5));
    return model;
  }

  it("the portal frame fixture with an added beam load, a column wind load and two point loads: every member is in equilibrium with its own loads and end forces, every node with the end forces, loads and reactions, and the structure as a whole (tolerance: 1e-12 · 300 kN·m)", () => {
    const model = loadedPortal();
    const result = solved(model);
    for (const member of model.members) {
      memberResidual(model, result, member.id).forEach((value, i) => {
        expectZero(value, 300, `${member.id} ${i}`);
      });
    }
    expectZero(largestNodeResidual(model, result), 300, "nodes");
    structureResidual(model, result).forEach((value, i) => {
      expectZero(value, 300, `structure ${i}`);
    });
    // The vertical reactions carry the beam's 60 kN and the 7 kN point load; the horizontal ones
    // the 20 kN nodal load, the 5 kN point load and 8 kN of wind.
    const r1 = get(result.reactions, "n1");
    const r4 = get(result.reactions, "n4");
    expectRel(r1.fz + r4.fz, 67, REL);
    expectRel(r1.fx + r4.fx, -33, REL);
    // Nothing leaves the frame's plane.
    for (const ends of Object.values(result.memberEndForces)) {
      for (const end of [ends.start, ends.end]) {
        expectZero(end.fy, 300);
        expectZero(end.mx, 300);
        expectZero(end.mz, 300);
      }
    }
  });

  it("the equilibrium checks are able to fail: an end force changed by 1e-6 of the scale is detected", () => {
    const model = loadedPortal();
    const result = solved(model);
    const b1 = get(result.memberEndForces, "b1");
    b1.end.my += 3e-4;
    expect(Math.abs(memberResidual(model, result, "b1")[4] as number)).toBeGreaterThan(1e-7 * 300);
    expect(largestNodeResidual(model, result)).toBeGreaterThan(1e-7 * 300);
  });

  it("the portal frame under a uniform load on its beam only, with the area times 1e6: joint rotation wL²/12 / (4EIc/h + 2EIb/L), base moments 2EIc·θ/h, beam end moments and thrust by slope-deflection (tolerance: relative 1e-7, which covers the remaining axial deformation and the rounding of so stiff a system; the largest difference measured is 8.2e-9)", () => {
    const model = portalFrame();
    model.nodalLoads = [];
    (model.sections[0] as Model["sections"][number]).A = A * 1e6;
    const w = 10;
    model.memberUniformLoads.push(uniform("ul1", "b1", "global", "z", -w));
    const result = solved(model);
    const h = 4;
    const S = 6;
    // In-plane bending of every member is about local y (E·Iy). No sway by symmetry. With θ the
    // rotation of the joints (n2: +θ about Y, the beam end sinks towards +X; n3: -θ):
    // column top moment 4EI/h · θ, beam end moment -wS²/12 + (4EI/S)θ - (2EI/S)θ; their sum is zero.
    const theta = (w * S ** 2) / 12 / ((4 * E * Iy) / h + (2 * E * Iy) / S);
    const jointMoment = ((4 * E * Iy) / h) * theta;
    const baseMoment = ((2 * E * Iy) / h) * theta;
    const thrust = (jointMoment + baseMoment) / h;
    const TOL = 1e-7;
    expectRel(get(result.displacements, "n2").ry, theta, TOL);
    expectRel(get(result.displacements, "n3").ry, -theta, TOL);
    // The feet would spread; the supports push them inward.
    expectSix(get(result.reactions, "n1"), F, { fx: thrust, fz: 30, my: baseMoment }, 30, TOL);
    expectSix(get(result.reactions, "n4"), F, { fx: -thrust, fz: 30, my: -baseMoment }, 30, TOL);
    const b1 = get(result.memberEndForces, "b1");
    // The beam is in compression by the thrust: start.fx > 0, end.fx < 0. Hogging at both ends.
    expectSix(b1.start, F, { fx: thrust, fz: 30, my: -jointMoment }, 30, TOL);
    expectSix(b1.end, F, { fx: -thrust, fz: 30, my: jointMoment }, 30, TOL);
    // Column c1 runs upward: local x is global Z and local z is minus global X.
    const c1 = get(result.memberEndForces, "c1");
    expectSix(c1.start, F, { fx: 30, fz: -thrust, my: baseMoment }, 30, TOL);
    expectSix(c1.end, F, { fx: -30, fz: thrust, my: jointMoment }, 30, TOL);
  });

  /**
   * A space frame of three members with roll angles: `ab` from a fixed base, `bc` to a pinned node,
   * `bd` to a free tip. Point loads act inside `ab`, `bc` and `bd`.
   */
  const spaceNodes: [string, number, number, number][] = [
    ["a", 0, 0, 0],
    ["b", 2, 3, 6],
    ["c", 6, 4, 5],
    ["d", 2, 0, 6],
  ];
  const spaceSupports = [support("a", ALL), support("c", ["ux", "uy", "uz"])];
  const lerp = (
    from: [string, number, number, number],
    to: [string, number, number, number],
    t: number,
    id: string,
  ): [string, number, number, number] => [
    id,
    from[1] + t * (to[1] - from[1]),
    from[2] + t * (to[2] - from[2]),
    from[3] + t * (to[3] - from[3]),
  ];

  it("a point load inside a member gives the same displacements, reactions and end forces as the same force on a node placed there, for skew members with roll angles and loads in local and global axes (tolerance: 1e-10 · the largest value of each kind; the two models have different matrices)", () => {
    const [a, b, c, d] = spaceNodes as [
      [string, number, number, number],
      [string, number, number, number],
      [string, number, number, number],
      [string, number, number, number],
    ];
    const whole = frame(
      spaceNodes,
      [
        ["ab", "a", "b", 25],
        ["bc", "b", "c", -50],
        ["bd", "b", "d", 70],
      ],
      spaceSupports,
    );
    const gab = geometry(whole, "ab");
    const gbc = geometry(whole, "bc");
    const gbd = geometry(whole, "bd");
    // Positions as fractions of each member: 0.3 of ab, 0.85 of bc, 0.5 of bd.
    whole.memberPointLoads.push(
      point("p1", "ab", "local", "y", 9, 0.3 * gab.length),
      point("p2", "bc", "global", "z", -12, 0.85 * gbc.length),
      point("p3", "bc", "local", "z", 4, 0.85 * gbc.length),
      point("p4", "bd", "global", "x", 3, 0.5 * gbd.length),
      point("p5", "bd", "local", "x", -2, 0.5 * gbd.length),
    );
    // The same structure with a node at each load. Collinear pieces with the same roll have the
    // same local axes as the whole member.
    const fy = (g: MemberGeometry, value: number): Partial<Record<Component, number>> => {
      const v = toGlobal(g.axes, 0, value, 0);
      return { fx: v.x, fy: v.y, fz: v.z };
    };
    const zLocal = toGlobal(gbc.axes, 0, 0, 4);
    const xLocal = toGlobal(gbd.axes, -2, 0, 0);
    const split = frame(
      [...spaceNodes, lerp(a, b, 0.3, "e"), lerp(b, c, 0.85, "f"), lerp(b, d, 0.5, "g")],
      [
        ["ab1", "a", "e", 25],
        ["ab2", "e", "b", 25],
        ["bc1", "b", "f", -50],
        ["bc2", "f", "c", -50],
        ["bd1", "b", "g", 70],
        ["bd2", "g", "d", 70],
      ],
      spaceSupports,
      {
        nodal: [
          nodal("n1", "e", fy(gab, 9)),
          nodal("n2", "f", { fx: zLocal.x, fy: zLocal.y, fz: zLocal.z - 12 }),
          nodal("n3", "g", { fx: xLocal.x + 3, fy: xLocal.y, fz: xLocal.z }),
        ],
      },
    );
    const one = solved(whole);
    const two = solved(split);
    const TOL = 1e-10;
    const largest = (values: number[]): number => Math.max(...values.map(Math.abs));
    const uScale = largest(Array.from(one.displacementVector));
    for (const nodeId of ["a", "b", "c", "d"]) {
      const u1 = get(one.displacements, nodeId);
      const u2 = get(two.displacements, nodeId);
      for (const dof of DOFS) {
        expectZero(u1[dof] - u2[dof], uScale, `${nodeId} ${dof}`, TOL);
      }
    }
    const fScale = largest(Array.from(one.reactionVector));
    for (const nodeId of ["a", "c"]) {
      const r1 = get(one.reactions, nodeId);
      const r2 = get(two.reactions, nodeId);
      for (const component of F) {
        expectZero(r1[component] - r2[component], fScale, `${nodeId} ${component}`, TOL);
      }
    }
    const pairs: [string, string, string][] = [
      ["ab", "ab1", "ab2"],
      ["bc", "bc1", "bc2"],
      ["bd", "bd1", "bd2"],
    ];
    for (const [id, first, second] of pairs) {
      const ends = get(one.memberEndForces, id);
      const startOfFirst = get(two.memberEndForces, first).start;
      const endOfSecond = get(two.memberEndForces, second).end;
      for (const component of F) {
        expectZero(ends.start[component] - startOfFirst[component], fScale, `${id} start`, TOL);
        expectZero(ends.end[component] - endOfSecond[component], fScale, `${id} end`, TOL);
      }
      memberResidual(whole, one, id).forEach((value, i) => {
        expectZero(value, fScale, `${id} ${i}`, TOL);
      });
    }
    expectZero(largestNodeResidual(whole, one), fScale, "nodes", TOL);
    // The loaded tip member is not idle: the comparison is of numbers that are not zero.
    expect(Math.abs(get(one.memberEndForces, "bd").start.my)).toBeGreaterThan(0.1);
    expect(uScale).toBeGreaterThan(1e-4);
  });

  it("a uniform load on a member gives the same displacements, reactions and end forces as the same load on the member cut into three pieces (tolerance: 1e-10 · the largest value of each kind; the two models have different matrices)", () => {
    const [a, b, c, d] = spaceNodes as [
      [string, number, number, number],
      [string, number, number, number],
      [string, number, number, number],
      [string, number, number, number],
    ];
    const whole = frame(
      spaceNodes,
      [
        ["ab", "a", "b", 25],
        ["bc", "b", "c", -50],
        ["bd", "b", "d", 70],
      ],
      spaceSupports,
      {
        uniform: [
          uniform("u1", "ab", "global", "y", 3),
          uniform("u2", "bc", "global", "z", -6),
          uniform("u3", "bc", "local", "y", 2),
          uniform("u4", "bd", "local", "z", -4),
          uniform("u5", "bd", "global", "y", 1.5),
        ],
      },
    );
    const pieces: [string, string, string, number][] = [];
    const extra: [string, number, number, number][] = [];
    const loads: MemberUniformLoad[] = [];
    const cut = (
      id: string,
      from: [string, number, number, number],
      to: [string, number, number, number],
      roll: number,
    ): void => {
      const n1 = `${id}-1`;
      const n2 = `${id}-2`;
      extra.push(lerp(from, to, 0.2, n1), lerp(from, to, 0.7, n2));
      const ids = [from[0], n1, n2, to[0]];
      for (let i = 0; i < 3; i++) {
        const pieceId = `${id}${i + 1}`;
        pieces.push([pieceId, ids[i] as string, ids[i + 1] as string, roll]);
        for (const load of whole.memberUniformLoads) {
          if (load.memberId === id) {
            loads.push({ ...load, id: `${load.id}-${i}`, memberId: pieceId });
          }
        }
      }
    };
    cut("ab", a, b, 25);
    cut("bc", b, c, -50);
    cut("bd", b, d, 70);
    const split = frame([...spaceNodes, ...extra], pieces, spaceSupports, { uniform: loads });
    const one = solved(whole);
    const two = solved(split);
    const TOL = 1e-10;
    const largest = (values: number[]): number => Math.max(...values.map(Math.abs));
    const uScale = largest(Array.from(one.displacementVector));
    for (const nodeId of ["a", "b", "c", "d"]) {
      const u1 = get(one.displacements, nodeId);
      const u2 = get(two.displacements, nodeId);
      for (const dof of DOFS) {
        expectZero(u1[dof] - u2[dof], uScale, `${nodeId} ${dof}`, TOL);
      }
    }
    const fScale = largest(Array.from(one.reactionVector));
    for (const nodeId of ["a", "c"]) {
      const r1 = get(one.reactions, nodeId);
      const r2 = get(two.reactions, nodeId);
      for (const component of F) {
        expectZero(r1[component] - r2[component], fScale, `${nodeId} ${component}`, TOL);
      }
    }
    for (const id of ["ab", "bc", "bd"]) {
      const ends = get(one.memberEndForces, id);
      const startOfFirst = get(two.memberEndForces, `${id}1`).start;
      const endOfLast = get(two.memberEndForces, `${id}3`).end;
      for (const component of F) {
        expectZero(ends.start[component] - startOfFirst[component], fScale, `${id} start`, TOL);
        expectZero(ends.end[component] - endOfLast[component], fScale, `${id} end`, TOL);
      }
      memberResidual(whole, one, id).forEach((value, i) => {
        expectZero(value, fScale, `${id} ${i}`, TOL);
      });
    }
    structureResidual(whole, one).forEach((value, i) => {
      expectZero(value, fScale * 10, `structure ${i}`, TOL);
    });
    expectZero(largestNodeResidual(whole, one), fScale, "nodes", TOL);
    expect(uScale).toBeGreaterThan(1e-4);
  });
});

describe("solve with member loads: load cases and the result", () => {
  const beam = (): Model => {
    const model = frame(
      [
        ["n1", 0, 0, 0],
        ["n2", 4, 0, 0],
        ["n3", 4, 0, 3],
      ],
      [
        ["m1", "n1", "n2"],
        ["m2", "n2", "n3", 15],
      ],
      [support("n1", ALL)],
    );
    model.loadCases = [
      { id: "lc1", name: "LC1" },
      { id: "lc2", name: "LC2" },
      { id: "lc3", name: "LC3" },
      { id: "lc4", name: "LC4" },
    ];
    return model;
  };
  const u1 = (lc: string) => uniform(`u-${lc}`, "m1", "global", "z", -3, lc);
  const p1 = (lc: string) => point(`p-${lc}`, "m2", "global", "y", 2, 1.2, lc);
  const p2 = (lc: string) => point(`q-${lc}`, "m1", "local", "y", 5, 3, lc);

  it("a member load belongs to its load case only: each case equals the case solved alone, a case with no load is zero, and a case with all the loads is the sum of the others (tolerance: exact for the first two; 1e-12 · the largest value for the sum)", () => {
    const model = beam();
    model.memberUniformLoads = [u1("lc1"), u1("lc3")];
    model.memberPointLoads = [p1("lc2"), p2("lc2"), p1("lc3"), p2("lc3")];
    const result = solve(model);
    if (!result.ok) {
      throw new Error("test: expected the model to solve");
    }
    const alone = (uniformLoads: MemberUniformLoad[], pointLoads: MemberPointLoad[]) => {
      const single = beam();
      single.loadCases = [{ id: "lc1", name: "LC1" }];
      single.memberUniformLoads = uniformLoads;
      single.memberPointLoads = pointLoads;
      return solved(single);
    };
    const lc1 = get(result.loadCases, "lc1");
    const lc2 = get(result.loadCases, "lc2");
    const lc3 = get(result.loadCases, "lc3");
    const lc4 = get(result.loadCases, "lc4");
    expect({ ...lc1, loadCaseId: "" }).toEqual({ ...alone([u1("lc1")], []), loadCaseId: "" });
    expect({ ...lc2, loadCaseId: "" }).toEqual({
      ...alone([], [p1("lc1"), p2("lc1")]),
      loadCaseId: "",
    });
    expect(Array.from(lc4.displacementVector).every((value) => value === 0)).toBe(true);
    expect(Array.from(lc4.reactionVector).every((value) => value === 0)).toBe(true);
    for (const ends of Object.values(lc4.memberEndForces)) {
      expect(ends).toEqual({
        start: { fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 },
        end: { fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 },
      });
    }
    const largest = (values: Float64Array): number => Math.max(...Array.from(values, Math.abs));
    const uScale = largest(lc3.displacementVector);
    lc3.displacementVector.forEach((value, i) => {
      const sum = (lc1.displacementVector[i] as number) + (lc2.displacementVector[i] as number);
      expectZero(value - sum, uScale);
    });
    const fScale = largest(lc3.reactionVector);
    lc3.reactionVector.forEach((value, i) => {
      expectZero(
        value - (lc1.reactionVector[i] as number) - (lc2.reactionVector[i] as number),
        fScale,
      );
    });
    for (const id of ["m1", "m2"]) {
      for (const end of ["start", "end"] as const) {
        for (const component of F) {
          expectZero(
            get(lc3.memberEndForces, id)[end][component] -
              get(lc1.memberEndForces, id)[end][component] -
              get(lc2.memberEndForces, id)[end][component],
            fScale,
          );
        }
      }
    }
    expect(uScale).toBeGreaterThan(1e-4);
  });

  it("the result with member end forces is plain data: it survives structuredClone; memberIds and the keys of memberEndForces are the members in the model's order", () => {
    const model = portalFrame();
    model.memberUniformLoads.push(uniform("ul1", "b1", "global", "z", -10));
    const result = solve(model);
    if (!result.ok) {
      throw new Error("test: expected the model to solve");
    }
    expect(structuredClone(result)).toEqual(result);
    expect(result.memberIds).toEqual(["c1", "b1", "c2"]);
    const lc1 = get(result.loadCases, "lc1");
    expect(Object.keys(lc1.memberEndForces)).toEqual(["c1", "b1", "c2"]);
    expect(Object.keys(get(lc1.memberEndForces, "b1"))).toEqual(["start", "end"]);
    expect(Object.keys(get(lc1.memberEndForces, "b1").start)).toEqual([...F]);
    expect(typeof result.smallestPivotRatio).toBe("number");
    expect(JSON.parse(JSON.stringify(lc1.memberEndForces))).toEqual(lc1.memberEndForces);
  });

  it("a member whose id is a name of Object.prototype has an ordinary entry", () => {
    const model = frame(
      [
        ["n1", 0, 0, 0],
        ["n2", 3, 0, 0],
      ],
      [["__proto__", "n1", "n2"]],
      [support("n1", ALL)],
      { uniform: [uniform("u1", "__proto__", "global", "z", -1)] },
    );
    const result = solved(model);
    expect(Object.keys(result.memberEndForces)).toEqual(["__proto__"]);
    expectRel(get(result.memberEndForces, "__proto__").start.fz, 3, REL);
  });

  it("the smallest pivot ratio: 1/4 for a cantilever of one element, 1 when nothing is free, the same for every load of the model (tolerance: relative 1e-12)", () => {
    const cantilever = frame(
      [
        ["n1", 0, 0, 0],
        ["n2", 3, 0, 0],
      ],
      [["m1", "n1", "n2"]],
      [support("n1", ALL)],
    );
    const plain = solve(cantilever);
    cantilever.memberUniformLoads.push(uniform("u1", "m1", "global", "z", -1e6));
    const loaded = solve(cantilever);
    if (!plain.ok || !loaded.ok) {
      throw new Error("test: expected the model to solve");
    }
    // Eliminating a tip deflection (12EI/L³) leaves the rotation 4EI/L - (6EI/L²)²/(12EI/L³) = EI/L,
    // a quarter of its diagonal entry; axial and torsion have the ratio 1.
    expectRel(plain.smallestPivotRatio, 0.25, REL);
    expect(loaded.smallestPivotRatio).toBe(plain.smallestPivotRatio);
    cantilever.supports.push(support("n2", ALL));
    const held = solve(cantilever);
    expect(held.ok && held.smallestPivotRatio).toBe(1);
  });

  it("does not change the model", () => {
    const model = portalFrame();
    model.memberUniformLoads.push(uniform("ul1", "b1", "global", "z", -10));
    model.memberPointLoads.push(point("pl1", "c1", "global", "x", 5, 1.5));
    const before = structuredClone(model);
    solve(model);
    expect(model).toEqual(before);
  });

  it("a member load so large that its equivalent nodal load overflows is reported as non-finite for its load case", () => {
    const model = simplySupportedBeam();
    (model.memberUniformLoads[0] as MemberUniformLoad).value = -1e308;
    expect(solve(model)).toEqual({
      ok: false,
      reason: "non-finite",
      where: "load-case",
      loadCaseId: "lc1",
    });
  });

  it("the sensitivity uses the whole load vector: for a cantilever under a uniform load it is finite, positive and of the order of ε", () => {
    const model = frame(
      [
        ["n1", 0, 0, 0],
        ["n2", 3, 0, 0],
      ],
      [["m1", "n1", "n2"]],
      [support("n1", ALL)],
      { uniform: [uniform("u1", "m1", "global", "z", -1)] },
    );
    const { sensitivity } = solved(model);
    expect(sensitivity).toBeGreaterThan(Number.EPSILON / 2);
    expect(sensitivity).toBeLessThan(100 * Number.EPSILON);
  });
});
