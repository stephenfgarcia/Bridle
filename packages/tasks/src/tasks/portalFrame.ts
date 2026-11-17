/**
 * Task (b), "Portal frame under wind and gravity" (intermediate). The numbers of the brief, the
 * models and the rubric all come from the constants below.
 *
 * Why these numbers. With gravity and wind together, the horizontal reaction and the base moment at
 * the windward base A are each the difference of a gravity part and a wind part. Loads at which
 * either difference is close to zero would make that answer a small number that a 1 percent
 * tolerance cannot judge, so the gravity load is chosen large enough against the wind that both
 * stay well away from zero (about +16 kN and 15 kN·m at A).
 *
 * Closed-form values for a fixed-base portal whose members do not change length, with
 * k = (Ib/L)/(Ic/H) (Ib, Ic the beam's and the columns' second moments of area):
 *   gravity w on the beam:  thrust wL²/(4H(k+2)), base moments wL²/(12(k+2)), vertical wL/2 each;
 *   lateral P at the eaves: horizontal P/2 each, base moments PH(3k+1)/(2(6k+1)),
 *                           vertical ∓3PHk/(L(6k+1)), sway PH³(3k+2)/(12·E·Ic·(6k+1)).
 * The solver includes axial deformation, so its values for this frame differ from these by up to 1.7
 * percent (the base moment at A: 15.36 kN·m against 15.63 kN·m; the sway by 1.2 percent). The tests
 * compare the two within 2 percent, and within 1e-4 on a copy of the model whose areas are
 * multiplied by 1000, where the members hardly change length.
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
  RATIO_TOLERANCE,
  STEEL_E_TEXT,
  STEEL_ID,
  support,
} from "../parts";
import { genericSection, genericSectionDimensions } from "../sections";
import type { Task } from "../types";

/** Width between the column centre lines, m. */
export const PORTAL_WIDTH = 8;
/** Height from the bases to the beam's centre line, m. */
export const PORTAL_HEIGHT = 5;
/** Uniform gravity load on the beam, kN/m; a service value that includes self-weight. */
export const PORTAL_BEAM_LOAD = 30;
/** Horizontal wind force at the top of the left column, kN, along +X; a service value. */
export const PORTAL_WIND_LOAD = 20;
export const PORTAL_COLUMN_SECTION = "I 300x150";
export const PORTAL_BEAM_SECTION = "I 400x180";
/** The sway limit is the height divided by this. */
export const PORTAL_DRIFT_DIVISOR = 300;

function sections() {
  return [PORTAL_COLUMN_SECTION, PORTAL_BEAM_SECTION].flatMap((name) => {
    const dimensions = genericSectionDimensions(name);
    return dimensions === undefined ? [] : [genericSection(dimensions)];
  });
}

/**
 * The frame's nodes and members in the global X-Z plane: A (left base), B (left eaves), C (right
 * eaves), D (right base); columns A-B and D-C run upward, the beam B-C runs along +X. No supports
 * and no loads.
 */
function startingModel(): Model {
  return {
    ...emptyTaskModel(sections()),
    nodes: [
      { id: "A", x: 0, y: 0, z: 0 },
      { id: "B", x: 0, y: 0, z: PORTAL_HEIGHT },
      { id: "C", x: PORTAL_WIDTH, y: 0, z: PORTAL_HEIGHT },
      { id: "D", x: PORTAL_WIDTH, y: 0, z: 0 },
    ],
    members: [
      frameMember("AB", "A", "B", PORTAL_COLUMN_SECTION),
      frameMember("BC", "B", "C", PORTAL_BEAM_SECTION),
      frameMember("DC", "D", "C", PORTAL_COLUMN_SECTION),
    ],
  };
}

const ALL_SIX = ["ux", "uy", "uz", "rx", "ry", "rz"] as const;

/** The starting model with both bases fixed (all six restraints), the beam load and the wind force. */
function referenceModel(): Model {
  return {
    ...startingModel(),
    supports: [support("A", ALL_SIX), support("D", ALL_SIX)],
    nodalLoads: [
      {
        id: "wind-B",
        loadCaseId: LOAD_CASE_ID,
        nodeId: "B",
        fx: PORTAL_WIND_LOAD,
        fy: 0,
        fz: 0,
        mx: 0,
        my: 0,
        mz: 0,
      },
    ],
    memberUniformLoads: [gravityLoad("w-BC", "BC", PORTAL_BEAM_LOAD)],
  };
}

