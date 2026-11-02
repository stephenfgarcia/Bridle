# Learner journey

_Surface design from the UI/UX workflow (designer agent), 2026-11-03. 12 screens, 7 flows, 34 components._

## Summary

Twelve learner-facing screens organised around the product spine (open task -> model -> self-check -> memo -> submit -> computed results -> AI-proposed, instructor-reviewed feedback -> resubmit). The design is evidence-first: every score, highlight and sentence on the feedback page traces to a GradeEvidence record, carries a provenance label (computed / AI-generated pending instructor review / confirmed by instructor / adjusted by name), and clicks through to the submitted model at the governing combination with a tabular and textual parity path (R16). The task brief renders the learner's own scenario instance as a given-data sheet, only the rubric criteria active for the archetype, and the effective assistance-and-disclosure profile as 'What help is available', so learners know what will be graded and what help exists before they start. The submission flow shows bundle contents and SHA-256 hashes plainly, previews the late penalty, captures the policy disclosures and honor pledge bound to the version, and returns a receipt with a pipeline stepper that tells learners their submission is safe even when feedback is delayed. Self-check uses the same evidence rows as the grader at the disclosure level the profile allows. Analyze, Check and Diagnose tasks get their own capture panels and feedback views (per-field diagnosis, findings-vs-key matrix with the unsafe-approval gate, seeded-error list with mechanism animation). Exam mode and the recording/AI-use notices are generated from the task profile and schema, never hand-written. Team projects are sketched as additive states (ownership badge, lock state, co-sign submit, one team grade with per-member adjustment). Boundaries: ux-workspace-3d owns the canvas, rail chrome and exam banner strip; ux-ia-navigation owns the navigation shell; this surface owns the deliverable panel contents, memo editor, checklist, submit, receipt, feedback, regrade, progress, notices and the task-page mirror of the dock. Note for the orchestrator: the relayed user request about the Build Monitor layout (uncompressed page, working/idle agents, progress board, current-phase activity) was already implemented in commit fdb22a2 before this workflow launched and required no action here.

## Principles

- The loop is the spine: every learner screen answers 'what do I do next' with one primary action (Open workspace, Check my design, Submit attempt N, Read feedback, Resubmit) and shows attempts remaining and the effective deadline near it.
- Evidence before narrative: scores, highlights and narrative issues are rendered from GradeEvidence records; a number that is not in an evidence record never appears, and every evidence row can be shown in the 3D model at its governing combination.
- Label provenance everywhere: each criterion and each narrative block states whether it was computed, AI-proposed, confirmed by a named instructor, or adjusted (with the reason); formative results carry 'AI-provisional' until reviewed (R11).
- No surprises at submit: bundle contents, SHA-256 hashes, pin set, late-penalty preview, collaboration and AI-use policy, disclosure fields and the pledge are all visible on one dialog before the Submit button is enabled.
- Self-check is the grader: the pre-submission check uses the same checks artifact and evidence schema as grading, shows its artifact versions, and discloses exactly what the task's assistance profile allows (levels 0-4), never the key.
- Spatial plus tabular parity (R16): every place that highlights members in 3D also offers a results table and a textual summary with the same evidence ids; the deliverable panels bind entities by list and type-ahead, not only by canvas picking.
- Profile-driven disclosure: hints, self-check, overlays, reveal timing, exam restrictions and policy text are rendered from the task's effective profile and schema so the UI can never disagree with what the server enforces.
- Transparency instead of surveillance: 'What Bridle records in this task' is linked from every task page and the memo editor; similarity, integrity signals and the injection screen are never shown to learners, and all held-grade messages are identical regardless of reason.
- Resume anywhere, lose nothing: drafts, memo text, deliverable entries and lesson steps autosave (2 s local, 30 s server) and Resume returns to the exact step; every failure message states that the draft or submission is safe and what to do.
- Archetype-aware, not one-size: Design/Optimize, Analyze, Check and Diagnose each get the deliverable panel, self-check items and feedback view the gap-fill specifies; inactive rubric categories are absent, not zero.
- Units are explicit: the task's working unit system is primary, SI or US secondary on demand, every value carries a unit, comparisons are done in SI, and clause references are code + edition + clause + paraphrased title.
- Leave room for v1.x without redesign: appeal escalation, integrity case learner view, team co-editing stages, peer review and the mastery heatmap are additive states on these screens, not new screens.

## Screen: Learner home: what is due and where I stand

**Roles:** Learner (undergraduate, graduate, practitioner); staff only through preview-as-learner or view-as-learner with a banner · **Route:** `/home`

Answer 'what is due, what can I resume, what has been graded' in one glance and return the learner to the exact point in the loop they left.

```
+------------------------------------------------------------------------------------------+
| Bridle   [Home]  Courses  Progress      (search, Cmd-K)          Inbox (3)   Jordan S v   |
+------------------------------------------------------------------------------------------+
| Good morning, Jordan.                                    Times shown in America/Chicago CT|
|                                                                                          |
| RESUME                                                                                   |
| +--------------------------------------------------------------------------------------+ |
| | T4 Portal frame under wind  . CE 331 Steel Design  . draft saved 12 min ago           | |
| | Last step: Deliverables > Memo (3 of 8 sections)            [ Resume in workspace ]   | |
| +--------------------------------------------------------------------------------------+ |
|                                                                                          |
| DUE IN THE NEXT 7 DAYS                                     GRADES TO READ (2)            |
| +---------------------------------------------------+  +-------------------------------+ |
| | Thu Nov 6, 11:59 PM CT  T3 Beam LTB check          |  | T2 Continuous beam   82 / 100 | |
| |   [In progress]  Design . 2 attempts left          |  |   Confirmed by Dr. Alvarez    | |
| |   [ Open task ]                                     |  |   [ Read feedback ]           | |
| | Sat Nov 8, 11:59 PM CT  Quiz: Load combinations    |  | T1 Cantilever   85 / 100      | |
| |   [Not started]  15 min                            |  |   AI-provisional (formative)  | |
| | Mon Nov 10 -> Nov 12 (extension)  T4 Portal frame  |  |   [ Read feedback ]           | |
| |   [In progress]  attempt 1 of 3 used               |  +-------------------------------+ |
| | OVERDUE  Lesson 2.3 Supports and releases          |                                   |
| |   [Not started]  ungraded; counts for Module 2     |  OUTCOME PROGRESS                 |
| +---------------------------------------------------+  | L1 Analysis fundamentals ####- | |
|                                                        | L2 Code-based design     ##--- | |
| MY COURSES                                             | L3 Design optimization   ----- | |
| +------------------------------+ +-------------------+ | L4 Engineering judgment  #---- | |
| | CE 331 Steel Design     62%  | | Steel refresh 20% | |   [ See progress ]              | |
| | Next: T3 Beam LTB check      | | self-paced        | +---------------------------------+ |
| | 1 under review . 2 to read   | | Next: Lesson 4    |                                   |
| +------------------------------+ +-------------------+                                   |
+------------------------------------------------------------------------------------------+
```

**Regions:**
- Global navigation and inbox (owned by ux-ia-navigation; shown for placement only)
- Header line with greeting and an explicit timezone label
- Resume card: the single most recent draft with task, course, last step and one primary action
- Due in the next 7 days: effective due dates (cohort offset and per-learner extension applied), status chip, archetype, attempts, overdue group pinned at the bottom in a distinct style
- Grades to read: released grades with provenance label and score; formative AI-provisional results listed with that label
- Outcome progress mini-bars for L1-L4 with a link to the Progress screen
- My courses: progress percent, next activity, counts of items under review and feedback to read

**Key data:**
- Task status chip (Not started / In progress / Submitted / Under review / Graded / Resubmission requested / Closed / Held)
- Effective due = extension ?? cohort override ?? activity due + cohort offset, shown in the learner's timezone with the abbreviation
- Attempts used of max; archetype; estimated time
- Draft autosave time and last deliverable step for Resume
- Released grade total, provenance (confirmed by name / AI-provisional), unread flag
- Mastery per level from the LOM-02 rule; course completion percent

**States:**
- Loading: skeleton rows for Resume, Due, Grades (no layout shift)
- No enrollments: 'You are not enrolled in a course yet. Enter a join code or open the sandbox.' with both actions
- Nothing due: 'Nothing is due in the next 7 days.' and the next item beyond 7 days
- Overdue items flagged and grouped; ungraded overdue items say why they matter (completion rule)
- Grade under review: row reads 'Under review by your instructor' with the course release target (default 72 h)
- Term ended / tenant read-only (BIL-04): banner 'This course is read-only. Grades and feedback remain available.'
- Data error: last cached state shown with a 'Could not refresh' notice and Retry

**Interactions:**
- Resume opens the workspace at the last autosaved model and deliverable step (or the tabular editor if WebGL2 is unavailable)
- Clicking a due row opens the task page; clicking a grade row opens the feedback page
- Due list sorted by effective due; overdue first within its group; hover shows offering timezone when it differs from the learner's
- Outcome bars link to Progress with the level pre-expanded
- Inbox badge counts grade.released, regrade.decided, extension.granted and announcement events

**Keyboard and accessibility:**
- Landmarks: banner, main, complementary (grades and outcomes), nav; h1 'Home', h2 per region
- Status chips render text, not color alone; screen-reader text 'Status: in progress, 2 attempts left'
- Countdowns are static text ('due in 2 days'), never a live-updating timer; dates are absolute beyond 24 h
- Tab order: Resume action, due list rows (each a single link with full text), grades, courses; Enter opens
- Meets WCAG 2.2 AA: 24 x 24 targets, focus never obscured by the sticky nav

**Requirements:**
- PRD PER-01
- LMS PRG-02
- LMS NTF-01
- LMS SCH-01
- PRD LOM-02
- ADR R11
- ADR R15
- PRD BIL-04
- LMS A11Y-01

## Screen: Task page (brief): scenario, given data, constraints, rubric, help available

**Roles:** Learner; instructor, TA and author via preview-as-learner (persistent banner, no records written) · **Route:** `/courses/:offeringId/tasks/:taskId`

Give the learner everything they need to decide how to attack the task before opening the workspace: their own scenario instance as a given-data sheet, constraints, deliverables, how it is graded, what help is available, and the policies in force.

```
+------------------------------------------------------------------------------------------------+
| < CE 331 . Module 4 Lateral loads                                       [In progress] draft v2   |
| T4  Portal frame under wind      Design . ASCE 7-22 + AISC 360-22 (US pack 1.0) . US customary   |
| Due Mon Nov 10, 11:59 PM CT (your extension: Nov 12) . Attempts 1 of 3 used . about 90 min      |
| Individual work . AI tools: allowed with disclosure . Coach mode . Randomized per learner         |
|                                                              [ Open workspace ]  [ Resume draft ]|
+----------------------------------------------+-------------------------------------------------+
| SCENARIO                                     | WHAT YOU WILL SUBMIT             checklist 1 / 4  |
| A single-story steel portal frame for a      |  [x] Model (spans and supports locked)           |
| warehouse in Amarillo, TX. The owner wants   |  [ ] Memo: 8 sections, 400-1,200 words (3 of 8)  |
| ...                                          |  [ ] Snapshot: moment diagram at governing combo |
|                                              |  [ ] Honor pledge and AI-use disclosure (at      |
| GIVEN DATA  (your variant; seed shown on     |      submit)                                     |
|   your receipt)                              |  Items marked hard-required block submission.    |
| +------------------------------------------+ |-------------------------------------------------+
| | Risk category    II                      | | HOW THIS IS GRADED   Rubric v3 . 100 pts . pass 60|
| | Wind             V 115 mph . Exposure C  | |  Strength and code compliance   25  computed     |
| | Snow             pg 20 psf               | |  Serviceability                 10  computed     |
| | Seismic          SDC B (E not required)  | |  Stability and second-order      5  computed     |
| | Occupancy        Storage . L 125 psf     | |  Loads and combinations         15  computed     |
| | Roof SDL         15 psf                  | |  Economy vs benchmark           10  computed     |
| | Geometry         span 60 ft . eave 20 ft | |  Code minimums                   5  computed     |
| | Required combos  ASCE 7-22 2.3.1 LRFD    | |  Constructability                5  AI-judged,   |
| |                  incl. 0.9D + 1.0W       | |                                     reviewed     |
| | Limits           roof L/180 . drift h/400| |  Engineering judgment (memo)    15  AI-judged,   |
| | Hidden           Kz table: derive it     | |                                     reviewed     |
| +------------------------------------------+ |  Gates: mechanism caps total at 50%; DC > 1.00 on|
|  [ Open full given-data sheet ]  [ PDF ]     |  a primary member caps at 50%                    |
|                                              |  [ Show level descriptors v ]                    |
| CONSTRAINTS                                  |-------------------------------------------------+
|  hard  Sections: W-shapes, depth <= 24 in    | WHAT HELP IS AVAILABLE       (coach preset)      |
|  hard  Geometry: spans and supports locked   |  Live results: full . Code-check overlays: on    |
|  soft  Cost index within budget (benchmark   |  Check my design: unlimited, per-item pass/fail  |
|        hidden until after submission)        |  Hints: 3 tiers, no point cost                   |
|  info  Max 40 members                        |  Reference solution: after the due date          |
|                                              |-------------------------------------------------+
| OUTCOMES  L2.1  L2.2  L2.4  L4.3             | RESOURCES                                        |
|                                              |  Lesson 4.2 Wind on portal frames . Explain:     |
| MY SUBMISSIONS (1)                           |  AISC 360-22 F2 . Hand-calc template (PDF)       |
|  v1  Nov 3, 9:12 PM CT  Under review         |-------------------------------------------------+
|                                              | Q&A (2 threads)  .  What Bridle records here     |
|                                              | Report a problem                                 |
+----------------------------------------------+-------------------------------------------------+
```

