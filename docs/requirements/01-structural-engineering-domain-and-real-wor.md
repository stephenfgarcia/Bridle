# Structural engineering domain and real-world grading criteria

_Source: requirements discovery workflow `wf_6281c128-0bb` (domain agent), 2026-11-03. 47 requirements: 39 must (MVP), 7 should (v1.x), 1 could (later)._

## Summary

Bridle's differentiator is that the simulation and grader honor real structural-engineering codes rather than a toy physics model, so this domain defines what "real-world" means concretely: a tiered task catalog (determinate beams through multi-story 3D frames, bridges and towers), a pluggable, versioned "code pack" model whose first pack is US (ASCE 7-22 loads/combinations, AISC 360-22 steel, ACI 318-19 concrete; NDS 2024 optional) with Eurocode (first-generation EN 1990/1991/1992/1993 with second-generation as a later pack version) and NSCP 2015 (Philippines, UBC-97-derived seismic and ASCE/ACI/AISC-derived members) following. Verified facts that shape decisions: ACI 318-25 was released in 2025 but IBC 2024 still references 318-19 (318-25 expected with IBC 2027), NSCP 2015 7th edition is still current, second-generation Eurocodes are published but national annexes are pending and first-generation texts are withdrawn only on 30 March 2028, and AISC Shapes Database v16.0 is the current shapes source. The site/environment scenario (risk category, occupancy, wind, seismic, snow, temperature, soil/foundation) is a first-class data object that deterministically derives load cases and combinations, with author-defined per-learner randomization ranges and seeded, feasibility-verified reference solutions for benchmarks. Grading must be deterministic-first: a checks engine produces clause-referenced evidence (demand/capacity ratios, serviceability ratios, model-validity findings, economy metrics), and the AI layer only explains, grades the written justification, and assigns rubric partial credit; it can never override a strength or stability fail. "Good" is defined measurably: governing members in a 0.70-1.00 utilization band, weight/cost within 5% of a seeded benchmark, continuous load path and lateral systems in both directions, rationalized section groups, and constructability heuristics. The grader must detect the classic learner mistakes (mechanisms, unrealistic supports, missing load cases/combos, unit errors, omitted self-weight, wrong unbraced lengths/K, ignored second-order effects, over/under-design, RC detailing violations). Architecture implications: an SI-internal units layer, versioned reference datasets with provenance, a verification suite against published worked examples, and immutable pack versions bound to published tasks.

## Must (MVP)

### CAT-01 Tiered task catalog with difficulty progression

Define six tiers that drive curriculum, unlockable simulator features and grader strictness: T1 determinate beams (simply supported, cantilever, overhang; analysis only); T2 continuous beams and 2D trusses (determinate and indeterminate); T3 steel member design (beams with LTB, columns, beam-columns, tension members) and 3D trusses; T4 2D portal/braced/moment frames and RC beams, columns, one-way slabs; T5 multi-story 3D frames with wind and seismic ELF loads, diaphragms and second-order effects; T6 capstone pedestrian truss/through bridges, lattice towers and open design-optimization challenges. Each tier declares learning objectives and prerequisite tiers.

**Why:** A progression lets a university course map weeks to tiers and lets the simulator hide features (e.g., P-delta, seismic) until they are taught; it also tells the grader which mistakes are expected at each level.

**Acceptance:**
- Catalog is data (not code) with fields: tier, structure type, allowed element types, required analysis type, enabled check modules, required site inputs, learning objectives, prerequisites
- Every tier has at least 3 seed task templates in the MVP content pack
- A T1 task cannot be published with seismic or second-order checks enabled unless the author overrides explicitly

### CAT-02 Structure-type taxonomy and element capabilities

Enumerate the structure types with the element formulations each requires: beam (1D Euler-Bernoulli, with optional Timoshenko shear deformation), truss (pin-jointed, axial only, nodal loads only), 2D frame (3 DOF/node), 3D frame (6 DOF/node with end releases, rigid offsets, member loads), plate/shell (RC slabs, v1.x), and RC member design driven by frame forces. Supports: pinned, fixed, roller (any direction), inclined, translational/rotational springs.

**Why:** The grader can only reason about mistakes it can represent (e.g., non-nodal loads on a truss member); the taxonomy fixes what the FE core must support in the MVP versus later.

**Acceptance:**
- MVP supports beam, truss, 2D and 3D frame; shell elements are feature-flagged for v1.x
- Each structure type lists the checks and site inputs that apply to it (e.g., trusses: no LTB check on chords unless modeled as beams; frames: drift)
- End releases and member loads work in 3D frames and are covered by regression tests against hand solutions

### CAT-03 Task archetypes

Every task is one of five archetypes: Analyze (compute reactions, forces, deflections of a given structure), Check (verify a given design against the code and report pass/fail with reasons), Design (select sections/reinforcement/bracing to satisfy all checks), Optimize (minimize weight or cost index subject to all checks and constraints, scored against a benchmark), Diagnose (a model seeded with 1-3 errors; the learner must find and fix them). Archetype determines which rubric categories are active.

**Why:** Analysis-only courses and design-optimization practice need different grading; a single archetype model would force the grader to penalize things the task never asked for.

**Acceptance:**
- Rubric weights default per archetype (e.g., Analyze: economy weight 0)
- Diagnose tasks store the seeded error list and the grader scores detection and correct fix separately
- Optimize tasks require a seeded benchmark (see SITE-03, GRD-05) before publishing

### CAT-04 Author constraints and analysis fidelity per task

Authors can lock geometry, supports, loads, materials or section families; set allowed section catalogs (e.g., only W-shapes 8-24 deep; only IPE/HEA), max member count, min/max section depth, allowed lateral systems, and the analysis fidelity required: linear static (T1-T4), second-order via geometric stiffness or B1/B2 amplification (T5+), seismic ELF (T5+), modal response spectrum (could). Locked fields are not editable by learners and edits to them are impossible rather than merely flagged.

**Why:** Locking is both pedagogy (focus the exercise) and anti-gaming (students cannot stiffen a material to pass deflection); fidelity flags tell the grader which second-order/seismic omissions are a learner error versus out of scope.

**Acceptance:**
- Task schema includes lock flags per entity class and per field
- A learner's attempt payload that modifies a locked field is rejected server-side
- Second-order analysis is mandatory when task fidelity is T5+ and the grader flags B2 > 1.1 ignored (see ERR-06)

### CODE-01 Pluggable, versioned code pack architecture with clause traceability

A code pack is an immutable, versioned bundle: load-combination generator (LRFD/ASD or STR/SLS), load derivation modules (wind, seismic, snow, live, dead/SDL), member check modules per material, serviceability limit table, stability method rules, code-minimum/detailing rules, consistency rules, native unit system, and a clause map. Every check result carries pack id+version, clause id, governing equation with substituted values and units, demand, capacity and ratio. Tasks bind to a specific pack version; publishing a task freezes it.

**Why:** Eurocode and NSCP packs must be added without touching the FE core or grader, and the AI explanations must cite exactly what the deterministic engine computed.

**Acceptance:**
- Pack interface documented with a conformance test suite any new pack must pass
- US pack v1 = ASCE 7-22 + AISC 360-22 + ACI 318-19; pack version strings appear in every grade report
- Changing a pack version never alters grades of already-published tasks (regression test)

### CODE-02 ASCE 7-22 load combinations (LRFD and ASD)

Generate the full combination set: LRFD 2.3.1 (1.4D; 1.2D+1.6L+0.5(Lr|S|R); 1.2D+1.6(Lr|S|R)+(L|0.5W); 1.2D+1.0W+L+0.5(Lr|S|R); 0.9D+1.0W) and seismic 2.3.6 (1.2D+Ev+Eh+L+0.2S; 0.9D-Ev+Eh with Ev=0.2·SDS·D, Eh=ρ·QE, plus overstrength Ω0 variants); ASD 2.4.1 (D; D+L; D+(Lr|S|R); D+0.75L+0.75(Lr|S|R); D+0.6W; D+0.75L+0.75(0.6W)+0.75(Lr|S|R); 0.6D+0.6W) and ASD seismic (D+0.7Ev+0.7Eh; D+0.525Ev+0.525Eh+0.75L+0.75S; 0.6D-0.7Ev+0.7Eh). Apply the 0.5 factor on L where Lo <= 100 psf except garages and public assembly. Expand W and E into all directions/signs (+/-X, +/-Y, +/-GCpi, accidental torsion where 3D).

**Why:** Missing or wrong combinations are among the top learner errors; the engine must own the complete enumerated set so the grader can diff the learner's set against it.

