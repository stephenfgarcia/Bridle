import { type Model, validateModel } from "@bridle/model";
import { type TaskIssue, taskIssue } from "./issues";
import {
  type AnswerSource,
  type ModelListName,
  RUBRIC_LEVELS,
  type RubricCriterion,
  type Task,
  UNIT_OF_KIND,
} from "./types";

/** How far the weights of a rubric may be from summing to 1. */
export const WEIGHT_SUM_TOLERANCE = 1e-9;

function blank(text: string): boolean {
  return text.trim() === "";
}

function duplicateIds(list: readonly { id: string }[], listName: string, issues: TaskIssue[]) {
  const seen = new Set<string>();
  list.forEach((item, index) => {
    if (seen.has(item.id)) {
      issues.push(taskIssue("duplicate-id", [item.id], `${listName}[${index}].id`));
    }
    seen.add(item.id);
  });
}

/** The ids of one list of a model; for `supports`, the node ids. */
function idsOf(model: Model, list: ModelListName): Set<string> {
  if (list === "supports") {
    return new Set(model.supports.map((support) => support.nodeId));
  }
  return new Set(model[list].map((entry) => entry.id));
}

function modelIssues(
  model: Model,
  code: "invalid-starting-model" | "invalid-reference-model",
  at: string,
  skipNoSupport: boolean,
  issues: TaskIssue[],
): void {
  for (const found of validateModel(model)) {
    if (skipNoSupport && found.code === "no-support") {
      continue;
    }
    const path = found.path === undefined ? at : `${at}.${found.path}`;
    issues.push(taskIssue(code, [found.code, ...found.ids], path));
  }
}

/** Reports the node or member of the reference model, or the requirement, that a source names and is not there. */
function sourceIssues(
  task: Task,
  answerId: string,
  source: AnswerSource,
  at: string,
  issues: TaskIssue[],
): void {
  const reference = task.referenceModel;
  switch (source.kind) {
    case "reaction":
      if (!idsOf(reference, "supports").has(source.nodeId)) {
        issues.push(taskIssue("missing-reference-part", [answerId, source.nodeId], `${at}.nodeId`));
      }
      break;
    case "displacement":
      if (!idsOf(reference, "nodes").has(source.nodeId)) {
        issues.push(taskIssue("missing-reference-part", [answerId, source.nodeId], `${at}.nodeId`));
      }
      break;
    case "member-end-force":
      if (!idsOf(reference, "members").has(source.memberId)) {
        issues.push(
          taskIssue("missing-reference-part", [answerId, source.memberId], `${at}.memberId`),
        );
      }
      break;
    case "limit-ratio":
      if (!(task.requirements ?? []).some((item) => item.id === source.requirementId)) {
        issues.push(
          taskIssue("missing-requirement", [answerId, source.requirementId], `${at}.requirementId`),
        );
      }
      break;
    case "pending":
      break;
  }
}

function criterionIssues(criterion: RubricCriterion, at: string, issues: TaskIssue[]): void {
  if (blank(criterion.name)) {
    issues.push(taskIssue("empty-text", [criterion.id], `${at}.name`));
  }
  if (!(criterion.weight > 0)) {
    issues.push(taskIssue("non-positive-weight", [criterion.id], `${at}.weight`));
  }
  const names = criterion.levels.map((entry) => entry.level);
  const ranks = names.map((name) => RUBRIC_LEVELS.indexOf(name));
  const rising = ranks.every((rank, index) => rank >= 0 && rank > (ranks[index - 1] ?? -1));
  if (
    names.length < 3 ||
    names.length > 4 ||
    !rising ||
    names[0] !== "not-shown" ||
    names[names.length - 1] !== "exemplary"
  ) {
    issues.push(taskIssue("invalid-rubric-levels", [criterion.id], `${at}.levels`));
  }
  criterion.levels.forEach((entry, index) => {
    if (blank(entry.description)) {
      issues.push(
        taskIssue("empty-text", [criterion.id, entry.level], `${at}.levels[${index}].description`),
      );
    }
  });
}

