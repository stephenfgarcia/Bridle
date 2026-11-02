# AI grading pipeline against real-world criteria

_Source: requirements discovery workflow `wf_6281c128-0bb` (domain agent), 2026-11-03. 45 requirements: 36 must (MVP), 7 should (v1.x), 2 could (later)._

## Summary

Bridle's grader is a hybrid pipeline: everything computable is computed deterministically on the server (re-analysis of the canonical submission under scenario-derived loads, then code, load-combination, constraint, constructability and efficiency checks that emit one typed evidence record per finding), and the LLM is confined to judging engineering-judgment criteria, the justification memo and the feedback narrative, grounded only in a deterministic evidence digest and post-validated so that no number, clause or evidence reference outside that digest can appear. Scores come from a versioned rubric (weights, scoring functions, gates, thresholds); a confidence score routes low-confidence, near-threshold, refused or injection-flagged grades to instructor review, and overrides, appeals and every model call land in an immutable audit trail stamped with a composite grader_version. Two facts verified against the current Claude API reference change the brief: temperature/top_p/top_k are rejected (400) on all current models, so reproducibility of the judged stage must come from pinned exact model ids, pinned prompts and schemas, enum-valued levels, Bridle's own persistent result cache keyed by content hash, and variance measured in the harness rather than from sampling parameters; and claude-fable-5-1 is unsuitable for the routine grading path (always-on thinking, $10/$50 per MTok, 30-day retention requirement), so routing is claude-haiku-5-5 for screening, claude-sonnet-5-5 for formative judging and claude-opus-5-5 for summative grading and escalation. Structured outputs (output_config.format, additionalProperties false, enums for levels) replace forced tool use and prefill, which are also rejected on these models. Prompt caching with a stable task prefix, per-grade token budgets and the Batches API for regrades and the offline harness keep cost in the $0.05-0.15 per grade range. Scenario parameters are randomized per learner from author-bounded ranges with a stored instance so the grader, efficiency benchmarks and anti-collusion checks all key off the same instance. Optimization tasks are scored by feasibility-gated ratio-to-benchmark functions or Pareto rank, with optional anonymized leaderboards.

## Must (MVP)

### PIPE-01 Asynchronous staged grading job with stage isolation

Every submission creates a grading job that runs the fixed stage sequence intake, re-analysis, rule checks, LLM judgment, aggregation, review routing, persisting each stage's output independently. Stage failures are isolated: if the LLM stage fails or times out, deterministic criteria and evidence are still produced and shown with judged criteria marked pending. Jobs are idempotent: re-running a job for the same snapshot and grader_version returns the stored result.

**Why:** Stage isolation gives fast partial results, graceful degradation during LLM outages, and is the foundation for reproducibility and cost control.

**Acceptance:**
- Job state machine with states queued, analyzing, checking, judging, aggregating, review, released, failed is exposed via API and UI
- An LLM provider outage yields a grade with judged criteria pending and no failed job
- Duplicate job requests for the same snapshot and grader_version return the existing job id

### PIPE-02 Immutable submission snapshot and canonical hash

At submit time the system stores an immutable snapshot of the model, memo, scenario instance, task version and rubric version. The model is canonicalized (sorted keys, SI units, deterministic node/member ordering, numeric rounding at a documented tolerance) and hashed; the hash keys all deterministic caching.

**Why:** Reproducible grading requires a frozen, canonical input; later workspace edits must not change what was graded.

**Acceptance:**
- Re-submitting an unchanged model yields the same canonical hash
- Edits in the workspace after submission do not alter the graded snapshot
- The snapshot can be reloaded in the 3D workspace in read-only mode

### PIPE-03 Server-side deterministic re-analysis with integrity check

The server re-runs the finite element analysis of the canonical model with a pinned solver build, generating loads and combinations itself from the scenario instance and never trusting client-reported results. Analysis failures (mechanism/singular stiffness, non-convergence, unsupported elements, size limits) become structured evidence (status error, severity critical) so the job completes and gates apply. Client-reported results differing from server results beyond tolerance produce a model_integrity evidence record.

**Why:** The client is untrusted; a server re-solve is the only trustworthy source of numbers for grading and prevents result tampering.

**Acceptance:**
- The same snapshot analysed twice on the same solver version gives identical results within 1e-9 relative tolerance
- A model with a mechanism produces a stability evidence record with severity critical and the total is capped by the gate
- Models above configured size limits (default 20,000 DOF) are rejected before queueing with an actionable message

### CHK-01 Code-check evidence for strength, serviceability and stability

The rules stage evaluates every member, plate and support under every required combination and emits evidence with demand, capacity, utilization (DCR), governing combination and location, and a clause reference. MVP code family: ASCE 7-22 loads with AISC 360-22 steel member checks (tension D2, compression E3/E4, flexure F2-F5 including LTB, shear G2, combined H1), serviceability deflection (IBC 2024 Table 1604.3 defaults, task-overridable) and story drift (ASCE 7-22 Table 12.12-1), stability (eigenvalue buckling load factor, second-order amplification, mechanism detection). Non-steel materials get generic elastic stress and deflection checks in MVP; a Eurocode pack (EN 1990/1991/1993) follows.

**Why:** Real-world grading means code-referenced numbers; steel under ASCE/AISC is the most tractable, widely taught starting point.

**Acceptance:**
- Every failing member has an evidence record with value, unit, limit, margin, governing combination and clause id
- Drift checks use the task's allowable drift ratio and the correct story heights
- The check library is versioned and its version is part of grader_version

### CHK-02 Load-combination and scenario-load verification

The server generates the complete required combination set for the task's code family and scenario (ASCE 7-22 section 2.3.1 LRFD basic combinations plus section 2.3.6 seismic; EN 1990 eq. 6.10) and analyses all of them. It also compares the learner-defined load cases, combinations and load magnitudes against the scenario-required ones and emits evidence for missing, extra or mis-factored combinations and for applied loads that deviate from scenario-derived values.

**Why:** Correct load combinations are a core learning objective and a frequent real-world error; grading must detect them explicitly rather than only through their consequences.

**Acceptance:**
- A submission missing 0.9D+1.0W yields a load_combination evidence failure naming the combination
- Scenario-derived wind, snow and seismic loads are compared to learner-applied loads within an author-set tolerance
- Evidence states which combination governs each failing member

### CHK-03 Author-defined task-constraint checks

Authors specify constraints per task using a schema of constraint types: geometry envelope, required spans and clearances, mandatory supports, allowed section catalog and materials, maximum member count, maximum cost or weight, prohibited elements. Each constraint is evaluated deterministically, emits evidence, and can be marked as a gate.

**Why:** Design tasks are only meaningful under constraints; deterministic constraint evidence also prevents trivial solutions from scoring.

**Acceptance:**
- Constraint schema is validated at authoring time with a preview run against the reference design
- Violation evidence names the offending element, the limit and the measured value

