/**
 * The submission and the evidence of the showcase (pitch card T6, `docs/plan/pitch-plan.md`).
 *
 * The evidence is plain data: objects, arrays, strings, numbers, booleans and `null`. No field is
 * `undefined` and, for a task that `validateTask` accepts, every number is finite (a number computed
 * from the learner's model that is not finite, or beyond `VALUE_BOUND`, is reported with a status
 * and not stored), so the evidence survives `JSON.stringify` and `JSON.parse` unchanged. It holds
 * names, codes and numbers only, and no sentence for a learner: the wording belongs to pitch cards
 * T7 and T8.
 *
 * Units. A value of an answer or of a requirement is in the display unit named beside it (kN, kN·m,
 * mm, MPa, or "-" for a ratio). Loads are in the model's units (kN, kN·m, kN/m), coordinates in m,
 * areas in m². No number is rounded.
 *
 * Order. Every array has a stated order; where it says "the reference's order" it is the order of
 * the list in the task's reference model.
 */
import type { Model } from "@bridle/model";
import type { Dof } from "@bridle/solver";
import type {
  DisplayUnit,
  ModelListName,
  QuantityKind,
  Tolerance,
  TranslationComponent,
} from "@bridle/tasks";

/** The value of `Evidence.version` this package writes. */
export const EVIDENCE_VERSION = 1;

/**
 * Two nodes are the same point when the distance between them is at most this, in m (one
 * micrometre). Nodes of the learner's model are matched to nodes of the reference by position.
 */
export const NODE_MATCH_TOLERANCE = 1e-6;

/** The loads of two models agree when they differ by at most this fraction of the reference's (1 percent). */
export const LOAD_RELATIVE_TOLERANCE = 0.01;

/**
 * The least allowance of a load comparison, in the load's unit (kN, kN·m or kN/m): it absorbs the
 * rounding of a sum when the reference's value is zero.
 */
export const LOAD_ABSOLUTE_TOLERANCE = 1e-9;

/**
 * The largest magnitude a number computed from a model may have to enter the evidence: an answer's
 * value in its display unit, a requirement's value in mm and its ratio, and every component of a
 * load resolved to global axes (its force, its own moment, its point of action, its force per unit
 * length and its moment about the origin). A value that is not finite or is beyond the bound is
 * reported as `out-of-range` (a load as unresolved) and is not stored.
 *
 * Why 1e100: it is far above any quantity of a structure in these units, and far enough below the
 * largest double (about 1.8e308) that what the evidence then computes from such values stays
 * finite: the difference from a typed value of any finite size, an allowance, the product of two
 * of them in r × F (at most 1e200), and the sum of the loads of a model.
 */
export const VALUE_BOUND = 1e100;

/**
 * Two unit vectors are parallel when the magnitude of their dot product is at least one minus this.
 * Used to compare the orientation of a member's section with the reference member's.
 */
export const PARALLEL_TOLERANCE = 1e-9;

/** What a learner hands in for one task. Card T5 stores it. */
export interface Submission {
  /** The id of the task the submission answers. */
  taskId: string;
  /** The learner's model, as `@bridle/model` defines it (kN, m). */
  model: Model;
  /**
   * The typed answers by answer id, each a number in the answer's display unit. An answer the
   * learner left empty is `null` or has no key.
   */
  answers: Record<string, number | null>;
  /** The written justification; an empty string when the learner wrote none. */
  justification: string;
  /**
   * The time of submission in UTC, as `YYYY-MM-DDTHH:MM:SSZ` with optional decimals of a second
   * (what `Date.prototype.toISOString` writes). It is not copied into the evidence.
   */
  submittedAt: string;
}

/** The codes `validateSubmission` reports. */
export const SUBMISSION_ISSUE_CODES = [
  "invalid-shape",
  "wrong-task-id",
  "unknown-answer-id",
  "non-finite-answer",
  "invalid-model",
  "invalid-time",
] as const;

export type SubmissionIssueCode = (typeof SUBMISSION_ISSUE_CODES)[number];

