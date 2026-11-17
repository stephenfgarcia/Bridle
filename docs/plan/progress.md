# Progress

The board between the markers is generated from the cards by `python3 tools/monitor/card.py status --write docs/plan/progress.md`
(at every `card.py new` and at every ship) and checked by `python3 tools/monitor/card.py status --check docs/plan/progress.md`,
a step of `pnpm check` (`tools/test/docs.test.sh`): the check compares the card ids and the `done` ids with the cards; station,
owner, updated and "next up" are rendered, not checked. The log is written by hand at every ship (`factory/line.md`, the ship
row); a phase exit (`docs/plan/roadmap.md` Part F) is a dated entry here too. The board is regenerated at every
`card.py new` and at every ship; a station move in between is rendered at the next regeneration and is not checked.

## Board

<!-- board:start -->
| id | phase | station | status | owner | updated |
|---|---|---|---|---|---|
| P0-01 | P0 | ship | done | orchestrator | 2026-11-02T20:28:58Z |
| P0-06 | P0 | ship | done | orchestrator | 2026-11-03T10:43:19Z |
| P0-02 | P0 | ship | done | orchestrator | 2026-11-17T09:57:34Z |
| P0-03 | P0 | ship | done | orchestrator | 2026-11-02T20:31:15Z |
| P0-08 | P0 | spec | running | orchestrator | 2026-11-17T10:02:03Z |
| P0-04 | P0 | ship | done | orchestrator | 2026-11-02T21:14:07Z |
| P0-07 | P0 | backlog | planned | - | 2026-11-03T08:29:21Z |
| P0-05 | P0 | backlog | planned | - | 2026-11-03T08:29:21Z |
| P0-09 | P0 | backlog | planned | - | 2026-11-03T08:29:21Z |
| P0-11 | P0 | ship | done | orchestrator | 2026-11-17T04:50:34Z |
| P0-10 | P0 | ship | done | orchestrator | 2026-11-03T09:15:35Z |
| P0-06.1 | P0 | ship | done | orchestrator | 2026-11-03T09:35:04Z |
| P0-06.2 | P0 | ship | done | orchestrator | 2026-11-03T10:05:21Z |
| P0-06.3 | P0 | ship | done | orchestrator | 2026-11-03T10:43:18Z |
| P0-02.1 | P0 | ship | done | orchestrator | 2026-11-03T11:33:26Z |
| P0-02.2 | P0 | ship | done | orchestrator | 2026-11-03T12:27:44Z |
| P0-02.3 | P0 | ship | done | orchestrator | 2026-11-03T14:00:22Z |
| P0-02.4 | P0 | ship | done | orchestrator | 2026-11-03T14:31:10Z |
| P0-02.5 | P0 | ship | done | orchestrator | 2026-11-17T08:33:00Z |
| P0-02.6 | P0 | ship | done | orchestrator | 2026-11-17T09:57:34Z |
| P0-12 | P0 | backlog | planned | - | 2026-11-03T17:07:59Z |
| P0-08.1 | P0 | ship | done | orchestrator | 2026-11-17T14:32:55Z |
| P0-08.2 | P0 | ship | done | orchestrator | 2026-11-17T15:15:43Z |
| P0-08.3 | P0 | backlog | planned | - | 2026-11-17T10:01:07Z |
| P0-08.4 | P0 | backlog | planned | - | 2026-11-17T10:01:07Z |
| P1-01 | P1 | backlog | planned | - | 2026-11-03T08:29:21Z |
| P1-02 | P1 | backlog | planned | - | 2026-11-03T08:29:21Z |
| P1-03 | P1 | backlog | planned | - | 2026-11-03T08:29:21Z |
| P1-04 | P1 | backlog | planned | - | 2026-11-03T08:29:21Z |
| P1-05 | P1 | backlog | planned | - | 2026-11-03T08:29:21Z |
| P2-01 | P2 | backlog | planned | - | 2026-11-03T08:29:21Z |
| P2-02 | P2 | backlog | planned | - | 2026-11-03T08:29:21Z |
| P2-03 | P2 | backlog | planned | - | 2026-11-03T08:29:21Z |
| P2-04 | P2 | backlog | planned | - | 2026-11-03T08:29:22Z |
| P2-05 | P2 | backlog | planned | - | 2026-11-03T08:29:22Z |
| P2-06 | P2 | backlog | planned | - | 2026-11-03T08:29:22Z |
| P2-07 | P2 | backlog | planned | - | 2026-11-03T08:29:22Z |
| P2-08 | P2 | backlog | planned | - | 2026-11-03T08:29:22Z |
| P2-09 | P2 | backlog | planned | - | 2026-11-03T08:29:22Z |
| P2-10 | P2 | backlog | planned | - | 2026-11-03T08:29:22Z |
| P2-11 | P2 | backlog | planned | - | 2026-11-03T08:29:22Z |
| P3-01 | P3 | backlog | planned | - | 2026-11-03T08:29:22Z |
| P3-02 | P3 | backlog | planned | - | 2026-11-03T08:29:22Z |
| P3-03 | P3 | backlog | planned | - | 2026-11-03T08:29:22Z |
| P3-04 | P3 | backlog | planned | - | 2026-11-03T08:29:22Z |
| P3-05 | P3 | backlog | planned | - | 2026-11-03T08:29:22Z |
| P4-06 | P4 | backlog | planned | - | 2026-11-03T08:29:22Z |
| P4-01 | P4 | backlog | planned | - | 2026-11-03T08:29:22Z |
| P4-02 | P4 | backlog | planned | - | 2026-11-03T08:29:22Z |
| P4-05 | P4 | backlog | planned | - | 2026-11-03T08:29:22Z |
| P4-03 | P4 | backlog | planned | - | 2026-11-03T08:29:22Z |
| P4-04 | P4 | backlog | planned | - | 2026-11-03T08:29:22Z |
| P5-01 | P5 | backlog | planned | - | 2026-11-03T08:29:22Z |
| P5-02 | P5 | backlog | planned | - | 2026-11-03T08:29:22Z |
| P5-03 | P5 | backlog | planned | - | 2026-11-03T08:29:22Z |
| P5-04 | P5 | backlog | planned | - | 2026-11-03T08:29:22Z |
| P5-05 | P5 | backlog | planned | - | 2026-11-03T08:29:22Z |
| P5-06 | P5 | backlog | planned | - | 2026-11-03T08:29:23Z |
| P5-07 | P5 | backlog | planned | - | 2026-11-03T08:29:23Z |
| P5-08 | P5 | backlog | planned | - | 2026-11-03T08:29:23Z |
| P6-01 | P6 | backlog | planned | - | 2026-11-03T08:29:23Z |
| P6-02 | P6 | backlog | planned | - | 2026-11-03T08:29:23Z |
| P6-03 | P6 | backlog | planned | - | 2026-11-03T08:29:23Z |
| P6-04 | P6 | backlog | planned | - | 2026-11-03T08:29:23Z |
| P6-05 | P6 | backlog | planned | - | 2026-11-03T08:29:23Z |
| P7-01 | P7 | backlog | planned | - | 2026-11-03T08:29:23Z |
| P7-02 | P7 | backlog | planned | - | 2026-11-03T08:29:23Z |
| P7-03 | P7 | backlog | planned | - | 2026-11-03T08:29:23Z |
| P7-04 | P7 | backlog | planned | - | 2026-11-03T08:29:23Z |
| P7-05 | P7 | backlog | planned | - | 2026-11-03T08:29:23Z |
| PLAN-01 | PLAN | ship | done | orchestrator | 2026-11-02T20:51:48Z |
| PLAN-02 | PLAN | ship | done | orchestrator | 2026-11-02T22:25:54Z |
| PLAN-03 | PLAN | ship | done | orchestrator | 2026-11-02T22:07:01Z |
| PLAN-04 | PLAN | ship | done | orchestrator | 2026-11-02T23:23:05Z |
| PLAN-05 | PLAN | ship | done | orchestrator | 2026-11-03T08:28:25Z |
| PX-01.1 | PX | ship | done | orchestrator | 2026-11-17T16:39:40Z |
| PX-01.2 | PX | ship | done | orchestrator | 2026-11-17T16:57:13Z |
| PX-01.3 | PX | ship | done | orchestrator | 2026-11-17T17:49:02Z |
| PX-01.4 | PX | ship | done | orchestrator | 2026-11-17T18:17:04Z |
| PX-01.5 | PX | backlog | planned | - | 2026-11-17T16:26:44Z |
| PX-01.6 | PX | backlog | planned | - | 2026-11-17T16:26:44Z |
| PX-01.7 | PX | backlog | planned | - | 2026-11-17T16:26:44Z |
| PX-01.8 | PX | backlog | planned | - | 2026-11-17T16:26:44Z |
| PX-01.9 | PX | backlog | planned | - | 2026-11-17T16:26:45Z |
| PX-02.1 | PX | ship | done | orchestrator | 2026-11-17T16:41:27Z |
| PX-02.2 | PX | ship | done | orchestrator | 2026-11-17T17:14:47Z |
| PX-02.3 | PX | ship | done | orchestrator | 2026-11-17T17:29:59Z |
| PX-02.4 | PX | ship | done | orchestrator | 2026-11-17T18:01:39Z |
| PX-02.5 | PX | backlog | planned | - | 2026-11-17T16:26:45Z |
| PX-02.6 | PX | backlog | planned | - | 2026-11-17T16:26:45Z |
| PX-02.7 | PX | backlog | planned | - | 2026-11-17T16:26:45Z |
| PX-02.8 | PX | backlog | planned | - | 2026-11-17T16:26:45Z |
| PX-02.9 | PX | backlog | planned | - | 2026-11-17T16:26:45Z |
| PX-02.10 | PX | backlog | planned | - | 2026-11-17T16:26:45Z |
| PX-02.11 | PX | backlog | planned | - | 2026-11-17T16:26:45Z |
| PX-02.12 | PX | backlog | planned | - | 2026-11-17T16:26:45Z |
| PX-02.13 | PX | backlog | planned | - | 2026-11-17T16:26:45Z |
| PX-03.1 | PX | backlog | planned | - | 2026-11-17T16:26:45Z |
| PX-03.2 | PX | backlog | planned | - | 2026-11-17T16:26:45Z |
| PX-03.3 | PX | backlog | planned | - | 2026-11-17T16:26:45Z |
| PX-03.4 | PX | backlog | planned | - | 2026-11-17T16:26:45Z |
| PX-03.5 | PX | backlog | planned | - | 2026-11-17T16:26:45Z |
| PX-03.6 | PX | backlog | planned | - | 2026-11-17T16:26:45Z |
| PX-03.7 | PX | backlog | planned | - | 2026-11-17T16:26:45Z |
| PX-03.8 | PX | backlog | planned | - | 2026-11-17T16:26:45Z |
| PX-03.9 | PX | backlog | planned | - | 2026-11-17T16:26:45Z |
| PX-03.10 | PX | backlog | planned | - | 2026-11-17T16:26:46Z |
| PX-03.11 | PX | backlog | planned | - | 2026-11-17T16:26:46Z |
| PX-03.12 | PX | backlog | planned | - | 2026-11-17T16:26:46Z |
| PX-04.1 | PX | backlog | planned | - | 2026-11-17T16:26:46Z |
| PX-04.2 | PX | backlog | planned | - | 2026-11-17T16:26:46Z |
| PX-04.3 | PX | backlog | planned | - | 2026-11-17T16:26:46Z |
| PX-04.4 | PX | backlog | planned | - | 2026-11-17T16:26:46Z |
| PX-04.5 | PX | backlog | planned | - | 2026-11-17T16:26:46Z |
| PX-04.6 | PX | backlog | planned | - | 2026-11-17T16:26:46Z |
| PX-04.7 | PX | backlog | planned | - | 2026-11-17T16:26:46Z |
| PX-04.8 | PX | backlog | planned | - | 2026-11-17T16:26:46Z |

