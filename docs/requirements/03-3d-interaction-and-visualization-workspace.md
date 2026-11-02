# 3D interaction and visualization workspace

_Source: requirements discovery workflow `wf_6281c128-0bb` (domain agent), 2026-11-03. 46 requirements: 37 must (MVP), 8 should (v1.x), 1 could (later)._

## Summary

The workspace is the product: a browser-native structural modeling environment where every edit (node drag, section swap, load change) re-runs analysis and repaints results within a perceptible-as-live budget. The design implication is a strict split between an immutable, canonically serializable model document (the thing that is graded) and a derived render/scene layer (instanced glyphs, merged member geometry, result overlays) that is rebuilt incrementally from it. Modeling must solve the classic 3D-pointer ambiguity with working planes, grid snapping and numeric coordinate entry, and must expose a complete keyboard/command path so the canvas is accessible and testable. Result visualization follows established structural-software conventions (deformed shape with auto scale, N/V/M diagrams in member local axes, utilization color maps, reaction arrows, mode shapes, per-case switching) and adds a grader feedback overlay that highlights failing members with reasons. Rendering targets WebGL2 as the baseline with WebGPU as progressive enhancement; analysis runs off the main thread (Worker/WASM) so interaction never blocks. An intro-friendly 2D planar mode, deterministic JSON serialization with model hashing for submissions, and performance tiers (S: 200 members at 60 fps up to L: 10k members / 50k shell elements at 30 fps) bound the MVP and set the growth path for DXF/IFC/SAF interchange.

## Must (MVP)

### VIEW-01 Camera navigation (orbit, pan, zoom) with device-aware mappings

The viewport supports orbit, pan, zoom and focus-on-selection with mouse, trackpad and touch. Orbit pivots about the selection centroid (or cursor hit point when nothing is selected), zoom is cursor-anchored, and a rotate-to-view-from-cursor option is available. Navigation never changes model state and is excluded from undo history.

**Why:** Navigation is the most frequent interaction; wrong pivot/zoom anchors make 3D editing feel broken and are the top complaint in CAD tools.

**Acceptance:**
- Mouse: LMB orbit, MMB/RMB pan, wheel zoom (cursor-anchored); trackpad: two-finger pan, pinch zoom, Alt+drag orbit; touch: one-finger orbit, two-finger pan/zoom
- Zoom to selection (key F) frames the selection with 10% margin in under 300 ms with eased motion (instant when reduced-motion is set)
- Camera state (position, target, projection, up vector) is serialized separately from the model and never appears in model hash

### VIEW-02 View presets, projection toggle and named views

Provide Top/Bottom/Front/Back/Left/Right/Isometric presets, orthographic and perspective projection toggle, fit-all, and user-named saved views stored with the document (not in the graded model). A navigation cube or axis triad shows orientation and is clickable.

**Why:** Structural engineers think in plan/elevation; ortho views with grid are how they verify geometry and how instructors screenshot tasks.

**Acceptance:**
- Keyboard 1-7 (or numpad) select presets; key 5 toggles ortho/perspective
- Switching projection preserves the framed extents (no visual jump larger than 5% of screen)
- Named views persist and are restorable, including section-cut and visibility state

### VIEW-04 2D planar mode for introductory tasks

A task can lock the workspace to a plane (XZ or XY) with an orthographic camera, 3 DOF per node (two translations, one rotation), in-plane loads only, and a simplified toolbar. The same document model is used (out-of-plane coordinate fixed at 0), so 2D tasks are graded by the same pipeline and can be opened in 3D later.

**Why:** Beams, trusses and plane frames are the first third of any structural curriculum; forcing 3D navigation on them hurts learning and completion rates.

**Acceptance:**
- In 2D mode orbit is disabled, pan/zoom remain, and the UI hides out-of-plane DOFs, loads and section properties
- A 2D model serializes with mode:'planar-xz' (or xy) and validates that all nodes have the fixed coordinate equal to 0
- Instructor can convert a 2D task template to 3D; the reverse is blocked if out-of-plane geometry exists

### VIEW-05 Display styles and visibility toggles

Toggle rendering of members as centerlines or extruded true sections, node dots, member/node labels, local axes triads, support glyphs, load arrows with magnitudes, section/material color coding, and plate thickness. Toggles are per-view, saved with named views, and have shortcuts.

**Why:** Engineers switch constantly between a clean centerline view for editing and an extruded view for checking orientation and clashes; label clutter must be controllable.

**Acceptance:**
- Extruded-section view renders the true profile (I, HSS, rectangular, circular) with the member orientation angle applied
- Label visibility auto-declutters above 500 visible labels (show on hover/selection only) with a user override
- Color-by: none, section, material, group, utilization (when results exist)

### VIEW-06 Rendering backend with WebGL2 baseline and WebGPU enhancement

The workspace runs on WebGL2 in all supported browsers and opportunistically uses WebGPU when available and verified stable, with identical visual output and feature set. Capability detection, GPU/driver blocklist handling and a clear 'graphics not supported' fallback page are required.

**Why:** WebGPU ships in Chrome 113+, Safari 26+ and Firefox 141+ (Windows only) as of late 2026, but coverage is uneven; Three.js recommends WebGPURenderer while WebGL remains maintained, so a dual path is the safe MVP choice.

