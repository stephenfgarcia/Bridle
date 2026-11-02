# ADR 0001: MVP scope and cross-domain resolutions

Status: proposed (adopted for the architecture and UI/UX work; confirmed or amended by the user at plan approval).
Date: 2026-11-03. Input: `docs/requirements/00-index.md` (critic's 18 conflicts and 45 MVP flags).

## Resolutions (one line each; the critic's recommendation adopted unless noted)

| # | Decision |
|---|---|
| R1 | MVP code checks are steel only: ASCE 7-22 loads and combinations, AISC 360-22 members. Reinforced concrete (ACI 318-19, reduced scope: rectangular beam flexure and shear, column P-M with user reinforcement, As min/max) is the first post-MVP pack increment (v1.1). RC appears in MVP only as Analyze/Check tasks with elastic section checks. |
| R2 | MVP ships the US pack only. Eurocode (EN 1990/1991/1993) and NSCP 2015 are v1.x packs. Load derivation and combination generation live in the code-pack module, not the FE engine; the engine exposes case superposition, envelopes, and the check contract. The second pack is chosen by launch geography (open question Q1). |
| R3 | Plates and shells are out of the MVP (no shell elements, no flat-plate template). Load panels distribute area loads one-way to framing at MVP; two-way is v1.x. |
| R4 | MVP stability: linear static analysis plus AISC Appendix 8 B1/B2 amplification from first-order results, notional loads as load cases, the ASCE 7-22 12.8.7 theta check, slenderness advisories, and mechanism detection. Iterative P-delta and eigenvalue buckling are v1.x. T5 tasks are limited to frames where the B2 route is valid. |
| R5 | One Scenario schema, owned by the structural domain (risk category, occupancy, wind, seismic, snow, temperature, soil/foundation). R, Omega0, Cd follow the chosen lateral system; SDC is derived. Derivation runs in the code pack inside the shared core. MVP fidelity is "simplified": ELF with a reduced system list, rectangular enclosed buildings for wind. |
| R6 | One rubric schema (criterion kinds auto, judged, hybrid, manual) with the structural grading categories as the dimension list; per-archetype default weights; severity classes and gates from the structural domain. Authoring and the LMS reference it; nobody redefines it. |
| R7 | A submission carries the model, modelHash, engineArtifactHash, resultHash, and a display-only results summary. Server re-analysis is the only grading input. Integrity check: resultHash equality when the engine artifact matches (bit-identical results); documented numeric tolerances apply only when artifacts differ. |
| R8 | One schema package, owned by the engine domain, exports the JSON Schema, migrations, and canonicalize() (round to documented quanta, RFC 8785 canonical JSON, SHA-256). Global axes are Z-up; the 2D plane is XZ. Fixed in schema v1 before any code. |
| R9 | The checks library is part of the shared Rust core, compiled to WebAssembly (browser) and native (server), versioned as its own pinned artifact. The client runs it for live utilization and the pre-submission self-check (advisory); the server runs the same artifact for grading (authoritative). |
| R10 | MVP benchmarks: author reference solution(s) plus an auto-sized reference (greedy lightest passing catalog section per member group) generated per seed at calibration time; infeasible seeds are rejected at calibration. Optimizer-generated references and cohort benchmarks are v1.x. |
| R11 | Summative (credit-bearing) tasks require instructor/TA review of every grade before release; confidence and flags only order the queue. Formative tasks release deterministic results immediately with the AI narrative labeled "AI-provisional". |
| R12 | MVP authentication: email/password (NIST 800-63B), Google and Microsoft OIDC sign-in, TOTP/passkey MFA enforced for instructor, author, and admin roles. SAML, IdP routing, SCIM, and LTI 1.3 are v1.x. |
| R13 | Single US region at MVP; tenant.region is reserved in the schema; EU region and EU AI Act artifacts arrive with the first EU customer. |
| R14 | Model-size tiers S and M only (up to 2,000 members, no shells). Latency contract: in-browser solve plus render at most 100 ms p95 for S and 300 ms for M on the reference laptop. Authors set a per-task hard cap enforced identically in the browser and on the server. WebGL2 only; WebGPU is v1.x. |
| R15 | Outcome tagging of tasks and criteria plus a simple mastery rule at MVP; at-risk flags are simple rules (no activity for 7 days, overdue tasks). Competency frameworks, heatmaps, learning paths, and alert messaging are v1.x. |
| R16 | The accessible parity path for the 3D workspace (tabular model editor, command palette, result tables, textual model summary, keyboard camera) is an MVP must (ADA Title II / WCAG 2.1 AA). Live-region narration of canvas changes and a formal ACR are v1.x. |
| R17 | A composite grader_version (solver build, checks library, clause library, scenario engine, rubric version, prompt template, judge schema, model ids and effort, routing policy, validator) is frozen per published task version and recorded on every grade; changing any component means a new task version. |
| R18 | Requirement ids are namespaced by domain when merged: STR-, SIM-, WS-, LMS-, AIG-, NFR-, AUT-, PRD-, DAT- (canonical data), LIC- (standards licensing), DLV- (deliverables), OPS- (operator console), INT- (integrity), TEAM- (collaboration). |

## MVP guardrails (from the critic's 45 flags; the architecture must not depend on anything in this list)

- Content: tiers T1 to T4 plus a reduced T5; 6 to 8 modules and 15 to 20 activities with design partners; eight beam/truss/frame starter templates.
- Engine: about 25 verification benchmarks matching MVP analysis types; frame-only performance scenes; in-browser solves plus a server path used for grading, no device-calibrated tier router.
- Workspace: fixed shortcuts plus a command palette; fixed layout with collapsible panels; S and M tiers.
- LMS: 1 to 3 tenants provisioned manually with a learner cap; one offering version per term; embedded video (YouTube/Vimeo) and PDF upload; quizzes limited to multiple choice, multi-select, true/false, unit-aware numeric; sections, per-learner extensions, one late policy; points-based gradebook with generic CSV export; about six notification events, announcements, one Q&A thread per task.
- Grading: about 50 clauses in the clause library; a reduced fixture set per template; per-tenant LLM counters and one global spend cap.
- Platform: OWASP ASVS L1 plus the L2 authentication, access-control and data-protection controls; dependency scanning and SBOM; a priority queue with per-tenant concurrency caps and a small fixed worker pool; 99.5 % availability, PITR plus daily off-site backups and one rehearsed restore; staging and production with rolling deploys; component-level cost tracking.
- Authoring: a validated JSON/YAML task definition plus forms for the common sections; checkpoint conditions authored as JSON; draft/published versioning with learner preview.
- Product: no free self-serve AI-graded sandbox until metering and billing exist (deterministic-only or hard-capped); admin console limited to members, roles, roster import, institution defaults.

## Open questions for the user (defaults in force until answered)

- Q1 Launch geography: US pilot first (default), which makes NSCP 2015 or Eurocode the second pack depending on the first non-US customer.
- Q2 Backend language: TypeScript end to end (default) versus Python for the grading and solver services; the architecture panel evaluates both.
- Q3 Hosting: a single cloud provider with managed Postgres and object storage (default); the panel names one.
