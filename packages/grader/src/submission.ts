/** Reading and checking a submission. */
import { type ModelIssue, type ParseResult, parseModel } from "@bridle/model";
import type { Task } from "@bridle/tasks";
import type { SubmissionIssue, SubmissionIssueCode } from "./types";

/** `YYYY-MM-DDTHH:MM:SSZ`, with optional decimals of a second. */
const UTC_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?Z$/;

/**
 * Whether `text` is a UTC time of the form `YYYY-MM-DDTHH:MM:SSZ` (decimals of a second allowed)
 * with a month from 01 to 12, a day that month has (29 February in leap years only), an hour up to
 * 23 and minutes and seconds up to 59. It uses no clock and no `Date`.
 */
export function isUtcTime(text: string): boolean {
  const parts = UTC_TIME.exec(text);
  if (parts === null) {
    return false;
  }
  const [year, month, day, hour, minute, second] = parts.slice(1, 7).map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return (
    days !== undefined && day >= 1 && day <= days && hour <= 23 && minute <= 59 && second <= 59
  );
}

function issue(code: SubmissionIssueCode, ids: string[], path: string): SubmissionIssue {
  return { code, ids, path };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reads a model of unknown shape with `parseModel`, through its JSON text. A value that has no JSON
 * text (`undefined`, a function, an object that refers to itself) gives `invalid-json`.
 */
export function parseSubmittedModel(model: unknown): ParseResult {
  let text: string | undefined;
  try {
    text = JSON.stringify(model);
  } catch {
    text = undefined;
  }
  return parseModel(text ?? "");
}

/** A submission of unknown shape, read without trusting any of it. */
export interface ReadSubmission {
  /** The task id, or an empty string when it is not a string. */
  taskId: string;
  /** The model as `parseModel` read it. */
  model: ParseResult;
  /** The typed value of an answer id: a finite number, or `null`. */
  typed: (answerId: string) => number | null;
  /** The justification, or an empty string when it is not a string. */
  justification: string;
}

/** Reads what `buildEvidence` needs from a submission, whatever its shape. It never throws. */
export function readSubmission(submission: unknown): ReadSubmission {
  const source = isObject(submission) ? submission : {};
  const answers = isObject(source.answers) ? source.answers : {};
  return {
    taskId: typeof source.taskId === "string" ? source.taskId : "",
    model: parseSubmittedModel(source.model),
    typed: (answerId) => {
      const value = Object.hasOwn(answers, answerId) ? answers[answerId] : null;
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    },
    justification: typeof source.justification === "string" ? source.justification : "",
  };
}

function modelIssuePath(found: ModelIssue): string {
  return found.path === undefined || found.path === "" ? "model" : `model.${found.path}`;
}

/**
 * Checks a submission against its task.
 *
 * @returns the issues found, in this order: the task id, the answers by key (keys sorted by code
 *   unit), the model, the justification, the time; an empty list for a valid submission.
 *
 * - `invalid-shape`: the submission is not an object; `taskId`, `justification` or `submittedAt` is
 *   not a string; `answers` is not an object; or an answer is neither a number nor `null`.
 * - `wrong-task-id`: `taskId` is a string other than the task's id (`[the submission's, the task's]`).
 * - `unknown-answer-id`: `answers` has a key that is not the id of an answer of the task (`[key]`).
 * - `non-finite-answer`: an answer is `NaN`, `Infinity` or `-Infinity` (`[key]`).
 * - `invalid-model`: `parseModel` does not accept the model; one issue per issue of `parseModel`
 *   (`[its code]`, with its path after `model.`).
 * - `invalid-time`: `submittedAt` is a string that `isUtcTime` does not accept.
 *
 * It does not run `validateModel`: a model that parses and is not valid (no support, say) is a
 * submission a learner can make, and the evidence reports its state.
 */
export function validateSubmission(task: Task, submission: unknown): SubmissionIssue[] {
  if (!isObject(submission)) {
    return [issue("invalid-shape", [], "")];
  }
  const issues: SubmissionIssue[] = [];

  if (typeof submission.taskId !== "string") {
    issues.push(issue("invalid-shape", [], "taskId"));
  } else if (submission.taskId !== task.id) {
    issues.push(issue("wrong-task-id", [submission.taskId, task.id], "taskId"));
  }

  const answers = submission.answers;
  if (!isObject(answers)) {
    issues.push(issue("invalid-shape", [], "answers"));
  } else {
    const known = new Set(task.answers.map((answer) => answer.id));
    for (const key of Object.keys(answers).sort()) {
      const value = answers[key];
      const path = `answers.${key}`;
      if (!known.has(key)) {
        issues.push(issue("unknown-answer-id", [key], path));
      }
      if (typeof value === "number") {
        if (!Number.isFinite(value)) {
          issues.push(issue("non-finite-answer", [key], path));
        }
      } else if (value !== null) {
        issues.push(issue("invalid-shape", [], path));
      }
    }
  }

  const parsed = parseSubmittedModel(submission.model);
  if (!parsed.ok) {
    for (const found of parsed.issues) {
      issues.push(issue("invalid-model", [found.code], modelIssuePath(found)));
    }
  }

  if (typeof submission.justification !== "string") {
    issues.push(issue("invalid-shape", [], "justification"));
  }

  const time = submission.submittedAt;
  if (typeof time !== "string") {
    issues.push(issue("invalid-shape", [], "submittedAt"));
  } else if (!isUtcTime(time)) {
    issues.push(issue("invalid-time", [], "submittedAt"));
  }
  return issues;
}
