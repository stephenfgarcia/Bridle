---
id: P0-02
title: Repository bootstrap
phase: P0
order: 2
dependsOn: [P0-06]
estimate: 5
station: ship
status: done
owner: orchestrator
updated: 2026-11-17T09:57:34Z
history:
  - 2026-11-03T10:44:55Z spec running orchestrator "Row split into P0-02.1 to .6 (E1 splits plus smoke and i18n)"
  - 2026-11-17T09:57:34Z ship done orchestrator "Work package complete: P0-02.1 (bd758ed), P0-02.2 (1890d99), P0-02.3 (0e2e2cf), P0-02.4 (d8d8b7e), P0-02.5 (ee5d288), P0-02.6 (c005a7c)"
---

# P0-02 Repository bootstrap: monorepo, CI, environments

## Spec

Work package (E2 row): Repository bootstrap: pnpm and Turborepo workspace, Cargo workspace, one Dockerfile with four entrypoints, docker compose (Postgres, MinIO, mailpit), PR checks with path filters and sccache, one `pnpm check` (lint, typecheck, unit; cargo fmt, clippy, test; wasm32 build of both facades; schema drift and quanta walk; under 10 min locally) and `pnpm e2e:smoke` (Playwright Chromium) that the test, review and ship stations run; externalized UI strings (ICU MessageFormat catalog, lint failing on hard-coded user-facing strings, pseudo-locale build; I18N-01)

After: P0-06. Size: 5 engineer-weeks. Split at the spec station (2026-11-03): P0-02.1 workspace skeleton and first pnpm check; .2 compose stack and pnpm dev; .3 Actions PR workflow proven on a pushed branch (ticks the P0-06.3 gates); .4 Dockerfile with four stub entrypoints; .5 Next.js skeleton and pnpm e2e:smoke; .6 externalized UI strings. The first four are the plan's E1 splits; .5 and .6 cover the row's remaining deliverables (smoke command, I18N-01).


## Plan


## Build


## Test


## Review


## Ship

The work package shipped as its six sub-cards and is closed with the last one (foreman, 2026-11-17): P0-02.1 `bd758ed`, P0-02.2
`1890d99`, P0-02.3 `0e2e2cf`, P0-02.4 `d8d8b7e`, P0-02.5 `ee5d288`, P0-02.6 `c005a7c`.

The row's deliverables, each with the sub-card that delivers it:
- pnpm and Turborepo workspace, Cargo workspace, one `pnpm check` (lint, typecheck, unit; cargo fmt, clippy, test): P0-02.1; seven
  steps since P0-11 added the documents step; about ten seconds locally on 2026-11-17.
- docker compose (Postgres, MinIO, mailpit) and `pnpm dev`: P0-02.2.
- PR checks with path filters and sccache: P0-02.3 (`.github/workflows/check.yml`).
- One Dockerfile with four entrypoints: P0-02.4. The four are stubs; P0-02.5 left open which card puts Next.js behind `web`.
- `pnpm e2e:smoke` (Playwright Chromium): P0-02.5. Actions does not run it (P0-02.5's third open question, default in force).
- Externalized UI strings (ICU catalog, lint, pseudo-locale build; I18N-01): P0-02.6.

Named in the row's text and not delivered, because the code they act on does not exist yet: the wasm32 build of both facades (the
facades come with P2-05 and the solver rows), schema drift (the schema package is P1-01) and the quanta walk (the quanta table is
P1-01). Each joins `pnpm check` in the row that creates its subject. For the owner: `packages/i18n` is not in the package list of
section 16 of `docs/architecture/architecture.md`.
