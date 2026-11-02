# Learner deliverables and grading specification per task archetype (Analyze, Check, Diagnose), including the memo and attachment deliverable for Design/Optimize

_Source: requirements discovery workflow `wf_6281c128-0bb` (gap-fill agent), 2026-11-03. 23 requirements: 23 must (MVP), 0 should (v1.x), 0 could (later)._

## Summary

Today only Design and Optimize tasks have an end-to-end deliverable path (canonical model + structured memo + checks + judged memo), while most T1-T2 tasks in the MVP course are Analyze or Check and CAT-03 also declares Diagnose. This gap-fill makes the deliverable set a per-archetype, schema-versioned part of the task definition and of the immutable submission bundle: Analyze adds author-defined answer fields bound to engine result queries (reactions, member forces, deflections) that are evaluated on a parametric reference model per learner seed and graded by a three-way comparison (reference, submitted, learner's own model) with unit-aware tolerances; Check adds a structured findings report (member, limit state, verdict, demand, capacity, clause, reason) graded against the checks-library key for the learner's instance with precision/recall-style credit, false-positive penalties and an 'unsafe approval' gate; Diagnose adds an author-facing seeded-error catalog whose entries are ops on the clean reference model, deterministic per-seed injection with a lock scope, a found-errors list plus change review in the workspace, and separate grading of found, fixed and collateral changes. The rubric category enum (STR GRD-02 as adopted by the critic) is extended with three archetype dimensions (analysis_accuracy, code_check_reporting, diagnosis) and a default activation/weight matrix per archetype is fixed. A single assistance-and-disclosure profile (live results, code-check overlays, self-check disclosure level 0-4, hints, reveal timing) replaces the scattered coach/exam settings: institution policy sets defaults and caps, authors choose per task, instructors may only tighten per offering, and the INTEG- exam lockdown is a preset of it. The memo becomes a structured editor with a canonical section catalog per archetype, word bounds, LaTeX and figure support, 2-second autosave, paste provenance for integrity review (no auto-penalty), English-only at MVP with language detection, and PII scrubbing before any model call. All new deliverable kinds reuse the existing evidence schema, canonicalization/pin set (DM-), checks library, seed engine and review/override machinery rather than adding parallel pipelines.

## Must (MVP)

### GAP3-DLV-01 Archetype deliverable catalog and canonical submission bundle

The task definition (AUT TB-13 / LMS CRS-03 deliverables object) is extended to a per-archetype deliverable list drawn from a fixed catalog: model (always), answers (Analyze), findings (Check), foundErrors (Diagnose), memo (all, archetype-specific sections), attachments, requiredSnapshots, and the honor pledge. Each deliverable kind has a versioned JSON schema in the shared contracts package, a canonical form (SI values, entries sorted by field/entry id, no UI state) and is hashed into the submission content hash so the DM- pin set covers it. The submission bundle stores every deliverable immutably per version (LMS SUB-01) and the grader consumes only the canonical forms.

**Why:** Without a typed deliverable catalog, Analyze/Check/Diagnose cannot be captured, hashed, regraded or audited consistently with the Design/Optimize path, and the critic's canonical pin set would miss half the graded inputs.

**Acceptance:**
- Task JSON schema validates deliverables against the archetype: a Check task without a findings deliverable or an Analyze task without at least one answer field fails validation
- Submitting the same deliverables twice in different entry order or display units yields the same deliverable hash; changing any value changes it
- Every submission version stores deliverables plus their hashes, and the grade record references the deliverable hashes alongside modelHash, engineArtifactHash and resultHash
- Deliverable schemas are exported from the same contracts package used by the browser, API, grader and authoring, with a migration test from every prior schema version

### GAP3-DLV-02 Submission checklist and completeness gate

The task page and workspace show a submission checklist listing every deliverable with status (complete, incomplete with reason, invalid), derived from the same validators the server applies at submit time. Authors mark each deliverable hard-required (blocks submission) or soft-required (allowed, but a missing_deliverable evidence record scores the bound criteria 0). The checklist also shows the late-penalty preview (LMS SCH-02), attempts remaining, the honor pledge, and the receipt lists deliverable hashes after submission.

**Why:** Learners must know exactly what will be graded before they submit, and the grader needs a deterministic rule for missing items instead of ad hoc nulls.

**Acceptance:**
- Submit is disabled with the list of hard-required items missing; the API rejects a bypass attempt with the same list
- A soft-required memo left empty produces evidence check_type task_constraint, subject memo, status fail, and the memo criteria score 0 (consistent with RUB-02 null-baseline rule)
- Client and server completeness validators share one implementation (contracts package); CI runs the same fixtures through both
- The receipt shows version number, submitted time in the offering timezone, and the hash of each deliverable

### GAP3-DLV-03 Given-data sheet rendered from the learner's scenario instance

For every task the brief includes an auto-rendered 'Given data' sheet produced from the learner's resolved scenario instance and starter model: geometry (spans, heights, node labels), supports, loads per case with source parameters, materials and sections, design attributes (Lb, K, bracing), required combinations, serviceability limits, and the task's unit system. Authors mark individual values as given, hidden (learner must derive) or not applicable; hidden values never appear in the sheet or exports. The sheet is the reference the learner compares against in Check (hand calculations) and Diagnose (spotting discrepancies) tasks.

**Why:** Check and Diagnose are impossible without an unambiguous statement of what the structure is supposed to be; deriving the sheet from the instance guarantees it matches the hidden key for that seed.

**Acceptance:**
- The sheet for two learners with different seeds shows their own resolved values; values marked hidden are absent from the HTML, PDF export and API payload
- Every value on the sheet carries a unit in the task's working unit system with converted secondary units when I18N-02 allows
- Changing the instance (re-seed per attempt) re-renders the sheet and records which sheet version the learner saw on the submission
- Sheet rendering is deterministic: identical instance yields byte-identical sheet JSON

### GAP3-DLV-04 Analyze: answer fields bound to engine result queries with per-seed reference values

Authors define answer fields for Analyze tasks, each binding a label and prompt to an engine result query on the reference model: reaction (node, global component), member force (member, component N/V2/V3/M2/M3/T, at end i/j, station x, or max/min along the member), displacement or relative deflection (node or member, component), with the load case or combination, a physical dimension, a declared sign convention, tolerances (relative plus absolute floor) and a weight. At assignment time the server resolves the learner's seed (TB-11/SCN-02), instantiates the parametric reference (TB-07), runs the pinned engine and stores a hidden ReferenceAnswerSet (field values in SI, resultHash, engineArtifactHash) with the instance. The calibration run (PV-02) evaluates all fields across the sampled seeds and rejects fields whose reference magnitude falls below 10 times the absolute tolerance for any seed.

**Why:** Analyze tasks need an answer key that is correct for each learner's randomized variant and reproducible under regrade; binding fields to engine queries removes hand-typed keys and ties grading to the same engine the learner uses.

**Acceptance:**
- Author UI supports the listed query kinds; entity references resolve by label first, then coordinates with tolerance (GL-02 semantics), never by internal id
- For two seeds the stored reference values differ wherever bound parameters differ, and re-generating the reference for the same seed and engine artifact yields identical values (hash equality)
- Calibration report lists per field the min/max reference magnitude across seeds and flags degenerate fields; publish is blocked while any field is degenerate
- Reference values are never included in any learner-facing payload before the reveal policy allows (GAP3-DLV-17/18)

### GAP3-DLV-05 Analyze: unit-aware value capture UI with entity binding

A 'Report values' panel in the workspace (also available on the task page for the accessible path) lists the answer fields with unit-aware numeric inputs that accept any unit compatible with the field's dimension (reusing the QZ-01/CNT-02 numeric component), show the declared sign convention and a truss tension/compression selector where applicable, and highlight the bound node or member in the 3D view when a field is focused. Entries convert to SI on the client for validation only; dimension mismatches and implausible magnitudes (ERR-04 bands, e.g., a reaction larger than the total applied load) are flagged inline without revealing correctness. An author option 'fill from my results' lets the learner copy their own model's value into a field; it is off when live results are hidden by the assistance profile.

**Why:** Transcription and unit errors would otherwise dominate Analyze grades; entity highlighting and unit-aware entry make the deliverable measure modeling and reading skill rather than clerical care.

**Acceptance:**
- Entering 12.5 kN, 12500 N or 2.81 kip into a force field stores the same SI value; entering 12.5 kN·m into a force field shows a dimension error and is not submittable
- Focusing a field highlights its entity and switches the active case/combination; a field whose entity cannot be resolved in the learner's model shows 'not found in your model'
- The panel is fully keyboard-operable with a list-based entity reference (no canvas interaction required) and meets WCAG 2.2 AA
- Draft values autosave with the model draft (SUB-02) and survive reload

### GAP3-DLV-06 Analyze: grading by three-way comparison with tolerances and partial credit

For each answer field the grader compares, in SI, the submitted value against the hidden reference value and against the learner's own re-analyzed model (PIPE-03) evaluated with the same query, then classifies the field: correct (within tolerance), sign_error, unit_error (submitted/reference ratio within 1 percent of a conversion fingerprint such as 1000, 12, 25.4, 47.88, 4.448), modeling_error (matches own model but not reference), transcription_error (own model matches reference but submitted does not), unresolved_entity, or missing. Default credit per field is 100 percent within tolerance, 50 percent within twice the tolerance or for a pure sign error under a stated convention, else 0; defaults are reference-type specific (reactions 2 percent, member forces 2 percent, deflections 3 percent, absolute floors 0.05 kN, 0.1 kN·m, 0.1 mm) and author-adjustable per field. Each classification is emitted as a GradeEvidence record feeding the analysis_accuracy criterion.

**Why:** A single number-match cannot tell a learner whether they modeled wrongly, read the wrong station, or mistyped units; the three-way classification turns Analyze grading into actionable feedback and prevents false failures from rounding.

**Acceptance:**
- Golden fixtures for each classification (correct, 2x-tolerance, sign flip, x1000 unit error, wrong support producing a modeling error, transcription error) score and label as specified
- Comparison is performed in SI before any formatting; a property-based test across 10,000 values near tolerance boundaries shows no flips between client preview and server grading
- The analysis_accuracy score equals the weighted mean of field credits recomputed from stored evidence rows (AGG-01)
- A field left blank or dimensionally invalid scores 0 and never raises an exception in the pipeline

### GAP3-DLV-07 Analyze: optional hand-calculation attachment

Authors can allow or require a hand-calculation attachment (PDF, PNG or JPG, up to 3 files of 20 MB each) for Analyze tasks and for any task's memo. Attachments are stored in the submission bundle, carry the PRD-02 educational-use notice on download, are visible in the review screen beside the related answer fields, and are graded only through manual or instructor-confirmed criteria in MVP; automated reading of attachments is a later option.

**Why:** The MVP course's L1.7 outcome (verify software against hand calculations) needs a place for the hand work, but AI reading of handwritten calculations is out of MVP scope and must not silently influence scores.

**Acceptance:**
- Upload enforces type, size and count limits with actionable errors; files are virus-scanned before storage
- A task that requires an attachment blocks submission without one; an optional attachment never affects auto-scored criteria
- Reviewers open attachments inline next to the answer-field comparison table
- Attachments are included in the learner's data export and excluded from any LLM prompt

### GAP3-DLV-08 Check: structured findings report form and limit-state catalog

Check tasks lock the given design and require a findings report captured in a 'Findings' panel: one entry per (member, limit state) with member picker (click in 3D or choose from a list), limit state chosen from the checks-library catalog filtered by the task's code pack and the member's section family, verdict pass/fail, demand and capacity as unit-aware values, auto-computed ratio, governing combination (when the author requires it), clause reference chosen from the clause library (XPL-03) with paraphrased titles, and a short reason (max 60 words). Entry-level validation flags internal inconsistencies (verdict pass with demand above capacity, clause not applicable to the limit state) and the author defines the required scope: every member's governing limit state, every applicable limit state, or an explicit list. The assistance profile hides utilization and code-check overlays by default for Check tasks so the learner performs the check from the analysis results and the given-data sheet.

**Why:** Check is the archetype for the code-based design outcomes (L2.3-L2.8) and for professional plan-check practice; a structured form is what makes it deterministically gradable while the clause and reason fields keep the code-navigation skill in the deliverable.

**Acceptance:**
- MVP limit-state catalog covers AISC 360-22 tension yielding/rupture, compression flexural buckling, flexure yielding and LTB, flange local buckling, shear, combined H1, slenderness advisories, deflection and drift, each mapped to a clause library id
- Required-scope coverage is shown live (for example 'B2: deflection check missing'); rows can be sorted, duplicated and imported from CSV with a documented column layout
- Publishing a Check task with code-check overlays enabled requires an explicit author override with a reason recorded on the task version
- The panel is keyboard-operable with list-based member selection and is included in the submission checklist

### GAP3-DLV-09 Check: per-seed check key and grading with credit, false-positive and miss penalties

At assignment time the server runs the pinned checks library on the learner's instance of the given design and stores the hidden key: for every (member, limit state) in the required scope the verdict, demand, capacity, ratio, governing combination and clause id. Grading matches learner entries to the key by (member, limit state): per matched entry, verdict correctness earns 50 percent of the entry credit, demand and capacity within 3 percent earn 15 percent each (ratio within 0.03 accepted as equivalent), a correct or equivalent clause earns 10 percent, and the reason is judged (hybrid, LLM grounded in the key evidence) for 10 percent on failing entries only. Entries in scope but absent are misses (no credit), reported failures that pass in the key are false positives (minus 50 percent of one entry credit each, capped at 20 percent of the criterion), and a pass verdict on a member that fails in the key is an unsafe approval (minus 100 percent of one entry credit); an unsafe approval of the governing failing member applies the GRD-03 Major cap of 75 percent. Out-of-scope entries are ignored unless the author enables strict scope.

**Why:** Credit for correct findings with asymmetric penalties mirrors real plan review, where approving a failing member is far worse than flagging a passing one, and tying the key to the learner's seed keeps the task copy-proof.

**Acceptance:**
- Golden fixtures: complete correct report scores 100 on code_check_reporting; report with one false positive and one miss on a 10-entry scope scores within +/-2 of the documented formula; a pass verdict on the governing failing member triggers the 75 percent cap with a visible gate reason
- Key generation for the same seed and artifact is hash-identical; a key is never computed from client-reported results
- Numeric comparisons use the key's SI values; clause equivalence sets from the clause library are honored
- Judged reasons are limited to failing entries (max 40 per grade) and pass the LLM-02 grounding validator; a judged-stage outage leaves reason credit pending without failing the job

### GAP3-DLV-10 Diagnose: author-facing seeded-error catalog

The platform ships a versioned seeded-error catalog whose entries mirror the ERR-01..ERR-08 detectors and the common-mistake tag taxonomy: each entry has an id, learner-facing category (supports; geometry and connectivity; releases and member type; loads; load cases and combinations; materials; sections and orientation; design attributes; units), an injection op template expressed in the SIM-SCH-02 op protocol, a semantic target selector (by label, group, role or predicate such as 'a diagonal brace'), parameter ranges (for example unit factors 12, 25.4, 47.88, 1000), the expected-fix predicate (inverse op or an accepted set such as 'any section from the allow-list between the same nodes'), a detectability signal, a difficulty tier and a learner-facing explanation template. Authors compose a task's error pool from catalog entries, set the number of errors per learner (1-3) and may add task-specific entries using the same schema.

**Why:** Diagnose tasks are only authorable at scale if errors are reusable, typed data that the injector, the self-check, the grader and the feedback templates all understand; mapping them to the existing detectors keeps one taxonomy across archetypes and analytics.

**Acceptance:**
- MVP catalog contains at least the 16 entries listed in domain notes, each with a fixture proving the injection op applies to a template model and that the expected-fix predicate accepts the inverse op
- Catalog entries are versioned and pinned per task version (DM- pin set); editing an entry creates a new catalog version
- Author UI shows for each pool entry the target candidates resolved on the clean reference and previews the injected model
- Learner-facing category names and explanation templates exist for every entry and contain no verbatim code text

### GAP3-DLV-11 Diagnose: deterministic per-seed injection, lock scope and calibration detectability

At assignment time the seed selects which pool entries, targets and parameters apply, the server instantiates the clean reference for the learner's instance, applies the injection ops to produce the learner's starter model, and stores the hidden InjectedErrorSet (entries, target ids, parameters, inverse ops, clean modelHash and clean resultHash). The author chooses a lock scope: scope-locked (only entity classes and fields that appear in the pool are editable; default for T1-T2) or open (everything editable, collateral penalties apply). The calibration run verifies for every sampled seed that each injected error is individually detectable (changes at least one graded quantity by 5 percent or more, or triggers a validation/engine finding or a check-verdict flip), that errors do not mask each other when combined, and that the injected model is schema-valid; failing seeds or entry combinations block publish.

**Why:** Randomized, reproducible injection is what prevents answer sharing across learners, and detectability checks prevent the unfair case where a seeded error has no observable effect for a given variant.

**Acceptance:**
- Same (task version, learner, attempt scope) yields the identical injected starter on client and server; different learners receive different error sets or targets for pools with at least 4 entries
- A learner payload that modifies a locked field in scope-locked mode is rejected server-side (CAT-04) with the field named
- Calibration report lists per seed each injected error with its detectability delta and masking status; a masked pair is excluded from the pool or blocks publish
- The clean reference, inverse ops and error set never appear in any learner-facing payload before the reveal policy allows

### GAP3-DLV-12 Diagnose: found-errors list and change review in the workspace

A 'Found errors' panel lets the learner add entries with an entity reference (pick in 3D or from a list), a category from the learner-facing enum, a one- or two-sentence description, and an automatically derived status (fixed: the referenced entity differs from the starter; not fixed). A 'Changes since start' view lists every entity the learner modified relative to the injected starter, marks entries not referenced by any finding as unreported changes, and offers one-click revert per change. When the learner edits an entity not yet in the list, the workspace suggests adding it. The brief states the number of seeded errors or a range, per author setting.

**Why:** The explicit list is the communication deliverable that separates diagnosis from guesswork, and the change review gives learners the tool to avoid collateral edits before the grader penalizes them.

**Acceptance:**
- Adding, editing and deleting entries works with keyboard only; entity references resolve by label or coordinates and show 'entity no longer exists' if deleted
- Status 'fixed' updates within 200 ms of a model edit; the changes view reflects the diff against the stored starter, not the clean reference
- Revert restores the starter state of that entity as a single undo step
- Entries and their timestamps are stored in the submission bundle and in the draft timeline used by INTEG- process evidence

### GAP3-DLV-13 Diagnose: grading of found, fixed and collateral changes

The grader scores each seeded error separately for detection and correction. Detection is 1.0 when a finding references the seeded entity with the correct category, 0.5 for the correct entity with a wrong category, else 0; correction is 1.0 when the submitted model satisfies the expected-fix predicate for that error, 0.3 when the right entity and field changed but the value is outside tolerance, else 0. Findings that reference no seeded entity are false findings (minus 0.2 of one error's detection credit each, capped at 0.6 total) and changed entities outside the union of expected-fix entities are collateral changes (minus 0.1 of one error's correction credit each when they alter physical fields, capped at 0.3; zero in scope-locked tasks). The fixed model is additionally validated and re-analyzed; the model_validity criterion scores from the validation outcome and a fidelity check that the fixed model's results match the clean reference within GRD-01 tolerances for errors whose fix is exact.

**Why:** CAT-03 requires detection and correct fix to be scored separately, and collateral penalties stop the degenerate strategy of rebuilding the model from scratch instead of diagnosing it.

**Acceptance:**
- Fixtures: all found and fixed scores 100 on diagnosis; found-not-fixed scores detection only; fixed-not-reported scores correction only; a rebuilt model in open mode shows collateral penalties at the cap
- Per-error outcomes are emitted as GradeEvidence records with the learner-facing explanation template and highlight ids
- Formula constants (0.5, 0.3, 0.2, 0.1, caps) are rubric parameters with documented defaults and are covered by unit tests
- A learner's fix that is physically equivalent but not the inverse op (for example a heavier allowed section for a removed brace) earns full correction credit when the predicate allows it

### GAP3-DLV-14 Design/Optimize: canonical memo sections, word bounds, attachments and verified required snapshots

Design and Optimize tasks use the canonical memo section catalog (domain notes): Design defaults to system and load path; assumptions and scenario interpretation; loads and governing combinations; governing members and what controlled; section selection and serviceability; constructability; verification or hand check; limitations and what I would change, with a default total bound of 400-1,200 words; Optimize adds an economy and trade-offs section (iterations tried, benchmark reasoning, Pareto trade-offs) with 500-1,500 words. The five LLM-03 judged sub-criteria map onto these sections as documented, and the memo's claims are verified against evidence as already specified. Required snapshots (CAP-01) are specified as {title, overlay type, case or combination, optional view preset} and are verified from the snapshot's view-state sidecar, not by image analysis; a calculation PDF remains optional unless the author requires it.

**Why:** Three domains describe the memo with different section lists and level scales; one catalog with explicit bounds and a verifiable snapshot requirement removes the ambiguity before the memo editor and the judge prompts are built.

**Acceptance:**
- Publish validation rejects a Design or Optimize task whose memo configuration omits the system/load path, governing, and verification sections unless the author records an override reason
- A snapshot captured with a different combination than required is marked unmet in the submission checklist with the expected and actual combination labels
- Total and per-section word bounds are enforced on submit (soft bound warns, hard bound blocks) and reported as evidence
- The memo JSON passed to the judge contains section ids so judged sub-criteria cite sections, and the 1,500-word LLM-03 cap is honored by default bounds

### GAP3-DLV-15 Rubric activation and partial credit per archetype

The rubric category enum adopted by the critic (STR GRD-02 list) is extended with analysis_accuracy, code_check_reporting and diagnosis, and each archetype has a default activation matrix with weights summing to 100 (domain notes): Analyze activates analysis_accuracy 60, model_validity_stability 15, loads_combinations 15, engineering_judgment 10; Check activates code_check_reporting 70, loads_combinations 10, engineering_judgment 20; Diagnose activates diagnosis 75, model_validity_stability 10, engineering_judgment 15; Design and Optimize keep the GRD-02 design categories with the memo weight unified at 15 and Optimize raising economy to 35 behind the OPT-01 feasibility gate. Inactive categories are hidden in the rubric builder and in learner views, partial credit follows the per-archetype formulas in domain notes, and GRD-03 gates apply only to the categories active for the archetype.

**Why:** CAT-03 makes the archetype the switch for active rubric categories but no document says which categories or weights; without this matrix the rubric builder, aggregation and analytics have nothing to switch on.

**Acceptance:**
- Rubric templates exist for all five archetypes and pass the RUB-01 schema with weights summing to 100
- Creating an Analyze task from a template yields economy, strength, serviceability and constructability criteria absent (not zero-weighted) and the learner-facing rubric shows only active criteria
- Unit tests cover each archetype's partial-credit formula and the gate list applied per archetype
- Changing an archetype on a draft task re-applies the matrix and warns about criteria that will be dropped

### GAP3-DLV-16 Pre-submission self-check per archetype

The PER-02 self-check runs the client checks library (advisory; identical artifact to the server) and the deliverable validators, and reports archetype-specific items without revealing the key unless the disclosure level allows: Analyze shows field completeness, dimension validity, plausibility warnings, model validity and equilibrium; Check shows scope coverage, entry consistency, clause applicability and that the model is unchanged; Diagnose shows fixed-model validity, findings-entry validity, unreported changes and (at level 2 or above) the count of correctly found errors; Design/Optimize keep the full deterministic evidence set (validity, stability, combinations, constraints, code checks, cost versus budget with the benchmark hidden) plus deliverable completeness. Results use the GradeEvidence schema so the final grade's deterministic evidence is identical to what the self-check showed for the same model and artifact.

**Why:** The product promise is 'know I am right before I submit'; a self-check that is specific to the archetype and provably consistent with the grader is what delivers it without leaking answer keys.

**Acceptance:**
- For every MVP template, self-check evidence on the submitted model equals the server's deterministic evidence (hash equality) when artifacts match
- Self-check never includes reference values, the check key or the injected error list in its payload at disclosure levels 0-2; at levels 3-4 only per-item pass/fail and hint tiers are included
- Author settings unlimited / N per task / off are enforced server-side and the remaining count is visible to the learner
- Self-check latency stays within the task tier's analysis budget plus 500 ms

### GAP3-DLV-17 Assistance and disclosure profile: coach versus exam, and who controls it

Each task carries one assistance-and-disclosure profile: live_results (full, deformed_only, none), code_check_overlays (full, none), self_check (mode and cap) and self_check_disclosure level 0-4 (none; completeness only; counts such as '2 of 5 within tolerance'; per-item pass/fail; per-item plus graduated hint tiers category > entity > clause per GRD-04), hints on/off (TB-12 tiers), fill_from_results on/off, benchmark_visible (never, after submission, before), and reveal timing for reference values, check key, seeded errors and reference solution (never, after release, after due date, after attempts exhausted). Presets are coach (formative default), summative (completeness and counts only, hints off, reveal after due date) and exam (level 0, no live code checks, no hints) which the INTEG- lockdown profile extends with session and time controls. Institution admins set defaults and caps per task type, authors choose per task within the caps, instructors may only tighten per offering, and the effective profile is shown to learners in the brief as 'What help is available'.

**Why:** Four documents each sketch part of coach versus exam behavior and the structural domain's open question on who controls it is unanswered; one profile with a clear control hierarchy is required before UI, authoring and integrity work can proceed.

**Acceptance:**
- Publish validation blocks a profile outside institution caps and names the violating field; an instructor attempt to loosen a profile per offering is rejected
- Switching a task to the exam preset hides utilization color maps, code-check panels, hints and self-check within one render and the effective profile is recorded on each submission (INTEG- verification)
- The learner-facing brief renders the effective profile; changing it mid-offering is a grading-affecting change under VP-03
- Analytics record disclosure level and hint usage per attempt (TB-12)

### GAP3-DLV-18 Reveal policy versus attempt policy consistency

When a task reveals reference values, the check key or the seeded error set after release and attempts remain, the publish gate requires one of: re-seed per attempt (new instance and new hidden references, author opt-in per SCN-02), withhold the reveal until attempts are exhausted or the due date passes, or reduce attempts to one. Resubmissions after a reveal that is still withheld show deterministic evidence only. Design and Optimize follow the same rule for reference-solution reveal (TB-07).

**Why:** Revealing the key while resubmission is open turns Analyze, Check and Diagnose into copy exercises; the conflict must be caught at authoring time, not discovered by a pilot instructor.

**Acceptance:**
- A task with reveal 'after release', 3 attempts and no re-seeding fails the VP-02 validation gate with a message offering the three remedies
- With re-seed per attempt enabled, attempt 2 receives a new instance whose hidden references differ and the gradebook target policy (best/last) still applies
- Reveal timing is evaluated server-side; a learner API request for reference values before the allowed time returns 403

### GAP3-DLV-19 Structured memo editor with sections, prompts, bounds, equations, images and autosave

The memo deliverable is captured in a structured editor whose sections come from the task's memo configuration: each section shows its prompt, required concepts hint, and live word count against per-section and total bounds; content supports paragraphs, bullet lists, inline and display LaTeX (same renderer as LB-01), simple tables, and figures inserted from workspace snapshots or uploaded images with captions and alt text. Drafts autosave locally within 2 seconds of the last change and to the server with the submission draft (SUB-02), recover after crash or reload, and the memo is stored as structured JSON (section id, blocks) that renders to HTML and to a PDF carrying the PRD-02 notice. A plain-text fallback mode and full keyboard operation are required.

**Why:** Judged sub-criteria cite sections, claim verification needs section-scoped text, and instructors expect engineering memos with equations and figures rather than a single textarea.

**Acceptance:**
- Autosave within 2 s locally and within 30 s to the server; a forced reload loses at most the last 2 s of typing
- Word bounds are computed identically on client and server (same tokenizer) and LaTeX, captions and tables are excluded from the count
- Memo JSON validates against the deliverable schema; the judge prompt receives section ids with text only (images replaced by their alt text and captions)
- Editor meets WCAG 2.2 AA; a screen-reader user can complete all sections using the plain-text mode

### GAP3-DLV-20 Memo integrity provenance, language and PII handling

The memo editor records paste events (timestamp, character count, section, a salted hash of the pasted text and a source class: within-Bridle, external, unknown) and bulk-insert events into the draft timeline consumed by the INTEG- process-evidence and similarity review; the learner is told what is collected, and provenance never changes a score automatically. MVP memos are English-only unless the author allows other languages; the LLM-05 screening call detects language and non-allowed languages are routed to instructor review rather than scored. Names, emails, student ids and institution names are scrubbed from memo text before any model call (SEC-02) with the scrub log stored on the grade.

**Why:** Universities will ask how AI-written memos are handled at the first contested grade; capturing provenance without automatic penalties and keeping the language policy explicit are the defensible positions, and PII scrubbing is already mandated upstream.

**Acceptance:**
- Pasting 300 words into a section produces one paste event with count, section id and hash; typed text produces none
- A memo in a non-allowed language yields judged criteria in needs_review state with the detected language shown to the instructor and never a 0 score
- Automated test asserts zero PII patterns in the assembled judge prompt for the memo fixtures
- Learner-facing disclosure text about collected provenance is shown in the editor and in the task brief

### GAP3-DLV-21 Instructor review and entry-level adjudication per archetype

The review screen (REV-01, PER-07) renders an archetype-specific comparison: Analyze shows per field the submitted, reference and own-model values with the classification; Check shows the key-versus-report matrix with misses, false positives and unsafe approvals; Diagnose shows seeded errors with found/fixed status, the model diff and collateral changes; Design/Optimize show the existing evidence and memo claim verdicts. Reviewers can adjudicate at entry level with a mandatory reason: accept an answer or finding as correct, accept an alternative clause, or waive a false-positive or collateral penalty; adjudications recompute the criterion through AGG-01, are audited (REV-04) and feed the calibration set (CAL-02). Propagating an accepted alternative clause into the task version's equivalence set with a regrade offer for other submissions is a v1.x addition.

**Why:** With 100 percent human review in MVP, instructors will immediately hit alternative clause citations and borderline tolerances; entry-level adjudication keeps those decisions consistent, cheap and auditable instead of forcing whole-criterion overrides.

**Acceptance:**
- Each archetype's review layout loads with the same evidence ids shown to the learner and highlights the entity in the 3D viewer on row selection
- An entry-level accept changes only the affected entry's credit, recomputes the criterion and total from stored rows, and creates an audit event with before/after and reason
- Reviewer median time per Analyze or Check submission is measurable (MET-03) and the layout exposes bulk-accept only for unflagged submissions
- Adjudications are exported in the course audit CSV

### GAP3-DLV-22 Learner feedback views per archetype after release

After release the learner's feedback view extends XPL-01/XPL-02 per archetype: Analyze shows a per-field table (submitted, own-model value, reference when the reveal policy allows, status and a plain-language diagnosis such as 'your support at A is a roller; the reference has a pin') with 3D highlighting and the governing case; Check shows each entry's verdict against the key, the key's demand, capacity and clause for revealed entries, misses with their evidence records, and the gate reason if an unsafe approval capped the score; Diagnose lists each seeded error with its explanation template, found/fixed/missed status, the learner's fix assessment, collateral changes, and an animated mechanism where applicable; Design/Optimize keep the existing views plus memo claim verdicts by section. Everything shown traces to evidence ids and respects the reveal timing of the profile.

**Why:** Feedback is the learning value of the product; archetype-specific views turn deterministic evidence into the explanation a learner needs to fix a modeling habit rather than a number.

**Acceptance:**
- Before the reveal time the Analyze view shows status and diagnosis but not the reference value; after it, the reference appears without a regrade
- Clicking any row focuses the entity and switches to the governing combination (RES-08)
- Every number displayed exists in an evidence record of that grade (automated check on fixtures)
- Views are keyboard-navigable lists with screen-reader text for status

### GAP3-DLV-23 Deliverable golden fixtures and harness coverage per archetype

Every MVP Analyze, Check and Diagnose template ships fixtures for the offline harness (EVAL-01/02): oracle deliverables (expected 95 or more), null (0), and at least two flawed variants per archetype (Analyze: unit-error and modeling-error answers; Check: false-positive report and unsafe approval; Diagnose: found-not-fixed and rebuilt model with collateral changes), plus memo variants where a memo is judged. CI runs them on every change to the checks library, seed engine, deliverable schemas or grading formulas and fails on any score delta beyond 2 points.

**Why:** The new deliverable kinds add three grading paths; without archetype fixtures a change to tolerances or penalties would be an uncontrolled experiment on real cohorts.

**Acceptance:**
- Fixture set exists per template and is versioned with the template
- Harness report includes per-archetype agreement metrics once instructor adjudications exist
- A tolerance or penalty constant change without updated fixtures fails CI

## Non-functional targets

| id | title | target |
|---|---|---|
| NF-GAP3-01 | Comparison determinism | All answer, finding and fix comparisons are performed in SI with documented rounding; identical inputs yield identical classifications 100 percent of the time across client preview, server grading and regrade; a 10,000-case boundary property test shows zero client/server flips |
| NF-GAP3-02 | Per-instance reference generation latency | ReferenceAnswerSet, check key or InjectedErrorSet generated at assignment time within 2 s p95 for Tier S models (up to 300 DOF) and 5 s p95 for Tier M; 20-seed calibration for these archetypes within 2 min (Tier S) and 10 min (Tier M), asynchronous and resumable |
| NF-GAP3-03 | Capture UI responsiveness | Unit/dimension validation under 50 ms per keystroke; entity pick-to-field binding under 100 ms; findings table with 200 rows renders under 300 ms; Diagnose change-review refresh under 200 ms after an edit |
| NF-GAP3-04 | Memo and deliverable autosave | Local autosave within 2 s of last change, server within 30 s; crash recovery loses at most 2 s of memo text and no structured entries; 100 percent recovery in the crash test suite |
| NF-GAP3-05 | Deliverable size limits | Memo total 1,500 words default (author-adjustable up to 3,000) and 20 figures; attachments 3 files of 20 MB each (PDF/PNG/JPG); answer fields up to 40 per task; findings up to 200 entries; found errors up to 10; required snapshots up to 10; bundle for Tier M stays under 5 MB excluding attachments |
| NF-GAP3-06 | Grading latency budget for new deliverables | Deliverable grading adds no more than 500 ms to the deterministic stage (AIG NFR-01 preserved); judged reasons for Check and Diagnose fit the existing per-grade budget (max 3 model calls, 25k input tokens) by judging at most 40 failing entries in one call |
| NF-GAP3-07 | Self-check parity with the grader | Client self-check evidence equals server deterministic evidence (hash equality) for 100 percent of CI fixtures when engine and checks artifacts match |
| NF-GAP3-08 | Accessibility of capture UIs | Answer, findings, found-errors panels and the memo editor meet WCAG 2.2 AA; axe reports zero serious or critical issues; a keyboard-only tester completes one task of each archetype end to end |
| NF-GAP3-09 | Fixture coverage | Every MVP Analyze/Check/Diagnose template ships oracle, null and at least two flawed deliverable fixtures; harness fails on any score delta beyond 2 points |

## Domain notes (for architecture and UX)

1. DELIVERABLE SCHEMA (contracts package, deliverables.schema.json v1)
Submission.deliverables = { model: {modelHash}, answers?: [{fieldId, valueSI: number, dimension, sense?: 'T'|'C', enteredUnit, enteredValue}], findings?: [{entryId, memberRef: {label|coords}, limitState, verdict: 'pass'|'fail', demandSI, capacitySI, ratio, governingComboId?, clauseLibraryId?, reason}], foundErrors?: [{entryId, entityRef, category, description, status: 'fixed'|'not_fixed', createdAt}], memo?: {configVersion, sections: [{sectionId, blocks: [{type: 'p'|'ul'|'math'|'table'|'figure', text?|latex?|rows?|snapshotId?, alt?, caption?}], wordCount}], totalWords, provenance: {pasteEvents: [{ts, sectionId, chars, hash, source}], bulkInserts: n}}, attachments?: [{id, kind: 'calc_pdf'|'image', sha256, bytes, mime}], snapshots?: [{reqId, imageRef, sidecar: {overlay, caseOrComboId, viewPreset, camera}}], pledge: {textVersion, acceptedAt} }. Canonical form: SI values rounded to the DM- quanta (1e-3 N, 1e-6 m, 1e-3 N·m), entries sorted by id, no UI state, JCS then SHA-256 per deliverable; deliverableHashes stored on the submission version and on every grade (DM- pin set).

2. ANALYZE ANSWER-FIELD QUERY DSL AND STATUSES
AnswerField = {id, label, prompt, query: {kind: 'reaction'|'memberForce'|'displacement'|'relativeDeflection', entity: {label|coords+tol}, component: Fx|Fy|Fz|Mx|My|Mz | N|V2|V3|T|M2|M3 | ux|uy|uz|rx|ry|rz, where: 'i'|'j'|{x: m}|'max'|'min'|'absmax', caseOrComboId}, dimension: force|moment|length|stress|dimensionless, convention: enum (reaction_up_positive, tension_positive, sagging_positive, ccw_positive, magnitude_only, magnitude_plus_sense), compare: 'signed'|'magnitude'|'magnitude_sense', tol: {rel, abs}, weight}. Convention mapping to engine axes lives in the query evaluator (global components for reactions; local M3 for major-axis bending with sign flip for sagging_positive; Z-up, XZ plane in 2D per the DM- decision). Statuses: correct, sign_error, unit_error (ratio to a fingerprint in {1000, 1/1000, 12, 1/12, 25.4, 1/25.4, 47.88, 4.448, 0.2248, 9.80665} within 1 percent), modeling_error, transcription_error, unresolved_entity, dimension_mismatch, missing. Field credit: 1.0 within tol; 0.5 within 2*tol or sign_error under signed compare; else 0. Defaults: reactions rel 2%, forces rel 2%, deflections rel 3%, abs floors 0.05 kN, 0.1 kN·m, 0.1 mm; UI asks for at least 3 significant figures. Analyze model modes: given-locked (geometry given, learner adds supports/loads/releases/sections) or build-from-brief (fidelity scored by semantic matching to the reference: supports, load cases and magnitudes, member connectivity, within GL-02 tolerances).

3. CHECK FINDINGS: LIMIT-STATE CATALOG (MVP, US pack) AND SCORING
Limit states (id -> clause library key): T-YIELD (AISC 360-22 D2(a)), T-RUPTURE (D2(b)), C-FB (E3), C-FTB (E4), F-YIELD (F2.1), F-LTB (F2.2), F-FLB (F3), V (G2.1), H1 (H1-1a/b), SLEND-C advisory (E2 user note Lc/r<=200), SLEND-T advisory (D1 L/r<=300), DEFL (IBC 2024 1604.3 or task limit), DRIFT (ASCE 7-22 12.12.1 or task wind drift), CLASS (B4.1 compactness, informational). Checks library emits per (member, limit state): verdict, demand, capacity, ratio, governing combo, station, clause id; the key is the subset in the required scope. Scope modes: governing_per_member (default T3), all_applicable, explicit_list. Entry credit split: verdict 0.50, demand 0.15, capacity 0.15, clause 0.10, reason 0.10 (judged, failing entries only; passing entries get reason credit automatically when verdict and numbers are right). Numeric tolerance 3 percent (ratio 0.03). Scoring: code_check_reporting = clamp((sum of entry credits - 0.5*FP - 1.0*UA)/|scope|, 0, 1)*100 where FP = reported fail that passes in key (penalty capped at 0.2*|scope|), UA = reported pass that fails in key; UA on the governing failing member -> GRD-03 Major cap 75 (author-adjustable). Out-of-scope entries ignored unless strict. Clause equivalence sets come from the clause library (for example F2-1 and F2.1 notation variants; LTB cited as F2.2 or F2-2/F2-3).

4. DIAGNOSE SEEDED-ERROR CATALOG (MVP 16 entries)
Format: id | category | injection op (SIM-SCH-02) | target selector | params | expected-fix predicate | detect signal | tier.
SE-SUP-01 | supports | update support dof | support by label/role | pin->roller or fixed->pin | dof set equals clean | reactions/deflection change, mechanism | T1
SE-SUP-02 | supports | delete support | one support | - | support restored (any equivalent dof set that removes the mechanism and matches brief) | ENG-SINGULAR | T1
SE-SUP-03 | supports | update support dof (over-restraint) | roller end of SS beam or thermal member | roller->pin | dof set equals clean | reaction/axial force appears | T2
SE-GEO-01 | geometry/connectivity | split member + offset node | interior node | offset 2-5 mm | node merged (coords within merge tol) | ENG-SINGULAR or hinge | T2
SE-GEO-02 | geometry/connectivity | delete member | diagonal brace or chord by role | - | member between same nodes with allowed section | mechanism or deflection > 5 percent | T2
SE-GEO-03 | geometry/connectivity | update node coord | span node | +/-5-10 percent of span | coord within 1e-3 m of clean | forces > 5 percent | T1
SE-REL-01 | releases/member type | update releases | continuous member end | add moment release | releases equal clean | M diagram change | T2
SE-REL-02 | releases/member type | update member type | one member | frame->truss or truss->frame | type equals clean | bending/axial change | T2
SE-LOD-01 | loads | scale load | distributed or point load | factor in {12, 25.4, 47.88, 1000, 1/1000} | magnitude within 1 percent of clean | implausible magnitude, forces | T1
SE-LOD-02 | loads | flip load direction | gravity load | sign | direction equals clean | deflection sign | T1
SE-LOD-03 | loads | move load to another case/member/story | live load | target | load on clean target in clean case | combination results | T2
SE-LOD-04 | load cases and combinations | delete load case | roof live/snow/wind case named in brief | - | case present with brief magnitude within 2 percent | missing case diff (ERR-03) | T2
SE-LOD-05 | loads | disable self-weight | dead case | - | selfWeight enabled with factor 1 | D < self-weight (ERR-05) | T2
SE-CMB-01 | load cases and combinations | update combination factors | one combination | 1.6W, missing 0.5Lr, missing 0.9D+1.0W | factors equal pack set within 0.01 | combination diff | T3
SE-MAT-01 | materials | update material property | steel E or density | E/1000, rho=0 | property within catalog band and equals clean within 1 percent | deflection or self-weight | T1
SE-SEC-01 | sections and orientation | update section or beta | one member | lighter section or beta 90 | section equals clean or any allowed section not lighter; beta equals clean | utilization/deflection | T2
Also in catalog for T3 content: SE-MAT-02 wrong grade (A36 for W-shapes), SE-DSN-01 wrong Lb/K versus brief bracing (detect via check verdict flip). Detectability rule: individually, any graded quantity changes >= 5 percent, or a validation/engine finding (VAL-*, ENG-*) appears, or a check verdict flips; jointly, each error's signal must persist with all others injected (masking test); injected model must be schema-valid (validation errors allowed and intended). Seed selection: PCG32/xoshiro per TB-11 with domain separation tag 'diagnose'; stores entries, targets, params, inverse ops, clean modelHash/resultHash.

5. RUBRIC ACTIVATION MATRIX (category -> weight; '-' inactive) with gates
Categories: MV model_validity_stability, LC loads_combinations, ST strength, SV serviceability, S2 stability_second_order, CM code_minimums_detailing, EC economy_utilization, CB constructability_rationalization, EJ engineering_judgment, AA analysis_accuracy, CR code_check_reporting, DG diagnosis.
Analyze: AA 60, MV 15, LC 15, EJ 10 (method and verification note; manual or dropped in deterministic-only mode), others '-'. Gates: mechanism in learner model -> MV critical, cap 50; locked-field tampering -> critical.
Check: CR 70, LC 10 (governing combination identification when required), EJ 20 (reasons 10, overall verdict and recommendation 10). Gates: unsafe approval of governing failing member -> cap 75. Model locked, so MV '-'.
Diagnose: DG 75 (detection 35, correction 40), MV 10 (fixed model validates/solves; fidelity to clean within GRD-01 tolerances where fix is exact), EJ 15 (diagnosis narrative). Penalties inside DG per section 4 formulas; gates: tampering with locked fields -> critical.
Design: MV 10, LC 15, ST 25, SV 10, S2 5, CM 5, EC 10, CB 5, EJ 15 (GRD-02 base with judgment unified at 15; see open question). Gates per GRD-03.
Optimize: MV 5, LC 10, ST 15, SV 5, S2 5, CM '-', EC 35 (OPT-01 feasibility gate -> 0 when any must-pass check fails), CB 10, EJ 15.
Partial credit: AA per field (section 2); CR per entry (section 3); DG per error: detection d in {1, 0.5, 0}, correction c in {1, 0.3, 0}, detection score = clamp((sum d - 0.2*falseFindings)/N, 0, 1) with false-finding penalty capped at 0.6, correction score = clamp((sum c - 0.1*collateral)/N, 0, 1) with collateral penalty capped at 0.3 (0 in scope-locked mode); ST/SV/S2 per GRD-03 severities and RUB-02 fraction scaling within the passing region; EJ per LLM-03 level map {0:0, 1:40, 2:75, 3:100}.

6. SELF-CHECK MATRIX (what is shown at disclosure levels 1-4; level 0 shows nothing)
Analyze: L1 completeness, dimension validity, plausibility bands, model validity, equilibrium; L2 adds count of fields within tolerance; L3 per-field within/outside; L4 adds hint tier (category: 'support type' > entity > clause/formula reference).
Check: L1 scope coverage, entry consistency, clause applicability, model unchanged; L2 count of verdicts agreeing with key; L3 per-entry agree/disagree; L4 adds hint tier.
Diagnose: L1 fixed-model validity, entry validity, unreported changes; L2 count of correctly found errors; L3 per-entry found-correct flag; L4 adds category hint for a remaining error.
Design/Optimize: L1 validity, stability, combinations present, constraints, deliverable completeness; L2 adds counts of failing checks by category; L3 full deterministic evidence (PER-02 behaviour today) with benchmark hidden; L4 adds TB-12 hints and scaffolding toggles. Self-check runs the client checks artifact; server grading is authoritative; evidence schema identical.

7. ASSISTANCE AND DISCLOSURE PROFILE
profile = {live_results: full|deformed_only|none, code_check_overlays: full|none, self_check: {mode: unlimited|capped|off, cap}, self_check_disclosure: 0-4, hints: on|off, fill_from_results: on|off, benchmark_visible: never|after_submission|before, reveal: {reference_values, check_key, seeded_errors, reference_solution: never|after_release|after_due|after_attempts}}. Presets: coach = {full, full (none for Check), unlimited, 3, on, on, after_submission, after_release}; summative = {full, full (none for Check), capped 3, 2, off, off, after_submission, after_due}; exam = {deformed_only or none per author, none, off, 0, off, off, never, after_due} + INTEG- session/time lockdown. Control: institution policy = defaults and caps per task type (formative/summative/exam), e.g., summative disclosure <= 2 and reveal >= after_due; author sets per task within caps; instructor per offering tighten-only; learner sees effective profile. Publish gate: Check task with code_check_overlays full -> override with reason; reveal/attempt conflict -> block (GAP3-DLV-18); exam preset without INTEG- lockdown -> warning. Effective profile id is pinned on every submission.

8. MEMO SECTION CATALOG AND DEFAULTS (id: prompt gist; default bounds in words)
M-SYS system and load path (60-200); M-ASM assumptions and scenario interpretation: supports, bracing/Lb, K, diaphragm, site parameters used (60-200); M-LOD loads and governing combinations with magnitudes (40-150); M-GOV governing members and what controlled (strength/deflection/drift) with numbers (60-200); M-SEL section selection rationale and serviceability (60-200); M-ECO economy and trade-offs: iterations, benchmark reasoning, Pareto (80-300, Optimize); M-CON constructability and rationalization (40-150); M-VER verification or hand check of one quantity (40-150); M-LIM limitations and what I would change (40-150); M-MET method and verification note (50-250, Analyze); M-FND overall verdict and recommendation (100-400, Check); M-DIA per-error narrative symptom > evidence > fix, scaffolded one block per finding (50-150 each, Diagnose). Defaults: Analyze [M-MET]; Check [M-FND, M-ASM optional]; Diagnose [M-DIA, M-VER]; Design [M-SYS, M-ASM, M-LOD, M-GOV, M-SEL, M-CON, M-VER, M-LIM] total 400-1,200; Optimize = Design + M-ECO, total 500-1,500. Judged sub-criteria (LLM-03) mapping: load path and system <- M-SYS; assumptions and scenario <- M-ASM (+M-LOD); governing combination and critical members <- M-GOV (+M-SEL); verification <- M-VER (M-MET for Analyze); limitations <- M-LIM. Check and Diagnose memos are judged with reduced sub-criteria sets (verdict quality; diagnosis narrative) on the formative route unless the task is summative. Level scale is the RUB-01/LLM-03 0-3 enum (the structural QUAL-05 0-4 scale is retired). Editor: section cards with prompt, live count, LaTeX (KaTeX-compatible), figures from CAP-01 snapshots, tables; stored as JSON; rendered HTML/PDF with PRD-02 notice; paste provenance as in section 1.

9. REFERENCE GENERATION PER SEED AND CALIBRATION CHECKS
Analyze: instance -> parametric reference -> engine (pinned artifact) -> evaluate answer queries -> ReferenceAnswerSet {taskVersion, instanceHash, engineArtifactHash, checksVersion, fields[], resultHash}. Calibration (PV-02 extension): all seeds finite, well-conditioned (ENG-ILL-CONDITIONED absent), no degenerate fields (|ref| >= 10*abs tol), reference model passes validation.
Check: instance -> given design instantiated (sections/loads may be chosen per seed from author sets so some seeds fail specific members) -> checks library -> key. Calibration: each seed has at least one failing limit state unless the author marks 'all-pass variants allowed'; scope size within limits; governing failing member identified per seed.
Diagnose: instance -> clean reference -> seed picks errors/targets/params -> injected starter + InjectedErrorSet. Calibration: detectability and masking per section 4; starter schema-valid; expected-fix predicates satisfiable by the inverse ops.
Design/Optimize: unchanged (author references plus auto-sized reference per seed at calibration; benchmark hidden). All hidden sets are stored with the scenario instance, pinned in the DM- pin set, and regenerated only when the task version changes.

10. UI PLACEMENT, REVIEW LAYOUTS AND CROSS-REFERENCES
Workspace right rail hosts a 'Deliverables' dock with tabs per archetype (Report values / Findings / Found errors / Memo / Snapshots) and the submission checklist; the task page mirrors the dock for non-canvas access. Review screen: left 3D viewer with evidence highlighting, center archetype comparison table, right criteria with entry-level adjudication actions. Cross-references: STR CAT-03/CAT-04/GRD-01..05/ERR-01..08/QUAL-05; AIG RUB-01/RUB-02/CHK-05/LLM-02/LLM-03/LLM-05/SEC-01/SEC-02/REV-01..04/CAL-02/EVAL-01/02/OPT-01; AUT TB-06/TB-07/TB-11/TB-12/TB-13/PV-02/VP-02/VP-03/GL-02; LMS CRS-03/SUB-01/SUB-02/SCH-02/GRD-03/I18N-02/DAT-04; WS CAP-01/CAP-02/RES-07/RES-08/DET-01/A11Y-01; SIM SCH-01/SCH-02/VAL-01/DET-01; PRD PER-02/PRD-02/MET-03; gaps DM- (pin set, canonicalization), INTEG- (lockdown, process evidence, similarity), LEG- (export notices, no verbatim clause text). Proposed implementation paths (stack-agnostic): packages/contracts/deliverables.schema.json and memo-config.schema.json; packages/contracts/canonicalize/deliverables.ts; services/grading/rules/deliverables/{analyze_answers, check_findings, diagnose_errors}.ts; services/grading/scenario/reference_sets.ts (ReferenceAnswerSet, CheckKey, InjectedErrorSet); content/seeded-errors/catalog.v1.json; apps/web/src/workspace/deliverables/{AnswerPanel, FindingsPanel, FoundErrorsPanel, MemoEditor, SubmissionChecklist}; apps/web/src/review/ArchetypeComparison.

## Risks

| risk | mitigation |
|---|---|
| Sign-convention or station ambiguity causes mass false 'wrong' answers on Analyze tasks. | Every field declares a convention and compare mode, the UI states it next to the input, sign-only errors earn half credit, fixtures include each convention, and instructors can bulk-accept by entry. |
| Tolerances misconfigured by authors (too tight for hand rounding or relative tolerance on near-zero values) fail whole cohorts. | Reference-type defaults with absolute floors, calibration rejects degenerate fields, the 3-significant-figure guidance in the UI, and entry-level adjudication plus regrade with a corrected task version. |
| Live utilization overlays leak the Check key or the Analyze engine values defeat hand-calc intent. | Archetype-aware profile defaults (overlays off for Check, live_results configurable for Analyze), publish-gate override with reason, and the effective profile pinned on each submission for integrity verification. |
| Seeded errors are undetectable for some seeds, mask each other, or are trivially revealed by validation messages. | Per-seed detectability and masking checks in calibration, catalog entries tagged with their signal so authors can mix 'silent' and 'loud' errors, and T1 tasks allowed to rely on validation signals by design. |
| Learners rebuild Diagnose models from scratch or copy the brief, bypassing diagnosis. | Scope-locked mode for introductory tasks, collateral penalties in open mode, change-review UI that shows unreported edits, and detection credit tied to explicit findings. |
| Judged free-text reasons per finding entry inflate LLM cost and latency. | Judge only failing entries (cap 40) in one grounded call on the formative route, deterministic credit for verdict/numbers/clause first, and deterministic-only mode for practice tasks. |
| Paste provenance is misread by instructors as proof of misconduct. | Provenance is shown only inside the INTEG- case workflow with explicit 'no automatic inference' labeling, learners are told what is collected, and scores never change automatically. |
| Three new deliverable kinds fragment the pipeline and the pin set. | One deliverable schema package, one canonicalization rule, GradeEvidence records for every outcome, and archetype fixtures in the same harness as Design/Optimize. |

## Open questions

- Does the MVP course include Diagnose tasks (recommended: 2-3 at T1-T2 using the scope-locked mode), or is Diagnose content deferred to v1.1 while the catalog and injector ship with the platform?
- Memo weight for Design/Optimize: GRD-02 says 5, the AI-grading design template says 20, this gap proposes 15 as the unified default; which does the design-partner instructor want for the MVP course?
- Should Analyze fields support hand-calculation 'show the work' credit through AI reading of attachments (vision) in v1.x, or stay manual-only indefinitely?
- Who adjudicates alternative clause citations and tolerance disputes: the course author (task version equivalence set) or the offering instructor (per-submission accept)? Recommended: instructor accepts per entry at MVP, author promotes to equivalence set in v1.x.
- Default sign conventions for learner-reported moments and shears: textbook conventions (sagging positive, reaction upward positive) with engine mapping, as recommended here, or the engine's local-axis convention shown in diagrams?
- Should re-seeding per attempt be the default remedy when reference values are revealed after release (keeps unlimited formative attempts) or should withholding until the due date be the default?
- Is a Check variant where the learner audits the software's utilization output (the L1.7 'verify software' outcome) wanted later, which would require a per-task exception to hiding code-check overlays?
- Which memo languages must be allowed at launch beyond English (Spanish and Filipino are the likely candidates given the launch-geography question), and does the judge route need per-language calibration sets?
- Should false-finding and collateral penalties apply in formative Diagnose tasks at all, or only in summative ones (recommended: on by default, author-toggle)?
