// The unit tests of apps/web that vitest runs: the TypeScript tests under src. `src/styles/tokens.test.mjs`
// stays on node's own test runner (the `test` script runs both).
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
