# Cross-domain canonical data model, identifier/version pin set, canonicalization and hashing, and unified event stream (gap-fill #1, id prefix GAP1-DM-)

_Source: requirements discovery workflow `wf_6281c128-0bb` (gap-fill agent), 2026-11-03. 25 requirements: 21 must (MVP), 3 should (v1.x), 1 could (later)._

## Summary

Bridle's grading promise (reproducible regrades, instructor review, calibration, integrity review, FERPA-grade records) depends on every domain naming the same artifacts the same way and pinning them identically on every submission and grade. This set defines one entity catalog with typed-prefix UUIDv7 row ids, sha256 content ids and ArtifactRef (`kind:name@semver#sha256:hex`) references for every versioned library (code packs, checks, clauses, sections, materials, cost model, engine, prompt, judge schema, grader). It fixes the Submission Pin Set and Grade Version Pin Set field by field, makes grades append-only versions with an explicit regrade_reason and a closed list of re-pinnable fields, and represents mid-offering upgrades as append-only activity pin sets. One canonicalization rule (semantic projection, per-dimension integer quantization, RFC 8785 JCS, SHA-256) is implemented once in a Rust crate compiled to WASM and native and shared by browser, API, grader and authoring, with Z-up axes, the XZ plane for 2D and SI storage units frozen in schema v1. A single CloudEvents-based envelope carries four classes (analytics, audit, learning, process) with per-class actor pseudonymization, PII, retention and FERPA rules, and xAPI, gradebook, draft timeline, hint usage and instructor analytics are projections of the learning class rather than separate logs. Finally a `<DOMAIN>-<AREA>-<NN>` namespacing scheme and a shared prefix registry resolve the GRD/SEC/PERF/A11Y collisions. Key implied architecture decisions: Postgres with uuid (v7) keys and JSONB pin columns, a transactional outbox, a WORM audit sink, per-tenant KMS keys for analytics pseudonyms, and a `packages/schema` + `bridle-canon` crate as the first thing built.

## Must (MVP)

### GAP1-DM-01 Canonical entity catalog and ownership registry

Publish one registry (`packages/schema/registry/entities.json`) listing every shared entity with its id prefix, owning domain, identity kind (uuid7 | digest | artifact-ref), immutability class and lifecycle states: tenant, user, membership, course blueprint and published version, offering, section, activity, task definition and version, scenario schema, scenario instance, model document and revision, submission, analysis result set, grade evidence record, grade version, rubric version, code pack / checks / clause / section / material / cost-model versions, engine artifact, prompt template version, judge schema version, activity pin set, event. A new shared entity must be registered before any code, schema or event references it.

**Why:** Eight domain sets currently invent different names and scopes for the same artifacts; the registry is the join key for regrades, calibration, integrity review and FERPA handling.

**Acceptance:**
- Registry lists every entity above with all five attributes and renders into the architecture docs
- CI lint fails when a DB model, API path or event type uses a prefix or entity name absent from the registry
- Domain requirement documents reference registry names instead of redefining entities

### GAP1-DM-02 Identifier formats: typed-prefix UUIDv7, content digests, ArtifactRef

Row identities are `<prefix>_<uuidv7>` strings (RFC 9562, canonical 36-char lowercase, e.g. `sub_019301a2-7c3e-7f4b-9a1d-0b2c3d4e5f60`) stored as native uuid columns; content identities are `sha256:<64 lowercase hex>`; versioned reference artifacts are ArtifactRef objects `{kind,name,version,digest}` with string form `<kind>:<name>@<semver>#sha256:<hex>` (e.g. `codepack:us-asce7-22@1.3.0#sha256:ab12...`). Prefix registry: ten, usr, mem, cbp, cbv, off, sec, act, task, taskv, sci, mdl, mrev, sub, res, evd, grd, rub, rubv, pin, evt, job; artifact kinds: engine, codepack, checks, clauses, sections, materials, cost, prompt, judge, grader, scengen, schema, canon.

**Why:** Typed prefixes make cross-entity joins and log reading unambiguous; UUIDv7 keeps indexes time-ordered; digests and ArtifactRefs make pins self-verifying.

**Acceptance:**
- Shared `parseId(prefix)` and `parseArtifactRef()` in the schema package reject wrong-prefix values (e.g. `learner_id` must be `usr_`)
- All external APIs and events use the prefixed form; databases store uuid/bytea columns with prefix implied by table
- Same artifact name+version can never resolve to two digests (unique index)

### GAP1-DM-03 Lifecycle states and immutability classes

Each entity is classed Mutable (tenant, user, membership, offering, section, activity, model document, draft blueprints/tasks/rubrics), Append-only versioned (published blueprint/task/rubric versions, grade versions, activity pin sets) or Content-immutable (model revision, submission, result set, scenario instance, evidence record, reference-library versions, engine artifacts, events). Content-immutable rows are never updated or deleted except by the retention/erasure process; corrections create new rows carrying `supersedes_*`. Lifecycles: tenant provisioning→active→suspended→archived→purged; user invited→active→deactivated→erased; blueprint/task/rubric draft→published(vN)→deprecated→retired; offering scheduled→active→concluded→archived; activity hidden→available→closed→archived; submission submitted→graded→released→superseded|withdrawn; grade computed→in_review→released→superseded|voided; artifacts published→deprecated→withdrawn.