**Acceptance:**
- Automated visual regression renders the reference scenes on both backends with pixel diff under 1%
- Backend selection is logged in telemetry and can be forced via a URL flag for support
- Context-loss events restore the scene without data loss within 2 s

### MOD-01 Grid systems, working plane and snapping

Users define rectangular grid systems (named gridlines A,B,C / 1,2,3 with spacings, and levels/elevations) and a working plane (XY at elevation, XZ, YZ or custom through three points). All drawing happens on the working plane unless snapping to existing 3D geometry. Snap targets in priority order: node, member end, member midpoint, grid intersection, member intersection, perpendicular, grid line, free with increment snap.

**Why:** Placing points unambiguously with a 2D pointer in 3D is the core usability problem of any 3D modeler; grids and working planes are the proven solution in structural software.

**Acceptance:**
- Snap indicator glyph and tooltip name the snap type and show world coordinates before clicking
- Snap tolerance is 8 px screen-space regardless of zoom; Shift temporarily disables snapping
- Grid definition is stored in the document but excluded from analysis and grader hash

### MOD-02 Node placement, numeric entry and coincident-node merging

Nodes are placed by click on the working plane, by typing absolute or relative coordinates (e.g., '3,0,4' or '@2,0,0'), or by splitting members. Nodes within a configurable merge tolerance (default 1 mm) are merged automatically with a visible notification and undo.

**Why:** Duplicate coincident nodes silently produce disconnected, unstable models; this is the most common student error in FE tools.

**Acceptance:**
- Coordinate input accepts the task's unit system and converts to SI internally
- Merge notification lists merged node IDs and can be reverted with a single undo
- Dragging a node onto another node offers 'merge' vs 'cancel'

### MOD-03 Member drawing with polyline, split, join and orientation

Draw frame/truss members as click-click polylines with Esc to finish; options to auto-split at crossing nodes, auto-split crossing members, join collinear members, and divide a member into N segments. Member local axes and the orientation (beta) angle are visualized and editable.

**Why:** Members are the dominant primitive; split/join behavior determines whether models are analyzable without hidden topology bugs.

**Acceptance:**
- A member cannot have zero length or duplicate an existing member between the same nodes (warning with override to allow double members disabled in MVP)
- Local axis triad shows axis 1 along the member and axis 2/3 after beta rotation; changing beta updates the extruded profile live
- Divide-into-N keeps loads and properties and splits distributed loads correctly

### MOD-05 Supports and springs with standard glyphs

Assign restraints per DOF (Tx,Ty,Tz,Rx,Ry,Rz) with presets (pin, roller in X/Y/Z, fixed, free) and linear springs; render standardized glyphs (triangle pin, circle roller, hatched fixed) oriented to the support direction, scaled in screen space so they stay legible at any zoom.

**Why:** Support conditions define the problem; students must read them at a glance and graders reference them in feedback.

**Acceptance:**
- Preset buttons plus a 6-checkbox DOF editor; mixed selections show indeterminate state
- Glyphs maintain 24-40 px on screen across zoom levels
- Support changes trigger live re-analysis and an instability check (mechanism detection) with a non-blocking warning

### MOD-06 Load application: nodal, member, area, self-weight, thermal

Apply nodal forces/moments, member point and distributed loads (uniform, trapezoidal, in global or local axes, projected or along length), area loads on plates or load panels distributed to members (one-way/two-way), self-weight per case, and uniform temperature change. Each load belongs to a load case; cases combine via task-defined or user-defined combinations.

**Why:** Real-world grading criteria (code load combinations, environmental loads) are impossible without a rich, correctly-typed load model.

**Acceptance:**
- Load arrows scale with magnitude relative to the max in the active case and show value labels on hover or always (toggle)
- A distributed load edited numerically updates the arrow fan live; local-axis loads rotate with member beta
- Load panels (one-way/two-way) show tributary distribution lines and the resulting member loads can be inspected

### MOD-07 Section, material, end-release and offset assignment

Assign sections from a library (AISC W/HSS/C/L, European IPE/HEA/HEB, rectangular/circular concrete, timber, user-defined by properties) and materials (steel grades, concrete strengths, timber classes, custom E/G/density/yield) to members; set end releases per DOF (moment, shear, axial, torsion) at i/j ends with circle glyphs; member end offsets/rigid zones are optional.

**Why:** Design optimization tasks are mostly 'pick the right section'; the grader evaluates utilization and economy, which depend on these properties.

**Acceptance:**
- Section picker filters by family/depth/weight and shows A, I, S, Z, r with units; favorites per task
- Release glyphs render at member ends; a fully released truss member shows both ends released
- Changing a section on 500 selected members updates results in under 1 s on Tier M models

### MOD-08 Copy, array, mirror, extrude and replicate

Duplicate selections with linear and radial arrays, mirror about a plane, move/copy by vector, extrude nodes into members and members into plates, and replicate by level. Operations carry loads, supports, releases and properties with per-operation checkboxes.

**Why:** Multi-bay, multi-story and radial structures are impractical to draw element by element; these are table-stakes CAD operations.

**Acceptance:**
- Array dialog previews ghost geometry before committing; commit is a single undo step
- Mirror flips member beta angles and asymmetric sections correctly
- Replicate-by-level merges coincident nodes and reports counts

### MOD-09 Live model validation and diagnostics

