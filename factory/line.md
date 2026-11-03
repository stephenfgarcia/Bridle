# The line

| # | Station | Worker | Job | Exit criteria |
|---|---|---|---|---|
| 0 | backlog | nobody | Card exists with a title, phase, order, and dependencies. | Dependencies are shipped before the card starts. |
| 1 | spec | foreman (you approve per E2 row) | Fill `## Spec`: what, why, acceptance criteria, files likely touched, out of scope. | Acceptance criteria are testable; the card is one sub-card of an approved E2 row (one package, at most one day). |
| 2 | plan | `factory-planner` | Fill `## Plan`: ordered steps, exact files to add or change, tests to write, risks. Read-only on the codebase. | Each step names a file; the test list covers every acceptance criterion. |
| 3 | build | `factory-builder` | Do the plan: write the code, keep it runnable, fill `## Build` with what changed and how to run it. | Code runs; no step of the plan skipped without a written reason. |
| 4 | test | `factory-tester` | Write or extend tests for the acceptance criteria, run them, fill `## Test` with commands and results. | Every acceptance criterion has a passing test; `pnpm check` passes (and `pnpm e2e:smoke` for cards touching apps/web, with screenshots attached under `## Test`); failures are reported verbatim. |
| 5 | review | `factory-reviewer` | Review the diff against `## Spec` and this table; fill `## Review` with PASS or FAIL and findings (file:line). Read-only. | PASS only when the spec is met, tests cover it, and nothing unrelated changed. |
| 6 | ship | orchestrator | Commit the code and the card (its sections through `## Review`) as `<id>: <title>` and push; then fill `## Ship` with the hash and the Actions run URL, move the card to `done`, regenerate the progress board, write the log entry, and commit them as `Cards: <id> shipped`, pushed at once. | `pnpm check` passes on the commit; the commit is pushed and the Actions run URL is in `## Ship`; every `manualGates:` item is ticked; card status is `done`; the progress board regenerated (`python3 tools/monitor/card.py status --write docs/plan/progress.md`) and the log entry written in `docs/plan/progress.md` with its hash and time, both in the `Cards: <id> shipped` commit (a phase exit is a dated entry there too). |

Loops: a FAIL at test or review moves the card back to **build** with the findings as the move note. One loop
per station; a second failure stops the card as `blocked` for a human.

Reporting: every worker reports through `tools/monitor/log.sh` (protocol in `tools/monitor/README.md`) with
`runId=factory`, `agentId=<card id>-<station>`, `taskId=<card id>`. The foreman emits `card.move` events.
