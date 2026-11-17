# Bridle

Bridle is a web-based Learning Management System for structural engineers built on the "Dedicated Simulation" strategy: a 3D
modeling workspace with live finite-element analysis, built-in grading and task completion tracking, and an AI grader that scores
designs against real-world criteria (building codes, site environment such as wind/seismic/snow/soil, efficiency, constructability,
engineering judgment). The stack is a TypeScript monorepo (Next.js and React with react-three-fiber, Postgres 16) with one Rust core
compiled to WebAssembly for browser and server, on AWS via OpenTofu ([docs/plan/roadmap.md](docs/plan/roadmap.md), Context and the
decisions table). Calendar ([ADR 0002](docs/decisions/0002-architecture-amendments.md) A4): friendly alpha summer 2027,
production-ready 2027-12-01, first pilot spring 2028.

## Start here

Read in this order: this file; [docs/plan/roadmap.md](docs/plan/roadmap.md) Part E (the implementation roadmap; approved
2026-11-03; the canonical copy); [docs/plan/progress.md](docs/plan/progress.md) (what shipped, what is in flight, what is next,
what only the owner can do); [docs/decisions/log.md](docs/decisions/log.md) (the owner's decisions);
[factory/README.md](factory/README.md) (how work moves).

## Repository map

- [docs/requirements](docs/requirements/00-index.md): 14 documents, 517 requirements; the index lists them.
- [docs/architecture](docs/architecture/README.md): architecture.md, decisions.md, build-sequence.md.
- [docs/ux](docs/ux/README.md): ux-spec.md, screen-inventory.md, tokens.css.
- [docs/decisions](docs/decisions): [ADR 0001](docs/decisions/0001-mvp-scope-resolutions.md), [ADR 0002](docs/decisions/0002-architecture-amendments.md), [log.md](docs/decisions/log.md) (the owner's operational decisions).
- [docs/ops](docs/ops): [github.md](docs/ops/github.md), [i18n.md](docs/ops/i18n.md), [local-dev.md](docs/ops/local-dev.md), [permissions.md](docs/ops/permissions.md), [secrets.md](docs/ops/secrets.md), [toolchain.md](docs/ops/toolchain.md).
- [docs/plan](docs/plan): [roadmap.md](docs/plan/roadmap.md), [monitor-v4.md](docs/plan/monitor-v4.md), [progress.md](docs/plan/progress.md).
- [factory](factory/README.md): README.md, [line.md](factory/line.md) (stations, workers, exit criteria), [cards/](factory/cards) (one markdown file per work item).
- [tools](tools): [check.sh](tools/check.sh) (`pnpm check`), [doctor.sh](tools/doctor.sh), [dev.sh](tools/dev.sh), [monitor/](tools/monitor/README.md) (the Bridle Build Monitor and `card.py`), [test/](tools/test) (one test file per shipped P0-02 and P0-06 sub-card, plus `docs.test.sh` for P0-11; the monitor's tests are in `tools/monitor/test`).
- [apps](apps): [web](apps/web), the Next.js application, and [e2e](e2e), its Playwright smoke test (`pnpm e2e:smoke`); [packages](packages): [units](packages/units), the first TypeScript package, and [i18n](packages/i18n) (the message catalog, `t()`, the string lint); [crates](crates): [bridle-canon](crates/bridle-canon), the first Rust crate.
- Root: [compose.yaml](compose.yaml) (`pnpm dev`), [Dockerfile](Dockerfile), [.github/workflows/check.yml](.github/workflows/check.yml) (CI, the required check `check`), [.claude](.claude): [skills/factory/SKILL.md](.claude/skills/factory/SKILL.md) (the foreman), [agents/](.claude/agents) (the four station agents).
- `tools/agent-hq/`: another session's standalone app (committed in `aac9cca`, excluded from root Biome by `049b0fd`), not part of the pnpm workspace or the factory.

## Where the state is

- `python3 tools/monitor/card.py list`: every card with its station and status, and who is next up.
- `/factory status` in a Claude Code session: the same, plus the monitor's mirror state and the board check.
- [docs/plan/progress.md](docs/plan/progress.md): the generated board, the owner's open items, the log of shipped cards with their commits.
- The monitor: the `url` in [.bridle/monitor.json](.bridle/monitor.json); the local viewer: `python3 tools/monitor/serve.py`, then http://127.0.0.1:8787/.
- The per-tool event log is machine-local (`.bridle/progress/`, gitignored) and mirrored into the claude.ai artifact; the cards and git are the durable record.

## How to resume

1. `bash tools/doctor.sh` (the toolchain, [docs/ops/toolchain.md](docs/ops/toolchain.md)), then `pnpm check`.
2. In a Claude Code session, a parked or in-flight card comes first: a card that `python3 tools/monitor/card.py list` shows at a station from spec to review is in flight whatever its status (running, blocked, failed or review, as `card.py move` names them) and is resumed with `/factory run <id>` (a parked card says where to start in the pause note of its Spec). A work-package row waiting at spec while its sub-cards run is not such a card (an E2 row "is a work package, not a card", SKILL.md). Otherwise `/factory next`, which takes backlog cards only. Preconditions ([.claude/skills/factory/SKILL.md](.claude/skills/factory/SKILL.md), step 0): the card exists, every `dependsOn` card is done, and for P1 and later cards the roadmap is approved; step 0 then arms the watch unless another session is already the mirror.

## By hand (only the owner)

The [E4 table of the roadmap](docs/plan/roadmap.md#e4-by-hand-the-user) lists what only the owner can do and before which card; the open items and their status are kept current in [docs/plan/progress.md](docs/plan/progress.md#in-flight--next--only-the-owner-can-do).

## Several sessions in one checkout

- Re-read a file before editing it.
- Stage only your own files, with explicit paths; never `git add -A`.
- Announce every commit to the other session.
- Only one session runs the monitor watch (`tools/monitor/watch.sh`).
- Regenerate the board (`python3 tools/monitor/card.py status --write docs/plan/progress.md`) at every `card.py new` and at every ship; a station move in between is rendered at the next regeneration and is not checked.
