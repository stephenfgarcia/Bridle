# Pitch plan: a working showcase by 2026-12-16

Status: APPROVED by the owner on 2026-11-18 (`docs/decisions/log.md`), with the answers recorded under "The owner's answers"
below. Written by the foreman.
The owner's decision behind it is in `docs/decisions/log.md` (2026-11-17, the pitch on 2027-01-01). `docs/plan/roadmap.md` stays
the plan for after the pitch; this file replaces its order of work until then.

## Goal

On 2027-01-01 the owner presents Bridle to a university and a competition panel; the same work is the owner's thesis case study
and defense. The presentation is 20 to 30 minutes and covers the whole system, how it was built, and its paper and
documentation. The panel judges the presentation, the system, and how well the development and implementation plan is explained. By 2026-12-16 the showcase works end to end, and
the two weeks after that are for fixes and rehearsal only.

What the panel sees, in one sitting:

1. A learner opens a structural task with a brief and a rubric.
2. The learner builds or edits a frame in a 3D workspace and sees the analysis update live: deflected shape, reactions, moment,
   shear and axial diagrams, and how hard each member is working.
3. The learner submits. The numbers are checked by the solver against a reference, and an AI writes feedback against the rubric
   from that evidence.
4. An instructor opens the submission, sees the model, the evidence and the feedback, and can change the grade.

## Scope

Stage A is the solver and the workspace. Stage B adds tasks, submission, AI feedback and the instructor view. A is finished first
and is a complete demonstration by itself if B slips.

In scope:

- A linear-elastic 3D frame solver for small models (up to about 200 members), written in TypeScript, running in a Web Worker.
- Nodal and member loads, supports, member end releases, truss members, load cases without combinations.
- Illustrative member checks (stress, deflection, drift) on a small catalog of generic steel sections.
- A 3D workspace: draw and edit nodes, members, supports and loads; property panel; table editor; undo and redo; templates.
- Three seeded tasks, one demo learner and one demo instructor, submissions stored in Postgres.
- AI feedback through the Anthropic API, with the evidence computed by the solver and only the wording written by the model.
- A public link on Google Cloud Run in the owner's Google Cloud project `comm360-sandbox` (the owner's decision of 2026-11-18),
  and a one-command local mode for presentation day.

Out of scope until after the pitch (all of it stays in `docs/plan/roadmap.md`):

- Real accounts, organizations, rosters, row-level security, MFA, audit logs, FERPA work.
- Licensed design-code data (AISC, ASCE, ACI) and code-clause checks; SME verification of content.
- The Rust and WebAssembly solver, canonical hashing and hash parity across runtimes, the sandboxed runner, the judge harness.
- AWS, OpenTofu, the pentest, runbooks, the status page.
- Nonlinear, dynamic, buckling or plate analysis; load combinations; exams and integrity signals.

The showcase is not a launch to real students. The checks are labelled "illustrative, not a design code" on screen.

## What is reused

- `apps/web` (Next.js 15, React 19), `packages/i18n` (every user-facing string goes through the catalog, as today),
  `packages/units`, `pnpm check` and the Actions workflow, the Postgres of the compose stack, `docs/ux/tokens.css`.
- The factory, the monitor and the lane tool of P0-08.2 (`tools/factory/lane.sh`): two lanes, core and web.

Not used for the pitch: `crates/bridle-canon`, the drafts of P1-01 and P2-01, and the parked P0-08.3 and P0-08.4. The token and
shell parts of the P4-06 draft are reused in card W1.

## Cards

Ids here are working names; the factory ids are given when the cards are created. Each card is at most about one day. "Review"
marks the cards that get a separate review station (see Process).

### Stage A, solver (core lane; new packages `packages/model` and `packages/solver`)

| Card | What | Review |
|---|---|---|
| S1 | Model types and validation: nodes, members, sections, materials, supports, loads, load cases; JSON format | |
| S2 | 3D frame element: local stiffness, transformation, assembly | yes |
| S3 | Supports and nodal loads; solve; displacements and reactions; a clear error for an unstable model | yes |
| S4 | Member loads (uniform and point) with fixed-end forces; member end forces | yes |
| S5 | Member end releases and truss members | yes |
| S6 | Values along a member: axial, shear, moment, deflected shape | yes |
| S7 | Benchmark suite against closed-form results: simply supported, cantilever and fixed-fixed beams, a portal frame, a truss, a 3D cantilever with torsion | yes |
| S8 | Illustrative checks: generic section catalog, stress utilization, deflection and drift limits | yes |
| S9 | Web Worker wrapper and a speed test (200 members solved in under 100 ms on the development machine) | |

### Stage A, workspace (web lane; `apps/web`)

| Card | What | Review |
|---|---|---|
| W1 | Dependencies (three.js, react-three-fiber, a state store), design tokens, app shell and navigation | |
| W2 | 3D viewport: grid, camera, nodes, members and supports drawn from a model | |
| W3 | Model store with undo and redo | |
| W4 | Tools: add, move and delete a node; draw a member; snap to grid | |
| W5 | Supports and loads: tools and glyphs | |
| W6 | Property panel: section, material, releases | |
| W7 | Table editor for nodes and members | |
| W8 | Live analysis: the worker wired to the store, status and the unstable-model message | |
| W9 | Results: deflected shape with a scale control, reactions | |
| W10 | Diagrams on members (moment, shear, axial) with value probes | |
| W11 | Utilization colouring and a results panel | |
| W12 | Templates (beam, portal frame, truss) and save and load | |
| W13 | Milestone A: an end-to-end browser test of "open a template, change a load, read the new moment", and a first deployment | yes |

