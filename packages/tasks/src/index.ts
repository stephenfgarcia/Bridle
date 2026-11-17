/**
 * `@bridle/tasks`: the task format of the showcase, its validation, the generic I-sections, three
 * seeded tasks, the reference answers computed with `@bridle/solver`, and the text of the owner's
 * document `docs/content/tasks.md`. See ../README.md.
 */
export { renderTasksDocument, TASKS_DOCUMENT_PATH } from "./document";
export {
  TASK_ISSUE_CODES,
  type TaskIssue,
  type TaskIssueCode,
  type TaskIssueMessageKey,
} from "./issues";
export {
  DISPLACEMENT_TOLERANCE,
  FORCE_TOLERANCE,
  LOAD_CASE_ID,
  MOMENT_TOLERANCE,
  RATIO_TOLERANCE,
  STEEL_E_MPA,
  STEEL_FY_MPA,
  STEEL_ID,
  STRESS_TOLERANCE,
  steel,
} from "./parts";
export {
  type AnswersResult,
  allowableValue,
  type ComputedAnswer,
  computeAnswers,
  evaluateSectionChoices,
  type RequirementCheck,
  referenceAnswers,
  type SectionChoiceResult,
} from "./reference";
export {
  GENERIC_I_SECTION_DIMENSIONS,
  genericSection,
  genericSectionDimensions,
  genericSections,
  type ISectionDimensions,
  massPerMetre,
  STEEL_DENSITY,
} from "./sections";
export * from "./tasks";
export * from "./types";
export { validateTask, WEIGHT_SUM_TOLERANCE } from "./validate";
