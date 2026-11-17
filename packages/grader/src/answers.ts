/**
 * Part (e) of the evidence: each required answer compared with the reference value and with the
 * value the solver computes for the learner's own model.
 *
 * The own-model value is read here and not by `computeAnswers` of `@bridle/tasks`, because that
 * function looks nodes and members up by the ids of the reference model, and a learner's node or
 * member is found by where it is. For a learner's model that uses the reference's ids and member
 * directions the two give the same numbers (a test checks it).
 */
import { type Member, type Model, memberLocalAxes, type Node, type Vec3 } from "@bridle/model";
import type { LoadCaseResult } from "@bridle/solver";
import {
  type AnswersResult,
  type ComputedAnswer,
  computeAnswers,
  DISPLAY_PER_MODEL_UNIT,
  type ForceComponent,
  type RequiredAnswer,
  referenceAnswers,
  type Task,
  type Tolerance,
} from "@bridle/tasks";
import { type ModelMatch, memberEnds } from "./matching";
import type { ExaminedModel } from "./modelState";
import { inRange } from "./range";
import {
  type AnswerEvidence,
  type AnswerVerdict,
  NODE_MATCH_TOLERANCE,
  type OwnModelLocation,
  type ReferenceBasis,
  type RequirementEvidence,
  type ValueStatus,
} from "./types";
import { dot, firstById, norm, scale, subtract } from "./vec";

/** The allowance of the tolerance rule of `@bridle/tasks`: max(relative × |reference|, absolute). */
export function allowance(tolerance: Tolerance, reference: number): number {
  return Math.max(tolerance.relative * Math.abs(reference), tolerance.absolute);
}

/** |typed − reference| for a signed answer; | |typed| − |reference| | for an unsigned one. */
export function answerDifference(signed: boolean, typed: number, reference: number): number {
  return signed ? Math.abs(typed - reference) : Math.abs(Math.abs(typed) - Math.abs(reference));
}

/** The tolerance rule: the difference is at most the allowance. All three values in the display unit. */
export function withinTolerance(
  signed: boolean,
  tolerance: Tolerance,
  typed: number,
  reference: number,
): boolean {
  return answerDifference(signed, typed, reference) <= allowance(tolerance, reference);
}

/** The reference value of one answer, in its display unit. */
export interface ReferenceValue {
  status: ValueStatus;
  basis: ReferenceBasis;
  value: number | null;
}

/**
 * The reference values of a task's answers.
 *
 * With `chosenSectionId` (a section of the task's `sectionChoice` list that the reference model
 * has), they are computed by `computeAnswers` for the reference model with that section on the
 * members of the choice; otherwise by `referenceAnswers` for the reference model as it is.
 *
 * @returns for an answer id, its value: `computed`, `pending` (the answer's source is the pending
 *   marker), `unavailable` (the reference model does not solve or lacks what the source names) or
 *   `out-of-range` (the value in the display unit is not `inRange`)
 */
export function referenceValues(
  task: Task,
  chosenSectionId: string | null,
): (answerId: string) => ReferenceValue {
  const choice = task.sectionChoice;
  const useChoice =
    choice !== undefined &&
    chosenSectionId !== null &&
    choice.sectionIds.includes(chosenSectionId) &&
    task.referenceModel.sections.some((section) => section.id === chosenSectionId);
  let result: AnswersResult;
  if (useChoice) {
    const named = new Set(choice.memberIds);
    const model: Model = {
      ...task.referenceModel,
      members: task.referenceModel.members.map((member) =>
        named.has(member.id) ? { ...member, sectionId: chosenSectionId } : member,
      ),
    };
    result = computeAnswers(task, model);
  } else {
    result = referenceAnswers(task);
  }
  const basis: ReferenceBasis = useChoice
    ? "reference-model-with-chosen-section"
    : "reference-model";
  const byId = new Map<string, ComputedAnswer>();
  if (result.ok) {
    for (const answer of result.answers) {
      byId.set(answer.answerId, answer);
    }
  }
  return (answerId) => {
    const answer = byId.get(answerId);
    if (answer?.status === "computed") {
      return inRange(answer.display)
        ? { status: "computed", basis, value: answer.display }
        : { status: "out-of-range", basis: "none", value: null };
    }
    return {
      status: answer?.status === "pending" ? "pending" : "unavailable",
      basis: "none",
      value: null,
    };
  };
}