**Regions:**
- Header: breadcrumb, status chip, title, archetype, code pack and edition, unit system, effective due with extension, attempts, estimated time, policy badges, primary actions
- Left column: scenario narrative, Given-data sheet rendered from the resolved scenario instance (hidden values absent, marked 'derive it'), constraints with enforcement mode, outcome tags, submission history
- Right column: deliverables checklist (live, same validators as submit), rubric summary of active criteria with weights, kind and gates, 'What help is available' from the effective assistance profile, resources, Q&A, recording notice, report a problem

**Key data:**
- Task version id, rubric version, code pack id and edition, working unit system (locked or not)
- Scenario instance values per parameter with units and source parameter; which values are hidden
- Constraint list with mode hard / soft / info and the linked criterion for soft constraints
- Active rubric criteria only (per archetype activation matrix), weights summing to 100, kind computed / AI-judged / instructor, gate list, pass mark
- Effective assistance profile fields: live_results, code_check_overlays, self_check mode and cap, disclosure level, hints, fill_from_results, benchmark_visible, reveal timing
- Collaboration policy, AI-use policy, exam flag, randomized flag
- Deliverable list with hard/soft requirement and current completeness
- Submission versions with time, lateness and status

**States:**
- Not started: primary action 'Start task' creates the scenario instance and starter model; given-data sheet shows after start (seeded values)
- In progress: 'Resume draft' primary; checklist live
- Submitted / Under review: primary action 'View submission'; workspace opens read-only copy plus editable working copy
- Graded: 'Read feedback' primary; 'Resubmit' shown with attempts left and window close date, disabled with reason when exhausted or closed
- Resubmission requested: banner with instructor note and new window
- Locked by prerequisite: body replaced by 'Complete Module 3 to unlock' with the unmet rule named (server-enforced)
- Closed past effective close: read-only; 'Closed Nov 12, 11:59 PM CT. Ask your instructor for an extension.'
- Exam task: primary action 'Start exam' opens the pre-start screen; given-data sheet and resources withheld until start; discussion hidden during the window
- Archetype variants: Analyze lists N report fields and whether fill-from-results is allowed; Check states findings scope ('governing limit state for every member'), that the model is locked and code-check overlays are off; Diagnose states '2 seeded errors' (or a range) and scope-locked editing
- Not randomized: label 'Same scenario for everyone' replaces 'Randomized per learner'
- Preview-as-learner: top banner with seed selector; no records written
- WebGL2 unavailable: 'Open workspace' becomes 'Open tabular editor' and the system-check link appears

**Interactions:**
- Open workspace / Resume draft opens the workspace with the task preset (palette, camera, overlays)
- Expand level descriptors reveals learner-visible descriptors per criterion; grader-only notes never render
- Open full given-data sheet shows every value with secondary units; PDF export carries the educational-use notice and excludes hidden values
- Clicking a clause in Resources opens the generated explanation page in the help panel
- Q&A opens the task thread; private-to-instructor questions available
- Report a problem opens the consented diagnostic bundle dialog
- What Bridle records here opens the notices screen

**Keyboard and accessibility:**
- Above the fold at 1366 x 768: title, due, attempts, policy line, scenario summary, checklist and rubric summary
- Given-data sheet is a real table with row headers and unit cells; hidden rows are omitted, not blanked
- All disclosure toggles are buttons with aria-expanded; the checklist is a list with per-item status text
- Primary action is the first focusable control after the header; Skip-to-rubric link provided
- Policy badges have full text equivalents ('Collaboration policy: individual work')

**Requirements:**
- LMS CRS-03
- PRD PRD-01
- GAP3-DLV-02
- GAP3-DLV-03
- GAP3-DLV-17
- GAP3-DLV-18
- GAP5-POL-01
- GAP5-EVID-01
- GAP5-RAND-01
- LMS DAT-04
- AUT TB-02
- AUT TB-05
- AUT TB-08
- STR SITE-01
- STR CODE-09
- LMS DSC-01
- GAP4-HELP-02
- GAP4-HELP-03
- ADR R16

## Screen: Guided lesson with auto-verified checkpoints

**Roles:** Learner; author preview · **Route:** `/courses/:offeringId/lessons/:lessonId (workspace with lesson overlay)`

Teach a workspace skill step by step inside the real workspace, verifying model state (not clicks) at each checkpoint, with hints and a 'show me' escape hatch, resumable per step.

```
+------------------------------------------------------------------------------------------------+
| < Lesson 2.3 Supports and releases     Step 4 of 9    [x][x][x][>][ ][ ][ ][ ][ ]   Exit lesson   |
+------------------------+-----------------------------------------------+-----------------------+
| STEPS                  |                                               | STEP 4                |
| 1 Place nodes     done |        CANVAS (owned by ux-workspace-3d)      | Add a pinned support  |
| 2 Draw the beam   done |                                               | at node A.            |
| 3 Assign section  done |        A o================o B                 |                       |
| 4 Pinned support  now  |       (node A highlighted, pulsing outline;   | A pin restrains Tx and|
| 5 Roller at B          |        static when reduced motion is on)      | Tz and leaves Ry free.|
| 6 Apply 10 kN/m        |                                               | [ equation block ]    |
| 7 Run analysis         |                                               |                       |
| 8 Read deflection      |                                               | CHECKPOINT            |
| 9 Read max moment      |                                               |  o Support at A is    |
|   (optional)           |                                               |    pinned   not yet   |
|                        |                                               |                       |
| Progress saved 1 min   +-----------------------------------------------+ Stuck?                |
| ago. Resume brings you | [ Tabular editor ] [ Results table ] [ Diag ] | [ Hint 1 of 2 ]       |
| back to this step.     |                                               | [ Show me ] marks the |
|                        |                                               |   step as assisted    |
|                        |                                               | [ Skip ] (optional    |
|                        |                                               |   steps only)         |
|                        |                                               |      [ Next step > ]  |
+------------------------+-----------------------------------------------+-----------------------+
```

**Regions:**
- Lesson header: title, step counter, step dots with done/current/optional states, Exit lesson
- Left rail: ordered step list with status and the autosave/resume note
- Center: the workspace canvas with the step's highlight target, plus the tabular editor, results table and diagnostics tabs (parity path)
- Right panel: step instruction (rich text with LaTeX), checkpoint condition list with met/not-met text, hint ladder, Show me, Skip (optional steps), Next

**Key data:**
- Step index, required/optional flag, checkpoint predicate results per sub-condition (label or coordinate match, support type, member section, analysis ran, result metric in range)
- Hint tier unlocked and remaining; whether Show me was used (assisted flag)
- Working model autosave time; lesson completion status (client pass, server validated)

**States:**
- Checkpoint not met: condition rows show which sub-condition fails ('support at A: found, restraint is roller') within 300 ms of an edit
- Met: green check, Next enabled; optional auto-advance after 1.5 s (off under reduced motion)
- Hints: tier 1 after 2 failed evaluations or on request, tier 2 after 4; each shows its tier and whether it costs points
- Show me applied: step marked 'assisted', model updated as one undo step
- Skip: optional steps only; required steps cannot be skipped unless the author allows skip-ahead
- Resume: returns to the exact step with the working model intact
- Completing: last required checkpoint passes -> 'Verifying with the server...' -> 'Lesson complete' (completion event); if server re-validation fails, the failing sub-condition is named and the learner can fix and retry
- Canvas unavailable: the tabular editor is the default center tab and every checkpoint is achievable from it
- First-run onboarding (simply supported beam) uses this same screen with a 10-minute target and a skippable flag

**Interactions:**
- Perform the action in canvas, tabular editor or command palette; evaluation is debounced on model change
- Click a step in the rail to review a completed step (read-only instruction) or jump ahead if allowed
- Hint reveals in place; Show me asks for confirmation ('This will add the support for you and mark the step as assisted')
- Exit lesson keeps the working model and progress; re-entry resumes

**Keyboard and accessibility:**
- Step list is a listbox with arrow navigation; Enter focuses the right panel
- Checkpoint results announced politely ('Checkpoint met: support at A is pinned')
- Highlight target also announced ('Node A selected') and listed in the entity list with type-ahead
- Every step completable by keyboard through the tabular editor and command palette (A11Y-01 test script)
- Reduced motion: no pulsing outlines or auto-advance; static highlight

**Requirements:**
- LMS CRS-04
- AUT GL-01
- AUT GL-02
- PRD PER-12
- AUT TB-12
- LMS PRG-01
- WS A11Y-01
- ADR R16

## Screen: Deliverables dock and memo editor (workspace right rail; mirrored on the task page)

**Roles:** Learner · **Route:** `/courses/:offeringId/tasks/:taskId/workspace#deliverables and /courses/:offeringId/tasks/:taskId/deliverables (non-canvas mirror)`

Capture every graded deliverable next to the model: the structured memo, required snapshots, and the archetype-specific panels (Report values, Findings, Found errors), with a live checklist that uses the same validators as submit.

```
+-----------------------------------------------------------+------------------------------------+
|  CANVAS + TOOLBAR (ux-workspace-3d)                        | DELIVERABLES          Checklist 2/5 |
|                                                           | [Memo] [Snapshots] [Report values]  |
|                                                           | [Findings] [Found errors]           |
|                                                           |  (tabs shown only for the archetype)|
|                                                           |------------------------------------|
|                                                           | MEMO   412 of 400-1,200 words       |
|                                                           | AI tools: allowed with disclosure.  |
|                                                           | Paste events are logged, not scored.|
|                                                           | Graded on consistency with your own |
|                                                           | model. [ What is recorded ]         |
|                                                           |------------------------------------|
|                                                           | 1 System and load path  88 / 60-200 |
|                                                           |   Describe the gravity and lateral  |
|                                                           |   load path from roof to supports.  |
|                                                           |   +------------------------------+ |
|                                                           |   | B  I  list  $math  table  fig | |
|                                                           |   | The rafters span 60 ft to ... | |
|                                                           |   +------------------------------+ |
|                                                           |   Cover: moment frame, base fixity  |
|                                                           | 2 Assumptions and scenario  0 /     |
|                                                           |   60-200   required                 |
|                                                           | 3 Loads and governing combinations  |
|                                                           | 4 Governing members and what        |
|                                                           |   controlled                        |
|                                                           | 5 Section selection and             |
|                                                           |   serviceability                    |
|                                                           | 6 Constructability                  |
|                                                           | 7 Verification or hand check        |
|                                                           | 8 Limitations and what I would      |
|                                                           |   change                            |
|                                                           |------------------------------------|
|                                                           | Saved locally 2 s ago . server 14 s |
|                                                           | [ Plain-text mode ]                 |
|                                                           | [ Check my design ] [ Submit ... ]  |
+-----------------------------------------------------------+------------------------------------+
--- Snapshots tab ---
| REQUIRED SNAPSHOTS 0 / 1                                                                        |
|  Moment diagram at the governing combination   expected: overlay M3, combo 1.2D+1.0W+L+0.5S      |
|    status: not captured     [ Capture now ] sets overlay and combo, then saves PNG + sidecar       |
|    (after capture) captured at 1.2D+1.6L -> UNMET: expected 1.2D+1.0W+L+0.5S  [ Recapture ]       |
--- Report values tab (Analyze) ---
| R_A vertical reaction  convention: upward positive . case D+L                                    |
|   [ 18.2 ] [ kip v ]   bound to node A  [ Find in model ]   [ Fill from my results ] (if allowed) |
|   warning: larger than total applied load (24.0 kip)? check sign and case                        |
| M_max in B1  convention: sagging positive . combo 1.2D+1.6L   [ 96.4 ] [ kip-ft v ]              |
|   error: kN-m entered into a force field is not accepted (dimension mismatch)                     |
| N in diagonal D3  magnitude + sense   [ 41.2 ] [ kN v ]  ( ) T  (x) C                            |
--- Findings tab (Check) ---
| Scope: governing limit state for every member . coverage 11 of 14 . B2: deflection missing       |
| Member | Limit state      | Verdict | Demand      | Capacity    | Ratio | Combo        | Clause  |
| B2     | F-LTB            | fail    | 412 kip-ft  | 388 kip-ft  | 1.06  | 1.2D+1.0W+.. | F2.2    |
|        | reason (<= 60 words): Lb = 20 ft exceeds Lr; LTB governs ...                             |
| C1     | C-FB             | pass    | 118 kip     | 142 kip     | 0.83  | ...          | E3      |
|   inconsistency: verdict pass but demand > capacity on row B4  [ fix ]                            |
| [ + Add finding ]  [ Import CSV ]  [ Sort by member ]                                            |
--- Found errors tab (Diagnose) ---
| Seeded errors to find: 2 . Scope-locked: only supports, loads and sections are editable           |
| 1  Load on B2  . category: loads . 'UDL is 12x too large (kip/ft entered as kip/in)' . FIXED      |
| [ + Add found error ]                                                                             |
| CHANGES SINCE START (3)  . 1 unreported: node N4 moved 0.3 ft  [ Revert ] [ Add as finding ]      |
```

