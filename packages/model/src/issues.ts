/**
 * The issues `validateModel` and `parseModel` report. A code is stable: later cards and the interface
 * match on it. Nothing here is text for a user; `messageKey` is the id the message catalog
 * (`packages/i18n`) will hold the text under.
 */

/** The codes `validateModel` reports. */
export const VALIDATION_ISSUE_CODES = [
  "duplicate-id",
  "duplicate-support",
  "missing-node",
  "missing-section",
  "missing-material",
  "missing-member",
  "missing-load-case",
  "zero-length-member",
  "non-positive-value",
  "load-position-outside-member",
  "no-support",
] as const;

/** The codes `parseModel` reports. */
export const PARSE_ISSUE_CODES = [
  "invalid-json",
  "invalid-shape",
  "unsupported-version",
  "unsupported-units",
] as const;

export type ValidationIssueCode = (typeof VALIDATION_ISSUE_CODES)[number];
export type ParseIssueCode = (typeof PARSE_ISSUE_CODES)[number];
export type IssueCode = ValidationIssueCode | ParseIssueCode;

/** The message catalog id of a code: `model.issue.` followed by the code. */
export type IssueMessageKey = `model.issue.${IssueCode}`;

export interface ModelIssue {
  code: IssueCode;
  messageKey: IssueMessageKey;
  /**
   * The ids the issue concerns: first the entry that has the problem (for a support, its node id),
   * then the id it names, if any. Empty when the issue belongs to no entry (`no-support`, and the
   * issues of `parseModel`).
   */
  ids: string[];
  /** Where in the model the issue is, for example `sections[0].A`. Absent for `no-support` and `invalid-json`. */
  path?: string;
}

export function issue(code: IssueCode, ids: string[], path?: string): ModelIssue {
  const base = { code, messageKey: `model.issue.${code}` as const, ids };
  return path === undefined ? base : { ...base, path };
}
