# Internal operator console, support workflows, incident runbooks, and help/documentation (gap-fill #4)

_Source: requirements discovery workflow `wf_6281c128-0bb` (gap-fill agent), 2026-11-03. 25 requirements: 24 must (MVP), 1 should (v1.x), 0 could (later)._

## Summary

The MVP runs 1-3 manually provisioned pilot tenants plus a free sandbox with 100% instructor review of summative grades and an exit criterion of zero lost submissions or grades, so the operator console and support surfaces are not optional tooling but the mechanism by which that exit criterion is observed and enforced. The key decisions implied are: (1) the console is a platform-admin-only, MFA-gated area of the main application whose every write carries a reason and lands in the audit/disclosure event class, and whose reads of education records are FERPA disclosure-log entries; (2) "zero lost" is proven by a 15-minute reconciliation invariant between submission versions, grading jobs, grade versions and a dead-letter queue, surfaced on one counter; (3) artifact rollout (engine, checks library, code pack, clause library, grader components) goes through a registry with per-type gates and two-person promotion, and per-task "pin overrides" are implemented as pins-only task versions so published versions stay immutable, with grade quarantine for anything produced under a revoked artifact; (4) LLM risk is handled by per-tenant budget overrides plus a global kill switch that degrades grading to deterministic-only with judged criteria pending and automatic backfill, never failed jobs; (5) support access is split into a read-only "view as learner" mode and a consent-token, reason-logged, time-boxed impersonation mode that notifies the learner and is visible to the institution admin; (6) five rehearsed runbooks (deadline backlog, LLM outage, engine regression, lost autosave/submission, tenant data-access error) each ship with console controls and learner/instructor comms templates, and a deadline-window calendar derived from due dates drives change freezes and escalation; (7) help is single-sourced from the monorepo so every workspace tool, check id and clause id has a contextual page, and a consented diagnostic bundle (canonical model, op-log tail, GPU capability data, session id) turns "it broke" into a replayable case.

## Must (MVP)

### GAP4-OPS-01 Operator console with privileged access, global search and action audit

An internal operator console, served as a platform-admin-only area of the main application rather than a separate product, gives the team one place to find any tenant, user (by email or opaque id), offering, task version, submission, grading job, session id or trace id and to act on it. Access requires the platform-admin role with a completed MFA challenge (conflict-12 resolution), every write action requires a free-text reason and is written to the audit/disclosure event class with actor, target, before/after and optional ticket reference. Any console read of a submission, grade or feedback record is itself a FERPA disclosure-log entry (DAT-01).

**Why:** Manual provisioning and 100% human review mean operators will touch production data daily; without one audited surface they reach for database shells, which is untraceable and incompatible with FERPA disclosure logging.

**Acceptance:**
- Console routes return 403 for every non-platform-admin role, including institution admins and instructors, in the two-tenant authorization suite (SEC-03).
- A platform-admin session without an MFA challenge in the last 12 hours cannot open the console.
- Global search returns a user, tenant, submission, grading job or trace by exact id or email in under 2 s and shows tenant and role context on every result.
- 100% of console write actions reject an empty reason and emit an append-only audit event with actor, target ids, before/after payload and optional ticket id; the audit log is exportable per tenant.
- Any console read of a submission, grade or feedback record emits a disclosure-log entry that the tenant's institution admin can list.

### GAP4-OPS-02 Tenant provisioning, plan/entitlement assignment and lifecycle states

Operators create a tenant in one guided flow: name, slug, region (field reserved, fixed to US at MVP), timezone, default unit system and code-pack edition, tenant type (pilot institution, institution, free sandbox), plan and entitlements through the BIL-01 entitlement service (seat cap, model-size tier, AI-graded submissions per period, feature set), monthly LLM budget (OBS-03), pilot start/end dates, DPA and pilot-agreement flags with named contacts, then invite the first institution admin. Lifecycle states (trial, pilot, active, read-only, archived per BIL-04) are changed from the same screen with reason and effective date; pilot expiry converts the tenant to read-only and never deletes data (GTM-05). The free sandbox is a platform-owned tenant whose plan forces deterministic-only grading or an explicit hard LLM cap, per the critic's MVP-04 resolution. Self-service provisioning and SCIM are v1.x.

**Why:** MVP-04 commits the team to provisioning a pilot tenant in under 1 hour; a checklist flow prevents half-configured tenants (no DPA, no budget, no timezone) from reaching learners.

**Acceptance:**
- A new pilot tenant with its first admin invited is provisioned end-to-end in <= 30 min by an operator following the flow, measured in a timed rehearsal before the first pilot.
- Provisioning is hard-blocked until plan, LLM budget, timezone, default code pack and at least one institution-admin contact are set; unset DPA or pilot-agreement flags show a persistent warning on the tenant header.
- Plan or entitlement changes take effect for API and UI within 1 min without redeploy and are audited with reason and effective date.
- In read-only state learners can still view grades and feedback and instructors can export the gradebook, while submissions, enrollment and authoring writes return a clear read-only error.
- The sandbox tenant cannot be assigned a plan with LLM-judged grading enabled unless a per-period hard cap is set.

### GAP4-OPS-03 Analysis and grading job inspector with retry, re-run and cancel

The console lists every analysis and grading job with filters on tenant, offering, task version, submission id, PIPE-01 state and stage (queued, analyzing, checking, judging, aggregating, review, released, failed), lane and priority, age, worker and pinned artifact versions (engine, checks library, code pack, clause library, composite grader_version). A job detail view shows the stage timeline with durations, each stage's persisted output (evidence records, validator outcome), every LLM call record (prompt hash, model id, usage, stop reason, retries), errors with OBS-01 trace links and the SUB-01 submission receipt. Operators can retry a failed stage, re-run from a chosen stage with the same or an updated pin set, cancel, requeue in another lane or priority, and apply these in bulk to a filter; all actions are idempotent so no duplicate grade record is ever created (GRD-02).

**Why:** The zero-lost-grades exit criterion cannot be verified or repaired without seeing and manipulating individual jobs, and PIPE-01 stage isolation only pays off if operators can resume at the failed stage.

**Acceptance:**
- Any job is findable by submission id, learner opaque id or trace id in under 2 s, and its console state reflects the queue within 5 s of a transition.
- Retrying or re-running a job for a submission that already has a grade creates a new grade version (VER-03 semantics) and never a second grade for the same version; an integration test re-runs the same job 3 times and asserts one grade version per run and none duplicated.
- Cancel moves a queued or running job to a cancelled terminal state within 30 s and frees its worker slot.
- Bulk re-run on a filter of up to 1,000 jobs is accepted as one audited action, enqueued in the batch lane and shows done/failed/remaining progress.
- Every action records actor, reason, prior state and new state in the job's audit timeline, included in the REV-04 audit export.

