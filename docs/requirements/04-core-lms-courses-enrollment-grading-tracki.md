# Core LMS: courses, enrollment, grading, tracking

_Source: requirements discovery workflow `wf_6281c128-0bb` (domain agent), 2026-11-03. 45 requirements: 31 must (MVP), 13 should (v1.x), 1 could (later)._

## Summary

Bridle's core LMS is not a generic course shell with a 3D widget bolted on; its central graded object is a Simulation Task whose structured environment scenario (site hazards, code set and edition, constraints, hidden benchmarks) is the contract that lets a deterministic code-check engine plus an AI grader evaluate designs against real-world criteria. The key decisions this implies are: (1) submissions are immutable, versioned model snapshots that the server re-analyzes before grading (never trusting client results), (2) rubrics separate auto-checked engineering criteria (strength, serviceability, stability, load combinations, economy) from AI-judged criteria (constructability, engineering judgment in the written justification) and manual ones, (3) grading runs as an idempotent pipeline with confidence-based routing into an instructor/TA review queue, explainable per-criterion evidence anchored to model elements and code clauses, and full appeal/override history, and (4) course content is versioned separately from offerings (runs) so authors can iterate without breaking live cohorts. Tenancy is organization-scoped from day one with institution defaults for units and code sets; roles are scoped (platform/org/department/offering/section) and enforced server-side with FERPA least-privilege in mind. MVP (must) covers tenancy, roles, email/OAuth auth, course hierarchy and versioning, simulation tasks and guided lessons, quizzes with unit-aware answers, enrollment/cohorts/sections, deadlines and late policy, the full submission-grading-gradebook loop, completion rules, notifications, discussions, instructor analytics with common-mistake aggregation, WCAG 2.2 AA, units localization, FERPA/GDPR baselines, and AI-grading governance. v1.x (should) adds departments and a shared catalog, SSO/MFA/SCIM, projects and teams, integrity tooling, calibration dashboards, competency mastery, certificates, LTI 1.3 Advantage, xAPI, a public API, and retention controls; QTI/Common Cartridge/OneRoster and badges/PDH are later, and SCORM is explicitly excluded.

## Must (MVP)

### TEN-01 Multi-tenant organizations with tenant defaults and seat licensing

Every institution or company is an Organization (tenant) with hard data isolation and its own settings: default unit system, default design code set and edition, timezone, grading scale, branding (logo, colors, email sender), allowed authentication methods, retention defaults, and seat licensing (seat pool, per-offering caps, waitlist). Platform admins provision tenants; organization admins manage settings. A user may belong to multiple organizations with independent role sets.

**Why:** Institutional sales require demonstrable isolation, and structural-engineering defaults differ by institution (a Eurocode university wants SI and EN 1990-1998; a US firm wants ASCE 7-22 and US customary units), so defaults must be tenant-level rather than global.

**Acceptance:**
- Every tenant-owned record carries an organization id; an automated isolation test suite exercises every API endpoint with a foreign-tenant principal and expects 404/403.
- Organization admin can set defaults; new courses inherit them; changing defaults never alters already-published task versions.
- Seat pool is enforced: enrollment beyond available seats is blocked with an optional waitlist, and seat usage is visible to the organization admin.
- Platform admin can create a tenant plus its first organization admin in under 5 minutes with no engineering involvement.

### ROLE-01 Scoped roles and server-enforced permission matrix

Roles are learner, teaching assistant, instructor, course author, institution admin, and platform admin, each granted within a scope (platform, organization, department, course offering, or section). The permission matrix is defined as data, enforced in the API layer, and mirrored in the UI. Key rules: TAs grade and comment only in assigned sections and cannot release grades or change course settings unless explicitly granted; course authors edit blueprints and publish versions but see no learner grades unless also an instructor; institution admins manage users, rosters, and settings and see aggregate reports but cannot edit individual grades; platform admins get cross-tenant operational access only through reason-logged impersonation.

**Why:** FERPA least-privilege and institutional trust depend on predictable, auditable authorization; scoping by section is what makes TA workflows and large cohorts safe.

**Acceptance:**
- A permission matrix document lists every role against every protected action, and automated tests cover each role across at least 40 critical actions.
- A TA assigned to section A receives 403 when reading a section B submission, even with a direct URL.
- All role grants and revocations are audit-logged with actor and scope.
- A single user can simultaneously be a learner in one offering and a TA in another within the same organization.

### AUTH-01 Email/password and OAuth sign-in with session management

Accounts use a verified email and a password policy aligned with NIST SP 800-63B (minimum 12 characters, breached-password screening, no composition rules or forced rotation), with password reset, rate limiting, and lockout. Google and Microsoft OAuth/OIDC sign-in is supported with account linking by verified email, invite-based account creation, remember-me, and a device/session list with revoke-all.

**Why:** University and corporate users overwhelmingly live in Google Workspace or Microsoft 365; supporting both at launch removes the main onboarding friction before enterprise SSO exists.

**Acceptance:**
- Signup, verification, and first login complete in under 2 minutes; unverified accounts cannot enroll.
- 10 failed logins within 15 minutes trigger a temporary lockout plus CAPTCHA; all auth events are audit-logged.
- Linking an OAuth identity to an existing password account requires a matching verified email.
- Revoking a session invalidates it within 60 seconds on every device.

### CRS-01 Program, course, module, and activity hierarchy with typed activities

Optional Programs group Courses; a Course contains ordered Modules of ordered Activities. MVP activity types: page (rich text), video, slides, PDF, quiz, guided simulation lesson, simulation task (graded), and external link; v1.x adds project, discussion activity, and survey. Each activity has required/optional flag, points if graded, estimated time, competency tags, and schedule fields.

**Why:** A stable three-level hierarchy with typed activities is what completion rules, gradebook categories, analytics, and LTI deep linking all key off.

**Acceptance:**
- Authors build and reorder the hierarchy with drag-and-drop; order persists and is reflected in learner navigation.
- Every MVP activity type renders in the learner view and emits progress events.
- Estimated times roll up to module and course totals.

### CRS-02 Course versioning, offerings, learner preview, duplication, and export

A Course blueprint has a draft and immutable published versions; an Offering is a scheduled run (term, cohorts, sections) pinned to one published version. Authors edit drafts without affecting live offerings, and instructors can upgrade an offering to a newer version through a diff that flags activities with existing submissions (grades preserved via stable activity ids). Authors preview any version as a sandbox learner, duplicate courses, and export/import a JSON bundle that includes simulation task definitions and rubrics; Common Cartridge export is later.

**Why:** Simulation tasks and rubrics evolve while cohorts are mid-course; without pinned versions, edits silently change what students were graded against.

**Acceptance:**
- Editing a draft never changes what a running offering shows; publishing creates an immutable version.
- Upgrade shows a diff listing added/removed/changed activities and warns on activities with submissions.
- Sandbox preview creates no real grade, progress, or analytics records.
- Export then import of a course restores structure, content, task definitions, and rubrics with equality on a checksum of the bundle.

### CRS-03 Simulation task definition with environment scenario and constraints

The core graded activity. An author defines the scenario narrative; the environment (site with derivable hazards or explicit values: basic wind speed and exposure, seismic parameters and site class, ground snow load, temperature range, soil bearing/class, risk or consequence category); the design code set and edition; a starter model or blank canvas with locked elements; allowed material and section catalogs and a geometric envelope; constraints and targets (weight or cost budget, deflection and drift limits, clear spans); required deliverables (model, written justification with word bounds and prompts, optional calculation PDF); rubric, attempt policy, and review routing; and hidden reference solutions with benchmark metrics for the economy criterion. Task definitions are versioned with the course and conform to a shared, versioned JSON schema.

**Why:** Grading against real-world criteria is only possible if the environment, code set, and constraints are structured data the check engine and AI grader can consume; the task schema is the contract between the LMS, simulation, and grading services.

