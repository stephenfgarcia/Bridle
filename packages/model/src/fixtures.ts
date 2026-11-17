/**
 * Three small models for tests and later cards, in model units (kN, m). Each call returns a new
 * object, so a caller may change it. Each is valid by `validateModel` (./index.test.ts checks it).
 *
 * The section and material values are round, illustrative numbers for a steel I-shape about 300 mm
 * deep and 150 mm wide; they are not taken from a section table or a design code. Names are short
 * codes, not text to translate.
 */
import {
  type Material,
  type Member,
  type MemberReleases,
  MODEL_UNITS,
  MODEL_VERSION,
  type Model,
  type Section,
  type Support,
} from "./types";

function section(): Section {
  return {
    id: "s1",
    name: "I 300x150",
    A: 5.4e-3,
    Iy: 8.4e-5,
    Iz: 6.0e-6,
    J: 2.0e-7,
    depthY: 0.15,
    depthZ: 0.3,
  };
}

/** E = 210 000 MPa, G = 81 000 MPa, fy = 355 MPa, stored in kN/m². */
function material(): Material {
  return { id: "mat1", name: "S355", E: 2.1e8, G: 8.1e7, fy: 3.55e5, density: 7850 };
}

function noReleases(): MemberReleases {
  return { start: { rx: false, ry: false, rz: false }, end: { rx: false, ry: false, rz: false } };
}

function member(id: string, startNodeId: string, endNodeId: string, kind: Member["kind"]): Member {
  return {
    id,
    startNodeId,
    endNodeId,
    sectionId: "s1",
    materialId: "mat1",
    kind,
    rollAngleDeg: 0,
    releases: noReleases(),
  };
}

function support(nodeId: string, restrained: readonly (keyof Omit<Support, "nodeId">)[]): Support {
  const has = (key: keyof Omit<Support, "nodeId">) => restrained.includes(key);
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

function base(): Pick<Model, "version" | "units" | "sections" | "materials" | "loadCases"> {
  return {
    version: MODEL_VERSION,
    units: { force: MODEL_UNITS.force, length: MODEL_UNITS.length },
    sections: [section()],
    materials: [material()],
    loadCases: [{ id: "lc1", name: "LC1" }],
  };
}

/**
 * A simply supported beam: 6 m along global X, one frame member `m1` from `n1` to `n2`, with a
 * uniform load of 10 kN/m downward (global z, value -10).
 *
 * Supports: `n1` holds the three translations and the rotation about global X (which stops the beam
 * spinning about its own axis); `n2` holds the translations along Y and Z and is free along X.
 */
export function simplySupportedBeam(): Model {
  return {
    ...base(),
    nodes: [
      { id: "n1", x: 0, y: 0, z: 0 },
      { id: "n2", x: 6, y: 0, z: 0 },
    ],
    members: [member("m1", "n1", "n2", "frame")],
    supports: [support("n1", ["ux", "uy", "uz", "rx"]), support("n2", ["uy", "uz"])],
    nodalLoads: [],
    memberUniformLoads: [
      { id: "ul1", loadCaseId: "lc1", memberId: "m1", axes: "global", direction: "z", value: -10 },
    ],
    memberPointLoads: [],
  };
}

/**
 * A portal frame in the global X-Z plane, 6 m wide and 4 m high: columns `c1` (`n1` up to `n2`) and
 * `c2` (`n4` up to `n3`), beam `b1` (`n2` to `n3`), all frame members, both bases fixed (all six
 * restraints). A lateral load of 20 kN along global +X acts on `n2`, the top of the left column.
 */
export function portalFrame(): Model {
  return {
    ...base(),
    nodes: [
      { id: "n1", x: 0, y: 0, z: 0 },
      { id: "n2", x: 0, y: 0, z: 4 },
      { id: "n3", x: 6, y: 0, z: 4 },
      { id: "n4", x: 6, y: 0, z: 0 },
    ],
    members: [
      member("c1", "n1", "n2", "frame"),
      member("b1", "n2", "n3", "frame"),
      member("c2", "n4", "n3", "frame"),
    ],
    supports: [
      support("n1", ["ux", "uy", "uz", "rx", "ry", "rz"]),
      support("n4", ["ux", "uy", "uz", "rx", "ry", "rz"]),
    ],
    nodalLoads: [
      { id: "nl1", loadCaseId: "lc1", nodeId: "n2", fx: 20, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 },
    ],
    memberUniformLoads: [],
    memberPointLoads: [],
  };
}

/**
 * A planar truss in the global X-Z plane: span 12 m, height 4 m, five nodes and seven truss members.
 * Bottom chord `n1` (0,0,0), `n2` (6,0,0), `n3` (12,0,0); top chord `n4` (3,0,4), `n5` (9,0,4); the
 * four diagonals are each 5 m long. Downward loads of 20 kN act on `n4` and on `n5`.
 *
 * Supports: `n1` holds the three translations, `n3` holds Y and Z, and `n2`, `n4`, `n5` are held
 * along Y only, which keeps the truss in its plane. No rotation is restrained anywhere: truss
 * members give the nodes no rotational stiffness, and the solver has to deal with that.
 */
export function planarTruss(): Model {
  return {
    ...base(),
    nodes: [
      { id: "n1", x: 0, y: 0, z: 0 },
      { id: "n2", x: 6, y: 0, z: 0 },
      { id: "n3", x: 12, y: 0, z: 0 },
      { id: "n4", x: 3, y: 0, z: 4 },
      { id: "n5", x: 9, y: 0, z: 4 },
    ],
    members: [
      member("t1", "n1", "n2", "truss"),
      member("t2", "n2", "n3", "truss"),
      member("t3", "n4", "n5", "truss"),
      member("t4", "n1", "n4", "truss"),
      member("t5", "n4", "n2", "truss"),
      member("t6", "n2", "n5", "truss"),
      member("t7", "n5", "n3", "truss"),
    ],
    supports: [
      support("n1", ["ux", "uy", "uz"]),
      support("n2", ["uy"]),
      support("n3", ["uy", "uz"]),
      support("n4", ["uy"]),
      support("n5", ["uy"]),
    ],
    nodalLoads: [
      { id: "nl1", loadCaseId: "lc1", nodeId: "n4", fx: 0, fy: 0, fz: -20, mx: 0, my: 0, mz: 0 },
      { id: "nl2", loadCaseId: "lc1", nodeId: "n5", fx: 0, fy: 0, fz: -20, mx: 0, my: 0, mz: 0 },
    ],
    memberUniformLoads: [],
    memberPointLoads: [],
  };
}