Next up: P0-07 External dependencies and legal register
<!-- board:end -->

## In flight / next / only the owner can do

Resumed 2026-11-17 by the owner after the pause of 2026-11-04 (the `- Paused` entry of the Log below). Since 2026-11-18 the work
follows the pitch plan (`docs/plan/pitch-plan.md`), with cards PX-01.1 to PX-04.8 running in the lanes core and web; `card.py list`
and the board above say which are in flight, and the last shipped card is PX-01.4 (`124eaaa`). The cards shipped on 2026-11-17,
before the pitch plan: P0-08.2 Lane tooling (`09c0851`), P0-08.1 Card tooling (`99168d5`), P0-02.6 Externalized UI strings
(`c005a7c`, which closed the P0-02 Repository bootstrap row; the row's card, `## Ship`, lists the three deliverables that wait for
later rows), P0-02.5 Next.js skeleton (`ee5d288`) and P0-11 Resume-ability (`6078dcd`); before those, P0-02.4 (`d8d8b7e`).

Parked on 2026-11-17 by the owner's decision of that day (`docs/decisions/log.md`): the P0-08 Factory lanes row stops after
P0-08.2. P0-08.3 PR-based ship is built and passing but not tested, reviewed or shipped: its work is the local commit `WIP P0-08.3`
on branch `lane/platform` in the worktree `../Bridle-1.lanes/platform` (not pushed; the card's copy there is at build with status
parked, and the pause note at the end of the Spec of the card on `main` says how to resume). P0-08.4 Factory rules is not started.
The P0-08 row card stays at spec with status running until the owner closes or resumes it.