/** One thing wrong with a submission. */
export interface SubmissionIssue {
  code: SubmissionIssueCode;
  /**
   * The ids the issue concerns. `wrong-task-id`: the submission's task id, then the task's.
   * `unknown-answer-id` and `non-finite-answer`: the answer id. `invalid-model`: the code of the
   * issue `parseModel` reported. Otherwise empty.
   */
  ids: string[];
  /** Where in the submission the issue is, for example `answers.reaction-a` or `model.nodes[0].x`. */
  path: string;
}

/** An issue of `parseModel` or `validateModel`, without its message key. */
export interface ModelIssueEvidence {
  /** The issue's code, for example `no-support` or `missing-node`. */
  code: string;
  /** The ids the issue concerns, as `@bridle/model` gives them. */
  ids: string[];
  /** Where in the model the issue is, or `null` when the issue has no place. */
  path: string | null;
}

/**
 * What `solve` did with the learner's model. `not-run`: the model could not be read, so nothing was
 * solved. `invalid-model`: `validateModel` reported issues. `not-supported`: the model has a member
 * the solver does not solve yet. `unstable`: the supports do not hold the structure. `non-finite`: a
 * number overflowed.
 */
export type SolveStatus =
  | "solved"
  | "not-run"
  | "invalid-model"
  | "not-supported"
  | "unstable"
  | "non-finite";

/** Part (a): the state of the learner's model. */
export interface ModelStateEvidence {
  /** `parseModel` read the JSON text of the submission's model without an issue. */
  parses: boolean;
  /** The issues of `parseModel`, in its order; empty when `parses`. */
  parseIssues: ModelIssueEvidence[];
  /** `validateModel` reported no issue. `false` when the model does not parse. */
  valid: boolean;
  /** The issues of `validateModel`, in its order; empty when the model does not parse. */
  issues: ModelIssueEvidence[];
  /** What `solve` did with the model. */
  solve: SolveStatus;
  /**
   * For `solve: "unstable"`: the node and the degree of freedom at which the solver's elimination
   * stopped, how many degrees of freedom were left, and the reference node at that node's position
   * (or `null`). Otherwise `null`. The solver's README says what the named degree of freedom means.
   */
  unstable: {
    nodeId: string;
    dof: Dof;
    remaining: number;
    referenceNodeId: string | null;
  } | null;
  /** For `solve: "not-supported"`: the members and the feature of each, in the solver's order. Otherwise empty. */
  unsupported: { memberId: string; feature: string }[];
  /** The model has a load case with the task's `loadCaseId`. `false` when the model does not parse. */
  hasLoadCase: boolean;
}

/** One node of the reference and the learner's node at its position. */
export interface NodeMatchEvidence {
  referenceNodeId: string;
  /** The learner's node within `NODE_MATCH_TOLERANCE` of the reference node, or `null`. */
  learnerNodeId: string | null;
}

/** A property of a matched member that differs from the reference member's. */
export type MemberDifference = "sectionId" | "materialId" | "kind" | "orientation" | "releases";

/** One member of the reference and the learner's member between the same two nodes. */
export interface MemberMatchEvidence {
  referenceMemberId: string;
  /** The learner's member whose two end nodes are matched to the reference member's, or `null`. */
  learnerMemberId: string | null;
  /** The learner's member runs from the reference member's end node to its start node. */
  reversed: boolean;
  /** The id of the reference member's section. */
  referenceSectionId: string;
  /** The id of the learner's member's section, or `null` without a member. */
  learnerSectionId: string | null;
  /**
   * What differs, in the order of `MemberDifference`; empty without a learner's member. `sectionId`
   * is left out for a member named by the task's `sectionChoice` (part g judges that choice).
   */
  differences: MemberDifference[];
}

/** How the learner's model was matched to the reference model: by position and connectivity, not by id. */
export interface MatchingEvidence {
  /** `NODE_MATCH_TOLERANCE`, in m. */
  nodeTolerance: number;
  /** One entry per node of the reference model, in the reference's order. */
  nodes: NodeMatchEvidence[];
  /** One entry per member of the reference model, in the reference's order. */
  members: MemberMatchEvidence[];
  /** The ids of the learner's nodes matched to no reference node, sorted by id. */
  extraNodeIds: string[];
  /** The ids of the learner's members matched to no reference member, sorted by id. */
  extraMemberIds: string[];
}