### CHK-05 Evidence record schema and deterministic digest

All stages emit GradeEvidence records conforming to a versioned JSON schema (see domain_notes) with stable ids, typed subjects, numeric values with units, limits, margins, governing combinations, clause references, severity and a visual payload. A deterministic digest selects what the LLM sees: all failing and warning records up to a cap, the top-N governing records per check type, summary statistics, and all constraint and memo-related records.

**Why:** The evidence schema is the contract between the deterministic stages, the LLM, the UI and the audit trail; a deterministic digest is what makes grounding and caching possible.

**Acceptance:**
- Schema validation rejects malformed evidence at stage boundaries
- Digest selection is deterministic: identical evidence sets produce byte-identical digests
- Digest size is measured with count_tokens and stays under the configured cap

### RUB-01 Rubric model

A rubric is a versioned set of criteria. Each criterion has id, title, description, weight, kind (auto, judged or hybrid), evidence sources (check types or constraint ids), scoring function (step, banded, linear-margin, fraction-scaled, level-map), level descriptors for judged criteria, gate behaviour (none, cap total at X percent, fail task) and a learner-visible explanation. Rubric-level settings include pass threshold, rounding, audience register and the judged-criteria model route.

**Why:** Separating auto-checked from judged criteria with explicit weights and gates is what lets scores be explainable, reproducible and tunable per course.

**Acceptance:**
- Rubric JSON schema is enforced and weights sum to 100
- Every judged criterion has at least three level descriptors
- Every auto criterion binds to at least one evidence source

### RUB-02 Partial credit, gates and degenerate-policy protection

Scoring functions give partial credit based on margins (default strength banding: max DCR up to 1.00 gives 100 percent, up to 1.05 gives 70, up to 1.10 gives 40, else 0, optionally scaled by the fraction of members passing). Gates cap the total for critical outcomes (instability, constraint violation, integrity mismatch). An empty or trivial submission must score 0 and a missing memo scores 0 on memo criteria.

**Why:** Partial credit reflects engineering reality (small overstress is different from collapse) while gates and null-baseline rules prevent degenerate submissions from scoring.

**Acceptance:**
- Defaults are documented per template and overridable per rubric
- The null-baseline fixture scores 0 and the oracle fixture scores at least 95
- Gate application order is documented and tested

### SCN-01 Scenario and environment parameterization

Each task has a typed scenario with code-family-specific parameters: wind (V, exposure, Kzt, Kd), snow (pg, Ce, Ct, Is), seismic (Ss, S1, site class, R, Ie, Cd), occupancy and roof live loads, temperature range, soil bearing capacity, risk category, plus geometry parameters. The scenario engine derives design loads from these parameters using the formulas in domain_notes; the scenario and derived loads are shown to the learner in the workspace and included in the evidence digest.

**Why:** Grading against a real environment requires loads that are derived from site conditions, not typed in by the author or learner.

**Acceptance:**
- Scenario JSON schema exists with per-code-family parameter sets
- Derived loads are displayed with their formula inputs
- Authors can set each parameter as fixed or ranged

### SCN-02 Per-learner randomized scenario instances (anti-collusion)

For ranged parameters the system generates a per-learner instance with a seed derived from task id, learner pseudonymous id and cohort salt, bounded by author ranges and discrete option sets. The instance is fixed across a learner's attempts unless the author enables re-seeding per attempt, is stored with the submission, and is the only instance the grader uses. Efficiency benchmarks scale with the instance via a parametric reference design or auto-sized reference.

**Why:** Randomized environments make copying another learner's design ineffective while keeping each learner's task stable and reproducible.

**Acceptance:**
- Two learners in the same cohort receive different parameter values for ranged parameters
- Re-grading the same learner uses the identical stored instance
- Author preview shows the reference design's score across 20 sampled instances to expose unfair difficulty variance

### LLM-01 Structured judged-criteria evaluation

For judged and hybrid criteria the judge model receives the rubric criterion and level descriptors, the evidence digest, the scenario summary and the learner memo (as untrusted, delimited data) and returns a JudgeResult per criterion via structured outputs (output_config.format with additionalProperties false; levels and confidence as enums; evidence_refs required). Default model claude-opus-5-5 on summative routes and claude-sonnet-5-5 on formative routes with the exact model id pinned per rubric version, adaptive thinking with effort pinned per route; forced tool use and prefill are not used because these models reject them.

**Why:** Structured, schema-constrained output is the only way to make the judged stage parseable, auditable and incapable of touching auto-checked scores.

**Acceptance:**
- Responses parse against the schema or the call is retried once and then flagged
- response.model is asserted equal to the requested id and stored with the grade
- The JudgeResult schema contains no field through which the model could set an auto criterion score

### LLM-02 Grounding validator (no hallucinated numbers or clauses)

A deterministic post-validator checks every judge and feedback output: all evidence_refs exist in the digest and are non-empty per criterion; every numeric literal in rationale and feedback matches a value present in the digest or an allow-list (level numbers, weights, counts, scenario values) after unit and precision normalization; every clause id cited exists in the clause library and the digest. Violations trigger one regeneration with a correction instruction; a second violation falls back to template feedback and raises a review flag.

**Why:** The brief requires that no numbers are hallucinated; prompting alone cannot guarantee this, a validator can.

**Acceptance:**
- Harness cases with fabricated numbers or clause ids are rejected 100 percent of the time
- Validator outcome, retry count and fallback use are logged per grade

### LLM-03 Justification memo evaluation with claim verification

The memo is evaluated on judged sub-criteria: load path and system description; assumptions and scenario interpretation; governing combination and critical member identification; verification or hand-check; limitations and next steps. Each memo claim about the structure is classified supported, unsupported or contradicted using the evidence (for example the learner claims LC2 governs but evidence shows LC4), and contradictions lower the level and are surfaced in feedback.

**Why:** Engineering judgment is expressed in the memo; tying memo claims to deterministic evidence is what makes its grading defensible.

**Acceptance:**
- A memo naming the wrong governing combination is marked contradicted with the relevant evidence id
- An empty or generic memo receives the lowest level on every memo sub-criterion
- Memo length limit (default 1,500 words) is enforced at submission

### LLM-04 Actionable feedback narrative

A learner-facing narrative with summary, strengths, prioritized issues (each tied to an evidence id, a clause reference and a concrete corrective action such as increase section depth or reduce the unbraced length of member B12), and next steps. The judge never sees the reference solution's geometry or sizes (only benchmark ratios) so it cannot leak answers; register (student or professional) and unit system follow course settings; output passes the grounding validator.

**Why:** Feedback quality is the learning value of the product; it must be specific, code-referenced and safe against answer leakage.

**Acceptance:**
- Each issue carries evidence_id, action and priority
- No feedback contains numbers absent from the evidence digest
- Narrative length stays within the configured cap and uses the course unit system