Next: the January pitch plan. The owner presents the project on 2027-01-01 to a university and a competition panel and wants a
working showcase by mid-December 2026, so `docs/plan/roadmap.md` becomes the plan for after the pitch and the foreman drafts a
plan, which the owner approved on 2026-11-18 (`docs/plan/pitch-plan.md`): first a frame solver with a 3D workspace and live results, then tasks, submission, AI
feedback against a rubric and a simple instructor view, built in that order so that the first part stands alone if the second
slips. Its cards are the sub-cards PX-01.1 to PX-04.8. Until the pitch the roadmap order does not apply: P0-07, P0-05
OpenTofu (its apply sub-card waits for the AWS items below), P0-12 and the drafts of P1-01, P2-01 and P4-06 (answered by the
owner on 2026-11-17) wait for the pitch plan to say which of them it uses. The owner's five measures of 2026-11-17 for faster
production were to be written into the factory documents by P0-08.4; they stay in force from `docs/decisions/log.md`. The `## Ship`
sections of cards P0-08.2, P0-08.1, P0-02.6, P0-02.5 and P0-11 list what each leaves for later cards.

Only the owner can do (the nine E4 rows of `docs/plan/roadmap.md` and the six M0 items of `docs/architecture/architecture.md`
section 17). Status: "done" names the card that proves it; "open" means the repository records it as not done yet; "unknown"
means no card or document says either way. The six M0 items were due 2026-11-16; on 2026-11-17 their rows still carry the
owner's word of 2026-11-04, and nothing later is recorded.