/** A value of a model's entry: a number, a text or a flag. */
export type FieldValue = number | string | boolean;

/** One field of a fixed part whose value differs from the starting model's. */
export interface ChangedField {
  /** The field's name, for example `x`, `sectionId` or `releases.start.ry`. */
  field: string;
  /** The value in the task's starting model. */
  expected: FieldValue;
  /** The value in the learner's model. */
  actual: FieldValue;
}

/** One fixed part of the task that the learner's model lacks or has changed. */
export interface FixedPartDifference {
  /** The list of the model the part is in. */
  list: ModelListName;
  /** The part's id in the starting model; for a support, its node id. */
  id: string;
  /** `missing`: the learner's model has no entry with this id in this list. `changed`: a field differs. */
  status: "missing" | "changed";
  /**
   * For a missing node or member: the id of the learner's node at the same position, or of the
   * learner's member between the same two positions, if there is one (the part was replaced, not
   * removed). Otherwise `null`.
   */
  counterpartId: string | null;
  /** The fields that differ, in the order of the entry's type; empty for `missing`. */
  changedFields: ChangedField[];
}

/** Part (b): the fixed parts of the task compared with the starting model. */
export interface FixedPartsEvidence {
  /** How many fixed parts the task has. */
  checked: number;
  /** The parts that are missing or changed, in the order of the task's `fixed`. */
  differences: FixedPartDifference[];
}

/** The six restraints of a node. */
export interface Restraints {
  ux: boolean;
  uy: boolean;
  uz: boolean;
  rx: boolean;
  ry: boolean;
  rz: boolean;
}

/** The supports of the two models at one node. */
export interface SupportNodeEvidence {
  /** The reference node, or `null` for a learner's support on a node matched to no reference node. */
  referenceNodeId: string | null;
  /** The learner's node at that position, or `null`. */
  learnerNodeId: string | null;
  /** The restraints of the reference's support on the node, or `null` when it has none there. */
  reference: Restraints | null;
  /** The restraints of the learner's support on the node, or `null` when it has none there. */
  learner: Restraints | null;
  /** The two agree in every restraint of `SupportsEvidence.compared` (no support counts as all free). */
  agrees: boolean;
  /** The restraints of `compared` that differ, in the order ux, uy, uz, rx, ry, rz. */
  differing: Dof[];
  /** The two agree in every restraint of `SupportsEvidence.outOfPlane`; `true` when that list is empty. */
  outOfPlaneAgrees: boolean;
  /** The restraints of `outOfPlane` that differ, in the same order. */
  outOfPlaneDiffering: Dof[];
}

/** Part (c): the supports of the two models, node by node. */
export interface SupportsEvidence {
  /**
   * `"xz"` when every node of the reference model has the same y within `NODE_MATCH_TOLERANCE`
   * (the model lies in one X-Z plane); otherwise `null`.
   */
  plane: "xz" | null;
  /**
   * The restraints that count as the support conditions the task asks for: ux, uz and ry for a
   * model in an X-Z plane; all six otherwise.
   */
  compared: Dof[];
  /**
   * The restraints that only hold a planar model in its plane, compared separately: uy, rx and rz
   * for a model in an X-Z plane; none otherwise.
   */
  outOfPlane: Dof[];
  /**
   * One entry per node with a support in either model: first the reference's supports in the
   * reference's order, then the learner's supports on other nodes, sorted by the learner's node id.
   */
  nodes: SupportNodeEvidence[];
}

/** A force and a moment in global axes. */
export interface LoadVector {
  fx: number;
  fy: number;
  fz: number;
  mx: number;
  my: number;
  mz: number;
}

/** The kind of a load: on a node, uniform over a member, or at a point of a member. */
export type LoadKind = "nodal" | "member-uniform" | "member-point";

