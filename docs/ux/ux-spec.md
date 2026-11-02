<!-- Source: UI/UX workflow wf_fd27a6f6-ac0 (5 surface designers, 2 critics, 1 synthesizer), 2026-11-03. Binding inputs: ADR 0001, docs/requirements. -->

# Bridle UI/UX specification (MVP, with v1.x room)

Status: synthesized from PLAN-03 designs and critiques. Binding inputs: ADR 0001 (R6, R7, R11, R14, R15, R16, R17, MVP guardrails) and the requirement documents. Where a design and a critique disagreed, the critique's fix is adopted unless noted in section 12. Routes, names and vocabulary in this document supersede every string in the source designs.

## 1 Principles

1. One shell, five modes, one route table. The URL decides the mode (Learn, Teach, Author, Admin, Operate) under `/o/:org`; `routes.ts` is the single source for breadcrumbs, the palette's Navigate group, deep-link mode resolution and 403 reasons.
2. Evidence before score. Every number on a grade surface renders from a GradeEvidence record with its unit, governing combination and clause; the same EvidenceRow, DcrMeter and ClauseChip appear in the live self-check, the released feedback and the review screen, so what the learner sees before submitting is what the grader found (R9).
3. Provenance before the number. One ProvenanceLabel component with the PRD-02 and D2 strings precedes every score; summative grades reach learners only after an explicit Release (R11); bulk accepts are labelled as such.
4. Live means honest. Analysis state is always one of Fresh, Solving, Stale, Paused, Unstable, Failed, Offline, shown in words in the status bar, on every legend and in one polite live region; stale overlays desaturate within one frame.
5. Parity is a mode, not a fallback (R16). The Tables layout, command line, result tables and textual summary cover every modeling, results and deliverable action including required snapshots, and ship in the same release as the canvas.
6. Colour is never the only channel; red is reserved for Fail, over-utilization and destructive actions; accent is never a data colour.
7. The profile decides what is shown, the server decides what is served. Hints, self-check, overlays, exports and reveal timing render from the task's assistance-and-disclosure profile; exam copy is generated, never hand-written.
8. Teach at the point of failure. Validity messages name the entity, the DOF and the likely cause, offer a one-click undoable fix and can animate the mechanism; a singular matrix is never shown as "solver error".
9. Plain words for first-years. Internal taxonomy (tier codes, model tiers, pack versions, outcome ids, preset names) stays behind a Details disclosure or a glossary tooltip bound to a help id; the task page carries only due, attempts, late policy and units above the fold.
10. Fixed, learnable layout; dense but never cramped. 1280x720 minimum, canvas at least 60% wide and 500 px tall with one rail open, compact density in workspace panels, default on LMS pages, 24 px targets (44 px touch).
11. Nothing silent. Scope (section, preview, view-as, impersonation, read-only tenant), degradation (AI paused, offline, incident) and exam mode are shell-level banners, one at a time by priority, with the rest as status-bar chips.
12. Educational-use framing everywhere: the D1 badge in the workspace status bar and every export footer; no engineer-of-record, stamped or sealed language anywhere.

## 2 Personas and jobs

| Persona | Primary jobs | Home surface |
|---|---|---|
| Undergraduate / graduate civil student | Open the next task, model and iterate with live results, run the self-check, write the memo, submit on time, read feedback and resubmit, know where they stand | Learn home with the Resume card |
| Early-career engineer, licensure prep | Practice design tasks against real code, self-paced; sandbox; exam-style timed tasks | Learn home (sandbox tenant at MVP) |
| Instructor | Set up the term in under 30 minutes, review and release grades, handle regrades and extensions, see where the cohort struggles, read similarity evidence | Teach home: Needs you cards |
| Teaching assistant (section-scoped) | Work the review queue for own sections, answer Q&A, grant extensions if granted | Teach home with section badge |
| Course author | Start from a template, build the course, tasks, lessons and quizzes, calibrate, publish safely | Author home: tasks needing attention |
| Institution admin (MFA) | Members, roles, roster import, institution defaults, usage, audit and disclosure logs, DSR approval | Admin home tiles |
| Platform operator (MFA, 12 h) | Prove zero lost work, run the five runbooks, tenants, jobs, artifacts, LLM budgets, incidents, support with consent | Operate home invariant strip |

## 3 Information architecture and navigation

**Shell.** Top bar (hamburger, product mark, mode switcher listing only held modes, organization switcher, breadcrumb, search field opening the palette, help, bell, account menu); one banner slot (40 px); per-mode left rail (240 px, icon rail 56 px at 1024-1279, drawer below 1024); context header with entity name, term, scope badge, pinned pack and units, primary action and entity navigation; main with the h1 focused on route change; footer with the educational-use notice, status, docs, release and display time zone. Entity "tabs" that change the route are a `nav` of links styled as tabs with `aria-current="page"`; `role=tablist` is used only for in-page panels. On the workspace route the workspace task header replaces the shell top bar.

**Rails.** Learn: Home, Tasks (n), Courses (current offering expanded), Grades, Sandbox, Inbox, Help. Teach: Home, Offerings (expanded: Overview, Review (n), Gradebook, People, Schedule, Insights, Discussions, Integrity, Settings), Inbox, Help; TAs get the same rail with a section badge and no Settings. Author: Home, Courses, Tasks, Guided lessons, Lessons, Quizzes, Library, Presets, Review, Inbox, Help. Admin and Operate rails as in section 8.

**Route table (MVP unless marked v1.x).**

| Area | Routes |
|---|---|
| Global | `/sign-in`, `/sign-up`, `/verify-email`, `/reset-password`, `/mfa`, `/invite/:token`, `/join/:code`, `/orgs`, `/onboarding`, `/settings/{profile,appearance,display,accessibility,security,notifications,privacy}`, `/system-check`, `/whats-new`, `/search?q=`, `/403`, `/404`, `/unsupported-browser`; v1.x: `/`, `/lti/launch`, `/verify/:certificateId` |
| Learn | `/o/:org/learn`, `/learn/tasks`, `/learn/grades`, `/learn/inbox`, `/learn/sandbox`, `/learn/courses/:offering` (outline) with `/tasks`, `/grades`, `/discussions`, `/discussions/:thread`, `/announcements`; `/learn/courses/:offering/activities/:activity` (task, guided lesson, lesson, quiz, page, video, PDF, link) with `/workspace` (`?layout=canvas|tables|both&panel=&dock=&compare=`), `/exam` (pre-start), `/submissions/:n` (receipt `#receipt`, feedback `#feedback`), `/submissions/:n/regrade`, `/notices`; v1.x: `/learn/outcomes`, `/learn/models`, `/learn/paths`, `/learn/certificates`, `.../team`, `.../peer-review` |
| Teach | `/o/:org/teach`, `/teach/new`, `/teach/:offering` (Overview), `/review` (queue; `/review/regrades`; `/review/:submissionVersion`), `/gradebook`, `/people` (`/people/:enrollment`), `/schedule`, `/insights`, `/discussions`, `/announcements`, `/integrity` (similarity report), `/activities/:activity` (task stats), `/settings`, `/go-live`; v1.x: `/calibration`, `/teams`, `/integrity/cases` |
| Author | `/o/:org/author`, `/author/courses/:course` (course builder), `/author/courses/:course/versions`, `/author/tasks/:task` (`?section=`), `/author/tasks/:task/model`, `/author/tasks/:task/versions/:version/calibration/:run`, `/author/tasks/:task/publish`, `/author/tasks/:task/preview`, `/author/guided/:id`, `/author/lessons/:id`, `/author/quizzes/:id`, `/author/library`, `/author/presets` (environment presets, cost models, libraries), `/author/review` |
| Admin | `/o/:org/admin` and `/members`, `/members/:user`, `/roles`, `/roster-imports`, `/offerings`, `/settings`, `/usage`, `/audit`, `/disclosures`, `/support-sessions`, `/data-requests`, `/flags`; v1.x: `/integrations`, `/integrity`, `/departments`, `/billing` |
| Operate | `/ops` and `/search`, `/tenants`, `/tenants/:id`, `/jobs`, `/jobs/:id`, `/dead-letter`, `/reconciliation`, `/artifacts`, `/pins`, `/llm`, `/flags`, `/incidents`, `/deadline-windows`, `/support`, `/support/:ticket`, `/replay/:bundle`, `/data-requests`, `/metrics`, `/onboarding`; v1.x: `/policies` |

