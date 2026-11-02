# Information architecture and navigation

_Surface design from the UI/UX workflow (designer agent), 2026-11-03. 14 screens, 10 flows, 20 components._

## Summary

Bridle is one web application with one shell and five modes chosen by the first path segment after the organization prefix: Learn (learners, sandbox users), Teach (instructors and TAs; TAs see the same rail with a section-scope badge and fewer actions), Author (course authors; no learner grades), Admin (institution admins) and Operate (platform admins; MFA step-up within 12 h, not tenant-scoped). The mode switcher lists only the modes the user holds in the current organization; deep links set the mode from the URL, so a notification for a TA who is also a learner lands in Teach with the right offering and section scope. The organization is a path prefix (/o/:orgSlug) so that invite and notification links are unambiguous for users who belong to several tenants (ROLE-01, TEN-01) and so that the free sandbox is simply the platform-owned tenant /o/sandbox. The learner's and instructor's unit of navigation is the Offering (labelled "course" with its term in learner copy); the Course blueprint and its versions live only in Author mode, and each offering header states the published version it pins (CRS-02). Inside an offering the context header carries entity tabs: learners get Outline | Tasks | Grades | Discussions | Announcements; staff get Overview | Review | Gradebook | People | Schedule | Insights | Discussions | Integrity | Settings. The product loop (task -> workspace -> self-check -> memo -> submit -> reviewed feedback -> resubmit) is reachable in one click from every learner surface through a Resume card that restores the exact activity and draft (PRG-02, PER-01), and the review queue is one click from every staff surface (PER-07, R11). Scope and degraded conditions are always visible in the shell as banners and badges (section scope, exam mode, author preview, support view-as, impersonation with timer, read-only tenant, LLM-paused grading, change freeze), never silent. All deadlines are rendered server-side from the learner's effective due date with an explicit time-zone label (SCH-01, NFR-09). Every grade number is preceded by a provenance label (AI-provisional, Reviewed by, Adjusted by, Under appeal, Under re-verification, AI feedback pending) per PRD-03 and GAP4-OPS-06/07. The workspace, review screen and authoring builders are designed by sibling agents; this surface defines how users reach them and what they land on.

SITEMAP AND SCREEN INVENTORY (routes under /o/:org unless marked global; [MVP] or [v1.x])
Entry and account (global): /sign-in [MVP] (email+password, Google, Microsoft; MFA challenge for instructor/author/admin accounts per R12) - /sign-up [MVP] (role intent student | practitioner | instructor -> sandbox tenant home) - /verify-email, /reset-password, /mfa [MVP] - /invite/:token, /join/:code [MVP] - /orgs (organization picker, remembered) [MVP] - /onboarding (10-minute first-analysis tutorial, skippable, relaunchable from Help) [MVP] - /settings/{profile,display,accessibility,security,notifications,privacy} [MVP] - /system-check [MVP] - /whats-new [MVP] - /search?q= [MVP] - /403, /404, /unsupported-browser [MVP] - / public catalog and logged-out live demo [v1.x] - /lti/launch [v1.x] - /verify/:certificateId [v1.x].
Learn: /learn home [MVP] - /learn/tasks [MVP] - /learn/grades [MVP] - /learn/courses/:offering (Outline) [MVP] - /learn/courses/:offering/{tasks,grades,discussions,announcements} [MVP] - /learn/courses/:offering/activities/:activity (task page, lesson, guided lesson, quiz, page, video, PDF, link) [MVP] - .../activities/:activity/workspace (full-screen workspace; slim header; owned by ux-workspace-3d) [MVP] - .../activities/:activity/exam (pre-start screen) [MVP] - .../activities/:activity/submissions/:n (version, receipt, feedback) [MVP] - .../submissions/:n/regrade [MVP] - /learn/courses/:offering/discussions/:thread (one Q&A thread per task plus course thread) [MVP] - /learn/sandbox (sample tasks, deterministic-only grading, hard-capped) [MVP] - /learn/models (saved-model portfolio, share links) [v1.x] - /learn/paths (practitioner paths, exam-spec tags) [v1.x] - /learn/outcomes (full mastery profile; home shows the simple widget at MVP) [v1.x] - /learn/certificates [v1.x] - /learn/courses/:offering/team [v1.x] - /learn/courses/:offering/activities/:activity/peer-review [v1.x].
Teach: /teach home [MVP] - /teach/new (new-offering wizard: course version, term date-shift, sections and TAs, roster, go-live checklist) [MVP] - /teach/:offering (Overview) [MVP] - /teach/:offering/review and /review/:submissionVersion (queue and review screen; owned by ux-instructor-author) [MVP] - /teach/:offering/gradebook [MVP] - /teach/:offering/people (roster states, sections, extensions, accommodations, join codes) [MVP] - /teach/:offering/schedule (available/due/close dates, date shift, deadline windows) [MVP] - /teach/:offering/insights (per-task criterion and mistake-tag breakdown, agreement metrics, simple at-risk list) [MVP] - /teach/:offering/discussions and /announcements [MVP] - /teach/:offering/integrity (ranked similarity report, no penalties) [MVP]; cases and integrity queue [v1.x] - /teach/:offering/activities/:activity (task stats, links to builder and queue) [MVP] - /teach/:offering/settings (late policy, review routing, assistance profile tighten-only, Q&A settings) [MVP] - /teach/:offering/go-live (checklist) [MVP] - /teach/:offering/calibration (GRD-05 dashboards) [v1.x] - /teach/:offering/teams [v1.x].
Author: /author home [MVP] - /author/courses/:course (course builder: modules, activities, gating, dates template) [MVP] - /author/courses/:course/versions (draft vs published, changelog; diff view [v1.x]) [MVP] - /author/tasks/:task (sectioned task builder), /author/tasks/:task/calibration, /author/tasks/:task/preview (new tab, banner, seed selector) [MVP] - /author/guided/:id, /author/lessons/:id, /author/quizzes/:id [MVP] - /author/library (platform starter pack copy-only, institution templates) [MVP] - /author/presets (environment presets, cost model, built-in section/material libraries; custom library import [v1.x]) [MVP] - /author/review (items in lightweight review) [MVP].
Admin: /admin home [MVP] - /admin/members and /admin/members/:user [MVP] - /admin/roles [MVP] - /admin/roster-imports [MVP] - /admin/offerings (structure only, no grades) [MVP] - /admin/settings (units, code pack edition, time zone, grading scale, auth methods, pledge text, AI-use default, training opt-in, retention) [MVP] - /admin/usage (seat usage report) [MVP] - /admin/audit and /admin/disclosures [MVP] - /admin/support-sessions (view-as and impersonation list) [MVP] - /admin/data-requests (approve DSR as record holder) [MVP] - /admin/flags (read-only release flags) [MVP] - /admin/integrations (SSO, LTI, LRS, API tokens) [v1.x] - /admin/integrity (policy settings, integrity officer) [v1.x] - /admin/departments, /admin/billing [v1.x].
Operate (global, platform admin + MFA): /ops home [MVP] - /ops/search [MVP] - /ops/tenants, /ops/tenants/new, /ops/tenants/:id [MVP] - /ops/jobs, /ops/jobs/:id (inspector: retry, re-run from stage, cancel, bulk) [MVP] - /ops/dead-letter, /ops/reconciliation [MVP] - /ops/artifacts and /ops/artifacts/:type/:version (registry, two-person promotion) [MVP] - /ops/pins (pin overrides, bulk re-pin, rollback, quarantine) [MVP] - /ops/llm (budgets, per-route disable, kill switch, backfill) [MVP] - /ops/flags [MVP] - /ops/incidents, /ops/incidents/:id, /ops/deadline-windows [MVP] - /ops/support, /ops/support/:ticket, /ops/replay/:bundle [MVP] - /ops/data-requests [MVP] - /ops/metrics (MET-02/03 and MVP-05 exit criteria) [MVP] - /ops/onboarding (go-live checklists, office hours, weekly check-ins) [MVP] - /ops/policies (runbook automation) [v1.x].
Overlays available on every route: command palette and search (Ctrl/Cmd+K), help panel (?), notification tray (bell), org and mode switcher, banner stack.

Proposed implementation files (greenfield, stack-agnostic): apps/web/src/shell/AppShell.tsx (top bar, banners, rail, context header, focus management); apps/web/src/routes.ts (route table with mode, scope requirement and MVP flag; one source for breadcrumbs, palette "Navigate" group and 403 reasons); apps/web/src/shell/ModeSwitcher.tsx and OrgSwitcher.tsx; apps/web/src/shell/CommandPalette.tsx (shared command bus with the workspace per EDIT-04); apps/web/src/shell/Banners.tsx; packages/contracts/permission-matrix.ts (ROLE-01 matrix as data, consumed by the route guard and by UI affordance hiding); docs/ux/ia-navigation.md (this sitemap, kept with the route table).

## Principles

- One shell, five modes. The URL decides the mode (/learn, /teach, /author, /admin, /ops); the mode switcher only navigates and only lists modes the user holds in the current organization. Data is never hidden by mode, only by permission.
- The offering is the unit of navigation for learners and staff; the course blueprint is an author object. Learner copy says "course" with the term; instructor headers state the pinned published version; learners never see version numbers.
- The loop is one click away. Every learner surface has a Resume affordance that restores the exact activity, guided-lesson step and autosaved draft; every staff surface has a path to the review queue with its count and oldest age.
- Scope and degraded states are shell-level, never silent: section scope, exam mode, author preview, support view-as, impersonation (with timer), read-only tenant, LLM-paused grading and change freeze render as banners or badges above the content on every route.
- Deadlines are server-derived and always time-zone labelled: effective due date = extension or cohort override or activity due + cohort offset; shown in the learner's zone with the course zone when they differ; the client clock is never used.
- Provenance before score. Every grade cell, feedback card and notification carries its label (AI-provisional, Reviewed by <name>, Adjusted by <name>, Under appeal, Under re-verification, AI feedback pending) ahead of the number; unreleased items show a state, never a number.
- Keyboard and non-canvas parity at the shell level (R16, A11Y-01): landmarks, skip link, h1 focus on route change, single-key "g" chords outside inputs and outside the canvas, and one command palette that serves navigation everywhere and modeling commands inside the workspace.
- Reading an education record is an audited navigation event: search results and gradebook exports say "viewing this is recorded", and support views write the disclosure log (DAT-01, GAP4-OPS-01).
- Fixed layout, progressive density: one shell layout with a collapsible rail and no dockable panels outside the workspace (MVP guardrail); 1024 px and below collapses to a drawer with read-only surfaces (NFR-10); the workspace needs 1280 x 720.
- Nothing modal in the workspace: help, What's new, announcements and notifications open as panels or trays; exam mode suppresses What's new and announcements entirely (GAP4-HELP-07, GAP5-EXAM-01).
- Educational-use positioning in the frame: the footer on every shell page and every export carries the notice; no engineer-of-record language anywhere in navigation (PRD-02, NFR-DOM-09).

## Screen: App shell and mode navigation (top bar, mode and organization switcher, per-mode left rail, context header, banner stack)

**Roles:** All signed-in users; rail contents, context tabs and switcher entries vary by mode, role and scope (TA sees section scope badge; Operate needs MFA step-up within 12 h) · **Route:** `/o/:org/{learn|teach|author|admin}/* (tenant-scoped); /ops/* (platform); /settings/*, /orgs (account). The full-screen workspace route keeps only a slim top bar.`

Give every role one predictable frame: where am I (org, mode, offering, module, activity), what can I switch to, what is degraded or scoped right now, and how do I search, get help or see notifications without leaving the page.

```
+-------------------------------------------------------------------------------------------------+
| [=] Bridle | Learn v |  State University v  |  CE 371 Steel Design (Fall 2026) > Module 4 > 4.4 |
|            |         |                     [ Search or jump to...   Ctrl+K ] [?] [Bell 3] [JG v] |
+------------+------------------------------------------------------------------------------------+
| LEFT RAIL  | BANNER SLOT (stacked, max 2 visible, rest in a "+1 more" disclosure):              |
| (Learn)    |   incident | AI feedback paused | preview | view-as | impersonating 00:41:12 |     |
|            |   read-only tenant | change freeze | EXAM MODE (non-dismissable, accent border)    |
| > Home     +------------------------------------------------------------------------------------+
|   Tasks  5 | CONTEXT HEADER  CE 371 Steel Design  Fall 2026  [Section B]  US pack v1.2  US units|
|   Courses  |   Tabs: [Outline] [Tasks] [Grades] [Discussions] [Announcements]                   |
|   > CE 371 +------------------------------------------------------------------------------------+
|     CE 450 |                                                                                    |
|   Grades   |   MAIN  role="main"  (h1 receives focus on every route change)                     |
|   Sandbox  |                                                                                    |
|            |                                                                                    |
| ---------- |                                                                                    |
|   Inbox  3 |                                                                                    |
|   Help   ? |                                                                                    |
|   What's new                                                                                    |
| [<] Collapse                                                                                    |
+------------+------------------------------------------------------------------------------------+
| Educational use only; not for construction  |  Status  |  Docs  |  Release 2026.11.2  |  CDT   |
+-------------------------------------------------------------------------------------------------+

MODE SWITCHER (opens from "Learn v"; lists only modes held in the current org):
+--------------------------------------------------+
| (o) Learn    2 courses                           |
| ( ) Teach    Instructor: CE 371 - TA: CE 450 sec B|
| ( ) Author   3 courses, 2 drafts                 |
| ( ) Admin    State University          [MFA]     |
| ( ) Operate  Platform                  [MFA <12h]|
|--------------------------------------------------|
| Organization: State University v   (Sandbox ...) |
+--------------------------------------------------+

LEFT RAIL BY MODE:
 Learn  : Home | Tasks (n) | Courses (expand current offering) | Grades | Sandbox | Inbox | Help
 Teach  : Home | Offerings (expand current: Overview, Review (n), Gradebook, People, Schedule,
          Insights, Discussions, Integrity, Settings) | Inbox | Help      TA: same rail, section badge,
          no Settings, no Release actions
 Author : Home | Courses | Tasks | Guided lessons | Lessons | Quizzes | Library | Presets | Inbox | Help
 Admin  : Home | Members | Roles | Roster imports | Offerings | Settings | Usage | Audit |
          Disclosures | Support sessions | Data requests | Flags (read-only)
 Operate: Home | Search | Tenants | Jobs | Dead-letter | Artifacts | Pins | LLM | Flags |
          Incidents | Windows | Support | Data requests | Metrics | Onboarding

RESPONSIVE: >=1280 rail expanded (240 px); 1024-1279 rail icons only (56 px) with tooltips;
<1024 hamburger drawer, read-only surfaces (home, feedback, discussions); workspace route shows
"Open on a laptop (1280 x 720 or larger)" with the tabular editor offered instead.
```

