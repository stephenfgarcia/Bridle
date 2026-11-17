// The solver's Web Worker (card PX-02.8). The bundler of Next finds the worker by this exact expression, a
// `new Worker(new URL(..., import.meta.url))`, and compiles `@bridle/solver/worker` (packages/solver/src/worker.ts)
// with the solver into a file of its own, which the browser loads when the worker is made.

/** Makes the worker. Browser only: call it from an effect or an event handler, never while rendering. */
export function makeSolverWorker(): Worker {
  return new Worker(new URL("@bridle/solver/worker", import.meta.url), { type: "module" });
}
