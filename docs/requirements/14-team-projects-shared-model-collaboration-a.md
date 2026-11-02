# Team projects, shared-model collaboration, and peer review at the document-model level (ids GAP6-; corresponds to the COLLAB area)

_Source: requirements discovery workflow `wf_6281c128-0bb` (gap-fill agent), 2026-11-03. 20 requirements: 5 must (MVP), 12 should (v1.x), 3 could (later)._

## Summary

Bridle's workspace document is a canonical JSON model edited through an append-only operation log with undo/redo, local autosave and immutable submission snapshots; today that model assumes one learner-editor, while authoring already has edit locks with presence (CA-02) and anchored review comments (CA-03) and CRS-05 plus capstone/ABET SO5 courses require teams sharing one model and one submission. The key decision this domain forces is to put five things into the MVP schema now, before any team feature ships: ownership and scope fields on every document (ownerType/ownerId/teamId/courseId/sectionId/taskId/forkedFrom), actor and session identity plus gesture grouping and lock epoch on every operation, stable client-generated element ids with tombstones and fractional order keys, a single element-level comment-anchor model shared by instructors, the AI grader and peers, and snapshot lineage with a frozen member list. With those in place, the team features are additive: a whole-document check-out lock with presence and auto-release (reusing CA-02) is the MVP-compatible editing model, with a documented staged path to element-group locks and then Figma-style server-ordered, per-property last-writer-wins real-time co-editing over the same op log (CRDT held in reserve for offline-first merging). Contribution attribution is derived purely from the op log (gestures, elements touched and surviving, active time, lock time, comments, justification authorship), excludes staff and system ops, and is presented to instructors with timeline, heatmap, replay and drill-down rather than bare counts. Team submissions are pin sets (snapshot(s) + justification version + attachments + frozen members) with team-level attempt policy, per-member grade adjustments and optional CATME-style peer evaluation; peer review is a separate anonymized activity on read-only snapshots, calibrated against instructor-scored exemplars; staff open learner models in explicit snapshot (immutable) or live (observer, optionally help-mode editing recorded as staff ops) modes.

## Must (MVP)

### GAP6-01 Schema: ownership and scope fields on every document

Every workspace document (sandbox model, task working model, template/starting model, staff fork, peer-review copy) carries ownerType ('user'|'team'|'course'), ownerId, teamId (nullable, set when ownerType='team'), courseId (nullable for personal sandboxes), sectionId (nullable), taskId (nullable), createdBy, forkedFrom {documentId, snapshotId} (nullable), schemaVersion and headSeq. Access is resolved from these fields plus the caller's course role in one authorization function; no per-user ACL rows are stored on documents in the MVP. Single-learner MVP documents simply use ownerType='user', teamId=null.

**Why:** Adding team ownership after launch would require rewriting every stored document and every authorization path; defining the fields now costs nothing and makes team documents a configuration change rather than a migration.

**Acceptance:**
- The Document JSON schema includes all listed fields; MVP sandbox and task documents are created with ownerType='user' and teamId=null.
- A single authorize(document, caller) function with unit tests covers: owner, team member, removed team member, instructor of course, TA of section, TA of other section, guest share link, anonymous.
- A test creates a document with ownerType='team' and a teamId against the unmodified MVP schema and all document APIs (open, op append, snapshot, comment) work without schema changes.
- forkedFrom is populated when a learner starts a task from a template model, when staff fork a learner snapshot, and when a member saves a personal version (GAP6-10).

### GAP6-02 Schema: actor, session, gesture and lock identity on every operation

Every op appended to a document's log records actorId (user id or 'system'), actorRole at the time of the op ('learner'|'instructor'|'ta'|'system'|'ai'), onBehalfOf (nullable; set when staff edit a learner or team document in help mode), sessionId (client tab/device), origin ('user'|'undo'|'redo'|'import'|'restore'|'system'|'migration'), clientOpId (UUID for idempotency), seq (server-assigned, gapless per document), baseSeq (head seq the client observed), lockEpoch, gestureId (groups ops from one user gesture), clientTs and serverTs. Ops are invertible (carry before and after values) so undo and redo are themselves ops referencing undoOfSeq; the log is append-only.

**Why:** Contribution attribution, per-user undo in co-editing, conflict detection and staff-edit exclusion are all derived from these fields and cannot be reconstructed later; an op log without actor ids makes team features impossible without replaying history nobody has.