export function portalFrameTask(): Task {
  const L = plain(PORTAL_WIDTH);
  const H = plain(PORTAL_HEIGHT);
  const w = plain(PORTAL_BEAM_LOAD);
  const P = plain(PORTAL_WIND_LOAD);
  const total = plain(PORTAL_BEAM_LOAD * PORTAL_WIDTH);
  const limit = `${H} m / ${PORTAL_DRIFT_DIVISOR} = ${((PORTAL_HEIGHT / PORTAL_DRIFT_DIVISOR) * 1000).toFixed(1)} mm`;
  const E = STEEL_E_TEXT;
  return {
    id: "portal-frame-wind-gravity",
    title: "Portal frame under wind and gravity",
    level: "intermediate",
    brief: [
      `A single-bay steel portal frame is ${L} m wide and ${H} m high, in the global X-Z plane (Z is up). The columns A-B (left) and D-C (right) are the generic I-section ${PORTAL_COLUMN_SECTION} and the beam B-C is ${PORTAL_BEAM_SECTION}, all bending about their strong axes in the plane of the frame; the steel has a modulus of elasticity E = ${E} MPa. The beam is rigidly connected to the columns, and both column bases, A and D, are fixed.`,
      `The frame carries two loads at the same time, both service (unfactored) values, in the one load case ${LOAD_CASE_ID}: a uniformly distributed gravity load of ${w} kN/m on the beam, which includes the self-weight of the members (do not add self-weight), and a wind load represented by a horizontal force of ${P} kN at the top of the left column, node B, acting along +X.`,
      "The nodes and the three members are given and cannot be changed. Add the supports and the two loads. A fixed base holds all three translations and all three rotations of its node.",
      "Report the values listed below. Give the two horizontal reactions with their signs, positive along +X; give every other value as a magnitude.",
      `Requirement of this task: the sway of the frame, measured as the horizontal displacement of node B, must not exceed the column height divided by ${PORTAL_DRIFT_DIVISOR}. Judge the frame against this limit in your written answer.`,
    ],
    givens: [
      { label: "Width, A to D", value: `${L} m` },
      { label: "Height, bases to beam", value: `${H} m` },
      {
        label: "Columns A-B and D-C",
        value: `${PORTAL_COLUMN_SECTION}, strong axis in the plane of the frame`,
      },
      { label: "Beam B-C", value: `${PORTAL_BEAM_SECTION}, strong axis in the plane of the frame` },
      { label: "Modulus of elasticity, E", value: `${E} MPa` },
      { label: "Bases A and D", value: "fixed" },
      {
        label: "Gravity load on the beam (service value, self-weight included)",
        value: `${w} kN/m, downward`,
      },
      { label: "Wind force at node B (service value)", value: `${P} kN along +X` },
      { label: "Sway limit", value: `height / ${PORTAL_DRIFT_DIVISOR}` },
    ],
    learningOutcomes: [
      "Model fixed bases, and apply a member load and a nodal load in one load case.",
      "Read base reactions and base moments with their signs and check them by the equilibrium of the whole frame.",
      "Explain how gravity and lateral load combine at the two bases, and why the reactions at the two bases differ.",
      "Judge a sway against a stated drift limit and say which members control it.",
    ],
    startingModel: startingModel(),
    fixed: [
      { list: "nodes", id: "A" },
      { list: "nodes", id: "B" },
      { list: "nodes", id: "C" },
      { list: "nodes", id: "D" },
      { list: "members", id: "AB" },
      { list: "members", id: "BC" },
      { list: "members", id: "DC" },
      { list: "sections", id: PORTAL_COLUMN_SECTION },
      { list: "sections", id: PORTAL_BEAM_SECTION },
      { list: "materials", id: STEEL_ID },
      { list: "loadCases", id: LOAD_CASE_ID },
    ],
    loadCaseId: LOAD_CASE_ID,
    answers: [
      {
        id: "reaction-ax",
        prompt: "Horizontal reaction at base A (signed, positive along +X)",
        kind: "force",
        unit: "kN",
        signed: true,
        tolerance: FORCE_TOLERANCE,
        source: { kind: "reaction", nodeId: "A", component: "fx" },
      },
      {
        id: "reaction-dx",
        prompt: "Horizontal reaction at base D (signed, positive along +X)",
        kind: "force",
        unit: "kN",
        signed: true,
        tolerance: FORCE_TOLERANCE,
        source: { kind: "reaction", nodeId: "D", component: "fx" },
      },
      {
        id: "reaction-az",
        prompt: "Vertical reaction at base A (magnitude)",
        kind: "force",
        unit: "kN",
        signed: false,
        tolerance: FORCE_TOLERANCE,
        source: { kind: "reaction", nodeId: "A", component: "fz" },
      },
      {
        id: "reaction-dz",
        prompt: "Vertical reaction at base D (magnitude)",
        kind: "force",
        unit: "kN",
        signed: false,
        tolerance: FORCE_TOLERANCE,
        source: { kind: "reaction", nodeId: "D", component: "fz" },
      },
      {
        id: "moment-a",
        prompt: "Moment reaction at base A, about the axis normal to the frame (magnitude)",
        kind: "moment",
        unit: "kN·m",
        signed: false,
        tolerance: MOMENT_TOLERANCE,
        source: { kind: "reaction", nodeId: "A", component: "my" },
      },
      {
        id: "moment-d",
        prompt: "Moment reaction at base D, about the axis normal to the frame (magnitude)",
        kind: "moment",
        unit: "kN·m",
        signed: false,
        tolerance: MOMENT_TOLERANCE,
        source: { kind: "reaction", nodeId: "D", component: "my" },
      },
      {
        id: "sway-b",
        prompt: "Sway: horizontal displacement of node B (magnitude)",
        kind: "displacement",
        unit: "mm",
        signed: false,
        tolerance: DISPLACEMENT_TOLERANCE,
        source: { kind: "displacement", nodeId: "B", component: "ux" },
      },
      {
        id: "drift-ratio",
        prompt: `Sway at B divided by the sway limit (height / ${PORTAL_DRIFT_DIVISOR})`,
        kind: "ratio",
        unit: "-",
        signed: false,
        tolerance: RATIO_TOLERANCE,
        source: { kind: "limit-ratio", requirementId: "drift-limit" },
      },
    ],
    requirements: [
      {
        id: "drift-limit",
        statement: `The horizontal displacement of node B under the given loads must not exceed the column height divided by ${PORTAL_DRIFT_DIVISOR}: ${limit}.`,
        limit: {
          quantity: "drift",
          nodeId: "B",
          component: "ux",
          length: PORTAL_HEIGHT,
          divisor: PORTAL_DRIFT_DIVISOR,
        },
      },
    ],
    justification: {
      prompt:
        "In four to six sentences: state the sway at B and the limit in mm and whether the frame meets the limit; show your equilibrium check of the reactions; explain why the base moment at D is larger than the one at A; and say which single change would reduce the sway more, stiffer columns or a stiffer beam, and why.",
    },
    rubric: {
      criteria: [
        {
          id: "model-and-supports",
          name: "Model and supports",
          weight: 0.2,
          basis: ["model", "results"],
          levels: [
            {
              level: "not-shown",
              description: "No support is added, or the model is reported as unstable.",
            },
            {
              level: "developing",
              description:
                "The model solves, but a base is not fixed: at A or D one of the six restraints is missing (for example a pinned base, with the rotation about Y free), or node B or C is supported.",
            },
            {
              level: "proficient",
              description:
                "A and D each hold all three translations and all three rotations, and no other node is supported.",
            },
            {
              level: "exemplary",
              description:
                "As proficient, and the justification says what the fixed bases contribute: that the frame can have base moments only because the rotation about Y is held there.",
            },
          ],
        },
        {
          id: "loads",
          name: "Loads",
          weight: 0.2,
          basis: ["model"],
          levels: [
            { level: "not-shown", description: `No load is applied in ${LOAD_CASE_ID}.` },
            {
              level: "developing",
              description:
                "Only one of the two loads is applied, or a load differs from the brief in value, direction or position (for example the wind force along −X or on another node, or the beam load upward).",
            },
            {
              level: "proficient",
              description: `The beam B-C carries ${w} kN/m along global −Z and node B carries ${P} kN along +X, both in ${LOAD_CASE_ID}, and nothing else is loaded.`,
            },
            {
              level: "exemplary",
              description: `As proficient, and the justification shows the equilibrium check with numbers: the horizontal reactions sum to −${P} kN and the vertical reactions sum to ${total} kN.`,
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
              description: "No answers are given, or none of the eight is within its tolerance.",
            },
            {
              level: "developing",
              description: "One to five of the eight answers are within tolerance.",
            },
            {
              level: "proficient",
              description: "Six or seven of the eight answers are within tolerance.",
            },
            {
              level: "exemplary",
              description:
                "All eight answers are within tolerance, the two horizontal reactions with their signs.",
            },
          ],
        },
        {
          id: "drift-judgement",
          name: "Drift judgement and justification",
          weight: 0.3,
          basis: ["justification", "results"],
          levels: [
            {
              level: "not-shown",
              description: "No justification is written, or it gives no verdict on the sway limit.",
            },
            {
              level: "developing",
              description: `A verdict is given but the numbers do not support it: the sway or the limit (${limit}) is missing or wrong, or the verdict contradicts the numbers stated.`,
            },
            {
              level: "proficient",
              description:
                "The sway and the limit are both stated in mm, the verdict follows from them (the frame meets the limit), and an equilibrium check of the horizontal or the vertical reactions is shown.",
            },
            {
              level: "exemplary",
              description:
                "As proficient, and the justification explains that the base moments from wind and from gravity act in the same sense at D and in opposite senses at A, and argues from the frame's behaviour which members control the sway.",
            },
          ],
        },
      ],
    },
    referenceModel: referenceModel(),
  };
}
