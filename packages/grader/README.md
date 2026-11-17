# @bridle/grader

The submission of the showcase and the evidence computed from it (pitch card T6, `docs/plan/pitch-plan.md`).
The evidence compares a learner's model and typed answers with a task's reference, with `@bridle/solver`. It
is the only source of facts for the feedback: the AI of card T7 words it and computes nothing. Plain
TypeScript; the runtime dependencies are `@bridle/model`, `@bridle/solver` and `@bridle/tasks`. The exported
functions are pure and use no browser or Node API, no clock and no random number.

```ts
import {
  buildEvidence,
  summarizeEvidence,
  validateSubmission,
  type Submission,
} from "@bridle/grader";
import { portalFrameTask } from "@bridle/tasks";

const task = portalFrameTask();
const submission: Submission = {
  taskId: task.id,
  model, // a Model of @bridle/model
  answers: { "reaction-ax": 15.6, "sway-b": 7.8 }, // by answer id, in the display unit
  justification: "The sway is 7.8 mm, below 16.7 mm.",
  submittedAt: "2026-12-01T09:30:00Z",
};
validateSubmission(task, submission); // [] for a valid submission
const evidence = buildEvidence(task, submission); // plain data, the same for the same input
const summary = summarizeEvidence(evidence); // counts and flags
```

| Command                                  | What it does            |
| ---------------------------------------- | ----------------------- |
| `pnpm --filter @bridle/grader test`      | runs the tests (vitest) |
| `pnpm --filter @bridle/grader typecheck` | runs `tsc --noEmit`     |

`src/types.ts` has every type with a comment per field; the tables below repeat them.

## The submission

| Field           | Content                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `taskId`        | The id of the task the submission answers.                                                                                |
| `model`         | The learner's `Model` (`@bridle/model`: kN, m).                                                                           |
| `answers`       | The typed answers by answer id, each a number in the answer's display unit; an answer left empty is `null` or has no key. |
| `justification` | The written justification; an empty string when there is none.                                                            |
| `submittedAt`   | The time in UTC as `YYYY-MM-DDTHH:MM:SSZ`, decimals of a second allowed (the text `Date.prototype.toISOString` writes).   |

`validateSubmission(task, submission)` takes a value of any shape and returns a list of issues, empty for a
valid submission. An issue is `{ code, ids, path }`. The issues come in this order: the task id, the answers
by key (keys sorted by code unit), the model, the justification, the time.

| Code                | Reported when                                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `invalid-shape`     | the submission is not an object; `taskId`, `justification` or `submittedAt` is not a string; `answers` is not an object; an answer is neither a number nor `null`        |
| `wrong-task-id`     | `taskId` is a string other than the task's id (`ids`: the submission's id, then the task's)                                                                              |
| `unknown-answer-id` | `answers` has a key that is not the id of an answer of the task                                                                                                          |
| `non-finite-answer` | an answer is `NaN`, `Infinity` or `-Infinity`                                                                                                                            |
| `invalid-model`     | `parseModel` of `@bridle/model` does not accept the model: one issue per issue of `parseModel`, its code in `ids` and its path after `model.`                            |
| `invalid-time`      | `submittedAt` is a string that `isUtcTime` does not accept (the form above, a month from 01 to 12, a day that month has, an hour up to 23, minutes and seconds up to 59) |

The model is read through its JSON text, so a number that is `NaN` or infinite, a missing list or a key the
format does not have is reported as `invalid-model`. `validateSubmission` does not run `validateModel`: a
model that parses and is not valid (no support yet, say) is a submission a learner can make, and the evidence
reports its state.

## How the two models are matched

A learner chooses the ids of what the learner draws, so nothing the learner drew is looked up by id.

- **Nodes by position.** A learner's node is matched to a reference node when the distance between them is
  at most `NODE_MATCH_TOLERANCE` = 1e-6 m (one micrometre). Each node is matched once: the reference's nodes
  are taken in their order, and each takes the nearest learner's node not yet taken (the first in the
  learner's order among equally near ones).
- **Members by their two end nodes, in either direction.** A learner's member is matched to a reference
  member when its end nodes are the nodes matched to that member's end nodes. `reversed` says that it runs
  the other way. Each member is matched once; a second member between the same two nodes is an extra member.
- **A member's "start" and "end" are resolved through the node.** An answer read at the "end" of reference
  member A-C is read at node C, which is the start of a learner's member drawn from C to A. The solver gives
  a member end force in the member's own local axes, which turn with the member's direction and roll angle;
  the evidence expresses it in the local axes of the reference member, so its sign is the one the reference
  member would report at that node. (When the two members have the same three axis vectors the solver's
  number is taken as it is.)
- **Supports by node, loads by the node or the member they act on.** Releases are compared at the node, so
  the start of a reversed member is compared with the reference member's end.
- **Sections, materials and load cases by id.** They have no position, and their ids come from the task's
  starting model.