The workspace continuously flags unstable/mechanism models, disconnected nodes or sub-structures, members without section/material, unsupported DOFs, zero-length members, duplicated members, and coplanar-load mistakes, with a diagnostics panel whose entries fly-to and select the offending entities.

**Why:** Live analysis will otherwise fail silently or produce singular-matrix errors that students cannot interpret; diagnostics also feed the grader's constructability checks.

**Acceptance:**
- Diagnostics update within 200 ms of an edit and are grouped by severity (error blocks analysis, warning does not)
- Each entry is clickable and highlights entities in a distinct outline color
- Singular stiffness matrix maps to a human message naming the likely free DOF/node

### SEL-01 Selection modes and hover feedback

Click select, Shift-add, Ctrl/Cmd-toggle, window box (left-to-right contains, right-to-left crossing), lasso, double-click to select connected chain, select-all-of-type and 'select similar' (same section/material/group). Hover highlights the candidate entity and shows a compact info tooltip.

**Why:** Every edit starts with selection; precise, predictable selection semantics are the difference between a toy and a tool.

**Acceptance:**
- Entity picking resolves within 16 ms on Tier M models (BVH or GPU id picking)
- Selection count and type breakdown shown in a status bar; Esc clears
- Window vs crossing semantics are visually distinct (solid vs dashed rectangle)

### SEL-02 Selection filters, groups, isolate and hide

A filter bar restricts picking to nodes, members, plates, supports or loads, and by section/material/group/level. Users can isolate the selection, hide/unhide entities, and create named groups that the grader and task author can reference (e.g., 'roof-chords').

**Why:** Dense 3D models require filtering to avoid mis-picks; named groups let task rubrics target subsets.

**Acceptance:**
- Hidden entities remain in analysis and in the serialized model; hidden state is view data only
- Group membership is stored in the model and exported with it
- Filter state is visible in the toolbar and resettable with one click

### EDIT-01 Transform gizmos with constraints and numeric input

Selected nodes/members get a move gizmo with axis and plane handles, optional rotate about an axis, screen-space constraint keys (X/Y/Z lock), snapping during drag, and a numeric input field for exact delta. Dragging a node moves attached members and keeps loads attached; results update live during drag (debounced).

**Why:** 'Full 3D adjustments with results updating' is the strategy promise; direct manipulation with live feedback is the signature experience.

**Acceptance:**
- Drag shows the delta and new coordinates in a HUD; release commits one undo step
- During drag, analysis re-runs at most every 100 ms and the deformed shape overlay follows
- Dragging into a snap target highlights it; dropping onto an existing node offers merge

### EDIT-02 Property panel with multi-select mixed-value editing

A contextual panel shows editable properties of the current selection (coordinates, section, material, beta, releases, restraints, load values, plate thickness). Mixed values across the selection display as 'varies' and typing a value applies to all. Inputs accept units and expressions (e.g., '2*3.5 m').

**Why:** Panel editing is the keyboard-accessible path for every modeling action and the fastest way to apply bulk changes.

**Acceptance:**
- Editing a property re-runs analysis and repaints results within the live budget
- Invalid values are rejected inline with the reason and never leave the model in an invalid state
- Panel is fully operable by keyboard with focus order matching visual order

### EDIT-03 Undo/redo with command history

Every model mutation is a named command; undo/redo stacks hold at least 200 steps, group drag and dialog operations into single steps, and survive page reloads via the local autosave. View changes, selection and display toggles are not undoable.

**Why:** Experimentation (try a section, see utilization, revert) is the learning loop; unreliable undo kills confidence.

**Acceptance:**
- Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z; history panel lists commands with timestamps
- Undo after a merge-nodes operation restores both nodes and all attachments
- Undo stack memory is bounded (structural sharing or diff-based) to under 50 MB on Tier L models

### EDIT-04 Keyboard shortcuts and command palette

All tools and view operations have shortcuts (customizable, with a printable cheat sheet) and are discoverable through a command palette (Ctrl/Cmd+K) with fuzzy search that also accepts coordinate and command-line style input (e.g., 'node 0,0,3', 'load member 12 -10 kN/m').

**Why:** Power users and accessibility both depend on a keyboard path; the command line is also the easiest surface for automated tests and tutorials.

**Acceptance:**
- Every toolbar action is reachable via the palette and has a shortcut hint
- Shortcuts do not conflict with browser defaults on macOS/Windows/Linux and respect text-input focus
- Palette commands are logged as the same commands as UI actions (single command bus)

### EDIT-06 Live analysis loop with staleness indicator

Every committed change (and debounced drag) triggers analysis for the active load case/combination off the main thread; the UI shows a stale/running/fresh indicator, keeps the last valid results dimmed while recomputing, and lets users pause live mode for large models and run manually.

**Why:** This is the 'Dedicated Simulation' promise; it must be reliable and must never freeze the canvas.

**Acceptance:**
- Tier S models show fresh results within 150 ms of a commit; Tier M within 1 s; Tier L in manual mode with progress
- Analysis runs in a Web Worker (WASM solver) and can be cancelled when a newer edit arrives
- Result overlays are visibly marked stale (desaturated + badge) within one frame of an edit

### RES-01 Deformed shape with scale slider, animation and ghost

Display the deformed shape for the active case with an auto scale (max displacement rendered as 5% of model bounding diagonal by default), a logarithmic scale slider, numeric scale entry, undeformed ghost outline, and a looped sinusoidal animation (0 to +1 or -1 to +1) with play/pause and speed.