### LLM-05 Model tiering and routing policy

Routes: claude-haiku-5-5 for pre-screening (injection, PII, off-topic classification, memo language detection); claude-sonnet-5-5 for formative and practice judged criteria and narratives; claude-opus-5-5 for summative tasks and for escalation when confidence is low, the score is near threshold or screening flags exist. claude-fable-5-1 is excluded from the grading path (price, always-on thinking, 30-day retention requirement) but may be used offline to assist golden labeling. Routes are configured per task and recorded in grader_version.

**Why:** Tiering balances cost and quality and keeps high-stakes grades on the strongest affordable model.

**Acceptance:**
- Routing decision and model id are stored per call
- Changing a route bumps grader_version
- Escalation rate is reported per task

### LLM-06 Refusal, truncation and API error handling

Handle stop_reason refusal (record stop_details.category), max_tokens truncation, 429 and 5xx with jittered retries, and timeouts; none of these may be scored as 0. Score-bearing calls do not use automatic server-side model fallbacks so model pinning holds; refusals route judged criteria to human review while deterministic criteria are released. Infra errors are recorded separately from grading outcomes.

**Why:** Conflating provider errors or safety refusals with learner performance would be unfair and would corrupt calibration data.

**Acceptance:**
- A refusal results in needs_review status for judged criteria, never a score
- Retry counts and error classes appear in the audit record
- Harness separates infra errors into an errors sidecar

### LLM-07 Cache-stable prompt layout

Prompt assembly follows the stable-prefix rule: breakpoint 1 on the global grader system prompt and schema semantics; breakpoint 2 on the task block (rubric level descriptors, clause explanations, scenario summary); the evidence digest and memo come last. The prefix exceeds the 512-token minimum, serialization is deterministic (sorted keys, no timestamps), one model and a pinned effort per route (caches are model-scoped and effort changes invalidate the messages cache), and the 1-hour TTL is enabled around deadline windows.

**Why:** Prompt caching is the largest cost and latency lever; it only works if the prefix is byte-stable.

**Acceptance:**
- Integration test asserts cache_read_input_tokens greater than 0 on the second grade of a task
- Steady-state cache read share is at least 60 percent of input tokens
- An alert fires when cache read share drops below 30 percent for one hour

### LLM-08 Token budgets, cost telemetry and batch mode

Per-grade budgets: evidence digest up to 12k tokens, memo up to 3k, total input up to 25k, max_tokens 8k per call (thinking counts as output), at most 3 model calls per grade, pre-checked with count_tokens. Usage from response.usage is stored per call and rolled into per-task and per-course cost dashboards with alerts; a daily spend cap per course pauses LLM stages while deterministic grading continues. Regrades, calibration runs and the offline harness use the Message Batches API (50 percent off, results within 24 hours); interactive submissions stay synchronous.

**Why:** Predictable per-grade cost is required for institutional pricing and prevents runaway spend from long memos or thinking tokens.

**Acceptance:**
- Cost per grade is visible per task and per course
- A budget breach produces a flagged grade rather than an uncapped call
- Batch jobs key results by custom_id and never block interactive grading

### AGG-01 Deterministic score aggregation

total equals the sum over criteria of weight times score divided by 100, with gates applied afterwards (cap or fail) and rounding per rubric; per-criterion scores, evidence ids and judged levels are stored. Aggregation is a pure function of stored stage outputs and is recomputed from raw rows on display rather than trusting a stored aggregate.

**Why:** A pure, recomputable aggregation is what makes grades auditable and regrades diffable.

**Acceptance:**
- Recomputation from stored rows always equals the stored total
- Unit tests cover every scoring function and gate order

### AGG-02 Confidence score and human-review flags

Each grade carries a confidence in the range 0 to 1 combining judge confidence enums, evidence completeness, validator retries, memo anomaly signals and proximity of the total to the pass threshold (default formula in domain_notes). Grades are flagged for review when confidence is below the threshold (default 0.7), the total is within 3 points of the pass mark, any critical gate fired, any injection or contradiction flag exists, or a refusal occurred. Summative flagged grades are held as provisional.

**Why:** Flag-for-human-review thresholds are the main fairness control for AI grading and concentrate instructor time where it matters.

**Acceptance:**
- Flag reasons are enumerated on each grade
- Thresholds are configurable per course
- Flagged share and flag precision are reported per task

### XPL-01 Per-criterion evidence view

Learners (after release) and instructors see every criterion with score, level, weight, the evidence records behind it (values, limits, margins, governing combination, location, clause reference with plain-language explanation), the judge rationale and memo claim classifications.

**Why:** Explainability per criterion is what turns a grade into learning and what instructors need to trust the AI.

**Acceptance:**
- Every displayed number traces to an evidence id
- Evidence can be filtered by status, check type and subject

### XPL-02 3D visual annotations from evidence

Evidence visual payloads drive the 3D workspace: failing and warning members highlighted by severity, utilization color maps, deflected shape and drift at the governing combination, support and load issues pinned to nodes; clicking an evidence record focuses the camera on its subject.

**Why:** Structural feedback is spatial; highlighting the failing member at its governing combination is the most direct explanation possible.

**Acceptance:**
- Every failing member evidence record has a highlight in the 3D view
- The deflected shape shown corresponds to the combination id in the evidence record

### XPL-03 Clause reference library

A versioned registry of code clauses (code, edition, clause number, short paraphrased title, in-house plain-language explanation, typical fixes, link to the official source) used by the rules stage and the judge. No verbatim copyrighted clause text is stored or shown.

**Why:** Clause references make feedback real-world and verifiable while avoiding copyright exposure from reproducing standards text.

**Acceptance:**
- Every clause id emitted by checks resolves in the library
- Library edition is part of grader_version
- Content review confirms no verbatim standard text

### CAL-01 Instructor-agreement metrics

Track agreement between AI results and instructor final results per task, criterion and grader version: exact level agreement, within-one-level agreement, quadratic weighted kappa, mean absolute error on totals, override rate, and flag precision (share of flags that led to a change).

**Why:** Agreement with instructors is the ground truth for whether AI grading is acceptable, and it must be measured continuously.

**Acceptance:**
- Dashboard per course computed from stored rows
- Alert when within-one-level agreement falls below 90 percent over the last 50 reviewed grades

### SEC-01 Prompt-injection resistance

Learner text (memo, appeal text, element labels, comments) is untrusted: it is placed only in the user turn inside explicit delimiters with a data-not-instructions framing and never in system prompts; operator instructions use the system prompt and role system mid-conversation messages where needed. A pre-screen (regex plus a claude-haiku-5-5 classifier) flags instruction-like content; structured outputs plus the validator make it impossible for the model to alter auto-checked scores; injection attempts are flagged for academic-integrity review. A red-team suite is part of the harness.

