// The design tokens of apps/web are a copy of docs/ux/tokens.css (card PX-02.1): the application image is built
// without docs/ (.dockerignore), so the app cannot import that file. This test fails when the two files differ.
// After a change of docs/ux/tokens.css: cp docs/ux/tokens.css apps/web/src/styles/tokens.css
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const copy = path.join(here, "tokens.css");
const source = path.join(here, "..", "..", "..", "..", "docs", "ux", "tokens.css");

test("src/styles/tokens.css is byte for byte docs/ux/tokens.css", () => {
  assert.ok(
    readFileSync(copy).equals(readFileSync(source)),
    "apps/web/src/styles/tokens.css differs from docs/ux/tokens.css: cp docs/ux/tokens.css apps/web/src/styles/tokens.css",
  );
});
