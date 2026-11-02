# Simulation / finite element engine

_Source: requirements discovery workflow `wf_6281c128-0bb` (domain agent), 2026-11-03. 57 requirements: 43 must (MVP), 9 should (v1.x), 5 could (later)._

## Summary

Bridle's differentiator is a structural model that re-solves while the learner edits it, and an AI grader that must re-run exactly what the learner saw. That forces two architectural decisions in this domain: (1) the finite element engine must run in the browser (Web Worker + WebAssembly) for models up to roughly 6k DOF and in a server job queue beyond that, and (2) the same engine artifact must execute on the server so grading is bit-for-bit reproducible. We recommend a custom direct-stiffness engine written in Rust, compiled to WASM for the browser and to native (or run as the identical .wasm under Wasmtime) on the server; OpenSees, CalculiX/Code_Aster and commercial APIs all fail the 'live' latency requirement, and OpenSees additionally has a UC Berkeley license that restricts commercial cloud redistribution. MVP scope is linear static (multi-case, multi-RHS), 3D frame/truss/flat-shell/spring elements, full support and load libraries with code load-combination generators, SI-internal unit handling, and member/shell result recovery with exact extrema feeding a separate code-check module (AISC 360-22 / EC3 steel first). Modal, P-delta, linear buckling and rigid diaphragms are v1.x; response spectrum, influence lines/moving loads, solids and nonlinear members are later. Determinism (fixed assembly order, pure-Rust libm, no FMA, single-threaded kernel, pinned engine versions, canonical model hashing), a CI benchmark suite with closed-form tolerances, and pedagogical mechanism/ill-conditioning diagnostics are first-class requirements because student models are routinely unstable and the grader must be trusted.

## Must (MVP)

### SIM-ARCH-01 Engine isolated behind a typed message API in a Web Worker

The FE engine is a self-contained module with no UI or DOM dependencies, exposed through a versioned, typed request/response protocol (load model, apply ops, validate, solve, query results, cancel). In the browser it always runs inside a Web Worker so the 3D viewport never blocks; results are returned as transferable typed arrays plus a JSON index.

**Why:** Live interaction needs a non-blocking solve path, and an interface-first design lets the implementation language (Rust/WASM now, anything later) be swapped and lets the server run the same protocol.

**Acceptance:**
- UI thread never blocks longer than 16 ms during a solve of a Tier-1 model
- Same protocol schema drives browser worker and server job runner (shared TypeScript types generated from one source)
- Protocol version is included in every message and mismatches are rejected with a clear error

### SIM-ARCH-02 Custom direct-stiffness engine in Rust compiled to WASM and native

Implement the MVP engine as a Rust crate (no_std-friendly numerical core) compiled to wasm32 with SIMD for the browser and to native for the server. Sparse symmetric LDLT/Cholesky with fill-reducing ordering (AMD) and multiple right-hand sides; dense fallback for tiny models. A week-1 spike must confirm the chosen sparse crate (faer-sparse or an in-house CSparse-style simplicial LDLT) builds and performs on wasm32-unknown-unknown.

**Why:** Only an in-browser engine meets live latency; Rust gives near-native numeric speed, memory safety, and one code base for client and grader. faer's wasm support is not officially documented, so it must be verified early with a fallback plan.

**Acceptance:**
- cargo build succeeds for wasm32-unknown-unknown and the host native target from one crate
- Spike benchmark: 10-storey 6x6-bay 3D frame (~3.2k DOF) solves (assemble+factor+solve, all cases) in < 50 ms in Chrome on an M1/Intel i5-8th-gen class laptop
- Engine wasm binary <= 1.5 MB raw, <= 500 KB gzipped

### SIM-ARCH-03 Model-size tier router based on symbolic analysis and device calibration

Before numeric factorization the engine performs symbolic analysis (ordering + elimination tree) and predicts factor nonzeros and flops. Combined with a 50 ms device micro-benchmark run at session start, it routes each solve to Tier 1 (live, in-browser), Tier 2 (in-browser background with progress) or Tier 3 (server job). Thresholds are configurable per deployment.

**Why:** DOF count alone is a poor predictor (frames vs shells differ 10x in fill-in); predicted flops plus measured device speed gives a reliable, cheap routing decision.

**Acceptance:**
- Default thresholds: Tier 1 if predicted time < 100 ms, Tier 2 if < 3 s and factor memory < 1 GB, else Tier 3
- Symbolic analysis itself completes in < 20 ms for 60k DOF
- User can force server solve; grader always uses the server path

### SIM-ARCH-04 Server solve job queue running the identical engine artifact

Provide a job queue (persisted, retryable, with priority lanes for grading vs interactive) whose workers run the same engine build as the client. Jobs accept the canonical model JSON plus analysis requests and store results with provenance. Analysis beyond browser limits (large models, P-delta over many combos, moving-load sweeps) and all grading re-runs go through this path.

**Why:** Needed for Tier 3 and for reproducible grading; identical artifact removes cross-platform numeric drift.

**Acceptance:**
- Tier-3 model up to 500k DOF linear static completes in < 60 s on one worker (8 cores, 16 GB)
- Grading lane p95 queue wait < 10 s under 100 concurrent submissions
- Job result stores engineVersion, engineArtifactHash, modelHash, resultHash, timings

### SIM-ARCH-05 Incremental re-solve with factorization and symbolic reuse

The engine keeps internal model state and accepts ops (diffs). Load-only edits reuse the existing factorization (forward/back substitution only); geometry or property edits that keep topology reuse the symbolic factorization and ordering; topology edits trigger full re-analysis. Combination results are formed by superposition of case results without re-solving.

**Why:** Dragging a load or changing a section must feel instantaneous; factorization dominates solve time and can usually be skipped.

**Acceptance:**
- Load-only change on a Tier-1 model returns results in < 10 ms
- Node drag (geometry-only) on a 3k DOF model returns results in < 40 ms
- Combination evaluation for 30 combos adds < 5 ms

### SIM-ARCH-06 Debounced, cancellable, sequence-numbered solve requests

Every solve request carries a monotonically increasing sequence number; the engine cancels or skips superseded requests, the UI drops stale responses, and edits are debounced (default 30 ms) so rapid drags do not queue solves. Tier-2 solves emit progress events and can be cancelled.

**Why:** Prevents result flicker and worker saturation during continuous interaction.

**Acceptance:**
- Dropping 100 edits in 1 s results in at most ~30 solves and the last result always corresponds to the final model state
- Cancellation of a Tier-2 solve takes effect within 200 ms

### SIM-ANL-01 Linear static analysis, multi-case, multi-RHS

Solve all load cases of a model in one factorization using multiple right-hand sides, including prescribed displacement cases (partitioned K_ff u_f = f_f - K_fs u_s). Support Euler-Bernoulli (default) and Timoshenko frame behaviour per section (shear areas).