**Why:** Learners are motivated adversaries of their own grader; defenses must be structural, not prompt-only.

**Acceptance:**
- At least 99 percent of red-team injection cases yield identical scores to their clean twin submissions
- Flagged attempts appear in the review queue with the offending excerpt
- No code path lets LLM output modify an auto criterion score

### SEC-02 Privacy and PII minimization toward the model

Model calls use pseudonymous submission ids; names, emails, student ids and institution names are stripped from memos by rule-based scrubbing before any model call; no roster or grade history is sent. Prompts and responses are stored encrypted with role-based access for audit, retention is configurable, and API data handling (no training on API data, retention tiers, inference region option) is documented for institutions.

**Why:** Educational records are regulated; minimizing what reaches the model is both a compliance and a trust requirement.

**Acceptance:**
- Automated test asserts zero PII fields in assembled prompts on every build
- Scrub log is stored with the grade
- Institution-facing data-handling document exists

### SEC-03 Input hardening and abuse limits

Submission payload limits (size, nodes, members, load cases, memo length), analysis timeouts, per-learner grading rate limits, and rejection of results-bearing payloads protect the deterministic stage and keep latency predictable.

**Why:** A free re-analysis endpoint is a denial-of-service target and a latency risk at deadlines.

**Acceptance:**
- Limits are configurable per deployment
- Exceeding a limit returns an actionable error before queueing

### VER-01 Grader and rubric version stamping

Every grade stores a composite grader_version: solver build, rules and check library, clause library, scenario engine, rubric version, prompt template version, judge schema version, model ids and effort per route, routing policy and validator version. Rubric edits create new rubric versions; existing grades keep theirs and authors are prompted whether to regrade.

**Why:** Grades must be comparable only within a version and reproducible years later for appeals and accreditation.

**Acceptance:**
- grader_version is visible to instructors on every grade
- Any component change produces a new version string
- Grades from different versions are labeled not directly comparable

### VER-02 Reproducibility and persistent result caching

Deterministic stages are pure functions cached by canonical hash, scenario instance hash and grader_version; judged results are cached in Bridle's persistent result store keyed by prompt content hash plus model id, effort and schema version. Because current Claude models reject temperature, top_p and top_k, reproducibility of the judged portion relies on pinned exact model ids, pinned prompts, enum-valued levels, persistent caching and measured variance rather than sampling parameters.

**Why:** The same submission must yield the same score; the brief's temperature-0 assumption is not available on current models and must be replaced by caching and pinning.

**Acceptance:**
- Re-grading an unchanged submission under the same grader_version returns identical totals and per-criterion results 100 percent of the time
- Harness reports judged-level flip rate across 3 fresh repeats of 2 percent or less on the golden suite

### REV-01 Instructor review queue and release control

Instructors have a queue of provisional and flagged grades with filters (flag reason, confidence, task, section), a side-by-side view of 3D evidence, memo, judge rationale and scores, and bulk actions. Summative grades are released by instructor action or by a course policy (auto-release unflagged); formative grades auto-release.

**Why:** Human-in-the-loop for high-stakes grades is the fairness backstop and the trust-building surface for instructors.

**Acceptance:**
- Queue sorts by flag severity and age
- Release events are audited
- Learners see a provisional state until release

### REV-02 Per-criterion override with reason

Instructors can override any criterion's score or level and edit feedback text with a mandatory reason; totals recompute; the original AI result remains stored for calibration.

**Why:** Overrides are the mechanism by which instructors own the grade and by which the system learns.

**Acceptance:**
- Override creates an audit event with before, after, actor and reason
- Overridden grades are marked human-adjusted in metrics

### REV-04 Immutable audit trail

Append-only events for submission, each stage result, every model call (prompt hash, model id, effort, usage, latency, stop reason, validator outcome), flags, overrides, appeals, regrades and releases; exportable per course.

**Why:** Every AI-influenced grade must be explainable after the fact to learners, instructors and institutions.

**Acceptance:**
- Events cannot be edited or deleted
- Export produces a complete timeline for any grade in under 10 seconds

### EVAL-01 Offline evaluation harness with CI gate

A CLI or service that runs a grader version over golden sets and labeled historical submissions (via Batches), isolates infra errors from grading outcomes in an errors sidecar, supports multiple repeats, and reports agreement metrics versus labels, flip rate, validator rejection rate, injection pass rate, per-stage latency, cost per grade from usage, and cache read share. It gates promotion of grader versions in CI.

**Why:** Without an offline harness every prompt, model or rubric change is an uncontrolled experiment on real learners.

**Acceptance:**
- Harness output is machine-readable and versioned with the grader
- A standard suite run completes within the batch window
- Promotion is blocked on threshold regressions defined in non_functional targets

### EVAL-02 Golden submission sets and judge sanity tests

Each task template ships fixtures: oracle design (expected 95 or more), null or empty (expected 0), flawed variants with known failing criteria (over-stressed member, missing combination, unstable frame, constraint violation, over-weight design), memo variants (excellent, generic, contradictory, injection, copied task text, non-English). The harness asserts expected outcomes plus judge sanity checks: known negatives score lowest, long and short equally-correct memos land within one level.

**Why:** Golden sets catch wiring bugs before they cost real grades and are the basis for calibration numbers.

**Acceptance:**
- Fixtures are versioned with the task template
- Every new task requires at least oracle, null and one flawed fixture before publishing
- Judge sanity tests run on every grader version

### OPT-01 Design-optimization scoring against benchmarks

Optimization tasks define objectives (weight, material cost, embodied carbon) computed deterministically from the section catalog and unit rates. Feasibility is a gate (all must-pass checks). The efficiency score maps the ratio r of submitted to benchmark through a monotone, bounded piecewise-linear function (defaults in domain_notes); the benchmark source is configurable: parametric reference design, auto-sized reference, best-known solution, or cohort percentile.

**Why:** Design optimization is a headline use case; scoring must reward economy only among feasible designs and scale with the learner's scenario instance.

**Acceptance:**
- Infeasible designs score 0 on efficiency criteria while other criteria still score
- Benchmark value and r are stored as evidence
- Efficiency score never exceeds 100

## Should (v1.x)

### CHK-04 Constructability checks

Deterministic constructability heuristics: number of distinct sections, use of catalog (standard) sections, member length versus transport limit, depth compatibility at connections, minimum practical member sizes, repetition ratio. Results feed a hybrid criterion where the LLM may use them as evidence for judgment.

**Why:** Constructability is part of real-world criteria but is heuristic; computing the facts deterministically keeps the LLM grounded.

**Acceptance:**
- Each heuristic has a configurable threshold with template defaults and emits warn or fail evidence
- Hybrid criterion rationale references constructability evidence ids only

### RUB-03 Rubric templates and authoring preview

