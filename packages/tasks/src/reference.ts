/**
 * The answers of a task computed from a model with `solve` of `@bridle/solver`. Nothing here is a
 * typed-in result: `referenceAnswers(task)` solves the task's reference model and reads each required
 * answer and each design requirement from the solver's results.
 */
import type { Model } from "@bridle/model";
import { type LoadCaseResult, type SolveResult, solve } from "@bridle/solver";
import {
  type AnswerSource,
  type DesignRequirement,
  DISPLAY_PER_MODEL_UNIT,
  type DisplayUnit,
  type Task,
} from "./types";

/** One required answer, computed or not. */
export type ComputedAnswer =
  | {
      answerId: string;
      status: "computed";
      /** In model units (kN, kN·m, m, no unit). An absolute value when the answer is not signed. */
      value: number;
      /** The same value in the answer's display unit (a displacement in mm). */
      display: number;
      unit: DisplayUnit;
    }
  /** The answer's source is the `pending` marker: no value is computed yet. */
  | { answerId: string; status: "pending"; unit: DisplayUnit; waitsFor: string[]; reason: string }
  /** The model has no result where the source points: `missingId` is the node, member or requirement. */
  | { answerId: string; status: "missing"; unit: DisplayUnit; missingId: string };

/** One design requirement checked against a model's results. */
export type RequirementCheck =
  | {
      requirementId: string;
      status: "computed";
      /** The magnitude of the limited translation, in m. */
      value: number;
      /** `limit.length / limit.divisor`, in m. */
      allowable: number;
      /** `value / allowable`. */
      ratio: number;
      /** `value <= allowable`. */
      satisfied: boolean;
    }
  /** The model has no node `missingId`. */
  | { requirementId: string; status: "missing"; missingId: string };

export type AnswersResult =
  | { ok: true; answers: ComputedAnswer[]; requirements: RequirementCheck[] }
  /** `solve` refused the model; `solve` is its refusal (invalid, not supported yet, unstable, non-finite). */
  | { ok: false; reason: "not-solved"; solve: Exclude<SolveResult, { ok: true }> }
  /** The model has no load case with the task's `loadCaseId`. */
  | { ok: false; reason: "missing-load-case"; loadCaseId: string };

/** The allowable value of a requirement's limit, in m: `length / divisor`. */
export function allowableValue(requirement: DesignRequirement): number {
  return requirement.limit.length / requirement.limit.divisor;
}

function checkRequirement(
  requirement: DesignRequirement,
  results: LoadCaseResult,
): RequirementCheck {
  const displacement = results.displacements[requirement.limit.nodeId];
  if (displacement === undefined) {
    return {
      requirementId: requirement.id,
      status: "missing",
      missingId: requirement.limit.nodeId,
    };
  }
  const value = Math.abs(displacement[requirement.limit.component]);
  const allowable = allowableValue(requirement);
  return {
    requirementId: requirement.id,
    status: "computed",
    value,
    allowable,
    ratio: value / allowable,
    satisfied: value <= allowable,
  };
}

/** The value a source points at, or the id that has no result. */
function sourceValue(
  source: Exclude<AnswerSource, { kind: "pending" }>,
  results: LoadCaseResult,
  checks: readonly RequirementCheck[],
): { value: number } | { missingId: string } {
  switch (source.kind) {
    case "reaction": {
      const reaction = results.reactions[source.nodeId];
      return reaction === undefined
        ? { missingId: source.nodeId }
        : { value: reaction[source.component] };
    }
    case "displacement": {
      const displacement = results.displacements[source.nodeId];
      return displacement === undefined
        ? { missingId: source.nodeId }
        : { value: displacement[source.component] };
    }
    case "member-end-force": {
      const ends = results.memberEndForces[source.memberId];
      return ends === undefined
        ? { missingId: source.memberId }
        : { value: ends[source.end][source.component] };
    }
    case "limit-ratio": {
      const check = checks.find((item) => item.requirementId === source.requirementId);
      return check === undefined || check.status === "missing"
        ? { missingId: source.requirementId }
        : { value: check.ratio };
    }
  }
}