- **Fixed parts by id** (part b). They are entries of the starting model, which the workspace keeps under
  their ids. A fixed node or member that is gone under its id and has a counterpart at the same place is
  reported as `missing` with that counterpart's id.

What is not matched, and what the evidence then says:

- **A member the learner split in two with an extra node** has no matched member (`learnerMemberId: null`,
  the pieces under `extraMemberIds`, the node under `extraNodeIds`). An answer read at an end of that member
  is still found: the evidence takes the learner's member that has exactly one end at the node and whose
  other node lies on the reference member's axis, strictly between its two nodes (`ownModelLocation.piece:
  true`). With two such members, or none, the own-model value is `member-not-found`. The loads on the pieces
  are not matched: the reference's load is `missing`, the learner's loads are `extra`, and only the
  resultant shows that the loads are the same. The pieces are not compared with the reference member's
  section, material, kind, orientation or releases, and a section choice on a split member is
  `member-missing`.
- **One member where the reference has two** (A to B without using C) is an extra member; both reference
  members are unmatched.
- **A node moved by more than the tolerance** is not matched; what is read at the reference node is
  `node-not-found`.
- **A model that is the reference moved or turned as a whole** is not recognised: positions are compared in
  the global axes.
- **Two learner's nodes at one reference node**: one is matched and the other is an extra node.

## The evidence

`buildEvidence(task, submission)` returns an `Evidence`. It does not change its arguments, and it does not
throw for a submission of the wrong shape: what cannot be read is listed in `submission.issues`.

Rules that hold for the whole evidence:

- **Plain data.** Objects, arrays, strings, numbers, booleans and `null`; no field is `undefined`, and
  `buildEvidence` replaces −0 by 0.
- **Finite numbers.** A number computed from the learner's model enters the evidence only when it is
  finite and its magnitude is at most `VALUE_BOUND` = 1e100 (`inRange` in `src/range.ts`, the one helper
  every conversion and every resolved load passes). What fails is reported, not stored: an own-model value
  and a requirement get the status `out-of-range` and `null` values, and a load is listed as unresolved and
  left out of every sum. The models that reach this are absurd ones that still parse and solve: a second
  moment of area of 1e-312 m⁴ makes a deflection in mm overflow, a load of 1e308 kN makes a sum overflow.
  Why 1e100: it is far above any quantity of a structure in kN, kN·m, m or mm, and far enough below the
  largest double (about 1.8e308) that what is then computed from such numbers stays finite: the difference
  from a typed value of any finite size, an allowance, a product of two of them in r × F (at most 1e200),
  and the sum of the loads of a model.
- **Equal to its JSON copy.** `JSON.parse` of `JSON.stringify` of an evidence equals it. The tests check
  this, and that no number is `NaN` or infinite, for every submission the scenario tests build (more than
  350): the scenarios of the card, and each of the three reference models with a section property, a
  material property, a load, a coordinate or the roll angle set to 1e-312, 1e-300, 1e300, 1e308, −1e300 and
  −1e308, and typed answers up to the largest double. The claim is for a task that `validateTask` accepts;
  a task with a tolerance or a limit of absurd size is not covered.
- **Deterministic.** The same task and submission give the same evidence, with the keys in the order of the
  types in `src/types.ts`. No clock is read; the submission's time is only checked for its form by
  `validateSubmission` and is not copied into the evidence.
- **No rounding.** Every number is as computed. Rounding is for display.
- **Units.** An answer's values are in its display unit (`unit`: kN, kN·m, mm, MPa, or `-` for a ratio); a
  requirement's values are in mm; loads are in kN, kN·m and kN/m; areas in m².
- **No prose.** Names, codes and numbers only. The ids of nodes, members and loads are the models' own.
- **Order.** Each array has the order its row below states.

| Field           | Content                                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| `version`       | `EVIDENCE_VERSION`, 1.                                                                                     |
| `taskId`        | The id of the task the evidence was built against.                                                         |
| `submission`    | What `validateSubmission` found, and two facts about the submission (below).                               |
| `model`         | Part (a): the state of the learner's model.                                                                |
| `matching`      | How the learner's nodes and members were matched to the reference's; `null` when the model does not parse. |
| `fixedParts`    | Part (b): the fixed parts that are missing or changed; `null` when the model does not parse.               |
| `supports`      | Part (c): the supports of the two models, node by node; `null` when the model does not parse.              |
| `loads`         | Part (d): the loads of the two models; `null` when the model does not parse.                               |
| `answers`       | Part (e): one entry per required answer, in the task's order.                                              |
| `requirements`  | Part (f): one entry per design requirement, in the task's order; empty for a task without.                 |
| `sectionChoice` | Part (g): the learner's choice of a section; `null` for a task without one.                                |

### `submission`

| Field                  | Content                                                                |
| ---------------------- | ---------------------------------------------------------------------- |
| `taskId`               | The submission's own task id; an empty string when it is not a string. |
| `taskIdMatches`        | It equals the task's id.                                               |
| `justificationPresent` | The justification has a character that is not white space.             |
| `issues`               | The issues of `validateSubmission`, in its order.                      |

### `model`, part (a)

| Field         | Content                                                                                                                                                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parses`      | `parseModel` read the JSON text of the submission's model without an issue.                                                                                                                                                                                   |
| `parseIssues` | The issues of `parseModel` as `{ code, ids, path }` (`path` is `null` when the issue has none), in its order; empty when `parses`.                                                                                                                            |
| `valid`       | `validateModel` reported no issue; `false` when the model does not parse.                                                                                                                                                                                     |
| `issues`      | The issues of `validateModel`, the same way, in its order.                                                                                                                                                                                                    |
| `solve`       | What `solve` did: `solved`, `invalid-model` (`validateModel` reported issues), `not-supported` (a truss member or an end release), `unstable`, `non-finite` (a number overflowed), or `not-run` (the model does not parse).                                   |
| `unstable`    | For `unstable`: `{ nodeId, dof, remaining, referenceNodeId }`, the node and degree of freedom at which the solver's elimination stopped, how many degrees of freedom were left, and the reference node at that node's position (or `null`); otherwise `null`. |
| `unsupported` | For `not-supported`: `{ memberId, feature }` per refused member, in the solver's order; otherwise empty.                                                                                                                                                      |
| `hasLoadCase` | The model has a load case with the task's `loadCaseId`.                                                                                                                                                                                                       |

