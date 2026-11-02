---
id: P0-04
title: Monitor JSONL validator (first card through the factory)
phase: P0
order: 4
dependsOn: [P0-03]
station: plan
status: running
owner: factory-planner
updated: 2026-11-02T20:31:57Z
history:
  - 2026-11-02T20:31:57Z spec running orchestrator "Spec ready: validator for .bridle/progress JSONL files; 5 acceptance criteria"
  - 2026-11-02T20:31:57Z plan running factory-planner "Planning: factory-planner spawned"
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


## Build


## Test


## Review


## Ship

