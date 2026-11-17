---
id: P1-01
title: Schema package
phase: P1
order: 101
dependsOn: [P0-02]
estimate: 4
station: backlog
status: planned
owner: -
updated: 2026-11-03T08:29:21Z
history:
---

# P1-01 Schema package

## Spec

Work package (E2 row): Schema package: schemars structs to JSON Schema, TypeScript, and zod for model, ops, result frame, result summary, scenario (nine ASCE 7-22 site classes plus default; design attributes Ky, Kz, Lb, Cb, An/Ag, U, stabilityMethod), evidence, deliverables, task, rubric, pin sets, events, integrity signal, exam profile, seeded-error catalog and InjectedErrorSet, learning-outcome taxonomy (LOM-01, versioned); quanta table; golden corpus; events table and emit(); packages/units (dimension-tagged SI conversion); exit: schema 1.0 frozen with fixtures handed to the content track (D21)

After: P0-02. Size: 4 engineer-weeks. Split into sub-cards at the spec station per E1.

### Draft for the owner's approval (2026-11-17, not approved)

Drafted by the spec-draft agent from the documents only; nothing below is approved or built. Short names for the citations:
RM = `docs/plan/roadmap.md`, AR = `docs/architecture/architecture.md`, DEC = `docs/architecture/decisions.md`,
DM = `docs/requirements/09-cross-domain-canonical-data-model-identifi.md`, PRD = `docs/requirements/08-product-definition-personas-mvp-scope.md`,
ADR1 and ADR2 = `docs/decisions/0001-...md` and `0002-...md`. "RM:293" is line 293 of that file.

What exists today: `crates/bridle-canon` is a hello crate with `CANON_VERSION` only; `packages/units` is a hello package with one
length table (`toMetres`); `packages/schema` does not exist. `factory/lanes.json` (untracked, card P0-08.2) gives `crates/`,
`packages/schema/`, `packages/units/` and the root workspace files to the core lane, and `tools/check.sh`, `tools/test/` to platform.

#### 1. Row acceptance criteria

Each quoted phrase is from the row's text (RM:293). "Every schema" means the fourteen named there: model, ops, result frame, result
summary, scenario, evidence, deliverables, task, rubric, pin sets, events, integrity signal, exam profile, seeded-error catalog
with InjectedErrorSet; plus the learning-outcome taxonomy.

1. "schemars structs to JSON Schema": every schema is a schemars-annotated Rust struct in `crates/bridle-canon` (AR:107, AR:195) and
   has a committed JSON Schema 2020-12 file under `packages/schema/json/` (AR:131, AR:195). `cargo test -p bridle-canon schema_drift`
   regenerates them in memory and fails on any difference from the committed files ("CI fails on drift", AR:131).
2. "TypeScript, and zod": `packages/schema` holds TypeScript types and zod validators generated from the committed JSON (AR:195), one
   export per schema. `pnpm --filter @bridle/schema test` regenerates and fails on drift, and parses every fixture of criterion 11
   with the zod validator and rejects one invalid fixture per schema.
3. "model": the document shape of AR:199 (header, settings with mode `3d | 2d-xz`, materials, sections, nodes, levels, members,
   links, supports, loadCases, loads, panels, combinations, analyses, groups), typed ids and fractional order keys, the reserved
   elements present in the schema, and the conventions of AR:197 (SI base units, +Z up) stated in the schema descriptions. A fixture
   of a simply supported beam and one of a 2D frame validate.
4. "ops, result frame, result summary": op schema with the per-op fields of AR:176 (the `oplog_segments` entry); the result frame
   header and layout of AR:205 (the binary body is P1-02, RM:294); `result_summary` per AR:207. One valid fixture each.