**Acceptance:**
- Generated combination list for a 3D building with D,L,Lr,S,W,E matches a hand-prepared reference list exactly (name, factors, directions)
- Learner may author combinations manually in tasks that require it; the grader diffs against the generated set
- Service combinations (D+L, D+0.5L, D+0.7E, 0.42W drift etc. per task) are generated for serviceability checks

### CODE-03 AISC 360-22 steel member checks

Implement, for both LRFD (phi) and ASD (Omega): tension (D2 yielding and rupture with U), compression (E3 flexural buckling, E4 torsional/flexural-torsional for singly symmetric and double angles, E7 slender elements), flexure (F2 compact doubly symmetric I with Lp/Lr/LTB and Cb; F3 noncompact flange; F6 weak axis; F7 HSS; F9 tees and F10 angles basic), shear (G2 with Cv1), combined forces (H1-1a/b), section classification (Table B4.1a/b), and slenderness advisories (Lc/r <= 200 compression, L/r <= 300 tension). Report governing limit state per member.

**Why:** Steel is the backbone of T3-T6; LTB and beam-column interaction are the two checks students most often misunderstand and must be computed, not approximated.

**Acceptance:**
- Reproduces AISC Design Examples v16.0 for W-beams (flexure/LTB), columns, beam-columns, HSS and tension members within 2% of published capacities
- Each member report lists classification, Lb, Cb, Lcx/Lcy, K, phi/Omega, governing limit state and ratio
- Bending about weak axis of W beams and use of Mp for noncompact sections are detected and reported

### CODE-04 Stability: Direct Analysis Method, Effective Length Method and P-delta

Support AISC Chapter C Direct Analysis Method (0.8 and tau_b stiffness reduction, notional loads 0.002*alpha*Yi, second-order analysis by geometric stiffness or Appendix 8 B1/B2 amplifiers) and the Effective Length Method (K from alignment-chart approximation or author-provided; permitted only if Delta2nd/Delta1st <= 1.5). Compute and report the sway amplification ratio per story and the seismic stability coefficient theta per ASCE 7-22 12.8.7 (ignore if <= 0.10; fail if > theta_max = 0.5/(beta*Cd) <= 0.25).

**Why:** Stability is where small frames 'pass' member checks yet are unsafe; a graded simulator without second-order effects would teach wrong habits.

**Acceptance:**
- Second-order results for the AISC benchmark problems (Chapter C commentary cantilever and sway frame) within 3% of published values
- Grader reports which stability method the learner used and whether its limits were respected
- Story P-delta coefficient theta appears in seismic results with pass/ignore/fail status

### CODE-05 ACI 318-19 reinforced concrete member checks and code minimums