Overlays on every route: command palette (Ctrl/Cmd+K), help panel (`?` and help icons), notification tray, mode and org switcher, banner slot. Deep links set the mode from the URL; a TA who is also a learner lands in Teach with the section scope from a review link and in Learn from a grade link. The `/` and `[` global keys are dropped.

## 4 Screen inventory

| Screen | Roles | MVP |
|---|---|---|
| App shell, mode/org switcher, banners, palette, help panel, inbox, settings (incl. Appearance and Accessibility), system check, What's new, sign-in/up/MFA/invite/join/orgs, onboarding tutorial | All | Yes |
| Learn home; Task list; Course outline; Grades and progress; Discussions and Q&A thread; Announcements | Learner | Yes |
| Task page; Content activity (page, video, PDF, link); Quiz attempt; Guided lesson | Learner | Yes |
| Workspace (canvas / tables / both); Deliverables dock and memo editor; Self-check; Diagnostics; Snapshot capture; Submit dialog; Exam pre-start and session takeover; Notices | Learner (author preview, staff inspect) | Yes |
| Receipt and grading status; Feedback page (with 3D, Results table, Text summary); Regrade request and decision | Learner | Yes |
| Team variants, peer review, learner outcomes profile, saved models, paths, certificates | Learner | No (v1.x) |
| Teach home; Offering overview; Course setup wizard; Go-live checklist; People (roster, sections, extensions, accommodations, gating bypass); Schedule; Offering settings | Instructor, TA (scoped) | Yes |
| Review queue; Review screen; Regrades; Gradebook; Insights; Similarity report; Discussions/announcements (staff) | Instructor, TA (scoped) | Yes |
| Calibration dashboards (GRD-05), integrity cases, teams | Instructor | No (v1.x) |
| Author home; Template library; Course builder; Course versions; Task builder (12 sections); Starter model (workspace author mode); Rubric and assistance profile; Randomization and seed explorer; Calibration report; Publish dialog; Guided lesson builder; Lesson editor with embedded model block; Quiz builder; Presets and cost models; Content review | Author | Yes |
| Admin home and entries (members, roles, roster imports, offerings, settings, usage, audit, disclosures, support sessions, data requests, flags) | Institution admin | Yes |
| Admin integrations, integrity policy, departments, billing | Institution admin | No (v1.x) |
| Operate home and entries (search, tenants, jobs, dead-letter, reconciliation, artifacts, pins, LLM, flags, incidents, deadline windows, support, replay, data requests, metrics, onboarding) | Platform operator | Yes |
| Operate policies (runbook automation) | Platform operator | No (v1.x) |

## 5 The 3D workspace

**Layout (normative chrome; the design-system canvas kit follows it).** Exam banner slot 40 px (only in exam, above everything); task header 44 px (Back to task, title with plain archetype phrase, ownership badge slot, policy and help-available chips, autosave state, Submit, help, bell hidden in exam); vertical tool rail 48 px; canvas at least 60% wide; right rail 320 px (resizable 280-480, collapses to a 40 px icon rail; the Memo tab expands it to 480); bottom dock collapsed by default (220 px when open); status bar 28 px. Vertical budget at 720 px: 40 + 44 + 28 = 112, canvas 608 px with the dock collapsed. The former view bar is a HUD strip inside the canvas. A layout test at 1280x720 and 1366x768 asserts canvas width at least 60% and height at least 500 px with one rail open and the dock collapsed. Below 1280 px panels open as drawers with a banner; never horizontal scroll.

```
+---------------------------------------------------------------------------+
| < Task | Portal frame under wind - Design task | Individual - AI allowed   |
|        | with disclosure | Help: coach | Saved 2 s ago | Submit | ?        |
+----+------------------------------------------------------------+---------+
| V  | [Top Front Iso] [Ortho] [Lines|Solid] [Labels] [Color v] [Fit]| Props  |
| N  |            ( 1.2D + 1.0W(+X) + L v )                 [cube] | Model  |
| M  |   C1 o=====================================o C2              | Loads  |
| S  |     |   deformed x25 (ghost dashed)         |   ### 0.84     | Results|
| L  |     |        B1 ================           |                | Check  |
| A  |   ^ N1 pin                           o^ N2 roller            | Deliver|
| T  |  +- Utilization - combined (H1) - C4 - x25 - Fresh 38 ms --+  |--------|
| P  |  | 0 .. 1.00 | //// 1.00-1.02 | XXXX >1.02 | hover = value | | PROPS  |
+----+------------------------------------------------------------+---------+
| > Results table  > Diagnostics (0)  > History  > Tables                   |
+---------------------------------------------------------------------------+
| Plane XZ | Snap | kN,m | 3 members | Members 42/300 | Fresh 38 ms | Live v |
| Saved 2 s | i records | Educational use only (i)                          |
+---------------------------------------------------------------------------+
```

**Status bar retention order** at 1280 px: analysis state (never icon-only), cap meter, autosave, selection; plane, snap, units, records and disclaimer collapse into an overflow menu. Every chip is a button with an accessible name; chip text at least 13 px.

**Modes.** Layout: Canvas, Tables, Both (header switch, persisted; Tables forced without WebGL2 with a banner and system-check link). Profile: coach (live results full, overlays on, self-check unlimited, disclosure level 3), summative (counts only, level 2, self-check capped 3, hints off, reveal after due), exam (level 0, no overlays, no hints, no exports). Role: learner edit; author (extra Author tab: lock, hide, required, label, group, bind, seeded error; preview-as-learner banner "nothing is recorded"); instructor/TA inspect (read-only snapshot, "Experiment on a copy"); operator support replay (read-only, isolated). 2D planar mode (T1-T2): XZ plane locked, orthographic, axis indicator instead of the cube, in-plane loads, presets named by behaviour: "Pin (restrains X and Z)", "Roller, free in X (restrains Z)", "Roller, free in Z (restrains X)", "Fixed", "Spring (stiffness per DOF)".

