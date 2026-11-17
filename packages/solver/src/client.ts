/**
 * The main-thread side of the worker (`@bridle/solver/client`): `createSolverClient` sends models
 * to a worker that runs ./worker.ts and gives each call a promise of its outcome. This file imports
 * types and the response guard only, so it does not bring the solver into the main thread's bundle.
 *
 * Rules, each covered by ./client.test.ts:
 * - One worker at a time. It is made by the first `solve` call, reused by the later ones, replaced
 *   after a worker error and terminated by `dispose`.
 * - Latest wins. A newer `solve` call settles the call before it as `superseded`, at once.
 * - The worker is not stopped for a superseded request. It finishes the request it is computing;
 *   that answer is dropped. While the worker is busy the client keeps only the newest model and
 *   sends it when the worker answers, so the worker computes at most one request that nobody waits
 *   for, however many calls arrive meanwhile.
 * - A promise of `solve` never rejects: every ending is a `SolveOutcome`.
 */
import type { Model } from "@bridle/model";
import { isSolveResponse, type SolveErrorInfo, type SolveRequest } from "./messages";
import type { SolveResult } from "./solve";

/** What the client reads of a worker event: `data` of a message, `message` of an error. */
export interface SolverWorkerEvent {
  readonly data?: unknown;
  readonly message?: unknown;
}

/** A handler property of a worker; declared as a method so that a DOM `Worker` fits. */
type SolverWorkerHandler = { handler(event: SolverWorkerEvent): void }["handler"];

/**
 * The part of a worker that the client uses. A browser `Worker` fits it (./client.test.ts checks
 * that with the compiler); a test passes an object of its own.
 */
export interface SolverWorker {
  postMessage(message: SolveRequest): void;
  terminate(): void;
  onmessage: SolverWorkerHandler | null;
  onerror: SolverWorkerHandler | null;
  onmessageerror: SolverWorkerHandler | null;
}

/** Why a call failed. */
export type SolverFailure =
  /** `solve` threw in the worker. The worker is kept. */
  | { kind: "solve-threw"; error: SolveErrorInfo }
  /**
   * The worker could not be made (`makeWorker` threw), or it reported an error or a message that
   * could not be read while this call was with it. That worker is terminated; the next call makes
   * a new one.
   */
  | { kind: "worker-error"; message: string }
  /** `postMessage` threw (a model that cannot be cloned, for example). The worker is kept. */
  | { kind: "not-sent"; message: string };

/** How a `solve` call ended. */
export type SolveOutcome =
  /** The worker answered. `result` is what `solve` returned; it may be a refusal (`ok: false`). */
  | { status: "solved"; result: SolveResult }
  /** A newer `solve` call was made before this one was answered. */
  | { status: "superseded" }
  | { status: "failed"; failure: SolverFailure }
  /** `dispose` was called before this call was answered, or before this call was made. */
  | { status: "disposed" };

export interface SolverClient {
  /** Sends the model to the worker. The promise resolves with the outcome and never rejects. */
  solve(model: Model): Promise<SolveOutcome>;
  /**
   * Terminates the worker and settles a waiting call as `disposed`. Calls made afterwards resolve
   * as `disposed` and make no worker. Calling it again does nothing.
   */
  dispose(): void;
}

interface PendingCall {
  id: number;
  model: Model;
  /** Whether the request was posted to the worker. */
  sent: boolean;
  settle(outcome: SolveOutcome): void;
}

function messageOf(value: unknown): string {
  if (value instanceof Error) {
    return value.message;
  }
  if (typeof value === "object" && value !== null && "message" in value) {
    const message = (value as { message: unknown }).message;
    if (typeof message === "string" && message !== "") {
      return message;
    }
  }
  return typeof value === "string" && value !== "" ? value : "worker error";
}

/**
 * Makes a client. `makeWorker` is called when a worker is needed: at the first `solve` call and at
 * the first one after a worker error, never by `createSolverClient` itself.
 */
export function createSolverClient(makeWorker: () => SolverWorker): SolverClient {
  let worker: SolverWorker | null = null;
  /** The id of the request the worker has not answered yet. */
  let inFlightId: number | null = null;
  /** The newest call, until it is settled. */
  let pending: PendingCall | null = null;
  let nextId = 1;
  let disposed = false;

  function settlePending(outcome: SolveOutcome): void {
    const call = pending;
    pending = null;
    call?.settle(outcome);
  }

  function discardWorker(): void {
    const old = worker;
    worker = null;
    inFlightId = null;
    if (old) {
      old.onmessage = null;
      old.onerror = null;
      old.onmessageerror = null;
      old.terminate();
    }
  }

  function onMessage(from: SolverWorker, data: unknown): void {
    if (from !== worker || !isSolveResponse(data) || data.id !== inFlightId) {
      return;
    }
    inFlightId = null;
    if (pending?.id === data.id) {
      settlePending(
        data.type === "solve-result"
          ? { status: "solved", result: data.result }
          : { status: "failed", failure: { kind: "solve-threw", error: data.error } },
      );
    } else {
      // The answer to a superseded request: dropped. The newest call has waited for it.
      sendPending();
    }
  }

  function onError(from: SolverWorker, event: SolverWorkerEvent): void {
    if (from !== worker) {
      return;
    }
    discardWorker();
    if (pending?.sent) {
      settlePending({
        status: "failed",
        failure: { kind: "worker-error", message: messageOf(event) },
      });
    } else {
      // The worker failed on a superseded request; the newest call goes to a new worker.
      sendPending();
    }
  }

  function ensureWorker(): SolverWorker {
    if (worker) {
      return worker;
    }
    const made = makeWorker();
    made.onmessage = (event) => onMessage(made, event.data);
    made.onerror = (event) => onError(made, event);
    made.onmessageerror = (event) => onError(made, event);
    worker = made;
    return made;
  }

  /** Posts the newest call if there is one, it was not posted yet and the worker is free. */
  function sendPending(): void {
    const call = pending;
    if (!call || call.sent || inFlightId !== null) {
      return;
    }
    let target: SolverWorker;
    try {
      target = ensureWorker();
    } catch (thrown) {
      settlePending({
        status: "failed",
        failure: { kind: "worker-error", message: messageOf(thrown) },
      });
      return;
    }
    try {
      target.postMessage({ type: "solve", id: call.id, model: call.model });
    } catch (thrown) {
      settlePending({
        status: "failed",
        failure: { kind: "not-sent", message: messageOf(thrown) },
      });
      return;
    }
    call.sent = true;
    inFlightId = call.id;
  }

  return {
    solve(model) {
      if (disposed) {
        return Promise.resolve({ status: "disposed" });
      }
      settlePending({ status: "superseded" });
      return new Promise<SolveOutcome>((resolve) => {
        pending = { id: nextId++, model, sent: false, settle: resolve };
        sendPending();
      });
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      discardWorker();
      settlePending({ status: "disposed" });
    },
  };
}