**Why:** Core capability for every task; multi-RHS makes 'all cases live' nearly free.

**Acceptance:**
- Results for N cases cost < 1.3x the time of a single case for N <= 20
- Closed-form benchmarks (see domain notes) pass within tolerance in both wasm and native

### SIM-ANL-02 Planar (2D) analysis mode

A model-level setting restricts analysis to the XZ (or XY) plane: out-of-plane translation and in-plane rotations are automatically restrained, member orientation is implied, and 2D support icons/loads are offered. The same 3D engine solves with 3 active DOF per node.

**Why:** Most coursework is planar; 2D mode halves DOF and removes the most common student mechanism errors (out-of-plane instability).

**Acceptance:**
- Switching to 2D mode on a planar portal frame produces identical in-plane results to the 3D solve
- Out-of-plane loads in 2D mode raise a validation error

### SIM-ELM-01 3D frame element with releases, rigid offsets and shear deformation

12-DOF two-node beam-column (axial, biaxial bending, St Venant torsion; optional Timoshenko shear via shear areas). Any of the 6 DOF at each end can be released (static condensation of stiffness and consistent fixed-end forces). Rigid end offsets (vector per end) via transformation. Local axes follow the SAP2000-style convention with a roll angle or orientation vector (see domain notes). Cw is stored for design checks.

**Why:** The workhorse element for frames; releases and offsets are needed for realistic steel connections and panel zones.

**Acceptance:**
- Fixed-fixed beam UDL: end moment wL^2/12, midspan wL^2/24 within 1e-6 relative
- Member with both end moment releases under UDL behaves as simply supported (midspan wL^2/8)
- Rigid offset of e at both ends shortens the flexible length and changes stiffness exactly as a member of length L-2e

### SIM-ELM-02 Truss element

Axial-only two-node element (3 translational DOF per node in 3D) with section and material; nodes connected only by truss elements have rotational DOFs automatically removed from the system.

**Why:** First element taught in every course; also used for bracing and cables.

**Acceptance:**
- Warren truss member forces match method-of-joints within 1e-9 relative
- Pure truss model solves without singularity warnings about rotations

### SIM-ELM-03 Flat shell element (quad and triangle)

4-node flat shell combining MITC4 Reissner-Mindlin plate bending (thin and thick, no shear locking) with a membrane with drilling DOF; 3-node MITC3/DKT counterpart. Behaviour selectable as shell, plate-only or membrane-only. Elements are defined directly by nodes in MVP; element quality (aspect ratio, warpage, skew, Jacobian) is checked.

**Why:** Slabs, walls and decks are part of real structures and of the product's 'plates' workspace.

**Acceptance:**
- Simply supported square plate (nu=0.3, 16x16 mesh): w_max within 2% of 0.00406 q a^4 / D
- Passes constant-stress membrane and constant-curvature plate patch tests
- Scordelis-Lo roof midside vertical displacement within 3% of 0.3024 (MacNeal-Harder) at 10x10 mesh

### SIM-ELM-05 Spring and link elements, nodal springs

Nodal spring supports with 6 independent stiffnesses and two-node link elements (zero length allowed) with translational/rotational stiffness in local axes; optional soil-subgrade helper converts a Winkler modulus and bearing area into spring stiffness.

**Why:** Models foundations, semi-rigid connections and elastic supports required by 'soil' environment scenarios.

**Acceptance:**
- Beam on three springs matches hand calculation of spring reactions within 1e-9 relative
- Zero-length link between coincident nodes passes validation only when explicitly typed as a link

### SIM-SUP-01 Per-DOF supports: fixed, pinned, roller, custom

Supports are defined per node with each of 6 DOF set to free, fixed or spring; presets Fixed, Pinned, Roller-X/Y/Z. Optional local support axes allow inclined (skewed) rollers through nodal transformation.

**Why:** Fundamental boundary conditions; skewed supports appear in bridge and roof problems.

**Acceptance:**
- Inclined roller at 30 degrees produces reaction normal to the incline within 1e-9 relative
- Validation flags models whose supports cannot remove all 6 rigid body modes

### SIM-SUP-02 Prescribed support displacement and settlement

Any restrained DOF can be given a nonzero prescribed displacement or rotation in a load case (settlement), handled by partitioning rather than penalty.

**Why:** Differential settlement is a standard 'environment' condition and a classic indeterminate-structure exercise.

**Acceptance:**
- Fixed-fixed beam with support settlement Delta: end moment 6 EI Delta / L^2 within 1e-6 relative
- Reactions reported for settled supports include the settlement-induced forces

### SIM-LOD-01 Nodal loads and moments

Forces and moments at nodes in global or node-local axes, assignable to any load case.

**Why:** Baseline load type.

**Acceptance:**
- Nodal load on an unrestrained free node without elements is rejected by validation

### SIM-LOD-02 Member distributed and point loads

Uniform and trapezoidal distributed loads over full or partial member length, member point loads/moments at a distance, in local or global axes, with projected-length option (snow/wind on sloped members). Consistent fixed-end forces are used, giving exact nodal results for prismatic members.

**Why:** Covers gravity, snow and wind on members; projected loads are a frequent student error the grader must distinguish.

**Acceptance:**
- Partial trapezoidal load on a simply supported beam: reactions match hand integration within 1e-9 relative
- Projected vs along-length UDL on a 30-degree rafter differ by cos(30) in total load

### SIM-LOD-03 Self-weight

A load case may include self-weight computed from material density and section area / shell thickness with a direction and factor; included in mass source for modal analysis.

**Why:** Dead load realism and the most common omission in student models.

**Acceptance:**
- Total self-weight reaction equals sum(rho g A L) + sum(rho g t Area) within 1e-9 relative

### SIM-LOD-04 Thermal loads

Uniform temperature change and through-depth gradients on frame members (axial and curvature strain) and uniform/gradient on shells, using material thermal expansion coefficient.

**Why:** Temperature is one of the listed environmental criteria.

**Acceptance:**
- Fully restrained bar with Delta T: axial stress -E alpha Delta T within 1e-9 relative
- Unrestrained bar with Delta T: zero internal force, elongation alpha Delta T L

### SIM-LOD-05 Area (panel) loads and shell pressures

Load panels are planar polygons bounded by members; area loads are distributed to the bounding members as one-way (user span direction) or two-way (tributary/yield-line envelope) distributed loads that are visible and auditable. On shell elements, area loads apply as pressure with consistent nodal forces. Projected option supported.

**Why:** Floor live/dead, snow and wind pressures are specified per area in codes; the distribution assumption must be explicit for grading.

**Acceptance:**
- Two-way panel 6x6 m with q: each edge beam receives a triangular load whose resultant is q*36/4 within 1e-9 relative
- Total reactions equal q times panel area within 1e-9 relative
- Non-planar or non-closed panels are rejected by validation

### SIM-LOD-06 Load cases, combinations, code generators and envelopes