/**
 * The reference's loads of one kind on one node or member, compared with the learner's loads of
 * that kind on the matched node or member (all of them summed on each side).
 *
 * What the vectors hold, in global axes:
 * - `nodal`: the forces in kN (`fx`, `fy`, `fz`) and the moments in kN·m (`mx`, `my`, `mz`).
 * - `member-uniform`: the force per unit length in kN/m (`fx`, `fy`, `fz`); the moments are 0.
 * - `member-point`: the forces in kN, and their moment in kN·m about the reference member's start
 *   node, which is where the position of a point load enters.
 */
export interface LoadComparison {
  kind: LoadKind;
  /** The node id (`nodal`) or the member id of the reference model the loads act on. */
  referenceTargetId: string;
  /** The ids of the reference's loads summed here, in the reference's order. */
  referenceLoadIds: string[];
  /** The learner's node or member matched to the target, or `null`. */
  learnerTargetId: string | null;
  /** The ids of the learner's loads of this kind on it, in the task's load case, sorted by id. */
  learnerLoadIds: string[];
  /**
   * The ids of the learner's loads of this kind on it, in the task's load case, that are left out
   * of the sum because a component of the load is not finite or is beyond `VALUE_BOUND`; sorted by
   * id. They are also in `LoadsEvidence.unresolvedLoadIds`.
   */
  learnerOutOfRangeLoadIds: string[];
  /** The sum of the reference's loads. */
  reference: LoadVector;
  /** The sum of the learner's loads, or `null` when `learnerLoadIds` is empty. */
  learner: LoadVector | null;
  /** The length of the difference of the two force vectors, or `null` without a learner's load. */
  forceDifference: number | null;
  /** max(`LOAD_RELATIVE_TOLERANCE` × length of the reference's force vector, `LOAD_ABSOLUTE_TOLERANCE`). */
  forceAllowance: number;
  /** The length of the difference of the two moment vectors, or `null` without a learner's load. */
  momentDifference: number | null;
  /** The same allowance for the moment vector. */
  momentAllowance: number;
  /**
   * `missing`: the learner has no load of this kind there (no counterpart). `agrees`: both
   * differences are within their allowances. `differs`: one is not.
   */
  status: "agrees" | "differs" | "missing";
}

/** A load of the learner, in the task's load case, where the reference has no load of that kind. */
export interface ExtraLoad {
  kind: LoadKind;
  /** The load's id in the learner's model. */
  loadId: string;
  /** The learner's node or member the load names. */
  learnerTargetId: string;
  /** The reference node or member matched to it, or `null`. */
  referenceTargetId: string | null;
}

/** The resultants of the applied loads of the two models, and whether they agree. */
export interface ResultantEvidence {
  /** The reference's resultant: forces in kN, moments in kN·m about the origin of the global axes. */
  reference: LoadVector;
  /** The learner's resultant, the same way. */
  learner: LoadVector;
  /** The length of the difference of the two force vectors, kN. */
  forceDifference: number;
  /** max(`LOAD_RELATIVE_TOLERANCE` × length of the reference's force vector, `LOAD_ABSOLUTE_TOLERANCE`), kN. */
  forceAllowance: number;
  /** The length of the difference of the two moment vectors, kN·m. */
  momentDifference: number;
  /** The same allowance for the moment vector, kN·m. */
  momentAllowance: number;
  /** Both differences are within their allowances. */
  agrees: boolean;
}

/** Part (d): the loads of the two models in the task's load case. */
export interface LoadsEvidence {
  /** The task's `loadCaseId`. */
  loadCaseId: string;
  /** The resultants of all applied loads of the load case (the reactions are not loads). */
  resultant: ResultantEvidence;
  /**
   * One entry per kind and node or member the reference loads: nodal loads, then uniform loads,
   * then point loads; within a kind in the order the reference first loads that node or member.
   */
  comparisons: LoadComparison[];
  /** The learner's loads with no counterpart in the reference, by kind (as above) and then load id. */
  extra: ExtraLoad[];
  /**
   * The ids of the learner's loads of the load case that name a node or member the model lacks, or
   * a member without length, or that have a component (of the force, the moment, the point of
   * action, the force per unit length or the moment about the origin) that is not finite or is
   * beyond `VALUE_BOUND`; they are left out of the resultant, of the sums of the comparisons and
   * of `extra`. Sorted.
   */
  unresolvedLoadIds: string[];
  /** The ids of the learner's loads in another load case than the task's; they are compared nowhere. Sorted. */
  otherLoadCaseLoadIds: string[];
}

