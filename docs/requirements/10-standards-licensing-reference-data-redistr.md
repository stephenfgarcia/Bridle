# Standards licensing, reference-data redistribution, legal terms (ToS/AUP, pilot agreements, learner IP, minors), disclaimers, and code-pack verification governance (gap-fill #2)

_Source: requirements discovery workflow `wf_6281c128-0bb` (gap-fill agent), 2026-11-03. 25 requirements: 23 must (MVP), 2 should (v1.x), 0 could (later)._

## Summary

Bridle's grader embeds derived content from copyrighted standards (ASCE 7-22, AISC 360-22, ACI 318-19; later Eurocode and NSCP 2015), a contract-licensed database (AISC Shapes Database v16.0), hazard values whose US seismic source (USGS) is public domain while wind/snow sources (ASCE) are delivered under site/subscription terms, and cost data for which the obvious commercial sources (RSMeans, ENR) are off limits. The defensible position for MVP is a facts-and-methods pack: equations as code, numeric coefficients in Bridle's own schema keyed by clause id, independently written explanations, zero verbatim text, figures or maps, link-out to official standards, and an executed AISC database license; permission requests to ASCE and ACI run in parallel, with ACI being the one input that can still block the concrete pack because ACI's terms expressly forbid AI, computer analysis and derivative use without consent. A machine-checked licensing register gates every pack and dataset publish, an automated similarity gate (or two-reviewer attestation where a publisher forbids automated analysis) enforces no-verbatim across packs, prompts, retrieval and exports, and a DMCA agent plus content-level kill switches make takedown a routine replace-within-10-business-days event. Learners own their models and memos; the platform and institution receive narrow purpose-bound licenses; exemplar reuse and grader-calibration use require recorded opt-in (learner-level and organization-level respectively) with de-identification and portability on deletion. Terms are split into self-serve ToS/AUP (16+ recommended, educational use only, no scraping or standard uploads), a sandbox AUP with technical limits, an institution pilot template with FERPA/state-privacy, errata-notification and no-engineering-services clauses, and under-18 handling only via institution-managed accounts. Every pack version ships with a licensed-engineer verification record bound to its content hash and a published verification report; grades carry full provenance so an S1 errata triggers institution disclosure within 2 business days, learner notification and a mandatory regrade offer within 10 business days. The liability position (educational software, not engineering services; SME sign-off is QA not a seal) is confirmed by counsel and backed by Tech E&O with media/IP coverage, cyber and CGL. Twenty-one of the 24 requirements are MVP blockers; Eurocode/NSCP determinations and the template/marketplace license are v1.x or later; licensing determinations, terms, minors, practice-act exposure and insurance need outside counsel.

## Must (MVP)

### GAP2-LIC-01 Reference-data licensing register gates every pack and dataset release

Maintain a licensing register with one determination record per embedded dataset or derived work (ASCE 7-22 content, AISC 360-22 content, AISC Shapes Database v16.0, named-site hazard dataset, unit-cost tables, clause explanations; later Eurocode, European profile tables and NSCP 2015). Each record states rights holder, protectability analysis (facts vs expression), legal basis, permitted uses (SaaS redistribution, derived values, display, export, LLM context), attribution text, fallback mode and counsel sign-off. The code-pack build pipeline refuses to publish any pack or dataset whose register entry is not approved. Gate: MVP launch blocker; outside counsel required for initial determinations.

**Why:** Three domains flagged licensing as open and unowned; a block discovered late forces a redesign of packs and datasets. A single machine-checked register makes the licensing position explicit, reviewable and enforced at build time instead of discovered at launch.

**Acceptance:**
- Register schema (see domain notes) implemented; every dataset shipped at MVP has a record in status approved with a counsel sign-off date.
- CI check: pack or dataset publish fails if any referenced dataset id lacks an approved register entry or its review_due date has passed.
- Each pack and dataset bundle embeds attribution text and legal basis in a machine-readable manifest; attribution renders on the Credits page and in export footers.
- Product copy never uses SDO logos and states non-affiliation with ASCE, AISC, ACI, CEN and ASEP (nominative use only).
- Register reviewed at least every 12 months and whenever a new pack version, dataset edition or rights-holder terms change; the link-out and institution-licensed-access fallback pattern is documented as the default for any dataset that loses approval.

### GAP2-LIC-02 ASCE 7-22 content: derived-values-only policy with permission request in parallel

ASCE/SEI 7-22 is copyrighted by ASCE and reproduction requires permission (ASCE routes requests via Copyright Clearance Center). The US pack may implement ASCE 7-22 methods as code (equations, load combinations) and store numeric coefficients as facts in Bridle's own schema keyed by clause id, but must not reproduce the standard's text, commentary, table layouts, figures or hazard maps. A written permission/educational-license request is submitted to ASCE in parallel; MVP ships on the derived-values basis only with counsel sign-off. Gate: MVP blocker; counsel required.

**Why:** Equations and factual coefficients are generally unprotectable in the US (17 USC 102(b); Feist) while text, commentary, figures and maps are protected. Staying on the factual side is the lowest-cost defensible position and avoids relying on unsettled fair-use case law (ASTM v. Public.Resource.Org 2023; ASTM v. UpCodes 2024), which concerned access-to-law republication rather than a commercial grader.

**Acceptance:**
- Pack content inventory for ASCE 7-22 lists each clause id used with content type (equation | numeric coefficient | Bridle explanation) and confirms zero text, figure or map assets.
- Coefficient tables derivable from the standard's equations (e.g., velocity pressure exposure coefficients) are computed at runtime; stored tables are limited to the subset needed by curriculum tasks.
- Table captions, footnotes and system descriptions are not copied; where a label is needed (e.g., seismic force-resisting systems) Bridle uses its own short descriptive labels with a clause id.
- Permission request to ASCE logged with date, scope and response; register entry records facts_derived basis plus request status.
- Link-out to the official ASCE 7-22 purchase/library page appears wherever a clause id is displayed.

### GAP2-LIC-03 AISC 360-22 content policy; AISC design examples used as verification benchmarks only

ANSI/AISC 360-22 is free to download but all rights reserved; the same derived-values-only rules as ASCE 7-22 apply. AISC Design Examples v16.0 and the Steel Construction Manual may be consulted by SMEs as benchmark references during verification, but their problem statements, text and design-aid tables are never reproduced in packs, tasks or the clause library. Gate: MVP blocker (counsel review covered by LIC-01).

**Why:** AISC specification methods are implemented by every commercial analysis package without a license and AISC distributes the standard free, so risk is low if the pack stays on the methods-and-facts side; the realistic leak is copying design-example problems into tasks.

