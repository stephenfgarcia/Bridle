/**
 * Part (d) of the evidence: the applied loads of the reference and of the learner's model in the
 * task's load case.
 *
 * Every load is first resolved to a force vector in global axes at a point of space:
 * - a nodal load: its force at the node, with its own moment;
 * - a uniform load: (value × the member's length) along its axis, at the middle of the member;
 * - a point load: its value along its axis, at `position` metres from the member's start node.
 * A load in a member's local axes uses `memberLocalAxes` of `@bridle/model` for that member.
 */
import {
  distance,
  type LoadAxes,
  type LoadDirection,
  type Member,
  type Model,
  memberLocalAxes,
  type Vec3,
} from "@bridle/model";
import type { ModelMatch } from "./matching";
import { allInRange } from "./range";
import {
  type ExtraLoad,
  LOAD_ABSOLUTE_TOLERANCE,
  LOAD_RELATIVE_TOLERANCE,
  type LoadComparison,
  type LoadKind,
  type LoadsEvidence,
  type LoadVector,
  type ResultantEvidence,
} from "./types";
import { add, compareIds, cross, firstById, norm, scale, subtract, ZERO } from "./vec";

/** One load of a model, resolved to global axes. */
export interface ResolvedLoad {
  kind: LoadKind;
  id: string;
  /** The node id (`nodal`) or the member id the load names. */
  targetId: string;
  /** The total force, kN. */
  force: Vec3;
  /** The load's own moment, kN·m: a nodal load's `mx`, `my`, `mz`; zero for a member load. */
  moment: Vec3;
  /** Where the force acts, m. */
  point: Vec3;
  /** For a uniform load, the force per unit length, kN/m; otherwise zero. */
  intensity: Vec3;
}

const KIND_ORDER: readonly LoadKind[] = ["nodal", "member-uniform", "member-point"];

const GLOBAL_AXES: Readonly<Record<LoadDirection, Vec3>> = {
  x: { x: 1, y: 0, z: 0 },
  y: { x: 0, y: 1, z: 0 },
  z: { x: 0, y: 0, z: 1 },
};

/** The geometry of a member, or `undefined` when a node is missing or the member has no length. */
function memberGeometry(
  model: Model,
  member: Member,
): { start: Vec3; end: Vec3; length: number; axes: Record<LoadDirection, Vec3> } | undefined {
  const nodes = firstById(model.nodes);
  const start = nodes.get(member.startNodeId);
  const end = nodes.get(member.endNodeId);
  if (start === undefined || end === undefined) {
    return undefined;
  }
  const axes = memberLocalAxes(start, end, member.rollAngleDeg);
  return axes && { start, end, length: distance(start, end), axes };
}

function direction(axes: LoadAxes, name: LoadDirection, local: Record<LoadDirection, Vec3>): Vec3 {
  return axes === "global" ? GLOBAL_AXES[name] : local[name];
}

/** A load left out because a component of it is not finite or is beyond `VALUE_BOUND`. */
export interface OutOfRangeLoad {
  kind: LoadKind;
  id: string;
  /** The node id (`nodal`) or the member id the load names. */
  targetId: string;
}

/**
 * Whether the model has an applied load in load case `loadCaseId`: a resolved load (`resolveLoads`)
 * with a force or moment component that is not zero.
 */
export function hasAppliedLoad(model: Model, loadCaseId: string): boolean {
  return resolveLoads(model, loadCaseId).loads.some((load) =>
    [load.force, load.moment].some((v) => v.x !== 0 || v.y !== 0 || v.z !== 0),
  );
}

/**
 * The loads of `model` in load case `loadCaseId`, resolved to global axes: nodal loads, then uniform
 * loads, then point loads, each in the model's order. With a repeated id among the nodes or the
 * members, the first entry is the one a load acts on.
 *
 * A load is not resolved, and is in no sum, when it names a node or a member the model lacks or a
 * member without length, or when a component of its force, its own moment, its point of action, its
 * force per unit length or its moment about the origin (r × F) is not `inRange`: not finite, or
 * beyond `VALUE_BOUND`. `unresolvedIds` has all of them, sorted; `outOfRange` has those of the
 * second kind with the node or member they name.
 */