**Pointer and tool rules.** Select is default; Esc returns to Select; Space temporarily orbits. LMB-drag on empty space orbits, with Ctrl/Cmd marquee; MMB pans, RMB orbits, wheel zooms at the cursor; trackpad two-finger pan, pinch zoom, Alt+drag orbit. In Select a drag that starts on an entity never moves it; moving requires the gizmo handles or the Transform tool (T), and every move, merge, delete and fix shows an 8 s focusable toast with Undo ("Moved N7 by 0.500 m"). Snap tooltip names the snap and shows world coordinates, segment length and angle before the click; Shift disables snap, Ctrl cycles candidates. Coincident nodes within 1 mm merge with an undoable toast. Locked elements are grey-blue with a padlock on hover and cannot be edited (no gizmo, inputs disabled, API refuses). Controls removed by role or task preset are hidden; controls normally available but temporarily disabled (exam, cap reached, read-only) are greyed with an Off badge and reason. Working-plane chooser opens the Grids and levels dialog (named gridlines A, B, C and 1, 2, 3 with spacings, levels); the HUD has a Local axes toggle.

**Shortcut registry (one owner).** `commandBus.ts` holds every shortcut for the shell, workspace, review surfaces and palette with a per-OS and per-browser denylist (Ctrl/Cmd+1-9, Alt+1-8, Alt+D, Ctrl+D, Ctrl+Shift+N/P/C/S, Ctrl+M, F6, Ctrl+W/T/L and OS media keys); CI fails on any collision or duplicate. Single-key shortcuts are active only while their composite widget has focus: tool keys V N M S L A T P, view keys 1-7 and 5, F, Home, +/-, Delete and arrows only while the canvas container (`role=application`) has focus; j/k/x/a only in the queue grid; 0-3 only as radio choices in a focused level group. Settings > Accessibility has "Single-key shortcuts: on/off" (off keeps modifier shortcuts and disables g-chords). Modifier shortcuts: Ctrl/Cmd+K palette, Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z, Ctrl/Cmd+Enter run (manual mode), `?` help; rail tabs, diagnostics, self-check, snapshot and move-by-vector are reached through the palette and registry-verified chords; the final map is published once in the shortcut sheet, Settings and help.

**Live loop.** Edit commits as a named invertible command on the single command bus (toolbar, shortcuts, palette, tables, lesson "show me", tests). Within one frame overlays desaturate to 40% and the LiveStatePill reads Stale; after 30-100 ms debounce (300 ms for Tier M) it reads Solving; the worker solves with sequence numbers and cancellation; Fresh repaints at full saturation and the status live region announces "Results updated". Paused (manual mode after three over-budget solves; Run button), Unstable (mechanism: node and DOF named, overlays cleared to ghost, diagnostics open once per session), Failed (solver error: results withheld, Report a problem), Offline (edits and local autosave continue). Case switcher pill repaints cached results without re-solving; the legend always states quantity, units, case or combination (governing in envelope), scale factor, sign convention, bands, the hatched 1.00-1.02 tolerance band and the hatched red above-1.02 band, plus the freshness badge, and renders into screenshots. Results tab: deformed shape (log slider with numeric twin, ghost, animate off under reduced motion), diagrams N/V2/V3/M2/M3/T with stations and convention, reactions with equilibrium residual, utilization bands/min/max/pattern mode, up to 10 probe cards. Results table (dock) syncs selection both ways and exports CSV with units, the D1 header and provenance stamp. SizeCapMeter: amber at 90%, red at 100%; creation tools disable with the reason; imports exceeding the cap are rejected before applying. Cost chip in the status bar when the task has a cost model, with a per-member cost table in the results dock.

**Diagnostics dock.** Rows with code (VAL-*, ENG-*, WS-CAP), severity word (Error blocks analysis, Warning, Notice), message naming the entity and likely cause, actions Show, Fix (single undoable command), Animate (mechanism), Explain (help page). On T1-T2 tasks an over-restraint Notice fires live (all nodes restrained, more than two fixed supports on a simple beam, support on an unconnected node). The analysis chip opens the timing popover (tier, DOF, per-phase ms, engine version, result id).

**Self-check (Check tab, "Check my design").** Header states run count and cap, artifact versions ("checks 1.4.0, US pack: ASCE 7-22, AISC 360-22"), what is and is not shown. Evidence groups: Model validity, Loads and combinations, Strength, Serviceability, Stability, Code minimums, Task constraints, Deliverables; Analyze adds Report values, Check adds Findings scope, Diagnose adds Found errors and unreported changes. Each row is an EvidenceRow (status word first, subject, metric with unit vs limit, governing combination, ClauseChip, Show, Why?, Fix). Disclosure levels: 0 tab hidden with Off badge (exam); 1 completeness only; 2 counts ("3 of 5 fields within tolerance", the summative preset); 3 per-item pass/fail (coach default); 4 per-item plus hint tiers category > entity > clause. Footer: "Evidence ids will match your grade exactly if the model is unchanged. Automated check - not professional engineering advice."

**Deliverables dock (Deliver tab; chrome owned here, contents in section 6).** Tabs appear only for the archetype, in the order Report values, Findings, Found errors, Memo, Snapshots, Attachments, Checklist. Memo defaults to the full-width task-page editor ("Open memo editor"); the dock shows per-section counts and can expand the rail to 480 px.

**Snapshots and exports.** Ctrl/Cmd+Shift+S is replaced by a registry chord; "Capture for requirement" applies the required overlay, combination and preset, renders in the print canvas theme with legend and title block, and attaches PNG plus sidecar (camera, overlay, case, legend bounds, model hash, result id, palette version). In the Tables layout the same action builds the sidecar and requests a deterministic offscreen or server render; the checklist shows "Generated from your view state" with alt text from the textual summary; if rendering is unavailable the requirement is satisfied by the sidecar with a note to the instructor, because grading verifies the sidecar, not pixels. Exports carry D1 and the provenance stamp; Download and Share are hidden in exam mode; share links open after the task closes.

**Exam mode.** Pre-start screen generated from the profile (window, duration with accommodation, "Turned off during the exam", "Results you can see", "Recorded", at-close rule, policy, single-session rule, pledge checkbox, explicit Start). In the attempt: plum ModeBanner above the header with countdown synced to server time every 30 s, Off badges on hints, self-check, utilization, exports and sharing; announcements polite at 30, 10 and 5 minutes, assertive at 1 minute; colour unchanged, text "Less than 5 minutes left" added. Second session shows the takeover dialog (Cancel default). Ops after close are rejected with the close time; auto-submit records pledge "not captured". The Tables layout works inside exam mode with the same banner and badges, and the attestation records the layout used.

