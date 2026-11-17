/**
 * The worker entry (`@bridle/solver/worker`): load this file as a module worker. It answers every
 * `SolveRequest` it receives with one `SolveResponse` and ignores any other message. The work is in
 * ./handler.ts.
 */
import { handleSolveRequest } from "./handler";
import { isSolveRequest } from "./messages";

/** The two members of a worker's global scope that this file uses. */
interface WorkerScope {
  onmessage: ((event: { data: unknown }) => void) | null;
  postMessage(message: unknown, transfer: ArrayBuffer[]): void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (event) => {
  if (!isSolveRequest(event.data)) {
    return;
  }
  const { response, transfer } = handleSolveRequest(event.data);
  scope.postMessage(response, transfer);
};
