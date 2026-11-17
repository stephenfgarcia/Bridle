/**
 * Task (c), "Choose the beam" (intermediate). The numbers of the brief, the models and the rubric
 * all come from the constants below.
 *
 * Closed form: the mid-span deflection is 5wL⁴/(384·E·Iy) and the limit is L/360 = 19.4 mm, so a
 * section meets the limit when Iy ≥ 5·360·w·L³/(384·E) = 1.914e-4 m⁴ (w = 25 kN/m, L = 7 m,
 * E = 2.1e8 kN/m²). Of the list, I 300x150, I 330x160 and I 360x170 are below that and I 400x180,
 * I 450x190 and I 500x200 are above; the lightest that meets the limit, I 400x180, is the reference
 * choice. The tests establish this with the solver (`evaluateSectionChoices`), not with this comment.
 *
 * The stress part: the brief asks for the maximum bending stress, but this card gives it no
 * reference value. The answer `max-bending-stress` has the source `pending` (waiting for pitch cards
 * S8, the illustrative checks, and T6, the evidence).
 */
import type { Model } from "@bridle/model";
import {
  DISPLACEMENT_TOLERANCE,
  emptyTaskModel,
  frameMember,
  gravityLoad,
  LOAD_CASE_ID,
  MOMENT_TOLERANCE,
  plain,
  RATIO_TOLERANCE,
  STEEL_E_TEXT,
  STEEL_FY_MPA,
  STEEL_ID,
  STRESS_TOLERANCE,
  support,
} from "../parts";
import { genericSection, genericSectionDimensions } from "../sections";
import type { Task } from "../types";

/** Span, m. */
export const CHOICE_SPAN = 7;
/** Uniform load, kN/m, downward; a service value that includes an allowance for self-weight. */
export const CHOICE_LOAD = 25;
/** The deflection limit is the span divided by this. */
export const CHOICE_DEFLECTION_DIVISOR = 360;
/** The sections the learner chooses from, lightest first. */
export const CHOICE_SECTIONS = [
  "I 300x150",
  "I 330x160",
  "I 360x170",
  "I 400x180",
  "I 450x190",
  "I 500x200",
] as const;
/** The section the model starts with: the lightest of the list. */
export const CHOICE_STARTING_SECTION = "I 300x150";
/** The reference choice: the lightest section of the list that meets the deflection limit. */
export const CHOICE_REFERENCE_SECTION = "I 400x180";

function sections() {
  return CHOICE_SECTIONS.flatMap((name) => {
    const dimensions = genericSectionDimensions(name);
    return dimensions === undefined ? [] : [genericSection(dimensions)];
  });
}

/**
 * The whole beam: nodes A, C (mid-span), B on the global X axis; members A-C and C-B with the given
 * section; A holds the three translations and the rotation about X, B holds Y and Z; the load on
 * both members.
 */
function beamModel(sectionId: string): Model {
  return {
    ...emptyTaskModel(sections()),
    nodes: [
      { id: "A", x: 0, y: 0, z: 0 },
      { id: "C", x: CHOICE_SPAN / 2, y: 0, z: 0 },
      { id: "B", x: CHOICE_SPAN, y: 0, z: 0 },
    ],
    members: [frameMember("AC", "A", "C", sectionId), frameMember("CB", "C", "B", sectionId)],
    supports: [support("A", ["ux", "uy", "uz", "rx"]), support("B", ["uy", "uz"])],
    memberUniformLoads: [
      gravityLoad("w-AC", "AC", CHOICE_LOAD),
      gravityLoad("w-CB", "CB", CHOICE_LOAD),
    ],
  };
}