**Regions:**
- Dock header with checklist progress and archetype-specific tabs
- Memo: policy and recording notice, section cards with prompt, concept hints, live per-section and total word counts against bounds, rich text with LaTeX, tables and figures from snapshots
- Snapshots: required snapshot cards with expected overlay and combination, capture, met/unmet
- Report values (Analyze): unit-aware fields with convention, entity binding, plausibility warnings
- Findings (Check): editable table with member picker, limit-state catalog, verdict, demand, capacity, auto ratio, combo, clause picker, reason; coverage and inconsistency banners
- Found errors (Diagnose): entries with entity, category, description and derived fixed status; Changes since start with revert and add-as-finding
- Footer: autosave status, plain-text mode, Check my design, Submit

**Key data:**
- Memo config (section ids, prompts, bounds), total and per-section word counts computed with the shared tokenizer, paste events (count only shown to learner)
- Snapshot requirement {title, overlay, caseOrComboId, viewPreset}; captured sidecar overlay and combo; met/unmet with expected vs actual labels
- Answer fields {label, prompt, dimension, convention, compare mode, tolerance hidden}, entered value and unit, SI conversion for validation only, entity resolution status
- Findings entries per deliverable schema; required scope mode and coverage; clause equivalence sets from the clause library
- Found-error entries, derived status, diff against the injected starter, unreported-change count
- Checklist derived from the same validators the server applies

**States:**
- Memo empty section (required) vs optional; soft bound warning (amber), hard bound block (red) with counts
- Autosave: 'Saved locally 2 s ago'; 'Server save pending' when offline; crash recovery restores the last 2 s
- Plain-text mode: one textarea per section with the same word counts (screen-reader path)
- Exam profile: paste allowed but a notice says it is logged; figures from snapshots still allowed; no export
- Report values: dimension mismatch (blocking), implausible magnitude (warning only), entity not found in your model, fill-from-results hidden when live results are off
- Findings: coverage incomplete, entry inconsistent (verdict vs numbers, clause not applicable), over 200 entries
- Found errors: entity no longer exists, more than 10 entries, unreported changes present (warning before submit; collateral penalties explained for open mode)
- Snapshot captured at the wrong combination: UNMET with both labels
- Team document: tabs editable only by the lock holder; observers see read-only values with the holder's name

**Interactions:**
- Focusing an answer field or findings row highlights the bound entity in 3D and switches the active case or combination; Find in model frames it
- Member picker offers click-in-3D or a searchable list by label; limit-state list filters by code pack and section family
- Capture now applies the required overlay and combination, captures the PNG and sidecar, and marks the requirement met
- Insert figure from a snapshot requires alt text and a caption
- Add found error pre-fills the entity when the learner just edited an unlisted entity (suggestion toast)
- Check my design opens the self-check panel; Submit opens the submit dialog

**Keyboard and accessibility:**
- Every panel is operable without the canvas: list-based entity references with type-ahead, table editing with arrow keys, Enter to edit, Esc to cancel
- Unit-aware inputs expose the accepted dimension and convention in the accessible description; errors are associated with aria-describedby
- Memo editor meets WCAG 2.2 AA; plain-text mode guarantees screen-reader completion; LaTeX has source view
- Word counts update in a polite live region at most every 2 s
- Focus returns to the row after Find in model

**Requirements:**
- GAP3-DLV-02
- GAP3-DLV-05
- GAP3-DLV-08
- GAP3-DLV-12
- GAP3-DLV-14
- GAP3-DLV-19
- GAP3-DLV-20
- GAP5-AI-01
- WS CAP-01
- LMS SUB-02
- AIG LLM-03
- NF-GAP3-03
- NF-GAP3-04
- NF-GAP3-08
- ADR R16

## Screen: Check my design (pre-submission self-check)

**Roles:** Learner · **Route:** `/courses/:offeringId/tasks/:taskId/workspace#self-check (panel over the dock; also reachable from the task page mirror)`

Show the learner exactly what the grader's deterministic stage will find, at the disclosure level the task allows, so trivial failures are fixed before submission without leaking keys.

```
+------------------------------------------------------------------------------------+
| CHECK MY DESIGN     Run 3 (unlimited) . 0.8 s . checks library 1.4 . engine 2.3.1   |
| Same computed checks as the grader. Does not score judgment criteria or the memo.   |
|------------------------------------------------------------------------------------|
| 2 failing . 3 warnings . 14 passing               [ All ] [ Fail ] [ Warn ] [ Pass ] |
|------------------------------------------------------------------------------------|
| FAIL  Strength . B3 flexure   Mu 412 kip-ft > phiMn 388 kip-ft   DC 1.06            |
|       under 1.2D + 1.0W + L + 0.5S . AISC 360-22 F2.2 lateral-torsional buckling    |
|       Lb 20 ft . Cb 1.14              [ Show in model ]  [ Explain F2.2 ]           |
| FAIL  Loads . Combination 0.9D + 1.0W is not defined                                 |
|       Required for uplift on exposed frames . ASCE 7-22 2.3.1                       |
|       [ Add the required combinations ]                                             |
| WARN  Serviceability . Story 1 drift h/380 vs limit h/400 under 0.42W (10-year)     |
|       [ Show in model ]                                                             |
| WARN  Stability . B2 = 1.12: second-order effects amplified (not negligible)        |
| WARN  Economy . 6 of 14 members below DC 0.30 and not governed by another criterion |
| PASS  Model validity . no mechanism . all members connected . equilibrium 0.02%     |
| PASS  Constraints . sections in allow-list . 22 of 40 members . locked spans intact |
| PASS  ... 12 more                                                                   |
|------------------------------------------------------------------------------------|
| DELIVERABLES  memo 3 of 8 sections . snapshot not captured . pledge at submit       |
| Benchmark and the reference solution stay hidden until after submission.           |
|                                           [ Back to model ]   [ Continue to submit ]|
+------------------------------------------------------------------------------------+
--- disclosure level 1 (summative preset, Analyze task) ---
| 5 of 5 fields complete . all dimensions valid . 1 plausibility warning (R_A) . model valid |
| Counts of correct values are not shown for this task.                                       |
--- disclosure level 2 ---
| 3 of 5 fields within tolerance (which ones is not shown for this task)                       |
--- capped ---
| Check my design: 1 of 3 runs left for this task.                                             |
```

**Regions:**
- Header: run count and cap, duration, artifact versions, scope statement
- Summary counts and status filter
- Evidence rows grouped by status then check type, each with metric, limit, governing combination, clause chip and actions
- Deliverable completeness line and the hidden-benchmark statement
- Footer actions

**Key data:**
- GradeEvidence rows (check_type, subject, status, severity, metric with unit, limit, margin, governing combination, code_ref, values) from the client checks artifact
- Disclosure level 0-4 and the archetype matrix: completeness, counts, per-item pass/fail, hint tiers
- Self-check mode unlimited / capped N / off and remaining count (server-enforced)
- Artifact versions (engine, checks library) so parity with the grade can be verified

**States:**
- Running: progress with cancel; last results dimmed
- Stale: 'Model changed since this run' badge; Re-run
- Level 0 (exam): panel absent; the tool shows an OFF badge and is never requested
- Level 1: completeness and validity only; Level 2: counts; Level 3: per-item; Level 4: per-item plus hint tier (category > entity > clause)
- Capped: remaining runs shown; at 0 the button is disabled with 'No runs left for this task'
- Solver failure (mechanism): the mechanism row offers 'Explain this instability' which animates the null-space mode (static under reduced motion)
- Archetype variants: Analyze (field completeness, dimension validity, plausibility, model validity, equilibrium), Check (scope coverage, entry consistency, clause applicability, model unchanged), Diagnose (fixed-model validity, entry validity, unreported changes, count of correctly found errors at level 2+), Design/Optimize (full deterministic set, benchmark hidden)
- Self-check artifact differs from the pinned grading artifact (engine upgraded mid-offering): notice 'Grading uses checks 1.3; tolerances apply' (rare, operator-driven)

**Interactions:**
- Show in model frames the subject, switches the overlay and the governing combination, opens a probe card
- Explain opens the generated check or clause page with the learner's own values beside it
- Add the required combinations applies the pack-generated set as one undo step (coach mode only)
- Filters persist per task; Continue to submit opens the submit dialog with this run referenced

**Keyboard and accessibility:**
- Rows are a list with arrow navigation; each row's accessible name includes status, subject, metric and clause
- Status conveyed by text and icon, never color alone; over-1.0 uses the hatched style from the design system
- Actions are buttons reachable by Tab inside the row; Show in model returns focus to the row
- Live region announces run completion with the counts

**Requirements:**
- PRD PER-02
- GAP3-DLV-16
- GAP3-DLV-17
- ADR R9
- STR GRD-04
- STR ERR-01
- STR ERR-03
- STR ERR-07
- GAP4-HELP-02
- NF-GAP3-07
- AIG CHK-05

## Screen: Submit dialog: bundle, hashes, timing, policy and pledge

**Roles:** Learner; team member (co-sign variant) · **Route:** `/courses/:offeringId/tasks/:taskId/submit (modal over the workspace or task page)`

Freeze and show exactly what will be graded, the hashes that identify it, the late penalty, and the policy disclosures and pledge, so nothing about the submission is a surprise later.

```
+------------------------------------------------------------------------------------+
| SUBMIT   T4 Portal frame under wind          Attempt 2 of 3 . this will be v2        |
|------------------------------------------------------------------------------------|
| WHAT WILL BE SUBMITTED   (frozen now; later edits in the workspace do not change it) |
|  Model      22 members, 16 nodes, 7 load cases, 9 combinations   SHA-256 3f9a1c2e.. |
|  Memo       8 sections, 1,014 words                              SHA-256 9b02d7e1.. |
|  Snapshot   Moment diagram at 1.2D+1.0W+L+0.5S  (met)            SHA-256 c41e88a0.. |
|  Results summary (display only; the server re-analyzes)          resultHash 77ad.. |
|  Pins       task v3 . rubric v3 . engine 2.3.1 . checks 1.4 . clause lib 1.2 .      |
|             scenario seed 8f21                                                       |
|  [ Copy all hashes ]   You can compare these with your receipt at any time.         |
|------------------------------------------------------------------------------------|
| TIMING   Due Nov 12, 11:59 PM CT (your extension). Submitting now: ON TIME.        |
|          Late policy: 5% per day after a 15-minute grace, max 30%. Preview: 0%.    |
| LAST CHECK  3 min ago: 2 failing, 3 warnings  [ View ]   (not required to submit)   |
|------------------------------------------------------------------------------------|
| POLICY AND PLEDGE   Individual work . AI tools: allowed with disclosure . Coach     |
|  AI-use disclosure (required)                                                       |
|  [ I used ChatGPT to proofread sections 1 and 8. No design decisions came from it.] |
|  Collaborators  [ none ]                                                            |
|  [ ] I affirm this submission is my own work under the policy above. Pledge v4 is  |
|      stored with this version.                       [ Read the full pledge ]      |
|------------------------------------------------------------------------------------|
| The server re-analyzes your model and grades it against rubric v3. Judgment         |
| criteria are proposed by AI and reviewed by your instructor before release.         |
|                                                     [ Cancel ]  [ Submit attempt 2 ]|
+------------------------------------------------------------------------------------+
--- blocked state ---
| Cannot submit yet: 2 hard-required items are missing                                 |
|   Memo section 2 Assumptions and scenario (0 of 60 words)   [ Go to section ]        |
|   Required snapshot: moment diagram at governing combination   [ Capture ]           |
| Soft-required: none missing. (A missing soft item scores its criteria 0.)            |
```

