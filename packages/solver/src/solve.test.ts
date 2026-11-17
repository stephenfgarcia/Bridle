import { type Model, type NodalLoad, planarTruss, portalFrame, type Support } from "@bridle/model";
import { describe, expect, it } from "vitest";
import {
  assemble,
  DOFS,
  factorize,
  fromRows,
  type LoadCaseResult,
  multiplyVector,
  PIVOT_THRESHOLD,
  REACTION_COMPONENTS,
  type SolveResult,
  solve,
  solveFactorized,
  zeros,
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

const ALL: readonly DofName[] = DOFS;

function load(
  id: string,
  nodeId: string,
  components: Partial<Record<Component, number>>,
  loadCaseId = "lc1",
): NodalLoad {
  return { id, loadCaseId, nodeId, fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0, ...components };
}

/** A model of frame members with the fixtures' section `s1` and material `mat1`, and load case `lc1`. */
function frame(
  nodes: [id: string, x: number, y: number, z: number][],
  members: [id: string, start: string, end: string][],
  supports: Support[],
  nodalLoads: NodalLoad[] = [],
): Model {
  return {
    version: 1,
    units: { force: "kN", length: "m" },
    nodes: nodes.map(([id, x, y, z]) => ({ id, x, y, z })),
    members: members.map(([id, startNodeId, endNodeId]) => ({
      id,
      startNodeId,
      endNodeId,
      sectionId: "s1",
      materialId: "mat1",
      kind: "frame",
      rollAngleDeg: 0,
      releases: {
        start: { rx: false, ry: false, rz: false },
        end: { rx: false, ry: false, rz: false },
      },
    })),
    sections: [{ id: "s1", name: "I 300x150", A, Iy, Iz, J, depthY: 0.15, depthZ: 0.3 }],
    materials: [{ id: "mat1", name: "S355", E, G, fy: 3.55e5, density: 7850 }],
    supports,
    loadCases: [{ id: "lc1", name: "LC1" }],
    nodalLoads,
    memberUniformLoads: [],
    memberPointLoads: [],
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

function unstable(model: Model): Extract<SolveResult, { reason: "unstable" }> {
  const result = solve(model);
  if (result.ok || result.reason !== "unstable") {
    throw new Error(`test: expected unstable, got ${JSON.stringify(result)}`);
  }
  return result;
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

function expectZero(actual: number, scale: number, what?: string): void {
  expect(Math.abs(actual), what).toBeLessThanOrEqual(ZERO * scale);
}

/** Checks the six components of an entry: `expected` gives the nonzero ones, the others must be zero within ZERO · scale. */
function expectSix<K extends string>(
  actual: Record<K, number>,
  keys: readonly K[],
  expected: Partial<Record<K, number>>,
  zeroScale: number,
  tolerance = REL,
): void {
  for (const key of keys) {
    const value = expected[key];
    if (value === undefined) {
      expectZero(actual[key], zeroScale, key);
    } else {
      expectRel(actual[key], value, tolerance, key);
    }
  }
}

/**
 * The resultant of every nodal load of the case and every reaction: three force sums and three
 * moment sums about the origin (each force F at a node at r adds r × F to the moment). All six are
 * zero for a structure in equilibrium.
 */
function resultant(model: Model, result: LoadCaseResult): number[] {
  const position = new Map(model.nodes.map((node) => [node.id, node]));
  const sum = [0, 0, 0, 0, 0, 0];
  const add = (nodeId: string, f: Record<Component, number>): void => {
    const r = position.get(nodeId);
    if (r === undefined) {
      throw new Error(`test: no node ${nodeId}`);
    }
    const parts = [
      f.fx,
      f.fy,
      f.fz,
      f.mx + r.y * f.fz - r.z * f.fy,
      f.my + r.z * f.fx - r.x * f.fz,
      f.mz + r.x * f.fy - r.y * f.fx,
    ];
    parts.forEach((part, i) => {
      sum[i] = (sum[i] as number) + part;
    });
  };
  for (const nodalLoad of model.nodalLoads) {
    if (nodalLoad.loadCaseId === result.loadCaseId) {
      add(nodalLoad.nodeId, nodalLoad);
    }
  }
  for (const [nodeId, reaction] of Object.entries(result.reactions)) {
    add(nodeId, reaction);
  }
  return sum;
}

/**
 * The smallest ratio of a pivot to its diagonal entry in the factorization of a model's reduced
 * matrix, for a model that `solve` accepts. The reduced matrix is built here from `assemble` and the
 * supports, and factorized with `factorize` and `PIVOT_THRESHOLD`, as `solve` does.
 */
function smallestRatio(model: Model): number {
  const assembled = assemble(model);
  if (!assembled.ok) {
    throw new Error("test: expected the model to assemble");
  }
  const { stiffness, dofMap } = assembled;
  const free: number[] = [];
  const restrained = new Set<number>();
  for (const item of model.supports) {
    const node = dofMap.nodeIndex.get(item.nodeId) as number;
    DOFS.forEach((dof, d) => {
      if (item[dof]) {
        restrained.add(6 * node + d);
      }
    });
  }
  for (let row = 0; row < dofMap.size; row++) {
    if (!restrained.has(row)) {
      free.push(row);
    }
  }
  const reduced = zeros(free.length, free.length);
  free.forEach((row, i) => {
    free.forEach((col, j) => {
      reduced.data[i * free.length + j] = stiffness.data[row * dofMap.size + col] as number;
    });
  });
  const result = factorize(reduced, PIVOT_THRESHOLD);
  if (!result.ok) {
    throw new Error("test: expected the reduced matrix to factorize");
  }
  const { order, pivots } = result.factorization;
  let smallest = Number.POSITIVE_INFINITY;
  for (let k = 0; k < free.length; k++) {
    const row = order[k] as number;
    smallest = Math.min(
      smallest,
      (pivots[k] as number) / (reduced.data[row * free.length + row] as number),
    );
  }
  return smallest;
}

/** A repeatable source of numbers from 0 (included) to 1 (not included): the mulberry32 generator. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Solves A x = b by Gaussian elimination with partial pivoting: the reference for `solveFactorized`. */
function gauss(rows: number[][], b: number[]): number[] {
  const n = b.length;
  const m = rows.map((row, i) => [...row, b[i] as number]);
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) {
      if (Math.abs((m[i] as number[])[k] as number) > Math.abs((m[p] as number[])[k] as number)) {
        p = i;
      }
    }
    const swap = m[k] as number[];
    m[k] = m[p] as number[];
    m[p] = swap;
    const pivotRow = m[k] as number[];
    for (let i = k + 1; i < n; i++) {
      const row = m[i] as number[];
      const factor = (row[k] as number) / (pivotRow[k] as number);
      for (let j = k; j <= n; j++) {
        row[j] = (row[j] as number) - factor * (pivotRow[j] as number);
      }
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    const row = m[i] as number[];
    let sum = row[n] as number;
    for (let j = i + 1; j < n; j++) {
      sum -= (row[j] as number) * (x[j] as number);
    }
    x[i] = sum / (row[i] as number);
  }
  return x;
}

describe("factorize and solveFactorized", () => {
  // Worked by hand. Step 0: every ratio is 1, so row 0 goes first (pivot 4). What is left of rows 1
  // and 2 is [2.5 2; 2 8], with ratios 2.5/3.5 and 8/9, so row 2 goes next (pivot 8), and row 1 is
  // left with 2.5 - 2·2/8 = 2. In the order (0, 2, 1): L = [1; 0.5 1; 0.5 0.25 1], D = (4, 8, 2).
  const SPD = [
    [4, 2, 2],
    [2, 3.5, 3],
    [2, 3, 9],
  ];

  it("factorizes a 3 by 3 matrix into the order, L and D worked by hand (tolerance: exact)", () => {
    const result = factorize(fromRows(SPD), PIVOT_THRESHOLD);
    if (!result.ok) {
      throw new Error("test: expected a factorization");
    }
    const { lower, pivots, order, size } = result.factorization;
    expect(size).toBe(3);
    expect(Array.from(order)).toEqual([0, 2, 1]);
    expect(Array.from(pivots)).toEqual([4, 8, 2]);
    expect([lower[3], lower[6], lower[7]]).toEqual([0.5, 0.5, 0.25]);
  });

  it("solves A x = b for that matrix (tolerance: exact; every intermediate value is a whole number or a half)", () => {
    const result = factorize(fromRows(SPD), PIVOT_THRESHOLD);
    if (!result.ok) {
      throw new Error("test: expected a factorization");
    }
    // x = (1, -2, 3) gives b = (6, 4, 23).
    const b = [6, 4, 23];
    expect(Array.from(solveFactorized(result.factorization, b))).toEqual([1, -2, 3]);
    expect(b).toEqual([6, 4, 23]);
  });

  it("factorizes the average of the matrix and its transpose, and does not change the matrix", () => {
    const skewed = fromRows([
      [4, 2.25, 1],
      [1.75, 3.5, 3.5],
      [3, 2.5, 9],
    ]);
    const before = Array.from(skewed.data);
    const result = factorize(skewed, PIVOT_THRESHOLD);
    if (!result.ok) {
      throw new Error("test: expected a factorization");
    }
    expect(Array.from(result.factorization.order)).toEqual([0, 2, 1]);
    expect(Array.from(result.factorization.pivots)).toEqual([4, 8, 2]);
    expect(Array.from(skewed.data)).toEqual(before);
  });

  it("solves a tridiagonal system (tolerance: residual at most 1e-12 · max|b|)", () => {
    // Tridiagonal, diagonally dominant, so positive definite.
    const n = 8;
    const rows = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 4 + i : Math.abs(i - j) === 1 ? -1.5 : 0)),
    );
    const matrix = fromRows(rows);
    const result = factorize(matrix, PIVOT_THRESHOLD);
    if (!result.ok) {
      throw new Error("test: expected a factorization");
    }
    const b = Array.from({ length: n }, (_, i) => (i % 3) - 0.7 * i);
    const x = solveFactorized(result.factorization, b);
    const residual = Array.from(multiplyVector(matrix, x), (value, i) => value - (b[i] as number));
    const scale = Math.max(...b.map(Math.abs));
    expect(Math.max(...residual.map(Math.abs))).toBeLessThanOrEqual(1e-12 * scale);
  });

  it("agrees with Gaussian elimination with partial pivoting on 20 full matrices of 15 rows whose rows it reorders (tolerance: 1e-10 · max|x|)", () => {
    // A = Bᵀ B + S, with B full and S diagonal with entries from 0.01 to 100, so the rows have very
    // different diagonal entries and the order of elimination is not the order of the rows.
    const next = random(2026);
    const n = 15;
    for (let sample = 0; sample < 20; sample++) {
      const B = Array.from({ length: n }, () => Array.from({ length: n }, () => next() - 0.5));
      const rows = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => {
          let sum = i === j ? 10 ** (4 * next() - 2) : 0;
          for (let k = 0; k < n; k++) {
            sum += ((B[k] as number[])[i] as number) * ((B[k] as number[])[j] as number);
          }
          return sum;
        }),
      );
      const b = Array.from({ length: n }, () => 10 * (next() - 0.5));
      const result = factorize(fromRows(rows), PIVOT_THRESHOLD);
      if (!result.ok) {
        throw new Error("test: expected a factorization");
      }
      const order = Array.from(result.factorization.order);
      expect([...order].sort((p, q) => p - q)).toEqual(Array.from({ length: n }, (_, i) => i));
      expect(order).not.toEqual(Array.from({ length: n }, (_, i) => i));
      const x = solveFactorized(result.factorization, b);
      const reference = gauss(rows, b);
      const scale = Math.max(...reference.map(Math.abs));
      for (let i = 0; i < n; i++) {
        expect(Math.abs((x[i] as number) - (reference[i] as number))).toBeLessThanOrEqual(
          1e-10 * scale,
        );
      }
    }
  });

  it("stops when no row that is left has a pivot above the threshold times its diagonal entry, and names the best row left", () => {
    // Singular: the second row repeats the first. Row 0 goes first, then row 2 (ratio 1); row 1 is
    // left with a pivot of exactly 0.
    expect(
      factorize(
        fromRows([
          [2, 2, 0],
          [2, 2, 0],
          [0, 0, 1],
        ]),
        PIVOT_THRESHOLD,
      ),
    ).toEqual({ ok: false, index: 1, pivot: 0, diagonal: 2, remaining: 1 });
    // A zero row, last and first: the other row is eliminated, the zero row is named.
    expect(
      factorize(
        fromRows([
          [3, 0],
          [0, 0],
        ]),
        PIVOT_THRESHOLD,
      ),
    ).toEqual({ ok: false, index: 1, pivot: 0, diagonal: 0, remaining: 1 });
    expect(
      factorize(
        fromRows([
          [0, 0],
          [0, 3],
        ]),
        PIVOT_THRESHOLD,
      ),
    ).toEqual({ ok: false, index: 0, pivot: 0, diagonal: 0, remaining: 1 });
    // Two zero rows: both are left, and the first is named.
    expect(
      factorize(
        fromRows([
          [0, 0, 0],
          [0, 3, 0],
          [0, 0, 0],
        ]),
        PIVOT_THRESHOLD,
      ),
    ).toEqual({ ok: false, index: 0, pivot: 0, diagonal: 0, remaining: 2 });
    // Indefinite: the second pivot is 1 - 4 = -3.
    expect(
      factorize(
        fromRows([
          [1, 2],
          [2, 1],
        ]),
        PIVOT_THRESHOLD,
      ),
    ).toEqual({ ok: false, index: 1, pivot: -3, diagonal: 1, remaining: 1 });
    // The threshold is relative to the row's own diagonal entry: the pivot 1e-3 of a row whose
    // diagonal is 1.001 passes at 1e-9 and fails at 1e-2.
    const nearly = fromRows([
      [1, 1],
      [1, 1.001],
    ]);
    expect(factorize(nearly, 1e-9).ok).toBe(true);
    const refused = factorize(nearly, 1e-2);
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.index).toBe(1);
      expect(refused.diagonal).toBe(1.001);
      expectRel(refused.pivot, 1e-3, 1e-12);
    }
  });

  it("throws for a matrix that is not square and for a vector of the wrong length", () => {
    expect(() => factorize(fromRows([[1, 2]]), PIVOT_THRESHOLD)).toThrow(RangeError);
    const result = factorize(fromRows(SPD), PIVOT_THRESHOLD);
    if (!result.ok) {
      throw new Error("test: expected a factorization");
    }
    expect(() => solveFactorized(result.factorization, [1, 2])).toThrow(RangeError);
  });
});

