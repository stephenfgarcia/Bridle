/** Part (a) of the evidence: whether the learner's model parses, is valid and solves. */
import { type Model, type ModelIssue, type ParseResult, validateModel } from "@bridle/model";
import { type LoadCaseResult, solve } from "@bridle/solver";
import type { Task } from "@bridle/tasks";
import { matchModels } from "./matching";
import type { ModelIssueEvidence, ModelStateEvidence, ValueStatus } from "./types";

function issueEvidence(found: ModelIssue): ModelIssueEvidence {
  return { code: found.code, ids: [...found.ids], path: found.path ?? null };
}

/** The state of the learner's model with what the other parts of the evidence read from it. */
export interface ExaminedModel {
  evidence: ModelStateEvidence;
  /** The model as `parseModel` read it, or `null` when it does not parse. */
  model: Model | null;
  /** The solver's results for the task's load case, or `null`. */
  results: LoadCaseResult | null;
  /** `computed` when `results` is there; otherwise why it is not. */
  resultsStatus: Extract<
    ValueStatus,
    "computed" | "model-not-read" | "not-solved" | "no-load-case"
  >;
}

/**
 * Validates and solves the learner's model as `parseModel` read it (`parsed`), for the task's load
 * case. It does not change the task or the model.
 */
export function examineModel(task: Task, parsed: ParseResult): ExaminedModel {
  if (!parsed.ok) {
    return {
      evidence: {
        parses: false,
        parseIssues: parsed.issues.map(issueEvidence),
        valid: false,
        issues: [],
        solve: "not-run",
        unstable: null,
        unsupported: [],
        hasLoadCase: false,
      },
      model: null,
      results: null,
      resultsStatus: "model-not-read",
    };
  }
  const model = parsed.model;
  const issues = validateModel(model).map(issueEvidence);
  const hasLoadCase = model.loadCases.some((loadCase) => loadCase.id === task.loadCaseId);
  const solved = solve(model);
  const base = {
    parses: true,
    parseIssues: [],
    valid: issues.length === 0,
    issues,
  };
  if (solved.ok) {
    const results = Object.hasOwn(solved.loadCases, task.loadCaseId)
      ? (solved.loadCases[task.loadCaseId] ?? null)
      : null;
    return {
      evidence: { ...base, solve: "solved", unstable: null, unsupported: [], hasLoadCase },
      model,
      results,
      resultsStatus: results === null ? "no-load-case" : "computed",
    };
  }
  let evidence: ModelStateEvidence;
  switch (solved.reason) {
    case "invalid-model":
      evidence = { ...base, solve: "invalid-model", unstable: null, unsupported: [], hasLoadCase };
      break;
    case "not-supported-yet":
      evidence = {
        ...base,
        solve: "not-supported",
        unstable: null,
        unsupported: solved.unsupported.map((item) => ({
          memberId: item.memberId,
          feature: item.feature,
        })),
        hasLoadCase,
      };
      break;
    case "unstable":
      evidence = {
        ...base,
        solve: "unstable",
        unstable: {
          nodeId: solved.nodeId,
          dof: solved.dof,
          remaining: solved.remaining,
          referenceNodeId:
            matchModels(task.referenceModel, model).otherNodeIdOf.get(solved.nodeId) ?? null,
        },
        unsupported: [],
        hasLoadCase,
      };
      break;
    case "non-finite":
      evidence = { ...base, solve: "non-finite", unstable: null, unsupported: [], hasLoadCase };
      break;
  }
  return { evidence, model, results: null, resultsStatus: "not-solved" };
}