**Why:** Reproducible regrades and audit require that nothing a grade points at can change underneath it.

**Acceptance:**
- DB privileges/triggers block UPDATE and DELETE on content-immutable tables for application roles
- Lifecycle enums and allowed transitions are defined in the registry and enforced by one state-machine helper
- Editing a submitted model revision returns 409 and a new revision is created instead

### GAP1-DM-04 Reference-library publishing contract

Code packs, checks library, clause library, section and material libraries, cost models, engine artifacts, prompt templates, judge schemas, scenario generator and grader releases are published only as immutable ArtifactRefs with a manifest: semver, sha256 of the canonical package content, published_at, publisher, changelog, supersedes, deprecated_at, withdrawn_at. Engine manifests additionally carry `wasm_digest`, `native_digest` and a `numeric_profile` id (target triple, SIMD/FMA flags, single-threaded grading mode).

**Why:** Grades pin these artifacts; a pin is meaningless unless the artifact is immutable and retrievable by digest.

**Acceptance:**
- Publishing an existing name+version with a different digest is rejected
- `GET /artifacts/{ref}` returns the manifest and the content by digest
- Grader refuses a withdrawn artifact except in replay-only mode for an existing grade

### GAP1-DM-05 Submission record pin set

Every submission stores immutably at submit time: ids (submission_id, tenant_id, offering_id, section_id, activity_id, activity_key, learner_id, submission_seq, attempt_no, idempotency_key, submitted_at, client_submitted_at); content pins (content_version_id+content_hash, task_version_id+task_hash, rubric_version_id+rubric_hash, scenario_instance_id+scenario_hash, activity_pinset_id+pinset_hash); work pins (model_revision_id, model_hash, schema_version, canon_version, justification_id+justification_hash of NFC UTF-8 text, attachments[{id,sha256,media_type,bytes}]); client analysis context (client_engine_ref, client_numeric_profile, client_result_hash); provenance (oplog_head_hash, oplog_segment_ids[], hint_usage_id+hint_usage_hash). The server recomputes model_hash from the stored revision and rejects the submission on mismatch, then stores `submission_hash` over the canonical record.

**Why:** This is the learner-side half of reproducibility: everything the learner saw and produced is fixed at one instant.

**Acceptance:**
- Submission schema with all fields exists in the schema package; all fields NOT NULL except attachments and hint fields
- Submit API returns 422 on client/server model_hash mismatch
- Learner receives `submission_hash` as a receipt and can verify it from the export

### GAP1-DM-06 Grade version pin set

Each grade version stores immutably: grade_id, submission_id, grade_version (1..n), supersedes_grade_id, regrade_reason, requested_by, computed_at, status (computed|in_review|released|superseded|voided), released_at, released_by; server analysis pins (engine_ref with native digest, numeric_profile, analysis_options_hash, result_set_id, result_hash, result_match); library pins (code_pack_refs[], checks_ref, clause_ref, section_lib_ref, material_lib_ref, cost_model_ref); rubric_version_id+rubric_hash; grader_ref (`grader@semver+gitsha`); evidence_id+evidence_hash; judge_invocations[] each with prompt_ref, judge_schema_ref, llm_provider, llm_model_id (e.g. `claude-opus-5-5`), api_version (anthropic-version header), effort, thinking_type, request_hash, response_id, response_model, output_hash, usage{input,output,cache_read}, inference_geo, or judge_skipped_reason; criterion_scores[] {criterion_id, score, max, source ∈ deterministic|judge|instructor|carried, evidence_refs[], override_note_id}; total, scale_ref, pinset_id, grade_hash.

**Why:** This is the grader-side half of reproducibility and the record instructors, appeals and calibration work from.

**Acceptance:**
- Released grades cannot be mutated; gradebook reads only status=released versions
- `GET /grades/{id}/pins` returns the complete pin set
- Test proves two grade versions of one submission with different engine/pack pins coexist

### GAP1-DM-07 Regrade semantics and re-pinnable fields

A regrade never edits a grade; it creates grade_version n+1 with supersedes_grade_id and regrade_reason ∈ {initial, instructor_override, pack_upgrade, engine_upgrade, rubric_fix, grader_release, judge_rerun, appeal, calibration, integrity_review}. Re-pinnable: engine_ref, numeric_profile, result_set_id/result_hash, all library refs, rubric_version_id (same rubric_id only, reason rubric_fix), grader_ref, prompt_ref, judge_schema_ref, llm_model_id, api_version. Never re-pinnable (copied from the submission): learner_id, model_hash, scenario_hash, task_version_id, content_version_id, justification_hash, attachments. Deterministic criteria are always recomputed; judge criteria are re-invoked only for judge_rerun, pack_upgrade, rubric_fix, appeal or calibration, otherwise copied with source=carried.