Starter rubrics for analysis, design and optimization tasks ship with the default criteria and weights listed in domain_notes. Authors can preview a rubric against the reference design and a deliberately flawed variant to see resulting scores before publishing.

**Why:** Rubric authoring is the main adoption burden for instructors; templates and dry-run previews make good rubrics the default.

**Acceptance:**
- Three templates ship with the product
- Preview runs the full pipeline in dry-run mode without storing a grade or incurring summative routing

### CAL-02 Calibration loop from overrides and appeals

Instructor overrides and appeal outcomes are captured as labeled examples (evidence digest, memo, final levels) into a per-task calibration set with instructor consent and PII scrubbing. Prompt template or level descriptor revisions must pass the harness against the calibration set before promotion.

**Why:** Human corrections are the cheapest high-quality labels; using them to gate changes prevents silent regressions.

**Acceptance:**
- Calibration set grows automatically from reviewed grades
- Promotion is blocked on regression beyond configured tolerance

### CAL-03 Fairness and difficulty-normalization monitoring

The pipeline never receives demographic or identity data. Score distributions are monitored by section, scenario instance parameters and memo language; instance-level deviations beyond a threshold alert the author to adjust ranges. Judge variance across repeats is measured and reported.

**Why:** Randomized instances and an LLM judge can introduce unfairness that only distribution monitoring reveals.

**Acceptance:**
- Fairness report per task
- Instance-difficulty alert fires when the reference design's efficiency score varies more than 10 points across instances

### VER-03 Regrade workflow with diffs

Instructors can regrade selected submissions with a newer grader or rubric version; the new result is stored as a new grade version alongside the old with a per-criterion diff, and the learner-visible grade changes only on explicit release.

**Why:** Grader improvements and rubric fixes are inevitable; regrading must be controlled and transparent.

**Acceptance:**
- Diff view shows criterion-level deltas and changed evidence
- Both grade versions remain in the audit trail

### REV-03 Appeals workflow

Learners can appeal a released grade once per task with a bounded text treated as untrusted; instructors resolve with a decision and reason; an optional AI-assisted re-read presents the appeal against evidence without changing scores. Status and deadlines are tracked.

**Why:** A formal appeal path is expected in academic settings and produces valuable calibration labels.

**Acceptance:**
- Appeal states open, under_review, upheld, denied
- Appeal text passes SEC-01 screening
- Resolution is audited with reason

### OPT-02 Multi-objective Pareto scoring

With two or more objectives, submissions are ranked by non-domination within the cohort plus an instructor-seeded reference front; score by front rank with a hypervolume-contribution tiebreak; a Pareto plot shows the learner's point anonymized among the cohort.

**Why:** Real design trade-offs (weight versus carbon versus cost) are multi-objective; Pareto scoring teaches that there is no single best answer.

**Acceptance:**
- Front computation is deterministic for the same set
- Ranks are frozen at the deadline and recomputed on regrade

## Could (later)

### SCN-03 Similarity and collusion flags

Compute a topology and section fingerprint per submission and flag near-identical designs submitted under different scenario instances, or near-identical memos, within a cohort for instructor review. Flags are instructor-only and never auto-penalize.

**Why:** Randomization deters collusion; fingerprinting detects the residual cases without automating integrity decisions.

**Acceptance:**
- Fingerprint similarity above a configurable threshold creates a review flag listing the compared submission ids
- Flags never change a score automatically

### OPT-03 Optional anonymized leaderboards

Instructor-enabled, class-scoped leaderboards for optimization tasks with opt-in aliases, feasible entries only, frozen at the deadline, with rules re-run on every entry to prevent gaming.

**Why:** Leaderboards motivate practicing engineers and advanced students but raise privacy and gaming concerns, so they are off by default.

**Acceptance:**
- Disabled by default and never shows real names
- Entries link to evidence for the instructor only

## Non-functional targets

| id | title | target |
|---|---|---|
| NFR-01 | Deterministic stage latency | p95 of 10 s or less from job start to evidence available for models up to 2,000 members or 12,000 DOF with up to 20 combinations including one eigen-buckling solve; p95 of 30 s or less up to the hard size limit |
| NFR-02 | LLM stage and end-to-end latency | LLM stage p95 of 60 s or less including screening, judge, narrative, validator and one regeneration; end-to-end p95 of 90 s or less; deterministic evidence visible to the learner within 15 s regardless of LLM stage status |
| NFR-03 | Deadline burst throughput | 500 submissions within 10 minutes processed with zero failed jobs; queue backlog drains within 30 minutes; LLM concurrency throttled with jittered backoff so no 429 becomes a failed grade |
| NFR-04 | Determinism and judged-stage stability | Identical snapshot plus grader_version yields identical totals and per-criterion results in 100 percent of replays; judged-level flip rate across 3 fresh repeats of 2 percent or less on the golden suite |
| NFR-05 | Cost per grade | At verified list prices: median of $0.08 or less and p95 of $0.20 or less on the Sonnet route; median of $0.15 or less and p95 of $0.40 or less on the Opus route; cache read share of 60 percent or more of input tokens in steady state; all non-interactive work at the 50 percent batch rate |
| NFR-06 | Calibration before promotion | Exact-level agreement of 85 percent or more, within-one-level agreement of 97 percent or more, quadratic weighted kappa of 0.80 or more against instructor labels on golden and calibration sets; oracle fixtures score 95 or more and null fixtures score 0 |
| NFR-07 | Injection resistance | 99 percent or more of red-team cases yield identical scores to clean twins; zero code paths by which LLM output can alter an auto-checked criterion, enforced by schema and covered by tests |
| NFR-08 | Privacy of model inputs and logs | Zero PII fields in assembled prompts verified by an automated test on every build; prompt and response logs encrypted at rest with access logging; retention configurable between 30 and 730 days |
| NFR-09 | Auditability | 100 percent of grade-affecting events carry actor, timestamp, reason and grader_version; audit export for any grade in under 10 s; events are append-only |
| NFR-10 | Availability, degradation and replay | Grading queue availability 99.5 percent monthly; LLM provider outage degrades to deterministic-only grades with judged criteria pending and auto-resumes within 1 hour of recovery; any grade is replayable from its snapshot within 10 minutes for at least 2 years with solver builds retained |

## Domain notes (for architecture and UX)

