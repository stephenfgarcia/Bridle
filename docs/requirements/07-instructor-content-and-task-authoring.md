# Instructor content and task authoring

_Source: requirements discovery workflow `wf_6281c128-0bb` (domain agent), 2026-11-03. 44 requirements: 35 must (MVP), 8 should (v1.x), 1 could (later)._

## Summary

Authoring is where Bridle's differentiation is created: an instructor turns a structure, a site/environment scenario, constraints, a rubric, deterministic auto-checks, AI grading guidance and reference solutions into a versioned, calibrated simulation task that the engine and the AI grader can evaluate reproducibly. The key decisions implied are (1) the simulation task is a versioned JSON definition (code basis, environment, load cases/combinations, constraints, parameter specs, rubric, checks, hints, submission policy) stored alongside model snapshots, with code bases, section/material libraries and cost models modeled as pinned, versioned data rather than hard-coded logic; (2) the author edits the starter model, locks, reference solutions and checkpoints inside the same 3D workspace learners use, in an 'author mode' with extra tools; (3) grading is calibrated before publishing by running the full pipeline (checks + AI grader) on reference and distractor solutions and across sampled randomization seeds, and the publish gate refuses broken tasks; (4) published versions are immutable and pinned to attempts, with an explicit in-flight-cohort policy for grading-affecting changes; (5) guided lessons verify learner model state with a declarative checkpoint DSL that matches elements semantically (labels/coordinates with tolerance), never by internal ids. MVP should target one code family (recommended ASCE 7-22 + AISC 360-22 steel, SI/US units) and a starter template pack so instructors never begin from an empty tool; marketplace, real-time co-editing, parametric quizzes and psychometrics follow in v1.x and later.

## Must (MVP)

### TB-01 Create simulation task from template or blank

An author creates a simulation task by choosing a starter from the template library (platform pack or institution library) or starting blank, then works through a sectioned builder: Basics, Code & Units, Site & Environment, Loads, Constraints, Starter Model, Reference Solutions, Rubric & Checks, Randomization, Hints, Submission. Basics capture title, learning objectives, tags (structure type, code basis, topics), difficulty estimate, estimated time, point value and prerequisites. Drafts can be saved at any point.

**Why:** The simulation task is the core content unit of the Dedicated Simulation strategy; a sectioned builder with defaults keeps a large configuration approachable for instructors and buildable by a small team.

**Acceptance:**
- Author can create a task from any template or from blank; the draft opens in the builder with every section present and defaults applied.
- A task created from a template records provenance (source template id and version).
- Metadata fields (title, objectives, tags, difficulty, estimated time, points, prerequisites) are editable and searchable in the library.
- The builder shows per-section completion status and allows saving an incomplete draft.

### TB-02 Design code basis and unit system per task

Each task declares a code basis (MVP: one code family, recommended ASCE 7-22 loads + AISC 360-22 steel; Eurocode EN 1990/1991/1993, NSCP 2015, ACI 318 etc. as pluggable code modules later), a design method (LRFD/ASD or ULS/SLS) and a unit system (SI or US customary) with display precision. The code basis determines the available load-combination sets, resistance/safety factors, deflection and drift presets, section families and the checks the auto-checker and AI grader apply.

**Why:** Grading against real-world criteria is meaningless without a declared code; a per-task setting supports mixed-code curricula and future expansion without a rewrite.

**Acceptance:**
- Author selects code basis, design method and unit system; downstream pickers (combinations, limits, section families, material grades) filter to that basis.
- Changing the code basis on a task with existing combinations or limits warns and offers to remap or clear dependent settings.
- Code basis identifier and code-module version are stored on the task version and shown to learners in the task brief.

### TB-03 Site and environment scenario editor

Author defines the task environment: location/jurisdiction label, risk/importance category, wind (basic wind speed, exposure category, topographic and directionality factors), seismic (Ss, S1 or SDS/SD1, site class, R, Ie, Cd, Omega0, seismic design category), snow (ground snow load, exposure and thermal factors, roof slope), temperature range, soil (allowable bearing pressure, subgrade modulus, lateral earth pressure) and occupancy live-load presets. Environments can be saved as institution presets and reused.

**Why:** The environment scenario is what makes a task a real-world design problem; it drives load derivation, the governing combination and the AI grader's judgment of environmental appropriateness.

**Acceptance:**
- All listed parameter groups can be entered with units, are validated against plausible ranges, and each group can be marked not applicable.
- Author can save an environment as an institution preset and apply it to other tasks; the platform ships at least five presets (e.g., coastal high wind, high-seismic urban, mountain snow, temperate low hazard, tropical typhoon).
- The environment renders to learners as a site brief and is available to the auto-checker and AI grader as structured data.
- Individual environment values can be flagged as given or learner-must-derive (hidden from the brief, gradable).

### TB-04 Required load cases and combinations

Author declares which load cases (D, L, Lr, S, R, W, E, T, H, custom) the learner must define, with a mode per case: given value, derived from environment, or learner-derived. Author selects the combination set from the code basis (e.g., ASCE 7-22 LRFD 2.3.1 plus seismic 2.3.6, ASD 2.4.1, EN 1990 6.10/6.10a/b) or composes custom combinations as factors per case, and chooses whether combinations are pre-applied in the starter model, learner-defined and graded, or both.

**Why:** Correct load combinations are an explicit grading criterion; representing combinations as data lets the auto-checker compare sets and the engine compute envelopes.

**Acceptance:**
- Combination sets for the selected code basis are available as editable presets; custom combinations are validated (every referenced case exists, factors numeric).
- Per-case mode (given / derived-from-environment / learner-derived) is stored; learner-derived cases appear as gradable rubric evidence.
- The expected combination set is stored so the combinations-match auto-check can compare learner combinations with a factor tolerance of 0.01.
- Author can flag which combination(s) are expected to govern for the reference solution; this feeds feedback and AI grading guidance.

### TB-05 Design constraints editor with enforcement modes

Author defines constraints, each with an enforcement mode (hard: blocks submission; soft: penalized through a linked rubric criterion; info: displayed only): allowed/disallowed section families and specific sections, allowed materials and grades, budget via the cost model, maximum structure mass, deflection limits per member class (L/n or absolute), story drift limits, geometry envelope (bounding box, locked nodes/supports, maximum span, member count) and minimum/maximum member size. Violations are evaluated live in the learner workspace.

**Why:** Constraints turn an open sandbox into a well-posed design task and are the basis for economy and serviceability grading.

**Acceptance:**
- Every listed constraint type can be added, parameterized with units and assigned hard/soft/info; soft constraints must link to a rubric criterion.
- Section allow-lists support family-level rules (e.g., all W-shapes with depth <= 18 in) and explicit lists drawn from pinned libraries.
- Code-basis presets for deflection and drift (e.g., L/360, L/240, L/180, h/400, h/500) are offered; custom ratios are accepted.
- Hard-constraint evaluation uses the same rule engine in the builder, preview-as-learner and the learner workspace.

### TB-06 Starter model with element locks and workspace presets