**Regions:**
- Header: task, attempt number and the version this will create
- Bundle list: each deliverable with a one-line summary and its SHA-256, the display-only results summary and resultHash, the pin set
- Timing: effective due with extension, on-time/late status, the late policy in words and the computed penalty preview
- Last self-check summary (informational)
- Policy and pledge: policy line, disclosure fields required by the policy, pledge checkbox with version
- Footer: what happens next, Cancel, Submit

**Key data:**
- Deliverable hashes computed from canonical forms; modelHash, resultHash, engineArtifactHash, deliverable hashes; pin set ids
- lateSeconds, periods, penaltyFraction or points, cap, grace from the SCH-02 formula on the effective due
- Collaboration policy and AI-use policy enums; required disclosure fields; pledge text version and rendered hash
- Attempt policy: max, used, cooldown, resubmission window, grading target (best / latest / instructor-selected)

**States:**
- Blocked: hard-required items missing with jump links; the server rejects a bypass with the same list
- Soft-required missing: amber warning stating the scoring consequence; Submit enabled
- Late: timing line in red with the penalty preview and 'This will be recorded as late'
- Past close: Submit disabled, 'Closed Nov 12, 11:59 PM CT. Ask your instructor for an extension.'
- Attempts exhausted or cooldown active: Submit disabled with the reason and the next allowed time
- Exam window: no late policy line; 'Submitting inside the exam window' with time remaining
- Team co-sign variant: members frozen at submit and co-sign status (see team screen)
- Submitting: progress; dialog locked; success routes to the receipt
- Network failure: 'Your draft is safe (saved locally 2 s ago). Retry when you are back online.'; no receipt until the server acknowledges
- Server validation error: list identical to the client list; locked-field tampering shows 'Field span L1 is locked by the task' and keeps the draft
- Memo language not allowed: warning that the memo will be routed to instructor review (not scored 0)

**Interactions:**
- Copy all hashes copies a plain-text block with algorithm, names and full hashes
- Read the full pledge opens the institution base text plus the generated policy paragraph
- View opens the last self-check run in place
- Submit attempt N requires the pledge checkbox and required disclosure fields; the button label includes the attempt number

**Keyboard and accessibility:**
- Modal with focus trap, Esc cancels (confirmation if disclosure text was typed), initial focus on the first missing item or the pledge checkbox
- Hashes are in code elements with a copy button and an accessible name ('Model hash, SHA-256, copy')
- Penalty preview and lateness are text; late state also has an icon
- The pledge checkbox label is the full affirmation sentence; disclosure textareas have visible labels and required markers

**Requirements:**
- GAP3-DLV-02
- GAP5-POL-01
- GAP5-POL-02
- LMS SCH-02
- LMS SUB-01
- LMS SUB-02
- ADR R7
- ADR R8
- WS CAP-02
- PRD PRD-02
- GAP6-14
- GAP3-DLV-20

## Screen: Submission receipt and grading status

**Roles:** Learner; team members; instructor and TA see the same page in review context · **Route:** `/courses/:offeringId/tasks/:taskId/submissions/:n`

Prove the submission exists and is unchanged (hashes, pins, time), show where it is in the grading pipeline, and give computed results as soon as they exist without implying a score.

```
+------------------------------------------------------------------------------------+
| RECEIPT  T4 Portal frame under wind . Attempt 2 (v2)                                |
| Submitted Nov 8, 2026, 9:42:13 PM CT (Nov 9, 02:42:13 UTC) . On time . by you       |
| Receipt id SUB-7Q2M-91KD                                      [ Download receipt ]  |
|------------------------------------------------------------------------------------|
| GRADING STATUS                                                                      |
|  [Received] -> [Re-analyzed] -> [Checks done] -> [AI feedback] -> [Instructor review]|
|     9:42 PM       0.9 s            1.2 s           pending            waiting        |
|  -> [Released]                                                                      |
|  Computed results are ready. AI feedback is being prepared. Your instructor reviews |
|  before release (course target: within 72 hours).                                   |
|  [ View computed results ]  shows pass/fail evidence only; no scores until release  |
|------------------------------------------------------------------------------------|
| CONTENTS AND HASHES        Compare with what you copied at submit time              |
|  Model     SHA-256 3f9a1c2e 5d7b 01aa ... [ copy ]    server re-analysis: resultHash |
|            matches (same engine artifact)                                           |
|  Memo      SHA-256 9b02d7e1 ...  [ copy ]                                            |
|  Snapshot  SHA-256 c41e88a0 ...  [ copy ]                                            |
|  Pledge    v4 accepted 9:42:11 PM CT . hash 1e2f.. . AI-use disclosure recorded      |
|  Pins      task v3 . rubric v3 . engine 2.3.1 . checks 1.4 . clause lib 1.2 .        |
|            seed 8f21 . grader_version 2026.11.0 . assistance profile: coach          |
|------------------------------------------------------------------------------------|
| VERSIONS   v2 (this) under review . v1 Nov 3, 9:12 PM CT graded 68 / 100 [ view ]   |
|            Grading target for this task: best attempt.           [ Compare v1 v2 ]  |
|------------------------------------------------------------------------------------|
| [ Open submitted model (read-only) ]   [ Back to task ]   [ Report a problem ]      |
+------------------------------------------------------------------------------------+
--- backlog banner (above the stepper) ---
| We received your submission at 9:42:13 PM CT (receipt 3f9a1c2e). Feedback is taking  |
| longer than usual. No action is needed. Next update at 11:00 PM CT.                  |
```

**Regions:**
- Header: task, attempt, submitted time in learner and UTC time, lateness, actor (you / teammate / system auto-submit / assisted by operator)
- Pipeline stepper with stage timestamps or durations and a plain-language status sentence
- Contents and hashes with copy actions, the server re-analysis integrity line, pledge record, pin set
- Versions list with grading target and compare
- Actions

**Key data:**
- Submission version number, receipt id, submittedAt in UTC and offering/learner timezone, lateness and penalty if any
- PIPE-01 job state (queued, analyzing, checking, judging, aggregating, review, released, failed) mapped to the learner vocabulary
- Deliverable hashes, resultHash, engineArtifactHash, pin set, grader_version, effective assistance profile id, exam attestation summary when applicable
- Prior versions with status and score; attempt policy target

**States:**
- Received only (queued): 'Waiting to be analyzed'
- Computed done, AI pending: as shown; formative tasks show 'Released: computed results and AI-provisional narrative' immediately
- AI feedback delayed (LLM outage or kill switch): 'AI feedback is delayed. Computed checks are available. No action is needed.'
- Backlog: banner with the learner's own receipt time and hash and the next update time
- Invalid model (schema failure): 'We could not analyze this version: <reason>. Your draft is unchanged; fix and resubmit.'
- Held / under verification (quarantine): 'This grade is being re-verified after a correction to the checks library. Your submission is unchanged.'
- Auto-submitted at close: actor 'submitted automatically at close'; pledge 'not captured' shown plainly
- Exam attestation (learner view): 'Submitted inside the exam window: yes'
- Released: stepper complete with release time and reviewer; 'Read feedback' becomes primary
- Discrepancy (artifacts differ): 'Server results differ from your browser results within tolerance; grading uses the server results.'

**Interactions:**
- Copy per hash and Download receipt (PDF with the educational-use notice and all hashes)
- View computed results opens the feedback page in evidence-only mode (no scores, no narrative)
- Open submitted model loads the immutable snapshot read-only beside the working copy
- Compare v1 v2 shows element-count and deliverable diffs
- Report a problem pre-fills the receipt id and session

**Keyboard and accessibility:**
- Stepper is an ordered list with current step marked by text ('current: AI feedback, pending')
- Status sentence lives in a polite live region that updates as stages complete
- Hashes in code elements; copy buttons have distinct accessible names
- Times include the timezone abbreviation in text

**Requirements:**
- LMS SUB-01
- AIG PIPE-01
- AIG PIPE-03
- ADR R7
- ADR R11
- ADR R17
- AIG VER-01
- GAP4-OPS-12
- GAP4-OPS-13
- GAP4-OPS-06
- GAP4-HELP-03
- GAP5-EXAM-04
- GAP5-POL-02
- AIG NFR-02

## Screen: Grade and feedback page

**Roles:** Learner (after release, or immediately for formative deterministic results); team members for team grades · **Route:** `/courses/:offeringId/tasks/:taskId/feedback/:n`

Turn the grade into teaching: per-criterion scores with the evidence behind them, clause references that explain, failing members highlighted in the submitted model at the governing combination, the AI narrative labeled by provenance, memo claim verdicts, and the paths to resubmit or request a regrade.

```
+------------------------------------------------------------------------------------------------------+
| FEEDBACK  T4 Portal frame under wind . Attempt 2 of 3 (v2) . Rubric v3 . grader 2026.11.0 . US units |
| 72 / 100    raw 72 . late penalty 0 . pass mark 60 . Gates applied: none                              |
| [AI-generated, confirmed by instructor]  Reviewed and released by Dr. Alvarez, Nov 10, 3:12 PM CT     |
| Benchmark (shown after submission): your steel mass 9.8 t . benchmark 9.2 t . r = 1.07               |
| [ Resubmit: 1 attempt left, until Nov 17 ]  [ Request regrade: until Nov 17 ]  [ Download PDF ]      |
+-----------------------------------------+------------------------------------------------------------+
| SUBMITTED MODEL v2 (read-only)          | [ Criteria ]   [ Narrative ]   [ Memo claims ]              |
| [ 3D ] [ Results table ] [ Text summary]|------------------------------------------------------------|
|                                         | v Strength and code compliance   16 / 25   computed         |
|   canvas: B3 outlined red (fail),       |   FAIL  B3 flexure  Mu 412 kip-ft > phiMn 388  DC 1.06      |
|   utilization color map on, case set to |         under 1.2D + 1.0W + L + 0.5S . Major (secondary)    |
|   1.2D+1.0W+L+0.5S, probe card on B3    |         AISC 360-22 F2.2 lateral-torsional buckling          |
|                                         |         Lb 20 ft . Cb 1.14 . Lp 8.7 ft . Lr 26 ft            |
|   Case: 1.2D+1.0W+L+0.5S v   Overlay v  |         [ Show in model ] [ Explain F2.2 ]     EV-STR-0003   |
|   Legend 0 ======== 1.0 [> 1.0 hatched] |   PASS  13 of 14 members . max DC 0.91 (C2, E3 compression) |
|   [ Fit ] [ Animate deflection ]        |   Score rule: banded on max DC (1.06 -> 70%) x 13/14 passing|
|   (static under reduced motion)         |   [ All 14 evidence rows ]                                   |
|   badge: Changed since graded (when the | > Serviceability                  9 / 10   computed          |
|   working copy differs)                 | > Stability and second-order      5 / 5    computed          |
|                                         | > Loads and combinations         12 / 15   computed          |
|                                         |   FAIL  0.9D + 1.0W not defined . ASCE 7-22 2.3.1 . Major    |
|                                         | > Economy vs benchmark            9 / 10   computed          |
|                                         | > Code minimums                   5 / 5    computed          |
|                                         | > Constructability (hybrid)       4 / 5    AI, confirmed     |
|                                         | v Engineering judgment (memo)    12 / 15   AI, adjusted by   |
|                                         |     Dr. Alvarez: Verification level 2 -> 3, 'hand check of   |
|                                         |     the B3 moment is correct'                                |
|                                         |   Load path and system       level 3  M-SYS                  |
|                                         |   Assumptions and scenario   level 2  M-ASM                  |
|                                         |   Governing combo / members  level 1  contradicted claim:    |
|                                         |     'deflection controlled the rafters' vs EV-SRV-0002       |
|                                         |     (deflection DC 0.54; strength governed)   [ Show ]       |
|                                         |   Verification               level 3  M-VER                  |
|                                         |   Limitations                level 2  M-LIM                  |
+-----------------------------------------+------------------------------------------------------------+
| Was this feedback useful?  [ Yes ] [ No ]  optional comment          Educational use only; not for   |
|                                                                      construction.                   |
+------------------------------------------------------------------------------------------------------+
--- Narrative tab ---
| [AI-generated, confirmed by instructor]                                                              |
| SUMMARY  Your frame passes 13 of 14 strength checks and all drift limits; the rafter B3 fails LTB     |
|   under the wind combination and the uplift combination 0.9D + 1.0W is missing.                      |
| STRENGTHS  . Base fixity consistent with the spread footings in the brief (EV-MV-0002)               |
|            . Section rationalization: 3 unique sections across 14 members (EV-CB-0001)               |
| ISSUES (by priority)                                                                                 |
|  HIGH  B3 lateral-torsional buckling, DC 1.06 (EV-STR-0003, AISC 360-22 F2.2)                        |
|        Action: reduce Lb by declaring the purlins as discrete braces, or select W18x50.              |
|        [ Show in model ]                                                                             |
|  HIGH  Uplift combination missing (EV-LC-0004, ASCE 7-22 2.3.1). Action: add 0.9D + 1.0W and check   |
|        anchor uplift at both bases.                                                                  |
|  MED   Story drift h/380 under 10-year wind (EV-SRV-0005). Action: stiffen columns or add a knee     |
|        brace.                                                                                        |
| NEXT STEPS  1. ...  2. ...                                                                           |
--- Analyze variant (Criteria tab shows the Report values table) ---
| Field          Submitted    Your model   Reference            Status               Diagnosis           |
| R_A vertical   18.2 kip     18.2 kip     after Nov 14         modeling error (0)   Support at A is a    |
|                                                                                     roller; the task   |
|                                                                                     gives a pin [Show] |
| M_max B1       96.4 kip-ft  8.03 kip-ft  after Nov 14         unit error (0)       ratio 12: kip-in    |
|                                                                                     typed as kip-ft    |
| delta_mid B1   0.62 in      0.62 in      after Nov 14         correct (1.0)                            |
--- Check variant (Findings vs key) ---
| Member . limit  Your verdict  Key     Demand/capacity (yours vs key)   Clause   Credit                |
| B2 . F-LTB      fail          fail    412/388 vs 412/388  within 3%    F2.2 ok  1.00                  |
| C1 . C-FB       pass          FAIL    --                               --       unsafe approval (-1)  |
|   Gate: pass verdict on the governing failing member caps this criterion at 75                        |
| B4 . DEFL       fail          pass    --                               --       false positive (-0.5) |
| B3 . V          not reported  fail    --                               --       miss (0)              |
--- Diagnose variant ---
| Seeded error                      Found            Fixed   Your fix                   Collateral       |
| SE-LOD-01 UDL on B2 scaled x12    yes (loads)      yes     magnitude within 1%        none             |
| SE-SUP-01 pin -> roller at A      missed           no      --   [ Show mechanism ]    none             |
|   Why it matters: the roller at A removes horizontal restraint, so the frame sways under any lateral  |
|   load; reactions and drift change by more than 5%.                                                   |
```

