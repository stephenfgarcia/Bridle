---
id: P0-02
title: Repository bootstrap
phase: P0
order: 2
dependsOn: [P0-06]
estimate: 5
station: backlog
status: planned
owner: -
updated: 2026-11-02T20:28:58Z
history:
---

# P0-02 Repository bootstrap: monorepo, CI, environments

## Spec

Work package (E2 row): Repository bootstrap: pnpm and Turborepo workspace, Cargo workspace, one Dockerfile with four entrypoints, docker compose (Postgres, MinIO, mailpit), PR checks with path filters and sccache, one `pnpm check` (lint, typecheck, unit; cargo fmt, clippy, test; wasm32 build of both facades; schema drift and quanta walk; under 10 min locally) and `pnpm e2e:smoke` (Playwright Chromium) that the test, review and ship stations run; externalized UI strings (ICU MessageFormat catalog, lint failing on hard-coded user-facing strings, pseudo-locale build; I18N-01)

After: P0-06. Size: 5 engineer-weeks. Split into sub-cards at the spec station per E1.


## Plan


## Build


## Test


## Review


## Ship

