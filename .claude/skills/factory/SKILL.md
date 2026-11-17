---
name: factory
description: Foreman of the Bridle software factory. Moves one markdown work card along the line (spec, plan, build, test, review, ship) by spawning the station subagents, with live progress on the Bridle Build Monitor. Use for "/factory run <id>", "/factory next", "/factory status", "/factory new".
argument-hint: run <card-id> | next | status | sync [seconds] | new <id> "<title>" --phase P1 --order 3 [--deps A,B]
---

# /factory

Read `factory/README.md` once (two minutes) and `factory/line.md` (the stations, workers, exit criteria).
Cards live in `factory/cards/`. The monitor's link and slug are in `.bridle/monitor.json`; its Factory view
shows the board live. Arguments: `$ARGUMENTS`.

## Commands

- `status`: run `tools/monitor/card.py list` and `tools/monitor/mirror.py status`; report cards per station, anything
  blocked or failed, next up, and whether events are waiting to be mirrored. Also run
  `python3 tools/monitor/card.py status --check docs/plan/progress.md`: stale means a card was created or shipped
  without a regeneration; run `--write` and commit the board.
- `new <id> "<title>" --phase <P> --order <n> [--deps A,B]`: run `tools/monitor/card.py new ...`. It prints a
  `tasks/<id>` op; mirror it with the artifact database tool the session offers (ToolSearch
  `select:mcp__claude-artifacts__db_write,ArtifactData` returns the one it has): with `db_write`, pass the printed op as
  `ops` with the `slug` from `.bridle/monitor.json`; with `ArtifactData`, as step 0 of `run` says.
- `next`: `card.py list` says who is next up; then `run` that card.
- `sync [seconds]`: be the mirror. Arm the watch (step 0 below, with the interval if given) and keep mirroring until
  the user stops you; use it from a session that is not running cards while another session does.
- `run <id>`: the procedure below, one station at a time. Never skip a station, never run two cards at once; a second
  card may run alongside only when the owner says so and the two cards share no files, recorded in the card's Spec as
  a process note.

## Work packages, sub-cards, and manual gates

A roadmap row (an E2 row in `docs/plan/roadmap.md`, for example `P2-02`) is a work package, not a card. At its spec
station the user approves the row's acceptance criteria and split list once; then create the sub-cards
`<row>.<n>` with `card.py new <row>.<n> "<title>" --phase <P> --order <row order x 10 + n> --deps <previous
sub-card or the row's After>`, each changing one package or crate, at most one engineer-day (about 15 files,
1,500 lines), one test command in `## Test`, one commit named `<row>.<n>: <title>`; the last sub-card carries
the row's acceptance criteria and closes the row. Human-only artifacts (register approvals, clause attestations,
SME verification records, the judge measurement report, pentest and accessibility reports, executed licenses) are
listed in the card frontmatter as `manualGates: [..]`; refuse `ship` while any gate is unticked (`[x]`), and say
which. Commands expected to run longer than two minutes (cargo build, pnpm install, docker compose up, Playwright
install) run with run_in_background, with an agent.heartbeat while they run.

## run <id>

0. Preconditions. The card exists; every card in `dependsOn` has `status: done`; if the card's phase is P1 or
   later, the implementation roadmap `docs/plan/roadmap.md` (Part E; approved 2026-11-03, the canonical copy; the plan
   file outside the repository is only its origin) has been approved by the user. If a precondition fails, say which
   and stop. Then arm the mirror so the monitor follows the card live, unless another session is already the mirror
   (`/factory sync`; only one session runs the watch):
   `Monitor({command: 'tools/monitor/watch.sh', timeout_ms: 1800000, description: 'unmirrored monitor events'})`.
   Every notification from it is one short turn: `tools/monitor/mirror.py pending --take`, then for each printed
   line one mirror write (wait 2 s after a multi-op call), then `tools/monitor/mirror.py ack --all`. Re-arm the
   watch when it expires. The mirror write (`db_write` in the rest of this file) uses the artifact database tool the
   session offers. Where the harness has `mcp__claude-artifacts__db_write`, call it with `slug` (from
   `.bridle/monitor.json`), `ops` and `idempotencyKey` taken from that line. Where it has `ArtifactData` instead (the
   foreman's session of 2026-11-17 mirrored card P0-11's whole second test station with it), make one `batch` call per
   printed line with the `url` from `.bridle/monitor.json`, each op `{"op":"set","path":"events/<id>","data":{..}}`
   becoming the write `{op: "set", collection: "events", doc_id: "<id>", data}` (for `tasks/<id>`: collection `tasks`);
   it takes no idempotency key, and a create of an id that already exists is refused. If a write is refused because a
   document already exists: `tools/monitor/mirror.py ack <batch> --exists events/<id>` prints the remainder; write and
   ack that.