**Acceptance:**
- Pack content inventory for AISC 360-22 confirms only equations, numeric limits and Bridle explanations; no verbatim text and no Manual design-aid tables reproduced.
- Verification benchmarks cite AISC Design Examples by example id and page only; benchmark input files are SME-authored, not copies of example statements.
- Task authoring guideline prohibits lifting textbook or design-example problems; task text passes the TXT-01 gate.
- Clause displays link out to the free official AISC 360-22 page at aisc.org.

### GAP2-LIC-04 AISC Shapes Database v16.0: execute AISC's developer license covering web/SaaS use

The AISC Shapes Database is distributed free but under AISC terms; AISC maintains a fee-free developer (commercial) license permitting inclusion of the database in a licensed application with click-wrap flow-down to end users, a new agreement per database version, and a template clause restricting distribution to personal-computer software. Bridle must obtain AISC's written license or confirmation that server-side use in a web SaaS, on-screen display and export of section properties are permitted, implement flow-down terms and attribution, and re-license for each database version. Gate: MVP blocker; counsel review of the executed agreement.

**Why:** Section properties are facts, but the compiled database is distributed by contract and the existing license template is desktop-oriented; executing the license removes ambiguity cheaply and provides a defensible attribution.

**Acceptance:**
- Executed AISC license or written AISC confirmation on file before the steel pack is enabled in production; register entry links to it and records covered version (v16.0) and permitted uses.
- Self-serve ToS and institution agreement include the AISC flow-down end-user terms; Credits page shows AISC's required attribution text.
- Database served only from Bridle's backend, never as a bulk download; exports limited to sections used in the learner's model plus any per-row notice the license requires.
- Fallback implemented behind a feature flag: user-supplied upload of the official AISC Excel file parsed client-side and/or runtime computation of properties from nominal dimensions, with the UI labelling the source.
- Adding a new database version to the register automatically creates a re-licensing task.

### GAP2-LIC-05 ACI 318-19: written consent sought; no text ingestion; counsel-approved fallback before the concrete pack ships

ACI's published terms prohibit reproduction, data mining, screen scraping, computer analysis, AI/ML training and derivative creation from its material without written consent, making ACI 318-19 the highest-risk pack input. Bridle requests written consent (educational/software license) from ACI; until obtained, the concrete pack may ship only in a counsel-approved facts-only form (equations as code, numeric factors in Bridle's schema, explanations authored independently with no ACI text in any tool), and ACI documents are never loaded into any automated pipeline, LLM prompt or similarity scan unless ACI consents. If counsel does not approve the fallback, the ACI pack moves to v1.x. Gate: MVP blocker for the concrete pack; counsel required.

**Why:** ACI's posture explicitly targets AI and derivative use; shipping without a documented position invites a takedown that would remove concrete grading mid-course. Equations and numeric factors remain unprotectable facts, but ACI's contractual terms (not only copyright) must be analysed.

**Acceptance:**
- Consent request sent to ACI with scope (coefficients keyed by clause id, independently written explanations, link-out, no text) and logged; response status tracked in the register.
- Technical control: ACI source documents live only in a restricted, access-logged location excluded from repositories, data lakes, retrieval indexes and LLM inputs; a CI rule blocks files matching ACI document fingerprints from entering pack repos.
- ACI clause explanations are authored by SMEs from their own knowledge and reviewed under the TXT-01 manual two-reviewer attestation path (no automated scan against ACI text until consent confirms it is permitted).
- Counsel sign-off memo on the fallback attached to the register entry before the ACI pack is enabled; if absent at code-freeze the concrete pack is feature-flagged off for launch.
- Clause displays link out to ACI's official store/collection page.

### GAP2-LIC-06 Named-site hazard dataset: public-domain seismic values, provenance-tagged manual entries for other hazards, no scraping

Seismic design parameters are sourced from the USGS Seismic Design Web Services (US Government work, public domain, credit requested). Wind, snow, ice, rain and tornado values for Bridle's curated teaching sites are entered manually by content authors from a lawfully licensed ASCE 7-22 copy or the ASCE Hazard Tool, limited to a small named-site set and tagged with provenance; bulk extraction or automated access to the ASCE Hazard Tool or ATC Hazards by Location is prohibited. Learners designing for real sites use link-out to the official tools or instructor-supplied values, and the hazard dataset is versioned and pinned alongside the code-pack version. Gate: MVP blocker.

**Why:** USGS data is free to redistribute; ASCE hazard data is delivered under site terms and an institutional subscription (which prohibits redistribution) exists, so wholesale copying is a contract and goodwill risk even if individual values are facts. A small provenance-tagged teaching set plus link-out keeps the product honest and the ASCE relationship intact.

**Acceptance:**
- Every site record stores per-parameter provenance: source (e.g., USGS asce7-22 service URL and response date; 'ASCE 7-22 manual lookup' with lookup date and author), units and hazard dataset version.
- USGS-derived values display 'Credit: U.S. Geological Survey' and the service version; no ASCE hazard map images appear anywhere in the product.
- Curated teaching-site count and manual-entry policy documented in the register entry with counsel confirmation of the de minimis/factual basis; no code path fetches ascehazardtool.org or hazards.atcouncil.org.
- Instructors can create custom sites by entering hazard values (user-supplied mode); learners see a 'Look up official values' link-out for real sites.
- Hazard dataset version is recorded on every grade (VER-03) so hazard-value errata are traceable.

### GAP2-LIC-07 Regional unit-cost tables: Bridle-authored educational cost index from public sources; no proprietary cost books

