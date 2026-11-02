# 3D simulation workspace (modeling, live analysis, results, s

_Surface design from the UI/UX workflow (designer agent), 2026-11-03. 13 screens, 9 flows, 33 components._

## Summary

The workspace is one fixed, learnable layout (1280x720 minimum: 44 px task header, 48 px tool rail, canvas >= 60% width, 320 px collapsible right rail with six tabs, collapsible bottom dock, 28 px status bar) over one immutable canonical model document edited through a single command bus that serves the toolbar, shortcuts, command palette, tabular editor and tests. Z-up global axes and the XZ plane for 2D mode are fixed by ADR R8; the same checks artifact runs in-browser for live utilization and the self-check and on the server for grading (R9), so the self-check panel and the grader feedback overlay render the same EvidenceCard. Live analysis is always labeled with one of four states (Fresh, Running, Stale, Paused) in the status bar and on every legend, results keep the last valid overlay dimmed while recomputing, and the per-task size cap (R14) is a visible meter that disables creation tools at 100% rather than failing silently. Validity errors (mechanism, unconnected nodes, singular matrix, missing section) name the entity, the DOF and the likely cause, offer a one-click fix, and animate the null-space mode. The task's assistance-and-disclosure profile (coach / summative / exam) drives what is visible with explicit 'off' badges, while exam mode's data-bearing features are withheld server-side and signaled by a non-dismissable banner. The accessible parity mode (tables + command line + textual summary + keyboard camera) is a peer layout selectable from the header, used on no-WebGL lab machines, and covers every modeling and results action (R16). Thirteen screens, nine flows, 26 components and copy rules follow. Critical files to implement first (greenfield; proposed paths): apps/web/src/workspace/WorkspaceShell.tsx (layout, profile-driven visibility, status bar); apps/web/src/workspace/commands/commandBus.ts and palette/grammar.ts (single command bus and command-line grammar); apps/web/src/workspace/analysis/liveLoop.ts (worker protocol, sequence numbers, debounce, Fresh/Running/Stale/Paused state); apps/web/src/workspace/results/ResultLegend.tsx and overlays (deformed, diagrams, utilization, reactions, grader outlines); apps/web/src/workspace/parity/TabularEditor.tsx (parity layout); apps/web/src/workspace/check/EvidenceCard.tsx (shared by self-check, diagnostics and feedback); packages/contracts/assistance-profile.schema.json. Source inputs: /Users/johnstephenf.garcia/Dev/Dev/Bridle-1/docs/decisions/0001-mvp-scope-resolutions.md and /Users/johnstephenf.garcia/Dev/Dev/Bridle-1/docs/requirements/03-3d-interaction-and-visualization-workspace.md.

## Principles

- One document, one command bus: every mutation (toolbar, shortcut, palette, tables, guided-lesson 'show me', tests) is the same named, invertible command; camera, selection, visibility and probes are view state and never enter the model hash.
- Live means honest: the analysis status is always one of Fresh, Running, Stale or Paused, shown in the status bar and on every legend; a stale overlay is desaturated and badged within one frame; no result number is ever shown without its case or combination name.
- Teach at the point of failure: a validity message names the entity label, the DOF and the likely cause in plain words, offers a one-click fix where one exists, and can animate the mechanism; a singular matrix is never shown as a solver error.
- Same evidence everywhere: diagnostics, the pre-submission self-check and the released grader feedback render the same EvidenceCard (status, subject, metric with units, limit, governing combination, clause id, action) from the same checks artifact the server uses, so what the learner sees before submitting is what the grader finds.
- Parity is a mode, not a fallback: the tables layout, command line, result tables, textual summary and keyboard camera are peer surfaces with full coverage of modeling and results actions; the canvas is one view of the model.
- The profile decides what is shown, the server decides what is served: the task's assistance-and-disclosure profile hides or badges features ('Off in exam mode', 'Off for this task'); data-bearing features (checks artifact, hints, exports, share links) are refused at the API in exam mode and the client never pretends otherwise.
- Fixed, learnable layout at MVP: 1280x720 minimum, canvas at least 60% width with one rail open, collapsible rails and dock, fixed shortcuts plus a command palette; no dockable panel system.
- A legend is part of the result: whenever an overlay is drawn the legend states quantity, units, case or combination, scale factor, sign convention, band thresholds and the above-1.0 style; legends render into screenshots.
- Bounded by design: the model-size cap and performance tier are visible in the status bar; tools disable at the cap with a reason; nothing degrades silently.
- Reversible and recoverable: 200-step undo, drag and dialog operations as single steps, merge and transform undoable in one step, per-change revert in Diagnose tasks, local autosave within 2 s, offline editing with reconciliation.
- Engineering vocabulary, educational framing: entities by label, values with units and task precision, clause ids with paraphrased titles, never verbatim standard text, never 'sealed', 'stamped' or engineer-of-record language; the D1 disclaimer badge is always present.

## Screen: WS-01 Workspace shell (3D task workspace)

