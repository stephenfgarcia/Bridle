# Bridle Build Monitor v4: live progress

## Context

The Bridle Build Monitor (artifact `0c683356-bb60-44ae-8ef4-52ce6912715d`, source `tools/monitor/index.html`, 1243 lines, single file) is the page the user keeps open while planning and factory agents work. The user reports it "feels lacking on realtime progress tracking and live monitoring of current progress". The page already subscribes to the artifact database in real time (`onSnapshot` on `events` rides a realtime stream per the `db` capability contract), so the gap is on both sides of that subscription.

**Write path (root cause).** Events reach the database only when an agent remembers to call `mcp__claude-artifacts__db_write` after each `log.sh` call, at step boundaries, with a 10-minute heartbeat floor. `Plan`/`Explore` subagents and every agent inside a `Workflow` run cannot load that tool (see the `warn` lines in `.bridle/progress/wf-ux/*.jsonl`), so their events arrive only when the orchestrator syncs after the run. Between step boundaries nothing is written at all: a station running for 15 minutes shows one static card.

**Read path.** Time text ("last seen 3 min ago", stale detection, the timeline now-line) refreshes on a 30 s `setInterval` (`index.html:1234`); nothing visibly ticks. `render()` rebuilds the whole active view and `derive()` re-sorts every event, so neither can run every second. There is no live strip showing per working agent the elapsed time in its step, the quiet time since its last event, or its last action. When the 1000-event window evicts old events, the `removed` handler deletes them (`index.html:1155-1160`), so history degrades during long runs.

**Outcome.** While a card or workflow runs: the page moves every second (timers, quiet-time colour, extending timeline bars); each agent's current action is visible within the sync cadence; freshness and sync lag are shown honestly; expected durations come from history; and events reach the artifact automatically, without relying on each agent's cooperation. A local viewer gives sub-second updates straight from the files.

## Decisions (user answers, 2026-11-03)

- **Target:** republish the existing artifact in place (same URL, same database).
- **Sync cadence:** the user asked for every 5 seconds. The watch polls every 5 s and wakes the session as soon as there are unmirrored events, but each mirror pass is one Claude turn (8 to 15 s of tool round trips), so the effective artifact latency is about 10 to 20 s during continuous activity and 5 s plus one turn after a quiet period. Cost: roughly 3 to 5 short turns per minute of agent activity (a few thousand mostly cached tokens each). The interval lives in one place (`syncIntervalSeconds` in `.bridle/monitor.json`, default 5) so it can be raised later. The local viewer needs no turns and is the sub-second view.
- **Local viewer:** yes (`tools/monitor/serve.py`).
- **Automatic tool-call tracing via Claude Code hooks:** yes (confirmed feasible: settings-file `PostToolUse` hooks fire inside subagents and carry `agent_id`/`agent_type`; `SubagentStop` carries `agent_id`, `agent_transcript_path`, `last_assistant_message`).
- **Tracking:** the work is recorded as factory card `P0-10 Monitor v4: live progress` (created with `card.py new`, moved through the stations by me without station agents, like P0-01/P0-03), so it shows on the monitor and ships as one commit.

**Concurrency warning.** Another Claude session is active in this repo (8 commits since this session started, cards seeded, `SKILL.md`, `README.md`, `card.py`, `line.md`, agent files changed). Every file is re-read immediately before editing, edits stay confined to the files listed below, cards other than P0-10 are never touched, and the commit adds only those files.

## Part 1: write path. Events reach the artifact within seconds, automatically

### 1a. Trace hook: `tools/monitor/trace-hook.sh` + `.claude/settings.json`

`.claude/settings.json` (new, committed) registers one command hook (`async: true`, so it never delays the next model call; no `onFailure`) on `PostToolUse` and `PostToolUseFailure` with matcher `*`, and one on `SubagentStop`. The script (bash wrapper around python3, like `log.sh`) reads the hook JSON on stdin and:

1. Returns at once when `agent_id` is absent (main session) or the event is not one of the three.
2. Resolves the monitor identity of `agent_id`: cache file `.bridle/progress/.mirror/agents/<agent_id>.json`; on a miss, read the first user message of the subagent transcript (`transcript_path` if its name is `agent-<agent_id>.jsonl`, else glob `<cwd>/.claude-sessions/<session_id>/**/agent-<agent_id>.jsonl`, else `~/.claude/projects/*/<session_id>/subagents/agent-<agent_id>.jsonl`) and parse the marker line `MONITOR run=<runId> phase=<phase> agent=<agentId> task=<taskId>` (fallback regex: `log.sh -r X -p Y -a Z -t W`). Three misses → cache `{skip: true}` (agents without a reporting block are not traced).
3. `PostToolUse`/`PostToolUseFailure`: appends `{"tsMs","tool","target","ok","ms","id"}` to `.bridle/progress/<runId>/<agentId>.trace.jsonl`. `target` = repo-relative `file_path` (Read/Edit/Write/NotebookEdit), first 80 chars of `command` (Bash), `pattern` (Grep/Glob), `description` (Agent), `mcp_server.name` for MCP tools, else nothing. Never the tool response or full input.
4. `SubagentStop`: if the agent's main JSONL has no `agent.done`/`agent.fail`, appends an `agent.done` (level info, `data.auto = true`, message = first 400 chars of `last_assistant_message`) via the same writer as `log.sh`, so no agent stays "running" forever.
5. Always exits 0 within ~50 ms; writes one complete line per append (safe under parallel hooks).

Known limits (documented in the README): hooks run only in trusted workspaces; whether `Workflow`-tool agents fire settings hooks is undocumented, so `backfill.py` stays the fallback for them.

### 1b. `tools/monitor/mirror.py`: cursor-based, idempotent sync (replaces manual `ops.sh` + `sync.md` for live use)

- `mirror.py pending [--take] [--run R] [--count]`: scans `.bridle/progress/**/*.jsonl` against `.bridle/progress/.mirror/cursor.json` (`{file: linesMirrored}`) and `*.trace.jsonl` against their own cursors. For every agent with new trace lines it appends ONE `agent.activity` event to the agent's main JSONL (level `debug`; `message` = "12 tool calls: Edit tools/monitor/check.py; Bash node tools/monitor/test/monitor.test.js"; `data` = `{calls, tools: {Read: 5, …}, files: […≤12], last: {tool, target, tsMs}, sinceTsMs, untilTsMs}`; no `step`, no `progress`; id `<tsMs>-<agentId>-<seq>` with `seq` = line count + 1, exactly as `log.sh`; phase/task/label from the identity cache or the agent's last line). Then prints op batches: one JSON array per line of up to 50 `{op: "set", path: "events/<id>", data}`. With `--take` it also writes each batch to `.bridle/progress/.mirror/outbox/<batchId>.json` and advances the cursors. `--count` prints only the number pending (and the runs).
- `mirror.py ack <batchId>|--all` deletes outbox files. `pending` always re-emits outbox batches first, so a failed `db_write` is retried next pass. Each batch carries `idempotencyKey = batchId`; a "document exists" refusal counts as acked.
- `mirror.py status`: lines mirrored per file, pending, outbox age, last ack (used by `/factory status` and `/factory sync`).
- `mirror.py prune-plan --run R [--types agent.activity,agent.heartbeat] [--older-than 7d]`: prints the `db_query` filter and the delete batches (ids; versions come from the query) for a finished run; the JSONL keeps everything. Capacity today: 120 of 25,000 documents; activity adds at most one document per agent per mirror pass.
- `check.py`: `TYPES` gains `agent.activity`; `check.test.py` gains one accepted case. `log.sh`: new `-i <stepIndex> -n <stepCount>` → `data.stepIndex`/`data.stepCount`; `-T agent.activity` accepted.
- Tests: `tools/monitor/test/mirror.test.py` (temp tree via `--root`: cursor advance, fold of trace lines into one event with correct id/seq, outbox retry, idempotency key, `--count`).

### 1c. Trigger: `tools/monitor/watch.sh` + the foreman's Monitor

- `watch.sh [seconds]` (default from `.bridle/monitor.json`): loop; every interval, if `mirror.py pending --count` > 0 and no outbox batch is in flight (or the oldest is older than 90 s), print one line `pending <n> events (<runs>)`. Self-pacing: at most one line per mirror pass.
- Foreman procedure (`SKILL.md`): `run` step 0 arms `Monitor({command: 'tools/monitor/watch.sh', timeout_ms: 1800000, description: 'unmirrored monitor events'})`; each notification is one turn: `mirror.py pending --take` → one `db_write` per batch (2 s between multi-op calls) → `mirror.py ack --all`; on expiry re-arm; step 7 stops it (`TaskStop`) after a final pass. New command `/factory sync [seconds]`: arm the watch and mirror until the user stops it (lets any session be the mirror while another runs agents). `status` reports `mirror.py status`.
- Station prompt gains the marker line `MONITOR run=factory phase=<phase> agent=<id>-<station> task=<id>` and "report `-i <n> -n <total>` per step; at least every 5 minutes". Workflow scripts' `report()` block gets the same marker. Self-mirroring by agents stays (faster when available) but is no longer load-bearing.
- Docs: `README.md` (protocol v2: marker, step index, activity events, hook, mirror, local viewer, sync lag), `sync.md` becomes "history replay and pruning" (uses `mirror.py`), `factory/README.md` "Watch it" names the local viewer.