**Parity layout (Tables).** Command line (grammar: `node 9,0`, `member N4 N7`, `support N7 rollerx`, `load member M3 -10 kN/m`, `case L`, `run`), navigator of entity tables (nodes, members, supports, loads, cases, combinations, sections, materials, groups, grid, levels) and result tables, textual summary whose first line carries the analysis state and time, status bar. Grid contract everywhere: arrows move cells, Tab and Shift+Tab leave the composite, Enter or F2 edits, Esc cancels, Ctrl+Enter adds a row, Space selects, Delete removes with confirmation; fly-to is a row action. Skip links at the top of the workspace: properties, results, diagnostics, deliverables. Toolbar and HUD groups are single Tab stops with roving tabindex. The canvas accessible name is short (counts and state); the full summary is a named region. A CI e2e builds the benchmark truss both ways and asserts hash equality; keyboard-only scripts cover one task per archetype including a required snapshot.

## 6 Learner journey

**Learn home (one screen; IA frame, learner-journey content).** h1 "Home", term, Open sandbox, Tutorial launcher; Resume card (task, course, last step, draft age, missing deliverables, effective due with extension); Due in the next 7 days (overdue first with penalty text); Feedback ready (ProvenanceLabel before the score; summative items awaiting review read "Under review"); My courses; Outcome progress (four plain-named levels with the R15 rule stated, shown after the first released summative grade). Unit switch lives in Settings. Phone: read-only, Resume shows "Open on a laptop".

**Course outline.** Context header with term, section badge, codes in a Details disclosure, progress, released total, Resume; pinned announcement strip; outline as nested lists: each module a disclosure button over a list, each activity a list item with one link (type, title, status, due in the accessible name) and one action; locked rows name the prerequisite (server enforced); right rail This week, Staff with Ask a question, Course rules (late policy, "Help available", AI grading notice, "What Bridle records").

**Task page (one screen; single scrolling page).** Above the fold at 1366x768: back link, title with plain archetype phrase and summative or practice, due with extension and zone, attempts and grading target, late policy, units, primary actions (Open workspace or Resume, Check my design (n left), Submit, Report a problem). Body: scenario, Given-data sheet (own variant; hidden rows omitted, marked "derive it"; secondary units; PDF with notice), constraints with mode, deliverables checklist (same validators as submit), rubric summary (active criteria only, weights to 100, kind, gates, pass mark, learner descriptors), "What help is available" from the profile, resources with clause links opening the help panel, outcomes in plain names, submissions list, Q&A (private-to-instructor option), "What Bridle records here", Details (pack version, task version only here and on the receipt). Sub-routes Submissions, Feedback and Q&A are navigation links, not tabs.

```
+----------------------------------------------------------------------------+
| < Module 4                                       [In progress] draft v2     |
| 4.4 Portal frame under wind   Design task - Summative - Individual work      |
| Due Fri Oct 17, 11:59 PM CDT (course time) - Extended to Oct 20 for you     |
| Attempts 2 of 3 left (best counts) - Late 5%/day, max 30% - US customary    |
| [ Resume ] [ Check my design (3 left) ] [ Submit ] [Report a problem]       |
+---------------------------------------+------------------------------------+
| SCENARIO ...                          | WHAT YOU WILL SUBMIT   1 of 4       |
| GIVEN DATA (your variant) [full sheet]| [x] Model  [ ] Memo 3/8  [ ] Snapshot|
| CONSTRAINTS hard/soft/info            | [ ] Pledge (at submit)              |
| HOW THIS IS GRADED  9 criteria, 100   | WHAT HELP IS AVAILABLE (coach)      |
|   Strength 25 computed ... Memo 15    | RESOURCES - Q&A (4) - What Bridle   |
|   AI-judged, reviewed; gates listed   |   records here - Details            |
+---------------------------------------+------------------------------------+
```

**Content activity and quiz (sketch, CNT-01/02).** Page, video (captions and transcript toggle), slides, PDF (in-app viewer with page tracking), link; completion-rule state; embedded model block in view-only, explore (orbit, select, read values) or sandbox (private copy with Reset) mode with the same HUD and a Tables alternative; educational-use footer. Quiz attempt: question list (MC, multi-select, true/false, unit-aware numeric accepting any compatible unit), static remaining-time text with announcements at 5 and 1 minutes, server-enforced limit with the accommodation multiplier, attempts remaining, submit with confirmation, results after release with per-option feedback, score to the gradebook.

**Guided lesson.** Workspace with the lesson stepper: step list with required and optional markers, instruction with LaTeX, highlight target (static under reduced motion), checkpoint conditions evaluated within 300 ms from model state with each sub-condition named, hint ladder (tier 1 after 2 failed evaluations or on request, tier 2 after 4), "Show me" (confirmation; applies the step as one undoable command labelled assisted), Next enabled when met; no auto-advance; Exit keeps model and step; server re-validates on completion. The 10-minute onboarding tutorial uses the same screen. Every checkpoint is achievable from the Tables layout.

**Deliverables (contents).** Report values (Analyze): numbered UnitInput rows with prompt, bound entity and case (focus highlights it), convention or T/C selector, dimension errors block, plausibility warnings do not ("larger than the total applied load (96.0 kN). Check the units."), fill-from-results when allowed. Findings (Check): rows member, limit state (catalog filtered by section family), verdict, demand, capacity, auto ratio, combination, clause (paraphrased titles), reason; coverage line; inconsistent rows block submission; CSV import. Found errors (Diagnose): entity, category, description, derived fixed status; Changes since start with Revert and Add as finding. Memo: eight section cards per archetype catalog with prompts, bounds and live counts, LaTeX, tables, figures from snapshots with alt text, plain-text mode, the versioned notice ("AI tools: <policy>. Paste events are logged, not scored..."). Attachments: PDF/PNG/JPG, 3 files of 20 MB, type, size and virus-scan errors. Checklist: hard and soft required with reasons, attempts, due in the offering zone, late-penalty preview, pledge state, Submit.

**Submit dialog.** "What will be submitted" as plain counts (members, nodes, cases, combinations; memo sections and words; snapshots met; attachments); timing line with on-time or late and the penalty preview; last self-check summary; policy line, required disclosure fields (AI use, collaborators), pledge checkbox whose label is the affirmation; "Technical details (for your receipt)" collapsed: SHA-256 per deliverable, resultHash, pin set, seed, Copy all hashes. Blocked state lists hard-required items with jump links; the server returns the same list. Button "Submit attempt 2".

**Receipt and grading status.** Submitted time in learner and UTC zones, lateness, actor (you, teammate v1.x, auto-submitted at close, assisted by operator), receipt id, GradingStatusTimeline (Received, Analyzed, Checked, AI feedback, Instructor review, Released) with the plain status sentence, contents and hashes ("sha256:3f9a...c21e", copy), server re-analysis integrity line, pledge record, pin set and grader version (shown to learners only here and in the feedback Details drawer), versions with the grading target, Open submitted model (read-only), Download receipt. Backlog banner: "We received your submission at <time> (receipt <hash>). Feedback is taking longer than usual. No action is needed. Next update at <time>."