A. PIPELINE STAGES (determinism class in brackets)
S0 Intake [deterministic]: validate submission schema; canonicalize model (sorted keys, SI units, nodes sorted by id, members by (i,j), floats rounded to 1e-9 relative); canonical_hash = sha256(canonical model); snapshot = {model, memo, scenario_instance, task_version, rubric_version}; PII scrub of memo (names, emails, ids, institution); size and rate limits.
S1 Re-analysis [deterministic]: pinned solver build (same core as the client live analysis); loads generated from the scenario instance; all required combinations; outputs per combination: nodal displacements, reactions, member end forces and station forces, stresses, story drifts, elastic buckling load factor lambda_cr, optional modal periods; integrity comparison with client-reported results (tolerance-based); cached by (canonical_hash, scenario_hash, solver_version).
S2 Rules [deterministic]: code checks, combination verification, task constraints, constructability, efficiency metrics -> GradeEvidence[]; EvidenceDigest built by deterministic selection.
S3 LLM [non-deterministic, pinned and cached]: (a) screen call on claude-haiku-5-5 (injection, PII residue, off-topic, language); (b) judge call on the route model returning JudgeResult for all judged/hybrid criteria via structured outputs; (c) narrative call producing FeedbackNarrative from JudgeResult plus digest; (d) grounding validator, one regeneration on violation, template fallback and flag on second violation; result stored in Bridle's persistent result store keyed by hash(prompt bytes, model id, effort, schema version).
S4 Aggregation [deterministic]: scoring functions, weights, gates, rounding, confidence, flags.
S5 Review [human]: queue, overrides, appeals, release, audit events.

B. EVIDENCE SCHEMA (GradeEvidence v1.0, TypeScript-like notation)
GradeEvidence {
  evidence_id: string            // 'EV-' + check_type code + 4-digit sequence; stable for a given (snapshot, grader_version)
  schema_version: '1.0'
  criterion_ids: string[]        // rubric criteria this record feeds
  check_type: 'strength' | 'serviceability' | 'stability' | 'load_combination' | 'scenario_load' | 'task_constraint' | 'constructability' | 'efficiency' | 'model_integrity' | 'analysis_error' | 'memo_claim'
  subject: { kind: 'member' | 'node' | 'plate' | 'support' | 'load_case' | 'combination' | 'model' | 'memo', id: string, label?: string }
  status: 'pass' | 'warn' | 'fail' | 'not_applicable' | 'error'
  severity: 'info' | 'minor' | 'major' | 'critical'
  metric: { name: string, value: number, unit: string, limit: number, comparator: '<=' | '>=' | '==' | 'in_range', margin_pct: number }
  governing?: { combination_id: string, combination_label: string, station?: string, component?: string }
  values: Record<string, { value: number, unit: string }>   // every named number used (Mu, phiMn, Lb, Cb, Pu, phiPn, delta, L/360 ...)
  code_ref?: { code: string, edition: string, clause: string, title: string, library_id: string }
  message_key: string            // template id rendered deterministically into learner text
  visual?: { highlight_ids: string[], color_scale?: 'utilization' | 'deflection' | 'drift', show: 'deflected_shape' | 'force_diagram' | 'none', combination_id?: string, annotation?: string }
  computed_by: { stage: 'analysis' | 'rules' | 'judge', component_version: string }
}
EvidenceDigest { scenario_summary; model_summary { n_nodes, n_members, materials[], sections[] }; summary_by_check_type { counts by status, max_metric, governing_combination }; records: GradeEvidence[] (all fail/warn up to cap, top-N governing per check type, all task_constraint, model_integrity, analysis_error, efficiency records); truncated: boolean; omitted_counts by check_type }. Serialize with sorted keys; never include timestamps or learner identity.

C. JUDGE OUTPUT SCHEMAS (structured outputs: additionalProperties false on every object; use enums because minimum/maximum, minLength and recursive schemas are not supported server-side; SDK parse validates client-side)
JudgeResult { criteria: [{ criterion_id: enum(judged ids of this rubric), level: enum('0','1','2','3'), evidence_refs: string[], rationale: string, memo_claims: [{ claim: string, verdict: enum('supported','unsupported','contradicted'), evidence_refs: string[] }], confidence: enum('low','medium','high'), flags: enum[]('injection_attempt','off_topic','insufficient_evidence','contradiction','possible_copy') }] }
FeedbackNarrative { summary: string, strengths: [{ text: string, evidence_refs: string[] }], issues: [{ evidence_id: string, clause_library_id?: string, problem: string, action: string, priority: enum('high','medium','low') }], next_steps: string[] }
No field exists for auto-criterion scores; the judge cannot touch them.

D. RUBRIC DEFAULTS
Design-task template (weights): strength (auto) 25; serviceability (auto) 10; stability (auto, gate cap 40) 10; load combinations and scenario loads (auto) 10; task constraints (auto, gate cap 50) 5; efficiency/economy (auto) 15; constructability (hybrid) 5; engineering-judgment memo (judged) 20. Pass threshold 60; rounding 0.5. Analysis-task template shifts weight to load combinations (20) and memo (30) and drops efficiency; optimization template raises efficiency to 35 and adds Pareto criterion when multi-objective.
Memo judged sub-criteria (levels 0-3): load path and system description; assumptions and scenario interpretation; governing combination and critical member identification (cross-checked against evidence); verification or hand-check; limitations and next steps. Level 3 = all claims supported by evidence and specific to this scenario; 2 = mostly supported, minor gaps; 1 = generic or partially contradicted; 0 = absent, off-topic or contradicted on the governing claim. Level map default {0:0, 1:40, 2:75, 3:100}.
Scoring functions: step (pass 100 else 0); banded_max_metric on max utilization u (u<=1.00:100, <=1.05:70, <=1.10:40, else 0); fraction_scaled = banded x (1 - n_fail/n_checked)^k with k default 1; linear_margin (100 at margin>=0 down to 0 at margin<=-m_max); level_map for judged. Aggregation: total_raw = sum(w_i x score_i / 100), weights sum to 100; apply gates in order fail-task, then caps (min of caps); round; pass if total >= threshold; recompute from raw rows on display.