**Roles:** Learner (edit); Author (author mode adds lock/hidden/required toggles, label editor, seed explorer, compare-with-reference, preview-as-learner banner); Instructor/TA (inspect mode: read-only snapshot by default, 'Experiment on a copy' creates a labeled clone; live-observer mode v1.x); Operator (support replay: read-only, isolated, banner 'Support replay - not the learner's record') · **Route:** `/offerings/:offeringId/tasks/:taskId/workspace (sandbox: /sandbox/:modelId); right-rail tab via ?panel=props|model|loads|results|check|deliver; dock via ?dock=table|diagnostics|history|tables`

The master layout every other workspace screen lives in: a canvas for direct manipulation, a tool rail with the tool-mode state machine, a right rail for properties/model/loads/results/check/deliverables, a bottom dock for lists, and a status bar that always states working plane, units, selection, size cap, analysis state, autosave and the educational-use disclaimer.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ ◀ Task │ Portal frame under wind · Design · T4 │ Personal ▾ │ Individual · AI: disclose │ ● Coach │ Submit ▸ │ ? │
├────┬─────────────────────────────────────────────────────────────────────────┬───────────────┤
│ V  │ [Top][Front][Right][Iso] [Ortho⇄Persp] [Lines⇄Solid] [Labels] [Color: Utilization ▾] [Fit] │ Props │ Model │
│ N  │                        ┌────────────────────────────┐                    ┌────┐ │ Loads │ Results│
│ M  │                        │ ▼ C4  1.2D + 1.0W(+X) + L ▾ │                    │ Z↑ │ │ Check │ Deliver│
│ S  │                        └────────────────────────────┘                    │ ●X │ ├───────────────┤
│ L  │                                                                           └────┘ │ PROPERTIES    │
│ A  │           C1 ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━● C2                          │ 3 members     │
│ T  │             ┃ ╲    deformed ×25 (ghost dashed)     ╱ ┃                           │ Section W12x26│
│ P  │             ┃   ╲ ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈ ╱   ┃  ░░░ 0.84                 │ Material A992 │
│    │             ┃        B1 ━━━━━━━━━━━━━━━━━━━━━        ┃                           │ β (deg) varies│
│    │             ┃  (locked: grey-blue, lock icon on hover)┃                           │ Releases i:M j:–│
│    │           ▲ N1 pin                              ○▲ N2 roller-X                   │ Lb (m)  3.00  │
│    │          ▔▔▔                                     ▔▔▔                              │ K       1.0   │
│    │ ┌─ Utilization · combined (AISC H1) · C4 ─────────────────────────┐              │ [Apply to all]│
│    │ │ 0.0 ░░ 0.2 ▒▒ 0.4 ▓▓ 0.6 ██ 0.8 ██ 1.0 ▓▓▓ >1.0 hatched  ● FRESH │              │ ? Properties  │
│    │ └──────────────────────────────────────────────────────────────────┘              │               │
├────┴─────────────────────────────────────────────────────────────────────┴───────────────┤
│ ▸ Results table   ▸ Diagnostics ● 0   ▸ History   ▸ Tables                                   │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ Plane XZ@0 ▾ │ Snap ● │ kN · m ▾ │ 3 members selected │ Members 42/300 │ ● Fresh 38 ms · Tier S │ Live ▾ │ Saved 2 s ago │ ⓘ records │ Educational use only ⓘ │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Regions:**
- Header task strip (44 px): back to task page; task title with archetype and tier chip; ownership badge (Personal / Team <name>, with a reserved lock-state slot 'You are editing' / '<name> is editing - Request edit' for v1.x teams); collaboration and AI-use policy chips; assistance profile chip (Coach / Summative / Exam) that opens 'What help is available'; Submit button (opens checklist); help '?'.
- Left tool rail (48 px, fixed, not collapsible): Select V, Node N, Member M, Support S, Load L, Assign A (section/material/release paint), Transform T (move/copy/array/mirror/replicate), Probe P. Tools hidden by the task's workspace preset are shown greyed with tooltip 'Not available in this task'. Each tool has a stable help id.
- Canvas (>= 60% width with one rail open): top view bar (presets 1-7, ortho/perspective 5, centerline/solid, labels, color-by none/section/material/group/utilization, named views, fit Home, frame F); persistent case switcher pill centered at the top showing the combination formula; navigation cube top-right drawn Z-up and clickable; working-plane grid; locked elements styled grey-blue with a lock icon on hover; hidden author geometry not rendered; legend bottom-left; snap tooltip and gizmo HUD near the cursor.
- Right rail (320 px, collapsible with Alt+0; tab strip with icon + short label): Props (contextual property panel), Model (entity tree with type-ahead, isolate/hide, named groups), Loads (WS-04), Results (WS-05), Check (self-check WS-07 and link to diagnostics), Deliver (WS-08).
- Bottom dock (collapsed by default, 220 px when open, resizable): Results table, Diagnostics (with live count badge), History (command list with timestamps; click undoes/redoes to that point), Tables (parity editor, same component as WS-11).
- Status bar (28 px): working plane chooser (XY@level, XZ, YZ, custom 3 points; locked in 2D); snap on/off with priority tooltip; units preset (SI kN-m-mm-MPa or US kip-ft-in-ksi) per task; selection summary ('3 members, 1 node'); SizeCapMeter ('Members 42/300'); AnalysisStatusChip ('● Fresh 38 ms · Tier S' with timing popover); Live menu (Live / Live debounced / Manual: Run Ctrl+Enter); autosave state; 'ⓘ records' link to 'What Bridle records in this task'; DisclaimerBadge 'Educational use only ⓘ' (non-dismissable, opens D1 text).

**Key data:**
- Task title, archetype, tier, assistance profile id, collaboration and AI-use policy, ownership (ownerType/teamId), attempt count and deadline (from the checklist).
- Model: nodes, members (section, material, beta, releases, design attributes Lb/K/Cb/bracing), supports, loads, cases, combinations, groups, grids, levels, lock/hidden/required flags from the task.
- View state: camera, projection, display style, labels, color-by, active case, visibility, named views, probes (never hashed).
- Analysis: state, last solve timings, DOF, tier, engine artifact version, model hash prefix, result hash prefix.
- Size cap: members used/cap, DOF used/cap (when set), from the task; identical rule on the server.
- Autosave: last local save time, last server save time, pending ops count.

**States:**
- Loading: skeleton layout, canvas placeholder with 'Loading solver (0.5 MB)…' progress; interactive within 4 s warm / 7 s cold on the reference laptop; a Tier M model opens within 2 s after download.
- Empty sandbox: canvas hint 'Press N to place a node, or Ctrl+K and type node 0,0,0'; task starter models are never empty.
- Analysis Fresh / Running / Stale (recomputing) / Stale (blocked by N errors) / Paused (manual) / Failed ('Solver error - Report a problem'); overlays desaturate and show a STALE badge within one frame of an edit.
- Offline: banner within 5 s of connectivity loss 'Offline - edits and analysis continue locally; saves sync on reconnect (last server save 10:42)'; on reconnect conflict: 'Another session saved a newer version at 10:45. [Keep mine] [Load theirs] [Compare]' with restore-previous.
- Below 1280 px: banner 'This window is narrower than 1280 px. Panels open as drawers; enlarge the window for the full layout.'; rails become overlay drawers; never horizontal scroll.
- Graphics context lost: toast 'Graphics context lost - restoring…', scene restored within 2 s without data loss; repeated loss offers the Tables layout.
- Graphics unsupported (no WebGL2): full-page fallback 'Your browser cannot run the 3D view (WebGL2 unavailable). [Run system check] [Continue with tables]'.
- Read-only (submission view, inspect mode, support replay, peer-review copy v1.x): banner names the mode, edit tools disabled with reason, 'Open working copy' or 'Experiment on a copy' action.
- Author mode: extra rail tab 'Author' (lock/hidden/required per element and class, labels, seed explorer, compare with reference); preview-as-learner shows a persistent 'Preview - nothing is recorded' banner.
- Exam: see WS-10 (banner, accent border, off badges).
- Autosave pending / saved / conflict; 'Saved 2 s ago' flips to 'Saving…' then back; failure shows 'Local copy safe - server save retrying'.

**Interactions:**
- Tool-mode state machine: Select is default; Esc returns to Select; Space temporarily enters navigation from any tool; Enter commits; right-click opens a context menu for the hovered entity (Select, Isolate, Hide, Assign section…, Add support…, Apply load…, Probe, Delete, Properties).
- Mouse: LMB select/draw, LMB-drag on empty space orbits (window-select in Select with Ctrl/Cmd), MMB-drag pans, RMB-drag orbits, wheel zooms anchored at the cursor, Shift+wheel dollies. Trackpad: two-finger scroll pans, pinch zooms, Alt+drag orbits, Cmd/Ctrl+drag box-selects. Orbit pivots about the selection centroid or the cursor hit point.
- Selection: click, Shift adds, Ctrl/Cmd toggles, Alt subtracts; left-to-right window (solid rectangle, fully contained) vs right-to-left crossing (dashed, intersecting); double-click selects the collinear chain; filter bar in the Model tab restricts picking by type/section/material/group/level and is visible in the view bar when active with one-click reset.
- Case switcher pill: dropdown lists cases, combinations (with formula and source), envelopes; switching repaints cached results within 100 ms and never re-solves; the active case is recorded in view state and screenshot metadata.
- Right-rail tab switching never changes the model; panel resize handle between canvas and rail; Alt+1..6 jumps to a tab; collapsing the rail keeps the canvas at >= 60%.
- Status bar chips are buttons: working plane opens the chooser; snap toggles and shows priority order; units opens the preset menu; size cap opens 'What counts?'; analysis chip opens the timing popover (assemble/factor/solve/recover ms, DOF, nnz, tier, engine version, result hash prefix) or the Diagnostics dock when blocked; Live menu switches modes and suggests Manual after three solves over budget.
- '?' opens the Help panel over the right rail for the focused tool; the panel's footer holds 'Report a problem' (consented diagnostic bundle).

**Keyboard and accessibility:**
- Tab order: header, tool rail, canvas (focusable), right rail, bottom dock, status bar; focus is visible everywhere and never trapped in the canvas (Tab leaves it).
- Canvas has an accessible name ('Model canvas: 24 nodes, 31 members, 2 supports, 3 load cases') and a description that is the textual summary; with focus in the canvas: arrows orbit, Shift+arrows pan, + and - zoom, F frames the selection, Home fits all, 1-7 view presets, 5 toggles projection, Delete removes the selection (confirm for > 20 entities), Ctrl+A selects all of the active filter.
- Global: Ctrl/Cmd+K command palette; Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z redo; Ctrl+Enter run analysis (manual mode); Alt+0 toggles the right rail; Alt+1..6 rail tabs; Alt+D diagnostics dock; '?' help; Esc cancels tool, closes popovers, clears selection in that order. Shortcuts are fixed at MVP, respect text-input focus and avoid browser defaults.
- Reduced motion: camera transitions instant, deformation animation disabled (static max shown), no pulsing badges. High-contrast element coloring option in the view bar.
- Every status chip, badge and legend band has text equivalents; utilization uses a deuteranopia/protanopia-validated sequential palette plus hatching above 1.0 and an optional pattern mode so no information is color-only.
- Live-region narration of canvas changes is v1.x; at MVP selection and analysis results are readable through the Props panel, the status bar and the textual summary.

**Requirements:**
- WS VIEW-01
- WS VIEW-02
- WS VIEW-05
- WS VIEW-06
- WS MOD-01
- WS SEL-01
- WS SEL-02
- WS EDIT-02
- WS EDIT-03
- WS EDIT-04
- WS EDIT-06
- WS INP-02
- WS A11Y-01
- WS A11Y-02
- WS PERF-01
- NFR PERF-02
- NFR AVL-03
- NFR ACC-02
- AUT TB-06
- STR CAT-04
- GAP5-POL-01
- GAP5-EVID-01
- GAP6-01
- GAP2-DIS-01
- GAP4-HELP-01
- GAP4-HELP-03
- ADR R8
- ADR R14
- ADR R16

## Screen: WS-02 2D planar mode with guided-lesson overlay (intro tasks)

**Roles:** Learner (T1-T2 tasks, onboarding tutorial); Author (converts a 2D template to 3D; reverse blocked if out-of-plane geometry exists); Instructor/TA inspect · **Route:** `same route as WS-01; mode comes from the task (planar-xz); guided lesson adds ?lesson=:lessonId&step=:n`

Lock the workspace to the global XZ plane with an orthographic camera, three DOF per node, in-plane loads and a simplified toolbar so beams, trusses and plane frames never require 3D navigation, while the same document model and grading pipeline are used; host the step-by-step guided lesson with auto-verified checkpoints.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ ◀ Lesson 1.2 │ Simply supported beam · Analyze · T1 · 2D │ Personal │ ● Coach │ Submit ▸ │ ? │
├────┬────────────────────────────────────────────────────────────────┬────────────────────────┤
│ V  │ [Fit] [Zoom + −] [Lines⇄Solid] [Labels] [Color: none ▾]           │ GUIDED LESSON   step 3/6│
│ N  │                        ▼ Case: L (live load) ▾                   │ Add a roller at node B │
│ M  │   Z↑                                                            │ that frees horizontal  │
│ S  │   └→X        w = 10.0 kN/m  ↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓          │ movement.              │
│ L  │        A ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━● B      │ ○ Checkpoint: roller-X │
│ P  │          ▲ pin (locked)                        6.000 m   ⟳ B    │   support at B · not yet│
│    │          ▔▔▔                                                    │ [Hint 1/3] [Show me]   │
│    │                                                                 │ ○ 4  Run and read δmax │
│    │  ┌─ Moment My · case L · sagging + drawn on tension side ──────┐ │ ○ 5  Report the reaction│
│    │  │ scale 0.08 × diagonal  ● STALE · 1 error blocks analysis     │ ├────────────────────────┤
│    │  └──────────────────────────────────────────────────────────────┘ │ PROPERTIES · Node B    │
│    │                                                                 │ X 6.000 m   Z 0.000 m  │
│    │                                                                 │ Support: [none] [pin]  │
│    │                                                                 │ [roller-X] [roller-Z]  │
│    │                                                                 │ [fixed]   Tx □ Tz □ Ry □│
├────┴────────────────────────────────────────────────────────────────┴────────────────────────┤
│ ▸ Results table   ▸ Diagnostics ● 1   ▸ History   ▸ Tables                                   │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ 2D · XZ plane (locked by task) │ Snap ● │ kN · m ▾ │ Node B selected │ Members 1/20 │ ● Stale: 1 error │ Saved │ Educational use only ⓘ │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Regions:**
- Header: same as WS-01 with a '2D' chip in the task title.
- Tool rail: Select, Node, Member, Support, Load, Probe; Assign and Transform are present but Transform offers only in-plane move/copy/mirror about X or Z.
- Canvas: orthographic camera locked to the XZ plane (X right, Z up, Y into the screen and fixed at 0); axis indicator replaces the navigation cube; orbit disabled, pan and zoom remain; grid is the task grid or 1 m / 1 ft increments; dimension readouts between nodes when a member is selected.
- Guided lesson overlay (right rail top, 40% height, collapsible): step list with required/optional markers, current step instruction (rich text, equations), highlight target in the canvas (pulsing outline unless reduced motion), checkpoint status derived from the model state, Hint button with tier counter, 'Show me' (applies the step and marks it assisted), Next/Back, skip-ahead if the author allows.
- Properties (2D variant): node X and Z only; support presets pin, roller-X, roller-Z, fixed, plus Tx/Tz/Ry checkboxes; member section, material, releases (moment only at i/j), Lb; loads Fx, Fz, My, UDL in global Z or local 2.
- Status bar: '2D · XZ plane (locked by task)' replaces the working-plane chooser.

**Key data:**
- Task mode planar-xz, starter model with locked elements, grid spacing, unit preset.
- Lesson: steps, required flags, checkpoint predicates (semantic by label/coordinates), hints with tiers, assisted flag per step, per-step progress persisted.
- Node X, Z; support DOF (Tx, Tz, Ry); in-plane loads; member releases at i/j (moment).
- Diagnostics count and the blocking reason.

**States:**
- Checkpoint not yet / passed (green check with 'passed at 14:02') / failed with author hint after repeated failures; lesson complete banner 'All required checkpoints passed' with completion recorded.
- Out-of-plane input rejected inline: 'Loads in 2D mode must lie in the XZ plane (Fx, Fz, My).' (VAL-2D-OUT-OF-PLANE).
- Stale blocked: here the missing support at B leaves a mechanism; diagnostics count 1 and the legend shows STALE with the reason.
- Author conversion: 'Convert to 3D' available; 'Convert to 2D' blocked with 'Model has out-of-plane geometry at N7 (y = 2.000 m)'.
- Onboarding (PER-12): the same overlay drives the 10-minute tutorial building a simply supported beam, skippable and relaunchable from Help.

**Interactions:**
- Placing a node by click projects onto the XZ plane; typing '6,0' or '6' then Tab in the coordinate field enters X then Z; '@3,0' is relative.
- Support presets apply in one click on the selected node; the glyph (triangle pin, circle-under-triangle roller with direction arrow, hatched fixed) is screen-space scaled 24-40 px.
- Load tool opens an inline mini-form (kind, value with unit, direction, case) anchored to the selected member or node with live arrow preview.
- Checkpoints evaluate within 300 ms of a debounced model change; 'Show me' applies the expected delta as a single undoable command labeled 'Lesson step 3 (assisted)'.
- Highlight target: the overlay can point at a canvas entity, a rail control or a status-bar chip; clicking the instruction's entity chip frames it.

**Keyboard and accessibility:**
- All checkpoints are achievable through the Tables layout (A11Y-02): the lesson overlay is also shown in parity mode and references entities by label.
- Arrow keys pan in 2D (orbit disabled); + and - zoom; Home fits; F frames.
- Support preset buttons are a radio group; DOF checkboxes announce 'Tz restrained'.
- Lesson step list is a list with aria-current on the active step; checkpoint status has text ('not yet', 'passed').
- Hint and 'Show me' are buttons with usage counters announced; reduced motion disables the pulsing highlight (static outline instead).

**Requirements:**
- WS VIEW-04
- SIM-ANL-02
- WS MOD-02
- WS MOD-05
- WS MOD-06
- LMS CRS-04
- AUT GL-01
- AUT GL-02
- PRD PER-12
- GAP1-DM-09
- ADR R8

## Screen: WS-03 Modeling interactions: drawing, snapping, gizmos, numeric entry, merge, property editing, section picker

**Roles:** Learner; Author (same tools plus lock/hidden/required toggles) · **Route:** `same route as WS-01; canvas states of the Member, Node, Select/Transform and Assign tools`

Make unambiguous placement with a 2D pointer in 3D: working plane plus prioritized snapping with a tooltip that names the snap and shows world coordinates before the click, numeric entry, a move gizmo with a HUD and axis locks, coincident-node merging with an undoable notification, and bulk property editing with mixed values.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ MEMBER · click a start node, click end nodes, Esc to finish · Shift: no snap · Ctrl: next snap │
├────┬────────────────────────────────────────────────────────────────┬────────────────────────┤
│ V  │                                                                 │ SECTION PICKER         │
│ N  │      N3 ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┅┅┅┅┅┅┅┅┅┅┅┅▸ ✛       │ Search  W12_        ⌕ │
│[M] │                                 ┌────────────────────────────┐  │ Family [W ▾] Depth 10-14│
│ S  │                                 │ ◆ Member midpoint · M4     │  │ Weight ≤ 40 lb/ft      │
│ L  │                                 │ (4.500, 0.000, 3.000) m    │  │ ★ favorites · task allow-list W8-W14│
│ A  │                                 │ length 4.500 m  ∠ 0.0°     │  │ ─────────────────────── │
│ T  │                                 └────────────────────────────┘  │ W12x26  A 7.65 in² Ix 204│
│ P  │                                                                 │         Zx 37.2  rx 5.17 │
│    │   ┌─ gizmo ──┐                                                  │ W12x30  A 8.79  Ix 238  │
│    │   │    Z     │ N7  HUD: Δ +0.500, 0.000, 0.000 m → (6.500, 0.000, 3.000) │ W12x35  A 10.3  Ix 285  │
│    │   │    ↑ ●───┼──▸ X   type a number = exact Δ · X / Y / Z lock axis       │ [Assign to 3 members]  │
│    │   │   ╱      │                                                  ├────────────────────────┤
│    │   └──────────┘                                                  │ PROPERTIES · 3 members │
│    │ ┌─────────────────────────────────────────────────────────────┐ │ Section  W12x26        │
│    │ │ ✓ Merged N9 into N4 (coincident within 1 mm)   [Undo]   ✕   │ │ Material A992          │
│    │ └─────────────────────────────────────────────────────────────┘ │ β (deg)  varies  [__]  │
│    │ ┌ context menu (RMB on M4) ┐                                    │ Release i  M2 M3 ☑  j ☐ │
│    │ │ Select chain · Isolate · Hide · Divide into N… · Assign      │ │ Length   4.500 m (read)│
│    │ │ section… · Apply load… · Probe · Delete · Properties         │ │ Expression ok: 2*3.5 m │
│    │ └──────────────────────────────────────────────────────────────┘ │                        │
├────┴────────────────────────────────────────────────────────────────┴────────────────────────┤
│ Plane XZ@0 ▾ │ Snap ● node › end › mid › grid › intersection › perpendicular › increment 0.5 m │ m · kN │ Drawing member 2 of polyline │ Members 43/300 │ ● Stale │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Regions:**
- Tool prompt strip (top of canvas, replaces the view bar while a drawing tool is active): what to do, Esc/Enter behavior, Shift and Ctrl modifiers.
- Snap tooltip (near cursor): snap glyph (● node, ◆ midpoint, ✚ grid intersection, ⟂ perpendicular), entity label, world coordinates in task units, and while drawing: segment length and angle.
- Gizmo (at the selection centroid): X red, Y green, Z blue axis handles; XY/XZ/YZ plane handles; HUD shows delta and resulting coordinates; typing digits during drag sets an exact delta; X/Y/Z keys lock an axis.
- Merge notification toast (bottom of canvas, 8 s, focusable): merged ids, tolerance, Undo.
- Context menu (right-click on hovered entity).
- Properties (right rail): mixed values display 'varies'; typing applies to all; inputs accept units and expressions ('2*3.5 m'); read-only derived fields (length, slope); invalid values rejected inline with the reason and the model never left invalid.
- Section picker (right rail overlay or inline popover): search, family, depth, weight filters, favorites per task, task allow-list highlighted, properties A, Ix, Iy, Zx, Sx, rx, ry, J in task units, 'Assign to N members'.
- Transform dialog (array/mirror/replicate): ghost preview before commit, checkboxes to carry loads/supports/releases/properties, one undo step.

**Key data:**
- Snap type, entity label, coordinates (task units, 3 decimals for m, 1 for mm/in), segment length and angle.
- Gizmo delta and new coordinates; axis lock state; increment step.
- Merge: source and target ids, tolerance (default 1 mm).
- Properties: coordinates, section, material, beta, releases i/j (tx,ty,tz,rx,ry,rz), restraints, load values, Lb, K, Cb, bracing flags; derived length and slope.
- Section catalog: family, label, depth, weight, A, Ix, Iy, Sx, Zx, rx, ry, J, Cw; allow-list membership; favorites.

**States:**
- Snap candidates: none (free, increment snap), node, member end, midpoint, grid intersection, member/member intersection, perpendicular foot, grid line; Shift disables (tooltip 'snap off'); Ctrl cycles candidates.
- Invalid member: zero length or duplicate between the same nodes shows an inline red tooltip 'A member already connects N3 and N4' and the click does nothing.
- Drag over an existing node: target highlighted; on drop a small chooser 'Merge into N4 / Cancel'.
- Locked element hovered: lock icon and 'Locked by the task' tooltip; edit attempts are impossible (no gizmo, inputs disabled), not merely warned.
- Section outside the task allow-list: row shown greyed with 'Not allowed in this task (W8-W14 only)'; cannot be assigned.
- Properties with mixed selection types (nodes + members): sections per type with counts; unsupported fields hidden.
- Cap reached: Node and Member tools disabled with tooltip 'Task cap reached (300 members)'.

**Interactions:**
- Node tool: click on the working plane or type coordinates in the status-bar coordinate field ('3,0,4' absolute, '@2,0,0' relative, in task units converted to SI); Enter places; nodes within 1 mm merge with a notification.
- Member tool: click-click polyline, Esc finishes, Enter closes to the start node; options in the tool prompt: auto-split at crossing nodes, split crossing members, truss vs frame default; after the first click a rubber band with length and angle follows the cursor.
- Divide into N and Join collinear from the context menu keep loads and properties and split distributed loads correctly.
- Assign tool: pick a section/material/release pattern once, then click members to paint; Esc exits.
- Transform: gizmo drag with snapping on the dragged node (not the pivot); results re-run every 100 ms during drag with the deformed shape following; release commits one undo step.
- Properties edits re-run analysis within the live budget; Tab moves between fields in visual order; Enter applies; Esc reverts the field.
- Section picker: typing filters within 50 ms; Enter assigns to the current selection; star toggles a favorite.

**Keyboard and accessibility:**
- All drawing actions have keyboard equivalents: Node via the coordinate field (Ctrl+Shift+N focuses it), Member via palette 'member N3 N4', Support via Properties presets, Load via palette or the Loads panel; the Model tab's entity list supports type-ahead by id or label and arrow-key navigation with Enter to select.
- Gizmo: with a node selected, Shift+arrow nudges by the increment snap; Ctrl+M opens 'Move by vector' with X/Y/Z inputs.
- Toasts are focusable and announced as status; Undo in the toast is a button.
- Context menu is a menu with roving focus; Shift+F10 opens it for the selection.
- Section picker is a listbox with type-ahead; properties read as a table row per section.

**Requirements:**
- WS MOD-01
- WS MOD-02
- WS MOD-03
- WS MOD-05
- WS MOD-07
- WS MOD-08
- WS EDIT-01
- WS EDIT-02
- WS SEL-01
- WS PERF-03
- SIM-LIB-02
- STR REF-01
- AUT TB-05
- AUT TB-06
- STR CAT-04

## Screen: WS-04 Loads, cases, combinations and the load-source explorer

**Roles:** Learner; Author (sets per-case mode given / derived / learner-derived and the combination source) · **Route:** `same route; ?panel=loads; Apply-load dialog as a modal anchored to the selection`

Give every load a case, every case a type and a provenance (derived from the scenario, given, or learner-entered), show combinations with their formulas and source, surface missing cases and combinations before grading, and let the learner trace any load to the scenario parameter and clause it came from.

```
┌─ RIGHT RAIL · LOADS ─────────────────────────────────────────────────────────────────────────┐
│ CASES                                   ▸ Add case ▾ (D, L, Lr, S, W, E, T, settlement, other)│
│ ● D   Dead      [derived] self-weight auto · 3 SDL loads            Σ −142.6 kN (−Z)   […]   │
│ ○ L   Live      [given]   2 loads · office 2.40 kN/m² ← scenario     Σ −96.0 kN (−Z)    […]   │
│ ○ S   Snow      [learner] 0 loads  ▲ scenario pg = 1.44 kN/m² expects a snow case      […]   │
│ ○ W+X Wind +X   [derived] 6 loads · Kz table ▸                       Σ +18.2 kN (+X)    […]   │
│ ○ W−X Wind −X   [derived] 6 loads                                    Σ −18.2 kN (−X)    […]   │
│ ──────────────────────────────────────────────────────────────────────────────────────────── │
│ LOADS IN CASE D                     ▸ Apply load ▾ (nodal · member distributed · member point · panel · thermal)│
│ ┌──────┬────────┬────────────────┬────────────┬───────────────────────────────────┬────────┐ │
│ │ id   │ target │ kind           │ value      │ source                             │        │ │
│ ├──────┼────────┼────────────────┼────────────┼───────────────────────────────────┼────────┤ │
│ │ auto │ all    │ self-weight    │ ×1.0 −Z    │ sections × density (not editable)  │        │ │
│ │ L12  │ B1     │ UDL global −Z  │ 3.20 kN/m  │ SDL 0.80 kN/m² × tributary 4.00 m  │ ⊙ show │ │
│ │ L13  │ B2     │ UDL global −Z  │ 3.20 kN/m  │ SDL 0.80 kN/m² × tributary 4.00 m  │ ⊙ show │ │
│ │ P4   │ panel  │ area 0.80 kN/m²│ one-way →X │ distributed to B1, B2 (inspect ▸)  │ ⊙ show │ │
│ └──────┴────────┴────────────────┴────────────┴───────────────────────────────────┴────────┘ │
│ ──────────────────────────────────────────────────────────────────────────────────────────── │
│ COMBINATIONS   source: ASCE 7-22 §2.3.1 LRFD (generated for this scenario) · + custom          │
│ ✓ C1 1.4D                     ✓ C2 1.2D + 1.6L + 0.5S        ✓ C4 1.2D + 1.0W(+X) + L + 0.5S  │
│ ✓ C3 1.2D + 1.6S + L          ✓ C5 0.9D + 1.0W(+X)           ▲ missing: 0.9D + 1.0W(−X) [Add]│
│ Service: ✓ S1 D + L   ✓ S2 D + 0.42W(+X) (drift)        [Envelope: strength] [Regenerate] [Add custom]│
│ ──────────────────────────────────────────────────────────────────────────────────────────── │
│ ▸ SHOW MY LOADS · L12 = 3.20 kN/m                                                             │
│   ← SDL 0.80 kN/m² (scenario: floor finish 0.25 + ceiling/MEP 0.55) × tributary width 4.00 m  │
│   · dead loads, ASCE 7-22 §3.1 · [Open explanation]  · panel P4 one-way span →X                │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Regions:**
- Cases list: radio selects the case shown on the canvas; type chip; provenance badge (derived / given / learner); load count; resultant per axis; '…' menu (rename, duplicate, delete when learner-owned, self-weight factor and direction).
- Loads table for the active case: id, target (entity label), kind, value with unit, axes (global/local, projected), source line; self-weight is a non-editable 'auto' row; panel rows expand to show the derived member loads with tributary lines drawn on the canvas.
- Apply-load dialog (anchored to the selection): kind tabs; value with unit input; direction/axes; projected toggle; start/end for partial loads; case picker; live arrow preview on the canvas; Apply = one command.
- Combinations: list with id, formula, check state (present / missing vs the generated set / custom), service combinations, envelope definitions, Regenerate (rebuilds the generated set for the scenario; custom ones kept), Add custom (factors per case, validated).
- Show my loads (source explorer): for the selected load, the chain scenario parameter -> derived quantity -> applied load with the clause id and an 'Open explanation' link to the generated check/clause page.
- Canvas (when the Loads tab is active): load arrows scaled to the max in the active case, value labels on hover or always (toggle), load-panel tributary lines, local-axis loads rotate with beta.

**Key data:**
- Cases: id, name, type, provenance mode, self-weight factor/direction, load count, resultants per axis.
- Loads: id, case, kind, target, axes, projected, values and units, partial extents, source parameter chain, clause id.
- Combinations: id, name, type (strength/service/seismic), code source and version, factors per case, presence vs generated set, governing flags.
- Scenario summary used for derivation (occupancy, SDL surfaces, pg, V, exposure) as read-only context when the profile allows.

**States:**
- Case empty (notice VAL-EMPTY-CASE); scenario expects a case that is absent (warning with the expected magnitude when the profile allows, e.g. 'pf ≈ 1.01 kN/m²'); learner-derived case where the task hides the value (no expected magnitude shown).
- Combination missing / extra / wrong factor vs the generated set ('1.6W is not an ASCE 7-22 strength factor; use 1.0W'); custom combination referencing a missing case (error).
- Manual-loads task: generated set off; Regenerate hidden; 'Your combinations are compared with the code set at grading'.
- Exam or Check task with scenario-derived expectations hidden: source explorer shows only the learner's own inputs.
- Load on a truss member mid-length: inline warning 'Non-nodal load on a truss member (bending in a pin-jointed element)'.
- Projected vs along-length difference shown for sloped members ('total 8.66 kN projected vs 10.0 kN along length').

**Interactions:**
- Selecting a case repaints the canvas overlays from cached results (no re-solve); the case switcher pill and this list stay in sync.
- Clicking a load row selects and frames its target; editing a value in the row updates the arrow fan live and re-runs analysis.
- Apply-load supports multi-selection targets; unit input accepts any compatible unit and shows the SI conversion on hover.
- Combination rows: click shows the formula with per-case factors; hover on a missing row explains why it is required; Add creates it with the expected factors.
- Show my loads opens for the selected load; 'Open explanation' opens the Help panel page with the learner's own values beside the explanation.
- Panel loads: 'inspect' draws the one-way distribution lines and lists the resulting member loads; distribution method is explicit per panel.

**Keyboard and accessibility:**
- Cases list is a radio group; loads table is a grid with arrow-key navigation, Enter to edit a cell, Ctrl+Enter to add a load row (opens the dialog pre-targeted at the selection).
- Apply-load dialog is a form with labeled unit inputs and a live text preview ('UDL −3.20 kN/m in global Z on B1 in case D').
- Combination formulas are plain text; missing-combination warnings are list items with an Add button.
- Source explorer is a definition list (parameter, value, clause).

**Requirements:**
- WS MOD-06
- WS RES-06
- SIM-LOD-01
- SIM-LOD-02
- SIM-LOD-03
- SIM-LOD-05
- SIM-LOD-06
- STR CODE-02
- STR SITE-02
- STR ERR-03
- STR ERR-05
- AUT TB-04
- ADR R2
- ADR R3
- ADR R5

## Screen: WS-05 Live results: deformed shape, diagrams, utilization legend, reactions, probes, results table

**Roles:** Learner (subject to live_results and code_check_overlays in the profile); Instructor/TA (same overlays on a submission); Author · **Route:** `same route; ?panel=results and ?dock=table`

Show the analysis as engineers read it: a deformed shape with an honest scale factor, N/V/M/T diagrams in member local axes with the sign convention stated, utilization color maps with a legend that is correct and color-safe, reaction arrows with an equilibrium check, pinned probes, and a results table that syncs with selection, all labeled with the case and freshness.

```
┌────┬────────────────────────────────────────────────────────────────┬────────────────────────┐
│ V  │                       ▼ Envelope: strength combinations ▾        │ RESULTS                │
│ N  │  ghost (undeformed) ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈           │ ☑ Deformed shape       │
│ M  │  C1 ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━● C2       │   scale ────●──── 25×  │
│ S  │    ┃ ▓▓▓▓▓▓ My ribbon on tension side ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ┃        │   [▶ animate] 1.0× ☐ ghost│
│ L  │    ┃      ┌─────── PROBE ────────┐         ░░░ 0.91    ┃        │ ☑ Diagram  My ▾ stations 9│
│ A  │    ┃      │ B1 · x = 3.00 m       │                     ┃        │   scale ────●──  sign: sagging +│
│ T  │    ┃      │ My −48.2 kN·m (C4)    │                     ┃        │ ☑ Reactions + equilibrium│
│[P] │    ┃      │ DCR 0.91 · F2.2 LTB   │                     ┃        │ ☑ Utilization: combined ▾│
│    │    ┃      │ [row] [pin] ✕         │                     ┃        │   bands 10 ▾ · min 0 · max 1.0│
│    │  ▲ N1 ↑ 71.3 kN                     ▲ N2 ↑ 71.3 kN      │        │   ☐ pattern mode (no color)│
│    │ ┌─ Utilization · combined (H1) · ENVELOPE · governing C4 ──────┐ │ ──────────────────────── │
│    │ │ 0.0 ░░ 0.2 ▒▒ 0.4 ▓▓ 0.6 ██ 0.8 ██ 1.0 ▓▓▓ >1.0 hatched red   │ │ EQUILIBRIUM (C4)         │
│    │ │ color-safe · hover a member for its value       ● FRESH 41 ms │ │ ΣFz applied  −238.6 kN  │
│    │ └───────────────────────────────────────────────────────────────┘ │ ΣFz reactions +238.6 kN  │
│    │                                                                 │ residual 0.000 % ✓       │
│    │                                                                 │ PROBES (3/10) [clear all]│
├────┴────────────────────────────────────────────────────────────────┴────────────────────────┤
│ ▾ RESULTS TABLE · Members ▾ (Nodes · Reactions) · case: Envelope ▾   sort: DCR ▾   [CSV]     │
│ id │ section │ DCR  │ governing          │ combo │ N (kN) │ My max (kN·m) │ δ/L   │ limit │ ok │
│ B1 │ W12x26  │ 0.91 │ F2.2 LTB           │ C4    │ −12.1  │ −48.2         │ 1/412 │ L/360 │ ✓  │
│ C1 │ W10x33  │ 0.76 │ H1-1a combined     │ C4    │ −119.3 │ 31.0          │ —     │ h/400 │ ✓  │
│ B3 │ W10x19  │ 1.23 │ F2.2 LTB           │ C4    │ −9.8   │ −44.0         │ 1/301 │ L/360 │ ✗  │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ … │ ● Fresh 41 ms · Tier S │ Live ▾ │ …                                                           │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Regions:**
- Results tab (right rail): overlay toggles with per-overlay controls: Deformed shape (log scale slider 0.01x-100x with the true factor displayed, numeric entry, ghost outline, animate play/pause/speed, disabled under reduced motion), Diagrams (N, Vy, Vz, My, Mz, T; station count 9-21; scale; sign convention toggle 'sagging positive on tension side'), Reactions and equilibrium, Utilization (combined / flexural / shear / axial; band count; min/max; pattern mode), color-by sync.
- Legend (canvas bottom-left, always drawn when an overlay is on, rendered in screenshots): quantity and check type, units, case or combination name (and 'governing Cx' in envelope), bands with numeric thresholds, above-1.0 hatched red style, deformation scale factor when the deformed shape is on, freshness badge.
- Probe cards (canvas, up to 10, follow their entity, update on case change): entity label, station, key values for the active overlays, governing clause, 'row' (opens the results table row), pin, close.
- Reaction arrows: screen-space scaled with a minimum legible length, labeled magnitudes, never overlapping support glyphs; equilibrium panel per global axis with residual highlighted above 0.1%.
- Results table (bottom dock): Members / Nodes / Reactions tabs; sortable columns; two-way selection sync; CSV export with units in headers, the D1 disclaimer header comment and the provenance stamp; per-member detail popup with tabulated station values.
- Hover readout (tooltip): key value for the active overlay (displacement, force at station, DCR) in task units and precision.

**Key data:**
- Per case/combination/envelope: nodal displacements (6 components), reactions, member station forces N/Vy/Vz/My/Mz/T with analytically located extrema, relative deflection and L/n ratio, story drift ratio per level pair, per-member utilization per check type with governing clause, combination and station.
- Deformation auto scale (0.05 x bounding diagonal / max displacement) and the current factor; diagram scale; band thresholds; min/max overrides.
- Equilibrium sums per axis and residual percentage; engine warnings (ENG-RESIDUAL, ENG-ILL-CONDITIONED) attached to the result.
- Probe list (entity, station, pinned values).

**States:**
- Fresh (full color), Running (previous results kept, spinner on the badge), Stale (overlays desaturated, 'STALE' badge with reason), Paused (badge 'Paused - Run Ctrl+Enter'), Blocked (overlays hidden, legend shows 'No results - 2 errors block analysis').
- Profile live_results = deformed_only: only the deformed shape toggle is available; diagrams, reactions and tables show an 'Off for this task' badge. live_results = none: Results tab hidden; status chip reads 'Validity only'.
- code_check_overlays = none (Check tasks, exam): Utilization absent from color-by and the table lacks DCR columns; 'Utilization - off for this task ⓘ' row remains so learners know why.
- Envelope mode: diagrams draw min and max ribbons; hovering gives the governing combination; utilization legend says ENVELOPE and names the governing combination for the hovered member.
- Mechanism results: when the engine reports a mechanism no overlays are drawn except the animated null-space mode from WS-06.
- Probe limit reached: 'Up to 10 probes - close one to add another'.

**Interactions:**
- Toggling an overlay repaints within one frame from cached typed arrays; changing bands/min/max repaints within one frame; changing station count re-queries without re-solving.
- Probe tool (P): click an entity to pin a card; with an entity selected, Enter pins; cards drag to reposition; case switch updates all cards.
- Clicking a table row selects and frames the entity (and opens its probe when the probe tool is active); selecting in the viewport highlights the row and scrolls it into view.
- Animation: sinusoidal loop 0 to +1 (or -1 to +1 option), speed 0.25x-2x; stops automatically under reduced motion and shows the static maximum.
- Utilization hover shows the value, check type, governing combination and clause; click opens the member's EvidenceCard list in the Check tab.
- Export CSV disabled in exam mode with the Off badge and reason.

**Keyboard and accessibility:**
- Overlay toggles are checkboxes with labeled sliders (arrow keys step the log slider; the true factor is announced).
- Legend text is a visible, selectable caption; the same text is exposed as the canvas description and in the textual summary.
- Results table is a native table with column headers including units; sort is keyboard-operable; Enter on a row selects the entity.
- Probe cards are focusable regions with a close button; Ctrl+Shift+P cycles probes.
- Equilibrium residual over 0.1% is announced as a warning in the Diagnostics count, not only by color.

**Requirements:**
- WS RES-01
- WS RES-02
- WS RES-03
- WS RES-04
- WS RES-06
- WS RES-07
- WS EDIT-06
- SIM-RES-01
- SIM-RES-02
- SIM-RES-05
- SIM-RES-07
- STR QUAL-01
- STR CODE-09
- NFR ACC-02
- GAP3-DLV-17
- ADR R9

## Screen: WS-06 Diagnostics and validity: mechanisms, unconnected nodes, singular matrix, size cap and performance feedback

**Roles:** Learner; Author (starter model must analyze unless marked intentionally unstable); Instructor/TA inspect · **Route:** `same route; ?dock=diagnostics; opened by the status-bar analysis chip when blocked`

Turn validation and engine failures into teaching moments: a grouped, stable list of issues with entity references, fly-to, one-click fixes and an animated mechanism, plus visible model-size and performance limits so analysis never fails silently or mysteriously.

```
┌────┬────────────────────────────────────────────────────────────────┬────────────────────────┐
│    │ (canvas: mechanism animation; N4 outlined red, last valid results dimmed)                 │ PROPERTIES · Node N4  │
│    │        N3 ●━━━━━━━━━━━━━━● N4 ⟲ rotates about Y                 │ X 6.000  Y 0  Z 3.000 │
│    │           ╲              ┆                                      │ Support: none          │
│    │            ╲             ┆                                      │ 3 members · all truss  │
│    │  ┌─ UNSTABLE STRUCTURE ─────────────────────────────────────┐   │                        │
│    │  │ Node N4 can rotate about Y with nothing resisting it.    │   │                        │
│    │  │ Likely cause: all 3 members at N4 are truss members.     │   │                        │
│    │  │ [▶ Animate mechanism]  [Explain]  [Stop]                 │   │                        │
│    │  └──────────────────────────────────────────────────────────┘   │                        │
├────┴────────────────────────────────────────────────────────────────┴────────────────────────┤
│ ▾ DIAGNOSTICS   ● 2 errors (block analysis) · ▲ 2 warnings · ⓘ 1 notice        [Re-check]    │
│ ● ENG-SINGULAR     Unstable: node N4, rotation about Y - all members at N4 are truss members. │
│                    Fix: add a support at N4, or make one member a frame member.               │
│                    [Show] [Animate] [Make M6 a frame member] [Add pin at N4]                  │
│ ● VAL-MISSING-SECTION  Member M9 has no section.             [Show] [Assign W12x26 (last used)]│
│ ▲ VAL-DUP-NODE     N9 and N4 are 0.6 mm apart - probably meant to be one node. [Show] [Merge] │
│ ▲ WS-CAP           Members 288/300 - 12 left before this task's cap.           [What counts?] │
│ ⓘ VAL-EMPTY-CASE   Case S (Snow) has no loads.                                [Go to Loads]  │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ … │ Members 288/300 ▲ │ ● Stale: 2 errors block analysis │ Live ▾ │ …                           │
└──────────────────────────────────────────────────────────────────────────────────────────────┘

size-cap reached state (status bar + tool rail):
│ … │ Members 300/300 ● cap reached │ ● Fresh 212 ms · Tier M │ … │   tool rail: N and M greyed - 'Task cap reached: delete or merge members to add more'

performance popover (click the analysis chip):
┌ Analysis timing ─────────────────────────────┐
│ Tier M · 1,842 members · 9,120 DOF            │
│ assemble 38 ms · factor 121 ms · solve 19 ms  │
│ recover 34 ms · total 212 ms (budget 300 ms)  │
│ engine bridle-fem 1.3.0 · results res_9f2a…   │
│ Live is debounced at 300 ms for Tier M.       │
│ [Switch to manual (Ctrl+Enter to run)]        │
└───────────────────────────────────────────────┘
```

**Regions:**
- Diagnostics dock: header with counts by severity (Error blocks analysis, Warning, Notice) and Re-check; rows with code, message naming entities by label, cause, and actions (Show = fly-to and outline in the diagnostic color; Fix actions generated by the rule engine; Animate for mechanisms; Explain opens the help page for the code).
- Mechanism card (canvas overlay when ENG-SINGULAR): plain-language statement of the free DOF, likely cause, Animate/Explain/Stop; the null-space mode animates with the last valid results dimmed.
- SizeCapMeter (status bar): members used/cap with a bar; DOF used/cap when the author set one; amber at 90%, red at 100%.
- AnalysisStatusChip popover: tier, counts, per-phase timings against the tier budget, engine version, result id, live mode suggestion.
- Canvas outlines: entities referenced by the selected diagnostic are outlined in the diagnostics color (distinct from selection and from grader severity colors).

**Key data:**
- Validation issues: code (VAL-*, ENG-*, WS-CAP), severity, entity ids and labels, message, fix actions, stable issue id.
- Mechanism: node, DOF, likely cause category (missing support, released member chain, truss node rotation, 2D model in 3D), null-space vector for animation.
- Condition estimate, residual norm, equilibrium imbalance per axis.
- Cap: member and DOF counts vs task cap; tier; per-phase timings; engine version; result id.

**States:**
- No issues: dock header '● 0 - model is valid'; chip Fresh.
- Errors present: analysis blocked; overlays hidden; chip 'Stale: N errors block analysis'; dock auto-opens the first time an error appears in a session (not on every edit).
- Warnings only: analysis runs; chip Fresh with a small warning count.
- Mechanism from the engine (pivot below 1e-12 x max diagonal mapped to node and DOF) vs from pre-check (rigid-body restraint missing): both render the same card; the pre-check version says 'No support resists translation in X'.
- Ill-conditioned (ENG-ILL-CONDITIONED): warning naming the extreme-stiffness entities ('spring K7 at 1e18 N/m') and the condition estimate; results shown with a 'verify' badge.
- Equilibrium residual above tolerance (ENG-RESIDUAL / ENG-EQUILIBRIUM): warning with the per-axis imbalance.
- Cap approaching (>= 90%): warning row and amber meter; cap reached: error-free but creation tools disabled; imports that would exceed the cap are rejected before applying with the count ('This import adds 120 members; 12 remain').
- Over budget: after three consecutive solves above the tier budget the chip suggests Manual mode; in Manual the chip shows 'Paused' and the canvas shows 'Results are from 10:42 - Run (Ctrl+Enter)'.
- Solver failure (NaN/Inf or panic): 'Solver error - results withheld. [Report a problem]' with the diagnostic bundle prefilled.

**Interactions:**
- Diagnostics update within 200 ms of an edit; entries keep stable ids so rows do not jump; clicking a row selects and frames its entities and outlines them.
- Fix actions run as single named commands (Merge N9 into N4; Assign section; Add node at intersection; Make M6 a frame member; Add pin at N4) and are undoable.
- Animate mechanism loops the null-space mode at the deformation scale; Stop restores the dimmed last-valid view; reduced motion shows a static exaggerated pose with arrows.
- Explain opens the generated help page for the validation code (what it means, common causes, how to fix) in the Help panel.
- Re-check forces validation and, if valid, a solve.
- Cap meter click opens 'What counts?' (members and nodes counted, hidden entities count, panels do not; identical rule on the server).

**Keyboard and accessibility:**
- Dock is a list with roving focus; Enter on a row = Show; buttons for Fix/Animate/Explain are reachable with Tab; Alt+D toggles the dock; the error count is announced when it changes (status role).
- Mechanism card is a dialog-like region with a heading; Animate is a toggle button announcing playing/stopped.
- Severity is conveyed by icon, word and color.
- Cap meter has an accessible value text ('288 of 300 members used').

**Requirements:**
- WS MOD-09
- WS PERF-01
- WS EDIT-06
- SIM-ROB-01
- SIM-ROB-02
- SIM-ROB-03
- SIM-VAL-01
- SIM-VAL-02
- SIM-ARCH-06
- STR ERR-01
- STR ERR-02
- NFR PERF-04
- GAP4-HELP-02
- GAP4-HELP-03
- ADR R14

## Screen: WS-07 Pre-submission self-check panel ('Check my design')

**Roles:** Learner (per the profile: mode unlimited / capped / off; disclosure level 0-4); Author (preview runs in dry-run); Instructor/TA (read-only view of the learner's last self-check in inspect mode) · **Route:** `same route; ?panel=check`

Let the learner run the deterministic part of the grader in the browser and see pass/fail per item with clause-cited evidence, counts remaining, and archetype-specific items, without revealing scores, benchmarks, keys or judged criteria; guarantee that what is shown is exactly what the server will compute for the same model and artifact.

```
┌─ RIGHT RAIL · CHECK ─────────────────────────────────────────────────────────────────────────┐
│ CHECK MY DESIGN                               2 of 3 self-checks left · [▶ Run self-check]   │
│ Runs the same checks the grader runs (checks 1.4.0 · US pack: ASCE 7-22, AISC 360-22).        │
│ Shows pass or fail per item. Does not show scores, the benchmark, or judged criteria.          │
│ Last run 2 min ago on model a81f…c2 (current) · ● up to date                                   │
│ ──────────────────────────────────────────────────────────────────────────────────────────── │
│ ▾ MODEL VALIDITY              ✓ 4 pass                                                        │
│ ▾ LOADS & COMBINATIONS        ✗ 1 fail · ▲ 1 warn                                             │
│   ✗ Missing combination 0.9D + 1.0W(−X) · required by ASCE 7-22 §2.3.1         [Add it] [Why?] │
│   ▲ Case S has no loads · scenario pg 1.44 kN/m² → pf ≈ 1.01 kN/m²             [Go to Loads]  │
│ ▾ STRENGTH (AISC 360-22)      ✗ 2 fail · ✓ 14 pass                                            │
│   ✗ B3  DCR 1.23 > 1.00 · flexure, LTB (F2.2) · governing C4 · Lb 6.00 m        [Show] [F2.2 ▸]│
│   ✗ C2  DCR 1.04 > 1.00 · combined (H1-1a) · governing C5 0.9D + 1.0W(+X)       [Show] [H1 ▸]  │
│ ▾ SERVICEABILITY              ✓ 6 pass                                                        │
│   ✓ max δ/L 1/412 ≤ L/360 under D + L at B1 · drift 1/520 ≤ h/400 under 0.42W(+X)             │
│ ▾ STABILITY                   ▲ 1 advisory                                                    │
│   ▲ B2 = 1.12 at story 1 under C4 · include second-order effects (AISC App. 8)   [Show] [Why?] │
│ ▾ TASK CONSTRAINTS            ✓ sections within W8-W14 · ✓ geometry envelope · mass 1.86 t     │
│ ▾ DELIVERABLES                ✗ memo: 2 sections empty · ✗ snapshot 'moment diagram' missing   │
│ ──────────────────────────────────────────────────────────────────────────────────────────── │
│ Evidence ids EV-STR-0007… will match your grade exactly if the model is unchanged.             │
│ Automated check - not professional engineering advice.                                         │
└──────────────────────────────────────────────────────────────────────────────────────────────┘

disclosure level 2 (summative preset) variant of the body:
│ LOADS & COMBINATIONS   1 item needs attention      STRENGTH   2 of 16 checks fail           │
│ SERVICEABILITY         all pass                    DELIVERABLES  2 items incomplete          │
│ (Per-item details are not shown for this task. Hints: off.)                                 │

exam variant:
│ CHECK MY DESIGN   OFF in exam mode ⓘ  - the checks library is not available in this session │
```

**Regions:**
- Header: title, remaining count or 'Unlimited', Run button, the artifact statement (checks library version and pack), what is and is not shown, last-run model hash and up-to-date/outdated state.
- Evidence groups by category (Model validity, Loads and combinations, Strength, Serviceability, Stability, Code minimums, Task constraints, Deliverables; Analyze adds Report values; Check adds Findings scope; Diagnose adds Found errors and unreported changes) with counts; each item is an EvidenceCard: status, subject label, metric with units vs limit, governing combination and station, clause id with paraphrased title, actions (Show, Why?, Fix/Go to).
- Footer: evidence-id parity statement and the AI/automation disclaimer line (D-series).

**Key data:**
- Checks library version, code pack ids and versions, engine version, model hash at run time.
- GradeEvidence records: evidence id, check type, subject, status, severity, metric (value, unit, limit, comparator, margin), governing combination and station, values used (Mu, phiMn, Lb, Cb…), clause reference, message key, visual payload.
- Remaining self-checks, disclosure level, hint tiers and costs.
- Deliverable validators' output (completeness, consistency, snapshot requirement status).

**States:**
- Never run: body shows categories with 'Not checked yet' and the Run button primary.
- Running: progress 'Analyzing all combinations… 12 of 20' (cancellable); budget is the tier analysis budget plus 500 ms.
- Up to date / Outdated ('Model changed since this check (3 edits) - run again') / Blocked ('Fix 2 validation errors first').
- Capped: 'No self-checks left for this task' with the Run button disabled; counts enforced server-side.
- Disclosure levels: 0 nothing (tab hidden), 1 completeness only, 2 counts per category, 3 per-item pass/fail (default coach), 4 per-item plus graduated hint tiers (category > entity > clause).
- Archetype variants: Analyze (field completeness, dimension validity, plausibility, validity, equilibrium; counts within tolerance at level 2+); Check (scope coverage, entry consistency, clause applicability, model unchanged; agreement counts at level 2+); Diagnose (fixed-model validity, entry validity, unreported changes; found-count at level 2+); Design/Optimize (full deterministic set, benchmark hidden, cost vs budget).
- Exam: tab shows 'OFF in exam mode' and never requests the artifact.
- Offline: 'Self-check runs locally; the remaining count will sync when reconnected'.

**Interactions:**
- Run executes validation, all required combinations and the checks library in the worker, then renders evidence; the result is stored on the draft timeline (self_check event).
- Show flies to the subject, switches the case to the governing combination and the overlay to the relevant quantity, and opens a probe card.
- Why? opens the generated check/clause page in the Help panel with the learner's own demand, capacity and limit values beside the explanation.
- Fix actions (Add combination, Go to Loads, Assign) are the same commands as elsewhere.
- Hint tier buttons (level 4 only) reveal progressively and log hint events; costs, when configured, are shown before reveal.
- Collapsing a category persists per user.

**Keyboard and accessibility:**
- Panel is a tree of disclosure groups; items are list entries with status text first ('Fail: member B3, DCR 1.23 of 1.00…'); actions are buttons.
- Run has a shortcut Ctrl+Shift+C; completion is announced ('Self-check finished: 3 fail, 1 warning, 24 pass').
- Status is conveyed by icon, word and color; clause links open the help panel without losing focus position.

**Requirements:**
- PRD PER-02
- GAP3-DLV-16
- GAP3-DLV-17
- AIG CHK-01
- AIG CHK-02
- AIG CHK-03
- AIG CHK-05
- STR GRD-04
- STR CODE-03
- STR CODE-04
- GAP4-HELP-02
- GAP5-EXAM-01
- ADR R4
- ADR R9

## Screen: WS-08 Deliverables dock: Report values (Analyze), Findings (Check), Found errors and change review (Diagnose), memo and snapshot entry, submission checklist

**Roles:** Learner; Author (defines fields, scope and seeded error pool; previews as learner); Instructor/TA (read-only in inspect mode) · **Route:** `same route; ?panel=deliver&tab=values|findings|errors|memo|snapshots|checklist; submit dialog opens from the header Submit button`

Capture the archetype-specific deliverables next to the model with unit-aware inputs and entity binding, show live completeness and consistency, and give one checklist that mirrors the server's submission validators, the late-penalty preview, attempts remaining and the honor pledge.

```
┌─ RIGHT RAIL · DELIVERABLES   [Report values] [Memo] [Snapshots] [Checklist] ─────────────────┐  (Analyze task)
│ REPORT VALUES   3 of 5 complete                       fill from my results: allowed for this task│
│ 1 Reaction at A, vertical (up +)      case L     [ 24.0   ] [kN ▾]    ✓   (A highlighted)       │
│ 2 Max moment, member AB (sagging +)   case L     [ 45.0   ] [kN·m ▾]  ✓                         │
│ 3 Shear at B, member AB (sign per convention ▸) case L  [        ] [kN ▾]  ○  enter ≥ 3 sig figs│
│ 4 Axial force, member M6   T/C: (T) (C) case L   [ 118    ] [kip ▾]   ▲ larger than the total   │
│                                                 applied load (96.0 kN). Check the units.         │
│ 5 Mid-span deflection, AB             D + L      [ 8.2    ] [mm ▾]    ✓                         │
├──────────────────────────────────────────────────────────────────────────────────────────────┤  (Check task)
│ FINDINGS   scope: governing limit state per member · coverage 7 of 9 · utilization overlay: off │
│ member ▾│ limit state ▾     │verdict│ demand    │ capacity  │ ratio│ combo│ clause ▾│ reason (≤60 w)│
│ B1     │ F-LTB  flexure LTB │ FAIL  │ 48.2 kN·m │ 39.1 kN·m │ 1.23 │ C4   │ F2.2    │ Lb = 6.0 m… │
│ C1     │ H1 combined        │ PASS  │ —         │ —         │ 0.76 │ C4   │ H1-1a   │             │
│ ▲ B2: no entry · B3: no entry                        [+ Add finding] [Import CSV] [Sort by member]│
│ ✗ row B1: verdict PASS but demand exceeds capacity - inconsistent; not submittable until fixed    │
├──────────────────────────────────────────────────────────────────────────────────────────────┤  (Diagnose task)
│ FOUND ERRORS   the brief says 2 seeded errors                     [Changes since start: 3 ▸]   │
│ 1 Support N1 · supports · 'Roller should be a pin per the given data'            ● fixed       │
│ 2 Load L4 · loads · 'UDL is 1000× too large (N/m entered as kN/m)'                ○ not fixed  │
│ Changes since start: N1 support (reported) · L4 value (reported) · M3 section ▲ unreported [Revert] [Add finding]│
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ CHECKLIST   ✓ model a81f…c2   ✓ answers 5/5   ✗ memo (M-MET empty)   ✓ snapshots 1/1   □ pledge │
│ Attempt 1 of 3 · due Nov 5, 23:59 America/Chicago · late penalty preview: none · [Submit…]       │
└──────────────────────────────────────────────────────────────────────────────────────────────┘

Submit dialog:
┌─ Submit attempt 1 of 3 ───────────────────────────────────────────────────────────────────────┐
│ Model a81f…c2 (analysis fresh) · answers 5 · memo 212 words · snapshots 1 · attachments 0       │
│ Policy: individual · AI use: allowed with disclosure → [AI tools used and purpose: ______ ]     │
│ ☐ I accept the honor pledge (v3) · generated paragraph: 'This task is individual work; AI use    │
│   must be disclosed; no exam profile.'                                                          │
│ Late penalty: none · Grading: deterministic results within minutes; AI feedback is provisional  │
│ until your instructor reviews it (summative).                                                   │
│                                              [Cancel]   [Submit attempt]                        │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
Receipt: 'Submitted v1 at 14:08 CT · model sha256:a81f… · answers sha256:… · pledge v3 accepted'
```

**Regions:**
- Tab strip inside the Deliver tab, showing only the tabs the task defines (Report values / Findings / Found errors / Memo / Snapshots / Checklist).
- Report values (Analyze): numbered AnswerField rows with prompt, bound entity and case, unit-aware input (any compatible unit), declared sign convention or T/C selector, status (empty / entered / dimension error / plausibility warning), 'fill from my results' when allowed, 3-significant-figure guidance.
- Findings (Check): FindingRow grid with member picker (list or click in 3D), limit state from the catalog filtered by pack and section family, verdict, demand and capacity unit inputs, auto ratio, governing combination when required, clause picker with paraphrased titles, reason; live scope coverage; inconsistency flags; CSV import with the documented layout.
- Found errors (Diagnose): FoundErrorRow with entity reference (pick or list), category enum, description, derived status fixed / not fixed; 'Changes since start' view listing every modified entity vs the injected starter, unreported markers, per-change Revert and 'Add finding' from a change.
- Memo tab: embeds the structured memo editor (section cards, prompts, live word counts, LaTeX, figures from snapshots); plain-text fallback; provenance notice.
- Snapshots tab: required snapshot list with status and 'Capture for requirement' (opens WS-13).
- Checklist: every deliverable with status derived from the shared validators (complete / incomplete with reason / invalid), hard vs soft required markers, attempts remaining, due date in the offering timezone, late-penalty preview, pledge state, Submit button.
- Submit dialog and receipt.

**Key data:**
- Answer fields: id, label, prompt, query binding (entity, component, station, case), dimension, convention, compare mode, tolerance hints (not values), entered value and unit, SI value, status.
- Findings: entry id, member ref (label/coords), limit state id, verdict, demand/capacity SI, ratio, governing combo, clause library id, reason; scope mode and coverage; consistency flags.
- Found errors: entry id, entity ref, category, description, status, timestamps; change list vs starter (entity, field, before/after, reported flag).
- Checklist: deliverable kinds, hard/soft flags, validator results, attempt policy state, due date and timezone, late penalty preview, pledge version and text hash, policy disclosures, receipt hashes.

**States:**
- Field states: empty, entered, dimension mismatch ('kN·m is a moment; this field needs a force'), implausible ('larger than the total applied load (96.0 kN). Check the units.' - never says wrong), entity not found ('not found in your model'), filled from results (badge), locked after submission.
- Findings: coverage incomplete; inconsistent row (verdict vs numbers, clause not applicable to the limit state) blocks submission; out-of-scope entry (ignored unless strict); model-changed warning in Check tasks ('The given design has changed - findings must refer to the given model').
- Diagnose: status updates within 200 ms of an edit; 'entity no longer exists' if deleted; unreported change count badge; scope-locked tasks show locked fields and no collateral warnings.
- Checklist: Submit disabled with the list of hard-required items missing; soft-required missing shows 'allowed, but the bound criteria will score 0'; attempts exhausted; cooldown active; past due with penalty preview; auto-submit notice for exam tasks.
- Submitting: progress then receipt with hashes; failure keeps the draft and shows 'Not submitted - try again or report a problem'.

**Interactions:**
- Focusing an answer field highlights its bound entity and switches the active case/combination; the input converts to SI client-side for validation only; T/C selector sets the sense.
- Member picker: type-ahead list or 'pick in 3D' (enters a one-shot pick mode, Esc cancels); limit-state list filters by the member's section family; clause picker shows the paraphrased title and equivalence set.
- Found errors: 'Add finding' from a change pre-fills the entity; Revert restores the starter state of that entity as one undo step; statuses derive from the diff against the stored starter.
- Checklist Submit opens the dialog; pledge checkbox is required; disclosure fields appear per policy; receipt is copyable and linked from the task page.
- All entries autosave with the model draft within 2 s locally and 30 s to the server and survive reload.

**Keyboard and accessibility:**
- Every panel is fully keyboard-operable with list-based entity references (no canvas interaction required); Tab order follows the row layout; Enter adds a row (Ctrl+Enter in grids); Delete removes with confirmation.
- Unit inputs are labeled with the field's dimension and current unit; errors are associated via aria-describedby and announced.
- Findings grid is a native table with editable cells; sort controls are buttons; coverage summary is a live status line.
- Checklist items are a list with status text; Submit button states explain why disabled.
- Panels meet WCAG 2.2 AA; axe zero serious/critical.

**Requirements:**
- GAP3-DLV-01
- GAP3-DLV-02
- GAP3-DLV-05
- GAP3-DLV-08
- GAP3-DLV-12
- GAP3-DLV-14
- GAP3-DLV-19
- GAP3-DLV-20
- GAP5-POL-01
- GAP5-POL-02
- LMS SUB-02
- LMS SCH-02
- WS CAP-02
- STR CAT-03

## Screen: WS-09 Grader feedback overlay and submitted-version comparison

**Roles:** Learner (after release; formative tasks immediately with the AI-provisional label); Instructor/TA (same overlay inside the review screen's viewer, plus entry-level adjudication actions there); Author (calibration preview) · **Route:** `/offerings/:offeringId/tasks/:taskId/workspace/submissions/:versionId (read-only); ?compare=working toggles the working copy with the feedback layer re-anchored`

Close the loop between the grader's evidence and the geometry: outline failing, warning and noted entities by severity, list each item with its reason, clause and action, fly to the governing case and overlay on click, label AI provenance and review status honestly, and let the learner compare the graded snapshot with the working copy before resubmitting.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ ◀ Portal frame under wind │ Viewing SUBMISSION v2 (graded) - read-only │ Compare: ● Submitted ○ Working (14 changes) │ ? │
├────┬────────────────────────────────────────────────────────────────┬────────────────────────┤
│    │ AI-generated feedback - not professional engineering advice · Reviewed by Dr. Lee, Nov 2 │ FEEDBACK   overlay ☑   │
│    │                      ▼ C4  1.2D + 1.0W(+X) + L + 0.5S ▾           │ 2 fail · 1 warn · 2 note│
│    │  C1 ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━● C2 │ ✗ B3  Flexural DCR 1.23│
│    │    ┃                                                   ┃        │   under C4 · AISC 360-22│
│    │    ┃   B3 ═══════ red outline + hatched ═══════        ┃        │   F2.2 (LTB) · Lb 6.00 m│
│    │    ┃                                                   ┃        │   but braces at 3.00 m  │
│    │    ┃   B2 ─ ─ ─ amber outline ─ ─ ─                    ┃        │   → set Lb = 3.00 m     │
│    │    ┃                                                   ┃        │   [Show] [Why ▸] EV-STR-0007│
│    │  ▲ N1                                                 ▲ N2      │ ✗ Missing 0.9D + 1.0W(−X)│
│    │ ┌─ Utilization · combined · C4 · as graded (results res_9f2a) ──┐ │   [Show combinations]   │
│    │ │ 0 ░░ ▒▒ ▓▓ ██ 1.0 ▓▓▓ >1.0 hatched     ● GRADED SNAPSHOT      │ │ ▲ B2  δ/L 1/238 > L/240 │
│    │ └───────────────────────────────────────────────────────────────┘ │   under D + L  [Show]   │
│    │                                                                 │ ⓘ Memo claims 'LTB      │
│    │                                                                 │   governed B2' -        │
│    │                                                                 │   contradicted (B2 was  │
│    │                                                                 │   governed by deflection)│
├────┴────────────────────────────────────────────────────────────────┴────────────────────────┤
│ Grade 71 / 100 · capped at 75: Major strength finding · per-criterion evidence ▸ │ [Open working copy to fix] [Resubmit · 2 attempts left] │
└──────────────────────────────────────────────────────────────────────────────────────────────┘

working-copy compare state (header): 'Working copy · feedback re-anchored · B3 changed since graded (section W10x19 → W12x26) · 2 items no longer apply'
formative label: 'AI-provisional - not yet reviewed by an instructor'
```

**Regions:**
- Header: submission version and status; Compare toggle (Submitted / Working) with the change count; read-only indicator.
- Provenance strip (top of canvas): AI label and review status per PRD-02 and GAP2-DIS-01 ('AI-generated feedback - not professional engineering advice' plus 'Reviewed by <name>, <date>' or 'AI-provisional - not yet reviewed by an instructor' or 'Not yet reviewed by an instructor').
- Canvas: graded snapshot rendered read-only with the grader overlay (outline pass: fail red, warn amber, note blue), legend badged 'GRADED SNAPSHOT' with the result id; in Working compare, entities changed since grading are drawn with a 'changed' marker and their items say 'changed since graded'.
- Feedback tab (right rail): counts by severity; FeedbackItem list sorted fail > warn > note then by criterion weight: subject, reason tag with numbers and clause, concrete action, evidence id, Show and Why; memo claim verdicts (supported / unsupported / contradicted) with the evidence they conflict with; archetype variants (Analyze per-field table with submitted / own-model / reference when revealed / status and diagnosis; Check key-vs-report matrix; Diagnose seeded errors with found/fixed/missed and an animated mechanism where relevant).
- Footer: total with gate explanation ('capped at 75: Major strength finding'), link to the per-criterion evidence view, Open working copy, Resubmit with attempts remaining (hidden when attempts are exhausted or the window closed).

**Key data:**
- Submission version id, model hash, result id, grader_version, review status and reviewer, release time.
- GradeEvidence records with visual payloads (highlight ids, color scale, show, combination id, annotation); FeedbackNarrative issues (evidence id, problem, action, priority); memo claim verdicts.
- Total, gates applied, per-criterion summary link; attempts remaining; reveal timing per hidden artifact.
- Diff between graded snapshot and working copy (changed, added, removed entity ids).

**States:**
- Provisional (summative awaiting review): deterministic items shown, judged items 'pending instructor review', total hidden; formative: everything shown with AI-provisional label.
- Released and reviewed: full view with reviewer name and date; overridden criteria marked 'adjusted by <role>'.
- Judged stage pending (LLM outage or refusal): narrative items 'pending', deterministic items complete.
- Working compare with entities deleted since grading: item shows 'changed since graded - view as of submission' which jumps back to the snapshot and frames the element's historical state.
- Reveal policy not yet met (Analyze reference values, Check key, Diagnose errors): rows show status and diagnosis but not the hidden values, with 'Available after <date/condition>'.
- Exam task before window close: feedback withheld with the reveal time.
- Integrity hold: 'Under review' with no reason unless notified (identical message to any held grade).

**Interactions:**
- Clicking an item frames the subject, switches the case to the governing combination, sets the overlay named by the item's visual payload (utilization / deflected shape / force diagram) and opens a probe card.
- Why opens the clause/check page with the learner's values; evidence id copies to clipboard on click.
- Compare toggle swaps the model to the working copy without leaving the screen; the overlay re-anchors by stable ids and marks changed items.
- Open working copy returns to WS-01 with the Feedback tab still available (overlay toggle) so fixes can be made while reading feedback.
- Resubmit opens the checklist (WS-08) on the working copy.
- 'Was this feedback useful?' one-tap prompt appears once per release at the bottom of the Feedback tab (MET-04).

**Keyboard and accessibility:**
- Feedback items are a navigable list with full reason text and severity words ('Fail', 'Warning', 'Note'); Enter = Show; outline styles differ by stroke pattern as well as color.
- Provenance strip is a status region announced on load.
- Compare toggle is a radio group; change markers have text ('changed since graded').
- Memo claim verdicts use words and icons.

**Requirements:**
- WS RES-08
- WS CAP-02
- AIG XPL-01
- AIG XPL-02
- AIG LLM-04
- AIG REV-01
- AIG AGG-02
- GAP3-DLV-22
- GAP3-DLV-18
- PRD PRD-02
- PRD PRD-03
- PRD MET-04
- GAP2-DIS-01
- GAP6-04
- ADR R11

## Screen: WS-10 Exam mode: pre-start disclosure and the locked workspace

**Roles:** Learner; Instructor/Author (preview-as-learner in exam mode shows the same signaling); TA (read-only after close) · **Route:** `/offerings/:offeringId/tasks/:taskId/exam/start (pre-start) then the workspace route with the exam profile in force; /exam/session-active for the takeover screen`

Make the difference between practice and exam unmistakable before the learner commits, enforce the per-task exam profile with server-withheld artifacts and visible 'off' badges, keep the countdown authoritative, and record an attestation the instructor can read later.

```
┌─ EXAM · Midterm design - steel beam (Design · T3) ───────────────────────────────────────────┐
│ Window: Nov 6, 09:00-11:00 CT · Your duration: 120 min × 1.5 accommodation = 180 min            │
│ Turned off during the exam: hints · self-check · utilization and code checks · exports ·        │
│   share links · screenshot downloads · task discussion                                          │
│ Results you can see: deflections and forces only (no utilization)                               │
│ Recorded: model operations, sessions, analysis runs, paste events (length and source, never     │
│   contents) - 'What Bridle records in this task' ▸ · kept 12 months · no camera, no keystrokes   │
│ Policy: individual work · AI use: prohibited                                                    │
│ One session only: opening this exam elsewhere ends the session here.                            │
│ ☐ I accept the honor pledge (v3): '…' (generated from this exam's policy)                        │
│                                                  [Cancel]              [Start exam ▸]           │
└───────────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ ▌EXAM MODE▐  Midterm design · 01:42:18 remaining (server time) · results: analysis only · individual · AI: prohibited │
├────┬────────────────────────────────────────────────────────────────┬────────────────────────┤
│ V  │ [Top][Front][Iso] [Lines⇄Solid] [Labels] [Color: section ▾ · Utilization OFF]            │ Props Model Loads     │
│ N  │ ╔═══════════════════ distinct accent border on the canvas ═══════════════════╗          │ Results · Check OFF   │
│ M  │ ║                                                                             ║          │ Deliverables           │
│ S  │ ║     (model; deformed shape and diagrams allowed; no color map)              ║          ├────────────────────────┤
│ L  │ ║                                                                             ║          │ RESULTS               │
│ P  │ ║  ┌─ Moment My · C2 ───────────────┐                                         ║          │ ☑ Deformed ☑ My ☑ Vz  │
│    │ ║  │ ● FRESH 12 ms                   │                                         ║          │ ☑ Reactions            │
│    │ ║  └─────────────────────────────────┘                                         ║          │ Utilization OFF ⓘ      │
│    │ ╚═════════════════════════════════════════════════════════════════════════════╝          │ Self-check OFF ⓘ       │
│    │                                                                                          │ Hints OFF ⓘ            │
├────┴────────────────────────────────────────────────────────────────┴────────────────────────┤
│ 2D · XZ │ Snap ● │ kN · m │ Members 3/10 │ ● Fresh │ Saved 1 s │ Export OFF · Share OFF │ ⓘ records │ Educational use only ⓘ │
└──────────────────────────────────────────────────────────────────────────────────────────────┘

session-active screen: 'This exam is open in another session (started 09:12, Chrome on macOS). [Take over here] [Cancel] - taking over ends the other session within 5 s and is recorded.'
close: 'Time is up. Your last saved draft (a81f…) was submitted automatically at 11:00:00 CT. Pledge: not captured.'
```

**Regions:**
- Pre-start screen generated from the profile flags: window and duration after accommodations, disabled list, results visibility, recorded fields with the notice link, policies, single-session rule, pledge checkbox, Start action.
- Exam banner (top, non-dismissable, distinct accent color and border, present in full-screen and in any required snapshot): task name, countdown synced to server time every 30 s, results visibility, policies.
- Workspace with 'OFF' badges: Self-check tab, hint buttons, Utilization in color-by and Results, Export/CSV/Download, Share, Screenshot download; Deliverables dock remains (snapshots capture into the bundle only).
- Results tab per visibility: full (as WS-05) / analysis_only (deformed shape, diagrams, reactions; no utilization or DCR columns) / none (Results tab hidden; chip 'Validity only').
- Session-active (takeover) screen; close/auto-submit notice; reconnect indicator ('Reconnecting… your session is kept').

**Key data:**
- Exam profile id and version, effective open/close after multiplier and extensions, results visibility, disabled features, single_session, auto_submit_at_close, reveal_feedback_at, policies, pledge text version.
- Session id, start, client build, artifacts served, takeover_of, reconnect gaps, refused request counts, ops rejected after close.
- Server time offset for the countdown.

**States:**
- Before window: pre-start shows 'Opens at 09:00 CT' with Start disabled.
- Active: countdown; aria-live announcements at 30, 10, 5 and 1 minutes; banner color unchanged (no alarm color shifts), text 'Less than 5 minutes left' added.
- Network loss under 60 s: countdown resumes from server time on reconnect; longer gaps are recorded as reconnects (amber in attestation).
- Refused request (a stale client somehow calls a disabled endpoint): toast 'Not available in exam mode' and an exam_violation notice signal; UI never offers the action.
- Second session: takeover screen; the first session shows 'This session was taken over at 09:40 on another device' and becomes read-only.
- Close: ops after close rejected with 'The exam closed at 11:00:00; this change was not saved'; auto-submit (if enabled) with pledge_status not_captured; feedback withheld until the profile's reveal time.
- Platform fault (restricted artifact served): nothing visible to the learner; attestation attributes to the platform.
- Author preview: identical signaling plus a 'Preview - nothing is recorded' strip under the exam banner.

**Interactions:**
- Start requires the pledge checkbox; Start creates the session and records client build hash and artifacts served.
- Required snapshots: 'Capture for requirement' works and writes to the bundle; Download hidden.
- Submit from the checklist works at any time inside the window; the receipt shows the attestation state (green/amber/red) after close.
- Help panel is available but exam-restricted explanation pages are not reachable (listed as 'not available during the exam').
- Clipboard paste works and is logged with length and classification, never contents; the memo editor says so.

**Keyboard and accessibility:**
- Pre-start is a form with a single required checkbox; Start is the default button; all lists are plain text.
- Banner is a landmark region with aria-live polite for time announcements; countdown contrast meets WCAG 2.2 AA; 'OFF' badges have text 'off in exam mode' and tooltips with the reason.
- Takeover screen is a dialog with focus on Cancel by default.
- Reduced motion: no countdown flashing.

**Requirements:**
- GAP5-EXAM-01
- GAP5-EXAM-02
- GAP5-EXAM-03
- GAP5-EXAM-04
- GAP5-POL-01
- GAP5-POL-02
- GAP5-EVID-01
- GAP3-DLV-17
- STR GRD-04
- PRD PER-02
- WS CAP-01

## Screen: WS-11 Accessible parity mode: tabular model editor, command line, result tables, textual summary, keyboard camera

**Roles:** Learner (any; required path for screen-reader users and no-WebGL machines); Instructor/TA inspect; Author (form-based equivalents for element properties) · **Route:** `same route with ?layout=tables (or ?layout=both for canvas + tables); also the destination of 'Continue with tables' from the graphics-unsupported page and the Tables tab of the bottom dock`

Provide every modeling and results action without the canvas: editable tables for nodes, members, supports, loads, cases, combinations, sections, materials and groups; a command line; sortable result tables with units; a textual analysis summary; and keyboard camera control when the canvas is present. Builds the same model (hash-equal) as the canvas path.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ ◀ Warren truss · Analyze · T2 · 2D │ Layout: ○ Canvas ● Tables ○ Both │ ● Coach │ Submit ▸ │ ? │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ > node 9,0_                                     command line · Enter runs · ↑ ↓ history · ? grammar│
├──────────────────────────────┬───────────────────────────────────────────────────────────────┤
│ MODEL                        │ NODES (7)   [+ Add row  Ctrl+Enter] [Delete row] [Import CSV] [Export CSV] │
│ ▸ Nodes (7)                  │ ┌────┬───────┬─────────┬─────────┬──────────┬────────┐          │
│ ▸ Members (11)               │ │ id │ label │ X (m)   │ Z (m)   │ support  │ locked │          │
│ ▸ Supports (2)               │ ├────┼───────┼─────────┼─────────┼──────────┼────────┤          │
│ ▸ Loads (4) · Cases (2)      │ │ N1 │ A     │ 0.000   │ 0.000   │ pin      │ yes    │          │
│ ▸ Combinations (3)           │ │ N2 │ B     │ 3.000   │ 0.000   │ —        │        │          │
│ ▸ Sections (2) · Materials (1)│ │ N3 │ C     │ 6.000   │ 0.000   │ —        │        │          │
│ ▸ Groups (1)                 │ │ N4 │ D     │[4.500  ]│ 2.598   │ —        │ editing│          │
│ ▸ Grid · Levels              │ └────┴───────┴─────────┴─────────┴──────────┴────────┘          │
│ RESULTS · case L ▾           │ Row 4 of 7 · N4 · arrows move · Enter edits · Esc cancels · Tab next cell │
│ ▸ Displacements              ├───────────────────────────────────────────────────────────────┤
│ ▸ Reactions                  │ SUMMARY (text; updates after each analysis; copy ▸)            │
│ ▸ Member forces              │ Model: 7 nodes, 11 truss members, pin at A and roller-X at G,  │
│ ▸ Utilization                │ cases D and L, 3 combinations. Analysis: fresh (9 ms, Tier S). │
│ ▸ Deflection ratios          │ Case L: maximum displacement 8.2 mm (vertical) at node D.      │
│ ▸ Equilibrium                │ Governing member M6 (bottom chord B-C): tension 118 kN,        │
│ ▸ Summary                    │ utilization 0.84 (AISC 360-22 D2, yielding), combination C2.    │
│ DIAGNOSTICS ● 0              │ Deflection ratio 1/732 within L/360. Equilibrium residual       │
│ DELIVERABLES ▸               │ 0.000 %. No validation issues.                                 │
│ Canvas preview ▸ (hidden)    │                                                                │
├──────────────────────────────┴───────────────────────────────────────────────────────────────┤
│ 2D · XZ │ kN · m ▾ │ Row N4 selected │ Members 11/40 │ ● Fresh 9 ms │ Saved │ ⓘ records │ Educational use only ⓘ │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Regions:**
- Header layout switch (Canvas / Tables / Both) available in every workspace; the choice persists per user; on no-WebGL machines Tables is forced with a note.
- Command line (top, full width): same grammar as the palette; Enter runs one command; history with arrows; '?' lists the grammar; errors appear inline under the line.
- Navigator (left, 240 px): model tables with counts, result tables for the selected case, diagnostics count, deliverables link, optional canvas preview toggle (in Both layout the canvas occupies the right 50%).
- Table area: one native HTML table per entity type with units in headers; editable cells; row actions; CSV import/export with the documented column layout; locked rows read-only with the reason; supports edited as a per-DOF select or preset; loads with case, kind, target, values; combinations as factor grids.
- Textual summary: deterministic paragraph(s) generated from the model and results (counts, supports by label, cases and combinations, analysis state and timing, max displacement with node, governing member with utilization, clause and combination, deflection ratios vs limits, drift when applicable, equilibrium, validation issues); copyable.
- Status bar as WS-01 (selection shows the row).

**Key data:**
- All model entity tables (ids, labels, coordinates, supports per DOF, member ends, section, material, beta, releases, design attributes, loads, cases, combinations, groups, grid, levels) with lock flags.
- Result tables per case: displacements (6 components), reactions, member forces at stations and extrema, utilization per check with clause and combination, deflection ratios vs limits, drift, equilibrium.
- Textual summary fields; analysis state and timing; diagnostics count.
- Command history.

**States:**
- Forced (no WebGL2): banner 'The 3D view is unavailable on this device; everything can be done here. [Run system check]'.
- Both layout: table selection syncs to the canvas and vice versa; keyboard camera applies when the canvas has focus.
- Analysis states appear in the summary's first lines and in the status bar; when blocked, the summary starts with the blocking issues and their fix suggestions.
- Profile-driven: utilization tables absent when overlays are off; results tables absent when live_results is none.
- Cell validation errors (unit, range, dangling reference, cap exceeded) shown inline and announced; a row is never committed invalid.
- Large tables (Tier M, 2,000 rows) virtualized with a 'rows 1-50 of 2,000' status and type-ahead jump.

**Interactions:**
- Arrow keys move between cells; Enter edits; Esc cancels; Tab next cell; Ctrl+Enter adds a row (pre-filled with the next id); Delete on a row deletes with confirmation; Ctrl+Z/Shift+Ctrl+Z as everywhere; edits are the same commands as canvas edits.
- Type-ahead in the first column jumps to an id or label; sorting by column header; filter box per table.
- Result tables: sort, filter, CSV export (same disclaimer and stamp rules), Enter on a row selects the entity (and frames it when the canvas is shown).
- Command line accepts coordinates and commands ('node 9,0', 'member N4 N7', 'support N7 rollerx', 'load member M3 -10 kN/m', 'case L', 'run', 'summary' reads the summary aloud via focus).
- Deliverables dock, self-check and feedback are reachable from the navigator and are the same components as in the canvas layout.
- Guided-lesson checkpoints evaluate identically here; the lesson overlay references entities by label and offers 'Open in table'.

**Keyboard and accessibility:**
- Everything operates by keyboard; focus order: header, command line, navigator, table, summary, status bar.
- Tables are real <table> elements with <th scope> headers including units; editable cells use native inputs; row selection is announced ('Row N4, node D, selected').
- Summary is a region with a heading; it is also the canvas's accessible description when the canvas is present.
- Keyboard camera (canvas focused): arrows orbit, Shift+arrows pan, + - zoom, F frame, Home fit, 1-7 presets, 5 projection.
- An e2e test builds the benchmark 2D truss here and via the canvas and asserts hash equality; a keyboard-only tester completes one task of each archetype end to end.

**Requirements:**
- WS A11Y-01
- WS A11Y-02
- WS EDIT-04
- WS IO-02
- WS VIEW-06
- NFR ACC-02
- LMS A11Y-02
- GAP3-DLV-05
- GAP4-HELP-03
- ADR R16

## Screen: WS-12 Command palette and shortcut reference

**Roles:** All workspace users · **Route:** `overlay on any workspace route (Ctrl/Cmd+K); shortcut sheet on '?' then 'Shortcuts' or Ctrl+/`

Make every toolbar action, view operation and model edit reachable and discoverable from the keyboard with fuzzy search and a command-line grammar that previews what will happen before Enter, logged as the same commands as UI actions.

```
┌────────────────────────────── Ctrl / Cmd + K ─────────────────────────────────┐
│ > load member B1 -10 kN/m_                                                     │
│ ─────────────────────────────────────────────────────────────────────────────── │
│ ▸ Apply distributed load −10.0 kN/m (global Z) on B1 in case L (active)         │  ← parsed preview
│   Runs as one command; Undo restores.                               [Enter]    │
│ ─────────────────────────────────────────────────────────────────────────────── │
│ COMMANDS matching 'load'                                                       │
│   Apply nodal load…                                              L, then N     │
│   Apply member load…                                             L, then M     │
│   Switch load case…                                              Ctrl+1 … 9    │
│   Open Loads panel                                               Alt+3         │
│ RECENT                                                                         │
│   node 6,0,3 · member N3 N4 · support N1 pin · view front · run                 │
│ ─────────────────────────────────────────────────────────────────────────────── │
│ Grammar: node x,z | node x,y,z | node @dx,dy,dz | member n1 n2 [truss] |        │
│ support n pin|rollerx|rollerz|fixed|free | load node n Fz -10 kN |             │
│ load member m w kN/m [local|projected] | section W12x26 | material A992 |      │
│ case L | combo 1.2D+1.6L | view top|front|iso | fit | frame | run | probe m    │
└────────────────────────────────────────────────────────────────────────────────┘

Shortcut sheet (overlay, Ctrl+/):
┌ Shortcuts (fixed at MVP) ──────────────────────────────────────────────────────┐
│ Tools   V select · N node · M member · S support · L load · A assign · T transform · P probe │
│ View    1-7 presets · 5 ortho/persp · F frame · Home fit · arrows orbit · Shift+arrows pan   │
│ Edit    Ctrl+Z undo · Shift+Ctrl+Z redo · Delete · Ctrl+D duplicate · Ctrl+M move by vector │
│ Panels  Alt+0 rail · Alt+1-6 tabs · Alt+D diagnostics · Ctrl+Shift+C self-check · ? help    │
│ Analysis Ctrl+Enter run (manual) · Ctrl+Shift+L toggle live                                 │
│ Trackpad: two-finger pan · pinch zoom · Alt+drag orbit · Cmd/Ctrl+drag box-select            │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Regions:**
- Input line with the typed text; parsed-command preview (what, where, value in task units, case) or a parse error with the expected form.
- Command results list grouped as Commands (fuzzy matched, with shortcut hints), Entities (jump to N4, B1 by id or label), Recent; arrow keys move, Enter executes, Tab completes.
- Grammar footer (collapsible) listing the command-line forms.
- Shortcut sheet overlay: fixed MVP shortcuts by group, trackpad alternatives, pointer mappings; printable version is v1.x.

**Key data:**
- Command registry (id, label, group, shortcut, enabled state and reason, help id).
- Entity index for jump (ids, labels, types).
- Grammar rules and unit preset; recent commands (per user, local).

**States:**
- Empty query: shows Recent and the most used commands for the current tool.
- Ambiguous entity ('B1' matches a label and an id'): preview lists both and asks to pick.
- Disabled command (locked by the task, off in exam mode, cap reached): shown greyed with the reason; Enter does nothing.
- Parse error: 'Expected: load member <member> <value> <unit>' with the caret position.
- Offline: all local commands work; server-only commands (share, export to server) greyed.

**Interactions:**
- Ctrl/Cmd+K opens with the input focused; Esc closes; typing filters within 50 ms; Enter executes exactly one command on the command bus with the same name and undo behavior as the UI.
- Units in the command default to the task preset; explicit units override and are converted to SI.
- Relative coordinates with '@' use the last placed node; omitting Y in 2D mode is allowed, in 3D 'node x,z' is rejected with a hint.
- Selecting an entity result selects and frames it (or its table row in parity mode).
- The sheet opens from the palette ('Shortcuts'), from Help, or Ctrl+/.

**Keyboard and accessibility:**
- Palette is a combobox with a listbox; the preview is announced as the description of the input; results announce their count.
- All shortcuts avoid browser defaults on macOS, Windows and Linux and respect text-input focus (shortcuts do not fire while typing in fields).
- Shortcut sheet is a table with headers; reachable by keyboard; closes with Esc.

**Requirements:**
- WS EDIT-04
- WS A11Y-01
- WS MOD-02
- WS MOD-06
- GAP4-HELP-01
- ADR MVP guardrail: fixed shortcuts plus a command palette

## Screen: WS-13 Snapshot capture, required snapshots and export

**Roles:** Learner; Author (defines required snapshots {title, overlay, case or combination, view preset}); Instructor/TA (captures evidence images in review, v1.x annotations) · **Route:** `dialog on any workspace route (Ctrl+Shift+S or Deliverables > Snapshots > Capture); export menu in the header '…' or File commands`

Produce reproducible images with a legend and title block and a JSON sidecar of view state, satisfy required submission snapshots by verifying the sidecar rather than the pixels, and export model and results with the educational-use disclaimer and the provenance stamp embedded; in exam mode capture into the bundle only.

```
┌──────────────── Capture snapshot ──────────────────────────────────────────────────────────┐
│ For requirement: ● 'Moment diagram, governing combination'  (1 of 2 required · unmet)        │
│   expected: overlay My · combination = governing strength (C4) · view front                  │
│   [Set view to requirement]   current: My ✓ · C4 (governing) ✓ · front ✓                      │
│ ○ Free snapshot                                                                             │
│ ─────────────────────────────────────────────────────────────────────────────────────────── │
│ ┌─ preview ───────────────────────────────┐   Scale   ○ 1×  ● 2×  ○ 4×  (long edge ≤ 4096 px) │
│ │  [frame with the My ribbon]             │   ☑ Legend (quantity, case C4, scale ×25)          │
│ │  legend bottom-left · title block       │   ☑ Title block: task · you · C4 · scale ·          │
│ │  bottom-right                           │     2026-11-03 14:02 CT · model a81f…               │
│ │  'Educational use only. Not for         │   ☑ Grader feedback overlay (when visible)         │
│ │   construction, permitting, or          │   Sidecar JSON (camera, overlay, case, visibility)  │
│ │   professional engineering use…'        │   is always attached.                              │
│ └─────────────────────────────────────────┘   Disclaimer and provenance stamp are embedded in   │
│                                               the PNG metadata.                                 │
│                                    [Cancel]   [Attach to submission]   [Download PNG]           │
└────────────────────────────────────────────────────────────────────────────────────────────┘

Snapshots tab (Deliverables): ' 1 Moment diagram, governing combination  ✗ unmet - captured with C2, expected governing C4  [Capture again] ·  2 Deformed shape, D + L  ✓ met (14:02) [View] [Replace] '
Export menu: 'Model JSON (canonical, stamped) · Results CSV (active case) · Reactions CSV · Nodes/Members CSV · Screenshot… · (DXF, IFC/SAF: v1.x)' - items carry the D1 disclaimer; in exam mode the menu shows 'Export OFF in exam mode'; before an individual task closes, 'Share link' is unavailable with the close date.
```

**Regions:**
- Requirement selector: required snapshots from the task with met/unmet status and the expected overlay, case and view; 'Set view to requirement' applies them; current-state checks show what still differs.
- Preview with legend and title block placement; scale options; include toggles; sidecar notice; disclaimer and stamp notice.
- Actions: Attach to submission (stores image, sidecar and hash on the draft), Download (hidden in exam mode), Cancel.
- Snapshots tab in the Deliverables dock listing requirements and status with capture/replace/view.
- Export menu with formats, disclaimer notice, stamp notice and exam/policy restrictions.

**Key data:**
- Required snapshot definitions (title, overlay type, case or combination rule, optional preset); captured sidecars (camera, projection, overlay, case id, visibility, scale factor, model hash, result id, engine version, timestamp).
- Export formats and their disclaimer/stamp fields; exam and policy flags.

**States:**
- Requirement met / unmet with the reason ('captured with C2, expected governing C4'); replaced snapshots keep the previous one until the new one is attached.
- Capture in progress ('Rendering 2× … 0.8 s'); hi-DPI capped at 4096 px; completes within 2 s.
- Stale results: capture blocked with 'Results are stale - run analysis first' (the legend would be wrong).
- Feedback overlay included when enabled on a submission view.
- Exam mode: Download and Share hidden; Attach works.
- Share link for an open individual task: 'Share links are available after Nov 5, 23:59 for this task'.

**Interactions:**
- Ctrl+Shift+S opens the dialog with the first unmet requirement preselected.
- Set view to requirement switches overlay, case and preset, then the learner may adjust the camera (camera is not part of the requirement unless the author pins a preset).
- Attach writes {reqId, imageRef, sidecar, hash} to the submission draft; the checklist updates immediately.
- Exports write the D1 string as a CSV header comment or JSON metadata field and add the provenance stamp (task version, exporter pseudonymous id, time, source model hash); imports read stamps and log them.

**Keyboard and accessibility:**
- Dialog is modal with focus trapped inside and returned on close; requirement options are a radio group; include toggles are checkboxes with the exact text that will be rendered.
- Preview has alt text summarizing the view ('Front view, My diagram, combination C4, scale 25×').
- Status of each requirement is text ('unmet: expected governing combination C4').

**Requirements:**
- WS CAP-01
- WS CAP-02
- WS IO-01
- GAP3-DLV-14
- GAP2-DIS-01
- GAP5-POL-03
- GAP5-EXAM-01
- PRD PRD-02
- WS DET-01

## Flow: First analysis on a 2D intro task (Analyze, T1) through to submission (Undergraduate learner, laptop with trackpad)

1. Open the task from the task page; the workspace loads the starter beam in 2D mode with A pinned (locked) and the guided lesson overlay on step 1 (WS-02).
2. Follow steps: place a roller at B via the Properties preset (checkpoint passes within 300 ms), apply the UDL in case L via the Load tool mini-form, watch the deformed shape and My ribbon appear with the legend saying 'case L · sagging +' and the status chip 'Fresh 4 ms'.
3. Open Results and read δmax from a probe or the results table; open Deliverables > Report values, focus field 1 (A highlights, case L selected), enter 24.0 kN; use 'fill from my results' for the deflection field since the task allows it (WS-08).
4. Run the self-check (WS-07): completeness, dimension validity and equilibrium pass; one plausibility warning on the axial field ('larger than the total applied load, check the units') leads to fixing kip to kN.
5. Open the checklist, accept the pledge, submit; the receipt shows the hashes; formative task shows deterministic feedback immediately labeled AI-provisional (WS-09).

Failure paths:
- Roller orientation leaves a mechanism (roller-Z instead of roller-X): diagnostics show ENG-SINGULAR naming N-B and the free DOF with 'Make it roller-X' as a fix; the lesson checkpoint stays 'not yet' with the author hint after two failures.
- Learner types the load as 10 kN/m but the task is in kip/ft: the unit input converts and shows the SI value; a plausibility band warning appears only if the magnitude is out of band.
- Field entered as a moment unit in a force field: dimension error, not submittable, explained inline.
- Browser crash mid-task: reload restores the draft within 5 s, including the entered values (local autosave ≤ 2 s).

## Flow: Design iteration loop on a 3D steel frame (Design, T4, coach profile) (Learner on a lecture-hall laptop (1366x768))

1. Open the task; starter geometry, supports and derived loads are locked; sections are the design variable; color-by Utilization is on by default per the workspace preset (WS-01).
2. Select the three beams in the Model tab filter, pick W12x26 from the section picker (allow-list W8-W14) and assign; utilization repaints within 300 ms with the envelope legend naming the governing combination (WS-03, WS-05).
3. Hover B3 (0.91, F2.2 LTB, C4); open its probe; check Lb in Properties against the modeled braces; set Lb = 3.00 m; DCR drops to 0.71.
4. Open Loads: the combination list flags '0.9D + 1.0W(−X) missing' with Add; the snow case is empty with the expected pf shown (coach level); add loads (WS-04).
5. Run the self-check: two strength fails become zero after resizing; stability advisory B2 = 1.12 remains with 'include second-order effects' guidance (R4: B1/B2 route); mass 1.86 t shown, benchmark hidden (WS-07).
6. Capture the two required snapshots via 'Set view to requirement' (WS-13); write the memo sections; submit with the pledge; summative task shows 'provisional until reviewed'.

Failure paths:
- Model reaches the task cap (Members 300/300) while adding bracing: Member tool disables with the reason; diagnostics suggest merging duplicate nodes/members; import of a bracing pattern is rejected before applying with the count.
- A node drag snaps onto an existing node: merge chooser; accidental merge is one Undo.
- Solve exceeds the Tier M budget three times: the chip offers Manual; the learner keeps Live debounced instead.
- Required snapshot captured with the wrong combination: checklist marks it unmet with the expected and actual labels; recapture.
- Server save fails (offline): banner; work continues; on reconnect a conflict from another tab offers Keep mine / Load theirs / Compare.

## Flow: Instability recovery (mechanism and unconnected node) (Learner building a truss)

1. Learner deletes a diagonal; analysis is blocked; the chip reads 'Stale: 1 error blocks analysis' and the Diagnostics dock opens the first time (WS-06).
2. Row ENG-SINGULAR names node N4 and the DOF; Animate shows the quadrilateral racking; Explain opens the help page for mechanisms.
3. Learner uses the fix 'Add member N2-N4' suggestion (or draws the diagonal with the Member tool; snap tooltip confirms both ends on existing nodes).
4. A second warning VAL-DUP-NODE shows N9 0.6 mm from N4; Merge fixes it in one undoable step; the chip returns to Fresh; overlays recolor.

Failure paths:
- Learner 'fixes' instability by adding a fixed support everywhere: analysis runs but the self-check later raises an over-restraint finding (ERR-02) with the rule; in Diagnose tasks it would be collateral.
- Singular detected only during factorization (pivot) in a large model: same card, cause 'released member chain' with the chain listed.
- Reduced-motion user: Animate shows a static exaggerated pose with arrows instead of looping.

## Flow: Keyboard-only and screen-reader completion via parity mode (Learner using NVDA on a lab PC without WebGL2)

1. The workspace route detects no WebGL2 and shows the graphics-unsupported page; 'Continue with tables' opens WS-11 with a banner and the system-check link.
2. Learner reads the textual summary of the starter model, opens Nodes, adds rows with Ctrl+Enter typing coordinates, then Members by node ids, Supports via the per-DOF select, Loads with case and values; the command line is used for 'run'.
3. The summary updates: max displacement, governing member and utilization, equilibrium; the Utilization table sorts by DCR; a deflection ratio exceeding L/360 is read from the Deflection ratios table.
4. Deliverables are completed from the navigator (same components); self-check runs with Ctrl+Shift+C and its result is announced; submit from the checklist.

Failure paths:
- Entering a member between a node id that does not exist: inline cell error 'N12 does not exist' and the row is not committed.
- Cap exceeded by CSV import: rejected with the count before applying.
- Hash parity: CI builds the benchmark truss both ways and asserts equal hashes; a mismatch is a release blocker, not a learner error.

## Flow: Exam session (summative design exam with analysis-only results) (Learner in a proctored lecture hall; instructor previews beforehand)

1. Instructor previews as learner in exam mode and confirms the banner, off badges and results visibility.
2. Learner opens the task at 09:00; the pre-start screen lists window, accommodations (180 min), disabled features, recorded fields, policy and pledge; Start creates the single session (WS-10).
3. Workspace shows the banner with the countdown; utilization and self-check are OFF; deformed shape and diagrams are available; the learner designs, captures required snapshots into the bundle and submits at 10:50 with the pledge.
4. After close, feedback stays withheld until the profile's reveal time; the attestation is green.

Failure paths:
- Learner opens the exam on a second device: takeover screen; taking over ends the first session within 5 s and is recorded (amber).
- Network loss for 60 s: session kept; countdown resyncs on reconnect.
- Learner does not submit before close: auto-submit of the last accepted draft with pledge_status not_captured; ops after close rejected with the close time.
- Platform served the checks artifact by misconfiguration: platform_fault signal; attestation attributes to the platform, never to the learner.

## Flow: Feedback to resubmission (Learner after instructor release (summative) or immediately (formative))

1. Open the released feedback from the task page; WS-09 loads the graded snapshot read-only with the overlay and provenance strip ('Reviewed by Dr. Lee').
2. Click the B3 fail item: camera frames B3, case switches to C4, overlay to utilization, probe opens with Lb and the clause; Why opens the F2.2 page with the learner's values.
3. Toggle Compare: Working to see the 14 changes made since; two items are marked 'changed since graded'.
4. Open the working copy with the Feedback tab still available; fix Lb and the missing combination; run the self-check; resubmit (2 attempts left).

Failure paths:
- Entity deleted in the working copy: item shows 'changed since graded - view as of submission' and jumps back to the snapshot state.
- Judged stage pending (LLM outage): narrative items 'pending', deterministic items complete; no zero scores.
- Integrity hold: 'Under review' message identical to any held grade; no reason shown unless a case notifies the learner.

## Flow: Check task: plan-check findings with overlays off (Learner (T3 steel member design course))

1. Open the Check task: the given design is locked; color-by has no Utilization ('off for this task ⓘ'); Results show forces and deflections only.
2. Read the Given-data sheet from the task page; analyze; open Deliverables > Findings; add an entry for B1: pick member from the list, choose F-LTB from the catalog (filtered to W-shapes), enter demand and capacity with units, ratio auto-computes, choose clause F2.2 by its paraphrased title, write the reason.
3. Scope coverage shows 7 of 9; the self-check (level 2) reports 'coverage incomplete: B2, B3' and 'model unchanged ✓'.
4. Complete all entries, submit.

Failure paths:
- Verdict PASS with demand above capacity: inconsistency flag blocks submission until fixed.
- Learner edits the given model: Findings panel warns 'the given design has changed' and the self-check reports 'model changed'; the model is locked so this only occurs on unlocked fields the author allowed.
- Clause not applicable to the limit state: inline error naming the applicable clauses.

## Flow: Diagnose task: find and fix seeded errors without collateral changes (Learner (T1-T2, scope-locked))

1. Open the Diagnose task; the brief says two seeded errors; only supports and loads are editable (scope-locked).
2. Diagnostics already show a plausibility notice on L4 (magnitude out of band); the learner reads the Given-data sheet, compares, fixes L4 (kN/m instead of N/m) and reports it in Found errors with the category 'loads' (status flips to fixed within 200 ms).
3. Noticing a roller at N1 where the sheet says pin, the learner changes it; the workspace suggests 'Add this change as a finding' and the learner does.
4. Changes since start shows both changes as reported; self-check (level 2) says '2 of 2 correctly found'; submit.

Failure paths:
- Learner changes M3's section (if the task were open scope): the change list marks it unreported with Revert; the self-check warns about unreported changes before the grader applies a collateral penalty.
- Entity referenced by a finding is deleted: 'entity no longer exists' on the row.

## Flow: Degraded conditions: offline, context loss, solver failure, report a problem (Any workspace user)

1. Connectivity drops: offline banner within 5 s; edits and live analysis continue; autosave local; the self-check count will sync later.
2. GPU context lost: toast, scene restored within 2 s without data loss.
3. Solver panic on a pathological model: results withheld with 'Solver error - Report a problem'; the Help panel's Report a problem opens the consent list (canonical model and hash, op-log tail, GPU data, engine hash, pins, session id, error stacks, optional screenshot, description; memo excluded unless ticked) and files a ticket with an id.

Failure paths:
- Reconnect finds a newer server version from another tab: per-object conflict dialog with Keep mine / Load theirs / Compare and restore-previous.
- Repeated context loss: the workspace offers the Tables layout.
- Exam mode: report a problem works but excludes restricted artifacts; nothing is downloadable.

## Components

| component | purpose | variants and states |
|---|---|---|
| WorkspaceShell | Fixed layout (header, tool rail, canvas, right rail, bottom dock, status bar) with profile-driven visibility, read-only and exam variants, responsive drawers below 1280 px. | layout canvas / tables / both; roles learner / author / inspect / support-replay / preview; profile coach / summative / exam; read-only; offline; below-min-viewport; context-lost |
| ToolRail | Tool-mode state machine entry (Select, Node, Member, Support, Load, Assign, Transform, Probe) with help ids and task-preset restrictions. | active tool; disabled with reason (task preset, cap reached, exam, read-only); 2D variant hides out-of-plane tools |
| CanvasViewport | WebGL2 scene with instanced glyphs, merged member geometry, overlays in separate groups, BVH picking, working-plane grid, locked-element styling, on-demand frame loop. | 3D / 2D-locked; display centerline / solid; label auto-declutter above 500; focusable with keyboard camera; stale overlay desaturation; context loss recovery |
| NavigationCube and AxisTriad | Orientation and click-to-view in 3D (Z-up); simple XZ axis indicator in 2D. | ortho / perspective; 2D indicator; reduced-motion instant transitions |
| CaseSwitcherPill | Persistent selector of the displayed case, combination (with formula) or envelope; repaints cached results without re-solving. | case / combination / envelope / service; governing-combination label in envelope; disabled when results are blocked or hidden |
| AnalysisStatusChip | Single source of truth for Fresh / Running / Stale (recomputing or blocked) / Paused / Failed with timing and tier; opens the timing popover or the diagnostics dock. | fresh, running, stale-recomputing, stale-blocked(n errors), paused-manual, failed, validity-only (results hidden by profile) |
| LiveModeMenu | Live / Live debounced / Manual with Run; auto-suggest Manual after repeated over-budget solves. | live, debounced 300 ms, manual; suggestion toast |
| SizeCapMeter | Members (and DOF when set) used vs the task cap, identical rule to the server; disables creation tools at 100%. | normal, 90% amber, 100% red with reason tooltip; 'What counts?' popover |
| SnapTooltip and SnapPriorityIndicator | Names the snap type and shows world coordinates, length and angle before the click; status-bar snap state with priority order. | node, member end, midpoint, grid intersection, intersection, perpendicular, grid line, increment; snap off (Shift); cycling (Ctrl) |
| TransformGizmo with HUD | Move (and rotate about an axis) with axis/plane handles, axis locks, numeric delta entry, snapping of the dragged node, debounced live results. | 3D / 2D in-plane; axis locked; typing delta; touch-enlarged (v1.x) |
| PropertyPanel | Contextual editing of the selection with mixed-value 'varies', unit and expression inputs, inline validation; the keyboard path for all assignments. | node, member, support, load, mixed selection; 2D variant; locked (read-only with reason); DofEditor with indeterminate state |
| SectionPicker | Search/filter catalog sections (AISC v16 W/HSS/C/L/WT/pipe at MVP) with properties and the task allow-list; favorites per task. | inline popover or rail overlay; disallowed rows greyed; empty search; assign to N |
| ModelTree (EntityList) | Grouped entity list with type-ahead by id or label, filter bar, isolate/hide, named groups for rubric references; selection sync. | filter active; hidden entities count; group editing; virtualized for Tier M |
| LoadCasePanel and ApplyLoadDialog | Cases with type and provenance, loads table, combinations with code source and presence checks, apply-load form with live preview. | derived / given / learner cases; manual-loads task; missing combination rows; panel distribution inspection; exam/Check restrictions |
| LoadSourceExplorer | Trace a load to its scenario parameter, derivation and clause with a link to the generated explanation page. | full chain (coach), inputs-only (hidden expectations), unavailable (exam) |
| ResultOverlayControls | Toggles and controls for deformed shape, diagrams, reactions, utilization (bands, min/max, pattern mode), animation and station count. | per profile live_results full / deformed_only / none; code_check_overlays none hides utilization; reduced motion disables animation |
| ResultLegend | Always-on legend for any drawn overlay: quantity, units, case/combination, scale factor, sign convention, band thresholds, above-1.0 style, freshness badge; rendered into screenshots. | utilization banded / smooth / pattern; diagram; deformed; envelope with governing label; stale / graded-snapshot badges |
| ProbeCard | Pinned readout that follows an entity and updates with the case; up to 10. | hover readout (transient), pinned, feedback-opened, limit reached |
| ResultsTable | Sortable native tables (members, nodes, reactions, deflection ratios, equilibrium) with units in headers, two-way selection sync and CSV export with disclaimer and stamp. | per case / envelope; DCR columns hidden by profile; export disabled in exam; virtualized |
| DiagnosticsList and DiagnosticEntry | Grouped, stable issue list with code, entity labels, cause, Show, Fix actions, Animate (mechanism), Explain. | error / warning / notice; cap entries; engine warnings (ill-conditioned, residual); empty |
| MechanismCard | Plain-language unstable-structure statement with the free DOF, likely cause and null-space animation controls. | pre-check vs factorization-detected; playing / stopped; reduced-motion static pose |
| EvidenceCard | One rendering of a GradeEvidence record used by the self-check, diagnostics summaries and released feedback: status, subject, metric vs limit, governing combination, clause with paraphrased title, actions. | pass / warn / fail / error / not applicable; severity critical / major / minor / advisory; disclosure-level variants (counts-only, per-item, with hint tiers); changed-since-graded |
| SelfCheckPanel | Run and present the client checks artifact per archetype with remaining count and the parity statement. | never run, running, up to date, outdated, blocked, capped, off (exam), disclosure 0-4, archetype variants |
| DeliverablesDock (AnswerField, FindingRow, FoundErrorRow, ChangeReviewRow, MemoEditor embed, SnapshotRequirementRow, SubmissionChecklist) | Archetype-specific deliverable capture with unit-aware inputs, entity binding and live validation; checklist mirroring server validators; submit dialog and receipt. | Analyze / Check / Diagnose / Design / Optimize tab sets; field states (empty, entered, dimension error, plausibility warning, not found, filled from results, locked); coverage; inconsistency; hard/soft required; attempts; late preview; pledge; receipt |
| FeedbackOverlay and FeedbackItem | Severity outlines on the canvas and the navigable feedback list bound to evidence ids with fly-to, case switch, overlay switch and probe. | fail / warn / note; AI-provisional / reviewed / pending judged; submitted vs working compare with changed markers; reveal-withheld |
| ExamBanner and OffBadge | Non-dismissable exam signaling with countdown and policy; 'OFF' badges with reasons on disabled tools, tabs and exports. | active, under 5 min text, reconnecting, taken over, closed; badge reasons: exam, task profile, cap, read-only |
| TabularEditorGrid and TextualSummary | Editable entity tables and result tables with keyboard semantics and the generated textual model/result summary; the parity path. | forced (no WebGL), chosen, both; locked rows; inline cell errors; virtualized; summary blocked-state variant |
| CommandPalette and CommandLine | Fuzzy command search plus command-line grammar with a parsed preview, executing on the shared command bus. | empty, matching, parse error, ambiguous entity, disabled command with reason; shortcut sheet |
| SnapshotCaptureDialog and ExportMenu | Deterministic PNG with legend, title block and sidecar; requirement-driven view setup; exports with the D1 disclaimer and provenance stamp. | for requirement / free; met / unmet; stale-blocked; exam (attach only); share blocked before close |
| OfflineBanner, ConflictDialog, ContextLossToast, ToastWithUndo | Degraded-condition messaging and reversible notifications (merge, fixes, lesson assisted steps). | offline, reconnecting, conflict per object, context lost / restored, undoable toast (8 s, focusable) |
| GuidedLessonStepper | Step list with instruction, highlight target, checkpoint status, tiered hints and 'Show me' (assisted) for guided lessons and onboarding. | required / optional steps; not yet / passed / failed with hint; skip-ahead allowed; parity-mode variant with 'Open in table' |
| HelpPanel and ReportProblemDialog | Contextual help for the focused tool or check/clause id with the learner's own values; consented diagnostic bundle ticketing. | tool page, check page, clause page with values, search; exam-restricted pages; consent checklist with items unticked by default for memo |
| DisclaimerBadge and RecordsNoticeLink | Persistent D1 'Educational use only' badge opening the full text; link to 'What Bridle records in this task'. | always present; sandbox watermark variant on exports |

## Content and copy

- Voice: plain, specific, engineer-literate; sentences name the entity by label ('member B3', 'node N4'), the quantity with units and the case ('under C4'); no exclamation marks, no blame ('check the units' not 'you entered the wrong units').
- Analysis state words are fixed: Fresh, Running ('Solving…'), Stale (with the reason: 'recomputing' or 'N errors block analysis'), Paused ('Run Ctrl+Enter'), Failed ('Solver error - Report a problem'), Validity only (results hidden by the profile).
- Diagnostic severity words: Error (blocks analysis), Warning, Notice. Grader overlay severity words: Fail, Warning, Note. Evidence severity words: Critical, Major, Minor, Advisory. Never mix the sets on one surface.
- Validity messages follow 'what · where · likely cause · next step': 'Unstable: node N4 can rotate about Y with nothing resisting it. Likely cause: all 3 members at N4 are truss members. Add a support at N4 or make one member a frame member.' Singular matrices are never shown as 'singular matrix' or 'solver error' to learners.
- Units: display per task preset (SI kN, m, mm, MPa or US kip, ft, in, ksi) with precision per quantity (length m 3 decimals, mm and in 1 decimal, forces 1 decimal, moments 1 decimal, stresses 1 decimal, ratios 2 decimals, deflection ratios as '1/412', drift as 'h/520'); every number carries its unit; inputs accept any compatible unit and show the conversion on hover; internal SI is never shown unless asked.
- Combinations are written as formulas with the code source: 'C4 1.2D + 1.0W(+X) + L + 0.5S · ASCE 7-22 §2.3.1'; directions in parentheses; service combinations prefixed 'Service:'.
- Clause references are 'AISC 360-22 F2.2 (lateral-torsional buckling)' - code, edition, clause id and a Bridle-written paraphrased title; never verbatim standard text, tables or figures; 'Why?' always opens the explanation with the learner's own values.
- Legends always state: quantity and check type, units, case or combination (and governing combination in envelope), scale factor ('×25' or 'scale 0.08 × diagonal'), sign convention ('sagging + drawn on tension side'), band thresholds, and 'above 1.0: hatched red'.
- Locked and restricted states state the owner of the restriction: 'Locked by the task', 'Not available in this task', 'Off in exam mode', 'Task cap reached (300 members)', 'Share links are available after Nov 5, 23:59'.
- Self-check framing: 'Runs the same checks the grader runs (checks 1.4.0 · US pack). Shows pass or fail per item. Does not show scores, the benchmark, or judged criteria.' plus 'Evidence ids will match your grade exactly if the model is unchanged.' At disclosure level 2: '2 of 16 checks fail'; at level 1: 'incomplete' / 'complete' only.
- Plausibility hints never reveal correctness: 'This value is larger than the total applied load (96.0 kN). Check the units.' and 'enter at least 3 significant figures'; dimension errors say which dimension the field needs.
- AI provenance labels are verbatim from DIS-01/PRD-02: 'AI-generated feedback - not professional engineering advice' with 'Reviewed by <name>, <date>' or 'Not yet reviewed by an instructor'; formative tasks use 'AI-provisional - not yet reviewed by an instructor'. Self-check footer: 'Automated check - not professional engineering advice.'
- The D1 disclaimer string is centrally versioned and appears as the status-bar badge text 'Educational use only' expanding to 'Educational use only. Not for construction, permitting, or professional engineering use. Results are not a substitute for analysis and design by a licensed engineer.'; exports embed it; cost outputs add 'Illustrative educational unit costs; not for estimating or bidding'. No 'sealed', 'stamped', 'engineer of record' or 'PE' wording anywhere in the UI.
- Merge and transform toasts are past-tense with ids and an Undo: 'Merged N9 into N4 (coincident within 1 mm)'; lesson assisted steps are labeled 'Lesson step 3 (assisted)' in History.
- Exam copy is generated from the profile flags, never hand-written: lists use 'Turned off during the exam:', 'Results you can see:', 'Recorded:' with the explicit exclusions 'no camera, no keystrokes'; the close message states the server time and the pledge status.
- Load provenance words: derived (from the scenario), given (by the task), learner (entered by you); self-weight row reads 'auto · sections × density (not editable)'.
- Size-cap and performance copy name numbers: 'Members 288/300 - 12 left before this task's cap', 'Analysis took 420 ms (budget 300 ms) three times - switch to manual?'.
- Keyboard hints are shown inline on prompts and tooltips using platform keys (Cmd on macOS, Ctrl elsewhere); tool prompts list Esc, Enter, Shift and Ctrl behaviors in that order.
- Empty states give the next action: 'Press N to place a node, or Ctrl+K and type node 0,0,0'; 'No findings yet - add one per member and limit state in scope'.
- Timestamps show the offering timezone ('Nov 5, 23:59 America/Chicago'); hashes are shown as the first 4 and last 2 hex characters ('a81f…c2') with copy-on-click for the full value.

## Open questions

- Y-up display preference (view-only, never in the model) in MVP or v1.x? The requirements allow it as a view preference; recommended v1.x to keep the navigation cube and the 2D plane unambiguous for the pilot.
- Default sign convention for learner-reported moments and shears in Report values (textbook sagging-positive with engine mapping, as the deliverables doc recommends) and whether the diagram convention toggle is per course or per task.
- Is the Measure tool (EDIT-05, should) wanted in MVP for checking geometry against drawings? The tool rail reserves a slot; recommended v1.x.
- Should live utilization be computed for the envelope of all strength combinations on every edit, or only the active combination with the envelope on demand, for Tier M models (cost vs the 300 ms budget)?
- Diagnostics placement: bottom dock (proposed) versus a right-rail tab; validate with instructors whether an auto-opening dock on the first error is acceptable in lecture-hall use.
- Hint UI location in MVP (self-check hint tiers at disclosure level 4 vs a Hints tab) given TB-12 is reduced to on-request and after-N-failures hints.
- Exam default results visibility per archetype (analysis-only for Analyze/Check, none for Design) needs the pilot institution's confirmation; the pre-start screen renders whatever is set.
- Tablet scope for v1.x (view/probe/feedback only vs full modeling with touch handles) affects whether the tool rail and gizmo get a touch variant now.
- Should the results table live in the bottom dock only, or also be openable as a right-rail tab for narrow screens where the dock steals canvas height?
- Which named views and view presets ship by default per task template (author workspace presets), and whether learners' named views persist across attempts.
- Team header slot (ownership badge, lock state, presence) is reserved per GAP6; confirm the badge appears for single-learner documents ('Personal') or is hidden until teams ship.

## Risks

- Canvas accessibility becomes a procurement blocker if the parity layout lags the canvas in coverage; mitigation: the command bus and tables are built first and the hash-equality e2e (canvas vs tables) is a release gate.
- Live analysis stutters on Tier M frames with all overlays; mitigation: worker solve with sequence numbers and cancellation, 300 ms debounce for M, dirty-tracked scene updates, the status chip's Manual suggestion, CI frame-time benchmarks on reference scenes.
- Clutter at 1280x720 (six rail tabs, dock, status bar chips) crowds the canvas; mitigation: fixed widths with the 60% canvas rule, collapsible rail and dock, status-bar chips truncating to icons with tooltips at narrow widths, usability test on a 1366x768 laptop before the pilot.
- Utilization and diagrams mislead through sign or scale confusion; mitigation: legend always shows convention, case and scale, the true deformation factor is displayed, instructor-configurable textbook convention defaults.
- Color-only encoding fails color-vision-deficient users and greyscale printouts; mitigation: validated sequential palette, hatched above-1.0, pattern mode, numeric legend, text equivalents.
- Overlays leak answer keys in Check or Analyze tasks (utilization reveals the check key; engine values defeat hand-calculation intent); mitigation: archetype-aware profile defaults, publish-gate override with reason, 'Off for this task' badges, effective profile pinned per submission.
- Exam restrictions implemented only client-side would be bypassable; mitigation: data-bearing artifacts and endpoints withheld server-side, served artifacts recorded in the attestation, client build hash recorded.
- The command-line grammar is ambiguous across unit systems and 2D/3D coordinate forms; mitigation: parsed preview before Enter, explicit unit override, 2D omission rules, cross-language grammar test vectors.
- Learners over-restrain models to 'fix' instability, hiding errors; mitigation: mechanism animation and cause-first messages, ERR-02 over-restraint findings in the self-check, lesson checkpoints that test support types.
- Self-check and grader diverge after an engine or checks upgrade mid-offering; mitigation: the panel states the artifact versions, evidence parity is asserted in CI, and a pinset-change banner appears when the task's pins change.
- Probe cards, labels and toasts pile up on dense models; mitigation: 10-probe limit, label declutter above 500, 8 s toast expiry with a History record, isolate/hide tools.
- Copy drift between client validation messages and server messages (same rule, different words); mitigation: one message-key catalog rendered by both, generated help pages, snapshot tests.