**Feedback page (one screen; the workspace overlay is its 3D tab).** Header: task, attempt n of N, total with raw, penalty and pass mark, GateBanner naming every cap with the evidence id, ProvenanceLabel ("AI-generated, confirmed by Dr. Alvarez on Nov 10" or "AI-generated, pending instructor review"), D2 line, benchmark line after submission, actions Resubmit (attempts and window), Request regrade, Download PDF, Open in workspace. Left: submitted snapshot with tabs 3D, Results table, Text summary; case and overlay selectors; legend badged GRADED SNAPSHOT; "Changed since graded" banner when the working copy differs; Compare toggle Submitted/Working with changed markers. Right: Criteria (CriterionCard: score, weight, kind, provenance, EvidenceRows with DcrMeter and ClauseChip, Show in model, Explain, score rule in GRD-03 words: "pass region scaled by the fraction of members passing; any member above 1.02 is Critical or Major and caps the total"), Narrative (summary, strengths, prioritized issues with action, clause and evidence id, next steps), Memo claims (supported, unsupported, contradicted with both texts). Archetype variants: Analyze per-field table (submitted, own model, reference after reveal, status word, diagnosis); Check findings-vs-key matrix (hit, miss, false positive, unsafe approval with the 75% gate); Diagnose seeded errors (found, fixed, missed, collateral) with a mechanism animation under play/pause. Judged criteria pending show "AI feedback pending", never 0. One-tap "Was this feedback useful?" once per release. Below 1280 px the viewer collapses to a tab above the criteria.

```
+----------------------------------------------------------------------------+
| FEEDBACK 4.4 Portal frame - attempt 2 of 3      72 / 100  (pass 60)          |
| AI-generated, confirmed by Dr. Alvarez on Nov 10 - Automated feedback -      |
| not professional engineering advice. Capped at 75% due to: Major - B3 LTB    |
| (EV-STR-0003)   [Resubmit: 1 left, until Nov 17] [Request regrade] [PDF]     |
+------------------------------+---------------------------------------------+
| [3D] [Results table] [Text]  | [Criteria] [Narrative] [Memo claims]        |
| B3 outlined solid red        | v Strength 16/25  Deterministic check        |
| case 1.2D+1.0W+L+0.5S        |   Fail B3 flexure 1.06 [=====|X] > 1.00     |
| legend GRADED SNAPSHOT       |   under 1.2D+1.0W+L+0.5S  AISC 360-22 s F2.2 |
| [Changed since graded]       |   [Show in model] [Explain]  EV-STR-0003     |
|                              | > Engineering judgment 12/15 Adjusted by ... |
+------------------------------+---------------------------------------------+
```

**Regrade.** Criteria checklist, optional evidence chips, reason (about 20 to 500 words), up to 3 attachments; "AI does not change scores on a regrade"; status chip on the feedback header and home row; decision card with per-criterion before and after in words, decider, grade history, "View updated feedback". Outside the window the form is replaced by the closed message.

**Grades and progress (`/learn/courses/:offering/grades`).** Released items only with ProvenanceLabel, raw, penalty and adjusted detail; course outline status with gating reasons; the simple mastery widget (four levels, rule stated); full per-outcome evidence screen is v1.x.

**Discussions, Q&A and announcements.** One Q&A thread per task plus a course thread: question composer with "private to instructors" and "anonymous to peers", answers with accepted and instructor-endorsed marks; announcements list with pinned and read state. Hidden during an exam attempt.

## 7 Instructor and author experience

**Teach home.** Staff banner slot (AI feedback paused with the manual path; quarantine; change freeze); Needs you cards (Review queue with count, flagged and oldest age; Regrade requests; Release pending; Go-live checklist; Unanswered questions); My offerings rows (state, learners, sections, pinned course version, next deadline, inline links); Deadline windows; At risk (no activity 7 days, overdue). Offering overview (`/teach/:offering`) is the same card set scoped to one offering.

**Course setup wizard (6 steps).** Source (platform course or duplicate), Term and dates (date-shift preview table with weekend and holiday collisions, bulk move), Content version (pins exactly one published course version, default latest, listing contained task versions with calibration chips; per-item pinning removed), Roster (CSV dry-run with per-row errors, join code, sections and TAs with grants: grade, release, override, default off for release and override), Settings (code pack read-only with change warning, units, late policy, review policy text), Go-live checklist (roster, dates, every summative task calibrated, review-queue training, support contacts; blocking items link to the fix; platform-admin waiver logged).

**People, schedule, settings.** People: roster table (states, section, last active, extensions), learner panel (transitions, section move, accommodation profile, extensions with reason and recomputed penalty, per-learner gating bypass, View as learner read-only and logged), sections bar. Schedule: available, due and close dates per activity, cohort overrides, date shift, deadline windows. Settings: late policy per task override, review routing defaults, assistance profile tighten-only, Q&A settings.

**Template library.** Filters (type, archetype, tier, structure, code, units, scope, license, calibration status); cards with calibration chip; drawer with scenario, rubric, references, fixtures, provenance, versions; Use template creates an independent copy (copy-only at MVP); Import validated JSON/YAML.

**Course builder (`/author/courses/:course`, new).** Module tree with typed ActivityRows (page, video, slides, PDF, quiz, guided lesson, task, link) by drag-and-drop or Alt+Up/Down, per-item required flag, points, estimated time, completion rule, release and due date template, gating editor ("complete 4.4 before 4.5"), draft/published version strip with changelog, Roles panel (owner, co-author, reviewer, viewer), Preview as learner, authored-content accessibility checker (alt text, headings, contrast, captions).

**Task builder.** Top bar (title, draft vs published with offering usage, autosave, Form/JSON toggle, Preview as learner with seed, Calibrate, Publish). Section rail with completion ticks: Basics (archetype, outcome tags, formative or summative, policies), Code and units (pack read-only, LRFD/ASD, units, precision, size cap S/M), Scenario (presets, groups with applies toggles, per-value given/hidden/randomized, derived-loads preview with formula and clause), Loads and combinations, Constraints (hard/soft/info, soft linked to a criterion, section allow-list, limits, budget), Starter model, References, Rubric and checks, Randomization, Hints (tier 1-3 text, unlock on request or after N failed checks, optional cost), Submission (deliverables, memo catalog, attachments, required snapshots, attempt policy, reveal policy), Assistance profile. Right rail: ValidationRail identical to the publish gate; anchored comments and presence locks are v1.x. Forms at MVP for the common sections; checkpoint DSL and hint unlock conditions are JSON with the tester.

**Starter model (workspace in author mode).** Author tools lock, hide, required, label, group, bind deliverable, seeded error with form equivalents in the Elements table (apply to class); references with expected band and Run checks; deliverable bindings per archetype; workspace preset; variant preview by seed; validation fails when the starter has a mechanism unless marked intentionally unstable.

**Rubric, checks and assistance profile.** Rows are the DLV-15 enum with learner titles and the archetype activation matrix (Design: Model validity 10, Loads and combinations 15, Strength 25, Serviceability 10, Stability 5, Code minimums 5, Economy 10, Constructability 5, Engineering judgment 15; Analyze AA 60, MV 15, LC 15, EJ 10; Check CR 70, LC 10, EJ 20; Diagnose DG 75, MV 10, EJ 15; Optimize EC 35 behind the feasibility gate); inactive rows absent. Task constraints are a gate editor, not a dimension. Gate options: Critical cap 50%, Major cap 75%, fail task; stability defaults to Critical cap 50%. Scoring functions: step, fraction-scaled in the pass region, linear margin, level map; judged criteria need at least 3 levels, learner explanation and grader-only notes, "not awardable above level N without confirmation". Auto-checks from the catalog with parameters, tolerance, severity and learner message templates. AI guidance (expected insights, required memo concepts, register) and review-ordering triggers. Assistance profile presets coach, summative (disclosure level 2, self-check capped 3), exam, with institution caps inline and a preview of "What help is available".