**Acceptance:**
- Publishing is blocked until environment, code set, rubric, deliverables, and attempt policy are complete and valid.
- Learner view shows scenario, constraints, deliverables, due date, and rubric descriptors but never reference solutions, benchmarks, or grader notes.
- Task JSON schema is versioned and shared as a package with the simulation and grading services; schema changes are backward compatible or migrated.
- Author can test-submit the reference solution through the real pipeline and receives the expected full-mark result.

### CRS-04 Guided simulation lessons with auto-verified checkpoints

Interactive lessons run inside the 3D workspace as ordered steps, each with instructions, optional highlighted UI or model elements, and a checkpoint predicate on model or analysis state (for example, two pinned supports exist, every member has a section, max utilization under 1.2D+1.6L is below 1.0). Checkpoints verify automatically, hints unlock after repeated failures, an optional 'show me' applies the step, and progress is resumable per step.

**Why:** This is the 'interactive guided simulation lesson' content type that distinguishes Bridle from video-plus-quiz LMSs and feeds mastery and completion tracking.

**Acceptance:**
- Authors compose a lesson from a predicate library covering model structure, supports, loads, sections, and analysis results without writing code.
- Per-step progress persists; resuming returns the learner to the exact step with their working model.
- Completion fires when all required checkpoints pass and is consumed by completion rules and xAPI.

### CNT-01 Static content: rich text with math, embedded model views, video, slides, PDF

A Markdown/rich-text editor with LaTeX math, tables, images, code, callouts, and embedded read-only 3D model views (a model snapshot with camera and highlighted elements). Video is uploaded (transcoded to adaptive streaming) or embedded from YouTube/Vimeo, with captions required (VTT upload; auto-captioning in v1.x) and transcripts. Slides are PDF (PPTX converted on upload) and PDFs render in an in-app viewer with page tracking.

**Why:** Engineering content is equation-dense and benefits from embedded model views that tie theory to the workspace; captions are an accessibility obligation, not a nice-to-have.

**Acceptance:**
- LaTeX renders inline and in display mode; an embedded model view loads in under 2 seconds.
- Video cannot be published without captions or an explicit accessibility exception recorded by the author.
- Content emits view-percentage and time-on-content events used by completion rules.

### CNT-02 Quizzes with unit-aware numeric answers and question banks

Question types: multiple choice, multi-select, true/false, numeric with absolute or relative tolerance and unit awareness (answers accepted in any compatible unit and compared in SI), short answer (exact or regex), and matching. Supports question banks, random selection, shuffling, server-enforced time limits with accommodation multipliers, attempt limits, per-option feedback, auto-grading, and manual override. v1.x adds parameterized questions with randomized variables and formula-derived answers.

**Why:** Concept checks between simulation tasks need unit-tolerant numeric grading; a learner answering 2.81 kip to a 12.5 kN question is correct and must be marked so.

**Acceptance:**
- A numeric question with answer 12.5 kN at 2% tolerance accepts 2.81 kip and 12.6 kN and rejects 13.0 kN.
- Time limits are enforced server-side and honor the learner's accommodation multiplier.
- Quiz results post to the gradebook and update competency tags on release.

### ENR-01 Enrollment methods and lifecycle states

Learners enroll via manual add, CSV roster import with dry-run validation and per-row error reports, invite links or codes with expiry, seat limits, and optional approval, or self-enrollment in open offerings; LTI auto-enrollment arrives with INT-01. Enrollment states are invited, pending_approval, active, completed, withdrawn, suspended, and expired, each transition stamped with actor and time. Withdrawn learners lose access while their grade records persist under retention policy.

**Why:** Roster accuracy drives access, gradebook integrity, and seat billing; explicit states avoid the ambiguity of 'deleted' learners whose grades institutions must retain.

**Acceptance:**
- A 500-row CSV imports in under 30 seconds with a downloadable error report for rejected rows; dry-run makes no changes.
- Invite links place the learner into the intended cohort and section.
- Illegal transitions (for example completed to invited) are rejected by the API.
- Gradebook hides withdrawn learners by default with a toggle to show them.

### ENR-02 Cohorts and sections within an offering

An offering has cohorts (schedule groups with date offsets or independent calendars) and sections (teaching and grading groups assigned to instructors and TAs). Each learner belongs to exactly one cohort and one section per offering; bulk moves are supported and preserve submissions and grades. Grading queues, analytics, and optionally discussions are section-scoped.

**Why:** Large university courses run as lecture-plus-sections with TAs, while professional cohorts start on rolling dates; both need to share one course version without sharing schedules or graders.

**Acceptance:**
- Creating a cohort with a +7-day offset shifts every activity deadline for that cohort.
- A TA's review queue contains only submissions from their sections.
- Moving a learner between sections leaves submission history and grades intact and logs the move.

### SCH-01 Scheduling, deadlines, extensions, and accommodations

Each activity has available-from, due, and close dates set at the offering level with cohort overrides; all timestamps are stored in UTC with the offering timezone canonical and displayed in the learner's timezone with an explicit label. Instructors grant per-learner extensions (new due and close dates) and maintain per-learner accommodation profiles (time multiplier for timed quizzes, extra attempts, default extra days) that apply across the course. All changes are logged and visible to the learner.

**Why:** Deadline bugs across timezones and DST are the most common LMS trust failure, and documented accommodations are a legal requirement for disability services offices.

**Acceptance:**
- Countdown and due labels are correct across a DST transition in an automated test suite.
- An extension overrides the cohort date for that learner only and is reflected in late-policy calculations.
- Accommodation multipliers apply automatically to every timed quiz without per-quiz setup.

### SCH-02 Deterministic late policy engine

A course-level late policy with per-task override: none, grace period in minutes, percentage per period (hour or day) with a cap, fixed deduction per period, or accept-until-close at instructor discretion. The penalty is computed at submission time against the learner's effective due date (including extensions) using the formula in the domain notes, shown to the learner before submitting, and stored as raw, penalty, and adjusted scores.

**Why:** Late handling must be explainable and reproducible for appeals; showing the penalty before submission prevents disputes.

**Acceptance:**
- Unit tests cover every policy mode including grace and cap boundaries.
- Granting an extension after a late submission recomputes the penalty and records the recomputation.
- Gradebook shows raw, penalty, and adjusted values and the policy applied.

### SUB-01 Versioned immutable submissions with server-side re-analysis

Each submit creates an immutable numbered version containing the serialized model snapshot (schema-versioned), task version reference, learner-visible analysis results, written justification, and attachments, plus a content hash and a receipt. The server re-runs the analysis on the snapshot and stores canonical results used for grading; discrepancies beyond tolerance versus client results are flagged on the submission.

**Why:** Appeals, integrity, and reproducible AI grading all require an unalterable record, and client-computed FEA results can be tampered with or depend on browser state.

**Acceptance:**
- There is no update or delete API for submitted versions; corrections happen as new versions.
- Learners can open any prior version read-only and verify its hash against the receipt.
- A discrepancy flag is visible in the instructor review view with the magnitude of difference.
- Re-analysis completes within the grading SLA (NFR-02) for models within course size limits.

### SUB-02 Attempt policy, drafts, autosave, and resubmission

Drafts autosave within 30 seconds with crash recovery and are never treated as submissions. Per-task attempt policy supports unlimited or N attempts, cooldown between attempts, a resubmission window after feedback, and a grading target of latest, best, or instructor-selected version; instructors may enable auto-submit of the current draft at the close date. Resubmission re-triggers the grading pipeline and all prior grades remain in history.

**Why:** Design optimization is iterative; learners must be able to respond to AI feedback and resubmit without losing the audit trail.

**Acceptance:**
- After a forced browser crash, the learner recovers a draft no older than 30 seconds.
- Attempt counts are enforced server-side; the UI cannot bypass them.
- With 'best' policy, the gradebook reflects the highest adjusted score across versions.
- Auto-submitted drafts are attributed to a system actor and labeled as such to the learner.

### GRD-01 Rubric builder with auto-check, AI-judged, and manual criteria

