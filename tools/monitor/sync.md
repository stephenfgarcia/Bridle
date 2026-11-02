# Syncing local JSONL events into the monitor

Use this when an agent could not reach the artifact database (the monitor shows gaps, or an agent's
`agent.done` never arrived) or after any workflow ends, as a final consistency pass.

1. Find the artifact slug in `.bridle/monitor.json`.
2. List what the database already has for the run (load the tool first with
   ToolSearch "select:mcp__claude-artifacts__db_query"):
   `db_query` with `collection: "events"`, `where: {runId: "<runId>"}`, `limit: 1000`
   (page with `cursor` if needed) and collect the returned ids.
3. Produce the local ops: `tools/monitor/ops.sh <runId>` prints one JSON array per line, each holding up to
   50 `{op:"set", path:"events/<id>", data:{...}}` ops. Drop any op whose id is already in the database.
4. For each remaining line: one `mcp__claude-artifacts__db_write` call with `slug` and `ops` set to that array.
   Send one call at a time and wait 2 seconds between calls (rate limit). A `set` on a brand-new document
   needs no `ifVersion`; if the server reports the document exists, skip it (it was already mirrored).
5. Write a `note` event ("synced N events for run <runId>") so the gap is visible in the log.

Pruning (optional, when the database nears 25,000 documents): `db_query` the oldest finished run's events,
confirm the run's JSONL is intact under `.bridle/progress/<runId>/`, then `db_write` with `op: "delete"`
for those ids (each needs its `ifVersion` from the query), 50 per call.