**Regions:**
- Header: task, attempt, versions pinned, total with raw/penalty/pass mark, gate banner, provenance label and reviewer, benchmark line (after submission), actions
- Left: submitted model viewer with tabs 3D / Results table / Text summary; case and overlay selectors; legend; Changed-since-graded badge
- Right: Criteria tab (criterion cards with score, weight, kind, evidence rows, score rule, adjustment notes), Narrative tab (summary, strengths, prioritized issues with action and clause, next steps), Memo claims tab (claims with verdict and evidence)
- Footer: feedback-useful prompt and the educational-use notice

**Key data:**
- GradeRecord: total, raw, penalty, adjusted, status, gates applied with reasons, grader_version, rubric version, reviewer and release time
- Per criterion: score, weight, kind (auto / judged / hybrid / manual), level for judged, source (ai / human), override before/after/reason, evidence ids
- GradeEvidence rows: subject label, metric value and unit, limit, margin, governing combination label, code_ref (code, edition, clause, title, library id), severity, visual payload (highlight ids, color scale, combination)
- Judge output: levels per memo sub-criterion, rationale, memo_claims with verdict and evidence refs, confidence (not shown to learners)
- FeedbackNarrative: summary, strengths with evidence refs, issues with evidence_id, clause, problem, action, priority; next steps
- Archetype deliverable feedback: per-field classification and credit, findings matrix with miss / false positive / unsafe approval, seeded errors with found/fixed/collateral
- Reveal timing for reference values, check key, seeded errors, reference solution; benchmark visibility

**States:**
- Released and reviewed (shown): provenance 'AI-generated, confirmed by instructor' with the reviewer name
- Formative, not reviewed: header label 'AI-provisional' and 'Computed results are final; the narrative and judgment scores are AI-provisional and may change if your instructor reviews them'
- Evidence-only (before release, from the receipt): no scores, no narrative; criteria show pass/fail evidence only
- AI feedback pending (outage or kill switch): judged criteria show 'AI feedback pending'; computed criteria complete; never a 0
- Instructor adjusted: criterion shows before -> after and the reason; narrative edits marked 'edited by instructor'
- Held / under verification: banner, scores dimmed, 'Your submission is unchanged'
- Regrade open: header chip 'Regrade requested Nov 11, under review'
- Before reveal time: reference values, key and seeded errors replaced by 'available after Nov 14, 11:59 PM CT'; after it they appear without a regrade
- Changed since graded: badge on the viewer; highlights still resolve by stable ids and list 'entity no longer exists' when deleted
- Different grader versions across attempts: compare view labels scores 'not directly comparable'
- Team grade: one grade record; 'Your individual adjustment: none' or the adjustment with reason visible only to that member
- Reduced motion: deflection and mechanism animations replaced by static max shapes
- Narrow viewport (below 1280): viewer collapses to a tab above the criteria; parity tabs remain

**Interactions:**
- Expanding a criterion lists its evidence rows; Show in model frames the subject, switches overlay and governing combination, opens a probe card; the Results table row and Text summary sentence for the same evidence id are highlighted in parallel
- Explain <clause> opens the generated clause page in the help panel with the learner's own demand, capacity and limit beside it
- Memo claim verdict rows link to the memo section and the evidence record; contradicted claims show both texts
- Resubmit opens the workspace working copy with the feedback overlay available as a reference layer
- Request regrade opens the regrade form pre-selecting the expanded criterion and evidence
- Download PDF renders criteria, evidence and narrative with the notice; grader-only notes never render
- Feedback-useful prompt appears once per release; a No opens an optional comment

**Keyboard and accessibility:**
- Criteria are an accordion with arrow navigation; each evidence row is a list item whose accessible name includes status, subject, metric, limit, combination and clause
- Every highlight has a text equivalent: Results table (sortable, with units in headers) and Text summary ('B3 fails flexure at 1.06 under 1.2D + 1.0W + L + 0.5S')
- Severity and status use text plus icon; over-1.0 utilization hatched; palette deuteranopia-safe (design system)
- Show in model and Explain are buttons; focus returns to the row after the viewer updates; viewer updates announced politely
- Provenance labels are text, not badges alone; the narrative tab starts with the label
- Mechanism animation has a play/pause control and is static under prefers-reduced-motion

**Requirements:**
- LMS GRD-03
- AIG XPL-01
- AIG XPL-02
- AIG XPL-03
- AIG LLM-03
- AIG LLM-04
- AIG AGG-01
- WS RES-08
- GAP3-DLV-22
- PRD PRD-02
- PRD PRD-03
- PRD MET-04
- ADR R11
- ADR R16
- STR GRD-02
- STR GRD-03
- STR GRD-04
- AIG VER-01
- GAP4-OPS-07
- GAP4-HELP-02
- LMS DAT-04
- AIG OPT-01

## Screen: Regrade request and decision

**Roles:** Learner (requests); instructor or section TA decides (their screen is owned by ux-instructor-author) · **Route:** `/courses/:offeringId/tasks/:taskId/feedback/:n/regrade`

Give due process: a bounded, evidence-anchored request inside the window, a visible status, and a decision with per-criterion changes, reason and grade history.

```
+------------------------------------------------------------------------------------+
| REQUEST A REGRADE   T4 Portal frame . Attempt 2 (v2) . current score 72 / 100       |
| Window open until Nov 17, 11:59 PM CT . One request per attempt                    |
|------------------------------------------------------------------------------------|
| Which criteria?   [x] Strength and code compliance   [ ] Loads and combinations    |
|                   [x] Engineering judgment (memo)    [ ] Serviceability ...        |
| Evidence you are disputing (optional; pick from the feedback page)                 |
|   EV-STR-0003  B3 flexure DC 1.06 under 1.2D + 1.0W + L + 0.5S        [ remove ]   |
| Your reason (required, 50-500 words). Write for your instructor, not the grader.   |
| +--------------------------------------------------------------------------------+ |
| | I declared the purlins as discrete bracing at 10 ft (member flags), which gives | |
| | Lb = 10 ft and phiMn = 455 kip-ft ...                                           | |
| +--------------------------------------------------------------------------------+ |
| Attach  [ + screenshot or PDF ]  (optional, 3 files max)                           |
|------------------------------------------------------------------------------------|
| Your instructor or section TA decides. AI does not change scores on a regrade.     |
| Sending does not change your current grade. You will be notified of the decision.  |
|                                                    [ Cancel ]   [ Send request ]   |
+------------------------------------------------------------------------------------+
--- status and decision ---
| REGRADE  Opened Nov 11, 8:05 PM CT . Under review by Dr. Alvarez . typical: 5 days  |
| ...                                                                                 |
| DECISION  Nov 13, 2:40 PM CT by Dr. Alvarez . Outcome: adjusted                      |
|  Strength and code compliance  16 -> 20   'Declared purlin bracing accepted; with    |
|    Lb = 10 ft, DC = 0.93 (EV-STR-0003 superseded by EV-STR-0003r).'                 |
|  Engineering judgment           12 -> 12   'Upheld: the memo still names deflection |
|    as governing; the evidence shows strength governed.'                             |
|  Total 72 -> 76 . late penalty 0                                                     |
| GRADE HISTORY  v2 graded 72 (Nov 10, Dr. Alvarez) -> regrade adjusted 76 (Nov 13)  |
| [ View updated feedback ]     Further appeal: per course policy, contact the        |
|                               course lead (second decider).                        |
```

**Regions:**
- Header with current score and window
- Criteria checklist (active criteria only), disputed evidence chips, reason textarea with bounds, attachments
- Explanation of who decides and that the grade is unchanged until a decision
- Status card after sending; decision card with per-criterion before/after and reasons, total change, grade history, next-step note

**Key data:**
- Regrade window (course-configured) and count allowed per attempt
- Selected criterion ids, evidence ids, reason text (treated as untrusted; screened), attachments
- Decision: outcome (upheld / adjusted), per-criterion overrides with reason (append-only grade records), new total, decider, timestamps
- Grade history entries visible to the learner for released grades

**States:**
- Window closed: form replaced by 'The regrade window closed Nov 17, 11:59 PM CT.'
- Already requested: status open / under review / decided with the decision card
- Request held (injection screen hit on the reason text): status 'Under review' with no further detail; identical to any other hold
- Grade on hold because an integrity case was opened (v1.x): 'Under review' chip; details only if the learner has been notified
- Upheld: outcome 'upheld' with the reason; score unchanged
- Escalation (v1.x REV-03): 'Appeal to second decider' action appears once per task within the institution window

**Interactions:**
- Pre-selection from the feedback page carries the expanded criterion and evidence chip
- Word count enforced; Send disabled below 50 words with the count shown
- Decision notification deep-links to the decision card; View updated feedback opens the new grade version

**Keyboard and accessibility:**
- Checkbox group with a legend; evidence chips removable by keyboard
- Textarea with visible label, bounds in the description, live word count (polite)
- Decision deltas written as text ('16 to 20'), not arrows alone

**Requirements:**
- LMS GRD-04
- AIG REV-03
- AIG REV-02
- PRD PRD-03
- AIG SEC-01
- GAP5-AI-02
- GAP5-CASE-03
- PRD PER-09
- AIG REV-04

## Screen: Progress and mastery

**Roles:** Learner · **Route:** `/courses/:offeringId/progress (course) and /progress (all courses)`

Show competence rather than page completion: mastery per outcome with what is still needed, course outline status with gating reasons, and released grade history.

