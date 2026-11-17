import {
  type LocalAxes,
  type Model,
  memberLocalAxes,
  planarTruss,
  portalFrame,
  simplySupportedBeam,
  type Vec3,
} from "@bridle/model";
import { describe, expect, it } from "vitest";
import {
  assemble,
  at,
  buildDofMap,
  DOFS,
  dofIndex,
  ELEMENT_DOFS,
  type ElementProperties,
  elementStiffnessGlobal,
  elementStiffnessLocal,
  elementTransformation,
  fromRows,
  LOCAL_DOF,
  type Matrix,
  maxAbs,
  memberDofIndices,
  multiply,
  multiplyVector,
  transpose,
  zeros,
} from "./index";

/**
 * Tolerances. Each test names the one it uses.
 * - EXACT: the two numbers must be the same floating-point value (difference 0).
 * - REL_TOL: a relative tolerance of 1e-12 for results of a few floating-point operations on
 *   numbers of similar size (about 4500 times the spacing of doubles near 1).
 * - RIGID_TOL: for K times a rigid-body motion, the largest entry of the result may be at most 1e-9
 *   times (largest entry of K) times (largest entry of the motion). The product of stiffness terms
 *   that differ by several orders of magnitude cancels to rounding error, not to exact zero.
 */
const EXACT = 0;
const REL_TOL = 1e-12;
const RIGID_TOL = 1e-9;

/** The largest absolute difference between two matrices of the same size. */
function maxDifference(a: Matrix, b: Matrix): number {
  expect([a.rows, a.cols]).toEqual([b.rows, b.cols]);
  let max = 0;
  for (let i = 0; i < a.data.length; i++) {
    max = Math.max(max, Math.abs((a.data[i] as number) - (b.data[i] as number)));
  }
  return max;
}

function identity(n: number): Matrix {
  const m = zeros(n, n);
  for (let i = 0; i < n; i++) {
    m.data[i * n + i] = 1;
  }
  return m;
}

function axesOf(start: Vec3, end: Vec3, rollAngleDeg: number): LocalAxes {
  const axes = memberLocalAxes(start, end, rollAngleDeg);
  if (axes === undefined) {
    throw new Error("test: no local axes");
  }
  return axes;
}

/**
 * An element with round numbers, chosen so that every textbook term is a different whole number:
 * EA/L = 240, GJ/L = 125,
 * about z: 12EIz/L³ = 180, 6EIz/L² = 360, 4EIz/L = 960, 2EIz/L = 480,
 * about y: 12EIy/L³ = 60, 6EIy/L² = 120, 4EIy/L = 320, 2EIy/L = 160.
 */
const ROUND: ElementProperties = { E: 320, G: 100, A: 3, Iy: 1, Iz: 3, J: 5, length: 4 };

/** The fixtures' section and material (packages/model/src/fixtures.ts), for realistic magnitudes. */
const STEEL = { E: 2.1e8, G: 8.1e7, A: 5.4e-3, Iy: 8.4e-5, Iz: 6.0e-6, J: 2.0e-7 };