describe("solve: closed-form cases", () => {
  const L = 3;
  const P = 10;
  const cantilever = (nodalLoads: NodalLoad[]): Model =>
    frame(
      [
        ["n1", 0, 0, 0],
        ["n2", L, 0, 0],
      ],
      [["m1", "n1", "n2"]],
      [support("n1", ALL)],
      nodalLoads,
    );

  it("cantilever along +X, downward tip force: deflection, rotation and fixed-end reactions (tolerance: relative 1e-12; zeros within 1e-12 times a scale given in the test)", () => {
    // Bending in the X-Z plane (stiffness E·Iy). Tip: uz = -P L³/(3 E Iy). The slope duz/dx at the
    // tip is -P L²/(2 E Iy), and ry = -slope, so ry = +P L²/(2 E Iy) (the tip turns from Z towards X).
    // Fixed end: the support pushes up with +P; the load's moment about the fixed end is
    // (L, 0, 0) × (0, 0, -P) = (0, +P L, 0), so the support's moment is my = -P L.
    const model = cantilever([load("nl1", "n2", { fz: -P })]);
    const result = solved(model);
    const uz = (-P * L ** 3) / (3 * E * Iy);
    const ry = (P * L ** 2) / (2 * E * Iy);
    expectSix(get(result.displacements, "n2"), DOFS, { uz, ry }, Math.abs(uz));
    expect(get(result.displacements, "n1")).toEqual({ ux: 0, uy: 0, uz: 0, rx: 0, ry: 0, rz: 0 });
    expectSix(get(result.reactions, "n1"), REACTION_COMPONENTS, { fz: P, my: -P * L }, P * L);
    expect(Object.keys(result.reactions)).toEqual(["n1"]);
  });

  it("cantilever along +X, tip force along +Y: the other bending plane (tolerance: relative 1e-12; zeros within 1e-12 times a scale given in the test)", () => {
    // Bending in the X-Y plane (stiffness E·Iz). Tip: uy = +P L³/(3 E Iz) and rz = +slope =
    // +P L²/(2 E Iz). The load's moment about the fixed end is (L, 0, 0) × (0, P, 0) = (0, 0, +P L),
    // so the support gives fy = -P and mz = -P L.
    const result = solved(cantilever([load("nl1", "n2", { fy: P })]));
    const uy = (P * L ** 3) / (3 * E * Iz);
    const rz = (P * L ** 2) / (2 * E * Iz);
    expectSix(get(result.displacements, "n2"), DOFS, { uy, rz }, uy);
    expectSix(get(result.reactions, "n1"), REACTION_COMPONENTS, { fy: -P, mz: -P * L }, P * L);
  });

  it("cantilever with a tip moment about Y and about Z (tolerance: relative 1e-12; zeros within 1e-12 times a scale given in the test)", () => {
    // Constant moment M: the tip rotation is M L/(E I) and the tip deflection is M L²/(2 E I) to the
    // side the rotation turns the axis. A positive ry turns the axis (X) towards -Z: uz = -M L²/(2 E Iy).
    // A positive rz turns X towards +Y: uy = +M L²/(2 E Iz). The support gives the opposite moment
    // and no force.
    const M = 4;
    const aboutY = solved(cantilever([load("nl1", "n2", { my: M })]));
    const ry = (M * L) / (E * Iy);
    const uz = (-M * L ** 2) / (2 * E * Iy);
    expectSix(get(aboutY.displacements, "n2"), DOFS, { ry, uz }, Math.abs(uz));
    expectSix(get(aboutY.reactions, "n1"), REACTION_COMPONENTS, { my: -M }, M);

    const aboutZ = solved(cantilever([load("nl1", "n2", { mz: M })]));
    const rz = (M * L) / (E * Iz);
    const uy = (M * L ** 2) / (2 * E * Iz);
    expectSix(get(aboutZ.displacements, "n2"), DOFS, { rz, uy }, uy);
    expectSix(get(aboutZ.reactions, "n1"), REACTION_COMPONENTS, { mz: -M }, M);
  });

  it("axial bar: elongation P L/(E A) and reaction -P (tolerance: relative 1e-12; zeros within 1e-12 times a scale given in the test)", () => {
    const result = solved(cantilever([load("nl1", "n2", { fx: P })]));
    const ux = (P * L) / (E * A);
    expectSix(get(result.displacements, "n2"), DOFS, { ux }, ux);
    expectSix(get(result.reactions, "n1"), REACTION_COMPONENTS, { fx: -P }, P);
  });

  it("propped cantilever of two elements, load at mid-span: the redundant reaction 5P/16 (tolerance: relative 1e-12; zeros within 1e-12 times a scale given in the test)", () => {
    // Fixed at n1 (x = 0), roller in Z at n3 (x = S), load P downward at the joint n2 (x = S/2).
    // Statically indeterminate to the first degree; by beam theory: roller reaction 5P/16, fixed-end
    // reaction 11P/16, fixed-end moment of size 3PS/16, deflection under the load 7PS³/(768 E I),
    // rotation at the roller of size PS²/(32 E I).
    // Signs: both reactions push up (+fz). Moments about Y at the fixed end: the load gives
    // (S/2, 0, 0) × (0, 0, -P) = +P S/2 and the roller gives (S, 0, 0) × (0, 0, 5P/16) = -5PS/16, so
    // the support's moment is my = -3PS/16. At the roller the beam rises towards the support
    // (slope duz/dx > 0), so ry = -slope = -PS²/(32 E Iy).
    const S = 8;
    const model = frame(
      [
        ["n1", 0, 0, 0],
        ["n2", S / 2, 0, 0],
        ["n3", S, 0, 0],
      ],
      [
        ["m1", "n1", "n2"],
        ["m2", "n2", "n3"],
      ],
      [support("n1", ALL), support("n3", ["uz"])],
      [load("nl1", "n2", { fz: -P })],
    );
    const result = solved(model);
    expectSix(
      get(result.reactions, "n1"),
      REACTION_COMPONENTS,
      { fz: (11 * P) / 16, my: (-3 * P * S) / 16 },
      P * S,
    );
    expectSix(get(result.reactions, "n3"), REACTION_COMPONENTS, { fz: (5 * P) / 16 }, P);
    const uz = (-7 * P * S ** 3) / (768 * E * Iy);
    expectRel(get(result.displacements, "n2").uz, uz, REL);
    expectRel(get(result.displacements, "n3").ry, (-P * S ** 2) / (32 * E * Iy), REL);
    expect(get(result.displacements, "n3").uz).toBe(0);
    for (const value of resultant(model, result)) {
      expectZero(value, P * S);
    }
  });

  it("3D cantilever column with tip forces along X and Y and a torque about Z (tolerance: relative 1e-12; zeros within 1e-12 times a scale given in the test)", () => {
    // A column from n1 at the origin up to n2 at height H, fixed at the base. By the local-axis rule
    // a vertical member that runs upward has local y = global +Y and local z = global -X, so bending
    // towards global X is in the local x-z plane (E·Iy) and bending towards global Y is in the local
    // x-y plane (E·Iz).
    // Fx = P: ux = P H³/(3 E Iy), and the top turns from Z towards X: ry = +P H²/(2 E Iy).
    // Fy = Q: uy = Q H³/(3 E Iz), and the top turns from Z towards Y, which is a negative rotation
    //         about X: rx = -Q H²/(2 E Iz).
    // Mz = T: rz = T H/(G J).
    // The loads' moment about the base is (0, 0, H) × (P, Q, 0) = (-H Q, +H P, 0), plus T about Z, so
    // the support gives mx = +H Q, my = -H P, mz = -T, and fx = -P, fy = -Q.
    const H = 4;
    const Q = 3;
    const T = 0.5;
    const model = frame(
      [
        ["n1", 0, 0, 0],
        ["n2", 0, 0, H],
      ],
      [["c1", "n1", "n2"]],
      [support("n1", ALL)],
      [load("nl1", "n2", { fx: P, fy: Q, mz: T })],
    );
    const result = solved(model);
    const ux = (P * H ** 3) / (3 * E * Iy);
    const uy = (Q * H ** 3) / (3 * E * Iz);
    expectSix(
      get(result.displacements, "n2"),
      DOFS,
      {
        ux,
        uy,
        ry: (P * H ** 2) / (2 * E * Iy),
        rx: (-Q * H ** 2) / (2 * E * Iz),
        rz: (T * H) / (G * J),
      },
      ux,
    );
    expectSix(
      get(result.reactions, "n1"),
      REACTION_COMPONENTS,
      { fx: -P, fy: -Q, mx: H * Q, my: -H * P, mz: -T },
      P,
    );
  });
});

