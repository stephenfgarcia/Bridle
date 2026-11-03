# Requirements index

Produced 2026-11-03 by the requirements discovery workflow (8 domain agents, a completeness critic, 6 gap-fill agents; 15 agents, 1.3M tokens). Priorities: **must** = MVP, **should** = v1.x, **could** = later. These documents are the input to the architecture and UI/UX work; the approved plan (`docs/plan/roadmap.md`, Part A) summarizes them.

| file | area | reqs | must | should | could |
|---|---|---|---|---|---|
| [01-structural-engineering-domain-and-real-wor.md](01-structural-engineering-domain-and-real-wor.md) | Structural engineering domain and real-world grading criteria | 47 | 39 | 7 | 1 |
| [02-simulation-finite-element-engine.md](02-simulation-finite-element-engine.md) | Simulation / finite element engine | 57 | 43 | 9 | 5 |
| [03-3d-interaction-and-visualization-workspace.md](03-3d-interaction-and-visualization-workspace.md) | 3D interaction and visualization workspace | 46 | 37 | 8 | 1 |
| [04-core-lms-courses-enrollment-grading-tracki.md](04-core-lms-courses-enrollment-grading-tracki.md) | Core LMS: courses, enrollment, grading, tracking | 45 | 31 | 13 | 1 |
| [05-ai-grading-pipeline-against-real-world-cri.md](05-ai-grading-pipeline-against-real-world-cri.md) | AI grading pipeline against real-world criteria | 45 | 36 | 7 | 2 |
| [06-non-functional-and-platform-requirements.md](06-non-functional-and-platform-requirements.md) | Non-functional and platform requirements | 45 | 44 | 1 | 0 |
| [07-instructor-content-and-task-authoring.md](07-instructor-content-and-task-authoring.md) | Instructor content and task authoring | 44 | 35 | 8 | 1 |
| [08-product-definition-personas-mvp-scope.md](08-product-definition-personas-mvp-scope.md) | Product definition, personas, MVP scope | 45 | 26 | 15 | 4 |
| [09-cross-domain-canonical-data-model-identifi.md](09-cross-domain-canonical-data-model-identifi.md) | Cross-domain canonical data model, identifier/version pin set, canonicalization and hashing, and unified event stream (gap-fill #1, id prefix GAP1-DM-) (gap fill) | 25 | 21 | 3 | 1 |
| [10-standards-licensing-reference-data-redistr.md](10-standards-licensing-reference-data-redistr.md) | Standards licensing, reference-data redistribution, legal terms (ToS/AUP, pilot agreements, learner IP, minors), disclaimers, and code-pack verification governance (gap-fill #2) (gap fill) | 25 | 23 | 2 | 0 |
| [11-learner-deliverables-and-grading-specifica.md](11-learner-deliverables-and-grading-specifica.md) | Learner deliverables and grading specification per task archetype (Analyze, Check, Diagnose), including the memo and attachment deliverable for Design/Optimize (gap fill) | 23 | 23 | 0 | 0 |
| [12-internal-operator-console-support-workflow.md](12-internal-operator-console-support-workflow.md) | Internal operator console, support workflows, incident runbooks, and help/documentation (gap-fill #4) (gap fill) | 25 | 24 | 1 | 0 |
| [13-academic-integrity-exam-mode-and-ai-use-po.md](13-academic-integrity-exam-mode-and-ai-use-po.md) | Academic integrity, exam mode, and AI-use policy (gap-fill #5, unified specification) (gap fill) | 25 | 13 | 10 | 2 |
| [14-team-projects-shared-model-collaboration-a.md](14-team-projects-shared-model-collaboration-a.md) | Team projects, shared-model collaboration, and peer review at the document-model level (ids GAP6-; corresponds to the COLLAB area) (gap fill) | 20 | 5 | 12 | 3 |
| | **total** | **517** | **400** | **96** | **21** |

## Critic's assessment

The eight domain sets are unusually deep and largely coherent on the product spine (scenario task -> live 3D FEA -> deterministic checks -> LLM-judged memo -> instructor-reviewed release -> resubmit). Two systemic problems dominate. (1) MVP scope is not aligned: the structural, engine, workspace, authoring and NFR agents each wrote their own 'must' set, and the union (RC design at ACI depth, MITC shells, Eurocode and NSCP generators, iterative second-order and buckling analysis, L-tier rendering, SAML SSO plus mandatory MFA, EU residency, full ASVS L2, canary deploys, an 11-section task builder) is a two-to-three-year program for a small team, whereas the product agent's MVP-02/03/04 is roughly a one-year scope. The conflicts below resolve to a steel-only, linear-static (+B1/B2), US-code-pack, frame-and-truss MVP with 100% human review of summative grades, which every domain's own open questions already lean toward. (2) Several core objects are defined independently by three or four domains with incompatible details: the rubric (four schemas, plus a real disagreement on whether DCR > 1.0 earns partial credit), the site scenario (four parameter sets), model canonicalization/hashing (three number-normalization rules), where code checks execute, the benchmark source, grader-version pinning scope, and duplicated requirement ids (GRD, SEC, PERF, A11Y each used by two domains). The gaps are mostly cross-cutting concerns with no owner: a canonical data model and submission pin set, standards licensing/legal terms/verification governance, deliverables and grading for the Analyze, Check and Diagnose archetypes, operator/support/help tooling, a unified academic-integrity and exam-mode spec, and team collaboration at the document-model level. Lesser gaps not listed (ranked out): responsive and offline behavior of the non-workspace LMS on phones/tablets (AVL-03 and INP-02 cover only the workspace), instructor content migration from SAP2000/ETABS/RISA and existing problem sets, and discussion content moderation/reporting beyond DSC-01's moderator tools. Verification notes: the AI-grading domain's Claude API claims (temperature/top_p/top_k rejected; forced tool use and prefill rejected on current models; structured outputs via output_config.format; claude-fable-5-1 at $10/$50 with always-on thinking and a 30-day retention requirement; claude-haiku-5-5 / claude-sonnet-5-5 / claude-opus-5-5 ids) match the current API reference. Two nuances: the minimum cacheable prompt prefix is model-dependent (512-4096 tokens), so LLM-07's 512-token assumption must be validated per routed model via usage.cache_read_input_tokens; and Fable 5.1 cannot be called from an organization configured for zero data retention, which breaks the 'offline golden labeling with Fable' idea if institutions demand ZDR. The NFR domain's ADA Title II dates (April 2027 for entities serving 50,000+ people, April 2028 for smaller ones) are correct after the DOJ's April 2026 interim final rule; its EU AI Act application date (2 December 2027 via the Digital Omnibus) remains unverified. Recurring open questions that block prioritization and should be decided before the architecture phase: launch geography and first code pack (raised by all eight domains), RC in MVP (five domains), review/auto-release policy (four), LTI at pilot (four), per-task model-size caps (three), team projects (three), EU residency (three). Repository state: greenfield and empty; no implementation files exist yet.

## Cross-domain conflicts and recommended resolutions

### C1. Structural domain (CODE-05, ERR-08, REF-04, CAT-01 T4) and Product (MVP-01/MVP-02) vs FE engine (SIM-RES-07/SIM-RES-08), AI grading (CHK-01) and Authoring (TB-02)

**Conflict:** Structural and Product put reinforced-concrete design checks (ACI 318-19 beams, columns and one-way slabs, detailing rules, rebar catalogs) in the MVP, while the engine, grader and authoring domains plan a steel-only MVP (AISC 360-22) with generic elastic checks for other materials and RC in v1.x. The ACI edition also differs: Structural and Product pin 318-19 (the IBC 2024 reference), while SIM-RES-08 and an LMS open question name 318-25.

**Recommended resolution:** Decide before the architecture phase; recommended: MVP = steel-only code checks (ASCE 7-22 + AISC 360-22), with RC as the first post-MVP pack increment (v1.1) at reduced scope (rectangular beam flexure and shear, column P-M interaction with user-specified reinforcement, As min/max, no detailing engine, no slabs, no long-term deflection). MVP-01's RC modules become Analyze-only tasks (reactions, member forces and deflections with author-declared effective stiffness per ACI 318-19 6.6.3.1.1; no Check, Design or Optimize task binds an RC member until the ACI pack ships) and the course title becomes 'Structural Analysis and Design Fundamentals (Steel)' with RC Analyze modules only (ADR 0002 A6). Pin ACI 318-19 as US pack v1 with 318-25 as a later pack version aligned with IBC 2027, and correct SIM-RES-08's edition.

### C2. FE engine (SIM-LOD-06 and SIM-RES-07 as must) vs Structural (CODE-11/CODE-12 should), AI grading (CHK-01), Authoring (TB-02) and Product (MVP-02)

**Conflict:** The engine lists EN 1990 and NSCP 2015 combination generators and EN 1993-1-1 member checks as MVP musts; every other domain limits the MVP to one US code family and defers Eurocode and NSCP to v1.x. Launch geography (US versus Philippines) is still open in four domains and decides which second pack comes first.

**Recommended resolution:** MVP ships the US pack only; EN/NSCP generators and EC3 checks become should. Load-combination generation and load derivation live in the code-pack module (CODE-01), not in the FE engine; the engine exposes only case superposition, envelopes and the check contract (SIM-RES-07). Keep the pack interface pluggable from day one and prove it with the second pack chosen by the launch-geography decision (NSCP 2015 if the Philippines is the first market, otherwise first-generation Eurocode with the UK National Annex).

### C3. FE engine (SIM-ELM-03, SIM-RES-04, SIM-VNV-02 must), Authoring (TL-02 flat-plate template must) and Workspace (PERF-01 shell tiers, MOD-04) vs Structural (CAT-02: shells v1.x) and Product (MVP-02 excludes plates/shells)

**Conflict:** Three domains build MITC flat shells, shell result recovery, shell benchmark suites, shell performance tiers and a flat-plate starter template into the MVP, while the structural and product domains explicitly exclude plates and shells from the MVP.

**Recommended resolution:** Shells are out of the MVP: SIM-ELM-03, SIM-RES-04, SIM-VNV-02, MOD-04 and the shell parts of PERF-01 and SIM-VNV-04 become should; replace TL-02's flat-plate template (for example with a 3D braced frame under wind or a continuous beam with support settlement). Keep load panels (SIM-LOD-05) with one-way distribution at MVP (two-way as should) so area loads reach framing without shells; if RC one-way slabs ever enter the MVP they use the strip method.

### C4. Structural (CODE-04 must: Direct Analysis Method with iterative second-order analysis, Effective Length Method, seismic theta) and AI grading (CHK-01 must: eigenvalue buckling load factor, second-order amplification) vs FE engine (SIM-ANL-04 P-delta and SIM-ANL-05 buckling as should) and Product (MVP-02: linear static only)

**Conflict:** Two domains require second-order and buckling results in MVP grading while the engine schedules those analyses for v1.x and the product limits the MVP to linear static analysis of frames up to about three stories.

**Recommended resolution:** MVP stability = linear static plus AISC Appendix 8 B1/B2 amplification computed from first-order results, notional loads generated as load cases, the ASCE 7-22 12.8.7 theta check, slenderness advisories and mechanism detection. Iterative P-delta and eigenvalue buckling move to v1.x; split CODE-04 and CHK-01 into must and should parts accordingly, and limit MVP T5 tasks to frames where the B2 route is valid (Delta2nd/Delta1st <= 1.5).

### C5. Structural (SITE-01/SITE-02, CODE-06/07/08 must), AI grading (SCN-01 must), Authoring (TB-03/TB-04 must) and LMS (CRS-03) vs FE engine (SIM-LOD-07 should) and Product (MVP-02 'simplified wind/seismic/snow inputs')

**Conflict:** Four domains define their own scenario object with different parameter sets (SCN-01 treats R, Ie and Cd as scenario inputs; SITE-01 derives them from the chosen lateral system; TB-03 adds Omega0, SDC and subgrade modulus; CRS-03 has a fifth variant), they disagree on where derivation runs (engine versus code pack), and they disagree on fidelity (complete ASCE 7-22 procedures versus simplified inputs).

**Recommended resolution:** One Scenario schema owned by the structural domain (SITE-01) and referenced by CRS-03, TB-03 and SCN-01; R, Omega0 and Cd come from the system selection (a Table 12.2-1 subset) and SDC is derived, never entered. Derivation runs in the code pack inside the shared Rust/WASM core (see the code-check location conflict), with SIM-LOD-07 as the engine's consumer interface. MVP fidelity is 'simplified': ELF with a reduced steel system table (SMF/IMF/OMF, SCBF/OCBF, BRBF), the MWFRS directional procedure for rectangular enclosed buildings (Kzt = 1, enclosed only, roof Cp from Fig. 27.3-1 for flat, low-slope (theta <= 10 degrees) and gable roofs up to 45 degrees (windward both-sign cases enumerated); monoslope, multispan, arched and partially enclosed cases are should), flat and sloped roof snow without drift or unbalanced cases, and live-load reduction; 3D accidental torsion, partially enclosed buildings, topographic effects and RC systems are should.

### C6. Structural (GRD-02 categories and weights, GRD-03 severity classes, QUAL-01, ERR-07) vs AI grading (RUB-01, RUB-02) vs LMS (GRD-01) vs Authoring (TB-08)

**Conflict:** Four overlapping rubric schemas: criterion kinds auto/AI-judged/manual (LMS) versus auto/judged/hybrid (AI grading) versus levels/points/automatic (authoring); nine structural categories versus a different nine-dimension taxonomy in TB-08 ('environmental appropriateness' and 'communication' versus 'model validity' and 'code minimums'). Substantively, RUB-02 gives partial credit for max DCR up to 1.05 (70%) and 1.10 (40%), while the structural domain treats any DC > 1.00 as a strength failure (Critical for primary members, score capped at 50%) that the LLM can never soften.

**Recommended resolution:** Adopt one rubric JSON schema (AI grading RUB-01) with kinds {auto, judged, hybrid, manual}; the dimension enum is the structural GRD-02 category list (fold 'communication' into engineering judgment and map 'environmental appropriateness' to loads/scenario consistency); per-archetype default weights come from GRD-02; TB-08 is the authoring UI over it and LMS GRD-01 references it. Severity classes and gates from GRD-03 are authoritative: utilization <= 1.00 passes, 1.00 < DC <= 1.02 is a numeric-tolerance advisory, above that is Critical (primary) or Major (secondary) with the score caps; drop the 1.05/1.10 credit bands and apply fraction-of-members scaling only within the passing region. Define per-archetype deliverables (see the archetype gap).

### C7. FE engine (SIM-DET-01 bit-identical results, SIM-RES-09 resultHash) and NFR (SBX-05) vs LMS (SUB-01 stores client results and flags discrepancies beyond tolerance), AI grading (PIPE-03 compares client results 'beyond tolerance' while SEC-03 'rejects results-bearing payloads') and Workspace (CAP-02 bundles a results summary)

**Conflict:** The domains disagree on whether a submission carries client-computed results at all, and on whether browser/server parity is bit-identical or within a numeric tolerance; the AI-grading domain contradicts itself (compare versus reject).

**Recommended resolution:** The submission bundle carries modelHash, engineArtifactHash, resultHash and a display-only results summary; server re-analysis is the only grading input. The integrity check is resultHash equality when the engine artifact matches (bit-identical per SIM-DET-01, trivially true if the server runs the same .wasm under Wasmtime), and the GRD-01 numeric tolerances apply only when artifacts differ (engine upgraded mid-offering). Reword SEC-03 to 'client results are ignored for grading', not rejected, and align SUB-01 and CAP-02.

### C8. FE engine (SIM-SCH-01, SIM-DET-02: RFC 8785 JCS + SHA-256) vs Workspace (IO-01, DET-01: numbers formatted to fixed precision) vs AI grading (PIPE-02: rounding at a documented tolerance) vs LMS (CRS-03: 'shared, versioned JSON schema')

**Conflict:** Three different number-normalization rules (JCS canonical floats, fixed-precision formatting, tolerance rounding) would produce three different hashes for the same model, and four domains assume they own or share the model schema; the global axis convention (Z-up versus Y-up) and the 2D plane (XZ versus XY) are undecided.

**Recommended resolution:** One schema package owned by the engine domain exports the JSON Schema, migrations and canonicalize() (round each dimension to a documented quantum such as 1e-6 m and 1e-3 N, then JCS, then SHA-256) and is imported by the browser, API, grader and authoring; adopt Z-up global axes with the XZ plane as 2D mode and record both in schema v1 before any code is written (feeds the data-model gap).

### C9. Workspace (RES-03 live utilization color maps, EDIT-06 live loop) and Product (PER-02 pre-submission self-check) vs AI grading (CHK-01 rules stage on the server) vs FE engine (SIM-RES-07 'separate design-check module' with unspecified runtime)

**Conflict:** Live utilization in the browser requires code checks to run client-side, the grader specifies them server-side, and the engine leaves the runtime unspecified; nobody owns the requirement that both runs are identical.

**Recommended resolution:** Make the checks library part of the shared Rust core compiled to WASM and native, versioned as its own pinned artifact alongside the engine. The client runs it for live utilization and the self-check (advisory); the server runs the same artifact for grading (authoritative), which also guarantees the self-check shows exactly what the grader will find.

### C10. Structural (SITE-03 optimizer-generated references per seed, QUAL-02 benchmark = seeded reference) vs Authoring (TB-07 author-attached references, PV-02 calibration across seeds) vs AI grading (OPT-01 four configurable benchmark sources, SCN-02 parametric or auto-sized reference)

**Conflict:** SITE-03 requires a built-in design optimizer that generates a feasibility-verified reference for every randomized seed at runtime; authoring assumes author-built references validated by a calibration run; the grader offers four benchmark sources with no default.

**Recommended resolution:** MVP benchmark = author reference(s) plus an 'auto-sized reference' (greedy lightest catalog section per member group that passes all checks; no global optimization) generated per seed during the calibration run (PV-02), with infeasible seeds rejected at calibration time rather than at runtime. Optimizer-generated references and cohort-percentile benchmarks are v1.x (should); QUAL-02 scoring bands apply to whichever benchmark the task configuration names.

### C11. Product (PRD-03, MVP-03: grades reach learners only after human review, no auto-release) vs AI grading (REV-01 formative auto-release and course-policy auto-release of unflagged grades; AGG-02 confidence routing) vs LMS (GRD-02 routing rules including 'never for practice tasks' and random sampling)

**Conflict:** The product requires 100% instructor/TA review before any grade is released in MVP, while the grading and LMS domains design confidence-based routing that releases unflagged or formative grades automatically.

**Recommended resolution:** MVP: summative (credit-bearing) tasks require 100% instructor/TA review before release, with confidence and flags used only to order the queue and power bulk-accept suggestions; formative/practice tasks release deterministic results immediately and the AI narrative labeled 'AI-provisional' when the task is marked formative (MVP-03 already permits deterministic-only). Auto-release of unflagged summative grades with sampled review becomes a v1.x tenant opt-in contingent on CAL-01 agreement >= 85%.

### C12. NFR (SEC-02 must: SAML 2.0/OIDC institutional SSO and mandatory MFA for privileged roles) vs LMS (AUTH-02 SSO/MFA as should) and Product (GTM-04 should; PER-10 SSO in v1.x)

**Conflict:** The NFR domain makes enterprise SSO and MFA MVP musts; the LMS and product domains defer SSO to v1.x.

**Recommended resolution:** MVP = email/password per NIST 800-63B plus Google/Microsoft OIDC sign-in (AUTH-01) plus TOTP/passkey MFA enforced for instructor, author and admin roles (small and high-value); SAML enterprise SSO, IdP routing and SCIM are v1.x. Update SEC-02 to match.

### C13. LMS (DAT-02 must: US/EU data-residency region chosen at tenant creation with in-region storage) vs NFR (PRIV-02: EU-resident deployment offered by v1.x) vs Product (MVP-04: US pilot institutions)

**Conflict:** One domain requires a selectable EU region at MVP; the others plan a single region until an EU customer exists.

**Recommended resolution:** MVP runs in a single US region; reserve tenant.region in the schema and avoid cross-tenant shared storage assumptions; deliver the EU region (data plus LLM inference_geo pin) in v1.x when the first EU customer is signed, together with the EU AI Act artifacts (PRIV-04).

### C14. Workspace (PERF-01 L tier of 10,000 members / 50,000 shells as must; '150 ms live budget') vs FE engine (SIM-ARCH-03 ~6k DOF browser routing and Tier-3 interactive server solves) vs NFR (PERF-04 'sub-100 ms'; course models about 360 DOF) vs LMS and Authoring (open question on per-task size caps)

**Conflict:** Three different performance tiers and two different live-latency numbers, and no agreed per-task model-size cap that the workspace and server both enforce.

**Recommended resolution:** MVP = S and M tiers only (<= 2,000 members, no shells) with one latency contract: Tier-1 solve plus render <= 100 ms p95 for S and <= 300 ms for M on the reference laptop; authors can set a per-task hard cap (members/DOF) enforced identically in the workspace and on the server. The L tier, device micro-benchmark routing and interactive Tier-3 server solves are v1.x.

### C15. Product (LOM-01/LOM-02 mastery tracking as must; PER-08 at-risk alerts in v1.x) vs LMS (PRG-03 competency mastery as should; ANL-01 at-risk flags as must)

**Conflict:** The two domains invert the priorities of outcome-mastery tracking and at-risk analytics.

**Recommended resolution:** MVP = outcome tagging of tasks and criteria plus the simple LOM-02 mastery rule shown to learners and as a per-section table; competency-framework extensions, heatmaps and learning paths are v1.x. At-risk = a simple rule list (no activity in 7 days, overdue tasks) at MVP, with alerts and messaging in v1.x in both documents.

### C16. Workspace (A11Y-01/A11Y-02 must) and NFR (ACC-01/ACC-02 must) vs LMS (A11Y-02 accessible 3D alternatives as should)

**Conflict:** Two domains require the non-canvas parity path for the 3D workspace at MVP; the LMS domain defers it.

**Recommended resolution:** The parity path (tabular model editor, command palette, result tables, textual summary, keyboard camera) is must for MVP because US public universities procure under ADA Title II (WCAG 2.1 AA; the DOJ's April 2026 interim final rule moved deadlines to April 2027 for entities serving 50,000+ and April 2028 for smaller ones); live-region narration of canvas changes and a formal published ACR are should for v1.x. Align LMS A11Y-02.

### C17. LMS (DAT-04: AI model and prompt version pinned per offering) vs Authoring (TB-10: grader model id and version pinned per task version) vs AI grading (VER-01: composite grader_version recorded per grade, rubric edits create new rubric versions)

**Conflict:** Three different pinning scopes for the grader configuration (offering, task version, grade), which makes 'which grader graded this' ambiguous and complicates regrades.

**Recommended resolution:** The composite grader_version (solver build, checks library, clause library, scenario engine, rubric version, prompt template, judge schema, model ids and effort per route, routing policy, validator) is frozen per published task version and recorded on every grade; an offering-level change log aggregates the task versions in use; changing any component requires a new task version under VP-02/VP-03. Fold this into the data-model gap's pin set.

### C18. Structural GRD-01..05 vs LMS GRD-01..05; AI grading SEC-01..03 vs NFR SEC-01..08; Workspace PERF-01..03 vs NFR PERF-01..05; Workspace A11Y-01/02 vs LMS A11Y-01/02

**Conflict:** Duplicate requirement id prefixes across domains will collide the moment the sets are merged, and cross-references in the digest already cite 'GRD-01' with two different meanings.

**Recommended resolution:** Namespace every id by domain before merging (STR-, SIM-, WS-, LMS-, AIG-, NFR-, AUT-, PRD-) and maintain a cross-reference table of related requirements.

## Flagged as unrealistic for an MVP by a small team

- STR CAT-01 (all six tiers as must): T5 multi-story 3D with diaphragms/second-order and T6 bridges/towers with moving loads need v1.x engine features; define the taxonomy now but ship T1-T4 content plus a reduced T5.
- STR CODE-04 (Direct Analysis Method with iterative second-order analysis): engine P-delta is v1.x; MVP should do B1/B2 amplification, notional loads and the theta check only.
- STR CODE-05 (full ACI 318-19: size-effect shear, one-way slabs, long-term deflection, slender-column magnification): too deep for a small team even if RC is in MVP; cut to beam flexure/shear and column P-M or defer.
- STR CODE-06 and CODE-07 (complete MWFRS directional and ELF procedures with all roof Cp cases, partial enclosure, Ke, the full Table 12.2-1 system list and 3D accidental torsion): implement the simplified subset for rectangular enclosed steel buildings and mark the rest should.
- STR SITE-03 (optimizer-generated, feasibility-verified reference solution per learner seed): requires a working design optimizer at launch; use author references plus a greedy auto-sized reference validated at calibration time.
- STR SITE-05 (foundation feasibility and bearing checks): unnecessary for a steel-only MVP; keep only base-fixity consistency warnings.
- STR ERR-06 (inferring unbraced length from modeled bracing geometry): geometric bracing inference is research-grade; MVP compares learner-declared Lb/K against author-declared bracing conditions only.
- STR ERR-08 (RC detailing violation detector): depends on RC scope; v1.x.
- STR QUAL-03 (torsional irregularity and single-member-removal metrics): need diaphragms and alternate-path analysis; keep only the load-path connectivity and both-direction LFRS gates.
- STR REF-05 and REF-06 (all EN and NSCP coefficient tables as versioned JSON; independent-FE golden sets for every template): US tables only; OpenSees cross-checks for a 5-10 problem subset with hand solutions elsewhere.
- STR QUAL-02 (regional unit-cost tables in USD/EUR/PHP): USD only until the second market is chosen.
- SIM-ELM-03, SIM-RES-04, SIM-VNV-02 (MITC4/MITC3 flat shells with MacNeal-Harder and NAFEMS benchmarks): weeks of numerical work with no MVP consumer because shells are out of the product MVP.
- SIM-ARCH-03 and SIM-ARCH-04 (device-calibrated tier router and interactive server solves): course models are a few hundred DOF; MVP needs in-browser solves plus a server path used only for grading.
- SIM-LOD-06 and SIM-RES-07 (EN 1990 and NSCP generators, EN 1993-1-1 checks as must): the second code family is v1.x.
- SIM-VNV-01 and SIM-VNV-04 (>= 40 benchmarks spanning shells, modal and buckling; performance scenes with slabs): trim to about 25 benchmarks matching MVP analysis types and frame-only performance scenes.
- SIM-LOD-05 (two-way yield-line panel load distribution): one-way tributary distribution at MVP; two-way should.
- WS PERF-01 (L tier of 10,000 members / 50,000 shells at 30 fps with automated benchmarks): far beyond course-sized models; budget S and M tiers only.
- WS VIEW-06 (WebGPU path with identical output plus GPU/driver blocklist handling): WebGL2-only at MVP; WebGPU is a v1.x enhancement.
- WS EDIT-04 and INP-02 (customizable shortcuts with printable cheat sheet and command-line parsing; dockable, persisted panel layouts): fixed shortcuts plus a command palette and a fixed layout with collapsible panels suffice for the pilot.
- WS A11Y-02 (screen-reader live announcements of canvas state): keep the tabular parity path as must and defer live-region narration.
- LMS TEN-01 (seat pools, per-offering caps, waitlists, branding and per-tenant auth policy): MVP provisions 1-3 tenants manually with a learner cap; the rest is v1.x.
- LMS CRS-02 (offering upgrade diff flagging activities with submissions; JSON bundle import/export): keep draft/published versioning and learner preview; MVP offerings pin one version for the term and the diff UI and bundle import are v1.x.
- LMS CNT-01 (video upload with adaptive-streaming transcoding, PPTX conversion and auto-captioning): embed YouTube/Vimeo and upload PDFs at MVP.
- LMS CNT-02 and AUT QZ-01 (full quiz engine: banks, random draw, timed with accommodation multipliers, matching/ordering, AI-graded short answer): MVP = multiple choice, multi-select, true/false and unit-aware numeric.
- LMS ENR-02, SCH-01, SCH-02 (cohorts with date offsets, accommodation profiles, five-mode late-policy engine): sections, per-learner extensions and one late policy (grace plus percent per day with a cap) at MVP.
- LMS GBK-01 (weighted categories, drop-lowest, extra credit, Canvas/Moodle-specific CSV layouts): points-based gradebook with generic CSV export at MVP.
- LMS NTF-01 and DSC-01 (digests, org-branded templates, per-category unsubscribe; full Q&A forum with anonymity, search and moderation): immediate in-app/email notifications for about six events, announcements, and a simple per-task Q&A thread.
- LMS DAT-02 (US/EU data residency selected at tenant creation): single US region at MVP with the field reserved.
- LMS A11Y-01 and NFR ACC-01 (authored-content accessibility checker, NVDA+JAWS+VoiceOver test matrix, published ACR every release): WCAG 2.2 AA with automated checks and one screen reader per OS, a draft VPAT for the pilot, formal ACR at v1.x.
- AIG XPL-03 and EVAL-02 (clause library with explanations and fixes for all packs; full fixture matrix of oracle, null, five flaws and six memo variants per template): cover only the roughly 50 clauses the MVP checks cite and a reduced fixture set (oracle, null, two flaws, three memo variants).
- AIG LLM-08 (per-course cost dashboards with daily spend caps and alerts): per-tenant counters and one global cap at MVP.
- NFR SEC-01 (full OWASP ASVS 5.0 L2 control mapping): complete L1 plus the L2 controls for authentication, access control and data protection; full L2 with SOC 2 preparation at v1.x.
- NFR SEC-02 (SAML/OIDC institutional SSO as must): v1.x; OAuth sign-in and MFA for privileged roles at MVP.
- NFR SEC-05 and SEC-08 (SBOMs with signed images and continuous IaC scanning; COOP/COEP cross-origin isolation for multithreaded WASM): dependency scanning and SBOM only; a single-threaded solver needs no isolation and the isolation decision should wait for the LTI embedding design.
- NFR SBX-03 and SCL-02 (weighted fair scheduling per tenant and user with deadline-burst autoscaling): a priority queue with a per-tenant concurrency cap and a small fixed worker pool covers pilot scale.
- NFR AVL-01 and AVL-02 (99.9% availability with deadline-aware freezes, cross-region replication, quarterly DR drills): 99.5% target, hosted status page, PITR plus daily off-site backups and one rehearsed restore before the pilot.
- NFR CI-01, CI-02, TEST-03, TEST-04 (ephemeral preview per PR, canary deploys with automatic rollback, flags for every feature, cross-engine headless-GPU visual regression, load and resilience tests before every release): staging plus production with rolling deploys and manual rollback, flags for risky features, one Chromium smoke e2e and one load test before deadline week.
- NFR OBS-03 (per-tenant cloud cost attribution with anomaly detection): component-level cost plus LLM per-tenant counters at MVP.
- AUT TB-01, TB-11, TB-12 (full 11-section task builder; derived-expression parameters; point-cost hints with time- and check-based unlock conditions): design partners author with a validated JSON/YAML definition plus forms for the common sections, basic numeric ranges and on-request/after-N-failures hints only.
- AUT GL-02 (visual checkpoint-condition builder): the checkpoint DSL evaluator is must because CRS-04 needs it, but conditions are authored as JSON by the team at MVP; the builder UI is v1.x.
- AUT TL-01, VP-01, VP-03, LIB-02, CA-02, CA-03, CM-03 (linked templates with update propagation, mandatory reviewer workflow, three-way in-flight republish with regrade, custom library import with mapping and dry-run, edit locks and presence, anchored review threads, rollover checklist): copy-only templates, optional lightweight review, block grading-affecting edits while attempts exist, built-in libraries only, and out-of-band coordination among the two or three MVP authors.
- AUT TL-02 (>= 10 starter templates including a flat plate): eight beam/truss/frame templates with no plate are enough for one course and the regression suite.
- PRD MVP-01 (8-12 modules and 20-30 activities each with rubric, reference solution, randomization and golden set): content effort rivals engineering effort; plan 6-8 modules and 15-20 activities with design partners starting content in month one.
- PRD MVP-04 and GTM-01 (free self-serve sandbox with AI-graded sample tasks at launch): LLM cost and abuse exposure before metering and billing exist; make free-tier grading deterministic-only or hard-capped until BIL-03 ships.
- PRD PER-10 (full admin console with departments, seat reports and retention-driven offboarding): members, roles, roster import and institution defaults only at MVP.

## Gaps the critic found (each filled by a gap-fill agent)

- **Cross-domain canonical data model, identifier/version pin set, and unified event stream**: Every domain depends on it, yet each invented different names and scopes for the artifacts a submission and grade must pin (task version, content version, code pack id+version, engine artifact hash, checks library version, clause library version, rubric version, scenario instance, model hash, result hash, grader_version, prompt/model ids, section/material library and cost-model versions) and for event logs (MET-01 product analytics, INT-02 xAPI, SIM-SCH-02 op log, DAT-01/REV-04 audit logs, SUB-03 draft timeline, TB-12 hint usage). Without one contract, reproducible regrades, calibration, integrity review and FERPA record handling get implemented four different ways and cannot be joined later.
- **Standards licensing, reference-data redistribution, legal terms, and code-pack verification governance**: The code-pack strategy embeds ASCE 7-22, AISC 360-22 and ACI 318-19 equations and coefficient tables, the AISC Shapes Database v16.0, hazard values and paraphrased clause explanations; three domains flagged licensing as an open question and none owns it, nor learner IP of designs, ToS/AUP for self-serve users, under-18 handling, or the licensed-engineer sign-off and errata process that makes clause-cited grades defensible. A licensing block discovered late forces a redesign of packs and datasets, and an unreviewed check defect found after grades are released is a trust-ending incident.
- **Learner deliverables and grading specification per task archetype (Analyze, Check, Diagnose), including the memo and attachment deliverable**: CAT-03 makes the archetype the switch for active rubric categories, and most introductory (T1-T2) course tasks are Analyze or Check, yet only Design/Optimize have an end-to-end deliverable path (model + memo + checks + judged memo). There is no capture UI for learner-reported numeric answers or a structured findings report, no authoring of seeded errors for Diagnose tasks, and no grading rule for found/fixed errors, so a large share of the MVP course cannot be graded as specified.
- **Internal operator console, support workflows, incident runbooks, and help/documentation**: The MVP plan relies on manual tenant provisioning, 100% human review and an exit criterion of zero lost submissions or grades, but no requirement covers tenant provisioning tools, grading-job inspection and retry, engine/pack/grader version rollout and pin overrides, LLM budget kill-switches, data-subject request execution, consent-based impersonation, a 'report a problem with my model' flow, pilot support SLAs, help content or release notes. These are the tools the team and pilot instructors will use daily during the first term.
- **Academic integrity, exam mode, and AI-use policy (unified specification)**: Integrity is split across four domains at four priorities (LMS SUB-03 should, AI grading SCN-03 could, product TRU-01 should, structural GRD-05 should, workspace DET-01 hashing for plagiarism) with no shared model-fingerprint definition, no exam-mode lockdown profile, no process-evidence retention rules, no integrity case workflow and no stated policy on AI-written memos. Universities ask for all of these in procurement and at the first contested grade, and the pieces must agree on what the workspace logs.
- **Team projects, shared-model collaboration, and peer review at the document-model level**: CRS-05 (should) assumes learners share one model and one submission, and capstone courses (ABET SO5) need teams, but the workspace document model, op log and comment anchors assume a single editor and author-only collaboration (CA-02 locks, CA-03 threads). Ownership, actor ids on operations and element-level anchors must be in the MVP schema now, or team features will require migrating every stored model and op log.