/** The value of one answer for the learner's own model, in model units and with the solver's sign. */
export interface OwnModelValue {
  status: ValueStatus;
  location: OwnModelLocation | null;
  value: number | null;
}

const NOT_COMPUTED = (status: ValueStatus): OwnModelValue => ({
  status,
  location: null,
  value: null,
});

/** The learner's member end that stands for one end of a reference member. */
export interface FoundMemberEnd {
  member: Member;
  /** The end of the learner's member that is at the node. */
  memberEnd: "start" | "end";
  /** The learner's node matched to the reference member's node at that end. */
  node: Node;
  /** The member is a piece of the reference member, not a member between its two nodes. */
  piece: boolean;
}

/**
 * Finds, in the learner's model, the member end that is at the node of the reference member's
 * `end`. The end is resolved through the node, not through the learner's member's own direction:
 * the "end" of reference member A-C is the end at C, which is the start of a learner's member drawn
 * from C to A.
 *
 * 1. The learner's node matched to that node of the reference member; without one, `node-not-found`.
 * 2. The learner's member matched to the reference member (between the same two nodes).
 * 3. Otherwise a piece: a learner's member with exactly one end at that node whose other node lies
 *    on the reference member's axis, strictly between its two nodes (more than
 *    `NODE_MATCH_TOLERANCE` from each along the axis and at most that far from the axis). This is
 *    what a learner gets who splits the member with an extra node. With no such member, or more
 *    than one, the result is `member-not-found`.
 */
export function findMemberEnd(
  reference: Model,
  learner: Model,
  match: ModelMatch,
  referenceMember: Member,
  end: "start" | "end",
): FoundMemberEnd | "node-not-found" | "member-not-found" {
  const atId = end === "start" ? referenceMember.startNodeId : referenceMember.endNodeId;
  const node = match.nodes.get(atId);
  if (node === undefined) {
    return "node-not-found";
  }
  const matched = match.members.get(referenceMember.id);
  if (matched !== undefined) {
    const memberEnd = matched.member.startNodeId === node.id ? "start" : "end";
    return { member: matched.member, memberEnd, node, piece: false };
  }
  const ends = memberEnds(reference, referenceMember);
  if (ends === undefined) {
    return "member-not-found";
  }
  const at = end === "start" ? ends.start : ends.end;
  const far = end === "start" ? ends.end : ends.start;
  const axis = subtract(far, at);
  const length = norm(axis);
  if (!(length > 0)) {
    return "member-not-found";
  }
  const unit = scale(axis, 1 / length);
  const learnerNodes = firstById(learner.nodes);
  const pieces: FoundMemberEnd[] = [];
  for (const member of firstById(learner.members).values()) {
    const startsHere = member.startNodeId === node.id;
    const endsHere = member.endNodeId === node.id;
    if (startsHere === endsHere) {
      continue;
    }
    const other = learnerNodes.get(startsHere ? member.endNodeId : member.startNodeId);
    if (other === undefined) {
      continue;
    }
    const offset = subtract(other, at);
    const along = dot(offset, unit);
    const across = norm(subtract(offset, scale(unit, along)));
    if (
      along > NODE_MATCH_TOLERANCE &&
      along < length - NODE_MATCH_TOLERANCE &&
      across <= NODE_MATCH_TOLERANCE
    ) {
      pieces.push({ member, memberEnd: startsHere ? "start" : "end", node, piece: true });
    }
  }
  const [piece] = pieces;
  return pieces.length === 1 && piece !== undefined ? piece : "member-not-found";
}

function sameAxis(a: Vec3, b: Vec3): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

/**
 * One component of the end action at `found`, expressed in the local axes of the reference member.
 *
 * The solver gives the end action in the learner's member's local axes. When those are the same
 * three vectors as the reference member's, the component is read as it is. Otherwise (a member
 * drawn in the other direction, or with another roll angle) the force or moment vector is turned
 * to global axes with the learner's member's axes and its component along the reference member's
 * axis is taken, so the sign is the one the reference member would report at that node.
 *
 * @returns `undefined` when the results have no entry for the member or an axis cannot be computed
 */
