/**
 * The worker entry across a real thread boundary. Node does not run the package's TypeScript source
 * as it is, so the test bundles ./worker.ts with Vite into one JavaScript file (as a bundler of a
 * web application would) and runs that file in a `node:worker_threads` worker. A few lines of glue
 * give the thread the two names a browser worker has, `self` and `postMessage`, and deliver its
 * messages to `self.onmessage`.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { type Model, portalFrame } from "@bridle/model";
import { build } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSolverClient, type SolverWorker, type SolverWorkerEvent } from "./client";
import type { SolveRequest } from "./messages";
import { solve } from "./solve";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "node_modules/.cache/solver-worker-test");
const bundle = resolve(outDir, "worker.mjs");

const GLUE = `
const { parentPort, workerData } = require("node:worker_threads");
globalThis.self = globalThis;
globalThis.postMessage = (message, transfer) => parentPort.postMessage(message, transfer);
import(workerData.url).then(() => {
  parentPort.on("message", (data) => globalThis.onmessage({ data }));
});
`;

const threads: Worker[] = [];

/** A thread that runs the bundled entry, behind the interface the client expects of a worker. */
function threadWorker(): SolverWorker {
  const thread = new Worker(GLUE, { eval: true, workerData: { url: pathToFileURL(bundle).href } });
  threads.push(thread);
  const adapter: SolverWorker = {
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    postMessage: (message: SolveRequest) => thread.postMessage(message),
    terminate: () => {
      void thread.terminate();
    },
  };
  thread.on("message", (data: unknown) => adapter.onmessage?.({ data }));
  thread.on("error", (error: SolverWorkerEvent) => adapter.onerror?.(error));
  thread.on("messageerror", (error: SolverWorkerEvent) => adapter.onmessageerror?.(error));
  return adapter;
}

function twoLoadCases(): Model {
  const model = portalFrame();
  model.loadCases.push({ id: "lc2", name: "LC2" });
  model.memberUniformLoads.push({
    id: "ul1",
    loadCaseId: "lc2",
    memberId: "b1",
    axes: "global",
    direction: "z",
    value: -10,
  });
  return model;
}

beforeAll(async () => {
  await build({
    configFile: false,
    root,
    logLevel: "error",
    build: {
      outDir,
      emptyOutDir: true,
      minify: false,
      target: "es2022",
      lib: { entry: resolve(root, "src/worker.ts"), formats: ["es"], fileName: () => "worker.mjs" },
    },
  });
}, 60_000);

afterAll(async () => {
  await Promise.all(threads.map((thread) => thread.terminate()));
});

describe("the worker entry in a real thread", () => {
  it("the bundled entry is one file that imports no other module", () => {
    const code = readFileSync(bundle, "utf8");
    expect(code).not.toMatch(/^\s*import\s/m);
    expect(code).not.toMatch(/\bimport\s*\(/);
    expect(code).not.toMatch(/\brequire\s*\(/);
    expect(code).not.toMatch(/\b(document|window|process)\./);
  });

  it("the portal frame's result comes back equal to a direct solve call", async () => {
    const client = createSolverClient(threadWorker);
    try {
      const outcome = await client.solve(portalFrame());
      const direct = solve(portalFrame());
      expect(outcome).toEqual({ status: "solved", result: direct });
      if (outcome.status !== "solved" || !outcome.result.ok || !direct.ok) {
        throw new Error("test: expected a solved result");
      }
      const received = outcome.result.loadCases.lc1;
      expect(received?.displacementVector).toBeInstanceOf(Float64Array);
      expect(received?.reactionVector).toBeInstanceOf(Float64Array);
      expect(Array.from(received?.displacementVector ?? [])).toEqual(
        Array.from(direct.loadCases.lc1?.displacementVector ?? []),
      );
      expect(received?.displacementVector).toHaveLength(24);
      expect(received?.memberEndForces).toEqual(direct.loadCases.lc1?.memberEndForces);
      expect(outcome.result.smallestPivotRatio).toBe(direct.smallestPivotRatio);
    } finally {
      client.dispose();
    }
  }, 30_000);

  it("the same thread answers several calls, a refusal included, and latest wins", async () => {
    const made: SolverWorker[] = [];
    const client = createSolverClient(() => {
      const worker = threadWorker();
      made.push(worker);
      return worker;
    });
    try {
      expect(await client.solve(twoLoadCases())).toEqual({
        status: "solved",
        result: solve(twoLoadCases()),
      });
      const unsupported = portalFrame();
      unsupported.supports = [];
      expect(await client.solve(unsupported)).toEqual({
        status: "solved",
        result: solve(unsupported),
      });
      const first = client.solve(portalFrame());
      const second = client.solve(twoLoadCases());
      expect(await first).toEqual({ status: "superseded" });
      expect(await second).toEqual({ status: "solved", result: solve(twoLoadCases()) });
      expect(made).toHaveLength(1);
    } finally {
      client.dispose();
    }
  }, 30_000);

  it("a model that makes solve throw comes back as a typed failure, and the thread keeps working", async () => {
    const client = createSolverClient(threadWorker);
    try {
      const outcome = await client.solve({} as unknown as Model);
      expect(outcome.status).toBe("failed");
      expect(outcome.status === "failed" && outcome.failure.kind).toBe("solve-threw");
      expect((await client.solve(portalFrame())).status).toBe("solved");
    } finally {
      client.dispose();
    }
  }, 30_000);
});
