// The speed test of `solve`: `pnpm --filter @bridle/solver bench`.
//
// Node does not run the package's TypeScript source as it is, so this script first bundles
// src/bench.ts (with the solver and @bridle/model) into one JavaScript file with Vite, not minified,
// under node_modules/.cache, then imports that file and prints the table. The models and the timing
// are in src/bench.ts.
import { cpus } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "node_modules/.cache/solver-bench");

await build({
  configFile: false,
  root,
  logLevel: "error",
  build: {
    outDir,
    emptyOutDir: true,
    minify: false,
    target: "es2022",
    lib: { entry: resolve(root, "src/bench.ts"), formats: ["es"], fileName: () => "bench.mjs" },
  },
});

const { formatBench, runBench } = await import(pathToFileURL(resolve(outDir, "bench.mjs")).href);

const RUNS = 15;
const WARM_UP = 3;
const rows = runBench(RUNS, WARM_UP);

const now = new Date();
const two = (n) => String(n).padStart(2, "0");
const today = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`; // local date
console.log(
  `solve(model): median of ${RUNS} calls after ${WARM_UP} warm-up calls, one thread, ${today}`,
);
console.log(`node ${process.version}, ${process.platform} ${process.arch}, ${cpus()[0]?.model}`);
console.log("");
console.log(formatBench(rows));