The degree of freedom named in `unstable` is where the solver's elimination stopped, not a diagnosis of the
mechanism (`packages/solver/README.md`, "The instability test").

### `matching`

| Field                          | Content                                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nodeTolerance`                | `NODE_MATCH_TOLERANCE`, 1e-6 m.                                                                                                                   |
| `nodes`                        | One `{ referenceNodeId, learnerNodeId }` per reference node, in the reference's order; `learnerNodeId` is `null` when no learner's node is there. |
| `members`                      | One entry per reference member, in the reference's order (the next six rows).                                                                     |
| `members[].referenceMemberId`  | The reference member.                                                                                                                             |
| `members[].learnerMemberId`    | The learner's member between the same two nodes, or `null`.                                                                                       |
| `members[].reversed`           | The learner's member runs from the reference member's end node to its start node.                                                                 |
| `members[].referenceSectionId` | The reference member's section.                                                                                                                   |
| `members[].learnerSectionId`   | The learner's member's section, or `null` without a member.                                                                                       |
| `members[].differences`        | What differs, of `sectionId`, `materialId`, `kind`, `orientation`, `releases`, in that order; empty without a learner's member.                   |
| `extraNodeIds`                 | The learner's nodes matched to no reference node, sorted by id.                                                                                   |
| `extraMemberIds`               | The learner's members matched to no reference member, sorted by id.                                                                               |

`sectionId` is not listed as a difference for a member named by the task's `sectionChoice`. `orientation`
means that the local y axes of the two members are not parallel in either sense (the section is turned about
the member's axis); a member drawn the other way with roll 0 has the same orientation. Ids are sorted by
UTF-16 code unit.

### `fixedParts`, part (b)

| Field                         | Content                                                                                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checked`                     | How many fixed parts the task has.                                                                                                                  |
| `differences`                 | The parts that are missing or changed, in the order of the task's `fixed`.                                                                          |
| `differences[].list`          | The list of the model the part is in (`nodes`, `members`, ...).                                                                                     |
| `differences[].id`            | The part's id in the starting model; for a support, its node id.                                                                                    |
| `differences[].status`        | `missing`: the learner's model has no entry with this id in this list. `changed`: a field differs.                                                  |
| `differences[].counterpartId` | For a missing node or member: the learner's node at the same position, or member between the same two positions, if there is one; otherwise `null`. |
| `differences[].changedFields` | `{ field, expected, actual }` per field that differs, in the order of the entry's type: the value in the starting model and in the learner's model. |

A part is compared field by field with the starting model, numbers exactly (a node moved by 1e-9 m is
changed). The ids an entry names (a member's nodes, a load's member) are compared as ids. The section of a
member named by `sectionChoice` is not compared. With a repeated id in a list, the first entry is compared.

### `supports`, part (c)