**Acceptance:**
- Op validation rejects any op missing actorId, actorRole, sessionId, clientOpId, gestureId or baseSeq (schema test).
- Re-sending an op with the same (documentId, clientOpId) returns the original seq and appends nothing.
- Undo emits an inverse op with origin='undo' and undoOfSeq set; database constraints forbid UPDATE/DELETE on op rows (verified by a migration test).
- seq is assigned only by the server and is gapless per document under concurrent appends (load test with two sessions).

### GAP6-03 Schema: stable element identity, tombstones and fractional order keys

Every element in the canonical model (node, member, plate, support, load, load case, load combination, section, material, group/layer, justification text block, design-alternative container) has a globally unique, client-generated, never-reused id (ULID or UUIDv7); all cross-references (member end nodes, load targets, combination cases) are by id, never by array index. Ordered collections carry a fractional-index 'order' key, deletes write a tombstone (deletedAtSeq) that remains resolvable, and ops address targets as (elementId, propertyPath) with set/create/delete semantics. Derived analysis results are never part of the model or the op log.

**Why:** Index-based addressing breaks comment anchors, attribution and concurrent editing the moment two actors edit the same model; retrofitting ids means rewriting every stored model and every op.

**Acceptance:**
- The canonical model JSON schema requires 'id' on every element type; a lint test fails on any schema property that references elements by position.
- Two clients creating elements concurrently in a test never collide; the server rejects an op that creates an id that already exists (including tombstoned ids).
- GET /documents/:id/elements/:elementId?asOf=<seq> returns the element state at that seq, or a tombstone record with deletedAtSeq.
- Reordering a load case produces exactly one 'order' set op, not a list rewrite; the solver input is independent of op history (contentHash equal for equal models).

### GAP6-04 Schema: one element-level comment-anchor model for authors, AI grader, learners and peers

Comments live in a collaboration layer outside the model JSON with threadId, parentId, authorId, authorRole, createdAt, body, visibility ('team'|'staff-only'|'author-and-staff'|'private-note'), status ('open'|'resolved', resolvedBy/At) and an anchor {type: 'element'|'elementSet'|'point'|'result'|'text-range'|'document', elementIds[], asOfSeq or snapshotId, fallback {worldPosition, label}}. Anchors resolve against any later head as live, outdated (element tombstoned; comment shows the element as of asOfSeq) or re-anchored by the author. Author review comments (CA-03), learner-to-learner comments, peer-review comments and AI grader findings all use this one schema.

**Why:** A single anchor model prevents three incompatible comment systems and guarantees every comment, including AI feedback, survives model edits and can be displayed on the 3D view by element id.

**Acceptance:**
- Moving a node keeps its comment attached; deleting the node marks the thread 'outdated' with a 'view as of seq N' action that renders the element's historical state.
- An elementSet anchor over three members highlights all three in the 3D view and in the 2D/results views.
- The AI grader writes its findings as comments with authorId='ai-grader', authorRole='ai' and element anchors (grading pipeline integration test).
- A comment created while viewing an immutable snapshot stores snapshotId and is shown both on that snapshot and on the live document labeled 'from submission attempt N'.
- Comment create/update/resolve never changes the document's contentHash.

### GAP6-05 Schema: snapshot lineage, canonical content hash and frozen membership

Each immutable snapshot stores id, documentId, seq (op log position captured), parentSnapshotId (previous snapshot of this document, or the forkedFrom snapshot for forks), contentHash (hash of the canonical JSON model via a canonicalization scheme such as RFC 8785, excluding derived results and comments), createdBy, reason ('manual'|'checkpoint'|'lock-release'|'submission'|'staff-fork'|'personal-version'|'peer-review-copy') and, for team documents, a frozen members[] list with userId and team role at capture time. Snapshots referenced by a submission, comment, attempt or fork are never mutated or deleted.

**Why:** Lineage lets instructors trace which submission derived from which version, lets integrity checks detect forks of other learners' models, and makes team membership at submission time unambiguous after roster changes.

