/** Small builders the three tasks share. Values are in the units of `@bridle/model` (kN, m). */
import {
  type Material,
  type Member,
  type MemberUniformLoad,
  MODEL_UNITS,
  MODEL_VERSION,
  type Model,
  type Section,
  type Support,
} from "@bridle/model";
import { STEEL_DENSITY } from "./sections";
import type { Tolerance } from "./types";

/** The id of the one material of the tasks. */
export const STEEL_ID = "steel";

/** The id of the one load case of each task. */
export const LOAD_CASE_ID = "LC1";

/** Modulus of elasticity of the tasks' steel, in MPa (the briefs quote it) and in kN/m². */
export const STEEL_E_MPA = 210000;
/** `STEEL_E_MPA` as the briefs write it. */
export const STEEL_E_TEXT = "210 000";
/** Yield strength of the tasks' steel, in MPa. */
export const STEEL_FY_MPA = 355;

/**
 * The steel of the tasks: E = 210 000 MPa, G = 81 000 MPa, fy = 355 MPa, 7850 kg/m³, stored in kN/m²
 * (1 MPa = 1000 kN/m²). The same values as the material of `@bridle/model`'s fixtures.
 */
export function steel(): Material {
  return {
    id: STEEL_ID,
    name: "S355",
    E: STEEL_E_MPA * 1000,
    G: 8.1e7,
    fy: STEEL_FY_MPA * 1000,
    density: STEEL_DENSITY,
  };
}

/** A model with the given sections, the steel, the load case `LC1` and nothing else. */
export function emptyTaskModel(sections: Section[]): Model {
  return {
    version: MODEL_VERSION,
    units: { force: MODEL_UNITS.force, length: MODEL_UNITS.length },
    nodes: [],
    members: [],
    sections,
    materials: [steel()],
    supports: [],
    loadCases: [{ id: LOAD_CASE_ID, name: "Service loads" }],
    nodalLoads: [],
    memberUniformLoads: [],
    memberPointLoads: [],
  };
}

/** A frame member with roll 0 and no releases, in the tasks' steel. */
export function frameMember(
  id: string,
  startNodeId: string,
  endNodeId: string,
  sectionId: string,
): Member {
  return {
    id,
    startNodeId,
    endNodeId,
    sectionId,
    materialId: STEEL_ID,
    kind: "frame",
    rollAngleDeg: 0,
    releases: {
      start: { rx: false, ry: false, rz: false },
      end: { rx: false, ry: false, rz: false },
    },
  };
}

type Restraint = keyof Omit<Support, "nodeId">;

/** A support on `nodeId` that restrains the listed degrees of freedom and no other. */
export function support(nodeId: string, restrained: readonly Restraint[]): Support {
  const has = (key: Restraint) => restrained.includes(key);
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

/** A uniform load of `w` kN/m downward (global −Z) on a member, in load case `LC1`. */
export function gravityLoad(id: string, memberId: string, w: number): MemberUniformLoad {
  return {
    id,
    loadCaseId: LOAD_CASE_ID,
    memberId,
    axes: "global",
    direction: "z",
    value: -w,
  };
}

/**
 * The tolerances of the tasks' answers. Relative part: 1 percent for forces, moments and stresses,
 * 2 percent for displacements and for ratios of a displacement to its limit (a displacement depends
 * on E·I and on the fourth power of a length, so a slip in rounding a property moves it more than it
 * moves a force). Absolute part: half of the last digit a learner is asked to type (one decimal;
 * two decimals for a ratio), so that a correctly rounded answer is never outside the tolerance.
 */
export const FORCE_TOLERANCE: Tolerance = { relative: 0.01, absolute: 0.05 };
export const MOMENT_TOLERANCE: Tolerance = { relative: 0.01, absolute: 0.05 };
export const DISPLACEMENT_TOLERANCE: Tolerance = { relative: 0.02, absolute: 0.05 };
export const RATIO_TOLERANCE: Tolerance = { relative: 0.02, absolute: 0.005 };
export const STRESS_TOLERANCE: Tolerance = { relative: 0.01, absolute: 0.5 };

/** A number as the briefs write it: no trailing zeros, at most `decimals` decimals. */
export function plain(value: number, decimals = 2): string {
  return String(Number(value.toFixed(decimals)));
}
