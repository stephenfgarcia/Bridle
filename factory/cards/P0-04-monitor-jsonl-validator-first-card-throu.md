---
id: P0-04
title: Monitor JSONL validator (first card through the factory)
phase: P0
order: 4
dependsOn: [P0-03]
station: review
status: running
owner: factory-reviewer
updated: 2026-11-02T21:08:36Z
history:
  - 2026-11-02T20:31:57Z spec running orchestrator "Spec ready: validator for .bridle/progress JSONL files; 5 acceptance criteria"
  - 2026-11-02T20:31:57Z plan running factory-planner "Planning: factory-planner spawned"
  - 2026-11-02T20:40:00Z build running factory-builder "Plan accepted (7 steps, 5 tests); factory-builder spawned"
  - 2026-11-02T20:55:20Z test running factory-tester "Build accepted: tools/monitor/check.py + README line; factory-tester spawned"
  - 2026-11-02T21:08:36Z review running factory-reviewer "Tests pass (6 tests, 0.46 s); factory-reviewer spawned"
---

# P0-04 Monitor JSONL validator (first card through the factory)

## Spec

What: `tools/monitor/check.py`, a validator for the monitor's local event logs (`.bridle/progress/<runId>/<agentId>.jsonl`).
Why: agents, `log.sh`, `card.py`, and `backfill.py` all write these files, and the sync procedure mirrors them into the
monitor's database; a malformed line should be caught here, before it is mirrored or dropped silently by the page.

Acceptance criteria:
1. `python3 tools/monitor/check.py` with no arguments validates every `*.jsonl` under `.bridle/progress/`, prints one
   line per file (`path  lines=N  problems=M`), ends with a totals line, and exits 0 when every line is valid.
2. Each invalid line is reported as `path:line: reason`, and the exit code is 1 when any line is invalid. Reasons to
   detect: not JSON; not a JSON object; a missing required field (`id, ts, tsMs, runId, phase, taskId, agentId, type,
   level, message`); `type` not in {run.start, run.end, task.status, agent.start, agent.progress, agent.log,
   agent.heartbeat, agent.done, agent.fail, note, card.move}; `level` not in {debug, info, warn, error};
   `progress` present but not a number in 0..100; `id` not equal to `<tsMs>-<agentId>-<seq padded to 4>`
   (backfilled events use `seq` 1 or 2, so this rule holds for them too); `tsMs` not within 2 seconds of `ts`.
3. `--run <runId>` restricts the check to that run's directory; a run directory that does not exist is reported on
   stderr with exit code 2.
4. `--summary` prints, after the per-file lines, one line per agent in the checked files: agent id, last event type,
   last `ts`, last known `progress` (or `-`), and `status` from the last event that carried one.
5. Pure Python 3 standard library; no third-party packages; runs in under a second on a few thousand lines.

Files likely touched: `tools/monitor/check.py` (new), `tools/monitor/test/check.test.py` (new, written by the test
station), one line in `tools/monitor/README.md`.
Out of scope: fixing or rewriting files, talking to the artifact database, validating the `data` payloads.


## Plan

Contract (the builder implements it, the tester asserts it verbatim). `tools/monitor/check.py`, stdlib only, `ROOT`
resolved from `__file__` as in `card.py`, default root `<repo>/.bridle/progress`.

- CLI: `python3 tools/monitor/check.py [--run <runId>] [--summary] [--root <dir>]`. `--root` lets tests point at a
  temp fixture tree; `.bridle/progress/` is gitignored and is never a test input.
- Discovery: every `*.jsonl` under the root (recursive, sorted); `--run X` uses `<root>/X`. Missing root or run dir:
  one line on stderr (`check.py: no progress directory <path>`), no stdout, exit 2. Present but empty: totals, exit 0.
- Lines: read bytes, decode each line as UTF-8 (undecodable = not JSON); blank lines are skipped and not counted
  (log.sh counts `seq` the same way); `path:line:` is the physical 1-based line number; `lines=N` counts non-blank lines.