Rubrics have weighted criteria with levels (descriptor plus points). Criterion types are auto-check (bound to engineering checks from the analysis and code engine, for example max demand-capacity ratio at or below 1.0 under all required combinations, deflection within L/360, drift within h/400, no mechanism, required load cases and combinations present, weight within 1.15x benchmark), AI-judged (prompt plus guidance on which evidence to use), and manual. Criteria carry competency tags, learner-visible descriptors, and grader-only notes; rubrics live in an organization or course library and are versioned with the task.

**Why:** Separating deterministic checks from AI judgment is what makes grades defensible: quantitative code compliance is computed, not guessed, and the AI is confined to criteria where judgment is genuinely required.

**Acceptance:**
- A 'Structural design task' template with the seven default criteria can be applied and edited in under 5 minutes.
- Auto-check criteria expose their thresholds and the check they bind to; totals recompute live.
- Changing a rubric after submissions exist prompts a regrade decision and creates a new rubric version.

### GRD-02 Grading pipeline with confidence-based review routing and release control

On each submitted version the pipeline runs: server re-analysis, deterministic checks producing auto-check scores with evidence, AI evaluation of AI-judged criteria (inputs: task environment, constraints, model summary, check results, justification; outputs: score, rationale, evidence citations, confidence), routing rules (always, any confidence below threshold, total within a band of the pass mark, integrity or discrepancy flag, random sample, or never for practice tasks), an instructor/TA review queue with side-by-side model, results, and AI rationale, and release per task or in bulk with a hold-until-all-graded option. Status is visible to the learner at each stage.

**Why:** This is the product's core loop; routing by confidence keeps human review affordable while guaranteeing oversight where the AI is uncertain or the stakes are highest.

**Acceptance:**
- The pipeline is idempotent per submission version and retries failed stages without duplicating grade records.
- Routing rules are configurable per task and inherited from course defaults.
- Review queue sorts by due date and confidence and shows per-criterion AI output with accept/adjust controls.
- Release is atomic per task and emits events consumed by notifications, gradebook, and xAPI.

### GRD-03 Explainable AI feedback with element-anchored evidence

Learners receive per-criterion scores with plain-language rationale, cited evidence (member and node ids, load combinations, code clause references such as ASCE 7-22 Section 2.3.6 or EN 1993-1-1 6.3.1), concrete improvement suggestions, and a label stating whether the grade is AI-provisional or reviewed by a named instructor. Evidence is clickable and highlights the referenced elements in the 3D viewer. v1.x adds instructor-authored annotations anchored to model elements and inline comments on the justification.

**Why:** An unexplained AI score is unacceptable in education and would fail EU AI Act transparency expectations; anchoring evidence to the model turns grading into teaching.

**Acceptance:**
- Every AI-judged criterion has a rationale and at least one evidence item or an explicit 'no evidence found' statement.
- Clicking an evidence item highlights the elements and selects the relevant load combination in the viewer.
- Grader-only notes never appear in the learner view or exports.

### GRD-04 Overrides, regrade requests, appeals, and grade history

Instructors (and TAs when granted) can override any criterion or total with a mandatory reason. Learners can request a regrade within a configurable window with a stated reason; the instructor upholds or adjusts with a comment, with optional escalation to a second grader. The complete history (who, when, what, why) is visible to instructors and, for released grades, to the learner.

**Why:** Due process for AI-assisted grading is a hard requirement for institutional adoption and for learner trust.

**Acceptance:**
- Each override creates a new grade record rather than mutating the old one.
- Regrade requests outside the window are rejected with the window shown.
- The learner is notified of the decision and can view the comment and resulting change.
- Grade history is included in gradebook exports.

### GBK-01 Gradebook with weighting policies, grading scales, and CSV export

The offering gradebook shows learners by graded items with categories and weights, drop-lowest-N, extra credit, excused, missing policy (zero after due), late adjustments, and status chips (late, resubmitted, under review, under appeal, provisional). Final grades render in the course scale (points, percent, letter with configurable cutoffs, or pass/fail). Learners see only released items. Exports include generic and Canvas/Moodle-compatible CSV layouts and a grade-history export; manual CSV import for offline items is v1.x and LTI passback is INT-01.

**Why:** Instructors judge an LMS by its gradebook; the weighting rules must be explicit and exports must drop into existing institutional workflows.

**Acceptance:**
- A 500-learner by 60-item gradebook loads in under 2 seconds at p95.
- Changing weights or drop rules recomputes final grades live and matches the formula in the domain notes.
- Exports match on-screen values exactly, including raw/adjusted late values.
- The learner view never includes unreleased or held grades.

### PRG-01 Completion rules, prerequisites, and gating

Each activity has a completion rule: viewed, minimum time, played or scrolled percentage, quiz score threshold, guided-lesson checkpoints complete, task submitted, task graded at or above a threshold, or manual mark complete. Module completion requires all required activities; course completion requires all required modules and an optional minimum final grade. Prerequisites between activities or modules, sequential mode, and date-based unlocks are enforced in the API, with per-learner instructor bypass.

**Why:** Completion and gating drive certificates, learning paths, and analytics; enforcing them server-side prevents URL-skipping.

**Acceptance:**
- Rules are evaluated from events server-side; direct API access to a gated activity returns 403 with the unmet prerequisite.
- Completion timestamps are immutable unless an instructor resets with a logged reason.
- Course completion emits an event consumed by certificates and xAPI.

### PRG-02 Learner progress dashboard and resume

The learner home lists enrolled courses with progress percentage, next activity, items due within 7 days (honoring cohort offsets and extensions), grades and feedback awaiting review, and a resume action that returns to the last position including a mid-lesson step. The course outline shows per-activity status. An ICS calendar feed is v1.x.

**Why:** Self-paced professionals and students alike need a single place that answers 'what is next and when is it due'.

**Acceptance:**
- Resume returns to the exact activity and guided-lesson step with the working draft intact.
- Due-soon list is correct for a learner with a cohort offset and an individual extension.
- Dashboard loads in under 1.5 seconds at p95.

### NTF-01 In-app and email notifications with preferences and digests

Event-driven notifications cover enrollment, activity release, due in 48h and 24h, grade released, feedback or regrade decision, review requested (instructor/TA), discussion reply or mention, and announcements, delivered to an in-app inbox and by email either immediately or as a daily digest per user preference and category. Organizations supply templates and branding; non-essential categories are unsubscribable. v1.x adds instructor alerts for at-risk learners and aging review queues; Slack/Teams webhooks are later.

**Why:** Deadlines and grade releases are the moments learners and instructors care about; reliable, configurable delivery is baseline LMS quality.

**Acceptance:**
- Immediate notifications are delivered within 60 seconds of the event.
- Digest batching respects the user's timezone and preference.
- Bounces and unsubscribes are honored and visible to organization admins.

### DSC-01 Task-attached discussions, Q&A, and announcements

Threads exist at course and activity level with a Q&A mode (accepted and instructor-endorsed answers, upvotes), private-to-instructors questions, anonymous-to-peers posting, attachments including model view snapshots as images, configurable restriction on sharing full model links before the deadline, mentions, moderation (edit, delete, lock, pin), and search. Announcements are course-level, schedulable, pinnable, emailed, and tracked for reads in v1.x.

**Why:** Questions about a specific task belong next to the task; private questions avoid leaking solutions in design courses.

**Acceptance:**
- A question posted from a task page appears in both the task view and the course forum with the task linked.
- Private questions are invisible to peers and visible to instructors and section TAs.
- Scheduled announcements publish and email at the scheduled time in the offering timezone.

### ANL-01 Instructor analytics with common-mistake aggregation

Per offering and section: progress funnel per activity (not started, in progress, submitted, graded), grade distributions, time-on-task, lateness, and at-risk flags (inactivity, missing submissions, low scores). Common mistakes are aggregated from rubric criterion outcomes and standardized AI evidence tags (for example 'missing seismic load combination' 41%, 'over-utilized members' 28%, 'deflection limit exceeded' 22%) with drill-down to learners and example submissions, and CSV export.