### GAP4-OPS-04 Dead-letter queue, stuck-job alerts and submission-to-grade reconciliation

Jobs that exhaust retries or exceed a stage wall-clock budget move to a dead-letter queue with a classified reason (solver error, model validation error, LLM error, infrastructure, unknown) and the full payload needed to replay them. Alerts fire for any job with no stage transition beyond its budget, for a dead-letter entry older than 15 min, and for oldest-queued-job age per lane above threshold. A reconciliation job runs every 15 min asserting the invariant that every submission version has exactly one active or terminal grading job and every terminal job has either a stored grade version, a dead-letter entry or an audited cancellation; violations page on-call, auto-recreate missing jobs, and feed a lost-work counter that the MVP-05 exit review reads.

**Why:** A lost submission is most likely a job that silently never ran or died between stages; an explicit invariant check is the only way to prove zero lost rather than hope for it.

**Acceptance:**
- A job whose stage exceeds its budget (deterministic stage 60 s per PERF-05, judge stage 5 min, each with a 3x hard ceiling) is marked stuck and alerts within 10 min with job id, tenant, task and stage.
- Dead-letter entries can be replayed individually or in bulk from the inspector and are removed only on success or an audited discard with reason.
- Reconciliation reports zero violations in steady state; deleting a job row for a submission in staging is detected within one cycle (<= 15 min) and the job is auto-recreated with the original submit timestamp.
- The lost-work counter shows every incident with ticket link and root-cause category and is displayed on the MET-02 exit-criteria dashboard.
- Stuck-job and dead-letter alerts route per OBS-02 (MTTA <= 15 min business hours, <= 60 min otherwise) and escalate one severity level inside a deadline window (GAP4-OPS-11).

### GAP4-OPS-05 Artifact registry and staged rollout for engine, code pack, checks library, clause library and grader components

A registry lists every version of each pinned artifact type (engine build, checks library, code pack, clause library, scenario engine, section/material libraries, prompt template, judge schema, routing policy, validator; canonical list owned by the DM- gap) with content hash, semver, changelog, verification or benchmark report (SIM-VNV-01, EVAL-01), SME sign-off record (LEG- gap) and lifecycle state: candidate, verified, default, deprecated, revoked. Promotion to default-for-new-task-versions requires the type's gates to pass and a second platform admin's approval, and rollout is staged through staging, the sandbox tenant, opted-in pilot tenants, then default. Published task versions never change pins automatically (VP-02, SIM-DET-03), artifacts are never deleted, and deprecated artifacts remain runnable for at least 3 years.

**Why:** Reproducible grades are the product's trust basis; the registry makes 'which artifact graded this' answerable in one click and makes an unreviewed artifact unable to become the default.

**Acceptance:**
- Every artifact version resolves to its content hash and verification report, and a task version's full pin set opens from any grade in the console.
- Promotion to default is refused when the type's gate is missing or failing: engine requires identical resultHash across wasm and native on the benchmark suite; grader components require the EVAL-01 harness within tolerance; code pack and clause library require a recorded SME sign-off.
- Promotion and revocation require two distinct platform admins (proposer and approver) and are audited with the changelog link.
- Revoking an artifact lists every task version and grade pinned to it within 10 s and offers GAP4-OPS-06 bulk re-pin.
- The task builder shows the current default per artifact type and the changelog since the author's previously pinned version when a new task version is created.

### GAP4-OPS-06 Per-task pin overrides, bulk re-pin, rollback and grade quarantine

Operators, and instructors with a warning (SIM-DET-03), override a published task version's pins by issuing a pins-only task version so the published version stays immutable (VP-02); the console lists affected offerings, in-flight attempts and existing grades and requires the VP-03 in-flight choice (new attempts only, regrade all with learner notification, or schedule after the due date). Rollback is a one-click re-pin to the previous pin set, and bulk re-pin applies the same change to every task version pinned to a given artifact. Grades produced under a revoked artifact enter a quarantined 'under verification' state that withholds release, or marks an already-released grade as under review, until a regrade under the replacement artifact has been instructor-reviewed and released.

**Why:** An engine or check defect discovered after release must be fixable without hand-editing rows, and learners must never see a grade the team knows may be wrong.

**Acceptance:**
- A pin override produces a new task version whose diff shows only pin fields; the previous version remains referenced by its existing submissions and grades.
- Rollback restores the exact previous pin set and takes effect for new jobs within 1 min.
- Bulk re-pin across all task versions pinned to artifact X runs as one audited action with a per-task result list and enqueues regrades in the batch lane (1,000-submission regrade <= 2 h per NFR-GRADE).
- Quarantined grades are unreleased to learners (or shown as 'under review' if already released), appear as a filter in the REV-01 review queue, and leave quarantine only when the instructor releases the regraded version.
- Learners whose released grade was quarantined receive the GAP4-OPS-14 notification and the event is recorded in the LEG- errata log.

### GAP4-OPS-07 LLM budget overrides, per-route disable and global kill switch to deterministic-only grading

The console shows LLM spend per tenant (month-to-date, projection, cost per grade, cache read share) against the OBS-03 budget and lets operators set a budget override (amount, expiry, reason), pause a tenant's judged stages, disable a model route (LLM-05) or flip a global kill switch. Under any of these, grading continues deterministic-only: deterministic criteria are produced and released per policy, judged criteria are marked pending (PIPE-01), no job fails, and pending judged stages queue for automatic backfill in the batch lane when the control is cleared. Instructors see a banner in the review queue with the reason and can grade judged criteria manually through the no-AI path (PRIV-05).

**Why:** LLM spend and provider availability are the two variable risks the critic flagged; the kill switch turns both into a degradation instead of an outage and per-tenant overrides keep one tenant's deadline from draining the global cap.

**Acceptance:**
- A global kill switch stops new LLM calls within 60 s; in-flight calls complete or time out within 120 s; zero jobs enter failed state (integration test with a mocked provider).
- A 100% budget breach (OBS-03) behaves identically to a tenant pause; overrides require amount, expiry (<= 90 days) and reason and are audited.
- While degraded, the learner feedback view labels judged criteria 'AI feedback pending', deterministic results follow the task's release policy, and nothing is scored 0 (LLM-06).
- Clearing the control backfills pending judged stages oldest-first at a configurable concurrency; the console shows backlog count and age and alerts when any pending judged criterion exceeds 24 h.
- Per-route disable removes only that model id from routing and bumps grader_version per LLM-05; the console warns which tasks will produce a new grader_version.

### GAP4-OPS-08 Read-only 'view as learner' and consent-and-reason-logged impersonation