- Stdout, per file: its `path:line: reason` lines, then `path  lines=N  problems=M` (two spaces; path relative to cwd
  when under it, else absolute, so it always ends in `<runId>/<agentId>.jsonl`). After all files:
  `total  files=F  lines=N  problems=M`. With `--summary`, after the totals, one sorted line per agent:
  `agent  <runId>/<agentId>  last=<type>  ts=<ts>  progress=<n|->  status=<status|->` (key = run dir + `agentId`
  field, file stem if absent; last = highest `tsMs`, ties to the later line; progress and status come from the latest
  event carrying that key; only lines that parsed as objects count). Exit code: 2 beats 1 (any problem) beats 0.
- Reasons, checked in this order, at most one per rule per line; a rule whose inputs are missing is skipped because
  the missing field is already reported (no cascades):
  `not JSON: <decoder message>` (stop) | `not a JSON object` (stop) | `missing required field: <name>` (one per field,
  spec order) | `type not allowed: <v>` | `level not allowed: <v>` | `progress not a number in 0..100: <v>` (bool is
  not a number; NaN fails) | `id mismatch: expected <tsMs>-<agentId>-<seq:04d>` when `seq` is an int, else
  `id does not match <tsMs>-<agentId>-NNNN` (4+ digits) | `tsMs not within 2 s of ts` (also when `ts` is not ISO-8601
  or `tsMs` is not a number; parse with `datetime.fromisoformat(ts.replace('Z', '+00:00'))`, naive = UTC; all three
  writers derive `ts` from the `tsMs` clock, so backfilled lines pass).

Steps (one new file plus one README line; nothing else changes):
1. Add `tools/monitor/check.py`: docstring with usage and exit codes; `REQUIRED`, `TYPES`, `LEVELS` copied from the
   spec; `ROOT`; argparse for `--run`, `--summary`, `--root`; `main(argv=None) -> int`; `sys.exit(main())` guard.
2. Same file: `check_event(obj) -> list[str]`, the rule chain above over one parsed object (pure, no I/O).
3. Same file: `check_file(path) -> (lines, problems [(lineno, reason)], events [(lineno, obj)])`: bytes in, per-line
   decode, blank skip, `json.loads`, `check_event`.
4. Same file: `main` resolves the root and run dir (exit 2 path), discovers files, prints per-file and totals lines.
5. Same file: `summarize(events_by_file) -> list[str]` for `--summary`, printed after the totals line.
6. `tools/monitor/README.md`, "## Tests": one line naming `python3 tools/monitor/check.py [--run <runId>] [--summary]`
   (exit 0 valid, 1 bad line, 2 missing run) and `python3 tools/monitor/test/check.test.py`.
7. Builder's proof: `python3 tools/monitor/check.py` and `--summary` on the real tree (today 20 files, 47 lines, 0
   problems, exit 0, verified while planning); `--run nope` (stderr, exit 2); one hand-made bad line under `--root`.

Tests: `tools/monitor/test/check.test.py` (unittest; run `python3 tools/monitor/test/check.test.py`; the dotted name
cannot be imported, so run the file). Helpers: `mk(tsMs, agent, seq, **fields)` builds a valid line exactly as log.sh
does (`ts` = `tsMs // 1000` as `%Y-%m-%dT%H:%M:%SZ`, `id` = `<tsMs>-<agent>-<seq:04d>`); `run(*args)` writes a temp
root and runs `[sys.executable, CHECK, "--root", tmp, *args]` with `subprocess.run(capture_output=True, text=True)`.
- AC1 `test_all_valid`: 2 runs / 3 files, all valid: one `<run>/<agent>.jsonl  lines=N  problems=0` line per file,
  last stdout line `total  files=3  lines=N  problems=0`, empty stderr, exit 0.
- AC2 `test_each_reason`: one file, one line per reason (not JSON; `[1]`; missing `message`; type `agent.poke`;
  level `LOUD`; progress 150; progress `"50"`; progress `true`; wrong id; `tsMs` 5 s off) plus a valid log.sh line and
  a valid backfill-shaped line (backfill key order, `seq` 2, `data.backfilled`): each `path:<n>: <reason>` present
  with the right line number, `problems=10`, no reason for the two valid lines, exit 1.