**Why:** The deformed shape is the first thing engineers look at to sanity-check a model; animation reveals mechanism-like behavior.

**Acceptance:**
- Member deflection uses cubic interpolation from end displacements and rotations (not straight lines) with at least 8 stations
- Slider range covers 0.01x to 100x auto scale; current true scale factor is displayed
- Animation stops automatically when reduced-motion is enabled and shows static max instead

### RES-02 Member internal force diagrams (N, Vy, Vz, My, Mz, T)

Draw axial, shear, moment and torsion diagrams as filled polygons perpendicular to each member in its local axes with sign convention shown in the legend, labeled min/max values, user-selectable station count (default 9, up to 21), diagram scale slider, and a per-member detail popup with tabulated values.

**Why:** Diagrams are the canonical representation taught in every structures course and are what the grader's serviceability/strength checks are derived from.

**Acceptance:**
- Diagrams flip correctly when member beta changes and remain on the correct side for the stated sign convention
- Values match the solver's station results to 4 significant figures
- Showing all six diagrams on a Tier M model keeps interaction above 30 fps

### RES-03 Stress and utilization color maps with legends

Color members by code utilization ratio (combined, flexural, shear, axial) and plates by contour quantities (von Mises, Sxx/Syy, Mxx/Myy, deflection) with banded or smooth color-vision-safe legends, user-defined min/max, a hard 'over 1.0' highlight color, and hover readout. Legends render in screenshots.

**Why:** Utilization maps are the fastest route to design optimization and are the primary visual the AI grader will reference.

**Acceptance:**
- Default palette is sequential and distinguishable under deuteranopia (validated), with ratio above 1.0 rendered in a distinct hatched/red style
- Legend shows units, case name and thresholds; changing min/max repaints within one frame
- Plate contours render per element or nodally averaged (toggle)

### RES-04 Reaction arrows and equilibrium summary

Show support reactions as force and moment arrows with magnitude labels scaled relative to the max reaction, plus an equilibrium panel listing sum of applied loads vs sum of reactions per global axis for the active case.

**Why:** Equilibrium checks are how students verify their model and how graders detect load application mistakes.

**Acceptance:**
- Arrows are screen-space-scaled with a minimum legible length and never overlap support glyphs
- Equilibrium residual is highlighted if it exceeds 0.1% of applied load
- Reaction values are exportable to CSV with the case name

### RES-06 Load case, combination and envelope switching

A persistent switcher selects the displayed load case or combination (with the combination formula shown, e.g., 1.2D+1.6L+0.5S), plus envelope mode for min/max across a set. Switching repaints all result overlays and diagrams without re-running analysis if results are cached.

**Why:** Code compliance is judged per combination; learners must see which combination governs.

**Acceptance:**
- Switching a case repaints within 100 ms for cached results
- Envelope diagrams show both min and max curves with governing-case tooltip
- The active case is stored in view state and in screenshots' metadata

### RES-07 Hover readouts, pinned probes and result tables

Hovering any entity shows the key result for the active overlay (displacement, force at station, utilization); clicking with the probe tool pins a readout card that follows the entity. A dockable results table lists per-member/per-node values, is sortable, syncs with selection both ways, and exports CSV.

**Why:** Numbers back the pictures; graders cite specific values, and students must find them quickly.

**Acceptance:**
- Probe cards show up to 10 simultaneously and update when the case changes
- Clicking a table row selects and frames the entity; selecting in the viewport highlights the row
- Readouts respect the task unit system and precision

### RES-08 Grader feedback overlay with failing-member highlighting

After AI grading, the workspace renders a feedback layer: failing or flagged members, nodes and supports are outlined and listed with reason tags (e.g., 'Flexural utilization 1.23 under 1.2D+1.6L', 'Deflection L/240 exceeded', 'Unbraced length'), each item flies to the entity and switches to the governing case/overlay. Feedback is read-only and versioned per submission.

**Why:** Closing the loop between the grader's real-world criteria and the geometry is the product's differentiator.

**Acceptance:**
- Feedback entities are referenced by stable IDs and the overlay degrades gracefully if the model changed after submission (shows 'changed since graded')
- Feedback items have severity (fail, warn, note) with distinct outline styles and screen-reader text
- The overlay can be toggled and is captured in screenshots when enabled

### PERF-01 Performance tiers and frame-rate budgets

The workspace meets defined budgets by model tier: S (200 members) 60 fps on integrated graphics; M (2,000 members or 5,000 shell elements) 60 fps interaction / 30 fps with all overlays; L (10,000 members or 50,000 shell elements) 30 fps navigation with labels auto-declutter and live mode paused. Budgets are enforced by automated benchmarks on reference scenes.

**Why:** Explicit tiers let task authors stay within a known envelope and keep performance regressions visible.

**Acceptance:**
- CI runs reference scenes headlessly and fails if median frame time exceeds budget by 20%
- Element counts near a tier limit show a warning in the diagnostics panel
- Memory stays under 1.5 GB tab heap on Tier L

### PERF-02 Instanced and batched rendering with level of detail

Nodes, supports, releases and load glyphs render via instancing; members render as a merged line geometry in centerline mode and as instanced extruded profiles per section type in solid mode; far-away members fall back to lines. Scene updates are incremental (only dirty entities rebuild buffers) and the frame loop is on-demand when idle.