Author builds or edits the starter model in the same 3D workspace learners use, in author mode, and marks nodes, members, supports, loads and plates as locked (not editable), hidden (helper geometry) or required (must persist in the submission). The author also presets the workspace for the task: visible tool palette, default camera, visible result overlays and unit display.

**Why:** Most tasks fix the problem geometry (spans, supports, applied loads) and leave only the design variables (sections, bracing, member layout) to the learner.

**Acceptance:**
- Lock, hidden and required flags can be set per element and per element class; locked elements render distinctly for learners and cannot be edited or deleted.
- Workspace presets (palette restrictions, default camera, overlays, units) are saved with the task and applied in preview-as-learner.
- The starter model must analyze without error before publish unless the author explicitly marks it as an intentionally unstable starting point.

### TB-07 Reference solutions

Author attaches one or more reference solutions as complete model states (built in the workspace or imported from a saved model) with metadata: approach label, expected score band and notes on why the design is good. Reference solutions feed calibration runs, anchor the AI grader on what good looks like, and support side-by-side comparison when reviewing submissions. Learners never see them unless a reveal policy allows it.

**Why:** Anchoring AI grading on instructor-validated designs reduces invented standards and gives calibration something concrete to test against.

**Acceptance:**
- At least one reference solution is required for any task whose rubric contains auto-checked or AI-graded design criteria (institution-configurable).
- Each reference stores the full model, an analysis-results snapshot, approach label and expected score band; multiple references with different approaches are supported.
- Reveal policy (never / after grading / after due date) is configurable per task.
- For randomized tasks a reference can be stored as a parametric model that re-analyzes per variant (used by PV-02).

### TB-08 Rubric builder with grading-dimension taxonomy

Author composes a rubric from criteria, each tagged with a grading dimension (strength, serviceability, stability, load combinations, environmental appropriateness, economy/material efficiency, constructability, engineering judgment/justification, communication), a weight and a scoring mode: levels with descriptors, points, or automatic (driven by linked auto-checks). Rubric templates per task type are provided and shareable within the institution; weights must sum to 100.

**Why:** The brief requires rubric-based grading on real-world criteria; a fixed dimension taxonomy gives the AI grader a stable schema and enables cross-task analytics.

**Acceptance:**
- Criteria can be added, reordered, weighted and linked to auto-check ids; submit-for-review/publish is blocked if weights do not sum to 100 (tolerance 0.01).
- Each level has a label, score and descriptor; the author may add exemplar text per level that is passed to the AI grader as guidance.
- A rubric can be saved as a template and applied to another task with dimension tags preserved.
- The rubric is rendered to learners before submission (transparent grading).

### TB-09 Auto-check configuration

Author configures deterministic checks that the analysis engine runs on submission: maximum demand/capacity ratio per member class, deflection and drift limits, stability (mechanism or singular stiffness, slenderness KL/r limits, buckling), global equilibrium of reactions, required supports and load cases present, combinations match, section and material allow-lists, budget and mass limits, geometry envelope, and connectivity (no floating nodes or disconnected members). Each check has parameters, tolerance, severity (hard/soft/info), score contribution and a learner-facing message.

**Why:** Deterministic checks make the majority of the grade reproducible and auditable; the AI grader is layered on top only for judgment-based criteria.

**Acceptance:**
- A catalog containing at least the listed check types is available; every check is parameterizable with units and tolerance.
- Checks link to rubric criteria; automatically scored criteria compute from check results by a documented formula.
- Author can run all checks against any reference solution from the builder and see pass/fail with measured values.
- Learner-facing messages support placeholders such as {member}, {value}, {limit}, {combination}.

### TB-10 AI grader guidance and human-review thresholds

Author configures how the AI grader applies judgment-based criteria: grading notes and expected insights (e.g., seismic combination should govern the columns), required concepts for the written justification, feedback tone and verbosity, relative weight of AI-judged versus deterministic criteria, and human-review triggers (low confidence, score near the pass threshold, disagreement with hard-check results). The grader model identifier and version are pinned per task version.

**Why:** AI grading on real-world criteria needs instructor intent to be reliable, and instructors need a safety valve for uncertain grades.

**Acceptance:**
- Guidance notes, required-concept list, tone and verbosity are saved with the task version and included in grader prompts.
- Review thresholds (confidence below X, absolute distance from pass mark below Y, hard-check disagreement) are configurable and route submissions to an instructor review queue.
- Grader model identifier and version are recorded on every grade and shown in the calibration report.
- Author can mark criteria as not awardable above level N without human confirmation.

### TB-11 Per-learner randomized parameters with deterministic seeds

Author defines parameters (numeric range with step and unit, choice set, or derived expression over other parameters) and binds them to starter-model coordinates, load magnitudes, environment values and constraint values, so that spans, bay counts, loads, wind speed, seismic coefficients or budget vary per learner. A seed is derived deterministically from task version, learner and attempt policy so the learner always sees the same variant and an instructor can reproduce it.

**Why:** Academic integrity requires variant problems; determinism is essential so grading, hints and reference analysis agree with what the learner saw.

**Acceptance:**
- Numeric, choice and derived parameter types are supported; derived expressions run in a sandboxed evaluator on both client and server.
- The same (task version, learner) pair yields identical parameter values on client and server; a cross-language test-vector suite passes.
- Author can enter any seed or pick any learner to preview the exact variant; the seed and resolved values are stored on each submission.
- Parameter bindings cover starter-model geometry, load magnitudes, environment fields and constraint values; bound fields display their binding in the builder.

### TB-12 Hints and scaffolding tiers

Author writes tiered hints (general, specific, near-solution) with optional point cost and unlock conditions (on request, after N failed auto-checks, after elapsed time, after a specific check fails), plus scaffolding toggles such as showing DCR color maps, revealing the governing combination, or showing the reference deflected shape. Hint usage is recorded and reported to the author.

**Why:** Scaffolding lets one task serve novices and advanced learners; state-based unlocks tie help to the simulation rather than a timer.

**Acceptance:**
- Ordered hints per task with cost and unlock conditions; conditions may reference auto-check ids.
- Scaffolding toggles are per task and visible in preview-as-learner.
- Hint usage and point deductions are applied consistently in grading and shown in gradebook detail.

### TB-13 Submission requirements, attempt policy and completion rule

Author defines what a submission contains: the model state (always), a written justification with a prompt and required sections (load path, governing combination, section selection rationale, serviceability, constructability), length limits, optional attachments (calculation PDF), and an attempt policy (maximum attempts, which attempt counts, resubmission after feedback, late policy). Author also sets the completion rule used by progress tracking: on submission, on grade release, or on score at or above a threshold.

**Why:** The justification is the primary evidence for grading engineering judgment; attempt and completion policies determine how the task feeds the gradebook and progress tracking.

**Acceptance:**
- Justification prompt, required sections and length limits are enforced in the learner submission form.
- Attempt policy options (max attempts, best/last/average counts, late penalty) are stored per task and applied by grading.
- Completion rule options are selectable and reflected in progress tracking.

### GL-01 Guided simulation lesson authoring

Author creates a step-by-step guided lesson in which each step has rich-text instruction, an optional highlight target in the 3D model and a checkpoint that auto-verifies the learner model state (e.g., add a pinned support at node A). Steps are ordered, required or optional, and the lesson completes when all required checkpoints pass; the author chooses whether learners may skip ahead.

