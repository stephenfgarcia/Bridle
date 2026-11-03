---
id: P0-10
title: Monitor v4: live progress
phase: P0
order: 10
dependsOn: [P0-04]
station: review
status: running
owner: orchestrator
updated: 2026-11-03T09:15:35Z
history:
  - 2026-11-03T08:42:22Z spec running orchestrator "Spec: live strip, 1 Hz tick, automatic tracing + mirror, local viewer (plan approved 2026-11-03)"
  - 2026-11-03T08:42:22Z plan running orchestrator "Plan: ~/.claude/plans/can-we-plan-on-floofy-forest.md (Parts 1-3)"
  - 2026-11-03T08:42:22Z build running orchestrator "Building directly in the main session (tooling card, no station agents)"
  - 2026-11-03T09:15:35Z test running orchestrator "Tests: monitor.test.js (7 groups), check/mirror/serve suites OK; real tree validates clean; headless render checked"
  - 2026-11-03T09:15:35Z review running orchestrator "Self-review PASS: 5 acceptance criteria covered; no secrets traced; hooks async"
---

# P0-10 Monitor v4: live progress

## Spec

What: Monitor v4, "live progress": the Bridle Build Monitor page (`tools/monitor/index.html`) shows motion every second
and the current action of every working agent, and events reach the artifact automatically; a local viewer serves the
same page from the files with sub-second updates.
Why: the user reported the monitor "feels lacking on realtime progress tracking and live monitoring of current progress".
Root causes: events reached the database only when an agent remembered to call db_write at step boundaries (and
Plan/Explore/Workflow agents could not), and the page refreshed time text every 30 s with no live strip.

Acceptance criteria:
1. A pinned "Working now" strip shows, per running or stale agent: step n of m, progress, elapsed in step and total,
   quiet time with colour thresholds (60 s, 5 min, stale at 10 min), typical duration from history, and the last
   action (tool calls or message); all times tick every second without rebuilding the DOM.
2. Subagent tool calls are traced automatically by a Claude Code hook (identity from the MONITOR marker or a log.sh
   command in the agent's prompt) and folded by `mirror.py` into one `agent.activity` event per agent per mirror
   pass; an agent that stops without agent.done gets an automatic one.
3. `mirror.py` mirrors unmirrored lines with cursors, outbox and idempotency keys; `watch.sh` wakes the foreman only
   when something is pending and never while a batch is in flight; the skill documents the procedure.
4. The page keeps evicted window events (up to 5,000), shows events per minute and the sync lag, draws step segments
   and activity ticks on the timeline, and highlights new lines.
5. `serve.py` serves the page at localhost with an SSE replay and tail, including ephemeral activity for raw traces.

Files: tools/monitor/{index.html, monlib.py, mirror.py, trace_hook.py, trace-hook.sh, watch.sh, serve.py, log.sh,
check.py, README.md, sync.md}, tools/monitor/test/*, .claude/settings.json, .claude/skills/factory/SKILL.md,
factory/README.md, .bridle/monitor.json.
Out of scope: product code, the card format, a new artifact, push notifications, changing how Workflow-tool agents
are launched (their hook coverage is undocumented; backfill.py remains their fallback).

## Plan

The approved plan is `~/.claude/plans/can-we-plan-on-floofy-forest.md` (2026-11-03): Part 1 write path (hook,
mirror.py, watch.sh, log.sh -i/-n, check.py agent.activity), Part 2 read path (constants and normEvent, derive()
extensions, ingestion and memory, 1 Hz tick with data attributes, live strip, header freshness and sparkline,
timeline segments and ticks, feeds and logs, agent cards, local source, seed tasks from the cards, CSS, tests),
Part 3 local viewer (serve.py + test). Decisions: republish the existing artifact; 5 s poll interval
(effective artifact latency one mirror pass plus one Claude turn); local viewer included; hook tracing on.

## Build

Added: tools/monitor/monlib.py (shared writer: id/seq rule, marker parsing, trace folding), mirror.py (pending/poll/
ack/status/init/prune-plan; state in .bridle/progress/.mirror/), trace_hook.py + trace-hook.sh (PostToolUse,
PostToolUseFailure, SubagentStop), watch.sh (one line per due mirror pass), serve.py (local viewer, SSE),
.claude/settings.json (async hooks), tests mirror.test.py and serve.test.py.
Changed: index.html rewritten (1,700 lines: live strip, tick loop, sparkline, sync lag, eviction bookkeeping,
step segments, activity ticks, local source, seed tasks regenerated from the 63 cards), monitor.test.js (7 groups),
log.sh (-i/-n, agent.activity), check.py (agent.activity; skips *.trace.jsonl and dot-directories), check.test.py,
README.md (protocol v2), sync.md (replay and pruning), factory/README.md, SKILL.md (watch arming, sync command,
marker line, no hand mirroring), .bridle/monitor.json (syncIntervalSeconds 5, viewer, protocol).
Run: `python3 tools/monitor/serve.py` then open http://127.0.0.1:8787/; foreman: see SKILL.md step 0.
Deviations from the plan: agent families use the first two name parts (arch-judge) instead of the prefix up to the
last dash (the latter split sibling judges); `ack --exists` takes several documents; no bulk history replay was needed
(the other session had mirrored its runs; only the three P0-10 card moves were missing and were written by hand);
the transition rule "nobody db_writes events by hand" replaces the plan's "agents may still self-mirror" because a
second write of an existing id refuses the whole batch.
Observed in the real tree while building: the hook identified the other session's P0-06.1 planner from its log.sh
command and traced its tool calls before any skill text changed.

## Test

`node tools/monitor/test/monitor.test.js`: ALL TESTS PASSED, FACTORY, ACTIVITY, DURATION, HELPER, MEMORY, LAG AND
ORDER TESTS PASSED (64 tasks, 5,300-event prune and 450-tick bound covered).
`python3 tools/monitor/test/check.test.py`: Ran 7 tests, OK. `python3 tools/monitor/test/mirror.test.py`: Ran 13
tests, OK (cursor, folding, outbox, poll pacing, truncation, --exists, skip ids, hook identity from marker and from a
log.sh command, auto agent.done once, unknown agents skipped after 3 misses). `python3 tools/monitor/test/serve.test.py`:
Ran 2 tests, OK (page served, replay order tasks/event/ready, live event and ephemeral activity within a second).
`python3 tools/monitor/check.py`: the real tree validates clean (trace files skipped).
Render check: headless Chrome screenshots of the overview and factory views against the local viewer (see Review).

## Review

Self-review (foreman-built tooling card, no reviewer agent): the five acceptance criteria map to the tests above and to
the published page; nothing outside the listed files changed; no secrets are traced (file paths, command heads,
patterns, descriptions only); hooks are async and exit 0 on every path; the old manual sync (ops.sh) is kept for a
fresh artifact. Advisory: Workflow-tool agents may not fire settings hooks (undocumented); expected durations need
finished history of the same kind and show nothing otherwise; the artifact lags the files by one mirror pass.

## Ship

