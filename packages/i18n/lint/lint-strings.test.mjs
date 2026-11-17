// Unit test of lint-strings.mjs (card P0-02.6): the failing and the passing fixture, the allowlist, the exit
// codes. JavaScript, so the package needs no node types; each case spawns the script as `pnpm lint` does.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, "lint-strings.mjs");
const FIXTURES = path.join(HERE, "fixtures");
const ALLOW_FAIL = JSON.parse(readFileSync(path.join(FIXTURES, "allow-fail.json"), "utf8"));

// Fixture LF: what the lint reports on fixtures/fail/page.tsx, in order.
const LF = [
  'property "Course settings"',
  'jsx-constant "Gradebook"',
  'prose "Submitted after the deadline"',
  'jsx-text "Welcome back"',
  'jsx-expression "Late"',
  'jsx-attribute "Beam diagram"',
  'jsx-attribute "Search"',
];

function lint(src, allow) {
  const result = spawnSync(process.execPath, [SCRIPT, "--src", src, "--allow", allow], {
    encoding: "utf8",
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

// A changed copy of allow-fail.json beside the fixtures' paths: the entries' `file` is relative to the
// allowlist's directory, so the sources are passed as that directory's sibling `fail`.
const scratch = mkdtempSync(path.join(tmpdir(), "lint-strings-"));
afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});
function allowlistWith(name, allow) {
  const file = path.join(scratch, name);
  writeFileSync(file, `${JSON.stringify({ allow }, null, 2)}\n`);
  return file;
}
const failEntries = (dir) =>
  ALLOW_FAIL.allow.map((entry) => ({
    ...entry,
    file: path.relative(scratch, path.join(dir, "page.tsx")).split(path.sep).join("/"),
  }));

describe("lint-strings", () => {
  it("fails on the failing fixture with the seven findings of fixture LF, in order", () => {
    const { status, stdout, stderr } = lint(
      path.join(FIXTURES, "fail"),
      path.join(FIXTURES, "allow-empty.json"),
    );
    expect(status).toBe(1);
    expect(stdout).toBe("");
    const lines = stderr.trimEnd().split("\n");
    const found = lines
      .slice(0, -1)
      .map((line) => /^.*page\.tsx:\d+:\d+ (.*)$/.exec(line)?.[1] ?? `unexpected line: ${line}`);
    expect(found).toEqual(LF);
    expect(lines.at(-1)).toBe(
      "lint-strings: FAILED: 7 hard-coded user-facing string(s), 0 stale allowlist entr(ies); 1 files checked",
    );
  });

  it("reports the line and the column of a finding", () => {
    const { stderr } = lint(path.join(FIXTURES, "fail"), path.join(FIXTURES, "allow-empty.json"));
    expect(stderr).toMatch(/page\.tsx:3:10 property "Course settings"\n/);
    expect(stderr).toMatch(/page\.tsx:6:17 jsx-constant "Gradebook"\n/);
  });

  it("passes on the passing fixture", () => {
    const { status, stdout, stderr } = lint(
      path.join(FIXTURES, "pass"),
      path.join(FIXTURES, "allow-empty.json"),
    );
    expect(stderr).toBe("");
    expect(status).toBe(0);
    expect(stdout).toBe("lint-strings: ok, 1 files checked, 0 allowlisted\n");
  });

  it("passes on the failing fixture when the allowlist holds its seven strings", () => {
    const { status, stdout, stderr } = lint(
      path.join(FIXTURES, "fail"),
      path.join(FIXTURES, "allow-fail.json"),
    );
    expect(stderr).toBe("");
    expect(status).toBe(0);
    expect(stdout).toBe("lint-strings: ok, 1 files checked, 7 allowlisted\n");
  });

  it("fails on a stale allowlist entry, naming it", () => {
    const allow = allowlistWith("stale.json", [
      ...failEntries(path.join(FIXTURES, "fail")),
      { file: "fail/page.tsx", text: "No such string", reason: "stale on purpose" },
    ]);
    const { status, stderr } = lint(path.join(FIXTURES, "fail"), allow);
    expect(status).toBe(1);
    expect(stderr).toMatch(
      /stale allowlist entry \{"file":"fail\/page\.tsx","text":"No such string"\}/,
    );
    expect(stderr).toMatch(
      /lint-strings: FAILED: 0 hard-coded user-facing string\(s\), 1 stale allowlist entr\(ies\); 1 files checked\n$/,
    );
  });

  it("exits 2 on an allowlist entry without a reason", () => {
    const entries = failEntries(path.join(FIXTURES, "fail"));
    const allow = allowlistWith("no-reason.json", [
      ...entries.slice(1),
      { file: entries[0].file, text: entries[0].text },
    ]);
    const { status, stderr } = lint(path.join(FIXTURES, "fail"), allow);
    expect(status).toBe(2);
    expect(stderr).toMatch(/cannot use the allowlist .*no non-empty "reason"/);
  });

  it("exits 2 on an allowlist entry with an empty reason, on a missing allowlist and on an unknown flag", () => {
    const entries = failEntries(path.join(FIXTURES, "fail"));
    const blank = allowlistWith("blank-reason.json", [{ ...entries[0], reason: "  " }]);
    expect(lint(path.join(FIXTURES, "fail"), blank).status).toBe(2);
    expect(lint(path.join(FIXTURES, "fail"), path.join(scratch, "missing.json")).status).toBe(2);
    const unknown = spawnSync(process.execPath, [SCRIPT, "--fix"], { encoding: "utf8" });
    expect(unknown.status).toBe(2);
    expect(unknown.stderr).toMatch(/^usage: /);
  });
});