export function resolveLoads(
  model: Model,
  loadCaseId: string,
): { loads: ResolvedLoad[]; unresolvedIds: string[]; outOfRange: OutOfRangeLoad[] } {
  const nodes = firstById(model.nodes);
  const members = firstById(model.members);
  const loads: ResolvedLoad[] = [];
  const unresolvedIds: string[] = [];
  const outOfRange: OutOfRangeLoad[] = [];
  const accept = (load: ResolvedLoad): void => {
    const about = cross(load.point, load.force);
    const vectors = [load.force, load.moment, load.point, load.intensity, about];
    if (allInRange(vectors.flatMap((v) => [v.x, v.y, v.z]))) {
      loads.push(load);
    } else {
      unresolvedIds.push(load.id);
      outOfRange.push({ kind: load.kind, id: load.id, targetId: load.targetId });
    }
  };
  for (const load of model.nodalLoads) {
    if (load.loadCaseId !== loadCaseId) {
      continue;
    }
    const node = nodes.get(load.nodeId);
    if (node === undefined) {
      unresolvedIds.push(load.id);
      continue;
    }
    accept({
      kind: "nodal",
      id: load.id,
      targetId: load.nodeId,
      force: { x: load.fx, y: load.fy, z: load.fz },
      moment: { x: load.mx, y: load.my, z: load.mz },
      point: { x: node.x, y: node.y, z: node.z },
      intensity: ZERO,
    });
  }
  for (const load of model.memberUniformLoads) {
    if (load.loadCaseId !== loadCaseId) {
      continue;
    }
    const member = members.get(load.memberId);
    const geometry = member && memberGeometry(model, member);
    if (geometry === undefined) {
      unresolvedIds.push(load.id);
      continue;
    }
    const intensity = scale(direction(load.axes, load.direction, geometry.axes), load.value);
    accept({
      kind: "member-uniform",
      id: load.id,
      targetId: load.memberId,
      force: scale(intensity, geometry.length),
      moment: ZERO,
      point: scale(add(geometry.start, geometry.end), 0.5),
      intensity,
    });
  }
  for (const load of model.memberPointLoads) {
    if (load.loadCaseId !== loadCaseId) {
      continue;
    }
    const member = members.get(load.memberId);
    const geometry = member && memberGeometry(model, member);
    if (geometry === undefined) {
      unresolvedIds.push(load.id);
      continue;
    }
    accept({
      kind: "member-point",
      id: load.id,
      targetId: load.memberId,
      force: scale(direction(load.axes, load.direction, geometry.axes), load.value),
      moment: ZERO,
      point: add(geometry.start, scale(geometry.axes.x, load.position)),
      intensity: ZERO,
    });
  }
  return { loads, unresolvedIds: unresolvedIds.sort(compareIds), outOfRange };
}

function vector(force: Vec3, moment: Vec3): LoadVector {
  return { fx: force.x, fy: force.y, fz: force.z, mx: moment.x, my: moment.y, mz: moment.z };
}

/** The sum of the forces of `loads` and of their moments about `about` (r × F plus their own moments). */
function sumAbout(loads: readonly ResolvedLoad[], about: Vec3): { force: Vec3; moment: Vec3 } {
  let force = ZERO;
  let moment = ZERO;
  for (const load of loads) {
    force = add(force, load.force);
    moment = add(moment, add(load.moment, cross(subtract(load.point, about), load.force)));
  }
  return { force, moment };
}

/**
 * The resultant of resolved loads: the sum of the forces, and the sum of their moments about the
 * origin of the global axes (each force's r × F plus its own moment).
 */
export function resultantOf(loads: readonly ResolvedLoad[]): LoadVector {
  const { force, moment } = sumAbout(loads, ZERO);
  return vector(force, moment);
}

/** max(`LOAD_RELATIVE_TOLERANCE` × `reference`, `LOAD_ABSOLUTE_TOLERANCE`). */
export function loadAllowance(reference: number): number {
  return Math.max(LOAD_RELATIVE_TOLERANCE * reference, LOAD_ABSOLUTE_TOLERANCE);
}

function forceOf(v: LoadVector): Vec3 {
  return { x: v.fx, y: v.fy, z: v.fz };
}

function momentOf(v: LoadVector): Vec3 {
  return { x: v.mx, y: v.my, z: v.mz };
}

/** The differences of two load vectors and their allowances, by the lengths of the force and the moment parts. */
function compareVectors(reference: LoadVector, learner: LoadVector) {
  const forceDifference = norm(subtract(forceOf(learner), forceOf(reference)));
  const forceAllowance = loadAllowance(norm(forceOf(reference)));
  const momentDifference = norm(subtract(momentOf(learner), momentOf(reference)));
  const momentAllowance = loadAllowance(norm(momentOf(reference)));
  return {
    forceDifference,
    forceAllowance,
    momentDifference,
    momentAllowance,
    agrees: forceDifference <= forceAllowance && momentDifference <= momentAllowance,
  };
}

/** The two resultants and whether they agree: both differences within their allowances. */
export function compareResultants(reference: LoadVector, learner: LoadVector): ResultantEvidence {
  return { reference, learner, ...compareVectors(reference, learner) };
}

/**
 * The sum of loads of one kind on one node or member, as the vector `LoadComparison` describes:
 * the six components of nodal loads; the intensity of uniform loads; the force of point loads with
 * its moment about `about`.
 */