**Why:** Makes every change to a learner's grade explainable by a pin diff and a reason, which is what appeals and audit need.

**Acceptance:**
- API rejects a regrade that changes any never-re-pinnable field
- Previous version becomes superseded only when the new one is released; learner history lists all versions with reasons
- Replaying a grade with identical pins yields identical deterministic criterion scores

### GAP1-DM-08 Activity pin set and mid-offering upgrades

Each activity (inheriting an offering default) has an append-only `activity_pinset` version holding refs for engine, code packs, checks, clauses, section/material libraries, cost model, rubric version, task version, content version, grader, prompt, judge schema and llm_model_id, plus effective_from, created_by, reason, regrade_policy ∈ {none, ungraded_only, all_unreleased, all} and supersedes_pinset_id. Submissions after effective_from use the new set; existing grades keep theirs; regrades under the new set are created by a job with regrade_reason pack_upgrade or engine_upgrade.

**Why:** Engine and code-pack releases will happen during a term; this makes the change explicit, reversible and visible per submission.

**Acceptance:**
- Event `bridle.lms.activity.pinset_superseded` is emitted with old and new pinset ids
- A pack upgrade with policy none changes no existing grade
- Instructor API shows which pin set applied to each submission and grade

### GAP1-DM-09 Schema v1 global conventions: Z-up, XZ plane, SI storage

`bridle-schema@1.x` fixes a right-handed global frame with +Z up (gravity in -Z) and X/Y horizontal; 2D models live in the global XZ plane with Y=0 and out-of-plane DOFs implicitly restrained; all stored quantities are SI base units (m, N, N·m, Pa, kg/m³, K, s, rad) and display units are never persisted in the semantic model; member orientation is a single roll_angle (rad) about local x (node i→node j); internal-force sign conventions are defined once by the FE domain and referenced, not redefined, by schema.

**Why:** Hashes and results are only comparable if every producer agrees on frame and units; changing this later invalidates every stored hash.

**Acceptance:**
- Conventions are documented in the schema package and asserted by validation (non-zero Y in a 2D model fails)
- Importers from Y-up tools apply the mapping and record source_convention in non-semantic metadata
- Rendering and unit preferences are stored outside the semantic document

### GAP1-DM-10 Model canonicalization and hashing rule canon/1

model_hash = sha256(JCS(canonical form)). Canonical form: (1) project the revision onto schema-flagged semantic fields (nodes, members, plates, restraints, releases, springs, sections, materials, loads, cases, combinations, result-affecting analysis settings) dropping labels, colours, camera, selection, layers, comments, timestamps, authorship and display units; (2) materialize schema defaults; (3) quantize each number to an integer count of its dimension's quantum (round-half-to-even, -0→0, non-finite is an error); (4) NFC-normalize strings, lowercase snake_case enums, omit absent optionals (never null); (5) emit collections as arrays sorted by entity id; (6) prefix header `{"schema":"bridle-schema@1.0.0","canon":1,"kind":"model"}`; (7) RFC 8785 JCS → UTF-8 → SHA-256 → `sha256:<hex>`. Quanta: length 1e-6 m, angle 1e-6 rad, force 1e-3 N, moment 1e-3 N·m, line load 1e-3 N/m, pressure/stress/modulus 1 Pa, area 1e-10 m², I and J 1e-14 m⁴, section modulus 1e-12 m³, density 1e-3 kg/m³, temperature 1e-3 K, spring stiffness 1e-3 N/m and 1e-3 N·m/rad, mass 1e-6 kg, dimensionless 1e-6.

**Why:** Integer quantization removes float-formatting ambiguity between Rust and JS; JCS fixes key order; the semantic allowlist keeps cosmetic edits from changing identity.

**Acceptance:**
- Golden vectors show relabeling or camera changes keep the hash while moving a node by 1 µm changes it
- Browser and API produce byte-identical canonical output for every golden model
- Any change to allowlist, quanta, ordering or header requires a canon version bump

### GAP1-DM-11 Result set canonical form, result_hash and result_match

A result set embeds its input pins (model_hash, scenario_hash, engine_ref, numeric_profile, analysis_options_hash) and quantized outputs (displacement 1e-9 m, rotation 1e-9 rad, force 1e-3 N, moment 1e-3 N·m, stress 1 Pa, utilization 1e-6, frequency 1e-6 Hz, buckling factor 1e-6) sorted by (combination_id, entity_id, station); result_hash is the JCS SHA-256. Hash equality is claimed only for the same engine artifact and numeric profile; the grader compares the learner's client results with the server rerun by tolerance (default relative 1e-6 or one quantum) and records result_match ∈ {exact, within_tolerance, mismatch, not_compared}.

**Why:** Server-side determinism is what regrades rely on; browser-vs-server differences are expected and must be measured, not hashed away.

