/**
 * Task (a), "Simply supported beam" (introductory). The numbers of the brief, the models and the
 * rubric all come from the constants below.
 *
 * Closed-form values for the reference (w = 15 kN/m, L = 6 m, E = 2.1e8 kN/m², Iy of I 300x150 =
 * 8.147e-5 m⁴ by `genericSection`): reactions wL/2 = 45 kN, maximum moment wL²/8 = 67.5 kN·m,
 * mid-span deflection 5wL⁴/(384·E·Iy) = 14.8 mm (span/406). The tests compare the solver's values
 * with these formulas.
 */
import type { Model } from "@bridle/model";
import {
  DISPLACEMENT_TOLERANCE,
  emptyTaskModel,
  FORCE_TOLERANCE,
  frameMember,
  gravityLoad,
  LOAD_CASE_ID,
  MOMENT_TOLERANCE,
  plain,
  STEEL_E_TEXT,
  STEEL_ID,
  support,
} from "../parts";
import { genericSection, genericSectionDimensions } from "../sections";
import type { Task } from "../types";

/** Span, m. */
export const BEAM_SPAN = 6;
/** Uniform load, kN/m, downward; a service value that includes the beam's self-weight. */
export const BEAM_LOAD = 15;
/** The beam's section. */
export const BEAM_SECTION = "I 300x150";

function sections() {
  const dimensions = genericSectionDimensions(BEAM_SECTION);
  return dimensions === undefined ? [] : [genericSection(dimensions)];
}

/** Nodes A, C (mid-span) and B on the global X axis, the section, the steel and the load case. */
function startingModel(): Model {
  return {
    ...emptyTaskModel(sections()),
    nodes: [
      { id: "A", x: 0, y: 0, z: 0 },
      { id: "C", x: BEAM_SPAN / 2, y: 0, z: 0 },
      { id: "B", x: BEAM_SPAN, y: 0, z: 0 },
    ],
  };
}

/**
 * The beam as two members, A-C and C-B. A holds the three translations and the rotation about X
 * (which stops the beam spinning about its own axis); B holds Y and Z and is free along X.
 */
function referenceModel(): Model {
  return {
    ...startingModel(),
    members: [frameMember("AC", "A", "C", BEAM_SECTION), frameMember("CB", "C", "B", BEAM_SECTION)],
    supports: [support("A", ["ux", "uy", "uz", "rx"]), support("B", ["uy", "uz"])],
    memberUniformLoads: [
      gravityLoad("w-AC", "AC", BEAM_LOAD),
      gravityLoad("w-CB", "CB", BEAM_LOAD),
    ],
  };
}