**Why:** Guided lessons are the on-ramp to the simulation workspace for academic cohorts and make self-paced learning possible without TA involvement.

**Acceptance:**
- Steps can be added, reordered and marked required/optional; each may reference one or more checkpoint conditions.
- Author can set a starting model and, per step, an expected model for comparison.
- Per-step pass events and lesson completion are recorded for progress tracking.

### GL-02 Declarative checkpoint condition builder

Author composes checkpoint conditions from a catalog evaluated against model state: node exists at coordinates (tolerance), support of type X at node, member between two nodes with section/material constraint, load of type/magnitude/direction applied, plate present, analysis has run, result metric within range (max deflection, reaction, member DCR, axial force sign) and combination defined. Conditions combine with AND/OR/NOT and match elements semantically by label or coordinates with tolerance, never by internal element ids.

**Why:** Learners create elements in arbitrary order; semantic matching makes auto-verification robust and a declarative catalog keeps conditions testable.

**Acceptance:**
- All listed condition types are available with units and tolerances; conditions compose with boolean operators.
- Conditions are evaluated on the client within 300 ms of a debounced model change and re-validated server-side on lesson completion.
- Author can test a condition against the current model in the builder and see which sub-conditions pass or fail.
- A failing checkpoint can display an author-written hint.

### LB-01 Rich-text lesson editor with engineering blocks

Author writes lessons in a block editor supporting headings, text, images, video embeds, LaTeX equations, tables, callouts, file attachments, inline knowledge checks (a single question drawn from the quiz bank) and embedded interactive models. Content autosaves and blocks can be copied between lessons.

**Why:** Conceptual instruction precedes simulation; equations and diagrams are essential for structural engineering content.

**Acceptance:**
- All listed block types can be inserted, reordered and deleted; LaTeX renders in the editor and the learner view.
- Autosave occurs within 2 s of a change and unsaved changes are recovered after reload.
- An inline knowledge check records a response and shows feedback without leaving the lesson.

### LB-02 Embedded interactive model block

Author embeds a model snapshot inside a lesson with configuration: mode (view-only, explore with overlays, or sandbox), visible overlays (deflected shape, axial/shear/moment diagrams, stress or DCR color map, reactions), camera preset, deflection scale factor and a reset action. The embed uses the same analysis engine as the workspace so results are live, not pre-rendered images.

**Why:** Rich text with embedded interactive models is a stated requirement and the main differentiator from static textbooks and slides.

**Acceptance:**
- The embed renders the model with the selected overlays; in explore mode learners can orbit, select elements and read result values.
- Sandbox mode lets learners modify a private copy; reset restores the author snapshot.
- Embed configuration is saved with the lesson version and renders identically in preview-as-learner.

### QZ-01 Quiz builder with unit-aware engineering answer types

Author builds quizzes with multiple choice, multi-select, true/false, numeric with units and tolerance, short answer (AI-graded against an answer key and rubric), matching and ordering questions, each with feedback and points. Numeric answers accept unit-equivalent input (kN·m vs N·mm) with author-set absolute/relative tolerance or significant figures. Quiz settings cover time limit, attempts, shuffling, feedback timing and due dates.

**Why:** Quizzes serve conceptual and code-knowledge checks; unit-aware numeric grading avoids penalizing correct answers expressed in other units.

**Acceptance:**
- All listed question types can be authored with feedback and points; numeric questions require a unit and a tolerance.
- Unit conversion is applied before comparison; dimensionally inconsistent answers are marked wrong with an explanatory message.
- Quiz settings (time limit, attempts, shuffle, feedback timing, due dates) are stored and enforced.

### TL-01 Institution template library with provenance and linking

Any task, guided lesson, lesson or quiz can be saved as a template in a library scoped private, department or institution, searchable by structure type, code basis, difficulty and tags. Items created from a template record provenance and the author chooses copy (independent) or linked (receives template updates through an accept/reject prompt). Templates carry license metadata.

**Why:** Sharing within an institution is a stated requirement and the main driver of adoption across sections and terms.

**Acceptance:**
- Save-as-template, browse/search and create-from-template work for all four content types.
- Visibility scope and license (e.g., CC BY, CC BY-NC-SA, all rights reserved) are set per template.
- Linked items show an update-available indicator when the template publishes a new version; accepting creates a new draft version of the item.

### TL-02 Platform starter template pack

The platform ships a curated pack of at least ten task templates with environment presets, starter model, reference solution, rubric and auto-checks: simply supported beam, cantilever, two-span continuous beam, Warren truss, Pratt truss, 2D portal frame, multi-story 2D moment frame, 3D braced frame, roof truss under snow and wind, pedestrian bridge truss, and a flat plate/slab. Each pack item is also a regression fixture for the engine and grader.

**Why:** Instructors will not adopt an empty authoring tool, and the pack doubles as test content for the simulation and grading pipeline.

**Acceptance:**
- Every template passes the pre-publish validation gate and a calibration run on the MVP code basis.
- Templates are platform-owned, cloneable, and not editable in place by institutions.

### VP-01 Content lifecycle states and review workflow

Every content item moves through draft, in review, published and archived with role-based transitions; in review assigns reviewers who comment and approve or request changes. Institutions configure whether review is mandatory before publish. A published item can have exactly one open draft (its next version) at a time.

**Why:** The brief requires a publish workflow; configurable review keeps small departments fast while supporting quality gates in larger ones.

**Acceptance:**
- Transitions are enforced by role: owners and co-authors submit for review and publish where allowed, reviewers approve or request changes, admins archive.
- The publish transition runs the pre-publish validation gate (VP-02) and refuses on hard failures.
- Archived items are hidden from new enrollments but remain readable for historical submissions.

### VP-02 Immutable versions, pinning and pre-publish validation gate

Each publish creates an immutable version with a required changelog; attempts, submissions and grades pin the content version, library versions and code-module version they were served. The validation gate checks that the starter model analyzes, at least one reference solution passes all hard constraints and checks, rubric weights sum to 100, combinations are consistent with the code basis, randomization yields valid variants, and a calibration run exists for the version (warn or block per institution).

**Why:** Immutable pinned versions are the foundation of in-flight cohort safety and grade-dispute resolution; the gate prevents publishing broken tasks.

**Acceptance:**
- Publishing is atomic; version numbers increment and a changelog entry is mandatory.
- Each submission references the task version id; viewing a historical submission shows the exact version served, including library pins.
- The validation report lists each check as pass, warn or fail; hard failures block publish.

### VP-03 In-flight cohort safety on republish

When a new version is published for an item with started attempts in any cohort, the system classifies the diff as cosmetic (text, media, camera) or grading-affecting (rubric, checks, constraints, loads, environment, randomization, references, submission policy, point value, code basis, library pins) and requires the author to choose: apply to new attempts only, apply to all and regrade with learner notification, or schedule after the cohort due date. Cosmetic changes may be hot-applied with a notice.

**Why:** Changing grading rules mid-assignment is the most common source of grading disputes; an explicit choice protects learners and instructors.