**Randomization and seed explorer.** Numeric ranges and choice sets with units and bindings (derived expressions v1.x); well-posedness constraints; warnings for invalidated static references and un-randomized summative tasks; seed or learner lookup resolving values with feasibility from the last calibration; sample table of 20 seeds.

**Calibration report.** Gate banner (passes, warnings, blocks) with tiles (references in band, seeds feasible, fixtures, judge p95, cost per grade, analysis p95, auto-sized reference coverage); tabs References, Seeds, Fixtures, Checks, Feedback preview; fix suggestions deep-linking to the section; stale notice after any grading-affecting edit.

**Publish dialog.** Step 1 gate; step 2 diff classified grading-affecting versus cosmetic with pin changelog links; step 3 in-flight attempts: when grading-affecting changes exist and attempts are started, publishing is blocked ("Grading-affecting changes cannot be published while 42 attempts are started in Fall 2026 CE 331; publish as a new version for new offerings or after the due date"); cosmetic-only diffs offer hot-apply with a learner notice; step 4 changelog (required) and optional review request. The three-way regrade policy is v1.x.

**Guided lesson builder.** Steps rail (reorder by keyboard), block editor, highlight target picker, checkpoint JSON with the condition catalog and a live tester tree (sub-condition results, timing, parity check that the condition is achievable in Tables), failure hint, preview as learner.

**Lesson editor and quiz builder (sketch).** Lesson blocks: text with LaTeX, tables, callouts, images with required alt text, video, PDF, inline knowledge check, embedded model block configurator (snapshot, mode view-only/explore/sandbox, overlays, camera preset, deflection scale, reset). Quiz builder: MC, multi-select, true/false, unit-aware numeric with unit and tolerance, time limit, attempts, shuffle, feedback timing, question bank (v1.x).

**Review queue.** Degraded banner (LLM paused, backfill age); task version and section filters (TA locked); tabs Needs review, Accepted (awaiting release), Released, Quarantined; sort flags then confidence ascending ("ordering only; never releases"); filter chips for the enumerated flag reasons; rows with learner, section, attempt, submitted and late chip, AI total, confidence word, flag chips and deterministic summary, age, reviewer. Bulk accept applies only to unflagged rows above the tenant threshold, is enabled only after the reviewer has opened at least one submission of the task, writes "accepted in bulk by <name>" to grade history and shows an Undo toast; accepts stay reversible until release. ReleaseControl (shared with the gradebook strip): "Release N reviewed", "Hold until all graded", confirmation with the notification preview; blocked while any summative judged criterion is pending unless graded manually with a reason. Keys j/k/x/a/r only while the grid has focus.

```
+-----------------------------------------------------------------------------+
| ! AI feedback pending for 12 submissions (route paused 09:40). Deterministic |
|   criteria are ready; grade judged criteria manually or wait.   [Details]    |
| Task [Portal frame v3] Section [A,B] Needs review 23 - Accepted 14 - Released 0|
| [x] unflagged (9)  [Accept AI proposal (9)]  [Release 14 reviewed] [ ] Hold  |
| Learner      Sec Att Submitted   AI  Conf   Flags / summary            Age   |
| Okafor, D.   A   2/3 Nov 25      48  Low    Critical gate: mechanism N7 2 h  |
| Lund, M.     B   1/3 Nov 25      61  Medium Near pass; M2 1.08           4 h  |
| Alvarez, R.  B   1/3 Nov 24 late 88  High   none - 0 fails - memo L3    1 d  |
+-----------------------------------------------------------------------------+
```

**Review screen.** Header: queue position, learner, task version, attempt, AI-provisional total and current total recomputed from rows, GateBanner, flag chips. Left: snapshot viewer with 3D/Tables, combination switcher, overlay selector, feedback overlay list, result tables, Open in inspect mode, Fork to my sandbox. Centre: archetype comparison table first when applicable, then CriterionCards with evidence, judge rationale, memo claim verdicts, Accept and Adjust (ReasonRequiredAction, minimum 10 characters, suggested chips); score rules in GRD-03 words. Right: pin set popover, exam attestation chip (green, amber, red with reasons; platform fault attributed to the platform), IntegrityContextChip with the fixed "not proof of misconduct; no score effect" text, lateness, memo panel with claim highlights, attachments, snapshots status, pledge and disclosures, Instructor note ("numbers in notes are not checked against evidence"), Accept all AI (unflagged only), Save and next, Release, Request second grader. Below 1366 px the summary rail becomes a drawer first, then the viewer a tab.

**Regrades.** Open, decided and rejected lists with assignee and decision due; detail with the learner reason (marked as quotation, screened), contested criterion evidence and the task limit table, Uphold, Adjust criterion with reason, Escalate; GradeHistoryTimeline (AI proposed, accepted, accepted in bulk, released, adjusted, regrade requested and decided, regraded) with export.

**Gradebook.** Sticky grid with status chips (late, resubmitted vN, under review, provisional, held, under appeal, re-verifying, missing, excused, AI pending on formative rows only); cell drawer with raw, penalty, hint deductions, adjusted, provenance, grader version, Open review, Override (reason), History; ReleaseControl strip per task; generic CSV export written to the disclosure log with the D1 line; learner view shows released items only.

**Insights.** Tabs Progress (funnel per activity), Mistakes (ranked bars by clause or category with drill-down, section-scoped; "n < 20: distributions hidden"), Task stats per version, AI agreement per grader version with the not-comparable label.

**Similarity report (`/teach/:offering/integrity`, new).** Policy header (collaboration and AI-use policy of the task), fixed statement "Similarity and process signals are not proof of misconduct and never change a score", "not randomized" and "low information (starter-dominated)" labels, threshold slider, ranked pair table (composite and per-component mini-bars, cohort baseline histogram with the pair marked, who submitted first), pair detail with synchronized side-by-side viewers (matching elements one colour, differences dimmed; Tables alternative), section-assignment diff, EditCadenceSummary per party, memo similarity signals; TA rows limited to own sections; every view written to the disclosure log; "Open case" disabled with "v1.x". Never visible to learners or in exports.

```
+-----------------------------------------------------------------------------+
| SIMILARITY  4.4 Portal frame v3   policy: individual, AI with disclosure     |
| Similarity is not proof of misconduct and never changes a score.  Threshold o|
| Pair                 Composite  geometry sections loads  baseline   first    |
| Chen L. / Diaz M.    0.91       ####      ####    ###   top 0.5%   Chen 9:41 |
| Rao S. / Lund M.     0.74       ###       ##      ###   top 4%     Rao       |
+-------------------------------------+---------------------------------------+
| Chen v2 [3D|Tables]  matching = teal | Diaz v1   differences dimmed          |
| Section diff: 14 of 16 identical    | Cadence: Chen 3 sessions, 412 ops ... |
+-------------------------------------+---------------------------------------+
```