Beams: flexure by strain compatibility with phi from 0.65 to 0.90 by net tensile strain, beam strain limit et >= ety+0.003 (9.3.3.1), As,min = max(3*sqrt(f'c)/fy, 200/fy)*bw*d, shear per Table 22.5.5.1 including the size-effect factor lambda_s and rho_w term, Av,min trigger (Vu > phi*lambda*sqrt(f'c)*bw*d), stirrup spacing d/2 or 24 in (d/4 or 12 in when Vs > 4*sqrt(f'c)*bw*d), Vs <= 8*sqrt(f'c)*bw*d, bar fit (clear spacing >= max(1 in, db, 4/3 dagg)), cover (Table 20.5.1.3.1). Columns: Pn,max = 0.80/0.85*phi*Po, 1% <= rho <= 8%, minimum 4 (tied)/6 (spiral) bars, tie spacing <= min(16db, 48dtie, least dimension), slenderness screening (6.2.5, klu/r <= 22 sway, <= 34+12M1/M2 braced) and moment magnification for slender columns. One-way slabs: Table 7.3.1.1 minimum thickness, temperature/shrinkage steel 0.0018*Ag (Grade 60), max spacing 3h or 18 in. Serviceability: Table 9.3.1.1 span/depth or computed deflection with Ie and long-term factor lambda_delta = xi/(1+50*rho').

**Why:** Code minimums (min steel, spacing, cover, tie spacing) are exactly the 'real-world' items students skip; they must be checked, not just the strength ratio.

**Acceptance:**
- Reproduces ACI SP-17(19) handbook examples for beam flexure, shear and tied columns within 2%
- Every RC member report lists rho, et, phi, As,min status, stirrup spacing status, bar fit status, cover status
- Development/anchorage length checks are 'could' and clearly labeled as not performed in MVP reports

### CODE-06 ASCE 7-22 wind loads (MWFRS directional procedure)

Derive wind pressures from the site scenario: qz = 0.00256*Kz*Kzt*Kd*Ke*V^2 (psf; SI equivalent 0.613), Kz by exposure B/C/D using the ASCE 7-22 terrain constants (alpha/zg: B 7.5/3280 ft, C 9.8/2460 ft, D 11.5/1935 ft) and Kz = 2.41*(z/zg)^(2/alpha), Kd = 0.85 buildings, G = 0.85 rigid (flexible gust factor could), Cp windward 0.8, leeward -0.5/-0.3/-0.2 by L/B, side -0.7, roof Cp by h/L and slope (Fig 27.3-1), GCpi +/-0.18 enclosed, +/-0.55 partially enclosed, minimum 16 psf walls / 8 psf roof. Basic wind speed V is the Risk-Category map value. Apply as nodal/member loads on the exposed frames by tributary width in +/-X and +/-Y with both internal pressure signs. Note ASCE 7-22 W is strength-level (1.0W LRFD, 0.6W ASD).

**Why:** Wind is the most common lateral load in the catalog and the 1.6W-vs-1.0W double counting is a classic error the grader must catch.

**Acceptance:**
- Pressures for a reference 3-story enclosed building (V = 115 mph, Exposure C) match a hand calculation within 1%
- Learner can view the derived pressure diagram and the Kz table used
- Grader flags any combination using 1.6W or 1.3W with ASCE 7-22 speeds

### CODE-07 ASCE 7-22 seismic Equivalent Lateral Force procedure

From Ss, S1, site class (A-F; D default when unknown), Risk Category and TL: Fa/Fv (Tables 11.4-1/2), SMS/SM1, SDS/SD1, SDC (Tables 11.6-1/2, E/F when S1 >= 0.75), Ie (1.0/1.25/1.5), system R/Omega0/Cd and height/SDC permissions from Table 12.2-1 (e.g., steel SMF 8/3/5.5, steel OMF 3.5/3/3 NP in D-F except exceptions, SCBF 6/2/5, OCBF 3.25/2/3.25, BRBF 8/2.5/5, 'steel not detailed' 3/3/3 B-C only, RC SMF 8/3/5.5, RC IMF 5/3/4.5, RC OMF 3/3/2.5 NP in C+), Ta = Ct*hn^x (0.028/0.8 steel MF, 0.016/0.9 RC MF, 0.03/0.75 EBF/BRBF, 0.02/0.75 other) with Cu cap, Cs = SDS/(R/Ie) with SD1/(T*(R/Ie)) cap and floors 0.044*SDS*Ie >= 0.01 (and 0.5*S1/(R/Ie) when S1 >= 0.6), V = Cs*W, vertical distribution with k, 5% accidental torsion in 3D, rho = 1.0 or 1.3, Ev = 0.2*SDS*D, story drift Delta = Cd*delta_xe/Ie against Table 12.12-1 (0.020/0.015/0.010 hsx by Risk Category; 0.025/0.020/0.015 for <= 4 stories with accommodating nonstructural). Modal response spectrum and the multi-period spectrum are 'could'.

**Why:** Seismic is where system choice (R), detailing permissions and drift interact; it is the core of T5 tasks and NSCP-region relevance.

**Acceptance:**
- Base shear and story forces for a reference 4-story steel SMF (Ss 1.5, S1 0.6, Site D) match hand calc within 1%
- Grader fails a system that is NP for the resulting SDC or exceeds its height limit
- Drift report shows delta_xe, Cd, Ie, Delta, allowable, ratio per story and direction

### CODE-08 Snow, occupancy live loads and live load reduction (ASCE 7-22)

Snow: pf = 0.7*Ce*Ct*Is*pg (Ce 0.9-1.2 by exposure, Ct 1.0/1.1/1.2, Is by Risk Category), low-slope minimum pm, sloped ps = Cs*pf; unbalanced and drift loads are 'should'. Live: Table 4.3-1 values embedded (office 50 psf + 15 psf partition allowance, residential 40, classrooms 40, corridors 80/100, assembly 100, library stacks 150, light/heavy storage 125/250, retail 100, stairs 100, roof Lr 20 reducible to 12, parking 40). Reduction 4.7: L = Lo*(0.25 + 15/sqrt(KLL*AT)) (SI 4.57) with KLL per Table 4.7-1, floors 0.5Lo / 0.4Lo for one / two+ floors, not for Lo > 100 psf (20% for 2+ floor columns), not for assembly, KLL*AT >= 400 ft2. Partitions required where live load < 80 psf.

**Why:** Correct occupancy loads and reduction rules are the first 'real-world' decision in any design task and are randomizable per learner.

**Acceptance:**
- Live-load reduction for interior column tributary 900 ft2 (KLL = 4) reproduces 0.5-floor result 0.25+15/60 = 0.50 -> clamped per rules
- Snow load for pg 30 psf, Ce 1.0, Ct 1.0, Is 1.0 = 21 psf, with pm = 20 psf comparison shown
- Grader flags omitted partition allowance and omitted roof live load where applicable

### CODE-09 Serviceability limit table (deflection and drift)

Default limits (author-overridable per task, learner-visible): floor live-load deflection L/360, total load L/240, roof L/180 (no ceiling) / L/240, members supporting brittle finishes L/480, cantilevers 2L/360 (i.e., L/180 on cantilever length), crane/bridges L/600-L/800 (T6), RC per ACI Table 24.2.2 including long-term; lateral: wind total drift H/400 and story drift h/400 under 10-year wind (0.42W per ASCE 7 Commentary CC.2.2, author-selectable), seismic drift per CODE-07; vibration is 'could'. Deflection checks use service (unfactored) combinations; RC uses effective inertia Ie and creep multiplier; steel uses gross I.

**Why:** Students routinely pass strength and fail serviceability or check deflection under factored loads; the limits and the combination to use must be explicit.

**Acceptance:**
- Each member reports max deflection, span, ratio L/x, limit, pass/fail per applicable load case
- Learner UI shows the active limit table for the task
- Grader detects deflection computed under factored combinations (ERR-07)

### SITE-01 Site/environment scenario schema

A task defines a Scenario object: risk category (I-IV), occupancy per floor/roof, location (named site or lat/long, drives hazard values), wind (V by risk category, exposure B/C/D, Kzt, enclosure class, ground elevation Ke), seismic (Ss, S1, TL, site class, optional PGA; NSCP: zone, soil profile, source type, fault distance), snow (pg, Ce, Ct, roof slope and heating), rain/ponding (could), temperature (installation temp and +/- delta T), soil (allowable bearing qa, soil type, water table, foundation type: isolated spread / strip / mat / piles; base fixity assumption), superimposed dead loads per surface (finishes, partitions, ceiling/MEP, roofing, cladding). Each parameter is fixed, hidden (learner must look it up from the brief), or randomized (SITE-03).

**Why:** This object is the 'environment' the AI grader evaluates against; it must be structured so loads derive deterministically and the grader can test consistency.

**Acceptance:**
- JSON schema with validation (ranges, enums, unit tags) and example scenarios for 10 named sites across US/EU/PH
- Learner-facing brief renders the scenario in the task's unit system
- Every derived load references the scenario parameters it came from

### SITE-02 Deterministic load derivation from scenario

The engine translates the scenario into load cases D (computed self-weight from sections and material unit weights, plus SDL by surface), L (occupancy with reduction), Lr, S, W (per direction/sign), E (per direction with Ev and torsion), T (thermal on restrained members, alpha steel 6.5e-6/F, concrete 5.5e-6/F) and H (lateral soil, could); applies them by tributary area to the modeled framing or as surface loads on one-way/two-way decks; then generates combinations per the code pack. In 'manual-loads' tasks, auto derivation is off and the learner must enter loads; the engine still computes the expected loads privately for grading.

**Why:** Automating load derivation keeps design tasks focused and gives the grader a ground truth to compare learner-entered loads against.

**Acceptance:**
- Tributary distribution of a 25 psf SDL + 50 psf L on a 30 ft x 30 ft bay reproduces beam line loads within 1%
- Self-weight updates live when a section changes and appears as a separate, non-editable line in D
- A 'show my loads' panel lists every load with its source parameter and clause

### SITE-03 Per-learner randomization with seeded, feasibility-verified benchmarks

Authors mark parameters randomizable with ranges, steps or discrete sets: spans and bay widths (+/-20%, steps of 0.5 m / 1 ft), story heights (3.0-4.5 m), number of bays/stories (small integer ranges), occupancy category, V (map values 95-180 mph or 150-290 km/h), exposure, (Ss, S1) pairs drawn from a curated site list so they stay physically consistent, pg (0-70 psf), qa (1500-4000 psf / 75-200 kPa), material grades (A992/A36/A572; f'c 3-6 ksi / 21-42 MPa; Grade 60/80, 275/415), risk category, delta T. The seed is deterministic per (learner, task, attempt policy). For each seed the platform generates a reference solution via the built-in optimizer under the same constraints; seeds whose reference fails any check are rejected and resampled. Benchmarks for economy scoring come from the seeded reference, never a fixed number.

**Why:** Randomization prevents answer sharing but is only fair if every learner's variant is solvable and benchmarked under its own conditions.

**Acceptance:**
- Same learner+task yields the same scenario on reload; different learners differ in at least 2 parameters
- Infeasible seeds are detected at publish time (batch-check 200 seeds) and at assignment time
- Seeded benchmark weight/cost stored with the attempt and shown after grading

### SITE-05 Foundation and support realism checks

Supports must be consistent with the scenario's foundation type and soil: fixed base requires a foundation capable of moment (mat, large footing, pile cap) and is flagged on isolated footings in soft soil (qa < 2000 psf); braced-frame and gravity columns default to pinned; roller supports on buildings flagged; spring supports require stiffness justification. Simplified bearing check: service reactions / footing area <= qa with a learner-sized footing or an auto-sized footing (sqrt(P/qa)), reported as 'foundation feasibility' (not full ACI Chapter 13 design).

**Why:** 'Unrealistic supports' is a named learner mistake; the soil parameters in the scenario are pointless unless some check consumes them.

**Acceptance:**
- Support consistency findings cite the scenario foundation type and soil
- Reaction table includes service and factored reactions and auto-sized footing dimensions
- Overturning/uplift at supports under 0.9D+W or 0.6D+0.6W is reported

### SITE-06 Scenario-structure consistency rules

Rule set evaluated before grading: snow load present only where pg > 0; seismic required where SDC >= B per pack (SDC A exempt); system R permitted in resulting SDC and height; OMF/OCBF restrictions in SDC D-F; exposure D only for sites flagged coastal/open water; wind speed consistent with risk-category map; thermal case required when restrained length > 300 ft (90 m) or temperature range given; partition allowance where occupancy requires; Risk Category IV implies Ie, Is and drift limits updated together.

**Why:** These are the 'engineering judgment' consistency checks a reviewing engineer makes; encoding them is cheap and catches many environment-related errors.

**Acceptance:**
- Rules are data-driven per pack with id, condition, message, severity
- At least 15 rules in the US pack with unit tests for true/false cases

### QUAL-01 Utilization targets and efficiency score

Per member, the governing demand/capacity ratio and governing criterion (strength limit state, deflection, drift, slenderness, minimum size, rationalization group). Efficiency score = mass-weighted sum of f(DC): f = 1.0 for 0.70-1.00; 0.7 for 0.50-0.70; 0.3 for 0.30-0.50; 0 below 0.30; members whose governing criterion is serviceability, slenderness, code minimum, connection or group-rationalization are scored 1.0 regardless. DC > 1.00 is a strength failure (GRD-03), not an efficiency matter.

**Why:** Defines 'well-proportioned' in a way that does not punish members legitimately governed by deflection or standardization.

**Acceptance:**
- Member table sortable by DC with governing criterion and the band color
- Score reproduces hand calculation on a 10-member test frame

### QUAL-02 Material economy versus seeded benchmark

Compute steel mass (t), concrete volume (m3), rebar mass (t), formwork area (m2) and a cost index using author-configurable regional unit costs (defaults: fabricated steel per t, concrete per m3, rebar per t, formwork per m2 in USD/EUR/PHP). Score = 100% if ratio r = learner/benchmark <= 1.05; linear to 0% at r = 1.50; bonus up to +5% when r < 0.95 with every check passing. Benchmark = seeded reference solution (SITE-03); authors can replace it with a curated solution.

**Why:** Design optimization is a stated 'best for'; without a fair benchmark, economy scoring is arbitrary.

**Acceptance:**
- Economy panel shows mass/cost live and benchmark band after submission
- Unit-cost table versioned per region with effective date

### QUAL-03 Redundancy and load path evaluation

Gates: every applied load has a connected path to supports (graph connectivity on the stiffness graph); lateral-force-resisting elements exist in both orthogonal directions for 3D buildings; diaphragm or bracing ties floors to the LFRS. Metrics: degree of static indeterminacy, share of total gravity load carried by any single member with DC > 0.9 (flag > 30%), single-member-removal stability for author-designated key elements (alternate path, 'should'), torsional irregularity check (max/avg drift > 1.2).

**Why:** Real-world robustness is not captured by member ratios; load path and redundancy are explicit engineering-judgment criteria reviewers apply.

**Acceptance:**
- Connectivity gate failure returns the unconnected node/member ids
- Redundancy metrics appear in the grade report with pass/flag states

### QUAL-05 Engineering judgment justification (structured write-up)

Design tasks require a structured justification: system selection and why, load path description, governing combinations and members, key assumptions (supports, bracing, Lb, K, diaphragm), what controlled (strength/deflection/drift), and what the learner would change. The AI grader scores each section 0-4 against a rubric and cross-checks factual claims against the evidence (e.g., 'LTB governed B3' is verified against B3's governing limit state; 'deflection controlled' verified against ratios). Unsupported or contradicted claims lose credit.

**Why:** Judgment is a stated grading criterion and the only place an LLM adds unique value; evidence cross-checking keeps it honest.

**Acceptance:**
- Template fields are mandatory; min word counts per field configurable
- Grade report shows per-field score, verified/contradicted claims with evidence links
- Two gradings of the same text at temperature 0 differ by <= 1 point per field

### ERR-01 Mechanism, instability and modeling-error detection

Before analysis: detect singular or ill-conditioned stiffness (rigid-body modes, unbraced pin-jointed quadrilaterals, zero-stiffness rotational DOFs at truss-only nodes, members released at both ends, disconnected substructures, coincident-but-unmerged nodes, duplicate or zero-length members, missing diaphragm constraints). Report the mechanism as the null-space mode (which nodes/DOFs move) and render it in the 3D view.

**Why:** An unstable model that merely errors out teaches nothing; showing the mechanism is the core pedagogical feedback in T1-T2.

**Acceptance:**
- Null-space mode computed and animated for a square pin-jointed truss without diagonal
- Coincident nodes within 1 mm are flagged with merge suggestion
- Condition number threshold tuned on a 50-model test set with 0 false positives on sound models

### ERR-02 Unrealistic support detection

Flag: all nodes restrained or more than 2 fixed supports on a simple beam, supports introduced mid-span not in the task, fixed bases inconsistent with the foundation scenario (SITE-05), roller orientation preventing load transfer, both ends of a frame pinned with no bracing (sway mechanism), supports on nodes with no connected member, restrained thermal members without expansion provision.

**Why:** Named learner mistake; students 'fix' instability by over-restraining, which hides errors and yields unrealistic results.

**Acceptance:**
- Each finding references support id and the rule violated
- 'Over-restraint' is Major severity on Design tasks, Critical on Diagnose tasks when it masks a seeded error

### ERR-03 Missing load cases, combinations and wrong factors

Diff the learner's load cases and combinations against the pack-generated set for the scenario: missing cases (no W on enclosed building, no S where pg > 0, no E where SDC >= B, no Lr on roof, no Ev), missing combinations (e.g., 0.9D+W uplift, seismic with vertical), wrong factors (ASD factors in LRFD run, 1.6W with ASCE 7-22, 1.0E in NSCP without rho/Ev), one-direction-only wind/seismic, missing pattern live loading on continuous beams (alternate spans) where required.

**Why:** The most common source of unsafe 'passing' designs.

**Acceptance:**
- Diff output lists missing/extra/incorrect combinations with expected factors
- Pattern-loading omission on continuous beams is detected via envelope comparison (> 5% moment difference)

### ERR-04 Unit and magnitude plausibility detection

Plausibility bands per quantity: E (steel 190-210 GPa, concrete 15-45 GPa), densities (7850 kg/m3 steel, 2400 kg/m3 RC), live loads 0.5-15 kPa, point loads vs span, member lengths 0.3-60 m, section dimensions vs catalog, f'c 17-70 MPa, Fy 235-485 MPa, delta T <= 60 C. Out-of-band values trigger 'likely unit error' hints (e.g., value looks like psf entered as kPa, inches as mm) with the probable conversion factor identified (x12, x25.4, x47.88, x1000).

**Why:** Unit errors are catastrophic in practice and are explicitly cited as a grader target; conversion-factor fingerprinting makes the hint actionable.

**Acceptance:**
- Detector recognizes the four common factor fingerprints on a seeded test set with >= 90% recall
- Material property edits outside bands are blocked when the task locks materials

### ERR-05 Self-weight omission and load application errors

Compare learner dead load to engine-computed self-weight + SDL per member; flag D < self-weight or D within 5% of SDL only ('self-weight omitted'). Detect loads applied to truss members mid-length (bending in a pin-jointed element), area loads not distributed by tributary width, gravity loads with upward sign, point loads at non-nodal coordinates when the task expects nodal, loads applied to the wrong story or surface, missing cladding/parapet loads where scenario provides them.

**Why:** Self-weight omission is explicitly listed; mis-applied loads invalidate otherwise correct designs.

**Acceptance:**
- Self-weight omission detected on a manual-loads task with 100% precision on the seeded test set
- Truss member mid-span load produces a 'non-nodal load on truss' Major finding

### ERR-06 Unbraced length, effective length and stability-method misuse

Lb for LTB must come from modeled lateral bracing or declared bracing conditions (continuous top-flange by deck/slab, discrete braces at purlins/joists); grader compares learner Lb to geometric bracing spacing and flags Lb < actual spacing. K/Lc inconsistent with sway condition (K = 1.0 columns in an unbraced moment frame under ELM), Lcx vs Lcy mismatch with intermediate bracing, truss top chord unbraced out of plane without purlins, ELM used with Delta2nd/Delta1st > 1.5, notional loads omitted under DAM, second-order effects ignored where B2 > 1.1, seismic theta > 0.10 not amplified.

**Why:** Unbraced length and K errors are the most consequential steel-design misconceptions and directly affect LTB/column capacity.

**Acceptance:**
- Bracing can be modeled (members) or declared (per-member flags); declared bracing is shown in the 3D view
- Lb mismatch finding shows learner Lb, geometric spacing, and capacity change if corrected

### ERR-07 Over/under-design and serviceability omission

Under-design: any DC > 1.00 (Critical if primary member: column, girder, chord, brace, transfer element; Major if secondary), deflection/drift ratio > 1.0 (Major; seismic drift Critical). Over-design: >= 60% of mass in members with DC < 0.30 not governed by other criteria (Minor, reduces efficiency score); deflection checked under factored loads (Minor, 'over-conservative method'); no service combination run at all (Major); RC immediate-only deflection where long-term applies (Minor).

**Why:** Codifies 'passing vs good' and the common habit of either skipping serviceability or checking it with the wrong loads.

**Acceptance:**
- Primary/secondary classification derived from load-path share and element role, overridable by author
- Service-combination presence verified from the attempt's run log

### ERR-08 Section/material misuse and RC detailing violations

Steel: A36 used for W-shapes (warn; A992 standard), HSS with A36 (warn; A500), slender-element sections used without Q/E7 reduction, Mp used for noncompact/slender flanges, weak-axis bending of W beams, round HSS/pipe used as beams with LTB claimed, Fy > 65 ksi without pack support. Concrete: f'c < 2500 psi (17 MPa), fy > 80 ksi flexure or > 60 ksi shear, rho_column outside 1-8%, bars that do not fit, cover below Table 20.5.1.3.1, stirrup spacing > d/2, no stirrups where required, tie spacing exceeded, slab thinner than Table 7.3.1.1 without deflection calc, bar sizes not in the regional catalog.

**Why:** These are the 'code minimums' the brief asks for and the mistakes that a plan checker would reject first.

**Acceptance:**
- Each rule has clause reference and severity; at least 20 rules implemented with unit tests
- Regional rebar catalogs (US/EU/PH) enforce available sizes per pack

### REF-01 AISC Shapes Database v16.0

Import all shape families (W, M, S, HP, C, MC, L, WT, MT, ST, 2L, HSS rectangular/square/round, Pipe) with full property sets in both unit systems (A, d, bf, tf, tw, k, Ix, Sx, Zx, rx, Iy, Sy, Zy, ry, J, Cw, rts, ho, bf/2tf, h/tw, weight, surface area) plus flags: availability/common-sizes for pedagogy, preferred material (A992/A500/A36), and 'T_F' special flange notes.

**Why:** Section properties drive every steel check; v16.0 matches AISC 360-22 and the 16th Edition Manual.

**Acceptance:**
- Row count and spot-checked properties (W14x90, HSS8x8x1/2, L4x4x1/2, W24x76) match the published Excel
- Dataset versioned, checksummed, with license/provenance note

### REF-03 Material library

Steel: ASTM A992 (Fy 50 / Fu 65 ksi), A36 (36/58), A572 Gr 50, A500 Gr C (rect 50 / round 46 ksi), A53 Gr B (35), E 29,000 ksi, G 11,200 ksi, nu 0.3, density 490 pcf (7850 kg/m3), alpha 6.5e-6/F; EN S235/S275/S355 (E 210 GPa, fy by thickness); PH A36 (248 MPa) and A572 (345 MPa). Concrete: f'c 3/4/5/6 ksi (and 21/28/35/42, PH 20.7/27.6 MPa), Ec = 57000*sqrt(f'c) psi (4700*sqrt(f'c) MPa), lambda 1.0/0.75, unit weight 150 pcf RC (23.5-24 kN/m3), alpha 5.5e-6/F; EN C20/25-C50/60 (Ecm, fctm, alpha_cc). Rebar: Grade 60 (420 MPa) and 80; PH Grade 275/415; EU B500B (fyk 500 MPa). Wood (could).

**Why:** Grader plausibility bands (ERR-04) and all checks depend on vetted properties; learners should select, not type, materials in locked tasks.

**Acceptance:**
- Library entries carry code reference, pack applicability, and unit-tagged values
- Custom materials permitted only when the task unlocks them and are flagged in reports

### REF-04 Rebar size catalogs

US #3-#11, #14, #18 (db, Ab, mass/length); SI/PH 10, 12, 16, 20, 25, 28, 32, 36 mm; EU 8, 10, 12, 16, 20, 25, 32, 40 mm; standard stirrup/tie sizes per region; bar-fit calculator inputs (clear spacing, aggregate size default 3/4 in / 20 mm).

**Why:** RC checks require discrete, regionally available bars.

**Acceptance:**
- Catalog per pack; bar-fit calculation unit-tested for 2-layer beams

### REF-05 Unit weights, SDL presets and code coefficient tables

Superimposed dead load presets (partitions 15-20 psf, ceiling+MEP 10-15, floor finish 5-25, roofing 5-20, composite deck+slab 45-75 by thickness, CMU walls 40-85, curtain wall 10-15; SI equivalents), material unit weights (ASCE 7 C3.1-1 excerpt), and all coefficient tables used by packs stored as versioned JSON with clause ids: ASCE 7-22 Tables 1.5-2, 4.3-1, 4.7-1, 7.3-1/2, 11.4-1/2, 11.6-1/2, 12.2-1, 12.8-1/2, 12.12-1, 26.6-1, 26.10-1/26.11-1; ACI 318-19 phi, cover, min thickness, spacing tables; AISC Table B4.1; EN 1990 Table A1.1, EN 1991-1-1 Table 6.2, EN 1993 buckling curve selection; NSCP Tables 205-1, 208-3 to 208-11.

**Why:** Tables are the data half of every code pack; keeping them as data enables pack versioning and clause citations.

**Acceptance:**
- Each table has id, edition, clause, units, and a loader test
- Learner UI can display the table rows used in a given derivation

### REF-06 Reference solutions, golden submissions and cost data

Each task template ships a vetted reference design (hand or independent FE such as OpenSees/PyNite) with reactions, forces, deflections and check ratios; a golden set of submissions (correct, each seeded error type, over-designed, gamed) with expected grades; and regional unit-cost tables (USD/EUR/PHP) with effective dates. These feed CI regression and author calibration.

**Why:** Grader credibility rests on verification; golden submissions quantify false positives and misses.

**Acceptance:**
- CI runs the golden set on every pack change; any grade delta > 2 points fails the build
- Reference results for all MVP templates traceable to an independent solver

### GRD-01 Deterministic-first grading pipeline with tolerances

Grading order: (1) model validity (ERR-01/02), (2) scenario consistency (SITE-06), (3) loads/combination diff (ERR-03/05), (4) analysis and code checks (CODE-*), (5) quality metrics (QUAL-*), (6) justification grading (QUAL-05), (7) rubric aggregation. Steps 1-5 are deterministic and reproducible; the LLM consumes the evidence JSON only and cannot change any pass/fail. Numeric tolerances when comparing to reference: reactions 1%, member forces 2%, deflections 3%, DC 0.02; plate results 5% with mesh convergence.

**Why:** The brief requires grading on real criteria; only a deterministic engine can be audited by an instructor or a code-literate engineer.

**Acceptance:**
- Evidence JSON schema published; LLM prompt receives only evidence + rubric + justification text
- Re-grading the same attempt yields identical deterministic evidence (hash equality)

### GRD-02 Rubric taxonomy, weights and gating

Default rubric categories and weights (author-adjustable per archetype): Model validity and stability 15; Loads and combinations 20; Strength 25; Serviceability 10; Stability/second-order 5; Code minimums and detailing 5; Economy and utilization 10; Constructability and rationalization 5; Engineering judgment 5. Gates: any Critical finding caps the score at 50%; any Major strength or loads finding caps at 75%; Analyze tasks score accuracy of results against reference with tolerances instead of design categories.

**Why:** A weighted rubric with gates mirrors how a plan checker treats unsafe-but-neat work and gives instructors a familiar structure.

**Acceptance:**
- Rubric editor validates weights sum to 100
- Gate application visible in the report ('capped at 50% due to: mechanism')

### GRD-03 Severity classes and partial credit

Critical: mechanism/instability, DC > 1.00 in a primary member, missing seismic in SDC >= C or missing wind on exposed structure, seismic drift exceedance, disallowed system for SDC, gaming (GRD-05). Major: DC > 1.00 secondary member, deflection/drift exceedance, missing combination or wrong factor, unit error, self-weight omitted, Lb/K misuse, no service check, ELM beyond limit. Minor: over-design, rationalization, constructability flags, over-conservative methods, connection heuristics. Advisory: style, naming, optional improvements. Deductions scale by count with diminishing returns within a category.

**Why:** Severity must reflect real-world consequence (life safety vs economy) rather than count of findings.

**Acceptance:**
- Every rule maps to exactly one severity; severity visible on each finding
- Diminishing-returns formula documented and unit-tested

### GRD-04 Clause-cited explanations and coach mode

Each finding has: plain-language statement, numbers (demand, capacity, ratio, limit), clause id with pack version, why it matters in the real world, and a next step. Coach mode (during attempts, author-enabled) gives graduated hints (category -> member -> clause) without revealing the fix; exam mode shows nothing until the deadline; full reference solution reveal is an author setting.

**Why:** Feedback is the product; clause citations make it credible to engineers and instructors.

**Acceptance:**
- Explanation templates exist for every rule id; LLM elaboration constrained to template slots
- Hint level and timing logged per attempt for analytics

## Should (v1.x)

### CODE-10 Connection feasibility heuristics

No full connection design in MVP; instead rule-based feasibility flags (warn, not fail): beam flange width <= column flange width + 2 in (strong-axis moment connections), moment connections only to W-column flanges (weak-axis framing requires stiffeners: warn), shear-tab rule of thumb (beam end reaction <= ~50% of beam web shear capacity else 'heavy connection'), brace work-point geometry and gusset angle 30-60 deg, HSS-to-W and HSS branch/chord width ratios (beta 0.25-1.0), beam depth change <= 2 nominal sizes at continuous connections, minimum member size for weld/bolt access (W6 minimum braces), RC beam width within column width minus 1.5 in each side (or flag offset beams), bar congestion at joints (number of bars entering a joint).

**Why:** Real designs are governed by whether members can be connected; heuristics give 80% of the pedagogical value at 5% of the cost of a connection design module.

**Acceptance:**
- Each heuristic has an id, inputs, threshold, message and a clause/reference (AISC Manual Part 9-10, ACI 15/18 joints) and is unit-tested
- Heuristic findings are 'Minor' severity and contribute to the constructability criterion only

### CODE-11 Eurocode pack (EN 1990 / 1991 / 1992 / 1993)

Pack v1 on first-generation texts with recommended values plus a selectable National Annex overlay (UK NA first): EN 1990 6.10 and 6.10a/b STR combinations (gamma_G 1.35, gamma_Q 1.5, xi 0.85, psi0/psi1/psi2 Table A1.1), SLS characteristic/frequent/quasi-permanent; EN 1991-1-1 imposed loads (categories A-E, roof H), EN 1991-1-3 snow (s = mu_i*Ce*Ct*sk), EN 1991-1-4 wind (qp(z) = ce(z)*qb, cpe Table 7.1, cs*cd); EN 1993-1-1 section classes 1-4, N/V/M resistances (6.2), flexural buckling with curves a0-d (alpha 0.13-0.76), LTB (6.3.2) and interaction 6.3.3 (Annex B), gamma_M0 = gamma_M1 = 1.0, gamma_M2 = 1.25; EN 1992-1-1 flexure (rectangular stress block, alpha_cc), VRd,c and variable strut inclination (1 <= cot theta <= 2.5), As,min = max(0.26*fctm/fyk, 0.0013)*bt*d, As,max 0.04Ac, rho_w,min = 0.08*sqrt(fck)/fyk, stirrup spacing 0.75d, column As,min = max(0.10NEd/fyd, 0.002Ac), span/depth 7.4.2, deflection span/250 and span/500. Second-generation (EN 1990:2023, EN 1993-1-1:2022, EN 1992-1-1:2023) as pack version 2 once NAs are published.

**Why:** Eurocode opens European and many international universities; the pack architecture is validated by a second, structurally different combination philosophy (partial factors with psi).

**Acceptance:**
- Reproduces SCI P362/P363 worked examples for steel and Concrete Centre 'How to design concrete structures' examples within 2%
- NA overlay switches alpha_cc, psi values, imposed loads and buckling curve selection without code changes
- US and Eurocode grade reports share the same evidence schema

### CODE-12 NSCP 2015 pack (Philippines)

Derived pack reusing US modules with NSCP coefficient tables: Section 203 combinations (ASCE 7-05/10 style with f1 = 1.0 for assembly, live > 4.8 kPa and garages; E = rho*Eh + Ev, Ev = 0.5*Ca*I*D); Section 205 live loads in kPa (residential 1.9, office 2.4, classrooms 1.9, corridors 3.8/4.8, assembly 4.8, storage 6.0/12.0, roof 1.0); Section 207 wind (ASCE 7-10-based directional procedure with zone-based basic wind speed maps per occupancy category, 3-s gust 250-290 km/h band); Section 208 seismic (UBC-97 based: zones 2/4 with Z 0.20/0.40, soil profiles SA-SF, source types A/B/C with Na/Nv near-source factors, Ca/Cv, R per Table 208-11 (e.g., SMRF 8.5, OMRF 3.5-4.5, SCBF 6.4, EBF 7.0), T = Ct*hn^(3/4) (Ct 0.0853/0.0731/0.0488), V = Cv*I*W/(R*T) with 2.5*Ca*I*W/R cap and 0.11*Ca*I*W floor (0.8*Z*Nv*I*W/R in zone 4), drift Delta_m = 0.7*R*Delta_s <= 0.025h (T < 0.7 s) / 0.020h); Chapter 4 concrete (ACI 318M-14 based; Grade 275/415 rebar; 10-36 mm bars; cover 40 mm beams/columns, 20 mm slabs) and Chapter 5 steel (AISC 360-10 based; A36 Fy 248 MPa common). SI units mandatory.

**Why:** The founding team's market includes the Philippines; NSCP uses a UBC-97 seismic model that differs materially from ASCE 7-22 and must be its own pack version, not a factor swap.

**Acceptance:**
- Reproduces at least 10 ASEP/NSCP published or textbook seismic and wind examples within 2%
- Fault-distance input drives Na/Nv; learner sees the near-source classification
- Pack flagged 'NSCP 2015 (7th ed.)' with a watch item for the next edition

### SITE-04 Named-site hazard dataset

Ship a curated, versioned dataset of named sites with precomputed ASCE 7-22 Hazard Tool values (V by risk category, Ss, S1, TL, pg, site class default) for ~50 US cities, Eurocode wind/snow basics for ~20 EU cities, and NSCP zone/fault-distance data for ~20 Philippine cities. Live lat/long lookup via USGS/ASCE APIs is 'could'.

**Why:** Removes a runtime dependency on external hazard APIs and keeps grading reproducible when map values change between editions.

**Acceptance:**
- Dataset has provenance (source, edition, retrieval date) and checksum
- Scenario editor offers site picker with hazard values prefilled and editable

### QUAL-04 Constructability and section rationalization heuristics

Rationalization: unique sections per element group (columns, girders, beams, braces) <= max(3, 10% of members) for full credit, 70% up to twice that, 30% beyond; heaviest member in each group should govern (DC >= 0.7). Constructability: member length <= 18 m (60 ft) shipping, brace angle 30-60 deg, consistent beam depths per floor, column sizes non-increasing with height and changed at most every 2 stories, RC: <= 2 bar sizes per member, bars fit in one or two layers, stirrup sizes #3/#4 (10/12 mm), slab thickness in 0.5 in / 10 mm steps, beam width >= 10 in (250 mm), column dims in 2 in / 50 mm steps; plus CODE-10 connection flags.

**Why:** Distinguishes a 'good' design from a merely passing one and mirrors what practicing reviewers comment on.

**Acceptance:**
- Each heuristic has id, threshold, message, weight; thresholds editable per task
- Report lists unique-section count per group and the rationalization score

### REF-02 European and regional steel profile catalogs

IPE, HEA/HEB/HEM, UPN/UPE, equal/unequal angles, CHS/SHS/RHS (EN 10210 hot-finished, EN 10219 cold-formed) with EN classification-ready properties (Wpl, Wel, iy, iz, It, Iw, Av); UK UB/UC (could); Philippine market list (A36 W-shapes and locally available built-up sections) as a tag set over REF-01.

**Why:** Required by the Eurocode pack and by NSCP users who mix AISC shapes with local availability.

**Acceptance:**
- IPE300, HEB200, SHS150x150x8 properties match published tables within 0.5%

### GRD-05 Anti-gaming and author calibration

Detect manipulations: editing E, density, Fy/f'c beyond catalog, deleting or scaling loads, disabling self-weight, adding supports, changing locked geometry, setting Lb = 0 or K < 1.0 without bracing, using unrealistic section catalogs, submitting the reference solution verbatim. Authors can run the grader over sample/golden submissions, view score distributions, adjust weights/thresholds, and publish only when the golden set grades as expected.

**Why:** Randomization and locks reduce gaming but a grader scoring economy invites parameter tricks; calibration tooling gives instructors confidence.

**Acceptance:**
- Each gaming pattern is a Critical rule with a test
- Calibration view shows per-rule hit counts across the sample set

## Could (later)

### CODE-13 NDS 2024 wood pack

Sawn lumber and glulam members: reference design values with adjustment factors (CD, CM, Ct, CL, CF, Cfu, Ci, Cr, CP), bending, shear, compression and combined bending-axial (NDS 3.9), ASD primary with LRFD conversion (KF, phi, lambda).

**Why:** Requested as optional; useful for US residential/academic courses but not core to the structural analysis/optimization positioning.

**Acceptance:**
- Reproduces AWC Structural Wood Design Examples within 2%

## Non-functional targets

| id | title | target |
|---|---|---|
| NFR-DOM-01 | Analysis accuracy versus independent reference | Frames/trusses/beams: reactions within 0.5%, member forces within 1%, deflections within 2% of OpenSees/PyNite/hand solutions on the reference suite; shells (v1.x) within 5% after mesh convergence. |
| NFR-DOM-02 | Code check verification coverage | US pack reproduces >= 30 AISC Design Examples v16.0 and >= 20 ACI SP-17(19) examples within 2% on capacity; each subsequent pack ships with >= 20 published worked examples passing before release. |
| NFR-DOM-03 | Live analysis latency | Linear static for <= 500 members and <= 20 combinations in <= 200 ms (p95) in-browser or <= 500 ms via server; second-order with <= 60 combinations on <= 2000 DOF in <= 2 s; seismic ELF derivation <= 100 ms. |
| NFR-DOM-04 | Grading determinism and stability | Deterministic evidence identical across re-runs (hash equal); LLM-scored justification variance <= +/-1 point per field and total score variance <= +/-3 points over 10 re-gradings at temperature 0. |
| NFR-DOM-05 | Grader quality on golden sets | False-positive rate < 2% on correct golden submissions; miss rate < 5% on seeded-error submissions, per error class; measured in CI per pack version. |
| NFR-DOM-06 | Grading turnaround | Full grade including LLM justification scoring in <= 60 s (p95) per submission; deterministic portion <= 10 s. |
| NFR-DOM-07 | Units integrity | All computation in SI double precision; display conversions round-trip with relative error < 1e-9; every stored quantity carries a unit tag; mixed-unit inputs rejected at the API boundary. |
| NFR-DOM-08 | Reference data governance | Every dataset and table has edition, clause, source, retrieval date, checksum and license note; pack versions immutable after first task publication; data changes require a new pack version. |
| NFR-DOM-09 | Educational-use disclaimer | Every report and export carries 'educational tool; not for sealed/stamped design' text; no PE/engineer-of-record language in UI. |
| NFR-DOM-10 | Randomization feasibility | >= 99.5% of generated seeds yield a feasible reference solution at publish-time batch check of 200 seeds; infeasible seeds never reach learners. |

## Domain notes (for architecture and UX)

## 1. Grading-criteria taxonomy (criterion | what is measured | decision rule | code reference)

MODEL VALIDITY
- Stability/mechanism | stiffness matrix rank, null-space modes, zero-stiffness DOFs | any rigid-body or mechanism mode -> Critical fail; near-singular (cond > 1e12) -> Major with explanation | general FE; AISC 360-22 C1 (stability of structure as a whole)
- Connectivity/load path | graph connectivity from every loaded node to supports | unconnected -> Critical | engineering judgment; ASCE 7-22 1.4 (continuous load path)
- Support realism | support set vs foundation scenario, over-restraint, roller orientation | rule hits -> Major (Critical when masking seeded errors) | SITE-05 rules; AISC 360-22 C2.3 fixity assumptions
- Modeling hygiene | coincident nodes, duplicates, zero-length, double releases, missing diaphragm | Major if affects results > 2%, else Minor | internal rules

LOADS AND COMBINATIONS
- Dead load completeness | D vs computed self-weight + SDL | D < self-weight -> Major; missing SDL items -> Major | ASCE 7-22 3.1; NSCP 204; EN 1991-1-1 Annex A
- Live loads | occupancy values, partition allowance, reduction rules, Lr | wrong value > 10% or missing -> Major; wrong reduction -> Minor/Major by effect | ASCE 7-22 4.3-1, 4.6, 4.7; NSCP 205; EN 1991-1-1 6.3
- Wind | V/exposure/Kz/Kd/G/Cp/GCpi, directions and signs | missing case -> Critical on exposed structures; pressure error > 10% -> Major | ASCE 7-22 Ch 26-27; NSCP 207; EN 1991-1-4
- Seismic | SDS/SD1, SDC, system permission, R/Cd/Omega0, Cs limits, V, distribution, torsion, Ev, rho | missing E in SDC >= C -> Critical; NP system -> Critical; Cs error > 5% -> Major | ASCE 7-22 Ch 11-12; NSCP 208; EN 1998 (later)
- Snow/thermal/soil | pf, Cs, delta T cases, H | missing where scenario requires -> Major | ASCE 7-22 Ch 7; EN 1991-1-3; NSCP 206 (rain/other)
- Combinations | set diff vs generated set; factor correctness; LRFD/ASD consistency | missing governing combo -> Major (Critical if it governs a failing member); wrong factor family -> Major | ASCE 7-22 2.3/2.4; EN 1990 6.4.3; NSCP 203

STRENGTH (per member, all combinations; DC = required/available)
- Steel tension | Pu/phiPn (yield gross, rupture net with U) | DC <= 1.00 pass | AISC 360-22 D2, D3
- Steel compression | Pu/phiPn with Lc/r, Fe, Fcr (E3/E4/E7) | DC <= 1.00; Lc/r > 200 advisory | AISC E2-E7
- Steel flexure | Mu/phiMn with classification, Lb, Cb, Lp/Lr, LTB | DC <= 1.00; wrong Lb -> recompute and re-grade | AISC F1-F10, B4
- Steel shear | Vu/phiVn | DC <= 1.00 | AISC G2
- Steel combined | H1-1a/b interaction | <= 1.00 | AISC H1
- RC flexure | Mu/phiMn, et, phi, As,min, As fit | DC <= 1.00 and As >= As,min and et >= ety+0.003 | ACI 318-19 22.2-22.3, 9.6.1, 9.3.3
- RC shear | Vu/phi(Vc+Vs), Av,min trigger, spacing, Vs cap | DC <= 1.00; spacing/caps as Major | ACI 22.5, 9.6.3, 9.7.6.2.2
- RC column | Pu,Mu vs interaction, rho 1-8%, ties, slenderness/magnification | inside diagram and limits | ACI 10.6, 22.4, 25.7.2, 6.2.5, 6.6.4
- RC slab | thickness, As,min T&S, spacing | limits met | ACI 7.3.1.1, 7.6.1, 24.4
- Eurocode equivalents | NEd/NRd, MEd/MRd, VEd/VRd, chi, chi_LT, 6.61/6.62 | <= 1.00 | EN 1993-1-1 6.2-6.3; EN 1992-1-1 6.1-6.2, 9.2-9.5

SERVICEABILITY
- Vertical deflection | delta under service combos vs L/x | ratio <= 1.0 pass; 1.0-1.1 Major; > 1.1 Major with larger deduction | IBC Table 1604.3 / ASCE 7-22 App. C; ACI Table 24.2.2; EN 1992 7.4; EN 1990 A1.4
- Wind drift | H/400 total, h/400 story under 10-yr wind | <= 1.0 pass; exceed Major | ASCE 7-22 CC.2.2 (author-selectable)
- Seismic drift | Delta = Cd*delta_xe/Ie vs Table 12.12-1 | exceed -> Critical | ASCE 7-22 12.12.1; NSCP 208.6.5
- RC long-term | lambda_delta = xi/(1+50 rho') applied | omitted where finishes sensitive -> Minor | ACI 24.2.4

STABILITY
- Second-order | B2 or Delta2nd/Delta1st, theta | ELM with ratio > 1.5 -> Major; B2 > 1.1 ignored -> Major; theta > theta_max -> Critical | AISC C1-C3, App. 7-8; ASCE 7-22 12.8.7
- Bracing/K | Lb vs bracing, K vs sway, Lcx/Lcy | mismatch reducing capacity > 5% -> Major | AISC App. 6, C3

CODE MINIMUMS AND DETAILING
- Min/max reinforcement, cover, spacing, bar fit, ties | rule set | violation -> Major (cover, spacing, rho) or Minor (bar count style) | ACI Ch 9-10, 20.5, 25.2, 25.7; EN 1992 9.2-9.5
- Steel slenderness and material compatibility | Lc/r, L/r, Fy/section pairing | advisory/Minor | AISC D1, E2 user notes; AISC Manual Table 2-4

ECONOMY, QUALITY, JUDGMENT
- Utilization efficiency | mass-weighted f(DC) with governing-criterion exemptions | score 0-100% (QUAL-01) | best practice (target 0.70-0.95)
- Material economy | ratio r vs seeded benchmark | 100% at r <= 1.05 -> 0% at 1.50; bonus r < 0.95 | internal
- Redundancy/load path | both-direction LFRS, indeterminacy, load share, alternate path, torsional irregularity | gates + flags | ASCE 7-22 1.4, 12.3.4, Table 12.3-1
- Rationalization/constructability | unique sections per group, lengths, angles, depth consistency, RC bar rules, connection heuristics | heuristic weights (QUAL-04, CODE-10) | AISC Manual Parts 2, 9-10; ACI 25-26 practice
- Engineering judgment | 6 rubric fields 0-4 with evidence cross-check | LLM-scored; contradicted claims zeroed | course rubric

## 2. Task catalog by tier (structure | analysis | checks | typical site inputs)
- T1: SS/cantilever/overhang beams | linear static | reactions, V/M diagrams, deflection formulas | none (given loads)
- T2: continuous beams (pattern loading), 2D trusses (determinate/indeterminate), method-of-joints verification | linear static | force accuracy, mechanism detection, support realism | none or simple occupancy
- T3: steel beams (LTB with bracing), columns, beam-columns, tension members, 3D roof trusses with purlins | linear static | AISC checks, Lb/K, slenderness, deflection | occupancy, snow, SDL
- T4: steel portal frames (gable, crane could), braced frames, 2D moment frames; RC beams, columns, one-way slabs | linear + optional second-order | all AISC/ACI member checks, drift, detailing | wind, snow, occupancy, soil
- T5: 3-6 story 3D steel/RC frames with diaphragms, SMF/SCBF/BRBF/RC SMF choice, ELF seismic, DAM | second-order required | system permission, drift, theta, torsion, redundancy | full scenario incl. seismic
- T6: pedestrian through/pony/Warren/Pratt truss bridges (span 20-60 m, pedestrian LL 90 psf/5 kPa, L/360-L/1000 deflection), lattice telecom towers (wind on lattice, Cf by solidity), design optimization challenges and Diagnose tasks | second-order where relevant | all plus economy benchmarks | wind, seismic, temperature, soil

## 3. Scenario -> load mapping (US pack)
risk category -> Ie, Is, V map, drift limit; occupancy -> Lo, partitions, KLL reduction, f1 (NSCP); surfaces -> SDL; sections+materials -> self-weight; V, exposure, Kzt, Ke, enclosure, geometry -> qz, Cp, GCpi -> W(+/-X, +/-Y, +/-GCpi); Ss, S1, site class, TL, system, hn, W -> SDS/SD1/SDC/Cs/V -> E(+/-X, +/-Y, +/-5% ecc, Ev); pg, Ce, Ct, Is, slope -> S; delta T -> T; qa, foundation type -> support fixity defaults and bearing check; water table/coastal flag -> exposure D permission.

## 4. Randomizable parameters (default ranges; author-editable)
spans 4-12 m (US 12-40 ft) step 0.5 m/1 ft; bays 2-5; stories 1-6; story height 3.0-4.5 m; occupancy from {office, residential, classroom, assembly, light storage, retail}; V from map set {95,105,115,120,130,140,150,160,170,180 mph} or NSCP {250,260,270,290 km/h}; exposure {B,C,D}; (Ss,S1) from named-site list; site class {C,D,E}; pg {0,20,30,40,50,70 psf}; qa {1500,2000,3000,4000 psf}; steel {A992,A36,A572-50}; f'c {3,4,5,6 ksi}; rebar {60,80} or PH {275,415}; risk category {II,III}; delta T 20-40 C. Constraint rules: no snow with tropical sites; SDC-dependent system list; exposure D only coastal sites.

## 5. Learner-mistake detectors (mistake -> detection signal)
missing load cases/combos -> set diff vs generated; mechanism -> null space; unrealistic supports -> support rules + scenario; unit errors -> plausibility bands + conversion fingerprints (12, 25.4, 47.88, 1000); over/under-design -> DC distribution, governing criteria; self-weight ignored -> D vs computed; wrong combinations -> factor family and factor diff; unbraced lengths wrong -> Lb vs bracing geometry, K vs sway; ELM beyond limit/no second-order -> Delta ratio, B2, theta; factored-load deflection -> run log; truss mid-span loads -> element type vs load location; A36 W-shapes / Mp on noncompact -> material-section pairing and classification; RC detailing -> rule set; gaming -> locked-field diffs and material/property bands.

## 6. Reference data inventory
AISC Shapes Database v16.0 (current; US+metric; 222 shapes added vs v15); EN profile tables (IPE/HE/UPE/L/CHS/SHS/RHS); PH availability tags; material library (REF-03); rebar catalogs US/SI/EU; SDL presets and unit weights; code coefficient tables as JSON (REF-05); named-site hazard dataset (SITE-04); regional unit costs; worked-example verification suites (AISC Design Examples v16.0, ACI SP-17(19), SCI P362/P363, Concrete Centre guides, ASEP/NSCP examples); golden submissions.

## 7. Edition status verified 2026-11 (for architecture)
ASCE 7-22 current (IBC 2024); AISC 360-22 current (16th Ed. Manual, Shapes DB v16.0); ACI 318-19 referenced by IBC 2024, ACI 318-25 released 2025 and expected in IBC 2027 -> pack version path; NDS 2024 current; NSCP 2015 7th ed. current, next edition under discussion; Eurocode second generation published (EN 1990:2023, EN 1992-1-1:2023, EN 1993-1-1:2022) with NAs pending and first generation withdrawn 30 March 2028 -> first-gen pack v1, second-gen pack v2.

## 8. Recommendations for architecture/UX phases
- Internal SI; pack-declared display units; unit tags on every quantity; plausibility bands at input time.
- Pack interface stages: actions -> combinations -> effects -> resistances -> verifications -> findings; packs are data + small pure functions, versioned and immutable.
- Evidence JSON (findings, member tables, load diffs, metrics) is the single contract between engine, grader LLM, report UI and analytics.
- Live workspace should surface: governing DC per member with criterion, deflection ratios, drift per story, mass/cost, unique sections, and a load-source explorer; grading results reuse the same components.
- Author tooling: scenario editor with named sites, randomization ranges with 20-variant preview, lock flags, rubric weights, golden-set calibration.

## Risks

| risk | mitigation |
|---|---|
| Code content copyright (ASCE/AISC/ACI/CEN/ASEP tables and text) limits what the product can embed. | Implement equations and coefficients as data with clause citations only; never reproduce code text or full tables verbatim in UI; legal review before launch; consider licensing agreements for table reproduction. |
| A bug in a code-check module silently mis-grades thousands of submissions. | Verification suite against published worked examples (NFR-DOM-02), golden submissions in CI, pack versioning, instructor override/appeal, and re-grade tooling by pack version. |
| LLM hallucinates code requirements or contradicts the deterministic engine. | Deterministic-first pipeline; LLM receives only evidence JSON and rubric; may only fill explanation template slots and score the justification; clause ids validated against the pack's clause map before display. |
| Randomized scenarios produce infeasible or trivially easy variants, making grades unfair. | Seed feasibility verification with the reference optimizer at publish and assignment time; difficulty bands tied to benchmark DC spread; author preview of 20 sample variants. |
| False mechanism/instability detections on near-singular but valid models (e.g., long slender trusses). | Null-space analysis with scaled tolerances, condition-number thresholds tuned on a test corpus, and a user-facing 'explain this instability' view rather than hard failure. |
| Edition churn (ASCE 7-28 expected ~2028, ACI 318-25, Eurocode 2nd generation, next NSCP) fragments content. | Immutable pack versions bound to tasks; migration tooling that re-grades golden sets under a new version and reports diffs to authors. |
| NSCP seismic (UBC-97 lineage) and Eurocode partial-factor philosophy do not fit a US-shaped pack interface. | Design the pack interface around abstract stages (actions -> combinations -> effects -> resistances -> verifications) and prove it with NSCP seismic and EN 1990 combos as conformance tests before freezing the interface. |
| Learners game economy scoring by manipulating materials, loads or supports. | Locked fields enforced server-side, anti-gaming rules as Critical findings, plausibility bands, and benchmark derived under identical constraints. |
| Hazard values (wind speeds, Ss/S1, pg) drift between tool versions and editions, breaking reproducibility. | Curated named-site dataset with provenance stored per pack version; no live API dependency in grading. |
| Instructors distrust AI grading of judgment write-ups. | Evidence cross-checking of claims, per-field rubric transparency, instructor override with audit trail, and calibration view on sample submissions. |

## Open questions

- Eurocode pack edition: start on first-generation texts (EN 1990:2002+A1, 1991-1-1:2002, 1992-1-1:2004, 1993-1-1:2005; withdrawn 30 March 2028) with recommended values + UK NA overlay, and treat second generation (EN 1990:2023, EN 1992-1-1:2023, EN 1993-1-1:2022) as pack version 2 once National Annexes are published? Recommended: yes.
- ACI edition: keep ACI 318-19 as US pack v1 (IBC 2024 reference) and add 318-25 as a pack version aligned with IBC 2027 adoption? Recommended: yes; schedule 318-25 for v1.x.
- NSCP: ASEP has a new edition under discussion; 2015 (7th ed.) remains current. Who monitors and when do we commit to a next-edition pack?
- Licensing: confirm whether implementing equations/coefficients with clause citations (without reproducing code text) is acceptable to ASCE/AISC/ACI/CEN/ASEP legal terms, and whether the AISC Shapes Database and ASCE Hazard Tool values may be redistributed inside the product.
- Seismic depth for MVP: ELF only (recommended) versus adding modal response spectrum in MVP for T5 tasks.
- RC slabs in MVP: one-way strip method only (no shell FE) versus shell elements and two-way slabs in v1.x (recommended v1.x).
- Connection scope: heuristics only (MVP) versus a simple bolted shear-tab/moment-connection design module later; and whether composite steel-concrete floors (AISC Chapter I) belong to v1.x.
- Default design philosophy for US tasks: LRFD default with ASD selectable per task (recommended) or author-chosen per course.
- Benchmark policy: platform optimizer-generated reference per seed versus instructor-curated reference; and whether learners see the benchmark band before or only after submission.
- Foundation scope: bearing/overturning feasibility only (MVP) or footing design (ACI Chapter 13) in v1.x.
- Pedagogical policy: show live D/C ratios during practice but hide during exams; who controls this per task (author/institution)?
- Which named sites and regional cost tables must exist at launch (US only, or US + PH + EU)?
