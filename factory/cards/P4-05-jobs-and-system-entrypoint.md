---
id: P4-05
title: Jobs and system entrypoint
phase: P4
order: 404
dependsOn: [P4-02, P1-04]
estimate: 4
station: backlog
status: planned
owner: -
updated: 2026-11-03T08:29:22Z
history:
---

# P4-05 Jobs and system entrypoint

## Spec

Work package (E2 row): Jobs and system entrypoint: Jobs interface over pg-boss with lanes and per-tenant caps, grading_jobs state machine with NOTIFY and the SSE status stream, runner pool and EngineRunner (wasmtime, wasm-node) in apps/worker with the identical-result_hash test, outbox relay and projections (gradebook, progress, mastery, notifications), oplog_segments storage with 15-minute rollups and blob_refs, reconciliation invariant, dead letters with transient auto-replay, retention, scheduled-capacity executor

After: P4-02, P1-04. Size: 4 engineer-weeks. Split into sub-cards at the spec station per E1.


## Plan


## Build


## Test


## Review


## Ship

