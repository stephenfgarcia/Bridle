---
id: P0-02
title: Repository bootstrap
phase: P0
order: 2
dependsOn: [P0-06]
estimate: 5
station: spec
status: running
owner: orchestrator
updated: 2026-11-03T10:44:55Z
history:
  - 2026-11-03T10:44:55Z spec running orchestrator "Row split into P0-02.1 to .6 (E1 splits plus smoke and i18n)"
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

