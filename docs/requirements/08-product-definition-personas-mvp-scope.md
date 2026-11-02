# Product definition, personas, MVP scope

_Source: requirements discovery workflow `wf_6281c128-0bb` (domain agent), 2026-11-03. 45 requirements: 26 must (MVP), 15 should (v1.x), 4 could (later)._

## Summary

Bridle is a simulation-native LMS for structural engineering: the product's spine is one loop (scenario task -> build/adjust a structure in a live 3D FEA workspace -> self-check -> written justification -> submit -> AI-proposed, instructor-reviewed, per-criterion feedback -> resubmit), and every persona-facing surface is organized around that loop. The landscape splits into tools without pedagogy (SkyCiv Education, SAP2000/ETABS/RISA academic licenses, Ftool/MASTAN2/Bridge Designer) and pedagogy without simulation (Canvas/Moodle, Mastering/Connect/PrairieLearn, MOOCs, PE-prep courses); Bridle's defensible position is open-ended design assessment against real-world code and site criteria, with instructor-in-the-loop AI grading, per-learner randomized scenarios, and outcome mastery tracking mapped to ABET and NCEES. The recommended MVP is one ready-to-teach course (steel and RC beams, trusses, frames; linear static; US code pack with editions pinned per course; US customary and SI) delivered to 1-3 pilot institutions on manually provisioned tenants with CSV grade export, plus a free individual sandbox; LTI 1.3 Advantage, SAML/OIDC SSO, self-serve payments, PDH certificates and corporate team plans are v1.x once explicit MVP exit criteria are met. Those exit criteria are measurable from day one through a product analytics event taxonomy: activation >= 70%, median time-to-first-analysis <= 10 minutes, task completion >= 85%, AI-vs-instructor agreement >= 85% within +/-5 points with override rate < 15%, and feedback-usefulness >= 75%. Grades are released only after human review in MVP, feedback is labeled and explainable, the product is positioned as educational-use-only, and a central entitlement service exists from the start so Free, Pilot, Institution and later Pro/Corporate plans can be gated without retrofitting a 3D workspace, solver, and grader.

## Must (MVP)

### PRD-01 Core learning loop is the product spine

The primary product loop is: open a task with its site/environment scenario -> build or adjust the model in the live 3D workspace -> inspect results -> run self-check -> write the justification memo -> submit -> receive per-criterion graded feedback -> resubmit if allowed. Learner dashboard, task page, workspace, and feedback view must be designed around this loop; features that do not serve it are out of MVP.

**Why:** The closed loop from simulation to graded, scenario-grounded feedback is what neither tool-only products (SkyCiv, SAP2000) nor LMS-only products (Canvas, Moodle) offer; it is the reason the product exists.

**Acceptance:**
- A learner can complete the full loop for a sample task in one session without leaving the product.
- Each loop stage emits the corresponding analytics event defined in MET-01.
- The task page shows scenario summary, constraints, rubric summary, attempts remaining and deadline above the fold on a 1366x768 viewport.

### PRD-02 Educational-use positioning and disclaimers

The product is explicitly for education and practice, not for producing engineering deliverables. Terms of use, the workspace, and every exported report, image or data file carry an 'educational use only; not for construction' notice, and AI feedback is labeled as automated and not professional engineering advice.

**Why:** Limits liability and regulatory exposure, sets expectations with institutions and practitioners, and keeps scope from drifting toward professional-tool parity.

**Acceptance:**
- Terms acceptance is recorded at signup with terms version and timestamp.
- Exported PDF, CSV, JSON and image artifacts include the notice as footer, watermark or metadata header.
- AI-generated feedback blocks carry a visible label stating 'AI-generated, pending instructor review' or 'AI-generated, confirmed by instructor'.

### PRD-03 Human-in-the-loop, explainable, contestable AI grading as a product principle

The instructor (or TA) is the grade authority. Every AI-proposed grade exposes per-criterion evidence; learners can view the evidence and open a regrade request; reviewers can override any criterion with a reason; all changes are audit-logged. In MVP, grades reach learners only after human review; auto-release of high-confidence grades is a later opt-in tenant setting.

**Why:** Institutional acceptance and fairness depend on it, and AI used to evaluate learning outcomes is classed as high-risk under the EU AI Act, where human oversight, logging and transparency are the core obligations.

**Acceptance:**
- No grade is visible to a learner before an instructor/TA release action or an explicit tenant setting enabling auto-release.
- Each criterion in the feedback view shows score, evidence (numbers and code clause references) and provenance (AI proposed / confirmed / overridden by whom).
- Learners can file a regrade request within the instructor-set window; status is visible to learner and reviewer.
- A per-course audit log of all grade changes is exportable as CSV.

### PRD-04 Zero-install, cross-platform desktop-browser access

All functionality (workspace, live analysis, submission, review) runs in current desktop browsers on macOS, Windows and ChromeOS, including managed university lab machines without admin rights and laptops with integrated GPUs. No plugins or local installs.

**Why:** Desktop teaching tools are Windows-only with install and license friction; SkyCiv's browser/Mac availability is a documented adoption reason; students increasingly use Macs and Chromebooks.

**Acceptance:**
- Supported matrix: last two major versions of Chrome, Edge, Firefox and Safari; WebGL2 required; minimum 1366x768 viewport.
- All MVP course tasks run at >= 30 fps on the reference low-end device defined in NFP-04.
- Unsupported browsers/devices show an explicit message with alternatives instead of failing silently.

### PER-01 Learner home: tasks, deadlines, progress by outcome

Learners land on a dashboard listing active courses, tasks with status (not started / in progress / submitted / under review / graded / resubmission requested), deadline countdowns, and progress by learning outcome. Resuming a task reopens the last autosaved model state.

**Why:** Undergraduate job-to-be-done: know what is due and where I stand; missed deadlines are the main driver of the task-completion metric.

**Acceptance:**
- Dashboard lists all active tasks sorted by deadline with overdue items flagged.
- Reopening a task restores the last autosave within 5 seconds.
- Outcome progress reflects a released grade within 1 minute.

### PER-02 Pre-submission self-check ('Check my design')

Before submitting, learners can run the deterministic part of the grader (model validity, stability/mechanism detection, required load cases and combinations present, constraint compliance such as allowed sections and geometry envelope, code checks) and see pass/fail per item without the judged score. Instructors can cap self-checks per task or disable code-check previews for exam-style tasks.

**Why:** Learner job-to-be-done: be confident before submitting; removes trivial failures so grading focuses on judgment and builds trust in the grader.