## Part 2: read path. The page shows motion (`tools/monitor/index.html`)

Architecture: two loops. The **structural render** (existing `scheduleRender` → `render()`, rAF-debounced, plus a 400 ms trailing throttle) runs `derive()` once per data change and rebuilds the active view, header and live strip. A **1 Hz `tick()`** never calls `derive()` and never creates or removes nodes: it rewrites only text, one attribute, one width and four SVG coordinates on elements that carry `data-*` attributes. Invariant: everything the tick computes is `now − <attribute>`.

Attribute scheme (owned by `tick()`; builders `ago()`, `quiet()`, `ghost()` are the only places that emit time text):

| Attribute | Tick writes |
|---|---|
| `data-since="<tsMs>"` (+ `data-prefix`/`data-suffix`) | `textContent = prefix + fmtAgo(now − ts) + suffix` |
| `data-quiet="<lastTs>"` | text `quiet 12 s`; `data-q = quietClass(ms)` (`ok` < 60 s, `warn` < 5 min, `serious`, `stale` ≥ 10 min); a flip to/from `stale` calls `scheduleRender()` |
| `data-until="<tsMs>"` | `hidden = now > ts` (the "+N while away" badge) |
| `data-eta-start`, `data-eta-typical` on `.ghost` inside `.meter` | width = min(100, elapsed/typical); `data-over` past typical |
| `data-t0 data-span data-x0 data-w` on the timeline `<svg>`; `data-tl-live` on running bars/open segments; `data-tl-dot`; `data-tl-now` | bar width to `x(now)`, dot `cx`, now-line `x1/x2`; past the headroom → `scheduleRender()` |

`tick()` walks only `#strip`, `header.top` and the visible `.v-<view>`; returns when `document.hidden`; writes are guarded (`if (el.textContent !== s)`).

Steps (line numbers from the current file):

