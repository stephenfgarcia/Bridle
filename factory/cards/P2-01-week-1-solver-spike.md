---
id: P2-01
title: Week-1 solver spike
phase: P2
order: 201
dependsOn: [P0-02]
estimate: 1
station: backlog
status: planned
owner: -
updated: 2026-11-03T08:29:21Z
history:
---

# P2-01 Week-1 solver spike

## Spec

Work package (E2 row): Week-1 solver spike: sparse LDLT with AMD on wasm32, M reference and M cap scenes timed on M1/Safari and Tiger Lake/Chrome, fallback decision

After: P0-02. Size: 1 engineer-weeks. Split into sub-cards at the spec station per E1.

### Draft for the owner's approval (2026-11-17, not approved)

Drafted by a spec-draft agent from the documents; nothing here is in force until the owner approves it. Short names: "roadmap" is
`docs/plan/roadmap.md`, "arch" is `docs/architecture/architecture.md`, "req 02" is
`docs/requirements/02-simulation-finite-element-engine.md`. Values marked "draft value" are proposals: the documents give no figure.

What exists today: one crate, `crates/bridle-canon` (a skeleton); no solver code. `tools/toolchain.json` pins the
`wasm32-unknown-unknown` target, wasm-bindgen-cli 0.2.130, binaryen 133, wasmtime 50 and Playwright 1.64.1 with Chromium only.
This development machine reports `Apple M4 Pro`, 48 GB, model `Mac16,7` (`sysctl`, 2026-11-17): it is neither reference machine.
Safari and Google Chrome are installed on it.

#### 1. Row acceptance criteria

1. "sparse LDLT with AMD on wasm32": a spike crate builds for `wasm32-unknown-unknown` at the recorded numeric profile (simd128,
   single thread, no FMA: arch line 219) and `bash crates/bridle-spike/test/wasm.test.sh` factors and solves the M-ref scene with
   20 right-hand sides under Node from one factorization (arch line 215). Relative residual of every solution at most 1e-9
   (draft value).
