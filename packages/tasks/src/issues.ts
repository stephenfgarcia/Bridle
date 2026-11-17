/**
 * The issues `validateTask` reports, in the pattern of `@bridle/model`'s issues: a stable `code`, a
 * `messageKey` for the message catalog (`packages/i18n` does not hold these keys yet), the `ids`
 * concerned and a `path` into the task. Nothing here is text for a user.
 */

export const TASK_ISSUE_CODES = [
  "empty-text",
  "duplicate-id",
  "missing-fixed-part",
  "missing-section-choice-part",
  "invalid-starting-model",
  "invalid-reference-model",
  "missing-reference-part",
  "missing-requirement",
  "unit-kind-mismatch",
  "non-positive-tolerance",
  "non-positive-limit",
  "rubric-criteria-count",
  "non-positive-weight",
  "rubric-weight-sum",
  "invalid-rubric-levels",
] as const;

export type TaskIssueCode = (typeof TASK_ISSUE_CODES)[number];

/** The message catalog id of a code: `task.issue.` followed by the code. */
export type TaskIssueMessageKey = `task.issue.${TaskIssueCode}`;

export interface TaskIssue {
  code: TaskIssueCode;
  messageKey: TaskIssueMessageKey;
  /**
   * The ids the issue concerns: first the entry that has the problem, then the id it names, if any.
   * For `invalid-starting-model` and `invalid-reference-model`: the code of the issue `validateModel`
   * reported, then that issue's ids.
   */
  ids: string[];
  /** Where in the task the issue is, for example `answers[2].tolerance.relative`. */
  path?: string;
}

export function taskIssue(code: TaskIssueCode, ids: string[], path?: string): TaskIssue {
  const base = { code, messageKey: `task.issue.${code}` as const, ids };
  return path === undefined ? base : { ...base, path };
}
