---
id: P0-08
title: Factory lanes (parallel mode)
phase: P0
order: 3
dependsOn: [P0-02]
estimate: 1
station: spec
status: running
owner: orchestrator
updated: 2026-11-17T10:02:03Z
history:
  - 2026-11-17T10:02:03Z spec running orchestrator "Row split into P0-08.1 to .4 (card tooling, lane tooling, PR-based ship, factory rules and rehearsal)"
---

# P0-08 Factory lanes (parallel mode)

## Spec

Work package (E2 row): Factory lanes (parallel mode): one worktree, branch and foreman session per lane, absolute-path card.py and log.sh, PR-based ship (rebase on origin/main, `pnpm check`, push, `gh pr create`, merge when Actions is green, merge commit in `## Ship`), `card.py new --estimate`, `manualGates:` enforcement, line.md and SKILL.md updated

After: P0-02. Size: 1 engineer-weeks. Split into sub-cards at the spec station per E1.

Owner's decision of 2026-11-17 (`docs/decisions/log.md`): shown the foreman's recommendation (finish P0-02.6, ship P0-08, approve P1-01, P2-01 and P4-06 together, then three lanes with planning ahead and tests alongside the build; the review fan-out for large or risky cards only), the owner answered "lets follow your recommendation on this". To be carried into this row's acceptance criteria and split at its spec station:
- Planning ahead: the planner may write the plans of the next two or three cards while the current card builds; the builder re-checks a plan against current `main` before starting and sends it back if the files it names have moved.
- Tests alongside the build: the tester writes the test file from the Spec's acceptance criteria while the builder builds, not from the builder's code; the full test run still follows the build.
- Guards for lanes: each lane owns its files and one lane owns the root files (the lockfile, `turbo.json`, the Dockerfile, the toolchain files); merges are serial, each rebased on `main` with `pnpm check` green; a lane that needs to change a shared contract or an ADR stops and raises it.
- The review fan-out by workflow is for large or risky cards only, at the owner's request.
- After this row ships, the owner approves the acceptance criteria and splits of P1-01, P2-01 and P4-06 in one sitting.

Split at the spec station (2026-11-17). The foreman proposed the four sub-cards below with the proof of each; the owner's answer to the proposal was to run `/factory next`, which the foreman takes as the approval of the row's acceptance criteria and split (`docs/decisions/log.md`). The owner may still change the split before a sub-card starts.
- P0-08.1 Card tooling: `card.py` refuses to ship a card with an unticked manual gate; `card.py` and `log.sh` work from a lane's worktree by absolute path, with events landing in the main checkout; a test for `card.py new --estimate`, which exists since PLAN-05.
- P0-08.2 Lane tooling: a script that creates, lists and removes a lane (one worktree and branch `lane/<name>`); a file that maps paths to the three lanes of `docs/plan/roadmap.md` E1 (core, web, platform); a check that a card's diff stays inside its lane.
- P0-08.3 PR-based ship: rebase on `origin/main`, `pnpm check`, push, `gh pr create`, merge when Actions is green, the merge commit in `## Ship`; proven on one real pull request.
- P0-08.4 Factory rules: `factory/line.md`, `factory/README.md`, `.claude/skills/factory/SKILL.md` and the station agents updated for lanes and for the owner's decision of 2026-11-17 above; a rehearsal with two lanes; carries the row's acceptance criteria and closes the row.

Row acceptance criteria (carried by P0-08.4): (1) two foreman sessions, each in its own lane worktree, can each run one card at the same time without touching each other's files, and the monitor shows both; (2) a lane card reaches `main` only through a pull request that is rebased on `origin/main`, passes `pnpm check` locally and the required `check` in Actions, one merge at a time; (3) a card with an unticked manual gate cannot be shipped; (4) the factory documents describe the lane procedure, planning ahead and tests alongside the build, and say what stays serial.

## Plan


## Build


## Test


## Review


## Ship