**Acceptance:**
- The diff classification and the list of changed grading-affecting fields are shown before publish.
- Apply-to-new-attempts-only leaves existing attempts on their pinned version; apply-and-regrade enqueues regrade jobs and records a regrade event per submission.
- Learners with in-flight attempts receive a notice when a cosmetic change is hot-applied.

### PV-01 Preview as learner

Author opens any draft or published item exactly as a learner sees it, choosing a seed or a specific learner variant and a cohort context, including hints, constraints, the submission form and grading feedback. Preview actions never create learner records and a persistent banner marks preview mode.

**Why:** Authors must see the learner experience to catch confusing instructions, broken locks and unreasonable constraints before publishing.

**Acceptance:**
- Preview works for tasks, guided lessons, lessons and quizzes from a draft or any version.
- The seed/learner selector reproduces the exact variant; preview submissions run grading in dry-run and display the feedback a learner would receive.
- No gradebook, progress or analytics records are written from preview.

### PV-02 Calibration run before publishing

Author runs the full grading pipeline (auto-checks and AI grader) against each reference solution and, for randomized tasks, across N sampled seeds (default 20). The report shows per-criterion scores, feedback text, check values and timing, and flags references outside their expected score band and seeds whose variant fails hard constraints or is unsolvable. Results persist with the version and feed the validation gate.

**Why:** Test-grading reference solutions is the only way to confirm that rubric, checks and AI guidance produce the intended grade.

**Acceptance:**
- Calibration runs on demand from the builder as an asynchronous job with progress; results persist with the version.
- The report flags references outside the expected band and lists failing seeds with the seed value and failing checks.
- Parametric references re-analyze per seed; for static references the author is warned which bound parameters would invalidate the reference.

### LIB-01 Built-in versioned section and material libraries