**Why:** Aggregated engineering mistakes are the unique instructional signal this product can provide; a lecture can be re-planned around the fact that 41% of a cohort missed a load combination.

**Acceptance:**
- Mistake tags come from the taxonomy in the domain notes and are emitted by both the check engine and the AI grader.
- Dashboard data is no more than 5 minutes stale.
- Drill-down respects section scoping for TAs.

### A11Y-01 WCAG 2.2 AA conformance for the LMS shell and authored content

All LMS pages (dashboard, course, quizzes, gradebook, discussions, settings, admin) meet WCAG 2.2 AA including the 2.2 criteria (focus not obscured, 24x24 target size, dragging alternatives, consistent help, accessible authentication). Authored content runs through an accessibility checker (alt text, heading structure, contrast), video requires captions, and the whole shell is keyboard-operable and screen-reader tested with NVDA, JAWS, and VoiceOver.

**Why:** US public universities must meet WCAG 2.1 AA under the 2024 ADA Title II rule (large entities from April 2026), EU public bodies follow EN 301 549, and procurement teams require a VPAT; failing this blocks sales.

**Acceptance:**
- Automated axe scans report zero serious or critical issues on every page in CI.
- A manual audit of the 10 core flows passes before each release.
- A VPAT (ACR) is published by v1.x.

### I18N-01 UI internationalization framework

All UI strings are externalized using ICU MessageFormat with locale-aware dates, times, and numbers, a per-user locale, and RTL-ready layout; MVP ships English only with pseudo-locale testing, v1.x adds Spanish, and course content is localized by authors as per-language course variants later.

**Why:** Retrofitting i18n is expensive; shipping translation-ready costs little now and the audience is global.

**Acceptance:**
- A lint rule fails the build on hard-coded user-facing strings.
- The pseudo-locale build renders with no truncation or untranslated strings in core flows.
- Dates, times, and numbers follow the user's locale.

### I18N-02 Units and design-code localization

All quantities are stored in SI; users choose SI or US customary display with engineering-appropriate units (kN, kN-m, MPa, mm versus kip, kip-ft, ksi, in) and significant-figure rules. A task defines its working unit system and may lock it (US code-set tasks in US units) while showing conversions; quiz answers, gradebook, analytics, and certificates follow the preference; and code-set vocabulary (for example 1.2D+1.6L versus EN 1990 6.10a/6.10b) is localized per task.

**Why:** Mixed-unit mistakes are a classic engineering failure; comparisons must happen in SI so rounding never flips a pass/fail check, while learners work in the units their code requires.

**Acceptance:**
- Switching display units converts every value on screen consistently, including historical grades and feedback.
- Locked tasks show the working unit prominently with converted values secondary.
- Threshold comparisons are performed in SI before formatting; a rounding test suite shows no pass/fail flips.

### DAT-01 FERPA-aligned access controls and immutable audit logging

Grades, submissions, and feedback are treated as education records: access is limited to roles with legitimate educational interest, every export or API access to education records is written to a disclosure log, and directory-information settings are per organization. An immutable audit log captures auth events, role changes, grade changes, submission events, exports, and admin or impersonation actions with actor, timestamp, before/after values, and reason, with an organization-admin viewer and export.

**Why:** US institutions cannot adopt a system that lacks FERPA-aligned access and disclosure logging; the same log underpins appeals and AI-grading accountability.

**Acceptance:**
- 100% of grade-affecting actions produce an audit entry; entries cannot be edited or deleted through any API.
- Audit retention is configurable with a minimum of 7 years for grade records.
- Impersonation requires a reason and is visible to the affected organization's admin.

### DAT-02 GDPR rights, consent, and data residency

Documented lawful basis and a per-organization DPA; automated data-subject export (machine-readable JSON plus files) and erasure that pseudonymizes grade records the institution must retain; consent management for non-essential analytics and cookies; a data residency region (US or EU) chosen at tenant creation with all personal data and submissions stored in-region; a published subprocessor list including the AI provider; and a breach-notification runbook.

**Why:** European universities and any institution with EU learners require this before contract; residency is far cheaper to design in than to add.

**Acceptance:**
- A DSAR export is produced automatically within 72 hours.
- Erasure removes direct identifiers within 30 days while leaving pseudonymous grade records.
- Configuration tests prove EU-tenant data paths never leave the EU region.

### DAT-04 AI grading governance and transparency

Every AI-graded task displays a plain-language notice of how AI is used and the human oversight path; AI provider calls use pseudonymous ids and exclude direct identifiers; prompts, outputs, and model and prompt versions are logged per grade for audit and reproducibility; learner data is never used for model training without explicit organization opt-in; and the model and prompt version is pinned per offering with a change log. EU AI Act high-risk (education) readiness documentation (risk management, logging, human oversight) is prepared for v1.x.

**Why:** AI systems that evaluate learning outcomes are listed as high-risk in the EU AI Act (Annex III), and institutional AI policies demand transparency and reproducibility; this is a sales blocker if absent.

**Acceptance:**
- The notice is visible on every AI-graded task page and in feedback.
- Each grade record stores the model identifier, prompt version, and a reference to the logged exchange.
- The training-data opt-in defaults to off and is visible only to organization admins.
- Changing the pinned model or prompt for a running offering requires an instructor acknowledgement and is logged.

## Should (v1.x)

### TEN-02 Departments, delegated administration, shared catalog, and self-serve learners

Organizations can define departments that own courses and have department admins with scoped roster management and reports (single level in v1.x, hierarchy later). Platform-authored courses live in a shared catalog that organizations can adopt (copy or link to a pinned version), and individual practicing engineers can self-register into a platform-run open tenant to enroll in catalog courses.

**Why:** Universities delegate course administration to departments, and the stated practicing-engineer audience mostly arrives without an institution; a shared catalog lets Bridle-authored content reach both.

**Acceptance:**
- Department admin can only see and manage courses, users, and reports belonging to their department.
- Adopting a catalog course creates an offering pinned to a catalog version and notifies the adopter when a newer version is published.
- A self-serve user can sign up, enroll in a catalog course, submit a task, receive a grade, and complete the course without any admin action.

### AUTH-02 Enterprise identity: SSO (SAML 2.0/OIDC), MFA, SCIM provisioning

Organizations configure their own identity provider (SAML 2.0 or OIDC; Okta, Entra ID, Shibboleth) via metadata upload, with email-domain-based IdP routing, just-in-time provisioning, and attribute-to-role mapping. MFA (TOTP and passkeys/WebAuthn) is optional for learners and enforceable by policy for instructor and admin roles. SCIM 2.0 provisioning and deprovisioning is a later sub-item.

**Why:** Institutional procurement routinely requires SSO and MFA for privileged users; SCIM reduces roster churn at scale but is not needed for pilot institutions.

**Acceptance:**
- Organization admin configures an IdP through the UI without engineering help and tests the connection.
- SSO login creates or links the user and applies mapped roles; a deprovisioned user loses access within 15 minutes.
- An organization MFA policy blocks privileged-role logins until MFA enrollment is complete.

### CRS-05 Multi-stage projects and team submissions

A project activity has milestones (for example concept, analysis, design, final report), each with its own deadline, deliverables, and rubric, and a weighted aggregate grade. Teams can be instructor-formed or self-formed with size limits, share one model and submission, keep a member contribution log, and optionally complete peer evaluations; instructors can adjust individual grades.

**Why:** Capstone and design-studio courses are project-based and collaborative; this is the natural v1.x expansion once single-learner tasks are solid.

**Acceptance:**
- Milestone deadlines and late policies apply independently.
- All team members see the shared submission and its versions; contribution log records who changed what.
- Instructor can override an individual's grade without changing teammates' grades.

### SUB-03 Academic integrity controls and similarity detection

