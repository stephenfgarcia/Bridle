/**
 * The task format of the showcase (pitch card T2, `docs/plan/pitch-plan.md`). A task is plain data:
 * objects, arrays, strings, numbers and booleans, so it can be stored as JSON and sent to a browser.
 *
 * The models inside a task are `Model`s of `@bridle/model`, in its units: kN, m, kN·m, kN/m²; Z up.
 * A learner reads and types values in the display units below (kN, kN·m, mm, MPa).
 */
import type { Model } from "@bridle/model";

export type TaskLevel = "introductory" | "intermediate";

/** What kind of quantity a required answer is. */
export type QuantityKind = "force" | "moment" | "displacement" | "ratio" | "stress";

/** The unit a required answer is shown and typed in. `"-"` is a number without a unit (a ratio). */
export type DisplayUnit = "kN" | "kN·m" | "mm" | "MPa" | "-";

/** The display unit of each quantity kind. `validateTask` reports an answer whose unit differs. */
export const UNIT_OF_KIND: Readonly<Record<QuantityKind, DisplayUnit>> = {
  force: "kN",
  moment: "kN·m",
  displacement: "mm",
  ratio: "-",
  stress: "MPa",
};

/**
 * The factor from a value in model units (kN, kN·m, m, kN/m², no unit) to the display unit:
 * display = model value × factor. A deflection of 0.012 m is 12 mm; a stress of 2.0e5 kN/m² is 200 MPa.
 */
export const DISPLAY_PER_MODEL_UNIT: Readonly<Record<DisplayUnit, number>> = {
  kN: 1,
  kN·m: 1,
  mm: 1000,
  MPa: 0.001,
  "-": 1,
};

/**
 * How close a learner's answer must be to the reference value. Both parts are positive. An answer is
 * within tolerance when
 *
 *   |answer − reference| ≤ max(relative × |reference|, absolute),
 *
 * with the answer, the reference and `absolute` in the answer's display unit. The absolute part keeps a
 * correctly rounded answer acceptable when the reference value is small. This package states the rule
 * and does not apply it: comparing a learner's answers is card T6.
 */
export interface Tolerance {
  /** A fraction of the reference value: 0.01 is 1 percent. */
  relative: number;
  /** In the answer's display unit. */
  absolute: number;
}

/** The three forces and three moments of a reaction or of a member end. */
export type ForceComponent = "fx" | "fy" | "fz" | "mx" | "my" | "mz";

/** A translation of a node along a global axis. */
export type TranslationComponent = "ux" | "uy" | "uz";

/**
 * Where the value of a required answer comes from, in the results of `solve` (`@bridle/solver`) for
 * the task's load case. The ids are ids of the reference model.
 *
 * - `reaction`: a component of the reaction at a supported node, in global axes (the force or moment
 *   the support applies to the structure).
 * - `displacement`: a translation of a node, in global axes, in m.
 * - `member-end-force`: a component of the end action at one end of a member, in the member's local
 *   axes, by the solver's sign convention (what the node applies to the member).
 * - `limit-ratio`: the value a design requirement limits, divided by its allowable value.
 * - `pending`: this package computes no value for the answer yet. `waitsFor` names the pitch cards
 *   that will define it and `reason` says why. It is a marker, not a number.
 */
export type AnswerSource =
  | { kind: "reaction"; nodeId: string; component: ForceComponent }
  | { kind: "displacement"; nodeId: string; component: TranslationComponent }
  | { kind: "member-end-force"; memberId: string; end: "start" | "end"; component: ForceComponent }
  | { kind: "limit-ratio"; requirementId: string }
  | { kind: "pending"; waitsFor: string[]; reason: string };

/** One value the learner must report. */
export interface RequiredAnswer {
  id: string;
  /** The question, as the learner reads it. */
  prompt: string;
  kind: QuantityKind;
  /** The unit the answer is shown and typed in; `UNIT_OF_KIND[kind]`. */
  unit: DisplayUnit;
  /**
   * `true`: the answer carries a sign, in the global axes (a horizontal reaction along +X is
   * positive). `false`: the answer is a magnitude, and the reference value is an absolute value.
   */
  signed: boolean;
  tolerance: Tolerance;
  source: AnswerSource;
}