**Acceptance:**
- 100 of 100 server reruns of golden models give identical result_hash
- WASM versus native runs of golden models report within_tolerance
- mismatch raises an integrity flag and routes to instructor review rather than failing silently

### GAP1-DM-12 Scenario instance canonical form and reproducible generation

A per-learner scenario instance is `{header kind:scenario, scenario_schema_hash, generator_ref, seed (128-bit hex), params}` where params are quantized input values only; derived quantities (e.g. design wind pressure) are excluded and recomputed deterministically by generator or engine. scenario_hash is its JCS SHA-256; the seed is random at instantiation, stored, and the instance is regenerable from (schema, generator_ref, seed).

**Why:** Grading must know exactly which site and load environment the learner was given, and integrity review must be able to regenerate it.

**Acceptance:**
- regenerate(schema, generator_ref, seed) reproduces params and hash for all golden vectors
- A task version change creates new instances; existing ones are never mutated
- Instance stores learner_id, activity_id and attempt_no and is pinned by the submission

### GAP1-DM-13 Evidence digest and judge I/O hashing

The deterministic evidence record is canonicalized (`kind:evidence`: pins plus per-check results sorted by check_id, quantized as results) to evidence_hash; each judge invocation stores request_hash (JCS SHA-256 of the full request body: model, system, messages, tools, output_config, thinking; auth headers excluded), output_hash (JCS of the structured output), response_id and response_model (the model actually served, including any fallback). The judge receives only the evidence digest and the justification text, never the raw model or result set.

**Why:** LLM output is not reproducible by rerun; reproducibility of judged criteria comes from storing exactly what was asked and answered.

**Acceptance:**
- evidence_hash is identical across reruns with the same pins
- Grade pin set links evidence_id and all judge invocation records
- A judge output failing judge-schema validation is stored as invalid and the criterion falls to instructor review

### GAP1-DM-14 Single shared schema and canonicalization package

Entity schemas, quanta tables, canonicalization, hashing, id parsing and the event envelope live in one place: JSON Schema sources in `packages/schema`, a Rust crate `bridle-canon` compiled to WASM (wasm-bindgen) for browser and Node and natively for grader and engine, generated TypeScript types, and a `golden/` corpus of at least 50 vectors (input → canonical bytes → hash). No consumer reimplements canonicalization.

**Why:** The task statement's four-way divergence can only be prevented structurally: one implementation, one test corpus.

**Acceptance:**
- CI runs the golden corpus in Rust native, Node (WASM) and headless Chromium, Firefox and WebKit and fails on any byte difference
- schema_version and canon_version appear in every submission and grade pin set
- A lint blocks ad-hoc JSON.stringify or serde_json based hashing outside the crate

### GAP1-DM-15 Unified event envelope

All events use CloudEvents 1.0.2 JSON: specversion, id (`evt_` uuid7), source (service URI), type `bridle.<domain>.<entity>.<verb-past-tense>`, time (RFC 3339 UTC, ms), datacontenttype, dataschema `bridle-events@<ver>#<type>`, subject (primary entity id); required extensions class (analytics|audit|learning|process), tenantid, actorkind (user|service|system|grader|anonymous), actorid, actorrole, traceparent (W3C), seq (per-source monotonic), schemaversion, pii (none|pseudonymous|identified), refs ([{rel,id}] including relevant pins); audit events add prevhash. `data` is validated per type; free text only in allowlisted types.

**Why:** One envelope lets analytics, audit, learning and process records be joined by entity refs and trace id instead of being four incompatible logs.

**Acceptance:**
- Every emitter uses the package `emit()` which validates against the per-type schema and rejects unknown types
- Events missing tenantid or class are refused at emit time
- Sample events for every registered type are checked into the schema package

### GAP1-DM-16 Event classes, actor pseudonymization and PII rules

analytics (product usage, replaces separate MET-01 emission): actorid = base32(HMAC-SHA256(per-tenant key in KMS, usr_id)); payload allowlist of enums, counts, durations, country and browser family; no IP, email or free text. audit (DAT-01, REV-04): identified usr_ or service id, before/after diffs by reference, never grade or justification content. learning (source for INT-02, SUB-03, TB-12, gradebook): identified usr_ id, scores and refs, no justification text. process (grader and analysis job logs, workspace op log): service ids or opaque usr_ id; timings, hashes and error codes only.

**Why:** Fixes per class who the actor is and what may be stored, so FERPA, pseudonymous analytics and operational debugging do not leak into each other.

**Acceptance:**
- Emitter enforces the pii attribute per class; analytics payload schemas contain no string fields outside the allowlist (static test)
- Destroying a tenant analytics key renders its analytics actorids unlinkable
- Audit payloads referencing grades or justifications contain only ids and hashes

### GAP1-DM-17 Retention, FERPA classification and erasure interplay