describe("elementStiffnessLocal", () => {
  it("is symmetric (tolerance: exact)", () => {
    for (const p of [ROUND, { ...STEEL, length: 3.7 }]) {
      const k = elementStiffnessLocal(p);
      expect([k.rows, k.cols]).toEqual([ELEMENT_DOFS, ELEMENT_DOFS]);
      expect(maxDifference(k, transpose(k))).toBe(EXACT);
    }
  });

  it("has the textbook entries with the right signs for round numbers (tolerance: exact)", () => {
    // Rows and columns: ux1 uy1 uz1 rx1 ry1 rz1 | ux2 uy2 uz2 rx2 ry2 rz2.
    const expected = fromRows([
      [240, 0, 0, 0, 0, 0, -240, 0, 0, 0, 0, 0],
      [0, 180, 0, 0, 0, 360, 0, -180, 0, 0, 0, 360],
      [0, 0, 60, 0, -120, 0, 0, 0, -60, 0, -120, 0],
      [0, 0, 0, 125, 0, 0, 0, 0, 0, -125, 0, 0],
      [0, 0, -120, 0, 320, 0, 0, 0, 120, 0, 160, 0],
      [0, 360, 0, 0, 0, 960, 0, -360, 0, 0, 0, 480],
      [-240, 0, 0, 0, 0, 0, 240, 0, 0, 0, 0, 0],
      [0, -180, 0, 0, 0, -360, 0, 180, 0, 0, 0, -360],
      [0, 0, -60, 0, 120, 0, 0, 0, 60, 0, 120, 0],
      [0, 0, 0, -125, 0, 0, 0, 0, 0, 125, 0, 0],
      [0, 0, -120, 0, 160, 0, 0, 0, 120, 0, 320, 0],
      [0, 360, 0, 0, 0, 480, 0, -360, 0, 0, 0, 960],
    ]);
    const k = elementStiffnessLocal(ROUND);
    // The inputs and every term are whole numbers that a double holds exactly, so no rounding.
    expect(maxDifference(k, expected)).toBe(EXACT);
  });

  it("has each textbook term where its formula says (tolerance: relative 1e-12)", () => {
    const p = { ...STEEL, length: 3.7 };
    const { E, G, A, Iy, Iz, J, length: L } = p;
    const k = elementStiffnessLocal(p);
    const D = LOCAL_DOF;
    const close = (i: number, j: number, value: number) => {
      expect(Math.abs(at(k, i, j) - value)).toBeLessThanOrEqual(REL_TOL * Math.abs(value));
    };
    close(D.ux1, D.ux1, (E * A) / L);
    close(D.ux1, D.ux2, (-E * A) / L);
    close(D.rx1, D.rx1, (G * J) / L);
    close(D.rx1, D.rx2, (-G * J) / L);
    // Bending about z (x-y plane).
    close(D.uy1, D.uy1, (12 * E * Iz) / L ** 3);
    close(D.uy1, D.uy2, (-12 * E * Iz) / L ** 3);
    close(D.uy1, D.rz1, (6 * E * Iz) / L ** 2);
    close(D.uy1, D.rz2, (6 * E * Iz) / L ** 2);
    close(D.uy2, D.rz1, (-6 * E * Iz) / L ** 2);
    close(D.uy2, D.rz2, (-6 * E * Iz) / L ** 2);
    close(D.rz1, D.rz1, (4 * E * Iz) / L);
    close(D.rz1, D.rz2, (2 * E * Iz) / L);
    close(D.rz2, D.rz2, (4 * E * Iz) / L);
    // Bending about y (x-z plane): the deflection-rotation terms have the opposite sign.
    close(D.uz1, D.uz1, (12 * E * Iy) / L ** 3);
    close(D.uz1, D.uz2, (-12 * E * Iy) / L ** 3);
    close(D.uz1, D.ry1, (-6 * E * Iy) / L ** 2);
    close(D.uz1, D.ry2, (-6 * E * Iy) / L ** 2);
    close(D.uz2, D.ry1, (6 * E * Iy) / L ** 2);
    close(D.uz2, D.ry2, (6 * E * Iy) / L ** 2);
    close(D.ry1, D.ry1, (4 * E * Iy) / L);
    close(D.ry1, D.ry2, (2 * E * Iy) / L);
    close(D.ry2, D.ry2, (4 * E * Iy) / L);
  });

  it("reproduces the cantilever tip formulas in both planes (tolerance: 1e-12 · P·L)", () => {
    // A cantilever fixed at the start node with a force P at the end node has, by beam theory, the
    // tip deflection P L³ / (3 E I) and a tip slope of P L² / (2 E I) in the direction of the
    // deflection. For P along +y the slope duy/dx is +rz; for P along +z the slope duz/dx is -ry.
    // With these end displacements, k u must give back the force P at the tip and no tip moment.
    const p = { ...STEEL, length: 3.7 };
    const { E, Iy, Iz, length: L } = p;
    const k = elementStiffnessLocal(p);
    const P = 10;
    const D = LOCAL_DOF;

    const uY = new Float64Array(ELEMENT_DOFS);
    uY[D.uy2] = (P * L ** 3) / (3 * E * Iz);
    uY[D.rz2] = (P * L ** 2) / (2 * E * Iz);
    const fY = multiplyVector(k, uY);
    const expectedY = new Float64Array(ELEMENT_DOFS);
    expectedY[D.uy2] = P;
    expectedY[D.uy1] = -P; // the reaction at the fixed end
    expectedY[D.rz1] = -P * L; // the fixing moment: the nodes' moment on the member end, about z

    const uZ = new Float64Array(ELEMENT_DOFS);
    uZ[D.uz2] = (P * L ** 3) / (3 * E * Iy);
    uZ[D.ry2] = (-P * L ** 2) / (2 * E * Iy);
    const fZ = multiplyVector(k, uZ);
    const expectedZ = new Float64Array(ELEMENT_DOFS);
    expectedZ[D.uz2] = P;
    expectedZ[D.uz1] = -P;
    expectedZ[D.ry1] = P * L; // about y, a force along +z at x = L has the moment -P L; the reaction is +P L

    // Scale: the largest force term is P L (37 kN·m); sums of terms of that size cancel.
    const tolerance = REL_TOL * P * L;
    for (let i = 0; i < ELEMENT_DOFS; i++) {
      expect(Math.abs((fY[i] as number) - (expectedY[i] as number))).toBeLessThanOrEqual(tolerance);
      expect(Math.abs((fZ[i] as number) - (expectedZ[i] as number))).toBeLessThanOrEqual(tolerance);
    }
  });
});

