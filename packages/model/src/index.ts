/**
 * `@bridle/model`: the types of a structural model, its validation, its JSON format and three
 * fixture models. Conventions (axes, units, member local axes) are in ../README.md and ./types.ts.
 */
export * from "./fixtures";
export {
  distance,
  type LocalAxes,
  memberLocalAxes,
  VERTICAL_TOLERANCE,
  type Vec3,
  ZERO_LENGTH_TOLERANCE,
} from "./geometry";
export {
  type IssueCode,
  type IssueMessageKey,
  type ModelIssue,
  PARSE_ISSUE_CODES,
  type ParseIssueCode,
  VALIDATION_ISSUE_CODES,
  type ValidationIssueCode,
} from "./issues";
export { emptyModel, type ParseResult, parseModel, serializeModel } from "./json";
export * from "./types";
export { POSITION_TOLERANCE, validateModel } from "./validate";