Default retention (tenant-configurable within bounds): analytics 13 months raw then aggregates; audit at least 7 years and never shorter than the record it concerns; learning = education-record lifetime (default 5 years after the offering concludes, then delete or pseudonymize); process 30 days; workspace op-log segments 90 days unless referenced by a submission, in which case they follow learning. FERPA education records: all learning-class events, promoted op-log segments, submissions, grades, evidence and `audit.disclosure.*` events; not education records: analytics (pseudonymous, key-separated) and other audit or process events. User erasure tombstones the profile and keeps the opaque usr_ id inside education records until tenant retention expires.

**Why:** Institutions will not adopt a tool whose student records cannot be retained, inspected and purged on a documented schedule.

**Acceptance:**
- Each class has a retention job and a monthly enforcement report
- Learner data export includes learning-class events and the disclosure log
- Deleting a user does not delete submissions or grades inside the retention window

### GAP1-DM-18 Audit class: append-only store and disclosure logging

Audit events are written in the same transaction as the action (outbox) to an append-only store with WORM retention. Every read or export of another person's education record (grade, justification, model, submission, evidence) emits `bridle.plt.record.disclosed` with viewer, role, record refs, purpose and legitimate-interest basis, satisfying the 34 CFR 99.32 record of disclosures.

**Why:** Instructor review, operator access and integrity investigations must leave an unalterable trail that the learner can inspect.

**Acceptance:**
- UPDATE and DELETE on audit storage are impossible for application roles
- A failed audit write fails the originating request
- Opening a submission produces exactly one disclosure event per record per viewer session; learners can obtain their disclosure log

### GAP1-DM-19 Learning class as the single learning-record source

Gradebook, progress, the SUB-03 draft timeline, TB-12 hint usage, instructor analytics and xAPI are projections of learning-class events (`bridle.lms.activity.viewed`, `bridle.ws.session.started|resumed|ended`, `bridle.ws.model.revision_saved`, `bridle.ws.hint.requested|revealed`, `bridle.lms.submission.submitted`, `bridle.aig.grade.computed|released`, `bridle.lms.progress.updated`), never independently emitted logs.

**Why:** One source means every derived view agrees with the record of the learner's work and can be rebuilt.

**Acceptance:**
- No service writes gradebook, progress, hint or xAPI rows except by consuming learning events
- Rebuilding projections from the event store yields identical gradebook state in a test
- A submission's draft timeline is derivable from learning events plus its referenced op-log segments

### GAP1-DM-21 Event delivery semantics and op-log segments

Events are persisted through a transactional outbox in the same commit as the state change, published at-least-once, consumed idempotently by id, ordered per (source, seq). Audit and learning sinks are durable stores; analytics and process sinks may batch or sample. The workspace op log is batched into segments (at most 5 s or 500 ops) forming a per-document hash chain whose head is pinned at submit as oplog_head_hash.

**Why:** Reproducibility and audit are worthless if events can be lost or reordered during a bus outage.

**Acceptance:**
- Chaos test loses no audit or learning events across a bus outage
- Duplicate delivery produces no duplicate projection rows
- Op-log segment chain verifies from the first segment to the pinned oplog_head_hash

### GAP1-DM-22 Namespacing scheme for requirement and entity ids

Requirement ids are `<DOMAIN>-<AREA>-<NN>` with DOMAIN from a registry: PRD, STR, FE, WS, LMS, AIG, PLT, AUT, DM plus gap domains INTG, OPS, DEL, LIC, TEAM. Existing single-segment ids are rewritten mechanically by prefixing the owning domain, resolving GRD- (AIG-GRD vs LMS-GRD), SEC- (PLT-SEC vs STR-SEC), PERF- (PLT-PERF vs FE-PERF or WS-PERF) and A11Y- (PLT-A11Y vs WS-A11Y). Entity prefixes, artifact kinds, event types and domain codes share the same registry; GAP1-DM-NN ids become DM-NN at consolidation.

**Why:** Collisions already exist across four prefixes; without a rule the consolidated plan and the monitor task ids cannot cross-reference requirements.

**Acceptance:**
- Registry file with a uniqueness test for domain codes, areas, entity prefixes and event types
- Lint rejects an unknown domain or prefix in docs, code and task ids
- Consolidated requirements document contains zero duplicate ids

## Should (v1.x)

### GAP1-DM-20 xAPI projection with idempotent statement ids

An xAPI 2.0 projector maps learning events via a table in the schema package (submitted→completed; grade released→scored plus passed/failed when a threshold exists; session started→launched; ended→terminated; hint revealed→interacted with a hint extension; activity viewed→experienced; progress→progressed). Statement id = UUIDv5(bridle xAPI namespace, event id); actor = account {homePage: tenant issuer, name: usr_ id or tenant pseudonym}, no mbox; context.extensions carry submission_id, grade_id, model_hash and pinset_id.

**Why:** LRS integration (INT-02) is a v1.x institution need; deriving it from the learning class keeps it free of duplicate emission.

**Acceptance:**
- Re-sending a batch creates no duplicate statements in an LRS
- Mapping table test covers every registered learning event type
- Tenant can disable the projector without affecting internal projections