'View as learner' renders a learner's dashboard, task page, workspace (their model and results) and feedback read-only with a persistent banner, no writes, and no MET-01 analytics or progress events attributed to the learner; it is available to platform admins and, within their tenant, institution admins. Impersonation (acting as the learner, including a writable workspace or submitting on their behalf) requires an active consent token the learner generates from account settings or the ticket email, institution-admin approval as break-glass, a reason and a time box (default 60 min, max 4 h), and a server-side denylist blocks password or email changes, grade release and deletions. Every action is attributed 'operator X as learner Y', the learner receives a summary email within 15 min of session end, institution admins can list all sessions in their tenant, and each session is a FERPA disclosure-log entry (DAT-01).

**Why:** Support for lost autosaves and stuck submissions needs to see exactly what the learner sees; FERPA and institutional trust require that access to be consented, bounded and visible.

**Acceptance:**
- In view-as mode every mutating API returns 403 and zero MET-01 events are attributed to the learner (e2e test).
- Impersonation without a valid unexpired consent token or recorded break-glass approval is refused; tokens are single-session and expire with the time box.
- Denylisted actions are blocked server-side during impersonation and attempts are audited.
- The learner summary email and the institution admin's session list show start/end, operator, reason and the actions taken.
- Submissions created during impersonation carry an 'assisted by operator' marker visible in the REV-01 review queue.

### GAP4-OPS-09 Data-subject request execution with export, erasure and grade pseudonymization

A DSR workflow handles access/export, rectification and erasure requests from self-service intake (DAT-02, PRIV-02) or tickets: identity verification, controller routing (institutional tenants forward the request to the institution admin as FERPA record holder and GDPR controller for approval; self-serve individuals are handled directly), legal-hold check (DAT-03), dry-run with per-store counts, execution and a completion certificate. Export produces the PRIV-02 JSON plus PDF bundle covering profile, enrollments, submissions with model JSON and memos, grades, feedback, appeals, audit timeline and diagnostic bundles. Erasure runs a per-store checklist (primary database, object storage, LLM prompt/response logs, search and analytics stores, support tickets and diagnostic bundles, email provider) and pseudonymizes grade and evidence rows the institution must retain by replacing identifiers with a freshly generated random pseudonym with no stored mapping; backups age out within 90 days. Statutory clocks (GDPR one month, FERPA access within 45 days) are tracked with alerts.

**Why:** Erasure that deletes grades breaks the institution's record obligations, and erasure that misses LLM logs or support bundles breaks GDPR; a checklist-driven job with a dry-run is how a small team executes this correctly under a statutory clock.

**Acceptance:**
- An export bundle is produced within 72 h of approval, validates against a published schema and includes every listed data class; a missing class fails the job.
- Erasure dry-run lists counts per store; execution reports per-store completion, fails loudly on any unreachable store, and the completion certificate lists stores, counts and timestamps.
- After erasure the learner's grade and evidence rows remain queryable under the pseudonym with no direct identifiers (automated test), and no table or object store contains the user's email, name or opaque id outside hashed audit references.
- Requests under legal hold are blocked with the hold id shown; institutional requests display approver, approval time and clock remaining.
- The request list shows SLA status with alerts at 50% and 80% of the statutory clock, and every step is audited.

### GAP4-OPS-10 Per-tenant feature flags and operational kill switches

A flag registry distinguishes release flags (ship dark, enable per tenant), operational kill switches (disable LLM judging, the server analysis lane, share links, discussions or self-serve signup) and plan entitlements (BIL-01), with scopes global, tenant, offering and user and the precedence global kill switch > tenant override > plan entitlement > default. One SDK evaluates flags in API and UI with server-authoritative evaluation for anything security- or grading-relevant, and each flag has an owner, description, expiry and audit trail. Grading-affecting behavior is never controlled by a flag mid-attempt (it belongs to the pinned task version) and flags cannot alter what an exam-mode attempt sees (INTEG- gap).

**Why:** Pilot tenants need opt-in to new capabilities and the team needs fast blast-radius control, while the critic correctly trimmed 'flags for every feature'; a small disciplined registry gives both.

**Acceptance:**
- Flag changes propagate to API and UI within 60 s without redeploy and are audited with actor, reason and scope.
- A CI check fails if code references a flag missing from the registry or a registry flag lacks owner or expiry; expired flags appear on a cleanup list.
- An integration test shows a grading-affecting setting cannot be toggled by a flag for an in-flight attempt; the attempt's behavior is determined solely by its pinned task version.
- Institution admins can view read-only which release flags are enabled for their tenant.
- Every kill switch has a learner- and instructor-facing message that renders in place of the disabled feature.

### GAP4-OPS-11 Incident management: severities, on-call, status communication, deadline windows and change freeze

Incidents are classified Sev1-Sev4 (definitions in domain_notes) with an on-call rotation meeting OBS-02 MTTA; every Sev1 or Sev2 incident has an incident commander, a timeline in the console, a hosted status-page entry, an in-app banner targeted to the affected tenants or offerings, and an instructor email from an audience-specific template with placeholders for scope, impact on submissions and grades, workaround and next update time. Deadline windows are derived from every summative due date (T-48 h to T+24 h, including extensions), the console shows upcoming windows across tenants, incidents inside a window auto-escalate one level, and a change freeze blocks artifact default-pointer changes and non-hotfix production deploys during any active window. Postmortems are written within 5 business days and tracked to closed actions.

**Why:** The team is small; explicit severities, pre-written communications and deadline awareness substitute for headcount and make the runbooks executable by whoever is on call.

**Acceptance:**
- Severity definitions, escalation path and update cadence (Sev1 every 30 min, Sev2 every 2 h) are published on the docs site and enforced by console reminders.
- Declaring an incident creates the status-page entry and in-app banner in one action from a chosen template, and banners target only affected tenants or offerings.
- Deadline windows are recomputed nightly and on due-date change; the deploy pipeline refuses non-hotfix production deploys during a window unless a platform admin overrides with an audited reason.
- A tabletop exercise of each runbook GAP4-OPS-12 to GAP4-OPS-16 is completed before the first pilot term with recorded outcome and action items.
- Every Sev1 or Sev2 incident links a postmortem within 5 business days and open actions are visible in the console.

### GAP4-OPS-12 Runbook: grading backlog at a deadline

Detection: grading-lane p95 wait above 60 s, oldest grading job older than 10 min, or throughput below the SCL-02 burst commitment. Actions in order: confirm every submission has a receipt and a job (GAP4-OPS-04 reconciliation); scale the worker pool to its burst ceiling; pause the batch and regrade lane; raise the affected tenant's concurrency cap; if LLM concurrency is the bottleneck, defer judged stages via GAP4-OPS-07 (deterministic now, AI backfill later); watch the dead-letter queue. Communications: a learner banner stating the submission was received at a given time with its receipt hash and that feedback is delayed with no action needed, and an instructor notice with a computed ETA and the option to extend the due date (SCH-02). Exit: queue age under threshold, deferred judged stages backfilled, reconciliation clean.