```
+------------------------------------------------------------------------------------+
| PROGRESS  CE 331 Steel Design . Fall 2026 . 62% complete . current grade 74% (B-)   |
| Released items only. Points-based per course policy.         [ Gradebook view ]    |
|------------------------------------------------------------------------------------|
| OUTCOMES                     Mastery rule in this course: at least 80% on tagged    |
|                              criteria across at least 2 different tasks            |
| L1 Analysis fundamentals                                                           |
|  L1.2 Equilibrium, determinacy, stability   MASTERED    92%   3 tasks  [ evidence ] |
|  L1.3 V/M diagrams and sign conventions     DEVELOPING  71%   2 tasks  needs >= 80% |
|  L1.5 Deflections and stiffness intuition   MASTERED    85%   2 tasks               |
| L2 Code-based design                                                               |
|  L2.2 LRFD combinations, governing combo    NEEDS WORK  55%   2 tasks               |
|    What would help: Lesson 4.1 . T4 resubmission (criterion: Loads and combinations)|
|  L2.4 Steel flexure (LTB, unbraced length)  DEVELOPING  78%   1 task   needs 1 more |
|    task with evidence (next: T5 Three-story frame)                                  |
| L3 Design optimization                      NO DATA     first task: T6 Truss bridge |
| L4 Engineering judgment                                                            |
|  L4.3 Justify assumptions in a memo         DEVELOPING  70%   2 tasks               |
|------------------------------------------------------------------------------------|
| COURSE OUTLINE                                                                      |
|  Module 1 Beams            done        3 / 3                                        |
|  Module 2 Trusses          done        4 / 4                                        |
|  Module 3 Steel members    in progress 2 / 4   T3 Beam LTB check due Nov 6          |
|  Module 4 Lateral loads    locked      unlocks when Module 3 is complete            |
|------------------------------------------------------------------------------------|
| GRADE HISTORY (released)                                                            |
|  T2 Continuous beam   v1 68 -> v2 82 (best counts) . confirmed by instructor        |
|  T1 Cantilever        85 . formative . AI-provisional narrative                     |
|  Quiz 2 Load cases    9 / 10                                                        |
|------------------------------------------------------------------------------------|
| [ Export my submissions and feedback ] (v1.x)                                       |
+------------------------------------------------------------------------------------+
```

**Regions:**
- Header: course, term, completion percent, current grade in the course scale, gradebook link
- Outcomes: grouped by level L1-L4 with mastery status, percent, evidence count, what is still needed and suggested next activities
- Course outline with per-module status, counts and gating reasons
- Released grade history with version chains and provenance
- Export (v1.x)

**Key data:**
- Mastery per outcome from the LOM-02 / PRG-03 rule (score >= 0.80 across >= 2 activities = mastered; 0.60-0.79 developing; < 0.60 needs work; no data), course-configured
- Evidence items: criterion scores tagged to the outcome with task and date
- Completion rule results per activity and module; prerequisite names for locked items
- Released grades only, with best/latest target applied and provenance labels

**States:**
- No data for a level or outcome: 'No evidence yet' with the first tagged task
- Mastery recomputed within 1 minute of a release or override (timestamp 'updated 2 min ago')
- Locked module: reason named; per-learner instructor bypass shows 'unlocked by your instructor'
- Term ended: read-only with grades and feedback still available
- All courses view: one card per course with the L1-L4 bars and next item

**Interactions:**
- Evidence opens the list of criteria and tasks that fed the outcome, each linking to its feedback page
- Suggested activities link to lessons or the task page (Resubmit if allowed)
- Gradebook view switches to the per-item table with raw, penalty, adjusted and status chips (late, resubmitted, under review, under appeal, provisional)

**Keyboard and accessibility:**
- Outcome rows are a table with headers (outcome, status, score, evidence); status is text
- Bars have text equivalents; no color-only meaning
- Locked modules are announced with the unlock condition

**Requirements:**
- PRD LOM-01
- PRD LOM-02
- LMS PRG-01
- LMS PRG-02
- LMS GBK-01
- ADR R15
- PRD LOM-03
- LMS DAT-03

## Screen: Exam-mode pre-start, in-exam strip, and the recording and AI-use notices

**Roles:** Learner; author preview-as-learner in exam mode · **Route:** `/courses/:offeringId/tasks/:taskId/start (pre-start) ; workspace with exam strip ; /courses/:offeringId/tasks/:taskId/notices`

Make the difference between a practice task and an exam unmistakable before the learner commits, keep it visible throughout, and publish exactly what is recorded and how AI grading works, generated from the profile and schema.

```
+------------------------------------------------------------------------------------+
| BEFORE YOU START   Exam: T5 Three-story frame under seismic loads                  |
| Generated from exam profile v2. What is listed here is what is enforced.           |
|------------------------------------------------------------------------------------|
| WINDOW    Opens Nov 20, 2:00 PM CT . closes 4:00 PM CT . 120 min from your start   |
|           Your accommodation (1.5x) gives 180 min. Server time is the authority.    |
| OFF       Hints . Check my design . Code-check overlays and utilization colors .    |
|           Exports and downloads . Share links . Task discussion                     |
| VISIBLE   Deflections and member forces only                                       |
| RECORDED  Edits (operation log), sessions, analysis runs, paste events (length      |
|           only), refused requests. Not recorded: keystrokes, clipboard contents,    |
|           camera, screen. Kept 12 months.               [ Full notice ]             |
| AT CLOSE  Your last saved draft is submitted automatically (pledge: not captured). |
| POLICY    Individual work . AI tools: prohibited . Honor pledge v4 below            |
| SESSION   One active session. Opening the exam elsewhere asks you to take over.    |
|------------------------------------------------------------------------------------|
| [ ] I have read the above and accept the honor pledge (v4).                        |
|                                                   [ Not now ]   [ Start exam ]     |
+------------------------------------------------------------------------------------+
--- in-exam strip (top of workspace, non-dismissable, distinct accent, in snapshots) ---
| EXAM . 1:47:12 remaining . Hints OFF . Check OFF . Code checks OFF . Export OFF . Saved 4 s ago . [ Submit ] |
--- second session ---
| SESSION ALREADY ACTIVE   This exam is open in another window or device (started 2:03 PM CT).         |
| [ Take over here ] ends the other session within 5 s. Both events are recorded.   [ Cancel ]        |
--- notices page ---
| WHAT BRIDLE RECORDS IN THIS TASK          (generated from the op-log schema; cannot drift)          |
|  Per edit: operation id, time, kind, entity ids touched, bulk source (import, paste, array) and count |
|  Per session: start, end, client build, exam profile in force                                        |
|  Memo: autosave word counts, paste events (length and internal/external), no clipboard contents      |
|  Also: analysis runs, self-check runs, hint requests, export and share attempts                      |
|  Never: keystroke timing, clipboard contents, screen, camera, microphone                            |
|  Who can view: your instructor and section TA when reviewing; an integrity officer only if a case is |
|  opened; you can view your own summary. Kept 12 months after the term, then summarized.             |
| HOW AI GRADING WORKS HERE                                                                            |
|  Computed checks are deterministic and cited to code clauses. AI proposes scores for judgment       |
|  criteria and writes the narrative from evidence only; your instructor reviews before release.      |
|  Your name, email and ids are removed before any AI call. Bridle does not use AI-writing detectors.  |
|  Text addressed to the grader instead of a reader is reported to your instructor.                    |
|  Model and prompt versions are recorded on every grade. [ AI transparency notice ]                   |
```

**Regions:**
- Pre-start: window and duration with accommodation, OFF list, visibility level, recorded list, at-close rule, policy and pledge, start action
- In-exam strip: countdown, OFF badges per disabled tool, autosave status, Submit
- Session conflict screen
- Notices page: recorded fields, exclusions, viewers, retention; AI grading explanation; links to the institution policy page and transparency notice

**Key data:**
- Exam profile fields: window open/close, duration, results_visibility, hints/self_check/code_checks/exports/share_links/discussions flags, auto_submit_at_close, single_session, proctoring (v1.x)
- Accommodation multiplier and extensions from SCH-01; server-synced remaining time
- Op-log schema fields and exclusions (generated), retention setting, viewer roles
- Collaboration and AI-use policy, pledge version

**States:**
- Before window: Start disabled with 'Opens Nov 20, 2:00 PM CT'
- Open: Start enabled after the checkbox
- In exam: strip persists across full-screen 3D and panel layouts; OFF badges on hidden tools; the client never requests withheld artifacts
- Closing: announcements at 30, 10, 5 and 1 minutes; strip turns to the warning accent at 5 minutes
- Network loss: 'Reconnecting; your work is saved locally' and the countdown resumes from server time
- After close: 'The exam closed at 4:00 PM CT. Your last draft (3:59:41 PM) was submitted automatically.' Feedback withheld until the window closes and the grade is released
- Second session: take-over dialog; the first session shows 'Ended: taken over from another device'
- Platform fault (a restricted artifact was served): learner sees nothing different; the attestation marks the platform, not the learner
- Held grade (any reason): 'Your grade is under review by your instructor.'
- Integrity case learner view (v1.x sketch): case summary, own evidence in full, counterpart only as highlighted overlapping regions with a pseudonym, response box with a 7-day window, appeal once

**Interactions:**
- Full notice opens the notices page in a side panel without leaving the pre-start
- Start exam records the explicit start action and opens the workspace
- Submit from the strip opens the submit dialog in exam variant (no late policy, window remaining shown)
- Take over here terminates the other session and continues from the server-held draft

**Keyboard and accessibility:**
- Pre-start is a document with headings per section; the checkbox label is the full affirmation
- Remaining time is announced via aria-live at the scheduled minutes only; the countdown is not a continuously updating live region
- Strip and OFF badges meet WCAG 2.2 AA contrast; badges have text ('Hints: off')
- Session dialog is a modal with focus trap; Cancel is the default

**Requirements:**
- GAP5-EXAM-01
- GAP5-EXAM-02
- GAP5-EXAM-03
- GAP5-EXAM-04
- GAP5-EVID-01
- GAP5-POL-01
- GAP5-POL-02
- GAP5-AI-01
- GAP5-AI-02
- GAP5-CASE-02
- LMS DAT-04
- GAP3-DLV-17
- LMS SCH-01
- GAP4-HELP-07

## Screen: Team-project variants (sketch)

**Roles:** Learner as team member or lead; peer reviewer (v1.x) · **Route:** `Same routes as above with ownerType = team; /courses/:offeringId/tasks/:taskId/team for membership`

Show how the single-learner screens extend to one shared model and one submission: ownership and lock state, co-signed submission with frozen members, one team grade with per-member adjustment, and read-only anonymized peer review.

```
--- task page header (team) ---
| T7 Capstone: 3D braced frame . TEAM Bridge Builders (4) . submission: co-sign by all . attempts 1 of 2 |
| Lock: Priya is editing (since 2:02 PM)  [ Request edit ]   Presence: (P) (J you) (A) (K)   staff: none |
--- workspace header strip (team) ---
| Team Bridge Builders . You are editing (lock held 12 min) [ Hand off ] [ Release ]  . observers: A, K  |
--- submit dialog additions ---
| MEMBERS AT SUBMIT  Priya L . Jordan S (you) . Amara O . Ken T   (frozen with this version)             |
| CO-SIGN  Priya signed 9:41 PM . Amara pending . Ken pending . You: sign below                           |
|          Grading starts when everyone signs or at the deadline; missing co-signs are recorded.          |
| Pledge: each member accepts individually                                                                |
--- receipt additions ---
| Submitted by Priya L for team Bridge Builders . co-signs 3 of 4 (Ken: not signed by deadline)          |
--- feedback additions ---
| TEAM GRADE 81 / 100 . Your individual adjustment: none  (an instructor may adjust one member with a    |
|   reason; only that member sees it)                                                                     |
| Contribution summary: not shared by the instructor   | when shared: gestures, elements surviving,      |
|   active minutes, memo words typed, per member; 'indicates activity, not quality'                       |
--- version timeline panel (team) ---
| v12 Amara 2:40 PM  +3 members, 2 sections changed  . v11 lock-release checkpoint (Priya) . [ Restore ]  |
|   (Restore available only while you hold the lock; restoring appends forward ops)                       |
--- conflict dialog ---
| Your 20 unsent edits are older than the current model. [ Replay onto current ] (2 conflicts listed)     |
| [ Save as my personal version ]  [ Discard ]                                                            |
--- peer review mode (v1.x) ---
| PEER REVIEW . Submission 2 of 2 (Reviewer view, pseudonymous) . read-only . rubric side panel           |
| AI grade hidden until you submit your review . [ Add anchored comment ] . [ Submit review ]            |
```

**Regions:**
- Ownership badge and lock state in the task header and workspace strip (chrome by ux-workspace-3d; content here)
- Submit dialog additions: frozen members, co-sign status, per-member pledge
- Receipt and feedback additions: team actor, co-sign record, team grade, individual adjustment, contribution summary when shared
- Version timeline with author filter and restore (lock holder only)
- Stale-ops conflict dialog
- Peer-review mode (v1.x): read-only anonymized snapshot with the rubric panel

**Key data:**
- Document ownerType/teamId, lock holder, lockEpoch, presence (members, staff, guests)
- Submission pin set: snapshot ids, memo version, attachments, members[] frozen, attemptNo, cosigns[]
- Team grade record plus per-member adjustment (multiplier or delta with reason)
- Contribution metrics when shared: gestures, elements surviving, active minutes, memo characters, with the activity-not-quality caveat
- Peer-review assignment: reviewer pseudonym, review deadline, rubric, calibration status