- AC3 `test_run_filter`: `--run a` prints only run a's file; `--run nope`: empty stdout, stderr names `nope`, exit 2.
- AC4 `test_summary`: agent.start (progress 0), agent.progress 40 with status running, agent.log without progress:
  `agent  r/a  last=agent.log  ts=<log ts>  progress=40  status=running`; an agent with neither field shows
  `progress=-  status=-`; summary lines follow the totals line.
- AC5 `test_stdlib_and_speed`: `ast`-parse check.py, every imported top-level module is in `sys.stdlib_module_names`;
  5,000 generated valid lines over 5 files: exit 0 and under 1.0 s wall time around the subprocess.

Risks and how to check them:
- Output drift between build and test: the contract above is the single source; tests assert the file, totals and
  summary lines whole and the reasons by prefix (the decoder message varies).
- `isinstance(True, int)` is true: exclude bool or `progress: true` passes (the AC2 test covers it).
- Portability: `fromisoformat` takes a bare `Z` only on 3.11+ (hence the replace); `sys.stdlib_module_names` is 3.10+
  (this machine runs 3.14; the test may fall back to an allowlist).
- Cascading reasons inflate `problems=`: the skip rule above; the AC2 test counts problems exactly.
- The real tree passes today; if the builder's smoke run reports problems, suspect the validator, not the data.

Leave alone: `log.sh`, `card.py`, `backfill.py`, `ops.sh`, `index.html`, `monitor.test.js`. Not checked (not in the
spec; candidates for a later card): `seq` against line position (backfill appends seq 1/2 after existing lines by
design), `agentId` against the file name, `runId` against the directory name, the `data` payload, `agentLabel`, `step`.
No fixing or rewriting of files, no database access, no third-party packages, no fixtures committed under `.bridle/`.


## Build

Files: `tools/monitor/check.py` (new, executable; stdlib only: argparse, datetime, json, os, re, sys) and
`tools/monitor/README.md` (one line under "## Tests", with a blank line before it so it reads as its own paragraph).
Nothing else changed; no commit.

Run: `python3 tools/monitor/check.py [--run <runId>] [--summary] [--root <dir>]` (`--help` lists the flags). Proof on
2026-11-02 from the repo root (the real tree has grown since the plan was written; other agents keep appending to it):
- `python3 tools/monitor/check.py`: 22 per-file lines, `total  files=22  lines=60  problems=0`, exit 0. `--summary` adds
  22 `agent  <run>/<agent>  last=...  ts=...  progress=...  status=...` lines after the totals. `--run factory`: 5 files,
  `total  files=5  lines=8  problems=0`, exit 0.
- `python3 tools/monitor/check.py --run nope`: empty stdout, stderr `check.py: no progress directory
  <repo>/.bridle/progress/nope`, exit 2.
- Hand-made file under `--root` (in the session scratchpad, not the repo): a valid line, a truncated JSON line, a line with
  `type: agent.poke` gave `<path>:2: not JSON: Unterminated string starting at: line 1 column 32 (char 31)`,
  `<path>:3: type not allowed: agent.poke`, `<path>  lines=3  problems=2`, `total  files=1  lines=3  problems=2`, exit 1,
  and with `--summary` `agent  r/a  last=agent.poke  ts=...  progress=40  status=running`.
- 5,000 generated valid lines over 5 files with `--summary`: exit 0, 0.10 s wall including interpreter start-up.
- An `ast` walk of the imports: all six top-level modules are in `sys.stdlib_module_names`.
- Beyond the plan's list, `check_event`, `check_file` and `summarize` were exercised on 40-odd hand-built cases (every
  reason, no cascades, bool/NaN/string progress, seq int vs regex path, naive and offset `ts`, CRLF, undecodable bytes,
  tsMs ties). That scratch script is not part of the deliverable; the test station writes the real tests.

Structure, one function per plan step, importable without side effects (`importlib` by path works, as does running the
file): `check_event(obj) -> list[str]` (pure rule chain), `check_file(path) -> (lines, problems, events)` with
`problems = [(lineno, reason)]` and `events = [(lineno, obj)]`, `discover(base)`, `display(path)`, `run_dir(root, path)`,
`summarize(events_by_file) -> list[str]` with `events_by_file = [(run_dir, stem, events), ...]` in file order, and
`main(argv=None) -> int`.