/**
 * Checks a task whose shape is already right (a `Task` value).
 *
 * @returns the issues found, in this order: the texts, the starting model, `fixed`, `sectionChoice`,
 *   `loadCaseId`, the answers, the requirements, the justification, the rubric, the reference model;
 *   an empty list for a valid task.
 *
 * Reported, with the `ids` of each issue:
 * - `empty-text`: the task's `id` or `title` is blank, `brief` or `learningOutcomes` is empty or has a
 *   blank entry, a given's `label` or `value`, an answer's `prompt`, the justification's `prompt`, a
 *   requirement's `statement`, a criterion's `name` or a level's `description` is blank (`[id]` of
 *   the entry where it has one, with the field in `path`).
 * - `duplicate-id`: an id used a second time among the answers, the requirements or the rubric's
 *   criteria, or the same list and id a second time in `fixed` (`[id]`).
 * - `missing-fixed-part`: `fixed` names an entry the starting model does not have (`[list, id]`).
 * - `missing-section-choice-part`: `sectionChoice` names a member or a section the starting model
 *   does not have, or has an empty list (`[id]`, or `[]` for an empty list).
 * - `invalid-starting-model`, `invalid-reference-model`: one per issue of `validateModel`
 *   (`[its code, ...its ids]`, `path` prefixed with `startingModel.` or `referenceModel.`). One
 *   exception: `no-support` is not reported for the starting model, because a task may ask the
 *   learner to add the supports; it is reported for the reference model.
 * - `missing-reference-part`: `loadCaseId`, an answer's source or a requirement's limit names a load
 *   case, node, supported node or member the reference model does not have (`[answer or requirement
 *   id, the id named]`; `[loadCaseId]` for the load case).
 * - `missing-requirement`: an answer's `limit-ratio` source names a requirement the task does not
 *   have (`[answerId, requirementId]`).
 * - `unit-kind-mismatch`: an answer's `unit` is not `UNIT_OF_KIND[kind]` (`[answerId]`).
 * - `non-positive-tolerance`: an answer's `tolerance.relative` or `tolerance.absolute` is not a
 *   number greater than zero; NaN is reported too (`[answerId]`, with the part in `path`).
 * - `non-positive-limit`: a requirement's `limit.length` or `limit.divisor` is not a finite number
 *   greater than zero (`[requirementId]`).
 * - `rubric-criteria-count`: the rubric has fewer than three or more than five criteria (`[]`).
 * - `non-positive-weight`: a criterion's weight is not a number greater than zero (`[criterionId]`).
 * - `rubric-weight-sum`: the weights do not sum to 1 within `WEIGHT_SUM_TOLERANCE` (`[]`).
 * - `invalid-rubric-levels`: a criterion does not have three or four levels in the order of
 *   `RUBRIC_LEVELS`, without repeats, from `not-shown` to `exemplary` (`[criterionId]`).
 *
 * It does not solve the reference model; `referenceAnswers` does, and reports a model that cannot
 * be solved.
 */