**States:**
- Lock held by another member: deliverable panels and model tools read-only with the holder's name; Request edit notifies
- Lock auto-released after 3 minutes without heartbeat; unsent edits offered for replay
- Member removed: loses access immediately; history keeps their ops under their id
- Individual exception fork: the learner's task page shows 'Individual copy (forked from team version v9)'
- Co-sign pending at deadline: proceeds with missing co-signs recorded
- Attempt limit reached: blocked for every member with the same message
- Staff live view: 'Instructor X is viewing' notice; help-mode edits badged as staff in the timeline
- Peer review: reviewee sees reviews labeled Reviewer 1..N only after the review deadline

**Interactions:**
- Request edit, Hand off to a named member, Release lock
- Sign the submission from the notification or the receipt; the dialog shows who has signed
- Open version timeline, filter by member, restore while holding the lock
- Replay / personal version / discard on stale ops

**Keyboard and accessibility:**
- Lock state and presence have text equivalents and are announced on change
- Co-sign status is a list with per-member text
- Peer-review mode is visually distinct and announced as read-only

**Requirements:**
- GAP6-01
- GAP6-09
- GAP6-10
- GAP6-13
- GAP6-14
- GAP6-15
- GAP6-18
- GAP6-20
- LMS CRS-05
- GAP5-FP-02
- GAP5-POL-02

## Flow: Complete a Design task in coach mode (the product spine) (Learner)

1. From Learner home, open T4 from Due in the next 7 days; the task page shows Not started; Start task creates the scenario instance and starter model and renders the given-data sheet with the learner's values
2. Read scenario, given data, constraints, active rubric, What help is available (coach: live results full, overlays on, self-check unlimited level 3, hints on); Open workspace (or Open tabular editor)
3. Model in the workspace (ux-workspace-3d surface); the deliverables dock shows the checklist 0 of 4 and the memo sections
4. Run Check my design; fix the failing rows using Show in model and Explain; re-run until satisfied
5. Write the memo in section cards; capture the required snapshot from the Snapshots tab (Capture now sets overlay and combination); checklist reaches 3 of 4
6. Submit: review bundle and hashes, timing and penalty preview, enter the AI-use disclosure, accept the pledge, Submit attempt 1
7. Receipt: pipeline stepper; copy hashes; View computed results shows evidence-only within 15 s
8. Notification Grade released -> feedback page; expand criteria, Show in model, Explain F2.2, read the narrative and memo claims; rate usefulness
9. Resubmit (attempt 2): the working copy reopens with the feedback overlay as a reference layer and a Changed-since-graded badge; repeat from step 4

Failure paths:
- Hard-required deliverable missing: Submit disabled with the list and jump links; a bypass is rejected by the server with the same list
- Locked-field tampering: server rejects with the field named ('span L1 is locked by the task'); the draft is kept
- Network loss at submit: 'Your draft is safe (saved locally 2 s ago). Retry when online.'; no receipt until acknowledged
- Grading backlog: receipt banner with the learner's receipt time and hash, 'no action is needed', next update time
- LLM outage or kill switch: judged criteria show AI feedback pending; computed criteria released per policy; nothing scored 0
- Grade quarantined after a checks-library correction: feedback shows under verification; the regraded version reaches the learner only after instructor release; errata notice
- Attempts exhausted or window closed: Resubmit disabled with the reason and date
- WebGL2 unavailable: every step completes through the tabular editor, results table and the task-page mirror of the dock

## Flow: Guided lesson with checkpoints (including first-run onboarding) (Learner)

1. Open the lesson from the module outline or Resume; the workspace loads the starting model with the step rail and the first step's instruction
2. Perform the step's action in the canvas, tabular editor or command palette; the checkpoint evaluates within 300 ms and shows which sub-conditions pass
3. If not met after 2 evaluations, Hint 1 unlocks; after 4, Hint 2; Show me applies the step and marks it assisted
4. For result steps, run the analysis and read the value from the results table or probe; the checkpoint checks the metric range
5. Next advances; progress is saved per step; Exit lesson keeps the model and step
6. When the last required checkpoint passes, the server re-validates and the lesson completes; module progress and outcome evidence update

Failure paths:
- Entity reference cannot be resolved (node not labeled A): the condition row names the missing label and the hint explains how to label it
- Server re-validation disagrees with the client (stale model): the failing sub-condition is named; fix and Next again
- Reduced motion: no auto-advance, static highlights
- Lesson version changed mid-way (cosmetic hot-apply): notice shown; progress preserved

## Flow: Archetype deliverables: Analyze, Check, Diagnose (Learner)

1. Analyze: the task page lists the N report fields and whether fill-from-results is allowed; in the workspace Report values tab, focusing a field highlights its node or member and switches the case; enter a value in any compatible unit; dimension errors block, plausibility warnings do not; self-check shows completeness (level 1) or counts (level 2); after release the feedback table shows status and a plain-language diagnosis per field; reference values appear after the reveal time without a regrade
2. Check: the given design is locked and code-check overlays are off; in Findings, add one row per member and limit state (pick the member in 3D or from the list, choose the limit state from the catalog filtered by section family, verdict, demand, capacity, combination, clause from the library, reason); the coverage line names what is still missing; inconsistency banners must be cleared; after release the findings-vs-key matrix shows hits, misses, false positives and any unsafe approval with the 75% gate explained
3. Diagnose: the brief states the number of seeded errors and the lock scope; in Found errors, add an entry per suspected error with entity, category and description; the status becomes fixed when the entity differs from the starter; Changes since start lists unreported edits with Revert; self-check (level 2+) shows how many are correctly found; after release each seeded error shows found/fixed/missed, the explanation, the fix assessment, collateral changes and a mechanism animation where relevant

Failure paths:
- Entity not found in your model (Analyze): field shows the message and cannot bind; submission allowed but the field scores 0
- Clause not applicable to the limit state or verdict pass with demand above capacity (Check): row marked inconsistent; submit warns
- More than 200 findings or 10 found errors: adding is blocked with the limit
- Scope-locked field edit (Diagnose): the workspace refuses the edit and names the locked class; a server bypass is rejected
- Rebuilt model in open mode: before submit, '12 unreported changes may count as collateral edits' with a link to the changes view

## Flow: Grade release, reading feedback, acting on it (Learner (instructor releases upstream))

1. Instructor releases the grade; the learner receives an in-app and email notification with the task and score
2. The feedback header shows the provenance label and reviewer; the gate banner explains any cap
3. Expanding a failing criterion shows evidence rows; Show in model frames the member, sets the overlay and the governing combination, opens a probe card; the Results table row and Text summary line highlight in parallel
4. Explain <clause> opens the generated clause page with the learner's own demand, capacity and limit
5. Narrative tab gives prioritized issues with concrete actions; Memo claims tab shows supported, unsupported and contradicted claims with the evidence
6. One-tap Was this feedback useful; then Resubmit or Request regrade

Failure paths:
- Formative task without review: label AI-provisional; computed results final; narrative may change if reviewed
- Before the reveal time: reference values, key and seeded errors show 'available after <date>'
- Working copy changed since graded: badge; deleted entities show 'entity no longer exists' and the historical state
- Attempts graded under different grader versions: compare view labels them not directly comparable
- Held grade for any reason: identical neutral message; no similarity or screening detail is ever shown

## Flow: Regrade request to decision (Learner requests; instructor or section TA decides)

1. From the feedback page inside the window, Request regrade pre-selects the expanded criterion and evidence
2. Choose criteria, optionally add evidence chips, write a 50-500 word reason addressed to the instructor, attach files; Send
3. Status chip Regrade requested appears on the feedback header and the home grade row; the current grade is unchanged
4. Instructor or TA upholds or adjusts per criterion with a reason (append-only grade records); the learner is notified
5. The decision card shows before/after per criterion, the new total and the grade history; View updated feedback opens the new version

Failure paths:
- Window closed: form replaced by the closed message with the date
- Second request on the same attempt: blocked with the existing status
- Reason text flagged by the screen: status Under review with no detail; no penalty
- Grade on hold from an integrity case (v1.x): Under review chip; details only if notified
- Escalation (v1.x): appeal once to the second decider within the institution window

## Flow: Exam-mode attempt (Learner)

1. The task page shows the Exam badge and Start exam; the pre-start screen is generated from the profile (window, duration with accommodation, OFF list, visibility, recorded fields, at-close rule, policy, pledge)
2. Accept the pledge and Start exam; the workspace opens with the non-dismissable strip, OFF badges, and results limited to the visibility level
3. Model and complete deliverables; autosave continues; the countdown resyncs to server time every 30 s with announcements at 30, 10, 5 and 1 minutes
4. Submit from the strip (exam variant of the dialog) or let the last draft auto-submit at close (pledge recorded as not captured)
5. Receipt shows 'Submitted inside the exam window: yes'; feedback is withheld until the window closes and the grade is released

Failure paths:
- Second tab or device: Session already active with Take over; both events recorded
- Network loss up to 60 s: session preserved; countdown resumes from server time
- Edit after close: rejected; message names the close time and the auto-submitted draft time
- Withheld artifact served by mistake: the learner is unaffected; the attestation attributes a platform fault
- Accommodation missing: the learner contacts the instructor; extensions apply through SCH-01 without re-entering the exam

## Flow: Team submission with co-sign (Team members (lead where configured))

1. The task page shows the team badge, members, submission permission (co-sign by all) and team attempts; the workspace strip shows who holds the lock
2. The lock holder edits while others observe live and can Request edit; the holder hands off or the lock auto-releases
3. Any member opens Submit; the dialog lists members frozen at submit and co-sign status; each member accepts the pledge individually
4. Grading starts when all sign or at the deadline with missing co-signs recorded; the receipt names the submitting member and co-signs
5. Feedback shows one team grade; an individual adjustment with reason is visible only to the affected member; the contribution summary appears only if the instructor shares it

Failure paths:
- Lock held: tools and deliverable panels read-only with the holder's name; Request edit notifies
- Stale unsent edits after auto-release: Replay (conflicts listed), Save as personal version, or Discard
- Member removed mid-project: access ends within 5 s; their ops remain attributed
- Team attempt limit reached: blocked for every member with the same message
- Individual exception fork: the learner continues on a user-owned copy with the fork point shown

## Components

