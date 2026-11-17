import { type Model, portalFrame, simplySupportedBeam } from "@bridle/model";
import { describe, expect, it } from "vitest";
import {
  createSolverClient,
  type SolveOutcome,
  type SolverClient,
  type SolverWorker,
  type SolverWorkerEvent,
} from "./client";
import { handleSolveRequest } from "./handler";
import type { SolveRequest, SolveResponse } from "./messages";
import { solve } from "./solve";

/** A worker that records what it is sent; the test delivers the messages and the errors. */
class FakeWorker implements SolverWorker {
  onmessage: ((event: SolverWorkerEvent) => void) | null = null;
  onerror: ((event: SolverWorkerEvent) => void) | null = null;
  onmessageerror: ((event: SolverWorkerEvent) => void) | null = null;
  readonly requests: SolveRequest[] = [];
  terminated = 0;
  throwOnPost: unknown;

  postMessage(message: SolveRequest): void {
    if (this.throwOnPost !== undefined) {
      throw this.throwOnPost;
    }
    this.requests.push(message);
  }

  terminate(): void {
    this.terminated += 1;
  }

  /** Delivers a message as the worker would. */
  deliver(data: unknown): void {
    this.onmessage?.({ data });
  }

  /** Answers request number `index` (in the order they were posted) with the real handler. */
  answer(index: number): SolveResponse {
    const request = this.requests[index];
    if (!request) {
      throw new Error(`test: no request ${index}`);
    }
    const { response } = handleSolveRequest(request);
    this.deliver(response);
    return response;
  }

  hasHandlers(): boolean {
    return this.onmessage !== null || this.onerror !== null || this.onmessageerror !== null;
  }
}

function setup(): { client: SolverClient; workers: FakeWorker[] } {
  const workers: FakeWorker[] = [];
  const client = createSolverClient(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker;
  });
  return { client, workers };
}

function only(workers: FakeWorker[], index = 0): FakeWorker {
  const worker = workers[index];
  if (!worker) {
    throw new Error(`test: no worker ${index}`);
  }
  return worker;
}

/** Whether a promise has settled by now, after the microtasks that were queued have run. */
async function settled(promise: Promise<unknown>): Promise<boolean> {
  const pending = Symbol("pending");
  for (let turn = 0; turn < 5; turn++) {
    await Promise.resolve();
  }
  return (await Promise.race([promise, Promise.resolve(pending)])) !== pending;
}

const SUPERSEDED: SolveOutcome = { status: "superseded" };
const DISPOSED: SolveOutcome = { status: "disposed" };

function beamWithLoad(value: number): Model {
  const model = simplySupportedBeam();
  const load = model.memberUniformLoads[0];
  if (load) {
    load.value = value;
  }
  return model;
}

describe("createSolverClient: one call", () => {
  it("a browser Worker fits SolverWorker (the type check of this file is the test)", () => {
    const asSolverWorker: (worker: Worker) => SolverWorker = (worker) => worker;
    const make: (url: URL) => SolverClient = (url) =>
      createSolverClient(() => new Worker(url, { type: "module" }));
    expect([typeof asSolverWorker, typeof make]).toEqual(["function", "function"]);
  });

  it("makes no worker until the first solve call", () => {
    const { workers } = setup();
    expect(workers).toHaveLength(0);
  });

  it("posts a request with the model and resolves with the worker's result", async () => {
    const { client, workers } = setup();
    const promise = client.solve(portalFrame());
    const worker = only(workers);
    expect(worker.requests).toEqual([{ type: "solve", id: 1, model: portalFrame() }]);
    expect(await settled(promise)).toBe(false);
    worker.answer(0);
    expect(await promise).toEqual({ status: "solved", result: solve(portalFrame()) });
  });

  it("a refusal of solve is a solved outcome whose result is not ok", async () => {
    const { client, workers } = setup();
    const model = portalFrame();
    model.supports = [];
    const promise = client.solve(model);
    only(workers).answer(0);
    const outcome = await promise;
    expect(outcome).toEqual({ status: "solved", result: solve(model) });
    expect(outcome.status === "solved" && outcome.result.ok).toBe(false);
  });

  it("reuses one worker for calls made one after another, with a new id each time", async () => {
    const { client, workers } = setup();
    for (let call = 0; call < 3; call++) {
      const promise = client.solve(beamWithLoad(-10 - call));
      only(workers).answer(call);
      expect(await promise).toEqual({ status: "solved", result: solve(beamWithLoad(-10 - call)) });
    }
    expect(workers).toHaveLength(1);
    expect(only(workers).requests.map((request) => request.id)).toEqual([1, 2, 3]);
    expect(only(workers).terminated).toBe(0);
  });

  it("ignores messages that are not the awaited response", async () => {
    const { client, workers } = setup();
    const promise = client.solve(portalFrame());
    const worker = only(workers);
    worker.deliver("hello");
    worker.deliver({ type: "solve-result", id: 99, result: solve(portalFrame()) });
    worker.deliver({ type: "solve-result", id: 1 });
    expect(await settled(promise)).toBe(false);
    worker.answer(0);
    expect((await promise).status).toBe("solved");
    // A second copy of the answer, after the call was settled, changes nothing.
    worker.answer(0);
    const next = client.solve(portalFrame());
    expect(worker.requests).toHaveLength(2);
    worker.answer(1);
    expect((await next).status).toBe("solved");
  });
});