5. "scenario (nine ASCE 7-22 site classes plus default; design attributes Ky, Kz, Lb, Cb, An/Ag, U, stabilityMethod)": the scenario
   schema of ADR1 R5 (ADR1:14) with a site-class enum of A, B, BC, C, CD, D, DE, E, F and `default` (RM:120); member design
   attributes Ky, Kz, Lb, Cb (AR:199) with An/Ag and U per member and defaults An = Ag, U = 1.0 (AR:221); `stabilityMethod`
   `dam | elm`, default `dam` (AR:221, ADR2 A5). A unit test asserts each enum value and default (placement: open question 5).
6. "evidence, deliverables, task, rubric, pin sets": GradeEvidence 1.0 record (AR:261, AR:279); deliverables; task definition with the
   fields of AR:170; rubric with the criterion kinds, dimensions, scoring functions and gates of AR:171 and AR:267, the Diagnose
   matrix present and inactive (AR:267, ADR2 A3); activity, submission and grade pin sets (AR:172, AR:179, AR:183, DM-05, DM-06) with
   `schema_version` and `canon_version` in the submission and grade pin sets (DM-14 acceptance, DM:162). One valid fixture each.
7. "integrity signal, exam profile, seeded-error catalog and InjectedErrorSet": schemas present with one valid fixture each; the
   seeded-error catalog and InjectedErrorSet are schema only, with no injector and no content (ADR2 A3, ADR2:14; RM:166).
