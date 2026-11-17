/**
 * From the result of one load case to the values the Results section prints (card PX-02.8). Pure; the
 * component ./ResultsPanel.tsx only renders this.
 *
 * Units: the solver works in kN, m and rad (packages/solver/README.md, "Units"). Forces are printed in kN,
 * moments in kN·m, translations in mm (the solver's metres times 1000) and rotations in rad.
 *
 * Each value is printed with `formatNumber` against the largest value of its group, so that what is left of
 * rounding prints as "0" (./format.ts). The groups: the forces of all reactions of the load case; the moments
 * of all reactions; the translations of all nodes; the rotations of all nodes; the end forces of all members;
 * the end moments of all members.
 */
import type {
  LoadCaseResult,
  MemberEndAction,
  NodeDisplacement,
  NodeReaction,
} from "@bridle/solver";
import { formatNumber, largestOf } from "./format";

/** The unit a value is printed in. */
export type ResultUnit = "kN" | "kNm" | "mm" | "rad";

/** A force or moment component, of a reaction or of a member end. */
export type ForceComponent = keyof NodeReaction;
/** A displacement component. */
export type DisplacementComponent = keyof NodeDisplacement;

export const FORCE_COMPONENTS = ["fx", "fy", "fz"] as const;
export const MOMENT_COMPONENTS = ["mx", "my", "mz"] as const;
export const TRANSLATION_COMPONENTS = ["ux", "uy", "uz"] as const;
export const ROTATION_COMPONENTS = ["rx", "ry", "rz"] as const;

/** One printed value. */
export interface ResultCell<C extends string = string> {
  component: C;
  /** The value as text, without its unit. */
  text: string;
  unit: ResultUnit;
}

/** The reaction at one support: three forces, then three moments, in global axes. */
export interface ReactionRow {
  nodeId: string;
  cells: ResultCell<ForceComponent>[];
}

function forceCells(
  values: NodeReaction | MemberEndAction,
  largestForce: number,
  largestMoment: number,
): ResultCell<ForceComponent>[] {
  return [
    ...FORCE_COMPONENTS.map((component) => ({
      component,
      text: formatNumber(values[component], largestForce),
      unit: "kN" as const,
    })),
    ...MOMENT_COMPONENTS.map((component) => ({
      component,
      text: formatNumber(values[component], largestMoment),
      unit: "kNm" as const,
    })),
  ];
}

function largestComponent<C extends string>(
  entries: Iterable<Record<C, number>>,
  components: readonly C[],
): number {
  const values: number[] = [];
  for (const entry of entries) {
    for (const component of components) {
      values.push(entry[component]);
    }
  }
  return largestOf(values);
}

/**
 * The reactions of a load case, one row per support, in the order of `nodeIds` (the node ids of the solved
 * model in its order: `nodeIds` of the solve result). A reaction is what the support applies to the structure,
 * positive along and about the positive global axes.
 */
export function reactionRows(loadCase: LoadCaseResult, nodeIds: readonly string[]): ReactionRow[] {
  const reactions = Object.values(loadCase.reactions);
  const largestForce = largestComponent(reactions, FORCE_COMPONENTS);
  const largestMoment = largestComponent(reactions, MOMENT_COMPONENTS);
  const rows: ReactionRow[] = [];
  for (const nodeId of nodeIds) {
    const reaction = Object.hasOwn(loadCase.reactions, nodeId)
      ? loadCase.reactions[nodeId]
      : undefined;
    if (reaction !== undefined) {
      rows.push({ nodeId, cells: forceCells(reaction, largestForce, largestMoment) });
    }
  }
  return rows;
}

/**
 * The sums of the reaction forces of a load case along global X, Y and Z, in kN. With the loads of the case
 * they are in equilibrium, so each is minus the sum of the applied forces along that axis. A sum is compared
 * with the largest single reaction force, so reactions that cancel print as "0".
 */
export function reactionForceSums(loadCase: LoadCaseResult): ResultCell<"fx" | "fy" | "fz">[] {
  const reactions = Object.values(loadCase.reactions);
  const largestForce = largestComponent(reactions, FORCE_COMPONENTS);
  return FORCE_COMPONENTS.map((component) => ({
    component,
    text: formatNumber(
      reactions.reduce((sum, reaction) => sum + reaction[component], 0),
      largestForce,
    ),
    unit: "kN" as const,
  }));
}

/**
 * The displacement of one node in global axes: three translations in mm, then three rotations in rad.
 * `null` when the load case has no entry for the node (a node added after the model was solved).
 */
export function displacementCells(
  loadCase: LoadCaseResult,
  nodeId: string,
): ResultCell<DisplacementComponent>[] | null {
  if (!Object.hasOwn(loadCase.displacements, nodeId)) {
    return null;
  }
  const displacement = loadCase.displacements[nodeId];
  if (displacement === undefined) {
    return null;
  }
  const all = Object.values(loadCase.displacements);
  const largestTranslation = largestComponent(all, TRANSLATION_COMPONENTS) * 1000;
  const largestRotation = largestComponent(all, ROTATION_COMPONENTS);
  return [
    ...TRANSLATION_COMPONENTS.map((component) => ({
      component,
      text: formatNumber(displacement[component] * 1000, largestTranslation),
      unit: "mm" as const,
    })),
    ...ROTATION_COMPONENTS.map((component) => ({
      component,
      text: formatNumber(displacement[component], largestRotation),
      unit: "rad" as const,
    })),
  ];
}

/** The end forces of one member: what its start node and its end node apply to its ends, in its local axes. */
export interface MemberEndCells {
  start: ResultCell<ForceComponent>[];
  end: ResultCell<ForceComponent>[];
}

/**
 * The end forces of one member, as the solver reports them: the forces and moments the joints apply to the
 * member's two ends, in the member's local axes, positive along and about the positive local axes at both
 * ends. They are not internal forces by a beam sign convention. `null` when the load case has no entry for
 * the member (a member added after the model was solved).
 */
export function memberEndCells(loadCase: LoadCaseResult, memberId: string): MemberEndCells | null {
  if (!Object.hasOwn(loadCase.memberEndForces, memberId)) {
    return null;
  }
  const forces = loadCase.memberEndForces[memberId];
  if (forces === undefined) {
    return null;
  }
  const ends = Object.values(loadCase.memberEndForces).flatMap((entry) => [entry.start, entry.end]);
  const largestForce = largestComponent(ends, FORCE_COMPONENTS);
  const largestMoment = largestComponent(ends, MOMENT_COMPONENTS);
  return {
    start: forceCells(forces.start, largestForce, largestMoment),
    end: forceCells(forces.end, largestForce, largestMoment),
  };
}
