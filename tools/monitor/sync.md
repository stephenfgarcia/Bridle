# Replaying and pruning monitor events

Live mirroring is automatic: the orchestrator keeps `tools/monitor/watch.sh` armed and runs `mirror.py` passes
(see `README.md`). This page covers the manual cases. The slug is in `.bridle/monitor.json`; load the database
tools with ToolSearch (`select:mcp__claude-artifacts__db_query,mcp__claude-artifacts__db_write`).

## Replaying history (first use of mirror.py, or a gap you can see on the page)

1. Collect the ids already in the database: `db_query` with `collection: "events"`, `limit: 1000` (page with
   `cursor`), and write the `id` of every returned document, one per line, to a file outside the repo.
2. `tools/monitor/mirror.py init --from-start`, then `tools/monitor/mirror.py pending --take --skip-ids-file <file>`:
   it prints one JSON line per batch (`batch`, `idempotencyKey`, `ops`).
3. For each line: one `db_write` with `slug`, `ops` and `idempotencyKey` from the line; wait 2 s between calls.
   Then `tools/monitor/mirror.py ack --all`. A refusal naming an existing document:
   `mirror.py ack <batch> --exists events/<id>` prints the re-queued remainder; write that one and ack it.
4. Write a `note` event ("replayed N events for run <runId>") so the gap stays visible in the log.

`mirror.py pending` never replays lines before its cursor; the first `pending` or `poll` on a fresh checkout sets the
cursor to the current end of every file, so nothing already in the database is sent twice.

## Pruning (when `db_usage` passes about 10,000 documents)

1. Pick a finished run. `tools/monitor/mirror.py prune-plan --run <runId> --older-than 7d` prints the ids of its
   `agent.activity` and `agent.heartbeat` events, 50 per line (the run's JSONL keeps them; confirm it is intact).
2. For each line: `db_query` with `where: [{"field": "id", "op": "in", "value": [...]}]` (at most 30 per filter)
   to get each document's `version`, then `db_write` with `op: "delete"` and `ifVersion`, 50 per call, 2 s apart.
3. Write a `note` event ("pruned N activity events of run <runId>").

## A fresh artifact

`tools/monitor/ops.sh <runId>` prints every event of a run as op batches (50 per line) for a full re-mirror into an
empty database; `tools/monitor/card.py sync-ops` prints the `tasks/<id>` documents.