/**
 * Whether a value was computed, or why not. `model-not-read`: the model does not parse.
 * `not-solved`: `solve` refused the model. `no-load-case`: the model lacks the task's load case.
 * `node-not-found`, `member-not-found`: the learner's model has no node or member where the
 * reference has the one the value is read from. `no-support`: the node has no support, so it has no
 * reaction. `pending`: the task defines no value for the answer yet. `unavailable`: the reference
 * model gave no value (a reference value), or the answer's limit ratio names a requirement the task
 * does not have (an own-model value). `out-of-range`: the value was computed and is not a finite
 * number, or its magnitude is beyond `VALUE_BOUND`; it is not stored. `no-loads`: the learner's
 * model has no applied load in the task's load case, so every result of it is zero whatever the
 * model is; the value is not offered as an own-model value.
 */
export type ValueStatus =
  | "computed"
  | "model-not-read"
  | "not-solved"
  | "no-load-case"
  | "node-not-found"
  | "member-not-found"
  | "no-support"
  | "pending"
  | "unavailable"
  | "out-of-range"
  | "no-loads";

/**
 * - `correct`: the typed value is within tolerance of the reference value.
 * - `consistent-with-own-model`: it is not, but it is within tolerance of the value the solver
 *   computes for the learner's own model.
 * - `incorrect`: it is within tolerance of neither.
 * - `missing`: no value was typed.
 * - `pending`: a value was typed and there is no reference value to compare it with.
 */
export type AnswerVerdict =
  | "correct"
  | "consistent-with-own-model"
  | "incorrect"
  | "missing"
  | "pending";

/** Which model the reference value of an answer was computed from. */
export type ReferenceBasis =
  /** The task's reference model as it is. */
  | "reference-model"
  /** The reference model with the learner's chosen section on the members of `sectionChoice`. */
  | "reference-model-with-chosen-section"
  /** No model: the answer has no reference value. */
  | "none";

/** Where in the learner's model the own-model value of an answer was read. */
export interface OwnModelLocation {
  /** The learner's node (a reaction, a displacement, a limit ratio, or the node of a member end). */
  nodeId: string;
  /** The learner's member, for a member end force; otherwise `null`. */
  memberId: string | null;
  /** The end of that member that is at the node; otherwise `null`. */
  memberEnd: "start" | "end" | null;
  /**
   * `true` when the member is a piece of the reference member (the learner split it with an extra
   * node) and not a member between the same two nodes.
   */
  piece: boolean;
}

/** Part (e): one required answer. */
export interface AnswerEvidence {
  /** The answer's id in the task. */
  answerId: string;
  /** The kind of quantity, from the task. */
  kind: QuantityKind;
  /** The display unit of `typed`, `reference`, `ownModel`, the differences and the allowances. */
  unit: DisplayUnit;
  /** From the task: `true` when the answer is compared with its sign, `false` by magnitude. */
  signed: boolean;
  /** The tolerance of the task: a relative part and an absolute part (in `unit`). */
  tolerance: Tolerance;
  /** The value the learner typed, or `null` when it is absent or not a finite number. */
  typed: number | null;
  /** Whether the reference value was computed, or why not. */
  referenceStatus: ValueStatus;
  /** The model the reference value comes from. */
  referenceBasis: ReferenceBasis;
  /** The reference value (a magnitude when not `signed`), or `null`. */
  reference: number | null;
  /** max(relative × |reference|, absolute), or `null` without a reference value. */
  referenceAllowance: number | null;
  /**
   * |typed − reference| for a signed answer, | |typed| − |reference| | for an unsigned one; `null`
   * without a typed or a reference value.
   */
  referenceDifference: number | null;
  /** Whether the value for the learner's own model was computed, or why not. */
  ownModelStatus: ValueStatus;
  /** Where that value was read in the learner's model, or `null` when it was not computed. */
  ownModelLocation: OwnModelLocation | null;
  /** The value the solver computes for the learner's own model (a magnitude when not `signed`), or `null`. */
  ownModel: number | null;
  /** max(relative × |ownModel|, absolute), or `null` without an own-model value. */
  ownModelAllowance: number | null;
  /** The difference of `typed` and `ownModel`, by the rule of `referenceDifference`; `null` without either. */
  ownModelDifference: number | null;
  /**
   * `true` for a signed answer whose verdict is `incorrect` and would be `correct` or
   * `consistent-with-own-model` if the typed value had the opposite sign; otherwise `false`.
   */
  signError: boolean;
  verdict: AnswerVerdict;
}