1. **Constants and `normEvent` (410-412, 470-492).** Add `EVENT_KEEP = 5000`, `QUIET_WARN_MS = 60e3`, `QUIET_SERIOUS_MS = 300e3`, `RENDER_MIN_GAP = 400`, `TL_MAX_ROWS = 60`, `TL_MAX_TICKS = 200`. `normEvent`: default level `debug` for `agent.activity`; lift numeric `data.stepIndex`/`data.stepCount` to `e.stepIndex`/`e.stepCount`; keep `data.ephemeral` (local viewer trace lines). No `JSON` use (the test vm has none).
2. **`derive()` (510-643).** Accumulate agents from `all` (not `evs`) and filter by run afterwards (`agentsAll` keeps cross-run history for ETA; keys already include `@runId`). New per-agent fields: `stepStartedTs`, `stepIndex` (not sticky), `stepCount` (sticky), `steps[]` (`{step, startTs, endTs, stepIndex}`, cap 64), `lastMessageTs`, `lastActivity`, `activityCount` (ephemeral lines excluded), `activityTicks` (last 400), `lastAction`/`lastActionTs`/`lastActionKind` (activity wins only when newer), `quietMs`, `typicalMs`/`typicalN`/`typicalBy`, `estPct`. `agent.activity` updates `lastTs` (liveness) but never `lastMessage`, `progress`, `step`, `status` or `count`. New pure helpers above the `document` guard (line 671) and exposed on `BridleMonitor` (669): `quietClass`, `historyKey` (`station:<suffix>` for ids ending in `-(spec|plan|build|test|review|ship)`, else `prefix:<id up to last dash>`), `typicalDuration` (median of the last 20 finished, not failed, same key), `rateBuckets(evs, now, 30, 60e3)`, `isFeedEvent` (not heartbeat, not activity), `classifyRemoval(tsMs, windowOldest, windowSize)` → `prune`/`evict`, `pruneMemory(events, keep)`, `touch()`. Return adds `rate`, `working` (running + stale, sorted by `firstTs`), `agentsAll`, `syncLagMs` (median of `arrivedAt − tsMs` over the last 20 db events after the first snapshot). Cost fixes: pre-group `card.move` by task (the 617-630 loop is O(tasks × events)); cache the sorted `all` keyed on `state.rev + ':' + size`.
3. **Ingestion and memory (1129-1137, 1153-1167).** `ingestEvent` bumps `state.rev`, stamps `arrivedAt`, `highlighted = !state.snapshotDone`. Snapshot handler: `windowOldest` from the last doc; `removed` → `classifyRemoval` → delete on `prune`, else mark `evicted`; `added` while hidden → `state.unseen++`; after the batch `snapshotDone = true` and `pruneMemory` when size > `EVENT_KEEP + 250`. `visibilitychange`: on visible, `awayCount = unseen`, `unseen = 0`, `awayUntil = now + 10 s`, `tick()`, `scheduleRender()`.
4. **Tick infrastructure (new, after 740).** `ago()`, `quiet()`, `ghost()`, `setText()`, `tick()`, `tickTimeline()`. Replace line 1234 with `setInterval(tick, 1000)` plus a 60 s `scheduleRender` safety. Convert inline time text at 798, 811, 831, 1034, 1084 to the builders (finished agents keep static text). Add the 400 ms trailing throttle to `scheduleRender` (743-747).
5. **Live strip.** `<section class="strip" id="strip" role="region" aria-label="Working now">` between `</header>` (326) and `<main>` (328), sticky at the top of every view; `renderStrip(d)` called from `render()` after `renderHeader`. One `button.srow.s-<display>` per `d.working` agent (same `onclick` as `agentCard`): pill + label + `task · station`; `step 3 of 7 · check_file` (fallback step name or "starting"); `meter()` with the ghost; `step 1 min 12 s · total 9 min`; `typically ~11 min (n=2, estimate)`; `quiet 8 s` with colour; last action with a `tools · 12 calls` tag and a title listing tool counts and files. Empty state: "No agent is working right now · last finished <label> <ago>" (+ stale count).
6. **Header freshness (763-799, HTML 303-307).** `ago(d.lastTs, 'last event ', ' ago')` ticking; `sync lag ~25 s` from `syncLagMs` (hidden when unknown); 30-bucket events-per-minute sparkline (`<svg id="spark" viewBox="0 0 120 22">`, rects rebuilt on data change only, last bucket emphasised, `<title>` with the total); `+N while away` badge with `data-until`. Load the `dataviz` skill before writing the sparkline.
7. **Timeline (983-1023, 1029-1041).** Row cap `TL_MAX_ROWS` (all running/stale, then most recently ended; range text "showing 60 of N"); headroom `t1 = max(t1, now + max(60 s, 5 % of span))` when anything runs; stamp the scale attributes; per-agent `rect.seg` overlays from `steps` (alternating `.alt`, `data-step` for the tooltip, open segment live); `line.atick` per activity tick (thinned per pixel, cap 200); dashed `rect.ghostbar` to `firstTs + typicalMs` for running agents with history; tooltip shows the step and "typically ~N min".
8. **Feeds and logs (817, 836, 886, 937-980).** Filter feeds with `isFeedEvent`; activity lines in Logs get tag `activity · 12 calls` and a muted style (hidden at "Info and up"); new lines get class `new` with a 1.8 s `flashin` animation (off under `prefers-reduced-motion`; burst guard: more than 30 new lines in one render → no animation).
9. **Agent cards (802-814).** Add the typical-duration line, `quiet()` in the foot for running agents, and `N tool bursts` next to the event count. Factory view cards (1083-1084): `here for` becomes `ago()`.
10. **Local source.** `connectLocal()` when `location.hostname` is `localhost`/`127.0.0.1`: `EventSource('/events')`; message types `event` (ingest, source `local`), `tasks` (replace `state.tasks`), heartbeat comments; conn pill states `local` ("Local live"). Otherwise `connectDb()` as today. `data.ephemeral` activity lines update `lastActivity`, `lastTs` and ticks only.
11. **Fallback tasks (391-408).** Regenerate `SEED_TASKS` from `card.py sync-ops` (59 cards; the old P1-00..P7-00 placeholders are gone) so the offline/local view is not stale.
12. **CSS.** Strip (`position: sticky; top: 0; z-index: 5`, grid row collapsing to 2 then 1 columns at 1100/700 px), `.squiet` dot coloured by `data-q` (`--good`/`--warn`/`--critical`; `--serious` stays for blocked), `.meter { position: relative }` with the striped `.ghost`, `.spark`, `.unseen`, `@keyframes flashin`, timeline `.seg`/`.atick`/`.ghostbar`. All through the existing tokens; reduced-motion block extended.
13. **Tests (`monitor.test.js`).** Activity updates liveness not message; later message beats older activity; activity never revives a done agent nor un-stales; `normEvent` activity defaults and stepIndex lifting; step segments open/closed; stepIndex sticky rules; typical by station suffix and by prefix across runs (failed excluded; none → null); `rateBuckets`; `quietClass` thresholds; `fmtAgo` pinned; `isFeedEvent`; `activityTicks` bound; `classifyRemoval`; `pruneMemory` keeps file events and newest; `working` order; `syncLagMs`.