export function chooseTheBeamTask(): Task {
  const L = plain(CHOICE_SPAN);
  const half = plain(CHOICE_SPAN / 2);
  const w = plain(CHOICE_LOAD);
  const limit = `${L} m / ${CHOICE_DEFLECTION_DIVISOR} = ${((CHOICE_SPAN / CHOICE_DEFLECTION_DIVISOR) * 1000).toFixed(1)} mm`;
  const E = STEEL_E_TEXT;
  const list = CHOICE_SECTIONS.join(", ");
  return {
    id: "choose-the-beam",
    title: "Choose the beam",
    level: "intermediate",
    brief: [
      `A steel floor beam spans ${L} m and is simply supported. It carries a uniformly distributed load of ${w} kN/m over its whole length. The load is a service (unfactored) value and includes an allowance for the beam's self-weight whichever section is chosen; do not add self-weight. The steel has a modulus of elasticity E = ${E} MPa and a yield strength of ${STEEL_FY_MPA} MPa.`,
      `The beam is modelled for you: nodes A (x = 0), C (x = ${half} m, mid-span) and B (x = ${L} m), the members A-C and C-B, a pin at A and a roller at B, and the load in load case ${LOAD_CASE_ID}. You cannot change them. What you choose is the section, the same for both members, from this list of generic I-sections, lightest first: ${list}. The model starts with the lightest, ${CHOICE_STARTING_SECTION}.`,
      `Requirement of this task: the mid-span deflection under the given load must not exceed the span divided by ${CHOICE_DEFLECTION_DIVISOR}. Choose the lightest section of the list, the one with the least mass per metre, that meets this requirement.`,
      "Report the values listed below for the section you chose. One of them is the maximum bending stress in the beam: take it as the maximum bending moment divided by the elastic section modulus about the strong axis, W = Iy / (h/2), with h the depth of the section, and compare it with the yield strength.",
      "Justify your choice in writing.",
    ],
    givens: [
      { label: "Span, A to B", value: `${L} m` },
      {
        label: "Uniformly distributed load (service value, self-weight allowance included)",
        value: `${w} kN/m, downward`,
      },
      { label: "Modulus of elasticity, E", value: `${E} MPa` },
      { label: "Yield strength", value: `${STEEL_FY_MPA} MPa` },
      { label: "Supports", value: "pin at A, roller at B" },
      { label: "Sections to choose from", value: list },
      { label: "Deflection limit at mid-span", value: `span / ${CHOICE_DEFLECTION_DIVISOR}` },
    ],
    learningOutcomes: [
      "Apply a deflection limit to a beam and express the result as a ratio to the limit.",
      "Compare candidate sections by their second moment of area and their mass, and select the lightest that meets a requirement.",
      "Compute an elastic bending stress from the bending moment and the section modulus.",
      "Justify a design choice with numbers, including why the next lighter section was rejected.",
    ],
    startingModel: beamModel(CHOICE_STARTING_SECTION),
    fixed: [
      { list: "nodes", id: "A" },
      { list: "nodes", id: "C" },
      { list: "nodes", id: "B" },
      { list: "members", id: "AC" },
      { list: "members", id: "CB" },
      ...CHOICE_SECTIONS.map((id) => ({ list: "sections" as const, id })),
      { list: "materials", id: STEEL_ID },
      { list: "supports", id: "A" },
      { list: "supports", id: "B" },
      { list: "loadCases", id: LOAD_CASE_ID },
      { list: "memberUniformLoads", id: "w-AC" },
      { list: "memberUniformLoads", id: "w-CB" },
    ],
    sectionChoice: { memberIds: ["AC", "CB"], sectionIds: [...CHOICE_SECTIONS] },
    loadCaseId: LOAD_CASE_ID,
    answers: [
      {
        id: "max-moment",
        prompt: "Maximum bending moment in the beam, at mid-span (magnitude)",
        kind: "moment",
        unit: "kN·m",
        signed: false,
        tolerance: MOMENT_TOLERANCE,
        source: { kind: "member-end-force", memberId: "AC", end: "end", component: "my" },
      },
      {
        id: "midspan-deflection",
        prompt: "Deflection at mid-span, node C, with the section you chose (magnitude, downward)",
        kind: "displacement",
        unit: "mm",
        signed: false,
        tolerance: DISPLACEMENT_TOLERANCE,
        source: { kind: "displacement", nodeId: "C", component: "uz" },
      },
      {
        id: "deflection-ratio",
        prompt: `Mid-span deflection divided by the deflection limit (span / ${CHOICE_DEFLECTION_DIVISOR})`,
        kind: "ratio",
        unit: "-",
        signed: false,
        tolerance: RATIO_TOLERANCE,
        source: { kind: "limit-ratio", requirementId: "deflection-limit" },
      },
      {
        id: "max-bending-stress",
        prompt: "Maximum bending stress in the beam with the section you chose, M / W (magnitude)",
        kind: "stress",
        unit: "MPa",
        signed: false,
        tolerance: STRESS_TOLERANCE,
        source: {
          kind: "pending",
          waitsFor: ["S8", "T6"],
          reason:
            "The illustrative stress check is defined by pitch card S8 and the evidence for it by pitch card T6; until then there is no reference value for this answer.",
        },
      },
    ],
    requirements: [
      {
        id: "deflection-limit",
        statement: `The deflection at mid-span (node C) under the given load must not exceed the span divided by ${CHOICE_DEFLECTION_DIVISOR}: ${limit}.`,
        limit: {
          quantity: "deflection",
          nodeId: "C",
          component: "uz",
          length: CHOICE_SPAN,
          divisor: CHOICE_DEFLECTION_DIVISOR,
        },
      },
    ],
    justification: {
      prompt:
        "In four to six sentences: name the section you chose; give its mid-span deflection and the limit in mm; show that the next lighter section of the list does not meet the limit; give the bending stress as a fraction of the yield strength; and say which of the two, deflection or stress, decides the choice for this beam.",
    },
    rubric: {
      criteria: [
        {
          id: "section-choice",
          name: "Section choice",
          weight: 0.35,
          basis: ["model", "results"],
          levels: [
            {
              level: "not-shown",
              description: `The beam still has the starting section ${CHOICE_STARTING_SECTION}, or the two members have different sections.`,
            },
            {
              level: "developing",
              description: `One section is assigned to both members, but its mid-span deflection exceeds the limit of ${limit} (I 330x160 or I 360x170).`,
            },
            {
              level: "proficient",
              description:
                "The chosen section meets the deflection limit but is not the lightest of the list that does (I 450x190 or I 500x200).",
            },
            {
              level: "exemplary",
              description: `The chosen section is ${CHOICE_REFERENCE_SECTION}, the lightest section of the list that meets the deflection limit.`,
            },
          ],
        },
        {
          id: "reported-results",
          name: "Reported results",
          weight: 0.2,
          basis: ["answers", "results"],
          levels: [
            {
              level: "not-shown",
              description:
                "No answers are given, or none of the three (maximum moment, deflection, deflection ratio) is within tolerance of the value computed for the section the learner chose.",
            },
            {
              level: "developing",
              description:
                "One of the three is within tolerance of the value computed for the chosen section.",
            },
            {
              level: "proficient",
              description:
                "Two of the three are within tolerance of the values computed for the chosen section.",
            },
            {
              level: "exemplary",
              description:
                "All three are within tolerance of the values computed for the chosen section.",
            },
          ],
        },
        {
          id: "stress-check",
          name: "Stress check",
          weight: 0.15,
          basis: ["answers", "results", "justification"],
          levels: [
            { level: "not-shown", description: "No bending stress is reported." },
            {
              level: "developing",
              description:
                "A bending stress is reported, but it is not M / W for the chosen section within tolerance (for example W taken from another section, or kN/m² typed as MPa).",
            },
            {
              level: "proficient",
              description: "The reported stress is M / W for the chosen section within tolerance.",
            },
            {
              level: "exemplary",
              description: `As proficient, and the justification states the stress as a fraction of the yield strength of ${STEEL_FY_MPA} MPa.`,
            },
          ],
        },
        {
          id: "justification",
          name: "Justification of the choice",
          weight: 0.3,
          basis: ["justification"],
          levels: [
            {
              level: "not-shown",
              description: "No justification is written, or it does not name a section.",
            },
            {
              level: "developing",
              description: `A section is named, but the choice is not supported by numbers: the deflection or the limit (${limit}) is missing.`,
            },
            {
              level: "proficient",
              description:
                "The deflection of the chosen section and the limit are stated in mm, and they show that the chosen section meets the limit.",
            },
            {
              level: "exemplary",
              description:
                "As proficient, and the justification shows with its deflection that the next lighter section of the list exceeds the limit, and says, with the stress value, which of deflection and stress decides the choice.",
            },
          ],
        },
      ],
    },
    referenceModel: beamModel(CHOICE_REFERENCE_SECTION),
  };
}