8. "learning-outcome taxonomy (LOM-01, versioned)": `packages/schema/registry/outcomes.json` lists the four levels and the outcomes
   of PRD:518-522 with stable ids and a taxonomy version; its schema allows a rename without changing an id ("renames do not break
   historical data", PRD:153); task and rubric-criterion schemas require at least one outcome tag (PRD:147). Tested by the package test.
9. "quanta table": one table in `bridle-canon` with the model quanta of AR:201 and the result quanta of AR:205, exported to
   `packages/schema`; every numeric field of every schema carries a quantum annotation, and `cargo test -p bridle-canon quanta_walk`
   walks the schemas and fails on a numeric field without one (AR:201). A fixture schema with an untagged number makes the walk fail.
10. "golden corpus": `packages/schema/golden/` holds at least 50 vectors covering the cases of AR:211 (relabel, reorder and
    display-unit invariance, 1 um and 1 mN sensitivity, alpha and Cw sensitivity, overflow rejection, result frames and summaries),
    each input valid against its schema. Whether canonical bytes and hashes are filled in this row is open question 1.
11. "events" and "events table and emit()": the CloudEvents 1.0.2 envelope of DM-15 (DM:165-174) as a schema; the entity, prefix and
    event-type registry (`packages/schema/registry/`, DM-01, DM:13) with a lint that fails on an unregistered prefix, entity or event
    type (AR:131); `emit()` validates against the per-type schema, rejects unknown types and refuses events without tenantid or
    class (DM:172-173); a sample event per registered type is committed (DM:174); the events table has the envelope columns,
    class, prevhash and monthly partitions, with `event_cursors` (AR:187, AR:139), proven by a test that inserts through `emit()`
    into the compose Postgres. Where the table lives is open question 2.
12. "packages/units (dimension-tagged SI conversion)": `@bridle/units` converts to and from SI for every dimension of the quanta
    table, refuses a conversion across dimensions at compile time and at run time, and a test proves its dimension list equals the
    quanta table's. `pnpm --filter @bridle/units test`.
13. Exit, "schema 1.0 frozen with fixtures handed to the content track (D21)": the schemas carry `bridle-schema@1.0.0`, `canon:1` and
    `bridle-events@1.0.0` (AR:195); `packages/schema/fixtures/` holds example task, rubric and deliverable fixtures (DEC:27, AR:195)
    plus the scenario they embed; a committed lock file of schema digests makes the package test fail when a frozen schema changes
    without a version bump; `docs/content/schema-fixtures.md` tells the content track where the fixtures are and how to validate a
    file (P1-05 authors "validated JSON/YAML against the P1-01 fixtures", RM:297).
14. Left by P0-02 (its `## Ship`): schema drift and the quanta walk run inside `pnpm check` (as cargo and vitest tests, so
    `tools/check.sh` is not changed), and `pnpm check` stays green and under 10 minutes locally (RM:287). The wasm32 build of the
    facades is not this row: the facades come with P2-05 (RM:349).

#### 2. The split

All sixteen sub-cards are in the core lane, so under "at most one card running per lane" (RM:276) none of them runs beside another.
The last column marks the pairs that share no files, should the owner allow it. Other rows can run beside this one: P4-06 (web lane)
and P2-01 are independent of P1-01 (RM:347), though P2-01 is also core.

| Sub-card | Title | Changes | Lane | Depends on | Days | Test command | Row criteria | File-disjoint with |
|---|---|---|---|---|---|---|---|---|
| P1-01.1 | Schema pipeline, typed ids and the model core, with the JSON Schema drift test | `crates/bridle-canon` | core | P0-02 | 1 | `cargo test -p bridle-canon` | 1, 3 (part) | none |
| P1-01.2 | Model: loads, cases, panels, combinations, analyses, design attributes, reserved elements | `crates/bridle-canon` | core | .1 | 1 | `cargo test -p bridle-canon` | 3, 5 (member part) | none |
| P1-01.3 | Quanta table and the schema walk test | `crates/bridle-canon` | core | .2 | 1 | `cargo test -p bridle-canon quanta_walk` | 9, 14 | none |
| P1-01.4 | TypeScript and zod generation with its drift test | `packages/schema` | core | .3 | 1 | `pnpm --filter @bridle/schema test` | 2, 14 | none |
| P1-01.5 | Ops, result frame header and result summary | `crates/bridle-canon` | core | .4 | 1 | `cargo test -p bridle-canon` | 4 | .14 |
| P1-01.6 | Scenario schema with the site classes | `crates/bridle-canon` | core | .5 | 0.5 | `cargo test -p bridle-canon` | 5 | .14 |
| P1-01.7 | Task definition, exam profile and deliverables | `crates/bridle-canon` | core | .6 | 1 | `cargo test -p bridle-canon` | 6 (part), 7 (part) | .14 |
| P1-01.8 | Rubric and the learning-outcome taxonomy | `crates/bridle-canon` | core | .7 | 1 | `cargo test -p bridle-canon` | 6 (part), 8 | .14 |
| P1-01.9 | Evidence and the three pin sets | `crates/bridle-canon` | core | .8 | 1 | `cargo test -p bridle-canon` | 6 | .14 |
| P1-01.10 | Integrity signal, seeded-error catalog and InjectedErrorSet | `crates/bridle-canon` | core | .9 | 0.5 | `cargo test -p bridle-canon` | 7 | .14 |
| P1-01.11 | Event envelope and per-type data schemas | `crates/bridle-canon` | core | .10 | 1 | `cargo test -p bridle-canon` | 11 (part) | .14 |
| P1-01.12 | Registry, registry lint and `emit()` | `packages/schema` | core | .11 | 1 | `pnpm --filter @bridle/schema test` | 11 (part) | none |
| P1-01.13 | Events table and the Postgres sink of `emit()` | `packages/schema` (open question 2) | core | .12 | 1 | `pnpm --filter @bridle/schema test:db` | 11 | .14 |
| P1-01.14 | `packages/units`: dimension tags and SI conversion | `packages/units` | core | .4 | 0.5 | `pnpm --filter @bridle/units test` | 12 | .5 to .11, .13 |
| P1-01.15 | Golden corpus: format, 50 inputs and their checks | `packages/schema` | core | .13 | 1 | `pnpm --filter @bridle/schema test` | 10 | none |
| P1-01.16 | Freeze at 1.0: fixtures, digest lock, hand-off note; closes the row | `packages/schema` | core | .15 | 1 | `pnpm check` | 13, 14, and all of 1 to 12 | none |

Total 14.5 engineer-days against the row's 4 engineer-weeks (20 days). Order: .1 to .4 come first because P1-02 (canon/1, RM:294),
P2-02 and P3-01 (RM:311) wait for the model structs, the quanta and the generated TypeScript; .5 to .10 are the grading and content
contracts P1-05 waits for (RM:297); .11 to .13 are what P4-01 waits for (RM:318). Sub-cards from .5 on that add a schema also commit
its regenerated files under `packages/schema/` (generated output only; open question 8).

#### 3. Per sub-card

- **.1** What: add serde and schemars to the crate, the typed-id and ArtifactRef string types (patterns of DM:24), the model header,
  settings, materials, sections, nodes, levels, members, supports (AR:199), a generator that writes
  `packages/schema/json/bridle-model.schema.json`, and the drift test. Accepts when: the drift test fails after a hand edit of the
  committed file; a beam fixture validates. Files: `crates/bridle-canon/src/{lib,ids,model/*,schema_gen}.rs`, `Cargo.toml`,
  `Cargo.lock`, `packages/schema/{package.json,json/}`. Out: parsing functions (P1-02, open question 3), canonicalization, hashing.
- **.2** What: links, loadCases with generator provenance, the six load kinds, one-way panels, combinations, analyses, groups, member
  design {Ky, Kz, Lb, Cb, bracedLateral, role, An/Ag, U}, and the reserved elements (AR:199). Accepts when: a 2D-frame fixture
  validates and each default of criterion 5's member part is asserted. Out: validation rules VAL-* (bridle-fem, AR:107).
- **.3** What: the quanta table (AR:201, AR:205) as data with per-field overrides (AR:131), a quantum annotation on every numeric
  field so far, the walk test, and the table exported as `packages/schema/json/quanta.json`. Accepts when: criterion 9 holds for
  the model schema; later schema cards must keep the walk green. Out: quantization itself (P1-02).
- **.4** What: the generator from committed JSON to TypeScript types and zod validators, its drift test, package exports and the
  turbo wiring. Accepts when: criterion 2 holds for the model schema and `pnpm check` runs both drift tests. Files:
  `packages/schema/{src/generated/*,scripts/gen.*,src/index.ts,tsconfig.json}`, `pnpm-lock.yaml`. Out: OpenAPI (P4-01, RM:318).
  The documents do not name a generator; the plan station picks one, pinned, and says why.
- **.5** What: op schema (AR:176), result frame header and layout (AR:205), `result_summary` (AR:207). Accepts when: criterion 4.
  Out: the binary body and `result_hash` (P1-02, RM:294); Worker Protocol (P2-05).
- **.6** What: scenario schema (ADR1 R5; site classes RM:120). Accepts when: criterion 5's scenario part; one fixture per MVP hazard
  (wind, seismic, snow). Out: derivation and the refusal of class F (P2-07, RM:305); the hazard dataset.
- **.7** What: task definition (AR:170) including `stabilityMethod`, exam profile, deliverables schemas for the MVP archetypes.
  Accepts when: one fixture per schema validates; a task without an outcome tag is rejected once .8 lands (asserted there).
  Out: the checkpoint DSL and authoring forms (P6); attestation records (open question 4).
- **.8** What: rubric schema (ADR1 R6, ADR1:15; AR:171, AR:267) and `outcomes.json` with its schema (PRD:518-522). Accepts when:
  criterion 8; the five archetype weight sets of AR:267 validate as fixtures. Out: mastery rules (LOM-02).
- **.9** What: GradeEvidence 1.0 record and the activity, submission and grade pin sets. Accepts when: criterion 6's pin-set part.
  Out: EvidenceDigest and JudgeOutput, which AR:73 gives to the grader package; the registry tables (P1-03).
- **.10** What: IntegritySignal (AR:185), seeded-error catalog and InjectedErrorSet schemas. Accepts when: criterion 7. Out: the
  injector, detectors and any catalog content (ADR2 A3).
- **.11** What: the envelope with its required extensions (DM:167) and data schemas for the event types the documents name (open
  question 9). Accepts when: a sample of each type validates and one without `tenantid` does not. Out: pseudonymization (DM-16).
- **.12** What: `registry/entities.json` with the prefixes and artifact kinds of DM:24, `registry/events.json`, the lint as a package
  test, and `emit(event, sink)` with validation and an in-memory sink. Accepts when: criterion 11 up to the table. Out: the outbox
  relay (P4-05), DB-model and API-path linting (nothing to lint until P4-01).
- **.13** What: the events table DDL (plain SQL), `event_cursors`, monthly partition creation, and a Postgres sink that inserts in the
  caller's transaction (AR:85). Accepts when: the test inserts and reads back through the compose Postgres and UPDATE is refused
  (AR:139). Out: Drizzle models and RLS (P4-01), the audit hash chain beyond the `prevhash` column (DM-25), the WORM copy.
- **.14** What: dimension-tagged values, conversion tables per dimension (SI and US customary), the cross-check against
  `quanta.json`. Accepts when: criterion 12. Out: display formatting and the tenant unit preference (web lane).
- **.15** What: the vector file format, 50 or more inputs grouped by the AR:211 cases with their expected relations (equal hash,
  different hash, rejected), each validated against its schema. Accepts when: criterion 10. Out: the five-host run (P0-09, RM:291).
- **.16** What: content fixtures, the digest lock, version strings, `docs/content/schema-fixtures.md`, a `validate <file>` script for
  JSON and YAML, and the row close with each criterion mapped to its sub-card. Accepts when: criteria 13 and 14 and a full pass of
  1 to 12. Out: the course outline and template briefs (P1-05).

#### 4. Manual gates

The documents require none for this row: E1's list of human-only artifacts (RM:276) names no schema artifact, and D21 (DEC:27) asks
for a freeze, not a signature. Proposed, for the owner to accept or drop: on P1-01.16 one gate, "owner confirms the 1.0 freeze of
task, rubric and deliverables", because after it only additive minors are allowed (DM:268). No SME gate: the fixtures are
illustrative and carry no reference values that are graded.

#### 5. Open questions for the owner

1. **Golden corpus before canon/1.** A vector is "(input, canonical bytes, hash)" (AR:211) and E1 puts "the first 50-vector golden
   corpus" in this row (RM:274), but canonical JSON and SHA-256 are P1-02 (RM:294), which comes after. Options: (a) this row ships
   inputs and expected relations, P1-02 fills bytes and hashes; (b) move the corpus to P1-02; (c) an independent oracle script
   produces the bytes here. Recommend (a): (c) is a second canonicalizer, which DM:156 forbids. With (b), drop .15 (minus 1 day).
2. **Home of the events table.** The row has "events table and emit()" (RM:293), but Drizzle, RLS and the immutable-table pattern
   arrive in P4-01 (RM:318), and `factory/lanes.json` owns no path for migrations. Options: (a) plain SQL in `packages/schema` now,
   adopted by P4-01's Drizzle setup; (b) move the table to P4-01 and ship only `emit()` with a sink interface here. Recommend (a),
   as written in .13; with (b), drop .13 (minus 1 day) and P4-01 gains the table.
3. **parseId and parseArtifactRef.** AR:131 and DM:29 put them in the schema package; RM:294 puts "id and artifact-reference parsing"
   in P1-02. Recommend: the id and ArtifactRef types and patterns here (.1), the parse functions in P1-02. No change to the split.
4. **Schemas the architecture lists and the row does not.** AR:195 adds "attestation" and "comment"; the row adds the outcome taxonomy
   and InjectedErrorSet, which AR:195 lacks. Options: add attestation to .7 and comment to .10, or leave both to the rows that use
   them (P5-06 integrity; discussion in P4-03). Recommend: attestation now (the submission pin set embeds it, AR:179), comment later.
5. **Where the design attributes sit.** The row lists them inside the scenario parentheses (RM:293); AR:199 puts Ky, Kz, Lb, Cb on
   the member, AR:221 makes An/Ag and U per member and `stabilityMethod` per task. Recommend the architecture's placement, as drafted.
6. **Site class F and "default".** The nine classes include F, which the pack refuses (RM:120). Recommend: F is a valid enum value
   and the refusal stays in P2-07; `default` means "unknown", resolved by the pack per 11.4.2. The documents do not say either.
7. **What "frozen" covers, and how early.** D21 freezes "task, rubric and deliverable schemas" (DEC:27, AR:195); the row's exit says
   "schema 1.0 frozen" (RM:293); milestone M3 dates the freeze 2027-02-12 (AR:389), before the solver, workspace and grader have
   used the schemas. Options: (a) hard lock on task, rubric, deliverables and scenario, version-bump lock on the rest; (b) hard
   lock on everything. Recommend (a). It changes only .16's lock file.
8. **One package per sub-card and generated files.** E1 says each sub-card changes one package or crate (RM:274), yet its own .1
   commits the JSON Schema, which lives in `packages/schema` (AR:131). Recommend: generated, committed output does not count.
   Otherwise every schema card splits in two and the row is about 26 cards.
9. **Which event types exist at 1.0.** The documents name eleven types in passing (for example `bridle.lms.submission.submitted`,
   AR:257; `bridle.plt.record.disclosed`, AR:297) and give no list. Recommend: register those eleven; later rows add theirs
   registry-first (DM:13). No change to the split.
10. **Sixteen sub-cards against E1's four.** E1 names four sub-cards for this row and caps each at one engineer-day in the same
    paragraph (RM:274); four days do not cover a 4-week row. Recommend the sixteen above. E1's .1 becomes .1 and .2; its .2 becomes .5 and .6; its .3 becomes .7 to
    .12; its .4 becomes .3, .4 and .15; .13, .14 and .16 cover what E1's four leave out.
11. **Where the walk and the lint live.** AR:354 puts "registry lint, quanta walk" in `tools/ci/`, which no lane owns, and
    `tools/check.sh` is platform. Recommend tests inside the crate and the package, as drafted; else add a platform sub-card.
12. **Hashing lint.** AR:195 and DM:163 want a lint against hashing outside `bridle-canon`; the row does not name it. Recommend P1-02.

#### 6. Risks

- Freezing before any consumer exists (question 7). Guard: additive minors (DM:268), the digest lock, and fixtures for every schema
  so a later change shows as a failing test, not a surprise.
- Schemars output and the TypeScript and zod generator disagree on JSON Schema 2020-12 features (tagged unions, `$defs`). Guard:
  .4 proves the whole chain on the model schema before twelve more schemas are written; each fixture is parsed by both sides.
- The quanta walk passes vacuously (it walks nothing). Guard: the failing fixture of criterion 9 and a count of fields walked.
- The crate grows beyond one-day cards as schemas pile up. Guard: one module per schema; the foreman may split a card at its plan
  station, as P0-02.6's ruling 5 allowed the opposite.
- All cards sit in the core lane, so this row holds the lane for about three weeks of line time while P1-02, P2-01 and P2-02 also
  need it. Guard: run .1 to .4 first, then let P2-01 interleave; .14 is the only card safe to hand elsewhere.
- `test:db` needs the compose stack, which Actions may not have. Guard: .13 states whether Actions runs it; if not, it is a local
  test recorded in `## Test`, like `pnpm e2e:smoke` (P0-02 `## Ship`).
- `canon:1` hashes depend on field names and semantic flags set here. Guard: P1-02 may still change them before any hash is stored;
  after M-A (RM:349) a change bumps canon (AR:195).


## Plan


## Build


## Test


## Review


## Ship

