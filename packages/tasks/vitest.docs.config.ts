import { defineConfig } from "vitest/config";

/** The configuration of `pnpm --filter @bridle/tasks run docs`: it runs the one file that writes the document. */
export default defineConfig({
  test: {
    include: ["scripts/write-document.ts"],
  },
});