/** Members in several orientations; the nodes are away from the origin on purpose. */
const ORIENTATIONS: { name: string; start: Vec3; end: Vec3; roll: number }[] = [
  { name: "along global +X", start: { x: 1, y: 2, z: 3 }, end: { x: 5, y: 2, z: 3 }, roll: 0 },
  { name: "along global +Y", start: { x: 1, y: 2, z: 3 }, end: { x: 1, y: 7, z: 3 }, roll: 0 },
  { name: "vertical upward", start: { x: 2, y: -1, z: 0 }, end: { x: 2, y: -1, z: 4 }, roll: 0 },
  { name: "vertical downward", start: { x: 2, y: -1, z: 4 }, end: { x: 2, y: -1, z: 0 }, roll: 0 },
  { name: "skew in 3D", start: { x: 1, y: 2, z: 3 }, end: { x: 4, y: -2, z: 5 }, roll: 0 },
  {
    name: "skew in 3D with roll 30°",
    start: { x: -1, y: 0.5, z: 2 },
    end: { x: 2, y: 3, z: 1 },
    roll: 30,
  },
  {
    name: "horizontal with roll 30°",
    start: { x: 0, y: 1, z: 2 },
    end: { x: 3, y: 5, z: 2 },
    roll: 30,
  },
  {
    name: "vertical upward with roll 30°",
    start: { x: 1, y: 1, z: 1 },
    end: { x: 1, y: 1, z: 4 },
    roll: 30,
  },
];

function globalMatrixOf(o: (typeof ORIENTATIONS)[number]): Matrix {
  const length = Math.hypot(o.end.x - o.start.x, o.end.y - o.start.y, o.end.z - o.start.z);
  const k = elementStiffnessLocal({ ...STEEL, length });
  return elementStiffnessGlobal(k, elementTransformation(axesOf(o.start, o.end, o.roll)));
}

/**
 * The six rigid-body motions of a two-node element, as vectors of its twelve global degrees of
 * freedom: a unit translation along each global axis (no rotation), and a small rotation θ about
 * each global axis through the origin, which gives each node the translation θ × r (r is the node's
 * position) and the rotation θ. The stiffness is linear, so θ has unit size here.
 */
function rigidBodyMotions(start: Vec3, end: Vec3): { name: string; u: number[] }[] {
  const cross = (a: Vec3, b: Vec3): Vec3 => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  });
  const axes: { name: string; e: Vec3 }[] = [
    { name: "X", e: { x: 1, y: 0, z: 0 } },
    { name: "Y", e: { x: 0, y: 1, z: 0 } },
    { name: "Z", e: { x: 0, y: 0, z: 1 } },
  ];
  const motions: { name: string; u: number[] }[] = [];
  for (const { name, e } of axes) {
    motions.push({
      name: `translation along ${name}`,
      u: [e.x, e.y, e.z, 0, 0, 0, e.x, e.y, e.z, 0, 0, 0],
    });
  }
  for (const { name, e } of axes) {
    const a = cross(e, start);
    const b = cross(e, end);
    motions.push({
      name: `rotation about ${name}`,
      u: [a.x, a.y, a.z, e.x, e.y, e.z, b.x, b.y, b.z, e.x, e.y, e.z],
    });
  }
  return motions;
}