**Why:** This is the most likely pilot incident (hundreds of submissions minutes before a deadline) and the one with the highest learner anxiety; the runbook must make clear that submissions are safe even when feedback is late.

**Acceptance:**
- Runbook thresholds match the configured alerts and are rehearsed in staging with a synthetic 500-submissions-in-5-minutes load before the pilot (NFR-BURST).
- The learner banner shows each learner's own SUB-01 receipt time and hash so they can verify their submission exists.
- Scale, pause lane, raise cap and defer judged stages are each single audited console controls, not shell commands.
- The instructor notice template includes an expected completion time computed from current throughput and backlog.
- The reconciliation report showing zero lost submissions is attached to the postmortem.

### GAP4-OPS-13 Runbook: LLM provider outage or degradation

Detection: LLM error rate (429, 5xx, 529 overloaded, timeouts) above 20% over 5 min, judge-stage p95 above budget, or a provider status incident. Actions: engage the GAP4-OPS-07 global switch (or per-route disable when one model is affected) so grading degrades to deterministic-only without failed jobs; confirm the review-queue banner; never substitute a different model id or enable server-side fallbacks on score-bearing calls (LLM-06); on recovery clear the switch and monitor backfill and cache read share (LLM-07). Communications: learners are told AI feedback is delayed while computed checks and scores are available; instructors are told judged criteria are pending and may be graded manually or awaited, with an expected backfill time once recovery starts.

**Why:** A provider outage must never become a grading outage; PIPE-01 and NFR-10 promise this and the runbook makes the human steps and messaging unambiguous.

**Acceptance:**
- A staged outage (mock provider returning 529 for 15 min) yields zero failed grading jobs, deterministic criteria released per policy, judged criteria pending, and a 500-job backlog fully backfilled within 60 min of recovery.
- The runbook and the per-route disable screen both state that the pinned model id must not be swapped during an outage.
- Learner and instructor banner texts are the published templates and render within 60 s of the switch.
- Backfill progress (pending judged criteria count, age, ETA) is visible in the console and in the instructor review queue.

### GAP4-OPS-14 Runbook: engine, code-pack or grader regression after release

Detection: a benchmark or verification diff on a promoted artifact, a browser/server resultHash mismatch for the same model (a system error under SIM-DET-01), an override spike or agreement drop (CAL-01, MET-03), or an instructor or SME report via GAP4-HELP-03. Actions: freeze promotions; set the previous artifact as default (GAP4-OPS-05); list every task version and grade pinned to the suspect artifact; quarantine affected grades and withhold releases (GAP4-OPS-06); reproduce with the EVAL-01 harness and benchmark suite; after fix and SME sign-off, bulk re-pin and regrade with instructor review before release; record the errata entry and notices per the LEG- errata process. Communications: instructors are told which tasks are under verification and not to release or curve until notified; learners are told the grade is being re-verified and the submission is unchanged.

**Why:** A wrong check applied to released grades is a trust-ending event; the runbook ensures speed and transparency rather than quiet fixes.

**Acceptance:**
- From detection, affected task versions and grades are listed within 15 min using the registry and pin set, and quarantine is applied as one audited bulk action.
- Regraded results are stored as new grade versions with per-criterion diffs (VER-03) and reach learners only after instructor release.
- The errata entry (artifact, defect, affected tasks and tenants, regrade outcome summary) is published to the release-notes feed and emailed to affected institution admins.
- The runbook has been rehearsed by promoting a deliberately wrong checks-library build in staging and executing every step end-to-end.

### GAP4-OPS-15 Runbook: lost autosave or submission, with recovery tooling

Detection: a GAP4-HELP-03 report or ticket, a GAP4-OPS-04 reconciliation violation, or a failed receipt lookup. Recovery order, each reachable from the console: (1) submission receipt lookup by learner and task (SUB-01 hash and time); (2) server draft history (SUB-02 autosave versions, retained at least 30 days); (3) object-store version history for the model document (AVL-02 30-day object versioning); (4) op-log replay reconstructing the model to the last recorded operation; (5) the learner's local IndexedDB autosave exported through the diagnostic bundle. Restoration always creates a new draft version labelled 'recovered by support' and never overwrites the learner's current state; the instructor is asked to grant an extension (SCH-02) and the incident is counted on the lost-work counter with a root cause. The learner receives a precise statement of what was recovered and up to which timestamp.

**Why:** The exit criterion is literally zero lost submissions or grades; this runbook turns the AVL-03, SUB-02 and CAP-03 autosave guarantees into a repeatable recovery practice.

**Acceptance:**
- Each of the five recovery sources is reachable within two clicks of the learner/task pair and shows timestamps and hashes.
- Restoration creates a new draft version with provenance (source, time, operator), is audited, and the learner can diff it against their current model by element counts.
- Rehearsal in staging: delete a draft's latest server autosave and recover from the op log and from an uploaded IndexedDB bundle within 30 min.
- Every lost-work ticket closes with a root-cause category (client crash, sync conflict, server error, user error) and is reported weekly during the pilot.
- A submission present in the receipt log but absent from the pipeline is recreated via GAP4-OPS-03 with the original submit timestamp preserved for the late policy.

### GAP4-OPS-16 Runbook: tenant data-access error (cross-tenant or wrong-role exposure)

Detection: a row-level-security violation or authorization-test alert (SEC-03), anomalous disclosure-log patterns, or a user report of seeing data not theirs. Actions: contain within 15 min using GAP4-OPS-10 kill switches on the affected route or feature or by placing the tenant in read-only; preserve evidence (request logs, disclosure log, trace ids); determine scope from the disclosure log (records, principals, tenants, time window); notify affected institution admins within the pilot-agreement window and meet the 72-hour GDPR supervisory clock where applicable (PRIV-02); fix and verify with the two-tenant authorization suite before re-enabling; publish a postmortem. Communications go to the institution admin first with scope and remediation, then to learners per the institution's decision, with no public status entry unless availability is affected.

**Why:** Tenant isolation is the core security promise to institutions; a rehearsed response limits harm and meets contractual and statutory clocks.

**Acceptance:**
- Containment controls named in the runbook (route kill switch, tenant read-only) are single console actions tested in the tabletop exercise.
- The disclosure log answers 'which records did principal P read between T1 and T2' in under 60 s for any tenant.
- Notification templates and a clock tracker (start time, 72 h deadline, contractual deadline) are built into the incident record.
- Re-enabling the affected feature requires a green two-tenant authorization suite run recorded on the incident.

### GAP4-HELP-01 In-app help center with contextual help for every workspace tool

A help panel inside the application (shortcut '?', help icon on every tool, panel and dialog) opens the page for the current tool or screen without leaving the workspace, with search, keyboard navigation and links to the docs site. Every workspace tool and panel (node, member, support, load types, section and material assignment, releases and offsets, selection modes, transform gizmos, grid, snapping and working planes, measure, view presets and section cuts, result overlays and probes, diagnostics, units, command palette, tabular editor) has a stable help id and a page with purpose, steps, shortcuts, an image or short animation, common mistakes and related checks. Help content is single-sourced with the docs site (GAP4-HELP-08), versioned per release, and cached for offline tolerance in the workspace (AVL-03).

