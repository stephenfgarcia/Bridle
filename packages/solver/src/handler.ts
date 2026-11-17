/**
 * The handling of one request, as a pure function: no worker, no global. ./worker.ts wires it to a
 * worker's messages; the tests call it directly.
 */
import type { Model } from "@bridle/model";
import type { SolveErrorInfo, SolveRequest, SolveResponse } from "./messages";
import { type SolveResult, solve } from "./solve";

/** A response and the buffers to hand over with it (the second argument of `postMessage`). */
export interface HandledRequest {
  response: SolveResponse;
  transfer: ArrayBuffer[];
}

function errorInfo(thrown: unknown): SolveErrorInfo {
  if (thrown instanceof Error) {
    return { name: thrown.name, message: thrown.message };
  }
  return { name: "Error", message: String(thrown) };
}

/**
 * The buffers of the `Float64Array`s of a result: two per load case (`displacementVector` and
 * `reactionVector`), none for a refusal. Each buffer is listed once. Posting the result with this
 * list moves the buffers instead of copying them; the arrays of the sender are then empty.
 */
export function transferList(result: SolveResult): ArrayBuffer[] {
  if (!result.ok) {
    return [];
  }
  const buffers = new Set<ArrayBuffer>();
  for (const loadCase of Object.values(result.loadCases)) {
    for (const vector of [loadCase.displacementVector, loadCase.reactionVector]) {
      if (vector.buffer instanceof ArrayBuffer) {
        buffers.add(vector.buffer);
      }
    }
  }
  return [...buffers];
}

/**
 * Runs `solve` for one request and returns the response with the same id. When `solve` throws, the
 * response is a `solve-error` with the name and the message of what was thrown, and nothing to
 * transfer. `solveModel` is `solve`; a test passes another function to make it throw.
 */
export function handleSolveRequest(
  request: SolveRequest,
  solveModel: (model: Model) => SolveResult = solve,
): HandledRequest {
  try {
    const result = solveModel(request.model);
    return {
      response: { type: "solve-result", id: request.id, result },
      transfer: transferList(result),
    };
  } catch (thrown) {
    return {
      response: { type: "solve-error", id: request.id, error: errorInfo(thrown) },
      transfer: [],
    };
  }
}