/** Part (f): one design requirement evaluated on the learner's model. */
export interface RequirementEvidence {
  /** The requirement's id in the task. */
  requirementId: string;
  /** What the limited translation is called in the task: a deflection or a drift. */
  quantity: "deflection" | "drift";
  /** The reference node whose translation is limited. */
  referenceNodeId: string;
  /** The learner's node at that position, or `null`. */
  learnerNodeId: string | null;
  /** The limited translation. */
  component: TranslationComponent;
  /** Whether the value was computed for the learner's model, or why not. */
  status: ValueStatus;
  /** The unit of `value` and `allowable`: always `"mm"`. */
  unit: DisplayUnit;
  /** The magnitude of the translation in the learner's model, or `null`. */
  value: number | null;
  /** The limit: the requirement's `length / divisor`. */
  allowable: number;
  /** The value divided by the limit, computed in metres (before the conversion to mm), or `null`. */
  ratio: number | null;
  /** The value is at most the limit (compared in metres), or `null` without a value. */
  satisfied: boolean | null;
}

/** One design requirement checked for one allowed section on the reference model. */
export interface SectionOptionRequirement {
  requirementId: string;
  /** The unit of `value` and `allowable`: always `"mm"`. */
  unit: DisplayUnit;
  /** The magnitude of the limited translation with this section. */
  value: number;
  /** The limit. */
  allowable: number;
  /** The value divided by the limit, as `evaluateSectionChoices` computed it in metres. */
  ratio: number;
  /** The value is at most the limit. */
  satisfied: boolean;
}

/** One section of the task's allowed list, tried on the reference model by `evaluateSectionChoices`. */
export interface SectionOptionEvidence {
  sectionId: string;
  /** The section's area in the reference model, m²; `null` when the reference model lacks the section. */
  area: number | null;
  /** Its mass per metre, kg/m, as `evaluateSectionChoices` gives it. */
  massPerMetre: number;
  /** The requirements with this section, in the task's order; those that were computed. */
  requirements: SectionOptionRequirement[];
  /** Every requirement of the task is computed and satisfied with this section. */
  meetsRequirements: boolean;
}

/** Part (g): the learner's choice of a section. */
export interface SectionChoiceEvidence {
  /** The section of each member the choice is for, in the order of the task's `sectionChoice.memberIds`. */
  members: {
    referenceMemberId: string;
    learnerMemberId: string | null;
    sectionId: string | null;
  }[];
  /**
   * `chosen`: every one of those members is in the learner's model and they have one section.
   * `mixed`: they have different sections. `member-missing`: the learner's model has no member
   * where one of them is. `model-not-read`: the model does not parse.
   */
  status: "chosen" | "mixed" | "member-missing" | "model-not-read";
  /** The chosen section's id; `null` unless `status` is `chosen`. */
  chosenSectionId: string | null;
  /** The chosen section is in the task's allowed list; `null` without a chosen section. */
  allowed: boolean | null;
  /** The chosen section's area in the reference model, m²; `null` unless an allowed section is chosen. */
  chosenArea: number | null;
  /**
   * The reference model with the chosen section meets every requirement of the task; `null` unless
   * an allowed section is chosen. Part (f) has the learner's own model.
   */
  meetsRequirements: boolean | null;
  /**
   * An allowed section with a smaller area than the chosen one also meets the requirements; `null`
   * unless an allowed section is chosen.
   */
  lighterAllowedSectionMeets: boolean | null;
  /** The allowed section of least area that meets the requirements, or `null` when none does. */
  lightestMeetingSectionId: string | null;
  /** The section of the task's reference model on those members, or `null` when they differ. */
  referenceSectionId: string | null;
  /** The allowed sections, in the order of the task's `sectionChoice.sectionIds`. */
  options: SectionOptionEvidence[];
}

