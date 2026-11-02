# Academic integrity, exam mode, and AI-use policy (gap-fill #5, unified specification)

_Source: requirements discovery workflow `wf_6281c128-0bb` (gap-fill agent), 2026-11-03. 25 requirements: 13 must (MVP), 10 should (v1.x), 2 could (later)._

## Summary

Integrity in Bridle is built on four product-native facts rather than surveillance: every learner gets a different randomized scenario instance, every edit is an operation in a replayable op log, every submission is an immutable canonical snapshot with a pin set, and every grade passes through instructor review. This domain unifies the integrity fragments spread across LMS SUB-03, AI-grading SCN-03/SEC-01, product TRU-01, structural GRD-04/GRD-05 and workspace DET-01 into one IntegritySignal schema, one scenario-invariant model fingerprint (WL topology hash, de-randomized geometry, section-assignment partition, learner-load signature) with cohort-baseline outlier flagging, one process-evidence profile for the op log with explicit exclusions and retention, one per-task exam-mode lockdown profile that is enforced at the API and attested per submission, per-task collaboration and AI-use policies bound to a versioned honor pledge, and an instructor case workflow with FERPA-style redaction and an appeal path. Three decisions follow for architecture: the fingerprint, signal, exam-profile, attestation and op-log event types must live in the shared schema package next to canonicalize() (DM gap) before any learner data is stored; exam-mode features that carry data (hints, self-check, checks-library artifact, exports, share links) are withheld server-side, never merely hidden; and no signal ever changes a score, so all integrity outcomes flow through the existing grade-history override path. The AI-use policy is explicit: no AI-writing detectors as evidence, authorship supported instead by memo-model coherence, process evidence, disclosure fields and optional design-defense questions; attention signals, if ever enabled, stay deterministic counts because live exam monitoring is an EU AI Act Annex III 3(d) high-risk use. MVP (first academic pilot) = randomization with instance-binding verification, pledge bound to the submission version, exam-mode lockdown with attestation, basic similarity report, and the signal/op-log schema; cases, memo similarity, provenance stamping, SEB integration and institution settings follow in v1.x.

## Must (MVP)

### GAP5-SIG-01 Unified IntegritySignal record and routing (no score effect)

Every integrity-relevant finding (model similarity pair, memo similarity pair, wrong-scenario-instance match, reference-solution match, foreign provenance stamp on import, prompt-injection screen hit, exam-mode violation, platform fault, manual instructor note) is emitted as one IntegritySignal record with a fixed schema: signal id, type, severity (info | notice | high), subject submission version id(s), pseudonymized counterpart id(s), metrics, evidence references (hashes, op-log ranges, excerpts), detector version plus settings hash, and creation time. Signals are visible only to instructor, course-lead and integrity-officer roles, never to learners unless attached to a case, and never change a score; a high-severity signal sets the existing integrityFlag that routes the grade to human review (LMS GRD-02, AIG AGG-02).

**Why:** Four domains each invented their own flag; one schema lets the review queue, the case workflow and the audit export consume all of them and encodes the no-automatic-penalty rule exactly once.

**Acceptance:**
- IntegritySignal JSON schema is published in the shared schema package (DM gap) and all MVP signal types (wrong_instance, model_similarity, reference_match, prompt_injection, exam_violation, platform_fault, manual) validate against it.
- Signal creation by the grading pipeline, the similarity job, the exam-mode enforcer or an instructor is an append-only audit event; signals cannot be edited or deleted, only superseded.
- An automated test asserts that grade totals and per-criterion scores are identical with and without signals attached to a grade.
- High-severity signals set integrityFlag on the grade; the review queue shows the signal type and links to its evidence; learner-facing APIs expose no signal fields (contract test).

### GAP5-RAND-01 Per-learner randomization as the primary collusion control, with instance-binding verification

Every summative simulation task in the pilot uses per-learner randomized scenario instances (AUT TB-11, AIG SCN-02) so that a copied model is detectable because it fits the wrong instance. The grader's deterministic stage verifies that the submitted model's bound quantities (spans, bay and story dimensions, load magnitudes, material grades bound to parameters) match the learner's own stored instance within the parameter step tolerance; a model whose bound quantities match another learner's instance in the comparison scope, or the un-randomized starter defaults, raises a wrong_instance signal (high) naming the matched seed owner pseudonymously. Tasks with zero randomized parameters are labeled 'not randomized' on the task page and in the similarity report.

**Why:** Randomization is the cheapest and most defensible integrity control in a design course because it mirrors practice (each engineer has a different site and geometry), and verifying the instance turns copying into a deterministic finding rather than a judgment call.

**Acceptance:**
- The publish gate warns when a summative task has no randomized parameter; an institution setting can turn the warning into a block.
- Fixture test: a model built for learner A's instance submitted by learner B yields a wrong_instance signal listing the matched parameters and A's pseudonymous id; the same design built on B's instance yields no signal.
- Bound-quantity tolerance defaults to the TB-11 parameter step and is recorded on the signal with the compared values.
- The grade still runs on the submitted model against B's own instance (mismatches also surface as failed checks); the signal itself never alters the score.

### GAP5-FP-01 Scenario-invariant model similarity fingerprint (v1)