**Why:** Per-entity meshes collapse at a few thousand objects; instancing is the only way to hit the tiers in a browser.

**Acceptance:**
- Draw calls stay under 200 on Tier L reference scene
- Editing one node in a Tier L model rebuilds only affected buffers in under 16 ms
- Idle workspace renders zero frames per second (no GPU usage) until input or results change

### PERF-03 Fast picking and hit testing

Entity picking uses a BVH over merged geometry or GPU color-id picking so hover and click stay responsive; screen-space thresholds make thin lines and small glyphs pickable with mouse and touch.

**Why:** Naive raycasting against thousands of objects stalls hover highlighting, which feels like lag everywhere.

**Acceptance:**
- Hover resolves in under 8 ms on Tier L
- Line pick tolerance is 6 px for mouse and 14 px for touch
- Picking respects visibility, filters and clipping planes

### INP-02 Responsive layout and minimum viewport

The workspace layout (toolbar, canvas, property panel, results dock, diagnostics) adapts from 1280x720 upward; below the minimum a banner recommends a larger window and panels collapse to drawers. Panels are resizable/dockable and layout persists per user.

**Why:** Lecture-hall laptops and split-screen with the task brief are common; the canvas must retain useful area.

**Acceptance:**
- At 1280x720 the canvas retains at least 60% of width with one side panel open
- Layout state persists and resets via a menu command
- No horizontal scrolling at any supported width

### A11Y-01 Keyboard-only operation of all modeling actions

Every action available with the pointer (place node, draw member, assign, apply load, select, transform, navigate, switch cases) is achievable with keyboard via the command palette, the property panel, an entity list with arrow-key navigation, and numeric coordinate entry. Focus is visible and never trapped in the canvas.

**Why:** Accessibility of a 3D canvas is a legal and institutional requirement for universities and also enables automated tests and tutorials.

**Acceptance:**
- A test script builds and loads a 2D truss and reads results using keyboard only
- Tab order: toolbar, canvas (focusable, with arrow-key camera control), panels
- Entity list supports type-ahead by ID and name

### A11Y-02 Screen-reader summaries and live announcements

The canvas exposes an accessible name and description summarizing the model (counts, supports, load cases), the current selection, and a plain-language result summary (max displacement, governing member and utilization); changes announce via a polite live region. Results tables are proper HTML tables.

**Why:** Non-visual users need an equivalent understanding of the model and results to complete tasks and read feedback.

**Acceptance:**
- Selection changes announce entity type, ID and key properties
- After analysis, the summary updates with max values and governing case
- Grader feedback items are navigable as a list with full reason text

### CAP-01 Screenshots and snapshots with view metadata

Export PNG screenshots at 1x/2x/4x of the current view with optional legend, title block (task, user, case, scale factor, timestamp) and a JSON sidecar of view state (camera, overlay, case, visibility). Instructors can require specific snapshots (e.g., 'moment diagram, governing combination') as submission attachments.

**Why:** Submissions and feedback need reproducible images; graders and instructors reference them.

**Acceptance:**
- Screenshot output is deterministic for a given model, view state and backend (pixel diff under 1% across runs)
- Hi-DPI export does not exceed 4096 px on the long edge and completes within 2 s
- View state sidecar can be re-applied to reproduce the view

### CAP-02 Submission model-state capture

Submitting a task captures the canonical model JSON, its content hash, the solver version, a results summary (reactions, max displacements, max utilization per member, governing combinations), required snapshots and the learner's written justification into an immutable submission bundle. The workspace shows the submitted version read-only alongside the working copy.

**Why:** The AI grader must evaluate exactly what the student submitted, and disputes require reproducibility.

**Acceptance:**
- Re-analyzing the bundle on the server reproduces results within 1e-6 relative tolerance
- Any change after submission is detected by hash and shown as 'modified since submission'
- Bundle size for Tier M models stays under 5 MB

### IO-01 Native JSON model format (versioned schema)

The native format is a documented, schema-versioned JSON with nodes, members, plates, supports, loads, cases, combinations, sections, materials, groups, grids and units; import validates against the schema and migrates older versions. This is the format used for tasks, submissions and grading.

**Why:** A single canonical format underpins determinism, grading and future interchange.

**Acceptance:**
- JSON Schema published and used for validation on import and on save
- Round-trip import/export of reference models is lossless
- Schema migrations are tested from every prior version

### DET-01 Deterministic canonical serialization and stable IDs

Serialization is canonical: entities sorted by stable IDs, numbers formatted to a fixed precision in SI units, no view or UI state, stable key ordering; IDs are never reused after deletion. The hash of the canonical form identifies a model for grading, caching and plagiarism comparison.

**Why:** The grader, result cache and submission audit trail all rely on 'same model, same bytes'.

**Acceptance:**
- Saving the same model from two sessions and platforms yields byte-identical JSON
- Renaming or reordering operations that do not change geometry/loads do not change the hash
- Property-based tests confirm hash stability across 1,000 random edit/undo sequences

## Should (v1.x)

### VIEW-03 Section cuts, clipping planes and level/plane isolation

Users can place up to three axis-aligned or arbitrary clipping planes and isolate a story/level or a grid plane (e.g., show only elements on gridline B) to work inside dense 3D models. Clipped geometry is capped visually or shown as ghost lines.