export function validateTask(task: Task): TaskIssue[] {
  const issues: TaskIssue[] = [];

  if (blank(task.id)) {
    issues.push(taskIssue("empty-text", [], "id"));
  }
  if (blank(task.title)) {
    issues.push(taskIssue("empty-text", [task.id], "title"));
  }
  for (const field of ["brief", "learningOutcomes"] as const) {
    if (task[field].length === 0) {
      issues.push(taskIssue("empty-text", [task.id], field));
    }
    task[field].forEach((text, index) => {
      if (blank(text)) {
        issues.push(taskIssue("empty-text", [task.id], `${field}[${index}]`));
      }
    });
  }
  task.givens.forEach((given, index) => {
    for (const field of ["label", "value"] as const) {
      if (blank(given[field])) {
        issues.push(taskIssue("empty-text", [task.id], `givens[${index}].${field}`));
      }
    }
  });

  modelIssues(task.startingModel, "invalid-starting-model", "startingModel", true, issues);

  const seenFixed = new Set<string>();
  task.fixed.forEach((part, index) => {
    const key = `${part.list}\u0000${part.id}`;
    if (seenFixed.has(key)) {
      issues.push(taskIssue("duplicate-id", [part.id], `fixed[${index}].id`));
    }
    seenFixed.add(key);
    if (!idsOf(task.startingModel, part.list).has(part.id)) {
      issues.push(taskIssue("missing-fixed-part", [part.list, part.id], `fixed[${index}].id`));
    }
  });

  if (task.sectionChoice !== undefined) {
    for (const [field, list] of [
      ["memberIds", "members"],
      ["sectionIds", "sections"],
    ] as const) {
      const present = idsOf(task.startingModel, list);
      const chosen = task.sectionChoice[field];
      if (chosen.length === 0) {
        issues.push(taskIssue("missing-section-choice-part", [], `sectionChoice.${field}`));
      }
      chosen.forEach((id, index) => {
        if (!present.has(id)) {
          issues.push(
            taskIssue("missing-section-choice-part", [id], `sectionChoice.${field}[${index}]`),
          );
        }
      });
    }
  }

  if (!idsOf(task.referenceModel, "loadCases").has(task.loadCaseId)) {
    issues.push(taskIssue("missing-reference-part", [task.loadCaseId], "loadCaseId"));
  }

  duplicateIds(task.answers, "answers", issues);
  task.answers.forEach((answer, index) => {
    const at = `answers[${index}]`;
    if (blank(answer.prompt)) {
      issues.push(taskIssue("empty-text", [answer.id], `${at}.prompt`));
    }
    if (answer.unit !== UNIT_OF_KIND[answer.kind]) {
      issues.push(taskIssue("unit-kind-mismatch", [answer.id], `${at}.unit`));
    }
    for (const part of ["relative", "absolute"] as const) {
      if (!(answer.tolerance[part] > 0)) {
        issues.push(taskIssue("non-positive-tolerance", [answer.id], `${at}.tolerance.${part}`));
      }
    }
    sourceIssues(task, answer.id, answer.source, `${at}.source`, issues);
  });

  const requirements = task.requirements ?? [];
  duplicateIds(requirements, "requirements", issues);
  requirements.forEach((requirement, index) => {
    const at = `requirements[${index}]`;
    if (blank(requirement.statement)) {
      issues.push(taskIssue("empty-text", [requirement.id], `${at}.statement`));
    }
    for (const field of ["length", "divisor"] as const) {
      const value = requirement.limit[field];
      if (!(Number.isFinite(value) && value > 0)) {
        issues.push(taskIssue("non-positive-limit", [requirement.id], `${at}.limit.${field}`));
      }
    }
    if (!idsOf(task.referenceModel, "nodes").has(requirement.limit.nodeId)) {
      issues.push(
        taskIssue(
          "missing-reference-part",
          [requirement.id, requirement.limit.nodeId],
          `${at}.limit.nodeId`,
        ),
      );
    }
  });

  if (task.justification !== undefined && blank(task.justification.prompt)) {
    issues.push(taskIssue("empty-text", [task.id], "justification.prompt"));
  }

  const criteria = task.rubric.criteria;
  if (criteria.length < 3 || criteria.length > 5) {
    issues.push(taskIssue("rubric-criteria-count", [], "rubric.criteria"));
  }
  duplicateIds(criteria, "rubric.criteria", issues);
  criteria.forEach((criterion, index) => {
    criterionIssues(criterion, `rubric.criteria[${index}]`, issues);
  });
  const sum = criteria.reduce((total, criterion) => total + criterion.weight, 0);
  if (!(Math.abs(sum - 1) <= WEIGHT_SUM_TOLERANCE)) {
    issues.push(taskIssue("rubric-weight-sum", [], "rubric.criteria"));
  }

  modelIssues(task.referenceModel, "invalid-reference-model", "referenceModel", false, issues);
  return issues;
}