At every submission (and nightly for drafts when enabled) the platform computes a fingerprint from the canonical model (DM canonicalize()) with four components: topology (a Weisfeiler-Lehman graph hash, 3 iterations, over the node/member graph with vertex labels = support restraint pattern and edge labels = element kind plus end-release pattern, plates as hyper-vertices); normalized geometry (coordinates de-randomized by dividing each bound coordinate by its TB-11 parameter value, bounding-box normalization as fallback, quantized to 1/200 of extent, best of the 8 horizontal-plane symmetries); section-assignment pattern (the partition of members into same-section groups plus family and weight-rank decile per WL-ordered member, so a copy with every section bumped one size still matches); and load-pattern signature (learner-applied loads only, excluding scenario-generated loads, tokenized by kind, target WL label, direction bin and magnitude normalized by the instance's reference load of that kind). Each component yields an exact hash and a 128-permutation MinHash sketch so pairwise Jaccard similarity can be estimated at cohort scale, and a weighted composite (defaults topology 0.40, geometry 0.25, sections 0.20, loads 0.15) is stored with per-component values and a fingerprint_version.

**Why:** modelHash (SIM-DET-02, DET-01) detects only byte-identical copies, and because every learner has a different scenario instance, copied designs differ in numbers; similarity must be computed after undoing the randomization and ignoring ids, ordering and display units.

**Acceptance:**
- Invariance tests: entity renumbering, entity reordering, rigid translation, 90-degree rotation or mirror in plan, display-unit changes, and regeneration of the same design under 20 different seeds all yield identical topology and geometry hashes.
- Sensitivity tests: adding or removing a member or support, changing a release pattern, changing the section partition, or moving a learner-applied load to another member changes the corresponding component.
- Fingerprint computation for a Tier-M model (<= 2,000 members) completes in < 500 ms server-side and the result is stored in the submission pin set with fingerprint_version.
- Component weights are institution-configurable (GAP5-INST-01) and the settings hash used is stamped on every pair record.

### GAP5-FP-02 Comparison scope, exclusions and cohort baseline

Pairwise comparison covers all submissions to the same task version within the offering (all sections) and, when the institution enables it, submissions from prior offerings of the same task lineage (template provenance, AUT TL-01) within the same tenant; cross-tenant comparison is never performed in MVP and may later exist only as an opt-in exchange of fingerprints, never models. Starter-model elements (identified by stable, never-reused element ids; modified starter elements count as learner elements), locked or hidden author elements and scenario-generated loads are excluded from the comparative fingerprint, and matches against reference solutions are reported as a separate reference_match signal rather than as a learner pair. Because constrained tasks make designs converge, the job computes the cohort baseline distribution of composite similarity and flags only outliers: composite >= 0.90 and at least 3 median absolute deviations above the cohort median, or an exact topology-plus-geometry match outside the starter with at least 10 learner elements.

**Why:** Without baseline correction a three-bay portal frame with a fixed catalog makes every pair look suspicious, without starter exclusion the starter dominates the score, and prior-offering comparison is what catches reuse of last year's solutions.

**Acceptance:**
- A submission identical to the starter plus one member produces no pair signal and is labeled 'low information (starter-dominated)'; comparative subsets under 10 elements or under 30% of the model are labeled the same way.
- Two learners submitting the same design under different seeds are flagged with composite >= 0.90 and the baseline chart shows the pair's position relative to the cohort distribution.
- Team submissions (COLLAB gap) are compared as one unit and within-team similarity is never flagged; prior-offering comparison is off by default and shows counterparts only as pseudonymous ids with the offering term.
- The similarity job is covered by the tenant-isolation test suite; no fingerprint or model data crosses tenants.

### GAP5-FP-03 Ranked instructor-only similarity report with evidence and no automatic penalties

Per task and offering, instructors (own sections), course leads and the institution integrity officer see a ranked list of flagged pairs with composite and per-component scores, cohort baseline position, submission timestamps (who submitted first), a side-by-side 3D view with matching elements highlighted and differing elements dimmed, the section-assignment diff, the edit-cadence summaries of both parties (GAP5-EVID-01) and a button to open an integrity case (GAP5-CASE-01). Scores and flags never change a grade, never appear in learner-facing surfaces or gradebook exports, and the report carries a fixed statement that similarity is not proof of misconduct.

**Why:** TRU-01, SUB-03 and SCN-03 all demand an evidence-first, no-auto-penalty report; the first contested grade at a pilot institution will be decided on how quickly a reviewer can see why a pair was flagged.

**Acceptance:**
- Pairs are ordered by composite score with a threshold slider (default 0.90) and the cohort distribution chart; filtering by section, signal type and 'has process anomaly' is available.
- Side-by-side highlighting of matching members, supports and loads renders within 2 s for Tier-M models and can be saved as frozen evidence.
- Report access is limited to the listed roles and every view is written to the disclosure log (LMS DAT-01).
- A contract test verifies that learner APIs, feedback views, notifications and gradebook exports contain no similarity data; pairs whose process evidence has expired (GAP5-EVID-03) still show scores but mark the timeline as unavailable.

### GAP5-EVID-01 Process-evidence profile of the op log and draft timeline, with disclosure

For every task-bound model the op log (SIM-SCH-02) and draft timeline (SUB-02, CAP-03) retain the fields a review needs: per op the op id, actor id, workspace session id, client and server timestamps, op kind, entity ids touched and a bulk marker (source: JSON/CSV/DXF import, clipboard paste, array/mirror/replicate/template; entity count; file hash; provenance stamp if present); per session the start, end, client build hash and exam profile in force; per draft autosave the model hash and element counts; per memo autosave the character delta plus paste events with length and internal/external classification; and analysis-run, self-check, hint (GRD-04), export-attempt and share-attempt events. Keystroke timing, clipboard contents, screen, camera and microphone data are explicitly never collected. A derived EditCadenceSummary (first and last edit, sessions, active minutes, ops per active minute, largest single-op entity count, bulk and external-paste counts, distinct autosave hashes, time from last bulk event to submit, memo words typed versus pasted) is stored with every submission version, and every task page and the workspace status bar link to a generated 'What Bridle records in this task' notice listing exactly these fields, the default 12-month retention and who may view them.

**Why:** These fields must exist in the op-log schema before the first learner edit is stored or evidence for the pilot's first case will not exist, and the explicit exclusions plus the notice are what let an institution's privacy office approve the collection.

**Acceptance:**
- The shared op-log schema includes the listed fields; replaying a log still reproduces the submission modelHash (SIM-SCH-02 AC).
- A JSON import of 200 members is logged as one bulk op with source=import_json, count=200, file hash and any provenance stamp; a clipboard paste of 40 entities is logged as source=paste with the stamp classification.
- EditCadenceSummary is computed at submit time, included in the submission pin set and reproducible from the log by a test.
- A CI schema test asserts that no keystroke-timing, clipboard-content, screen or camera fields exist in the op log or telemetry; the notice text is generated from the schema so it cannot drift.

### GAP5-EXAM-01 Exam-mode lockdown profile enforced server-side

An exam-mode profile is a per-task setting versioned with the task: hints off, self-check off, live utilization and code-check overlays off (the checks-library artifact is not delivered to exam sessions and no check endpoint responds), analysis results visibility (full | deflections and forces only | none), coach feedback and reference solution withheld until the window closes, task discussions hidden during the window, exports, downloads, share links and screenshot downloads disabled (required snapshots are captured into the submission bundle only), clipboard paste allowed but logged, and the window and single-session rules of GAP5-EXAM-02. Everything that carries data is refused at the API with an audited exam_mode error rather than hidden in the UI.

**Why:** Structural GRD-04 and product PER-02 both leave 'hide D/C ratios during exams' as an open question; a single profile enforced at the API is the only way an instructor can later prove that the learner did not see code checks.

**Acceptance:**
- The exam profile JSON schema is part of the task definition, validated by the publish gate, and any change creates a new task version.
- In an exam session, requests for hints, self-check, the checks-library artifact, exports and share-link creation return 403 with reason exam_mode and create exam_violation signals of severity notice.
- Live analysis still runs in the browser at the configured results-visibility level; with 'none' the client never requests solver results for display (e2e test).
- Authors can preview the task as a learner in exam mode; required snapshots are captured into the bundle without a download path.

### GAP5-EXAM-02 Fixed time window, single active session and accommodations

Exam mode supports an absolute open/close window per offering (cohort offsets honored) and/or a duration from first open, both enforced with server time as the only authority and with the learner's SCH-01 accommodation multiplier and individual extensions applied automatically; ops arriving after the effective close are rejected and the last accepted draft is auto-submitted at close when the author enables it (SUB-02). Only one active workspace session per learner and task is allowed: a second tab or device sees a 'session already active' screen with a take-over action that terminates the first session, and takeovers, refused ops and reconnects are recorded in the attestation (GAP5-EXAM-04). The visible countdown resyncs to server time every 30 s and a short network loss does not end the session.

**Why:** Fixed windows and single sessions are what make an in-class design exam administrable, and automatic accommodations are a legal requirement for US institutions (ADA) that SCH-01 already models.

**Acceptance:**
- Ops received after the learner's effective close instant are rejected and logged; the auto-submitted version equals the last accepted model hash.
- A learner with a 1.5x multiplier on a 120-minute exam gets 180 minutes with no per-task setup; an individual extension shifts the close for that learner only.
- Opening the task in a second browser does not create a second session; take-over invalidates the first within 5 s and both events appear in the attestation.
- A 60 s network loss preserves the session and the countdown resumes from server time on reconnect.

### GAP5-EXAM-03 Visible exam-mode signaling and pre-start disclosure

Before starting, the learner sees a pre-start screen generated from the profile that lists the window and duration, what is disabled (hints, self-check, code checks, exports, sharing), what is recorded (GAP5-EVID-01 fields plus any GAP5-EXAM-06 signals), the collaboration and AI-use policy and the honor pledge, and must take an explicit start action. During the exam the workspace shows a persistent, non-dismissable banner with the countdown, a distinct accent color and border, 'off' badges on disabled tools and accessible remaining-time announcements; the same signaling appears in the instructor's preview-as-learner.

**Why:** Learners must see the difference between a practice task and an exam before they commit; unexpected lockdown is the most common source of exam-day disputes.

**Acceptance:**
- Pre-start content is rendered from the profile flags, so no hand-written text can disagree with what is enforced.
- The banner cannot be hidden by panel layout or full-screen 3D and appears in any required snapshot captured in exam mode.
- Remaining time is announced via aria-live at 30, 10, 5 and 1 minute; countdown and banner meet WCAG 2.2 AA contrast.

### GAP5-EXAM-04 Exam-mode attestation per submission and instructor verification

Every submission version created under an exam profile stores an immutable attestation hash-linked to the version: profile id and version, effective window and duration after accommodations, session ids with start and end, client build hashes, which artifacts were served to each session, counts of refused hint, self-check, check-artifact, export and share requests, session takeovers, reconnects, ops rejected after close, whether the bundle was created inside the window, and proctoring verification results when GAP5-EXAM-05 is on. The review view shows the attestation as a green/amber/red summary with raw events expandable, and it is included in the submission pin set and the grade audit export (AIG REV-04).

**Why:** An instructor must be able to answer 'was the lockdown actually in force for this student' per submission, and the attestation equally protects the learner when the platform was at fault, for example a misconfigured profile.

**Acceptance:**
- The attestation is immutable, referenced from the submission pin set and present in the grade audit export within 10 s.
- A submission created after close is marked red with reason outside_window; a clean exam is green; refused requests alone are amber.
- If the checks-library artifact or hint content was served to an exam session, a platform_fault signal is raised and the attestation shows it, so misconfiguration is attributable to the platform, not the learner.

### GAP5-POL-01 Per-task collaboration and AI-use policy

Each task version declares a collaboration policy (individual: no sharing of models or memos; group: team submission per the COLLAB gap with within-team sharing expected; discussion-allowed: concepts may be discussed, models and memos are individual, collaborators must be named at submission) and an AI-use policy (prohibited; allowed with disclosure of tools and purpose; allowed), with course and institution defaults when a task does not override. The policies are displayed on the task page, in the workspace header and on the pledge screen, and the similarity report and case view show the policy in force so reviewers interpret similarity in context.

**Why:** Similarity means different things under different policies, and TRU-01's per-task collaboration policy needs the AI-use axis to answer the question instructors now ask first.

**Acceptance:**
- Both policy enums exist on the task definition with course and institution defaults and visible inheritance in the task builder.
- Under discussion-allowed the submission form requires a collaborators field (which may be 'none'); under allowed-with-disclosure it requires an AI-use disclosure field; both are stored with the pledge record and shown to the reviewer.
- The similarity report header and the case view display the collaboration and AI-use policy of the task version.

### GAP5-POL-02 Honor pledge capture bound to the submission version

At every submit the learner must affirmatively accept the honor pledge: the institution's base text (TRU-01) plus an automatically generated paragraph stating the task's collaboration and AI-use policy and exam profile if any, together with the collaborators and AI-use disclosure fields of GAP5-POL-01. The pledge record (pledge text version id, rendered text hash, server acceptance timestamp, actor, submission version id, disclosures) is immutable, included in the submission pin set, shown on the receipt and copied into any case; auto-submitted drafts record pledge_status = not_captured instead of an implied acceptance.

**Why:** A pledge bound to the exact version and policy text is what institutions cite in conduct proceedings; a pledge stored once per task, or implied by the act of submitting, is not evidence.

**Acceptance:**
- The submission API rejects a submit without a pledge acceptance object; the receipt shows the pledge text hash.
- Changing the institution pledge text creates a new pledge version; existing records keep the text they were accepted under and can be rendered verbatim.
- Auto-submitted versions carry pledge_status = not_captured and the review view displays it.
- Acceptance is one audited event keyed by actor id; no IP address or device fingerprint is stored on the pledge record.

### GAP5-AI-01 AI-written memo policy: no automated AI-writing detectors; product-native authorship signals

Bridle does not run, integrate or display AI-writing detectors, and detector output is never admissible evidence in a case; this is stated on the institution policy page and in the learner notice. Authorship is instead supported by signals the product already produces: the grader's claim verification (AIG LLM-03) marks memo claims contradicted by the learner's own model, a memo-model coherence check lists members, combinations, loads or values named in the memo that do not exist in the submitted model or scenario instance (grading evidence plus an instructor-visible notice signal), process evidence (a 900-word memo pasted in one event versus typed over 40 minutes), and the per-task AI-use policy with disclosure. The memo editor shows the policy, what is logged and that the memo is graded on consistency with the learner's own design.

**Why:** AI-text detectors have documented false-positive problems and no defensible per-learner error rate (OpenAI withdrew its classifier in 2023 and universities such as Vanderbilt disabled vendor detectors), and pilot institutions will ask for the vendor's position in procurement; instructors still need usable signals.

**Acceptance:**
- No dependency on or UI for AI-writing detection exists and the case evidence schema has no AI-probability field (schema test).
- The coherence check runs on every graded memo and lists unresolved references with the memo excerpt; a fixture memo citing a non-existent member 'B7' and a combination not in the instance is caught.
- The memo editor shows the versioned AI-use policy and logging notice before the first edit.

## Should (v1.x)

### GAP5-MEMO-01 Memo similarity and copied-task-text detection

Justification memos are normalized (lowercase, punctuation stripped, numbers and unit strings replaced by placeholder tokens so scenario-specific values do not matter), fingerprinted with k-gram winnowing (k = 5 words, window 4, 64-bit hashes) and compared pairwise within the GAP5-FP-02 scope. Fingerprints that belong to task text (task brief, scenario description, memo section prompts, rubric descriptors, clause explanations, platform help) are subtracted first, and the share of memo tokens originating from task text is reported separately as 'copied task text', a low-effort indicator for the instructor rather than an integrity signal. Pairs at or above the threshold (default 30% shared fingerprints after exclusion and at least 40 matched words) appear in the same report as model pairs with side-by-side highlighted passages, with the same no-automatic-penalty rule.

**Why:** Memos are the easiest part of a submission to copy; the AI grader's claim verification (AIG LLM-03) catches contradictions with the model but not shared prose.

**Acceptance:**
- Two memos differing only in numbers and units score >= 0.95; a memo consisting only of quoted task brief scores 0 similarity and a copied-task-text share near 100%.
- Matching passages are highlighted side by side and task-text passages are shaded distinctly.
- Memo pairs create IntegritySignal records of type memo_similarity with the same visibility and audit rules as GAP5-FP-03.
- Comparison of memos up to the 1,500-word limit completes in < 200 ms per pair; a 500-learner cohort completes within the same window as the model job.

### GAP5-EVID-02 Process timeline viewer with replay for reviewers

Instructors reviewing a submission, a similarity pair or a case can open a process timeline showing sessions on a time axis, model-hash plateaus, an element-count sparkline, bulk and external-paste events, analysis, self-check and hint events, exam-mode markers, and a 'replay to this point' control that reconstructs the model at any op in a read-only 3D view. Two learners' timelines can be aligned on one axis with both submission times marked to show, for example, a model that appeared fully formed in one bulk event shortly after a counterpart submitted.

**Why:** Process evidence only helps if a reviewer can read it in minutes; replaying the op log is the most persuasive and least contestable evidence in a case.

**Acceptance:**
- A 10,000-op timeline renders in < 2 s and replay to any op completes in < 3 s for Tier-M models.
- The aligned two-learner view marks both submission instants and highlights bulk events within 24 h of the counterpart's submission.
- Each timeline view is written to the disclosure log with viewer, purpose (review or case id) and time.

### GAP5-EVID-03 Retention policy, legal hold and learner self-access to process evidence

Raw op logs and draft timelines for task-bound models are retained for 12 months after the offering end date by default (tenant-configurable 6 to 24 months) and then reduced to the EditCadenceSummary, which follows the submission's retention (NFR PRIV-03, LMS DAT-03); an open case or legal hold extends retention until closure plus the appeal window. Learners can view their own process timeline at summary level, obtain the full log through the DSAR export (PRIV-02, DAT-02), and are told when a reviewer viewed their timeline as part of a case against them.

**Why:** GDPR transparency and access rights and FERPA inspection rights apply to process data as soon as it is used in a decision about a learner; bounded retention is also what keeps the op-log store affordable.

**Acceptance:**
- The daily retention job reduces expired op logs to summaries and reports counts; held logs are skipped and the hold reason is logged.
- The learner timeline view shows sessions, active minutes and bulk events without instructor annotations; DSAR export includes the full op log in the documented JSON format.
- Changing the retention setting applies to future expirations only and is audited.

### GAP5-EXAM-05 External proctoring integration (Safe Exam Browser keys; 1EdTech Proctoring Services later)

An exam profile can require Safe Exam Browser: the task is served only when the request carries a valid X-SafeExamBrowser-ConfigKeyHash or X-SafeExamBrowser-RequestHash (SHA-256 over the absolute request URL and the Config Key or Browser Exam Key stored on the profile, per the SEB developer documentation), with the SafeExamBrowser.security JavaScript API as the fallback where the WKWebView engine cannot send headers, and the institution-managed .seb configuration available for download. Later, Bridle can act as the assessment platform in the 1EdTech Proctoring Services profile on LTI 1.3 or run inside an institution-LMS launch where the institution's own proctoring is active. Verification outcomes are written to the attestation, and Bridle never builds webcam, gaze or emotion-based monitoring of its own.

**Why:** Institutions with high-stakes exams already own proctoring; validating SEB keys is small work that makes Bridle usable in existing exam halls, whereas camera-based monitoring is out of scope and, under EU AI Act Annex III 3(d) and the Article 5 ban on emotion recognition in education, legally fraught.

**Acceptance:**
- With SEB required, a request without a valid key hash receives an exam-entry page explaining the requirement; with a valid hash the workspace loads and the key is re-verified on every workspace request during the window.
- The attestation records the verification method and result per session.
- The 1EdTech Proctoring Services flow (could) passes an end-to-end test against a reference proctoring tool and records start and end events in the attestation.

### GAP5-POL-03 Model sharing before deadlines and export provenance stamps

Models bound to an open task (draft or submitted, before the learner's effective close) cannot be shared through read-only links or copied into the sandbox for sharing unless the task's collaboration policy is group (team members only); the restriction lifts at the learner's close date or at the author's reveal setting. Every export of a task-bound model (JSON, CSV, DXF) and every clipboard copy of entities carries a provenance stamp (task version id, exporting learner's pseudonymous id, timestamp, source model hash) in metadata; on import or paste the stamp is written to the op log (GAP5-EVID-01), and a stamp from a different learner on the same open task raises a foreign_provenance signal (high). The stamp is not a lock, but it makes the most common copy path leave a trace.

**Why:** SUB-03 asked to restrict sharing before deadlines; provenance stamping is the cheap counterpart that turns export-and-import copying into evidence without forbidding legitimate reuse of one's own earlier work.

**Acceptance:**
- Share-link creation for an open individual task returns a policy error naming the close date; after close the link opens in the PER-03 viewer.
- Exported JSON contains a provenance object; importing it into another learner's draft for the same open task logs a bulk op with the stamp and creates a foreign_provenance signal visible in the similarity report.
- Sandbox (non-task) models and share links are unaffected.

### GAP5-AI-02 Prompt-injection attempts routed to the integrity queue with neutral learner messaging

When the grader screen (AIG SEC-01) flags instruction-like content in a memo, appeal text or element labels, the grade is held for review as today and one IntegritySignal of type prompt_injection (high) is created with the excerpt, classifier version and the clean-twin score, landing in the integrity queue (GAP5-CASE-01) where the instructor decides whether to open a case. The learner sees the same provisional-grade message as for any held grade and learns of the excerpt and policy only if a case is opened; there is no automatic penalty and the screen's reasoning is never shown to learners. The memo editor notice states that text addressed to the grader rather than to a human reader is reported to the instructor.

**Why:** SEC-01 flags attempts for 'academic-integrity review' but no queue, message or decision path exists; a consistent path prevents both silent zeroing and silent ignoring.

**Acceptance:**
- Every SEC-01 flag creates exactly one prompt_injection signal linked to the grade, visible in both the review queue and the integrity queue.
- Learner-facing messages for held grades are identical for injection flags and low-confidence flags (no information leak, verified by snapshot test).
- A red-team memo attempting to raise the score is graded on its evidence, the signal appears, and the score equals the clean twin's.

### GAP5-CASE-01 Integrity queue and case lifecycle

An integrity queue per course (and per institution for the integrity officer role) lists open signals and cases; an instructor opens a case from any signal, submission or manually, naming the subject learner(s), submission version(s), the policy in force and a reason. Case states are open, under_review, awaiting_learner_response, decided and closed, plus appealed and appeal_decided (GAP5-CASE-03), with server-enforced transitions, default 14-day decision due dates, reminders and filters by state, task, signal type and age. Opening a case can place the affected grade on hold (provisional), and the learner is notified when the instructor chooses notify or when the institution setting forces notification on open.

**Why:** Without a lifecycle, flags end up in email threads and the audit trail breaks; institutions require a record from first notice to final decision.

**Acceptance:**
- Illegal state transitions are rejected by the API; every transition stores actor, timestamp and reason.
- A case can reference several learners, each with their own notification, response and outcome.
- Grade hold is reversible and shows to the learner as 'under review' with no reason unless they have been notified.
- Overdue cases trigger instructor notifications (LMS NTF-01) and queue counts appear on the instructor dashboard.

### GAP5-CASE-02 Evidence bundle, learner response and privacy redaction

Evidence attaches to a case as typed items (similarity pair with frozen fingerprints and side-by-side view state, process timeline ranges, exam attestation, memo and prompt-injection excerpts, provenance stamps, instructor-uploaded files, notes), each recording who attached it and when, and attaching places the referenced op logs, snapshots and prompts under legal hold. The learner can read the case summary and the evidence that concerns them with counterparts pseudonymized and counterpart models or memos shown only as highlighted overlapping regions, and may respond with text and attachments within a configurable window (default 7 days); instructors can export the case file (PDF and JSON) with the same redaction for the institution's conduct office.

**Why:** FERPA and GDPR both forbid disclosing another student's record; a case tool that showed the accused learner the counterpart's full model would be unusable at a US university.

**Acceptance:**
- The learner view shows their own model in full and the counterpart only as highlighted overlapping regions with a pseudonymous id; an API test confirms no counterpart names, ids or full documents leak.
- Attaching evidence sets legal hold on referenced logs and snapshots (interplay with PRIV-03 and DAT-03) and the hold is released at closure plus the appeal window.
- Case export produces a complete PDF with evidence captions in < 30 s and is written to the disclosure log.
- Learner responses are stored immutably and screened like appeals (AIG SEC-01) before any AI-assisted reading.

### GAP5-CASE-03 Outcomes, grade impact through grade history, appeal path and audit trail

A decided case records an outcome (no_action, warning, resubmission_required, grade_adjustment in points or percent on a named grade, task_zero, referred_to_institution) with a written rationale; grade impacts are applied as LMS GRD-04 overrides whose reason is the case id, never by editing a score, and are reversible by the appeal decision. The learner may appeal once within the institution's window (default 10 days) to a second decider (course lead, department or integrity officer) who sees the full case and records the final outcome. Every action is an append-only audit event (AIG REV-04, LMS DAT-01), the case timeline is exportable, and closed cases stay readable for the grade-record retention period.

**Why:** Routing the grade impact through grade history keeps gradebook exports, LTI passback and regrades consistent, and an appeal path is a procurement requirement.

**Acceptance:**
- A grade_adjustment outcome creates a GRD-04 override with reason = case id and the adjusted score appears in the gradebook within 60 s; reversal on appeal creates a further override, never a deletion.
- The appeal decider must differ from the original decider (enforced server-side).
- The audit export of a case lists every state change, evidence attachment, notification and decision with actor and timestamp.
- Per-offering outcome statistics (counts by outcome, median time to decision) are available without learner identifiers.

### GAP5-INST-01 Institution integrity policy settings and integrity officer role

Institution admins configure the honor pledge base text, default collaboration and AI-use policies, similarity scanning (on/off, cohort-only or plus prior offerings, thresholds and component weights), memo similarity, process-evidence retention (6 to 24 months) and learner self-view level, exam-mode defaults (SEB allowed, attention signals allowed, default results visibility), case settings (notify learner on open, decision due days, appeal window, who decides appeals) and notification templates. An integrity officer role (extending LMS ROLE-01) has read access to all cases and reports in the institution without grading rights; all changes are audited, stamped on later signals, and apply to task versions published after the change unless the admin explicitly applies them to open offerings. MVP runs on documented defaults (pledge editable, scanning on with cohort scope, 12-month retention).

**Why:** Integrity norms differ by institution and country and the pilot institution's policy office cannot sign off without them, but the MVP can run on fixed documented defaults.

**Acceptance:**
- Every setting has a documented default and produces an audit event on change.
- Threshold and weight changes take effect at the next similarity run and the settings hash is stamped on resulting signals.
- The integrity officer role can read all cases and reports in the institution and cannot grade, override or release grades (permission test).
- The settings page lists the open offerings affected before a change is saved.

## Could (later)

### GAP5-EXAM-06 Optional deterministic attention signals in exam mode (no AI monitoring)

Institutions may enable, per exam profile and with a disclosure line on the pre-start screen, two deterministic signals: window visibility changes (tab hidden/visible) and full-screen exits, each as timestamped counts. They appear in the attestation as information only, carry no score, no colored verdict and no automated suspicion rating, and are off by default; no webcam, microphone, screen recording, keystroke dynamics or behavioral profiling is ever collected.

**Why:** Some instructors want a minimal signal for in-room exams, but anything beyond counts becomes live monitoring and profiling under EU AI Act Annex III 3(d), which the product deliberately avoids.

**Acceptance:**
- Enabling requires both the institution setting and the task profile flag and automatically adds the disclosure line.
- The signal schema contains only event type, timestamp and count fields (schema test).
- The attestation shows the counts without deriving any verdict from them.

### GAP5-AI-03 Authorship follow-up: design-defense questions generated from the learner's own submission

On instructor request the platform generates three to five short questions specific to a submission from its model, scenario instance and evidence digest (for example why the brace in bay 2 is heavier than in bay 3, or which combination governed member M14 and why), usable in an oral check or as a timed written follow-up inside an exam profile. Answers are graded by the instructor with the evidence shown alongside, and the outcome (consistent, partially consistent, inconsistent) can be attached to a case or simply recorded; questions are never used for automatic scoring.

**Why:** A viva voce is the oldest and most accepted authorship check; generating questions from the learner's own model makes it cheap enough to use routinely under an 'allowed with disclosure' AI policy.

**Acceptance:**
- Generated questions reference only entities and evidence present in the submission (same grounding validator as the AI grading stage).
- A written follow-up can run under an exam profile with a 15-minute window and is linked to the original submission version.
- The instructor-recorded outcome is attachable to a case as typed evidence.

## Non-functional targets

| id | title | target |
|---|---|---|
| GAP5-NFR-01 | Similarity job throughput | Pairwise comparison for a 500-submission cohort (124,750 pairs) completes within 10 minutes of the close date using MinHash sketches; a nightly prior-offering run over 5,000 submissions completes within 60 minutes on one worker. |
| GAP5-NFR-02 | Fingerprint precision and recall | On a synthetic benchmark of 1,000 independently generated designs for constrained tasks the outlier rule flags <= 1% of pairs; on 200 copied-and-perturbed pairs (renumbered, re-seeded, every section bumped one size, 10% of members moved) recall >= 95%; both measured in CI on every fingerprint_version change. |
| GAP5-NFR-03 | Exam-mode enforcement integrity | 100% of hint, self-check, checks-artifact, export and share-link requests in exam sessions are refused at the API (e2e suite); zero data-bearing exam restrictions implemented only client-side; session take-over effective within 5 s; 100% of ops after close rejected. |
| GAP5-NFR-04 | Attestation and audit completeness | 100% of submissions under an exam profile carry an immutable attestation; case and grade audit exports complete in < 10 s; every signal, case transition and evidence attachment is an append-only audit event. |
| GAP5-NFR-05 | Learner-data confidentiality in integrity surfaces | Zero counterpart identifiers, names or full documents in learner-facing APIs, feedback, notifications or gradebook exports, verified by an automated contract test on every build; every instructor view of a report, timeline or case is written to the disclosure log. |
| GAP5-NFR-06 | Process-evidence overhead | Integrity fields add <= 25% to per-op storage; EditCadenceSummary computed in < 1 s at submit; timeline render < 2 s and replay < 3 s for 10,000-op logs on Tier-M models; retention job reduces expired logs daily with a count report. |
| GAP5-NFR-07 | No-AI-monitoring guarantee | Schema and dependency tests prove no webcam, microphone, screen, keystroke-timing, clipboard-content or AI-writing-probability fields or libraries exist in the product; attention signals (if enabled) are limited to two event types with timestamp and count. |

## Domain notes (for architecture and UX)

1. CROSS-REFERENCE AND SUPERSESSION (for the merge step; ids namespaced per the critic's resolution)
- LMS SUB-03 (should): honor pledge -> GAP5-POL-02; similarity across cohort and prior offerings with starter exclusion and no penalties -> GAP5-FP-01/02/03 and GAP5-MEMO-01; draft activity timeline -> GAP5-EVID-01/02; restrict model-link sharing before deadline -> GAP5-POL-03; 'editing locks after close' remains SUB-02/SEC-06.
- AIG SCN-03 (could): superseded by GAP5-FP-01/02/03 (now must at basic level). AIG SEC-01 'flagged for academic-integrity review' -> GAP5-AI-02. AIG AGG-02 / LMS GRD-02 integrityFlag -> set by GAP5-SIG-01 high-severity signals.
- PRD TRU-01 (should): randomization -> GAP5-RAND-01; honor statement -> GAP5-POL-02; similarity flags with pair and matching elements, never auto-penalize -> GAP5-FP-03; per-task collaboration policy -> GAP5-POL-01. PRD PER-02 'disable code-check previews for exam-style tasks' and PER-10 'integrity settings' -> GAP5-EXAM-01 and GAP5-INST-01.
- STR GRD-04 'exam mode shows nothing until the deadline' -> GAP5-EXAM-01 (results visibility and feedback reveal). STR GRD-05 anti-gaming: manipulation rules stay deterministic grading evidence; 'submitting the reference solution verbatim' becomes a reference_match signal (hold for review) pending the open question.
- WS DET-01 'hash identifies a model for plagiarism comparison': modelHash is exact-copy identity only; similarity uses the GAP5-FP-01 fingerprint. WS CAP-01 screenshots and IO-01/02/03 exports: disabled in exam mode (GAP5-EXAM-01) and stamped with provenance (GAP5-POL-03).
- SIM-SCH-02 op log 'logged for replay and learner-process analytics' -> field profile in GAP5-EVID-01. DM gap (#1) event envelope class 'process/op log' should adopt the GAP5-EVID-01 fields and retention; the Submission Pin Set gains fingerprint_version + component hashes, EditCadenceSummary, pledge record, exam attestation reference.
- COLLAB gap (#6): team submissions compared as one unit; actor ids on every op (already required there) are the basis for GAP5-EVID-01. DLV gap (#3) memo editor 'paste provenance for integrity' = GAP5-EVID-01 memo paste events with the GAP5-POL-03 stamp classification. OPS gap (#4) impersonation and support access must write disclosure-log entries when touching integrity data.

2. FINGERPRINT v1 ALGORITHM (implement once in the shared schema package next to canonicalize(); Rust core with TS bindings or pure TS; deterministic, versioned as fingerprint_version)
- Input: canonical model (SI, Z-up, XZ plane for 2D), task version (starter element id set, locked/hidden ids, TB-11 parameter bindings), scenario instance (parameter values, scenario-generated load ids).
- Comparative subset: elements whose stable ids are not in the starter set, plus starter elements whose geometry or properties differ from the starter; exclude locked/hidden author elements and scenario-generated loads (loads carry a generator provenance field). Low-information flag if subset < 10 elements or < 30% of the model.
- Graph: vertices = nodes; edges = members (frame, truss, spring); plate = hyper-vertex connected to its corner nodes. Initial vertex label = (6-bit restraint pattern, degree); edge label = (element kind, 12-bit end-release pattern). WL refinement for 3 iterations: label_{i+1}(v) = H64(label_i(v) || sorted multiset of (edgeLabel || label_i(u)) over neighbors), H64 = SHA-256 truncated to 64 bits. topoHash = SHA-256(sorted multiset of final labels || edge count || plate count). topoSketch = MinHash(128 permutations) over all labels from all iterations (WL subtree kernel). Invariant to ids, order, geometry, units.
- Geometry: for each node axis bound to a TB-11 parameter (span, bay width, story height, offsets), divide by the instance value; otherwise translate to the subset's min corner and divide by the bounding-box extent; quantize to 0.005 (1/200). Evaluate the 8 plan-view symmetries (rotations by 90 degrees and mirrors) and keep the maximum similarity. Token = (qx, qy, qz, final WL label). geomHash = SHA-256(sorted tokens); geomSketch = MinHash(128).
- Sections: per member token = (edge WL label, section family [W, HSS-rect, HSS-round, C, L, WT, pipe, RC-rect, ...], weight-rank decile of the section within its family in the task's catalog). Partition signature = sorted list of same-section groups described as (group size rank, sorted WL labels). sectionHash = SHA-256(partition signature); sectionSketch = MinHash over both token sets.
- Loads: learner-applied loads only; token = (kind [nodal, udl, trapezoidal, thermal, area, settlement], target WL label, direction binned to 45 degrees, magnitude normalized by the instance's reference magnitude of the same kind and bucketed to 10%, load-case kind D/L/Lr/S/W/E/T). loadHash, loadSketch as above.
- Composite S = 0.40*J_topo + 0.25*J_geom + 0.20*J_sect + 0.15*J_load (institution-configurable); J from sketches, set to 1.0 when exact hashes match. 'Exact design match' = topoHash and geomHash equal outside the starter with >= 10 learner elements.
- Baseline and flagging: compute S over all cohort pairs (sample 50k pairs if larger); flag if S >= 0.90 and S - median >= 3*MAD, or exact design match. Store per pair: component values, baseline percentile, element correspondence (by WL label alignment) for highlighting, submission timestamps.
- Scope: same task version in the offering; prior offerings of the same lineage in the tenant when enabled; never cross-tenant. Teams compared as units.

3. MEMO SIMILARITY: normalize (NFKC, lowercase, strip punctuation, numbers -> <num>, unit strings -> <unit>, member/node labels -> <id>), k = 5 word k-grams, winnowing window 4, 64-bit hashes; exclusion set = fingerprints of task brief, scenario description, memo section prompts, rubric descriptors, clause explanations, help text; similarity = shared / min(|A|, |B|); flag at >= 0.30 and >= 40 matched words; copied-task-text share reported separately. Memo limit 1,500 words (LLM-03) keeps pair cost trivial.

4. PROCESS-EVIDENCE FIELDS (op-log class of the DM event envelope)
- Op: op_id (ULID), model_id, revision, actor_id, session_id, ts_client, ts_server, kind [add, update, delete, batch, import, paste, bulk_transform, undo, redo], entity_ids, entity_count, bulk {source: import_json | import_csv | import_dxf | paste | array | mirror | replicate | template, count, file_hash?, provenance_stamp? {task_version_id, exporter_pseudonymous_id, exported_at, source_model_hash}}, exam_profile_id?, client_build.
- Session: session_id, actor_id, started_at, ended_at (last activity + idle timeout), client_build, exam_profile_id?, artifacts_served[] (engine, checks-library, hint endpoints), takeover_of?.
- Memo events: autosave {ts, char_delta, word_count}; paste {ts, length, classification internal | external, stamp?}.
- Other events: analysis_run {ts, model_hash}, self_check {ts, summary}, hint {level, ts}, export_attempt, share_attempt, visibility_change and fullscreen_exit (exam-only, when enabled).
- Explicit exclusions: keystroke timing, clipboard contents, screen or camera capture, raw user agent, IP on pledge records.
- EditCadenceSummary: first_edit, last_edit, session_count, active_minutes (ops within 5-minute idle windows), ops_total, ops_per_active_minute, max_bulk_count, bulk_event_count, external_paste_count, distinct_autosave_hashes, minutes_from_last_bulk_to_submit, memo_words_typed, memo_words_pasted.
- Retention: raw logs 12 months after offering end (6-24 configurable) then summary only; legal hold on case evidence; summary follows submission retention (PRIV-03 default 5 years then anonymized).

5. EXAM PROFILE (task definition fragment) AND ATTESTATION
- Profile: {id, version, hints: off, self_check: off, code_checks: off, results_visibility: full | analysis_only | none, discussions_hidden: true, exports: off, share_links: off, screenshot_download: off, paste: logged, window: {open_at, close_at} | duration_minutes, single_session: true, auto_submit_at_close: bool, reveal_feedback_at: close | release, proctoring: {seb: {required, config_key, browser_exam_keys[], seb_config_url}, lti_proctoring: {enabled, tool_registration}}, attention_signals: off}. Accommodation multipliers and extensions from SCH-01 apply automatically.
- Enforcement points (server): hint endpoint, self-check endpoint, checks-library artifact delivery, export endpoints, share-link creation, discussion listing, op ingestion after close, session registry (one active session per learner-task, take-over semantics). Client: results visibility, banner, disabled tools; the client build hash is recorded so a tampered client is detectable.
- Attestation: {submission_version_id, profile_id, profile_version, effective_open, effective_close, multiplier, extensions, sessions[{id, start, end, client_build, artifacts_served, takeover_of}], refused_requests {hints, self_check, checks_artifact, export, share}, ops_rejected_after_close, submitted_inside_window, proctoring {method: seb_header | seb_js | lti_proctoring | none, result}, attention_signals?, verdict: green | amber | red, reasons[]}. Verdict rules: red = outside window or submission bundle created outside window or proctoring failed when required; amber = refused requests > 0, takeover, or reconnect gaps > 5 minutes; green otherwise. platform_fault overrides to 'platform' when restricted artifacts were served.
- SEB verification: X-SafeExamBrowser-ConfigKeyHash = SHA-256 over absolute request URL + Config Key (stable across SEB versions); X-SafeExamBrowser-RequestHash = SHA-256 over absolute request URL + Browser Exam Key (version-specific; keep one BEK per supported SEB build). Headers are sent only when the .seb config enables sending keys; on macOS/iOS WKWebView use the SafeExamBrowser.security.configKey JS API. 1EdTech Proctoring Services 1.0 (July 2019) is LTI 1.3-based with the assessment platform launching the proctoring tool; message names seen in implementations (LtiStartProctoring, LtiEndAssessment) must be confirmed against the member spec before design.

6. INTEGRITY SIGNAL SCHEMA: {signal_id, type [wrong_instance, model_similarity, memo_similarity, reference_match, foreign_provenance, prompt_injection, exam_violation(subtype: outside_window | session_takeover | refused_request), platform_fault, manual], severity [info, notice, high], tenant_id, offering_id, task_version_id, subject_submission_version_ids[], counterpart_pseudonymous_ids[], metrics{}, evidence_refs[{kind, ref, hash}], detector_version, settings_hash, created_at, created_by (system | actor_id)}. Severity defaults: wrong_instance high, model_similarity high when flagged by the outlier rule else info, memo_similarity high when flagged, reference_match high, foreign_provenance high, prompt_injection high, exam_violation notice (outside_window high), platform_fault notice. Only high sets integrityFlag.

7. CASE STATE MACHINE AND ROLES: open -> under_review -> awaiting_learner_response -> decided -> closed; decided -> appealed -> appeal_decided -> closed. Outcomes: no_action, warning, resubmission_required, grade_adjustment {grade_id, points | percent}, task_zero, referred_to_institution. Grade effects always via GRD-04 overrides with reason = case id. Roles: instructor (own sections), course lead (all sections of the course), integrity officer (institution-wide read, appeal decider option, no grading), platform support (no case content without consent-logged impersonation). Learner view: own evidence only; counterparts pseudonymized; overlapping regions only.

8. INSTITUTION SETTINGS (defaults): pledge_text (platform default text, versioned); default_collaboration_policy = individual; default_ai_use_policy = allowed_with_disclosure (recommend confirming with the pilot); similarity_scanning = on; similarity_scope = cohort; similarity_threshold = 0.90; mad_multiplier = 3; weights = 0.40/0.25/0.20/0.15; memo_similarity = on at v1.x; process_retention_months = 12; learner_timeline_view = summary; seb_allowed = true; attention_signals_allowed = false; exam_results_visibility_default = analysis_only; notify_learner_on_case_open = instructor_choice; case_decision_due_days = 14; appeal_window_days = 10; appeal_decider = course_lead | integrity_officer; draft_fingerprinting = off.

9. LEGAL AND POLICY NOTES
- FERPA (34 CFR Part 99): similarity reports, timelines and case files become education records once maintained for a decision; students may inspect their own records (institutions have 45 days) and never another student's, hence counterpart pseudonymization and overlap-only display; every school-official access is written to the disclosure log (DAT-01).
- GDPR: Articles 13/14 transparency for op-log collection (generated notice), Article 15 access (timeline export), Article 17(3)(e) legal-claims exemption for evidence under hold; update the DPIA (PRIV-02) to cover process evidence and similarity profiling.
- EU AI Act (Regulation (EU) 2024/1689): Annex III 3(b) covers AI evaluation of learning outcomes (already in NFR PRIV-04); 3(d) covers AI systems for monitoring and detecting prohibited behaviour of students during tests, and a Commission-linked presentation indicates plagiarism checks on submitted work without live monitoring fall outside 3(d) while live monitoring and any profiling fall inside; Article 5 bans emotion recognition in education. Secondary sources report the Annex III application date moved to 2 December 2027 under the Digital Omnibus; verify in the Official Journal. Design consequence: no camera/microphone/behavioral monitoring, attention signals limited to counts and off by default, similarity reported as decision support with human decision only, and documentation of these choices in the risk file.
- AI-writing detectors: OpenAI withdrew its AI text classifier in 2023 citing low accuracy, and universities such as Vanderbilt disabled Turnitin's AI indicator in 2023 over false positives; Bridle's position (GAP5-AI-01) is to exclude detector output as evidence and rely on product-native signals.

10. UX NOTES: similarity report = ranked table with per-component mini-bars, baseline histogram with the pair marked, side-by-side synchronized 3D viewers with matching elements in one color and differences dimmed, section diff table, cadence summaries, 'open case' action; timeline = horizontal sessions with hash plateaus and bulk markers, replay scrubber bound to a read-only workspace; exam mode = pre-start checklist screen generated from the profile, persistent top banner with countdown and distinct accent color, 'off' badges on hint/self-check/utilization tools, no download affordances; learner notice = one page per task listing recorded fields, retention and viewers; case view = tabs (summary, evidence, learner response, decision, audit) with redaction applied automatically in learner mode.

11. SUGGESTED MODULE PLACEMENT (greenfield; for the architecture phase): packages/schema (integrity-signal, exam-profile, attestation, op-log event types, pledge record, fingerprint v1 next to canonicalize()); services/integrity (fingerprint worker, similarity job with MinHash, memo winnowing, baseline statistics); services/api/integrity (signals, cases, institution settings, SEB verification middleware, exam session registry); apps/web/features/exam-mode (pre-start, banner, enforcement-aware tool state); apps/web/features/integrity (report, side-by-side viewer, timeline and replay, case UI); tests/integrity (invariance fixtures, precision/recall benchmark, red-team memos, exam-mode e2e).

12. REFERENCES USED FOR VERIFICATION: 1EdTech Proctoring Services overview https://www.1edtech.org/standards/lti/proctoring-services and specification https://www.imsglobal.org/node/184511 ; Safe Exam Browser Config Key documentation https://safeexambrowser.org/developer/seb-config-key.html and Browser Exam Key specification https://raw.githubusercontent.com/SafeExamBrowser/SafeExamBrowser-Website/master/developer/documents/SEB-Specification-BrowserExamKey.pdf ; EU AI Act Annex III commentary https://casrai.org/news/ai-act-annex-iii and https://media-and-learning.eu/files/2026/07/18June_auditorium_Limante-AI-in-Education_Limante.pdf (verify against the Official Journal text of Regulation (EU) 2024/1689).

## Risks

| risk | mitigation |
|---|---|
| False accusations when constrained tasks make independent designs converge, damaging learner trust and exposing the institution. | Cohort-baseline outlier rule, starter and reference exclusion, low-information labeling, no automatic penalty, evidence-first report with disclaimer, and the GAP5-NFR-02 precision benchmark gating every fingerprint change. |
| Op-log process evidence is perceived as surveillance by learners or rejected by the institution's privacy office. | Explicit schema-level exclusions (no keystroke timing, clipboard content, camera, screen), a generated 'what is recorded' notice on every task, learner self-view and DSAR export, bounded retention, and DPIA coverage. |
| Exam-mode restrictions are bypassed client-side (for example by running the checks WASM manually) or defeated by hand calculations, creating a false sense of security. | Withhold data-bearing artifacts and endpoints server-side, record served artifacts in the attestation, treat hand calculation as legitimate engineering, and position exam mode as 'not assisted by the platform' rather than 'uncheatable'. |
| Fingerprint invariance depends on complete TB-11 parameter bindings; tasks with partial bindings produce geometry mismatches between genuine copies. | Bounding-box fallback normalization, per-task 'binding coverage' shown in the report, and topology plus section components that do not depend on bindings. |
| Instructor pressure to add AI-writing detectors, or a competitor's checkbox feature, undermines the stated policy. | Documented policy with cited failure history, strong alternatives (coherence check, process timeline, disclosure, design-defense questions), and institution-level policy page that procurement can reference. |
| Scope creep in exam monitoring (attention signals, suspicion scores) moves the product into EU AI Act Annex III 3(d) high-risk territory and prohibited emotion recognition. | Attention signals limited to two deterministic counts, off by default, no verdicts derived; no camera or microphone features; classification recorded in the AI Act risk file maintained under NFR PRIV-04. |
| Case evidence retention collides with GDPR erasure requests or retention purges, destroying evidence mid-case or retaining data unlawfully. | Legal hold on attached evidence with documented lawful basis (legal claims exemption), counterpart pseudonymization, release of hold at closure plus appeal window, and purge dry-run reports (DAT-03). |
| Cross-section or cross-tenant leakage of similarity data violates tenant isolation or FERPA role limits. | Tenant-scoped similarity jobs covered by the isolation test suite, section-scoped instructor access, disclosure logging of every report view, and pseudonymous counterparts for prior offerings. |

## Open questions

- Does the pilot institution's conduct office want cases managed inside Bridle, or only an exported case file for their own system (for example Maxient)? This decides how much of GAP5-CASE-01..03 ships in v1.x.
- Structural GRD-05 treats 'submitting the reference solution verbatim' as a Critical scoring rule, while this domain routes reference_match as a signal with no automatic penalty; recommended resolution is hold-for-review rather than a score change, but the structural domain must agree.
- Is prior-offering comparison acceptable under the pilot institution's retention policy, given it requires keeping fingerprints (not models) beyond the op-log retention window?
- Exam-mode default results visibility: should design exams default to 'deflections and forces only' or 'none'? Recommended: analysis-only for Analyze/Check archetypes, none for Design exams.
- Are in-class (SEB-protected) exams part of the first pilot term, or are all pilot tasks take-home? This decides whether GAP5-EXAM-05 is needed before the pilot.
- What is the pilot institution's default AI-use policy for memos (prohibited versus allowed with disclosure), and does it already publish guidance that the pledge text should cite?
- Must learners always be notified when a case is opened (institution-forced), or is instructor discretion acceptable under the institution's conduct code?
- Will any pilot institution operate under EU law? That triggers the Annex III documentation for similarity profiling and the DPIA update for process evidence, and rules out attention signals in practice.
- Who holds the integrity officer role at the pilot institution, and should TAs ever see similarity reports for their sections?
- Should drafts be fingerprinted nightly (earlier signals, higher privacy expectations) or only submissions at MVP? Recommended: submissions only at MVP.
- Should the wrong_instance check also cover sandbox models re-used across tasks by the same learner (legitimate), to avoid self-matches?
