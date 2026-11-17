/** Builders the tests of this package share. Not exported by the package. */
import type { Model, Support } from "@bridle/model";
import { computeAnswers, referenceAnswers, type Task } from "@bridle/tasks";
import type { AnswerEvidence, Evidence, Submission } from "./types";

/** A deep copy of plain data. */
export function copy<T>(value: T): T {
  return structuredClone(value);
}

/** The computed answers of `computeAnswers(task, model)` in display units, by answer id. */
export function computedValues(task: Task, model: Model): Record<string, number> {
  const result = computeAnswers(task, model);
  if (!result.ok) {
    throw new Error(`computedValues: the model does not solve (${result.reason})`);
  }
  const values: Record<string, number> = {};
  for (const answer of result.answers) {
    if (answer.status === "computed") {
      values[answer.answerId] = answer.display;
    }
  }
  return values;
}

/** The reference answers of a task in display units, by answer id (the pending one left out). */
export function referenceValuesOf(task: Task): Record<string, number> {
  const result = referenceAnswers(task);
  if (!result.ok) {
    throw new Error("referenceValuesOf: the reference model does not solve");
  }
  return computedValues(task, task.referenceModel);
}

/** A submission of `model` with `answers`, a justification and a fixed time. */
export function submissionOf(
  task: Task,
  model: Model,
  answers: Record<string, number | null>,
): Submission {
  return {
    taskId: task.id,
    model,
    answers,
    justification: "Checked by hand.",
    submittedAt: "2026-12-01T09:30:00Z",
  };
}

/** The reference model submitted with the reference answers. */
export function referenceSubmission(task: Task): Submission {
  return submissionOf(task, copy(task.referenceModel), referenceValuesOf(task));
}

type Restraint = "ux" | "uy" | "uz" | "rx" | "ry" | "rz";

/** A support on `nodeId` that restrains the listed degrees of freedom and no other. */
export function supportOn(nodeId: string, restrained: readonly Restraint[]): Support {
  const has = (key: Restraint) => restrained.includes(key);
  return {
    nodeId,
    ux: has("ux"),
    uy: has("uy"),
    uz: has("uz"),
    rx: has("rx"),
    ry: has("ry"),
    rz: has("rz"),
  };
}

/**
 * A copy of `model` in which the member `memberId` has the id `newId` and, with `reverse`, runs
 * from its end node to its start node. The member loads that named it name the new id.
 */
export function redrawMember(
  model: Model,
  memberId: string,
  newId: string,
  reverse: boolean,
): Model {
  const next = copy(model);
  next.members = next.members.map((member) =>
    member.id !== memberId
      ? member
      : {
          ...member,
          id: newId,
          startNodeId: reverse ? member.endNodeId : member.startNodeId,
          endNodeId: reverse ? member.startNodeId : member.endNodeId,
        },
  );
  for (const load of [...next.memberUniformLoads, ...next.memberPointLoads]) {
    if (load.memberId === memberId) {
      load.memberId = newId;
    }
  }
  return next;
}

/**
 * A copy of `model` in which every node has a new id (`n1`, `n2`, ... in the model's order);
 * members, supports and nodal loads name the new ids.
 */
export function renameNodes(model: Model): Model {
  const next = copy(model);
  const newId = new Map(next.nodes.map((node, index) => [node.id, `n${index + 1}`]));
  const renamed = (id: string) => newId.get(id) ?? id;
  for (const node of next.nodes) {
    node.id = renamed(node.id);
  }
  for (const member of next.members) {
    member.startNodeId = renamed(member.startNodeId);
    member.endNodeId = renamed(member.endNodeId);
  }
  for (const support of next.supports) {
    support.nodeId = renamed(support.nodeId);
  }
  for (const load of next.nodalLoads) {
    load.nodeId = renamed(load.nodeId);
  }
  return next;
}

/** The evidence of the answer `answerId`; the test fails when there is none. */
export function answerOf(evidence: Evidence, answerId: string): AnswerEvidence {
  const found = evidence.answers.find((answer) => answer.answerId === answerId);
  if (found === undefined) {
    throw new Error(`answerOf: no answer ${answerId}`);
  }
  return found;
}

/** The verdicts of an evidence by answer id. */
export function verdictsOf(evidence: Evidence): Record<string, string> {
  return Object.fromEntries(evidence.answers.map((answer) => [answer.answerId, answer.verdict]));
}