describe("elementTransformation and elementStiffnessGlobal", () => {
  it.each(ORIENTATIONS)("the transformation is orthogonal: $name (tolerance: 1e-12)", (o) => {
    const t = elementTransformation(axesOf(o.start, o.end, o.roll));
    expect([t.rows, t.cols]).toEqual([ELEMENT_DOFS, ELEMENT_DOFS]);
    // The entries of T are at most 1, so 1e-12 is an absolute tolerance on T Tᵀ - I and Tᵀ T - I.
    expect(maxDifference(multiply(t, transpose(t)), identity(ELEMENT_DOFS))).toBeLessThanOrEqual(
      REL_TOL,
    );
    expect(maxDifference(multiply(transpose(t), t), identity(ELEMENT_DOFS))).toBeLessThanOrEqual(
      REL_TOL,
    );
  });

  it("the transformation has the local axes as the rows of each 3 by 3 block (tolerance: exact)", () => {
    const axes = axesOf({ x: 1, y: 2, z: 3 }, { x: 4, y: -2, z: 5 }, 30);
    const t = elementTransformation(axes);
    const expected = zeros(ELEMENT_DOFS, ELEMENT_DOFS);
    for (let block = 0; block < 4; block++) {
      [axes.x, axes.y, axes.z].forEach((axis, i) => {
        [axis.x, axis.y, axis.z].forEach((value, j) => {
          expected.data[(3 * block + i) * ELEMENT_DOFS + 3 * block + j] = value;
        });
      });
    }
    expect(maxDifference(t, expected)).toBe(EXACT);
  });

  it("elementStiffnessGlobal is Tᵀ k T, entry by entry (tolerance: relative 1e-12 of the largest entry)", () => {
    const o = ORIENTATIONS[5] as (typeof ORIENTATIONS)[number];
    const length = Math.hypot(o.end.x - o.start.x, o.end.y - o.start.y, o.end.z - o.start.z);
    const k = elementStiffnessLocal({ ...STEEL, length });
    const t = elementTransformation(axesOf(o.start, o.end, o.roll));
    const kg = elementStiffnessGlobal(k, t);
    // The triple sum written out, without the matrix helpers.
    const expected = zeros(ELEMENT_DOFS, ELEMENT_DOFS);
    for (let i = 0; i < ELEMENT_DOFS; i++) {
      for (let j = 0; j < ELEMENT_DOFS; j++) {
        let sum = 0;
        for (let a = 0; a < ELEMENT_DOFS; a++) {
          for (let b = 0; b < ELEMENT_DOFS; b++) {
            sum += at(t, a, i) * at(k, a, b) * at(t, b, j);
          }
        }
        expected.data[i * ELEMENT_DOFS + j] = sum;
      }
    }
    expect(maxDifference(kg, expected)).toBeLessThanOrEqual(REL_TOL * maxAbs(k));
  });

  it.each(ORIENTATIONS)(
    "the global matrix is symmetric: $name (tolerance: relative 1e-12 of the largest entry)",
    (o) => {
      const kg = globalMatrixOf(o);
      expect(maxDifference(kg, transpose(kg))).toBeLessThanOrEqual(REL_TOL * maxAbs(kg));
    },
  );

  it.each(ORIENTATIONS)(
    "K times each of the six rigid-body motions is zero: $name (tolerance: 1e-9 · max|K| · max|u|)",
    (o) => {
      const kg = globalMatrixOf(o);
      const motions = rigidBodyMotions(o.start, o.end);
      expect(motions).toHaveLength(6);
      for (const motion of motions) {
        const force = multiplyVector(kg, motion.u);
        const scale = maxAbs(kg) * Math.max(...motion.u.map(Math.abs));
        const residual = Math.max(...Array.from(force, Math.abs));
        expect(residual, motion.name).toBeLessThanOrEqual(RIGID_TOL * scale);
      }
    },
  );

  it("the rigid-body test is able to fail: a wrong sign in one bending plane is detected", () => {
    // The local matrix with the uz-ry coupling terms given the sign of the uy-rz ones. It is still
    // symmetric, but a rigid rotation about local y no longer gives zero force.
    const k = elementStiffnessLocal(ROUND);
    const D = LOCAL_DOF;
    const wrong: Matrix = { rows: k.rows, cols: k.cols, data: Float64Array.from(k.data) };
    for (const uz of [D.uz1, D.uz2]) {
      for (const ry of [D.ry1, D.ry2]) {
        wrong.data[uz * ELEMENT_DOFS + ry] = -at(k, uz, ry);
        wrong.data[ry * ELEMENT_DOFS + uz] = -at(k, ry, uz);
      }
    }
    const [start, end] = [
      { x: 0, y: 0, z: 0 },
      { x: ROUND.length, y: 0, z: 0 },
    ];
    const aboutY = rigidBodyMotions(start, end)[4] as { name: string; u: number[] };
    expect(aboutY.name).toBe("rotation about Y");
    const residual = (m: Matrix) => Math.max(...Array.from(multiplyVector(m, aboutY.u), Math.abs));
    expect(residual(k)).toBeLessThanOrEqual(RIGID_TOL * maxAbs(k) * ROUND.length);
    expect(residual(wrong)).toBeGreaterThan(1);
  });

  it("a member along global +X has its global matrix equal to its local matrix (tolerance: exact)", () => {
    const o = ORIENTATIONS[0] as (typeof ORIENTATIONS)[number];
    const k = elementStiffnessLocal({ ...STEEL, length: 4 });
    expect(maxDifference(globalMatrixOf(o), k)).toBe(EXACT);
  });

  it("a member along global +Y has the local matrix with the axes permuted by the local-axis rule (tolerance: exact)", () => {
    // The rule (packages/model/src/geometry.ts): local x = global +Y; local y = Z × x = global -X;
    // local z = x × y = global +Z. So, at each node, for translations and rotations alike:
    //   global X component = -(local y component), global Y = local x, global Z = local z.
    const axes = axesOf({ x: 1, y: 2, z: 3 }, { x: 1, y: 7, z: 3 }, 0);
    // `+ 0` turns a minus zero into zero, which `toEqual` tells apart.
    const components = [axes.x, axes.y, axes.z].flatMap((v) => [v.x + 0, v.y + 0, v.z + 0]);
    expect(components).toEqual([0, 1, 0, -1, 0, 0, 0, 0, 1]);
    const k = elementStiffnessLocal({ ...STEEL, length: 5 });
    const kg = elementStiffnessGlobal(k, elementTransformation(axes));

    // For each global row within a block of three: the local row it equals, and the sign.
    const localOf = [
      { index: 1, sign: -1 }, // global X  <- -local y
      { index: 0, sign: 1 }, //  global Y  <-  local x
      { index: 2, sign: 1 }, //  global Z  <-  local z
    ];
    const expected = zeros(ELEMENT_DOFS, ELEMENT_DOFS);
    for (let i = 0; i < ELEMENT_DOFS; i++) {
      for (let j = 0; j < ELEMENT_DOFS; j++) {
        const a = localOf[i % 3] as { index: number; sign: number };
        const b = localOf[j % 3] as { index: number; sign: number };
        const localRow = i - (i % 3) + a.index;
        const localCol = j - (j % 3) + b.index;
        expected.data[i * ELEMENT_DOFS + j] = a.sign * b.sign * at(k, localRow, localCol);
      }
    }
    // The entries of T are exactly 0, 1 and -1 here, so the products add nothing but zeros.
    expect(maxDifference(kg, expected)).toBe(EXACT);

    // Spot checks in words: axial stiffness sits on global uy, torsion on global ry, and the
    // strong-axis stiffness 12 E Iy / L³ (local z deflection) on global uz.
    const [E, L] = [STEEL.E, 5];
    expect(at(kg, 1, 1)).toBe((E * STEEL.A) / L);
    expect(at(kg, 4, 4)).toBe((STEEL.G * STEEL.J) / L);
    expect(at(kg, 2, 2)).toBe((12 * E * STEEL.Iy) / L ** 3);
    expect(at(kg, 0, 0)).toBe((12 * E * STEEL.Iz) / L ** 3);
    // Global ux with global rz: (-local uy) with (local rz), so minus 6 E Iz / L².
    expect(at(kg, 0, 5)).toBe((-6 * E * STEEL.Iz) / L ** 2);
  });
});