**Why:** Multi-story and 3D truss tasks become un-editable without a way to see inside; this is standard in SAP2000/ETABS/RFEM.

**Acceptance:**
- Clipping planes drag interactively with a handle and have numeric offset entry
- Isolate-by-level shows a breadcrumb and a one-click 'show all'
- Selection and snapping ignore clipped-away geometry

### MOD-04 Plate/shell drawing with mesh preview

Draw quadrilateral or polygonal plates by picking 3+ nodes on a plane, assign thickness and material, and preview the analysis mesh (target element size) before running. Plates render with transparency so members behind remain selectable.

**Why:** Slabs, walls and plate girders appear in v1.x tasks; MVP can ship with members only but the data model must anticipate plates.

**Acceptance:**
- Non-planar node sets are rejected with the max out-of-plane deviation reported
- Mesh preview shows element count and warns above the tier budget
- Plate edges snap to member lines so slab-beam connectivity is shared

### EDIT-05 Measurement and inspection tools

Measure point-to-point distance (with dx/dy/dz), angle between members, member length and slope, and query node coordinates and member properties without changing the model. Measurements can be pinned as annotations in the view.

**Why:** Checking geometry against task drawings is a frequent step; pinned measurements help instructors annotate screenshots.

**Acceptance:**
- Measurement uses the same snapping as modeling
- Pinned annotations are view data and appear in screenshots when enabled
- Units follow the task unit system with precision settings

### RES-05 Mode shape animation

When a modal analysis exists, list modes with frequency/period and mass participation, animate the selected mode shape with the same scale/animation controls as the deformed shape, and allow stepping between modes with arrow keys.

**Why:** Seismic tasks require understanding dynamic behavior; mode animation makes it tangible.

**Acceptance:**
- Mode list sorted by frequency; selecting a mode updates the viewport within one frame
- Animation uses normalized amplitude with the auto-scale rule
- Mode shapes are excluded from the submission hash but included in result summary

### INP-01 Mouse, trackpad and touch input support

All modeling and result interactions work with mouse (3-button and 2-button), laptop trackpads (gesture events, no middle button) and touch screens (tablet-class, with long-press for context menu and touch-sized handles). Desktop is primary; touch is a supported secondary mode in v1.x.

**Why:** Students are overwhelmingly on laptops with trackpads; iPad use in studios is growing.

**Acceptance:**
- Every mouse-button-dependent action has a trackpad modifier alternative shown in the help overlay
- Touch handles are at least 44 px and gizmos enlarge in touch mode
- Pointer-type detection switches tolerances automatically

### CAP-03 Autosave, versioning and crash recovery

The model autosaves locally (IndexedDB) on every command and to the server at a throttled interval; on reload the workspace restores the last state including undo history; users can create named versions and restore them.

**Why:** Browser tabs crash and labs time out; losing an hour of modeling is unacceptable for coursework.

**Acceptance:**
- Reload after a simulated crash restores the model with no more than the last command lost
- Named versions are listable with diffs in element counts
- Server sync conflicts (two tabs) resolve with last-writer-wins plus a warning

### IO-02 CSV table import/export

Import and export nodes, members, supports and loads as CSV with a documented column layout, with a preview and error list on import; export results tables for the active case.

**Why:** Instructors author tasks in spreadsheets and students compare with hand calcs.

**Acceptance:**
- Import of 10k rows completes within 3 s with per-row error reporting
- Exports include units in headers
- Imported geometry respects merge tolerance

### IO-03 DXF import of 2D/3D wireframe

Import DXF lines/polylines as members (with layer-to-section mapping) and points as nodes, in 2D or 3D, with unit scaling; export centerline DXF.

**Why:** Many course drawings exist as CAD; tracing them manually wastes time.

**Acceptance:**
- Layer mapping dialog assigns section and material per layer
- Import splits crossing lines optionally and merges coincident endpoints
- Export opens correctly in AutoCAD and FreeCAD

## Could (later)

### IO-04 IFC and SAF interchange

Export the analytical model to SAF (Structural Analysis Format) and IFC structural analysis entities; import SAF for practicing-engineer workflows.

**Why:** Professional users want to round-trip with commercial tools; low priority for academic MVP.

**Acceptance:**
- SAF export validates in the reference SAF checker
- IFC export includes IfcStructuralCurveMember and supports

## Non-functional targets

| id | title | target |
|---|---|---|
| NFR-3D-01 | Interaction frame rate by tier | Tier S 60 fps, Tier M 60 fps (30 fps with all overlays), Tier L 30 fps navigation, measured as median frame time on reference scenes in CI on an integrated-GPU runner |
| NFR-3D-02 | Live result latency | Commit-to-fresh-results under 150 ms (Tier S), under 1 s (Tier M); drag updates at most every 100 ms; UI thread never blocked over 50 ms by analysis |
| NFR-3D-03 | Picking latency | Hover hit-test under 8 ms and click selection under 16 ms on Tier L |
| NFR-3D-04 | Time to interactive workspace | Empty workspace interactive within 3 s on a 10 Mbps connection (initial bundle under 1.5 MB gzipped, solver WASM lazy-loaded); Tier M model opens within 2 s after download |
| NFR-3D-05 | Memory ceiling | Tab heap under 1.5 GB and GPU memory under 1 GB on Tier L reference scene; undo history under 50 MB |
| NFR-3D-06 | Browser and backend support | Latest two versions of Chrome, Edge, Firefox and Safari on macOS/Windows; WebGL2 baseline, WebGPU when available; visual parity under 1% pixel diff between backends |
| NFR-3D-07 | Minimum viewport | Fully usable at 1280x720 with canvas at least 60% width with one panel open; touch targets at least 44 px in touch mode |
| NFR-3D-08 | Determinism of serialization and screenshots | Byte-identical canonical JSON across sessions/platforms; screenshot pixel diff under 1% for identical model, view state and backend |
| NFR-3D-09 | Accessibility conformance | WCAG 2.2 AA for all non-canvas UI; keyboard-only completion of the reference 2D truss task; color maps validated for deuteranopia/protanopia; reduced-motion honored |
| NFR-3D-10 | Resilience | WebGL/WebGPU context loss recovers within 2 s without data loss; crash recovery loses at most the last command |