describe("createSolverClient: latest wins", () => {
  it("a newer call settles the older one as superseded at once, and the late answer is ignored", async () => {
    const { client, workers } = setup();
    const first = client.solve(beamWithLoad(-10));
    const second = client.solve(beamWithLoad(-20));
    expect(await first).toEqual(SUPERSEDED);
    const worker = only(workers);
    // The worker is not stopped, and the second request waits until it has answered the first.
    expect(workers).toHaveLength(1);
    expect(worker.terminated).toBe(0);
    expect(worker.requests.map((request) => request.id)).toEqual([1]);
    worker.answer(0);
    expect(await settled(second)).toBe(false);
    expect(worker.requests.map((request) => request.id)).toEqual([1, 2]);
    expect(worker.requests[1]?.model).toEqual(beamWithLoad(-20));
    worker.answer(1);
    expect(await second).toEqual({ status: "solved", result: solve(beamWithLoad(-20)) });
  });

  it("of many calls made while the worker is busy, only the first and the last are posted", async () => {
    const { client, workers } = setup();
    const promises = Array.from({ length: 50 }, (_, call) => client.solve(beamWithLoad(-1 - call)));
    const worker = only(workers);
    expect(worker.requests).toHaveLength(1);
    for (const promise of promises.slice(0, 49)) {
      expect(await promise).toEqual(SUPERSEDED);
    }
    worker.answer(0);
    expect(worker.requests.map((request) => request.id)).toEqual([1, 50]);
    worker.answer(1);
    expect(await promises[49]).toEqual({ status: "solved", result: solve(beamWithLoad(-50)) });
    expect(workers).toHaveLength(1);
  });

  it("a response with another id does not free the worker: the newer call still waits", async () => {
    const { client, workers } = setup();
    const first = client.solve(beamWithLoad(-10));
    const worker = only(workers);
    worker.deliver({ type: "solve-result", id: 99, result: solve(portalFrame()) });
    const second = client.solve(beamWithLoad(-20));
    expect(await first).toEqual(SUPERSEDED);
    expect(worker.requests.map((request) => request.id)).toEqual([1]);
    worker.answer(0);
    expect(worker.requests.map((request) => request.id)).toEqual([1, 2]);
    worker.answer(1);
    expect((await second).status).toBe("solved");
  });

  it("an error response to a superseded request does not fail the newer call", async () => {
    const { client, workers } = setup();
    const first = client.solve(beamWithLoad(-10));
    const second = client.solve(beamWithLoad(-20));
    const worker = only(workers);
    worker.deliver({ type: "solve-error", id: 1, error: { name: "Error", message: "old" } });
    expect(await first).toEqual(SUPERSEDED);
    worker.answer(1);
    expect((await second).status).toBe("solved");
  });
});