describe("the degree-of-freedom map", () => {
  it("numbers the nodes in the order given, six rows each", () => {
    const map = buildDofMap([{ id: "b" }, { id: "a" }, { id: "c" }]);
    expect(map.nodeIds).toEqual(["b", "a", "c"]);
    expect(map.size).toBe(18);
    expect(DOFS).toEqual(["ux", "uy", "uz", "rx", "ry", "rz"]);
    expect(DOFS.map((dof) => dofIndex(map, "b", dof))).toEqual([0, 1, 2, 3, 4, 5]);
    expect(DOFS.map((dof) => dofIndex(map, "a", dof))).toEqual([6, 7, 8, 9, 10, 11]);
    expect(dofIndex(map, "c", "rz")).toBe(17);
    expect(dofIndex(map, "missing", "ux")).toBeUndefined();
    expect(memberDofIndices(map, "c", "b")).toEqual([12, 13, 14, 15, 16, 17, 0, 1, 2, 3, 4, 5]);
    expect(memberDofIndices(map, "c", "missing")).toBeUndefined();
  });
});

/** The beam fixture's section and material, with the nodes and members given. */
function modelOf(
  nodes: Model["nodes"],
  members: [id: string, start: string, end: string][],
): Model {
  const model = simplySupportedBeam();
  const template = model.members[0] as Model["members"][number];
  return {
    ...model,
    nodes,
    members: members.map(([id, startNodeId, endNodeId]) => ({
      ...template,
      id,
      startNodeId,
      endNodeId,
      releases: {
        start: { rx: false, ry: false, rz: false },
        end: { rx: false, ry: false, rz: false },
      },
    })),
    supports: [
      { nodeId: nodes[0]?.id ?? "", ux: true, uy: true, uz: true, rx: true, ry: true, rz: true },
    ],
    memberUniformLoads: [],
  };
}