**Why:** PER-12's tutorial reaches a first analysis, but a live FEA workspace has dozens of tools; contextual help keeps support load down and keeps instructors from becoming the help desk.

**Acceptance:**
- 100% of workspace palette tools and panels have a help id resolving to a page; a CI check fails on any tool without one.
- Pressing '?' or the help icon opens the focused tool's page within 300 ms; help search returns within 500 ms p95.
- Each page records 'Was this helpful?' votes and search-miss queries, reviewed weekly by the team.
- Help pages render without blocking the canvas and remain available offline from the last session's cache.
- The release checklist requires a help review whenever a tool's behavior or shortcut changes (GAP4-HELP-07).

### GAP4-HELP-02 Check and clause explanation pages generated from the check catalog and clause library

Every deterministic check id (TB-09 catalog, SIM-VAL-02 validation rules, SITE-06 consistency rules, ERR- detectors) and every clause id in the clause library (XPL-03) resolves to an explanation page: what is measured, inputs and governing-equation outline (PRD-05), the limit and its source, why it matters in a real structure, typical fixes, common learner mistakes and the pack edition. Pages are generated from the clause library and check catalog so they cannot drift, contain only paraphrased explanations with no verbatim standard text (LEG- gap), and are linked from evidence records, diagnostics entries, self-check results (PER-02) and feedback (GRD-03, GRD-04). Exam-mode tasks can restrict which explanation pages are reachable during an attempt (INTEG- gap).

**Why:** The pedagogy depends on learners understanding why a check failed; generated pages keep the explanation identical across workspace, grader and docs.

**Acceptance:**
- Every check id and clause id emitted by the MVP code pack resolves to a page; a CI test iterates the catalog and fails on any missing page.
- Clicking a clause reference in feedback, diagnostics or self-check opens the page in the help panel with the learner's own demand, capacity and limit values beside the explanation.
- Pages carry the pack version and change only with a new clause-library version; the explanation-text diff is part of the artifact changelog (GAP4-OPS-05).
- An automated scan verifies no page contains verbatim passages from the referenced standards.
- Instructors can append course notes to a page without modifying the generated text.

### GAP4-HELP-03 'Report a problem' from the workspace with a consented diagnostic bundle, system check and support replay

A 'Report a problem' action in the workspace and on task and feedback pages creates a support ticket with a diagnostic bundle after the learner reviews an itemized consent list: canonical model JSON and hash, the op-log tail (last 200 operations or 10 minutes), browser and GPU capability data (user agent, WebGL2 vendor and renderer, WebGPU availability, WASM SIMD and threads support, device memory, pixel ratio, viewport, backend chosen per VIEW-06), engine artifact hash, task version and pin set, session id, recent client error and WASM panic stacks, an optional screenshot and the learner's description; memo text and attachments are excluded unless explicitly ticked. A self-service system-check page runs the BRW-01 capability tests and the start-up micro-benchmark and shows pass/fail with fixes. Engineers open a bundle in a sandboxed support-replay workspace that loads the model with the same pinned artifacts and never touches the learner's records.

**Why:** Most workspace problems reproduce only with the exact model, operations and device; a consented bundle turns 'it broke' into a replayable case and reduces the need for impersonation.

**Acceptance:**
- Bundle capture completes within 5 s for a Tier M model and is <= 10 MB; the consent dialog lists each item with a checkbox and unticked items are absent from the stored bundle.
- The ticket records tenant, offering, task version, pins, session id and bundle link; the learner receives a ticket id and can view or withdraw the bundle from their account.
- Support replay loads the bundle with the same engine artifact and reproduces the resultHash recorded in the bundle; replay is read-only and isolated from learner data.
- Bundles are retained 90 days then deleted, access is written to the disclosure log, and bundles are included in DSR export and erasure (GAP4-OPS-09).
- The system-check page is linked from error states such as the graphics-unsupported page, reports each capability with a plain-language fix, and points lab machines without WebGL2 to the tabular parity path (ACC-02).

### GAP4-HELP-04 Support intake, ticketing and pilot SLAs with deadline-week coverage

Support reaches the team through the in-app report action, a support email address and an instructor priority channel per pilot tenant; every ticket is tagged with tenant, role, offering, task, severity and deadline proximity and appears in a console triage queue linked to jobs, sessions and incidents. Pilot SLAs by severity (Sev1: a cohort cannot submit, workspace unusable or suspected data loss; Sev2: grading stalled or a feature broken with workaround; Sev3: single-user non-blocking issue; Sev4: question or request) define response and resolution targets, coverage hours and escalation, with extended coverage inside deadline windows (GAP4-OPS-11). Grade disputes are not support tickets and are routed to the instructor through the appeals path (REV-03, PRD-03), and SLA attainment is reported monthly to each pilot institution.

**Why:** Pilot instructors need to know who answers and how fast, especially in deadline weeks; routing grade disputes away from support protects the instructor-as-grade-authority principle.

**Acceptance:**
- Targets: Sev1 response <= 30 min (24x7 inside deadline windows, <= 1 h business hours otherwise) and mitigation <= 4 h; Sev2 response <= 2 business hours and resolution <= 2 business days; Sev3 response <= 1 business day and resolution <= 5 business days; Sev4 response <= 2 business days.
- Every ticket shows SLA clocks, breaches alert the on-call lead, and the monthly per-tenant report lists tickets by severity with attainment.
- Workspace-created tickets link to the diagnostic bundle, the learner's recent jobs and session id; tickets about a grade offer a one-click redirect to the appeal flow.
- Messages in the instructor priority channel create tickets automatically, defaulting to Sev2 inside deadline windows.
- The pilot agreement (GTM-05) references these SLA definitions verbatim.

### GAP4-HELP-05 Instructor onboarding, go-live readiness checklist and training material

Each pilot instructor completes a guided onboarding: kickoff session, a sandbox course with sample tasks and seeded submissions, and short training modules covering course setup from template in 30 minutes (PER-06), roster import, task basics and randomization, calibration runs and golden submissions (PV-02, EVAL-02), the review queue and overrides (REV-01, REV-02), gradebook export (MVP-04), integrity settings (INTEG- gap) and what to tell learners about AI grading (DAT-04). A go-live readiness checklist in the console gates opening an offering to learners: roster imported, dates shifted, every summative task calibrated with at least 10 golden submissions (MVP-01), instructor and TAs completed the review-queue module, support contacts exchanged, deadline windows registered. A train-the-TA module covers section scoping (PER-09).

**Why:** The first term's success depends on instructors using calibration and review correctly; a checklist converts tribal knowledge into a gate.