### GAP1-DM-23 Replay bundle and nightly reproducibility test

For any grade version the system exports a replay bundle (submission pin set, model revision, scenario instance, every ArtifactRef manifest with digest, evidence, judge request and response hashes with stored outputs) and runs a replay job that re-executes deterministic steps and asserts equality of result_hash, evidence_hash and deterministic criterion scores.

**Why:** Turns the reproducibility promise into a continuously verified property instead of an assumption.

**Acceptance:**
- Nightly replay of a sample of released grades passes
- Bundle export completes within 60 s
- Replay with a withdrawn artifact is permitted in replay-only mode

### GAP1-DM-24 Schema evolution policy

`bridle-schema` and `bridle-events` use semver; minor versions are additive and readable by N-1 consumers for 90 days; any change to semantic fields, quanta, ordering or header bumps `canon`, and stored hashes stay valid under their recorded canon_version and are never recomputed; data migrations may not rewrite canonical content of immutable rows.

**Why:** The engine and code packs will evolve; hashes recorded in grades must remain verifiable as they were.

**Acceptance:**
- Compatibility suite loads golden vectors from the previous minor version
- A regrade across canon versions re-hashes under the recorded version and records both versions

## Could (later)

### GAP1-DM-25 Audit hash chain and external anchoring

Per-tenant audit events carry prevhash forming a chain, and a daily chain head is signed and anchored outside the platform (timestamping service or off-platform store).

**Why:** Adds tamper evidence beyond WORM for institutions with formal audit demands.

**Acceptance:**
- Verification tool detects any removed or altered audit event
- Anchoring failure raises an operations alert

## Non-functional targets

| id | title | target |
|---|---|---|
| GAP1-DM-NFR-01 | Canonicalization determinism across platforms | 100% byte-identical canonical output and hash for all golden vectors across Rust native, Node WASM and WASM in Chromium, Firefox and WebKit; CI gate on every change |
| GAP1-DM-NFR-02 | Canonicalization and hashing performance | Model with 5,000 nodes and 10,000 members canonicalized and hashed in <= 200 ms in WASM on a 2020-class laptop and <= 50 ms native |
| GAP1-DM-NFR-03 | Server analysis reproducibility | Identical result_hash in 100 of 100 reruns of each golden model on the same engine artifact and numeric profile, across at least 3 distinct hosts |
| GAP1-DM-NFR-04 | Event ingestion throughput and latency | >= 2,000 events/s sustained per region; p99 commit-to-bus latency <= 500 ms; op-log segments at most one per 5 s per active session |
| GAP1-DM-NFR-05 | Audit durability | Zero lost audit or learning events under bus outage (outbox replay); audit storage WORM-locked for >= 7 years; audit write failure fails the request |
| GAP1-DM-NFR-06 | Retention enforcement | Expired events and segments purged within 7 days of expiry; monthly enforcement report per tenant with zero unexplained overdue items |
| GAP1-DM-NFR-07 | Schema compatibility window | API and events remain readable by N-1 minor schema consumers for 90 days; no stored hash is ever recomputed under a newer canon version |
| GAP1-DM-NFR-08 | Replay bundle service level | Replay bundle export for any released grade in <= 60 s; nightly replay sample passes with 100% deterministic-score equality |

## Domain notes (for architecture and UX)