**Acceptance:**
- Walking parentSnapshotId from any submission snapshot reaches the task template snapshot (or null for a blank start) in a lineage test.
- Two snapshots with identical canonical models produce the same contentHash regardless of key order, number formatting or cached results.
- A team-document snapshot includes members[]; later membership changes do not alter it.
- DELETE on a snapshot referenced by a submission, comment or fork returns 409.

## Should (v1.x)

### GAP6-06 Teams: team sets, instructor-formed teams and section scoping

Instructors create a team set within a course (optionally scoped to a section) and form teams manually, randomly, or balanced by section; each team has a name, members with role ('member'|'lead'), and an audit log of membership changes. A team set can be bound to several tasks; a task in team mode binds to exactly one team set, and a learner belongs to at most one team per team set.

**Why:** Capstone and design-studio courses run several deliverables with the same teams and need deterministic formation controls; this is the ABET SO5 enabler CRS-05 assumes.

**Acceptance:**
- Auto-assigning 48 learners into teams of 4 yields 12 teams with no learner in two teams and sections respected when 'balance by section' is set.
- Creating a team-mode task without a team set is blocked with a clear error; the task stores teamSetId.
- Membership audit log records actor, action, member and timestamp for every change.
- Team documents for the task are created lazily on first open with ownerType='team', teamId, courseId, sectionId, taskId and forkedFrom pointing at the task template snapshot.

### GAP6-07 Teams: self-formed teams with size limits and formation deadline

When a team set is configured as self-formed, learners create a team, invite by join code or open list, and join or leave until a formation deadline, subject to min/max size (default 2-5) and section scoping. After the deadline the instructor sees unassigned learners and undersized teams and can auto-fill, merge, or allow individual mode for a learner.

**Why:** Self-selection is common in professional-practice courses but needs guardrails so no learner is left without a team and no team exceeds what the lock model supports well.

**Acceptance:**
- Joining a full team or a team outside the learner's section (when scoped) is rejected with a specific error.
- Leaving a team after the formation deadline requires instructor action.
- The post-deadline report lists every enrolled learner without a team and every team below minimum size.

### GAP6-08 Teams: membership changes mid-project and individual-exception forks

Instructors (and leads, if the team set allows) can add or remove members mid-project. Removed members lose edit and live-view access immediately, but their ops, comments and attribution remain under their actorId; added members get full history access. An instructor can move a learner to 'individual exception' mode, which forks the team document at a chosen snapshot into a user-owned document (forkedFrom set) and routes that learner's submission to the fork.

**Why:** Team breakdowns are routine; the system must preserve attribution integrity and give instructors a clean recovery path without data loss or manual copying.

**Acceptance:**
- Removing a member revokes any lock they hold and closes their sessions within 5 s; their historical ops still appear in attribution and version history.
- An individual-exception fork carries forkedFrom {documentId, snapshotId} and the source snapshot's frozen members[].
- Membership changes after a submission do not alter that submission's members[]; the gradebook shows the submission under the members frozen at pin time.

### GAP6-09 Editing: whole-document check-out lock with presence and auto-release