The platform provides versioned section libraries (AISC families W, S, C, L, WT, rectangular and round HSS, pipe; Eurocode IPE, HEA/HEB/HEM, UPN, RHS/SHS/CHS; generic rectangular, circular and T concrete sections; dimensional and glulam timber) and material libraries (ASTM A992, A36, A500, A572; S235/S275/S355; concrete grades by f'c or C-class; timber grades) with the properties required for analysis and code checks. Authors browse and select from them in constraints and the workspace.

**Why:** Instructors must not type section properties by hand, and code checks need complete property sets (e.g., Zx, Iy, J, Cw for lateral-torsional buckling).

**Acceptance:**
- Libraries are searchable by family, depth and mass per length; each entry shows the properties used by the engine and code checks.
- Library entries are versioned and tasks pin a library version (VP-02).
- MVP ships at least the MVP code-basis steel families plus a basic concrete and timber set.

### LIB-02 Import custom section and material libraries

Institution admins and authors import sections and materials from CSV/JSON through a column-mapping step with an explicit unit-system declaration, schema validation per section type (required properties, plausibility ranges such as steel E within 190-215 GPa), duplicate handling, dry-run preview and a row-level error report. Imported libraries are institution-scoped and versioned.

**Why:** Institutions teach local codes and products (regional steel sections, local concrete grades) and need their own libraries without platform involvement.

**Acceptance:**
- Importing 5,000 rows completes within the performance target and yields a downloadable error report with row numbers and reasons.
- Unit conversion is applied on import; properties are stored in SI internally with the original unit system retained for display.
- Imported entries become selectable in constraints and the workspace after the library version is published.

### LIB-03 Cost model for budget constraints and economy grading

Authors define a cost model at course level with task overrides: unit cost per material and grade by mass or volume, currency, and later per-connection and fabrication factors. The engine computes structure cost (sum of member length x mass per length x unit cost, plus concrete volume and rebar mass) for the budget constraint, live display and the economy rubric criterion.

**Why:** Material efficiency and economy are explicit grading criteria; a transparent cost model keeps economy objective and explainable.

**Acceptance:**
- The cost model is editable with sensible defaults; cost is displayed live in the workspace when the task enables it.
- The budget constraint and the economy criterion read the same computed cost; per-member cost details are viewable.

### CM-01 Course structure authoring

Authors organize a course into modules and ordered items (lesson, guided lesson, task, quiz) with drag-and-drop, prerequisites and gating (complete X before Y), release and due dates per item, and point values that feed the gradebook. Items are owned by the course or linked from the template library.

**Why:** Course structure is where authored content becomes a learning path; gating ties guided lessons to the tasks they prepare for.

**Acceptance:**
- Modules and items can be created, reordered, gated and scheduled; the learner view respects gating.
- Point values and completion rules propagate to the gradebook schema.

### CM-02 Course duplication

Author duplicates a course with all content (tasks, lessons, quizzes, cost model, environment presets) as independent copies or linked instances, excluding learner data, with an optional date shift and a choice of latest published or specific content versions.

**Why:** Instructors teach multiple sections and reuse courses; duplication is the baseline operation for that.

**Acceptance:**
- Duplicating a 50-item course completes within the performance target; all internal references (embedded models, question-bank links, cost model) resolve in the copy.
- Learner data (submissions, grades, learner comments) is never copied.

### CM-03 Term rollover

Author or admin creates a new offering of a course for a new term or cohort: dates shift by offset or map to a new academic calendar, content versions carry over (default latest published), co-author and reviewer roles persist, and in-progress drafts can be carried or dropped. Rollover produces a checklist of items needing attention (dates landing on holidays, references to archived libraries, failed validation).

**Why:** Term rollover is a recurring administrative chore for academic customers and a frequent source of broken dates and stale content.

**Acceptance:**
- The rollover wizard shows a date-shift preview and a conflicts list before confirmation.
- The new offering has a fresh cohort with no learner data and a link to the prior offering for analytics comparison.

### AN-01 Task statistics for authors

For each published task, authors see attempts, submission rate, mean and median score, pass rate, score distribution per rubric criterion, time on task, hint usage, median attempts to pass and auto-check failure frequency, filterable by cohort and task version.

**Why:** Authors need immediate signal on whether a task is working before enough data exists for psychometrics.

**Acceptance:**
- Statistics update within 5 minutes of a grade release and can be filtered by cohort and task version.
- Per-criterion distributions and per-check failure counts are displayed.

### CA-01 Roles and co-authoring permissions

Content items and courses have owner, co-author (edit), reviewer (comment and approve) and viewer roles assignable by owners or institution admins; TAs can hold reviewer or viewer rights on content independently of grading rights. Roles carry over on duplication and rollover.

**Why:** Courses are built by several people (lead instructor, co-instructors, TAs); explicit roles keep publishing accountable.

**Acceptance:**
- Role assignment is available per item and per course; permissions are enforced on every authoring API.
- Role changes are written to the audit history.

### CA-02 Edit locking and presence

While one author edits an item, others see presence and an edit lock; the lock auto-releases after an idle timeout and can be taken over with notice, and the previous editor's unsaved changes are preserved as a recoverable snapshot. Real-time collaborative editing of rich-text blocks can follow later.

**Why:** 3D model state and complex task configuration do not merge well; locking is the simplest safe default for a small team.

**Acceptance:**
- Presence appears within 1 s; takeover requires confirmation and notifies the previous editor.
- No data is lost on takeover: the previous editor's unsaved changes are stored as a recoverable snapshot.

### CA-03 Anchored comments and review threads

Collaborators comment on a task field, rubric criterion, auto-check, hint, lesson block, lesson step, quiz question or a specific model element (node, member, support) in the 3D workspace; threads support mentions, resolve/reopen and notifications, are hidden from learners and survive version bumps through stable anchors (orphaned anchors are flagged).

**Why:** Review workflow and co-authoring depend on precise, contextual comments, especially on model elements.

**Acceptance:**
- Comments can be created from each anchor type; model-element comments show a marker in the 3D view.
- Resolve/reopen and mentions trigger notifications; comments are never visible to learners.
- Comments remain attached across versions while the anchor exists; orphaned comments are listed for cleanup.

## Should (v1.x)

### GL-03 Authoring by demonstration and per-step scaffolding

Author records a step by performing the action in the workspace; the builder diffs model state before and after and proposes checkpoint conditions to accept or edit. Per step the author can restrict the tool palette, set a camera preset, highlight elements and allow a do-it-for-me action after N failed attempts.

**Why:** Hand-writing conditions is slow; recording makes guided lesson authoring far faster and less error-prone.

**Acceptance:**
- Recording proposes at least one condition for add/remove/modify of nodes, members, supports, loads and analysis runs.
- Palette restriction, camera preset and highlights are saved per step and applied in preview.
- Do-it-for-me applies the expected delta to the learner model and marks the step as assisted.

### LB-03 Parameter controls bound to embedded models

Author exposes model parameters (load magnitude, span, section choice, support type, material) as sliders or dropdowns in the lesson; changing a control re-runs live analysis in the embed and updates overlays and optional readouts (e.g., maximum moment, deflection). Authors set ranges, steps, defaults and readout formulas.

**Why:** Parameter exploration (what happens to deflection when span doubles) is the pedagogical core of simulation-based learning.

**Acceptance:**
- Slider and dropdown controls bind to numeric or choice parameters; analysis re-runs within 500 ms for models of up to 200 members.
- Readouts display engine results with author-set units and precision.

### QZ-02 Parameterized, model-linked and hotspot questions

Author defines variables with ranges and an answer expression (e.g., M = wL^2/8) so each learner receives a seeded variant, and can link a question to an embedded model so the expected answer is computed by the analysis engine (e.g., vertical reaction at B). Hotspot questions ask the learner to click the member or node satisfying a condition (e.g., highest DCR).

**Why:** These question types reuse the task randomization engine and make quizzes integrity-safe and simulation-grounded.

**Acceptance:**
- Variables use the same parameter and seed engine as TB-11; answer expressions are evaluated server-side with tolerance.
- Model-linked questions derive the expected answer from engine results of the seeded variant.
- Hotspot questions accept an element selection in the embedded model and grade by semantic match.

### QZ-03 Question bank with tags and random draw

Questions live in an institution-scoped bank with tags (topic, code clause, difficulty, structure type) and can be reused by reference across quizzes and courses; a quiz can draw N random questions from a tag pool per learner. Bank items carry version history and analytics.

**Why:** Reuse and random draw are standard LMS expectations and reduce authoring effort across terms.

**Acceptance:**
- Questions can be searched and filtered by tags and inserted by reference; edits create new versions with an update prompt in referencing quizzes.
- Random-draw pools generate per-learner sets deterministically from the seed engine.

### VP-04 Version diff, rollback and audit history

Authors compare any two versions of an item through a structured diff of configuration, rubric and checks plus a 3D model diff (added/removed/changed elements), restore a prior version as a new draft, and view an audit log of edits and state transitions with actor and timestamp.

**Why:** Diff and rollback make iterative improvement safe and support institutional audit requirements.

**Acceptance:**
- The diff view shows field-level changes and a model-element change list; rollback creates a draft whose changelog references the source version.
- The audit log is append-only and exportable.

### PV-03 Distractor solutions and grader consistency check

Author attaches intentionally flawed distractor solutions (missing seismic combination, under-designed column, unstable truss, over-budget design) with the criteria expected to fail; calibration verifies the grader catches each flaw. The author can also run the AI grader N times on a reference and see per-criterion score variance with a warning above a configurable threshold.

**Why:** Negative test cases and variance checks turn calibration from a smoke test into real validation of grading quality.

**Acceptance:**
- Distractors are stored like references with expected-fail criteria; the calibration report shows caught/missed per flaw.
- The consistency run reports mean, standard deviation and range per criterion over N runs and flags criteria above the threshold.

### AN-02 Item difficulty, discrimination and variant fairness

For tasks and quiz items with sufficient data (default n >= 20), the system computes a difficulty index (mean score / maximum), a discrimination index (upper versus lower 27% groups) and item-total (point-biserial) correlation, and flags items with discrimination below 0.2 or negative, difficulty outside 0.3-0.8, or very high hint dependence. For randomized tasks it compares score distributions across parameter ranges to detect unfair variants.

**Why:** Difficulty and discrimination analytics are a stated requirement and directly improve content quality across terms.

**Acceptance:**
- Metrics are computed per version and cohort with n shown; insufficient-data is displayed below the threshold.
- Flagged items appear in an author needs-revision list with the triggering metric.

### AN-03 AI grading agreement and override analytics

Authors see, per task and criterion, the rate and direction of instructor overrides of AI grades, mean absolute score difference and human-review queue volume; tasks whose override rate exceeds a threshold are flagged for revising rubric descriptors or AI guidance.

**Why:** Override data is the fastest feedback loop for improving AI-graded criteria and for building instructor trust.

**Acceptance:**
- Override rate, mean absolute difference and flagged criteria are shown per task version.
- Selecting a flagged criterion lists sample submissions with AI versus instructor scores.

## Could (later)

### TL-03 Cross-institution template marketplace

Authors can later publish templates to a cross-institution marketplace with review/approval, ratings, attribution, licensing, optional pricing and update notifications to forks; institutions control whether staff may publish to or import from it.

**Why:** A marketplace multiplies content supply beyond what a small team can author, but it requires moderation, licensing and payments that are out of MVP scope.

**Acceptance:**
- A marketplace listing requires passing validation and calibration, a license, and reviewer approval.
- Importing institutions see provenance and can pin or follow template versions.

## Non-functional targets

| id | title | target |
|---|---|---|
| NF-AUTH-01 | Authoring autosave and recovery | Changes persisted within 2 s of the last edit; 100% of unsaved edits recoverable after a reload or crash via local draft snapshot. |
| NF-AUTH-02 | Preview-as-learner load time | Task preview interactive within 3 s for models up to 500 members on a mid-range laptop over a 20 Mbps connection. |
| NF-AUTH-03 | Calibration run duration | Single reference: analysis <= 5 s for models up to 2,000 DOF and AI grade <= 60 s; 20-seed randomized calibration <= 10 min, executed asynchronously with progress and resumable on failure. |
| NF-AUTH-04 | Checkpoint verification latency | Guided-lesson checkpoint conditions evaluated within 300 ms (client-side, debounced) of a model change; server re-validation on completion within 2 s. |
| NF-AUTH-05 | Randomization determinism | 100% identical parameter values between client and server across a 1,000-case cross-language test-vector suite; any mismatch fails CI. |
| NF-AUTH-06 | Library import throughput | 5,000-row section or material import validated and committed within 10 s with a complete row-level error report. |
| NF-AUTH-07 | Duplication and rollover time | 50-item course duplicated or rolled over within 30 s; rollover preview rendered within 5 s. |
| NF-AUTH-08 | Publish atomicity and in-flight safety | Publish is transactional (all-or-nothing); 0 in-flight attempts altered without an explicit instructor choice; 100% of state transitions produce an audit entry. |
| NF-AUTH-09 | Edit lock and presence responsiveness | Presence and lock state visible to collaborators within 1 s; idle locks released after 5 min (configurable). |
| NF-AUTH-10 | Authoring accessibility | Non-3D authoring UI meets WCAG 2.2 AA; all builder forms fully keyboard-operable; 3D authoring actions have form-based equivalents for element properties. |
| NF-AUTH-11 | Analytics freshness | Task statistics reflect a released grade within 5 minutes; psychometric metrics recomputed at least nightly. |
| NF-AUTH-12 | Version and audit retention | Published versions and audit history retained at least 3 years or per institution policy; no version hard-deleted while any submission references it. |

## Domain notes (for architecture and UX)

1. CONTENT TYPES AND ENTITY MODEL (recommendation for architecture)
Content types: SimulationTask, GuidedLesson, Lesson, Quiz (plus Template wrappers). Suggested entities: Course -> Offering (term/cohort) -> Module -> CourseItem (points, release/due/lock dates, gating; references a ContentItem version directly or a linked Template); ContentItem (type, owner, roles) -> ContentVersion (immutable once published; state draft|in_review|published|archived; changelog; pins: codeModuleVersion, sectionLibraryVersion[], materialLibraryVersion[], costModelVersion, graderModelId); TaskDefinition (JSON document, schema-versioned) with sub-objects: codeBasis, environment, loadCases[], combinations[], constraints[], parameterSpecs[], starterModelRef, workspacePreset, rubric, autoChecks[], aiGuidance, hints[], submissionPolicy, completionRule; ModelSnapshot (3D state: nodes with labels, members, plates, supports, loads, sections, materials; stored as JSON, element labels stable across edits); ReferenceSolution / DistractorSolution (modelSnapshotRef, resultsSnapshotRef, approach, expectedBand or expectedFailCriteria, parametric flag); CalibrationRun (versionRef, seeds[], per-reference per-criterion scores, grader model, timings, flags); EnvironmentPreset, CostModel, SectionLibrary/MaterialLibrary (versioned, scope platform|institution); Template (scope, license, provenance edges); Comment (anchorType, anchorId, versionRef, thread, resolved); EditLock (itemRef, holder, expiresAt); AuditEvent; ItemStats (per version per cohort). Store TaskDefinition as JSON validated by a JSON Schema with explicit schemaVersion and migration scripts; keep model snapshots separate from definitions because they are large and reused (starter, references, lesson embeds).

2. GRADING DIMENSION TAXONOMY (enum used by rubric criteria, auto-checks, analytics and the AI grader)
strength (DCR <= 1.0 under all combinations), serviceability (deflection, drift, vibration later), stability (mechanisms, slenderness, buckling, bracing), load_combinations (correct cases, factors, governing combination identified), environmental (wind/seismic/snow/soil appropriately derived and applied), economy (mass/cost vs reference band), constructability (member count/variety, repetition, realistic connections, erection logic), judgment (written justification: load path, governing case, trade-offs), communication (clarity, units, labeled sketches). Default rubric levels: Exemplary 100, Proficient 75, Developing 50, Beginning 25, Missing 0. Recommended MVP weighting guidance: deterministic dimensions (strength, serviceability, stability, load_combinations, economy) 60-75% of total; AI-judged (environmental reasoning, constructability, judgment, communication) 25-40%.

3. AUTO-CHECK CATALOG (deterministic, engine-backed; each has severity hard|soft|info, weight, tolerance, learner message with placeholders)
max_dcr {memberClass, limit=1.0}; deflection_limit {memberClass, ratio L/n or absolute, combination set SLS}; drift_limit {story, ratio h/n, combination}; stability {mechanism/singular stiffness; KL/r <= 200 compression, L/r <= 300 tension (AISC recommended limits); elastic buckling factor later}; equilibrium {sum reactions = sum applied loads, tol 0.5%}; required_supports {node, type}; required_load_cases {case ids}; combinations_match {expected set, factor tol 0.01}; governing_combination_identified {expected id, from justification parse or learner selection}; section_allowed / material_allowed {allow-list rules}; budget {cost <= B}; mass {<= M}; geometry_envelope {bounding box, locked nodes unchanged, max span, member count}; connectivity {no floating nodes, all members connected to a support path}; unbraced_length_assigned {members with LTB check}. Auto-scored criterion formula example: score = weight x clamp(1 - overshoot/limit, 0, 1) for continuous checks; pass/fail for discrete checks.

4. CODE MODULES AS DATA
A code module = {id, edition, unitDefaults, loadCases[], combinationSets[], resistanceFactors, deflectionPresets[], driftPresets[], materialGrades[], sectionFamilies[], checkImplementations[]}. ASCE 7-22 LRFD (Sec. 2.3.1): 1.4D; 1.2D + 1.6L + 0.5(Lr or S or R); 1.2D + 1.6(Lr or S or R) + (L or 0.5W); 1.2D + 1.0W + L + 0.5(Lr or S or R); 0.9D + 1.0W; seismic (2.3.6): 1.2D + Ev + Eh + L + 0.2S; 0.9D - Ev + Eh (Ev = 0.2 SDS D). ASCE 7-22 ASD (2.4.1): D; D + L; D + (Lr or S or R); D + 0.75L + 0.75(Lr or S or R); D + 0.6W; D + 0.75L + 0.75(0.6W) + 0.75(Lr or S or R); 0.6D + 0.6W; seismic: D + 0.7Ev + 0.7Eh; D + 0.525Ev + 0.525Eh + 0.75L + 0.75S; 0.6D - 0.7Ev + 0.7Eh. EN 1990 Eq. 6.10 (STR/GEO Set B): sum(gammaG,j Gk,j) + gammaQ,1 Qk,1 + sum(gammaQ,i psi0,i Qk,i) with gammaG = 1.35 unfavourable / 1.00 favourable, gammaQ = 1.50 / 0; SLS characteristic: sum Gk + Qk,1 + sum psi0,i Qk,i; psi0 values per EN 1990 Table A1.1 (e.g., 0.7 offices, 0.6 wind, 0.5 snow below 1000 m). AISC 360-22: phi = 0.90 (flexure, compression, tension yielding), Omega = 1.67; compression Ch. E Fcr = 0.658^(Fy/Fe) Fy when Fy/Fe <= 2.25 else 0.877 Fe, Fe = pi^2 E/(Lc/r)^2; flexure Ch. F (Mp = Fy Zx, LTB with Lp/Lr); shear Ch. G Vn = 0.6 Fy Aw Cv1; combined Ch. H Eq. H1-1a Pr/Pc + 8/9 (Mrx/Mcx + Mry/Mcy) <= 1.0 for Pr/Pc >= 0.2, else H1-1b Pr/(2Pc) + (...) <= 1.0. Deflection presets (IBC 2021 Table 1604.3): floor L: L/360, D+L: L/240; roof (no plaster) L/240 (Lr or S), L/180 D+L; wind drift commonly h/400 to h/500; seismic allowable story drift per ASCE 7-22 Table 12.12-1 (e.g., 0.020 hsx for typical Risk Category I/II). Edition status (verified Nov 2026): ASCE 7-22 and AISC 360-22 current; ACI 318-25 released 2025 (digital Jan, print July) with adoption expected in IBC 2027 while ACI 318-19 remains in adopted codes; second-generation Eurocodes (EN 1990:2023 etc.) are being published with national adoption staggered; NSCP 2015 current in the Philippines. Treat editions as module versions.

5. ENVIRONMENT SCHEMA AND FORMULAS
environment = {jurisdiction, riskCategory I-IV, wind {V, exposure B|C|D, Kzt, Kd, Ke}, seismic {Ss, S1, siteClass A-F, SDS, SD1, R, Ie, Cd, Omega0, SDC}, snow {pg, Ce, Ct, slope}, temperature {Tmin, Tmax, dT}, soil {qAllow, ks, Ka/Kp, groundwater}, occupancy {floorLive, roofLive}}. Wind velocity pressure (ASCE 7-22 26.10-1): qz = 0.00256 Kz Kzt Kd Ke V^2 (psf, V mph) or qz = 0.613 Kz Kzt Kd Ke V^2 (N/m^2, V m/s). Seismic ELF: Cs = SDS/(R/Ie) (with Cs max/min per 12.8.1.1), V = Cs W, SDS = 2/3 SMS. Snow (ASCE 7-22 Eq. 7.3-1): pf = 0.7 Ce Ct pg; the importance factor Is was removed in 7-22 because ground snow maps are now provided per Risk Category (7-16 form includes Is). Example presets (author-entered values, not geocoded in MVP): coastal high wind (V = 170 mph, Exposure D, low seismic), high-seismic urban (Ss = 2.0 g, S1 = 0.7 g, Site D, SDC E, V = 95 mph), mountain snow (pg = 60 psf, Ct = 1.1), temperate low hazard, tropical typhoon (NSCP-style 250-270 kph zone).

6. MATERIAL AND SECTION REFERENCE DATA
Steel: E = 29,000 ksi (200 GPa) per AISC, 210 GPa per EN 1993-1-1 (store E per material, not per code); G = 11,200 ksi (77.2 GPa); density 7,850 kg/m^3 (490 pcf). ASTM A992 Fy 50 ksi / Fu 65 ksi (345/450 MPa); A36 36/58 ksi; A500 Gr. C: rectangular HSS Fy 50 ksi, round 46 ksi; A572 Gr. 50. EN 10025-2 per EN 1993-1-1 Table 3.1 (t <= 40 mm): S235 fy 235 / fu 360 MPa; S275 275/430; S355 355/490. Concrete: ACI 318 Ec = 57,000 sqrt(f'c) psi = 4,700 sqrt(f'c) MPa (normal weight), density 150 pcf (2,400 kg/m^3); EN 1992 Ecm = 22 (fcm/10)^0.3 GPa with fcm = fck + 8 MPa. Section property schema (SI canonical): name, family, standard, d, bf, tw, tf, A, Ix, Iy, Zx, Zy, Sx, Sy, rx, ry, J, Cw, rts, ho, massPerLength, surfaceArea, compactness classification inputs; HSS adds Ht, B, t_des; angles add x/y centroid. Sources: AISC Shapes Database v16.0 (Excel, US and metric; developer license requires legal confirmation before bundling), Eurocode profiles from EN 10365 / producer tables, local libraries via LIB-02.

7. RANDOMIZATION ENGINE
parameterSpec = {name, type: number|choice|derived, min, max, step, unit, choices[], expression, bindings[]}; bindings target JSON paths in the TaskDefinition or ModelSnapshot (node coordinates, load magnitudes, environment values, constraint values). Seed = HMAC-SHA256(serverSecret, taskVersionId + learnerId + attemptScope) truncated to 64 bits; PRNG must have identical reference implementations in the client (TypeScript) and grading services (choose PCG32 or xoshiro128** with shared test vectors; avoid language-specific RNGs). Derived expressions evaluated by a sandboxed math evaluator (no arbitrary code). Well-posedness: authors may add parameter constraints (e.g., L/d >= 10, budget >= 1.1 x reference cost) and the calibration run samples N seeds, reporting failures. Store resolved parameter values on every submission so grading never re-derives from a possibly changed spec.

8. CHECKPOINT DSL (guided lessons)
Example: {"all":[{"type":"support","at":{"label":"A"},"restraint":"pinned"},{"type":"member","between":[{"label":"A"},{"xyz":[6,0,0],"tol":0.05}],"section":{"family":"W","depthMax":0.46}},{"type":"analysis_ran"},{"type":"result","metric":"max_deflection","scope":"any_member","op":"<","value":0.016,"unit":"m"}]}. Resolve element references by label first, then by coordinates with tolerance; never by internal id. Evaluate client-side on debounced model change (<= 300 ms) and re-validate server-side on completion. Record-by-demonstration diffs two snapshots into add/remove/modify events and maps each to a proposed condition.

9. HINTS AND SCAFFOLDING
Tier 1 conceptual (which code section or load governs), tier 2 specific (which members are overstressed and why), tier 3 near-solution (a section family or bracing pattern that works). Unlock conditions: on_request, after_failed_checks(n, checkId?), after_minutes(t), after_submission_attempt(n). Scaffolding toggles: show_dcr_colors, reveal_governing_combination, show_reference_deflected_shape, show_cost_live.

10. VERSIONING RULES
Grading-affecting fields (force a major version and the VP-03 apply policy): rubric, autoChecks, constraints, loadCases, combinations, environment, parameterSpecs, referenceSolutions, submissionPolicy, pointValue, codeBasis, library pins, cost model, completionRule. Cosmetic (minor version, hot-apply allowed with notice): instruction text, media, camera presets, hint wording (hint unlock conditions and costs are grading-affecting). A ContentVersion is immutable after publish; a new draft is a fork of the latest version. Pinning: Attempt.contentVersionId plus the version's library/code/grader pins are sufficient to reproduce a grade later.

11. COST MODEL
cost = sum over steel members (length x massPerLength x unitCost[grade]) + sum over concrete elements (volume x unitCost[concreteGrade] + rebarMass x unitCost[rebar]) + (later) connections x unitCostConnection + fabrication factor. Defaults editable per institution; currency per institution; cost shown live when enabled; economy criterion scores against the reference cost band (e.g., full marks within 110% of best reference, linear decay to 0 at 150%).

12. ITEM ANALYSIS FORMULAS AND THRESHOLDS
Difficulty p = mean score / max score (dichotomous: proportion correct); target 0.3-0.8. Discrimination D = p_upper - p_lower using top and bottom 27% by total course score; D >= 0.3 good, 0.2-0.29 acceptable, < 0.2 revise, negative flag. Item-total correlation: point-biserial r_pb = ((M1 - M0)/S) x sqrt(p q) for dichotomous, corrected Pearson item-total (item excluded) for polytomous. Quiz reliability: KR-20 / Cronbach alpha. Minimum n = 20 (configurable) before showing D or r_pb. Variant fairness: one-way comparison of mean score across parameter-value bins; flag bins differing by more than 10 points with n >= 10 per bin.

13. CALIBRATION SEMANTICS
A calibration run executes, for each reference and distractor and for each sampled seed, the exact learner grading path (constraint evaluation, analysis, auto-checks, AI grader with pinned model, rubric aggregation) in dry-run mode, persisting a CalibrationRun with per-criterion scores, feedback, check values and durations. Pass conditions: every reference within its expected band; every distractor fails each expected criterion; no sampled seed violates hard constraints; AI variance per criterion below threshold (when PV-03 enabled). The validation gate reads the latest CalibrationRun for the version (not for an older version).

14. STARTER PACK (TL-02) WITH SUGGESTED LEARNING OBJECTIVES
Simply supported beam under UDL (section selection, deflection), cantilever with point load (moment/shear envelopes), two-span continuous beam (pattern live load), Warren truss (axial force signs, tension/compression members), Pratt truss (member sizing under moving load later), 2D portal frame (wind combination, drift), 3-story 2D moment frame (seismic ELF distribution, drift limits), 3D braced frame 2x2 bays (bracing layout, stability, torsion), roof truss under snow and wind (snow + wind uplift combinations, 0.9D + W), pedestrian bridge truss (serviceability-governed design, economy), flat plate/slab (plate elements, deflection). Each ships with environment preset, rubric, auto-checks, hints and a reference solution.

15. UX RECOMMENDATIONS FOR THE BUILDER
Template-first creation; left-rail section navigation with completion ticks; right-rail live validation panel (same checks as the publish gate) and a Calibrate button; the starter-model/reference/checkpoint editors are the learner workspace component in author mode (extra tools: lock/hide/required toggles, label elements, condition tester, seed explorer, compare-with-reference); preview-as-learner opens in a new tab with a persistent banner and seed selector; publish dialog shows the diff classification and in-flight policy choice; comments drawer anchored to the currently focused field or selected element.

16. PHASING SUMMARY
MVP (must): TB-01..TB-13, GL-01, GL-02, LB-01, LB-02, QZ-01, TL-01, TL-02, VP-01..VP-03, PV-01, PV-02, LIB-01..LIB-03, CM-01..CM-03, AN-01, CA-01..CA-03. v1.x (should): GL-03, LB-03, QZ-02, QZ-03, VP-04, PV-03, AN-02, AN-03. Later (could): TL-03 marketplace, real-time co-editing, geocoded hazard lookup, LTI/Common Cartridge, connection-level cost modeling.

## Risks

| risk | mitigation |
|---|---|
| AI grader non-determinism makes calibration results unstable and undermines instructor trust. | Pin grader model and version per task version, use temperature 0 and structured output, give deterministic checks the majority of weight in MVP rubrics, and expose the N-run variance report (PV-03) so authors see and can tighten unstable criteria. |
| Checkpoint and hotspot matching by internal element ids breaks when learners create elements in a different order or delete and recreate them. | Match semantically by author-assigned labels or coordinates with tolerance; treat ids as opaque; include a condition tester in the builder and a regression suite of learner-built variants. |
| Randomized variants produce degenerate or unsolvable problems (e.g., span/depth ratios no section can satisfy under budget). | Author-defined well-posedness constraints on parameters, sampled-seed calibration with failing seeds reported, and a seed explorer in preview; block publish when any sampled seed fails hard constraints. |
| Republishing a task mid-cohort silently changes grades and triggers disputes. | Immutable versions pinned to attempts, automatic classification of grading-affecting fields, explicit apply policy with regrade events and learner notification (VP-02, VP-03). |
| Breadth of design codes (ASCE/AISC, Eurocode, NSCP, ACI) exceeds a small team's capacity and delays MVP. | MVP targets one code family with combinations, factors and limits expressed as versioned data in a code-module schema; add modules incrementally without touching the builder. |
| Unit mismatches in imported libraries (in vs mm, kip vs kN, psi vs MPa) corrupt analysis and grading. | Mandatory unit-system declaration on import, plausibility-range validation per property, dry-run preview, SI canonical storage with original units retained. |
| Section database licensing (AISC Shapes Database developer license, producer catalogs for Eurocode sections) restricts redistribution. | Legal review of AISC developer license terms before bundling; prefer open or self-derived property tables for non-US families; keep libraries institution-importable so customers can supply their own data. |
| The task builder becomes an overwhelming wall of configuration and instructors abandon it. | Template-first flow with sensible defaults, progressive disclosure per section, a right-rail validation panel, and the starter pack so most tasks are clone-and-tweak. |
| Co-authoring conflicts on 3D model state and complex config cause lost work. | Per-item edit locks with presence and recoverable snapshots in MVP; defer real-time collaborative editing to rich-text blocks only. |
| Code editions move (ACI 318-25 released 2025 and expected in IBC 2027; second-generation Eurocodes rolling out), so hard-coded assumptions go stale. | Code modules are versioned data pinned per task version; edition upgrades are new module versions, never in-place edits. |

## Open questions

- Which code family is the MVP target: ASCE 7-22 + AISC 360-22 (US, recommended for breadth of free reference data), Eurocode EN 1990/1991/1993, or NSCP 2015 (Philippines)? Which unit system is the default for the first customers?
- Is MVP steel-only (members and simple plates), or must reinforced concrete design checks (ACI 318-19/25 or EN 1992) be in the first release? This determines the material library and auto-check scope.
- Must every task have a reference solution to be publishable, or should open-ended tasks graded purely by rubric and AI be allowed (recommended: institution-configurable, default required)?
- Should hints cost points by default, and should hint usage be visible to learners as a deduction preview?
- Is the review/approval step mandatory for all institutions or configurable (recommended: configurable, default optional for departments under N instructors)?
- Marketplace business model and default license (CC BY-NC-SA vs commercial), and whether institutions can block outbound publishing.
- Should parameterized quiz questions ship in MVP alongside randomized tasks, given they share the seed engine, or stay in v1.x as planned?
- How are TAs modeled: a content role (reviewer/viewer) plus a separate grading role, or a single TA role with both?
- Is the written justification English-only in MVP, and what minimum length is reasonable for AI grading quality?
- Can the AISC Shapes Database v16.0 be bundled under its developer license, and what is the data source for Eurocode section tables (producer catalogs vs EN 10365 derived)?
- Should geocoded hazard lookup (e.g., ASCE Hazard Tool style wind/seismic/snow values by address) be on the roadmap, or do authors always enter environment values manually (recommended for MVP)?
- Is LTI 1.3 / Common Cartridge import-export needed in v1.x for institutional LMS integration, and does that affect how course packages are structured?