An honor pledge is captured with each submission, editing locks after the close date, and instructors see a submission timeline of draft activity. Similarity detection compares model topology, geometry, and section assignments plus justification text across the cohort and prior offerings, producing a ranked report (no automatic penalties), with starter-model similarity excluded. Sharing full model links before the deadline can be restricted per task.

**Why:** Design files are easy to copy; instructors need evidence tooling that respects due process rather than auto-flagging.

**Acceptance:**
- Similarity report lists pairs with topology similarity at or above a configurable threshold with side-by-side views.
- Starter-model elements are excluded from similarity scoring.
- Pledge text and acceptance timestamp are stored with the version.

### GRD-05 Calibration and AI accuracy monitoring

Instructors blind-grade a sample set per task; the system reports per-criterion agreement with the AI (within one rubric level), suggests routing-threshold adjustments, and tracks ongoing overturn rate, mean adjustment, and drift per task and criterion. Tasks whose overturn rate exceeds a threshold automatically switch to full review.

**Why:** The AI grader's quality must be measured continuously per task rather than assumed; calibration data is also the evidence base for institutional approval.

**Acceptance:**
- Calibration report shows agreement per criterion and a recommended confidence threshold.
- Overturn rate above 10% over the last 20 reviewed submissions raises the review rate to 100% and alerts the instructor.
- Metrics feed ANL-02.

### PRG-03 Competency mastery tracking and learning paths

A platform competency framework for structural engineering (see domain notes) with organization-specific extensions; rubric criteria and quiz questions are tagged, and mastery per competency is computed by the formula in the domain notes after grade release. Learners see a mastery profile, instructors a section heatmap. Learning paths are ordered course sequences at program level with prerequisites and recommended-next; adaptive remediation suggestions are later.

**Why:** Mastery across tasks (for example load combinations or lateral systems) is more meaningful for engineers and accreditors than course-level grades, and it powers remediation and upskilling paths.

**Acceptance:**
- Mastery updates within 1 minute of grade release and reflects evidence from at least two activities before showing 'mastered'.
- Heatmap filters by section and competency and drills to learners.
- Learning path shows locked and unlocked courses with the unmet prerequisite named.

### CRD-01 Certificates, Open Badges, and PDH/CPD credit

Certificates (PDF with unique id, verification URL, and QR) are issued automatically when a course's completion rule and optional minimum grade are met, use organization templates, and can be revoked. Later: Open Badges 3.0 (Verifiable Credentials) for competencies with 2.0 export for legacy wallets, and PDH/CPD hour records per course with a CPD statement for practicing engineers, subject to the provider-accreditation decision.

**Why:** Professional learners need proof of continuing education, and universities use certificates for non-credit offerings; badges and PDH depend on business decisions not yet made.

**Acceptance:**
- Certificate issues within 1 minute of meeting the rule and the verification page shows issue status and revocation.
- Badge JSON validates against the Open Badges 3.0 schema when that sub-feature ships.

### ANL-02 Admin usage and AI operations analytics

Organization admins see active users, enrollments, completions, certificates, SSO logins, and storage; platform admins see per-tenant usage, grading pipeline volume, latency, failure rate, LLM cost per submission, and review overturn rate, with exports and scheduled reports.

**Why:** Institutions need usage evidence for renewal, and the team needs grading cost and quality telemetry to run the AI grader sustainably.

**Acceptance:**
- Metrics are available by day, week, and term.
- Cost per tenant and per task is visible with alert thresholds.

### A11Y-02 Accessible alternatives for the 3D workspace and results

Because WebGL canvases are opaque to assistive technology, provide equivalent non-visual paths: a tabular model editor (nodes, members, supports, loads, sections), sortable results tables for utilization and deflection, a textual analysis summary, keyboard camera controls, a reduced-motion mode, and high-contrast element coloring; guided-lesson checkpoints must be achievable through the tables.

**Why:** Full canvas accessibility is infeasible, but a table-based path keeps simulation tasks completable by screen-reader users and gives a defensible VPAT exception.

**Acceptance:**
- A tester completes a simulation task end-to-end using only the tabular editor and keyboard.
- Results tables are readable by a screen reader with correct headers and units.
- Exceptions are documented in the VPAT.

### INT-01 LTI 1.3 Advantage tool integration

Bridle acts as an LTI 1.3 tool: OIDC login and launch, Deep Linking 2.0 (instructors pick a task, lesson, or course from Canvas, Moodle, Blackboard, or D2L), Assignment and Grade Services 2.0 (line-item creation and score passback with activity and grading progress), and Names and Role Provisioning Services 2.0 (roster sync into sections), with per-platform registrations (dynamic registration where supported), user linking by claims and verified email, and context-to-offering mapping. 1EdTech certification and the Submission Review service are later.

**Why:** Universities will not run a second gradebook; passback and seamless launch from the campus LMS is the path to adoption, but pilots can begin with CSV export.

**Acceptance:**
- Launching from Canvas opens the mapped task in context without a separate login.
- A released grade appears in the platform gradebook within 60 seconds; failures retry with backoff and are visible to the instructor.
- Roster sync creates and deactivates enrollments according to NRPS membership.

### INT-02 xAPI statements to an external LRS

Emit xAPI 1.0.3-compatible statements (ready for xAPI 2.0, IEEE 9274.1.1-2023) for launched, attempted, completed, passed, failed, scored, and answered plus custom verbs for submitted-design and checkpoint-achieved, using activity-type IRIs for course, module, lesson, assessment, and simulation. Organizations configure LRS endpoints and auth with a pseudonymous-actor option; deliveries are queued and retried. Caliper 1.2 and cmi5 are later.

**Why:** Institutions with learning-record stores and corporate L&D teams expect xAPI; it is also the standard way to expose simulation activity without a bespoke integration.

**Acceptance:**
- Statements pass the ADL LRS conformance test suite.
- LRS configuration is per organization with a test-send action.
- Failed deliveries are retried and surfaced in the admin console.

### INT-03 Public REST API and webhooks

An OAuth2 client-credentials API exposes users, enrollments, offerings, grades, completions, and submission metadata with organization-scoped tokens, rate limits, and a published OpenAPI spec. Signed webhooks fire for submission created and graded, enrollment changes, and completions with retries.

**Why:** Institutional IT and corporate L&D integrate through APIs; webhooks let partners react to grading events without polling.

**Acceptance:**
- OpenAPI spec is published and versioned.
- Webhooks are HMAC-signed and retried with exponential backoff for 24 hours.
- Tokens are scoped per organization and revocable.

### DAT-03 Retention policies, legal hold, and learner data export

Per-organization retention rules by record type (submissions, drafts, logs, discussions) with sensible defaults, scheduled purge jobs with dry-run reports, legal-hold overrides, and a learner self-service export of their own submissions (model JSON, justification, feedback) available during and for a configurable period after the course.

**Why:** Institutions have records schedules, and engineers want to keep their own designs; both reduce storage cost and privacy exposure.

**Acceptance:**
- Purge jobs support dry-run and produce a report of affected records.
- Legal hold blocks purge for the held scope and is logged.
- Learner export is downloadable in an open, documented format.

## Could (later)

### INT-04 Other standards: QTI 3.0, Common Cartridge, OneRoster; SCORM explicitly excluded

QTI 3.0 import and export of quizzes, Common Cartridge 1.3 export of courses, and OneRoster 1.2 rostering are later additions. SCORM is explicitly out of scope: Bridle is itself the LMS and its content is live simulation rather than packaged content; if customers need packaged-content import, cmi5 will be evaluated instead.

**Why:** These standards matter to a minority of institutions; recording the SCORM decision now prevents repeated scope debates.

**Acceptance:**
- An architecture decision record documents the SCORM exclusion and cmi5 alternative.
- QTI import of a sample set of multiple-choice and numeric items succeeds when the feature ships.

## Non-functional targets