## Domain notes (for architecture and UX)

INTERACTION PATTERNS
- Tool-mode state machine: Select (default) | Draw Node | Draw Member | Draw Plate | Apply Support | Apply Load | Measure | Probe | Section Cut. Esc returns to Select; Space temporarily enters navigation from any tool; Enter commits; right-click opens a context menu for the hovered entity. One command bus serves toolbar, shortcuts, palette and tests.
- Pointer mapping. Mouse: LMB select/draw, LMB-drag orbit on empty space (or window select when in Select mode with modifier), MMB-drag pan, RMB-drag orbit, wheel zoom cursor-anchored, Shift+wheel dolly. Trackpad: two-finger scroll pan, pinch zoom, Alt+drag orbit, Cmd/Ctrl+drag box-select. Touch: 1 finger orbit (or select tap), 2 finger pan/zoom, long-press context menu. Keyboard camera: arrows orbit, Shift+arrows pan, +/- zoom, F frame selection, Home fit all.
- Working plane: drawing projects the ray onto the active working plane; snapping to existing 3D geometry overrides the plane. Working plane chooser in the status bar: XY@level, XZ, YZ, custom (3 points), or 'last picked face'. In 2D mode the plane is locked.
- Snap priority (highest first): node > member end > member midpoint > grid intersection > member/member intersection > perpendicular foot > grid line > increment snap (user step). Tolerance 8 px mouse / 14 px touch. Shift disables; Ctrl cycles to the next candidate.
- Selection semantics: left-to-right window = fully contained; right-to-left crossing = intersecting; Shift adds, Ctrl/Cmd toggles, Alt subtracts; double-click selects connected chain of collinear members; filter bar restricts entity types; hidden/clipped geometry is not pickable.
- Gizmo rules: move gizmo at selection centroid; axis handles colored X red, Y green, Z blue; plane handles for XY/XZ/YZ; X/Y/Z keys lock axis during drag; typing a number during drag sets the delta; snapping applies to the dragged node, not the pivot; results re-run debounced at 100 ms during drag and on release.
- Entity glyph conventions: supports as triangles (pin), circles under triangle (roller) with direction arrow, hatched block (fixed), springs as zigzag; releases as hollow circles at member ends; loads as arrows (force), double-headed arrows (moment), fans with magnitude labels (distributed), hatched regions (area). Glyphs are screen-space scaled (clamped 24-40 px).
- Coordinate conventions: global right-handed, Z up (configurable Y-up display for courses that use it, stored as a view preference not a model property). Member local axis 1 along i to j, axis 3 default in the global Z plane (vertical member special case uses global X), beta rotates 2-3 about 1. Internal units SI (m, N, kg); display units per task (SI or US customary); precision per quantity type.

RESULT RENDERING RULES
- Deformed shape auto scale = 0.05 * bounding-box diagonal / max nodal displacement; slider is logarithmic 0.01x-100x; member curves use Hermite cubic interpolation from end displacements and rotations with 8-16 stations; plates use nodal displacements with per-element interpolation.
- Diagrams: drawn in local axes as filled ribbons; height scale = 0.08 * diagonal / max absolute value in active case; labels at extremes and ends; positive moment drawn on the tension side (configurable); envelope shows two ribbons with governing-case tooltip.
- Color maps: sequential perceptually-uniform palette for utilization 0-1.0, discrete red/hatched above 1.0; diverging palette for signed stresses; legends banded (default 10 bands) or smooth; min/max user override; palette validated for deuteranopia and protanopia.
- Grader overlay: entity outlines by severity (fail red, warn amber, note blue) rendered with an outline pass; clicking a feedback item frames the entity, switches overlay and governing case, opens probe card.

PERFORMANCE TIERS (reference scenes to be committed as fixtures)
- Tier S: up to 200 members, 300 nodes, no plates; 2D intro tasks; target 60 fps on Intel/Apple integrated GPUs; analysis under 50 ms; live mode always on.
- Tier M: up to 2,000 members, 5,000 shell elements, 3,000 nodes; 60 fps interaction, 30 fps with all overlays; analysis under 1 s; live mode on with debounce.
- Tier L: up to 10,000 members, 50,000 shell elements, 25,000 nodes; 30 fps navigation; labels on hover only; live mode default off (manual run with progress); analysis under 10 s; heap under 1.5 GB.
- Rendering architecture: document (immutable, canonical) -> scene builder (incremental, dirty-tracked) -> layers: members (merged LineSegments in centerline mode; InstancedMesh per section family in solid mode; distance-based LOD), nodes/supports/releases/load glyphs (InstancedMesh with per-instance color/scale), plates (merged BufferGeometry with per-vertex color for contours), overlays (deformed shape, diagrams, reactions, grader outlines) in separate groups toggled per view. Frame loop on demand; raycasting via BVH over merged geometry (or GPU id picking as fallback); labels via instanced SDF text or a 2D HTML overlay layer that declutters above 500 labels.
- Analysis in a Web Worker (WASM solver); the main thread receives typed arrays (displacements, element forces at stations, reactions, utilizations) and updates GPU buffers in place; cancellation token per edit generation; last valid results kept and marked stale.

