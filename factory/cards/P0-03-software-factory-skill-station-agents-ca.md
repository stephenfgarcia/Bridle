---
id: P0-03
title: Software factory: skill, station agents, cards, Factory view
phase: P0
order: 3
dependsOn: [P0-01]
station: ship
status: done
owner: orchestrator
updated: 2026-11-02T20:31:15Z
history:
  - 2026-11-02T20:30:16Z spec running orchestrator "Spec written (after the fact: the factory was built before the line existed)"
  - 2026-11-02T20:30:16Z plan running orchestrator "Plan: README, line, card.py, skill, 4 station agents, Factory view, tests"
  - 2026-11-02T20:30:16Z build running orchestrator "Built: 16 cards, card.py, skill, agents, Factory view"
  - 2026-11-02T20:30:16Z test running orchestrator "node tools/monitor/test/monitor.test.js: ALL TESTS PASSED, FACTORY TESTS PASSED"
  - 2026-11-02T20:30:16Z review running orchestrator "Self-review PASS; rendering unverified in this session"
  - 2026-11-02T20:31:15Z ship done orchestrator "Shipped in ee9afdc"
---

# P0-03 Software factory: skill, station agents, cards, Factory view

## Spec

What: a small, visual software factory for this repo: markdown work cards, one line of stations, a Claude Code
skill as foreman, one subagent per working station, and a Factory view on the Bridle Build Monitor.
Why: implementation will run as many small tasks in parallel; the factory makes each task's path, state, and
worker visible, and keeps the process explainable in a few minutes.
Acceptance criteria:
1. `.claude/skills/factory/SKILL.md` defines `/factory run|next|status|new` and the station procedure with loops.
2. Four station subagents exist (`factory-planner`, `factory-builder`, `factory-tester`, `factory-reviewer`).
3. Cards are markdown files with frontmatter; `tools/monitor/card.py` lists, creates, moves, and syncs them, and a move emits a `card.move` event.
4. The monitor has a Factory view: the line with cards at stations, planned progression with next-up, and a per-card station track with times.
5. `factory/README.md` explains the whole thing on one page.
Out of scope: running product work through the line before the roadmap is approved.


## Plan

1. `factory/README.md`, `factory/line.md`: the explanation and the station table with exit criteria.
2. `tools/monitor/card.py`: frontmatter parser/writer; list, show, new, move (calls log.sh with card.move), sync-ops.
3. `.claude/skills/factory/SKILL.md`: commands, run procedure, station prompt with the reporting block.
4. `.claude/agents/factory-{planner,builder,tester,reviewer}.md`: one focused prompt each.
5. `tools/monitor/index.html`: `#factory` view (board, planned flow, card detail); `card.move` counts as a status event.
6. `tools/monitor/test/monitor.test.js`: headless derivation tests including card state and next-up.
Tests: node test for derivation; card.py smoke (new/move/list/sync-ops) by hand.
Risk: subagent frontmatter format; mitigated by keeping only `name` and `description`.


## Build

Files added: factory/README.md, factory/line.md, factory/cards/*.md (16 cards), tools/monitor/card.py,
.claude/skills/factory/SKILL.md, .claude/agents/factory-planner.md, factory-builder.md, factory-tester.md,
factory-reviewer.md, tools/monitor/test/monitor.test.js. Files changed: tools/monitor/index.html (Factory view),
tools/monitor/README.md. Run: open the monitor and choose Factory; `python3 tools/monitor/card.py list`.
Deviation: built directly by the orchestrator (the line did not exist yet), so this card's stations were
recorded after the fact.


## Test

RESULT: PASS
Command: `node tools/monitor/test/monitor.test.js`
Covers: criterion 3 (card.move -> station, status, progress; history), criterion 4 (next-up excludes placeholders and
non-planned cards; done cards sit at ship), plus the earlier monitor assertions. card.py smoke: new, move, show,
list, sync-ops on a throwaway card, then removed. Not covered by a test: rendering (no browser in this session).


## Review

VERDICT: PASS (self-review by the orchestrator; a station reviewer will review every later card)
Checked: all five acceptance criteria present in the repo; derivation tests pass; no unrelated files changed.
Findings (advisory): the page has not been rendered in a browser this session; first viewer confirms layout.


## Ship

Commit ee9afdc (P0-03: Software factory). Monitor page republished as version 1793651441-dfb1.

