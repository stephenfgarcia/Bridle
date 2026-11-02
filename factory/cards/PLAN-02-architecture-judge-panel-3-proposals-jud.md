---
id: PLAN-02
title: Architecture judge panel: 3 proposals, judges, synthesis
phase: PLAN
order: 2
dependsOn: [PLAN-01]
station: ship
status: done
owner: orchestrator
updated: 2026-11-02T22:25:54Z
history:
  - 2026-11-02T20:51:48Z spec running orchestrator "Spec: judge panel of 3 architectures, 3 judges, synthesis, 2 refuters, refine"
  - 2026-11-02T20:51:48Z build running orchestrator "Architecture workflow launching"
  - 2026-11-02T22:25:54Z ship done orchestrator "Shipped in f032ea1: docs/architecture (final doc, 26 decisions, 16-step build sequence)"
---

# PLAN-02 Architecture judge panel: 3 proposals, judges, synthesis

## Spec

Judge panel: three independent architecture proposals (simplicity-first, determinism-first, extensibility-first), three judges (engineering lead, structural educator, SRE/security), one synthesis, two adversarial refuters, one refine pass; inputs ADR 0001 and docs/requirements. Deliverable: docs/architecture.


## Plan


## Build

Workflow wf_79250bb6-1e6 (10 agents, 4.4M tokens, 89 min). Output: docs/architecture/architecture.md (15,896 words, 20 sections), decisions.md (26), build-sequence.md (16 steps, 165 engineer-weeks with the cut list), proposals/ (3), judgments.md, refutations.md (36 issues, none fatal), change-log.md (36 entries).


## Test

RESULT: PASS (planning deliverable; no code). Judge totals: Lockstep 190, Keel two-process 185, Keel extensibility 181; two refuters raised 21 major and 15 minor issues, each answered in the final document's change log.


## Review

VERDICT: PASS (adversarial refutation stage inside the workflow). Four ADR amendments are proposed for plan approval (live band and reference scenes; MVP resistance checks cut to LRFD W-shapes; Diagnose content to v1.1; spring-2028 pilot). The polish pass (PLAN-04) reviews the whole plan again.


## Ship

Commit f032ea1 (PLAN-02: Architecture).