## 8 Admin and operator surfaces (sketch)

Admin home: tenant plan state with pilot end date, seat usage, Invite members, Import roster; tiles Members, Roles and scopes, Roster imports, Offerings (structure only), Settings (units, code pack edition, time zone, grading scale, auth and MFA policy, pledge text, AI-use default, training opt-in, retention), Usage, Audit log, Disclosure log, Support sessions, Data requests (statutory clock, legal-hold check, approve with reason), Feature flags (read-only); v1.x tiles locked with a contact path. Institution defaults summary with the inheritance rule; recent admin activity. Operate home: global id search, MFA freshness, change-freeze banner; invariant strip (lost work, reconciliation age, dead-letter, oldest queued); LLM line (kill switch, paused tenants, spend, cache share, pending judged); tiles with live qualifiers (promotion awaiting second approval, SLA at 80%, DSR clock); queue by lane with runbook controls; incidents and deadline windows with Declare incident; MVP exit-criteria dashboard. Every write opens a reason dialog with before and after; every read of a submission or grade notes "This view is written to the tenant's disclosure log"; view-as is read-only, impersonation needs a consent token, reason and time box and shows a countdown banner.

## 9 Design system

**Tokens.** One `tokens.json` generates `tokens.css`, `tokens.ts` and `viz-palette.json` for the renderer; components reference semantic, canvas, viz, density and component tokens only (stylelint forbids raw hex and primitives). Three colour jobs never mix: accent (indigo) for interaction and selection, status set (pass green, warn amber, fail red, info blue, not-checked gray, pending accent-tinted), theme-invariant data encodings. Chrome has light and dark themes; the canvas has light, dark and print themes and every export renders in print. Impersonation red is the one documented exception to the red rule (an operator writing as another person).

**Typography and numbers.** Inter Variable (tabular, lining figures), JetBrains Mono (hashes, coordinates, command line), KaTeX (memos, clause pages); scale 11-30 px, 14 px body, 13 px data rows, 11 px legend ticks only; numbers right-aligned, unit after a thin space, true minus, 3 significant figures (4 in tables, probes and exports), deflections 0.1 mm or 0.01 in, DCR 2 decimals (3 when rounding would hit the limit), comparisons in SI before formatting.

**Engineering encodings.** Utilization: cividis(10) bands 0 to 1.00, hatched amber 1.00-1.02 tolerance (GRD-03 advisory), hatched red with outline above 1.02, target bracket 0.70-1.00 for Design and Optimize, banded default, pattern-only mode; every colormapped member gets a 1.5 px halo in the inverse canvas colour. Acceptance: legend swatches at least 3:1 against the legend background with a 1 px border, monotonic lightness under CVD simulation, hatch and numeric labels as the non-colour channel (adjacent bands are not required to reach 3:1). Diverging blue-neutral-orange for signed quantities with a 2% zero band and the convention printed. Load cases: Okabe-Ito hues with letter tags. Diagram components: N teal (`#0E8C8C`, outside the accent and categorical sets), V2, V3, M2, M3, T as tokens; sign by side and fill; load arrows dim to 30% while a ribbon is on; selection uses the double outline plus halo so hue is never the only cue. Grader overlay: Fail solid 3 px, Warn dashed 3 px, Notice dotted 2 px, numbered pins. Status glyphs plus words always.

**Components (canonical names; other names in the source designs are aliases).** Button, TaskStatusChip, CheckStatusChip, SeverityChip, ProvenanceLabel, DeadlineLabel, ReceiptChip, ClauseChip, CombinationChip, LoadCaseChip, DcrMeter, EvidenceRow and EvidenceTable, CriterionCard, GateBanner, IssueCard, ClaimVerdictRow, ConfidenceIndicator (staff only), FlagChips, UnitInput, EntityRefPicker, SectionPicker, SliderWithInput, DataTable (grid contract), FormSection, ValidationRail, InlineValidation, ReasonRequiredAction, Toast, InlineAlert, ModeBanner, GradingStatusTimeline, NotificationItem, ResumeCard, OfferingCard, ActivityRow, ChecklistCard, EmptyState, Skeleton, Tooltip, HelpAffordance and HelpPanel, DisclaimerBadge, EntitlementLock, ScopeBadge, and the workspace kit: ToolRail, CanvasViewport, NavigationCube, CaseSwitcherPill, LiveStatePill, LiveModeMenu, SizeCapMeter, SnapIndicator, TransformGizmo, PropertyPanel, ModelTree, LoadCasePanel, ResultOverlayControls, ResultLegend, ProbeCard, DiagnosticsList, MechanismCard, SelfCheckPanel, DeliverablesDock, SnapshotCaptureDialog, TabularEditorGrid, TextualSummary, CommandPalette, ReleaseControl, ElementFlagTable, ModelViewerSnapshot.

**States.** Every component defines default, hover, focus-visible (double ring), disabled with reason, loading, empty, error; data components add stale, pending, unverified and changed-since-graded.

**Motion.** fast 100 ms, base 180 ms, slow and camera 300 ms, deformed loop 2 s, stale pulse 1.2 s outline only; reduced motion zeroes all of them, shows the static maximum deformation and removes pulses; numbers, meters, legends, totals and countdowns never animate. Toasts: 8 s with an action, 5 s informational, paused on hover and focus, maximum three; danger toasts persist.

**Density and responsive.** Compact (28 px rows) in workspace panels, default (36 px) on LMS pages, comfortable (44 px) for coarse pointers; xl two panels, lg one panel plus icon rail, md (1024-1279) drawers and the below-1280 banner, sm tablet read-only workspace, phone reading only with "Open on a laptop". 200% zoom on LMS pages behaves as md; the Tables layout stays fully usable.

## 10 Accessibility

WCAG 2.2 AA for all non-canvas UI plus the R16 parity path. Landmarks and a skip link in the shell; in-workspace skip links; h1 focus on route change with a polite title announcement; route-changing tabs are links with `aria-current`; outlines are nested lists with disclosure buttons; grids follow the one grid contract (Tab leaves the composite). Single-key shortcuts fire only while their composite has focus and can be switched off in Settings (2.1.4); no browser-reserved combinations (registry denylist). Focus is never trapped in the canvas; sticky headers use scroll-margin (2.4.11). Every drag has a numeric or menu twin: gizmo deltas in the property panel, splitters as `role=separator` with arrow keys and View > Panel width, probe cards dockable from a menu (2.5.7). Targets 24 px, 44 px touch (2.5.8). One polite status live region announces analysis-state transitions, self-check and submit completion at MVP; per-change narration is v1.x. Canvas container: `role=application`, short name and description, keyboard camera; the full textual summary is a named region. Contrast: text 4.5:1, large text and glyphs 3:1, tested in CI for every fg/bg pair in both themes plus CVD simulation; forced-colors mode uses system colours for chrome and pattern-only results. Timing: exam announcements at 30/10/5 polite and 1 minute assertive; session idle warning 5 minutes before sign-out with Extend and guaranteed autosave; a 30 s warning before a team edit lock auto-releases (v1.x). Authentication (3.3.8): no cognitive tests, paste allowed in password and TOTP fields, passkeys primary, recovery codes readable. Release gate: axe zero serious or critical; manual NVDA and VoiceOver passes on learner and instructor flows (home, task, workspace in Tables, submit with a required snapshot, feedback; review queue, review screen with the Tables tab, task builder, calibration report, publish dialog); the canvas-versus-tables hash-equality e2e.

