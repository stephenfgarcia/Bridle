/**
 * Writes `docs/content/tasks.md` from the task data: `pnpm --filter @bridle/tasks run docs`
 * (with `run`: `pnpm docs` by itself is a command of pnpm, not this script).
 *
 * It runs under vitest (`vitest.docs.config.ts`) because the workspace packages export TypeScript
 * sources and vitest is the tool every package already has that loads them. `pnpm test` does not
 * run this file: its name does not match vitest's default pattern.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { renderTasksDocument, seededTasks, TASKS_DOCUMENT_PATH } from "../src/index";

test(`writes ${TASKS_DOCUMENT_PATH}`, () => {
  const path = fileURLToPath(new URL(`../../../${TASKS_DOCUMENT_PATH}`, import.meta.url));
  const text = renderTasksDocument(seededTasks());
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  expect(text.endsWith("\n")).toBe(true);
});
