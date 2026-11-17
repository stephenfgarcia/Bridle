// Unit tests of ./runAnalysis.ts (card PX-02.8): the live analysis on a model store of its own, first with a
// client the test answers by hand, then with the solver's real client over a worker that runs the solver's
// request handler in this thread.
import { type Model, planarTruss, portalFrame } from "@bridle/model";
import { handleSolveRequest, type SolveRequest, solve } from "@bridle/solver";
import { createSolverClient, type SolveOutcome, type SolverWorker } from "@bridle/solver/client";
import { describe, expect, it } from "vitest";
import { createStore } from "zustand/vanilla";
import { createModelState, issuesOf, type ModelState, selectModel } from "../model/modelStore";
import {
  type AnalysisEvent,
  type AnalysisState,
  INITIAL_ANALYSIS,
  reduceAnalysis,
  shownResults,
} from "./analysisState";
import { startLiveAnalysis } from "./runAnalysis";
import { analysisStatus } from "./status";

const FIXED = { ux: true, uy: true, uz: true, rx: true, ry: true, rz: true };

/** A client whose calls the test answers: `calls` holds each model sent and the function that answers it. */
function manualClient() {
  const calls: { model: Model; answer: (outcome: SolveOutcome) => void }[] = [];
  return {
    calls,
    solve: (model: Model) =>
      new Promise<SolveOutcome>((resolve) => {
        calls.push({ model, answer: resolve });
      }),
  };
}

/** A model store, an analysis state fed by the events, and the list of the events. */
function setup(client: { solve(model: Model): Promise<SolveOutcome> }, clock?: () => number) {
  const store = createStore<ModelState>()(createModelState(portalFrame(), "portal"));
  const events: AnalysisEvent[] = [];
  const box: { state: AnalysisState } = { state: INITIAL_ANALYSIS };
  const live = startLiveAnalysis({
    client,
    getModel: () => selectModel(store.getState()),
    subscribe: (listener) => store.subscribe(listener),
    issuesOf,
    dispatch: (event) => {
      events.push(event);
      box.state = reduceAnalysis(box.state, event);
    },
    ...(clock ? { now: clock } : {}),
  });
  const model = () => selectModel(store.getState());
  return { store, events, box, live, model };
}