1. Spec (you). If `## Spec` is empty, write it with the user: what, why, acceptance criteria (testable),
   files likely touched, out of scope. Then
   `tools/monitor/card.py move <id> spec --agent orchestrator --note "Spec ready"` (the watch mirrors every move).
   Commit the new card file as `Cards: <id> spec` once the spec is approved, with the board regenerated
   (`python3 tools/monitor/card.py status --write docs/plan/progress.md`) when the card is new.
2. Plan. `card.py move <id> plan --note "Planning"`, then spawn the Agent tool with
   `subagent_type: "factory-planner"` and the station prompt below. Read `## Plan` when it returns; if a step
   names no file or the plan ignores an acceptance criterion, send it back once via SendMessage, else continue.
3. Build. `card.py move <id> build --note "Building"`, spawn `factory-builder`. It fills `## Build`.
4. Test. `card.py move <id> test --note "Testing"`, spawn `factory-tester`. It fills `## Test`.
   Failing tests: `card.py move <id> build --from test --note "<failure summary>"`, spawn the
   builder again with the failures, then test again. Second failure: `card.py move <id> build --status blocked
   --note "<why>"`, stop and tell the user.
5. Review. `card.py move <id> review --note "Reviewing"`, spawn `factory-reviewer`. FAIL: back to build
   once as in step 4 (then test and review again); second FAIL blocks the card.
6. Ship (you). Check the exit criteria yourself: tests pass (re-run the command in `## Test`), `## Review` says
   PASS, every section through `## Review` is filled. `git add` the touched files and the card (its sections through
   `## Review`); commit as `<id>: <title>` with the attribution line from your instructions; push and record the
   Actions run URL. Then, in this order: write the hash and the run URL in `## Ship`;
   `card.py move <id> ship --status done --agent orchestrator --note "Shipped in <hash>"`;
   `python3 tools/monitor/card.py status --write docs/plan/progress.md`; append the card's entry under `## Log` in
   `docs/plan/progress.md` with its hash and time (`- <date> <time>, <id>, commit <hash>: <title>; <one line>`);
   rewrite the paragraphs under `## In flight / next / only the owner can do` in the same file (what is in flight, the
   last shipped card, what is next);
   commit the card and `docs/plan/progress.md` as `Cards: <id> shipped` and push it at once. So no commit ever
   holds a log entry without its hash, and every commit passes `pnpm check` in a full clone.
7. Report: what shipped, what the reviewer flagged, what is next up. If this session armed the watch in step 0, run
   one last mirror pass (`pending --take`, `db_write`, `ack --all`) and stop the watch with `TaskStop` unless another
   card follows; where another session is the mirror, leave the pass and the watch to it.

Mirroring: events (card moves, agent reports, traced tool calls) reach the monitor only through the armed watch
and `mirror.py` batches; never `db_write` an `events/<id>` document by hand (a second write of the same id is refused,
and with it the whole batch where the tool applies a batch all or nothing; `ArtifactData` says in its result whether
it did that or applied the batch one write at a time in order, and then the writes before the refused one may have
landed: name each with `--exists` as in step 0 until the remainder goes through). The only op mirrored by hand is the
`tasks/<id>` document printed by `card.py new`.

Spawning a station: `Agent` with `subagent_type` = the station's name (`factory-planner`, `factory-builder`,
`factory-tester`, `factory-reviewer`). Agent types are registered when a session starts, so in a session older
than `.claude/agents/`, the Agent tool will say the type is not found: then use `subagent_type: "general-purpose"`
and paste the body of `.claude/agents/<station>.md` under a "ROLE" heading above the station prompt. Run one
station at a time and wait for its result before moving the card.

## Station prompt (fill the angle brackets; give it to every station agent)

```
You are the <station> station of the Bridle software factory, working card <id>: <title>.
Card file: <absolute path>. Read factory/line.md (your row only matters) and the whole card first.
Do only your station's job and write the result in the card's "## <Station>" section; leave other sections as they are.

MONITOR run=factory phase=<phase> agent=<id>-<station> task=<id>
REPORTING (mandatory). Run these from /Users/johnstephenf.garcia/Dev/Dev/Bridle-1:
  tools/monitor/log.sh -r factory -p <phase> -a <id>-<station> -t <id> -T agent.start -m "<what you will do>"
  tools/monitor/log.sh -r factory -p <phase> -a <id>-<station> -t <id> -T agent.progress -P <0-100> -i <step n> -n <steps total> -s "<step name>" -m "<done; next>"   (at each step, at least every 5 minutes)
  tools/monitor/log.sh -r factory -p <phase> -a <id>-<station> -t <id> -T agent.done -m "<3-6 sentence summary>" -d '{"files":[...]}'
Each call prints a JSON op: ignore it. The foreman mirrors everything automatically; never call db_write or any artifact database tool yourself.
Your tool calls are traced to the monitor automatically (a file path, the first 80 characters of a command, a search pattern or a description; also the first 80 characters of a fetched URL or of a web or tool search query, and the name of an MCP server): keep secrets off command lines and out of URLs and search queries.
Finish with the same summary as your final message.
```