Deviations from the plan: none in behaviour. Steps 1 to 5 were written into the file in one pass in the plan's order and
each step was verified on its own before the next was logged.

For the tester and reviewer:
- `<v>` in a reason is the value as written: strings bare (`type not allowed: agent.poke`, `level not allowed: LOUD`,
  `progress not a number in 0..100: 150`), anything else in JSON notation (`: true`, `: null`, `: [1]`, `: NaN`). A
  progress string `"50"` prints as `progress not a number in 0..100: 50`; a bare in-range number there always means
  "not a number", because a real number in 0..100 is never reported.
- `not JSON: <decoder message>` carries Python's `json` message for syntax errors and the `UnicodeDecodeError` message
  for undecodable bytes; assert that reason by prefix.
- To make a line fail only the ts rule, shift `ts`, not `tsMs`: the id embeds `tsMs`, so a shifted `tsMs` also fails the
  id rule and the line gets two reasons (and `problems=` counts reasons, one printed line each). A `tsMs` written as a
  digit string gets exactly one reason (the ts rule); the id rule matches it literally.
- `missing required field` means key absence only; a present `null` is judged by that field's own rule (`type not
  allowed: null`, `tsMs not within 2 s of ts`), still one reason per defect.
- Summary: an event whose `tsMs` is missing or not a number sorts before every numeric one (ties go to the later line);
  a file directly under the root (no run directory) is keyed by `agentId` alone; `--run X` still prints keys as
  `X/<agentId>`; the real tree shows `factory/P0-04-plan ... progress=80` because its `agent.done` carried no progress,
  which is the contract's "latest event carrying that key".
- Not checked, as the plan lists: `seq` against line position, `agentId` against the file name, `runId` against the
  directory, `data`, `agentLabel`, `step`. Nothing is fixed or rewritten; no database access.
- Working tree: while this build ran, `tools/monitor/index.html` appeared as modified in `git diff --stat` (mtime
  2026-11-02T20:49:52Z, after this build's `agent.start`); it is clean again against HEAD fdb22a2 by the end of the build. This station never
  opened or changed it; whatever touched it is other work, not part of this card. `docs/` (untracked) is not this
  card's either. `tools/monitor/__pycache__/`, created by the builder's `py_compile` check, was removed.


## Test

RESULT: PASS

Command (from the repo root; unittest, verbosity 2, standard library only, Python 3.14.3, run 2026-11-02):
`python3 tools/monitor/test/check.test.py` -> `Ran 6 tests in 0.458s`, `OK`, exit 0. Six tests, six pass, no failures.

File: `tools/monitor/test/check.test.py` (new; nothing else added or changed; `check.py` and the README untouched). Every
test runs `check.py` as a subprocess exactly as documented, `[sys.executable, check.py, --root, <tmp>, *args]`, where
`<tmp>` is a `tempfile.TemporaryDirectory` (removed after the test) that is also the subprocess's cwd, so paths print as
`<runId>/<agentId>.jsonl` and every stdout and stderr line is asserted whole, by list equality; only the decoder message
after `not JSON: ` is asserted by prefix. `.bridle/progress` is never read, no fixture is written inside the repository,
and nothing is imported from `check.py`, so no `__pycache__` appears. Helpers: `iso(ms)` (`ts` as log.sh writes it,
anchored by `iso(1700000000000) == 2023-11-14T22:13:20Z` at import), `mk(tsMs, agent, seq, **fields)` (a valid line in
log.sh's key order; `OMIT` drops a field; the id is computed from the given tsMs/agent/seq, so overriding `ts` fails only
the ts rule and overriding `id` only the id rule), `backfill(...)` (backfill.py's key order, `data.backfilled`, seq 1/2),
`tree(files)`, `check(root, *args)`, `run(files, *args)`.

Tests, the criterion each covers, and its result:
- `test_all_valid`, AC1, pass: 2 runs / 3 files / 11 valid lines covering all 11 types, all 4 levels, progress 0, 33.5
  and 100, `step`, `status`, `data`, a non-ASCII message. Stdout is exactly `a/x.jsonl  lines=3  problems=0`,
  `a/y.jsonl  lines=2  problems=0`, `b/orchestrator.jsonl  lines=6  problems=0`, `total  files=3  lines=11  problems=0`;
  stderr empty; exit 0.
- `test_each_reason`, AC2, pass: one file with, in the plan's order, truncated JSON, `[1]`, a blank line (skipped and not
  counted, but it keeps its physical number), missing `message`, type `agent.poke`, level `LOUD`, progress 150, `"50"`,
  `true`, id `nope` (seq 9), `ts` shifted 5 s (not `tsMs`, so only the ts rule fails), then a valid log.sh line and a
  valid backfill-shaped line (seq 2). Asserts the ten `r/a.jsonl:<n>: <reason>` lines with their physical numbers (1, 2,
  4 to 11) and exact text (`id mismatch: expected 1700000000000-a-0009`, `progress not a number in 0..100: 50` for the
  string, `: true` for the bool, `: 150`), nothing for lines 12 and 13, `r/a.jsonl  lines=12  problems=10`,
  `total  files=1  lines=12  problems=10`, stderr empty, exit 1.
- `test_reason_corners`, AC2 (contract corners beyond the plan's ten), pass: a missing `tsMs` gives exactly one reason,
  no id or ts cascade; `tsMs` as a digit string gives only `tsMs not within 2 s of ts`; without `seq` an id ending in four
  digits passes and `...-a-4` gives `id does not match 1700000000000-a-NNNN`; `type: null` gives `type not allowed: null`;
  progress NaN gives `progress not a number in 0..100: NaN`; `lines=6  problems=5`; exit 1.
- `test_run_filter`, AC3, pass: `--run a` prints only `a/x.jsonl  lines=2  problems=0` and
  `total  files=1  lines=2  problems=0` (run b's file absent), stderr empty, exit 0; `--run nope`: empty stdout, stderr
  exactly `check.py: no progress directory <root>/nope`, exit 2.
- `test_summary`, AC4, pass: agent a = agent.start (progress 0), agent.progress 40 with status running, agent.log with
  neither, plus a backfill-shaped agent.start 10 s older appended as the last physical line (must not become "last");
  agent b = one agent.log. With `--summary` stdout is the two per-file lines, the totals, then exactly
  `agent  r/a  last=agent.log  ts=2023-11-14T22:13:22Z  progress=40  status=running` and
  `agent  r/b  last=agent.log  ts=2023-11-14T22:13:23Z  progress=-  status=-`; without the flag, no agent lines.
- `test_stdlib_and_speed`, AC5, pass: an `ast` walk of check.py's imports, every top-level module in
  `sys.stdlib_module_names` (allowlist fallback below 3.10); 5,000 generated valid lines over 5 files with `--summary`:
  exit 0, `total  files=5  lines=5000  problems=0`, five agent lines, wall time asserted under 1.0 s around the subprocess
  (measured separately with the same tree: median 0.058 s, max 0.132 s over five runs, interpreter start-up included);
  the same tree under `python3 -S` (no site-packages on sys.path) also exits 0.

Verbatim result:
```
$ python3 tools/monitor/test/check.test.py; echo "EXIT=$?"
test_all_valid (__main__.CheckTests.test_all_valid)
AC1: every file is listed as `path  lines=N  problems=0`, the totals line ends stdout, exit 0. ... ok
test_each_reason (__main__.CheckTests.test_each_reason)
AC2: every reason is reported as `path:line: reason` with the physical line number; exit 1. ... ok
test_reason_corners (__main__.CheckTests.test_reason_corners)
AC2 (contract corners): one reason per defect, no cascades; the id rule without `seq`; null and NaN. ... ok
test_run_filter (__main__.CheckTests.test_run_filter)
AC3: --run restricts the check to that run's directory; a missing run is one stderr line and exit 2. ... ok
test_stdlib_and_speed (__main__.CheckTests.test_stdlib_and_speed)
AC5: check.py imports only the standard library and validates 5,000 lines in under a second. ... ok
test_summary (__main__.CheckTests.test_summary)
AC4: --summary adds, after the totals, one line per agent: last type and ts, latest progress and status. ... ok

