# Bridle Build Monitor

A claude.ai artifact page that shows, live, every agent working on the Bridle build: who is working right now and
on which step, how long each one has been quiet, its last tool calls, its progress, its log lines, and a timeline of
all agents. The page is read-only. Events reach it through the artifact database (written by the orchestrator's
mirror pass, see below) or, on the local viewer, straight from the files.

- Page source: `tools/monitor/index.html` (single file, no build step; views `#overview`, `#tasks`, `#agents`, `#logs`,
  `#factory`, `#timeline`; a sticky "Working now" strip under the header in every view).
- Artifact id, URL and `syncIntervalSeconds`: `.bridle/monitor.json`.
- Durable local log: `.bridle/progress/<runId>/<agentId>.jsonl` (gitignored; the source of truth). Hook traces live
  next to it as `<agentId>.trace.jsonl`; mirror state in `.bridle/progress/.mirror/`.

## How events flow (protocol v2, 2026-11-03)

```
agent ──── log.sh ───────────────────▶ .bridle/progress/<run>/<agent>.jsonl ──┐
Claude Code hook, every subagent tool call ──▶ <run>/<agent>.trace.jsonl ──────┤── mirror.py (orchestrator, every few s) ──▶ artifact db "events" ──▶ page (onSnapshot)
                                                                               └── serve.py ──▶ http://127.0.0.1:8787 (same page, sub-second, no Claude turn)
```

1. Agents write step-level events with `log.sh` (protocol below). Agents never call `db_write` for events.
2. `.claude/settings.json` registers `tools/monitor/trace-hook.sh` on `PostToolUse`, `PostToolUseFailure` and
   `SubagentStop` (async; never blocks a tool). For every subagent whose prompt carries the marker line
   `MONITOR run=<runId> phase=<phase> agent=<agentId> task=<taskId>` (fallback: a `log.sh -r … -p … -a … -t …`
   command), the hook appends one trace line per tool call (`{tsMs, tool, target, ok, ms}`; a file path, the first
   80 characters of a command, a search pattern or a description; never the tool input or response) and, when the
   agent stops without `agent.done`/`agent.fail`, an automatic `agent.done` (`data.auto`). The main session is never
   traced. Identities are cached in `.bridle/progress/.mirror/agents/<harness id>.json`.