/** The evidence of one submission against one task. */
export interface Evidence {
  /** `EVIDENCE_VERSION`. */
  version: number;
  /** The id of the task the evidence was built against. */
  taskId: string;
  /** What `validateSubmission` found, and two facts about the submission. */
  submission: {
    /** The submission's own task id; an empty string when it has none. */
    taskId: string;
    /** It equals the task's id. */
    taskIdMatches: boolean;
    /** The justification has a character that is not white space. */
    justificationPresent: boolean;
    /** The issues of `validateSubmission`, in its order. */
    issues: SubmissionIssue[];
  };
  /** Part (a). */
  model: ModelStateEvidence;
  /** How the two models were matched; `null` when the learner's model does not parse. */
  matching: MatchingEvidence | null;
  /** Part (b); `null` when the learner's model does not parse. */
  fixedParts: FixedPartsEvidence | null;
  /** Part (c); `null` when the learner's model does not parse. */
  supports: SupportsEvidence | null;
  /** Part (d); `null` when the learner's model does not parse. */
  loads: LoadsEvidence | null;
  /** Part (e): one entry per required answer, in the task's order. */
  answers: AnswerEvidence[];
  /** Part (f): one entry per design requirement, in the task's order; empty for a task without. */
  requirements: RequirementEvidence[];
  /** Part (g); `null` for a task without a section choice. */
  sectionChoice: SectionChoiceEvidence | null;
}

/** Counts and flags of an evidence, for the interface and for the prompt of card T7. No prose. */
export interface EvidenceSummary {
  taskId: string;
  /** `validateSubmission` reported no issue. */
  submissionValid: boolean;
  /** The justification has a character that is not white space. */
  justificationPresent: boolean;
  /** The learner's model parses. */
  modelParses: boolean;
  /** `validateModel` accepts it. */
  modelValid: boolean;
  /** `solve` solved it. */
  modelSolved: boolean;
  /** What `solve` did with it. */
  solveStatus: SolveStatus;
  /** How many answers have each verdict; `total` is their sum. */
  answers: {
    total: number;
    correct: number;
    consistentWithOwnModel: number;
    incorrect: number;
    missing: number;
    pending: number;
  };
  /** Reference members with no learner's member, with a difference, and learner's members and nodes matched to nothing. */
  members: { missing: number; different: number; extra: number; extraNodes: number };
  /** Fixed parts: how many the task has, and how many are missing or changed. */
  fixedParts: { checked: number; missing: number; changed: number };
  /** Nodes whose compared restraints differ, and nodes whose out-of-plane restraints differ. */
  supports: { differing: number; outOfPlaneDiffering: number };
  /**
   * Loads: whether the resultants agree (`null` when the model does not parse), and how many
   * comparisons have the status `differs`, how many `missing`, and how many extra loads there are.
   */
  loads: { resultantAgrees: boolean | null; differing: number; missing: number; extra: number };
  /** Requirements by outcome; `notComputed` are those without a value. */
  requirements: { total: number; satisfied: number; notSatisfied: number; notComputed: number };
  /**
   * `true` when the task has requirements and every one is computed and satisfied on the learner's
   * model; `false` when one is computed and not satisfied; otherwise `null`.
   */
  requirementsMet: boolean | null;
  /** The flags of part (g), or `null` for a task without a section choice. */
  sectionChoice: {
    status: SectionChoiceEvidence["status"];
    chosenSectionId: string | null;
    allowed: boolean | null;
    meetsRequirements: boolean | null;
    lighterAllowedSectionMeets: boolean | null;
  } | null;
}