### Stage B, tasks and grading (both lanes)

| Card | What | Review |
|---|---|---|
| T1 | Database tables and a demo sign-in with one seeded learner and one seeded instructor | |
| T2 | Task format and three seeded tasks with rubrics and reference models | |
| T3 | Learner home and task page: brief, requirements, start | |
| T4 | Workspace in task mode: fixed parts of the model, answer fields | |
| T5 | Submission: the model, the results and the answers stored together | |
| T6 | Evidence: the submission's numbers compared with the reference within tolerances | yes |
| T7 | AI feedback: rubric and evidence sent to the Anthropic API from the server, a structured answer with a level and a comment per criterion | yes |
| T8 | Feedback screen: levels, evidence table, comments, each marked "computed" or "AI-written" | |
| T9 | Fallback: stored feedback when the API cannot be reached, and a retry | |
| T10 | Instructor view: list of submissions, one submission with model, evidence and feedback, grade override | |
| T11 | Consistency check: six prepared submissions with expected levels, and a report of how the AI graded them | yes |
| T12 | Milestone B: an end-to-end browser test of the whole learner and instructor path | yes |

### Stage C, presentation

| Card | What |
|---|---|
| C1 | Hosting on Google Cloud Run in the project `comm360-sandbox`: the container image of the repository's `Dockerfile` with Next.js behind its `web` entrypoint, the database on Cloud SQL for PostgreSQL in the same project (the owner's decision of 2026-11-18: everything stays on Google Cloud), the secrets (the Anthropic API key in Secret Manager), a budget alert, a health check; nothing billable is created before the owner confirms the list of resources |
| C2 | Local presentation mode: one command, seeded data, a reset button |
| C3 | Introduction page for the panel |
| C4 | Visual pass: empty, loading and error states |
| C5 | Browser and speed check in Chrome and Safari |
| C6 | Demonstration script for 20 to 30 minutes, rehearsal checklist and a recorded backup video |
| C7 | Validation report for the paper: the solver's benchmark results against closed-form values, the AI consistency check, the speed test, each with the command that reproduces it |
| C8 | Development and implementation summary for the paper: the architecture of the showcase, the plan and how it was cut, the factory process and its records, what comes after the pitch; source material for the owner's thesis, not the thesis itself |

That is 42 cards in 20 working days, with stage A's two tables running side by side in two lanes.

## Schedule

| By | Checkpoint | The owner can see |
|---|---|---|
| 2026-11-24 | S1 to S7 and W1 to W4 done | The benchmark report; a frame drawn on screen |
| 2026-12-01 | Milestone A (W13) | A deployed link: build a portal frame, watch the diagrams change |
| 2026-12-08 | Milestone B (T12) on the development machine | The full learner and instructor path with AI feedback |
| 2026-12-14 | C1 to C5 | The public link and the local mode |
| 2026-12-16 | C6 to C8 | A full rehearsal; the two documents for the paper |
| 2026-12-17 to 2026-12-31 | Freeze | Fixes only; nothing new |

If a checkpoint is missed by more than two working days, the foreman tells the owner the same day and names what to drop. The
order of dropping: W7, T11, C3, T10's grade override, T9.

## Process

The owner's lighter process for the pitch (decision of 2026-11-18):

- Each card's Spec is its row in this plan plus acceptance criteria written by the foreman; the owner's approval of this plan
  approves them.
- One agent builds a card and writes its tests. `pnpm check` is green before every commit; commits go to `main` after a rebase.
- A separate review station runs only for the cards marked "yes": the solver, the evidence, the AI prompt and the two
  milestones. Those keep the full bar. A failed review goes back to build once; a second failure goes to the owner.
- The monitor is mirrored at station boundaries, as decided on 2026-11-17.

## What only the owner can do

| Item | Needed by |
|---|---|
| Answer the questions below | before the cards are created |
| Read and correct the three task briefs (card T2) | 2026-11-28 |
| Anthropic API key with a spend cap; the foreman asks for it when card T7 starts | 2026-12-02 (card T7) |
| Confirm the list of Google Cloud resources and their expected cost before the first deployment (the project `comm360-sandbox` and the `gcloud` CLI are already set up on the development machine) | 2026-11-30 (card W13) |
| Rehearse with the script | 2026-12-16 |

## Risks

- The 3D editing takes longer than planned. Guard: templates and the table editor mean the demonstration never depends on
  freehand drawing; W7 is first to drop.
- A wrong solver result in front of engineers. Guard: the benchmark suite S7 and a review of every solver card.
- The AI gives different feedback on the same work. Guard: the numbers come from the solver, the model only words them; a
  structured answer; the consistency check T11; stored feedback as the fallback.
- No network at the venue. Guard: the local mode C2 and the backup video C6.
- The monthly spend limit stops the factory. Guard: two lanes at most; the foreman reports the pace each checkpoint.
- New wishes during the build. Guard: anything added means something on the dropping list goes.

## The owner's answers (2026-11-18)

1. Units: the units and terms the industry uses. The foreman's reading: SI, with forces in kN, lengths in m, moments in kN·m,
   stresses in MPa and deflections in mm; the model stores kN and m.
2. The presentation is 20 to 30 minutes on the full scope of the system and how it was built, with its paper and documentation.
3. Judging: how well the owner presents, how good the system is, and how well the development plan and the implementation plan
   are explained in the research and development; the work is also the owner's thesis case study and defense. Cards C7 and C8
   were added for this.
4. The name "Bridle" stays.
