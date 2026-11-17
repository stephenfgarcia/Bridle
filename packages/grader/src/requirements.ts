/** Part (f) of the evidence: the task's design requirements evaluated on the learner's model. */
import { allowableValue, DISPLAY_PER_MODEL_UNIT, type Task } from "@bridle/tasks";
import type { ModelMatch } from "./matching";
import type { ExaminedModel } from "./modelState";
import { allInRange } from "./range";
import type { RequirementEvidence } from "./types";

/** The factor from metres to the unit the requirements are reported in, mm. */
export const MM_PER_M = DISPLAY_PER_MODEL_UNIT.mm;

/**
 * Evaluates each design requirement of the task on the learner's model: the magnitude of the
 * limited translation of the learner's node at the position of the requirement's node (`match`),
 * against `allowableValue` of `@bridle/tasks`. The ratio and `satisfied` are computed in metres, as
 * `@bridle/tasks` does; `value` and `allowable` are then given in mm. A value in mm or a ratio that
 * is not `inRange` (not finite, or beyond `VALUE_BOUND`) gives the status `out-of-range` and no
 * value, ratio or `satisfied`.
 *
 * @param match - the matching of the learner's model to the reference, or `null` when the model
 *   does not parse
 */
export function evaluateRequirements(
  task: Task,
  match: ModelMatch | null,
  examined: Pick<ExaminedModel, "results" | "resultsStatus">,
): RequirementEvidence[] {
  return (task.requirements ?? []).map((requirement): RequirementEvidence => {
    const { limit } = requirement;
    const allowable = allowableValue(requirement);
    const node = match?.nodes.get(limit.nodeId);
    const base = {
      requirementId: requirement.id,
      quantity: limit.quantity,
      referenceNodeId: limit.nodeId,
      learnerNodeId: node?.id ?? null,
      component: limit.component,
    };
    const without = (status: RequirementEvidence["status"]): RequirementEvidence => ({
      ...base,
      status,
      unit: "mm",
      value: null,
      allowable: allowable * MM_PER_M,
      ratio: null,
      satisfied: null,
    });
    if (examined.results === null) {
      return without(examined.resultsStatus === "computed" ? "not-solved" : examined.resultsStatus);
    }
    if (node === undefined || !Object.hasOwn(examined.results.displacements, node.id)) {
      return without("node-not-found");
    }
    const displacement = examined.results.displacements[node.id];
    if (displacement === undefined) {
      return without("node-not-found");
    }
    const value = Math.abs(displacement[limit.component]);
    if (!allInRange([value * MM_PER_M, value / allowable])) {
      return without("out-of-range");
    }
    return {
      ...base,
      status: "computed",
      unit: "mm",
      value: value * MM_PER_M,
      allowable: allowable * MM_PER_M,
      ratio: value / allowable,
      satisfied: value <= allowable,
    };
  });
}