export function memberEndComponent(
  reference: Model,
  referenceMember: Member,
  learner: Model,
  found: FoundMemberEnd,
  results: LoadCaseResult,
  component: ForceComponent,
): number | undefined {
  if (!Object.hasOwn(results.memberEndForces, found.member.id)) {
    return undefined;
  }
  const action = results.memberEndForces[found.member.id]?.[found.memberEnd];
  const referenceEnds = memberEnds(reference, referenceMember);
  const learnerEnds = memberEnds(learner, found.member);
  if (action === undefined || referenceEnds === undefined || learnerEnds === undefined) {
    return undefined;
  }
  const referenceAxes = memberLocalAxes(
    referenceEnds.start,
    referenceEnds.end,
    referenceMember.rollAngleDeg,
  );
  const learnerAxes = memberLocalAxes(
    learnerEnds.start,
    learnerEnds.end,
    found.member.rollAngleDeg,
  );
  if (referenceAxes === undefined || learnerAxes === undefined) {
    return undefined;
  }
  if (
    sameAxis(referenceAxes.x, learnerAxes.x) &&
    sameAxis(referenceAxes.y, learnerAxes.y) &&
    sameAxis(referenceAxes.z, learnerAxes.z)
  ) {
    return action[component];
  }
  const local: Vec3 =
    component === "fx" || component === "fy" || component === "fz"
      ? { x: action.fx, y: action.fy, z: action.fz }
      : { x: action.mx, y: action.my, z: action.mz };
  const global: Vec3 = {
    x: local.x * learnerAxes.x.x + local.y * learnerAxes.y.x + local.z * learnerAxes.z.x,
    y: local.x * learnerAxes.x.y + local.y * learnerAxes.y.y + local.z * learnerAxes.z.y,
    z: local.x * learnerAxes.x.z + local.y * learnerAxes.y.z + local.z * learnerAxes.z.z,
  };
  const axis = component.endsWith("x") ? "x" : component.endsWith("y") ? "y" : "z";
  return dot(global, referenceAxes[axis]);
}

/**
 * The value of one answer for the learner's own model, read from the solver's results where the
 * reference has the node or member the answer's source names (`match`, by position).
 *
 * - `reaction`: the reaction at the learner's node there; `no-support` when that node has no support.
 * - `displacement`: the translation of the learner's node there.
 * - `member-end-force`: `findMemberEnd`, then `memberEndComponent`.
 * - `limit-ratio`: the ratio of the requirement in `requirements` (part f), with its status.
 * - `pending`: no value.
 *
 * The value is in model units with the solver's sign; `answerEvidence` converts it.
 *
 * @param loaded - whether the learner's model has an applied load in the task's load case
 *   (`hasAppliedLoad`). Without one every result of the model is zero whatever the model is, so no
 *   value is offered (`no-loads`) and no typed answer can be `consistent-with-own-model`.
 */
export function ownModelValue(
  task: Task,
  answer: RequiredAnswer,
  match: ModelMatch | null,
  examined: Pick<ExaminedModel, "model" | "results" | "resultsStatus">,
  requirements: readonly RequirementEvidence[],
  loaded: boolean,
): OwnModelValue {
  const source = answer.source;
  if (source.kind === "pending") {
    return NOT_COMPUTED("pending");
  }
  const { model, results } = examined;
  if (model === null || match === null || results === null) {
    return NOT_COMPUTED(
      examined.resultsStatus === "computed" ? "not-solved" : examined.resultsStatus,
    );
  }
  if (!loaded) {
    return NOT_COMPUTED("no-loads");
  }
  const at = (node: Node): OwnModelLocation => ({
    nodeId: node.id,
    memberId: null,
    memberEnd: null,
    piece: false,
  });
  switch (source.kind) {
    case "reaction": {
      const node = match.nodes.get(source.nodeId);
      if (node === undefined) {
        return NOT_COMPUTED("node-not-found");
      }
      const reaction = Object.hasOwn(results.reactions, node.id)
        ? results.reactions[node.id]
        : undefined;
      return reaction === undefined
        ? NOT_COMPUTED("no-support")
        : { status: "computed", location: at(node), value: reaction[source.component] };
    }
    case "displacement": {
      const node = match.nodes.get(source.nodeId);
      const displacement =
        node !== undefined && Object.hasOwn(results.displacements, node.id)
          ? results.displacements[node.id]
          : undefined;
      return node === undefined || displacement === undefined
        ? NOT_COMPUTED("node-not-found")
        : { status: "computed", location: at(node), value: displacement[source.component] };
    }
    case "member-end-force": {
      const referenceMember = task.referenceModel.members.find(
        (member) => member.id === source.memberId,
      );
      if (referenceMember === undefined) {
        return NOT_COMPUTED("member-not-found");
      }
      const found = findMemberEnd(task.referenceModel, model, match, referenceMember, source.end);
      if (typeof found === "string") {
        return NOT_COMPUTED(found);
      }
      const value = memberEndComponent(
        task.referenceModel,
        referenceMember,
        model,
        found,
        results,
        source.component,
      );
      return value === undefined
        ? NOT_COMPUTED("member-not-found")
        : {
            status: "computed",
            location: {
              nodeId: found.node.id,
              memberId: found.member.id,
              memberEnd: found.memberEnd,
              piece: found.piece,
            },
            value,
          };
    }
    case "limit-ratio": {
      const requirement = requirements.find((item) => item.requirementId === source.requirementId);
      if (requirement === undefined) {
        return NOT_COMPUTED("unavailable");
      }
      return requirement.ratio === null || requirement.learnerNodeId === null
        ? NOT_COMPUTED(requirement.status)
        : {
            status: "computed",
            location: {
              nodeId: requirement.learnerNodeId,
              memberId: null,
              memberEnd: null,
              piece: false,
            },
            value: requirement.ratio,
          };
    }
  }
}

