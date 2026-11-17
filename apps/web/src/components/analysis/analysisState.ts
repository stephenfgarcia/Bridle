/**
 * The state of the live analysis and its transitions (card PX-02.8). Pure: no React, no zustand, no worker.
 * ./analysisStore.ts holds one such state; ./runAnalysis.ts sends the events.
 *
 * Every event names the model object it is about. The model store keeps a model object until a command
 * changes it (../model/modelStore.ts), so "is this answer about the model on screen" is a comparison of
 * object identity. An answer (`solved`, `failed`) for a model that is not the state's model is dropped: the
 * state comes back unchanged.
 */
import type { Model } from "@bridle/model";
import type { SolveResult } from "@bridle/solver";
import type { SolverFailure } from "@bridle/solver/client";

/** What the worker answered for one model object: results, or a refusal (`result.ok` is `false`). */
export interface Answer {
  /** The model that was sent. */
  model: Model;
  result: SolveResult;
  /** The time from sending the model to receiving the answer, in ms. */
  ms: number;
}

/**
 * - `idle`: nothing was looked at yet.
 * - `blocked`: the model has issues of `validateModel` and was not sent.
 * - `pending`: the model was sent and not answered yet.
 * - `done`: the worker answered for this model; the answer is `answer`.
 * - `failed`: the call for this model failed; why is `failure`.
 */
export type AnalysisPhase = "idle" | "blocked" | "pending" | "done" | "failed";

export interface AnalysisState {
  /** The model the analysis is about: the one the last `requested` or `blocked` event named. */
  model: Model | null;
  phase: AnalysisPhase;
  /** The number of issues of the model, in the phase `blocked`; 0 otherwise. */
  issueCount: number;
  /**
   * The last answer. In the phase `done` it belongs to `model`. In the phase `pending` it is the answer for
   * an earlier model, kept so that its values can stay on screen marked as stale (`staleAnswer`), or the
   * answer for this same model when it was sent again. `null` in the other phases.
   */
  answer: Answer | null;
  /** Why the call failed, in the phase `failed`; `null` otherwise. */
  failure: SolverFailure | null;
}

export type AnalysisEvent =
  /** The model was sent to the worker. */
  | { type: "requested"; model: Model }
  /** The model has issues and was not sent. */
  | { type: "blocked"; model: Model; issueCount: number }
  /** The worker answered for that model. */
  | { type: "solved"; model: Model; result: SolveResult; ms: number }
  /** The call for that model failed. */
  | { type: "failed"; model: Model; failure: SolverFailure }
  /** The call for that model was replaced by a newer one before it was answered: nothing changes. */
  | { type: "superseded"; model: Model }
  /** Back to the start (the workspace was left). */
  | { type: "reset" };

export const INITIAL_ANALYSIS: AnalysisState = {
  model: null,
  phase: "idle",
  issueCount: 0,
  answer: null,
  failure: null,
};

/** The next state. An event that changes nothing returns the state object it was given. */
export function reduceAnalysis(state: AnalysisState, event: AnalysisEvent): AnalysisState {
  switch (event.type) {
    case "requested":
      return {
        model: event.model,
        phase: "pending",
        issueCount: 0,
        answer: state.answer,
        failure: null,
      };
    case "blocked":
      return {
        model: event.model,
        phase: "blocked",
        issueCount: event.issueCount,
        answer: null,
        failure: null,
      };
    case "solved":
      if (event.model !== state.model) {
        return state;
      }
      return {
        model: state.model,
        phase: "done",
        issueCount: 0,
        answer: { model: event.model, result: event.result, ms: event.ms },
        failure: null,
      };
    case "failed":
      if (event.model !== state.model) {
        return state;
      }
      return {
        model: state.model,
        phase: "failed",
        issueCount: 0,
        answer: null,
        failure: event.failure,
      };
    case "superseded":
      return state;
    case "reset":
      return state === INITIAL_ANALYSIS ? state : INITIAL_ANALYSIS;
  }
}

/** The results a view may show for `model`, with whether they are stale. */
export interface ShownResults {
  /** The model the results were computed for. */
  model: Model;
  result: Extract<SolveResult, { ok: true }>;
  /** `true` when the results belong to an earlier model than `model` and a new answer is awaited. */
  stale: boolean;
}

/**
 * The results to show beside `model`, the model on screen; `null` when there are none. Results computed for
 * `model` itself come back with `stale: false`. Results of an earlier model come back, with `stale: true`,
 * only while the answer for `model` is awaited (the state is `pending` for `model`, or has not heard of
 * `model` yet); in every other case they are not returned. A refusal is not a result.
 */
export function shownResults(state: AnalysisState, model: Model): ShownResults | null {
  const { answer } = state;
  if (answer === null || !answer.result.ok) {
    return null;
  }
  if (answer.model === model) {
    return { model: answer.model, result: answer.result, stale: false };
  }
  const awaited = state.model !== model || state.phase === "pending";
  return awaited ? { model: answer.model, result: answer.result, stale: true } : null;
}
