# The line

| # | Station | Worker | Job | Exit criteria |
|---|---|---|---|---|
| 0 | backlog | nobody | Card exists with a title, phase, order, and dependencies. | Dependencies are shipped before the card starts. |
| 1 | spec | you + Claude (orchestrator) | Fill `## Spec`: what, why, acceptance criteria, files likely touched, out of scope. | Acceptance criteria are testable; scope fits one card (hours, not days). |
| 2 | plan | `factory-planner` | Fill `## Plan`: ordered steps, exact files to add or change, tests to write, risks. Read-only on the codebase. | Each step names a file; the test list covers every acceptance criterion. |
| 3 | build | `factory-builder` | Do the plan: write the code, keep it runnable, fill `## Build` with what changed and how to run it. | Code runs; no step of the plan skipped without a written reason. |
| 4 | test | `factory-tester` | Write or extend tests for the acceptance criteria, run them, fill `## Test` with commands and results. | Every acceptance criterion has a passing test; failures are reported verbatim. |
| 5 | review | `factory-reviewer` | Review the diff against `## Spec` and this table; fill `## Review` with PASS or FAIL and findings (file:line). Read-only. | PASS only when the spec is met, tests cover it, and nothing unrelated changed. |
| 6 | ship | orchestrator | Commit the code and the card as `<id>: <title>`; fill `## Ship` with the hash. | Commit exists; card status is `done`. |

Loops: a FAIL at test or review moves the card back to **build** with the findings as the move note. One loop
per station; a second failure stops the card as `blocked` for a human.

Reporting: every worker reports through `tools/monitor/log.sh` (protocol in `tools/monitor/README.md`) with
`runId=factory`, `agentId=<card id>-<station>`, `taskId=<card id>`. The foreman emits `card.move` events.
