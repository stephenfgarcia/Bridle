/**
 * The types of a structural model (`@bridle/model`). The conventions below are also in ../README.md.
 *
 * Axes and units:
 * - Global axes are right-handed with Z up; gravity acts along minus Z.
 * - The model stores forces in kN and lengths in m, so moments are kN·m, distributed loads are kN/m,
 *   and stresses and moduli (E, G, fy) are kN/m². Angles are in degrees. Density is in kg/m³.
 * - The interface displays stress in MPa (1 MPa = 1000 kN/m²) and deflection in mm (1 m = 1000 mm).
 *
 * Member local axes (the one written definition is in ./geometry.ts, `memberLocalAxes`): local x runs
 * from the start node to the end node; `Iy` and `Iz` are second moments of area about local y and z.
 */

/** The value of `Model.version` this package reads and writes. */
export const MODEL_VERSION = 1;

/** The units every number of a model is stored in. */
export const MODEL_UNITS = { force: "kN", length: "m" } as const;

export type ModelUnits = typeof MODEL_UNITS;

/** A point of the structure. `x`, `y`, `z` are global coordinates in m (Z up). */
export interface Node {
  id: string;
  x: number;
  y: number;
  z: number;
}

/**
 * `frame`: a member that carries axial force, shear, bending and torsion.
 * `truss`: a member that carries axial force only.
 */
export type MemberKind = "frame" | "truss";

/**
 * The rotational releases of one member end, about the member's local axes. `true` means released:
 * the member passes no moment about that axis to the node. `rx` is torsion, `ry` and `rz` are bending.
 */
export interface MemberEndRelease {
  rx: boolean;
  ry: boolean;
  rz: boolean;
}

export interface MemberReleases {
  start: MemberEndRelease;
  end: MemberEndRelease;
}

/** A straight member between two nodes. Its local x axis runs from the start node to the end node. */
export interface Member {
  id: string;
  startNodeId: string;
  endNodeId: string;
  sectionId: string;
  materialId: string;
  kind: MemberKind;
  /**
   * The roll angle in degrees: a rotation of local y and z about local x by the right-hand rule,
   * from their default orientation (./geometry.ts, `memberLocalAxes`).
   */
  rollAngleDeg: number;
  releases: MemberReleases;
}

/** A cross-section. Areas in m², second moments of area in m⁴, depths in m. */
export interface Section {
  id: string;
  name: string;
  /** Area, m². */
  A: number;
  /** Second moment of area about local y, m⁴ (bending in the local x-z plane). */
  Iy: number;
  /** Second moment of area about local z, m⁴ (bending in the local x-y plane). */
  Iz: number;
  /** Torsion constant, m⁴. */
  J: number;
  /**
   * The overall dimension of the section along local y, in m. The stress check takes the extreme
   * fibre for bending about local z at half of it (a section symmetric about its local axes).
   */
  depthY: number;
  /**
   * The overall dimension of the section along local z, in m. The stress check takes the extreme
   * fibre for bending about local y at half of it.
   */
  depthZ: number;
}

/** A material. `E`, `G` and `fy` are in kN/m² (1 MPa = 1000 kN/m²); `density` is in kg/m³. */
export interface Material {
  id: string;
  name: string;
  /** Modulus of elasticity, kN/m². */
  E: number;
  /** Shear modulus, kN/m². */
  G: number;
  /** Yield strength, kN/m². */
  fy: number;
  /** Mass density, kg/m³. */
  density: number;
}

/**
 * The restraints of one node, along and about the global axes. `true` means restrained: `ux`, `uy`,
 * `uz` are the translations, `rx`, `ry`, `rz` the rotations.
 */
export interface Support {
  nodeId: string;
  ux: boolean;
  uy: boolean;
  uz: boolean;
  rx: boolean;
  ry: boolean;
  rz: boolean;
}

/** A named set of loads that act together. */
export interface LoadCase {
  id: string;
  name: string;
}

/**
 * A load on a node. Its direction is global (a node has no local axes): `fx`, `fy`, `fz` are forces
 * in kN along global X, Y, Z; `mx`, `my`, `mz` are moments in kN·m about them, by the right-hand
 * rule. A downward force is a negative `fz`.
 */
export interface NodalLoad {
  id: string;
  loadCaseId: string;
  nodeId: string;
  fx: number;
  fy: number;
  fz: number;
  mx: number;
  my: number;
  mz: number;
}

/** Whether a member load's `direction` names a global axis or one of the member's local axes. */
export type LoadAxes = "global" | "local";

export type LoadDirection = "x" | "y" | "z";

/**
 * A force per unit length of the member, in kN/m, over the whole member, along the axis that `axes`
 * and `direction` name. The length is the member's own length, also for a global direction on an
 * inclined member. Gravity is `axes: "global"`, `direction: "z"` and a negative `value`.
 */
export interface MemberUniformLoad {
  id: string;
  loadCaseId: string;
  memberId: string;
  axes: LoadAxes;
  direction: LoadDirection;
  /** kN/m, signed along the axis. */
  value: number;
}

/**
 * A force in kN at one point of a member, along the axis that `axes` and `direction` name.
 * `position` is the distance in m from the start node along the member, from 0 to the member's length.
 */
export interface MemberPointLoad {
  id: string;
  loadCaseId: string;
  memberId: string;
  axes: LoadAxes;
  direction: LoadDirection;
  /** kN, signed along the axis. */
  value: number;
  /** m from the start node. */
  position: number;
}

/**
 * A structural model. Ids are strings, unique within their own list (a node and a member may share
 * an id). Members, supports and loads name other entries by id.
 */
export interface Model {
  version: typeof MODEL_VERSION;
  units: ModelUnits;
  nodes: Node[];
  members: Member[];
  sections: Section[];
  materials: Material[];
  supports: Support[];
  loadCases: LoadCase[];
  nodalLoads: NodalLoad[];
  memberUniformLoads: MemberUniformLoad[];
  memberPointLoads: MemberPointLoad[];
}