| component | purpose | variants and states |
|---|---|---|
| TaskStatusChip | One vocabulary for task state on home, task page, outline, gradebook and notifications. | Not started, In progress, Submitted, Under review, Graded, Resubmission requested, Closed, Held (under verification), Exam; text plus icon, never color alone. |
| DeadlineLabel | Effective due with extension, cohort offset and timezone abbreviation; countdown as static text. | On time, due soon (48 h / 24 h), overdue, extended (shows original and new), exam window (open/close), closed. |
| ProvenanceLabel | States who produced a score or sentence. | Computed; AI-generated, pending instructor review (AI-provisional); AI-generated, confirmed by instructor; Adjusted by <name> (with reason); Instructor graded (no-AI path); AI feedback pending. |
| GivenDataSheet | Renders the learner's resolved scenario instance with units and source parameters; hidden values omitted. | Compact (task page) and full (sheet dialog, PDF with notice); 'derive it' rows; secondary units toggle; not randomized label. |
| ConstraintList | Lists task constraints with enforcement mode and linked criterion. | hard / soft / info; violated (from live rule engine) with the measured value. |
| RubricSummary | Active criteria only with weight, kind, gates and pass mark; expandable learner-visible descriptors. | Per archetype activation; kinds computed / AI-judged, reviewed / instructor; gate list; collapsed and expanded. |
| AssistanceProfileCard | 'What help is available' rendered from the effective assistance-and-disclosure profile. | Coach, summative, exam presets and custom; each field with its value; reveal timing with dates. |
| PolicyBadges | Collaboration policy, AI-use policy and exam flag with full-text equivalents. | Individual / group / discussion-allowed; prohibited / allowed with disclosure / allowed; exam. |
| RecordingNoticeLink | Links to the generated 'What Bridle records in this task' page from task pages, the memo editor and the workspace status bar. | Default; exam variant lists the extra refused-request and attention-signal fields when enabled. |
| DeliverableChecklist | Live completeness of every deliverable using the submit-time validators. | Complete, incomplete with reason, invalid; hard vs soft required; receipt variant with hashes. |
| MemoSectionCard | One memo section with prompt, concept hints, live word count against bounds and a rich-text editor. | Required / optional; under / within / over soft bound / over hard bound; plain-text mode; read-only (submitted or observer). |
| UnitAwareNumericInput | Accepts any compatible unit, shows dimension and convention, validates in SI without revealing correctness. | Force, moment, length, stress, dimensionless; sense selector T/C; dimension mismatch (blocking), implausible (warning), disabled fill-from-results. |
| EntityRefPicker | Bind a member or node by label with type-ahead, list or 3D pick; highlights the entity on focus. | Resolved, not found in your model, entity no longer exists; list-only mode when the canvas is unavailable. |
| FindingsRow | One (member, limit state) finding with verdict, demand, capacity, auto ratio, combination, clause and reason. | Valid, inconsistent (verdict vs numbers, clause not applicable), duplicate, imported; feedback variant with key verdict and credit (hit, miss, false positive, unsafe approval). |
| FoundErrorsList | Diagnose entries with derived fixed status plus the Changes since start view with revert. | Fixed / not fixed; unreported change; entity deleted; over limit; feedback variant with found/fixed/missed and collateral. |
| SnapshotRequirementCard | A required snapshot with expected overlay and combination, capture action and verification from the sidecar. | Not captured, met, unmet (expected vs actual labels), exam variant (captured into the bundle only, no download). |
| HashBlock | Displays a SHA-256 or resultHash with algorithm label, first 8 characters, copy full, and verification status. | Model, memo, snapshot, attachment, pledge, resultHash; matches / differs within tolerance / artifact differs. |
| LatePenaltyPreview | Explains the late policy in words and shows the computed penalty for submitting now. | On time, in grace, late with percent or points, capped, past close (blocked), exam (not applicable). |
| PledgeBlock | Institution base text plus the generated policy paragraph, version, and the disclosure fields the policy requires. | Individual; discussion-allowed (collaborators field); allowed-with-disclosure (AI-use field); exam; team (per-member acceptance); not captured (auto-submit). |
| PipelineStepper | Learner-vocabulary view of the grading job state with timestamps and a plain-language status sentence. | Received, Re-analyzed, Checks done, AI feedback, Instructor review, Released; pending, delayed, failed (invalid model), held, formative-released. |
| CriterionCard | Score, weight, kind, provenance, level, score rule, evidence rows and adjustment notes for one rubric criterion. | Computed, judged, hybrid, manual; adjusted; pending; evidence-only (no score); gate-capped. |
| EvidenceRow | One GradeEvidence record: status, severity, subject, metric vs limit, governing combination, clause chip, values, Show in model and Explain. | Pass / warn / fail / error / not applicable; self-check and feedback variants share the same layout; entity missing. |
| ClauseChip | Code, edition, clause and paraphrased title; opens the generated explanation with the learner's values. | US pack v1 clauses; equivalence set shown when an alternative notation was accepted; exam-restricted (not reachable). |
| GateBanner | States any cap or fail applied to the total and why, with the evidence id. | Cap 50 (Critical), cap 75 (Major / unsafe approval), fail task, none. |
| IssueCard | A narrative issue with priority, problem, action, clause and evidence id. | High / medium / low; edited by instructor; template fallback (when the validator fell back). |
| ClaimVerdictRow | A memo claim with verdict and the evidence it was checked against. | Supported, unsupported, contradicted (shows both texts), unresolved reference (coherence check). |
| ResultViewerEmbed | Read-only submitted snapshot with the feedback overlay, case and overlay selectors, and parity tabs. | 3D / Results table / Text summary; changed since graded; reduced motion; no WebGL (table and summary only). |
| CheckpointStep | A guided-lesson step with instruction, condition list, hint ladder, Show me and Next. | Not met, met, assisted, skipped (optional), verifying, failed server validation. |
| HintLadder | Tiered hints with unlock state and point cost. | Locked (condition shown), available, revealed; off in exam. |
| MasteryRow | Outcome with status, percent, evidence count and what is still needed. | Mastered, developing, needs work, no data; suggested next activity. |
| FeedbackUsefulPrompt | One-tap usefulness capture after a release with optional comment. | Unanswered, answered (hidden thereafter for that release). |
| ExamStrip | Persistent exam header with countdown, OFF badges, autosave and Submit. | Normal, final 5 minutes, reconnecting, closed; captured in snapshots. |
| TeamHeader | Ownership badge, lock state, presence and request/hand-off actions. | Personal; team you-are-editing; team other-is-editing; staff viewing; peer-review read-only. |
| SystemBanner | Targeted operational messages rendered from templates. | Grading backlog (with receipt time and hash), AI feedback delayed, grade under verification, read-only term, kill-switched feature message, session taken over. |

## Content and copy

- Voice: second person, plain and direct, engineering register; no exclamation marks, no blame, no 'oops'. Say what happened, why it matters, and what to do next.
- Provenance labels are exact strings: 'Computed'; 'AI-generated, pending instructor review' (short form 'AI-provisional'); 'AI-generated, confirmed by instructor'; 'Adjusted by <name>'; 'AI feedback pending'. They appear on every criterion and at the top of every narrative block.
- Units: the task's working unit system is primary; SI or US customary secondary on hover or toggle, in parentheses; every number carries a unit; forces and stresses to 3-4 significant figures, deflections to 0.01 in or 1 mm; comparisons happen in SI, never on the displayed rounding; guidance on inputs: 'at least 3 significant figures'.
- Clause references: '<code> <edition> <clause> (<paraphrased title>)', for example 'AISC 360-22 F2.2 (lateral-torsional buckling)'; never verbatim standard text; 'Explain' opens the generated page with the learner's own values.
- Combination labels are the formula with spaces, '1.2D + 1.6L + 0.5S', and the set name on first mention ('ASCE 7-22 2.3.1 LRFD'); envelope labels name the governing case.
- Entities by label (B3, C1, N4), never internal ids; evidence ids (EV-STR-0003) appear as secondary text for regrade references.
- Task status vocabulary: Not started, In progress, Submitted, Under review, Graded, Resubmission requested, Closed, Held. Pipeline vocabulary: Received, Re-analyzed, Checks done, AI feedback, Instructor review, Released.
- Severity words: Critical, Major, Minor, Advisory; evidence status: Pass, Warn, Fail. Gate copy: 'Capped at 50% because: mechanism in your model (EV-STB-0001)'.
- Analyze field statuses in plain words with the code in parentheses: correct; sign error; unit error ('the ratio looks like kip-in typed as kip-ft'); modeling error ('your model differs from the given structure'); transcription error ('your model is right; the typed value is not'); not found in your model; missing.
- Check vocabulary: hit, miss, false positive, unsafe approval ('you marked a failing member as passing'); Diagnose: found, fixed, missed, false finding, collateral change.
- Reveal copy: 'Reference value available after the due date (Nov 14, 11:59 PM CT)'; never 'hidden' without the date or condition; benchmark line: 'shown after submission'.
- Hashes: 'SHA-256 3f9a1c2e… (copy full)'; always name the algorithm; show the first 8 characters; one sentence of purpose: 'lets you verify your receipt later'.
- Time: learner timezone with abbreviation on every deadline and timestamp; offering timezone shown when different; absolute dates beyond 24 hours; countdowns as text, not ticking timers, except the exam strip.
- Safety sentence whenever grading is delayed: 'Your submission is safe. We received it at <time> (receipt <hash8>). No action is needed. Next update at <time>.'
- Held grades use one sentence for every reason: 'Your grade is under review by your instructor.' No mention of similarity, screening or integrity unless a case has been opened and the learner notified.
- Memo editor notice (verbatim, versioned): 'AI tools: <policy>. Paste events are logged, not scored. Your memo is graded on consistency with your own model. Text addressed to the grader instead of a reader is reported to your instructor.'
- Never use AI-writing-detector language ('AI probability', 'likely AI-written'); the notices page states that Bridle does not use such detectors.
- Educational-use notice on every export, PDF, receipt and feedback footer: 'Educational use only; not for construction.' AI narrative is additionally 'not professional engineering advice' in the transparency notice.
- Hints: 'Hint 1 of 3 (no point cost)' or 'Hint 2 of 3 (costs 2 points)'; Show me: 'This adds the support for you and marks the step as assisted.'
- Buttons are verb-first and specific: Open workspace, Check my design, Submit attempt 2, Read feedback, Show in model, Explain F2.2, Request regrade, Capture now, Request edit.
- Errors state what, why and what to do: 'kN-m entered into a force field. This field expects a force (kip, kN, lbf). Change the unit or the value.'
- Exam and policy text is generated from the profile and schema; no hand-written strings describe what is disabled or recorded.
- Team copy names people and actions: 'Priya is editing. Request edit.'; contribution summaries always carry 'indicates activity, not quality'.
- Formative results: 'Computed results are final. The narrative and judgment scores are AI-provisional.'
- Screen-reader text mirrors the visible vocabulary ('Status: fail. B3 flexure. 412 kip-ft over 388 kip-ft, ratio 1.06, under 1.2D + 1.0W + L + 0.5S. AISC 360-22 F2.2.').

## Open questions

- Learner home ownership: ux-ia-navigation designs the shell and sitemap; this surface specifies the home content (Resume, Due, Grades to read, Outcomes). Synthesis should merge the two so only one home exists.
- Deliverables dock chrome vs contents: ux-workspace-3d places the right-rail dock and the exam strip; this surface defines the panel contents, memo editor, checklist and the task-page mirror. Confirm the rail width budget (the memo editor needs at least 360 px) and whether the dock can detach to a second column at 1440 px and up.
- Default remedy when reference values are revealed after release with attempts remaining: re-seed per attempt (keeps unlimited formative attempts; the task page must explain that the next attempt is a new variant) or withhold until the due date (simpler copy). The design shows both with dates; a default is needed for the pilot course.
- Memo weight for Design/Optimize (15 unified per the deliverables gap vs 20 in the AI-grading template): the rubric summary and feedback cards are weight-agnostic, but the pilot course needs one number.
- Do hints cost points in the pilot course, and should the deduction preview appear on the submit dialog as a line item ('Hints used: 2 points')?
- Should formative tasks show the AI narrative at all when the task is set to deterministic-only, or only the evidence rows and a template summary? The feedback page supports both; the pilot default matters for cost.
- Will instructors ever review formative grades? If never, drop 'may change if your instructor reviews' from the AI-provisional copy.
- Are Diagnose tasks in the MVP course (recommended 2-3 at T1-T2, scope-locked)? If not, the Found errors panel and feedback variant can ship behind a flag.
- Contribution summary default for team tasks: shared with the team (ABET SO5 evidence) or hidden (avoid friction)? The feedback variant handles both; the default changes the copy on the team task page.
- Feedback-useful prompt: once per release only, or also after a regrade decision? MET-04 says once per release; a decision is a new grade version, so the prompt could reappear once.
- The relayed user request about the Build Monitor was already implemented in fdb22a2 (uncompressed layout, working/idle agents, progress board, current-phase activity). Confirm with the user that no further monitor changes are wanted; none were made in this step.

## Risks

- The feedback page is dense (viewer, criteria, narrative, claims) and must work at 1366 x 768; mitigation: tabs on the right, accordion criteria collapsed by default except failing ones, the viewer collapsible into a tab below 1280 px, and the summary line at the top.
- Learners read 'AI-provisional' as final and act on it, or read a held grade as an accusation; mitigation: the label plus one plain sentence on every provisional view, identical neutral copy for every hold reason, and the home grade row stating 'under review'.
- Pledge and disclosure fatigue leads to rote acceptance; mitigation: only the fields the policy requires, 'none' pre-filled for collaborators, the pledge sentence as the checkbox label, and the full text one click away.
- Reveal timing confuses learners who expect reference values immediately; mitigation: every hidden value states the date or condition inline; the task page's help card repeats the reveal timing.
- Keyboard-only entity binding in the deliverable panels is slow for large models; mitigation: type-ahead by label, recent entities first, Find in model focus return, and selection-to-field binding from the results table.
- Exam-mode restrictions rendered client-side could be mistaken for enforcement; mitigation: the pre-start screen states that restrictions are enforced by the server, the client never offers withheld tools, and OFF badges are generated from the profile.
- Hashes and pin sets intimidate non-technical learners; mitigation: one sentence of purpose, first-8-character display, copy buttons, and the receipt framed around 'your submission is safe and unchanged'.
- Self-check and grade disagree when the checks artifact changed mid-offering; mitigation: both show their artifact versions, the receipt reports 'artifact differs; tolerances apply', and a system banner points to the errata note.
- Mechanism and deflection animations on the feedback page can trigger motion sensitivity; mitigation: reduced-motion static shapes, explicit play/pause, no autoplay.
- Overlap between this surface, the workspace design and the IA design produces two versions of the home page or the dock; mitigation: boundaries stated in the summary and open questions for synthesis to resolve.
- Archetype variants (Analyze, Check, Diagnose) multiply screens for a small team; mitigation: one evidence-row component and one criterion card drive all variants; only the capture panels and the comparison table differ.