| id | title | target |
|---|---|---|
| NFR-01 | Gradebook and roster performance | A 500-learner by 60-item gradebook renders in under 2 s at p95; roster operations on 500 rows complete in under 30 s; learner dashboard under 1.5 s at p95. |
| NFR-02 | Grading turnaround | Deterministic checks plus AI provisional feedback delivered within 10 minutes at p95 for models within course size limits (to be set with the simulation domain, suggested 2,000 members / 5,000 DOF); pipeline scales horizontally and queue lag alerts at 5 minutes. |
| NFR-03 | Deadline burst scalability | Accept 2,000 submissions within a 10-minute window with zero loss; submission acknowledgement under 2 s at p95 even when grading is queued. |
| NFR-04 | Availability | 99.9% monthly availability for the LMS core (auth, course access, submission); maintenance windows outside academic peak with a public status page. |
| NFR-05 | Durability and recovery | RPO 15 minutes, RTO 4 hours; submissions stored append-only with content hash; restore drills quarterly. |
| NFR-06 | Security baseline | OWASP ASVS Level 2 controls; tenant-isolation test suite in CI; encryption in transit (TLS 1.2+) and at rest; third-party penetration test before first institutional launch; SOC 2 Type II readiness within 12 months of launch. |
| NFR-07 | Accessibility conformance | WCAG 2.2 AA; zero serious/critical axe findings in CI; manual audit of 10 core flows per release; VPAT/ACR published by v1.x. |
| NFR-08 | Auditability | 100% of grade-affecting, role, export, and admin actions logged with actor, timestamp, before/after, and reason; logs immutable; grade-record audit retained at least 7 years or per tenant policy. |
| NFR-09 | Time correctness | All timestamps stored UTC with offering timezone canonical; automated DST and timezone test suite covering deadlines, late penalties, and digests; zero deadline-miscalculation defects accepted at release. |
| NFR-10 | Browser support | Last two major versions of Chrome, Edge, Firefox, and Safari on desktop; LMS shell fully functional without WebGL (workspace requires WebGL2); responsive down to 1024 px with read-only mobile for dashboard, feedback, and discussions. |
| NFR-11 | Observability | Per-tenant metrics and distributed tracing across the grading pipeline; alerting on pipeline failure rate above 1% and queue lag above 5 minutes; AI cost per submission tracked. |
| NFR-12 | Privacy by design | Selectable US/EU data residency at tenant creation; AI provider calls carry pseudonymous ids only; subprocessor list published; DSAR export automated within 72 hours. |
| NFR-13 | Interoperability conformance | Pass the 1EdTech LTI Advantage conformance suite before GA of INT-01; xAPI statements pass the ADL LRS conformance tests before GA of INT-02. |
| NFR-14 | AI grading quality | On each task's calibration set, AI agrees with instructor within one rubric level on at least 90% of criteria; live overturn rate below 10% per task, with automatic escalation to full review when exceeded. |

## Domain notes (for architecture and UX)

## 1. Core entities (for the architecture data model)
Organization (tenant; settings: unit system, code set, timezone, grading scale, branding, auth methods, retention, seat pool) -> Department (v1.x) -> User, RoleAssignment {user, role, scopeType in [platform, organization, department, offering, section], scopeId}. Program -> Course -> CourseVersion (draft | published | archived; immutable once published) -> Module -> Activity {type, required, points, estimatedMinutes, competencyTags, completionRule}. Offering {courseVersionId, term, timezone, state in [planned, open, running, closed, archived]} -> Cohort {dateOffsetDays or explicit calendar} and Section {instructors, TAs}. Enrollment {user, offering, cohort, section, state}. SimulationTaskDefinition (activity payload; schema-versioned; see section 6). GuidedLesson {steps[{instructions, highlights, checkpointPredicate, hints}]}. Quiz {questions, bank refs, timing, attempts}. Submission {activity, enrollment, versions[]}; SubmissionVersion {n, modelSnapshotRef, taskVersionRef, clientResultsRef, serverAnalysisRunRef, justification, attachments, contentHash, submittedAt, lateness, status}. AnalysisRun {inputs hash, engine version, results ref, discrepancyFlag}. CheckResult {criterionId, pass/value, evidence[]}. GradeRecord {submissionVersion, rubricVersion, criterionScores[{criterionId, score, rationale, evidence[], confidence, source in [auto, ai, human]}], raw, penalty, adjusted, status, gradedBy, modelVersion, promptVersion}. Review, RegradeRequest, GradeOverride (append-only). CompletionRecord, Competency, MasteryRecord, Certificate, Notification, Thread/Post, Announcement, AuditEvent, DomainEvent (outbox). Mapping to campus LMS terms: Offering ~ Canvas course / Moodle course; Section ~ Canvas section; Cohort ~ Moodle group.

## 2. State machines
- Enrollment: invited -> pending_approval -> active -> completed | withdrawn | suspended | expired; suspended -> active; withdrawn is terminal except admin reinstatement (logged).
- SubmissionVersion: draft (not a version) -> submitted -> analyzing -> checking -> ai_grading -> provisional -> [under_review] -> graded_held -> graded_released; any stage -> failed (retryable, max 3) ; invalid_model (parse/schema failure, learner notified). Lateness: on_time | late | past_close (rejected unless instructor accepts).
- GradeRecord: provisional -> reviewed -> released -> (overridden | under_appeal -> appeal_resolved) ; final when offering closes. Every change appends a record; nothing mutates.
- CourseVersion: draft -> published -> deprecated (no new offerings) -> archived. Offering: planned -> open (enrollment) -> running -> closed (grades final) -> archived.
- Review routing decision: review_required = policy==always OR any(criterion.confidence < tau_criterion) OR |total - passMark| <= band OR integrityFlag OR discrepancyFlag OR random() < sampleRate; never for policy==practice.

## 3. Permission matrix (abbreviated; full matrix is a deliverable of ROLE-01)
Action | Learner | TA | Instructor | Author | Org admin | Platform admin
View published content: own enrollments | sections | offerings | preview any version | aggregate only | via impersonation
Submit/resubmit: yes | no | no (test as sandbox) | sandbox | no | no
Grade/comment: no | own sections | offering | no | no | no
Release grades: no | if granted | yes | no | no | no
Override/appeal decision: no | if granted | yes | no | no | no
Edit course blueprint/publish: no | no | if also author | yes | no | no
Manage offering schedule/cohorts/sections: no | no | yes | no | yes (structure only) | yes
Manage users/roster/SSO/settings: no | no | roster of own offering | no | yes | yes
View individual grades: own | sections | offering | no | no (aggregate) | with reason-logged impersonation
Export education records: own | no | offering (logged) | no | org (logged) | logged
Platform ops/feature flags/tenant provisioning: no | no | no | no | no | yes

## 4. Formulas
- Effective due: effectiveDue = coalesce(extension.due, cohortOverride.due, activity.due + cohort.offset); effectiveClose similarly.
- Late penalty (SCH-02): lateSeconds = max(0, submittedAt - effectiveDue - graceSeconds); periods = ceil(lateSeconds / periodSeconds); percentage mode: penaltyFraction = min(cap, ratePerPeriod * periods), adjusted = raw * (1 - penaltyFraction); fixed mode: adjusted = max(0, raw - fixedPerPeriod * periods); submittedAt > effectiveClose -> rejected unless instructor accepts (then policy applies with discretion flag). Store raw, penaltyFraction/points, adjusted, policyVersion.
- Weighted final grade (GBK-01): for each category c, included items = graded items minus excused minus dropped (drop lowest N by percentage); missing items count as 0 if pastDue and missingPolicy==zero, else excluded; categoryScore_c = sum(earned_i) / sum(possible_i); extra-credit items add to earned only. final = sum(w_c * categoryScore_c) / sum(w_c over categories with >= 1 included item) when normalizeEmptyCategories is true, else divided by sum of all weights. Letter = first cutoff <= final percent. Points-only courses: final = sum(earned)/sum(possible).
- Mastery (PRG-03): for competency k, evidence items e_i with normalized score s_i in [0,1] (criterion points / max, or quiz item correctness), weight w_i = activityWeight_i * recency^(rank_i) with recency default 0.8; M_k = sum(w_i s_i)/sum(w_i). Status: mastered if M_k >= 0.80 and evidence from >= 2 distinct activities; developing 0.60-0.79; needs_work < 0.60; no_data if < 1 evidence item. Recompute on grade release.
- Economy criterion default: score = clamp((1.3 - weight/benchmark) / 0.3, 0, 1) mapped to rubric levels; full marks at or below 1.0x benchmark, zero above 1.3x; benchmark hidden from learners.
- AI agreement metric (GRD-05, NFR-14): agreement = share of criteria where |aiLevel - humanLevel| <= 1; overturnRate = reviewed submissions with any criterion adjusted / reviewed submissions (rolling 20).