**Regions:**
- Top bar (role=banner): hamburger (rail toggle), product mark (goes to mode home), mode switcher, organization switcher, breadcrumb (mode root > offering (term) > module > activity; in Author: Author > course > version vN draft > module > task), search field (opens palette), help (?), notification bell with unread count, account menu (profile, settings, switch org, sign out).
- Banner slot: stacked targeted banners from GAP4-OPS-11 incidents, GAP4-OPS-07 LLM degradation (staff only, learner sees it on feedback pages), PV-01 preview, GAP4-OPS-08 view-as / impersonation with countdown and "end session", BIL-04 read-only tenant, GAP4-OPS-11 change freeze (Operate only), GAP5-EXAM-03 exam banner (replaces top-bar actions except help; non-dismissable).
- Left rail (role=navigation, aria-label by mode): mode-specific items with counts; current offering expanded; collapsible, state persisted per user; bottom group Inbox, Help, What's new.
- Context header: entity name, term, scope badge (Section B / Team / Preview / Read-only), pinned code pack and unit system, entity tabs (role-dependent), primary action (Resume for learners; Review queue count for staff).
- Main (role=main): page content; h1 is the focus target after navigation.
- Footer (role=contentinfo): educational-use notice, status page link, docs link, release version, current display time zone.

**Key data:**
- Current organization (slug, name, plan state, read-only flag), list of organizations the user belongs to
- Modes held in the current org with scope summaries (offerings taught, sections, draft counts), last-used mode per org
- Breadcrumb entities resolved from the route (offering name and term, module, activity title and type)
- Unread notification count; active targeted banners (incident, degraded, freeze) for this tenant/offering
- User display preferences (unit system, time zone, reduced motion), MFA status and time of last challenge
- Release version and status-page state

**States:**
- Loading: rail and context header render immediately from cached route metadata; main shows skeleton; breadcrumb fills as entities resolve.
- Organization picker: first sign-in with multiple orgs (or none remembered) shows /orgs with each org's roles; one org skips the picker.
- Single-mode user: switcher collapses to a static mode label (no dropdown).
- Privileged step-up: opening /admin or /ops without a recent MFA challenge shows an inline step-up page (TOTP or passkey) and returns to the requested route.
- Scoped (TA): section badge in the context header; rail items that require offering-wide rights (Settings, Release) are absent, not disabled.
- Read-only tenant (pilot expired, past-due): grey banner "Read-only: you can view grades and feedback; submissions and edits are paused"; write actions show the same message inline.
- Degraded grading: amber banner for staff "AI feedback paused (reason). Computed checks continue; judged criteria show AI feedback pending".
- Preview / view-as / impersonation: distinct colored banners with the subject's name, reason/ticket, and for impersonation a countdown and End button; no analytics attributed to the subject.
- Exam mode: accent-colored border and persistent banner with countdown; What's new, announcements and discussions hidden; export and share affordances removed.
- Offline or request failure: toast "You are offline; changes are kept locally" (workspace) or inline retry; never a blank page.
- 403: page states the missing role or scope in plain words ("This submission belongs to Section A; you are a TA for Section B") with links to the user's own home and the inbox; 404: suggests search.

**Interactions:**
- Mode switcher: select a mode -> navigate to that mode's home in the current org; deep links set mode implicitly; last mode per org remembered.
- Organization switcher: lists orgs with role summaries; switching resets mode to the last used in that org; sandbox tenant shown as "Sandbox (personal)".
- Rail: click expands the current offering's sub-items; the chevron collapses the rail to icons; a keyboard shortcut toggles it.
- Context tabs: switch sub-routes without reloading the header; tab counts (Review 34, Discussions 2) update live.
- Banner actions: Details opens the incident or policy page; impersonation banner's End ends the session and triggers the learner summary email.
- Account menu: Settings, Switch organization, Generate support consent token, Sign out (revokes this session).
- Bell: opens a tray of the latest 10 notifications with "Open inbox"; items deep-link with mode resolution.