export function simplySupportedBeamTask(): Task {
  const L = plain(BEAM_SPAN);
  const half = plain(BEAM_SPAN / 2);
  const w = plain(BEAM_LOAD);
  const total = plain(BEAM_LOAD * BEAM_SPAN);
  const E = STEEL_E_TEXT;
  return {
    id: "simply-supported-beam",
    title: "Simply supported beam",
    level: "introductory",
    brief: [
      `A steel floor beam spans ${L} m between two walls and carries a uniformly distributed load of ${w} kN/m over its whole length. The load is a service (unfactored) value and already includes the self-weight of the beam; do not add self-weight. The beam is the generic I-section ${BEAM_SECTION} (300 mm deep, 150 mm wide), bending about its strong axis, in steel with a modulus of elasticity E = ${E} MPa.`,
      `The beam is simply supported: a pin at A, the left end, and a roller at B, the right end, which is free to move along the beam. Nodes A (x = 0), C (x = ${half} m, mid-span) and B (x = ${L} m) are already placed on the global X axis; Z is up and gravity acts along −Z.`,
      `Model the beam. Draw it as two members, A to C and C to B, so that the mid-span deflection can be read at node C. Give it its supports. Apply the load to both members in load case ${LOAD_CASE_ID}.`,
      "The workspace analyses the model in three dimensions, so the supports must also do what a drawing in one plane takes for granted: hold both ends against moving sideways (along Y), and hold one end against twisting about the beam's own axis (rotation about X). A model that is not held in every direction is reported as unstable and has no results. Do not hold the bending rotation (about Y) at either end: that would make the end fixed, not simply supported.",
      "Read the results and report the values listed below. Before you submit, check each of them by hand calculation.",
    ],
    givens: [
      { label: "Span, A to B", value: `${L} m` },
      {
        label: "Uniformly distributed load (service value, self-weight included)",
        value: `${w} kN/m, downward`,
      },
      { label: "Section", value: `${BEAM_SECTION}, strong axis` },
      { label: "Modulus of elasticity, E", value: `${E} MPa` },
      { label: "Supports", value: "pin at A, roller at B" },
    ],
    learningOutcomes: [
      "Represent a simply supported beam as a model of nodes, members, a pin and a roller.",
      "Restrain a plane structure completely in a three-dimensional analysis without adding restraint in its own plane.",
      "Apply a uniformly distributed load in the direction of gravity.",
      "Read reactions, bending moment and deflection from the results and check them against wL/2, wL²/8 and 5wL⁴/(384EI).",
    ],
    startingModel: startingModel(),
    fixed: [
      { list: "nodes", id: "A" },
      { list: "nodes", id: "C" },
      { list: "nodes", id: "B" },
      { list: "sections", id: BEAM_SECTION },
      { list: "materials", id: STEEL_ID },
      { list: "loadCases", id: LOAD_CASE_ID },
    ],
    loadCaseId: LOAD_CASE_ID,
    answers: [
      {
        id: "reaction-a",
        prompt: "Vertical reaction at support A (magnitude)",
        kind: "force",
        unit: "kN",
        signed: false,
        tolerance: FORCE_TOLERANCE,
        source: { kind: "reaction", nodeId: "A", component: "fz" },
      },
      {
        id: "reaction-b",
        prompt: "Vertical reaction at support B (magnitude)",
        kind: "force",
        unit: "kN",
        signed: false,
        tolerance: FORCE_TOLERANCE,
        source: { kind: "reaction", nodeId: "B", component: "fz" },
      },
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
        prompt: "Deflection at mid-span, node C (magnitude, downward)",
        kind: "displacement",
        unit: "mm",
        signed: false,
        tolerance: DISPLACEMENT_TOLERANCE,
        source: { kind: "displacement", nodeId: "C", component: "uz" },
      },
    ],
    justification: {
      prompt:
        "In three to five sentences: show how you checked the reactions, the maximum moment and the deflection by hand (the formulas and the numbers you got), and say by what factor the mid-span deflection would change if the span were doubled with the same load per metre and the same section.",
    },
    rubric: {
      criteria: [
        {
          id: "model-and-supports",
          name: "Model and supports",
          weight: 0.3,
          basis: ["model", "results"],
          levels: [
            {
              level: "not-shown",
              description:
                "No members connect A to B, or the model has no supports, or it is reported as unstable.",
            },
            {
              level: "developing",
              description:
                "The beam is drawn and the model solves, but the supports do not make it simply supported in its plane: the rotation about Y is held at A or B, or both ends are held along X, or node C is supported.",
            },
            {
              level: "proficient",
              description: `The beam runs from A through C to B with section ${BEAM_SECTION}; one end is held along X, Y and Z and the other along Y and Z with X free; no rotation about Y is held; the model solves.`,
            },
            {
              level: "exemplary",
              description:
                "As proficient, with the pin at A and the roller at B as the brief has them, the twist about X held at one end only and nothing else restrained.",
            },
          ],
        },
        {
          id: "loads",
          name: "Loads",
          weight: 0.2,
          basis: ["model"],
          levels: [
            {
              level: "not-shown",
              description: `No load is applied to the beam in load case ${LOAD_CASE_ID}.`,
            },
            {
              level: "developing",
              description: `A load is applied but it differs from the brief: it is not ${w} kN/m, or one of the two members is unloaded, or it acts upward or along another axis, or it is entered as point loads.`,
            },
            {
              level: "proficient",
              description: `Both members carry a uniform load of ${w} kN/m along global −Z in ${LOAD_CASE_ID}, a total of ${total} kN, and nothing else is loaded.`,
            },
            {
              level: "exemplary",
              description: `As proficient, and the justification shows that the two vertical reactions sum to the total applied load of ${total} kN.`,
            },
          ],
        },
        {
          id: "reported-results",
          name: "Reported results",
          weight: 0.3,
          basis: ["answers", "results"],
          levels: [
            {
              level: "not-shown",
              description: "No answers are given, or none of the four is within its tolerance.",
            },
            {
              level: "developing",
              description: "One or two of the four answers are within tolerance.",
            },
            {
              level: "proficient",
              description: "Three of the four answers are within tolerance.",
            },
            { level: "exemplary", description: "All four answers are within tolerance." },
          ],
        },
        {
          id: "judgement",
          name: "Engineering judgement and justification",
          weight: 0.2,
          basis: ["justification"],
          levels: [
            {
              level: "not-shown",
              description: "No justification is written, or it does not refer to this beam.",
            },
            {
              level: "developing",
              description:
                "The justification repeats the software's results without an independent check, or names formulas without the numbers they give.",
            },
            {
              level: "proficient",
              description:
                "The justification gives hand values for the reactions, the maximum moment and the deflection from wL/2, wL²/8 and 5wL⁴/(384EI) and compares them with the results.",
            },
            {
              level: "exemplary",
              description:
                "As proficient, and it states that doubling the span multiplies the mid-span deflection by 16, because the deflection varies with the fourth power of the span.",
            },
          ],
        },
      ],
    },
    referenceModel: referenceModel(),
  };
}