E. SCENARIO PARAMETERS AND LOAD REFERENCE (ASCE 7-22 unless noted; SI)
Wind: velocity pressure qz = 0.613 Kz Kzt Kd Ke V^2 (N/m^2, V in m/s) [Eq. 26.10-1 SI]; MWFRS pressure p = q G Cp - qi (GCpi) [Eq. 27.3-1]; exposure B/C/D; Kd 0.85 for buildings. Snow: flat-roof pf = 0.7 Ce Ct Is pg [Eq. 7.3-1]; sloped ps = Cs pf; drift and unbalanced cases optional in v1.x. Seismic: SDS = (2/3) Fa Ss, SD1 = (2/3) Fv S1; Cs = SDS / (R/Ie) with Section 12.8.1.1 bounds; V = Cs W; vertical distribution per 12.8.3; Ev = 0.2 SDS D; story drift limit Delta_a = 0.020 hsx (Risk Category I/II), 0.015 (III), 0.010 (IV) [Table 12.12-1]. Live loads from Table 4.3-1 (office 2.40 kN/m^2, classrooms 1.92, assembly 4.79, residential 1.92). Thermal: temperature range applied as uniform strain on restrained members. Soil: allowable bearing for support/footing checks. Risk category drives Ie and Is.
LRFD combinations (2.3.1 and 2.3.6): 1.4D; 1.2D+1.6L+0.5(Lr or S or R); 1.2D+1.6(Lr or S or R)+(L or 0.5W); 1.2D+1.0W+L+0.5(Lr or S or R); 0.9D+1.0W; 1.2D+Ev+Eh+L+0.2S; 0.9D-Ev+Eh. ASD set (2.4.1) available as an option. Eurocode: EN 1990 eq. 6.10 ULS 1.35 Gk + 1.5 Qk,1 + sum 1.5 psi0,i Qk,i; SLS characteristic Gk + Qk,1 + sum psi0,i Qk,i; actions EN 1991-1-3 snow, 1991-1-4 wind, EN 1998-1 seismic; steel EN 1993-1-1 6.2 (cross-section) and 6.3 (buckling).
Serviceability defaults: floors L/360 live and L/240 total, roofs L/180 to L/360 by ceiling type (IBC 2024 Table 1604.3); wind drift H/400 to H/500 under 10-year MRI wind as a warn-level rubric default (ASCE 7 Appendix CC practice); Eurocode national-annex typical L/250 total, L/300 to L/360 live.
Stability defaults: singular stiffness or mechanism = critical gate; elastic lambda_cr < 1.0 under any combination = fail; 1.0 <= lambda_cr < 3.0 = warn (suggested default); second-order amplification B2 > 1.5 = warn (AISC 360-22 Appendix 8 approximate-method limit). AISC 360-22 LRFD resistance factors: phi_t 0.90 yielding and 0.75 rupture, phi_c 0.90, phi_b 0.90, phi_v 0.90 (1.00 for qualifying rolled I-shapes).
Material reference: steel E 200 GPa, A992 Fy 345 MPa, density 7850 kg/m^3; concrete density 2400 kg/m^3. Unit cost and embodied-carbon placeholders to confirm with the content team: fabricated steel roughly $2.5-4 per kg, concrete roughly $150-250 per m^3; embodied carbon per ICE database v3 (structural steel sections about 1.55 kgCO2e/kg EU average, C30/37 concrete about 0.10-0.12 kgCO2e/kg).

F. OPTIMIZATION SCORING DEFAULTS
Feasibility gate first (all must-pass checks); objectives computed from section catalog mass, unit cost and carbon factors. Ratio r = submitted / benchmark; default piecewise-linear knots: r<=1.00 -> 100, 1.10 -> 85, 1.25 -> 65, 1.50 -> 40, r>=2.00 -> 10; infeasible -> 0 on efficiency criteria only; no bonus above 100 (leaderboard rank captures beating the benchmark). Benchmark sources: parametric reference design (scales with scenario instance), auto-sized reference (greedy sizing from the catalog), best-known solution, cohort percentile (P25 of feasible submissions, frozen at deadline). Multi-objective: NSGA-II style non-domination fronts within cohort plus instructor-seeded reference front; score 100 for front 0, minus 15 per front (configurable, floor 10); hypervolume contribution as tiebreak; store rank, front and crowding in evidence.

G. CLAUDE API FACTS USED (verified 2026-11-03 against the bundled Claude API reference, prices cached 2026-10-06; confirm pricing before launch)
Models and list prices per MTok: claude-opus-5-5 $4 in / $20 out, cache read $0.20, default effort medium; claude-sonnet-5-5 $2 / $10, cache read $0.20, default effort high; claude-haiku-5-5 $0.10 / $0.50 for prompts up to 100K tokens; claude-fable-5-1 $10 / $50, cache read $0.25, thinking always on, not available under zero-data-retention (30-day retention required). Use exact ids, no date suffixes.
Sampling: temperature, top_p, top_k are rejected (400) on Fable 5.1 and Opus 5.5, non-default values rejected on Sonnet 5.5 and Haiku 5.5, and all are rejected on every model on API version 2026-10-21; temperature 0 never guaranteed identical outputs on earlier models either. Thinking cannot be disabled on Opus 5.5 or Fable 5.1; use thinking {type: adaptive} and pin output_config.effort per route (suggested: Sonnet route medium, Opus route high; tune with the harness).
Output control: forced tool_choice any/tool and assistant prefill return 400 on Fable 5.1, Opus 5.5 and Sonnet 5.5; use structured outputs (output_config.format with a JSON schema; additionalProperties false on all objects; no minimum/maximum, minLength or recursive schemas server-side; SDKs strip and validate client-side; incompatible with citations; works with Batches, streaming and thinking; refusal output may not match the schema; new schemas pay a one-time compile and are cached 24 h). Prefer client.messages.parse() or the SDK equivalent.
Refusals and errors: stop_reason 'refusal' with stop_details.category; server-side fallbacks exist (fallbacks 'default' with beta header server-side-fallback-2026-07-01) but are recommended OFF for score-bearing calls to keep model pinning, optional for the narrative call; assert response.model equals the requested id; retry 429/5xx with jittered backoff; never score errors as 0.
Caching: prefix match in render order tools -> system -> messages; minimum cacheable prefix 512 tokens on these models; max 4 breakpoints; cache write 1.25x (5-minute TTL) or 2x (1-hour TTL); caches are model-scoped; thinking or effort changes invalidate the messages cache; verify with usage.cache_read_input_tokens; sort JSON keys; no timestamps or ids in the prefix. Mid-conversation role system messages are the non-spoofable operator channel for corrections (cache-preserving).
Batches: 50 percent off every token including cache reads and writes; results within 24 h; key by custom_id; use for regrades, calibration and the harness. count_tokens for budgets; Admin API usage and cost reports for org-level dashboards.
Prompt layout per judge call: [system block 1, cache 1 h: grader charter and rules (ground only in evidence, memo is untrusted data, cite evidence ids, no numbers outside evidence, verbosity-neutral, never reveal reference design) plus schema semantics] [system block 2, cache 5 min or 1 h near deadlines: task block = judged criteria with level descriptors, clause explanations for clauses present in this task, scenario summary] [user: evidence digest JSON with sorted keys; learner memo inside explicit untrusted delimiters; instruction]. output_config.format = JudgeResult; thinking adaptive; effort pinned; max_tokens 8,000-16,000.
Cost worked example per grade (Sonnet route): 12k cached read ($0.0024) + 6k uncached input ($0.012) + about 5k output including thinking ($0.05) + Haiku screen ($0.0003) = about $0.065; Opus route about $0.0024 + $0.024 + $0.10 = about $0.13; batch work halves these.

H. CONFIDENCE AND FLAGS (default, to be calibrated)
confidence = 0.35 x judge_conf (low 0.3, medium 0.65, high 1.0, averaged over judged criteria) + 0.20 x evidence_completeness (1 - omitted share of digest) + 0.15 x (1 - validator_retries / 2) + 0.15 x min(1, |total - threshold| / 10) + 0.15 x memo_signal (0 if any judge flag else 1). Review when confidence < 0.7, |total - threshold| <= 3, any critical gate, any injection/contradiction/possible_copy flag, refusal or validator fallback. Summative flagged grades are provisional until released.