DOMAIN CODES (registry): PRD product/personas, STR structural domain (codes, loads, sections, materials, cost), FE engine, WS 3D workspace, LMS core, AIG AI grading, PLT platform NFRs, AUT authoring, DM data model/events; gap domains INTG integrity/exam mode, OPS operator console, DEL learner deliverables, LIC standards licensing, TEAM team projects. Legacy ids cited by other domains map by prefixing the owner: MET-01 -> <owner>-MET-01, INT-02 -> LMS-INT-02, SIM-SCH-02 -> WS-SIM-SCH-02 (or FE), DAT-01 -> PLT-DAT-01, REV-04 -> AIG-REV-04, SUB-03 -> LMS-SUB-03, TB-12 -> WS-TB-12.\n\nENTITY -> PREFIX / OWNER / IDENTITY: tenant ten_/PLT/uuid7; user usr_/PLT/uuid7 (global, tenant membership via mem_/LMS); course blueprint cbp_/AUT, published version cbv_/AUT (content_version int + content_hash); offering off_/LMS; section sec_/LMS; activity act_/LMS (activity_key slug from blueprint); task definition task_/AUT, task version taskv_/AUT (task_hash); scenario schema = part of taskv (scenario_schema_hash); scenario instance sci_/LMS (scenario_hash); model document mdl_/WS; model revision mrev_/WS (model_hash); submission sub_/LMS; result set res_/FE (result_hash); evidence record evd_/AIG (evidence_hash); grade version grd_/AIG (grade_hash); rubric rub_/rubv_/AUT (rubric_hash); activity pin set pin_/LMS (pinset_hash); event evt_/DM; job job_/PLT. ArtifactRef kinds (owner): engine (FE), codepack, checks, clauses, sections, materials, cost (STR; clauses co-owned with LIC), prompt, judge, grader (AIG), scengen (AUT/STR), schema, canon (DM). String form: kind:name@semver#sha256:hex; JSON form {kind,name,version,digest}. Suggested first artifacts: codepack:us-asce7-22, codepack:us-aisc360-22, codepack:us-aci318-19, sections:aisc-shapes-v16, materials:astm-base.\n\nCANONICAL HEADER: {\"schema\":\"bridle-schema@1.0.0\",\"canon\":1,\"kind\":model|result|scenario|evidence|submission|grade}. Canonical numbers are JSON integers (quantum counts, |n| < 2^53); no floats, nulls, NaN or Infinity ever appear in canonical bytes. Collections are arrays sorted by id using JCS string order; object keys sorted by JCS. Model quanta: length/thickness/offset 1e-6 m, angle 1e-6 rad, force 1e-3 N, moment 1e-3 N·m, line load 1e-3 N/m, pressure/stress/modulus 1 Pa, area 1e-10 m², I/J 1e-14 m⁴, section modulus 1e-12 m³, density 1e-3 kg/m³, temperature 1e-3 K, translational spring 1e-3 N/m, rotational spring 1e-3 N·m/rad, mass 1e-6 kg, acceleration 1e-6 m/s², time 1e-6 s, dimensionless 1e-6, currency 1e-4 units. Result quanta: displacement 1e-9 m, rotation 1e-9 rad, force 1e-3 N, moment 1e-3 N·m, stress 1 Pa, utilization 1e-6, frequency 1e-6 Hz, buckling factor 1e-6. Axis convention: right-handed, +Z up, 2D in XZ (Y=0). Storage units SI base; display units in view state only.\n\nPIN SET SUMMARY: submission = ids + content pins (content_version, task_version, rubric_version, scenario_instance, activity_pinset) + work pins (model_revision/model_hash/schema_version/canon_version, justification_hash, attachments) + client context (client_engine_ref, client_numeric_profile, client_result_hash) + provenance (oplog_head_hash, oplog_segment_ids, hint_usage). grade version = lineage (grade_version, supersedes, regrade_reason, status) + server analysis pins (engine_ref, numeric_profile, analysis_options_hash, result_set/result_hash/result_match) + library pins (code_pack_refs, checks, clauses, sections, materials, cost) + rubric + grader_ref + evidence + judge_invocations + criterion_scores + pinset_id + grade_hash. Re-pinnable on regrade: engine, numeric_profile, result, libraries, rubric version (same rubric id), grader, prompt, judge schema, llm_model_id, api_version. Never: learner, model_hash, scenario_hash, task_version, content_version, justification, attachments.\n\nLLM JUDGE PIN FIELDS (Anthropic Messages API, per plan: claude-opus-5-5 judge, claude-haiku-5-5 pre-screen): llm_model_id (exact id string, no date suffix), api_version (anthropic-version header value), effort (output_config.effort), thinking_type (adaptive), judge_schema_ref (the output_config.format JSON schema, content-addressed), prompt_ref (system prompt + message template, content-addressed), request_hash, response_id, response_model (fallback may differ), stop_reason, usage, inference_geo. Do not pin temperature/top_p/top_k: current API versions reject sampling parameters. Judge output is stored verbatim; reruns are new grade versions, never silent replacements.\n\nEVENT ENVELOPE EXAMPLE: {\"specversion\":\"1.0\",\"id\":\"evt_0193...\",\"source\":\"/svc/api\",\"type\":\"bridle.lms.submission.submitted\",\"time\":\"2026-11-03T10:15:02.123Z\",\"datacontenttype\":\"application/json\",\"dataschema\":\"bridle-events@1.0.0#bridle.lms.submission.submitted\",\"subject\":\"sub_0193...\",\"class\":\"learning\",\"tenantid\":\"ten_0193...\",\"actorkind\":\"user\",\"actorid\":\"usr_0193...\",\"actorrole\":\"learner\",\"traceparent\":\"00-...\",\"seq\":4182,\"schemaversion\":\"1.0.0\",\"pii\":\"identified\",\"refs\":[{\"rel\":\"activity\",\"id\":\"act_...\"},{\"rel\":\"model_revision\",\"id\":\"mrev_...\"},{\"rel\":\"pinset\",\"id\":\"pin_...\"}],\"data\":{\"submission_seq\":2,\"model_hash\":\"sha256:...\",\"scenario_hash\":\"sha256:...\"}}.\n\nCLASS TABLE (actor | PII | default retention | FERPA education record): analytics | HMAC pseudonym per tenant, allowlisted payload | 13 months raw, aggregates kept | no (by design; tenant may disable class). audit | identified user/service | >= 7 years and >= life of referenced record, WORM | only audit.disclosure.* events are part of the learner's record. learning | identified learner | education-record lifetime (default 5 years after offering concludes) | yes, all. process | service or opaque user id | 30 days; op-log segments 90 days unless referenced by a submission (then learning rules) | no, except promoted op-log segments. Event type naming: bridle.<domain>.<entity>.<verb> with past-tense verbs (created, published, submitted, computed, released, superseded, viewed, disclosed, exported, failed). Audit-worthy actions: role changes, pinset changes, grade release/override, artifact publish/withdraw, exports, record reads by non-owners, retention purges, erasures.\n\nxAPI MAPPING: submission.submitted -> completed (result.completion=true); grade.released -> scored (result.score raw/max/scaled) + passed|failed when threshold exists; ws.session.started -> launched; ws.session.resumed -> resumed; ws.session.ended -> terminated; ws.hint.revealed -> interacted (+ extension hint id/criterion); activity.viewed -> experienced; progress.updated -> progressed. Statement id = UUIDv5(namespace bridle-xapi, event id). Actor = account{homePage tenant issuer, name usr_ id or tenant pseudonym}.\n\nARCHITECTURE RECOMMENDATIONS: Postgres with uuid primary keys generated as UUIDv7 (Postgres 18 uuidv7() or app-side), JSONB pin columns with generated columns for indexed fields (model_hash, result_hash, pinset_id), immutable tables guarded by REVOKE UPDATE/DELETE plus triggers; transactional outbox table polled into a bus (Redis Streams via BullMQ is sufficient for MVP; NATS/Kafka later); audit sink on S3-compatible storage with Object Lock (WORM) plus a Postgres index; per-tenant analytics HMAC keys in KMS; `packages/schema` (JSON Schema source of truth, codegen to TS and Rust types) and `crates/bridle-canon` (canonicalize, hash, id parsing, event validation) built before any product feature; golden vectors shared with the FE engine's determinism tests; CloudEvents SDK for envelope handling; store op-log segments as content-addressed blobs. UX implications: learners see a submission receipt (submission_hash) and grade history with reasons; instructors see per-submission pin sets and a pinset-change banner; operators see replay status.

