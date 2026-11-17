/**
 * `@bridle/grader`: the submission of the showcase and the evidence computed from it (pitch card
 * T6, `docs/plan/pitch-plan.md`). The evidence compares a learner's model and typed answers with
 * the task's reference, deterministically, with `@bridle/solver`. See ../README.md.
 */
export {
  allowance,
  answerDifference,
  answerEvidence,
  type FoundMemberEnd,
  findMemberEnd,
  memberEndComponent,
  type OwnModelValue,
  ownModelValue,
  type ReferenceValue,
  referenceValues,
  verdictOf,
  withinTolerance,
} from "./answers";
export { buildEvidence, withoutNegativeZero } from "./evidence";
export { compareFixedParts } from "./fixedParts";
export {
  compareLoads,
  compareResultants,
  hasAppliedLoad,
  loadAllowance,
  type OutOfRangeLoad,
  type ResolvedLoad,
  resolveLoads,
  resultantOf,
} from "./loads";
export {
  type MatchedMember,
  type ModelMatch,
  matchingEvidence,
  matchModels,
  memberDifferences,
} from "./matching";
export { type ExaminedModel, examineModel } from "./modelState";
export { allInRange, inRange, nonFinitePaths } from "./range";
export { evaluateRequirements } from "./requirements";
export {
  type ChosenSection,
  chosenSection,
  sectionChoiceEvidence,
  sectionOptions,
} from "./sectionChoice";
export {
  isUtcTime,
  parseSubmittedModel,
  type ReadSubmission,
  readSubmission,
  validateSubmission,
} from "./submission";
export { summarizeEvidence } from "./summary";
export { compareSupports, modelPlane, OUT_OF_PLANE_DOFS } from "./supports";
export * from "./types";
