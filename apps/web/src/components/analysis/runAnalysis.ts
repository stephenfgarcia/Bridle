/**
 * The wiring of the live analysis (card PX-02.8), without React and without a worker of its own: it watches
 * a source of models, sends each model that has no issue to a solver client and reports what happens as
 * events of ./analysisState.ts. ./LiveAnalysis.tsx starts it with the application's stores and a client whose
 * worker is the solver's; ./runAnalysis.test.ts starts it with a client of its own.
 *
 * Latest wins. The client keeps only the newest call (packages/solver/README.md, "The client"); an answer
 * that arrives for a model that is no longer the one on screen is dropped by the reducer.
 */
import type { Model, ModelIssue } from "@bridle/model";
import type { SolveOutcome } from "@bridle/solver/client";
import type { AnalysisEvent } from "./analysisState";

export interface LiveAnalysisOptions {
  /** The solver: `solve` must resolve, never reject (`createSolverClient` of `@bridle/solver/client`). */
  client: { solve(model: Model): Promise<SolveOutcome> };
  /** The model on screen. */
  getModel: () => Model;
  /** Calls `listener` after the model on screen may have changed; returns what stops the calls. */
  subscribe: (listener: () => void) => () => void;
  /** The issues of a model (`issuesOf` of ../model/modelStore.ts). */
  issuesOf: (model: Model) => ModelIssue[];
  /** Receives the events. */
  dispatch: (event: AnalysisEvent) => void;
  /** A clock in ms (`performance.now` by default). */
  now?: () => number;
}

export interface LiveAnalysis {
  /** Sends the model on screen again, whatever was answered for it before (the Retry button). */
  retry: () => void;
  /** Stops watching. Answers that arrive afterwards are not reported. */
  stop: () => void;
}

/**
 * Starts the live analysis: the model on screen is looked at once at the start and again whenever `subscribe`
 * reports and the model object is another one. A model with issues gives the event `blocked` and is not
 * sent. Any other model gives `requested`, is sent, and its outcome gives `solved`, `failed` or `superseded`;
 * a client that was disposed gives nothing.
 */
export function startLiveAnalysis(options: LiveAnalysisOptions): LiveAnalysis {
  const { client, getModel, subscribe, issuesOf, dispatch } = options;
  const now = options.now ?? (() => performance.now());
  let stopped = false;
  let seen: Model | null = null;

  const analyse = (model: Model): void => {
    seen = model;
    const issues = issuesOf(model);
    if (issues.length > 0) {
      dispatch({ type: "blocked", model, issueCount: issues.length });
      return;
    }
    dispatch({ type: "requested", model });
    const sentAt = now();
    void client.solve(model).then((outcome) => {
      if (stopped) {
        return;
      }
      if (outcome.status === "solved") {
        dispatch({ type: "solved", model, result: outcome.result, ms: now() - sentAt });
      } else if (outcome.status === "failed") {
        dispatch({ type: "failed", model, failure: outcome.failure });
      } else if (outcome.status === "superseded") {
        dispatch({ type: "superseded", model });
      }
    });
  };

  const unsubscribe = subscribe(() => {
    const model = getModel();
    if (!stopped && model !== seen) {
      analyse(model);
    }
  });
  analyse(getModel());

  return {
    retry: () => {
      if (!stopped) {
        analyse(getModel());
      }
    },
    stop: () => {
      stopped = true;
      unsubscribe();
    },
  };
}