2. Same item, the ordering: the test in 1 asserts that the AMD permutation is identical in the native build and the wasm32 build
   and identical across two runs (arch line 215: "the spike confirms the ordering on wasm32 too"; arch line 217: "AMD is
   deterministic for an identical graph").
3. Same item, the bytes: the solution bytes of the same `.wasm` file are identical under Node, Wasmtime and headless Chromium
   (arch line 219: "the browser runs the same bytes"). The native result is compared and its largest relative difference is
   recorded, not gated (arch line 219: native is informational within 1e-9).
4. "M reference and M cap scenes": `cargo test -p bridle-spike` proves two deterministic generators. M-ref: 10-storey 6x6-bay 3D
   frame, about 1,300 members, about 3.2k DOF, 20 combinations (arch lines 14 and 27). M-cap: 2,000 members and 12,000 DOF (arch
   line 235), geometry per open question 4. The test asserts the exact member, node and DOF counts written in the sub-card's Plan
   and that K is symmetric.
5. "timed": one JSON report per (machine, host, scene) under `docs/perf/solver-spike/` (arch line 353 puts perf evidence under
   `docs/`), each with: machine model, OS, host and version, wasm file digest, timer resolution, and p50 and p95 over at least 30
   runs after 5 warm-up runs for assemble, ordering plus symbolic, numeric factorization, the 20 right-hand sides, and the total;
   plus wasm file size and peak linear memory. `node crates/bridle-spike/bench/validate.mjs docs/perf/solver-spike` passes.
6. "on M1/Safari and Tiger Lake/Chrome": two of those reports, `m1-safari.json` and `tigerlake-chrome.json`, each for both scenes,
   produced by a person on the real machines (manual gates, section 4).
7. Proxy timings the factory can produce are committed beside them and labelled proxy: this machine under Node, Wasmtime and
   headless Chromium (section 4). They do not satisfy criterion 6.
8. "fallback decision": `docs/perf/solver-spike/memo.md` holds: whether the faer sparse LDLT built for wasm32 and with which
   crate version, features and licence; the findings of criteria 2 and 3; the measured numbers beside the planning values they
   replace (arch lines 227, 233, 235); a recommendation, faer or the in-house AMD plus simplicial LDLT of about 3k lines (arch
   lines 215, 408); which deferrals apply if the spike slipped (arch line 215, last sentence); and what was not measured. The
   decision is the owner's (the documents name no decider: open question 5) and is one dated row in `docs/decisions/log.md`.
9. `pnpm check` stays green and under 10 minutes locally with the spike crate in the workspace (the P0-02 row's text; its time is
   recorded before and after in P2-01.2's `## Test`).

#### 2. The split

| Sub-card | Title | Changes | Lane | Depends on | Estimate | Test command | Carries |
|---|---|---|---|---|---|---|---|
| P2-01.1 | Spike crate with the M-ref and M-cap scene generators | `crates/bridle-spike` | core | P0-02 | 1.0 | `cargo test -p bridle-spike` | 4 |
| P2-01.2 | faer sparse LDLT with AMD on wasm32, M-ref solved under Node | `crates/bridle-spike` | core | P2-01.1 | 1.0 | `bash crates/bridle-spike/test/wasm.test.sh` | 1, 2, 9 |
| P2-01.3 | Timing harness and report format under Node and Wasmtime | `crates/bridle-spike` | core | P2-01.2 | 0.5 | `bash crates/bridle-spike/test/bench.test.sh` | 5, part of 3 and 7 |
| P2-01.4 | Browser timing page, headless Chromium run, runbook for the two machines | `crates/bridle-spike` | core | P2-01.3 | 1.0 | `bash crates/bridle-spike/test/browser.test.sh` | 3, 7 |
| P2-01.5 | Real-hardware reports, day-5 memo and the fallback decision | `docs/` | core | P2-01.4 | 0.5 | `node crates/bridle-spike/bench/validate.mjs docs/perf/solver-spike --memo` | 6, 8, and the whole row |

Total 4.0 engineer-days against the row's 1 engineer-week (5 days); the remaining day is for one loop back to build and for the
optional sub-card of open question 6. The roadmap's own first split has two sub-cards (roadmap line 274: ".1 faer-sparse and AMD
on wasm32 solving the M-ref scene under Node, .2 timings on M1/Safari and Tiger Lake/Chrome and the day-5 memo"); that puts five
days into two cards, against the cap of one engineer-day in the same line. Here .1 and .2 are its .1, and .3 to .5 are its .2.

Running at the same time: none inside this row. All five sub-cards are in the core lane (`factory/lanes.json`: `crates/`,
`Cargo.toml`, `Cargo.lock` and `docs/` are core), four change the same crate, and each depends on the one before. The row as a
whole shares no file with P4-06 (web lane) and can run beside it. P1-01 is also core (`packages/schema/`, `crates/`), so P1-01 and
this row take turns in the core lane although roadmap line 347 calls them independent (roadmap line 276: "at most one card running
per lane").

The wasm32 build of both facades that the P0-02 row left open (P0-02 row card, `## Ship`): no sub-card of this row picks it up.
The facades are `crates/bridle-wasm-engine` and `crates/bridle-wasm-checks` (arch line 339) and come with P2-05 and P2-10; roadmap
line 349 calls what precedes them "a test-only wasm build". P2-01.2 makes the first wasm32 build in the repository, inside its own
test command; it does not add a step to `pnpm check` (`tools/check.sh` belongs to the platform lane).

#### 3. Per sub-card

P2-01.1. What: a new crate `crates/bridle-spike` with deterministic generators for the two scenes: nodes, members, fixed bases, a
plain 12-DOF frame element stiffness without releases, offsets or shear, K assembled from sorted ids into sparse form, 20 load
vectors. Acceptance: row criterion 4; the counts are literal data in `## Plan`. Files: `crates/bridle-spike/{Cargo.toml,src/*}`,
`Cargo.lock`. Out of scope: any solver, wasm, the real element of `bridle-fem` (P2-02), the model schema (P1-01).

P2-01.2. What: add the faer sparse Cholesky (AMD ordering, simplicial LDLT; the docs call it "faer-sparse", the plan station
names the crate and pins the exact version) behind one small trait (order, factor, solve) so the fallback can sit "behind the same
API" (arch line 408); build native and wasm32; a Node script loads the wasm and solves M-ref. Acceptance: row criteria 1, 2 and 9.
Files: the crate's `src/`, `test/wasm.test.sh`, a Node loader, `Cargo.lock`. Out of scope: the in-house fallback itself,
iterative refinement, the dense path, timings. If faer does not build for wasm32 within the card, the card ships the failing
evidence and the memo recommends the fallback.

P2-01.3. What: a benchmark entry point that times the phases of criterion 5 for both scenes and writes the report JSON; run under
Node and under the pinned Wasmtime CLI; `validate.mjs` checks a report's shape. Acceptance: row criterion 5 for this machine's
Node and Wasmtime reports, committed as proxy; solution bytes equal between the two hosts. Files: the crate's `bench/*`,
`test/bench.test.sh`, `docs/perf/solver-spike/proxy-*.json`. Out of scope: browsers; any pass or fail threshold on time.
Wasmtime is here because arch line 227 says the spike replaces the server planning values; the roadmap row does not name it.

P2-01.4. What: a static page that runs the same wasm in a Web Worker, shows progress and offers the report as a download; a small
Node server with the cross-origin isolation headers; a headless Chromium run through the pinned Playwright; `RUNBOOK.md` in the
crate for the person at the two machines. Acceptance: headless Chromium report committed as proxy; its solution bytes equal
Node's (row criterion 3); the runbook's steps work on this machine in Safari by hand or are marked untested. Files: the crate's
`web/*`, `test/browser.test.sh`, `RUNBOOK.md`. If wasm-bindgen is used, the crate version is exactly 0.2.130
(`docs/ops/toolchain.md` line 27). Out of scope: `apps/web`, `e2e/`, the Engine Worker and Worker Protocol (P2-05),
`tools/perf-runners/` (P2-04), Playwright WebKit or Firefox (P0-09).

P2-01.5. What: commit the two real-hardware reports, write the memo, record the owner's decision, close the row. Acceptance: row
criteria 6 and 8; the three manual gates ticked; the row card's `## Ship` lists each deliverable with its sub-card. Files:
`docs/perf/solver-spike/{m1-safari.json,tigerlake-chrome.json,memo.md}`, `docs/decisions/log.md`. Out of scope: building the
fallback; editing the planning values in `docs/architecture/architecture.md` (the memo lists the proposed replacements; the edit
waits for the owner's word).

Test files stay in the crate, not in `tools/test`: `tools/test/docs.test.sh` (line 343) fails on a file there that names a card
outside P0-02, P0-06, P0-11 and P0-08.2, and `tools/test/` is the platform lane's.

#### 4. Manual gates

On P2-01.5, as `manualGates: [M1 Safari timings committed, Tiger Lake Chrome timings committed, Owner fallback decision recorded]`.

- M1 Safari timings: a person at an M1 Mac (the roadmap names an M1 Mac mini, line 361; arch line 233 says 8 GB) follows
  `crates/bridle-spike/RUNBOOK.md`: check out the commit of P2-01.4, plug in power, close other applications, start the page
  server, open the page in Safari, press Run, wait for both scenes, save the downloaded report as
  `docs/perf/solver-spike/m1-safari.json`, type the machine model into it, and hand the file to the foreman or commit it.
- Tiger Lake Chrome timings: the same on a Tiger Lake laptop (arch line 233: "4-core 2020 laptop, Iris Xe ... 8 GB") in Chrome,
  saved as `tigerlake-chrome.json`. The documents do not say which operating system.
- Owner fallback decision: the owner reads `memo.md` and says "faer" or "in-house"; the foreman writes the row in
  `docs/decisions/log.md`.

What the factory can do without the hardware: build and solve on wasm32 (criteria 1 to 4), prove equal bytes across Node, Wasmtime
and headless Chromium, and time all three on this M4 Pro. These numbers are faster than the reference laptop would give and prove
"builds" and "deterministic", not "performs". Safari on this machine needs a person: Playwright's WebKit is not pinned
(`tools/toolchain.json`) and is not Safari, and Safari's remote automation must be switched on by hand.

#### 5. Open questions for the owner

1. Hardware. Do an M1 Mac (8 GB) and a Tiger Lake laptop exist, and who runs them? `docs/plan/progress.md` line 131 records the
   runners as "unknown"; this machine is an M4 Pro. Options: (a) both exist: the gates above stand and P2-01.5 waits for them;
   (b) one or none exists and you obtain them: the row waits (P2-02 comes After P2-01, roadmap line 300, so the solver chain
   waits too); (c) close the row on proxy numbers with a decision marked provisional, and move the two real-hardware gates to
   P2-04, where roadmap line 361 already puts the runners ("P2-04 R14 evidence only (never blocks ship)"). Recommendation: (a) if
   both machines are at hand this week, otherwise (c). Under (c) P2-01.5 keeps one gate (the decision), criterion 6 moves to
   P2-04, and the row's E2 text needs your edit.
2. Roadmap against itself on the hardware. Roadmap line 299 and arch lines 14 and 233 say the spike measures on M1/Safari and
   Tiger Lake/Chrome; roadmap line 361 says the runners are needed for P2-04 only. Which holds? It decides question 1.
3. What "the spike passes" means (arch line 215: "faer-sparse if the week-1 spike passes"). No document gives a pass rule. The
   figures disagree: req 02 line 30 asks M-ref "assemble+factor+solve, all cases" under 50 ms "in Chrome on an M1/Intel
   i5-8th-gen class laptop"; arch line 233 plans assemble 5 ms, factorization 50 ms p50 and 70 ms p95, right-hand sides 20 ms,
   on M1/Safari and Tiger Lake/Chrome. For M-cap: 3 s target and 5 s budget for the whole run (arch line 235), 0.3-1.5 s on the
   server (arch line 227). Options: (a) no numeric rule, you judge from the memo; (b) pass = builds, criteria 2 and 3 hold, and
   on both real machines M-ref assemble plus factorization plus right-hand sides is at most 95 ms p95 (the sum of arch line 233's
   figures) and M-cap total solve at most 1.5 s. Recommendation: (b), with the memo free to argue an exception. It adds one
   paragraph to the memo; the split does not change.
4. The M-cap scene has no geometry. Arch line 235 gives only "2,000 members and 12,000 DOF"; a regular frame with 2,000 members
   has far fewer than the 2,000 nodes that 12,000 DOF needs, so both caps are reached only with intermediate nodes along members.
   Options: (a) a regular frame at the member cap (about 2,000 members, DOF well under the cap); (b) a frame with members
   subdivided to reach both caps; (c) both. Recommendation: (b), with the generator's parameters written in P2-01.1's Plan for
   your approval; (c) adds about 0.25 day to P2-01.1. For M-ref a 7 by 7 column grid over 10 storeys gives 1,330 members and
   3,234 DOF counting the base nodes (2,940 free): confirm that this is the "1,300 members, 3.2k DOF" scene. ADR 0002 line 12
   gives M-ref no DOF figure; arch line 27 does.
5. Who decides, where it is recorded, and what "day 5" counts from. The documents say "day-5 fallback decision" (arch lines 215,
   368, 408) and date the result to milestone M1, 2026-12-18 (arch line 388); they name no decider and no record. Options for the
   record: (a) a row in `docs/decisions/log.md` pointing at the memo; (b) a new ADR 0003. Recommendation: you decide; (a), since
   arch line 215 already allows both outcomes; day 5 is the fifth working day after P2-01.1 starts, and if the gates are still
   open then, question 1(c) applies. No change to the split.
6. "Checks and scene timing". Arch line 368 lists it in the spike; roadmap line 299 does not. No checks library (P2-10) or scene
   builder (P3) exists to time. Options: (a) leave it out and say so in the memo; (b) add a sub-card P2-01.6 (web lane, 1 day)
   timing a synthetic instanced three.js scene of M-ref size. Recommendation: (a). (b) uses the spare day and adds a second lane.
7. Where the spike code lives. `crates/bridle-spike` is not in the crate list of arch section 16 (lines 334-341). Options: (a) a
   separate spike crate, removed or absorbed when P2-02.4 and P2-04 ship; (b) start `crates/bridle-fem` now with the sparse
   module. Recommendation: (a): P2-02 writes `bridle-fem` against plan-station fixtures (roadmap line 276) and should not
   inherit spike code. Under (b) the four crate sub-cards change `crates/bridle-fem` instead and P2-02.4 shrinks.
8. If the decision is "in-house": no row carries the fallback's cost (about 3k lines in arch lines 215 and 408, about 2k in req
   02 line 686). P2-02.4 "sparse LDLT and the dense/sparse switch" (roadmap line 274) would grow by two or three sub-cards.
   Recommendation: decide the row and size when the memo recommends the fallback, not now.
9. New dependencies. faer and what it pulls in are the first third-party Rust crates. The documents do not say whether a crate
   needs an entry in the licensing register (P0-07). Recommendation: the memo records faer's licence and dependency count, and
   you say whether the register applies.

#### 6. Risks and guards

- The hardware does not exist and the solver chain waits on a manual gate. Guard: question 1, option (c).
- Proxy numbers from an M4 Pro read as proof of performance. Guard: proxy reports are named `proxy-*`, criterion 6 accepts only
  the two named files, and the memo states which numbers are proxies.
- faer on wasm32 needs threads, or takes a different code path than native (my expectation to check, not a statement of the
  documents). Guard: threading features off, the simd128 profile fixed in the build, criteria 2 and 3.
- Browser timers are coarse (about 1 ms in Safari without isolation), which hides a 5 ms phase. Guard: the page server sends the
  cross-origin isolation headers, each phase is timed over a loop of repeats, and the report records the measured resolution.
- The ordering is not reproducible between runs or targets, which would break the fresh-equivalence invariant (arch line 217).
  Guard: criterion 2; a failure goes into the memo as a reason for the fallback.
- The spike's plain element becomes the product's element by drift. Guard: no crate may depend on `bridle-spike`; question 7.
- faer's compile time pushes `pnpm check` (which runs `cargo test --workspace`) toward its 10 minutes, locally or in Actions.
  Guard: criterion 9; if it fails, the crate leaves the workspace's default members (root `Cargo.toml`, core lane).
- The row slips past day 5. Guard: arch line 215 already names what moves to v1.1 (symbolic reuse for drags, Timoshenko, the
  animated null-space mode); the memo says whether it applies.
- `tools/perf-runners/` (arch line 355) has no owner in `factory/lanes.json`. This row does not create it; P2-04 must assign it.

### Owner's decisions on the draft (2026-11-17)

Hardware (question 1): the owner has an M4 Pro MacBook ("64 gigabytes of RAM" in the owner's words; this development machine reports `Mac16,7`, Apple M4 Pro, 51539607552 bytes, which is 48 GiB), so neither reference machine (an M1 Mac with 8 GB, a Tiger Lake laptop) is at hand. The draft's option (c) therefore applies: the row closes on proxy numbers with a decision marked provisional, and the two real-hardware gates move to P2-04. Five sub-cards instead of E1's two (the owner took the recommendation). Recorded in `docs/decisions/log.md` (2026-11-17). The owner answered the foreman's six questions in chat and added: "If ever you have anything specific to ask, just give me the questions". The foreman takes this as the approval of this draft's acceptance criteria and split with the draft's recommendation on each open question; a recommendation that would change `docs/architecture/architecture.md` or an ADR is not applied by this approval and goes back to the owner as a question with a decision record. The sub-cards are created after P0-08.4 ships, once the foreman has checked the draft against `docs/plan/roadmap.md`; the owner may change the split before a sub-card starts.

## Plan


## Build


## Test


## Review


## Ship

