---
id: P0-12
title: Local ports: the monitor viewer and the Agent HQ API stop sharing 8787
phase: P0
order: 27
dependsOn: [P0-10]
estimate: 0.1
station: backlog
status: planned
owner: -
updated: 2026-11-03T17:07:59Z
history:
---

# P0-12 Local ports: the monitor viewer and the Agent HQ API stop sharing 8787

## Spec

What: the monitor's local viewer (`tools/monitor/serve.py`, default port 8787) and Agent HQ's API server
(`tools/agent-hq/server/index.ts`, `PORT` default 8787, the target of both Vite proxies in `tools/agent-hq/vite.config.ts`) stop
defaulting to the same port.

Why: the owner's decision at the pause check (2026-11-04, `docs/decisions/log.md`); today only one of the two runs at a time.

Acceptance criteria:
1. The two defaults differ; each tool's README names its port.
2. The "Other local ports" table in `docs/ops/local-dev.md` and its clash sentence are updated.
3. Both tools' own tests pass.

Out of scope: any other port.

Process note (foreman, 2026-11-04): order 27 places the card after the P0-02 sub-cards and never ahead of P0-08 (owner
decision 3). The change touches another session's files, so the session that owns the tool builds it.


## Plan


## Build


## Test


## Review


## Ship

