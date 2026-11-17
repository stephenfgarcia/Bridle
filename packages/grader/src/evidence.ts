/** `buildEvidence`: the parts of the evidence put together. */
import type { Task } from "@bridle/tasks";
import { answerEvidence, ownModelValue, referenceValues } from "./answers";
import { compareFixedParts } from "./fixedParts";
import { compareLoads, hasAppliedLoad } from "./loads";
import { matchingEvidence, matchModels } from "./matching";
import { examineModel } from "./modelState";
import { evaluateRequirements } from "./requirements";
import { chosenSection, sectionChoiceEvidence } from "./sectionChoice";
import { readSubmission, validateSubmission } from "./submission";
import { compareSupports } from "./supports";
import { EVIDENCE_VERSION, type Evidence, type Submission } from "./types";

/**
 * A copy of plain data with every negative zero replaced by zero, the key order kept. A product
 * such as −15 × 0 is −0, which `JSON.stringify` writes as `0`; without this the evidence would not
 * be equal to its own JSON copy.
 */
export function withoutNegativeZero<T>(value: T): T {
  if (typeof value === "number") {
    return (value === 0 ? 0 : value) as T;
  }
  if (Array.isArray(value)) {
    return value.map(withoutNegativeZero) as T;
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, withoutNegativeZero(item)]),
    ) as T;
  }
  return value;
}

/**
 * Builds the evidence of a submission against a task: what the learner's model is, how it differs
 * from the reference, and how each typed answer compares, as plain data (`Evidence` in ./types.ts).
 *
 * It is a pure function of its two arguments: no clock, no random number, no state. It changes
 * neither argument. It does not throw for a submission of the wrong shape: what cannot be read is
 * reported in `submission.issues`, and a model that does not parse leaves the parts that need one
 * `null`. The submission's time is only checked for its form (`submission.issues`).
 *
 * Steps: `validateSubmission`; `parseModel`, `validateModel` and `solve` on the learner's model
 * (part a); the matching of its nodes and members to the reference by position; then the fixed
 * parts (b), the supports (c), the loads (d), the requirements (f), the section choice (g) and the
 * answers (e), which use (f) and (g).
 */
export function buildEvidence(task: Task, submission: Submission): Evidence {
  const read = readSubmission(submission);
  const examined = examineModel(task, read.model);
  const learner = examined.model;
  const match = learner === null ? null : matchModels(task.referenceModel, learner);
  const requirements = evaluateRequirements(task, match, examined);
  const chosen = chosenSection(task, match);
  const sectionChoice = chosen === undefined ? null : sectionChoiceEvidence(task, chosen);
  const reference = referenceValues(
    task,
    sectionChoice?.allowed === true ? sectionChoice.chosenSectionId : null,
  );
  const loaded = learner !== null && hasAppliedLoad(learner, task.loadCaseId);
  const evidence: Evidence = {
    version: EVIDENCE_VERSION,
    taskId: task.id,
    submission: {
      taskId: read.taskId,
      taskIdMatches: read.taskId === task.id,
      justificationPresent: read.justification.trim() !== "",
      issues: validateSubmission(task, submission),
    },
    model: examined.evidence,
    matching: learner === null || match === null ? null : matchingEvidence(task, learner, match),
    fixedParts: learner === null ? null : compareFixedParts(task, learner),
    supports:
      learner === null || match === null
        ? null
        : compareSupports(task.referenceModel, learner, match),
    loads:
      learner === null || match === null
        ? null
        : compareLoads(task.referenceModel, learner, match, task.loadCaseId),
    answers: task.answers.map((answer) =>
      answerEvidence(
        answer,
        read.typed(answer.id),
        reference(answer.id),
        ownModelValue(task, answer, match, examined, requirements, loaded),
      ),
    ),
    requirements,
    sectionChoice,
  };
  return withoutNegativeZero(evidence);
}
