---
id: P0-06
title: Toolchain and machine bootstrap
phase: P0
order: 1
dependsOn: [PLAN-05]
estimate: 1
station: spec
status: running
owner: orchestrator
updated: 2026-11-03T08:33:53Z
history:
  - 2026-11-03T08:33:53Z spec running orchestrator "Row approved by the user: split into P0-06.1 pins+installs+doctor, .2 allowlist, .3 first push; installs and GitHub push authorized"
---

# P0-06 Toolchain and machine bootstrap

## Spec

Work package (E2 row): Toolchain and machine bootstrap: rust-toolchain.toml (pinned stable, wasm32-unknown-unknown target), wasm-bindgen-cli, binaryen, wasmtime CLI; .node-version 22 and pnpm via corepack, one value read by `engines`, the Dockerfile and setup-node; Docker Desktop or OrbStack running; OpenTofu and AWS CLI; Playwright browsers; `tools/doctor.sh` checking every pin (the first test of P0-02); `.claude/settings.json` allowlist (cargo, pnpm, docker, git add/commit/push/rebase, gh pr, tofu fmt/validate/plan, tools/monitor/*); `git push -u origin main`

After: PLAN-05. Size: 1 engineer-weeks. Split into sub-cards at the spec station per E1.


## Plan


## Build


## Test


## Review


## Ship