function groupVector(kind: LoadKind, loads: readonly ResolvedLoad[], about: Vec3): LoadVector {
  if (kind === "member-uniform") {
    return vector(
      loads.reduce((sum, load) => add(sum, load.intensity), ZERO),
      ZERO,
    );
  }
  if (kind === "nodal") {
    return vector(
      loads.reduce((sum, load) => add(sum, load.force), ZERO),
      loads.reduce((sum, load) => add(sum, load.moment), ZERO),
    );
  }
  const { force, moment } = sumAbout(loads, about);
  return vector(force, moment);
}

/**
 * Compares the loads of the two models in load case `loadCaseId`.
 *
 * - The resultants of all resolved loads of each model, compared by `compareResultants`.
 * - One comparison per kind of load and node or member the reference loads. The learner's
 *   counterpart is every load of that kind, in the load case, on the node matched to the reference
 *   node or on the member matched to the reference member (`match`: by position, in either
 *   direction). Several loads on one target are summed on each side.
 * - The learner's loads of the load case that are in no comparison are `extra`.
 *
 * A learner's load that is not resolved is in none of these; one whose numbers are out of range is
 * named in the comparison of its node or member (`learnerOutOfRangeLoadIds`).
 *
 * A member the learner split in two has no matched member, so a load on its pieces has no
 * counterpart: the reference's load is `missing` and the learner's loads are `extra`, while the
 * resultants still agree if the loads are the same.
 */
export function compareLoads(
  reference: Model,
  learner: Model,
  match: ModelMatch,
  loadCaseId: string,
): LoadsEvidence {
  const ofReference = resolveLoads(reference, loadCaseId);
  const ofLearner = resolveLoads(learner, loadCaseId);
  const referenceMembers = firstById(reference.members);
  const referenceNodes = firstById(reference.nodes);

  const comparisons: LoadComparison[] = [];
  const compared = new Set<ResolvedLoad>();
  for (const kind of KIND_ORDER) {
    const targets: string[] = [];
    for (const load of ofReference.loads) {
      if (load.kind === kind && !targets.includes(load.targetId)) {
        targets.push(load.targetId);
      }
    }
    for (const targetId of targets) {
      const referenceLoads = ofReference.loads.filter(
        (load) => load.kind === kind && load.targetId === targetId,
      );
      const learnerTargetId =
        kind === "nodal"
          ? (match.nodes.get(targetId)?.id ?? null)
          : (match.members.get(targetId)?.member.id ?? null);
      const learnerLoads = ofLearner.loads
        .filter((load) => load.kind === kind && load.targetId === learnerTargetId)
        .sort((a, b) => compareIds(a.id, b.id));
      for (const load of learnerLoads) {
        compared.add(load);
      }
      // The moment of point loads is taken about the reference member's start node for both models.
      const member = referenceMembers.get(targetId);
      const about = (member && referenceNodes.get(member.startNodeId)) ?? ZERO;
      const referenceVector = groupVector(kind, referenceLoads, about);
      const learnerVector =
        learnerLoads.length === 0 ? null : groupVector(kind, learnerLoads, about);
      const result = learnerVector === null ? null : compareVectors(referenceVector, learnerVector);
      comparisons.push({
        kind,
        referenceTargetId: targetId,
        referenceLoadIds: referenceLoads.map((load) => load.id),
        learnerTargetId,
        learnerLoadIds: learnerLoads.map((load) => load.id),
        learnerOutOfRangeLoadIds: ofLearner.outOfRange
          .filter((load) => load.kind === kind && load.targetId === learnerTargetId)
          .map((load) => load.id)
          .sort(compareIds),
        reference: referenceVector,
        learner: learnerVector,
        forceDifference: result?.forceDifference ?? null,
        forceAllowance: loadAllowance(norm(forceOf(referenceVector))),
        momentDifference: result?.momentDifference ?? null,
        momentAllowance: loadAllowance(norm(momentOf(referenceVector))),
        status: result === null ? "missing" : result.agrees ? "agrees" : "differs",
      });
    }
  }

  const extra: ExtraLoad[] = [];
  for (const kind of KIND_ORDER) {
    const rest = ofLearner.loads
      .filter((load) => load.kind === kind && !compared.has(load))
      .sort((a, b) => compareIds(a.id, b.id));
    for (const load of rest) {
      extra.push({
        kind,
        loadId: load.id,
        learnerTargetId: load.targetId,
        referenceTargetId:
          (kind === "nodal"
            ? match.otherNodeIdOf.get(load.targetId)
            : match.otherMemberIdOf.get(load.targetId)) ?? null,
      });
    }
  }

  const otherLoadCaseLoadIds = [
    ...learner.nodalLoads,
    ...learner.memberUniformLoads,
    ...learner.memberPointLoads,
  ]
    .filter((load) => load.loadCaseId !== loadCaseId)
    .map((load) => load.id)
    .sort(compareIds);

  return {
    loadCaseId,
    resultant: compareResultants(resultantOf(ofReference.loads), resultantOf(ofLearner.loads)),
    comparisons,
    extra,
    unresolvedLoadIds: ofLearner.unresolvedIds,
    otherLoadCaseLoadIds,
  };
}