**Keyboard and accessibility:**
- Landmarks: banner, navigation (per-mode aria-label), main, contentinfo; skip link "Skip to main content" is the first focusable element.
- Route change moves focus to the page h1 and announces the page title through a polite live region.
- Rail: arrow keys move between items, Right/Left expand or collapse groups, Home/End jump; current item has aria-current=page.
- Global chords outside text inputs and outside the canvas: Ctrl/Cmd+K palette, ? help, g h home, g t tasks, g c courses, g i inbox, g r review queue (Teach), g g gradebook, [ toggle rail, Esc closes overlays; chords are suspended while the workspace canvas or any input has focus.
- All banners are aria-live=polite regions except exam countdown announcements at 30, 10, 5 and 1 minutes which are assertive.
- Status and scope badges carry text, not color alone; counts are part of the accessible name ("Review queue, 34 items").
- Targets at least 24 x 24 CSS px; focus never obscured by sticky header (scroll-margin on headings); respects reduced motion for rail animation.

**Requirements:**
- ROLE-01
- TEN-01
- AUTH-01
- ADR-0001 R12
- A11Y-01
- NFR-10
- I18N-01
- I18N-02
- BIL-01
- BIL-04
- GAP4-OPS-01
- GAP4-OPS-07
- GAP4-OPS-08
- GAP4-OPS-10
- GAP4-OPS-11
- GAP4-HELP-01
- GAP4-HELP-07
- GAP5-EXAM-03
- PV-01
- PRD-02
- PER-09

## Screen: Learner home

**Roles:** Learner (institutional, self-serve student or practitioner); also the view-as target for support and admins (read-only) · **Route:** `/o/:org/learn`

Answer in one glance what is next and when it is due, surface released feedback, and provide the Resume card that restores the exact task state; also the activation surface for new accounts (tutorial, sandbox).

```
+-------------------------------------------------------------------------------------------------+
| h1 Home                        Fall 2026     Units: US customary v    [Open sandbox] [Tutorial] |
+-----------------------------------------------------+-------------------------------------------+
| UP NEXT                                             | DUE IN THE NEXT 7 DAYS                    |
| +------------------------------------------------+ | (your time, CDT; course time is the same) |
| | [3D thumbnail]  4.4 Portal frame under wind    | | ! OVERDUE  2.4 Truss: method of joints    |
| |  CE 371 - Task T4 Design - In progress         | |   CE 371 - due Oct 14 - 1 attempt left    |
| |  Draft v3 autosaved 2 min ago                  | |   Late penalty now 10%           [Open]   |
| |  Memo 0/400 words - Snapshot missing           | | Tue 15  4.3 Quiz: load combinations       |
| |  Due Fri Oct 17, 11:59 PM CDT (extended Oct 20)| |   CE 371 - 10 min - 2 attempts   [Start]  |
| |  [ Resume -> ]                                 | | Fri 17  4.4 Portal frame under wind       |
| +------------------------------------------------+ |   CE 371 - extended to Oct 20   [Resume]  |
|                                                     | Mon 20  5.1 Guided: supports and releases |
|                                                     |   CE 450 - 25 min                [Start]  |
|                                                     | [See all tasks ->]                        |
+-----------------------------------------------------+-------------------------------------------+
| FEEDBACK READY (2 unread)                                                                       |
| 3.2 Continuous beam design  CE 371  Released Oct 12  82/100  Reviewed by Dr. Alvarez   [View]  |
| 1.3 Cantilever analysis     CE 371  Practice  AI-provisional  9 of 10 checks pass       [View]  |
+-----------------------------------------------------+-------------------------------------------+
| MY COURSES                                          | OUTCOME PROGRESS                          |
| [CE 371 Steel Design  Fall 2026  [======---] 62% ]  | L1 Analysis fundamentals  [####--] 4/6    |
| [  Next: 4.4 Portal frame   Grades: 84%   Open  ]  | L2 Code-based design      [##----] 2/9    |
| [CE 450 Capstone      Fall 2026  [==------] 20% ]  | L3 Design optimization    [------] 0/6    |
| [  Next: 5.1 Guided lesson  Grades: --     Open  ]  | L4 Engineering judgment   [#-----] 1/6    |
| Join a course: [Enter join code]                    | Mastered = 80%+ on 2 or more tasks [i]    |
+-----------------------------------------------------+-------------------------------------------+
```

**Regions:**
- Header: greeting-free h1 "Home", current term, unit-system quick switch (display only; locked tasks keep their units), Open sandbox (if entitled), Tutorial launcher (relaunchable PER-12).
- Up next: single Resume card for the most urgent in-progress item (draft version, autosave age, missing deliverables, effective due date with extension note); falls back to the next not-started item.
- Due in the next 7 days: list honoring cohort offsets and extensions; overdue items first with the current late penalty; each row has one primary action (Open / Start / Resume / View).
- Feedback ready: released grades not yet viewed, with provenance label and score; practice items labelled AI-provisional.
- My courses: offering cards with term, progress, next activity, released-grade total, Open; join-code entry.
- Outcome progress: L1-L4 bars from the simple mastery rule (R15/LOM-02) with the rule stated; links to the course outline filtered by outcome.

**Key data:**
- Enrollments (active) with offering name, term, progress %, next activity, released total
- Effective due dates (extension > cohort override > activity due + offset) for items due within 7 days, lateness state and current penalty
- Latest draft per in-progress task: version, autosave timestamp, deliverable completeness summary
- Released grade records not yet viewed: score, provenance, release time
- Outcome mastery per L1-L4 (count of criteria evidence vs rule), computed within 1 minute of release
- Entitlements: sandbox access, model-size tier, self-check caps

**States:**
- Loading: skeleton for Up next and Due list; data target under 1.5 s p95 (NFR-01).
- Empty (no enrollments): "You are not in a course yet" with Enter join code, Open sandbox sample tasks, and the tutorial; self-serve instructors are redirected to Teach instead.
- New account: Up next shows the tutorial card ("Build a beam and run your first analysis, about 10 minutes") until onboarding_completed or skipped.
- Nothing due: Due list shows "Nothing due in the next 7 days" with the next future deadline.
- Overdue: red bordered rows at top with penalty text; past-close items read "Closed - ask your instructor for an extension".
- Degraded grading: Feedback cards show "AI feedback pending" for judged criteria while computed checks are available.
- Read-only tenant: Resume becomes View; a banner explains.
- Error: section-level retry; Up next falls back to the cached last position.
- Phone (<1024): single column, read-only; Resume opens an interstitial "Open on a laptop" with the option to read the brief.

**Interactions:**
- Resume restores the exact activity and guided-lesson step with the working draft within 5 s (PER-01).
- Row actions open the task page (not the workspace) unless the task is in progress, in which case Resume goes straight to the workspace.
- Unit switch converts every displayed quantity consistently, including historical grades (I18N-02).
- Feedback View marks the item viewed and opens the submission version; a one-tap usefulness prompt appears there, not on home.
- Join code field validates expiry and domain restriction inline, consumes a seat, and adds the course card.

**Keyboard and accessibility:**
- Sections are h2 regions in a logical order: Up next, Due, Feedback, Courses, Outcomes; Tab reaches each primary action in that order.
- Due list rows are a list with each item's accessible name including the due date in words ("due Friday October 17 at 11:59 PM Central").
- Overdue state announced in text ("Overdue, late penalty 10 percent"), not only by color.
- Progress bars expose value, min and max; outcome bars include the rule in the description.
- g t jumps to Tasks; Enter on a course card opens the outline.

**Requirements:**
- PRG-02
- PER-01
- PRG-01
- LOM-02
- ADR-0001 R15
- NTF-01
- PER-12
- MVP-04
- PRD-01
- SCH-01
- SCH-02
- I18N-02
- NFR-01
- NFR-10

## Screen: Course page (learner outline of an offering)

**Roles:** Learner; staff see the same outline through Teach > Overview with staff affordances; authors see it as Preview as learner · **Route:** `/o/:org/learn/courses/:offering (tabs: /tasks, /grades, /discussions, /announcements)`

Present the offering as modules and typed activities with per-activity status, gating reasons and dates, plus section staff, policies and the week's deadlines; be the stable hub between home and the task page.

```
+-------------------------------------------------------------------------------------------------+
| CONTEXT HEADER  CE 371 Steel Design   Fall 2026   Section B   US pack v1.2 (ASCE 7-22, AISC 360)|
| Progress 62%   Grade so far 84% (released items)   [ Resume: 4.4 Portal frame under wind -> ]   |
| Tabs: [Outline] [Tasks 5] [Grades] [Discussions 2] [Announcements 1]                            |
+-------------------------------------------------------------------------------------------------+
| PINNED  Oct 13  Office hours moved to Thu 3 pm (Dr. Alvarez)                     [Read] [Dismiss]|
+-------------------------------------------------------------------+-----------------------------+
| h1 Outline                                     [Expand all]        | THIS WEEK                   |
| v Module 4  Frames and lateral loads   3 of 6 done   ~2 h 40 m left| Fri 17  4.4 Portal frame    |
|   [x] Page    4.1 Wind load derivation (ASCE 7-22 Ch 27)   12 min  | Mon 20  5.1 Guided lesson   |
|   [x] Lesson  4.2 Guided: build a 2D portal frame          25 min  |                             |
|   [x] Quiz    4.3 Load combinations   8/10                  10 min | STAFF                       |
|   [>] Task    4.4 Portal frame under wind   IN PROGRESS   T4 Design| Dr. M. Alvarez  instructor  |
|               Summative - Individual - Memo - Due Fri Oct 17 CDT   | R. Chen  TA, section B      |
|               2 of 3 attempts left                        [Resume] | [Ask a question (Q&A)]      |
|   [ ] Task    4.5 Diagnose: find 2 seeded errors   LOCKED          |                             |
|               Unlocks when 4.4 is submitted                 [Why?] | COURSE RULES                |
|   [ ] Page    4.6 Reading: drift limits                     8 min  | Late: 5%/day, cap 30%,      |
| > Module 5  Multi-story frames and seismic   Opens Mon Oct 20      |   15 min grace              |
| > Module 3  Steel members   COMPLETE   92%                         | Help available: Coach mode  |
| > Module 2  Trusses and continuous beams   COMPLETE   88%          |   (self-check 3 per task)   |
| > Module 1  Beams and idealization   COMPLETE   95%                | AI grading notice [Read]    |
|                                                                    | What Bridle records [Read]  |
+-------------------------------------------------------------------+-----------------------------+
```

**Regions:**
- Context header: offering name, term, section and TA, pinned code pack edition and unit system, progress and released-grade total, Resume primary action, entity tabs with counts.
- Pinned announcement strip (max 1 pinned; others under the Announcements tab).
- Outline: modules (collapsed except current) with completion counts and remaining estimated time; activity rows with type icon, title, tier and archetype for tasks, status, summative/formative, due date, attempts, one action.
- Right rail: This week (effective dates), Staff (instructor, section TA, Ask a question), Course rules (late policy, assistance profile summary, AI grading notice, process-evidence notice, collaboration and AI-use defaults).

**Key data:**
- Offering: name, term, time zone, pinned course version (hidden from learners), code pack id+version, unit system
- Modules and activities in order with required flag, points, estimated minutes, completion rule and state (viewed, submitted, graded, checkpoints), gating prerequisites and release dates
- Per-task: tier, archetype, summative vs formative, collaboration and AI-use policy, attempts used/left, effective due date, draft presence
- Section membership, staff names and roles
- Late policy, assistance profile preset name, pledge version
- Announcements (pinned and recent) with read state

**States:**
- Loading: header from cache; outline skeleton of the current module first.
- Empty module (not yet released): row reads "Opens Mon Oct 20" with no actions.
- Locked activity: row shows the unmet prerequisite in words and a Why? popover; server enforces (direct URL returns 403 with the same reason).
- Completed module: collapsed with score; expandable.
- Withdrawn or expired enrollment: read-only outline, grades visible, actions removed, banner explains.
- Exam-mode task row: Exam badge with window times; Start opens the pre-start screen.
- Error loading outline: retry; cached outline shown stale with timestamp.
- Preview (author): banner "Preview as learner - seed 1042 - no records are written".

**Interactions:**
- Click a row to open the task page or lesson; Resume on in-progress tasks goes straight to the workspace.
- Expand all / collapse persists per offering; current module auto-expands.
- Ask a question opens the course Q&A composer with the option "private to instructors".
- Tabs switch to the offering's task list, grades, discussions (one thread per task plus course thread), announcements.
- Dismissing a pinned announcement hides it for this user only.

**Keyboard and accessibility:**
- Outline is a tree (role=tree) with modules as expandable nodes; Right/Left expand and collapse; type-ahead jumps to an activity title.
- Each activity's accessible name = type, title, status, due date; Locked rows include the prerequisite in the description.
- Pinned announcement is a complementary region with a heading; Dismiss is a button with a visible label.
- Tabs follow the WAI-ARIA tabs pattern with arrow-key movement and the panel labelled by the tab.

**Requirements:**
- CRS-01
- CRS-02
- CRS-03
- CRS-04
- PRG-01
- DSC-01
- SCH-01
- SCH-02
- ENR-01
- ENR-02
- GAP3-DLV-17
- GAP5-POL-01
- GAP5-EVID-01
- DAT-04
- PV-01

## Screen: Task list (cross-course and per-offering)

**Roles:** Learner; TA and instructor see the equivalent as the review queue (separate surface) · **Route:** `/o/:org/learn/tasks and /o/:org/learn/courses/:offering/tasks`

A deadline-sorted, filterable list of every graded task with status, attempts and one action, so the learner can plan the week and never miss a deadline.

```
+-------------------------------------------------------------------------------------------------+
| h1 Tasks           [Course: All v] [Type: All v] [Archetype: All v]   Sort: [Due date v]        |
| Tabs: [Open 5] [Submitted 1] [Graded 7] [Locked 2] [All 15]        Times shown in CDT (your time)|
+-------------------------------------------------------------------------------------------------+
| Due                      | Task                              | Course | Status          | Attempts|
|--------------------------+-----------------------------------+--------+-----------------+---------|
| ! Overdue - was Oct 14   | 2.4 Truss: method of joints   T2  | CE 371 | Not started     | 1 left  |
|   late penalty now 10%   |   Analyze - Individual            |        |                 | [Open]  |
| Tue Oct 15, 11:59 PM     | 4.3 Quiz: load combinations       | CE 371 | Not started     | 2       |
|                          |   Quiz - 10 min                   |        |                 | [Start] |
| Fri Oct 17, 11:59 PM     | 4.4 Portal frame under wind   T4  | CE 371 | In progress     | 2 left  |
|   extended to Oct 20     |   Design - Summative - Memo       |        | draft v3 2 m ago| [Resume]|
| Mon Oct 20, 11:59 PM     | 5.1 Guided: supports, releases    | CE 450 | Not started     | --      |
|                          |   Guided lesson - 25 min          |        |                 | [Start] |
| Fri Oct 24, 11:59 PM     | 4.5 Diagnose: find 2 errors   T2  | CE 371 | Locked          | --      |
|                          |   Diagnose - unlocks after 4.4    |        |                 | [Why?]  |
| Submitted Oct 10 (v2)    | 3.2 Continuous beam design    T3  | CE 371 | Under review    | 1 used  |
|                          |   receipt 9f3a...                 |        | since Oct 10    | [View]  |
| Released Oct 12          | 1.3 Cantilever analysis       T1  | CE 371 | Graded 82/100   | --      |
|                          |   Practice - AI-provisional       |        | Reviewed        |[Feedback]|
+-------------------------------------------------------------------------------------------------+
| Status: Not started - In progress - Submitted - Under review - Graded - Resubmission requested - |
|         Locked - Closed                                                                         |
+-------------------------------------------------------------------------------------------------+
```

**Regions:**
- Filter bar: course, activity type (task, quiz, guided lesson), archetype (Analyze, Check, Design, Optimize, Diagnose), sort (due date, course, status); time-zone note.
- Status tabs with counts: Open, Submitted, Graded, Locked, All.
- Table: Due (effective, with extension and lateness), Task (number, title, tier, archetype, summative flag, deliverable hints), Course, Status (with sub-line: draft age, receipt hash, provenance), Attempts, one action.
- Legend of status vocabulary.

**Key data:**
- Every graded activity in active enrollments with effective due and close dates, lateness, penalty now
- Task metadata: tier, archetype, summative/formative, deliverables required, exam flag
- Attempt policy state: used, left, cooldown end, resubmission window end, grading target
- Latest submission version: number, receipt hash (short), pipeline state mapped to learner states, provenance label of released grade
- Draft presence and autosave age

**States:**
- Loading: skeleton rows; filters usable immediately.
- Empty (no tasks): "No tasks yet" with link to the course outline; empty filter result: "No tasks match - clear filters".
- Overdue rows pinned first with penalty; past-close rows read Closed with "Request extension" that opens Q&A private to instructors.
- Submitted and processing: status shows "Received - checking" then "Under review"; never shows a score before release.
- Resubmission requested (instructor decision): highlighted with the window end date and Resume.
- Degraded: graded rows with pending judged criteria show "Graded (AI feedback pending)".
- Exam tasks: window shown instead of due date; action Start opens pre-start screen.
- Phone: card list instead of table, read-only actions (View, Feedback).

**Interactions:**
- Row click opens the task page; Resume opens the workspace; Feedback opens the released version.
- Sort and filters persist per user; URL query reflects them for sharing.
- Why? popover on Locked explains the prerequisite and links to it.
- Receipt hash copies on click (for support).

**Keyboard and accessibility:**
- Table has column headers with scope, sortable headers announce sort state; rows are navigable with arrow keys (grid pattern) and the row action is reachable with Tab.
- Due cell accessible text spells the date and the time zone; overdue and extension states are text.
- Status tab counts are part of the tab name; selecting a tab updates the table and announces the count.
- g t opens this list; / focuses the course filter.

**Requirements:**
- PER-01
- SCH-01
- SCH-02
- SUB-01
- SUB-02
- GRD-02
- GAP3-DLV-02
- GAP5-EXAM-02
- PRG-01
- CAT-03

## Screen: Task page (learner hub between course, workspace, submissions, feedback and Q&A)

**Roles:** Learner; author preview; staff via Teach activity page link "View as learner" · **Route:** `/o/:org/learn/courses/:offering/activities/:activity (tabs: brief, given-data, deliverables, submissions, feedback, qa)`

Show the scenario, constraints, rubric, policies, attempts and deadline above the fold on 1366 x 768, and route to the workspace, self-check, submit, prior versions, feedback and the task's Q&A thread. Detailed brief, given-data sheet, deliverables dock and feedback views are designed by the deliverables and workspace designers; this screen fixes their placement and navigation.

```
+-------------------------------------------------------------------------------------------------+
| < Module 4                                                                                      |
| h1 4.4 Portal frame under wind      T4 Design  Summative  Individual  100 pts   [Exam] (if any) |
| Due Fri Oct 17, 11:59 PM CDT (your time = course time)  Extended to Oct 20 for you             |
| Attempts 2 of 3 left  Grading target: best   Late: 5%/day cap 30%   Randomized: your variant    |
| US pack v1.2 (ASCE 7-22, AISC 360-22)  Units: US customary (locked)  Draft v3 autosaved 2 m ago |
| [ Open workspace -> ]   [ Check my design  3 left ]   [ Submit ]   [Report a problem]           |
| Tabs: [Brief] [Given data] [Deliverables 1/4] [Submissions 1] [Feedback] [Q&A 4] [Help: Coach]  |
+-----------------------------------------------------------------------+-------------------------+
| BRIEF                                                                 | SUBMISSION CHECKLIST    |
| Scenario: single-story portal frame, enclosed, Risk Category II ...   | [x] Model  hash 9f3a..  |
| Site: V = 115 mph, Exposure C, Kzt 1.0 ... (full sheet in Given data) | [ ] Memo  0 / 400-1200 |
| Constraints: W-shapes <= W18 - drift h/400 - budget <= 1.10x ref      | [ ] Snapshot: moment    |
| Deliverables: model, memo (8 sections), 1 snapshot, pledge            |     diagram, governing  |
| Rubric: 9 criteria, 100 pts  [Show rubric]                            |     combination         |
| Policies: Collaboration individual - AI use allowed with disclosure   | [ ] Honor pledge        |
| AI grading: checks are computed; memo is AI-judged; released after    |     (at submit)         |
|   instructor review. [How grading works]                              | Penalty preview: none   |
| What Bridle records in this task [Read]                               | [ Submit ] disabled:    |
|                                                                       |  3 items missing        |
+-----------------------------------------------------------------------+-------------------------+
```

**Regions:**
- Back link to the module; h1 with tier, archetype, summative flag, collaboration policy, points, Exam badge.
- Fact line: effective due date with extension, attempts and grading target, late policy, randomization note, code pack and units, draft state.
- Primary actions: Open workspace (or Resume), Check my design with remaining count, Submit (enabled only when hard-required deliverables are complete), Report a problem (consented bundle).
- Tabs: Brief | Given data | Deliverables (n/m) | Submissions (count) | Feedback | Q&A (count) | Help available (effective assistance profile).
- Brief body (scenario narrative, site brief summary, constraints, deliverables, rubric descriptors, AI grading notice, policies, process-evidence notice).
- Submission checklist rail (mirrors the workspace Deliverables dock for non-canvas access): deliverable statuses, pledge, penalty preview, Submit.

**Key data:**
- Task version metadata: title, tier, archetype, summative/formative, points, code pack and edition, unit system lock, randomization flag and the learner's instance id
- Effective due/close, extension, late policy, attempt policy state, grading target
- Assistance profile (effective): live results, overlays, self-check mode and remaining count, hints, reveal timing
- Deliverable catalog for the archetype with completeness from the shared validators; latest draft hash and autosave time
- Submission versions with receipts, pipeline state, release state and provenance; Q&A thread count; policies and pledge version

**States:**
- Not started: primary action Open workspace (starter model loads); checklist all unchecked.
- In progress: Resume; checklist partially complete; Submit disabled with the list of missing hard-required items.
- Submitted (processing): banner "Received Oct 10 9:41 PM, receipt 9f3a... - checking"; Submissions tab highlighted; workspace stays editable for the next attempt if allowed.
- Under review / graded held: "Under review by your instructor" with no score.
- Released: Feedback tab badge; one-tap usefulness prompt inside the feedback view.
- Resubmission window open: Resume plus window end date; after close: read-only.
- Locked by prerequisite or availability date: brief visible, actions replaced by the reason.
- Exam task before window: Start exam opens the pre-start screen; during window: Resume exam; after: "Closed - feedback after the window".
- Degraded: Feedback tab shows "AI feedback pending" with computed evidence available.
- Preview (author): seed selector in the banner; submit runs grading dry-run.
- Unsupported device: Open workspace opens the system-check interstitial and offers the tabular editor.

**Interactions:**
- Open workspace / Resume navigates to the full-screen workspace route with a slim header that returns here.
- Check my design runs the client checks artifact and opens the self-check panel (in the workspace or inline for the parity path); decrements the cap.
- Submit opens the deliverables checklist confirmation with pledge text, collaborators/AI-use disclosure fields when required, penalty preview, then shows the receipt.
- Submissions tab lists versions (v1, v2), each read-only with hash verification and the feedback for released ones.
- Q&A tab opens the task's thread with private-to-instructors option.
- Report a problem opens the consent dialog for the diagnostic bundle.

**Keyboard and accessibility:**
- Above-the-fold facts are a description list (dl) read in order: due, attempts, late policy, units.
- Primary actions are buttons with explicit disabled reasons exposed via aria-describedby.
- Tabs pattern with counts in names; checklist is a list with text status (Complete / Missing: reason).
- Clause references in the brief are links that open the help panel page (GAP4-HELP-02) without leaving the page.
- The checklist rail provides the full non-canvas path for Analyze/Check/Diagnose entry panels (GAP3-DLV-05/08/12).

**Requirements:**
- CRS-03
- PRD-01
- PER-02
- SUB-01
- SUB-02
- GRD-03
- GRD-04
- DAT-04
- DSC-01
- GAP3-DLV-02
- GAP3-DLV-03
- GAP3-DLV-16
- GAP3-DLV-17
- GAP5-POL-01
- GAP5-POL-02
- GAP5-EXAM-03
- GAP4-HELP-02
- GAP4-HELP-03
- ADR-0001 R11
- ADR-0001 R16

## Screen: Gradebook (instructor and TA) and My grades (learner)

**Roles:** Instructor (all sections, release, export, override); TA (assigned sections, no release unless granted, no export); learner (own released items only) · **Route:** `/o/:org/teach/:offering/gradebook (staff); /o/:org/learn/courses/:offering/grades and /o/:org/learn/grades (learner)`

Points-based gradebook with status chips, raw/penalty/adjusted detail, per-task release control and generic CSV export (ADR guardrail), while the learner view shows only released items with provenance.

```
+-------------------------------------------------------------------------------------------------+
| h1 Gradebook  CE 371 Steel Design  Fall 2026        [Section: All v] [ ] Show withdrawn (3)     |
| Points-based  Scale: percent + letter      [Find learner]     [Export CSV v] [Grade history CSV] |
| RELEASE  4.4 Portal frame: 31 reviewed - 3 provisional - 0 held - 2 quarantined                  |
|          [ Release 31 reviewed ]  [ ] Hold until all graded      Exports are disclosure-logged   |
+-------------------------------------------------------------------------------------------------+
| Learner (84)   | Sec | 3.2 Beam | 4.3 Quiz | 4.4 Portal frame            | 4.5 Diagnose | Total |
|                |     | /100     | /10      | /100                        | /50          | %  L  |
|----------------+-----+----------+----------+-----------------------------+--------------+-------|
| Aguilar, P.    |  B  | 82       | 8        | 74.1 [late -5%] [reviewed]  | --           | 78.1 C|
| Brooks, T.     |  A  | 91       | 10       | --   [under review]         | --           | 90.2 A|
| Chen, L.       |  B  | 67 [v2]  | 7        | 88   [provisional]          | --           | 71.0 C|
| Diaz, M.       |  A  | 0 [miss] | 9        | 59   [under appeal]         | --           | 55.3 F|
| Evans, K.      |  B  | 78       | 9        | --   [re-verifying]         | --           | 80.5 B|
| ... 79 more rows (virtualized; sticky first column and header)                                  |
+-------------------------------------------------------------------------------------------------+
| CELL DRAWER  Aguilar, P. - 4.4 Portal frame - version 2 of 2 (grading target: best)             |
| raw 78.0 - late penalty 5% (5%/day, cap 30%) - adjusted 74.1  - Reviewed by R. Chen, Oct 12      |
| grader v1.2.0 (US pack v1.2, checks 1.4.0, rubric v3)   [Open review] [Override...] [History 3]  |
+-------------------------------------------------------------------------------------------------+
LEARNER VIEW (/learn/courses/:offering/grades): one row per graded activity: title - released
score or "Under review" (no number) - provenance label - late detail (raw, penalty, adjusted) -
[View feedback]; course total counts released items only; held, provisional and quarantined items
never show a score. /learn/grades groups the same rows by course.
```

**Regions:**
- Header: offering, section filter (TA fixed to own sections), show-withdrawn toggle (default off), find learner, Export CSV (generic layout; Canvas/Moodle layouts v1.x), Grade history CSV.
- Release strip per selected task: counts by state (reviewed, provisional, held, quarantined), Release action (summative requires review per R11), hold-until-all-graded option; disclosure note.
- Grid: sticky learner column and section, one column per graded item with points possible, cells with adjusted score and status chips (late, resubmitted vN, under review, provisional, under appeal, re-verifying, missing, excused), course total in the course scale.
- Cell drawer: version, raw / penalty / adjusted with the policy, provenance, grader version, actions Open review, Override (reason required), History.

**Key data:**
- Enrollments (active; withdrawn hidden by default) with section
- Grade records per activity: raw, penaltyFraction, adjusted, status, source (auto, ai, human), gradedBy, released flag, appeal state, quarantine state, version number, grading target
- Points possible per item, course scale and letter cutoffs, computed totals (server-side, cached)
- Release counts per task; hold-until-all-graded flag
- Export audit: who exported what and when (disclosure log)

**States:**
- Loading: header and release strip first; grid virtualized; target under 2 s p95 for 500 x 60 (NFR-01).
- Empty (no graded items yet): "No graded items yet - grades appear here after release".
- TA scoped: section filter locked to assigned sections; Release and Export hidden; override only if granted.
- Provisional cells (summative not yet reviewed): score visible to staff with chip; learner sees Under review.
- Quarantined (artifact revoked): chip re-verifying; release blocked; tooltip links to the ops notice.
- Under appeal: chip; drawer shows the regrade request and decision controls.
- Degraded: cells with pending judged criteria show the deterministic partial with chip "AI pending".
- Read-only tenant: export allowed, overrides and release disabled with explanation.
- Export: confirmation states that the export is written to the disclosure log and carries the educational-use notice.

**Interactions:**
- Click a cell to open the drawer; Open review jumps to the review screen for that version and returns here.
- Release releases the selected task's reviewed grades atomically and emits notifications; with hold-until-all, the button stays disabled until the last provisional grade is reviewed.
- Override requires a reason and creates a new grade record; History lists who, when, what, why.
- Show withdrawn reveals rows with a Withdrawn chip; grades remain.
- Export CSV downloads generic layout matching on-screen values including raw and adjusted.

**Keyboard and accessibility:**
- Grid uses the ARIA grid pattern: arrow keys move cells, Enter opens the drawer, Esc closes; sticky header cells are column headers with scope.
- Each cell's accessible name includes learner, item, score and every chip as text ("74.1, late penalty 5 percent, reviewed by R. Chen").
- Release button's disabled reason exposed via aria-describedby; confirmation dialog traps focus and returns it to the button.
- Learner view is a simple table (not a grid) with a caption stating that only released items are shown.
- g g opens the gradebook in Teach mode.

**Requirements:**
- GBK-01
- ADR-0001 R11
- SCH-02
- ENR-01
- GRD-02
- GRD-04
- DAT-01
- PER-09
- MVP-04
- GAP4-OPS-06
- GAP4-OPS-07
- PRD-02
- NFR-01

## Screen: Teach home (instructor and TA dashboard)

**Roles:** Instructor (all offerings taught); TA (offerings with assigned sections, section-scoped counts) · **Route:** `/o/:org/teach`

Land staff on what needs them now: review queue counts and age, pending releases, regrade requests, go-live checklists, unanswered questions, deadline windows and at-risk learners, with direct links into each offering's surfaces.

```
+-------------------------------------------------------------------------------------------------+
| h1 Teach  Fall 2026                                        [ + New offering from a course ]      |
| BANNER  AI feedback paused by the platform (tenant budget). Computed checks continue; judged     |
|         criteria show "AI feedback pending". You can grade them manually.  [Details]             |
+-------------------------------------------------------------------------------------------------+
| NEEDS YOU                                                                                       |
| [ Review queue  34 to review - 12 flagged - oldest 2 d 4 h   CE 371 ]  [ Regrade requests 3 ]   |
| [ Release pending  4.4 Portal frame: 31 reviewed, 3 left (hold-until-all)  CE 371 ]             |
| [ Go-live checklist  CE 450 Capstone: 5 of 7 - calibration missing on 2 summative tasks ]       |
| [ Unanswered questions 2  CE 371 Q&A ]                                                          |
+-------------------------------------------------------------------------------------------------+
| MY OFFERINGS                                                                                    |
| CE 371 Steel Design   Fall 2026   RUNNING   84 learners - 2 sections - pinned course v3          |
|   Next deadline Fri Oct 17 (4.4)   Review 34 | Gradebook | People | Schedule | Insights | ...    |
| CE 450 Capstone       Fall 2026   PLANNED   0 learners - opens Oct 20   [Finish go-live checklist]|
| CE 371 Steel Design   Fall 2026   TA - Section B only   (scope badge; queue 14)                  |
+-----------------------------------------------------+-------------------------------------------+
| DEADLINE WINDOWS (T-48 h to T+24 h)                 | AT RISK (simple rules)                    |
| Fri Oct 17  4.4 Portal frame  84 learners  freeze on| 6 learners - no activity 7 d (4),          |
| Fri Oct 24  4.5 Diagnose      84 learners           |   overdue tasks (2)       [Open list]      |
+-----------------------------------------------------+-------------------------------------------+
```

**Regions:**
- Header: term selector, New offering wizard entry (course version, date shift, sections, roster, checklist).
- Staff banner slot: LLM degradation with manual-grading path, quarantine notices, change freeze during windows.
- Needs you: cards with counts and age for review queue, regrade requests, release pending, go-live checklist, unanswered Q&A; each links to the filtered surface.
- My offerings: rows with state (planned, open, running, closed, archived), learners and sections, pinned version, next deadline, inline tab links; TA rows carry the section badge.
- Deadline windows (derived from summative due dates incl. extensions) and At risk (no activity 7 d, overdue) per R15.

**Key data:**
- Offerings where the user holds instructor or TA role, with state, enrollment counts, sections, pinned course version
- Review queue counts by flag reason and oldest provisional age (section-scoped for TAs)
- Regrade requests open and due; release readiness per task; hold-until-all flags
- Go-live checklist progress per planned offering (roster, dates shifted, calibration per summative task, training modules, support contacts, windows registered)
- Deadline windows next 14 days; at-risk learners by rule
- Unanswered Q&A count; LLM degradation state and backfill ETA

**States:**
- Loading: cards show skeleton counts; offerings list from cache.
- Empty (no offerings): self-serve instructor sees the sandbox course card with sample tasks and seeded submissions plus "Request institution pilot"; institutional instructor sees "No offerings yet - create one from a course".
- TA only: Needs you limited to the TA's sections; no New offering action; release card hidden.
- Planned offering: checklist card dominates; learners cannot see it until opened.
- Closed offering: grades final; export only.
- Degraded or quarantine: banner as shown; review queue card adds "3 awaiting AI backfill".
- Deadline window active: freeze badge and a note that support coverage is 24 x 7 inside the window.

**Interactions:**
- Cards open the target surface pre-filtered (e.g., review queue sorted by flag severity and age).
- Offering row tab links open the offering's context tabs; the row header opens Overview.
- New offering launches the wizard (flow: term setup).
- At risk opens the people list filtered by rule with an export; messaging is v1.x.

**Keyboard and accessibility:**
- Needs-you cards are links with the count in the accessible name; order is by urgency.
- Offering rows are list items with nested link groups; arrow keys move between tab links within a row.
- Banner is a polite live region; degraded-state copy includes the manual-grading path.
- g r opens the review queue of the most urgent offering; g g the gradebook.

**Requirements:**
- PER-06
- PER-07
- PER-08
- PER-09
- GRD-02
- GRD-04
- NTF-01
- ADR-0001 R11
- ADR-0001 R15
- GAP4-OPS-07
- GAP4-OPS-11
- GAP4-HELP-05
- ANL-01
- DSC-01
- GTM-01

## Screen: Author home (content library and course versions)

**Roles:** Course author (no learner grades); instructors who also hold the author role arrive here via "Edit content" from Teach · **Route:** `/o/:org/author`

Show what content exists, what state and version each item is in, what blocks publishing (validation, calibration, review), which offerings pin which version, and artifact default changes that affect grading; route into the builders.

```
+-------------------------------------------------------------------------------------------------+
| h1 Author                           [ + New course ] [ + New task v ] [ Browse template library ]|
| NOTICE  US code pack v1.3 becomes the default for NEW task versions on Nov 10 (grading-affecting)|
|         Published tasks keep their pins.  [Changelog]  [Re-pin guidance]                 [Dismiss]|
| Tabs: [Courses 3] [Tasks 24] [Guided lessons 6] [Lessons 18] [Quizzes 9] [Library] [Presets]     |
+-------------------------------------------------------------------------------------------------+
| COURSES                                                                                         |
| Structural Analysis and Design Fundamentals   v3 published Aug 20   draft v4 (7 changes, 2       |
|   grading-affecting)   Used by: CE 371 Fall 2026 (v3)   [Open builder] [Preview as learner] [...]|
| Lateral systems short course                  draft v1   4 of 11 sections complete   [Open]     |
+-------------------------------------------------------------------------------------------------+
| TASKS NEEDING ATTENTION                                    Filter: [All v] [Needs calibration v] |
| Portal frame under wind        v3 PUBLISHED   Calibrated 20 seeds, 2 refs in band - override 9% |
| Diagnose: find 2 errors        v1 DRAFT       Validation 2 fails: no reference; weights = 95 [Fix]|
| Roof truss snow + wind         v2 IN REVIEW   Reviewer Dr. Alvarez - 1 open comment      [Open] |
| 3-story moment frame           v1 PUBLISHED   NEEDS CALIBRATION after rubric edit   [Calibrate] |
+-------------------------------------------------------------------------------------------------+
| LIBRARY  Platform starter pack (8 templates, copy-only)   Institution templates (5)   [Browse]   |
+-------------------------------------------------------------------------------------------------+
```

**Regions:**
- Header: New course, New task (from template or blank; archetype picker), Browse library; artifact default-change notice (GAP4-OPS-05/HELP-07) with changelog and re-pin guidance.
- Content type tabs with counts.
- Courses: blueprint rows with published version, open draft and its change classification, offerings using each version, actions (builder, preview, duplicate, rollover entry).
- Tasks needing attention: version, lifecycle state (draft, in review, published, archived), validation and calibration status, override rate from released grades, action.
- Library entry: platform starter pack (copy-only) and institution templates.

**Key data:**
- Content items owned or co-authored with lifecycle state, version numbers, changelog counts, grading-affecting diff classification
- Offerings pinning each course version
- Validation gate results per draft (starter analyzes, reference passes, weights = 100, combinations consistent, randomization valid, calibration run exists)
- Calibration status per published task version and override rate (AN-03 subset at MVP: override rate only)
- Artifact registry defaults and announced default-pointer changes
- Templates available with provenance and license

**States:**
- Loading: counts skeleton; notice loads from release notes feed.
- Empty: "Start from the ready-to-teach course or a starter template" with the two primary actions.
- Draft blocked: red validation summary with the first failing gate and Fix link into the builder section.
- In review: reviewer and open comment count; publish disabled until approved when the institution requires review.
- Published with in-flight attempts: Open builder warns that grading-affecting edits are blocked while attempts exist (MVP rule) and offers a new draft.
- Needs calibration: amber state after any grading-affecting edit; Calibrate runs the async job with progress.
- Edit lock: row shows "Being edited by <name>" with takeover available after idle timeout.
- Read-only tenant: builders open read-only.

**Interactions:**
- Open builder routes to the course or task builder (sibling design); Preview as learner opens a new tab with banner and seed selector.
- Duplicate course copies content without learner data with an optional date shift; Rollover creates a new offering (crosses into Teach).
- Dismiss hides the notice for this user; it reappears if a new grading-affecting change is announced.
- Filter by Needs calibration / Validation failing / In review.

**Keyboard and accessibility:**
- Tabs pattern; rows are list items whose accessible name includes title, version and state.
- Validation failures are listed as text with links; status colors have text equivalents.
- Notice is a polite live region with a dismiss button; links open in the same tab except Preview (announced as new window).

**Requirements:**
- TB-01
- VP-01
- VP-02
- VP-03
- PV-01
- PV-02
- TL-01
- TL-02
- CM-01
- CM-02
- CM-03
- CA-01
- CA-02
- AN-01
- GAP4-OPS-05
- GAP4-HELP-07
- ROLE-01

## Screen: Institution admin console (home and entry points)

**Roles:** Institution admin (MFA enforced); aggregate data only, no individual grades · **Route:** `/o/:org/admin (entries: /members, /roles, /roster-imports, /offerings, /settings, /usage, /audit, /disclosures, /support-sessions, /data-requests, /flags)`

Provision people and roles, import rosters, set institution defaults, report seat usage, and see every audited action, disclosure and support access in the tenant; integrations and integrity policy are v1.x entries shown locked.

```
+-------------------------------------------------------------------------------------------------+
| h1 Administration  State University          Plan: Pilot (ends Dec 20, 2026)   DPA signed       |
| Seats 212 of 300 used - 180 active in 30 d          [ Invite members ] [ Import roster (CSV) ]   |
+-------------------------------------------------------------------------------------------------+
| [ Members 240 ]  [ Roles and scopes ]  [ Roster imports 3 ]  [ Offerings 4 ]  [ Settings ]       |
| [ Usage report ] [ Audit log ]  [ Disclosure log ]  [ Support sessions 1 ]  [ Data requests 0 ]  |
| [ Feature flags (read-only) ]  [ Integrations - v1.x ]  [ Integrity policy - v1.x ]  [ Depts - v1.x ]|
+----------------------------------------------+--------------------------------------------------+
| INSTITUTION DEFAULTS (new courses inherit;   | RECENT ADMIN ACTIVITY                            |
| published tasks never change)                | Oct 13  Role granted: TA R. Chen -> CE 371 sec B |
| Units: US customary     Time zone: Chicago   |         by Dr. Alvarez                           |
| Code pack: US v1.2      Grading scale: %+letter|Oct 12  Roster import CE 450: 48 ok, 2 rejected  |
| Grade release: instructor review (MVP locked)| Oct 11  View-as session on J. Garcia by operator |
| Auth: email, Google, Microsoft - MFA required|         (ticket #311, 12 min)                    |
|   for instructor/author/admin                | Oct 10  Institution pledge text -> v2            |
| Pledge text v2 - AI-use default: disclose    | [ All audit entries ]  [ Disclosure log ]        |
| Training-data opt-in: OFF (default)          |                                                  |
| Retention: grade audit 7 y - op logs 12 mo   |                                                  |
+----------------------------------------------+--------------------------------------------------+
```

**Regions:**
- Header: tenant name, plan and lifecycle state with pilot end date, DPA and pilot-agreement flags, seat usage (purchased / assigned / active 30 d), Invite members, Import roster.
- Entry-point tiles with counts: Members, Roles and scopes, Roster imports, Offerings (structure only), Settings, Usage report, Audit log, Disclosure log, Support sessions, Data requests, Feature flags (read-only); v1.x tiles (Integrations, Integrity policy, Departments) shown with a lock and "coming in v1.x".
- Institution defaults summary with the inheritance rule stated.
- Recent admin activity (audit) with links to the full log and disclosure log.

**Key data:**
- Tenant settings: units, code pack edition, time zone, grading scale, auth methods and MFA policy, pledge text version, collaboration and AI-use defaults, training opt-in, retention
- Members by role and scope; pending invites; roster import jobs with per-row results
- Seat pool: purchased, assigned, active in 30 days; learner cap
- Audit events (role grants, settings, imports, exports) and disclosure log entries (who read which education records)
- Support sessions (view-as, impersonation) with operator, reason, ticket, duration; DSR requests awaiting approval with statutory clocks
- Release flags enabled for the tenant (read-only)

**States:**
- Loading: tiles with counts skeleton.
- New tenant: checklist tile "Finish setup: defaults, first instructor, roster" until complete.
- Seat cap near or reached: amber (80 %) / red (100 %) with enrollment behavior explained (block or waitlist off at MVP).
- Pilot expiring: banner at 30 and 7 days; expired: read-only state explained.
- DSR pending approval: tile shows clock remaining; opening shows requester (verified), scope, legal-hold check and Approve/Reject with reason.
- Impersonation in progress in this tenant: tile shows live session with End-session request path.
- Locked v1.x tiles: visible, non-navigable, with contact path (BIL-01 rule).
- Error: tile-level retry.

**Interactions:**
- Invite members opens role and scope picker (platform matrix as data) and sends invites; Import roster runs dry-run first with a downloadable error report, then commit.
- Settings tiles edit defaults; changes are audited with reason and never alter published task versions (copy says so).
- Audit and disclosure logs are filterable by actor, action, date and exportable (export itself logged).
- Support sessions list shows every view-as and impersonation session; admin can revoke break-glass approvals.

**Keyboard and accessibility:**
- Tiles are links in a grid with counts in the accessible name; locked tiles are buttons that open the contact dialog and are described as unavailable.
- Defaults summary is a description list; each value links to its settings section.
- Audit entries are a table with time, actor, action, target, reason; filters are labelled form controls.
- MFA step-up page is reachable by keyboard and supports passkeys and TOTP.

**Requirements:**
- PER-10
- ADR-0001 MVP guardrails (admin console limited to members, roles, roster import, institution defaults)
- TEN-01
- ROLE-01
- ENR-01
- DAT-01
- DAT-02
- DAT-04
- GAP4-OPS-02
- GAP4-OPS-08
- GAP4-OPS-09
- GAP4-OPS-10
- GAP5-INST-01
- AUTH-02
- INT-01
- BIL-01
- GTM-05

## Screen: Operator console (platform home and entry points)

**Roles:** Platform admin only, MFA challenge within 12 h; every write requires a reason; every read of education records is disclosure-logged · **Route:** `/ops (entries: /search, /tenants, /jobs, /dead-letter, /reconciliation, /artifacts, /pins, /llm, /flags, /incidents, /deadline-windows, /support, /replay/:bundle, /data-requests, /metrics, /onboarding)`

One audited place to prove the zero-lost-work criterion and to run the five rehearsed runbooks: queue and reconciliation health, dead-letter, LLM budget and kill switch, artifact promotions, pins and quarantine, incidents and deadline windows, support tickets and SLAs, DSR clocks, and the MVP exit-criteria dashboard.

```
+-------------------------------------------------------------------------------------------------+
| h1 Operate   [ Search: email, user id, tenant, sub_, job_, trace_ ...        ]   MFA ok (2 h ago) |
| CHANGE FREEZE ACTIVE  State University - window Fri Oct 17 10:00 to Sat Oct 18 23:59 CDT        |
+-------------------------------------------------------------------------------------------------+
| LOST WORK  0   | RECONCILIATION  clean, 4 min ago | DEAD-LETTER  1 (14 min, solver_error) | OLDEST |
|                |                                  |                                      | QUEUED 38 s|
| LLM  global ON - tenants paused 0 - spend MTD $212 of $600 - cache read 71% - pending judged 0   |
+-------------------------------------------------------------------------------------------------+
| [ Tenants 3 ] [ Jobs ] [ Dead-letter 1 ] [ Artifacts: 1 promotion awaiting 2nd approval ]        |
| [ Pins and quarantine ] [ LLM budgets ] [ Flags ] [ Incidents 0 open ] [ Deadline windows: Fri ] |
| [ Support 4 open - 1 at 80% SLA ] [ Data requests 1 - GDPR clock 12 d ] [ Exit criteria ]        |
| [ Onboarding: 1 go-live checklist waiting ]                                                      |
+---------------------------------------------------+---------------------------------------------+
| QUEUE BY LANE      interactive | grading | batch   | INCIDENTS AND WINDOWS                       |
| p95 wait            0.4 s      | 3.1 s   | paused  | No open incident   [Declare incident]       |
| oldest              2 s        | 38 s    | 1,240   | Fri Oct 17  CE 371 4.4   84 learners        |
| per-tenant caps     univ 8 - sandbox 2             | Fri Oct 24  CE 371 4.5   84 learners        |
+---------------------------------------------------+---------------------------------------------+
| EXIT CRITERIA (MVP-05)  activation 74% (>=70) - TTFA median 8 m (<=10) - agreement 86% (>=85)    |
|   override 11% (<15) - usefulness 71% (>=75, below) - lost work 0 - pilot reuse: pending         |
+-------------------------------------------------------------------------------------------------+
```

**Regions:**
- Header: global search by exact id or email (results show tenant and role context), MFA freshness, change-freeze banner with the active window.
- Invariant strip: lost-work counter, reconciliation status and age, dead-letter count and oldest age with reason class, oldest queued job; LLM line (kill switch state, paused tenants, spend vs budget, cache read share, pending judged backlog).
- Entry-point tiles with live counts and the most urgent qualifier (promotion awaiting second approval, SLA at 80 %, GDPR clock).
- Queue by lane (interactive, grading, batch) with p95 wait, oldest, per-tenant concurrency caps; Incidents and windows with Declare incident.
- Exit-criteria dashboard (MET-02, MET-03, MVP-05) with targets and live status.

**Key data:**
- Reconciliation invariant results, lost-work counter with incident links, dead-letter entries by reason class
- Queue metrics per lane; stuck-job alerts; per-tenant caps
- LLM telemetry: spend MTD and projection per tenant, cost per grade, cache read share, kill switch and per-route state, backfill backlog and age
- Artifact registry: versions by type with lifecycle state, pending promotions, gate results; pin overrides and quarantined grades
- Incidents (severity, commander, timeline), deadline windows next 14 days across tenants, freeze state
- Support tickets with severity, deadline proximity and SLA clocks; DSR requests with statutory clocks
- Exit criteria metrics with targets; go-live checklists per planned offering

**States:**
- Step-up required: console routes render the MFA challenge first; non-platform roles get 403 (including institution admins).
- Healthy: all invariant cells green; freeze banner absent.
- Backlog runbook: grading lane p95 above 60 s turns the lane amber with the runbook link and single-action controls (scale workers, pause batch lane, raise tenant cap, defer judged stages).
- LLM outage runbook: error rate above threshold shows the global switch control with the warning "do not swap pinned model ids"; after engaging, backfill backlog and ETA display.
- Regression runbook: revoked artifact lists affected task versions and grades; quarantine applied as one bulk action with reason.
- Lost-work incident: counter red with ticket and root-cause category; recovery sources (receipt, server drafts, object versions, op-log replay, IndexedDB bundle) reachable within two clicks of the learner/task pair.
- Tenant data-access incident: containment controls (route kill switch, tenant read-only) prominent; disclosure-log query panel.
- Write action: every control opens a reason dialog (ticket optional) and shows before/after; bulk actions show done/failed/remaining.
- Read of a submission or grade: inline note "This view is written to the tenant's disclosure log".

**Interactions:**
- Search by trace, job, submission, learner opaque id or email resolves in under 2 s and opens the detail with tenant context.
- Tiles open list views with filters; job detail shows the stage timeline, persisted stage outputs, model-call records, errors with trace links and the receipt; actions retry stage, re-run from stage, cancel, requeue, bulk.
- Declare incident creates the status-page entry and targeted in-app banner from a template in one action.
- Promotion requires a second platform admin; the proposer cannot approve.
- View as learner (read-only) and Impersonate (consent token, reason, time box) start from the user detail with the denylist shown.

**Keyboard and accessibility:**
- Invariant strip values are a description list with status words (clean, stuck, paused) not only color.
- Tiles are links with counts and qualifiers in their names; the freeze banner is a polite live region.
- Reason dialogs trap focus and require text; destructive and bulk actions are confirmed with the count in the button label.
- Tables (jobs, tickets, artifacts) use sortable headers and row actions reachable by Tab; filters are labelled controls.

**Requirements:**
- GAP4-OPS-01
- GAP4-OPS-02
- GAP4-OPS-03
- GAP4-OPS-04
- GAP4-OPS-05
- GAP4-OPS-06
- GAP4-OPS-07
- GAP4-OPS-08
- GAP4-OPS-09
- GAP4-OPS-10
- GAP4-OPS-11
- GAP4-OPS-12
- GAP4-OPS-13
- GAP4-OPS-14
- GAP4-OPS-15
- GAP4-OPS-16
- GAP4-HELP-04
- GAP4-HELP-05
- GAP4-HELP-06
- MET-02
- MET-03
- MVP-05
- ADR-0001 R17

## Screen: Global search and command palette

**Roles:** All roles; result groups and people results are permission- and section-scoped; operators get id lookups across tenants · **Route:** `Overlay on every route (Ctrl/Cmd+K; "/" outside inputs); full results at /search?q=; inside the workspace the same palette adds modeling commands`

One keyboard surface for navigation, actions, content and help, and (inside the workspace) for every modeling command and command-line input, so the shell and the canvas share one command bus and one accessible path.

```
PALETTE (overlay, Ctrl/Cmd+K anywhere; "/" outside inputs)
+------------------------------------------------------------------------------+
| >  wind|                                                   Teach - CE 371 [x] |
+------------------------------------------------------------------------------+
| ACTIONS                                                                      |
|   Grant extension...                   Open review queue filtered "wind"     |
|   Switch to Learn mode                 Release 4.4 Portal frame (31 reviewed)|
| TASKS AND CONTENT                                                            |
|   4.4 Portal frame under wind   CE 371   Summative - due Fri 17   [Stats]    |
|   4.1 Wind load derivation      CE 371   Page                                |
| PEOPLE (your sections only)                                                  |
|   Winder, A.   learner - CE 371 sec B   [Submissions] [Gradebook row]        |
| HELP AND CLAUSES                                                             |
|   ASCE 7-22 Eq. 27.3-1 wind pressure   clause page                           |
|   Load panel tool   workspace help                                           |
| RECENT                                                                       |
|   Review: Chen, L. - 4.4 v2        Gradebook CE 371                          |
+------------------------------------------------------------------------------+
| Enter open - Tab next group - "g t" tasks - "g r" review - paste sub_/job_   |
+------------------------------------------------------------------------------+

INSIDE THE WORKSPACE the same palette adds a COMMANDS group first (EDIT-04):
|   > node 0,0,3            place node at (0, 0, 3) m                          |
|   > load member 12 -10 kN/m                                                  |
|   Assign section...  (S)     Fit all (Home)     Switch case: 1.2D+1.6L       |

FULL RESULTS PAGE  /search?q=wind : same groups as sections with pagination; every result that
is a submission, grade or feedback record shows "viewing this is recorded" and writes the
disclosure log when opened.
```

**Regions:**
- Input with scope chip (current mode and offering) that can be cleared to search the whole org; Esc closes.
- Result groups in fixed order: Commands (workspace only), Actions, Tasks and content, People (scoped), Help and clauses, Recent; each group capped at 5 with "more" leading to the results page.
- Footer: key hints and id-format tips.

**Key data:**
- Route table entries (titles, modes, scope requirements) for Navigate/Actions
- Content index: activities, tasks, lessons, announcements within the user's enrollments or offerings; authors' content items
- People directory scoped by role (learner: staff of own offerings only; TA: own sections; instructor: offering; admin: tenant)
- Help ids (tool, panel, screen, check, clause) and clause library paraphrased titles
- Recent items per user; id prefixes (sub_, job_, trace_, usr_) for staff and operator lookups
- Workspace command registry with shortcuts and parse grammar (shared command bus)

**States:**
- Empty query: shows Recent and the mode's top actions (Resume, Review queue, New offering).
- No results: "Nothing matches - try a task number, a learner name (your sections) or an id" with link to help search.
- Scoped: PEOPLE group label states the scope ("your sections only"); results outside scope never appear.
- Permission-sensitive result: submission or grade results carry the disclosure note; opening logs the read.
- Workspace focus: Commands group first; coordinate and command-line input parsed with a preview line; invalid input shows the grammar hint.
- Exam mode: help and clause results limited per the exam profile; export/share actions absent.
- Offline: navigation results from the cached route table; search groups show "unavailable offline".
- Slow: results stream per group with a progress indicator; target under 500 ms p95.

**Interactions:**
- Type to filter; Enter opens the highlighted result; Ctrl/Cmd+Enter opens in the background (results page).
- Actions execute in place (e.g., Switch mode) or open the target dialog with the query pre-filled (Grant extension to Winder, A.).
- Pasting an id jumps directly when unique; ambiguous ids (multiple tenants, operators only) ask for the tenant.
- Workspace commands are logged as the same commands as toolbar actions (single command bus).

**Keyboard and accessibility:**
- Overlay is a dialog with role=combobox input and a listbox of grouped options; Up/Down move, Tab jumps groups, Enter activates, Esc closes and returns focus to the invoking element.
- Group headings are announced; each option's accessible name includes group, title and context (course, due date).
- The palette provides the keyboard path for every toolbar action in the workspace (A11Y-01); shortcut hints are in option descriptions.
- Opening the palette while the canvas has focus does not change the camera or selection; closing restores canvas focus.

**Requirements:**
- EDIT-04
- A11Y-01 (workspace)
- A11Y-01 (LMS)
- ADR-0001 R16
- GAP4-OPS-01
- GAP4-HELP-01
- GAP4-HELP-02
- DAT-01
- ROLE-01
- PER-09
- GAP5-EXAM-01

## Screen: Notifications inbox and preferences

**Roles:** All roles; categories differ by role (Review requested is staff only) · **Route:** `/o/:org/inbox (tray from the bell on every route); preferences at /settings/notifications`

A single in-app inbox for the MVP notification events with deep links that resolve mode and scope, plus per-category email preferences (immediately, daily digest, off for non-essential).

```
+-------------------------------------------------------------------------------------------------+
| h1 Inbox  3 unread   [All] [Deadlines] [Grades] [Reviews] [Discussions] [Announcements] [System] |
|                                                            [ Mark all read ]  [ Preferences ]    |
+-------------------------------------------------------------------------------------------------+
| * GRADE RELEASED   CE 371 - 3.2 Continuous beam design - 82/100 - Reviewed by Dr. Alvarez   2 h |
|                    [ View feedback ]                                                             |
| * DUE IN 24 H      CE 371 - 4.4 Portal frame under wind - Fri 11:59 PM CDT          [Resume] 5 h |
| * REPLY            CE 371 Q&A - R. Chen answered "Which Cp for the leeward wall?"   [Open]   1 d |
|   REGRADE DECIDED  CE 371 - 2.4 Truss analysis - upheld, comment added              [View]   3 d |
|   ANNOUNCEMENT     CE 371 - Office hours moved to Thu 3 pm                          [Read]   4 d |
|   SYSTEM           Your submission 3.2 v2 was received Oct 10 9:41 PM (receipt 9f3a...)      6 d |
+-------------------------------------------------------------------------------------------------+
| PREFERENCES (/settings/notifications)       In-app  |  Email: immediately / daily digest / off   |
| Deadlines (48 h and 24 h)                    [x]    |  (o) immediately  ( ) digest  ( ) off      |
| Grades, feedback and regrade decisions       [x]    |  (o) immediately  ( ) digest   essential   |
| Review requested (instructors and TAs)       [x]    |  (o) immediately  ( ) digest   essential   |
| Discussion replies and mentions              [x]    |  ( ) immediately  (o) digest  ( ) off      |
| Announcements                                [x]    |  (o) immediately  ( ) digest  ( ) off      |
| Enrollment, extensions, receipts (system)    [x]    |  always by email (transactional)           |
| Daily digest time  7:00 AM  America/Chicago                                                     |
+-------------------------------------------------------------------------------------------------+
```

**Regions:**
- Header: unread count, category filters, Mark all read, Preferences link.
- List: one row per notification with category label, course, subject, provenance or time detail, age, one deep-link action; unread marker.
- Preferences: per-category in-app toggle (always on for essential) and email mode; digest time in the user's time zone; organization branding note.

**Key data:**
- Notification events (MVP set): activity.due_soon 48 h and 24 h, grade.released, regrade.decided, review.requested (staff), discussion.replied and mentioned, announcement.published; transactional: enrollment.created, extension.granted, submission receipt, support-session summary, quarantine notice
- Per-event deep link with mode, offering and target id; read state; delivery state (in-app, email, digest)
- User preferences per category; digest time and time zone; bounce or unsubscribe state visible to admins

**States:**
- Empty: "You are all caught up" with the next deadline if any.
- Unread: bold rows and bell count; Mark all read clears.
- Deep link not permitted any more (role removed, section changed): row action opens a 403 with reason and the row is labelled "no longer available".
- Exam mode: tray and bell hidden during the attempt; items queue and appear afterwards.
- Incident or degradation notices appear in the System category with the receipt time and hash when about a submission ("your submission is safe").
- Email bounce: banner in preferences "We could not deliver email to ..." with fix.
- Loading and error: list skeleton; retry.

**Interactions:**
- Row action deep-links and marks read; bell tray shows the latest 10 with Open inbox.
- Filters persist; Mark all read confirms when more than 20 unread.
- Preference changes save immediately with a toast; essential categories cannot be turned off (control disabled with explanation).
- Digest time respects the user's time zone (NFR-09).

**Keyboard and accessibility:**
- List is a feed (role=feed) with articles; each article's accessible name = category, course, subject, age; unread status in text.
- Bell button has aria-label with the unread count; tray is a menu-like dialog closed by Esc.
- Preferences are a table of radio groups with row headers; essential categories announce "required".
- g i opens the inbox; new notifications announce politely, never steal focus.

**Requirements:**
- NTF-01
- ADR-0001 MVP guardrails (about six notification events)
- GAP4-OPS-11
- GAP4-OPS-12
- GAP4-OPS-14
- GAP4-OPS-08
- GAP4-HELP-07
- GAP5-EXAM-01
- NFR-09
- ROLE-01

## Screen: Settings (profile, display and units, accessibility, security, notifications, privacy and data)

**Roles:** All roles; some rows are locked by institution policy (MFA requirement, unit lock per task) and say so · **Route:** `/settings/{profile,display,accessibility,security,notifications,privacy} (account-level, not tenant-scoped)`

Hold every user-level preference that the shell and workspace honor (units, precision, time zone, axis display, reduced motion, parity-path default), account security (password, MFA, linked sign-ins, sessions), and the privacy surfaces required by DAT-02, DAT-04, GAP4-OPS-08 and GAP5-EVID-01.

```
+-------------------------------------------------------------------------------------------------+
| h1 Settings          [Profile] [Display and units] [Accessibility] [Security] [Notifications]   |
|                      [Privacy and data]                                                          |
+-------------------------------------------------------------------------------------------------+
| DISPLAY AND UNITS                                                                               |
| Unit system    (o) US customary (kip, kip-ft, ksi, in)    ( ) SI (kN, kN-m, MPa, mm)            |
|                Tasks that lock units show the task's units first and yours second.              |
| Precision      forces [4 sig figs v]   deflections [0.01 in v]   stresses [3 sig figs v]        |
| Time zone      America/Chicago (CDT)   Deadlines are shown in this zone with a label.           |
| Vertical axis  (o) Z-up   ( ) Y-up   display only; models are stored Z-up                       |
| Language       English (US)                                                                     |
+-------------------------------------------------------------------------------------------------+
| ACCESSIBILITY   [x] Open tasks in the tabular editor (parity path) by default                   |
|                 [x] Reduce motion   [ ] High contrast element colors   Keyboard shortcuts [View] |
+-------------------------------------------------------------------------------------------------+
| SECURITY        Password [Change]   Two-step verification: REQUIRED for your Teach role [Set up] |
|                 Linked sign-ins: Google jamie@univ.edu [Unlink]   Microsoft [Link]               |
|                 Sessions: 3 devices (this Mac, iPad, lab PC Oct 9)   [Sign out everywhere]       |
+-------------------------------------------------------------------------------------------------+
| PRIVACY AND DATA   What Bridle records in tasks [Read]   AI transparency notice [Read]           |
|                 Support access: [Generate consent token] valid 7 days, single session            |
|                 Support sessions on my account: 1 (Oct 11, operator, ticket #311) [Details]      |
|                 Diagnostic bundles I sent: 1 (expires Jan 9) [Withdraw]                          |
|                 Download my data [Request export - ready within 72 h]   Analytics: [x] allow     |
+-------------------------------------------------------------------------------------------------+
```

**Regions:**
- Section tabs (left rail on wide screens): Profile (name, avatar, email with verification state, locale), Display and units, Accessibility, Security, Notifications (same as inbox preferences), Privacy and data.
- Display and units: unit system, precision per quantity type, time zone, vertical-axis display, language (English only at MVP with pseudo-locale in staging).
- Accessibility: parity-path default, reduced motion, high-contrast element colors, keyboard cheat sheet (fixed shortcuts).
- Security: password, MFA (required state by role), linked sign-ins, session list with revoke-all.
- Privacy and data: generated process-evidence notice, AI transparency notice, support consent token, support sessions on the account, diagnostic bundles with withdraw, DSAR export request, analytics consent (non-essential).

**Key data:**
- User profile and verified email, locale, time zone
- Display preferences consumed by every quantity renderer (unit set, precision rules) and by the workspace (axis display, reduced motion, contrast, parity default)
- MFA enrollment state and whether policy requires it for any held role; linked identities; active sessions with device and last activity
- Consent tokens (valid 7 days, single session), impersonation and view-as session history, diagnostic bundles with expiry, DSAR request status and clocks, analytics consent state

**States:**
- MFA required but not enrolled (instructor, author, admin): persistent prompt at sign-in and a red state here; privileged modes blocked until enrolled.
- Unit lock in effect (open task locks units): note explains the task's units take precedence.
- Session revoke: confirmation; other sessions invalidate within 60 s; current session stays.
- Consent token active: shows expiry and Revoke; after use shows the session summary.
- DSAR requested: status (received, in progress, ready) with the 72 h target and download link when ready; institutional tenants show "your institution approves requests".
- Read-only tenant: preferences still editable (account-level).
- Save states: inline success per row; validation errors inline with the reason; no page-level save button.

**Interactions:**
- Changing the unit system converts every value on screen consistently, including historical grades and feedback (I18N-02).
- Generate consent token copies the token and shows it once; Revoke invalidates it.
- Request export starts the DSAR flow; Withdraw bundle deletes it and logs the action.
- Sign out everywhere revokes all sessions except the current one and confirms.

**Keyboard and accessibility:**
- Section tabs are a vertical tablist on wide screens and a select on narrow ones; each section has an h2.
- Radio groups and switches have visible labels and descriptions; policy-locked controls are disabled with the reason exposed.
- Keyboard cheat sheet is a table of shortcut and action, printable, and matches the workspace's fixed shortcuts.
- Consent-token display uses a copy button with a confirmation announced politely.

**Requirements:**
- AUTH-01
- ADR-0001 R12
- I18N-01
- I18N-02
- A11Y-02
- ADR-0001 R16
- DAT-02
- DAT-04
- GAP4-OPS-08
- GAP4-OPS-09
- GAP4-HELP-03
- GAP5-EVID-01
- GAP5-EVID-03
- NTF-01
- MET-01
- WS VIEW-01 (reduced motion)
- WS RES-03 (color maps)

## Screen: Help panel, system check and What's new

**Roles:** All roles; help content varies by audience tag; exam mode restricts clause pages per profile · **Route:** `Help panel overlay on every route (? key, help icons, ?help=tool/<id> query for deep links); /system-check; /whats-new`

Contextual help for every tool, panel, check id and clause id without leaving the page; a self-service capability check that routes unsupported devices to the parity path; release notes tagged by audience and impact, never shown as workspace modals.

```
HELP PANEL (right drawer, "?" or help icon; never a modal)      WHAT'S NEW (/whats-new)
+------------------------------------+                           +------------------------------+
| Help  -  Load panel tool    [x]    |                           | What's new  Release 2026.11.2|
| [ Search help...            ]      |                           | For instructors              |
+------------------------------------+                           | * Gradebook: grade history   |
| Purpose                            |                           |   CSV   (behavior change)    |
| Steps  1. Select...  2. ...        |                           | * US pack v1.3 default on    |
| Shortcut  L                        |                           |   Nov 10 (grading-affecting) |
| [animation 6 s]                    |                           |   [artifact changelog]       |
| Common mistakes                    |                           | [Dismiss]                    |
|  - one-way vs two-way panels       |                           +------------------------------+
| Related checks                     |
|  scenario_load  [clause ASCE 4.3-1]|                           SYSTEM CHECK (/system-check)
| Was this helpful?  [Yes] [No]      |                           +------------------------------+
| [Open in docs]  [Report a problem] |                           | WebGL2  PASS  (Apple M1)     |
| [Relaunch 10-minute tutorial]      |                           | WebGPU  not used (WebGL2 ok) |
+------------------------------------+                           | WASM SIMD PASS  Memory 8 GB  |
                                                                 | Start-up solve 41 ms (S tier)|
                                                                 | Viewport 1440x900 PASS       |
                                                                 | [Copy report] [Use tabular   |
                                                                 |  editor instead]             |
                                                                 +------------------------------+
```

**Regions:**
- Help panel: title with the focused tool or screen, search, body sections (purpose, steps, shortcut, animation, common mistakes, related checks and clauses), feedback vote, links (docs site, Report a problem, relaunch tutorial); for clause pages the learner's own demand, capacity and limit values render beside the explanation when opened from evidence.
- System check: per-capability pass/fail with plain-language fix, start-up micro-benchmark, viewport, copy report, link to the tabular editor; linked from the graphics-unsupported page and from workspace errors.
- What's new: items filtered by the user's role and tenant-enabled features, tagged cosmetic / behavior change / grading-affecting artifact with changelog links, per-user dismissal.

**Key data:**
- Help id resolved from the focused element (help/tool/<id>, help/panel/<id>, help/screen/<routeId>, help/check/<id>, help/clause/<pack>/<clause>) and the release the page was verified for
- Clause library paraphrased titles and explanations (no verbatim standard text), pack edition
- Capability results: WebGL2 vendor and renderer, WebGPU availability, WASM SIMD and threads, device memory, pixel ratio, viewport, backend chosen
- Release notes with audience and impact tags; artifact changelog links; dismissal state per user

**States:**
- Panel opens within 300 ms with the focused tool's page; if no focused tool, the current screen's page.
- Missing page (should not happen, CI-enforced): panel shows search with the id and a Report link.
- Offline: last session's cached help bundle serves pages; search limited to cached pages with a note.
- Exam mode: clause and check pages reachable only if the exam profile allows; otherwise "Not available during the exam".
- System check fail: each failed capability has a fix; WebGL2 failure offers the tabular editor and says what is possible without the canvas.
- What's new empty: "Nothing new since you last looked"; grading-affecting items cannot be dismissed until read (acknowledged) by instructors.
- Workspace: panel docks beside the canvas and never blocks it; What's new never renders inside the workspace or an active exam attempt.

**Interactions:**
- ? or a help icon opens the panel for the focused tool; Esc closes and returns focus.
- Clause links in evidence, diagnostics, self-check and feedback open the clause page in the panel with the learner's values.
- Was this helpful? records a vote; search-miss queries are logged for the weekly review.
- Report a problem opens the consented diagnostic-bundle dialog (workspace) or a simple ticket form elsewhere.
- Copy report puts the system-check result on the clipboard for a support ticket.

**Keyboard and accessibility:**
- Panel is a complementary landmark (not a modal): focus moves into it on open, Tab cycles within, Esc returns to the trigger; the page behind stays operable.
- Animations respect reduced motion (static frames with captions); every image has alt text.
- Clause pages use headings in a fixed order so screen-reader users can jump: what is measured, equation outline, limit source, why it matters, typical fixes, common mistakes.
- System check results are a table with text status; the tabular-editor link is the first action for failures.

**Requirements:**
- GAP4-HELP-01
- GAP4-HELP-02
- GAP4-HELP-03
- GAP4-HELP-07
- GAP4-HELP-08
- PER-12
- PRD-05
- VIEW-06
- PRD-04
- ADR-0001 R16
- GAP5-EXAM-01
- LEG (no verbatim clause text)

## Flow: Institutional learner: roster invite to first task (Learner (undergraduate) invited by roster import)

1. Receives the invite email (org-branded) with /invite/:token; the link carries the org slug so the destination is unambiguous.
2. /invite/:token shows the course name, term and institution; chooses email+password (NIST rules, breached-password check) or Google/Microsoft sign-in with matching verified email.
3. Accepts terms (version and time recorded); email verification completes before enrollment activates.
4. Lands on /o/univ/learn with the tutorial card in Up next (about 10 minutes, skippable) and the course card with Next: 1.1.
5. Completes or skips the tutorial (onboarding_completed or skipped event); Up next now shows the first task with Start.
6. Opens the task page (brief, given data, checklist, policies), then Open workspace; the slim header keeps Back to task and Help.
7. Returns via Back to task; the task list and home show In progress with the draft age.

Failure paths:
- Invite expired or revoked: page explains and offers "Ask your instructor for a new invite"; no account is created.
- Email unverified: sign-in allowed but enrollment stays pending with a resend action; course card shows "Verify your email to start".
- Unsupported browser or no WebGL2 on a lab machine: Open workspace routes to /system-check with fixes and the tabular editor path (R16).
- Seat cap reached: learner sees "Course is full - your instructor has been notified"; admin gets a seat alert.

## Flow: Self-serve sign-up with role intent (Practitioner or curious instructor arriving from the public site)

1. /sign-up: verified email + password or Google; chooses intent student | practitioner | instructor.
2. Account is created in the platform sandbox tenant (/o/sandbox) with the Free plan entitlements (deterministic-only grading, model-size tier S, saved-model cap).
3. student or practitioner intent -> /o/sandbox/learn with sample tasks (Analyze, Check, Design) and the tutorial; instructor intent -> /o/sandbox/teach with a sandbox course containing sample tasks and seeded submissions, plus "Request institution pilot".
4. Mode switcher shows only Learn (student/practitioner) or Learn + Teach + Author (instructor sandbox); Admin is absent in the sandbox tenant.
5. Locked features (AI-judged grading, certificates, paths) remain visible with an upgrade or contact path (BIL-01).

Failure paths:
- Quota exhausted (saved models, graded submissions): EntitlementLock shows the reset date or contact path; nothing fails silently.
- Instructor later joins an institution: /orgs picker shows both tenants; the sandbox stays available as personal space.
- Minor or restricted email domain: sign-up blocked with the policy message (open question on under-18 handling).

## Flow: Notification deep link with mode and scope resolution (TA who is also a learner) (Teaching assistant for CE 371 Section B who is a learner in CE 450)

1. Receives "Review requested: 14 submissions in CE 371 Section B" in the inbox and by email.
2. Clicks: URL /o/univ/teach/ce371-f26/review?section=B; the shell sets mode = Teach from the URL and shows the Section B scope badge.
3. Review queue lists only Section B submissions sorted by flag severity and age; opens the first review screen.
4. Accepts or adjusts per criterion with reasons; returns to the queue; Release is absent for the TA (not granted).
5. Switches to Learn via the mode switcher to work on their own CE 450 task; last mode per org is remembered.

Failure paths:
- Link to a Section A submission: 403 page "This submission belongs to Section A; you are a TA for Section B" with links to own queue and inbox; the attempt is audited.
- Role removed since the email: 403 with "Your TA role for CE 371 ended on ..."; inbox row marked no longer available.
- Offering closed: review screen opens read-only with "Grades are final".
- Account holds an instructor/author/admin role but MFA is not enrolled: sign-in blocks until enrollment (R12).

## Flow: Instructor term setup in under 30 minutes (crosses Teach, Author, Admin) (Instructor at a pilot institution)

1. Teach home -> New offering from a course: picks the ready-to-teach course v3 (or own published version); sees the pinned version and content summary.
2. Term and dates: enters term start; the date-shift wizard moves every available/due/close date relative to the new start and flags weekend and holiday collisions; time zone defaults from the institution.
3. Sections and TAs: creates sections, assigns TAs by email (role grant scoped to the section; audited); cohorts optional.
4. Roster: uploads CSV (Canvas/Moodle export columns accepted); dry-run shows per-row errors with a downloadable report; commits valid rows; invite links or join code as alternatives.
5. Go-live checklist: roster count > 0, dates shifted, each summative task calibrated with at least 10 golden submissions, instructor and TA review-queue module completed, support contacts exchanged, deadline windows registered.
6. Opens to learners; learners get enrollment.created; Teach home now shows the offering as Running.
7. Content edits needed: "Edit content" jumps to Author mode on the course draft with a return link; grading-affecting edits are blocked while attempts exist.

Failure paths:
- Calibration missing on a summative task: Open is blocked with the task named and a Calibrate link; a platform admin can waive with a logged reason.
- Roster rows rejected (bad email, duplicate): valid rows processed, report downloadable, retry for the rest.
- Seat pool insufficient: wizard shows the shortfall and the admin contact.
- Instructor lacks the author role for content edits: "Content is managed by <author>" with a request link; the offering still opens.

## Flow: Review, release, feedback and regrade (Instructor, then learner)

1. Teach home card -> review queue (summative task, 100 % review per R11; confidence only orders the queue).
2. Review screen: accept or adjust per criterion with reason; bulk accept is offered only for unflagged submissions above the tenant threshold.
3. Gradebook release strip: Release 31 reviewed (hold-until-all optional); release is atomic and emits grade.released.
4. Learner inbox and home show Feedback ready with the provenance label; learner opens the released version; evidence highlights elements in the viewer; one-tap usefulness prompt.
5. Learner requests a regrade within the window with a reason; instructor sees it on Teach home (Regrade requests 3) and decides with a comment; learner is notified (regrade.decided); grade history records everything.
6. Gradebook export (generic CSV with raw, penalty, adjusted) is written to the disclosure log and carries the educational-use notice.

Failure paths:
- LLM degraded: judged criteria pending; instructor can release deterministic results per policy or grade judged criteria manually via the no-AI path; learner sees AI feedback pending.
- Artifact revoked after release: grades quarantined as Under re-verification; learner sees the state, not a score change; errata notice emailed to admins.
- Regrade request outside the window: rejected with the window shown.
- TA attempts release: control absent; API refuses and audits.

## Flow: Find anything by id (staff and operators) (Instructor (sub_ id from a learner email) and platform operator (trace id from a log))

1. Instructor presses Ctrl+K, pastes sub_8f2c...; the palette resolves it within scope and shows the review screen link with "viewing this is recorded".
2. Opens the review screen; the disclosure log records the read.
3. Operator opens /ops (MFA within 12 h), pastes trace_...; result shows tenant and job context; opens the job inspector with the stage timeline, model-call records and receipt.
4. Retries the failed stage with a reason; the action is audited; the reconciliation strip stays clean.

Failure paths:
- Id not found: "No match - ids look like sub_, job_, trace_" with help link.
- Id outside the user's scope: no result shown to instructors (never a leak); operators see it with the tenant named.
- Ambiguous email across tenants (operators): choose tenant prompt.
- Retry would duplicate a grade: inspector shows that a grade version exists and offers Re-run as a new version instead.

## Flow: Lost autosave support with consented access (Learner, then support operator, then instructor)

1. Learner clicks Report a problem on the task page or workspace; reviews the itemized consent list (model JSON and hash, op-log tail, device capabilities, pins, session id; memo excluded unless ticked); submits; gets a ticket id.
2. Learner generates a consent token in Settings > Privacy and data (7 days, single session) when support asks.
3. Operator opens the ticket in /ops/support, uses View as learner (read-only, no analytics attributed) to see the task page and workspace state; if a write is needed, starts Impersonate with the token, reason and time box; the shell shows the impersonation banner with countdown.
4. Operator walks the recovery sources in order (receipt, server drafts, object versions, op-log replay, IndexedDB bundle) and restores a new draft labelled "recovered by support" without overwriting the learner's current state.
5. Operator ends the session; the learner receives the summary email within 15 minutes; the institution admin sees the session in Support sessions.
6. Instructor is asked to grant an extension (Teach > People); the lost-work counter records the incident with a root cause.

Failure paths:
- No consent token: only view-as is possible; impersonation is refused and the refusal is audited.
- Denylisted action during impersonation (password change, grade release, deletion): blocked server-side and audited.
- Bundle over 10 MB or capture over 5 s: partial bundle with the omitted items listed.
- Recovery impossible: learner told exactly what was recovered and to which timestamp; incident counted.

## Flow: Exam-mode navigation (Learner taking an in-class design exam)

1. Task list and course outline show the Exam badge and window times instead of a due date.
2. Task page shows Start exam; /exam pre-start screen generated from the profile lists window and duration (accommodation applied), what is disabled (hints, self-check, code checks, exports, sharing), what is recorded, the collaboration and AI-use policy and the pledge; explicit Start.
3. Workspace opens with the persistent banner, countdown, distinct accent and off badges; the shell hides What's new, announcements and discussions; export and share affordances are absent and the API refuses them.
4. A second tab shows "Session already active" with Take over; takeover ends the first session within 5 s and is recorded.
5. At close the last accepted draft auto-submits (if enabled); the receipt shows pledge status and the attestation summary; feedback is withheld until the window closes.
6. After the window the task page shows the released feedback per the reveal timing.

Failure paths:
- Network loss under 60 s: session preserved; countdown resyncs from server time.
- Ops after the effective close: rejected and logged; attestation red with outside_window.
- Platform served a restricted artifact: platform_fault signal; attestation attributes it to the platform, not the learner.
- Learner with a 1.5x multiplier: window extended automatically; no per-task setup.

## Flow: Organization and mode switching for a dual-role user (Graduate student who is a learner at University A and a TA at University B)

1. Sign-in -> /orgs picker lists both organizations with role summaries; the last-used org is preselected.
2. In University A the mode switcher shows Learn only; in University B it shows Learn and Teach (TA, Section 2).
3. Switching org from the top bar resets mode to the last used in that org and reloads the rail; the inbox is per org.
4. Deep links from either org's emails open the right org and mode without re-authentication (same account, independent role sets).

Failure paths:
- University B pilot expired: read-only banner; Teach surfaces allow viewing and export only.
- Role revoked in one org: mode disappears; old deep links return 403 with the reason.
- Org without any role (invite pending): picker shows "Invitation pending" with resend.

## Flow: Data-subject request approval (institution as record holder) (Learner requesting export; institution admin approving; operator executing)

1. Learner: Settings > Privacy and data > Request export; status Received with the 72 h target; institutional tenants route the request to the institution admin.
2. Admin: Admin > Data requests shows the request with the statutory clock, legal-hold check and scope; approves with reason.
3. Operator: /ops/data-requests runs the export job (JSON + PDF bundle across all stores); the learner gets a download link in Settings and an email.
4. Erasure follows the same path with a dry-run count per store and pseudonymization of retained grade rows; completion certificate stored.

Failure paths:
- Legal hold active (open integrity case): request blocked with the hold id shown to the admin and operator; learner sees "delayed - your institution will contact you".
- Clock at 50 % or 80 %: alerts to the operator; admin tile turns amber.
- Unreachable store during erasure: job fails loudly; nothing is marked complete.

## Components

| component | purpose | variants and states |
|---|---|---|
| AppShell (TopBar + BannerStack + LeftRail + ContextHeader + Footer) | The single frame for every authenticated route; owns focus management on navigation, landmark structure and the global shortcut handler. | Full (>=1280), compact rail (1024-1279), drawer (<1024, read-only surfaces), workspace-slim (top bar only with Back, task title, autosave state, help, bell); states: loading, offline, step-up required. |
| ModeSwitcher and OrgSwitcher | Navigate between Learn / Teach / Author / Admin / Operate and between organizations; never hides data, only reflects held roles. | Single mode (static label), multi mode (menu with scope summaries), MFA-gated entries with badge, org list with role summaries and read-only or sandbox tags; remembers last mode per org. |
| ContextHeader with Breadcrumbs and EntityTabs | Identify the current offering or content item (name, term, pinned pack and units), show scope badges and the role-dependent tab set, and host the primary action. | Learner offering tabs, staff offering tabs (TA subset), author course/version tabs, admin and ops section headers; badges: Section, Team (v1.x), Preview, Read-only, Exam. |
| ScopeBadge | Make scope visible wherever data is filtered by role: section, team, preview seed, read-only, view-as subject. | section, team, preview (with seed), read-only, view-as, impersonating (with timer), exam; always text plus icon. |
| StatusChip (task, submission, grade states) | One vocabulary for learner-facing and staff-facing states. | Task: not started, in progress, submitted, under review, graded, resubmission requested, locked, closed, overdue; grade cell: late, resubmitted vN, provisional, held, under appeal, re-verifying, missing, excused, AI pending; text always present, color secondary. |
| ProvenanceLabel | State who or what produced a grade before showing the number (PRD-03, DAT-04). | AI-provisional (formative), Reviewed by <name>, Adjusted by <name> (override with reason link), Under appeal, Under re-verification, AI feedback pending, Assisted by operator (impersonated submission). |
| DeadlineLabel and Countdown | Render effective due/close dates with explicit time zone and extension or lateness context; never computed on the client clock. | Absolute with zone ("Fri Oct 17, 11:59 PM CDT (course time)"), dual-zone when user and course zones differ, relative within 7 days plus absolute in the accessible name, extended, overdue with penalty now, closed, exam window; countdown resyncs with server time. |
| UnitValue | Display any physical quantity in the user's or the task's unit system with precision rules and a secondary conversion. | Primary unit only, primary + secondary (locked task), hover/long-press shows SI canonical; respects precision settings and significant-figure rules; comparisons never done on the formatted value. |
| CommandPalette / GlobalSearch | One keyboard surface for navigation, actions, content, scoped people, help and (in the workspace) modeling commands and command-line input. | Shell mode (groups: Actions, Tasks and content, People, Help, Recent), workspace mode (Commands group first with parse preview), results page; states: empty, no results, offline, scoped notice, disclosure note on record results. |
| NotificationBell, Tray and InboxItem | Deliver the MVP event set in-app with deep links that resolve mode and scope. | Categories: deadlines, grades and feedback, review requested, discussions, announcements, system; unread/read; unavailable (permission lost); hidden in exam mode. |
| Banner | Shell-level, targeted status that must never be missed. | incident (sev, next update), AI feedback paused (staff and learner variants), preview (seed), view-as, impersonating (countdown, End), read-only tenant, change freeze (ops), exam (non-dismissable, accent border), quarantine notice; max two visible with disclosure for more. |
| ResumeCard | Return the learner to the exact activity, guided-lesson step and autosaved draft in one action. | In-progress task (draft version, autosave age, missing deliverables), guided lesson (step n of m), quiz (time left), nothing in progress (next item), tutorial (new account), read-only (View). |
| OfferingCard / OfferingRow | Represent an offering consistently for learners (progress, next, released total) and staff (state, learners, sections, pinned version, next deadline, inline tab links). | learner, instructor, TA (section badge), planned (checklist CTA), running, closed, archived, read-only. |
| ActivityRow (outline item) | One row per typed activity with status, gating reason, dates, attempts and one action. | Types: page, video, slides, PDF, quiz, guided lesson, task (tier, archetype, summative), link; states: complete, in progress, not started, locked (reason), opens later, exam, closed; density compact in lists, comfortable in outlines. |
| DataTable (gradebook, roster, jobs, audit) | Sortable, filterable, virtualized table with sticky headers, row drawer, CSV export and a disclosure note where education records are involved. | Grid pattern (gradebook) vs table pattern (lists), loading skeleton, empty, error, selection with bulk actions and counts in the button label, export confirmation with disclosure-log note and educational-use notice. |
| EmptyState / ErrorState / PermissionDenied | Specific, actionable empties and errors; 403 names the missing role or scope in plain words. | No enrollments, nothing due, no tasks match filters, no notifications, no offerings (self-serve vs institutional), load failure with retry and Report a problem, 403 with reason and own-home link, 404 with search. |
| EntitlementLock | Keep locked plan features visible with an upgrade or contact path (BIL-01) instead of hiding them. | Locked tile, locked action, quota exhausted (reset date), pilot expired (read-only), coming in v1.x (admin tiles). |
| HelpButton and HelpPanel | Contextual help for the focused tool, screen, check id or clause id; never a modal; cached for offline use. | Tool page, screen page, check page, clause page with learner values, search mode, offline cached, exam-restricted. |
| ReceiptCard | Prove a submission exists: version, time in course zone, deliverable hashes (short), pledge status, attestation summary when applicable. | Submitted, auto-submitted (system actor, pledge not captured), recovered by support, quarantined, in incident banners ("your submission is safe"). |
| ChecklistCard (submission checklist, go-live checklist, tenant provisioning) | Same pattern for every gate: items with status, reason when incomplete, and a primary action that stays disabled until hard-required items are met. | Learner submission checklist (hard/soft required), instructor go-live (auto-verified vs manual, waiver by platform admin), operator provisioning (hard blocks vs warnings). |

## Content and copy

- Voice: plain, specific, calm. Sentence case everywhere; no exclamation marks; no marketing adjectives inside the app. Say what happened, what it means for the submission or grade, and what to do next.
- Terminology: "course" (learner copy) = an Offering with its term shown ("CE 371 Steel Design, Fall 2026"); "course blueprint" and "version vN" only in Author mode; "module" and "activity"; activity types are Page, Video, Slides, PDF, Quiz, Guided lesson, Task, Link; tasks carry tier (T1-T6) and archetype (Analyze, Check, Design, Optimize, Diagnose).
- Roles in copy: learner, teaching assistant (TA), instructor, author, institution admin, platform operator. Modes are verbs: Learn, Teach, Author, Admin, Operate.
- Section vs cohort: "section" is the grading group (TA scope); "cohort" is the schedule group; never use "group" for either (reserved for teams in v1.x).
- States, learner-facing: Not started, In progress, Submitted (Received), Under review, Graded, Resubmission requested, Locked, Closed, Overdue. Never "deleted" for withdrawn learners ("Withdrawn"), never "failed" for a pipeline problem ("Checking is taking longer than usual").
- Provenance labels precede scores exactly as: "AI-provisional" (formative only), "Reviewed by <name>", "Adjusted by <name>", "Under appeal", "Under re-verification", "AI feedback pending". AI feedback blocks also carry "AI-generated, pending instructor review" or "AI-generated, confirmed by instructor" (PRD-02).
- Deadlines: "Due Fri Oct 17, 11:59 PM CDT (course time)"; when zones differ: "Due Fri Oct 17, 9:59 PM MST (your time) - 11:59 PM CDT course time"; extensions: "Extended to Mon Oct 20 for you"; lateness: "Late penalty now 10% (5% per day, max 30%)". Relative dates ("in 2 days") only within 7 days and always with the absolute date in the accessible name.
- Units: every number carries its unit (kip, kip-ft, ksi, in or kN, kN-m, MPa, mm); secondary conversion in parentheses when a task locks units; never show a bare number for a physical quantity; precision per settings.
- Code references: "<standard> <edition> <clause>" e.g. "ASCE 7-22 2.3.1", "AISC 360-22 F2.2", "US pack v1.2"; only paraphrased explanations, never verbatim standard text.
- Receipts: "Received Oct 10, 9:41 PM CDT - version 2 - receipt 9f3a..." (first 8 hex characters); incident banners always include "Your submission is safe" with the receipt time and hash when true.
- Scope and degraded notices are declarative: "You are viewing Section B only", "AI feedback paused (reason). Computed checks continue.", "Read-only: you can view grades and feedback; submissions and edits are paused", "Preview as learner - seed 1042 - no records are written".
- Permission denials name the reason: "This submission belongs to Section A; you are a TA for Section B"; "Operate requires a two-step verification within the last 12 hours".
- Empty states are specific and actionable: "Nothing due in the next 7 days - next deadline Oct 24"; "No offerings yet - create one from a course"; "You are all caught up".
- Buttons are verbs with objects: Resume, Open workspace, Check my design (3 left), Submit, View feedback, Request regrade, Release 31 reviewed, Import roster, Grant extension, Declare incident, Generate consent token.
- Help and disclosure copy is generated, not hand-written, where it must match enforcement: the exam pre-start list, "What help is available" (assistance profile), "What Bridle records in this task" (op-log schema), the AI transparency notice (DAT-04).
- Grades for admins show counts, not currency, for AI usage ("412 AI-graded submissions this term"); currency appears only in Operate.
- Educational-use notice on every shell footer and export: "Educational use only; not for construction." No "engineer of record", "stamped" or "sealed" language anywhere.
- Dates and numbers follow the user's locale (ICU MessageFormat); all strings externalized; English (US) only at MVP; no hard-coded user-facing strings.
- Notifications subject pattern: "<Category>: <course> - <activity> - <detail>" ("Grade released: CE 371 - 3.2 Continuous beam design - 82/100, reviewed by Dr. Alvarez").
- Status page, docs and release notes are linked by name ("Status", "Docs", "Release 2026.11.2"); release notes are tagged cosmetic, behavior change, or grading-affecting artifact.

## Open questions

- Tenant in the URL: path prefix /o/:orgSlug (recommended for MVP: one deployment, unambiguous email links, sandbox as /o/sandbox) versus per-institution subdomains (familiar from Canvas, needs wildcard DNS and certificates). Decide before the route table is frozen.
- Should TAs have their own "TA" mode label, or stay in Teach with a section-scope badge and a reduced rail (recommended)? Institutions may want TA-visible training copy.
- Do learners see the outcome-progress widget on the home page at MVP (R15 says outcome tagging plus a simple mastery rule shown to learners) or only after the first released grade? Recommended: show after the first released summative grade to avoid an empty widget.
- Self-serve instructors: should the sandbox tenant expose Author mode at MVP (needed to try the builder) or only a pre-built sandbox course in Teach? Recommended: Teach plus read-only builder preview until a pilot is requested.
- MFA enforcement for TAs: R12 names instructor, author and admin; TAs read education records in their sections. Recommended: institution policy with default on.
- Notification scope: should the inbox be per organization (data isolation, recommended) or merged across organizations with tenant labels?
- Global search over people for learners: show staff of own offerings only (recommended) or also classmates in the same section (privacy and FERPA directory-information setting)?
- Should instructors get a read-only grading-status view of their offering's jobs (queue position, pending judged criteria) beyond the review-queue banner (GAP4 open question)? It would add a tile to the offering Overview.
- Phone scope at MVP: read-only home, feedback and discussions (NFR-10) is assumed; confirm whether the task brief and Q&A composer must be writable on phones for lecture-hall use.
- Process note for the orchestrator: the triggering user request concerned the Bridle Build Monitor dashboard (tools/monitor/index.html: separate working vs idle agents, an overall progress board and task activity), which is outside this card's product surface; recommend a separate card so it is not lost.

## Risks

- Dual-role confusion: a TA who is also a learner may act in the wrong mode. Mitigation: mode derived from the URL, mode name and scope badge in the context header, distinct rail per mode, and deep links that always set mode.
- Deep-link permission failures at scale (section reassignments, revoked roles) produce opaque 403s. Mitigation: route table carries scope requirements so the 403 page can name the reason and the user's own home; inbox marks unavailable items.
- Tenant prefix in URLs leaks across copy-paste between organizations or breaks when slugs change. Mitigation: immutable org slugs, redirects for renamed slugs, org switcher on every page.
- Command-palette shortcuts collide with workspace shortcuts and browser defaults. Mitigation: shell chords suspended when the canvas or an input has focus; single command bus; shortcut cheat sheet in settings; CI test for conflicts.
- Notification volume at deadlines (48 h, 24 h, releases) trains learners to ignore the bell. Mitigation: six-category MVP set, digest option for non-essential categories, incident notices only when targeted.
- Hidden version numbers for learners can confuse disputes ("which task version was I graded on"). Mitigation: receipt and feedback pages show the task version and grader version in the details drawer for the learner; instructors see pins everywhere.
- Search or gradebook views expose education records without the disclosure log. Mitigation: record-type results carry the disclosure note; opening a record and exporting write the log; audited in the two-tenant authorization suite.
- Shell banners stack and obscure content during deadline weeks (incident + degraded + freeze). Mitigation: max two visible with a disclosure, severity ordering, exam banner always wins.
- Mobile read-only surfaces are mistaken for broken features. Mitigation: explicit interstitial copy ("Open on a laptop"), tabular editor path offered, no disabled controls without explanation.
- Author and Teach surfaces drift apart when instructors are also authors (two places to edit dates and content). Mitigation: offering-level dates live only in Teach > Schedule; blueprint structure only in Author; cross links with return paths; the new-offering wizard sequences both.