## 5. Reference data
Activity types: page, video, slides, pdf, quiz, guided_lesson, simulation_task, external_link (MVP); project, discussion, survey (v1.x).
Completion rule types: viewed, min_time(seconds), media_progress(percent), quiz_score(threshold), lesson_checkpoints_complete, task_submitted, task_graded(threshold), manual.
Notification events: enrollment.created, activity.released, activity.due_soon(48h,24h), grade.released, regrade.decided, review.requested, discussion.replied, discussion.mentioned, announcement.published, certificate.issued, extension.granted.
Common-mistake tag taxonomy (emitted by check engine and AI grader): LOADS: missing_load_case, wrong_load_magnitude, missing_load_combination, wrong_combination_factors, wrong_wind_exposure_or_direction, missing_seismic_mass, missing_snow_drift, missing_self_weight, wrong_risk_category. ANALYSIS: unstable_mechanism, unconnected_members, wrong_support_conditions, wrong_member_releases, unit_mismatch, p_delta_ignored. STRENGTH: member_overstressed, section_class_misapplied, unbraced_length_wrong, column_slenderness_exceeded. SERVICEABILITY: deflection_exceeded, drift_exceeded. ECONOMY: widespread_overdesign (DCR < 0.5 on > 50% of members), weight_above_benchmark, nonstandard_sections, excessive_section_variety. CONSTRUCTABILITY: impractical_geometry, incompatible_connections, no_lateral_system, non_repetitive_layout. JUDGMENT: unjustified_assumption, missing_load_path_description, justification_contradicts_model, no_alternatives_considered, incorrect_code_reference.
Competency framework (platform default, ids SE-*): SE-LOAD-1 gravity loads and tributary areas; SE-LOAD-2 load combinations (ASCE 7 Ch. 2 / EN 1990 6.4.3); SE-LOAD-3 wind loads; SE-LOAD-4 seismic loads and equivalent lateral force; SE-LOAD-5 snow, temperature, other environmental; SE-ANL-1 statics and load path; SE-ANL-2 indeterminate analysis and stiffness method; SE-ANL-3 modeling assumptions (supports, releases, diaphragms); SE-ANL-4 stability, buckling, P-Delta; SE-STL-1 steel tension/compression; SE-STL-2 steel flexure (LTB) and shear; SE-STL-3 steel connections; SE-CON-1 RC flexure; SE-CON-2 RC shear and detailing; SE-CON-3 RC columns and slenderness; SE-TIM-1 timber members; SE-LAT-1 lateral systems (braced/moment frames, shear walls, diaphragms); SE-SRV-1 serviceability (deflection, drift, vibration); SE-FND-1 foundations and soil-structure; SE-ECO-1 material efficiency and optimization; SE-CNS-1 constructability; SE-JDG-1 engineering judgment and communication; SE-JDG-2 code navigation and referencing.
Default rubric template 'Structural design task' (100 pts): 1 Strength and code compliance (auto, 25); 2 Serviceability (auto, 15); 3 Stability (auto, 10); 4 Loads and combinations correct for the environment (auto + AI, 15); 5 Material efficiency/economy vs benchmark (auto, 10); 6 Constructability (AI + heuristics, 10); 7 Engineering judgment and justification (AI, instructor-reviewed, 15). Default routing: review if any AI criterion confidence < 0.7, total within 5 points of pass mark, any flag, plus 10% random sample.
Code sets and editions (seed data, versioned): US-2024: IBC 2024, ASCE 7-22, AISC 360-22, ACI 318-25 (ACI 318-19 selectable for IBC 2024 alignment), NDS 2024, TMS 402/602-22. EC-Gen1: EN 1990:2002, EN 1991, EN 1992, EN 1993, EN 1994, EN 1995, EN 1997, EN 1998 with National Annex selection (UK, DE, FR, NL, ES, IT initially). EC-Gen2 (second-generation Eurocodes, published 2022-2027) added later via the same versioning. Later candidates: Canada NBCC 2020 / CSA S16 and A23.3; AS/NZS 1170; India IS 456 / IS 800.
Serviceability defaults (editable per task): floor live-load deflection L/360, total load L/240, roof L/180 (IBC Table 1604.3); wind drift h/400 (ASCE 7 commentary range h/600 to h/400); seismic allowable story drift per ASCE 7-22 Table 12.12-1 (0.020 h_sx typical for Risk Category I/II, 0.015 for III, 0.010 for IV); Eurocode: span/250 to span/500 per National Annex, EN 1998 damage limitation 0.005 h to 0.010 h.
Units: canonical SI (N, m, Pa, kg, degC); display sets SI-engineering (kN, kN-m, MPa, mm, kN/m2) and US customary (kip, kip-ft, ksi, in, psf, lbf). Precision: 3-4 significant figures for forces/stresses, 1 mm or 0.01 in for deflections; comparisons in SI before formatting.
xAPI vocabulary: verbs http://adlnet.gov/expapi/verbs/{launched, attempted, completed, passed, failed, scored, answered, experienced}; custom verbs under a Bridle IRI namespace for submitted-design and checkpoint-achieved; activity types http://adlnet.gov/expapi/activities/{course, module, lesson, assessment, simulation}.
LTI role mapping: membership#Instructor -> instructor; membership/Instructor#TeachingAssistant -> TA; membership#Learner -> learner; membership#ContentDeveloper -> course author; institution/person#Administrator -> institution admin. Context id maps to Offering; NRPS section claims map to Section.
Environment parameter schema (task, section 6) uses risk category I-IV (US) or consequence class CC1-CC3 (EC).

## 6. Simulation task definition schema (shape, to be formalized in a shared contracts package)
{ taskId, version, scenario: {title, narrative, learnerHints[], resources[]}, environment: { site: {name, lat, lon, country, elevation}, riskCategory|consequenceClass, wind: {basicSpeed, exposureOrTerrain, topographicFactor}, seismic: {SDS, SD1, siteClass, R, Ie, Cd} | {ag, groundType, q, importanceClass}, snow: {groundSnowLoad, exposure, thermal, roofSlope}, temperature: {min, max, installation}, soil: {bearingCapacity, class, groundwater}, occupancy: {liveLoadByArea, partitions} }, codeSet: {id, editions{}}, starterModel: {modelRef | null, lockedElementIds[]}, catalogs: {materials[], sections[]}, envelope: {bounds, fixedSupports[], fixedLoads[]}, constraints: {maxWeight|maxCost, deflectionLimits{}, driftLimit, minClearSpan, other[]}, deliverables: {model: true, justification: {minWords, maxWords, prompts[]}, calcPdf: optional}, rubricRef: {id, version}, attemptPolicy: {max, cooldownMinutes, resubmitWindowDays, gradingTarget}, reviewRouting: {...}, hidden: {referenceSolutions[], benchmarks{weight, cost}, graderNotes}, unitSystem: {working, locked} }

