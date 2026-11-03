---
id: P5-03
title: Judge stage (S3)
phase: P5
order: 503
dependsOn: [P5-02]
estimate: 6
station: backlog
status: planned
owner: -
updated: 2026-11-03T08:29:22Z
history:
---

# P5-03 Judge stage (S3)

## Spec

Work package (E2 row): Judge stage (S3): judge-client seam over the Anthropic SDK with record/replay fixtures (`pnpm test` green offline), prompt assembly, haiku screen and opus judge with structured outputs, grounding validator, judge cache, Batches route for formative; manual gate before P5-04 starts: the measurement run on 50 golden grades (`bridle-grader measure --effort medium,high --n 50` with ANTHROPIC_API_KEY in .env.local, report committed under docs/verification/)

After: P5-02. Size: 6 engineer-weeks. Split into sub-cards at the spec station per E1.


## Plan


## Build


## Test


## Review


## Ship

