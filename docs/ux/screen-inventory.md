# Screen inventory

79 screens, 69 in the MVP. Full definitions in ux-spec.md and surfaces/.

| # | screen | roles | MVP |
|---|---|---|---|
| 1 | App shell (top bar, mode/org switcher, banner slot, per-mode rail, context header, footer) | All signed-in users | yes |
| 2 | Sign-in, sign-up, verify email, reset password, MFA step-up, invite and join, organization picker | All | yes |
| 3 | Onboarding tutorial (10-minute guided lesson) | Learner, self-serve instructor | yes |
| 4 | Settings: profile, appearance, display and units, accessibility (incl. single-key shortcuts switch), security, notifications, privacy and data | All | yes |
| 5 | Command palette and global search results | All (scoped results) | yes |
| 6 | Help panel, system check, What's new | All | yes |
| 7 | Notifications inbox and tray | All | yes |
| 8 | 403, 404, unsupported browser | All | yes |
| 9 | Public catalog and logged-out live demo | Anonymous | v1.x |
| 10 | Learn home (Resume, Due in 7 days, Feedback ready, My courses, Outcome progress) | Learner | yes |
| 11 | Task list (cross-course and per offering) | Learner | yes |
| 12 | Course outline | Learner; staff via Overview; author preview | yes |
| 13 | Grades and progress (released items, outline status, simple mastery widget) | Learner | yes |
| 14 | Discussions: task Q&A thread, course thread, announcements | Learner, staff | yes |
| 15 | Task page (brief, given data, constraints, rubric, help available, checklist) | Learner; author preview; staff view-as | yes |
| 16 | Content activity viewer (page, video, slides, PDF, link, embedded model block) | Learner | yes |
| 17 | Quiz attempt and results | Learner | yes |
| 18 | Guided lesson with auto-verified checkpoints | Learner; author preview | yes |
| 19 | Workspace shell (canvas / tables / both layouts; 2D planar mode) | Learner; author mode; staff inspect; operator replay | yes |
| 20 | Modeling interactions (drawing, snapping, gizmo, properties, section picker, grids and levels) | Learner, author | yes |
| 21 | Loads, cases, combinations and load-source explorer | Learner, author | yes |
| 22 | Live results (deformed shape, diagrams, utilization legend, reactions, probes, results table, cost) | Learner, staff, author | yes |
| 23 | Diagnostics and validity (mechanism card, cap meter, timing popover) | Learner, author, staff | yes |
| 24 | Self-check panel (Check my design) | Learner; author dry-run; staff read-only | yes |
| 25 | Deliverables dock (report values, findings, found errors, memo, snapshots, attachments, checklist) and memo editor | Learner | yes |
| 26 | Snapshot capture and export (incl. sidecar-based capture on the Tables layout) | Learner, author, staff | yes |
| 27 | Submit dialog | Learner | yes |
| 28 | Exam pre-start, in-exam banner, session takeover | Learner; author preview | yes |
| 29 | Notices: what Bridle records, how AI grading works | Learner | yes |
| 30 | Receipt and grading status | Learner; staff in review context | yes |
| 31 | Feedback page (3D / results table / text summary; criteria, narrative, memo claims; archetype variants) | Learner | yes |
| 32 | Regrade request and decision | Learner | yes |
| 33 | Command palette and shortcut reference (workspace) | All workspace users | yes |
| 34 | Team-project variants (ownership, locks, co-sign, team grade) | Learner (team member) | v1.x |
| 35 | Peer review mode | Learner | v1.x |
| 36 | Learner outcomes profile, saved models, paths, certificates | Learner | v1.x |
| 37 | Sandbox (sample tasks, deterministic-only grading) | Learner, self-serve users | yes |
| 38 | Teach home | Instructor, TA | yes |
| 39 | Offering overview | Instructor, TA | yes |
| 40 | Course setup wizard and go-live checklist | Instructor; admin may start | yes |
| 41 | People: roster, sections, extensions, accommodations, gating bypass, view-as | Instructor; TA (scoped); admin (structure) | yes |
| 42 | Schedule: dates, cohort overrides, date shift, deadline windows | Instructor | yes |
| 43 | Offering settings (late policy, review routing, assistance profile tighten-only, Q&A) | Instructor | yes |
| 44 | Review queue | Instructor; TA (own sections) | yes |
| 45 | Review screen (evidence-first grade review) | Instructor; TA; second grader | yes |
| 46 | Regrade requests and grade history | TA (scoped), instructor | yes |
| 47 | Gradebook with ReleaseControl and cell drawer | Instructor; TA (scoped, no release unless granted); learner view | yes |
| 48 | Cohort insights (progress, mistakes by clause, task stats, AI agreement, at-risk) | Instructor; TA (scoped); author (stats only) | yes |
| 49 | Similarity report | Instructor; TA (own sections); course lead | yes |
| 50 | Teach discussions and announcement composer | Instructor, TA | yes |
| 51 | Calibration dashboards (GRD-05) | Instructor | v1.x |
| 52 | Integrity cases and queue | Instructor, integrity officer | v1.x |
| 53 | Teams management | Instructor | v1.x |
| 54 | Author home | Author | yes |
| 55 | Template library | Author, instructor | yes |
| 56 | Course builder (modules, activities, gating, dates template, points, roles, a11y checker) | Author | yes |
| 57 | Course versions (draft vs published, changelog) | Author | yes |
| 58 | Task builder (12 sections, form and JSON, validation rail) | Author; reviewer | yes |
| 59 | Starter model: workspace in author mode | Author; reviewer | yes |
| 60 | Rubric, checks, AI guidance and assistance profile | Author; instructor (tighten only) | yes |
| 61 | Randomization and seed explorer | Author; instructor (seed lookup) | yes |
| 62 | Calibration report | Author; instructor (read) | yes |
| 63 | Publish dialog (gate, diff classification, in-flight block, changelog) | Author with publish right; reviewer | yes |
| 64 | Guided lesson builder with checkpoint tester | Author | yes |
| 65 | Lesson editor with embedded model block | Author | yes |
| 66 | Quiz builder | Author | yes |
| 67 | Presets: environment presets, cost models, libraries | Author | yes |
| 68 | Content review (items in lightweight review) | Author, reviewer | yes |
| 69 | Course version diff view | Author | v1.x |
| 70 | Admin home and institution defaults | Institution admin | yes |
| 71 | Admin members, roles and scopes, roster imports, offerings (structure only) | Institution admin | yes |
| 72 | Admin settings, usage report, audit log, disclosure log, support sessions, data requests, feature flags (read-only) | Institution admin | yes |
| 73 | Admin integrations, integrity policy, departments, billing | Institution admin | v1.x |
| 74 | Operate home (invariant strip, LLM line, tiles, queue by lane, exit criteria) | Platform operator | yes |
| 75 | Operate search, tenants, jobs and job inspector, dead-letter, reconciliation | Platform operator | yes |
| 76 | Operate artifacts and promotion, pins and quarantine, LLM budgets and kill switch, flags | Platform operator | yes |
| 77 | Operate incidents, deadline windows, support tickets, replay, data requests, metrics, onboarding | Platform operator | yes |
| 78 | Operate policies (runbook automation) | Platform operator | v1.x |
| 79 | Design-system reference site (tokens, typography, encodings, components, patterns) | Product engineers, designers | yes |
