import { seededTasks, simplySupportedBeamTask } from "@bridle/tasks";
import { describe, expect, test } from "vitest";
import { isUtcTime, readSubmission, validateSubmission } from "./submission";
import { copy, referenceSubmission } from "./testSupport";

const task = simplySupportedBeamTask();

describe("validateSubmission", () => {
  test("the reference submission of each task has no issue", () => {
    for (const each of seededTasks()) {
      expect(validateSubmission(each, referenceSubmission(each))).toEqual([]);
    }
  });

  test("an answer that is null or has no key is accepted", () => {
    const submission = referenceSubmission(task);
    submission.answers = { "reaction-a": null };
    expect(validateSubmission(task, submission)).toEqual([]);
  });

  test("a wrong task id", () => {
    const submission = { ...referenceSubmission(task), taskId: "portal-frame-wind-gravity" };
    expect(validateSubmission(task, submission)).toEqual([
      {
        code: "wrong-task-id",
        ids: ["portal-frame-wind-gravity", "simply-supported-beam"],
        path: "taskId",
      },
    ]);
  });

  test("an answer id the task does not have", () => {
    const submission = referenceSubmission(task);
    submission.answers["reaction-z"] = 3;
    expect(validateSubmission(task, submission)).toEqual([
      { code: "unknown-answer-id", ids: ["reaction-z"], path: "answers.reaction-z" },
    ]);
  });

  test("a number that is not finite", () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const submission = referenceSubmission(task);
      submission.answers["max-moment"] = value;
      expect(validateSubmission(task, submission)).toEqual([
        { code: "non-finite-answer", ids: ["max-moment"], path: "answers.max-moment" },
      ]);
    }
  });

  test("a model that does not parse: one issue per issue of parseModel, with its path", () => {
    const submission = referenceSubmission(task);
    const model = copy(submission.model) as unknown as Record<string, unknown>;
    delete model.supports;
    (model.nodes as { x: unknown }[])[0] = { id: "A", x: "0", y: 0, z: 0 } as never;
    expect(validateSubmission(task, { ...submission, model })).toEqual([
      { code: "invalid-model", ids: ["invalid-shape"], path: "model.nodes[0].x" },
      { code: "invalid-model", ids: ["invalid-shape"], path: "model.supports" },
    ]);
  });

  test("a model with a number that is not finite does not parse", () => {
    const submission = referenceSubmission(task);
    (submission.model.nodes[1] as { x: number }).x = Number.NaN;
    expect(validateSubmission(task, submission)).toEqual([
      { code: "invalid-model", ids: ["invalid-shape"], path: "model.nodes[1].x" },
    ]);
  });

  test("a missing model, and a model of another version", () => {
    const { model: _model, ...rest } = referenceSubmission(task);
    expect(validateSubmission(task, rest)).toEqual([
      { code: "invalid-model", ids: ["invalid-json"], path: "model" },
    ]);
    const other = { ...referenceSubmission(task).model, version: 2 };
    expect(validateSubmission(task, { ...rest, model: other })).toEqual([
      { code: "invalid-model", ids: ["unsupported-version"], path: "model.version" },
    ]);
  });

  test("a model that parses and is not valid is not an issue of the submission", () => {
    const submission = referenceSubmission(task);
    submission.model.supports = [];
    expect(validateSubmission(task, submission)).toEqual([]);
  });

  test("wrong shapes", () => {
    expect(validateSubmission(task, null)).toEqual([{ code: "invalid-shape", ids: [], path: "" }]);
    expect(validateSubmission(task, [])).toEqual([{ code: "invalid-shape", ids: [], path: "" }]);
    const submission = referenceSubmission(task);
    const broken = {
      taskId: 7,
      model: submission.model,
      answers: { "reaction-a": "45", "reaction-b": 45 },
      justification: null,
      submittedAt: 0,
    };
    expect(validateSubmission(task, broken)).toEqual([
      { code: "invalid-shape", ids: [], path: "taskId" },
      { code: "invalid-shape", ids: [], path: "answers.reaction-a" },
      { code: "invalid-shape", ids: [], path: "justification" },
      { code: "invalid-shape", ids: [], path: "submittedAt" },
    ]);
    expect(validateSubmission(task, { ...submission, answers: [1, 2] })).toEqual([
      { code: "invalid-shape", ids: [], path: "answers" },
    ]);
  });

  test("the issues come in a fixed order, the answers by key", () => {
    const submission = {
      ...referenceSubmission(task),
      taskId: "other",
      answers: { zeta: 1, "max-moment": Number.NaN, alpha: Number.POSITIVE_INFINITY },
      submittedAt: "yesterday",
    };
    expect(
      validateSubmission(task, submission).map((issue) => `${issue.code} ${issue.path}`),
    ).toEqual([
      "wrong-task-id taskId",
      "unknown-answer-id answers.alpha",
      "non-finite-answer answers.alpha",
      "non-finite-answer answers.max-moment",
      "unknown-answer-id answers.zeta",
      "invalid-time submittedAt",
    ]);
  });

  test("the time", () => {
    for (const time of [
      "2026-12-01T09:30:00Z",
      "2026-12-01T09:30:00.123Z",
      "2028-02-29T23:59:59Z",
      "2000-02-29T00:00:00Z",
    ]) {
      expect(isUtcTime(time)).toBe(true);
    }
    for (const time of [
      "",
      "2026-12-01",
      "2026-12-01T09:30:00",
      "2026-12-01T09:30:00+08:00",
      "2026-12-01 09:30:00Z",
      "2026-13-01T09:30:00Z",
      "2026-00-10T09:30:00Z",
      "2026-02-29T09:30:00Z",
      "2100-02-29T09:30:00Z",
      "2026-04-31T09:30:00Z",
      "2026-12-01T24:00:00Z",
      "2026-12-01T09:60:00Z",
      "2026-12-01T09:30:60Z",
    ]) {
      expect(isUtcTime(time)).toBe(false);
      expect(validateSubmission(task, { ...referenceSubmission(task), submittedAt: time })).toEqual(
        [{ code: "invalid-time", ids: [], path: "submittedAt" }],
      );
    }
  });
});

describe("readSubmission", () => {
  test("reads the typed values, and null for what is not a finite number", () => {
    const read = readSubmission({
      taskId: "t",
      answers: { a: 1.5, b: null, c: Number.NaN, d: "2", constructor: 3 },
      justification: "  ",
    });
    expect(read.taskId).toBe("t");
    expect(read.typed("a")).toBe(1.5);
    expect(read.typed("b")).toBeNull();
    expect(read.typed("c")).toBeNull();
    expect(read.typed("d")).toBeNull();
    expect(read.typed("constructor")).toBe(3);
    expect(read.typed("toString")).toBeNull();
    expect(read.typed("absent")).toBeNull();
    expect(read.model.ok).toBe(false);
  });

  test("does not throw for any shape", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    for (const value of [undefined, null, 3, "x", [], { model: cyclic }, { answers: 5 }]) {
      const read = readSubmission(value);
      expect(read.taskId).toBe("");
      expect(read.justification).toBe("");
      expect(read.model.ok).toBe(false);
      expect(read.typed("a")).toBeNull();
    }
  });
});