describe("solve: the portal frame fixture", () => {
  it("reactions balance the lateral load in forces and in moments about the origin (tolerance: 1e-12 · 80 kN·m, the load's moment about the origin)", () => {
    const model = portalFrame();
    const result = solved(model);
    // 20 kN along +X at n2 (0, 0, 4): its moment about the origin is (0, +80, 0) kN·m.
    for (const value of resultant(model, result)) {
      expectZero(value, 80);
    }
    const n1 = get(result.reactions, "n1");
    const n4 = get(result.reactions, "n4");
    // Written out for the two in-plane sums that are not trivially zero.
    expectZero(n1.fx + n4.fx + 20, 80);
    expectZero(n1.my + n4.my + 4 * 20 - 6 * n4.fz, 80);
    // Signs: both supports push back along -X; the load tries to overturn the frame towards +X, so
    // the right base pushes up and the left base pulls down; both base moments are negative.
    expect(n1.fx).toBeLessThan(0);
    expect(n4.fx).toBeLessThan(0);
    expect(n1.fz).toBeLessThan(0);
    expect(n4.fz).toBeGreaterThan(0);
    expect(n1.my).toBeLessThan(0);
    expect(n4.my).toBeLessThan(0);
    // The frame and its load are in the X-Z plane: nothing moves or reacts out of it.
    for (const nodeId of ["n1", "n2", "n3", "n4"]) {
      const u = get(result.displacements, nodeId);
      expect([u.uy, u.rx, u.rz]).toEqual([0, 0, 0]);
    }
    expect([n1.fy, n1.mx, n1.mz, n4.fy, n4.mx, n4.mz]).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it("the sway agrees with the slope-deflection value when the axial stiffness is made large (tolerance: relative 1e-7, with the area times 1e6)", () => {
    // Slope-deflection for a fixed-base portal with inextensible members, columns of height h and
    // stiffness E·Ic, a beam of span b and stiffness E·Ib, lateral load H at beam level, and
    // k = (Ib/b)/(Ic/h). Both joints rotate by θ and sway by Δ:
    //   joint:  (4 E Ic/h) θ - (6 E Ic/h²) Δ + (6 E Ib/b) θ = 0   →  θ = 6 Δ / (h (4 + 6k))
    //   storey: H = 2 (12 E Ic Δ/h³ - 6 E Ic θ/h²)                →  Δ = H h³ (2 + 3k) / (12 E Ic (1 + 6k))
    //   base moment of each column, in size: (2 E Ic/h)(3Δ/h - θ) = (H h/2)(1 + 3k)/(1 + 6k)
    // The model's members shorten and lengthen, which the formula leaves out. With the fixture's own
    // area the eight values below differ from the formulas by up to 1.4 %; the difference falls in
    // proportion to 1/A, and with the area times 1e6 the largest is about 1.4e-8 (the rotation of
    // n2). So the tolerance 1e-7 bounds the modelling difference; it is not a rounding tolerance.
    const model = portalFrame();
    (model.sections[0] as Model["sections"][number]).A = A * 1e6;
    const result = solved(model);
    const H = 20;
    const h = 4;
    const b = 6;
    const k = Iy / b / (Iy / h);
    const sway = (H * h ** 3 * (2 + 3 * k)) / (12 * E * Iy * (1 + 6 * k));
    const theta = (6 * sway) / (h * (4 + 6 * k));
    const baseMoment = ((H * h) / 2) * ((1 + 3 * k) / (1 + 6 * k));
    const tolerance = 1e-7;
    expectRel(get(result.displacements, "n2").ux, sway, tolerance);
    expectRel(get(result.displacements, "n3").ux, sway, tolerance);
    // The joints turn from Z towards X (positive ry); the base moments are negative (see above).
    expectRel(get(result.displacements, "n2").ry, theta, tolerance);
    expectRel(get(result.displacements, "n3").ry, theta, tolerance);
    expectRel(get(result.reactions, "n1").my, -baseMoment, tolerance);
    expectRel(get(result.reactions, "n4").my, -baseMoment, tolerance);
    expectRel(get(result.reactions, "n1").fx, -H / 2, tolerance);
    expectRel(get(result.reactions, "n4").fx, -H / 2, tolerance);
  });
});

describe("solve: load cases, supports and the result", () => {
  const twoCases = (): Model => {
    const model = frame(
      [
        ["n1", 0, 0, 0],
        ["n2", 3, 0, 0],
      ],
      [["m1", "n1", "n2"]],
      [support("n1", ALL)],
      [
        load("a", "n2", { fz: -10 }, "lc1"),
        load("b", "n2", { fy: 2 }, "lc2"),
        load("c", "n2", { mx: 0.25 }, "lc2"),
      ],
    );
    model.loadCases = [
      { id: "lc1", name: "LC1" },
      { id: "lc2", name: "LC2" },
    ];
    return model;
  };

  it("two load cases in one model give two independent results, each equal to the case solved alone (tolerance: exact; two closed-form values at relative 1e-12)", () => {
    const model = twoCases();
    const result = solve(model);
    if (!result.ok) {
      throw new Error("test: expected the model to solve");
    }
    expect(Object.keys(result.loadCases)).toEqual(["lc1", "lc2"]);
    for (const id of ["lc1", "lc2"]) {
      const alone = twoCases();
      alone.loadCases = alone.loadCases.filter((loadCase) => loadCase.id === id);
      alone.nodalLoads = alone.nodalLoads.filter((nodalLoad) => nodalLoad.loadCaseId === id);
      expect(get(result.loadCases, id)).toEqual(solved(alone, id));
    }
    const lc1 = get(get(result.loadCases, "lc1").displacements, "n2");
    const lc2 = get(get(result.loadCases, "lc2").displacements, "n2");
    // lc1 bends in the X-Z plane only; lc2 bends in the X-Y plane and twists.
    expect([lc1.uy, lc1.rx, lc1.rz]).toEqual([0, 0, 0]);
    expect(lc1.uz).toBeLessThan(0);
    expect([lc2.uz, lc2.ry]).toEqual([0, 0]);
    expectRel(lc2.uy, (2 * 3 ** 3) / (3 * E * Iz), REL);
    expectRel(lc2.rx, (0.25 * 3) / (G * J), REL);
  });

  it("a load case with no load gives zero displacements and zero reactions (tolerance: exact)", () => {
    const model = twoCases();
    model.loadCases.push({ id: "empty", name: "Empty" });
    const result = solved(model, "empty");
    expect(Array.from(result.displacementVector).every((value) => value === 0)).toBe(true);
    expect(Array.from(result.reactionVector).every((value) => value === 0)).toBe(true);
    expect(result.sensitivity).toBe(0);
  });

  it("the sensitivity of a result is ε · Σ|u_i||K_ij||u_j| / Σ f_i u_i: ε for an axial bar, 13 ε for a tip-loaded cantilever (tolerance: relative 1e-12)", () => {
    const bar = (nodalLoad: NodalLoad): Model =>
      frame(
        [
          ["n1", 0, 0, 0],
          ["n2", 3, 0, 0],
        ],
        [["m1", "n1", "n2"]],
        [support("n1", ALL)],
        [nodalLoad],
      );
    // One displacement, u = P L/(E A): the sum is u · (E A/L) · u = P u, the work is P u.
    expectRel(solved(bar(load("nl1", "n2", { fx: 10 }))).sensitivity, Number.EPSILON, REL);
    // Tip force P: d = P L³/(3 E I) and θ = P L²/(2 E I). With k = E I/L³ the sum is
    // 12 k d² + 2 · 6 k L d θ + 4 k L² θ² = (12/9 + 2 + 1) P² L³/(E I), and the work is
    // P d = (1/3) P² L³/(E I): the ratio is 13.
    expectRel(solved(bar(load("nl1", "n2", { fz: -10 }))).sensitivity, 13 * Number.EPSILON, REL);
  });

  it("a model with no load case solves to an empty set of results, and is still checked for stability", () => {
    const model = twoCases();
    model.loadCases = [];
    model.nodalLoads = [];
    expect(solve(model)).toEqual({ ok: true, nodeIds: ["n1", "n2"], loadCases: {} });
    model.supports = [support("n1", ["ux", "uy", "uz"])];
    expect(solve(model).ok).toBe(false);
  });

  it("loads on one node add up, and a load on a restrained degree of freedom goes to the reaction (tolerance: relative 1e-12; zeros within 1e-12 times a scale given in the test)", () => {
    const model = frame(
      [
        ["n1", 0, 0, 0],
        ["n2", 3, 0, 0],
      ],
      [["m1", "n1", "n2"]],
      [support("n1", ALL)],
      [
        load("a", "n2", { fx: 4 }),
        load("b", "n2", { fx: 6 }),
        load("c", "n1", { fz: -7, my: 1.5 }),
      ],
    );
    const result = solved(model);
    expectRel(get(result.displacements, "n2").ux, (10 * 3) / (E * A), REL);
    // The reaction is K u - f on the restrained rows: -10 from the bar, +7 and -1.5 against the
    // load applied on the support itself.
    expectSix(get(result.reactions, "n1"), REACTION_COMPONENTS, { fx: -10, fz: 7, my: -1.5 }, 10);
  });

  it("an unrestrained component of a support has a reaction of exactly 0, and every support has an entry", () => {
    // n1 holds everything except the rotation about Y; n2 holds the translation along Z only; n3
    // (at mid-span) has a support that restrains nothing.
    const model = frame(
      [
        ["n1", 0, 0, 0],
        ["n2", 6, 0, 0],
        ["n3", 3, 0, 0],
      ],
      [
        ["m1", "n1", "n3"],
        ["m2", "n3", "n2"],
      ],
      [support("n1", ["ux", "uy", "uz", "rx", "rz"]), support("n2", ["uz"]), support("n3", [])],
      [load("nl1", "n3", { fz: -12 })],
    );
    const result = solved(model);
    expect(Object.keys(result.reactions)).toEqual(["n1", "n2", "n3"]);
    expect(get(result.reactions, "n3")).toEqual({ fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 });
    expect(get(result.reactions, "n1").my).toBe(0);
    const n2 = get(result.reactions, "n2");
    expect([n2.fx, n2.fy, n2.mx, n2.my, n2.mz]).toEqual([0, 0, 0, 0, 0]);
    // A simply supported beam with a mid-span load: each support carries half (relative 1e-12).
    expectRel(get(result.reactions, "n1").fz, 6, REL);
    expectRel(n2.fz, 6, REL);
    // Mid-span deflection P S³/(48 E Iy) downward (relative 1e-12).
    expectRel(get(result.displacements, "n3").uz, (-12 * 6 ** 3) / (48 * E * Iy), REL);
  });

  it("a model with every degree of freedom restrained gives zero displacements and reactions equal to minus the loads (tolerance: exact)", () => {
    const model = frame(
      [
        ["n1", 0, 0, 0],
        ["n2", 3, 0, 0],
      ],
      [["m1", "n1", "n2"]],
      [support("n1", ALL), support("n2", ALL)],
      [load("nl1", "n2", { fx: 1, fy: 2, fz: 3, mx: 4, my: 5, mz: 6 })],
    );
    const result = solved(model);
    expect(Array.from(result.displacementVector).every((value) => value === 0)).toBe(true);
    expect(get(result.reactions, "n2")).toEqual({
      fx: -1,
      fy: -2,
      fz: -3,
      mx: -4,
      my: -5,
      mz: -6,
    });
  });

  it("the result is plain data: it survives structuredClone, and the vectors hold the same numbers as the records", () => {
    const model = portalFrame();
    const result = solve(model);
    if (!result.ok) {
      throw new Error("test: expected the model to solve");
    }
    expect(structuredClone(result)).toEqual(result);
    expect(result.nodeIds).toEqual(["n1", "n2", "n3", "n4"]);
    const lc1 = get(result.loadCases, "lc1");
    expect(lc1.loadCaseId).toBe("lc1");
    expect(lc1.displacementVector).toBeInstanceOf(Float64Array);
    expect(lc1.reactionVector).toBeInstanceOf(Float64Array);
    expect(lc1.displacementVector).toHaveLength(24);
    expect(lc1.reactionVector).toHaveLength(24);
    expect(Object.keys(lc1.displacements)).toEqual(["n1", "n2", "n3", "n4"]);
    result.nodeIds.forEach((nodeId, node) => {
      const u = get(lc1.displacements, nodeId);
      DOFS.forEach((dof, d) => {
        expect(lc1.displacementVector[6 * node + d]).toBe(u[dof]);
      });
      const r = lc1.reactions[nodeId];
      REACTION_COMPONENTS.forEach((component, d) => {
        expect(lc1.reactionVector[6 * node + d]).toBe(r === undefined ? 0 : r[component]);
      });
    });
    expect(Object.keys(lc1.reactions)).toEqual(["n1", "n4"]);
  });

  it("ids that are also names of Object.prototype are ordinary keys of the result", () => {
    const model = frame(
      [
        ["__proto__", 0, 0, 0],
        ["constructor", 3, 0, 0],
      ],
      [["m1", "__proto__", "constructor"]],
      [support("__proto__", ALL)],
      [load("nl1", "constructor", { fx: 10 }, "toString")],
    );
    model.loadCases = [{ id: "toString", name: "LC" }];
    const result = solve(model);
    if (!result.ok) {
      throw new Error("test: expected the model to solve");
    }
    expect(Object.keys(result.loadCases)).toEqual(["toString"]);
    const lc = get(result.loadCases, "toString");
    expect(Object.keys(lc.displacements)).toEqual(["__proto__", "constructor"]);
    expectRel(get(lc.displacements, "constructor").ux, (10 * 3) / (E * A), REL);
    expectRel(get(lc.reactions, "__proto__").fx, -10, REL);
  });

  it("does not change the model", () => {
    const model = portalFrame();
    solve(model);
    expect(model).toEqual(portalFrame());
  });
});

describe("solve: refusals", () => {
  it("returns the issues of validateModel for an invalid model; a model with no support is one", () => {
    const model = portalFrame();
    model.supports = [];
    expect(solve(model)).toEqual({
      ok: false,
      reason: "invalid-model",
      issues: [{ code: "no-support", messageKey: "model.issue.no-support", ids: [] }],
    });
  });

  it("refuses a number that is not finite as an invalid model", () => {
    const model = portalFrame();
    (model.nodalLoads[0] as NodalLoad).fx = Number.NaN;
    expect(solve(model)).toEqual({
      ok: false,
      reason: "invalid-model",
      issues: [
        {
          code: "non-finite-value",
          messageKey: "model.issue.non-finite-value",
          ids: ["nl1"],
          path: "nodalLoads[0].fx",
        },
      ],
    });
  });

  it("refuses a model with a uniform member load or a member point load as not supported yet", () => {
    const model = portalFrame();
    model.memberUniformLoads.push({
      id: "ul1",
      loadCaseId: "lc1",
      memberId: "b1",
      axes: "global",
      direction: "z",
      value: -10,
    });
    model.memberPointLoads.push({
      id: "pl1",
      loadCaseId: "lc1",
      memberId: "c1",
      axes: "local",
      direction: "y",
      value: 5,
      position: 2,
    });
    expect(solve(model)).toEqual({
      ok: false,
      reason: "not-supported-yet",
      unsupported: [
        { loadId: "ul1", memberId: "b1", feature: "member-load" },
        { loadId: "pl1", memberId: "c1", feature: "member-load" },
      ],
    });
  });

  it("refuses truss members and end releases as assemble does, listing them before any member load", () => {
    const truss = solve(planarTruss());
    expect(truss.ok).toBe(false);
    if (truss.ok || truss.reason !== "not-supported-yet") {
      throw new Error("test: expected not-supported-yet");
    }
    expect(truss.unsupported).toHaveLength(7);
    expect(truss.unsupported[0]).toEqual({ memberId: "t1", feature: "truss-member" });

    const model = portalFrame();
    (model.members[1] as Model["members"][number]).releases.end.ry = true;
    model.memberUniformLoads.push({
      id: "ul1",
      loadCaseId: "lc1",
      memberId: "b1",
      axes: "global",
      direction: "z",
      value: -10,
    });
    expect(solve(model)).toEqual({
      ok: false,
      reason: "not-supported-yet",
      unsupported: [
        { memberId: "b1", feature: "end-release" },
        { loadId: "ul1", memberId: "b1", feature: "member-load" },
      ],
    });
  });

  it("reports a stiffness that overflows, and a displacement that overflows, as non-finite", () => {
    // E·A = 1e300 · 1e10 overflows a double, although both numbers are finite and positive.
    const stiff = portalFrame();
    (stiff.materials[0] as Model["materials"][number]).E = 1e300;
    (stiff.sections[0] as Model["sections"][number]).A = 1e10;
    expect(solve(stiff)).toEqual({ ok: false, reason: "non-finite", where: "stiffness" });

    // 1e308 kN on a 30 m cantilever: the deflection P L³/(3 E Iz) is above the largest double.
    const loaded = frame(
      [
        ["n1", 0, 0, 0],
        ["n2", 30, 0, 0],
      ],
      [["m1", "n1", "n2"]],
      [support("n1", ALL)],
      [load("nl1", "n2", { fy: 1e308 })],
    );
    expect(solve(loaded)).toEqual({
      ok: false,
      reason: "non-finite",
      where: "load-case",
      loadCaseId: "lc1",
    });
  });
});

/**
 * A space frame on a rectangular grid of columns: `storeys` levels, `bays` + 1 columns each way,
 * beams along X and along Y at every level above the ground. Each level is shifted a little
 * sideways, so no member is exactly along a global axis. Node ids are `n<i>_<j>_<level>`.
 */
function tower(storeys: number, bays: number): Model {
  const nodes: [string, number, number, number][] = [];
  const members: [string, string, string][] = [];
  const id = (i: number, j: number, level: number) => `n${i}_${j}_${level}`;
  for (let level = 0; level <= storeys; level++) {
    for (let i = 0; i <= bays; i++) {
      for (let j = 0; j <= bays; j++) {
        nodes.push([
          id(i, j, level),
          5.1 * i + 0.013 * level,
          4.3 * j - 0.021 * level,
          3.2 * level,
        ]);
        if (level < storeys) {
          members.push([`m${members.length}`, id(i, j, level), id(i, j, level + 1)]);
        }
        if (level > 0 && i < bays) {
          members.push([`m${members.length}`, id(i, j, level), id(i + 1, j, level)]);
        }
        if (level > 0 && j < bays) {
          members.push([`m${members.length}`, id(i, j, level), id(i, j + 1, level)]);
        }
      }
    }
  }
  return frame(nodes, members, []);
}

/** Nodes `n0` to `n<pieces>` on a straight line from the origin along `direction`, `length` long. */
function onLine(
  direction: readonly [number, number, number],
  length: number,
  pieces: number,
  fractions?: readonly number[],
): [string, number, number, number][] {
  const norm = Math.hypot(...direction);
  return Array.from({ length: pieces + 1 }, (_, i): [string, number, number, number] => {
    const t = i === 0 ? 0 : i === pieces ? 1 : (fractions?.[i - 1] ?? i / pieces);
    const s = (length * t) / norm;
    return [`n${i}`, direction[0] * s, direction[1] * s, direction[2] * s];
  });
}

/** Members `m0`, `m1`, ... joining the nodes of `onLine` in a chain. */
function chain(pieces: number): [string, string, string][] {
  return Array.from({ length: pieces }, (_, i): [string, string, string] => [
    `m${i}`,
    `n${i}`,
    `n${i + 1}`,
  ]);
}

const PINNED: readonly DofName[] = ["ux", "uy", "uz"];

/** The rotation about the global axis that the direction has its largest component along. */
function mainRotation(direction: readonly [number, number, number]): DofName {
  const sizes = direction.map(Math.abs);
  return (["rx", "ry", "rz"] as const)[sizes.indexOf(Math.max(...sizes))] as DofName;
}

/**
 * The bound the tests put on the pivot that is left in an unstable model: a tenth of the threshold.
 */
const LEFT = 0.1 * PIVOT_THRESHOLD;

describe("solve: unstable models", () => {
  const beam = (supports: Support[]): Model =>
    frame(
      [
        ["n1", 0, 0, 0],
        ["n2", 6, 0, 0],
      ],
      [["m1", "n1", "n2"]],
      supports,
      [load("nl1", "n2", { fz: -1 })],
    );

  it("too few restraints: a beam free to slide along its axis is unstable at the last node's ux, with a pivot of exactly 0", () => {
    const result = unstable(beam([support("n1", ["uy", "uz", "rx"]), support("n2", ["uy", "uz"])]));
    expect(result).toEqual({
      ok: false,
      reason: "unstable",
      nodeId: "n2",
      dof: "ux",
      pivot: 0,
      diagonal: (E * A) / 6,
      threshold: PIVOT_THRESHOLD,
      remaining: 1,
    });
  });

  it("a beam along X left free to spin about its own axis is unstable at the last node's rx, with a pivot of exactly 0", () => {
    const result = unstable(beam([support("n1", ["ux", "uy", "uz"]), support("n2", ["uy", "uz"])]));
    expect(result).toEqual({
      ok: false,
      reason: "unstable",
      nodeId: "n2",
      dof: "rx",
      pivot: 0,
      diagonal: (G * J) / 6,
      threshold: PIVOT_THRESHOLD,
      remaining: 1,
    });
  });

  it("a skew beam pinned at both ends, free to spin about its own axis, is unstable: one rotation is left (|pivot| <= 1e-13 · diagonal)", () => {
    // The member runs along (2, 3, 6). The spin is a rotation about that line.
    const model = frame(
      [
        ["n1", 0, 0, 0],
        ["n2", 2, 3, 6],
      ],
      [["m1", "n1", "n2"]],
      [support("n1", PINNED), support("n2", PINNED)],
    );
    const result = unstable(model);
    expect(result.remaining).toBe(1);
    expect(["rx", "ry", "rz"]).toContain(result.dof);
    expect(result.diagonal).toBeGreaterThan(0);
    expect(Math.abs(result.pivot)).toBeLessThanOrEqual(LEFT * result.diagonal);
    // With the rotation about X held at one end the same beam solves.
    model.supports = [support("n1", ["ux", "uy", "uz", "rx"]), support("n2", PINNED)];
    expect(solve(model).ok).toBe(true);
  });

  // The four models of the review of this card: a beam pinned at both ends, nearly but not exactly
  // parallel to a global axis or to the horizontal plane. The rule of the first build passed them.
  it.each([
    ["rise 0.1 mm over 10 m along X, two members", [0, 0, 0], [5, 0, 0.00005], [10, 0, 0.0001]],
    [
      "rise 5 mm over a plan diagonal of 14 m, two members",
      [0, 0, 0],
      [5, 5, 0.0025],
      [10, 10, 0.005],
    ],
    [
      "rise 4 mm over a plan diagonal of 28 m, two members",
      [0, 0, 0],
      [10, 10, 0.002],
      [20, 20, 0.004],
    ],
    [
      "rise 5 mm over a plan diagonal of 14 m, one member, no load",
      [0, 0, 0],
      undefined,
      [10, 10, 0.005],
    ],
  ] as const)(
    "a nearly level beam free to spin is unstable: %s (|pivot| <= 1e-13 · diagonal)",
    (_name, a, c, b) => {
      const model =
        c === undefined
          ? frame(
              [
                ["a", ...a],
                ["b", ...b],
              ],
              [["m1", "a", "b"]],
              [support("a", PINNED), support("b", PINNED)],
            )
          : frame(
              [
                ["a", ...a],
                ["c", ...c],
                ["b", ...b],
              ],
              [
                ["m1", "a", "c"],
                ["m2", "c", "b"],
              ],
              [support("a", PINNED), support("b", PINNED)],
              [load("nl1", "c", { fz: -10 })],
            );
      const result = unstable(model);
      expect(result.remaining).toBe(1);
      expect(["rx", "ry", "rz"]).toContain(result.dof);
      expect(Math.abs(result.pivot)).toBeLessThanOrEqual(LEFT * result.diagonal);
      // The same with the nodes listed in the opposite order.
      const reversed = unstable({ ...model, nodes: [...model.nodes].reverse() });
      expect(reversed.remaining).toBe(1);
      expect(Math.abs(reversed.pivot)).toBeLessThanOrEqual(LEFT * reversed.diagonal);
      // Held against the spin at one end, each of them solves.
      model.supports = [support("a", ["ux", "uy", "uz", "rx"]), support("b", PINNED)];
      expect(solve(model).ok).toBe(true);
    },
  );

  const SLOPES = [1e-7, 2e-7, 5e-7, 1e-6, 2e-6, 5e-6, 1e-5, 2e-5, 5e-5, 1e-4, 2e-4, 5e-4, 1e-3];
  /** Nine directions that differ from a global axis or from the plan diagonal by the slope `s`. */
  const nearly = (s: number): [number, number, number][] => [
    [1, 0, s],
    [1, s, 0],
    [0, 1, s],
    [s, 1, 0],
    [1, 1, s],
    [3, 1, s],
    [s, 0, 1],
    [s, 0.7 * s, 1],
    [1, 0.3 * s, s],
  ];

  it("a sweep of 702 beams pinned at both ends, with slopes from 1e-7 to 1e-3: every one is unstable (|pivot| <= 1e-13 · diagonal), and every one solves with one rotation held", () => {
    // 13 slopes, 9 directions, lengths of 6, 10 and 20 m, as one member and as two collinear
    // members with a load of 10 kN downward on the middle node.
    let count = 0;
    let smallest = Number.POSITIVE_INFINITY;
    for (const s of SLOPES) {
      for (const direction of nearly(s)) {
        for (const length of [6, 10, 20]) {
          for (const pieces of [1, 2]) {
            const what = `slope ${s}, direction ${direction}, ${length} m, ${pieces} member(s)`;
            const last = `n${pieces}`;
            const model = frame(
              onLine(direction, length, pieces),
              chain(pieces),
              [support("n0", PINNED), support(last, PINNED)],
              pieces === 2 ? [load("nl1", "n1", { fz: -10 })] : [],
            );
            const result = solve(model);
            expect(result.ok, what).toBe(false);
            if (result.ok || result.reason !== "unstable") {
              throw new Error(`test: expected unstable for ${what}`);
            }
            expect(Math.abs(result.pivot), what).toBeLessThanOrEqual(LEFT * result.diagonal);
            expect(["rx", "ry", "rz"], what).toContain(result.dof);
            model.supports = [
              support("n0", [...PINNED, mainRotation(direction)]),
              support(last, PINNED),
            ];
            expect(solve(model).ok, what).toBe(true);
            smallest = Math.min(smallest, smallestRatio(model));
            count++;
          }
        }
      }
    }
    expect(count).toBe(702);
    // The held beams are far from the threshold: their smallest ratio is above 1e-6.
    expect(smallest).toBeGreaterThan(1e-6);
  });

  /** Four sections: the fixtures' I-shape, a heavier H-shape, a concrete column, a 16 mm steel rod. */
  const SECTIONS = [
    { E, G, A, Iy, Iz, J },
    { E, G, A: 1.49e-2, Iy: 2.517e-4, Iz: 8.56e-5, J: 1.85e-6 },
    { E: 3.0e7, G: 1.25e7, A: 0.36, Iy: 1.08e-2, Iz: 1.08e-2, J: 1.82e-2 },
    { E, G, A: 2.01e-4, Iy: 3.22e-9, Iz: 3.22e-9, J: 6.43e-9 },
  ];

  it("400 random beams pinned at both ends (four sections, 2 to 30 m, one to three members, any direction or nearly along an axis): every one is unstable (|pivot| <= 1e-13 · diagonal), and every one solves with the rotations held at one end", () => {
    const next = random(12345);
    const tiny = () => 10 ** (-8 + 6 * next()) * (next() < 0.5 ? -1 : 1);
    let smallest = Number.POSITIVE_INFINITY;
    for (let sample = 0; sample < 400; sample++) {
      const kind = sample % 5;
      const direction: [number, number, number] =
        kind === 0
          ? [next() - 0.5, next() - 0.5, next() - 0.5]
          : kind === 1
            ? [1, tiny(), tiny()]
            : kind === 2
              ? [tiny(), tiny(), 1]
              : kind === 3
                ? [1, 1, tiny()]
                : [tiny(), 1, next() - 0.5];
      const length = 2 + 28 * next();
      const pieces = 1 + (sample % 3);
      // The inner nodes are at uneven places, so they are on the line only up to rounding.
      const fractions = [0.1 + 0.3 * next(), 0.5 + 0.4 * next()].slice(0, pieces - 1);
      const last = `n${pieces}`;
      const model = frame(
        onLine(direction, length, pieces, pieces === 2 ? [0.2 + 0.6 * next()] : fractions),
        chain(pieces),
        [support("n0", PINNED), support(last, PINNED)],
        pieces > 1 ? [load("nl1", "n1", { fx: 1, fy: -2, fz: -10 })] : [],
      );
      const section = SECTIONS[sample % 4] as (typeof SECTIONS)[number];
      Object.assign(model.sections[0] as Model["sections"][number], section);
      Object.assign(model.materials[0] as Model["materials"][number], section);
      const what = `sample ${sample}, direction ${direction}`;
      const result = solve(model);
      if (result.ok || result.reason !== "unstable") {
        throw new Error(`test: expected unstable for ${what}`);
      }
      expect(Math.abs(result.pivot), what).toBeLessThanOrEqual(LEFT * result.diagonal);
      expect(["rx", "ry", "rz"], what).toContain(result.dof);
      model.supports = [support("n0", ALL), support(last, PINNED)];
      expect(solve(model).ok, what).toBe(true);
      smallest = Math.min(smallest, smallestRatio(model));
    }
    expect(smallest).toBeGreaterThan(1e-6);
  });

  it("a chain of 200 members along (1, 1, 0.0001), pinned at both ends, is unstable (|pivot| <= 1e-13 · diagonal)", () => {
    const model = frame(onLine([1, 1, 1e-4], 14, 200), chain(200), [
      support("n0", PINNED),
      support("n200", PINNED),
    ]);
    const result = unstable(model);
    expect(Math.abs(result.pivot)).toBeLessThanOrEqual(LEFT * result.diagonal);
  });

  it("a node that no member connects is unstable at that node's ux: six degrees of freedom are left", () => {
    const model = portalFrame();
    model.nodes.push({ id: "loose", x: 9, y: 9, z: 9 });
    expect(unstable(model)).toEqual({
      ok: false,
      reason: "unstable",
      nodeId: "loose",
      dof: "ux",
      pivot: 0,
      diagonal: 0,
      threshold: PIVOT_THRESHOLD,
      remaining: 6,
    });
    // Restraining the loose node's six degrees of freedom makes the model solve again.
    model.supports.push(support("loose", ALL));
    expect(solve(model).ok).toBe(true);
  });

  it("a loose node listed first is named too", () => {
    const model = portalFrame();
    model.nodes.unshift({ id: "loose", x: 9, y: 9, z: 9 });
    const result = unstable(model);
    expect([result.nodeId, result.dof, result.remaining]).toEqual(["loose", "ux", 6]);
  });

  it("a portal frame on two pinned bases can turn about the line through them: unstable, one degree of freedom is left (|pivot| <= 1e-13 · diagonal)", () => {
    // Both bases hold the three translations and no rotation. The frame is in the X-Z plane and the
    // bases are on the X axis, so the whole frame can turn about X as a rigid body.
    const model = portalFrame();
    model.supports = [support("n1", PINNED), support("n4", PINNED)];
    const result = unstable(model);
    expect(result.remaining).toBe(1);
    expect(Math.abs(result.pivot)).toBeLessThanOrEqual(LEFT * result.diagonal);
  });

  it("a 96-member space frame fixed at all bases solves and is in equilibrium (1e-9 · 384 kN·m)", () => {
    const model = tower(12, 1);
    expect(model.members).toHaveLength(96);
    const bases = model.nodes.filter((node) => node.id.endsWith("_0"));
    expect(bases).toHaveLength(4);
    const top = model.nodes[model.nodes.length - 1] as Model["nodes"][number];
    model.nodalLoads = [load("nl1", top.id, { fx: 10, fy: 5, fz: -3, mz: 1 })];
    model.supports = bases.map((node) => support(node.id, ALL));
    const stable = solved(model);
    // 384 kN·m is 10 kN times the height of the frame, 38.4 m: the order of the loads' moments.
    for (const value of resultant(model, stable)) {
      expect(Math.abs(value)).toBeLessThanOrEqual(1e-9 * 10 * 38.4);
    }
  });

  it.each([1, 1e2, 1e5, 1e8])(
    "the 96-member space frame with the area times %d, pinned along one line of bases or on one pin and two rollers, is unstable with a load, with a load that does not move the mechanism, and with no load case, in both node orders (|pivot| <= 1e-13 · diagonal)",
    (factor) => {
      const model = tower(12, 1);
      (model.sections[0] as Model["sections"][number]).A = A * factor;
      const bases = model.nodes.filter((node) => node.id.endsWith("_0"));
      const top = model.nodes[model.nodes.length - 1] as Model["nodes"][number];
      const [b0, b1, b2] = bases as [
        Model["nodes"][number],
        Model["nodes"][number],
        Model["nodes"][number],
      ];
      const supportSets = [
        // Two of the four bases, both at x = 0: the frame can turn about the line through them.
        [support(b0.id, PINNED), support(b1.id, PINNED)],
        // One pin and two rollers: the frame can turn about the vertical through the pin.
        [support(b0.id, PINNED), support(b1.id, ["uz"]), support(b2.id, ["uz"])],
      ];
      const loadSets = [
        [load("nl1", top.id, { fx: 10, fy: 5, fz: -3, mz: 1 })],
        // Along the line of the two pins (global Y), on one of them: it moves nothing.
        [load("nl1", b1.id, { fy: 10 })],
        undefined,
      ];
      for (const supports of supportSets) {
        for (const loads of loadSets) {
          model.supports = supports;
          model.nodalLoads = loads ?? [];
          model.loadCases = loads === undefined ? [] : [{ id: "lc1", name: "LC1" }];
          const result = unstable(model);
          expect(result.remaining).toBe(1);
          expect(Math.abs(result.pivot)).toBeLessThanOrEqual(LEFT * result.diagonal);
          // The same with the nodes listed in the opposite order.
          const reversed = unstable({ ...model, nodes: [...model.nodes].reverse() });
          expect(reversed.remaining).toBe(1);
          expect(Math.abs(reversed.pivot)).toBeLessThanOrEqual(LEFT * reversed.diagonal);
        }
      }
      // Fixed at all four bases, in both node orders, it solves for areas up to 1e5 times the
      // fixture's; the smallest ratio falls in proportion to the area (5e-4 for the fixture's).
      model.supports = bases.map((node) => support(node.id, ALL));
      model.loadCases = [{ id: "lc1", name: "LC1" }];
      model.nodalLoads = [load("nl1", top.id, { fx: 10, fy: 5, fz: -3, mz: 1 })];
      if (factor <= 1e5) {
        expect(solve(model).ok).toBe(true);
        expect(solve({ ...model, nodes: [...model.nodes].reverse() }).ok).toBe(true);
        expect(smallestRatio(model) * factor).toBeGreaterThan(1e-4);
        expect(smallestRatio(model) * factor).toBeLessThan(1e-3);
      }
    },
  );
});

describe("solve: stiff next to soft", () => {
  /**
   * A cantilever along +X of two segments with different sections: the root segment of length L1
   * with bending stiffness EI1, then the tip segment of length L2 with EI2, and a tip force P along
   * -Z. By superposition (the root segment carries P and the moment P·L2 at the joint):
   *   joint deflection d1 = P L1³/(3 EI1) + P L2 L1²/(2 EI1)
   *   joint rotation   t1 = P L1²/(2 EI1) + P L2 L1/EI1
   *   tip deflection      = d1 + t1 L2 + P L2³/(3 EI2)
   */
  function stepped(
    L1: number,
    root: "stocky" | "slender",
    L2: number,
    tip: "stocky" | "slender",
    order: "root-first" | "tip-first",
  ): { model: Model; expected: number } {
    const P = 10;
    const nodes: [string, number, number, number][] = [
      ["n1", 0, 0, 0],
      ["n2", L1, 0, 0],
      ["n3", L1 + L2, 0, 0],
    ];
    const model = frame(
      order === "root-first" ? nodes : [...nodes].reverse(),
      [
        ["m1", "n1", "n2"],
        ["m2", "n2", "n3"],
      ],
      [support("n1", ALL)],
      [load("nl1", "n3", { fz: -P })],
    );
    // The stocky section: 1000 times the second moments of area and 100 times the area.
    const slender = model.sections[0] as Model["sections"][number];
    model.sections.push({
      ...slender,
      id: "stocky",
      A: 100 * A,
      Iy: 1000 * Iy,
      Iz: 1000 * Iz,
      J: 1000 * J,
    });
    const use = (index: number, which: "stocky" | "slender") => {
      (model.members[index] as Model["members"][number]).sectionId =
        which === "stocky" ? "stocky" : "s1";
    };
    use(0, root);
    use(1, tip);
    const EI1 = E * Iy * (root === "stocky" ? 1000 : 1);
    const EI2 = E * Iy * (tip === "stocky" ? 1000 : 1);
    const d1 = (P * L1 ** 3) / (3 * EI1) + (P * L2 * L1 ** 2) / (2 * EI1);
    const t1 = (P * L1 ** 2) / (2 * EI1) + (P * L2 * L1) / EI1;
    return { model, expected: -(d1 + t1 * L2 + (P * L2 ** 3) / (3 * EI2)) };
  }

  it.each([
    ["a short stocky root (0.5 m) and a long slender tip (20 m)", 0.5, "stocky", 20, "slender"],
    ["a long slender root (20 m) and a short stocky tip (0.5 m)", 20, "slender", 0.5, "stocky"],
  ] as const)(
    "%s solve to the stepped-cantilever tip deflection in both node orders (tolerance: relative 1e-7)",
    (_name, L1, root, L2, tip) => {
      // The translational stiffness 12 E I/L³ of the two segments differs by a factor of 6.4e7.
      // The tolerance is wider than 1e-12 because the system is ill-conditioned: with the stocky
      // segment at the tip the computed deflection is off by about 5e-9 of its value (rounding
      // error of about 2e-16 times the stiffness ratio); with it at the root, by less than 1e-15.
      for (const order of ["root-first", "tip-first"] as const) {
        const { model, expected } = stepped(L1, root, L2, tip, order);
        const result = solved(model);
        expectRel(get(result.displacements, "n3").uz, expected, 1e-7, order);
        expect(result.sensitivity).toBeLessThan(1e-6);
      }
    },
  );

  it("a cantilever of 200 elements along a skew line solves to P S³/(3 E Iy) (tolerance: relative 1e-7)", () => {
    // The tolerance is wider than 1e-12 because rounding errors add up over 1200 unknowns: the
    // computed deflection is off by about 2e-8 of its value.
    // 200 equal elements along (2, 3, 6)/7 from the fixed end, total length S = 14 m, numbered from
    // the fixed end. The tip force is along the member's local z, so the bending is about local y.
    const n = 200;
    const S = 14;
    const nodes = Array.from({ length: n + 1 }, (_, i): [string, number, number, number] => {
      const s = (S * i) / n;
      return [`n${i}`, (2 * s) / 7, (3 * s) / 7, (6 * s) / 7];
    });
    const members = Array.from({ length: n }, (_, i): [string, string, string] => [
      `m${i}`,
      `n${i}`,
      `n${i + 1}`,
    ]);
    // Local axes of a member along x = (2, 3, 6)/7 with roll 0: y = Z × x / |Z × x| = (-3, 2, 0)/√13,
    // z = x × y = (-12, -18, 13)/(7√13).
    const z = [-12, -18, 13].map((value) => value / (7 * Math.sqrt(13))) as [
      number,
      number,
      number,
    ];
    const P = 2;
    const model = frame(
      nodes,
      members,
      [support("n0", ALL)],
      [load("nl1", `n${n}`, { fx: P * z[0], fy: P * z[1], fz: P * z[2] })],
    );
    const result = solved(model);
    expect(result.sensitivity).toBeLessThan(1e-4);
    const tip = get(result.displacements, `n${n}`);
    const along = tip.ux * z[0] + tip.uy * z[1] + tip.uz * z[2];
    expectRel(along, (P * S ** 3) / (3 * E * Iy), 1e-7);
  });

  /** A fixed-base portal of height h and span b with the fixtures' section, 20 kN along +X at n2. */
  function portal(h: number, b: number, areaFactor: number): { model: Model; sway: number } {
    const model = frame(
      [
        ["n1", 0, 0, 0],
        ["n2", 0, 0, h],
        ["n3", b, 0, h],
        ["n4", b, 0, 0],
      ],
      [
        ["c1", "n1", "n2"],
        ["b1", "n2", "n3"],
        ["c2", "n4", "n3"],
      ],
      [support("n1", ALL), support("n4", ALL)],
      [load("nl1", "n2", { fx: 20 })],
    );
    (model.sections[0] as Model["sections"][number]).A = A * areaFactor;
    // The slope-deflection sway for inextensible members (see the portal frame test above).
    const k = h / b;
    return { model, sway: (20 * h ** 3 * (2 + 3 * k)) / (12 * E * Iy * (1 + 6 * k)) };
  }

  it("the 4 m by 6 m portal solves with the area times 1e6, 1e8 and 1e10 (sway within 1e-7 of the slope-deflection value); with the area times 1e12 it is reported unstable although it is stable", () => {
    for (const factor of [1e6, 1e8, 1e10]) {
      const { model, sway } = portal(4, 6, factor);
      expectRel(get(solved(model).displacements, "n2").ux, sway, 1e-7, `area times ${factor}`);
    }
    const result = unstable(portal(4, 6, 1e12).model);
    expect([result.nodeId, result.dof]).toEqual(["n3", "ux"]);
    // The pivot left is real stiffness (thousands of kN/m), but below 1e-12 of the beam's E A/L.
    expect(result.pivot).toBeGreaterThan(1000);
    expect(result.pivot / result.diagonal).toBeLessThan(PIVOT_THRESHOLD);
  });

  it("a portal 30 m high and 2 m wide solves with the area times 1e7 (sway within 1e-4) and is reported unstable with the area times 1e8: how much contrast passes depends on the geometry", () => {
    const { model, sway } = portal(30, 2, 1e7);
    expectRel(get(solved(model).displacements, "n2").ux, sway, 1e-4);
    const result = unstable(portal(30, 2, 1e8).model);
    expect(result.pivot).toBeGreaterThan(0);
    expect(result.pivot / result.diagonal).toBeLessThan(PIVOT_THRESHOLD);
  });

  it("a model accepted near the threshold has lost digits: the 10 m by 10 m portal with the area times 1e9 has a smallest ratio between 1e-12 and 1e-11, a sway within 1e-4 of the slope-deflection value but not within 1e-6, and a sensitivity between 1e-4 and 1e-3", () => {
    const { model, sway } = portal(10, 10, 1e9);
    const ratio = smallestRatio(model);
    expect(ratio).toBeGreaterThan(1e-12);
    expect(ratio).toBeLessThan(1e-11);
    const result = solved(model);
    const error = Math.abs(get(result.displacements, "n2").ux - sway) / sway;
    expect(error).toBeLessThan(1e-4);
    expect(error).toBeGreaterThan(1e-6);
    expect(result.sensitivity).toBeGreaterThan(1e-4);
    expect(result.sensitivity).toBeLessThan(1e-3);
  });

  it("a short stocky stub on a long slender cantilever: 0.1 m with 1000 times the inertia at the tip of 30 m solves (smallest ratio between 1e-12 and 1e-11); with 10 000 times it is reported unstable although it is stable", () => {
    const { model } = stepped(30, "slender", 0.1, "stocky", "root-first");
    expect(solve(model).ok).toBe(true);
    const ratio = smallestRatio(model);
    expect(ratio).toBeGreaterThan(1e-12);
    expect(ratio).toBeLessThan(1e-11);
    const stocky = model.sections[1] as Model["sections"][number];
    stocky.Iy = 1e4 * Iy;
    stocky.Iz = 1e4 * Iz;
    stocky.J = 1e4 * J;
    const result = unstable(model);
    expect(result.nodeId).toBe("n3");
    expect(result.pivot).toBeGreaterThan(0);
  });

  it("16 mm steel rods of 15 m as columns under a concrete girder of 2 m², fixed at the bases, solve (smallest ratio above 1e-10)", () => {
    const model = frame(
      [
        ["n1", 0, 0, 0],
        ["n2", 0, 0, 15],
        ["n3", 4, 0, 15],
        ["n4", 4, 0, 0],
      ],
      [
        ["c1", "n1", "n2"],
        ["b1", "n2", "n3"],
        ["c2", "n4", "n3"],
      ],
      [support("n1", ALL), support("n4", ALL)],
      [load("nl1", "n2", { fx: 1, fy: 0.5 })],
    );
    Object.assign(model.sections[0] as Model["sections"][number], {
      A: 2.01e-4,
      Iy: 3.22e-9,
      Iz: 3.22e-9,
      J: 6.43e-9,
    });
    model.sections.push({
      id: "girder",
      name: "girder",
      A: 2,
      Iy: 0.667,
      Iz: 0.1667,
      J: 0.458,
      depthY: 1,
      depthZ: 2,
    });
    model.materials.push({
      id: "concrete",
      name: "C30",
      E: 3.0e7,
      G: 1.25e7,
      fy: 3e4,
      density: 2500,
    });
    const girder = model.members[1] as Model["members"][number];
    girder.sectionId = "girder";
    girder.materialId = "concrete";
    expect(solve(model).ok).toBe(true);
    expect(smallestRatio(model)).toBeGreaterThan(1e-10);
  });

  it.each([50, 100, 200])(
    "a cantilever of %d equal elements along X has a smallest ratio of 1/(4 n³) (tolerance: relative 1e-2)",
    (n) => {
      const model = frame(
        onLine([1, 0, 0], 14, n),
        chain(n),
        [support("n0", ALL)],
        [load("nl1", `n${n}`, { fz: -1 })],
      );
      expect(solve(model).ok).toBe(true);
      expectRel(smallestRatio(model), 1 / (4 * n ** 3), 1e-2);
    },
  );
});
