# @bridle/tasks

The task format of the showcase, its validation, three seeded tasks with rubrics and reference models, the
generic I-sections they use, and the generator of the owner's document `docs/content/tasks.md` (pitch card
T2, `docs/plan/pitch-plan.md`). Plain TypeScript; the runtime dependencies are `@bridle/model` and
`@bridle/solver`. The exported functions are pure and use no browser or Node API; only the test and the
script that writes the document read and write files.

```ts
import { referenceAnswers, seededTasks, validateTask } from "@bridle/tasks";

const [beam, portal, choice] = seededTasks(); // new objects on every call
validateTask(beam); // [] for a valid task
const result = referenceAnswers(portal); // solves the task's reference model
if (result.ok) {
  result.answers; // one entry per required answer: computed (value, display, unit), pending or missing
  result.requirements; // one entry per design requirement: value, allowable, ratio, satisfied
}
```

| Command                                 | What it does                                      |
| --------------------------------------- | ------------------------------------------------- |
| `pnpm --filter @bridle/tasks test`      | runs the tests (vitest)                           |
| `pnpm --filter @bridle/tasks typecheck` | runs `tsc --noEmit`                               |
| `pnpm --filter @bridle/tasks run docs`  | writes `docs/content/tasks.md` from the task data |

The word `run` is needed in the last command: `pnpm docs` without it is a command of pnpm itself (it asks
for a package name and exits with an error), not this package's script. `pnpm check` runs the tests and the
type check through turbo.

## The task format

`src/types.ts` has the types with their comments. A `Task` is plain data (it survives `JSON.stringify` and
`structuredClone`; a test checks both).

| Field              | Content                                                                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `title`      | The id is a stable slug (`simply-supported-beam`).                                                                                                             |
| `level`            | `introductory` or `intermediate`.                                                                                                                              |
| `brief`            | Plain paragraphs, one string each.                                                                                                                             |
| `givens`           | The given values of the brief as label and value texts, for a table.                                                                                           |
| `learningOutcomes` | A list of sentences.                                                                                                                                           |
| `startingModel`    | The `Model` the learner begins from. It may have no support yet.                                                                                               |
| `fixed`            | The parts of the starting model the learner cannot change: `{ list, id }`, the list being one of the lists of `Model` (for `supports`, the id is the node id). |
| `sectionChoice`    | Optional: the members whose section the learner chooses, and the sections to choose from.                                                                      |
| `loadCaseId`       | The load case the answers and limits are read from.                                                                                                            |
| `answers`          | The required answers: `id`, `prompt`, `kind` (force, moment, displacement, ratio, stress), `unit` for display, `signed`, `tolerance`, `source`.                |
| `requirements`     | Optional design requirements: a `statement` in words and a `limit` as data (a translation of a node must not exceed `length / divisor`).                       |
| `justification`    | Optional: the prompt of the short written answer.                                                                                                              |
| `rubric`           | Three to five criteria: `id`, `name`, `weight`, `basis` (what it is assessed from) and three or four `levels` from `not-shown` to `exemplary`.                 |
| `referenceModel`   | A complete, correct `Model` of the task.                                                                                                                       |

The card asked for the fields above except four, which this package adds: `givens` (so that the brief's
numbers can be shown as a table), `justification` (the rubrics assess a written answer, so the task must
ask for it), `signed` on an answer (whether the learner gives a sign or a magnitude) and `basis` on a
criterion (which evidence the criterion is judged from).

**Units.** The models are in the units of `@bridle/model` (kN, m, kN·m, kN/m²). An answer's `unit` is the
unit the learner reads and types: kN, kN·m, mm, MPa, or `"-"` for a ratio. `UNIT_OF_KIND` gives the unit of
each kind and `DISPLAY_PER_MODEL_UNIT` the factor from model units to the display unit (1000 for mm, 0.001
for MPa).

**Tolerance.** `{ relative, absolute }`, both positive, the absolute part in the display unit. An answer
is within tolerance when |answer − reference| ≤ max(relative × |reference|, absolute). The seeded tasks use
1 percent for forces, moments and stresses and 2 percent for displacements and for ratios of a displacement
to its limit; the absolute part is half of the last digit a learner types (0.05 kN, 0.05 kN·m, 0.05 mm,
0.005 for a ratio, 0.5 MPa). This package states the rule and does not apply it: comparing a learner's
answers is card T6.

