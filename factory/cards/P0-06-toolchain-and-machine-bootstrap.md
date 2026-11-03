---
id: P0-06
title: Toolchain and machine bootstrap
phase: P0
order: 1
dependsOn: [PLAN-05]
estimate: 1
station: ship
status: done
owner: orchestrator
updated: 2026-11-03T10:43:19Z
history:
  - 2026-11-03T08:33:53Z spec running orchestrator "Row approved by the user: split into P0-06.1 pins+installs+doctor, .2 allowlist, .3 first push; installs and GitHub push authorized"
  - 2026-11-03T10:43:19Z ship done orchestrator "Work package complete: P0-06.1 (ceba851), P0-06.2 (f637497), P0-06.3 (a898c34)"
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

Recorded after the fact (foreman, 2026-11-04, pause check): the work package shipped as its three sub-cards, P0-06.1 `ceba851`,
P0-06.2 `f637497` (amended by `dd7b40f`) and P0-06.3 `a898c34`, and was closed in `dfd0b72` ("Cards: P0-06.3 shipped; P0-06 work
package complete"), whose time matches this card's history line of 2026-11-03T10:43:19Z.