----------------------------------------------------------------------
Ran 6 tests in 0.458s

OK
EXIT=0
```

Notes for the reviewer:
- The tests bite. Run (in the session scratchpad, never the repo) against five one-line mutants of check.py, each was
  caught by the test for its criterion: bool accepted as progress -> test_each_reason; skew widened to 6 s ->
  test_each_reason; summary "last" taken in file order instead of by tsMs -> test_summary; missing run directory exiting
  1 -> test_run_filter; a third-party import added -> the whole suite (the ast check in test_stdlib_and_speed, and every
  subprocess run, that module being absent here).
- The first run of the file raised a `TypeError` in my own `mk` helper (`seq` is positional, so `seq=OMIT` collided);
  fixed in the test file (`mk(ms, agent, OMIT, id=...)`). The five planned tests passed on that first run as well. No
  product code was touched and there is nothing to send back to the builder.
- Working tree after this station: `tools/monitor/test/check.test.py` is the only new file; the files the build left
  modified or untracked (the four cards, `tools/monitor/README.md`, `tools/monitor/check.py`) are as it left them. No
  commit.


## Review

VERDICT: PASS

Findings (advisory only; neither breaks the spec or the exit criteria):
- `tools/monitor/check.py:88` (robustness): a `tsMs` written as an integer literal too large for a float (309 to
  4,300 digits; `json.loads` accepts it, longer ones already come back as `not JSON` from Python's int-to-str limit)
  makes `abs(ms - reference)` raise `OverflowError: int too large to convert to float`, so the run dies with a
  traceback: exit 1 but no `path:line: reason`, no per-file or totals line, later files unchecked. No writer
  produces such a value and no acceptance criterion reaches it. Fix: compute the skew as
  `try: off = abs(float(ms) - reference) except OverflowError: off = float('inf')` and test `off <= SKEW_MS`, so the
  line gets `tsMs not within 2 s of ts` like every other bad `tsMs`. Infinite floats (`1e400`) and deeply nested
  lines (100,000 `[`) are already reported, not crashed (probed in the session scratchpad).
- `tools/monitor/check.py:168-170` (by design, worth knowing): `--summary` takes `progress` and `status` from the
  latest event carrying the key even when that event failed validation, so a `progress` of `150` or `"50"` shows as
  `progress=150` / `progress=50` under the problem lines that report it. Nothing is hidden and the spec's "last known
  progress" allows it; if the summary should reflect valid values only, skip events for which `check_event` returned
  reasons when filling the `progress`/`status` tables.

Checked and found fine: AC1 to AC5 each map to a passing test (`test_all_valid`, `test_each_reason` +
`test_reason_corners`, `test_run_filter`, `test_summary`, `test_stdlib_and_speed`); `python3 tools/monitor/test/check.test.py`
re-run from the repo root gives `Ran 6 tests in 0.457s`, `OK`, exit 0; `python3 tools/monitor/check.py --summary` on the
real tree gives `total  files=36  lines=117  problems=0`, 36 agent lines, exit 0 (the Build section's 22/60 were this
tree's counts at build time; it keeps growing, as the card says), `--run nope` gives the one stderr line and exit 2,
`--run factory` 9 files / 24 lines / 0 problems; every spec reason is detected in the spec's set and wording, one
reason per defect with no cascades, bool and NaN progress rejected, the id rule holds for log.sh (`seq:04d`, id last)
and backfill.py (seq 1/2) shapes, `ts`/`tsMs` skew is 2,000 ms; two one-line mutants (skew 6 s, bool accepted as
progress) run in the scratchpad are each caught by `test_each_reason`; stdlib only (argparse, datetime, json, os, re,
sys), no secrets, no dead code, no silent error swallowing (decode and JSON errors become reported reasons, `ts` parse
failures become the ts reason by contract, nothing else is caught); the diff is exactly the two new files plus a
blank line and one line under "## Tests" in `tools/monitor/README.md`; `check.py` is executable as Build states, no
`__pycache__` left behind, `.bridle/progress` is never read by the tests and no fixture lives in the repo; the other
modified files in the tree (PLAN-01 shipped, PLAN-02/03 launched, this card's frontmatter) are the foreman's, and
`docs/.DS_Store` is gitignored; Build and Test sections are filled and match what the code and the runs show.


## Ship