STACK RECOMMENDATION (verify in architecture phase)
- Three.js (current release; WebGPURenderer recommended by the project, WebGLRenderer maintained in maintenance mode) with react-three-fiber v9 (React 19) and drei for controls/gizmos/HTML overlays; three-mesh-bvh for picking; zustand (or similar) with an immutable command log for undo; Web Worker + WASM solver; JSON Schema for the native format. Keep WebGL2 as baseline: WebGPU is in Chrome 113+, Safari 26+, Firefox 141+ (Windows only), so a dual backend with capability detection is required through at least v1.x. R3F v10 (alpha, WebGPU-first) is a watch item, not a dependency.
- Sources: https://threejs.org/manual/en/webgpurenderer.html ; https://r3f.docs.pmnd.rs/tutorials/v9-migration-guide ; https://newreleases.io/project/npm/@react-three/fiber/release/10.0.0-alpha.6 ; https://webo360solutions.com/blog/webgpu-browser-support

SERIALIZATION SKETCH (canonical JSON)
{schemaVersion, units:{internal:'SI'}, mode:'3d'|'planar-xz'|'planar-xy', materials[], sections[], nodes[{id,x,y,z}], members[{id,i,j,section,material,beta,releases:{i:[...],j:[...]},group}], plates[{id,nodes[],thickness,material,meshSize}], supports[{node,dof:[6 bool],springs:[6 num]}], loadCases[{id,name,type:'dead'|'live'|'wind'|'seismic'|'snow'|'temp'|...}], loads[{case,type,target,values...}], combinations[{id,name,factors:{caseId:factor}}], groups[{id,name,members[]}], grids[...] } with entities sorted by id, numbers to 9 significant figures, keys in fixed order, no view/UI/selection state. Separate view-state document holds camera, visibility, named views, overlay, active case, probes, annotations.

## Risks

| risk | mitigation |
|---|---|
| Live analysis on larger models blocks or stutters the canvas, undermining the 'live' promise | Solver in a Web Worker with cancellation per edit generation, debounced drag updates, stale-result overlays, automatic switch to manual mode above Tier M, CI benchmarks on reference scenes |
| 3D pointer ambiguity leads to nodes placed at wrong elevations and unstable models that students cannot diagnose | Working-plane model with explicit indicator, snap tooltips showing coordinates, auto-merge with notification, live diagnostics naming free DOFs, 2D mode for intro tasks |
| Floating-point differences between client and server solvers break determinism and grading reproducibility | Ship the same WASM solver binary on both sides, pin solver version in submission bundle, define relative tolerances, property-based tests on canonical hashing |
| Scope creep toward a full CAD/BIM tool (plates, offsets, meshing, IFC) delays MVP | Members-only MVP with schema that reserves plate/offset fields; plates, DXF and IFC/SAF staged as should/could |
| WebGPU backend divergence (Firefox non-Windows, driver blocklists) causes visual or picking inconsistencies | WebGL2 baseline, capability detection with forced-backend flag, visual regression on both backends, GPU id picking fallback |
| Accessibility of the canvas is deferred and becomes a blocker for university procurement | Command bus and keyboard path built first (also used by tests), screen-reader summaries as a must requirement, WCAG audit before v1 |
| Color maps and diagrams mislead users due to sign convention or scale confusion | Legends always show convention, case and scale factor; true scale factor displayed; defaults follow textbook conventions with instructor override |

## Open questions

- Which design codes and load-combination sets does the MVP grade against (AISC 360/ASCE 7, Eurocode 3/EN 1990, NSCP 2015)? This drives section libraries, unit defaults and utilization semantics shown in color maps.
- Are plates/shells in the MVP or v1.x? Shell meshing, contour rendering and mesh-size UX roughly double the workspace scope.
- Does live analysis run client-side (WASM solver in a worker) with server re-run for grading, or server-side only? The determinism requirement (1e-6 reproduction) and the 150 ms live budget favor the same solver binary on both sides.
- Is Z-up the canonical global axis (structural convention) with Y-up only as a display preference? Must be fixed before the schema is written.
- What is the tablet/touch priority for v1.x: full modeling on iPad, or view/probe/feedback only?
- Do instructors author tasks in the same workspace (with authoring-only tools such as locked entities, hidden answer models, required snapshots), or in a separate authoring mode?
- Which quantities must be captured in the submission result summary for the grader (per-member utilization by check type, deflections vs limits, reactions) and in what unit system?
- What are the limits on member count per task that instructors can set, and should the workspace enforce them (hard cap) or only warn?
- Should DXF import target 2D only in v1.x (most course drawings) to reduce scope, deferring 3D DXF?
