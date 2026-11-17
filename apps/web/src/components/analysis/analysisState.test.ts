// Unit tests of ./analysisState.ts (card PX-02.8): the transitions of the live analysis, and that an answer
// for a model that is no longer the one on screen is dropped.
import { type Model, portalFrame } from "@bridle/model";
import { type SolveResult, solve } from "@bridle/solver";
import { describe, expect, it } from "vitest";
import {
  type AnalysisEvent,
  type AnalysisState,
  INITIAL_ANALYSIS,
  reduceAnalysis,
  shownResults,
} from "./analysisState";

function run(events: AnalysisEvent[], from: AnalysisState = INITIAL_ANALYSIS): AnalysisState {
  return events.reduce(reduceAnalysis, from);
}

const UNSTABLE: SolveResult = {
  ok: false,
  reason: "unstable",
  nodeId: "n1",
  dof: "ry",
  pivot: 0,
  diagonal: 1,
  threshold: 1e-12,
  remaining: 1,
};

describe("reduceAnalysis", () => {
  const a: Model = portalFrame();
  const b: Model = portalFrame();
  const resultA = solve(a);
  const resultB = solve(b);

  it("starts idle, with no model and no answer", () => {
    expect(INITIAL_ANALYSIS).toEqual({
      model: null,
      phase: "idle",
      issueCount: 0,
      answer: null,
      failure: null,
    });
  });

  it("goes from requested to done with the answer of that model", () => {
    const pending = run([{ type: "requested", model: a }]);
    expect(pending.phase).toBe("pending");
    expect(pending.model).toBe(a);
    expect(pending.answer).toBeNull();
    const done = reduceAnalysis(pending, { type: "solved", model: a, result: resultA, ms: 4 });
    expect(done.phase).toBe("done");
    expect(done.model).toBe(a);
    expect(done.answer).toEqual({ model: a, result: resultA, ms: 4 });
    expect(done.answer?.model).toBe(a);
    expect(done.answer?.result).toBe(resultA);
  });

  it("drops an answer for a model that is not the current one: the state object stays", () => {
    const pendingB = run([
      { type: "requested", model: a },
      { type: "requested", model: b },
    ]);
    const late = reduceAnalysis(pendingB, { type: "solved", model: a, result: resultA, ms: 9 });
    expect(late).toBe(pendingB);
    expect(late.phase).toBe("pending");
    expect(late.answer).toBeNull();
    const failedLate = reduceAnalysis(pendingB, {
      type: "failed",
      model: a,
      failure: { kind: "worker-error", message: "gone" },
    });
    expect(failedLate).toBe(pendingB);
    // The answer for the current model is taken.
    const done = reduceAnalysis(pendingB, { type: "solved", model: b, result: resultB, ms: 2 });
    expect(done.answer?.model).toBe(b);
    // And a second, late answer for the old model still changes nothing.
    expect(reduceAnalysis(done, { type: "solved", model: a, result: resultA, ms: 9 })).toBe(done);
  });

  it("drops every answer before anything was requested and after a reset", () => {
    const event: AnalysisEvent = { type: "solved", model: a, result: resultA, ms: 1 };
    expect(reduceAnalysis(INITIAL_ANALYSIS, event)).toBe(INITIAL_ANALYSIS);
    const done = run([{ type: "requested", model: a }, event]);
    const reset = reduceAnalysis(done, { type: "reset" });
    expect(reset).toBe(INITIAL_ANALYSIS);
    expect(reduceAnalysis(reset, event)).toBe(INITIAL_ANALYSIS);
    expect(reduceAnalysis(INITIAL_ANALYSIS, { type: "reset" })).toBe(INITIAL_ANALYSIS);
  });

  it("keeps the previous answer while the next model is pending, and replaces it when that one is answered", () => {
    const doneA = run([
      { type: "requested", model: a },
      { type: "solved", model: a, result: resultA, ms: 4 },
    ]);
    const pendingB = reduceAnalysis(doneA, { type: "requested", model: b });
    expect(pendingB.phase).toBe("pending");
    expect(pendingB.model).toBe(b);
    expect(pendingB.answer?.model).toBe(a);
    const doneB = reduceAnalysis(pendingB, { type: "solved", model: b, result: resultB, ms: 3 });
    expect(doneB.answer?.model).toBe(b);
    expect(doneB.answer?.result).toBe(resultB);
  });

  it("blocked: the model has issues, the count is kept and the earlier answer is gone", () => {
    const doneA = run([
      { type: "requested", model: a },
      { type: "solved", model: a, result: resultA, ms: 4 },
    ]);
    const blocked = reduceAnalysis(doneA, { type: "blocked", model: b, issueCount: 2 });
    expect(blocked).toEqual({
      model: b,
      phase: "blocked",
      issueCount: 2,
      answer: null,
      failure: null,
    });
    // The answer of a call made before the model got its issues is dropped.
    expect(reduceAnalysis(blocked, { type: "solved", model: a, result: resultA, ms: 4 })).toBe(
      blocked,
    );
  });

  it("failed: the failure is kept and no answer is shown; a new request clears it", () => {
    const failure = { kind: "worker-error", message: "no worker" } as const;
    const failed = run([
      { type: "requested", model: a },
      { type: "solved", model: a, result: resultA, ms: 4 },
      { type: "requested", model: b },
      { type: "failed", model: b, failure },
    ]);
    expect(failed.phase).toBe("failed");
    expect(failed.failure).toEqual(failure);
    expect(failed.answer).toBeNull();
    const again = reduceAnalysis(failed, { type: "requested", model: b });
    expect(again.phase).toBe("pending");
    expect(again.failure).toBeNull();
  });

  it("superseded changes nothing", () => {
    const pending = run([{ type: "requested", model: b }]);
    expect(reduceAnalysis(pending, { type: "superseded", model: a })).toBe(pending);
    expect(reduceAnalysis(pending, { type: "superseded", model: b })).toBe(pending);
  });

  it("takes a refusal as the answer of its model", () => {
    const done = run([
      { type: "requested", model: a },
      { type: "solved", model: a, result: UNSTABLE, ms: 1 },
    ]);
    expect(done.phase).toBe("done");
    expect(done.answer?.result).toBe(UNSTABLE);
  });

  describe("shownResults", () => {
    const doneA = run([
      { type: "requested", model: a },
      { type: "solved", model: a, result: resultA, ms: 4 },
    ]);

    it("gives the results of the model on screen, not stale", () => {
      const shown = shownResults(doneA, a);
      expect(shown?.stale).toBe(false);
      expect(shown?.model).toBe(a);
      expect(shown?.result).toBe(resultA);
    });

    it("gives the results of the earlier model as stale while the next one is pending", () => {
      const pendingB = reduceAnalysis(doneA, { type: "requested", model: b });
      const shown = shownResults(pendingB, b);
      expect(shown?.stale).toBe(true);
      expect(shown?.model).toBe(a);
      // Once b is answered, its own results are shown and they are not stale.
      const doneB = reduceAnalysis(pendingB, { type: "solved", model: b, result: resultB, ms: 3 });
      expect(shownResults(doneB, b)).toEqual({ model: b, result: resultB, stale: false });
    });

    it("marks results as stale for a model the state has not heard of yet", () => {
      // The model on screen is b, the state is still done for a: never the results of a as those of b.
      expect(shownResults(doneA, b)?.stale).toBe(true);
    });

    it("gives the same model's results as fresh while it is sent again", () => {
      const again = reduceAnalysis(doneA, { type: "requested", model: a });
      expect(shownResults(again, a)?.stale).toBe(false);
    });

    it("gives nothing without an answer, for a refusal, when blocked and when failed", () => {
      expect(shownResults(INITIAL_ANALYSIS, a)).toBeNull();
      expect(shownResults(run([{ type: "requested", model: a }]), a)).toBeNull();
      const refused = run([
        { type: "requested", model: a },
        { type: "solved", model: a, result: UNSTABLE, ms: 1 },
      ]);
      expect(shownResults(refused, a)).toBeNull();
      const blocked = reduceAnalysis(doneA, { type: "blocked", model: b, issueCount: 1 });
      expect(shownResults(blocked, b)).toBeNull();
      const failed = run(
        [
          { type: "requested", model: b },
          { type: "failed", model: b, failure: { kind: "not-sent", message: "" } },
        ],
        doneA,
      );
      expect(shownResults(failed, b)).toBeNull();
    });
  });
});