describe("assemble", () => {
  it("two collinear elements assemble to the known sums at the shared node (tolerance: relative 1e-12)", () => {
    // Along global +X, so local and global axes coincide; lengths 2 m and 4 m so that the coupling
    // terms of the two elements do not cancel at the shared node.
    const [L1, L2] = [2, 4];
    const model = modelOf(
      [
        { id: "a", x: 0, y: 0, z: 0 },
        { id: "b", x: L1, y: 0, z: 0 },
        { id: "c", x: L1 + L2, y: 0, z: 0 },
      ],
      [
        ["m1", "a", "b"],
        ["m2", "b", "c"],
      ],
    );
    const result = assemble(model);
    if (!result.ok) {
      throw new Error("test: expected the model to assemble");
    }
    const { stiffness: K, dofMap } = result;
    expect([K.rows, K.cols]).toEqual([18, 18]);
    const { E, G, A, Iy, Iz, J } = STEEL;
    const row = (dof: (typeof DOFS)[number], node = "b") => dofIndex(dofMap, node, dof) as number;
    const close = (i: number, j: number, value: number) => {
      expect(Math.abs(at(K, i, j) - value)).toBeLessThanOrEqual(REL_TOL * Math.abs(value));
      expect(at(K, j, i)).toBe(at(K, i, j));
    };

    // The diagonal at the shared node: the end of element 1 plus the start of element 2.
    close(row("ux"), row("ux"), (E * A) / L1 + (E * A) / L2);
    close(row("uy"), row("uy"), (12 * E * Iz) / L1 ** 3 + (12 * E * Iz) / L2 ** 3);
    close(row("uz"), row("uz"), (12 * E * Iy) / L1 ** 3 + (12 * E * Iy) / L2 ** 3);
    close(row("rx"), row("rx"), (G * J) / L1 + (G * J) / L2);
    close(row("ry"), row("ry"), (4 * E * Iy) / L1 + (4 * E * Iy) / L2);
    close(row("rz"), row("rz"), (4 * E * Iz) / L1 + (4 * E * Iz) / L2);
    // The couplings at the shared node: -6EIz/L1² (end of 1) + 6EIz/L2² (start of 2) for uy-rz,
    // and the opposite signs for uz-ry.
    close(row("uy"), row("rz"), (-6 * E * Iz) / L1 ** 2 + (6 * E * Iz) / L2 ** 2);
    close(row("uz"), row("ry"), (6 * E * Iy) / L1 ** 2 - (6 * E * Iy) / L2 ** 2);

    // Shared node to the outer nodes: one element each.
    close(row("ux"), row("ux", "a"), (-E * A) / L1);
    close(row("ux"), row("ux", "c"), (-E * A) / L2);
    close(row("uy"), row("uy", "a"), (-12 * E * Iz) / L1 ** 3);
    close(row("uy"), row("rz", "a"), (-6 * E * Iz) / L1 ** 2);
    close(row("uy"), row("rz", "c"), (6 * E * Iz) / L2 ** 2);
    close(row("rz"), row("rz", "c"), (2 * E * Iz) / L2);
    close(row("uz"), row("ry", "a"), (6 * E * Iy) / L1 ** 2);
    close(row("uz"), row("ry", "c"), (-6 * E * Iy) / L2 ** 2);
    close(row("ry"), row("ry", "a"), (2 * E * Iy) / L1);

    // The outer nodes share no element: their block is zero (exact), and node a has element 1 only.
    for (const p of DOFS) {
      for (const q of DOFS) {
        expect(at(K, row(p, "a"), row(q, "c"))).toBe(0);
        expect(at(K, row(p, "c"), row(q, "a"))).toBe(0);
      }
    }
    close(row("ux", "a"), row("ux", "a"), (E * A) / L1);
    close(row("rz", "c"), row("rz", "c"), (4 * E * Iz) / L2);
  });

  it("the portal frame assembles to a symmetric 24 by 24 matrix (tolerance: relative 1e-12 of the largest entry)", () => {
    const model = portalFrame();
    const result = assemble(model);
    if (!result.ok) {
      throw new Error("test: expected the portal frame to assemble");
    }
    const { stiffness: K, dofMap, elements } = result;
    expect([K.rows, K.cols]).toEqual([24, 24]);
    expect(dofMap.nodeIds).toEqual(["n1", "n2", "n3", "n4"]);
    expect(dofMap.size).toBe(6 * model.nodes.length);
    expect(dofIndex(dofMap, "n3", "ry")).toBe(16);
    expect(maxDifference(K, transpose(K))).toBeLessThanOrEqual(REL_TOL * maxAbs(K));
    expect(elements.map((e) => e.memberId)).toEqual(["c1", "b1", "c2"]);
    expect(elements.map((e) => e.length)).toEqual([4, 6, 4]);
    expect(elements[1]?.dofIndices).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
  });

  it("the portal frame matrix has the expected in-plane terms at a beam-column joint (tolerance: relative 1e-12)", () => {
    // Node n2: top of column c1 (vertical, 4 m, local x = global Z, local y = global Y) and start
    // of beam b1 (along X, 6 m). In-plane bending of both is about global Y and uses Iy.
    const result = assemble(portalFrame());
    if (!result.ok) {
      throw new Error("test: expected the portal frame to assemble");
    }
    const { stiffness: K, dofMap } = result;
    const { E, A, Iy } = STEEL;
    const row = (dof: (typeof DOFS)[number]) => dofIndex(dofMap, "n2", dof) as number;
    const close = (i: number, j: number, value: number) => {
      expect(Math.abs(at(K, i, j) - value)).toBeLessThanOrEqual(REL_TOL * Math.abs(value));
    };
    // Sway (global ux): the column's shear stiffness plus the beam's axial stiffness.
    close(row("ux"), row("ux"), (12 * E * Iy) / 4 ** 3 + (E * A) / 6);
    // Vertical (global uz): the column's axial stiffness plus the beam's shear stiffness.
    close(row("uz"), row("uz"), (E * A) / 4 + (12 * E * Iy) / 6 ** 3);
    // Joint rotation about global Y: 4EI/L of both members.
    close(row("ry"), row("ry"), (4 * E * Iy) / 4 + (4 * E * Iy) / 6);
    // Sway with joint rotation, from the column alone (the beam's axial term has no coupling).
    // A rigid rotation about Y through the column's base moves its top by +θ·4 along X, so a pure
    // sway of the top with no rotation needs the moment -6EI/L² per unit sway at the top.
    close(row("ux"), row("ry"), (-6 * E * Iy) / 4 ** 2);
    // Vertical with joint rotation, from the beam's start: uz-ry in axes equal to the global ones.
    close(row("uz"), row("ry"), (-6 * E * Iy) / 6 ** 2);
  });

  it("K times each rigid-body motion of the whole portal frame is zero (tolerance: 1e-9 · max|K| · max|u|)", () => {
    const model = portalFrame();
    const result = assemble(model);
    if (!result.ok) {
      throw new Error("test: expected the portal frame to assemble");
    }
    const K = result.stiffness;
    const e = [
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 1 },
    ];
    const motions: number[][] = [];
    for (const a of e) {
      motions.push(model.nodes.flatMap(() => [a.x, a.y, a.z, 0, 0, 0]));
      motions.push(
        model.nodes.flatMap((r) => [
          a.y * r.z - a.z * r.y,
          a.z * r.x - a.x * r.z,
          a.x * r.y - a.y * r.x,
          a.x,
          a.y,
          a.z,
        ]),
      );
    }
    for (const u of motions) {
      const residual = Math.max(...Array.from(multiplyVector(K, u), Math.abs));
      expect(residual).toBeLessThanOrEqual(RIGID_TOL * maxAbs(K) * Math.max(...u.map(Math.abs)));
    }
  });

  it("a node that no member touches keeps zero rows", () => {
    const model = portalFrame();
    model.nodes.push({ id: "free", x: 9, y: 9, z: 9 });
    const result = assemble(model);
    if (!result.ok) {
      throw new Error("test: expected the model to assemble");
    }
    expect(result.stiffness.rows).toBe(30);
    expect(Array.from(result.stiffness.data.subarray(24 * 30)).every((v) => v === 0)).toBe(true);
  });

  it("does not change the model", () => {
    const model = portalFrame();
    assemble(model);
    expect(model).toEqual(portalFrame());
  });

  it("refuses a model that validateModel reports issues for, returning those issues", () => {
    const model = portalFrame();
    model.supports = [];
    (model.members[0] as Model["members"][number]).sectionId = "nope";
    const result = assemble(model);
    expect(result).toEqual({
      ok: false,
      reason: "invalid-model",
      issues: [
        {
          code: "missing-section",
          messageKey: "model.issue.missing-section",
          ids: ["c1", "nope"],
          path: "members[0].sectionId",
        },
        { code: "no-support", messageKey: "model.issue.no-support", ids: [] },
      ],
    });
  });

  it("refuses truss members with a typed not-supported-yet result", () => {
    const result = assemble(planarTruss());
    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== "not-supported-yet") {
      throw new Error("test: expected not-supported-yet");
    }
    expect(result.unsupported).toEqual(
      ["t1", "t2", "t3", "t4", "t5", "t6", "t7"].map((memberId) => ({
        memberId,
        feature: "truss-member",
      })),
    );
  });

  it.each([
    ["start", "rx"],
    ["start", "ry"],
    ["start", "rz"],
    ["end", "rx"],
    ["end", "ry"],
    ["end", "rz"],
  ] as const)("refuses a member with the %s %s release", (end, axis) => {
    const model = portalFrame();
    (model.members[1] as Model["members"][number]).releases[end][axis] = true;
    expect(assemble(model)).toEqual({
      ok: false,
      reason: "not-supported-yet",
      unsupported: [{ memberId: "b1", feature: "end-release" }],
    });
  });

  it("throws for a member whose local axes cannot be computed (an infinite coordinate)", () => {
    const model = portalFrame();
    (model.nodes[1] as Model["nodes"][number]).z = Number.POSITIVE_INFINITY;
    expect(() => assemble(model)).toThrow("member c1 could not be resolved");
  });
});