/**
 * The machine-readable limit of a design requirement: the magnitude of the translation `component`
 * of node `nodeId` (an id of the reference model) must not exceed `length / divisor`, in m.
 * `quantity` says what the translation is called: the deflection of a beam or the drift (sway) of a
 * frame.
 */
export interface DisplacementLimit {
  quantity: "deflection" | "drift";
  nodeId: string;
  component: TranslationComponent;
  /** The span or the height the limit is a fraction of, in m. */
  length: number;
  /** 360 for span/360. */
  divisor: number;
}

/** A requirement the learner's structure must meet, stated in words with its limit as data. */
export interface DesignRequirement {
  id: string;
  /** The requirement in words. It is the task's own requirement, not a quotation of a design code. */
  statement: string;
  limit: DisplacementLimit;
}

/** The levels of a rubric criterion, from the lowest to the highest. */
export const RUBRIC_LEVELS = ["not-shown", "developing", "proficient", "exemplary"] as const;

export type RubricLevelName = (typeof RUBRIC_LEVELS)[number];

/** The level names as a reader sees them. */
export const RUBRIC_LEVEL_LABEL: Readonly<Record<RubricLevelName, string>> = {
  "not-shown": "Not shown",
  developing: "Developing",
  proficient: "Proficient",
  exemplary: "Exemplary",
};

export interface RubricLevel {
  level: RubricLevelName;
  /** What a submission at this level shows, in observable terms. */
  description: string;
}

/**
 * What a criterion is assessed from: the learner's `model`, the solver's `results` for that model,
 * the learner's typed `answers`, or the written `justification`.
 */
export type EvidenceBasis = "model" | "results" | "answers" | "justification";

export interface RubricCriterion {
  id: string;
  name: string;
  /** The criterion's share of the grade; the weights of a rubric sum to 1. */
  weight: number;
  basis: EvidenceBasis[];
  /**
   * Three or four levels in the order of `RUBRIC_LEVELS`: the first is `not-shown`, the last is
   * `exemplary`.
   */
  levels: RubricLevel[];
}

export interface Rubric {
  /** Three to five criteria. */
  criteria: RubricCriterion[];
}

/** The lists of a `Model` whose entries a task can fix. */
export type ModelListName =
  | "nodes"
  | "members"
  | "sections"
  | "materials"
  | "supports"
  | "loadCases"
  | "nodalLoads"
  | "memberUniformLoads"
  | "memberPointLoads";

/**
 * A part of the starting model that the learner cannot change or delete. `id` is the entry's id in
 * that list; for `supports`, which have no id, it is the support's node id.
 *
 * A fixed member keeps its nodes, kind, roll angle, releases, material and section. The one
 * exception is a member named by the task's `sectionChoice`: its section is the learner's choice.
 */
export interface FixedPart {
  list: ModelListName;
  id: string;
}

/**
 * The choice of a section that a task asks for: the learner assigns one of `sectionIds` (sections of
 * the starting model) to all of `memberIds` (members of the starting model) together.
 */
export interface SectionChoice {
  memberIds: string[];
  sectionIds: string[];
}

/** One line of the brief's table of given values, as text: `{ label: "Span", value: "6 m" }`. */
export interface Given {
  label: string;
  value: string;
}

/** The short written answer a task asks for beside the numbers. */
export interface Justification {
  prompt: string;
}

export interface Task {
  id: string;
  title: string;
  level: TaskLevel;
  /** The brief, one string per paragraph, in plain text. */
  brief: string[];
  /** The given values of the brief as a table. */
  givens: Given[];
  learningOutcomes: string[];
  /** The model the learner begins from. It may have no support yet. */
  startingModel: Model;
  /** The parts of the starting model the learner cannot change. */
  fixed: FixedPart[];
  /** Present when the task asks the learner to choose a section. */
  sectionChoice?: SectionChoice;
  /** The load case (of the reference model) whose results the answers and the limits are read from. */
  loadCaseId: string;
  answers: RequiredAnswer[];
  requirements?: DesignRequirement[];
  justification?: Justification;
  rubric: Rubric;
  /** A complete, correct model of the task. The reference answers are computed from it. */
  referenceModel: Model;
}
