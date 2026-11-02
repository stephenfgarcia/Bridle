---
name: factory
description: Foreman of the Bridle software factory. Moves one markdown work card along the line (spec, plan, build, test, review, ship) by spawning the station subagents, with live progress on the Bridle Build Monitor. Use for "/factory run <id>", "/factory next", "/factory status", "/factory new".
argument-hint: run <card-id> | next | status | new <id> "<title>" --phase P1 --order 3 [--deps A,B]
---

# /factory

Read `factory/README.md` once (two minutes) and `factory/line.md` (the stations, workers, exit criteria).
Cards live in `factory/cards/`. The monitor's link and slug are in `.bridle/monitor.json`; its Factory view
shows the board live. Arguments: `$ARGUMENTS`.

## Commands

- `status`: run `tools/monitor/card.py list`; report cards per station, anything blocked or failed, and next up.
- `new <id> "<title>" --phase <P> --order <n> [--deps A,B]`: run `tools/monitor/card.py new ...`. It prints a
  `tasks/<id>` op; mirror it (ToolSearch `select:mcp__claude-artifacts__db_write`, slug from `.bridle/monitor.json`).
- `next`: `card.py list` says who is next up; then `run` that card.
- `run <id>`: the procedure below, one station at a time. Never skip a station, never run two cards at once.

## run <id>

0. Preconditions. The card exists; every card in `dependsOn` has `status: done`; if the card's phase is P1 or
   later, the implementation roadmap (plan file, Part E) has been approved by the user. If a precondition
   fails, say which and stop.
1. Spec (you). If `## Spec` is empty, write it with the user: what, why, acceptance criteria (testable),
   files likely touched, out of scope. Then
   `tools/monitor/card.py move <id> spec --agent orchestrator --note "Spec ready"` and mirror the printed op.
2. Plan. `card.py move <id> plan --note "Planning"`, mirror, then spawn the Agent tool with
   `subagent_type: "factory-planner"` and the station prompt below. Read `## Plan` when it returns; if a step
   names no file or the plan ignores an acceptance criterion, send it back once via SendMessage, else continue.
3. Build. `card.py move <id> build --note "Building"`, mirror, spawn `factory-builder`. It fills `## Build`.
4. Test. `card.py move <id> test --note "Testing"`, mirror, spawn `factory-tester`. It fills `## Test`.
   Failing tests: `card.py move <id> build --from test --note "<failure summary>"`, mirror, spawn the
   builder again with the failures, then test again. Second failure: `card.py move <id> build --status blocked
   --note "<why>"`, mirror, stop and tell the user.
5. Review. `card.py move <id> review --note "Reviewing"`, mirror, spawn `factory-reviewer`. FAIL: back to build
   once as in step 4 (then test and review again); second FAIL blocks the card.
6. Ship (you). Check the exit criteria yourself: tests pass (re-run the command in `## Test`), `## Review` says
   PASS, every section is filled. `git add` the touched files and the card; commit as `<id>: <title>` with the
   attribution line from your instructions; write the hash in `## Ship`; then
   `card.py move <id> ship --status done --agent orchestrator --note "Shipped in <hash>"` and mirror.
   The card's shipped state is committed with the next card (or as `<id>: card shipped` if nothing else is pending).
7. Report: what shipped, what the reviewer flagged, what is next up.

Mirror = one `mcp__claude-artifacts__db_write` call with `slug` and `ops: [<printed op>]`; never block on it.

## Station prompt (fill the angle brackets; give it to every station agent)

```
You are the <station> station of the Bridle software factory, working card <id>: <title>.
Card file: <absolute path>. Read factory/line.md (your row only matters) and the whole card first.
Do only your station's job and write the result in the card's "## <Station>" section; leave other sections as they are.

REPORTING (mandatory). Run these from /Users/johnstephenf.garcia/Dev/Dev/Bridle-1:
  tools/monitor/log.sh -r factory -p <phase> -a <id>-<station> -t <id> -T agent.start -m "<what you will do>"
  tools/monitor/log.sh -r factory -p <phase> -a <id>-<station> -t <id> -T agent.progress -P <0-100> -s "<step>" -m "<done; next>"   (at each step)
  tools/monitor/log.sh -r factory -p <phase> -a <id>-<station> -t <id> -T agent.done -m "<3-6 sentence summary>" -d '{"files":[...]}'
Each call prints a JSON op. Mirror the ops to the monitor: ToolSearch "select:mcp__claude-artifacts__db_write",
then db_write with slug <slug> and ops = [the printed ops] (batch; one call at a time). If db_write fails, continue.
Finish with the same summary as your final message.
```