3. The orchestrator keeps `tools/monitor/watch.sh` armed with the `Monitor` tool. Whenever unmirrored lines exist the
   watch prints one line; the orchestrator runs `tools/monitor/mirror.py pending --take` (which first folds each
   agent's new trace lines into ONE `agent.activity` event, level debug), calls `db_write` once per printed line
   (`ops` and `idempotencyKey` from the line; 2 s between multi-op calls) and runs `mirror.py ack --all`. The watch
   stays quiet while a batch is in flight, so the pace is one pass per `syncIntervalSeconds` plus one Claude turn
   (about 10 to 20 s of latency during continuous activity). A refusal that names an existing document:
   `mirror.py ack <batch> --exists events/<id>` re-queues the rest under a new batch.
4. The page subscribes to the latest 1,000 events, keeps up to 5,000 in memory (evicted window events are kept, true
   deletions are dropped), rewrites every timer once a second, and shows the sync lag (median time from an event's
   `tsMs` to its arrival) next to the connection pill.
5. `python3 tools/monitor/serve.py` serves the same page at `http://127.0.0.1:8787/` and streams the files as they
   change: a replay of every event, then a live tail; raw trace lines arrive as ephemeral activity events.

## Reporting protocol (every agent, verbatim in its prompt)

```
MONITOR run=<runId> phase=<phase> agent=<agentId> task=<taskId>
REPORTING (mandatory). Run these from /Users/johnstephenf.garcia/Dev/Dev/Bridle-1:
  tools/monitor/log.sh -r <runId> -p <phase> -a <agentId> -t <taskId> -T agent.start -m "<what you will do>"
  tools/monitor/log.sh -r <runId> -p <phase> -a <agentId> -t <taskId> -T agent.progress -P <0-100> -i <step n> -n <steps total> -s "<step name>" -m "<done; next>"
      (at every step boundary, and at least every 5 minutes; while a long background command runs, agent.heartbeat)
  tools/monitor/log.sh -r <runId> -p <phase> -a <agentId> -t <taskId> -T agent.done -m "<3-6 sentence summary>" -d '{"files":[...]}'
      (or agent.fail -l error -m "<the error and what you tried>")
Each call prints a JSON op: ignore it, the orchestrator mirrors automatically; never call db_write yourself.
Never block on reporting; never log secrets; keep messages specific (what you did, what is next, what blocks you).
```

Agents in isolated worktrees must call the script by absolute path from the main checkout:
`/Users/johnstephenf.garcia/Dev/Dev/Bridle-1/tools/monitor/log.sh`.

Agent types: any subagent type is traced (the hook keys on the marker line, not on the type), so `Plan` and `Explore`
subagents, which cannot load the artifact database tool, now appear live as well. Agents launched by the `Workflow`
tool may not fire settings hooks (undocumented); `backfill.py` still derives their start and done events from the
harness journal.

## Event types

| type | emitter | fields |
|---|---|---|
| `run.start` / `run.end` | orchestrator | `-r runId -p phase -m "workflow name"` (use `-a orchestrator -t <phase task>`) |
| `task.status` | orchestrator or agent | `-t taskId -S planned|queued|running|blocked|review|done|failed [-P progress] -m "why"` |
| `agent.start` | agent | `-m "plan of attack"` |
| `agent.progress` | agent | `-P 0-100 -s step [-i stepIndex -n stepCount] -m "..."` |
| `agent.log` | agent | `-l debug|info|warn|error -m "..."` |
| `agent.heartbeat` | agent | at least every 5 minutes on long tasks, and while a background command (`run_in_background`) runs |
| `agent.done` / `agent.fail` | agent (or the SubagentStop hook, `data.auto`) | `-m "summary" -d '{"files":["path", ...]}'` |
| `agent.activity` | `mirror.py` (folded hook traces) | level `debug`; `message` "12 tool calls: Edit …; Bash …"; `data` `{calls, tools, files, failed, last, sinceTsMs, untilTsMs}` |
| `note` | orchestrator | `-m "human-readable phase note"` |
| `card.move` | foreman (`tools/monitor/card.py move`) | `-s <station> -S <status> -P <progress>`; drives the **Factory** view |

The page derives state from events: a task's status is its latest `task.status` event unless its agents have
reported more recently; an agent with no activity for 10 minutes and no `agent.done`/`agent.fail` shows as stale, and
the strip colours its quiet time (green under 1 minute, amber under 5, red beyond). `agent.activity` counts as
liveness and as "last action", never as a message, a step or progress. A builder or tester whose long command runs
in the background (`run_in_background`, see `.claude/agents/factory-builder.md` and `factory-tester.md`) heartbeats
while it runs and is not stale: an agent with a background command still running is never counted stale (plan D3).
Expected durations ("typically ~11 min, estimate") come from finished agents of the same kind: the same station
suffix (`<card>-build`) or the same two-part name prefix (`arch-judge-…`).

## Database layout

- `tasks/<taskId>`: `{id, title, phase, order, workstream?, dependsOn?, estimate?, placeholder?}`; seeded by the
  foreman (`card.py new` prints the op; mirror that one by hand).
- The **Factory** view (`#factory`) reads the same collections: a `card.move` event's `step` is the station; see `factory/README.md`.
- `events/<tsMs>-<agentId>-<seq>`: one document per event (fields as written by `log.sh`). Document ids sort
  chronologically; the page subscribes to the latest 1,000 by `tsMs`.

Capacity: the artifact database holds at most 25,000 documents. Step-level events are few; `agent.activity` adds at
most one document per agent per mirror pass. When `db_usage` passes about 10,000 documents, prune the activity and
heartbeat events of finished runs (`mirror.py prune-plan`, procedure in `sync.md`); the JSONL keeps everything.

## Local viewer

```
python3 tools/monitor/serve.py            # http://127.0.0.1:8787/  (--port, --root, --cards, --interval)
```

Same page, same data, no database and no Claude turn: every `log.sh` line and every traced tool call shows within
a second. Keep it open while watching a run; the artifact stays the shareable view.

## Tests

- `node tools/monitor/test/monitor.test.js`: the page's derivation logic headlessly (status, stale and quiet,
  run filter, factory cards, next-up, activity semantics, step segments, expected durations, rate buckets,
  eviction bookkeeping, sync lag).
- `python3 tools/monitor/test/check.test.py`: the validator. `python3 tools/monitor/check.py [--run <runId>] [--summary]`
  validates every event line under `.bridle/progress/` (trace files and `.mirror/` are skipped; exit 0 valid, 1 bad
  line, 2 missing run directory).
- `python3 tools/monitor/test/mirror.test.py`: `mirror.py` (cursor, folding, outbox, ack, poll) and the hook.
- `python3 tools/monitor/test/serve.test.py`: the local viewer's stream.

## Mirroring, replay and pruning

- Live: the armed watch (above). `tools/monitor/mirror.py status` shows the cursor, pending lines and the outbox.
- First use, a visible gap, pruning, or a fresh artifact: `sync.md`.

## Backfilling from the harness

`tools/monitor/backfill.py --run <runId> --dir <workflow transcript dir> --task <taskId> --phase <phase>` derives
`agent.start`, `agent.done`/`agent.fail`, and `agent.heartbeat` events from a Claude Code workflow's own journal and
per-agent transcripts (real timestamps), appends them to the run's JSONL (deduplicated), and prints op batches to
mirror. The orchestrator runs it at every workflow boundary so agents that could not report still appear.