Risks and mitigations: `derive()` at 5000 events ≈ a few ms once the card.move pre-grouping lands; structural renders are throttled to 400 ms so 50-op sync bursts coalesce; SVG churn is bounded by the row and tick caps; the tick skips when hidden and runs immediately on return; negative elapsed from clock skew clamps to 0 s; ETA shows only with history and is always labelled an estimate; the artifact sandbox has no Notification API or visible title, so all cues are in-page.

## Part 3: local viewer, `tools/monitor/serve.py` (stdlib only)

`python3 tools/monitor/serve.py [--port 8787] [--root .bridle/progress] [--interval 0.25]`: serves `index.html` at `/`; `/events` is Server-Sent Events: first a `tasks` event (frontmatter of `factory/cards/*.md` through `card.py`'s `parse`/`task_doc`), then a replay of every JSONL line, then a tail (polls file sizes every 250 ms, handles truncation and new files) that streams new JSONL lines as `event` messages and new trace lines as ephemeral `agent.activity` messages (`data.ephemeral = true`, id `trace-<agentId>-<tsMs>`), plus a comment heartbeat every 15 s. Prints the URL on start. Test: `tools/monitor/test/serve.test.py` (start on a free port against a temp root, append lines, assert the stream order and the ephemeral shape).

## Files

- Change: `tools/monitor/index.html`, `tools/monitor/test/monitor.test.js`, `tools/monitor/log.sh`, `tools/monitor/check.py`, `tools/monitor/test/check.test.py`, `tools/monitor/README.md`, `tools/monitor/sync.md`, `factory/README.md`, `.claude/skills/factory/SKILL.md`, `.bridle/monitor.json` (version, `syncIntervalSeconds`, `localViewer`).
- Add: `tools/monitor/mirror.py`, `tools/monitor/watch.sh`, `tools/monitor/trace-hook.sh`, `tools/monitor/serve.py`, `.claude/settings.json`, `tools/monitor/test/mirror.test.py`, `tools/monitor/test/serve.test.py`, `factory/cards/P0-10-*.md`.
- Reuse: `log.sh`'s writer (id/seq rules), `card.py`'s `parse`/`task_doc` (tasks for the local viewer), `check.py` (validation of everything the new writers produce), `ops.sh` (kept for manual replay).
- Not touched: other cards, `.claude/agents/*.md` (the reporting change lives in the station prompt), `backfill.py`.

## Verification

1. `node tools/monitor/test/monitor.test.js`, `python3 tools/monitor/test/check.test.py`, `python3 tools/monitor/test/mirror.test.py`, `python3 tools/monitor/test/serve.test.py` pass; `python3 tools/monitor/check.py` validates the whole tree including the new `agent.activity` events.
2. Hook: spawn a scratch `general-purpose` subagent whose prompt carries the marker and makes three tool calls; the trace file shows three lines; `mirror.py pending` folds them into one activity event; a `SubagentStop` without `agent.done` yields the auto `agent.done`.
3. Local viewer: start `serve.py`, open `http://127.0.0.1:8787`, append a line with `log.sh`; it appears within a second; the strip ticks.
4. Artifact: republish in place (`publish_files`, `base_version` from `get_artifact`, title and icon kept), check `read_declaration` still has `{db, user}`, run `mirror.py pending --take` and `db_write` the batches, open the artifact: live strip, sparkline, sync lag and the timeline update; `db_list tasks` shows no stale placeholders (delete with `ifVersion` if any remain).
5. End to end: arm the watch and run the P0-10 card's own test station or a small card; activity lines appear on the artifact within one mirror pass and the timeline extends live.
6. Ship: commit as `P0-10: Monitor v4: live progress` (only the files above), move the card to ship, update `.bridle/monitor.json`, and record the new version in the `bridle-planning-state` memory.

## Out of scope

Product code; the card format; a new artifact type; push notifications from the page; changing how `Workflow`-tool agents are launched (their hook coverage is undocumented; `backfill.py` remains their fallback).