| Item | Needed before | Due | Status |
|---|---|---|---|
| E4.1 Push `main`, enable Actions, repository secrets, branch protection | P0-02.3 | | done: the push, Actions and branch protection at P0-06.3 (`a898c34`) and P0-02.3 (`0e2e2cf`, required check `check`); secrets: none needed yet (`docs/ops/github.md` item d) |
| E4.2 Docker Desktop or OrbStack, rustup, pnpm via corepack, OpenTofu, AWS CLI, Playwright browsers installed | P0-06 | | done: P0-06.1 (`ceba851`); `bash tools/doctor.sh` proves the eleven tools of `tools/toolchain.json` |
| E4.3 AWS account with billing alarms, OpenTofu state bucket and lock table, OIDC role for Actions, domain in Route53 and ACM, SES production access | P0-05 apply sub-card (staging is needed by P5-08 and P7) | | open: plan-approval decision 4, default in force, not yet answered (`docs/ops/secrets.md`, "Obtained at" P0-05.2) |
| E4.4 Google Cloud and Microsoft Entra OIDC app registrations | P4-01 | | open |
| E4.5 Anthropic API key, organization spend cap, rate-limit tier request; about $25 for the measurement run | P5-03 manual gate | | open |
| E4.6 Grafana Cloud, Sentry and status-page accounts | P7-02 | | open |
| E4.7 Self-hosted M1 Mac mini and Tiger Lake runners | P2-04 R14 evidence only (never blocks ship) | | unknown: no card or document says whether the runners exist or are set up |
| E4.8 AISC Shapes license (requested at P0-07, executed by M4), ASCE and ACI consent requests, counsel, SME framework agreements and signed verification records, DMCA agent, pentest booking, insurance, pilot agreement | P0-07 requests; gates on P2-11, the P2-08 clause attestation, P7-04 and P7-05 | M0 2026-11-16 for counsel, the AISC and ACI requests and the SME agreements; M4 2027-03-12 for the executed AISC license | open: P0-07 is at backlog |
| E4.9 Design-partner instructors and two SME reviewers named; spring-2028 term confirmed | P1-05 | M0 2026-11-16 | open: plan-approval decision 1, default in force, not yet answered |
| M0 Counsel engaged | P0-07 requests (E4.8); M3 determinations for register items 1-3 and 5-8 | 2026-11-16 | open: not started (owner, 2026-11-04) |
| M0 AISC Shapes license and ACI consent requests sent | P0-07 sends them; P2-11 and the ACI pack (E4.8) | 2026-11-16 | open: not started (owner, 2026-11-04); P0-07 is at backlog |
| M0 SME framework agreements signed | P0-07 requests; gates on P2-11, the P2-08 clause attestation, P7-04 (templates SME-signed) and P7-05 (E4.8) | 2026-11-16 | open: not started (owner, 2026-11-04); the reviewers are not named (E4.9) |
| M0 Design partners named | P1-05 (E4.9) | 2026-11-16 | open: not started (owner, 2026-11-04) |
| M0 Spring-2028 term confirmed | P1-05 (E4.9) | 2026-11-16 | open: not started (owner, 2026-11-04) |
| M0 Contractor R2 starts | the pack and conformance work (build-sequence step 5, overlapping step 3; P2-06 to P2-08) | 2026-11-16 | open: not started (owner, 2026-11-04) |