| Field                         | Content                                                                                                                                            |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plane`                       | `"xz"` when every node of the reference model has the same y within 1e-6 m; otherwise `null`.                                                      |
| `compared`                    | The restraints that count as the support conditions the task asks for: `ux`, `uz`, `ry` when `plane` is `"xz"`; all six otherwise.                 |
| `outOfPlane`                  | The restraints that only hold a planar model in its plane, compared separately: `uy`, `rx`, `rz` when `plane` is `"xz"`; none otherwise.           |
| `nodes`                       | One entry per node with a support in either model: the reference's supports in the reference's order, then the learner's others sorted by node id. |
| `nodes[].referenceNodeId`     | The reference node, or `null` for a learner's support on a node at no reference node.                                                              |
| `nodes[].learnerNodeId`       | The learner's node at that position, or `null`.                                                                                                    |
| `nodes[].reference`           | The six restraints of the reference's support there (`ux` to `rz`, `true` is restrained), or `null` when it has none.                              |
| `nodes[].learner`             | The six restraints of the learner's support there, or `null` when it has none.                                                                     |
| `nodes[].agrees`              | The two agree in every restraint of `compared`; no support counts as all free.                                                                     |
| `nodes[].differing`           | The restraints of `compared` that differ, in the order ux, uy, uz, rx, ry, rz.                                                                     |
| `nodes[].outOfPlaneAgrees`    | The two agree in every restraint of `outOfPlane`; `true` when that list is empty.                                                                  |
| `nodes[].outOfPlaneDiffering` | The restraints of `outOfPlane` that differ, in the same order.                                                                                     |

The split follows the reference model alone: it is planar in all three seeded tasks. An out-of-plane
restraint that is missing never makes `agrees` false; whether the model is held at all is `model.solve`.
Task (b) asks for bases with all six restraints: a base without `rx` or `rz` shows in
`outOfPlaneDiffering`, one without `ry` in `differing`.

### `loads`, part (d)

Every load of the task's load case is resolved to a force in global axes at a point: a nodal load at its
node, with its own moment; a uniform load as (value × the member's length) at the middle of the member; a
point load at its position. A load in local axes is turned with `memberLocalAxes` of `@bridle/model`.

A load is **out of range**, and then unresolved, when a component of its force, its own moment, its point
of action, its force per unit length or its moment about the origin (r × F) is not finite or is beyond
`VALUE_BOUND` = 1e100. Such a load is in no resultant and no sum; `unresolvedLoadIds` names it, and so
does `learnerOutOfRangeLoadIds` of the comparison of its node or member, whose `status` is then about the
remaining loads (`missing` when there are none).

| Field                                               | Content                                                                                                                                                                                      |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loadCaseId`                                        | The task's `loadCaseId`.                                                                                                                                                                     |
| `resultant.reference`                               | The resultant of the reference's applied loads: `fx`, `fy`, `fz` in kN and `mx`, `my`, `mz` in kN·m about the origin of the global axes. Reactions are not loads.                            |
| `resultant.learner`                                 | The learner's resultant, the same way.                                                                                                                                                       |
| `resultant.forceDifference`                         | The length of the difference of the two force vectors, kN.                                                                                                                                   |
| `resultant.forceAllowance`                          | max(0.01 × the length of the reference's force vector, 1e-9), kN.                                                                                                                            |
| `resultant.momentDifference`                        | The length of the difference of the two moment vectors, kN·m.                                                                                                                                |
| `resultant.momentAllowance`                         | max(0.01 × the length of the reference's moment vector, 1e-9), kN·m.                                                                                                                         |
| `resultant.agrees`                                  | Both differences are at most their allowances (the two resultants agree within 1 percent).                                                                                                   |
| `comparisons`                                       | One entry per kind of load and node or member the reference loads: nodal, then uniform, then point loads; within a kind in the order the reference first loads the target.                   |
| `comparisons[].kind`                                | `nodal`, `member-uniform` or `member-point`.                                                                                                                                                 |
| `comparisons[].referenceTargetId`                   | The reference node (nodal) or member the loads act on.                                                                                                                                       |
| `comparisons[].referenceLoadIds`                    | The reference's loads of that kind on it, in the reference's order.                                                                                                                          |
| `comparisons[].learnerTargetId`                     | The learner's node or member matched to the target, or `null`.                                                                                                                               |
| `comparisons[].learnerLoadIds`                      | The learner's loads of that kind on it, in the task's load case, sorted by id; empty when there is no counterpart.                                                                           |
| `comparisons[].learnerOutOfRangeLoadIds`            | The learner's loads of that kind on it that are left out of the sum because a number of the load is out of range (below); sorted by id. They are also in `unresolvedLoadIds`.                |
| `comparisons[].reference`                           | The sum of the reference's loads there as `{ fx, fy, fz, mx, my, mz }` in global axes (what it holds per kind is below).                                                                     |
| `comparisons[].learner`                             | The sum of the learner's loads there, or `null` without one.                                                                                                                                 |
| `comparisons[].forceDifference`, `momentDifference` | The lengths of the differences of the force parts and of the moment parts, or `null` without a learner's load.                                                                               |
| `comparisons[].forceAllowance`, `momentAllowance`   | max(0.01 × the length of the reference's part, 1e-9).                                                                                                                                        |
| `comparisons[].status`                              | `missing`: the learner has no load of that kind there. `agrees`: both differences are at most their allowances. `differs`: one is not.                                                       |
| `extra`                                             | The learner's loads of the load case that are in no comparison, as `{ kind, loadId, learnerTargetId, referenceTargetId }`, by kind and then load id.                                         |
| `unresolvedLoadIds`                                 | The learner's loads of the load case that name a node or member the model lacks or a member without length, or that are out of range (below); they are in no sum and not in `extra`. Sorted. |
| `otherLoadCaseLoadIds`                              | The learner's loads in another load case; they are compared nowhere. Sorted.                                                                                                                 |

The vector of a comparison: for `nodal`, the forces in kN and the moments in kN·m; for `member-uniform`, the
force per unit length in kN/m, with the moments 0; for `member-point`, the forces in kN and their moment in
kN·m about the reference member's start node, which is how the position of a point load is compared.
Several loads on one node or member are summed on each side, so two loads of 10 and 5 kN/m agree with one of
15 kN/m. A uniform load and a point load are different kinds and never each other's counterpart.

The resultant alone can miss a difference: a force moved along its own line of action (the wind of task (b)
applied at node C instead of B) has the same resultant. The comparison per load shows it.

### `answers`, part (e)

| Field                 | Content                                                                                                                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `answerId`            | The answer's id in the task.                                                                                                                                                                        |
| `kind`                | The kind of quantity, from the task: force, moment, displacement, ratio or stress.                                                                                                                  |
| `unit`                | The display unit of every value of this entry.                                                                                                                                                      |
| `signed`              | From the task: `true` when the answer is compared with its sign, `false` by magnitude.                                                                                                              |
| `tolerance`           | The task's tolerance, `{ relative, absolute }`, the absolute part in `unit`.                                                                                                                        |
| `typed`               | The value the learner typed, or `null` when it is absent or not a finite number.                                                                                                                    |
| `referenceStatus`     | `computed`; `pending` (the task defines no reference value for the answer yet); `unavailable` (the reference model gave no value); or `out-of-range` (it is not finite or is beyond `VALUE_BOUND`). |
| `referenceBasis`      | The model the reference value comes from: `reference-model`, `reference-model-with-chosen-section`, or `none`.                                                                                      |
| `reference`           | The reference value (a magnitude when not `signed`), or `null`.                                                                                                                                     |
| `referenceAllowance`  | max(relative × \|reference\|, absolute), or `null` without a reference value.                                                                                                                       |
| `referenceDifference` | \|typed − reference\| for a signed answer, \| \|typed\| − \|reference\| \| for an unsigned one; `null` without a typed or a reference value.                                                        |
| `ownModelStatus`      | `computed`, or why the value for the learner's own model is not there (below).                                                                                                                      |
| `ownModelLocation`    | Where the value was read in the learner's model: `{ nodeId, memberId, memberEnd, piece }`; `null` when it was not computed.                                                                         |
| `ownModel`            | The value the solver computes for the learner's own model for the same quantity (a magnitude when not `signed`), or `null`.                                                                         |
| `ownModelAllowance`   | max(relative × \|ownModel\|, absolute), or `null` without an own-model value.                                                                                                                       |
| `ownModelDifference`  | The difference of `typed` and `ownModel`, by the rule of `referenceDifference`; `null` without either.                                                                                              |
| `signError`           | `true` for a signed answer whose verdict is `incorrect` and would be `correct` or `consistent-with-own-model` if the typed value had the opposite sign; otherwise `false`.                          |
| `verdict`             | One of the five verdicts below.                                                                                                                                                                     |

**The tolerance rule** is the one `@bridle/tasks` states: a typed value is within tolerance of a value v
when the difference is at most max(relative × |v|, absolute), all in the display unit. A signed answer is
compared with its sign, an unsigned one by magnitude (so a magnitude typed with a minus sign is not an
error). Every verdict follows from the numbers of its entry, by the order of the table below: `typed` is
`null`; `reference` is `null`; `referenceDifference ≤ referenceAllowance`; `ownModel` is not `null` and
`ownModelDifference ≤ ownModelAllowance`. A test recomputes the verdict from these stored numbers alone for
every submission the scenario tests build, the extreme models included. An own-model value that is not
stored (`ownModel: null`, whatever its status) never gives `consistent-with-own-model`.

**The verdicts**, tested in this order:

| Verdict                     | Meaning                                                                                             |
| --------------------------- | --------------------------------------------------------------------------------------------------- |
| `missing`                   | No value was typed.                                                                                 |
| `pending`                   | A value was typed and there is no reference value to compare it with.                               |
| `correct`                   | The typed value is within tolerance of the reference value.                                         |
| `consistent-with-own-model` | It is not, but it is within tolerance of the value the solver computes for the learner's own model. |
| `incorrect`                 | The typed value is within tolerance of neither.                                                     |

`consistent-with-own-model` tells a modelling error from a reading error: the learner read the results
correctly from a model that is not the task's. `correct` says nothing about the learner's model: reference
answers typed beside an unstable model are `correct`, and `model`, `supports`, `loads` and `ownModel` say
what the model is. An answer left out is `missing` even when its reference is pending.

**The reference value** is computed by `referenceAnswers` of `@bridle/tasks` for the task's reference model.
For a task with a section choice (task (c)), when the learner chose one section of the allowed list, it is
computed by `computeAnswers` for the reference model with that section on the chosen members
(`reference-model-with-chosen-section`); when there is no such choice (two different sections, a section
outside the list, a missing member, a model that does not parse) it is the reference model as it is.

**The own-model value** is read from the results of `solve` for the learner's model, in the task's load
case, at the learner's node or member matched to the one the answer's source names: a reaction or a
translation at the node; a member end force at the member end at the node, in the reference member's axes;
a limit ratio from part (f). `ownModelStatus` when there is no value:

| Status             | Meaning                                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `model-not-read`   | The model does not parse.                                                                                                     |
| `not-solved`       | `solve` refused the model (`model.solve` says how).                                                                           |
| `no-load-case`     | The model lacks the task's load case.                                                                                         |
| `node-not-found`   | No learner's node is where the reference has the node the value is read at.                                                   |
| `member-not-found` | No learner's member, and no single piece of one, is where the reference has the member.                                       |
| `no-support`       | The learner's node there has no support, so it has no reaction.                                                               |
| `pending`          | The task defines no value for the answer yet.                                                                                 |
| `unavailable`      | The answer's limit ratio names a requirement the task does not have (`validateTask` reports such a task).                     |
| `out-of-range`     | The value was computed and, in the display unit, is not a finite number or is beyond `VALUE_BOUND` (1e100); it is not stored. |
| `no-loads`         | The learner's model has no applied load in the task's load case; its results are not offered (below).                         |

**A model without an applied load offers no own-model value.** When the learner's model has no load in the
task's load case with a force or moment component that is not zero (no load at all, loads of zero, loads
only in another load case, or only loads that are unresolved), the grader offers none of its results as the
learner's own. With no load, or loads of zero, every result is zero whatever the model is; with only
unresolved loads the solver may still have applied them, and the results are then not zero and not usable
(a requirement can still be `computed` from them). In both cases the result is not a reading of the model, so `ownModelStatus` is `no-loads`, `ownModel` is `null`, and a
typed value cannot be `consistent-with-own-model`: without this rule any typed value up to the absolute part
of the tolerance (0.05 mm, say, or a deflection typed in metres) would be. The rule is about the model's
loads, not about the value: a loaded model whose value is zero keeps it (below). Part (f) is not changed by
this rule: a requirement is still evaluated on an unloaded model, with a value of 0.

A support that does not restrain the component asked for has a reaction of 0 there, which is a computed
value: the base moment of a pinned base is 0.

`computeAnswers` of `@bridle/tasks` is not used for the learner's model, because it looks nodes and members
up by the reference's ids. For a model that has those ids and member directions the two give the same
numbers; a test compares them with `toBe`.

### `requirements`, part (f)

| Field             | Content                                                                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `requirementId`   | The requirement's id in the task.                                                                                                                                                                 |
| `quantity`        | What the task calls the limited translation: `deflection` or `drift`.                                                                                                                             |
| `referenceNodeId` | The reference node whose translation is limited.                                                                                                                                                  |
| `learnerNodeId`   | The learner's node at that position, or `null`.                                                                                                                                                   |
| `component`       | The limited translation: `ux`, `uy` or `uz`.                                                                                                                                                      |
| `status`          | `computed`; or `model-not-read`, `not-solved`, `no-load-case` or `node-not-found` as for an answer; or `out-of-range` when the value in mm or the ratio is not finite or is beyond `VALUE_BOUND`. |
| `unit`            | The unit of `value` and `allowable`: always `mm`.                                                                                                                                                 |
| `value`           | The magnitude of the translation in the learner's model, or `null`.                                                                                                                               |
| `allowable`       | The limit: the requirement's `length / divisor` (`allowableValue` of `@bridle/tasks`).                                                                                                            |
| `ratio`           | The value divided by the limit, or `null`.                                                                                                                                                        |
| `satisfied`       | The value is at most the limit, or `null` without a value.                                                                                                                                        |

`ratio` and `satisfied` are computed in metres, as `@bridle/tasks` does, before `value` and `allowable` are
converted to mm.

### `sectionChoice`, part (g)

| Field                         | Content                                                                                                                                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `members`                     | `{ referenceMemberId, learnerMemberId, sectionId }` per member of the task's `sectionChoice.memberIds`, in that order: the learner's member there and its section.                             |
| `status`                      | `chosen` (all of them are there and have one section), `mixed` (different sections), `member-missing` (no learner's member where one of them is), `model-not-read`.                            |
| `chosenSectionId`             | The chosen section; `null` unless `status` is `chosen`.                                                                                                                                        |
| `allowed`                     | The chosen section is in the task's allowed list; `null` without a chosen section.                                                                                                             |
| `chosenArea`                  | The chosen section's area in the reference model, m²; `null` unless an allowed section is chosen.                                                                                              |
| `meetsRequirements`           | The reference model with the chosen section meets every requirement of the task; `null` unless an allowed section is chosen.                                                                   |
| `lighterAllowedSectionMeets`  | An allowed section with a smaller area than the chosen one also meets the requirements; `null` unless an allowed section is chosen.                                                            |
| `lightestMeetingSectionId`    | The allowed section of least area that meets the requirements (the first in the list among equal areas), or `null` when none does.                                                             |
| `referenceSectionId`          | The section of the task's reference model on those members, or `null` when they differ.                                                                                                        |
| `options`                     | The allowed sections in the order of `sectionChoice.sectionIds` (the next five rows).                                                                                                          |
| `options[].sectionId`         | The section.                                                                                                                                                                                   |
| `options[].area`              | Its area in the reference model, m²; `null` when the reference model lacks it.                                                                                                                 |
| `options[].massPerMetre`      | Its mass per metre, kg/m, as `evaluateSectionChoices` gives it.                                                                                                                                |
| `options[].requirements`      | `{ requirementId, unit, value, allowable, ratio, satisfied }` per requirement computed with this section on the reference model, values in mm; one whose numbers are out of range is left out. |
| `options[].meetsRequirements` | Every requirement of the task is computed and satisfied with this section.                                                                                                                     |

The choice is judged with `evaluateSectionChoices` of `@bridle/tasks`, which tries each allowed section on
the task's reference model; "lighter" is a smaller cross-section area. Part (f) is the learner's own model:
the two agree when the learner changed nothing but the section.

## The summary

`summarizeEvidence(evidence)` returns counts and flags, no prose. A part that is `null` in the evidence
counts as zero entries.

| Field                        | Content                                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `taskId`                     | The evidence's task id.                                                                                                                                       |
| `submissionValid`            | `validateSubmission` reported no issue.                                                                                                                       |
| `justificationPresent`       | The justification has a character that is not white space.                                                                                                    |
| `modelParses`, `modelValid`  | `model.parses`, `model.valid`.                                                                                                                                |
| `modelSolved`, `solveStatus` | `model.solve` is `solved`; `model.solve`.                                                                                                                     |
| `answers`                    | `total`, and how many answers have each verdict: `correct`, `consistentWithOwnModel`, `incorrect`, `missing`, `pending`.                                      |
| `members`                    | `missing`: reference members with no learner's member; `different`: with a difference; `extra`: learner's members matched to nothing; `extraNodes`: nodes so. |
| `fixedParts`                 | `checked`, and how many fixed parts are `missing` and `changed`.                                                                                              |
| `supports`                   | `differing`: nodes whose `agrees` is false; `outOfPlaneDiffering`: nodes whose `outOfPlaneAgrees` is false.                                                   |
| `loads`                      | `resultantAgrees` (`null` when the model does not parse); `differing` and `missing`: comparisons with that status; `extra`: extra loads.                      |
| `requirements`               | `total`, `satisfied`, `notSatisfied`, and `notComputed` (those without a value).                                                                              |
| `requirementsMet`            | `true` when the task has requirements and each is computed and satisfied on the learner's model; `false` when one is computed and not satisfied; else `null`. |
| `sectionChoice`              | `status`, `chosenSectionId`, `allowed`, `meetsRequirements`, `lighterAllowedSectionMeets` of part (g); `null` for a task without a choice.                    |

## Worked example

Task (b), the portal frame. The learner gave base A a pin (the three translations, no rotation) where the
task asks for a fixed base, kept everything else, and typed seven answers read from that model, one of them
without its sign. The numbers below are rounded for reading; the evidence holds them unrounded. A test
(`src/evidence.test.ts`, "the worked example of the README") builds this evidence.

`model`: `parses: true`, `valid: true`, `solve: "solved"`. `fixedParts`: 11 checked, no difference.
`loads`: the resultants agree and both comparisons are `agrees`. `supports.nodes[0]`, node A:

| `reference`    | `learner`                               | `agrees` | `differing` | `outOfPlaneAgrees` | `outOfPlaneDiffering` |
| -------------- | --------------------------------------- | -------- | ----------- | ------------------ | --------------------- |
| all six `true` | `ux`, `uy`, `uz` `true`, others `false` | `false`  | `["ry"]`    | `false`            | `["rx", "rz"]`        |

`answers`:

| `answerId`    | `unit` | `signed` | `typed` | `reference` | `referenceAllowance` | `referenceDifference` | `ownModel` | `ownModelAllowance` | `ownModelDifference` | `verdict`                   |
| ------------- | ------ | -------- | ------- | ----------- | -------------------- | --------------------- | ---------- | ------------------- | -------------------- | --------------------------- |
| `reaction-ax` | kN     | yes      | 12.5    | 15.609      | 0.156                | 3.109                 | 12.527     | 0.125               | 0.027                | `consistent-with-own-model` |
| `reaction-dx` | kN     | yes      | 32.5    | −35.609     | 0.356                | 68.109                | −32.527    | 0.325               | 65.027               | `incorrect`                 |
| `reaction-az` | kN     | no       | 115.1   | 114.302     | 1.143                | 0.798                 | 115.103    | 1.151               | 0.003                | `correct`                   |
| `reaction-dz` | kN     | no       | 124.9   | 125.698     | 1.257                | 0.798                 | 124.897    | 1.249               | 0.003                | `correct`                   |
| `moment-a`    | kN·m   | no       | 0       | 15.363      | 0.154                | 15.363                | 0          | 0.05                | 0                    | `consistent-with-own-model` |
| `moment-d`    | kN·m   | no       | 60.8    | 69.781      | 0.698                | 8.981                 | 60.827     | 0.608               | 0.027                | `consistent-with-own-model` |
| `sway-b`      | mm     | no       | 4.98    | 7.783       | 0.156                | 2.803                 | 4.981      | 0.100               | 0.001                | `consistent-with-own-model` |
| `drift-ratio` | -      | no       | `null`  | 0.467       | 0.009                | `null`                | 0.299      | 0.006               | `null`               | `missing`                   |

How to read it:

- `reaction-ax`: 12.5 is 3.109 kN from the reference, beyond the allowance of 0.156 kN (1 percent of 15.609),
  and 0.027 kN from the value of the learner's own model, within 0.125 kN: a correct reading of a model that
  is not the task's.
- `reaction-dx` is signed. The learner typed 32.5 for −32.527: `incorrect`, with `signError: true`, because
  −32.5 would be `consistent-with-own-model`. Every other `signError` in the table is `false`.
- `reaction-az` and `reaction-dz`: the pin moves the vertical reactions by 0.8 kN, inside 1 percent of 114
  and 126 kN, so the values read from the pinned model are `correct`.
- `moment-a`: a pin carries no moment; the own-model value is 0, and its allowance is the absolute part,
  0.05 kN·m.
- `drift-ratio` was left out: `missing`, with the reference and own-model values still given.

`requirements[0]`, the drift limit on the learner's model: `value` 4.981 mm, `allowable` 16.667 mm, `ratio`
0.299, `satisfied: true`.

`summarizeEvidence` gives `answers: { total: 8, correct: 2, consistentWithOwnModel: 4, incorrect: 1,
missing: 1, pending: 0 }`, `supports: { differing: 1, outOfPlaneDiffering: 1 }`, `fixedParts: { checked: 11,
missing: 0, changed: 0 }`, `loads: { resultantAgrees: true, differing: 0, missing: 0, extra: 0 }`,
`members: { missing: 0, different: 0, extra: 0, extraNodes: 0 }`, `requirementsMet: true`,
`modelSolved: true`, `sectionChoice: null`.

## Limits

- The matching limits are under "How the two models are matched".
- The stress answer of task (c) has no reference value: its source in `@bridle/tasks` is the `pending`
  marker, and its verdict is `pending` or `missing`. Nothing here computes a stress.
- Unsigned answers are compared by magnitude, so they do not show the direction of a reaction or of a
  displacement: a load applied upward gives reactions of the right magnitude. Part (d) shows the load.
- The solver refuses truss members and end releases (`model.solve: "not-supported"`); such a model has no
  own-model values.
- The tolerance of the load comparison (1 percent, and 1e-9 as the least allowance), the node tolerance
  (1e-6 m) and the bound of a stored number (1e100) are constants of this package
  (`LOAD_RELATIVE_TOLERANCE`, `LOAD_ABSOLUTE_TOLERANCE`, `NODE_MATCH_TOLERANCE`, `VALUE_BOUND`), not data of
  a task.
- A model with numbers of absurd size is not diagnosed: its values are `out-of-range` or its loads
  unresolved, and the solver may report it as `unstable` or `non-finite`.
- Nothing here is text for a learner, and no message key is defined for the codes.

## The parts as functions

`buildEvidence` is the composition of one pure function per part, each exported and tested by itself:
`examineModel` (a), `compareFixedParts` (b), `compareSupports` (c), `compareLoads` (d), `ownModelValue`,
`referenceValues` and `answerEvidence` (e), `evaluateRequirements` (f), `chosenSection` and
`sectionChoiceEvidence` (g), with `matchModels` and `matchingEvidence` for the matching. Used by
themselves, the load functions can return −0 where a product is zero; `buildEvidence` removes it.