Named load cases with a type (dead, superimposed dead, live, roof live, snow, wind, seismic, temperature, settlement, other) and user combinations (factor x case; nested combinations later). Generators produce standard sets for ASCE 7-22 (LRFD 2.3 and ASD 2.4, with wind/seismic directions and vertical seismic term), EN 1990 (6.10, 6.10a/b, SLS characteristic/frequent/quasi-permanent with psi factors) and NSCP 2015. Envelopes return max/min with governing combination per quantity.

**Why:** 'Correct load combinations' is an explicit grading criterion; the generator provides the reference set.

**Acceptance:**
- ASCE 7-22 generator from cases D, L, Lr, S, W(+/-x,+/-y), E(+/-x,+/-y) yields the full LRFD set including 0.9D combos
- Combination results equal the factored superposition of case results within 1e-12 relative
- Envelope reports governing combination id for every reported extreme

### SIM-LIB-01 Material library

Isotropic linear elastic materials with E, G/nu, density, alpha, design strengths (fy, fu, f'c, Fb) and code-specific derived properties (e.g., Ec = 4700 sqrt(f'c) MPa per ACI 318). Built-in: structural steels (ASTM A992, A36, A500; S235/S275/S355), concretes (f'c 21-50 MPa / C20-C50), plus custom materials.

**Why:** Needed for analysis and for code checks; students should pick real materials.

**Acceptance:**
- Every built-in material carries a source reference and version
- Custom materials require E > 0, 0 <= nu < 0.5, rho >= 0

### SIM-LIB-02 Section library and parametric sections

Built-in AISC Shapes Database v16 (W, HSS, C, L, WT, pipe) and European profiles (IPE, HEA/HEB/HEM, UPN, RHS/CHS), parametric shapes (rectangle, circle, I, T, hollow, channel) and custom-by-properties (A, Iy, Iz, J, Cw, S, Z, r, shear areas). Each section stores the dimensions needed for code checks (bf, tf, tw, h) and a drawing outline for 3D rendering.

**Why:** Design optimization tasks revolve around choosing sections; code checks need slenderness dimensions.

**Acceptance:**
- W12x26 properties match AISC v16 within 0.5% (unit-converted)
- Parametric rectangle 300x500 mm: A, Iy, Iz, Z computed to closed form within 1e-9 relative

### SIM-UNT-01 Unit systems with SI-internal storage

All stored model and result quantities are SI base units (N, m, kg, s, Pa, K). Users select display presets (SI kN-m-mm-MPa, US kip-ft-in-ksi) or per-quantity units; conversions happen only at the UI/API boundary with explicit dimension tags so mixed-unit entry (kN with mm sections) is handled correctly.

**Why:** Unit errors are a leading cause of wrong answers; a single internal system keeps the engine and grader simple.

**Acceptance:**
- Round-trip 1 kip-ft -> SI -> kip-ft is exact to 1e-12 relative
- Same model solved under SI and US display settings yields identical SI results and hash

### SIM-RES-01 Nodal displacements and reactions with equilibrium check

Per case and combination: 6-component nodal displacements, support reactions (including spring and prescribed-displacement supports), sum of reactions vs applied loads per global direction with the imbalance reported.

**Why:** Reactions and global equilibrium are both pedagogically important and the engine's built-in sanity check.

**Acceptance:**
- Reaction sum equals applied load sum within 1e-8 relative for all benchmarks
- Imbalance > 1e-6 relative raises an engine warning attached to the result

### SIM-RES-02 Member internal force diagrams, exact extrema and deflected shape

For every frame member: N, Vy, Vz, T, My, Mz at a configurable number of stations (default 11) plus analytically located extrema (e.g., zero-shear points under distributed loads) and values at load discontinuities; local deflections along the member from Hermitian interpolation plus distributed-load correction. Sign conventions documented and consistent with the local axis convention.

**Why:** Grading against M_max or V_max needs exact extremes, not sampled approximations; diagrams are the main learning visual.

**Acceptance:**
- Simply supported beam with partial UDL: reported M_max equals hand calculation within 1e-9 relative and at the correct location
- Diagram arrays are returned as typed arrays sized stations x 6 per member

### SIM-RES-03 Member stresses

Axial, bending (top/bottom, both axes), combined normal stress extremes, average/approximate shear and torsional shear stress per station based on section properties.

**Why:** Bridges analysis to allowable-stress intuition and feeds simple utilization displays.

**Acceptance:**
- Rectangular beam under pure bending: sigma = M c / I within 1e-9 relative

### SIM-RES-04 Shell internal forces and stresses

Membrane forces (Nxx, Nyy, Nxy), moments (Mxx, Myy, Mxy), transverse shears (Qx, Qy), top/mid/bottom stresses, principal and von Mises values at Gauss points, extrapolated to nodes and averaged with a discontinuity flag; per-element local axis definition is reported.

**Why:** Needed to design slabs and walls and to check serviceability stresses.

**Acceptance:**
- Uniform-membrane patch test returns constant Nxx exactly (1e-12 relative)
- Averaged vs unaveraged nodal moments differ by < 5% on the plate benchmark at 16x16

### SIM-RES-05 Serviceability quantities: relative deflection and storey drift

Compute max member deflection relative to its chord (with location and L/ratio), absolute nodal displacement ratios, and storey drift and drift ratio when nodes are assigned to levels; expose per combination and as envelope.

**Why:** L/360-type and drift limits are the serviceability criteria the grader applies.

**Acceptance:**
- Simply supported beam UDL: relative deflection 5 w L^4 / (384 EI) within 1e-6 relative and reported as L/n
- Storey drift ratio reported for each level pair for every lateral combination

### SIM-RES-07 Code-check contract and steel utilization (AISC 360-22, EN 1993-1-1)

The engine exposes per-station demands, section/material data and member design attributes (Kx, Ky, Lb, Cb, bracing) to a separate design-check module with a stable interface. MVP checks: AISC 360-22 LRFD/ASD for W, HSS and pipe (tension, compression with flexural/torsional buckling, flexure with LTB, shear, combined H1) and EN 1993-1-1 (classification, 6.2 resistances, 6.3 buckling). Output: utilization ratio, governing clause, governing combination and station.

**Why:** 'Utilization through code checks' is the headline result quantity; keeping checks outside the solver lets codes evolve independently.

**Acceptance:**
- AISC Design Examples v16 beam and column examples reproduce phi*Mn, phi*Pn within 1%
- Every utilization carries clause reference, combination id and station

### SIM-RES-09 Results schema with provenance

Result sets are versioned documents keyed by modelHash + analysisRequestHash + engineArtifactHash, containing timings, warnings, tier used, per-case/combination arrays and a resultHash computed over canonicalized numeric content.

**Why:** Grader and gradebook must reference exactly which results were graded and reproduce them.

**Acceptance:**
- Two runs of the same model and engine artifact yield identical resultHash
- Results from a different engine version are never silently reused (cache key includes artifact hash)

### SIM-DET-01 Bit-identical reproducibility within an engine artifact

Given identical canonical model JSON, analysis request and engine artifact, results are bit-identical across runs, browsers, OSs and the server. Recipe: deterministic entity ordering (sorted ids, no hash-map iteration), single-threaded numeric kernel (or deterministic reduction trees), pure-Rust libm for transcendental functions on all targets, no FMA contraction, fixed eigen-solver start vectors and sign conventions, and no wall-clock or random inputs.

**Why:** The grader re-runs submissions; any drift creates disputes about grades.

**Acceptance:**
- CI runs the benchmark suite on wasm (Node), native Linux and native macOS and asserts identical resultHash for each problem
- Grader re-run of a submission with the same artifact produces hash equality; mismatch is treated as a system error, not a student error

### SIM-DET-02 Canonical model serialization and content hashing

Model JSON is canonicalized (RFC 8785 JCS: sorted keys, normalized number formatting, no insignificant fields) before hashing with SHA-256; the hash identifies the model revision used in results and submissions.

**Why:** Enables result caching, duplicate-submission detection and grader provenance.

**Acceptance:**
- Reordering entities or changing display units does not change modelHash
- Any physical change (coordinate, property, load) changes modelHash

### SIM-DET-03 Engine version pinning and migration policy

Each task pins an engine artifact version; submissions record it; the grader uses the pinned version even after newer engines ship. Engine releases are semver'd, artifacts are content-addressed and retained, and numerics-affecting changes bump the minor version with a changelog entry and a benchmark diff report.

**Why:** Allows engine improvement without retroactively changing grades.

**Acceptance:**
- Old artifacts remain downloadable and runnable server-side for at least 3 years
- A task can be re-pinned by an instructor with a warning that stored results will be recomputed

### SIM-VNV-01 Verification benchmark suite in CI

A curated suite (>= 40 problems) of closed-form and reference solutions covering beams, trusses, frames, thermal, settlement, springs, plates/shells, modal and buckling (see domain notes), each with a tolerance; runs on every engine change for wasm and native.

**Why:** The engine's credibility with instructors depends on demonstrable verification.

**Acceptance:**
- Suite passes on every merge; any tolerance change requires reviewer approval
- Verification report (problem, reference, computed, error) is published per engine release

### SIM-VNV-02 Element patch tests and standard shell benchmarks

Membrane and plate patch tests, MacNeal-Harder set (Scordelis-Lo roof, pinched cylinder, hemispherical shell, twisted beam), and NAFEMS LE1/LE2/FV32 run with mesh refinement to document convergence.

**Why:** Shell formulations are the most error-prone part of the element library.

**Acceptance:**
- Each benchmark passes stated tolerance at the reference mesh and converges monotonically with refinement

### SIM-VNV-04 Performance regression benchmarks

Generated models for each tier (portal frame, 10-storey frame, 30x30 slab, 5-storey building with slabs) are timed in CI on wasm and native with alerts on > 15% regression.

**Why:** Protects the live-interaction targets as features are added.

**Acceptance:**
- Timings for assemble, symbolic, numeric, solve, recovery recorded per benchmark per commit

### SIM-ROB-01 Mechanism and singularity detection with DOF localization

Before factorization, check rigid-body restraint and per-node stiffness presence; during LDLT, detect pivots below 1e-12 x max diagonal and map them back to node + DOF. Report as 'unstable structure' with the offending node/direction and a likely cause (missing support, released member chain, truss node rotation, 2D model in 3D).

**Why:** Unstable student models are the norm; messages must teach, not just fail.

**Acceptance:**
- Pinned-pinned-pinned three-hinged chain reports the mechanism node and rotation DOF
- No NaN or Inf ever reaches results; singular systems return a structured error

### SIM-ROB-02 Ill-conditioning warnings and residual verification

Estimate condition via pivot ratio and a 1-norm estimator; warn above 1e12 with the entities contributing extreme stiffness (e.g., 1e15 springs, 1 mm members). After solve compute ||K u - f|| / ||f||; apply one step of iterative refinement and warn if residual > 1e-8.

**Why:** Students combine wildly different stiffnesses and units; silent inaccuracy would be graded as wrong.

**Acceptance:**
- Model with a 1e18 N/m spring triggers the warning naming the spring
- Residual is stored in results and exposed to the grader

### SIM-ROB-03 Element quality and geometric sanity checks

Shell aspect ratio > 10 warns, > 100 errors; warpage, skew and non-positive Jacobian error; frame members shorter than 1e-4 m error; coordinates beyond 1e5 m warn; orientation vectors parallel to the member axis error.

**Why:** Prevents garbage results and guides mesh quality.

**Acceptance:**
- Each check has a test fixture that triggers it and a message with entity ids

### SIM-VAL-01 Validation rule engine with severities and fix suggestions

Validation runs on every edit (< 20 ms for Tier-1 models) and before solve, producing issues with code, severity (error blocks solve, warning allows), entity references and, where possible, an automatic fix action (merge duplicates, add node at intersection, assign default section).

**Why:** Fast, specific feedback is the pedagogical core of a live modelling workspace and reduces support load.

**Acceptance:**
- Issues are stable across runs (same ids and order) so the UI can diff them
- Grader receives the final validation report with the submission

### SIM-VAL-02 Model validation rule set

Rules: orphan nodes (warn; error if loaded or supported), duplicate nodes within 1 mm (warn + merge fix), zero/near-zero length members (error), members crossing without a shared node (warn), overlapping/duplicate members (error), missing or invalid section/material (error), non-positive properties (error), insufficient supports / no supports (error), release patterns creating mechanisms (error), loads referencing missing entities (error), empty load cases (warn), combinations referencing missing cases (error), non-planar or open load panels (error), nodes not on their assigned level (warn), 2D-mode out-of-plane inputs (error).

**Why:** Enumerating the rules makes them testable and gives the UI a consistent vocabulary.

**Acceptance:**
- Every rule has a code (e.g., VAL-ORPHAN-NODE), a test fixture and user-facing text
- Rule list is published in developer docs and versioned

### SIM-SCH-01 Structural model JSON schema with stable ids and semver

A JSON Schema (draft 2020-12) defines the model (see domain notes outline): entity collections with immutable, never-reused string ids; schemaVersion (semver) with forward migrations; physical values in SI; display preferences separate from physics. Schema is published and used to validate all imports and API payloads.

**Why:** The model document is the contract between workspace, engine, grader and storage.

**Acceptance:**
- Schema validation rejects unknown entity types and dangling references
- Migration tests upgrade fixtures from every prior schema version

### SIM-SCH-02 Model operation (diff) protocol for live editing and undo

Edits are expressed as ops (add/update/delete entity, batch) with inverse ops for undo/redo; the engine consumes the same ops to update its state incrementally; ops are logged for replay and for learner-process analytics.

**Why:** Drives incremental re-solve and makes editing history auditable for grading of 'engineering judgment'.

**Acceptance:**
- Replaying the op log from an empty model reproduces the final modelHash
- Undo/redo of 1,000 ops keeps engine state consistent (hash equality with fresh load)

## Should (v1.x)

### SIM-ANL-03 Modal analysis with mass source

Compute the first N natural frequencies/periods and mass-normalized mode shapes via shift-invert Lanczos or subspace iteration (dense symmetric eigen for < 1,000 DOF). Mass source = self-weight mass + additional nodal masses + factored load cases (e.g., D + 0.25L). Report modal participation factors, effective modal mass ratios per direction and cumulative mass.

**Why:** Required for seismic education (periods, mass participation) and as the basis for response spectrum.

**Acceptance:**
- Cantilever and simply supported beam frequencies within 1% of closed form with 8 elements
- 10 modes of a 5k DOF frame in < 2 s in-browser
- Sum of effective modal mass reported per global direction

### SIM-ANL-04 P-delta / geometric nonlinear static analysis

Second-order analysis per load combination using geometric stiffness from member axial forces, iterated to convergence (displacement norm < 1e-6 relative, max 20 iterations), capturing P-Delta (storey) and, through member subdivision or stability functions, P-delta (member). Non-convergence reports the combination and the estimated load factor.

**Why:** AISC 360 Direct Analysis Method and EC3 require second-order effects; grading 'real-world' stability needs it.

**Acceptance:**
- Column with axial P and lateral load: lateral amplification within 2% of 1/(1 - P/Pcr)
- Divergence for P > Pcr is detected and reported as instability, not NaNs

### SIM-ANL-05 Linear buckling eigenvalue analysis

For a selected combination, form K_G from the linear static axial forces and solve (K + lambda K_G) phi = 0 for the lowest N positive load factors and buckling mode shapes.

**Why:** Gives students critical load factors and visual buckling modes; shares K_G code with P-delta.

**Acceptance:**
- Euler column (pinned-pinned, 4 elements) critical load within 0.5% of pi^2 EI / L^2; K=0.7, 0.5, 2.0 cases within 1%
- Negative or spurious eigenvalues filtered and reported

### SIM-ELM-04 Region meshing for slabs and walls

User defines planar polygonal regions (with openings) and a target mesh size; the engine generates a quad-dominant mesh, inserts nodes on boundary members and merges them so members and shells share nodes. Line and point loads can be applied to the region and mapped to the mesh.

**Why:** Hand-defining shell elements is impractical beyond demo size.

**Acceptance:**
- L-shaped slab with an opening meshes with > 90% quads at 0.5 m target
- Boundary beams receive shared nodes at every mesh vertex along their length

### SIM-ELM-06 Rigid diaphragm and rigid link constraints

Master-slave constraints: rigid diaphragm per storey level (in-plane rigid, out-of-plane free) and general rigid links between nodes, implemented by transformation (DOF elimination) so the system stays symmetric positive definite.

**Why:** Building models under lateral loads are unrealistic without diaphragms; needed for seismic ELF tasks.

**Acceptance:**
- Storey with diaphragm shows identical in-plane displacement (translation + rotation about vertical) at all constrained nodes
- Reactions still balance applied loads within 1e-8 relative

### SIM-LOD-07 Environment-driven load generators

From a task's environment parameters compute reference loads: seismic equivalent lateral force (ASCE 7-22 Ch. 12 / NSCP 2015 Sec. 208) using approximate or modal period, simplified MWFRS wind pressures (ASCE 7-22 Ch. 27/28, EN 1991-1-4 basic), and flat/sloped roof snow (ASCE 7-22 Ch. 7). Outputs are load cases students can apply or that the grader compares against.

**Why:** Links the environment scenario to concrete loads and gives the grader a deterministic reference.

**Acceptance:**
- ELF base shear and storey distribution match hand calculation for a 5-storey example within 0.5%
- Generator records all intermediate code parameters (Cs, T, k, Kz, qz, Ce, Ct, Is) in the load case metadata

### SIM-RES-06 Mode shapes, frequencies and buckling modes as results

Modal and buckling results share the result model: eigenvalue, period/frequency or load factor, normalized shape vectors, participation and effective mass (modal), with animation-ready displacement arrays.

**Why:** Results pipeline must handle eigen analyses the same way as static ones for visualization and grading.

**Acceptance:**
- Mode shapes normalized to unit max displacement and sign-stabilized (largest component positive) for reproducibility

### SIM-RES-08 Reinforced concrete checks (ACI 318-25, EN 1992-1-1)

RC beam flexure/shear and column P-M interaction checks for rectangular and circular sections with user-specified reinforcement, producing utilization and required As.

**Why:** Concrete is half of structural curricula; ACI 318-25 is the current edition.

**Acceptance:**
- Singly reinforced beam phi*Mn matches hand calculation within 1%
- Column interaction diagram passes through pure compression and pure bending points within 2%

### SIM-VNV-03 Cross-check against an independent solver

A reference set of 20 models is also solved with OpenSees (research use, offline) and results compared within 1e-6 relative for linear static and 1e-3 for eigenvalues; discrepancies are triaged before release.

**Why:** Independent validation catches formulation and sign-convention errors closed-form checks miss.

**Acceptance:**
- Comparison script and report archived per release

## Could (later)

### SIM-ANL-06 Response spectrum analysis

Modal response spectrum analysis with user or code-defined spectra (ASCE 7-22 / NSCP 2015 design spectrum from Ss, S1, site class; EN 1998 Type 1/2), SRSS and CQC modal combination, directional combination (100/30 or SRSS), and scaled base shear reporting.

**Why:** Natural extension once modal analysis exists; valuable for seismic courses.

**Acceptance:**
- SDOF check: spectral displacement equals Sa/omega^2 within 0.1%
- Reports base shear per direction and mass participation used

### SIM-ANL-07 Influence lines and moving loads

Compute influence lines for reactions, member forces and displacements by unit-load sweeps along selected member paths (reusing the factorization), and run moving vehicle/lane loads (AASHTO HL-93 truck and lane, user-defined axle trains) producing envelopes.

**Why:** Bridge engineering tasks; cheap given factor reuse.

**Acceptance:**
- Simply supported beam midspan moment influence line matches L/4 peak within 0.1%
- 1,000-position sweep on a 2k DOF model in < 2 s

### SIM-ANL-08 Tension-only / compression-only members and gap springs

Iterative linear analysis that deactivates members violating their sign constraint per combination until the active set converges; results are per-combination (no superposition).

**Why:** Cable bracing and foundation uplift are common real-world scenarios.

**Acceptance:**
- X-braced frame under lateral load reports only the tension diagonal active
- Non-convergence after 50 iterations reported with the oscillating members listed

### SIM-ELM-07 Solid elements

8-node hexahedral and 4/10-node tetrahedral solid elements with stress recovery for detailed component studies (e.g., connections, footings).

**Why:** Not required for frame/shell curricula; large DOF counts push to Tier 3.

**Acceptance:**
- NAFEMS LE10 thick plate stress within 3% of reference

### SIM-SCH-03 Import and export interoperability

Export model to OpenSees (Python/Tcl) and CSV tables; import simple CSV node/member lists and DXF wireframes; later IFC structural analysis view.

**Why:** Lets instructors reuse existing materials and lets learners cross-check in other tools.

**Acceptance:**
- Exported OpenSees script reproduces displacements within 1e-6 relative for the reference set

## Non-functional targets

| id | title | target |
|---|---|---|
| SIM-NFR-01 | Tier 1 live solve latency | Models with predicted factorization time < 100 ms (approximately <= 6,000 DOF frame models or <= 3,000 DOF shell models): end-to-end assemble+factor+solve+recovery p50 < 50 ms, p95 < 100 ms in Chrome/Safari/Firefox on a 2020-class laptop; load-only re-solve < 10 ms |
| SIM-NFR-02 | Tier 2 background solve latency | 6,000-60,000 DOF (frame) or 3,000-30,000 DOF (shell): complete in < 3 s in-browser with progress events at least every 250 ms; factor memory < 1 GB; results remain cancellable |
| SIM-NFR-03 | Tier 3 server solve | Up to 500k DOF linear static < 60 s; modal 20 modes of 100k DOF < 120 s; interactive job queue wait p95 < 5 s, grading lane p95 < 10 s at 100 concurrent submissions |
| SIM-NFR-04 | Determinism | Identical resultHash for the same artifact across all supported browsers, Node, Linux and macOS workers; cross-artifact (version to version) drift documented with max relative difference per benchmark |
| SIM-NFR-05 | Verification coverage | >= 40 benchmark problems; tolerances: 1e-6 relative for exact-element beam/truss problems, 2% for shell benchmarks at reference mesh, 1% for eigenvalues at reference mesh; 100% pass required for release |
| SIM-NFR-06 | Engine load and memory footprint | wasm artifact <= 1.5 MB raw / 500 KB gzipped, instantiated in < 300 ms on first load (cached thereafter); worker memory for Tier-1 models < 200 MB |
| SIM-NFR-07 | UI responsiveness | Main thread never blocked > 16 ms by engine activity; validation on edit < 20 ms for Tier-1 models |
| SIM-NFR-08 | Observability | Every solve emits timings per phase, tier, DOF, nnz(K), nnz(L), warnings; server jobs expose metrics (queue depth, p95 latency, failure rate < 0.1%) |
| SIM-NFR-09 | Numerical safety | No NaN/Inf in any result; singular or diverged analyses always return structured errors; residual //Ku-f/////f// < 1e-8 after refinement for all benchmark models |

## Domain notes (for architecture and UX)

## 1. Solver strategy comparison

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| Custom direct-stiffness in TypeScript | One language, trivial toolchain, same V8 numerics in browser and Node (deterministic), easy debugging | 2-5x slower than wasm for tight loops, no SIMD, GC pauses, no mature sparse Cholesky (would be hand-written), performance ceiling hit by shells (~10k DOF) | Fallback only; keep interface compatible |
| Custom engine in Rust -> WASM (+ native) | Near-native speed, wasm SIMD, memory safety, one crate for client and server, mature LA crates (faer, nalgebra), bit-identical with pure-Rust libm, full control of result model (diagrams, extrema, utilization inputs) | Second language on a small team, wasm-bindgen build pipeline, wasm32 4 GB memory cap, faer wasm support must be verified | **Recommended for MVP and growth core** |
| OpenSees / OpenSeesPy server service | Research-grade nonlinear elements, fiber sections, dynamics, free for research | Not live (process spawn + round trip 200 ms-2 s), scripting layer, results post-processing must be built, UC Berkeley license requires a commercial license for products/cloud services that redistribute it, no browser execution | Growth-phase adapter for advanced nonlinear/dynamic analysis only, after licensing |
| CalculiX (GPL2) / Code_Aster (GPL) | Broad solid/shell capability, free; Code_Aster strong in civil engineering | Beam/frame handling awkward (CalculiX expands beams to solids), heavy installs, slow start-up, server-only, French-centric docs (Code_Aster), GPL process isolation needed | Not recommended |
| Commercial APIs (SkyCiv API, Dlubal RFEM WebService, CSI OAPI) | Validated code checks, no solver maintenance | Per-call quotas/subscription (SkyCiv tiers bundle ~10-50 calls/month on standard plans; enterprise is quote-based), 0.5-3 s latency, no live interaction, opaque versioning breaks grading reproducibility, Windows/COM for CSI, licensing per seat | Not viable at classroom scale |

MVP recommendation: Rust engine crate `bridle-fem` compiled to wasm32 (worker) and native (server), with the server optionally running the identical .wasm under Node/Wasmtime for guaranteed bit-equality. Growth: same crate natively with deterministic multithreaded factorization for Tier 3, plus an OpenSees adapter (licensed) behind the same job queue and model JSON for pushover/time-history, and optional response-spectrum in-house.

## 2. Model-size tiers (reasoning)

Sizing reference: 3D frame node = 6 DOF; truss node = 3; shell node = 6 (5 + drilling).
- Course 2D problems: 10-50 nodes -> < 300 DOF -> ~1 ms anywhere.
- 10-storey 6x6-bay frame: ~540 nodes, 3.2k DOF, 1.3k members; nnz(K) ~ 200k, nnz(L) ~ 1-2M with AMD, ~1e8 flops -> 20-40 ms wasm single-thread (1.5-3 GFLOP/s effective).
- 30x30 slab mesh: 961 nodes, 5.8k DOF, 2D-topology fill-in O(n log n), ~5e8 flops -> ~150-300 ms wasm (Tier 2 boundary).
- 5-storey building with 0.5 m meshed slabs/walls: 20-80k DOF -> Tier 2/3.
Tier definition is by predicted cost from symbolic analysis (nnz(L), flops) scaled by a device calibration factor, not by DOF alone: Tier 1 if predicted < 100 ms; Tier 2 if < 3 s and factor memory < 1 GB; else Tier 3. Rough DOF equivalents: Tier 1 <= 6k DOF frames / 3k DOF shells; Tier 2 <= 60k / 30k; Tier 3 beyond, or any nonlinear/multi-combination P-delta with > 10 combos, moving-load sweeps > 200 positions, or client benchmark below threshold. Factorization reuse: load edits reuse L (ms), geometry edits reuse ordering/symbolic (saves 30-50%).

## 3. Formulation choices

- Frame: 12-DOF Euler-Bernoulli with optional Timoshenko phi = 12 E I / (kappa G A L^2); St Venant torsion with J; Cw stored for LTB design. Releases by static condensation of k_e and consistent fixed-end vector; rigid offsets by transformation T_offset. Local axes (SAP2000-style): local 1 from node I to J; for non-vertical members local 2 lies in the vertical plane through the member pointing toward +Z; for vertical members local 2 = +X global; local 3 = 1 x 2; roll angle rotates 2-3 about 1; orientation vector overrides. Major-axis bending = M3 (about local 3), section web along local 2.
- Truss: axial only; nodes with only truss elements have rotational DOFs eliminated.
- Shell: 4-node flat shell = MITC4 plate (Reissner-Mindlin) + bilinear membrane with Allman-type drilling DOF; 3-node MITC3/DKT + CST-drilling; 2x2 Gauss, nodal extrapolation + averaging with discontinuity flag. Element local x along node1-node2 edge (overridable), z = element normal.
- Springs/links: diagonal 6x6 in local axes; zero length allowed only for typed links.
- Constraints: rigid diaphragm/rigid links by master-slave transformation (keeps SPD system).
- Solver: AMD ordering, supernodal or simplicial LDLT (symmetric indefinite safe for releases/springs), multiple RHS, one step iterative refinement; dense symmetric path < 500 DOF. Eigen: shift-invert Lanczos (or subspace iteration) reusing LDLT; dense Jacobi/QR < 1,000 DOF; fixed deterministic start vectors; modes sign-normalized.
- P-delta: K_G (consistent cubic) from axial forces, iterate; buckling: (K + lambda K_G) phi = 0.
- Area loads: one-way (span direction) or two-way (45-degree tributary envelope) to boundary members as trapezoidal/triangular loads; shells receive pressure via consistent nodal loads.

## 4. Determinism recipe

Sorted entity ids drive assembly order; BTreeMap/sorted Vec only; single-threaded kernel (or fixed reduction trees); `libm` crate for sin/cos/sqrt on all targets; `-C target-feature` fixed; no FMA (Rust default) and no fast-math; eigen start vectors fixed; no clocks/randomness in numerics; results carry engineVersion + artifact SHA-256 + modelHash + resultHash (hash of canonical little-endian f64 arrays). Model canonicalization: RFC 8785 JCS, physical SI values, display units excluded. Grader: always re-run pinned artifact server-side; compare resultHash; expose per-quantity diffs if mismatch (system error path).

## 5. Verification reference set (closed forms; E, I, L, w, P, EI as usual)

Cantilever tip load: delta = P L^3 / (3 E I) (+ P L / (kappa G A) Timoshenko); SS beam UDL: delta = 5 w L^4 / (384 E I), M = w L^2 / 8; fixed-fixed UDL: M_end = w L^2 / 12, M_mid = w L^2 / 24; propped cantilever UDL: R_prop = 3 w L / 8; fixed-fixed settlement Delta: M = 6 E I Delta / L^2, V = 12 E I Delta / L^3; restrained thermal bar: sigma = -E alpha Delta T; portal frame sway (slope-deflection reference); Warren truss (method of joints); beam on springs (hand); Euler buckling P_cr = pi^2 E I / (K L)^2 with K = 1, 0.7, 0.5, 2; cantilever beam frequencies omega_n = (beta_n L)^2 sqrt(E I / (m L^4)), beta L = 1.875, 4.694, 7.855; SS beam omega_n = n^2 pi^2 sqrt(E I / (m L^4)); SDOF spring-mass; SS square plate UDL w_max = 0.00406 q a^4 / D (nu = 0.3), clamped 0.00126 q a^4 / D; MacNeal-Harder: Scordelis-Lo roof 0.3024, pinched cylinder 1.8248e-5, hemispherical shell 0.0924 (standard units), twisted beam; NAFEMS LE1, LE2, LE10, FV32; P-delta amplification 1 / (1 - P / P_cr); influence line SS beam reaction (linear) and midspan moment (peak L/4). Tolerances: 1e-6 relative for exact beam/truss elements, 2% shells at reference mesh, 1% eigenvalues, 2% P-delta.

## 6. Structural model JSON schema outline

```
{ schemaVersion: "1.0.0", id, name, revision: int, createdAt, modifiedAt,
  settings: { mode: "3d"|"2d-xz"|"2d-xy", gravity: [0,0,-9.80665], tolerances:{mergeNodes:0.001}, display:{units:{length:"m",force:"kN",stress:"MPa",...}} },
  materials: [{ id, name, type:"isotropic", E, nu, rho, alpha, design:{ grade, fy, fu | fc, code } , source }],
  sections: [{ id, name, kind:"catalog"|"parametric"|"custom", catalog:{db:"AISC16", label:"W12X26"} | params:{shape:"I", d, bf, tf, tw}, props:{A, Iy, Iz, J, Cw, Sy, Sz, Zy, Zz, ry, rz, Asy, Asz}, outline:[[y,z],...] }],
  nodes: [{ id, x, y, z, levelId? }],
  levels: [{ id, name, elevation }],
  members: [{ id, type:"frame"|"truss", nodeI, nodeJ, sectionId, materialId, orientation:{roll}|{vector:[x,y,z]}, releases:{i:{tx,ty,tz,rx,ry,rz}, j:{...}}, offsets:{i:[dx,dy,dz], j:[...]}, timoshenko:bool, design:{Ky,Kz,Lb,Cb,bracedLateral:bool}, behaviour:"both"|"tension"|"compression" }],
  shells: [{ id, nodes:[n1,n2,n3,(n4)], thickness, materialId, behaviour:"shell"|"plate"|"membrane", localAxes?, regionId? }],
  regions: [{ id, polygon:[nodeIds], openings:[[...]], thickness, materialId, meshSize }],
  links: [{ id, nodeI, nodeJ, stiffness:{tx,ty,tz,rx,ry,rz}, axes }],
  constraints: [{ id, type:"diaphragm"|"rigidLink", master, slaves:[...], levelId? }],
  supports: [{ id, nodeId, dof:{tx:"fixed"|"free"|{k}, ty, tz, rx, ry, rz}, localAxes?:{rotation} }],
  loadCases: [{ id, name, type:"dead"|"superDead"|"live"|"roofLive"|"snow"|"wind"|"seismic"|"temperature"|"settlement"|"other", selfWeight?:{factor,dir}, generator?:{kind, params, derived} }],
  loads: [{ id, caseId, kind:"nodal"|"memberDistributed"|"memberPoint"|"thermal"|"areaPanel"|"shellPressure"|"settlement", target, axes:"global"|"local", projected:bool, values:{...} }],
  panels: [{ id, polygon:[nodeIds], distribution:"oneWay"|"twoWay", spanDir?:[x,y,z] }],
  massSource: { selfWeight:bool, cases:[{caseId,factor}], nodalMasses:[{nodeId,m}] },
  combinations: [{ id, name, type:"strength"|"service"|"seismic", code:"ASCE7-22"|"EN1990"|"NSCP2015"|"custom", terms:[{caseId|comboId, factor}], envelope:bool }],
  analyses: [{ id, type:"linearStatic"|"modal"|"buckling"|"pDelta"|"responseSpectrum"|"movingLoad", params:{...} }],
  meta: { authorId, taskId?, parentModelId?, tags } }
```
Ids: client-generated opaque strings (e.g., `n_01HX...`), immutable, never reused; deletions leave no tombstones in the model but ops log keeps history. Versioning: schemaVersion semver with migration functions; `revision` increments per committed op batch; modelHash over canonical JSON. Results document: `{ resultVersion, modelHash, analysisHash, engineVersion, engineArtifactHash, tier, timings, warnings:[{code, severity, entities, message}], validation, cases:{[caseId]:{nodal:Float64Array(nNodes*6), reactions, memberStations, memberExtrema, shellGauss, shellNodal}}, combinations:{...}, envelopes:{...}, modal:{...}, buckling:{...}, resultHash }`.

## 7. Worker protocol sketch

`loadModel(model) -> {modelHash, validation}`; `applyOps(ops[], seq) -> {modelHash, validation}`; `solve({analyses, cases?, combos?, seq}) -> progress* -> results | cancelled | error`; `query(selector)`; `influenceLine(...)`; `estimate() -> {dof, nnzK, nnzL, flops, predictedMs, tier}`; `benchmark() -> gflops`. Transferables for arrays; JSON for metadata; debounce 30 ms; stale seq dropped.

## 8. Validation codes (examples)

VAL-ORPHAN-NODE, VAL-DUP-NODE, VAL-ZERO-LENGTH, VAL-CROSSING-MEMBERS, VAL-DUP-MEMBER, VAL-MISSING-SECTION, VAL-MISSING-MATERIAL, VAL-BAD-PROPERTY, VAL-NO-SUPPORT, VAL-INSUFFICIENT-SUPPORT, VAL-RELEASE-MECHANISM, VAL-LOAD-TARGET-MISSING, VAL-EMPTY-CASE, VAL-COMBO-CASE-MISSING, VAL-PANEL-NONPLANAR, VAL-PANEL-OPEN, VAL-2D-OUT-OF-PLANE, VAL-SHELL-QUALITY, VAL-ORIENTATION-PARALLEL, ENG-SINGULAR (node, dof), ENG-ILL-CONDITIONED, ENG-RESIDUAL, ENG-EQUILIBRIUM, ENG-NONCONVERGED.

## 9. Code references for load/combination generators

ASCE 7-22 Sec. 2.3 (LRFD) and 2.4 (ASD) combinations, Ch. 7 snow, Ch. 12 ELF (Cs, T_a = C_t h^x, k exponent), Ch. 26-28 wind; EN 1990 6.10/6.10a/6.10b with psi_0/1/2 from EN 1990 Table A1.1; NSCP 2015 Sec. 203 combinations and Sec. 208 seismic (mirrors ASCE 7-05/UBC-97 structure); AISC 360-22 Chapters D-H and C (Direct Analysis); EN 1993-1-1 Sec. 5-6; ACI 318-25 (current, released Jan 2025) for RC checks.

## 10. Risks requiring early spikes

(1) faer-sparse on wasm32 (build + timing); (2) wasm SIMD gains; (3) grader hash equality wasm-in-Node vs native vs browser; (4) MITC4 + drilling implementation vs MacNeal-Harder set; (5) region quad meshing library choice (in-house paving vs triangulation + quad merge).

## Risks

| risk | mitigation |
|---|---|
| Chosen Rust sparse crate (faer-sparse) may not build or perform well on wasm32; wasm support is not officially documented | Week-1 spike compiling and benchmarking faer-sparse on wasm32; fallback is an in-house simplicial LDLT with AMD (CSparse-style, ~2k lines) which is sufficient for Tier 1/2 |
| Small team lacks Rust experience, slowing the engine | Engine scope is bounded and algorithmic; keep the typed worker protocol language-agnostic so a TypeScript implementation of the same interface is a viable fallback for Tier-1 models; pair Rust work with the benchmark suite from day one |
| Live latency targets missed for shell-heavy models in WASM | Tier router degrades gracefully to Tier 2/3; shells are capped by mesh size in tasks; enable wasm SIMD and consider deterministic multi-threading with SharedArrayBuffer later |
| Grader and client disagree numerically (cross-platform drift) | Grader always re-runs the pinned artifact server-side (identical .wasm under Node/Wasmtime or native with libm); hash mismatch is treated as a system error; CI asserts cross-platform hash equality |
| Shell element formulation errors (locking, drilling DOF, sign conventions) | Use established formulations (MITC4/MITC3 bending, Allman-type drilling membrane), patch tests and MacNeal-Harder/NAFEMS benchmarks in CI, cross-check with OpenSees ShellMITC4 |
| OpenSees license restricts commercial cloud redistribution; GPL for CalculiX/Code_Aster | Do not ship OpenSees in the product; use it only for offline validation; if adopted later for advanced analysis, obtain a UC Berkeley commercial license first and run it as an isolated service |
| Area-load distribution and projected-load assumptions differ from what instructors expect | Make distribution method explicit per panel, render the derived member loads, document algorithms, and let task authors fix the method |
| Design-code scope creep (AISC, EC3, ACI, NSCP, timber, aluminium) | Stable engine-to-design-check contract; ship AISC 360-22 + EC3 steel in MVP, ACI 318-25 next; codes are plugins with their own verification examples |
| Unstable or ill-conditioned student models produce confusing failures and support load | Invest early in DOF-localized mechanism messages, validation auto-fixes and residual/equilibrium checks surfaced in the UI |

## Open questions

- Primary code jurisdiction for MVP tasks: ASCE 7-22/AISC 360-22/ACI 318-25 (US), Eurocodes, or NSCP 2015 (Philippines)? This determines combination generators and the first design-check plugins.
- Is reinforced concrete design (ACI 318-25) required at MVP or can steel-only checks ship first?
- Should task authors be able to cap model size per task (e.g., max DOF or mesh size) to guarantee Tier-1 behaviour for all learners?
- Do instructors need nonlinear static (pushover) or time-history analysis in v1.x, which would justify an OpenSees adapter earlier?
- Is 2D-only (planar) a separate simplified workspace mode or just an analysis flag with 3D rendering?
- Section database licensing: AISC Shapes Database v16 is freely redistributable; confirm sources for European profile tables and any attribution requirements.
- Should the grader trust client-reported results for fast feedback (with server verification later) or always wait for the server re-run before scoring?
- Expected maximum model size from instructors (e.g., meshed multi-storey buildings) to size Tier-3 workers and storage.
- Is import from existing instructor material (SAP2000/ETABS, RISA, DXF) needed early for course migration?