/**
 * The verdict of one answer, by this order of tests:
 * 1. no typed value: `missing`;
 * 2. no reference value: `pending`;
 * 3. the typed value is within tolerance of the reference value: `correct`;
 * 4. there is an own-model value and the typed value is within tolerance of it:
 *    `consistent-with-own-model`;
 * 5. otherwise `incorrect`.
 * All values in the display unit; `signed` selects the comparison (`answerDifference`).
 */
export function verdictOf(
  signed: boolean,
  tolerance: Tolerance,
  typed: number | null,
  reference: number | null,
  ownModel: number | null,
): AnswerVerdict {
  if (typed === null) {
    return "missing";
  }
  if (reference === null) {
    return "pending";
  }
  if (withinTolerance(signed, tolerance, typed, reference)) {
    return "correct";
  }
  if (ownModel !== null && withinTolerance(signed, tolerance, typed, ownModel)) {
    return "consistent-with-own-model";
  }
  return "incorrect";
}

/**
 * The evidence of one answer.
 *
 * @param typed - the learner's value in the display unit, or `null`
 * @param reference - from `referenceValues`, in the display unit
 * @param own - from `ownModelValue`, in model units with the solver's sign; it is converted here as
 *   `computeAnswers` of `@bridle/tasks` converts a value: the magnitude for an unsigned answer, then
 *   times `DISPLAY_PER_MODEL_UNIT` of the answer's unit. A converted value that is not `inRange`
 *   (not finite, or beyond `VALUE_BOUND`) is not stored: the status is `out-of-range`, the value
 *   and the location are `null`, and the verdict is the one of an own model without a value.
 */
export function answerEvidence(
  answer: RequiredAnswer,
  typed: number | null,
  reference: ReferenceValue,
  own: OwnModelValue,
): AnswerEvidence {
  const { signed, tolerance } = answer;
  const converted =
    own.value === null
      ? null
      : (signed ? own.value : Math.abs(own.value)) * DISPLAY_PER_MODEL_UNIT[answer.unit];
  const outOfRange = converted !== null && !inRange(converted);
  const ownModel = outOfRange ? null : converted;
  const verdict = verdictOf(signed, tolerance, typed, reference.value, ownModel);
  const referenceAllowance =
    reference.value === null ? null : allowance(tolerance, reference.value);
  return {
    answerId: answer.id,
    kind: answer.kind,
    unit: answer.unit,
    signed,
    tolerance: { relative: tolerance.relative, absolute: tolerance.absolute },
    typed,
    referenceStatus: reference.status,
    referenceBasis: reference.basis,
    reference: reference.value,
    referenceAllowance,
    referenceDifference:
      typed === null || reference.value === null
        ? null
        : answerDifference(signed, typed, reference.value),
    ownModelStatus: outOfRange ? "out-of-range" : own.status,
    ownModelLocation: outOfRange ? null : own.location,
    ownModel,
    ownModelAllowance: ownModel === null ? null : allowance(tolerance, ownModel),
    ownModelDifference:
      typed === null || ownModel === null ? null : answerDifference(signed, typed, ownModel),
    signError:
      signed &&
      typed !== null &&
      verdict === "incorrect" &&
      verdictOf(signed, tolerance, -typed, reference.value, ownModel) !== "incorrect",
    verdict,
  };
}