/** Lets the promise callbacks that are due run. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function okOutcome(model: Model): SolveOutcome {
  return { status: "solved", result: solve(model) };
}

describe("startLiveAnalysis with a client answered by hand", () => {
  it("sends the model on screen at the start and reports its answer with the time it took", async () => {
    const client = manualClient();
    let time = 100;
    const { events, box, model } = setup(client, () => time);
    expect(client.calls.map((call) => call.model)).toEqual([model()]);
    expect(client.calls[0]?.model).toBe(model());
    expect(box.state.phase).toBe("pending");
    time = 107.5;
    client.calls[0]?.answer(okOutcome(model()));
    await settle();
    expect(events.map((event) => event.type)).toEqual(["requested", "solved"]);
    expect(box.state.phase).toBe("done");
    expect(box.state.answer?.model).toBe(model());
    expect(box.state.answer?.ms).toBe(7.5);
    expect(analysisStatus(box.state, model())).toMatchObject({ kind: "analysed", ms: 7.5 });
  });

  it("sends every new model object, and only when the object changed", () => {
    const client = manualClient();
    const { store, model } = setup(client);
    const first = model();
    store.getState().moveNode({ id: "n2", x: 0, y: 0, z: 5 });
    expect(client.calls).toHaveLength(2);
    expect(client.calls[1]?.model).toBe(model());
    expect(model()).not.toBe(first);
    // A command that is refused changes nothing and sends nothing.
    expect(store.getState().moveNode({ id: "n2", x: 0, y: 0, z: 5 })).toBe(false);
    expect(client.calls).toHaveLength(2);
  });

  it("drops the answer of an older model: the result on screen is never one of another model", async () => {
    const client = manualClient();
    const { store, box, model } = setup(client);
    const first = model();
    store.getState().moveNode({ id: "n2", x: 0, y: 0, z: 5 });
    const second = model();
    // The answer for the first model arrives late.
    client.calls[0]?.answer(okOutcome(first));
    await settle();
    expect(box.state.phase).toBe("pending");
    expect(box.state.answer).toBeNull();
    expect(shownResults(box.state, second)).toBeNull();
    client.calls[1]?.answer(okOutcome(second));
    await settle();
    expect(box.state.answer?.model).toBe(second);
    expect(shownResults(box.state, second)?.stale).toBe(false);
  });

  it("keeps the previous result as stale while the next model is pending", async () => {
    const client = manualClient();
    const { store, box, model } = setup(client);
    const first = model();
    client.calls[0]?.answer(okOutcome(first));
    await settle();
    store.getState().addNodalLoad({
      loadCaseId: "lc1",
      nodeId: "n3",
      fx: 0,
      fy: 0,
      fz: -15,
      mx: 0,
      my: 0,
      mz: 0,
    });
    const second = model();
    expect(shownResults(box.state, second)).toMatchObject({ stale: true, model: first });
    expect(analysisStatus(box.state, second)).toEqual({ kind: "analysing", stale: true });
    client.calls[1]?.answer(okOutcome(second));
    await settle();
    expect(shownResults(box.state, second)).toMatchObject({ stale: false, model: second });
  });

  it("does not send a model with issues, and drops the answer of the model before it", async () => {
    const client = manualClient();
    const { store, events, box, model } = setup(client);
    const first = model();
    store.getState().removeSupport({ nodeId: "n1" });
    store.getState().removeSupport({ nodeId: "n4" });
    // One support left: still valid, sent. No support: an issue, not sent.
    expect(client.calls).toHaveLength(2);
    const count = issuesOf(model()).length;
    expect(count).toBeGreaterThan(0);
    expect(events.at(-1)).toEqual({ type: "blocked", model: model(), issueCount: count });
    expect(analysisStatus(box.state, model())).toEqual({ kind: "issues", count });
    client.calls[0]?.answer(okOutcome(first));
    client.calls[1]?.answer({ status: "superseded" });
    await settle();
    expect(box.state.phase).toBe("blocked");
    expect(shownResults(box.state, model())).toBeNull();
  });

  it("follows undo and redo: the earlier model object is sent again and its answer is shown", async () => {
    const client = manualClient();
    const { store, box, model } = setup(client);
    const first = model();
    client.calls[0]?.answer(okOutcome(first));
    store.getState().setSupport({ nodeId: "n3", ...FIXED });
    const second = model();
    client.calls[1]?.answer(okOutcome(second));
    await settle();
    expect(box.state.answer?.model).toBe(second);
    store.getState().undo();
    expect(model()).toBe(first);
    expect(client.calls).toHaveLength(3);
    expect(client.calls[2]?.model).toBe(first);
    expect(analysisStatus(box.state, first).kind).toBe("analysing");
    client.calls[2]?.answer(okOutcome(first));
    await settle();
    expect(box.state.answer?.model).toBe(first);
    store.getState().redo();
    expect(client.calls[3]?.model).toBe(second);
    client.calls[3]?.answer(okOutcome(second));
    await settle();
    expect(box.state.answer?.model).toBe(second);
    expect(analysisStatus(box.state, second).kind).toBe("analysed");
  });

  it("follows the load of another model", async () => {
    const client = manualClient();
    const { store, box, model } = setup(client);
    store.getState().replaceModel(planarTruss(), "truss");
    expect(client.calls[1]?.model).toBe(model());
    client.calls[1]?.answer(okOutcome(model()));
    await settle();
    expect(analysisStatus(box.state, model()).kind).toBe("unsupported");
  });

  it("reports a failure, and Retry sends the same model again", async () => {
    const client = manualClient();
    const { box, live, model } = setup(client);
    const failure = { kind: "worker-error", message: "no worker" } as const;
    client.calls[0]?.answer({ status: "failed", failure });
    await settle();
    expect(analysisStatus(box.state, model())).toEqual({ kind: "failed", failure });
    live.retry();
    expect(client.calls).toHaveLength(2);
    expect(client.calls[1]?.model).toBe(model());
    expect(analysisStatus(box.state, model()).kind).toBe("analysing");
    client.calls[1]?.answer(okOutcome(model()));
    await settle();
    expect(analysisStatus(box.state, model()).kind).toBe("analysed");
  });

  it("reports nothing for a disposed client, and a superseded call changes no state", async () => {
    const client = manualClient();
    const { events, box } = setup(client);
    const pending = box.state;
    client.calls[0]?.answer({ status: "disposed" });
    await settle();
    expect(events.map((event) => event.type)).toEqual(["requested"]);
    const second = manualClient();
    const other = setup(second);
    const before = other.box.state;
    second.calls[0]?.answer({ status: "superseded" });
    await settle();
    expect(other.events.map((event) => event.type)).toEqual(["requested", "superseded"]);
    expect(other.box.state).toBe(before);
    expect(box.state).toBe(pending);
  });

  it("after stop: no model is sent, no answer is reported, Retry does nothing", async () => {
    const client = manualClient();
    const { store, events, live, model } = setup(client);
    live.stop();
    store.getState().moveNode({ id: "n2", x: 0, y: 0, z: 5 });
    live.retry();
    expect(client.calls).toHaveLength(1);
    client.calls[0]?.answer(okOutcome(model()));
    await settle();
    expect(events.map((event) => event.type)).toEqual(["requested"]);
  });
});

/**
 * A worker that answers in a later task with the solver's own request handler; the model is copied as
 * `postMessage` would copy it. `posted` counts the requests.
 */