Team documents use a single whole-document edit lock reusing the CA-02 mechanism: the holder edits while other members and staff observe live (ops streamed read-only, holder's selection highlighted) and can 'request edit'. The lock carries a lockEpoch, is kept alive by a 30 s heartbeat, auto-releases after 3 min without heartbeat or on tab close, can be handed off explicitly, and can be force-released by an instructor; the server rejects ops whose lockEpoch is stale. Lock release automatically captures a checkpoint snapshot (reason='lock-release').

**Why:** This is the MVP-compatible collaboration model: minimal new infrastructure, a guaranteed linear op log, and no conflicting edits, while presence keeps the rest of the team engaged.

**Acceptance:**
- With A holding the lock, B's edit tools are disabled and B sees 'A is editing'; B's request notifies A; after A releases, B acquires within 2 s.
- Killing A's tab releases the lock within 3 min; A's unsent local ops are preserved locally and offered for replay per GAP6-10.
- An op with a stale lockEpoch or from a non-holder returns 409 and never enters the op log.
- Observers see the holder's ops rendered within 1 s p95 and analysis results recomputed locally from the same canonical model.

### GAP6-10 Editing: conflict handling, autosave replay and per-member version history

When a member has unsent local ops whose lockEpoch or baseSeq is stale, the client offers: replay onto the current head (ops re-based by element id; ops touching tombstoned elements or properties changed since baseSeq are listed as conflicts to accept or drop), save as a personal version (user-owned fork with forkedFrom at the baseSeq snapshot), or discard. Any member can create named versions and browse a version timeline (author, time, diff summary of elements added/changed/removed, filter by member); the lock holder restores a version as a forward op batch (origin='restore'), never by rewinding the log.

**Why:** Under a lock model conflicts are rare but inevitable (network loss, auto-release); learners must never lose work, and instructors need a truthful history of what happened.

**Acceptance:**
- Replaying 20 stale ops where 2 target a tombstoned member applies 18 and lists 2 conflicts with element ids and both values.
- Restoring a version appends forward ops with the restorer's actorId and origin='restore'; all prior ops remain queryable.
- Version timeline filtered by a member shows only versions and lock-release checkpoints that member created.
- A personal version is a separate document the member can edit alone and later propose to the team by sharing a comment link to its snapshot.

### GAP6-12 Attribution: per-member contribution metrics derived from the op log

For team documents the system computes per member, up to the submission's seq: gestures and ops by type (create/modify/delete), distinct elements touched, elements surviving in the submitted snapshot by creator and by last editor, active editing time (sessions with gaps under 5 min), lock-held time, analysis runs triggered, comments authored and resolved, versions created, and justification characters authored. Ops with actorRole in ('instructor','ta','system','ai'), onBehalfOf set, or origin in ('import','restore','migration') are excluded from learner totals and shown separately.

**Why:** Instructors need objective evidence for individual grade adjustments and for detecting free-riding without relying solely on peer evaluation.

**Acceptance:**
- A golden test with a scripted three-member op log produces the expected metrics table exactly.
- Staff help-mode edits and restores never appear in any learner's totals.
- Metrics for a 50,000-op document compute in under 5 s and are cached per (documentId, seq).
- Metrics use gestureId so a drag that emits 200 property ops counts as one gesture.

### GAP6-13 Attribution: instructor presentation with timeline, heatmap, replay and drill-down

The grading view of a team submission includes a contribution panel: a per-member summary table, a stacked activity timeline by member, a 3D heatmap of the submitted snapshot colored by creator or last editor, a scrubber that replays model evolution with author coloring, and CSV export. Every number links to the underlying ops, and the panel states that metrics indicate activity, not quality; learners see their own team's summary only when the instructor enables it.

**Why:** Raw counts are easy to misread and to dispute; visual context and drill-down make adjustments defensible and support process assessment.

**Acceptance:**
- Clicking a member's 'elements touched' lists element ids and selects them in the 3D view.
- The heatmap toggles between 'creator' and 'last editor' coloring on the submitted snapshot.
- The op-log scrubber shows the model at any seq with the acting member's color and the lock holder at that time.
- Learner-facing summary is hidden by default and shows no per-member data unless 'share contribution summary with team' is on.

### GAP6-14 Submission: team pin set, submission permission and team-level attempt policy

A team submission is a pin set: the pinned model snapshot (or several labeled snapshots when the task requests design alternatives), the justification text version, attachments, and members[] frozen at pin time. Submission permission per task is 'any member', 'lead only', or 'any member with co-sign by all' before the deadline; attempts, attempt limits, late policy and grace period are counted per team, and each attempt records attemptNo and the previous attempt's snapshot.

**Why:** CRS-05 assumes one shared submission; its policy semantics must be explicit so the gradebook and AI grader treat the team as the grading unit and disputes about who submitted are answerable.

**Acceptance:**
- In co-sign mode grading is held until all members confirm or the deadline passes, after which the submission proceeds with missing co-signs recorded.
- Attempt 2 references attempt 1's snapshot; both remain inspectable and gradeable.
- With an attempt limit of 2, a third pin is blocked for every member with the same message.
- The AI grader receives the pinned snapshot by contentHash and the members[] list, and produces one team grade record.

### GAP6-16 Comments: learner-to-learner threads anchored to model elements

Members of a team document can create threads anchored per GAP6-04 on elements, element sets, points, results or the justification text, mention teammates, resolve threads, and filter by element, author or status; threads are visible to the team and staff. Notifications are in-app with an optional email digest, and comments never alter the model or its contentHash.

**Why:** Design discussion should happen on the model rather than in external chat so instructors can assess team process and the AI grader can read the same anchored context.

**Acceptance:**
- A comment on member M-12 appears to all members within 2 s and highlights M-12 on click in 3D and results views.
- Resolving a thread records resolvedBy/resolvedAt and keeps the thread in history.
- Filtering by 'open threads on selected elements' returns only threads whose anchor intersects the selection.

### GAP6-17 Comments: share links with permission, scope, expiry and integrity limits

Share links extend the existing read-only sandbox links with a permission ('view'|'comment'), a scope (live document or a specific snapshot), an expiry (default 30 days, institution-configurable maximum), optional passcode, revocation and an access log; link recipients appear in presence as guests. Edit is never granted by link. For documents bound to a graded task, learners may share only snapshots and only after the deadline unless the task allows earlier sharing; institutions can disable external sharing entirely.

**Why:** Sharing is essential for portfolios and help-seeking but must not become a channel for copying graded work before the deadline.

**Acceptance:**
- A 'comment' link lets a guest create comments with a guest actor id and nothing else; a 'view' link allows no writes.
- Expired or revoked links return 410 and the access log records the attempt.
- Sharing a live task document before the deadline is blocked unless the task setting allows it; snapshot sharing after the deadline works.

### GAP6-18 Peer review: anonymized review activity on read-only submission snapshots

Instructors attach a peer-review activity to a design task: after the submission deadline each learner (or team) is assigned N (default 2) submissions from other teams using the task rubric or a checklist, with reviewer and reviewee pseudonymized (double-blind by default, single-blind configurable). Reviewers open a peer-review copy of the submission snapshot read-only in the workspace (they may run analysis and inspect results), add anchored comments, score each criterion and submit before the review deadline; reviewees see reviews labeled 'Reviewer 1..N' after the window closes.

**Why:** Reviewing others' designs against real-world criteria is a core professional skill and scales feedback in large sections while reusing the same rubric as AI and instructor grading.

**Acceptance:**
- The assignment never includes the reviewer's own team's submission and balances reviews per submission to within one.
- The peer-review copy strips author metadata (document title, member names, comment authors) and any edit attempt returns 403.
- Reviewee visibility is blocked until the review deadline; the instructor sees all reviews with real identities.

### GAP6-20 Staff access: open-learner-model semantics (snapshot vs live) and read-only inspection

Instructors and TAs open a learner's or team's document in 'snapshot' mode (any immutable version; read-only; default for grading; 'fork to my sandbox' creates a staff-owned document with forkedFrom) or 'live' mode (current working document; read-only observer shown in presence; members notified). In live mode staff may take the lock for help-mode edits when the task allows it; those ops carry actorRole and onBehalfOf, appear in version history with a staff badge, and are excluded from attribution. TAs are limited to their sections, and an op-log scrubber lets staff replay the design process to any seq.

**Why:** Grading needs immutability, tutoring needs liveness, and attribution integrity requires staff edits to be distinguishable from learner work.

**Acceptance:**
- Opening a snapshot never acquires the lock or appends ops; results shown are recomputed from the snapshot's canonical model.
- Live view shows 'Instructor X is viewing' to members; staff help-mode edits show a staff badge in version history and are absent from attribution totals.
- A TA assigned to section B receives 403 on section A documents; an instructor sees all sections.
- Scrubbing to seq N renders the model as of N and lists the comments whose asOfSeq <= N.

## Could (later)

### GAP6-11 Editing: documented staged path to real-time co-editing over the op log

The architecture records an ADR with three stages that the MVP op schema must not preclude: Stage 1 whole-document lock (GAP6-09); Stage 2 element-group locks keyed by (documentId, scope) in the same lock table; Stage 3 lock-free real-time co-editing with server-ordered ops and per-property last-writer-wins on the existing op log (Figma-style), per-user undo limited to one's own ops, and element-level presence. CRDT (for example Yjs) is reserved for offline-first merging and is not required for Stage 3. The MVP invariants that make this possible are element-granular, idempotent, invertible ops; client-generated ids; fractional order keys; baseSeq on every op; derived results never in the op log.

**Why:** Committing to a CRDT now complicates the engine and the solver integration, while an op log with stable ids already supports LWW co-editing if the invariants are kept from day one.

**Acceptance:**
- An ADR lists the stages, invariants, and measurable trigger criteria for moving to Stage 2/3 (for example lock-wait complaints above a threshold).
- A 'co-edit readiness' CI suite verifies the invariants on the MVP op schema: idempotency by clientOpId, invertibility of every op type, id-only addressing, no derived results in ops, order keys fractional.

### GAP6-15 Submission: per-member grade adjustments and optional peer evaluation

The AI/instructor grade is produced once per team submission and stored per member with an optional individual adjustment (multiplier or point delta with a required reason, visible to that member). An optional peer-evaluation step after submission or at milestones asks each member to rate teammates and themselves on configurable criteria (default five CATME-style dimensions) with comments; responses are staff-only, and the system suggests an adjustment factor the instructor can accept, edit or ignore.

**Why:** A team grade with no individual lever is the main instructor objection to team tasks; peer evaluation is the standard complement to op-log attribution.

**Acceptance:**
- Adjusting one member's grade changes neither the team grade record nor other members' grades; the gradebook shows team grade, adjustment and reason.
- Peer-evaluation responses are never visible to teammates; the suggested factor displays its formula and inputs.
- Missing peer evaluations are listed and the instructor can apply a default factor.

### GAP6-19 Peer review: calibration against instructor exemplars, reviewer accuracy and AI anchoring control

Before reviewing peers, reviewers complete 1-3 calibration reviews of instructor-scored exemplar submissions; scores outside a configured tolerance show the instructor's rationale and allow limited retries. Reviewer accuracy (agreement with instructor on calibration, with AI and peer consensus on real reviews) is tracked and shown to the instructor, the AI grader's result is hidden from reviewers until they submit and then shown side by side, and peer scores can be weighted into the grade (default 0%) while the review itself can be graded for completion and accuracy.

**Why:** Uncalibrated peer scores are noisy; calibration (as in Calibrated Peer Review and Moodle Workshop examples) materially improves reliability and turns reviewing into a learning activity.

**Acceptance:**
- A reviewer whose calibration deviation exceeds tolerance is blocked from peer reviews until a retry passes or the instructor waives.
- The instructor dashboard ranks reviewers by accuracy and flags reviews differing from the median by more than a configurable threshold.
- The AI grade is not readable by the reviewer's session until their review is submitted (API test).

## Non-functional targets

| id | title | target |
|---|---|---|
| GAP6-NFR-01 | Lock handoff and presence latency | Lock acquire/release and presence changes visible to all sessions on the document within 2 s p95; observers render the holder's ops within 1 s p95 on the same region. |
| GAP6-NFR-02 | Attribution computation | Per-member metrics for a 50,000-op document computed in under 5 s and cached per (documentId, seq); incremental update under 500 ms when a new submission seq is pinned. |
| GAP6-NFR-03 | Op log and snapshot retention | Full op logs and snapshots retained for the course duration plus 24 months (or institution policy); any compaction must preserve per-op actorId, actorRole, onBehalfOf, serverTs, gestureId and target elementIds, or precomputed attribution aggregates plus the referenced snapshots. |
| GAP6-NFR-04 | Anchor resolution performance | Resolving 1,000 comment anchors against the current head (including tombstone detection) in under 500 ms server-side. |
| GAP6-NFR-05 | Canonical hashing determinism | contentHash computed from a canonical serialization (sorted keys, normalized number formatting, derived results and comments excluded) so that identical models hash identically across browsers and server; verified by a cross-platform test fixture. |
| GAP6-NFR-06 | Team concurrency limits | A team document supports at least 8 concurrent sessions (1 editor plus observers and staff) with presence and streamed ops; team size limited to 8 by configuration. |
| GAP6-NFR-07 | Privacy and integrity of peer data | Peer-review pseudonyms are unlinkable by learners (no sequential ids, no timestamps revealing order); peer-evaluation responses and contribution data are education records: access is role-checked and logged, and account deletion pseudonymizes actorId rather than deleting ops. |
| GAP6-NFR-08 | Autosave durability | Unsent local ops survive tab crash and browser restart (IndexedDB) and are offered for replay on next open; no learner-reported data loss in acceptance testing of lock auto-release scenarios. |

## Domain notes (for architecture and UX)

TAXONOMIES. Team structure: Course -> TeamSet (name, sectionId?, formation: instructor|self, minSize, maxSize, formationDeadline, allowLeadManagement) -> Team (name, members[{userId, role: member|lead, joinedAt, leftAt?}], auditLog[]). Task.teamMode binds taskId -> teamSetId; submissionPermission: any|lead|cosign. Document.ownerType: user|team|course; Document kinds: sandbox, task-work, template, staff-fork, personal-version, peer-review-copy. Op fields (GAP6-02): documentId, seq, clientOpId, actorId, actorRole(learner|instructor|ta|system|ai), onBehalfOf?, sessionId, origin(user|undo|redo|import|restore|system|migration), baseSeq, lockEpoch, gestureId, undoOfSeq?, type(create|set|delete|batch), target{elementId, path}, before, after, clientTs, serverTs. Lock: {documentId, scope:'document' (Stage 2 adds 'group:<id>'), holderUserId, sessionId, epoch, acquiredAt, expiresAt}. Comment anchor types: element, elementSet, point (world position + optional nearest elementId), result (elementId + resultKind + loadCombinationId + station), text-range (justification block id + offsets), document. Snapshot reasons: manual, checkpoint, lock-release, submission, staff-fork, personal-version, peer-review-copy. Submission pin set: {snapshotIds[{snapshotId,label}], justificationVersionId, attachmentIds[], members[], attemptNo, previousAttemptSnapshotId?, cosigns[{userId, at}]}.

FORMULAS. Active editing time per member = sum over sessions of (lastOpTs - firstOpTs) where consecutive ops of the same sessionId are joined if gap < 5 min (configurable). Elements surviving = elements in submitted snapshot whose creatorActorId (from first create op) or lastEditorActorId (last non-undo set op) equals the member. Contribution share (indicative only) = member gestures / team gestures, shown next to surviving-element share. Peer-evaluation suggested factor (CATME-style) = clamp(mean rating received by member / mean rating received across team, 0.5, 1.1), with self-rating excluded by default; instructor may cap or override. Reviewer calibration deviation = mean absolute difference between reviewer and instructor criterion scores on exemplars, normalized to the rubric scale; default tolerance 15% of scale. contentHash = SHA-256 over RFC 8785 (JSON Canonicalization Scheme) serialization of the model with derived results, comments and presence removed and floats normalized by the canonical JSON rules.

REFERENCE DATA. ABET EAC Student Outcome 5: 'an ability to function effectively on a team whose members together provide leadership, create a collaborative and inclusive environment, establish goals, plan tasks, and meet objectives' (team formation, contribution evidence and peer evaluation map directly to it). Canvas group assignments: one submission per group, 'assign grades to each student individually' option, group sets reusable across assignments, self sign-up with size limits, automatic/manual anonymous peer reviews. Moodle: 'students submit in groups' and 'require all group members submit'; Workshop activity phases (setup, submission, assessment, grading evaluation, closed), assessment examples for calibration and 'comparison of assessments' strictness. Calibrated Peer Review (UCLA): reviewers must pass calibration essays before reviewing peers; reviewer competency index weights their reviews. CATME peer evaluation dimensions: contributing to the team's work, interacting with teammates, keeping the team on track, expecting quality, having relevant knowledge/skills/abilities. Figma multiplayer (2019 engineering post): server-authoritative ordering with per-property last-writer-wins over client-generated object ids, no CRDT library, per-user undo of own ops; this is the Stage 3 model. CRDT options if offline merging is ever required: Yjs (13.x, with y-websocket/Hocuspocus backends) or Automerge 2.x/automerge-repo; verify versions at architecture time. Fractional indexing: any standard library producing lexicographically ordered string keys. ULID or UUIDv7 for client-generated ids (time-ordered, collision-safe).

RECOMMENDATIONS FOR ARCHITECTURE. Store ops in a relational table with primary key (document_id, seq) and a unique index on (document_id, client_op_id); keep actor/session/gesture columns indexed for attribution queries; store comments in a separate table referencing document_id and anchor JSON with a GIN/JSONB index on elementIds. Keep the lock in the database row of the document (holder, epoch, expiresAt) with a heartbeat endpoint; presence over the same WebSocket channel that streams ops. Analysis results are a client/worker cache keyed by contentHash, never persisted in the op log; observers recompute locally from the streamed model (deterministic solver). Implement authorization as one pure function over (document ownership fields, caller role, team membership, share-link grant) and test it exhaustively. Build attribution as a pure function over an op array (easy golden tests) with a cache table keyed by (document_id, seq). Make the peer-review copy an explicit snapshot with metadata stripping so anonymization is a data transformation, not a UI filter.

RECOMMENDATIONS FOR UX. Workspace header shows ownership badge (Personal / Team <name>) and lock state ('You are editing' / '<name> is editing - Request edit'); presence avatars with guest and staff badges. Version timeline panel with author filter and 'restore' only when holding the lock. Comment sidebar shared across author review, AI findings, team and peer comments, filtered by author role, with outdated-anchor state and 'view as of' affordance. Team submission dialog shows pin set contents, members frozen at pin time, co-sign status and attempt count. Instructor grading view adds a Contribution tab (table, timeline, heatmap toggle, replay scrubber, CSV). Peer-review mode is a visually distinct read-only workspace with pseudonyms and a rubric side panel; AI grade revealed only after submit. Staff live-view banner: 'Viewing live - learners can see you; Take lock to help' with a confirmation that edits are recorded as staff edits.

PROPOSED MODULES (greenfield; no existing files): packages/model-schema (canonical model, element ids, order keys, canonicalization/hash); packages/op-protocol (op types, invertibility, idempotency, baseSeq/lockEpoch validation, co-edit readiness tests); services/collab (locks, presence, op streaming, comments and anchors, share links); services/teams (team sets, teams, membership, audit); services/submissions (pin sets, attempts, co-sign, snapshot lineage); services/attribution (op-log metrics, cache); services/peer-review (assignment, anonymized copies, calibration, accuracy); apps/web workspace (lock/presence UI, version timeline, comment sidebar, contribution tab, peer-review mode, staff live/snapshot modes).

## Risks

| risk | mitigation |
|---|---|
| The whole-document lock frustrates 4-5 person teams (members waiting to edit), driving them to copy models around outside the system and breaking attribution. | Fast handoff and request-edit notifications, live read-only observation with results, personal versions for parallel exploration, lock-wait telemetry as the explicit trigger for Stage 2/3 in the ADR. |
| Attribution gaming (op spam, trivial edits) or misreading counts as quality leads to unfair individual adjustments. | Count gestures not ops, surface surviving elements and justification authorship alongside activity, show the caveat and drill-down, require a reason on every adjustment, combine with peer evaluation. |
| Peer-review anonymization leaks identity through model metadata (document titles, element labels, comment authors, justification text). | Peer-review copies are dedicated snapshots (reason='peer-review-copy') with metadata stripped and comments excluded; warn learners that justification text should not contain names. |
| Features ship without the must-level schema fields (schema drift), forcing the migration this gap-fill exists to prevent. | The 'co-edit readiness' CI suite and JSON schema validation in the API reject documents, ops, comments and snapshots missing the fields from GAP6-01..05. |
| Op-log growth and storage cost for long capstone projects with many checkpoints. | Checkpoint snapshots enable truncated loads; compaction policy preserves attribution metadata or aggregates (GAP6-NFR-03); retention is institution-configurable. |
| Share links and personal forks become a channel for copying graded work between teams before deadlines. | Snapshot-only sharing after deadline for task documents, institution-level disable, access logs, and snapshot lineage (forkedFrom, contentHash) feeding the integrity/similarity checks in the grading domain. |

## Open questions

- Should the AI grader for team submissions consume process evidence (op-log attribution, comment threads) in addition to the pinned snapshot and justification, or only the snapshot?
- Do institutions allow cross-section teams and external (non-course) share links by default, and what maximum expiry should the institution policy allow?
- Is Stage 2 (element-group locks) worth building before Stage 3 (server-ordered LWW real-time co-editing), or should the roadmap jump straight to Stage 3 once lock-wait metrics justify it?
- Who may create share links for team documents: any member, lead only, or instructor only for graded tasks?
- In peer review of team submissions, is the reviewing unit the individual learner or the team, and should reviewers from the same section be excluded?
- Should the learner-facing contribution summary be on by default for ABET SO5 evidence, or off to avoid team friction?
- Does account deletion (right to erasure) require pseudonymizing actorId on ops and comments, and how long must attribution remain re-identifiable for grade appeals?
- Should peer evaluation be mandatory for team tasks (for accreditation evidence) or always optional per task?