**Acceptance:**
- Self-check output uses the same evidence format as the final grade.
- Instructor setting offers unlimited / N per task / disabled, and the remaining count is shown to the learner.
- Self-check completes within the analysis latency budget for the task's model tier.

### PER-06 Instructor course set-up from a template in under 30 minutes

An instructor copies a ready-made course (modules, tasks, rubrics, reference solutions), shifts all dates to the new term with a wizard, imports a roster (CSV or join code) and publishes, in one sitting and without support.

**Why:** Instructor adoption is the bottleneck; SkyCiv's CSV roster upload sets the baseline and a ready-made course is the MVP's main sales asset.

**Acceptance:**
- Median set-up time <= 30 minutes measured in pilot onboarding sessions.
- Date-shift wizard moves all deadlines relative to the new term start and flags weekend/holiday collisions.
- Roster import accepts the email and name columns of Canvas and Moodle roster exports; invalid rows are reported while valid rows are processed.

### PER-07 Instructor/TA grading review queue

A review queue lists submissions with AI-proposed scores, confidence and flags, per-criterion evidence and a read-only viewer of the learner's model and results. Reviewers accept, adjust per criterion with a reason, add comments, and bulk-accept unflagged high-confidence submissions; sorting by flag severity, section and failed criterion.

**Why:** Instructor job-to-be-done: grade 80 submissions consistently without 20 TA-hours; the review step is what makes AI grading acceptable (PRD-03).

**Acceptance:**
- Median reviewer time per submission <= 3 minutes (measured per MET-03).
- The viewer highlights failing members and shows the learner's own results.
- Every adjustment records who, when, old and new score, and reason.
- Bulk accept is only offered for submissions without flags and above the tenant's confidence threshold.

### PER-08 Instructor cohort insights

Per task and per course: score distribution, most-failed criteria and outcomes, common deterministic errors (missing combination, mechanism, wrong unbraced length), time-on-task, submission timing, and an at-risk list (no activity in 7 days, overdue tasks, failing outcomes), exportable as CSV. MVP ships the per-task criterion and error breakdown; at-risk alerts and messaging follow in v1.x.

**Why:** Instructor job-to-be-done: see where the class struggles before the exam; this pedagogy layer is absent from analysis tools.

**Acceptance:**
- Insights update within 5 minutes of grade release.
- Each most-failed criterion links to the submissions that failed it.
- At-risk thresholds are configurable per course.

### PER-09 Teaching assistant role with section scoping

TAs are scoped to sections: they review and grade only their sections' submissions, open any learner's model in read-only inspect mode with the learner's results, annotate feedback, and handle regrade requests; instructors see all sections and can reassign.

**Why:** Large courses are run by TAs; cross-section consistency is a known pain and section scoping protects learner privacy.

**Acceptance:**
- TAs cannot read or edit grades outside assigned sections (enforced server-side, covered by authorization tests).
- Inspect mode cannot modify the submission; TA experiments happen on a clearly labeled clone.
- Regrade requests route to the section TA with escalation to the instructor.

### PER-10 Institution admin console

Institution admins manage members, roles, departments, courses, seat allocation, roster imports, usage and seat reports, and offboarding (deactivate, export, delete per retention policy), and set institution-wide defaults (units, code edition, grade-release policy, integrity settings). SSO and LTI configuration are added in v1.x.

**Why:** Institution admin job-to-be-done: provision a department without per-student account work, report usage for renewal, and meet FERPA obligations.

**Acceptance:**
- Bulk import of 500 users via CSV completes in one operation with a validation report.
- Seat usage report (purchased / assigned / active in last 30 days) is exportable.
- Offboarding removes access immediately, schedules data handling per policy and writes an audit entry.

### PER-12 First-run guided onboarding to first analysis

New learners get an interactive, skippable tutorial that builds a simply supported beam (nodes, member, supports, load, section), runs the analysis and reads deflection and moment, designed to finish in about 10 minutes and relaunchable from help.

**Why:** Directly drives time-to-first-analysis and activation and counters the 'software learning curve' objection.

**Acceptance:**
- >= 70% of new learners complete the tutorial with a median duration <= 10 minutes.
- Checkpoints verify model state (for example a pinned support at node A), not button clicks.
- Completion emits the onboarding_completed event.

### LOM-01 Learning-outcome taxonomy and task tagging

A platform-wide taxonomy with four levels (L1 analysis fundamentals, L2 code-based design, L3 design optimization, L4 engineering judgment) containing roughly 30 granular outcomes (see domain notes). Every task, rubric criterion and lesson is tagged with at least one outcome plus catalog metadata: structure type, materials, analysis type, code pack and edition, level, estimated time.

**Why:** Outcome tagging turns grades into competence tracking, lets instructors align with syllabi and accreditation, and powers path filtering.

**Acceptance:**
- Publishing a task without outcome tags is blocked.
- Taxonomy is versioned; renames do not break historical data.
- Catalog filtering by any metadata field returns within 1 second.

### LOM-02 Mastery tracking per outcome

