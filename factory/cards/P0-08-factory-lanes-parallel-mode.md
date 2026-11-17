---
id: P0-08
title: Factory lanes (parallel mode)
phase: P0
order: 3
dependsOn: [P0-02]
estimate: 1
station: backlog
status: planned
owner: -
updated: 2026-11-03T08:29:21Z
history:
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

## Plan


## Build


## Test


## Review


## Ship