## 7. Architecture recommendations within this domain
- Tenant isolation: organization_id on every tenant-owned row plus database row-level security or an equivalent mandatory query filter; isolation tests in CI.
- Submissions and model snapshots in object storage keyed by content hash; database holds metadata only; append-only tables for versions, grade records, overrides, audit.
- Transactional outbox for DomainEvents feeding notifications, xAPI, analytics, and webhooks; idempotency keys on the grading pipeline keyed by submissionVersionId plus rubricVersion.
- Grading pipeline as a durable job workflow (re-analysis -> checks -> AI -> routing -> queue) with per-stage retries and dead-letter visibility; AI calls carry pseudonymous ids, pinned model and prompt versions logged per grade.
- Shared versioned contracts package: task schema, model schema, check-results schema, grade-record schema, event schema; consumed by LMS, simulation, and grading services.
- Time: store UTC, carry offering timezone id, compute deadlines server-side; never trust client clocks.
- Gradebook computation server-side with cached materialized totals invalidated by events; exports generated from the same computation.
- Analytics via the event stream into a warehouse or columnar store; mistake tags are first-class event attributes.
- Buy, don't build: video transcoding/streaming, transactional email, captioning, LTI library, PDF rendering.

## 8. UX implications (key screens and flows)
Learner: dashboard (progress, due soon, resume), course outline with status, task page (scenario, environment summary, constraints, deliverables, rubric descriptors, attempts left, late warning), workspace with guided-lesson overlay and checkpoint feedback, submit flow (deliverables checklist, honor pledge, penalty preview, receipt), submission history with version compare, feedback view with per-criterion evidence that highlights model elements, regrade request, discussions/Q&A on task, notifications inbox, mastery profile (v1.x).
Instructor/TA: review queue (sorted by due/confidence, filters by section and flags), review screen (model viewer, server results, AI rationale per criterion, accept/adjust, comments, annotations v1.x), release controls, gradebook, extensions/accommodations manager, cohort/section manager, analytics with common-mistake drill-down, calibration workspace (v1.x), announcements and forum moderation.
Author: course builder (hierarchy, versions, publish, diff), simulation task builder (environment wizard with site-derived hazards, catalogs, constraints, deliverables, hidden references, test-submit), guided-lesson step builder with predicate picker, rubric builder with templates, preview-as-learner.
Admin: organization settings (defaults, branding, auth, residency, retention), users and roles, roster import, seat usage, audit viewer, integrations (SSO, LTI, LRS, API tokens), usage reports.

## 9. MVP cut line
Must (MVP): TEN-01, ROLE-01, AUTH-01, CRS-01..04, CNT-01..02, ENR-01..02, SCH-01..02, SUB-01..02, GRD-01..04, GBK-01, PRG-01..02, NTF-01, DSC-01, ANL-01, A11Y-01, I18N-01..02, DAT-01..02, DAT-04. Should (v1.x): TEN-02, AUTH-02, CRS-05, SUB-03, GRD-05, PRG-03, CRD-01, ANL-02, A11Y-02, INT-01..03, DAT-03. Could (later): INT-04 and the badge/PDH sub-items of CRD-01.

## 10. Proposed critical files to create first (stack-agnostic paths; repo is empty)
- packages/contracts/task-definition.schema.json (CRS-03 contract shared with simulation and grading)
- packages/contracts/grade-record.schema.json and check-results.schema.json (GRD-01/02 outputs)
- apps/api/src/authz/permission-matrix.ts (ROLE-01 matrix as data plus enforcement middleware)
- apps/api/src/grading/pipeline.ts (GRD-02 durable workflow: re-analysis -> checks -> AI -> routing -> release)
- apps/api/src/gradebook/compute.ts and apps/api/src/scheduling/late-policy.ts (GBK-01 and SCH-02 formulas with exhaustive unit tests)

## Risks

| risk | mitigation |
|---|---|
| AI grader mis-grades code compliance or judgment criteria, eroding trust and creating academic-integrity disputes. | Quantitative criteria are computed by the deterministic check engine, not the LLM; AI is confined to judgment criteria with evidence citations; confidence-based review routing, per-task calibration (GRD-05), overturn monitoring (NFR-14), and a full regrade/appeal path (GRD-04). |
| Client-side analysis results are tampered with or diverge from server results, invalidating grades. | Server-side re-analysis on every submitted version (SUB-01) with discrepancy flags and content hashes; grading consumes only server results. |
| Course versioning plus offerings plus cohorts becomes an over-engineered MVP that delays launch. | MVP implements immutable published snapshots pinned per offering with stable activity ids; the upgrade-with-diff tool can ship in a simplified form (warn-only) and mature in v1.x. |
| Deadline, timezone, and DST defects at scale cause mass disputes during exam weeks. | UTC storage with offering timezone canonical, an automated DST test suite (NFR-09), pre-deadline load testing (NFR-03), and learner-visible explicit timezone labels. |
| Regulatory obligations (FERPA, GDPR, EU AI Act high-risk classification for education) slow institutional contracts. | Privacy-by-design baseline in MVP (DAT-01, DAT-02, DAT-04), DPA and subprocessor templates prepared before first sale, and AI governance documentation drafted in v1.x; track the EU AI Act timeline for high-risk obligations (scheduled August 2026, with a Commission delay proposal pending) and confirm with counsel. |
| LTI 1.3 integration and 1EdTech certification take longer than planned and block university adoption. | Use a mature LTI 1.3 library, target Canvas first, ship CSV export in MVP as the fallback, and treat certification as a separate milestone. |
| Generic-LMS scope creep (video hosting, forums, calendars) starves the differentiating simulation-grading loop. | Hold the must list strictly; buy rather than build commodity pieces (video transcoding, email delivery, captioning) and defer non-core features to v1.x. |
| Accessibility of the 3D workspace is unattainable and jeopardizes VPAT-driven procurement. | Guarantee WCAG 2.2 AA on the LMS shell (A11Y-01), provide table-based equivalents for the workspace (A11Y-02), and document residual exceptions in the VPAT. |
| LLM grading cost grows linearly with submissions and resubmissions, hurting margins. | Cache deterministic results, limit AI to judgment criteria, cap resubmission counts via attempt policy, batch review, and track cost per tenant and task (ANL-02) with budgets. |
| The task and model JSON schemas churn between the LMS, simulation, and grading domains, breaking stored submissions. | Define a shared versioned contracts package early (task schema, model schema, check-results schema, grade-record schema) with backward-compatible evolution rules and migration tests. |

## Open questions

- Go-to-market for MVP: institution-only tenants, or also self-serve individual engineers (TEN-02) with payments? This decides whether a platform-run open tenant and billing are MVP.
- Which design code sets ship first: US (ASCE 7-22, AISC 360-22, ACI 318-25) or Eurocode first-generation with a specific National Annex? This fixes the initial auto-check library, rubric templates, and unit defaults.
- Can an AI-only grade ever be final (for example practice tasks), or must every credit-bearing grade be human-reviewed? Institutional policy and EU AI Act exposure vary; routing defaults depend on the answer.
- Do pilot institutions require grade passback to Canvas/Moodle on day one? If yes, INT-01 (LTI 1.3 Advantage) moves from should to must and must be scheduled early.
- Are team projects (CRS-05) needed for the first academic pilot (capstone courses) or can MVP be single-learner only?
- Will any learners be under 18 (dual-enrollment high school programs)? That adds parental consent and COPPA-adjacent handling.
- Will Bridle pursue PDH/CPD provider accreditation (for example state board or RCEP recognition)? This determines whether PDH records in CRD-01 are informational or certifiable.
- Will the first customers include EU institutions, making EU data residency (DAT-02) a launch requirement rather than a configuration option?
- Who owns the IP of learner-created designs, and may anonymized designs be used to improve the grader with organization opt-in (DAT-04)?
- Should letter-grade cutoffs be standardized per organization or configurable per course, and is anonymous grading a stated requirement from any target institution?
- What model size limits (members, DOF, plates) define 'course-sized' for the grading SLA (NFR-02)? Needs agreement with the simulation domain.
- Which LRS vendors and campus LMS platforms (Canvas, Moodle, Blackboard, D2L) are the pilot targets, in priority order?
