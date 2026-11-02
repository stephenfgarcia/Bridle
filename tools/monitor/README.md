# Bridle Build Monitor

A claude.ai artifact page that shows, live, every agent working on the Bridle build: which phase and task
each one is on, its progress, its log lines, and a timeline of all agents. The page is read-only; agents and
the orchestrator write events through the artifact database.

- Page source: `tools/monitor/index.html` (single file, no build step).
- Artifact id and URL: `.bridle/monitor.json` (written at publish time).
- Durable local log: `.bridle/progress/<runId>/<agentId>.jsonl` (gitignored; the source of truth).

## Reporting protocol (every agent, verbatim in its prompt)

```
REPORTING (mandatory)
You are agent <agentId> working on task <taskId> in run <runId>, phase <phase>.
1. On start: append an agent.start event, then at every step boundary an agent.progress event, and at least
   one heartbeat or log every 10 minutes. On finish: agent.done (or agent.fail) with a 3-6 sentence summary
   and the list of files you changed.
2. Write each event with tools/monitor/log.sh (it appends the JSON line to .bridle/progress/<runId>/<agentId>.jsonl
   and prints the matching db_write op):
     tools/monitor/log.sh -r <runId> -p <phase> -a <agentId> -t <taskId> -T agent.progress -P 40 -s "step name" -m "what you did; what is next"
3. Mirror events to the monitor: load the tool with ToolSearch "select:mcp__claude-artifacts__db_write" and
   call it with slug <slug> and ops = the printed op objects (batch up to 50 per call; one call at a time;
   wait 2 s after a multi-op call). If the call fails, keep working; the orchestrator syncs the JSONL later.
4. Never block on reporting; never log secrets; keep messages specific (what you did, what you are doing
   next, what is blocking).
```

Agent types and the database tool: subagents of the built-in `Plan` and `Explore` types cannot load the artifact
database tool (ToolSearch finds no `mcp__claude-artifacts__*` match for them), so their events reach only the local
JSONL and must be synced by the orchestrator (`sync.md`). Workflow agents that should appear live on the monitor
run as `general-purpose` (or a custom type) with read-only instructions in the prompt.

Agents in isolated worktrees must call the script by absolute path from the main checkout:
`/Users/johnstephenf.garcia/Dev/Dev/Bridle-1/tools/monitor/log.sh`.

## Event types

| type | emitter | fields |
|---|---|---|
| `run.start` / `run.end` | orchestrator | `-r runId -p phase -m "workflow name"` (use `-a orchestrator -t <phase task>`) |
| `task.status` | orchestrator or agent | `-t taskId -S planned|queued|running|blocked|review|done|failed [-P progress] -m "why"` |
| `agent.start` | agent | `-m "plan of attack"` |
| `agent.progress` | agent | `-P 0-100 -s step -m "..."` |
| `agent.log` | agent | `-l debug|info|warn|error -m "..."` |
| `agent.heartbeat` | agent | at least every 10 minutes on long tasks, and while a background command (`run_in_background`) runs |
| `agent.done` / `agent.fail` | agent | `-m "summary" -d '{"files":["path", ...]}'` |
| `note` | orchestrator | `-m "human-readable phase note"` |
| `card.move` | foreman (`tools/monitor/card.py move`) | `-s <station> -S <status> -P <progress>`; drives the **Factory** view |

The page derives state from events: a task's status is its latest `task.status` event unless its agents have
reported more recently; an agent with no activity for 10 minutes and no `agent.done`/`agent.fail` shows as stale. A builder or tester whose long command runs in the background (`run_in_background`, see `.claude/agents/factory-builder.md` and `factory-tester.md`) heartbeats while it runs and is not stale: an agent with a background command still running is never counted stale (plan D3).

## Database layout

- `tasks/<taskId>`: `{id, title, phase, order, workstream?, dependsOn?, estimate?, placeholder?}`; seeded by the
  orchestrator, replaced when the implementation roadmap is approved.
- The **Factory** view (`#factory`) reads the same collections: a `card.move` event's `step` is the station; see `factory/README.md`.
- `events/<tsMs>-<agentId>-<seq>`: one document per event (fields as written by `log.sh`). Document ids sort
  chronologically; the page subscribes to the latest 1,000 by `tsMs`.

Capacity: the artifact database holds at most 25,000 documents. Agents log at step boundaries, not per tool
call. When a run is finished and archived, the orchestrator prunes its events from the database (the JSONL
keeps the full history, and the page can load it from a dropped file).

## Tests

`node tools/monitor/test/monitor.test.js` runs the page's derivation logic headlessly (status, stale detection, run filter, factory cards, next-up).

`python3 tools/monitor/check.py [--run <runId>] [--summary]` validates every line of `.bridle/progress/**/*.jsonl` (exit 0 all valid, 1 at least one bad line, 2 the run directory does not exist); `python3 tools/monitor/test/check.test.py` runs its tests.

## Syncing missed events

See `sync.md`. `tools/monitor/ops.sh <runId>` prints db_write-ready op batches for a whole run.

## Backfilling from the harness

`tools/monitor/backfill.py --run <runId> --dir <workflow transcript dir> --task <taskId> --phase <phase>` derives
`agent.start`, `agent.done`/`agent.fail`, and `agent.heartbeat` events from a Claude Code workflow's own journal and
per-agent transcripts (real timestamps), appends them to the run's JSONL (deduplicated), and prints op batches to
mirror. The orchestrator runs it at every workflow boundary so agents that could not report still appear.