## 11 Content and copy rules

- Voice: plain, direct, second person for guidance, sentence case, no exclamation marks, no blame; errors say what, where and the fix.
- Learner vocabulary: "course" (offering with term), "module", "activity"; archetypes as phrases ("Design task", "Analyze task", "Check task", "Find the errors task"); tier codes, model tiers, preset names and outcome ids never in learner copy; every remaining term has a glossary tooltip bound to a help id.
- Task states: Not started, In progress, Submitted, Under review, Graded, Resubmission requested, Locked, Overdue, Closed, Held, Exam. Pipeline stages: Received, Analyzed, Checked, AI feedback, Instructor review, Released. Analysis state: Fresh, Solving, Stale (reason), Paused, Unstable, Failed, Offline; "Validity only" when results are hidden by the profile. Diagnostics: Error (blocks analysis), Warning, Notice. Check status: Pass, Warn, Fail, Not checked, Pending. Severity (staff and gate copy): Critical, Major, Minor, Advisory (evidence `info` maps to Advisory).
- ProvenanceLabel strings: "Deterministic check"; "AI-generated, pending instructor review" (dense cells: "AI-provisional", with the D2 sentence in the tooltip); "AI-generated, confirmed by <name> on <date>" with the secondary line "accepted without changes" when bulk-accepted; "Adjusted by <name>" with the reason link; "Regraded under grader <version>"; "Instructor graded (no AI)"; "AI feedback pending"; "Under appeal"; "Under re-verification"; "Assisted by operator". "Overridden" is audit-log vocabulary only.
- Units: task working units primary, converted value secondary; kN, kN·m, MPa, mm, m, kN/m², kN/m or kip, kip·ft, ksi, in, ft, psf, kip/ft; thin space before the unit, middle dot in products; never a bare number for a physical quantity.
- Figures: 3 significant figures (4 in tables and exports); deflections 0.1 mm or 0.01 in; DCR 2 decimals, a third when rounding would equal the limit while the SI comparison fails (1.004 Fail, never 1.00 Fail); span ratios L/412; percent whole numbers.
- Clauses: "<Code> <edition> §<clause>" with the paraphrased title in the tooltip ("AISC 360-22 §F2.2 (lateral-torsional buckling)"); never verbatim standard text; Official source link-out; pack provenance line under evidence ("Checks: us-aisc360-22@1.3.0 · verified <date>").
- Combinations: "1.2D + 1.6L + 0.5S", "0.9D − Ev + Eh", the word "governing" next to the governing one.
- Deadlines: "Due Fri Oct 17, 11:59 PM CDT (course time)"; dual zone when they differ; relative forms only within 7 days and always beside the absolute date; extensions "Extended to Mon Oct 20 for you"; lateness "Late penalty now 10% (5% per day, max 30%)".
- Hashes: "sha256:3f9a…c21e" with copy-full and one sentence of purpose; receipts "Received Oct 10, 9:41 PM CDT - version 2 - receipt sha256:9f3a…12ab".
- Gates: "Capped at 50% due to: mechanism (Critical, EV-STB-0001)"; the uncapped value in a tooltip.
- Safety sentence whenever grading is delayed: "Your submission is safe. We received it at <time> (receipt <hash>). No action is needed. Next update at <time>." Held grades use one sentence for every reason: "Your grade is under review by your instructor."
- Disclaimers: D1 "Educational use only. Not for construction, permitting, or professional engineering use. Results are not a substitute for analysis and design by a licensed engineer." (status-bar badge, export footers, CSV header, JSON metadata); D2 on every AI panel; D3 certificates; D4 API envelope; D5 Credits; sandbox watermark. Never "engineer of record", "stamped", "sealed", "PE".
- Generated, never hand-written: exam pre-start lists, "What help is available", "What Bridle records in this task", the AI transparency notice, the memo notice.
- Buttons are verb-first and specific: Resume, Open workspace, Check my design (3 left), Submit attempt 2, Read feedback, Show in model, Explain F2.2, Request regrade, Release 14 reviewed, Grant extension, Declare incident.
- Empty states are one sentence plus one action; permission denials name the reason ("This submission belongs to Section A; you are a TA for Section B").

## 12 Open questions

1. Memo weight for Design tasks: 15 (DLV-15, working default) versus 20 (AI grading template) versus 5 (GRD-02); the pilot instructor decides.
2. Reveal of reference values with attempts remaining: withhold until the due date (default) or re-seed per attempt.
3. Default TA grants in the pilot: accept and escalate only (default) or release and override.
4. Should the 1.00-1.02 tolerance band be visible in the live colormap and self-check (default yes, labelled "tolerance") or only in grading evidence.
5. Default UI theme for the workspace (follow OS, default) and whether the independent canvas-theme setting ships at MVP.
6. Exam default results visibility per archetype (analysis-only for Analyze and Check, none for Design) needs pilot confirmation.
7. Tenant URL prefix `/o/:org` (default) versus per-institution subdomains; decide before routes freeze.
8. Pattern-only results in WebGL2 within the Tier S/M frame budget, or as a 2D overlay layer.
9. Whether formative tasks with deterministic-only grading show any AI narrative; and whether instructors ever review formative grades (if never, drop "may change if reviewed").
10. Diagnose tasks in the MVP course (recommended 2-3 scope-locked T1-T2); otherwise the Found errors panel ships behind a flag.
11. Phone scope: read-only home, feedback and discussions assumed; confirm whether Q&A composing is needed on phones.
12. Process: the relayed user request about the Build Monitor dashboard (uncompressed layout, working versus idle agents, progress board, current-phase activity) was implemented in commit fdb22a2 before this workflow ran; confirm with the user that no further monitor changes are wanted.

## 13 Deferred to v1.x

Live-region narration of every canvas change and a formal ACR; team projects (ownership badge content, locks, co-sign, team grades, version timeline), peer review; integrity cases and the learner case view; three-way in-flight republish with regrade; derived randomization parameters, visual checkpoint condition builder, presence locks and anchored comments; course version diff view; instructor calibration dashboards (GRD-05) and LLM variance reports; full learner outcomes profile, heatmaps, paths, certificates, saved-model portfolio, public catalog and live demo; LTI, SAML, SCIM, integrations, departments, billing, tenant branding (logo only); Measure tool, Y-up display preference, two-way load panels, DXF/IFC export, tablet modeling; comfortable density on laptops; question banks; messaging from at-risk lists; operator runbook automation; Eurocode and NSCP packs and reinforced concrete checks.