Learner mastery per outcome is computed from graded rubric criteria tagged to that outcome (default rule: >= 80% on that outcome's criteria across >= 2 distinct tasks; instructor-configurable per course) and shown to learners as progress per level and to instructors as a cohort heatmap.

**Why:** Content tracking that reflects competence rather than page completion is central to the product strategy.

**Acceptance:**
- Mastery is recomputed within 1 minute of grade release or override.
- The learner view states what is still needed to reach mastery for each outcome.
- Changing the rule in one course does not recompute other courses.

### MVP-01 MVP content: one ready-to-teach course

Ship one complete course, 'Structural Analysis and Design Fundamentals (Steel)' (title per ADR 0002 A6; reinforced-concrete members appear only in Analyze modules with author-declared effective stiffness until the ACI pack ships in v1.1), co-authored with design-partner instructors: 8-12 modules and 20-30 activities including guided lessons, simulation tasks, 2-3 design-optimization tasks with benchmarks, and one capstone with a written justification memo, each with rubric, reference solution and randomized scenario parameters.

**Why:** Instructors adopt whole courses, not isolated tasks; a complete course is the only way to test the full loop and the grading agreement metric at scale.

**Acceptance:**
- Every task's rubric is calibrated on >= 10 golden submissions before the pilot starts.
- The course fits a 14-week semester or 10-week quarter via the date-shift wizard.
- Content is reviewed for code correctness by at least one licensed PE/SE.

### MVP-02 MVP structural and code scope

MVP supports linear static analysis of 2D/3D trusses, beams (simply supported, cantilever, continuous) and steel moment/braced frames up to about three stories, plus RC beam and column member checks; a US code pack with ASCE 7-22 combinations (LRFD and ASD) and simplified wind/seismic/snow inputs, AISC 360-22 member checks and ACI 318-19 beam/column checks; US customary and SI units. Out of MVP: plates/shells, modal/dynamic, nonlinear, foundations beyond a bearing check, Eurocode/NSCP packs, moving loads.

**Why:** Covers a standard first design course and the three most common teaching structure types while keeping solver, workspace and grader scope achievable for a small team.

**Acceptance:**
- Every MVP course task is solvable within the in-browser model tier defined by the FEA domain.
- Unsupported features are hidden or marked 'coming later', never half-implemented.
- Code pack editions are pinned per course (for example ACI 318-19 now, ACI 318-25 selectable later) and shown on every task.

### MVP-03 MVP grading scope and review policy

Hybrid AI grading (deterministic re-analysis, rule checks, LLM rubric evaluation of judgment and memo) with 100% instructor/TA review before release as the MVP default; resubmission per task settings; regrade requests supported; no auto-release. Instructors can set a task to deterministic-only grading for formative practice.

**Why:** Builds trust and produces the agreement data required to justify auto-release later.

**Acceptance:**
- Agreement metrics (MET-03) are computed from the first pilot submission.
- Deterministic-only mode produces feedback without any LLM call.

### MVP-04 MVP go-to-market scope

MVP serves (a) one to three pilot institutions on manually provisioned tenants with free pilot agreements or manual invoicing and CSV grade export to the institution's LMS, and (b) a free self-serve sandbox with sample tasks for individuals with a waitlist for paid self-serve; (b) is deferred to v1.1 per ADR 0002 A9 together with GTM-01 and TOS-03, so at MVP accounts are created by roster import, invite or join code only. LTI, SSO, card payments and corporate features are v1.x.

**Why:** Avoids building integrations and billing before the core loop is validated while still capturing demand signal from individuals.

**Acceptance:**
- A pilot tenant can be created and configured by the team in <= 1 hour.
- CSV grade export matches Canvas and Moodle gradebook import formats (documented and tested).
- Sandbox signup requires no payment details (v1.1, with (b)).

### MVP-05 MVP exit criteria

MVP is validated when, within one academic term: at least one pilot cohort of >= 30 learners completes >= 6 simulation tasks; activation >= 70% and median time-to-first-analysis <= 10 minutes; grading agreement >= 85% (within +/-5 of 100) with override rate < 15% over >= 200 reviewed submissions; feedback-usefulness >= 75%; the pilot instructor commits to reuse next term; zero lost-submission or lost-grade incidents.

**Why:** Makes the go/no-go for v1.x investment (LTI, SSO, payments) explicit and measurable.

**Acceptance:**
- The metrics dashboard (MET-02) shows each exit criterion with live status.
- A post-pilot review records the result for each criterion.

### MET-01 Product analytics event instrumentation

Implement a privacy-safe, versioned event taxonomy covering the loop and lifecycle (account_created, onboarding_completed, model_created, analysis_run, task_started, self_check_run, submission_created, grade_proposed, grade_reviewed, grade_released, feedback_viewed, feedback_rated, resubmission_created, appeal_opened, appeal_resolved, module_completed, course_completed, certificate_issued, seat_assigned, seat_released, lti_launch, sso_login, checkout_completed, subscription_canceled) with tenant, course, section, task, outcome, plan, role and browser dimensions, pseudonymous user IDs and no PII in payloads.

**Why:** Every success metric derives from these events, and retrofitting instrumentation into a 3D workspace and grading pipeline is expensive.

**Acceptance:**
- Event schema is documented and versioned; CI fails on undocumented event names.
- Events are queryable within 15 minutes of emission.
- Tenant-level opt-out of non-essential analytics does not disable grading audit logs.

### MET-02 Core funnel dashboard: activation, time-to-first-analysis, completion

Internal dashboard per tenant, course and cohort for activation rate (>= 1 successful analysis within 7 days of account creation), time-to-first-analysis (median and p90 from first login), task completion rate (final submissions by deadline / assigned) and course completion rate, with targets and trends.

**Why:** These are the primary product-health metrics and MVP exit criteria.

**Acceptance:**
- Metric definitions match the formulas in domain notes and are unit-tested on fixture data.
- Filters by role, plan and cohort; refreshed at least daily.

### MET-03 Grading agreement and trust metrics

Per task and rubric: AI-vs-final score agreement (share within +/-5 of 100), per-criterion agreement split into deterministic and judged criteria, override rate, appeal rate and outcome, and reviewer time per submission; alert the product team and the instructor when a task's agreement drops below threshold (default 80%).

**Why:** Grading trust is the product's make-or-break metric, needed to justify auto-release and to detect miscalibrated rubrics.

**Acceptance:**
- Metrics update on every review action and are visible per task to instructors and globally to the team.
- Alert fires within 1 hour once a task has >= 20 reviews and falls below threshold.

### MET-04 Learner satisfaction and feedback-usefulness capture

After viewing graded feedback, learners see a one-tap 'Was this feedback useful?' prompt with optional comment (MVP). End-of-course learner surveys (CSAT 1-5, NPS, open text) and term-end instructor surveys follow in v1.x. Results feed the dashboard and the rubric calibration backlog.

**Why:** Learner satisfaction is a stated success metric and per-task micro-surveys reveal which rubrics or feedback templates need work.

**Acceptance:**
- Micro-survey response rate >= 40% in the pilot; shown at most once per grade release.
- Negative ratings with comments appear in the instructor's task insights.

### GTM-01 Self-serve identity and signup

**Status:** deferred to v1.1 per ADR 0002 A9 (with MVP-04(b) and TOS-03); at MVP accounts are created by roster import, invite or join code only, and there is no public self-serve sign-up or sandbox.

Individuals sign up with verified email and password or Google OAuth, choose a role intent (student, practitioner, instructor) and land in the free sandbox. Self-serve instructors get a sandbox course with sample tasks, plan-limited learner caps and a 'request institution pilot' path. Institution users are provisioned by roster import in MVP and by SSO/LTI in v1.x.

**Why:** Individuals and curious instructors are the top of the funnel while institutional procurement is slow.

**Acceptance:**
- Signup to first workspace view takes <= 2 minutes with no payment step.
- Role intent sets the default home (learner dashboard vs. instructor sandbox course).
- Self-serve instructors can run a course up to the plan's learner cap without a contract.

### GTM-02 Enrollment mechanisms

Learners join courses via roster import, invite email, join code or link (optional email-domain restriction and expiry), or self-enrollment in public self-paced courses; LTI launch auto-enrollment is added in v1.x.

**Why:** Covers institutional and individual flows with minimal admin effort.

**Acceptance:**
- Revoked join codes are rejected.
- Enrollment consumes a seat where applicable and emits course_enrolled.

### BIL-01 Plans and entitlement model

A central entitlement service maps plans (Free, Individual Pro, Institution, Enterprise/Corporate, plus pilot and trial variants) to feature flags and quotas: saved models, model-size tier, AI-graded submissions per period, course and learner caps for self-serve instructors, certificates, LTI/SSO, admin console, private content. UI and API enforce identical entitlements; locked features remain visible with an upgrade or contact path. MVP uses it for Free and Pilot/Institution tenants, including a per-tenant learner cap.

**Why:** Even the MVP has Free and Pilot behaviors, and adding gating later across a 3D workspace, grader and LMS is costly.

**Acceptance:**
- A single entitlement check is used by API and UI; an integration test covers every gated feature.
- A plan change takes effect within 1 minute without redeploy.
- Quota exhaustion returns a message with reset date or upgrade path.

## Should (v1.x)

### PRD-05 'Show the work': hand-calculation-style transparency for results and checks

For member checks and any result used in grading, learners can open a step-by-step breakdown (inputs, governing equation, intermediate values, code clause) suitable for comparison with hand calculations. MVP delivers a tabular check summary with clause references; v1.x delivers the full formula walkthrough.

**Why:** Connecting software output to theory is the core learning value; hand-calc reports are SkyCiv's most-cited education feature and instructors distrust black-box results.

**Acceptance:**
- Every utilization value in the UI links to a breakdown that names the governing equation and clause.
- Breakdown values match the engine result within display rounding.
- Breakdowns are printable/exportable and carry the PRD-02 notice.

### PER-03 Sandbox workspace and portfolio

Any user, including free accounts, has a sandbox to create, save and reopen models outside tasks, with read-only share links. Graduate students and practitioners use it for parametric practice and portfolio work; it is also the free-tier activation surface.

**Why:** Serves graduate and practitioner jobs-to-be-done (parametric studies, portfolio) and drives activation and sharing-led acquisition.

**Acceptance:**
- Free tier allows at least 5 saved models at model-size tier 1; Pro and institution plans are unlimited within tier limits.
- Share links open a read-only viewer with results without login.
- Sandbox models can only be submitted to a task through the task flow.

### PER-04 Practitioner self-paced paths tagged to exam specifications and code chapters

Self-paced paths (for example 'Steel design refresh', 'Lateral systems', 'PE Civil: Structural practice') composed of 20-45 minute tasks, each tagged to NCEES PE Civil: Structural and PE Structural (SE) specification topics and to code chapters, with progress persisted across short sessions and devices.

**Why:** Early-career engineers study after work in short sessions and need relevance to licensure (the common PE Civil: Structural exam and the CBT SE exam with vertical/lateral breadth and depth components) and to the codes they use at work.

**Acceptance:**
- Each task displays its exam-spec and code-chapter tags; paths are filterable by tag.
- Estimated time is displayed and compared with actual median time.
- A learner can leave mid-task and resume on another device with model state intact.

### PER-05 Completion records and PDH/CEU certificates

On meeting a course's completion rule, learners receive a verifiable certificate (PDF plus verification URL) stating hours, course, date and assessment summary. The platform records the activity needed for professional development hour claims but does not guarantee state board acceptance.

**Why:** Practitioner and corporate jobs-to-be-done (license renewal evidence, training records) at low build cost and high perceived value.

**Acceptance:**
- Each certificate has a unique ID verifiable at a public URL without login.
- Hours derive from instructor-set credit hours, not raw time-on-task.
- Certificates are revoked automatically if the underlying grade is invalidated.

### LOM-03 Prerequisites and learning-path gating

Tasks and modules can require completion or mastery of earlier outcomes; locked items explain why and what unlocks them; instructors can disable gating per course. Self-paced paths use gating to enforce the L1 -> L2 -> L3 -> L4 progression.

**Why:** Prevents learners from attempting code-design tasks before demonstrating analysis competence, and makes the progression model tangible.

**Acceptance:**
- Gating is evaluated server-side; locked tasks cannot be submitted via API.
- Per-learner unlock overrides by instructors are logged.

### LOM-04 Mapping to external frameworks (ABET, NCEES)

Outcomes can be mapped many-to-many to ABET General Criterion 3 student outcomes (1)-(7) and to NCEES PE Civil: Structural and PE Structural exam specification topics. Instructors export a per-course evidence report (tasks, criteria, score distributions per mapped outcome) for accreditation self-study.

**Why:** Departments must produce ABET assessment evidence; practitioners need exam relevance; both are purchase drivers.

**Acceptance:**
- Mappings are editable by institution admins and instructors.
- Evidence report exports as CSV and PDF with course, term and sample size.

### GTM-03 LTI 1.3 and LTI Advantage integration

Implement LTI 1.3 Core (OIDC launch, platform registration), Deep Linking 2.0 (instructors place a Bridle task or module into a Canvas/Moodle assignment), Assignment and Grade Services 2.0 (passback of released grades, re-sync on override) and Names and Role Provisioning Services 2.0 (roster sync); verify against Canvas and Moodle and target 1EdTech LTI Advantage certification.

**Why:** Institution-wide sales require the institutional LMS to remain the system of record; grade passback removes CSV friction and many RFPs require LTI Advantage certification.

**Acceptance:**
- A learner launched from Canvas is auto-enrolled and lands on the linked task without a second login.
- A grade override in Bridle reaches the Canvas gradebook within 5 minutes.
- Registration guides exist for Canvas, Moodle, Blackboard and D2L Brightspace.

### GTM-04 Enterprise SSO (SAML 2.0 / OIDC)

Institution and corporate tenants configure SAML 2.0 or OIDC SSO (Okta, Microsoft Entra ID, Google Workspace, Shibboleth/InCommon) with just-in-time provisioning, domain claiming and role mapping from IdP attributes; SSO-enforced tenants disable password login.

**Why:** Universities and firms require SSO under their security policies; it is a frequent procurement blocker.

**Acceptance:**
- An admin completes SSO setup from the console using metadata URL or XML without Bridle staff.
- SP-initiated and IdP-initiated login are verified against at least two IdPs.

### GTM-05 Procurement and pilot readiness pack

Maintain a procurement pack: HECVAT Lite answers, accessibility conformance report (VPAT against WCAG 2.2 AA), DPA template, FERPA and GDPR statements, subprocessor list including the LLM provider, and a standard pilot agreement. Pilot tenants have term-limited access with automatic expiry reminders.

**Why:** Institution sales stall in security review; ready answers shorten cycles for a small team.

**Acceptance:**
- Pack is versioned and reviewed in any release that changes data flows.
- Pilot expiry reminders at 30 and 7 days; expiry converts the tenant to read-only rather than deleting data.

### GTM-06 Self-serve payments and subscriptions

Individuals purchase Individual Pro monthly or annual subscriptions or single-course access through a payment provider (Stripe or equivalent) with tax handling, receipts, upgrade/downgrade, cancellation and refunds per policy, and an optional student discount via academic email-domain or third-party verification.

**Why:** The practitioner segment is self-pay; required to monetize sandbox demand after MVP validation.

**Acceptance:**
- Entitlements update within 1 minute of the payment webhook.
- Failed payments enter dunning with the 14-day grace period defined in BIL-04.

### GTM-09 Public catalog and logged-out live demo

Public pages list courses and paths with outcomes, syllabus, time and sample tasks; a logged-out interactive demo lets visitors modify a small structure and watch results update live (no save) with a signup prompt.

**Why:** Activation starts before signup and a live demo is the most persuasive proof of in-browser live FEA for instructors and practitioners.

**Acceptance:**
- Demo is interactive within 3 seconds on broadband and works without cookies.
- Demo-to-signup conversion is tracked.

### BIL-02 Seat management and term-based licensing

Institution contracts define seat pools (per-seat or site license) with validity windows aligned to academic terms; seats are consumed on enrollment and released on unenrollment or term end; overage policy is configurable (soft: warn and allow N% overage; hard: block); seat usage reports support renewals.

**Why:** Institution admin job-to-be-done and renewal conversations depend on seat usage; term alignment matches how departments budget.

**Acceptance:**
- Admins are notified at 80% and 100% seat utilization.
- Term end converts learner access to read-only (grades and feedback remain viewable) rather than deleting data.

### BIL-03 AI-grading metering and quotas

Count grading runs and token-cost proxies per tenant and plan; enforce plan quotas with soft limits; expose counts (not currency) to institution admins; alert the team on anomalies.

**Why:** LLM grading is a variable cost; quotas protect margin and prevent abuse such as unlimited resubmissions.

**Acceptance:**
- Interaction between per-task resubmission limits and plan quotas is documented and tested.
- Quota alerts at 80% and 100% reach admins.

### BIL-04 Billing lifecycle states

Define tenant and user billing states (trial, pilot, active, past due with 14-day grace then read-only, canceled with 90-day data export window, expired term) with the UI behavior and emails for each.

**Why:** Prevents accidental lockouts mid-semester and sets clear expectations for institutions.

**Acceptance:**
- No learner loses access to graded work during an active academic term because of the institution's billing state; read-only is the worst case.

### TRU-01 Academic integrity at the product level

Per-learner randomized scenario parameters (seeded and reproducible), an honor statement at submission, similarity signals (identical or near-identical geometry and parameters across learners) surfaced to instructors, and an instructor-set collaboration policy per task (individual or allowed group).

**Why:** Instructors' top objection to take-home design assignments is answer sharing; randomization plus similarity flags is the product-level answer.

**Acceptance:**
- Similarity flags show the pair and matching elements and never auto-penalize.
- Honor statement text is configurable per institution and acceptance is stored with the submission.

## Could (later)

### PRD-06 Transfer path to professional tools

Models export in formats that let learners continue in professional software: native JSON and CSV node/member/load tables in MVP; DXF, SAP2000 .s2k text and IFC/SAF later. Positioning is complementary to SAP2000/ETABS/RISA, not a replacement.

**Why:** Defuses the instructor objection that students must learn the industry tool, and supports capstone workflows that start in Bridle.

**Acceptance:**
- Exported CSV re-imports into Bridle losslessly on the benchmark model set.
- At least one third-party format round-trip is verified on a benchmark model before the feature is marketed.

### PER-11 Corporate L&D team management

Corporate tenants create teams, assign learning paths, view competency reports (outcome mastery per engineer), track PDH completion, export CSV to HR systems, and host private org-only content.

**Why:** Corporate L&D lead job-to-be-done (onboard graduate engineers, verify competency before project work, track license renewal); a later segment once the institutional product is proven.

**Acceptance:**
- Managers cannot see private content of other teams.
- Competency report aggregates per outcome with the date of latest evidence.

### GTM-07 Learner-paid course access (access-code / inclusive-access model)

Support the textbook-platform model where the institution runs the course but learners pay per course by direct purchase or by redeeming codes sold through the campus bookstore or inclusive-access programs; instructors never handle payment.

**Why:** Standard in US higher-education homework platforms and unlocks adoption where departments lack software budget.

**Acceptance:**
- Access codes are single-use, course-scoped and expiring; redemption assigns a seat.

### GTM-08 Corporate team plan

Annual team plans with seat pools, a manager role, SSO, invoice billing and the reporting defined in PER-11.

**Why:** Later segment; listed so the entitlement and seat models accommodate it from the start.

**Acceptance:**
- Team plan is representable in the BIL-01 entitlement model without schema changes.

## Non-functional targets

| id | title | target |
|---|---|---|
| NFP-01 | Time-to-first-analysis | Median <= 10 minutes and p90 <= 30 minutes from first login to first successful analysis_run, measured on new learner accounts |
| NFP-02 | Instructor effort | Course set-up from template median <= 30 minutes; reviewer time per submission median <= 3 minutes |
| NFP-03 | Grade turnaround as experienced by learners | AI-proposed grade available to reviewers <= 2 minutes p95 after submission; instructor release SLA default 72 hours with on-time rate reported per course |
| NFP-04 | Browser and device support | Last 2 major versions of Chrome, Edge, Firefox, Safari on macOS 13+, Windows 10+, ChromeOS; WebGL2; minimum 1366x768; reference low-end device (2020 laptop with Intel Iris Xe or Apple M1, 8 GB RAM) sustains >= 30 fps on all MVP tasks |
| NFP-05 | Availability during academic terms | >= 99.5% monthly availability; no planned maintenance within 24 hours before any deadline affecting >= 25 learners; public status page |
| NFP-06 | Grading trust | AI-vs-final agreement >= 85% within +/-5 of 100; override rate < 15%; appeal rate < 5% per task after calibration |
| NFP-07 | Learner satisfaction | Feedback-useful rating >= 75%; end-of-course CSAT >= 4.2/5; NPS >= 30 |
| NFP-08 | Support responsiveness | Instructor support response <= 1 business day during term and <= 4 business hours for grade-release-blocking issues; in-app help center with task-level help |
| NFP-09 | Sales-readiness documentation | VPAT (WCAG 2.2 AA), HECVAT Lite, DPA template and subprocessor list published before the first paid institutional contract |

## Domain notes (for architecture and UX)

## 1. Personas and jobs-to-be-done (JTBD)
1. Undergraduate civil student (years 2-4; Structural Analysis I/II, Steel Design, RC Design, capstone). JTBD: see what my hand calcs mean on a real structure; know I am right before I submit; get feedback in minutes not weeks; use it on my Mac/Chromebook/lab PC without installs. Pains: Windows-only desktop tools, black-box results, late feedback, fear of software learning curve. Surfaces: learner home, task page, workspace, self-check, feedback view, onboarding.
2. Graduate student (MS/PhD structural; often also a TA). JTBD: practice realistic multi-story/bridge design under code loads; run parametric studies; build a portfolio. Surfaces: sandbox, share links, optimization tasks, export.
3. Early-career practicing engineer (EIT, 0-5 years; PE Civil: Structural or SE candidate; upskilling into lateral/seismic, a new material, or a new code edition). JTBD: practice realistic design problems graded like a senior reviewer would; fill gaps from school; study in 20-45 minute sessions; collect PDH evidence. Surfaces: self-paced paths, exam-spec tags, certificates, self-serve signup and subscription.
4. Instructor/professor. JTBD: assign realistic design problems that cannot be copied from answer sites; grade 80+ submissions consistently without 20 TA-hours; see where the class struggles before the exam; produce ABET evidence; fit the Canvas/Moodle gradebook; reuse the course next term. Pains: slow inconsistent grading of open-ended design, licensing/install friction, academic integrity. Surfaces: course template set-up, review queue, insights, authoring (other domain), LTI.
5. Teaching assistant. JTBD: review AI-proposed grades quickly and override where needed; open the student's exact model in office hours; handle regrade requests; stay consistent across sections. Surfaces: section-scoped queue, inspect mode.
6. Institution admin (department IT / LMS admin). JTBD: provision a department with SSO and roster import rather than per-student accounts; LTI into the campus LMS; FERPA/GDPR compliance; seat usage for renewal; offboard graduates. Surfaces: admin console, SSO/LTI config, reports, procurement pack.
7. Corporate L&D lead (engineering firm). JTBD: onboard graduate engineers on a standard design curriculum; verify competency before project assignment; track PDH for license renewal; host firm-specific content; SSO with Okta/Entra; report by office/team. Surfaces: team plan, manager reports, private content.

## 2. Learning-outcomes map (taxonomy for LOM-01)
L1 Analysis fundamentals: L1.1 idealize structure (supports, releases, loads, units); L1.2 equilibrium, reactions, determinacy and stability (recognize mechanisms); L1.3 axial/shear/moment diagrams and sign conventions; L1.4 trusses (joints/sections, zero-force members); L1.5 deflections, deformed shape, stiffness intuition (EI, L, boundary conditions); L1.6 indeterminate structures and load redistribution (stiffness-method concepts); L1.7 verify software output against hand calculations and limiting cases; L1.8 effect of modeling choices (releases, rigid offsets, spring supports).
L2 Code-based design: L2.1 dead/live/snow/wind/seismic loads from occupancy and site (ASCE 7-22); L2.2 LRFD/ASD combinations and governing-combination identification; L2.3 steel tension/compression members (slenderness, buckling); L2.4 steel flexure (compactness, LTB, unbraced length); L2.5 steel beam-columns and stability (K factors or direct analysis, P-delta); L2.6 RC beams (flexure, shear, minimum reinforcement, spacing); L2.7 RC columns (P-M interaction, slenderness); L2.8 serviceability (L/360, L/240, H/400 drift, vibration awareness); L2.9 connection feasibility and load-path continuity.
L3 Design optimization: L3.1 utilization targeting (about 0.80-0.95) within serviceability; L3.2 weight/cost minimization against a benchmark and Pareto thinking; L3.3 section rationalization and repetition; L3.4 parametric studies and sensitivity (span, depth, bracing layout); L3.5 system selection trade-offs (moment vs braced frame, truss depth); L3.6 redundancy and robustness.
L4 Engineering judgment: L4.1 translate site/environment scenario (exposure, SDC, snow, soil) into decisions; L4.2 sanity-check results and detect modeling errors; L4.3 justify assumptions in a written memo for a reviewer; L4.4 risk, safety and ethics (code is a minimum); L4.5 communicate trade-offs with evidence (numbers, clauses, alternatives considered); L4.6 constructability and sequencing awareness.
ABET General Criterion 3 (2025-26) student outcomes mapping: SO1 (identify/formulate/solve complex problems) <- L1, L2; SO2 (design with health, safety, welfare, economic and environmental factors) <- L2, L3, L4.1, L4.4; SO3 (communicate) <- L4.3, L4.5 memo; SO4 (ethics/professional responsibility, informed judgment) <- L4.4; SO5 (teams) <- group projects (later); SO6 (experimentation, analyze data, judgment) <- L1.7, L3.4, L4.2; SO7 (acquire new knowledge) <- self-paced paths. Civil program criteria additionally expect engineering mechanics, numerical methods, design in at least two civil contexts and complex problems in four specialty areas; a structural course using Bridle contributes evidence for the structural area.
NCEES mapping: PE Civil: Structural (single CBT exam, 80 questions) topics such as loads and load applications, forces and load effects, materials, component design and detailing, codes and standards. PE Structural (SE) exam: computer-based since April 2024 with four components (Vertical Breadth, Vertical Depth, Lateral Breadth, Lateral Depth); breadth offered year-round, depth twice a year; closed-book with electronic references; revised specifications effective April 2027. Tag L2/L3 tasks as vertical (gravity) or lateral (wind/seismic).

## 3. Competitive and adjacent landscape
- SkyCiv Education (closest): browser-based professional analysis/design suite with student and education accounts; institutional licensing is quote-based; instructors upload a CSV roster; students get Structural 3D, Beam, Section Builder, Beam Shell FEA and mobile app; hand-calculation reports and tutorials; 30-day education trial; vendor claims 2,000+ schools with Stanford (since 2019) and Monash (500 students) case studies. Observed gaps (verify before making claims): no scenario-driven assignments with rubrics, no AI grading or instructor review workflow, no outcome mastery tracking, no evident LTI grade passback. Threat: could add assignments. Response: pedagogy depth, grading quality, integrity features, LMS integration; treat hand-calc transparency (PRD-05) as table stakes.
- Desktop professional tools used in teaching: CSI SAP2000/ETABS (academic licenses typically free via university consortia/IT, Windows, institutional-use only), RISA, Bentley STAAD, Autodesk Robot, Dlubal RFEM student, IDEA StatiCa Campus, Tekla Campus. Gaps: no pedagogy or grading, install and license friction, steep learning curve. Position Bridle as complementary with an export path (PRD-06).
- Free teaching tools: Ftool (2D frames), MASTAN2 (matrix analysis incl. nonlinear), Frame3DD, West Point Bridge Designer / Bridge Designer (cost-optimized truss bridge with load test, the closest precedent to scored design optimization). Gaps: no LMS, no 3D code design, no grading.
- Generic LMSs (Canvas, Moodle, Blackboard, D2L Brightspace): institutional systems of record; integrate via LTI 1.3 Advantage, never compete.
- Auto-graded homework/assessment platforms: Pearson Mastering Engineering, McGraw Hill Connect, WileyPLUS, PrairieLearn (open source, parameterized problems), Gradescope (AI-assisted grading of handwritten work), Mobius/WebAssign. They grade numeric answers to textbook problems, not open-ended designs with code checks and judgment memos.
- MOOCs and webinars (Coursera, edX, Udemy, YouTube, ASCE/AISC PDH webinars): passive, no design feedback.
- Exam prep (PPI/Kaplan, School of PE, EET, AEI): practice problems without simulation; potential partner for the practitioner persona.
Differentiators: (1) assignment = scenario + live 3D FEA + rubric; (2) AI grading on real-world criteria with instructor in the loop; (3) per-learner randomization and similarity signals; (4) outcome mastery mapped to ABET/NCEES; (5) zero-install cross-platform; (6) instructor time savings; (7) minutes-not-weeks feedback latency. Defensibility comes from calibrated course content and rubrics, the grading-agreement dataset, and LMS integrations.

## 4. MVP definition and growth sequencing
In MVP: one course (MVP-01); trusses, beams, steel frames up to ~3 stories, RC members in Analyze tasks only (ADR 0002 A6); linear static; US code pack (ASCE 7-22 combinations with simplified wind/seismic/snow inputs, AISC 360-22, ACI 318-19) with edition pinned per course; US customary and SI; guided lessons, simulation tasks, 2-3 optimization tasks with benchmarks, capstone with memo; hybrid AI grading with 100% human review; learner home, self-check, review queue, basic insights, TA role, admin console, CSV roster import and CSV grade export in generic, Canvas and Moodle layouts (ADR 0002 A8); free sandbox (v1.1 per ADR 0002 A9); event instrumentation and dashboards; entitlement service with Free and Pilot/Institution plans.
Out of MVP: plates/shells, modal/dynamic/nonlinear, Eurocode/NSCP packs, moving loads, LTI, SSO, card payments, certificates, corporate teams, marketplace, mobile/tablet, leaderboards, group projects.
v1.x (after MVP-05 exit criteria): LTI 1.3 Core + Deep Linking + AGS + NRPS; SAML/OIDC SSO; Stripe self-serve with Individual Pro; PDH certificates; practitioner paths with exam-spec tags; procurement pack; mastery gating; at-risk alerts; full hand-calc walkthrough; seat pools and billing lifecycle; AI-grading quotas.
v2: corporate team plans and private content; Eurocode and NSCP 2015 packs; modal and P-delta; plates; access-code/inclusive-access model; content marketplace; EU AI Act conformance work for EU sales; group projects (ABET SO5).
Academic-calendar constraint: a fall pilot must be production-ready by early August for a late-August start; a spring pilot by early December. Pilot instructors need the course at least 6 weeks before term start.

## 5. Success metrics: definitions and targets
- Activation rate = users with >= 1 successful analysis_run within 7 days of account_created / accounts created in period. Target >= 70% (institutional cohorts), >= 40% (self-serve sandbox).
- Time-to-first-analysis = timestamp(first successful analysis_run) - timestamp(first login). Median <= 10 min, p90 <= 30 min.
- Task completion rate = final submissions on or before deadline / tasks assigned to active learners. Target >= 85%. Course completion = learners meeting the course completion rule / enrolled active learners; >= 75% institutional, >= 40% self-paced.
- Grading agreement = share of reviewed submissions with |AI proposed score - final score| <= 5 (of 100); target >= 85%. Per-criterion agreement reported separately for deterministic criteria (expected ~100%) and judged criteria (Cohen's kappa >= 0.7). Override rate = overridden / reviewed (< 15%). Appeal rate = appeals / released (< 5%).
- Feedback usefulness = positive responses / responses (>= 75%); CSAT end-of-course mean >= 4.2/5; NPS >= 30.
- Instructor time saved: reviewer time per submission (grade_reviewed - review_opened), median <= 3 min, versus a self-reported baseline of 15-20 min per design submission.
- Seat utilization = seats with activity in last 30 days / seats purchased (>= 80% target at renewal).
- Reliability metrics owned by the platform domain but shown on the same dashboard: analysis success rate >= 99.5%, grading turnaround p95 <= 2 min.

## 6. Plans and entitlement matrix (creates requirements only; no price points)
- Free (individual): sandbox, model-size tier 1, 5 saved models, sample tasks with deterministic checks only, no certificates, community support.
- Individual Pro (monthly/annual): full course library and paths, AI grading with a per-month graded-submission quota, unlimited saved models within tier 2, certificates, share links.
- Institution (per-seat per term or site license; pilot variant free and term-limited): everything in Pro for learners plus instructor tools, templates, review queue, gradebook and CSV export, admin console, roster import, LTI/SSO (v1.x), seat pools, priority support.
- Enterprise/Corporate (annual): Institution plus teams, manager reports, private content, SSO, invoice billing, SLA.
Reference points for pricing research (not requirements): US homework platforms commonly charge students per course per term; SkyCiv education is quote-based; CSI academic licenses are often free to students via consortia, so the willingness-to-pay driver is grading and course content, not the analysis engine.

## 7. GTM facts that create requirements
- LTI Advantage = LTI 1.3 Core + Assignment and Grade Services 2.0 + Names and Role Provisioning Services 2.0 + Deep Linking 2.0; 'LTI Advantage Complete' certification requires Core plus all three services. Canvas and Moodle are the first targets; Blackboard and D2L next.
- SSO: SAML 2.0 and OIDC cover Okta, Entra ID, Google Workspace and InCommon/Shibboleth federations used by US universities.
- Institutional security review typically requires HECVAT (Lite acceptable for small vendors), VPAT, DPA, FERPA statement and subprocessor list (must name the LLM provider and data handling for learner text).
- PDH acceptance varies by state board; the product issues records and certificates but must not claim approval unless registered as a provider in states that require it.
- Student-pays (access code / inclusive access) and institution-pays models coexist in US higher education; the entitlement model must support both.
- Instructor self-serve accounts with plan-limited learner caps are the low-friction wedge into departments.

## 8. Analytics event taxonomy (MET-01)
Events: account_created, email_verified, onboarding_started, onboarding_completed, course_enrolled, model_created, analysis_run (model_tier, duration_ms, success), task_opened, task_started, self_check_run (pass_count, fail_count), submission_created (attempt_no), grade_proposed (confidence, flags), review_opened, grade_reviewed (action: accept|override, delta), grade_released, feedback_viewed, feedback_rated (useful: bool), resubmission_created, appeal_opened, appeal_resolved (outcome), module_completed, course_completed, certificate_issued, seat_assigned, seat_released, lti_launch, sso_login, demo_interacted, checkout_started, checkout_completed, subscription_canceled, quota_exhausted. Dimensions: tenant_id, course_id, section_id, task_id, outcome_tags, plan, role, persona_intent, browser/os, model_tier. User IDs pseudonymous; no free-text or PII in payloads.

## 9. Verified reference facts and caveats
- Code editions: ASCE 7-22 and AISC 360-22 are current; ACI 318-19 remains the IBC-referenced edition while ACI 318-25 was published in 2025 (electronic early 2025, print mid-2025) and is expected in the 2027 IBC; hence per-course edition pinning (MVP-02).
- NCEES PE Structural exam: CBT since April 2024 with vertical/lateral breadth and depth components; breadth year-round, depth twice yearly; closed-book with electronic references; new specs effective April 2027. PE Civil: Structural is a separate single CBT exam. Exact question counts and durations should be re-verified on ncees.org before publishing exam-aligned content.
- ABET 2025-26 General Criterion 3 lists student outcomes (1)-(7); civil program criteria text should be quoted from abet.org when building the evidence report.
- SkyCiv education claims (2,000+ schools, case studies, CSV roster upload, hand calcs, 30-day trial) are vendor statements; pricing is quote-based.
- Suggested planning artifacts for later phases (none exist yet, repo is empty): docs/product/personas.md, docs/product/learning-outcomes.md, docs/product/mvp-scope.md, docs/product/metrics.md, docs/product/entitlements.md.

## Risks

| risk | mitigation |
|---|---|
| AI grades disagree with instructors in the first cohort, eroding trust before calibration data exists. | 100% human review in MVP, golden-submission calibration per task before pilot, agreement metrics from day one with per-task alerts, deterministic-only mode as fallback, conservative confidence thresholds for bulk accept. |
| Instructors will not redesign a course around a new tool (adoption friction). | Ship a complete ready-to-teach course, 30-minute template set-up, CSV roster import and gradebook export in MVP, LTI in v1.x, and recruit design-partner instructors who co-author the content. |
| Instructors and engineers distrust the solver's correctness compared with SAP2000/ETABS. | Published verification suite against closed-form and benchmark problems (FEA domain), hand-calculation transparency (PRD-05), licensed PE/SE review of course content, export path to professional tools. |
| Scope creep toward professional-tool feature parity (plates, dynamics, connections) starves the learning loop. | MVP-02 scope list with explicit exclusions, PRD-01 rule that features must serve the loop or a persona JTBD, MVP-05 exit criteria gating v1.x investment. |
| Missing the academic calendar window pushes the pilot by a full term. | Plan backwards from term start with a 6-week content-ready buffer; keep a self-serve sandbox cohort as a fallback validation channel. |
| Learners misuse educational outputs for real projects, creating liability. | Educational-use terms and watermarks (PRD-02), no stamped/professional report formats, AI feedback labeled as non-professional advice. |
| Regulatory exposure for AI-based assessment (EU AI Act high-risk category) and student-data law (FERPA/GDPR). | Human oversight, explainability and audit logging as product principles (PRD-03), procurement pack with DPA and subprocessor disclosure (GTM-05), defer EU sales until conformance work is scoped. |
| Variable LLM grading cost explodes with unlimited resubmissions or abuse. | Per-task resubmission limits, plan quotas and metering (BIL-03), deterministic self-check that does not call the LLM (PER-02). |
| A small team cannot deliver 3D workspace, solver, grader and LMS simultaneously. | Strict MVP cut (linear static, three structure families, one course), reuse of mature libraries where the architecture phase allows, and sequencing integrations and billing after validation. |

## Open questions

- Launch geography and first paying market: US universities (US code pack, US customary units, USD) or Philippines/NSCP 2015 (the structural domain brief names NSCP); this decides code-pack order, default units, currency and the pricing model.
- Who are the design-partner instructors and institution for the MVP course, and which term is the target start (fixes content scope and the production-ready date)?
- Grade of record: will the pilot instructor accept CSV export to Canvas/Moodle for one term, or is LTI grade passback a precondition even for the pilot?
- MVP review policy: 100% instructor/TA review of AI grades versus review of flagged submissions only; this changes instructor-workload claims and the agreement-metric baseline.
- Institutional monetization: institution-pays per seat/site license versus learner-pays access codes (inclusive access); this determines whether self-serve payments must ship before or after LTI.
- Content ownership and revenue share with authoring professors, and whether a future marketplace is intended.
- Primary self-serve persona for v1.x: practitioner exam prep or student course supplement (shapes catalog, paths and the Individual Pro quota design).
- Will Bridle register as a continuing-education provider in states that require it, or only issue completion records?
- Are group/team projects (ABET SO5) needed in the first year?
- Is EU/UK sales within 18 months in scope (triggers EU AI Act high-risk obligations for AI-based assessment and GDPR data residency requirements)?
