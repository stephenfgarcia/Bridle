/**
 * From the state of the live analysis to what the status area says (card PX-02.8). Pure: the component
 * ./AnalysisStatus.tsx only renders this.
 */
import type { MessageId } from "@bridle/i18n";
import type { Model } from "@bridle/model";
import type { Dof, UnsupportedFeature, UnsupportedMember } from "@bridle/solver";
import type { SolverFailure } from "@bridle/solver/client";
import { restrainOutOfPlane } from "../tools/supportLoadTools";
import type { AnalysisState } from "./analysisState";

/**
 * Below this smallest pivot ratio the status area warns that the result may have lost accuracy. The solver
 * refuses a model as unstable at 1e-12 (`PIVOT_THRESHOLD`); a ratio r leaves a relative rounding error of the
 * order of 2.2e-16 / r in a pivot (packages/solver/README.md, "The smallest pivot ratio").
 */
export const PIVOT_WARNING = 1e-9;

/** The members the solver does not analyse yet, for one feature. */
export interface UnsupportedGroup {
  feature: UnsupportedFeature;
  /** In the order the solver listed them, each id once. */
  memberIds: string[];
}

export type AnalysisStatus =
  /** The model on screen was sent, or is about to be; `stale` when an earlier result is still shown. */
  | { kind: "analysing"; stale: boolean }
  | {
      kind: "analysed";
      /** From sending the model to the answer, in ms. */
      ms: number;
      smallestPivotRatio: number;
      /** `smallestPivotRatio` is below `PIVOT_WARNING`. */
      lostAccuracy: boolean;
    }
  /** `validateModel` reports issues: the model is not analysed. */
  | { kind: "issues"; count: number }
  | {
      kind: "unstable";
      /** Where the solver's elimination stopped; not a diagnosis of the cause. */
      nodeId: string;
      dof: Dof;
      /** "Restrain out of plane" would add a restraint: the model lies in one X-Z plane and a node lacks one. */
      canRestrain: boolean;
    }
  | { kind: "unsupported"; groups: UnsupportedGroup[] }
  /** A number of the model or of the result is too large for the arithmetic. */
  | { kind: "overflow"; loadCaseId: string | null }
  | { kind: "failed"; failure: SolverFailure };

export type AnalysisStatusKind = AnalysisStatus["kind"];

/** The members of a refusal by feature, truss members first. */
export function unsupportedGroups(unsupported: UnsupportedMember[]): UnsupportedGroup[] {
  const groups: UnsupportedGroup[] = [];
  for (const feature of ["truss-member", "end-release"] as const) {
    const memberIds = [
      ...new Set(
        unsupported.filter((entry) => entry.feature === feature).map((entry) => entry.memberId),
      ),
    ];
    if (memberIds.length > 0) {
      groups.push({ feature, memberIds });
    }
  }
  return groups;
}

/**
 * What the status area shows beside `model`, the model on screen. A state that is about another model object
 * (the analysis has not heard of `model` yet) gives "analysing": a status is never one of an earlier model.
 */
export function analysisStatus(state: AnalysisState, model: Model): AnalysisStatus {
  const earlierResult = state.answer?.result.ok === true && state.answer.model !== model;
  if (state.model !== model || state.phase === "idle" || state.phase === "pending") {
    return { kind: "analysing", stale: earlierResult };
  }
  if (state.phase === "blocked") {
    return { kind: "issues", count: state.issueCount };
  }
  if (state.phase === "failed" || state.answer === null) {
    return {
      kind: "failed",
      failure: state.failure ?? { kind: "worker-error", message: "" },
    };
  }
  const { result, ms } = state.answer;
  if (result.ok) {
    return {
      kind: "analysed",
      ms,
      smallestPivotRatio: result.smallestPivotRatio,
      lostAccuracy: result.smallestPivotRatio < PIVOT_WARNING,
    };
  }
  switch (result.reason) {
    case "invalid-model":
      return { kind: "issues", count: result.issues.length };
    case "not-supported-yet":
      return { kind: "unsupported", groups: unsupportedGroups(result.unsupported) };
    case "unstable":
      return {
        kind: "unstable",
        nodeId: result.nodeId,
        dof: result.dof,
        canRestrain: restrainOutOfPlane(model).outcome === "done",
      };
    case "non-finite":
      return { kind: "overflow", loadCaseId: result.loadCaseId ?? null };
  }
}

/** The short title of each status. */
export const STATUS_TITLE: Record<AnalysisStatusKind, MessageId> = {
  analysing: "workspace.analysis.analysing",
  analysed: "workspace.analysis.analysed",
  issues: "workspace.analysis.issues",
  unstable: "workspace.analysis.unstable",
  unsupported: "workspace.analysis.unsupported",
  overflow: "workspace.analysis.notAnalysed",
  failed: "workspace.analysis.failed",
};

/**
 * The sentence for the degree of freedom at which the solver stopped: "free to move along X at node {node}"
 * for a translation, "free to rotate about X at node {node}" for a rotation, in global axes. Each message
 * takes the value `node`.
 */
export const UNSTABLE_WHERE: Record<Dof, MessageId> = {
  ux: "workspace.analysis.unstableUx",
  uy: "workspace.analysis.unstableUy",
  uz: "workspace.analysis.unstableUz",
  rx: "workspace.analysis.unstableRx",
  ry: "workspace.analysis.unstableRy",
  rz: "workspace.analysis.unstableRz",
};

/** The sentence that names the members of one feature; it takes `members` and `more`. */
export const UNSUPPORTED_MESSAGE: Record<UnsupportedFeature, MessageId> = {
  "truss-member": "workspace.analysis.unsupportedTruss",
  "end-release": "workspace.analysis.unsupportedRelease",
};

/** What went wrong, by the kind of failure. */
export const FAILURE_MESSAGE: Record<SolverFailure["kind"], MessageId> = {
  "worker-error": "workspace.analysis.failedWorker",
  "solve-threw": "workspace.analysis.failedSolve",
  "not-sent": "workspace.analysis.failedSend",
};

/** The technical text of a failure, as the browser or the solver gave it; it may be empty. */
export function failureDetail(failure: SolverFailure): string {
  return failure.kind === "solve-threw" ? failure.error.message : failure.message;
}

/** How many member ids a sentence names before it says "and N more". */
export const MEMBER_LIST_LIMIT = 8;

/** The values `members` (the first ids, comma separated) and `more` (how many are left out) of a sentence. */
export function memberList(
  memberIds: string[],
  limit: number = MEMBER_LIST_LIMIT,
): { members: string; more: number } {
  return {
    members: memberIds.slice(0, limit).join(", "),
    more: Math.max(0, memberIds.length - limit),
  };
}