## Log

One entry per shipped card and per recorded commit without a card, chronological, in this shape:
`- <date> <time>, <card id or "no card">, commit <hash>: <title>; <one line>`, the title being the card's or its commit's
subject. For a card the hash is the one in its `## Ship` section (where that section names no hash, the entry says where its
hash comes from); every hash is verified against `git log --oneline`, and the date and time are the commit's, on the local
clock (UTC+8). Cards shipped before `0e2e2cf` (P0-02.3, the Actions workflow) predate CI and carry no Actions run URL.
A pause is an entry too, in the shape `- Paused <date> <time> (<who>): <the state at the pause>`, on the same clock: the last
shipped card, the parked card and how to resume it, what is next, the open owner items, the last check and its Actions run, and
the sessions open on the checkout.

- 2026-11-03 04:11, P0-01, commit 9b95026 (and ecc7870 at 04:15, the backfill tool): Build and publish this monitor; seed tasks; first commit; the Bridle Build Monitor page, `tools/monitor/log.sh`, the seed tasks, the repository's first commit. Both hashes come from the card's history line "Monitor published and committed (9b95026, ecc7870)"; its `## Ship` was empty until the pause check of 2026-11-04.
- 2026-11-03 04:31, P0-03, commit ee9afdc: Software factory: skill, station agents, cards, Factory view; the `/factory` skill, four station agents, `tools/monitor/card.py`, the first cards, the monitor's Factory view.
- 2026-11-03 04:51, PLAN-01, commit 2ffea1e: Requirements discovery; 517 requirements in 14 documents under `docs/requirements`, ADR 0001.
- 2026-11-03 05:14, P0-04, commit cf6276b: Monitor JSONL validator; `tools/monitor/check.py`, the first card through every station of the line.
- 2026-11-03 06:07, PLAN-03, commit add1426: UI/UX specification; `docs/ux` (ux-spec, 79 screens, tokens, five surfaces, critiques).
- 2026-11-03 06:25, PLAN-02, commit f032ea1: Architecture; `docs/architecture` (three proposals, judges, 26 decisions, the 16-step build sequence).
- 2026-11-03 07:23, PLAN-04, commit 89bed6d: Adversarial polish follow-ups; the plan revised (86 fixes), twelve document corrections, ADR 0002 written as proposed.
- 2026-11-03 16:28, PLAN-05, commit ce7b2dc: Final plan assembled and presented for approval; approved by the owner on 2026-11-03 (the second approval). The card has no commit of its own (its `## Ship` says the plan file lived outside the repository); ce7b2dc "PLAN-05 approved: ADR 0002 adopted; card.py gains --estimate" is the approval commit on record.
- 2026-11-03 17:15, P0-10, commit 126d1f8 (card shipped in 5f3260c; follow-ups dc5ae67 and d58fed8, no bytecode): Monitor v4: live progress; the live strip, the trace hook, `mirror.py`, `watch.sh`, `serve.py`, protocol v2.
- 2026-11-03 17:35, P0-06.1, commit ceba851: Toolchain pins, installs, and tools/doctor.sh; `tools/toolchain.json`, the installs, `docs/ops/toolchain.md`.
- 2026-11-03 18:05, P0-06.2, commit f637497 (amended by dd7b40f at 22:01: the `gh pr merge` rule): Claude Code command allowlist for the factory; `.claude/settings.json`, `docs/ops/permissions.md`.
- 2026-11-03 18:43, P0-06.3, commit a898c34: First push to GitHub and the GitHub checklist; `main` pushed, `docs/ops/github.md`.
- 2026-11-03 18:43, P0-06, commit dfd0b72: Toolchain and machine bootstrap; the work package closed, its deliverables being the three sub-cards' commits (ceba851, f637497, a898c34). The hash comes from the card's history line 2026-11-03T10:43:19Z ("Work package complete: P0-06.1 (ceba851), P0-06.2 (f637497), P0-06.3 (a898c34)"), whose time is that of dfd0b72 ("Cards: P0-06.3 shipped; P0-06 work package complete"); its `## Ship` was empty until the pause check of 2026-11-04, when the foreman names dfd0b72 there.
- 2026-11-03 19:33, P0-02.1, commit bd758ed (chore 049b0fd at 20:27: `tools/agent-hq` excluded from root Biome): Workspace skeleton and the first pnpm check; pnpm, Turborepo, Biome, Cargo, `packages/units`, `crates/bridle-canon`, `tools/check.sh`.
- 2026-11-03 20:27, P0-02.2, commit 1890d99: Docker compose stack and pnpm dev smoke; `compose.yaml` (Postgres on host port 55432, RustFS as the `minio` service, mailpit), `tools/dev.sh`, `docs/ops/local-dev.md`.
- 2026-11-03 21:53, P0-02.3, commit 0e2e2cf: Actions PR workflow proven on a pushed branch; `.github/workflows/check.yml`, the required check `check` on `main`, pull request #1, P0-06.3's gates ticked; run https://github.com/stephenfgarcia/Bridle/actions/runs/41648493356.
- 2026-11-03 22:29, P0-02.4, commit d8d8b7e: Dockerfile with four stub entrypoints; `Dockerfile`, `.dockerignore`, `tools/entrypoint.sh`, `tools/test/image.test.sh`; run https://github.com/stephenfgarcia/Bridle/actions/runs/41654180819; card marked done in d2d9b4c.
- 2026-11-03 22:32, no card, commit 8e0e550: the verbatim copies of the approved plan and the monitor v4 plan committed as `docs/plan/roadmap.md` and `docs/plan/monitor-v4.md` (the header blocks come with P0-11).
- 2026-11-03 22:38, no card, commit 0ef5e8c: P0-08 ordered right after P0-02 (owner decision 3); the P0-11 card committed with its Spec and Plan.
- 2026-11-03 22:43, no card, commit aac9cca: Agent HQ: neon office dashboard (2D, 3D, iso, live data); the other session's standalone app under `tools/agent-hq` (78 files), outside the pnpm workspace and the factory.
- Paused 2026-11-04 01:07 (foreman, at the owner's instruction): last shipped card P0-02.4 (`d8d8b7e`); parked card P0-11 at build after review
  loop 1, its files on `main` in `8e1f6dd` without the second test and review (resume with `/factory run P0-11` at the test station);
  next up after P0-11: P0-02.5 Next.js skeleton and pnpm e2e:smoke; open owner items: the six M0 items due 2026-11-16, none
  started (owner, 2026-11-04), and the E4 rows marked open above; `pnpm check` 7/7 ok at `8e1f6dd`, Actions run https://github.com/stephenfgarcia/Bridle/actions/runs/41680833335 green;
  sessions open on this checkout at the pause: the foreman (bridle-1-3f), the monitor owner (bridle-1-64), Agent HQ
  (bridle-1-fb), two idle sessions that did nothing here (bridle-1-d3, bridle-1-aa) and a Remote Control bridge, all closed
  at the pause (owner, 2026-11-04).
- 2026-11-17 12:48, P0-11, commit 6078dcd: Resume-ability: the plan, a root README, progress and decisions logs in the repository; the canonical `docs/plan/roadmap.md`, the root `README.md`, this file, `docs/decisions/log.md`, the resume and several-sessions rules of the factory documents, `tools/test/docs.test.sh` as step 7 of `pnpm check`. First on `main` unreviewed in 8e1f6dd at the owner's pause; reworked, tested and reviewed on 2026-11-17 (second review PASS); run https://github.com/stephenfgarcia/Bridle/actions/runs/44019661238; card marked done in the `Cards: P0-11 shipped` commit that follows it.
- 2026-11-17 16:31, P0-02.5, commit ee5d288: Next.js skeleton and pnpm e2e:smoke; `apps/web` (Next.js 15, React 19) with a home page and `/api/v1/health`, the Chromium-only Playwright smoke `pnpm e2e:smoke` with its screenshot, `tools/test/web.test.sh`, the image pruned of the web app, and the full list of pin mirrors in `docs/ops/toolchain.md`; Actions run https://github.com/stephenfgarcia/Bridle/actions/runs/44047464566 green.
- 2026-11-17 17:55, P0-02.6, commit c005a7c: Externalized UI strings: catalog, lint, pseudo-locale; `packages/i18n` (ICU catalog `en.json`, typed `t()`, the pseudo-locale `en-XA.json` and `pnpm i18n:pseudo`, the string lint in `pnpm lint` with its allowlist), `apps/web` on the catalog by `NEXT_PUBLIC_LOCALE`, `tools/test/i18n.test.sh` and `docs/ops/i18n.md`; the P0-02 row closed with it; Actions run https://github.com/stephenfgarcia/Bridle/actions/runs/44060053116 green.
- 2026-11-17 17:55, P0-02, commit c005a7c: Repository bootstrap; the work package closed with its last sub-card, its deliverables being the six sub-cards' commits (bd758ed, 1890d99, 0e2e2cf, d8d8b7e, ee5d288, c005a7c); the hash and time are those of P0-02.6's commit, as the card's `## Ship` and its history line say ("Work package complete").
- 2026-11-17 22:31, P0-08.1, commit 99168d5: Card tooling: manual gates and worktree-safe card.py and log.sh; `card.py gates` and `gate`, the refusal of ship or done with an open gate (exit 3), of malformed gate lines, line breaks and non-UTF-8 arguments, atomic card writes, events written to the main checkout from a linked worktree by `log.sh` and `trace-hook.sh`, 47 cases in `tools/monitor/test/card.test.py`; the owner allowed one build loop past a block and set the bar for the remaining stations; Actions run https://github.com/stephenfgarcia/Bridle/actions/runs/44104022679 green.
- 2026-11-17 23:14, P0-08.2, commit 09c0851: Lane tooling: worktree per lane, path ownership, lane check; `tools/factory/lane.sh` (new, list, remove), `factory/lanes.json` (every path in one of core, web, platform), `tools/factory/lane-check.sh`, `card.py move --lane` with one running card per lane, `tools/test/lanes.test.sh` (hand-run, seven cases) and 51 cases in `tools/monitor/test/card.test.py`; one rework loop for a false docstring sentence; Actions run https://github.com/stephenfgarcia/Bridle/actions/runs/44111986297 green.
- 2026-11-18 00:39, PX-01.1, commit f1c2c89: Model types and validation; the package `packages/model` (`@bridle/model`): the types of a structural model in kN and m with Z up, `validateModel` with eleven issue codes, `parseModel` and `serializeModel`, the member local-axis rule in `memberLocalAxes`, three fixture models, 98 tests; built and tested by one agent under the pitch process.
- 2026-11-18 00:41, PX-02.1, commit e9ee25e: App shell, design tokens and 3D dependencies; the app shell of `apps/web` (top bar, navigation, `/workspace` with a viewport area and a side panel, `/tasks`), the design tokens as a tested copy of `docs/ux/tokens.css`, `three` 0.187.0, `@react-three/fiber` 9.8.2, `@react-three/drei` 10.7.9 and `zustand` 5.1.0, a third smoke test, the `plain` case of `tools/test/web.test.sh` replaced by `shell`; built and tested by one agent under the pitch process.
- 2026-11-18 00:57, PX-01.2, commit a649c06: 3D frame element stiffness and assembly; the package `packages/solver` (`@bridle/solver`): the 12 by 12 Euler-Bernoulli 3D frame element in local axes, its transformation from `memberLocalAxes`, and `assemble` for the dense global stiffness matrix with the degree-of-freedom map, 49 tests; an independent review compared all 144 entries with the textbook matrix and closed-form cases and failed one README sentence, fixed by the foreman.
- 2026-11-18 01:14, PX-02.2, commit f09c66d: 3D viewport; the 3D viewport of `/workspace`: a model drawn with Z up (nodes, members, fixed, pinned and roller glyphs), orbit, pan, zoom, Fit and the views 3D, Front and Top, an axis indicator, hover and select with the properties in the side panel, a switch between the three example models, 32 unit tests of the scene description and five smoke tests; `tools/test/i18n.test.sh` and two documents of `docs/ops` brought up to date; built and tested by one agent under the pitch process.
- 2026-11-18 01:29, PX-02.3, commit 1fb07cc: Model store with undo and redo; the model store of the workspace: pure commands for nodes, members, supports, loads, sections, materials and load cases with their refusals, new ids, undo and redo with a history of 200 steps, the Undo and Redo buttons and shortcuts, the issues of `validateModel` in the side panel with catalog messages, 72 new unit tests; built and tested by one agent under the pitch process.
- 2026-11-18 01:48, PX-01.3, commit 8de87e8: Supports, nodal loads and the solve; `solve(model)` in `packages/solver`: supports, nodal loads, an L D Lᵀ factorization with symmetric pivoting, displacements and reactions per load case, and an `unstable` result that names a node and a degree of freedom; `validateModel` refuses non-finite numbers; 108 solver tests and 170 model tests. The first review found a beam free to spin reported as solved; one rework loop replaced the stability rule, and the second review passed it after 1950 new mechanisms were all refused.
- 2026-11-18 02:01, PX-02.4, commit 93471e8: Node and member tools; the drawing tools of the workspace: a palette with Select, Node and Member, a work plane (X-Z or X-Y) with a snap step and a cursor readout, nodes placed by a click, members drawn from click to click with a preview line, a selected node dragged or typed to a new place, Delete, and "New model"; 72 new unit tests and a sixth browser test that draws two nodes and a member; built and tested by one agent under the pitch process.
- 2026-11-18 02:17, PX-01.4, commit 124eaaa: Member loads and member end forces; member loads in `solve` (a uniform load over a member, a point load at a position, in local or global axes) through consistent nodal loads, member end forces per load case in local axes, and the smallest pivot ratio in the result; 156 solver tests. An independent review confirmed 148 values and the signs against its own statics and failed one README sentence, reworded by the foreman.