function handlerWorker(posted: SolveRequest[]): SolverWorker {
  const worker: SolverWorker = {
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    terminate: () => {
      worker.onmessage = null;
    },
    postMessage: (message) => {
      const request = structuredClone(message);
      posted.push(request);
      setTimeout(() => {
        worker.onmessage?.({ data: handleSolveRequest(request).response });
      }, 0);
    },
  };
  return worker;
}

const idle = () => new Promise<void>((resolve) => setTimeout(resolve, 20));

describe("startLiveAnalysis with the solver's client", () => {
  it("analyses the portal frame, then each edit, and ends on the result of the last model", async () => {
    const posted: SolveRequest[] = [];
    const client = createSolverClient(() => handlerWorker(posted));
    const { store, box, model } = setup(client);
    await idle();
    expect(analysisStatus(box.state, model()).kind).toBe("analysed");
    const sway = (state: AnalysisState) => {
      const shown = shownResults(state, model());
      return shown?.stale === false ? shown.result.loadCases.lc1?.displacements.n2?.ux : undefined;
    };
    const firstSway = sway(box.state);
    expect(firstSway).toBeGreaterThan(0);
    // Five edits in a row, faster than the worker answers: the lateral load grows from 20 kN to 120 kN.
    for (const fx of [40, 60, 80, 100, 120]) {
      store.getState().updateNodalLoad({ id: "nl1", fx });
    }
    const last = model();
    expect(analysisStatus(box.state, last)).toEqual({ kind: "analysing", stale: true });
    await idle();
    expect(box.state.answer?.model).toBe(last);
    expect(analysisStatus(box.state, last).kind).toBe("analysed");
    // Linear: six times the load, six times the sway. Not the sway of an intermediate model.
    expect(sway(box.state)).toBeCloseTo((firstSway ?? 0) * 6, 9);
    // Latest wins in the client: the first edit went out, the last one after it; the three between did not.
    expect(posted).toHaveLength(3);
    client.dispose();
  });

  it("reports the unstable frame and then the frame restrained again", async () => {
    const posted: SolveRequest[] = [];
    const client = createSolverClient(() => handlerWorker(posted));
    const { store, box, model } = setup(client);
    const pinned = { ux: true, uy: true, uz: true, rx: false, ry: false, rz: false };
    store.getState().setSupport({ nodeId: "n1", ...pinned });
    store.getState().setSupport({ nodeId: "n4", ...pinned });
    await idle();
    expect(analysisStatus(box.state, model())).toMatchObject({
      kind: "unstable",
      canRestrain: true,
    });
    expect(shownResults(box.state, model())).toBeNull();
    store.getState().undo();
    await idle();
    expect(analysisStatus(box.state, model()).kind).toBe("analysed");
    client.dispose();
  });

  it("reports a worker that cannot be made as a failure, and Retry analyses with a new worker", async () => {
    const posted: SolveRequest[] = [];
    let attempts = 0;
    const client = createSolverClient(() => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("no worker today");
      }
      return handlerWorker(posted);
    });
    const { box, live, model } = setup(client);
    await idle();
    const status = analysisStatus(box.state, model());
    expect(status.kind).toBe("failed");
    if (status.kind === "failed") {
      expect(status.failure.kind).toBe("worker-error");
    }
    live.retry();
    await idle();
    expect(analysisStatus(box.state, model()).kind).toBe("analysed");
    client.dispose();
  });
});