/**
 * Solves `model` and reads the task's required answers and design requirements from the results of
 * the task's load case. The sources name nodes and members by the ids of the reference model, so the
 * model must use those ids where an answer is read; an answer whose node or member the model lacks
 * comes back with `status: "missing"`.
 *
 * It does not change the task or the model.
 */
export function computeAnswers(task: Task, model: Model): AnswersResult {
  const solved = solve(model);
  if (!solved.ok) {
    return { ok: false, reason: "not-solved", solve: solved };
  }
  const results = solved.loadCases[task.loadCaseId];
  if (results === undefined) {
    return { ok: false, reason: "missing-load-case", loadCaseId: task.loadCaseId };
  }
  const requirements = (task.requirements ?? []).map((requirement) =>
    checkRequirement(requirement, results),
  );
  const answers = task.answers.map((answer): ComputedAnswer => {
    const { id: answerId, unit, source } = answer;
    if (source.kind === "pending") {
      return {
        answerId,
        status: "pending",
        unit,
        waitsFor: [...source.waitsFor],
        reason: source.reason,
      };
    }
    const found = sourceValue(source, results, requirements);
    if ("missingId" in found) {
      return { answerId, status: "missing", unit, missingId: found.missingId };
    }
    const value = answer.signed ? found.value : Math.abs(found.value);
    return {
      answerId,
      status: "computed",
      value,
      display: value * DISPLAY_PER_MODEL_UNIT[unit],
      unit,
    };
  });
  return { ok: true, answers, requirements };
}

/** `computeAnswers` for the task's own reference model. */
export function referenceAnswers(task: Task): AnswersResult {
  return computeAnswers(task, task.referenceModel);
}

/** One section of a task's `sectionChoice`, tried on the reference model. */
export interface SectionChoiceResult {
  sectionId: string;
  /** The section's mass per metre, kg/m: its area times the density of the member's material. */
  massPerMetre: number;
  /** The task's requirements with this section on the chosen members. */
  requirements: RequirementCheck[];
  /** Every requirement is computed and satisfied. */
  satisfied: boolean;
  /** This is the section the reference model uses. */
  reference: boolean;
}

/**
 * Tries each section of the task's `sectionChoice` on a copy of the reference model (all the chosen
 * members get that section) and checks the design requirements.
 *
 * @returns one entry per section in the order of `sectionChoice.sectionIds`; an empty list for a
 *   task without `sectionChoice`. A section the reference model lacks, or one with which the model
 *   cannot be solved, gets no requirement checks and `satisfied: false`.
 */
export function evaluateSectionChoices(task: Task): SectionChoiceResult[] {
  const choice = task.sectionChoice;
  if (choice === undefined) {
    return [];
  }
  const chosen = new Set(choice.memberIds);
  const referenceSections = new Set(
    task.referenceModel.members
      .filter((member) => chosen.has(member.id))
      .map((member) => member.sectionId),
  );
  return choice.sectionIds.map((sectionId) => {
    const section = task.referenceModel.sections.find((item) => item.id === sectionId);
    const model: Model = {
      ...task.referenceModel,
      members: task.referenceModel.members.map((member) =>
        chosen.has(member.id) ? { ...member, sectionId } : member,
      ),
    };
    const first = model.members.find((member) => chosen.has(member.id));
    const density =
      model.materials.find((material) => material.id === first?.materialId)?.density ?? 0;
    const result = section === undefined ? undefined : computeAnswers(task, model);
    const requirements = result?.ok ? result.requirements : [];
    return {
      sectionId,
      massPerMetre: (section?.A ?? 0) * density,
      requirements,
      satisfied:
        result?.ok === true &&
        requirements.every((check) => check.status === "computed" && check.satisfied),
      reference: referenceSections.size === 1 && referenceSections.has(sectionId),
    };
  });
}