describe("createSolverClient: failures", () => {
  it("a solve-error response is a failed outcome, and the same worker serves the next call", async () => {
    const { client, workers } = setup();
    const promise = client.solve(portalFrame());
    const worker = only(workers);
    worker.deliver({ type: "solve-error", id: 1, error: { name: "TypeError", message: "bad" } });
    expect(await promise).toEqual({
      status: "failed",
      failure: { kind: "solve-threw", error: { name: "TypeError", message: "bad" } },
    });
    const next = client.solve(portalFrame());
    expect(workers).toHaveLength(1);
    expect(worker.terminated).toBe(0);
    worker.answer(1);
    expect((await next).status).toBe("solved");
  });

  it("a worker error fails the call, terminates that worker, and the next call makes a new one", async () => {
    const { client, workers } = setup();
    const promise = client.solve(portalFrame());
    const broken = only(workers);
    broken.onerror?.({ message: "Uncaught ReferenceError: x is not defined" });
    expect(await promise).toEqual({
      status: "failed",
      failure: { kind: "worker-error", message: "Uncaught ReferenceError: x is not defined" },
    });
    expect(broken.terminated).toBe(1);
    expect(broken.hasHandlers()).toBe(false);
    expect(workers).toHaveLength(1);

    const next = client.solve(portalFrame());
    expect(workers).toHaveLength(2);
    const fresh = only(workers, 1);
    expect(fresh.requests.map((request) => request.id)).toEqual([2]);
    fresh.answer(0);
    expect(await next).toEqual({ status: "solved", result: solve(portalFrame()) });
    expect(fresh.terminated).toBe(0);
  });

  it("a message that cannot be read (messageerror) is handled like a worker error", async () => {
    const { client, workers } = setup();
    const promise = client.solve(portalFrame());
    only(workers).onmessageerror?.({ data: null });
    expect(await promise).toEqual({
      status: "failed",
      failure: { kind: "worker-error", message: "worker error" },
    });
    expect(only(workers).terminated).toBe(1);
  });

  it("a worker error during a superseded request sends the newest call to a new worker", async () => {
    const { client, workers } = setup();
    const first = client.solve(beamWithLoad(-10));
    const second = client.solve(beamWithLoad(-20));
    expect(await first).toEqual(SUPERSEDED);
    const broken = only(workers);
    broken.onerror?.({ message: "boom" });
    expect(broken.terminated).toBe(1);
    expect(workers).toHaveLength(2);
    const fresh = only(workers, 1);
    expect(fresh.requests.map((request) => request.id)).toEqual([2]);
    fresh.answer(0);
    expect(await second).toEqual({ status: "solved", result: solve(beamWithLoad(-20)) });
  });

  it("a worker error with no call waiting replaces the worker at the next call", async () => {
    const { client, workers } = setup();
    const promise = client.solve(portalFrame());
    only(workers).answer(0);
    await promise;
    only(workers).onerror?.({ message: "late" });
    expect(only(workers).terminated).toBe(1);
    const next = client.solve(portalFrame());
    expect(workers).toHaveLength(2);
    only(workers, 1).answer(0);
    expect((await next).status).toBe("solved");
  });

  it("when makeWorker throws, the call fails as worker-error and the next call tries again", async () => {
    const workers: FakeWorker[] = [];
    let attempts = 0;
    const client = createSolverClient(() => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("Worker is not defined");
      }
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    });
    expect(await client.solve(portalFrame())).toEqual({
      status: "failed",
      failure: { kind: "worker-error", message: "Worker is not defined" },
    });
    const next = client.solve(portalFrame());
    expect(attempts).toBe(2);
    only(workers).answer(0);
    expect((await next).status).toBe("solved");
  });

  it("when postMessage throws, the call fails as not-sent and the worker is kept", async () => {
    const { client, workers } = setup();
    const first = client.solve(portalFrame());
    const worker = only(workers);
    worker.answer(0);
    await first;
    worker.throwOnPost = new Error("could not be cloned");
    expect(await client.solve(portalFrame())).toEqual({
      status: "failed",
      failure: { kind: "not-sent", message: "could not be cloned" },
    });
    worker.throwOnPost = undefined;
    const next = client.solve(portalFrame());
    expect(workers).toHaveLength(1);
    expect(worker.terminated).toBe(0);
    worker.answer(1);
    expect((await next).status).toBe("solved");
  });
});

describe("createSolverClient: dispose", () => {
  it("terminates the worker, removes its handlers and settles the waiting call as disposed", async () => {
    const { client, workers } = setup();
    const promise = client.solve(portalFrame());
    const worker = only(workers);
    client.dispose();
    expect(await promise).toEqual(DISPOSED);
    expect(worker.terminated).toBe(1);
    expect(worker.hasHandlers()).toBe(false);
  });

  it("settles a superseded call and the waiting call, each once", async () => {
    const { client, workers } = setup();
    const first = client.solve(beamWithLoad(-10));
    const second = client.solve(beamWithLoad(-20));
    client.dispose();
    expect(await first).toEqual(SUPERSEDED);
    expect(await second).toEqual(DISPOSED);
    expect(only(workers).requests).toHaveLength(1);
  });

  it("after dispose, solve resolves as disposed and makes no worker; a second dispose does nothing", async () => {
    const { client, workers } = setup();
    const promise = client.solve(portalFrame());
    only(workers).answer(0);
    await promise;
    client.dispose();
    client.dispose();
    expect(only(workers).terminated).toBe(1);
    expect(await client.solve(portalFrame())).toEqual(DISPOSED);
    expect(workers).toHaveLength(1);
    expect(only(workers).requests).toHaveLength(1);
  });

  it("dispose before any call makes no worker", async () => {
    const { client, workers } = setup();
    client.dispose();
    expect(await client.solve(portalFrame())).toEqual(DISPOSED);
    expect(workers).toHaveLength(0);
  });
});