Economy scoring uses a Bridle-authored educational cost index built from public-domain or openly licensed sources (e.g., state DOT average bid price reports, BLS producer price indexes) and clearly labelled as illustrative; proprietary cost books (RSMeans/Gordian, ENR cost indexes, Craftsman, Spon's/BCIS) are never ingested. Instructors may upload their own unit-cost tables for a course, which remain private to that course. Gate: MVP blocker because economy is a grading criterion.

**Why:** Proprietary cost data is aggressively licensed and expensive, and grading needs only consistent relative costs rather than estimating-grade accuracy.

**Acceptance:**
- Each cost-table row stores source, publication date, region and normalization method; the register entry lists all sources and their licenses.
- UI and exports label cost outputs 'Illustrative educational unit costs; not for estimating or bidding'.
- Instructor-uploaded cost tables are course-scoped, carry an uploader rights attestation, and are excluded from platform-wide datasets and calibration data.
- Grader economy scores are expressed relative to task baselines so absolute values are never presented as real-world pricing.

### GAP2-TXT-01 No-verbatim-standard-text policy with authoring standard and release gate

Pack explanations, task text, rubric text, UI strings and exports must never contain verbatim or close-paraphrase text from any standard; authors write explanations from engineering understanding, cite clause ids, and keep each explanation to what the check needs. Every pack release passes a similarity gate against a restricted internal reference corpus of lawfully purchased standards where the publisher's terms permit internal analysis, or a two-reviewer manual attestation where they do not (ACI). Gate: MVP blocker.

**Why:** Paraphrase that tracks the structure and wording of a clause is still a derivative work; a measurable gate plus human attestation makes 'no verbatim' verifiable rather than aspirational.

**Acceptance:**
- Internal authoring standard defines: no copied sentences, no mirrored sentence order, no copied table captions or notes, Bridle variable-naming conventions, clause-id citation format.
- Automated gate (where permitted) fails on any 8-word contiguous overlap with the reference corpus (equation tokens and clause ids excluded) or more than 10% 5-gram overlap per explanation; results stored with the pack version.
- Reference corpus stored in an access-controlled bucket, never deployed, never indexed for retrieval, never passed to any LLM; access logged and limited to named individuals.
- Where a publisher's terms forbid automated analysis, two reviewers (author excluded) sign an attestation per clause batch; attestation ids are listed in the verification record (VER-01).
- Exports (PDF, CSV, JSON, model files) contain only clause ids, Bridle explanations and attribution; an automated export test asserts zero reference-corpus matches where scanning is permitted.

### GAP2-TXT-02 LLM prompt and retrieval isolation; clause-citation validation in AI feedback

All LLM prompts, system instructions, few-shot examples and retrieval indexes used by the grader may contain only Bridle-authored pack content (structured JSON, explanations, rubrics) and the learner's submission; standard PDFs and extracted text are never retrievable by the model. AI outputs are post-filtered for verbatim standard text where scanning is permitted, and every clause id cited in AI feedback is validated against the pack's clause registry. Gate: MVP blocker.

**Why:** LLMs can regurgitate memorized standard text and invent clause numbers; both undermine the no-verbatim position and the defensibility of clause-cited grades.

**Acceptance:**
- Retrieval index build reads only from the signed pack bundle; a build-time allowlist rejects any other source path.
- System prompt instructs the model not to quote standards verbatim; the output filter flags matches at TXT-01 thresholds, replaces the passage with the Bridle explanation plus clause id, and logs the event with pack version.
- Clause ids in AI feedback that do not exist in the pack registry are removed and logged; feedback displays 'Clause references validated against pack vX.Y.Z'.
- LLM vendor contract provides zero data retention and no training on Bridle inputs (coordinated with the AI-grader domain); the register records vendor terms.
- Learner uploads of full standards are blocked by the AUP and by file-fingerprint checks at upload.

### GAP2-TXT-03 Takedown-and-replace process with SLA and DMCA designated agent

Publish a rights-holder contact channel and register a DMCA designated agent with the US Copyright Office before launch. Any infringement notice or internal finding triggers a defined process: acknowledge within 1 business day, disable the specific clause explanation, table, site or template via content feature flags within 2 business days (degrading to clause id plus link-out so grading continues), author and SME-review replacement content within 10 business days, and record the incident and outcome in the register. Gate: MVP blocker.

**Why:** Safe-harbour protection for user-uploaded content (templates, memos) requires a registered agent, and content-level kill switches turn a takedown from a product outage into a routine replacement.

**Acceptance:**
- DMCA agent registration confirmation on file; the Terms and a /legal/copyright page list the agent and notice requirements.
- Every clause explanation, coefficient table, teaching site, cost table and shared template has an individually toggleable content flag; disabling an explanation degrades the UI to clause id plus link-out without breaking checks.
- Incident runbook implements the SLA clocks (1/2/10 business days); the incident log records notice received, actions, timestamps and the replacement content's reviewer attestation.
- Counter-notice and repeat-infringer handling for user content documented and enforced.
- Quarterly drill: one simulated takedown executed end to end with timings recorded.

### GAP2-IP-01 Learner ownership of models and memos; scoped licenses to the platform and the institution

Learners own the copyright in the models, memos and other content they create. Learners grant Bridle a non-exclusive, worldwide license limited to hosting, processing, analysing, displaying to authorized course staff, backing up and grading that content to provide the service, and grant their institution the rights needed for assessment, academic-integrity review, accreditation evidence and record retention under institution policy. No other rights (public display, marketing, model training) are taken without a separate consent record. Gate: MVP blocker; counsel required.

**Why:** Learner IP ownership is the expectation in university policy and among practising engineers; a narrow, purpose-bound license is easier to defend and simpler to explain in pilot negotiations.

**Acceptance:**
- ToS and institution agreement contain the ownership and license language; an in-product 'Your content' page explains it in plain language.
- Access control: learner content is visible only to the learner, enrolled course staff and institution roles named in the agreement; platform staff access requires a logged support reason.
- Marketing, public galleries and research use require a separate consent record (IP-02/IP-03); no code path publishes learner content without a consent reference.
- Institutional rights end-state on contract termination is defined (export then deletion per TOS-02 and IP-04).

### GAP2-IP-02 Instructor reuse of learner work as exemplars requires learner opt-in, anonymization and revocation

Instructors may reuse a learner submission as an exemplar (within their course, their institution, or Bridle's public gallery) only with a recorded learner opt-in for that scope; exemplars are anonymized by default and the learner can revoke, which removes the exemplar from future use within 30 days. Gate: MVP blocker for the policy and the per-submission opt-in control; richer exemplar tooling may follow in v1.x.

**Why:** Exemplars are among the most requested instructor features and the most likely source of IP and privacy complaints; a lightweight consent at submission time avoids both.

**Acceptance:**
- Submission flow offers a consent control with three scopes (this course / my institution / public gallery), default off; the consent record stores scope, terms version and timestamp.
- Exemplar display strips learner identity and metadata (name, email, ids, file metadata) unless the learner explicitly chose attribution.
- Revocation is self-serve; exemplar copies are removed from active use within 30 days and the audit log records the removal.
- Instructor exemplar library shows the consent scope on each item and prevents copying beyond the granted scope.

### GAP2-IP-03 Anonymized use of learner work for grader calibration requires organization opt-in and learner notice; no third-party model training

Bridle may use de-identified learner models, memos and grading outcomes to calibrate and evaluate the AI grader only where the learner's organization has opted in (institution admin) or, for self-serve users, the learner has opted in; learners always receive notice of the purpose. Calibration data is irreversibly de-identified, held separately from production records, and never used to train third-party foundation models. Gate: MVP blocker.

**Why:** Grader quality depends on calibration data from day one, but FERPA, state student-privacy laws and GDPR expect purpose limitation and institutional control; building consent in from the first submission avoids a later data-use reset.

**Acceptance:**
- Organization-level setting (default off) with dated acceptance by an authorized admin; self-serve toggle (default off) in account settings; both produce consent records with terms version.
- De-identification pipeline removes direct identifiers and free-text PII from memos before data enters the calibration store; the store has separate access controls and a documented retention period.
- LLM vendor terms prohibit training on Bridle data; calibration uses Bridle-controlled evaluation sets only.
- Learners can view which purposes their organization has opted into; withdrawal stops future inclusion and the notice explains that already de-identified data cannot be retrieved.
- Annual review of calibration data use recorded in the register.

### GAP2-IP-04 Portability and deletion: open-format export of all learner work and grades with defined retention

Learners can export all their models (Bridle JSON model schema plus a neutral geometry/results format), memos (Markdown and PDF), grade reports and consent records at any time. On account deletion, self-serve content is deleted within 30 days; institution-managed accounts follow the institution's retention schedule and the agreement's data-return terms. Gate: MVP blocker.

**Why:** Portability turns the learner-ownership promise into something testable and is a standard pilot-agreement demand.

**Acceptance:**
- 'Export my data' produces a downloadable archive within 24 hours containing the formats above, each with the educational-use disclaimer (DIS-01) embedded.
- Self-serve deletion: content removed from production within 30 days and from backups within 90 days; de-identified calibration derivatives retained only where consent existed and disclosed as such.
- Institution accounts: deletion or return executes per the agreement and the admin receives a completion certificate listing the data classes deleted.
- Exported model format and schema version are documented so third-party tools can read them.

### GAP2-TOS-01 Self-serve Terms of Service and Acceptable Use Policy

Self-serve individuals accept a ToS/AUP covering: educational use only and no use for construction, permitting or professional services; no scraping, bulk export or reverse engineering of code packs and reference datasets; no uploading of standards or other material the user lacks rights to; AI feedback is automated and not professional advice; learner IP terms (IP-01 to IP-04); AISC flow-down terms (LIC-04); minimum age (TOS-04); account, payment, suspension and termination rules; limitation of liability and governing law. Gate: MVP blocker; counsel required.

**Why:** The grader's defensibility and every licensing fallback depend on users being bound to educational-use and no-redistribution terms.

**Acceptance:**
- Click-through acceptance recorded with terms version, timestamp and IP; re-acceptance required on material changes with a published changelog.
- AUP enforcement hooks exist: export rate limits and watermarking, upload fingerprinting for known standards, and a suspension workflow.
- Plain-language summary page highlights the educational-use limit and the AI-feedback statement.
- Counsel-reviewed draft approved before public signup opens; dispute-resolution approach (arbitration vs courts) decided with counsel.

### GAP2-TOS-02 Institution pilot agreement essentials

A standard pilot/subscription agreement template for institutions covers: FERPA 'school official' designation and data-processing terms (GDPR DPA where applicable; state student-privacy clauses such as Illinois SOPPA and California SOPIPA); learner IP and data-use consents (IP-01 to IP-03); educational-use and no-engineering-services statements; access to verification reports and errata notifications with the duties in VER-03; security and availability commitments; insurance certificate (VER-04); limitation of liability; term, termination, data return and deletion; publicity and non-affiliation statements. Gate: MVP blocker for any institutional pilot; counsel required.

**Why:** Universities negotiate from their own templates; having Bridle's positions ready on IP, AI use, verification and errata shortens procurement and avoids inadvertently promising engineering services.

**Acceptance:**
- Template approved by counsel with a redline playbook for the five most negotiated clauses (liability cap, data use, IP, insurance, accessibility).
- Agreement designates an institution contact for errata notices and an admin authorized to grant data-use consents.
- A clause states Bridle provides educational software, not engineering services, and that no output is sealed or suitable for construction.
- Signed agreement required before any institution-managed accounts are provisioned (enforced in the admin provisioning workflow).

### GAP2-TOS-03 Free sandbox acceptable use and technical limits

The free sandbox is for personal learning and evaluation only: no commercial, production or client work; no automated access; limited model size, export count and hazard lookups; exports watermarked and disclaimer-stamped; no API access; no publishing to the public gallery without an account in good standing. Gate: MVP blocker.

**Why:** An unlimited free simulation workspace invites practitioners to use it as free analysis software, which undermines the educational-use position and creates liability exposure.

**Acceptance:**
- Sandbox tier enforces configurable quantitative limits and displays them; attempts beyond limits show the educational-use message and course/upgrade paths.
- Sandbox exports are watermarked 'Bridle free sandbox - educational use only - not for construction'.
- Sandbox users accept the same ToS/AUP; abuse signals (bulk exports, scripted access) trigger throttling and review.
- Sandbox content is covered by IP-01 and deleted after a published inactivity period.

### GAP2-TOS-04 Minimum age and under-18 (dual-enrollment) handling

Self-serve accounts require users to be at least 16 (recommended; counsel to confirm 13 vs 16 by jurisdiction) and paid self-serve subscriptions require 18 or a guardian. Under-18 learners are admitted only through institution-managed accounts where the institution provides the required consent (COPPA school consent or parental consent, FERPA, GDPR Article 8 where applicable) and no advertising, profiling or non-educational data use occurs. Gate: MVP blocker; counsel required.

**Why:** Dual-enrollment and early-college programs are a realistic university use case; routing minors through the institution keeps Bridle out of direct parental-consent flows at MVP.

**Acceptance:**
- Signup collects date of birth or an age attestation; under-threshold attempts are blocked with guidance to use an institution account and no minor data is retained from failed signups.
- Institution-managed minor accounts are flagged; flagged accounts have marketing email, public-gallery sharing and calibration data use disabled by default.
- Pilot agreement includes the institution's consent representation for minors and the data-use restrictions.
- Privacy notice has a minors section; a counsel memo records the jurisdictional age thresholds chosen.

### GAP2-DIS-01 Disclaimer placement rules for workspace, AI feedback, exports, certificates and API responses

Standard disclaimer strings (domain notes D1-D5) must appear: persistently in the simulation workspace (non-dismissable footer or status badge); on every AI-feedback panel with instructor-review status; on the first page and page footer of every PDF export; as a header comment in CSV exports; as a metadata field in JSON and model exports; on every certificate; and as a disclaimer field in every API response envelope plus a response header. Certificates recognize completion only and make no licensure, competency or PDH/CEU claim at MVP. Gate: MVP blocker.

**Why:** Consistent, machine-checkable disclaimer placement is the cheapest part of the liability position and the first thing counsel, insurers and institutions ask to see.

**Acceptance:**
- Disclaimer strings centrally defined and versioned; an automated UI test and an export snapshot test fail if any surface lacks the required string.
- AI feedback panels show 'Automated feedback - not professional engineering advice' and either 'Reviewed by <instructor>' with date or 'Not yet reviewed by an instructor'.
- Certificate template carries D3 plus the pack and verification versions used in the course; no PDH/CEU wording unless a registered-provider arrangement exists (v1.x or later).
- API responses include disclaimer, code_pack_version and verification_status fields; API docs state the educational-use limitation.
- Product copy and the grader's name never use 'engineer', 'PE', 'SE' or 'certified' to describe the AI.

### GAP2-VER-01 Licensed-engineer SME review and signed verification record per code-pack version

Every code-pack version is reviewed before release by an independent licensed engineer (US pack: PE or SE licensed in a US jurisdiction; later packs: equivalent chartered or licensed status) who did not author the pack, against a benchmark suite of SME-authored hand calculations and recognized reference examples. The reviewer signs an electronic verification record bound to the pack's content hash stating scope, coverage, benchmark results, limitations and credentials, and stating explicitly that the sign-off is educational content quality assurance, not a professional engineering seal or certification of any design. Gate: MVP blocker; counsel to confirm the sign-off is not practice of engineering in the pilot states.

**Why:** Clause-cited grades are only defensible if a qualified, accountable reviewer verified the checks; binding the record to a content hash makes the verified artifact unambiguous.

**Acceptance:**
- Verification record schema (domain notes) implemented; record is signed (detached signature) over the canonical pack bundle hash; pack publish fails without a record in verified status.
- Benchmark suite has at least one benchmark per check id with expected values and tolerance; all pass within tolerance (default 0.5% for deterministic checks; documented exceptions up to 1%).
- Reviewer independence and credential (license type, number, jurisdiction, expiry) captured; the SME engagement agreement covers confidentiality, IP assignment, conflict disclosure and the 'not engineering practice' scope statement.
- Deterministic checks and coefficient data are in scope; LLM rubric scoring is explicitly out of scope and labelled calibrated rather than verified.
- Pack bundles are immutable once verified; any change produces a new version and a new record.

### GAP2-VER-02 Published verification report and gating of unverified checks

For each released pack version Bridle publishes a verification report summarizing scope, check coverage, benchmark results, known limitations, reviewer credential type and the errata list, available to institutions, learners and the public. Checks without verified status cannot contribute to released grades; they may run in preview mode with an unverified badge and are excluded from scores unless an instructor explicitly enables them with a visible label. Gate: MVP blocker.

**Why:** Transparency about what is and is not verified is what lets institutions accept AI-assisted grading and what limits the blast radius of defects.

**Acceptance:**
- A /verification page lists every pack version with report, publication date, content hash and status (verified / superseded / withdrawn).
- Grader refuses to score unverified check ids unless the instructor override flag is set; the override is shown on the learner's grade report.
- Report is generated from the verification record (no hand-edited numbers) and includes coverage percentage by chapter or clause family.
- Institution admins can subscribe to report updates and errata notices.

### GAP2-VER-03 Errata process for check defects found after grades are released, with grade provenance and deterministic replay

Every grade records pack version, hazard dataset version, check ids, input hashes and grader model/prompt version so affected submissions can be enumerated and replayed deterministically. A confirmed defect is classified S1 (changes any released score or pass/fail), S2 (changes displayed values without crossing grade bands) or S3 (explanatory or cosmetic). S1 triggers institution disclosure within 2 business days, a changelog entry, learner notification, and a mandatory regrade offer within 10 business days; self-serve learners receive an automatic no-harm regrade. Gate: MVP blocker.

**Why:** A defect discovered after grades are released is a trust-ending incident unless the response is fast, transparent and reproducible.

**Acceptance:**
- Grade record schema includes the provenance fields; a replay job re-scores any historical submission against any pack version and produces a diff.
- Erratum record schema (domain notes) implemented; a public changelog per pack lists errata with severity and fix version.
- S1 SLA clocks (disclosure 2 business days, regrade offer 10 business days) tracked in the incident tool; notifications go to the institution contact (TOS-02) and to affected learners in-app and by email.
- Regrade policy: institutions decide whether to apply regrades to their gradebook but learners are always notified; self-serve regrades never lower a released score.
- Hotfix packs ship as PATCH versions with a new verification record covering the changed checks plus full benchmark regression.

### GAP2-VER-04 Professional-liability position and insurance assumptions

Bridle's stated position is that it provides educational software and automated feedback, not engineering services: no output is sealed, no user may rely on it for construction, and SMEs provide content quality assurance rather than engineering practice. Counsel confirms this position against the engineering practice acts of the pilot states (including title use and firm-authorization rules), and the company carries Technology E&O with media/IP-infringement coverage, cyber liability and commercial general liability at limits institutions typically require (assumption: at least 1M per claim / 2M aggregate at MVP, reviewed at the first institutional contract). Gate: MVP blocker; counsel and insurance broker required.

**Why:** The liability stance ties together disclaimers, terms, SME scope and insurance; stating it once lets every other requirement reference it consistently.

**Acceptance:**
- Counsel memo on file covering practice-of-engineering exposure, SME sign-off characterization and certificate/PDH claims; action items tracked in the register.
- Insurance certificates obtained before the first institutional pilot; coverage includes copyright and media claims arising from content.
- ToS, pilot agreement, disclaimers and SME agreements use consistent liability language reviewed together.
- Liability position reviewed annually and whenever packs expand to new jurisdictions (Eurocode, NSCP).

## Should (v1.x)

### GAP2-LIC-08 Eurocode, European profile tables and NSCP 2015: licensing determination before build

Before any Eurocode or NSCP work starts, the register must hold determinations for: CEN/national-standards-body copyright in the Eurocodes and in EN 10365 profile dimensions; the EU sui generis database right, which can protect compiled profile tables even where dimensions are facts; and ASEP's written-permission requirement for NSCP 2015, whose status as a referral code under the Philippine National Building Code and local fair-use rules need Philippine counsel. Fallbacks are producer-catalogue-derived values with attribution, runtime computation of section properties from nominal dimensions, or user-supplied uploads. Gate: v1.x; outside counsel (EU and Philippines) required.

**Why:** The EU database right has no US equivalent and is the trap most likely to be missed by a US-focused team; NSCP is derived from US codes but separately owned by ASEP.

**Acceptance:**
- Register entries for Eurocode packs, EN profile tables and NSCP 2015 reach approved status before the first sprint of those packs is scheduled.
- European profile tables are either computed from nominal dimensions at runtime or sourced under a documented license with attribution; the register records source database and extraction scope.
- Permission request to ASEP logged with response; the NSCP pack is feature-flagged off until approved.
- EU and Philippine counsel memos attached to the entries.

### GAP2-TOS-05 Default license for shared templates and groundwork for a future marketplace

Instructor-shared templates (tasks, models, rubrics) published to the public gallery carry a default open license (recommended CC BY 4.0; counsel and product to confirm versus CC BY-NC-SA 4.0) with the contributor retaining ownership, attribution rendered automatically, and a contributor warranty that the template contains no third-party standard text or licensed data. A future paid marketplace requires a separate seller agreement, content review, revenue share and tax handling. Gate: v1.x for the gallery; marketplace later.

**Why:** Setting the default license before the first share avoids retroactive relicensing, and the no-standard-text warranty keeps user content inside the TXT-01 policy.

**Acceptance:**
- Share flow displays the license, requires the contributor warranty, and stores license version with the template.
- Templates pass the TXT-01 gate and upload fingerprinting before appearing publicly; the TXT-03 takedown path applies.
- Gallery pages render attribution and license badges; forks inherit the license and attribution chain.
- Marketplace requirements (seller agreement, payouts, tax forms, content review, refund policy) captured as a backlog epic with counsel review before any paid listing.

## Non-functional targets

| id | title | target |
|---|---|---|
| GAP2-NFR-01 | Takedown-and-replace SLA | Acknowledge rights-holder notice within 1 business day; disable affected content via flag within 2 business days; SME-reviewed replacement live within 10 business days; 100% of incidents logged with timestamps; one drill per quarter. |
| GAP2-NFR-02 | Errata response SLA | S1: institution disclosure within 2 business days of confirmation, learner notification and regrade offer within 10 business days; S2: fix in a PATCH release within 30 days; S3: next scheduled release; replay job enumerates affected submissions within 24 hours. |
| GAP2-NFR-03 | No-verbatim similarity gate thresholds | Zero 8-word contiguous overlaps with the reference corpus (equation tokens and clause ids excluded) and at most 10% 5-gram overlap per explanation; 100% of explanations either scanned or covered by a two-reviewer attestation before publish. |
| GAP2-NFR-04 | Verification benchmark coverage and tolerance | At least one benchmark per check id (100% coverage); deterministic check results within 0.5% of SME reference values (documented exceptions up to 1%); 100% pass before a record can be signed. |
| GAP2-NFR-05 | Disclaimer coverage | 100% of workspace views, AI-feedback panels, export formats, certificates and API endpoints covered by automated disclaimer tests; zero releases shipped with a failing disclaimer test. |
| GAP2-NFR-06 | Licensing register completeness and freshness | 100% of shipped datasets and packs reference an approved register entry; review cadence at most 12 months; CI blocks publish on missing/expired entries with zero manual overrides. |
| GAP2-NFR-07 | Consent record integrity | Every exemplar and calibration use references a consent record id; a weekly audit query returns zero orphan uses; revocations propagate within 30 days. |
| GAP2-NFR-08 | Portability and deletion timing | Export archive available within 24 hours of request; self-serve deletion within 30 days (production) and 90 days (backups); institution deletion per agreement with completion certificate. |
| GAP2-NFR-09 | Pack immutability and replay fidelity | Every released pack has a content hash and signed record; deterministic replay reproduces 100% of historical deterministic check scores bit-for-bit for the same pack version. |
| GAP2-NFR-10 | Reference corpus containment | Standards reference corpus accessible to at most 5 named individuals with 100% access logging; CI asserts corpus fingerprints are absent from repositories, build artifacts, retrieval indexes and LLM logs on every build. |

## Domain notes (for architecture and UX)

A. LICENSING DETERMINATIONS (initial, pending counsel) - dataset | rights holder | protectable? | basis for Bridle | SaaS redistribution? | fallback
1. ASCE 7-22 equations/coefficients | ASCE | equations/numeric coefficients: facts/methods (not protectable); text, commentary, table layouts, figures, hazard maps: protected | facts_derived, own schema, clause-id citations, no text | derived values yes; text/figures/maps no | link-out to ASCE; permission request via Copyright Clearance Center logged; institution-licensed access later
2. AISC 360-22 | AISC | same split; standard is free to download but all rights reserved | facts_derived | derived values yes | link-out to free PDF at aisc.org
3. AISC Shapes Database v16.0 | AISC | facts, but distributed under contract; fee-free developer license exists with click-wrap flow-down, per-version re-licensing, and a template clause limiting distribution to personal-computer software | license_executed (required) | only under executed license confirming web/SaaS use | user-supplied Excel upload parsed client-side; runtime computation of properties from nominal dimensions
4. ACI 318-19 | ACI | numeric factors/equations: facts; ACI terms expressly prohibit reproduction, data mining, screen scraping, 'computer analysis', AI/ML training and derivatives without written consent | permission_pending; facts-only fallback requires counsel memo | derived values only if counsel approves; no text ever | defer concrete pack to v1.x
5. Hazard dataset: seismic (USGS Seismic Design Web Services, asce7-22 endpoint) | US Government | public domain, credit requested | public_domain with credit | yes | n/a
6. Hazard dataset: wind/snow/ice/rain/tornado | ASCE (Hazard Tool; public terms are disclaimer-only; 2017 institutional multi-user subscription prohibits copying/redistribution of Licensed Material) | individual values are facts; bulk dataset/maps protected by contract and copyright | manual per-site transcription for a small curated teaching set with provenance; no scraping | small set yes (counsel to confirm); bulk no | link-out; instructor-entered values; institutional subscription integration later
7. Unit-cost tables | n/a (Bridle-authored) | sources must be public domain or open (state DOT bid tabulations, BLS PPI); RSMeans/Gordian, ENR, Craftsman, Spon's/BCIS excluded | own_work | yes | instructor upload (course-scoped)
8. Clause explanations | Bridle | own expression; derivative-work risk if close paraphrase | own_work gated by TXT-01 | yes | disable via content flag, fall back to clause id + link-out
9. Eurocodes (EN 1990-1999) | CEN and national standards bodies | copyright asserted on documents and national adoptions; reproduction requires NSB agreement; equations/methods still facts | facts_derived + NSB discussion (v1.x) | derived values likely; text no | link-out to NSB stores
10. European profile tables (EN 10365 dimensions; producer catalogues) | CEN/NSBs; producers | dimensions are facts, but EU sui generis database right (Directive 96/9/EC, 15-year term, protects substantial investment in obtaining/verifying/presenting) can protect compilations | compute properties from nominal dimensions or license a source (v1.x) | only with documented source | user upload
11. NSCP 2015 | ASEP | written permission required per ASEP notice (2010 edition; 2015 presumed same); referral-code status under PD 1096 IRR and Philippine fair use need PH counsel | permission_pending (v1.x) | no until approved | link-out; defer

B. LEGAL DOCTRINES IN PLAY: 17 USC 102(b) idea/expression and merger (equations, methods, single-expression tables); Feist (facts and thin compilation copyright); contract terms override copyright defaults (ACI terms, ASCE site/subscription terms, AISC license); ASTM v. Public.Resource.Org, 82 F.4th 1262 (D.C. Cir. Sept 12, 2023) - non-commercial posting of standards incorporated by reference into law is fair use; ASTM v. UpCodes (E.D. Pa. Oct 2, 2024) - preliminary injunction denied, for-profit posting of IBR standards likely fair use because access-to-law purpose; neither covers a commercial grader embedding derived content, so not relied upon at MVP. EU database right has no US equivalent. Trademarks (ASCE, AISC, ACI, Eurocode, NSCP): nominative use only, no logos, non-affiliation statement. DMCA 512 safe harbour requires a registered designated agent (US Copyright Office directory; small fee; renew every 3 years).

C. FALLBACK PATTERNS (choose per dataset, record in register): (1) derived-values-only: equations as code + numeric coefficients in Bridle schema keyed by clause id; (2) link-out: deep link to the official store/library page, never proxying content; (3) user-supplied upload: learner/instructor uploads a file they are licensed for, parsed client-side, course-scoped, never aggregated; (4) institution-licensed access: integration with the institution's subscription (e.g., ASCE Hazard Tool multi-user, ASCE Library, ACI Collection) via the institution's credentials, v1.x+; (5) content flag off: clause id + link-out only, grading continues.

D. SCHEMAS
licensing_register_entry { id, name, publisher, edition_or_version, rights_holder, protectability: facts|expressive|mixed, legal_basis: public_domain|license_executed|facts_derived|own_work|permission_pending|blocked, license_doc_ref, permitted_uses: [saas_redistribution, derived_values, display, export, llm_context], attribution_text, fallback_mode: derived_only|link_out|upload|institution_licensed|flag_off, counsel_signoff: {by, date, memo_ref}, request_log: [{to, date, scope, response}], review_due, status: draft|approved|expired|revoked }
verification_record { pack_id, pack_version (semver: MAJOR = code edition change, MINOR = new checks/coverage, PATCH = errata), content_hash (sha256 of canonical bundle), scope: [check_id], coverage: {clauses_total, clauses_checked, pct_by_chapter}, benchmarks: [{id, citation_only, inputs_hash, expected, actual, tolerance, pass}], author: {name}, reviewer: {name, credential_type: PE|SE|CEng|other, license_number, jurisdiction, expiry, independence_attestation}, attestation_ids_txt01: [], limitations: [text], not_a_seal_statement: true, signed_at, signature, status: draft|verified|superseded|withdrawn }
erratum { id, pack_versions_affected, hazard_dataset_versions_affected, check_ids, severity: S1|S2|S3, description, discovered_at, confirmed_at, root_cause, fix_version, affected_submissions_query, institutions_notified_at, learners_notified_at, regrade_offer_deadline, status }
grade_provenance { submission_id, pack_version, pack_hash, hazard_dataset_version, cost_index_version, check_ids, input_hash, grader_model_id, prompt_version, rubric_version, verification_status, graded_at }
consent_record { subject_type: learner|org, subject_id, org_id, purpose: exemplar|calibration|research|marketing, scope: course|institution|public, granted_by, terms_version, granted_at, revoked_at, evidence }

E. DISCLAIMER STRINGS (central, versioned)
D1 (workspace, exports): 'Educational use only. Not for construction, permitting, or professional engineering use. Results are not a substitute for analysis and design by a licensed engineer.'
D2 (AI feedback): 'This feedback was generated automatically by an AI grader and is not professional engineering advice.' + 'Reviewed by <instructor> on <date>' or 'Not yet reviewed by an instructor'.
D3 (certificates): 'This certificate recognizes completion of educational activities on Bridle. It is not a professional license, credential, or certification of engineering competency and does not by itself confer PDH/CEU credit.'
D4 (API): JSON envelope field disclaimer: {code: 'EDU_ONLY_V1', text: D1}, plus code_pack_version and verification_status; header X-Bridle-Disclaimer: EDU_ONLY_V1.
D5 (non-affiliation): 'Bridle is not affiliated with or endorsed by ASCE, AISC, ACI, CEN, or ASEP. Clause references are provided for study; consult the official standards.'
Sandbox watermark: 'Bridle free sandbox - educational use only - not for construction'.

F. ATTRIBUTION TEXT DRAFTS (pending publisher/counsel confirmation)
- 'Seismic design parameters from the U.S. Geological Survey Seismic Design Web Services (ASCE 7-22 edition). Credit: U.S. Geological Survey. Public domain.'
- 'Section dimensions and properties from the AISC Shapes Database v16.0, copyright American Institute of Steel Construction, used under license.' (exact wording per executed license)
- 'Clause references cite ASCE/SEI 7-22, ANSI/AISC 360-22 and ACI 318-19, which are copyrighted by their publishers. Bridle does not reproduce their text. Obtain the official standards from ASCE, AISC and ACI.'
- 'Illustrative educational unit costs compiled by Bridle from public sources (listed); not for estimating or bidding.'

G. GATING SUMMARY: MVP blockers (must): LIC-01..07, TXT-01..03, IP-01..04, TOS-01..04, DIS-01, VER-01..04. v1.x (should): LIC-08 (Eurocode/EN profiles/NSCP determinations), TOS-05 (gallery license). Later (could): paid marketplace (within TOS-05), institution-licensed access integrations, PDH-bearing certificates. Outside counsel required: LIC-01, LIC-02, LIC-04 (agreement review), LIC-05, LIC-06 (de minimis confirmation), LIC-08 (EU + PH counsel), IP-01, TOS-01, TOS-02, TOS-04, VER-01 (practice-act question), VER-04 (plus broker). Can proceed without counsel: LIC-03, LIC-07, TXT-01, TXT-02, TXT-03 (agent registration is administrative), IP-02, IP-03, IP-04, TOS-03, TOS-05 draft, DIS-01, VER-02, VER-03.

H. COUNSEL CHECKLIST (one engagement, sequenced): (1) register determinations for items A1-A8 and the ACI fallback memo; (2) AISC license review/amendment for SaaS; (3) ToS/AUP, privacy notice, minors policy; (4) institution pilot template with FERPA/SOPPA/SOPIPA/GDPR DPA; (5) practice-of-engineering memo for pilot states incl. SME sign-off and AI branding; (6) insurance coverage review with broker (Tech E&O incl. media/IP, cyber, CGL); (7) DMCA agent registration and copyright policy page; (8) later: EU database-right and CEN/NSB memo, Philippine counsel for NSCP, marketplace seller agreement, PDH provider rules.

I. RECOMMENDED REPO ARTIFACTS (greenfield; proposed paths): /legal/licensing-register.yaml (source of truth consumed by CI gate); /legal/disclaimers.json (D1-D5, versioned); /legal/templates/{tos.md, aup.md, pilot-agreement.md, sme-engagement.md}; /packs/<pack>/manifest.json (attribution, legal_basis, content_hash); /packs/<pack>/verification-record.json + .sig; /packs/<pack>/CHANGELOG.md (errata with severity); /tools/ci/pack-publish-gate (register approval, similarity gate, disclaimer tests, corpus-fingerprint scan); grading service persists grade_provenance on every score.

J. SOURCES CONSULTED (verification, Nov 2026): ACI copyright page (concrete.org/copyright.aspx) - prohibits reproduction, data mining, AI training, computer analysis, derivatives without written consent; ASCE Hazard Tool terms page (asce.org/publications-and-news/asce-hazard-tool/terms) - disclaimers only, site terms apply; ASCE Hazard Tool multi-user subscription (2017 PDF) - institutional license prohibiting copying/redistribution; AISC 360-22 free download page (aisc.org/publications/steel-standards/aisc-360); AISC Shapes Database v16.0 page and developer Commercial License Agreement template (fee-free, click-wrap, per-version, PC-distribution clause); USGS Copyrights and Credits page - USGS data public domain, credit requested; USGS Seismic Design Web Services asce7-22 endpoint; CEN-CENELEC copyright page and Guide 10; NSCP 2010 copyright notice (ASEP); ASTM v. Public.Resource.Org (D.C. Cir. 2023) and ASTM v. UpCodes (E.D. Pa. 2024) summaries.

## Risks

| risk | mitigation |
|---|---|
| ACI refuses or delays consent and counsel does not approve the facts-only fallback, leaving the concrete pack unlaunchable at MVP. | Send the consent request in the first planning sprint; build the ACI pack behind a feature flag with independent authoring and no ACI text in any tool; prepare a v1.x launch plan for concrete and a curriculum that can run steel-and-loads only. |
| AISC's developer license template is desktop-oriented and does not clearly cover server-side SaaS use, display and export of Shapes Database properties. | Request written confirmation or an amended license from AISC before the steel pack is enabled; keep the user-upload and derived-properties fallback behind a flag; never offer bulk download. |
| ASCE objects to manually transcribed wind/snow values for teaching sites or changes Hazard Tool terms. | Keep the curated site set small with per-value provenance, use USGS public-domain data for seismic, provide link-out for real sites, pursue an educational data license or the institutional multi-user subscription as the longer-term path, and keep the content flags ready for removal. |
| The LLM reproduces memorized standard text or invents clause numbers in graded feedback, undermining the no-verbatim position and grade defensibility. | Prompt/retrieval isolation, output similarity filter where permitted, clause-id validation against the pack registry, and logging of every intervention with pack version. |
| A check defect surfaces after grades are released and the response is slow or irreproducible, causing an institution to withdraw. | Grade provenance and deterministic replay from day one, S1/S2/S3 classification with SLA clocks, mandatory regrade offer, public changelog, and institution contact designated in the agreement. |
| A state board treats the SME sign-off, the AI grader branding, or the platform's outputs as practice of engineering or unlicensed offering of engineering services. | Counsel memo on practice acts in pilot states; sign-off worded as content QA not a seal; no 'engineer/PE/SE/certified' branding of the AI; educational-use disclaimers on every surface; no construction-ready exports. |
| Licensed SME reviewers are scarce or expensive, delaying pack releases. | Retain at least two independent PE/SE reviewers under framework agreements; scope benchmarks per check so reviews are incremental; PATCH releases re-verify only changed checks plus regression. |
| Minors enter via self-serve or dual-enrollment without appropriate consent, triggering COPPA/FERPA/state-law exposure. | Age gate at signup, institution-only path for under-18, flagged minor accounts with restricted data use, and consent representations in the pilot agreement. |
| European profile tables are extracted from a CEN/NSB-protected compilation and trigger EU database-right claims when Eurocode packs ship. | Complete the LIC-08 determination before build; compute properties from nominal dimensions or license a source; attribute and document extraction scope; obtain EU counsel memo. |
| Tech E&O policy excludes copyright/media claims, leaving the content-licensing exposure uninsured. | Broker to confirm media/IP coverage explicitly; align policy with the register's risk inventory; review at first institutional contract. |

## Open questions

- Will ACI grant written consent for coefficient use keyed by clause id and independently authored explanations in a commercial educational SaaS, on what terms and fees, and if not does counsel endorse the facts-only fallback or should the concrete pack move to v1.x?
- Does AISC's Shapes Database developer license cover server-side SaaS use, on-screen display and per-model export (the template references distribution for personal computers), and what attribution and click-wrap wording does AISC require?
- What is ASCE's position on manually transcribed per-site wind/snow/ice values for a small set of named teaching sites, and is an educational data license or an institutional multi-user Hazard Tool subscription integration available?
- Which pilot-state practice acts could treat the SME sign-off, the AI grader, or exported results as practice or offering of engineering, and does any state require firm authorization or restrict title use in Bridle's marketing?
- Self-serve minimum age: 16 (GDPR-safe) versus 13 (COPPA floor), and which state student-privacy laws (SOPPA, SOPIPA, others) apply to the first pilot institutions?
- Default gallery template license: CC BY 4.0 (marketplace-friendly) versus CC BY-NC-SA 4.0 (OER-conventional); does a future paid marketplace change the recommendation?
- Should self-serve learner data be opt-in (recommended) or opt-out for grader calibration, and what retention period applies to de-identified calibration data?
- Is any reliance on the ASTM v. Public.Resource.Org / ASTM v. UpCodes line of cases appropriate for incorporated-by-reference standards, or is it excluded from the MVP position entirely (recommended)?
- May Bridle run an automated similarity scan against lawfully purchased standard text given ACI's 'computer analysis' prohibition, or must ACI content rely solely on manual two-reviewer attestation?
- What insurance limits will the first pilot institutions require, and does the quoted Tech E&O policy expressly cover copyright and media claims arising from pack content?
- Should Bridle pursue formal education partnerships with ASCE, AISC and/or ACI that could unlock verbatim clause viewing for institution-licensed users in v1.x?
- May learners quote short excerpts of standards inside private memos (fair-use commentary) provided memos are never indexed, published or used in prompts beyond grading?
- Regrade floor: when an institution declines to apply an S1 regrade, must learners still be notified of the defect (recommended yes as a transparency floor)?
- Certificates: which states require registered providers for PDH/CEU claims, and when (if ever) should Bridle or partner institutions issue PDH-bearing certificates?