**Where an answer comes from.** `source` is one of: `reaction` (node, component), `displacement` (node,
translation), `member-end-force` (member, end, component; local axes and the solver's sign convention),
`limit-ratio` (the value a design requirement limits divided by its allowable value), or `pending` (no
value is computed yet; `waitsFor` names the cards that will define it). The ids are those of the reference
model. A `signed` answer keeps the solver's sign (global axes); an answer that is not signed is the
absolute value.

**Fixed parts.** A fixed member keeps its nodes, kind, roll angle, releases, material and section, except
that the section of a member named by `sectionChoice` is the learner's to choose. Nothing in this package
enforces `fixed`; the workspace in task mode (card T4) does.

## Validation

`validateTask(task)` returns a list of issues and an empty list for a valid task, in the pattern of
`validateModel`: each issue has a `code`, a `messageKey` (`task.issue.<code>`; `packages/i18n` does not
hold these keys yet), the `ids` it concerns and a `path` into the task.

| Code                          | Reported when                                                                                                                                                               |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `empty-text`                  | the id, the title, a paragraph, an outcome, a given, a prompt, a statement, a criterion's name or a level's description is blank, or `brief` or `learningOutcomes` is empty |
| `duplicate-id`                | an id appears a second time among the answers, the requirements or the criteria, or the same list and id a second time in `fixed`                                           |
| `missing-fixed-part`          | `fixed` names an entry the starting model does not have                                                                                                                     |
| `missing-section-choice-part` | `sectionChoice` names a member or a section the starting model does not have, or one of its lists is empty                                                                  |
| `invalid-starting-model`      | `validateModel` reports an issue for the starting model, other than `no-support`                                                                                            |
| `invalid-reference-model`     | `validateModel` reports an issue for the reference model                                                                                                                    |
| `missing-reference-part`      | `loadCaseId`, an answer's source or a requirement's limit names a load case, node, supported node or member the reference model does not have                               |
| `missing-requirement`         | an answer's `limit-ratio` source names a requirement the task does not have                                                                                                 |
| `unit-kind-mismatch`          | an answer's `unit` is not the unit of its `kind`                                                                                                                            |
| `non-positive-tolerance`      | the relative or the absolute part of a tolerance is not a number greater than zero                                                                                          |
| `non-positive-limit`          | a limit's `length` or `divisor` is not a finite number greater than zero                                                                                                    |
| `rubric-criteria-count`       | the rubric has fewer than three or more than five criteria                                                                                                                  |
| `non-positive-weight`         | a criterion's weight is not a number greater than zero                                                                                                                      |
| `rubric-weight-sum`           | the weights do not sum to 1 within 1e-9                                                                                                                                     |
| `invalid-rubric-levels`       | a criterion does not have three or four levels in rising order, without repeats, from `not-shown` to `exemplary`                                                            |

For the two model codes there is one task issue per model issue; its `ids` are the model issue's code
followed by its ids, and its `path` is the model issue's path after `startingModel.` or `referenceModel.`.

One difference from the card's wording: a starting model that `validateModel` rejects only for
`no-support` is accepted, because two of the three tasks ask the learner to add the supports. A reference
model without a support is reported. `validateTask` does not solve the reference model; `referenceAnswers`
does.

## Reference answers

- `referenceAnswers(task)` solves the task's reference model with `solve` of `@bridle/solver` and reads
  each required answer and each design requirement from the results of the task's load case. No reference
  value is typed in anywhere in this package.
- `computeAnswers(task, model)` does the same for any model. The sources name nodes and members by the ids
  of the reference model, so an answer whose node or member the model lacks comes back as
  `status: "missing"`; a model `solve` refuses gives `{ ok: false, reason: "not-solved", solve }`, and a
  model without the task's load case `{ ok: false, reason: "missing-load-case" }`.
- `evaluateSectionChoices(task)` tries each section of `sectionChoice` on the reference model and reports
  its mass per metre and whether the design requirements are met.
- `allowableValue(requirement)` is `length / divisor` in m. A requirement is satisfied when the magnitude
  of the limited translation is at most that value.

## The generic I-sections

`src/sections.ts` defines eleven doubly symmetric I-shapes from I 200x100 to I 600x220 by four dimensions
(depth h, flange width b, web thickness tw, flange thickness tf) as three rectangles without root fillets.
They are shapes made for these tasks, not the sections of any manufacturer's or standard's table; a name
gives the depth and the width in mm. Card S8 is to make its catalog from this list. `genericSection`
computes the properties in the units of `@bridle/model`:

- A = 2·b·tf + (h − 2·tf)·tw
- Iy = [b·h³ − (b − tw)·(h − 2·tf)³] / 12 (strong axis, about local y)
- Iz = [2·tf·b³ + (h − 2·tf)·tw³] / 12 (weak axis, about local z)
- J = [2·b·tf³ + (h − tf)·tw³] / 3 (thin-walled open section, the web taken between the flange centre lines)
- `depthZ` = h, `depthY` = b

The fixture section of `@bridle/model` has the same name, I 300x150, with round illustrative values
(Iy = 8.4e-5 m⁴). The section of that name here is computed from its dimensions (Iy = 8.147e-5 m⁴), so the
two differ by 3 percent in Iy. The tasks use the sections of this package only.

The steel of the tasks is the fixtures' material: E = 210 000 MPa, G = 81 000 MPa, fy = 355 MPa,
7850 kg/m³.

## The three tasks

Each is a function that returns a new `Task` (`simplySupportedBeamTask`, `portalFrameTask`,
`chooseTheBeamTask`; `seededTasks()` returns the three). The numbers of a task's brief, models and rubric
come from the constants at the top of its file in `src/tasks/`. All loads are service values in one load
case, `LC1`. Frames and beams lie in the global X-Z plane; the beams hold `ux`, `uy`, `uz`, `rx` at A and
`uy`, `uz` at B, which makes them stable in three dimensions without restraining them in their plane.

| Task                                | The learner                                                            | Reference model                                                                                      | Reference answers                                                                                                                                                              |
| ----------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Simply supported beam               | draws two members on three given nodes, adds the supports and the load | span 6 m, 15 kN/m, I 300x150                                                                         | reactions 45 kN and 45 kN, maximum moment 67.5 kN·m, mid-span deflection 14.79 mm                                                                                              |
| Portal frame under wind and gravity | adds fixed bases and the two loads to a given frame                    | 8 m wide, 5 m high, columns I 300x150, beam I 400x180, 30 kN/m on the beam, 20 kN along +X at node B | horizontal reactions +15.61 kN (A) and −35.61 kN (D), vertical 114.30 kN and 125.70 kN, base moments 15.36 kN·m and 69.78 kN·m, sway 7.78 mm, 0.467 of the limit of height/300 |
| Choose the beam                     | chooses one of six sections for a given beam                           | span 7 m, 25 kN/m, I 400x180 (the lightest of the list within span/360)                              | maximum moment 153.125 kN·m, mid-span deflection 16.44 mm, 0.845 of the limit of span/360; the bending stress is pending                                                       |

The tests compare the answers of the two beams with wL/2, wL²/8 and 5wL⁴/(384EI), and those of the portal
with the equilibrium of the whole frame, with the closed-form values of a fixed-base portal whose members
do not change length (within 2 percent, and within 1e-4 on a copy whose areas are multiplied by 1000), and
with the values frozen from the solver on 2026-11-18.

In "Choose the beam", I 300x150, I 330x160 and I 360x170 exceed the deflection limit and I 400x180,
I 450x190 and I 500x200 meet it. The answer `max-bending-stress` has the source `pending`: the brief asks
for the stress, but its reference value waits for pitch cards S8 (the illustrative checks) and T6 (the
evidence). `referenceAnswers` returns it with `status: "pending"` and no number.

The limits (span/360, height/300) are requirements of the tasks themselves. No design code is quoted or
cited.

## The document

`renderTasksDocument(tasks)` returns the Markdown text of `docs/content/tasks.md`: for each task the brief,
the given values, the learning outcomes, the starting model, the required answers with their tolerances,
the design requirements, the rubric and the reference answers, then the table of the generic sections. The
text depends only on the tasks (no date), so writing it twice gives the same bytes. A test fails when the
file differs from this text.

`scripts/write-document.ts` writes the file. It runs under vitest (`vitest.docs.config.ts`), which loads
the TypeScript sources of the workspace packages; `pnpm --filter @bridle/tasks test` does not run it.