## Risks

| risk | mitigation |
|---|---|
| Floating-point nondeterminism between WASM and native engine builds (FMA, libm, thread reductions) makes client and server results differ | Claim hash equality only per engine artifact and numeric profile; FE builds grading mode single-threaded with fixed math flags; compare client vs server by tolerance and record result_match |
| Quantum table too coarse (collapses meaningful differences) or too fine (hash churn from UI rounding) | STR and FE review the table before schema v1 freeze; golden vectors encode expected sensitivity; changes require a canon version bump and never rewrite stored hashes |
| Analytics pseudonyms re-identified by tenant staff, turning analytics into education records | Per-tenant HMAC keys held in platform KMS, payload allowlists, no raw identifiers or IPs, tenant option to disable the analytics class |
| Workspace op-log volume overwhelms the event bus and storage | Batch into segments with hash chain, process-class retention of 90 days, promote only submission-referenced segments to learning retention |
| LLM judge output cannot be reproduced on rerun, undermining the reproducibility story | Pin and store request and output hashes plus verbatim outputs; treat reruns as new grade versions; keep deterministic criteria the majority of the score and calibrate judged criteria |
| Domains drift from the registry and reintroduce parallel ids and event logs | Single registry file with CI lint on prefixes, event types and requirement ids; emit() helper is the only event API |
| Pin set breadth overwhelms a small team | Pin sets are one versioned JSON schema object (ArtifactRef list) with helper library and generated types; the activity pin set is the only place pins are chosen |
| FERPA defaults do not fit non-US tenants (GDPR, local record laws) | Retention and residency are per-tenant profiles within documented bounds; classes and erasure rules are jurisdiction-neutral |
| Mid-offering upgrades confuse learners and instructors about which rules graded them | Explicit pinset_superseded events, per-submission pin visibility and regrade reasons surfaced in the UI; default regrade_policy none |

## Open questions

- Should free-text labels and load-case names be excluded from model_hash (proposed yes) or should a secondary document hash include them?
- Should the integrity domain get a canonical topology hash (ids renumbered) for similarity detection, separate from model_hash?
- Which domain owns MET-01 product analytics (PRD or PLT), and may tenants disable the analytics class entirely?
- Confirm default learning-record retention (proposed 5 years after offering concludes) and the legal minimum tenants may set, with institution customers and counsel
- Must learners see their disclosure log in-product at MVP, or is export on request sufficient?
- May a rubric_fix regrade change maximum points (affects gradebook totals and released grades)?
- Event bus for MVP: Postgres outbox plus Redis Streams versus NATS/Kafka from day one (architecture phase)
- Should the judge request_hash include prompt-cache breakpoints and tool definitions verbatim (proposed yes, excluding auth headers)?
- Is offering-level pin set inheritance needed at MVP or is an activity-level pin set sufficient?
- Cost-model currency quantum and FX handling for non-USD tenants
- Confirm Postgres 18 uuidv7() availability on the chosen hosting provider; otherwise generate UUIDv7 application-side
