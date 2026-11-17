/**
 * The messages that carry one `solve` call to a worker thread and its answer back. Types and two
 * guards only: this file imports no code, so the client (./client.ts) can use it without bringing
 * the solver into the bundle of the main thread.
 */
import type { Model } from "@bridle/model";
import type { SolveResult } from "./solve";

/** Main thread to worker: solve this model. `id` comes back in the response. */
export interface SolveRequest {
  type: "solve";
  id: number;
  model: Model;
}

/** What is known of a value that `solve` threw: the name and the message of the error. */
export interface SolveErrorInfo {
  name: string;
  message: string;
}

/**
 * Worker to main thread. `solve-result` carries what `solve` returned, which may be a refusal
 * (`result.ok === false`): a refusal is an answer, not an error. `solve-error` is sent when `solve`
 * threw.
 */
export type SolveResponse =
  | { type: "solve-result"; id: number; result: SolveResult }
  | { type: "solve-error"; id: number; error: SolveErrorInfo };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Whether a received value has the shape of a request: the type, a numeric id and an object as the
 * model. The model itself is not checked here; `solve` validates it.
 */
export function isSolveRequest(value: unknown): value is SolveRequest {
  return (
    isRecord(value) &&
    value.type === "solve" &&
    typeof value.id === "number" &&
    isRecord(value.model)
  );
}

/** Whether a received value has the shape of a response. The result itself is not checked. */
export function isSolveResponse(value: unknown): value is SolveResponse {
  if (!isRecord(value) || typeof value.id !== "number") {
    return false;
  }
  if (value.type === "solve-result") {
    return isRecord(value.result);
  }
  return (
    value.type === "solve-error" &&
    isRecord(value.error) &&
    typeof value.error.name === "string" &&
    typeof value.error.message === "string"
  );
}