**Acceptance:**
- Checklist items are auto-verified where possible (roster count > 0, calibration report per summative task, module completion recorded) and block 'open to learners' until complete or explicitly waived by a platform admin with reason.
- Training modules are completable in <= 90 min total and completion is recorded per instructor and TA.
- Median instructor course setup time <= 30 min measured in onboarding sessions (PER-06).
- Onboarding materials are versioned with the release and linked from the docs-site instructor guide.

### GAP4-HELP-06 Office hours and pilot success cadence

Each pilot tenant has a named success contact, a shared channel, weekly office hours during the first four weeks of term and every deadline week (recorded, with notes published to that tenant's instructors), and a weekly check-in reviewing the MET-02 and MVP-05 metrics (activation, time-to-first-analysis, agreement, override rate, lost-work counter, open tickets) and upcoming deadline windows. Mid-term and end-of-term reviews capture instructor feedback into the rubric-calibration backlog and the product backlog.

**Why:** A small team cannot wait for tickets; a regular cadence surfaces miscalibrated tasks and confused learners before deadlines.

**Acceptance:**
- The office-hours schedule is published in-app for each pilot tenant's instructors and sessions are logged with attendance and action items.
- Weekly check-in notes include the exit-criteria dashboard snapshot and are stored per tenant in the console.
- Every action item is tracked to closure with an owner; items open longer than 2 weeks are flagged.
- Mid-term and end-of-term reviews are completed for every pilot tenant and feed the MVP-05 post-pilot review.

### GAP4-HELP-07 Release notes and in-app change announcements

Every production release publishes release notes tagged by audience (learner, instructor, admin, API) and impact (cosmetic, behavior change, grading-affecting artifact), linked to artifact changelogs (GAP4-OPS-05); grading-affecting artifacts never alter pinned tasks silently and their default-pointer change is announced at least 5 business days ahead with re-pin and regrade guidance. An in-app 'What's new' surface shows audience-appropriate items with per-user dismissal, instructors can schedule announcements to learners (DSC-01), and announcements are suppressed inside exam-mode attempts and never shown as modals in the workspace. API changes follow a published deprecation policy with at least 90 days notice.

**Why:** Instructors mid-term must know whether a change can affect grading, and learners must not be interrupted during an attempt.

**Acceptance:**
- A release cannot be promoted to production without a release-notes entry (pipeline check); notes are published on the docs site within 24 h.
- Each note carries audience and impact tags; grading-affecting items link to the artifact version and GAP4-OPS-06 re-pin instructions.
- 'What's new' shows only items for the user's role and tenant-enabled features, is dismissible, and does not render inside an active exam-mode attempt or as a workspace modal.
- API release notes list deprecations with removal dates at least 90 days out.

### GAP4-HELP-08 Documentation site structure for learners, instructors, admins and API users

A public documentation site generated from the monorepo and versioned per release has four audience sections plus a trust section: Learner (getting started and tutorial, workspace reference and shortcuts, tabular editor and accessibility path, analysis and results, checks and clause explanations, tasks, self-check, submissions and receipts, how AI grading and appeals work, system requirements and troubleshooting); Instructor (course setup and term rollover, authoring tasks and scenarios, randomization, calibration and golden submissions, review queue and overrides, gradebook export, integrity and exam mode, analytics); Admin (tenant settings, members and roles, roster import, data requests and retention, security and privacy, status and support); API (authentication, OpenAPI reference, webhooks, rate limits, changelog; ships with INT-03); Trust (status page, security, privacy, AI transparency notice, subprocessors, VPAT, release notes). Search, a feedback widget and a 'last verified for release X' stamp appear on every page, and the same source feeds in-app contextual help.

**Why:** Procurement reviewers, instructors and learners each need a predictable place to look; single-sourcing with in-app help keeps one truth.

**Acceptance:**
- The information architecture above exists with at least one reviewed page per topic before the pilot starts; the API section ships together with INT-03.
- The docs build runs in CI; broken links or missing help ids fail the build; every page shows the release it was verified for.
- Site search returns within 500 ms p95 and zero-result queries are logged for review.
- The trust section hosts or links the GTM-05 procurement-pack artifacts and the exact AI transparency text used in-app (DAT-04).

## Should (v1.x)

### GAP4-OPS-17 Runbook automation: auto-scale, auto-degrade and transient dead-letter replay

Codify the mechanical steps of GAP4-OPS-12 and GAP4-OPS-13 as policies: scale workers on grading-lane age, engage per-route or global LLM degradation automatically when the provider error rate crosses the runbook threshold and clear it after a sustained healthy window, and automatically replay dead-letter entries classified as transient (infrastructure, timeouts) up to a bounded number of times. Each automatic action is audited as 'policy' actor, notifies on-call, and can be disabled per policy from the console.

**Why:** Once the runbooks have been rehearsed and the thresholds validated in the first term, automating them removes the most common pages from a small on-call rotation.

**Acceptance:**
- Each policy has an enable switch, thresholds, a maximum action rate and a dry-run mode that only notifies.
- Automatic actions appear in the incident timeline with the triggering metric values.
- A load test shows auto-scaling keeps grading-lane p95 wait under 60 s for the NFR-BURST scenario without operator action.

## Non-functional targets

| id | title | target |
|---|---|---|
| GAP4-NFR-01 | Operator action auditability | 100% of console write actions carry actor, reason, target and before/after; audit export for any tenant or grade completes in < 10 s; console reads of education records appear in the disclosure log within 60 s |
| GAP4-NFR-02 | Job inspector freshness and search | Job state visible in the console within 5 s of a queue transition; lookup by submission, learner or trace id < 2 s; bulk actions of 1,000 jobs accepted < 10 s |
| GAP4-NFR-03 | Stuck-job detection and reconciliation | Stuck-job alert within 10 min of a stage exceeding its budget; reconciliation every 15 min with zero unreconciled submissions older than 30 min; lost-work counter = 0 across the pilot term |
| GAP4-NFR-04 | LLM kill switch and degradation propagation | Global or per-tenant switch stops new LLM calls within 60 s; in-flight calls settle within 120 s; zero failed jobs caused by the switch; backfill of a 500-job judged backlog within 60 min of recovery |
| GAP4-NFR-05 | Pin override, rollback and regrade latency | Re-pin or rollback effective for new jobs within 1 min; affected task versions and grades listed within 10 s; 1,000-submission regrade <= 2 h in the batch lane |
| GAP4-NFR-06 | Data-subject request clocks | Export delivered <= 72 h after approval; erasure <= 30 days in primary stores and <= 90 days in backups; SLA alerts at 50% and 80% of the GDPR one-month and FERPA 45-day clocks |
| GAP4-NFR-07 | Impersonation bounds | Consent token single-session, default 60 min, max 4 h; learner summary email within 15 min of session end; 100% of impersonated actions attributed to the operator in the audit log |
| GAP4-NFR-08 | Pilot support SLAs | Sev1 response <= 30 min (24x7 in deadline windows, <= 1 h business hours otherwise), mitigation <= 4 h; Sev2 response <= 2 business hours, resolution <= 2 business days; Sev3 1 / 5 business days; Sev4 response <= 2 business days; >= 95% attainment per month |
| GAP4-NFR-09 | Contextual help coverage and speed | 100% of workspace tools, panels, MVP check ids and cited clause ids have a help page before pilot start (CI-enforced); help panel opens < 300 ms; help and docs search < 500 ms p95 |
| GAP4-NFR-10 | Diagnostic bundle | Capture < 5 s for a Tier M model; bundle <= 10 MB; memo excluded by default; retained 90 days; support replay reproduces the bundle's resultHash 100% of the time on the same artifact |
| GAP4-NFR-11 | Release communication | Release notes published within 24 h of every production release; grading-affecting default-pointer changes announced >= 5 business days ahead; API deprecations >= 90 days notice |
| GAP4-NFR-12 | Incident response and freeze | Status-page entry and targeted in-app banner within 10 min of declaring Sev1/Sev2; Sev1 updates every 30 min; postmortem within 5 business days; zero non-hotfix production deploys inside deadline windows without an audited override |

## Domain notes (for architecture and UX)

SEVERITY MATRIX (used by OPS-11, HELP-04, runbooks)
- Sev1: learners in any cohort cannot open the workspace or submit; grading pipeline fully stopped; suspected loss or exposure of submissions, grades or personal data. Page on-call + incident commander. Response 30 min (24x7 inside deadline windows; business hours otherwise 1 h), mitigation 4 h, status updates every 30 min.
- Sev2: grading stalled or deterministic-only for > 2 h; core feature broken with workaround; one tenant affected; severe performance degradation. Response 2 business hours, resolution 2 business days, updates every 2 h.
- Sev3: single-user issue, non-blocking defect, help-content error. Response 1 business day, resolution 5 business days.
- Sev4: question, how-to, feature request. Response 2 business days.
- Business hours = 08:00-18:00 in each pilot institution's timezone (US zones at MVP). Inside a deadline window every incident escalates one level (Sev2 -> Sev1 paging).

DEADLINE WINDOWS: for each offering and each summative activity with due date D (max over per-learner extensions), window = [D - 48 h, D + 24 h]; windows are merged per tenant and shown globally. Recomputed nightly and on any due-date change. Effects: change freeze (no artifact default-pointer changes, no non-hotfix production deploys), 24x7 Sev1 coverage, severity escalation, instructor-channel tickets default to Sev2.

JOB STATES AND ALLOWED OPERATOR ACTIONS (state machine from AIG PIPE-01)
- queued: cancel, reprioritize, move lane.
- analyzing / checking / judging / aggregating: cancel; on failure -> failed.
- failed: retry stage, re-run from stage (same pins or new pin set), move to dead-letter, discard (reason).
- review: re-run (creates new grade version), quarantine.
- released: regrade (new grade version; instructor release required), quarantine (marks 'under review').
- dead-letter: replay, discard (reason). Reason classes: solver_error, model_validation_error, llm_error, infrastructure, unknown; transient classes (infrastructure, timeouts) are eligible for OPS-17 auto-replay.
Lanes/priorities: interactive > grading > batch/regrade (NFR SBX-03). Per-tenant concurrency cap is an operator-adjustable number.

RECONCILIATION INVARIANT (every 15 min): for each submission_version s: exactly one grading job j(s) exists and is active or terminal; for each terminal job: state in {review, released} implies a stored grade_version; state = failed implies a dead-letter entry; state = cancelled implies an audited reason. Violations: page, auto-create missing job preserving original submit timestamp, increment lost-work counter only if a learner-visible loss actually occurred (operator confirms root cause).

ARTIFACT REGISTRY
- Types (canonical list owned by the DM- gap): engine build, checks library, code pack, clause library, scenario engine, section/material libraries, cost model, prompt template, judge schema, routing policy, validator, rubric templates. Composite grader_version is derived from the grader-side subset and frozen per published task version (critic conflict 17).
- Lifecycle: candidate -> verified -> default -> deprecated -> revoked (revoked = must not be used for new jobs; existing grades quarantined). Never deleted; runnable >= 3 years (SIM-DET-03).
- Gates per type: engine = benchmark suite passes with identical resultHash across wasm/native/macOS/Linux and performance regression < 15%; checks library and code pack = conformance suite + SME sign-off record (LEG-); clause library = SME sign-off + no-verbatim scan; grader components = EVAL-01 harness within tolerance (agreement, flip rate, injection pass rate) and cost within COST-02.
- Rollout rings: staging -> sandbox tenant -> opted-in pilot tenants (new task versions only) -> default pointer. Two-person rule on promotion and revocation.
- Pin override = new task version containing only pin fields (VP-02 immutability preserved) with the VP-03 in-flight choice; rollback = re-pin to the previous pin set. Quarantine states on grade versions: none | under_verification (unreleased, withheld) | under_review (released, flagged to learner and instructor).

FEATURE FLAGS: categories release | kill_switch | entitlement (entitlements come from BIL-01 plans, not editable as flags). Scopes global, tenant, offering, user. Precedence: global kill switch > tenant override > plan entitlement > default. Server-authoritative evaluation for anything security- or grading-relevant; client receives an evaluated snapshot. Flags must never change grading-affecting behavior for an in-flight attempt (that is the pinned task version) or anything visible in an exam-mode attempt. Recommend a minimal Postgres-backed flag table + cached SDK rather than a SaaS at MVP (keeps tenant/offering semantics native and avoids a subprocessor).

IMPERSONATION MODEL: mode view_as (read-only; no writes; no learner-attributed MET-01 events; banner) vs impersonate (writable; consent token + reason + time box; denylist: password/email change, MFA changes, grade release, deletions, DSR actions, billing). Consent token: random 128-bit, generated by learner (account settings or ticket email link), valid 7 days to start, single session, revocable; break-glass = institution-admin approval recorded with reason. Audit actor format 'operator:<id> as learner:<id>'. Learner summary email within 15 min; institution admin session list; FERPA disclosure-log entry per session.

DSR EXECUTION: controller routing (institutional tenant -> institution admin approves; self-serve -> platform). Store checklist: primary Postgres (all tenant tables), object storage (models, snapshots, attachments, bundles), LLM prompt/response logs, search/analytics stores, support help-desk tickets and diagnostic bundles, transactional email provider, backups (age out <= 90 days; document crypto-shredding if adopted). Pseudonymization: rewrite retained grade, evidence, audit and learning-record rows to a freshly generated random pseudonym; delete the user row and never store a mapping; audit log keeps only a hashed reference. Clocks: GDPR Art. 12 one month (extendable +2 months with notice), FERPA 34 CFR 99.10 access within 45 days; internal targets 72 h export, 30 d erasure.

RUNBOOK TEMPLATE: id, title, default severity, owner, detection signals (metric names and thresholds), preconditions, numbered steps naming the exact console control, learner/instructor/admin comms templates, rollback and exit criteria, verification, postmortem requirements, last-rehearsed date. All five MVP runbooks are rehearsed via tabletop plus a staging drill before the pilot term.

COMMS TEMPLATE FIELDS: audience (learner | instructor | admin), channel (in-app banner | email | status page | priority channel), scope (tenants/offerings/tasks), what happened (plain language, no blame), impact on submissions (always state 'your submission is safe' when true, with receipt time/hash), impact on grades, what the user should do (usually nothing), workaround, next update time, incident id. Sample learner text (backlog): 'We received your submission for <task> at <time> (receipt <hash8>). Feedback is taking longer than usual; no action is needed. Next update at <time>.'

HELP ID SCHEME: help/tool/<toolId>, help/panel/<panelId>, help/screen/<routeId>, help/check/<checkId>, help/clause/<packId>/<clauseId>. Content lives in the monorepo (MDX with front-matter: id, audience, release, lastVerified) and builds both the docs site and the in-app help bundle; CI iterates the workspace tool registry and the check/clause catalogs and fails on missing ids. Check/clause pages are generated from catalog data (what is measured, equation outline, limit source, why it matters, typical fixes, common mistakes, pack edition) plus optional hand-written prose; a no-verbatim scan runs against the referenced standards' fingerprints (LEG-).

DIAGNOSTIC BUNDLE SCHEMA (outline): {bundleVersion, createdAt, sessionId, tenantId, offeringId, taskVersionId, pins{engine, checksLibrary, codePack, clauseLibrary, graderVersion}, model{canonicalJson, modelHash}, opLogTail[{seq, ts, op, actorId}], results{resultHash, summary?}, client{userAgent, platform, webgl2{vendor, renderer}, webgpu, wasmSimd, wasmThreads, deviceMemory, devicePixelRatio, viewport, backend, locale, timezone}, errors[{ts, message, stack, wasmPanic?}], screenshot?, description, consent{items[], memoIncluded:false}}. Retention 90 days; included in DSR export/erasure; access logged.

SUPPORT TICKET SCHEMA: id, tenantId, reporterRole, offeringId?, taskVersionId?, severity, deadlineProximity (hours to nearest window), channel, bundleId?, linked jobIds, sessionId, incidentId?, SLA clocks (firstResponseDue, resolutionDue), status, rootCauseCategory on close. Grade disputes are redirected to REV-03 appeals, not held as tickets.

DOCS IA: Learner | Instructor | Admin | API | Trust (status, security, privacy, AI transparency, subprocessors, VPAT, release notes). Release notes carry audience and impact tags (cosmetic | behavior | grading-affecting artifact) and link to artifact changelogs.

TOOLING RECOMMENDATIONS FOR A SMALL TEAM: build the console as internal routes of the main app behind platform-admin + MFA (no second product); use a hosted status page and a hosted help desk with email ingestion and an API (both added to the GTM-05 subprocessor list; confirm data location); a lightweight hosted on-call pager; docs as a static site generated from the monorepo; release-notes skeleton generated from PR labels with hand-written audience summaries; LLM spend from provider usage fields (OBS-03) rather than a separate metering vendor.

## Risks

| risk | mitigation |
|---|---|
| The operator console becomes the highest-value attack surface (impersonation, DSR, kill switches) and is under-protected because it is 'internal'. | Platform-admin role with enforced MFA, optional IP allowlist, reason-required writes, two-person rule on artifact promotion and revocation, full audit, and inclusion of console routes in the annual pentest and the two-tenant authorization suite. |
| Impersonation misuse or an unlogged read of education records creates a FERPA disclosure violation that an institution discovers later. | Consent tokens, time boxes, denylist, learner summary email, institution-admin visibility, and disclosure-log entries for every console read; rehearse the OPS-16 runbook. |
| Re-pin and regrade churn after an engine or check defect confuses learners and undermines instructor trust in AI grading. | Grade quarantine with explicit 'under verification' status, instructor release required for every regraded version, pre-written comms templates and an errata log published per LEG- process. |
| The LLM kill switch is left engaged or budgets are set too low, so judged criteria silently pile up and instructors release incomplete grades. | Backfill backlog count and age on the console and in the review queue, an alert when any pending judged criterion exceeds 24 h, and a review-queue banner stating the degraded mode and manual-grading path. |
| DSR erasure either deletes grades the institution must retain or misses a store (LLM logs, support bundles) and fails GDPR. | Controller routing to the institution, dry-run with per-store counts, checklist-driven job that fails loudly on unreachable stores, pseudonymization of retained rows, legal-hold check and a completion certificate. |
| Help content drifts from product behavior and clause explanations drift from the clause library, so learners and the grader disagree. | Single-source docs in the monorepo, generated check/clause pages from catalog data, CI coverage checks on tool and check ids, and a help review item in the release checklist. |
| A 3-5 person team cannot sustain 24x7 coverage, and deadline-week incidents land on whoever is awake. | Deadline-window calendar limits 24x7 coverage to known windows, change freeze during windows, pre-rehearsed runbooks, and OPS-17 automation of the mechanical steps after the first term. |
| Diagnostic bundles accumulate personal data (names in memos, screenshots) outside the main data model and are forgotten in DSRs and retention. | Memo excluded by default with itemized consent, 90-day retention with automatic deletion, access logged to the disclosure log, and bundles included in the DSR store checklist. |

## Open questions

- Who is the designated FERPA school-official contact at each pilot institution for DSR approvals, impersonation break-glass and breach notification, and what notification window will the pilot agreement specify (24 h, 72 h)?
- Is learner consent sufficient for impersonation at pilot institutions, or do they require institution-admin approval for every session (and different handling for under-18 dual-enrollment learners)?
- Which hosted help desk, status page and on-call vendors are acceptable given they become subprocessors receiving learner emails and diagnostic bundles (GTM-05), and must any of them keep data in a specific region?
- Should instructors get a read-only grading-status view of their own offering's jobs (queue position, pending judged criteria) or only the review-queue banner?
- Are pilot SLAs targets only, or do pilot agreements include service credits or termination rights on repeated breach?
- Should diagnostic bundles ever include memo text by default for grading-related reports (it is the most PII-prone field), or always require an explicit tick?
- Does the default-pointer change for grading-affecting artifacts require sign-off from a design-partner instructor in addition to the two-person operator rule during the first term?
- What business-hours timezone set applies at MVP (single US zone or per-tenant), and who covers deadline-window nights and weekends in a 3-5 person team?