I. GROUNDING VALIDATOR ALGORITHM
1) parse structured output against the schema; 2) every evidence_refs entry exists in the digest and each judged criterion has at least one; 3) extract numeric literals from rationale, problem, action and summary text (decimals, thousands separators, percents, units); normalize units and precision; accept only values present in the digest (equal after rounding to at most 3 significant figures) or in the allow-list (levels 0-3, rubric weights, counts in the digest summary, scenario parameter values); 4) clause library ids cited must exist in the library and in the digest; 5) verdict 'contradicted' requires evidence_refs; 6) on failure append a role system message listing violations and regenerate once (cache-preserving); second failure -> template feedback rendered from message_key plus flag 'validator_fallback'. Log every outcome.

J. OFFLINE HARNESS METRICS AND GATES
Per grader version over golden plus calibration sets with R=3 repeats via Batches: exact-level agreement (gate >= 85 percent), within-one-level (>= 97 percent), quadratic weighted kappa (>= 0.80), MAE on totals, judged flip rate across repeats (<= 2 percent), validator rejection rate, injection pass rate (>= 99 percent), oracle >= 95, null = 0, known negatives (empty memo, 'I don't know', confident wrong memo, copied task text) at lowest level, verbosity check (long versus short equally-correct memos within one level), infra error rate (sidecar, excluded from scores), per-stage latency p50/p95, cost per grade from usage, cache read share, served model equals requested model. Noise floor roughly 1/sqrt(n x R) on pass-rate style metrics; size golden sets so the floor is below the smallest change worth shipping.

K. GRADER VERSION
grader_version = { solver, rules, clause_library, scenario_engine, rubric, prompt_template, judge_schema, routes: { screen: haiku id, formative: sonnet id + effort, summative: opus id + effort }, validator, aggregator } each semver, plus a composite hash; any change produces a new composite; stored on every grade and every model-call audit event.

L. PROPOSED MODULE LAYOUT (stack-agnostic names for the architecture phase; critical files first)
services/grading/evidence/schema (GradeEvidence, EvidenceDigest, JudgeResult, FeedbackNarrative schemas: the contract between all stages); services/grading/pipeline/orchestrator (job state machine, stage isolation, idempotency, cache keys); services/grading/judge/prompt_assembly plus judge/validator, judge/routing, judge/cost (cache-stable prompt layout, structured-output client, grounding validator, tiering, usage accounting); services/grading/rubric/aggregation plus rubric/scoring_functions, rubric/confidence; tools/grading-eval/harness plus fixtures/golden sets; services/grading/rules/{asce7_22_loads, aisc360_22, serviceability, stability, constraints, constructability, efficiency}; services/grading/scenario/{schema, instance_generator, load_derivation}; services/grading/review/{queue, overrides, appeals, audit}; content/clause-library (registry JSON with editions).

## Risks

| risk | mitigation |
|---|---|
| Hallucinated numbers, clauses or evidence references in feedback undermine trust in the grader. | Evidence-only grounding with a deterministic validator (LLM-02), structured outputs, template fallback on second violation, and fabricated-number fixtures in the harness. |
| Client live analysis and server re-analysis disagree, confusing learners and producing false integrity flags. | Build both from the same solver core (same numeric settings, pinned build), compare with tolerance, show both values in the evidence, and treat mismatch as warn until the core is proven stable. |
| The plan assumed temperature 0 for determinism, but current Claude models reject sampling parameters. | Design reproducibility around pinned exact model ids, pinned prompts and schemas, enum levels, Bridle's persistent result cache keyed by content hash, and variance measured by the harness (VER-02). |
| Model deprecation or routing change silently shifts judged scores between cohorts. | Pin exact model ids in grader_version, assert response.model, run the harness and calibration gate before any route change, and label grades from different versions as not comparable. |
| Deadline bursts spike cost and latency or hit API rate limits. | Queue with concurrency limits and jittered backoff, 1-hour cache TTL during deadline windows, deterministic results released first, Batches for regrades and evals, per-course daily spend caps. |
| Learners inject instructions into memos or labels to manipulate the judge. | Untrusted-data framing in the user turn only, Haiku pre-screen, schema that cannot touch auto scores, validator, integrity flags, and a red-team suite with a 99 percent pass gate. |
| Reproducing building-code clause text violates copyright of ASCE, AISC, ACI or CEN. | Clause library stores only ids, paraphrased titles and in-house explanations with links to official sources; legal review before launch. |
| Over-reliance on AI for summative grades harms learners when the judge is wrong. | Provisional status, confidence-based flags, instructor release control, per-criterion overrides, appeals and agreement dashboards with alerts. |
| Randomized scenario instances create unequal task difficulty across learners. | Author-bounded ranges, 20-instance difficulty preview, parametric benchmarks, and instance-level fairness monitoring with alerts. |
| Safety classifiers refuse grading requests that discuss collapse or failure, or thinking tokens blow per-grade budgets. | Handle stop_reason refusal by routing to human review, keep neutral engineering wording in prompts, pin effort per route, cap max_tokens, and monitor usage per call. |

## Open questions

- Which code family ships in MVP: ASCE 7-22 plus AISC 360-22 (recommended) or Eurocode first, and which editions (ACI 318-19 versus 318-25; first- versus second-generation Eurocodes) should the clause library target?
- Is MVP code checking steel-only with generic elastic checks for other materials, with concrete (ACI 318) and timber (NDS) checks deferred to v1.x?
- Will the server re-analysis share the same solver core as the client live analysis (strongly recommended), and who owns the numeric-tolerance contract between them?
- For summative tasks, is instructor release mandatory, or is auto-release of unflagged grades acceptable with a sampled review rate?
- Default judged-criteria route: Sonnet 5.5 for formative and Opus 5.5 for summative (recommended), or Opus everywhere at roughly double the per-grade cost?
- Should score-bearing calls ever use server-side model fallbacks, or must refusals always go to human review to preserve strict model pinning?
- What institutional data requirements apply (FERPA, GDPR, data processing agreements, inference region, retention tiers), and are anonymized opt-in leaderboards acceptable to pilot institutions?
- Which memo languages must be supported at launch, and are unit systems (SI versus US customary) set per course or per task?
- Attempt policy: unlimited formative attempts with feedback, limited summative attempts, and does randomization re-seed per attempt by default?
- Should instructors be able to author custom deterministic checks via an expression DSL in MVP, or is the fixed constraint-type schema sufficient until v1.x?
- Who produces and legally reviews the paraphrased clause explanations, and how are code edition updates versioned against existing grades?
- What appeal SLA and escalation path do pilot institutions expect, and is AI-assisted appeal review permitted by their policies?
