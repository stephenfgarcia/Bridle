/**
 * The scenarios of the card's fourth acceptance criterion, for each of the three tasks, and the
 * determinism of the evidence. Each scenario is a complete submission; the tests state the evidence
 * it must give.
 */
import type { Model } from "@bridle/model";
import {
  chooseTheBeamTask,
  genericSection,
  portalFrameTask,
  seededTasks,
  simplySupportedBeamTask,
  type Task,
} from "@bridle/tasks";
import { describe, expect, test } from "vitest";
import { buildEvidence, withoutNegativeZero } from "./evidence";
import { nonFinitePaths } from "./range";
import { validateSubmission } from "./submission";
import { summarizeEvidence } from "./summary";
import {
  answerOf,
  computedValues,
  copy,
  redrawMember,
  referenceSubmission,
  referenceValuesOf,
  submissionOf,
  supportOn,
  verdictsOf,
} from "./testSupport";
import type { Evidence, Submission } from "./types";

const beam = simplySupportedBeamTask();
const portal = portalFrameTask();
const choice = chooseTheBeamTask();

/** Every submission a test of this file builds, for the tests of determinism at the end. */
const built: { task: Task; submission: Submission }[] = [];

function evidenceOf(task: Task, submission: Submission): Evidence {
  built.push({ task, submission: copy(submission) });
  return buildEvidence(task, submission);
}

/** The evidence of `model` submitted with the task's reference answers. */
function withReferenceAnswers(task: Task, model: Model): Evidence {
  return evidenceOf(task, submissionOf(task, model, referenceValuesOf(task)));
}

/** The evidence of `model` submitted with the answers read from that model itself. */
function withOwnAnswers(task: Task, model: Model): Evidence {
  return evidenceOf(task, submissionOf(task, model, computedValues(task, model)));
}

function all(task: Task, verdict: string): Record<string, string> {
  return Object.fromEntries(task.answers.map((answer) => [answer.id, verdict]));
}

/** The beam's reference model with one change. */
function beamWith(change: (model: Model) => void): Model {
  const model = copy(beam.referenceModel);
  change(model);
  return model;
}

function portalWith(change: (model: Model) => void): Model {
  const model = copy(portal.referenceModel);
  change(model);
  return model;
}

/** The chosen beam with one section on both members, and an optional further change. */
function choiceWith(sectionId: string, change: (model: Model) => void = () => {}): Model {
  const model = copy(choice.referenceModel);
  for (const member of model.members) {
    member.sectionId = sectionId;
  }
  change(model);
  return model;
}

const NO_DIFFERENCE = {
  submissionValid: true,
  justificationPresent: true,
  modelParses: true,
  modelValid: true,
  modelSolved: true,
  solveStatus: "solved",
  members: { missing: 0, different: 0, extra: 0, extraNodes: 0 },
  supports: { differing: 0, outOfPlaneDiffering: 0 },
  loads: { resultantAgrees: true, differing: 0, missing: 0, extra: 0 },
};

describe("the reference model with the reference answers", () => {
  test("task (a): no difference, four answers correct", () => {
    const evidence = evidenceOf(beam, referenceSubmission(beam));
    expect(summarizeEvidence(evidence)).toEqual({
      taskId: "simply-supported-beam",
      ...NO_DIFFERENCE,
      answers: {
        total: 4,
        correct: 4,
        consistentWithOwnModel: 0,
        incorrect: 0,
        missing: 0,
        pending: 0,
      },
      fixedParts: { checked: 6, missing: 0, changed: 0 },
      requirements: { total: 0, satisfied: 0, notSatisfied: 0, notComputed: 0 },
      requirementsMet: null,
      sectionChoice: null,
    });
    // The reference values are the closed-form ones: wL/2, wL²/8, 5wL⁴/(384·E·Iy).
    const iy = beam.referenceModel.sections[0]?.Iy ?? 0;
    expect(answerOf(evidence, "reaction-a").reference).toBeCloseTo(45, 9);
    expect(answerOf(evidence, "reaction-b").reference).toBeCloseTo(45, 9);
    expect(answerOf(evidence, "max-moment").reference).toBeCloseTo(67.5, 9);
    expect(answerOf(evidence, "midspan-deflection").reference).toBeCloseTo(
      ((5 * 15 * 6 ** 4) / (384 * 2.1e8 * iy)) * 1000,
      8,
    );
    for (const answer of evidence.answers) {
      expect(answer).toMatchObject({
        referenceStatus: "computed",
        referenceBasis: "reference-model",
        referenceDifference: 0,
        ownModelStatus: "computed",
        ownModelDifference: 0,
        signError: false,
      });
      expect(answer.ownModel).toBe(answer.reference);
      expect(answer.typed).toBe(answer.reference);
    }
    expect(evidence.fixedParts).toEqual({ checked: 6, differences: [] });
    expect(evidence.sectionChoice).toBeNull();
    expect(evidence.requirements).toEqual([]);
  });

  test("task (b): no difference, eight answers correct, the drift limit met", () => {
    const evidence = evidenceOf(portal, referenceSubmission(portal));
    expect(summarizeEvidence(evidence)).toEqual({
      taskId: "portal-frame-wind-gravity",
      ...NO_DIFFERENCE,
      answers: {
        total: 8,
        correct: 8,
        consistentWithOwnModel: 0,
        incorrect: 0,
        missing: 0,
        pending: 0,
      },
      fixedParts: { checked: 11, missing: 0, changed: 0 },
      requirements: { total: 1, satisfied: 1, notSatisfied: 0, notComputed: 0 },
      requirementsMet: true,
      sectionChoice: null,
    });
    // Equilibrium of the whole frame: the horizontal reactions balance the wind, the vertical ones the beam load.
    const value = (id: string) => answerOf(evidence, id).reference ?? Number.NaN;
    expect(value("reaction-ax") + value("reaction-dx")).toBeCloseTo(-20, 9);
    expect(value("reaction-az") + value("reaction-dz")).toBeCloseTo(240, 9);
    expect(value("reaction-ax")).toBeGreaterThan(0);
    expect(value("reaction-dx")).toBeLessThan(0);
    expect(value("drift-ratio")).toBeCloseTo(value("sway-b") / (5000 / 300), 12);
  });

  test("task (c): no difference, three answers correct and the stress pending", () => {
    const submission = referenceSubmission(choice);
    submission.answers["max-bending-stress"] = 150;
    const evidence = evidenceOf(choice, submission);
    expect(summarizeEvidence(evidence)).toEqual({
      taskId: "choose-the-beam",
      ...NO_DIFFERENCE,
      answers: {
        total: 4,
        correct: 3,
        consistentWithOwnModel: 0,
        incorrect: 0,
        missing: 0,
        pending: 1,
      },
      fixedParts: { checked: 17, missing: 0, changed: 0 },
      requirements: { total: 1, satisfied: 1, notSatisfied: 0, notComputed: 0 },
      requirementsMet: true,
      sectionChoice: {
        status: "chosen",
        chosenSectionId: "I 400x180",
        allowed: true,
        meetsRequirements: true,
        lighterAllowedSectionMeets: false,
      },
    });
    expect(verdictsOf(evidence)).toEqual({
      "max-moment": "correct",
      "midspan-deflection": "correct",
      "deflection-ratio": "correct",
      "max-bending-stress": "pending",
    });
    expect(answerOf(evidence, "max-bending-stress")).toEqual({
      answerId: "max-bending-stress",
      kind: "stress",
      unit: "MPa",
      signed: false,
      tolerance: { relative: 0.01, absolute: 0.5 },
      typed: 150,
      referenceStatus: "pending",
      referenceBasis: "none",
      reference: null,
      referenceAllowance: null,
      referenceDifference: null,
      ownModelStatus: "pending",
      ownModelLocation: null,
      ownModel: null,
      ownModelAllowance: null,
      ownModelDifference: null,
      signError: false,
      verdict: "pending",
    });
    expect(answerOf(evidence, "max-moment").reference).toBeCloseTo((25 * 7 ** 2) / 8, 9);
    expect(answerOf(evidence, "max-moment").referenceBasis).toBe(
      "reference-model-with-chosen-section",
    );
  });
});

describe("supports", () => {
  test("(b) a pinned base where the task asks for a fixed one", () => {
    const model = portalWith((m) => {
      m.supports[0] = supportOn("A", ["ux", "uy", "uz"]);
    });
    const evidence = withOwnAnswers(portal, model);
    expect(evidence.model.solve).toBe("solved");
    expect(evidence.supports?.nodes).toEqual([
      {
        referenceNodeId: "A",
        learnerNodeId: "A",
        reference: { ux: true, uy: true, uz: true, rx: true, ry: true, rz: true },
        learner: { ux: true, uy: true, uz: true, rx: false, ry: false, rz: false },
        agrees: false,
        differing: ["ry"],
        outOfPlaneAgrees: false,
        outOfPlaneDiffering: ["rx", "rz"],
      },
      {
        referenceNodeId: "D",
        learnerNodeId: "D",
        reference: { ux: true, uy: true, uz: true, rx: true, ry: true, rz: true },
        learner: { ux: true, uy: true, uz: true, rx: true, ry: true, rz: true },
        agrees: true,
        differing: [],
        outOfPlaneAgrees: true,
        outOfPlaneDiffering: [],
      },
    ]);
    expect(summarizeEvidence(evidence).supports).toEqual({ differing: 1, outOfPlaneDiffering: 1 });
    // A pin carries no moment: the learner's own base moment at A is zero.
    expect(answerOf(evidence, "moment-a")).toMatchObject({
      typed: 0,
      ownModel: 0,
      ownModelDifference: 0,
      verdict: "consistent-with-own-model",
    });
    expect(answerOf(evidence, "moment-a").referenceDifference).toBeCloseTo(15.3628, 4);
    // The answers were typed from the pinned model. The two vertical reactions move by 0.8 kN,
    // which is inside 1 percent of about 114 and 126 kN; the six others are outside.
    expect(verdictsOf(evidence)).toEqual({
      "reaction-ax": "consistent-with-own-model",
      "reaction-dx": "consistent-with-own-model",
      "reaction-az": "correct",
      "reaction-dz": "correct",
      "moment-a": "consistent-with-own-model",
      "moment-d": "consistent-with-own-model",
      "sway-b": "consistent-with-own-model",
      "drift-ratio": "consistent-with-own-model",
    });
    const az = answerOf(evidence, "reaction-az");
    expect(az.referenceDifference).toBeCloseTo(0.8011, 4);
    expect(az.referenceAllowance).toBeCloseTo(1.143, 3);
    // The pinned frame is still in equilibrium with the same loads.
    const own = (id: string) => answerOf(evidence, id).ownModel ?? Number.NaN;
    expect(own("reaction-ax") + own("reaction-dx")).toBeCloseTo(-20, 9);
    expect(own("reaction-az") + own("reaction-dz")).toBeCloseTo(240, 9);
  });

  test("(a) out-of-plane restraints added: the support conditions agree and the answers are the same", () => {
    const model = beamWith((m) => {
      m.supports = [
        supportOn("A", ["ux", "uy", "uz", "rx", "rz"]),
        supportOn("B", ["uy", "uz", "rx"]),
      ];
    });
    const evidence = withReferenceAnswers(beam, model);
    expect(evidence.supports?.nodes.map((node) => [node.agrees, node.outOfPlaneDiffering])).toEqual(
      [
        [true, ["rz"]],
        [true, ["rx"]],
      ],
    );
    expect(summarizeEvidence(evidence)).toMatchObject({
      modelSolved: true,
      supports: { differing: 0, outOfPlaneDiffering: 2 },
      answers: { correct: 4 },
    });
    for (const answer of evidence.answers) {
      expect(answer.ownModel).toBeCloseTo(answer.reference ?? Number.NaN, 9);
    }
  });

  test("(a) out-of-plane restraints left out: the support conditions agree and the model is unstable", () => {
    const model = beamWith((m) => {
      m.supports = [supportOn("A", ["ux", "uz"]), supportOn("B", ["uz"])];
    });
    const evidence = withReferenceAnswers(beam, model);
    expect(evidence.supports?.nodes.map((node) => [node.agrees, node.outOfPlaneDiffering])).toEqual(
      [
        [true, ["uy", "rx"]],
        [true, ["uy"]],
      ],
    );
    expect(evidence.model.solve).toBe("unstable");
    expect(summarizeEvidence(evidence)).toMatchObject({
      modelSolved: false,
      solveStatus: "unstable",
      supports: { differing: 0, outOfPlaneDiffering: 2 },
    });
  });

  test("(b) out-of-plane restraints left out at one base: in-plane results unchanged", () => {
    const model = portalWith((m) => {
      m.supports[1] = supportOn("D", ["ux", "uy", "uz", "ry"]);
    });
    const evidence = withReferenceAnswers(portal, model);
    expect(evidence.supports?.nodes.map((node) => [node.agrees, node.outOfPlaneDiffering])).toEqual(
      [
        [true, []],
        [true, ["rx", "rz"]],
      ],
    );
    expect(verdictsOf(evidence)).toEqual(all(portal, "correct"));
    for (const answer of evidence.answers) {
      expect(answer.ownModel).toBeCloseTo(answer.reference ?? Number.NaN, 9);
    }
  });

  test("(c) a support held in a further direction is a changed fixed part and a support difference", () => {
    const model = choiceWith("I 400x180", (m) => {
      m.supports[1] = supportOn("B", ["ux", "uy", "uz"]);
    });
    const evidence = withReferenceAnswers(choice, model);
    expect(evidence.fixedParts?.differences).toEqual([
      {
        list: "supports",
        id: "B",
        status: "changed",
        counterpartId: null,
        changedFields: [{ field: "ux", expected: false, actual: true }],
      },
    ]);
    expect(evidence.supports?.nodes[1]).toMatchObject({ agrees: false, differing: ["ux"] });
  });
});

describe("loads", () => {
  test("(a) a missing load: nothing is applied", () => {
    const evidence = withReferenceAnswers(
      beam,
      beamWith((m) => {
        m.memberUniformLoads = [];
      }),
    );
    expect(evidence.loads?.resultant).toEqual({
      reference: { fx: 0, fy: 0, fz: -90, mx: 0, my: 270, mz: 0 },
      learner: { fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 },
      forceDifference: 90,
      forceAllowance: 0.9,
      momentDifference: 270,
      momentAllowance: 2.7,
      agrees: false,
    });
    expect(
      evidence.loads?.comparisons.map((item) => [item.referenceTargetId, item.status]),
    ).toEqual([
      ["AC", "missing"],
      ["CB", "missing"],
    ]);
    expect(summarizeEvidence(evidence).loads).toEqual({
      resultantAgrees: false,
      differing: 0,
      missing: 2,
      extra: 0,
    });
    // The typed answers are the reference's: correct. The unloaded model's results are all zero
    // whatever the model is, so they are not offered as own-model values.
    expect(verdictsOf(evidence)).toEqual(all(beam, "correct"));
    for (const answer of evidence.answers) {
      expect(answer).toMatchObject({
        ownModelStatus: "no-loads",
        ownModelLocation: null,
        ownModel: null,
        ownModelAllowance: null,
        ownModelDifference: null,
      });
    }
  });

  test("(b) a missing load: the wind is left out", () => {
    const evidence = withOwnAnswers(
      portal,
      portalWith((m) => {
        m.nodalLoads = [];
      }),
    );
    expect(
      evidence.loads?.comparisons.map((item) => [item.kind, item.referenceTargetId, item.status]),
    ).toEqual([
      ["nodal", "B", "missing"],
      ["member-uniform", "BC", "agrees"],
    ]);
    expect(evidence.loads?.resultant).toMatchObject({
      forceDifference: 20,
      momentDifference: 100,
      agrees: false,
    });
    // Without wind the frame and its load are symmetric: the two bases mirror each other, and node
    // B moves only by half the shortening of the beam under the thrust H: H · (L/2) / (E·A).
    const own = (id: string) => answerOf(evidence, id).ownModel ?? Number.NaN;
    const beamArea = portal.referenceModel.sections.find((s) => s.id === "I 400x180")?.A ?? 0;
    expect(own("reaction-ax")).toBeGreaterThan(0);
    expect(own("sway-b")).toBeCloseTo(((own("reaction-ax") * 4) / (2.1e8 * beamArea)) * 1000, 9);
    expect(own("sway-b")).toBeLessThan(0.1);
    expect(own("reaction-ax")).toBeCloseTo(-own("reaction-dx"), 9);
    expect(own("reaction-az")).toBeCloseTo(120, 9);
    expect(own("moment-a")).toBeCloseTo(own("moment-d"), 9);
    expect(verdictsOf(evidence)).toEqual(all(portal, "consistent-with-own-model"));
  });

  test("(a) a load of the wrong size, answers typed from the learner's own model", () => {
    const model = beamWith((m) => {
      for (const load of m.memberUniformLoads) {
        load.value = -12;
      }
    });
    const evidence = withOwnAnswers(beam, model);
    expect(
      evidence.loads?.comparisons.map((item) => [
        item.status,
        item.forceDifference,
        item.forceAllowance,
      ]),
    ).toEqual([
      ["differs", 3, 0.15],
      ["differs", 3, 0.15],
    ]);
    expect(evidence.loads?.resultant).toMatchObject({
      learner: { fx: 0, fy: 0, fz: -72, mx: 0, my: 216, mz: 0 },
      forceDifference: 18,
      momentDifference: 54,
      agrees: false,
    });
    expect(verdictsOf(evidence)).toEqual(all(beam, "consistent-with-own-model"));
    // 12 kN/m in place of 15: every result is 0.8 of the reference's.
    for (const answer of evidence.answers) {
      expect(answer.ownModel).toBeCloseTo(0.8 * (answer.reference ?? Number.NaN), 9);
      expect(answer.typed).toBe(answer.ownModel);
      expect(answer.ownModelDifference).toBe(0);
      expect(answer.referenceDifference).toBeCloseTo(0.2 * (answer.reference ?? Number.NaN), 9);
    }
    expect(answerOf(evidence, "reaction-a").typed).toBeCloseTo(36, 9);
    expect(answerOf(evidence, "reaction-a").reference).toBeCloseTo(45, 9);
    // The same model with the reference's answers typed: correct, and the own-model value says
    // that they were not read from this model.
    const copied = withReferenceAnswers(beam, model);
    expect(verdictsOf(copied)).toEqual(all(beam, "correct"));
    expect(answerOf(copied, "reaction-a").ownModel).toBeCloseTo(36, 9);
    expect(answerOf(copied, "reaction-a").ownModelDifference).toBeCloseTo(9, 9);
    expect(answerOf(copied, "reaction-a").ownModelAllowance).toBeCloseTo(0.36, 9);
  });

  test("(b) a load of the wrong size: 25 kN/m on the beam", () => {
    const evidence = withOwnAnswers(
      portal,
      portalWith((m) => {
        (m.memberUniformLoads[0] as { value: number }).value = -25;
      }),
    );
    expect(evidence.loads?.comparisons.map((item) => [item.status, item.forceDifference])).toEqual([
      ["agrees", 0],
      ["differs", 5],
    ]);
    expect(summarizeEvidence(evidence).loads).toEqual({
      resultantAgrees: false,
      differing: 1,
      missing: 0,
      extra: 0,
    });
    const own = (id: string) => answerOf(evidence, id).ownModel ?? Number.NaN;
    expect(own("reaction-az") + own("reaction-dz")).toBeCloseTo(200, 9);
    // The sway comes from the wind alone (the frame is symmetric), so it is the reference's.
    expect(answerOf(evidence, "sway-b").verdict).toBe("correct");
    expect(answerOf(evidence, "reaction-az").verdict).toBe("consistent-with-own-model");
  });

  test("(a) a load on the wrong member: both loads on A-C", () => {
    const model = beamWith((m) => {
      (m.memberUniformLoads[1] as { memberId: string }).memberId = "AC";
    });
    const evidence = withOwnAnswers(beam, model);
    expect(evidence.loads?.comparisons).toMatchObject([
      {
        referenceTargetId: "AC",
        learnerLoadIds: ["w-AC", "w-CB"],
        forceDifference: 15,
        status: "differs",
      },
      { referenceTargetId: "CB", learnerLoadIds: [], status: "missing" },
    ]);
    expect(evidence.loads?.resultant).toMatchObject({
      forceDifference: 0,
      momentDifference: 135,
      agrees: false,
    });
    // 90 kN at x = 1.5 m on a 6 m span: 67.5 kN at A, 22.5 kN at B, and 22.5 × 3 = 67.5 kN·m at C.
    expect(answerOf(evidence, "reaction-a").ownModel).toBeCloseTo(67.5, 9);
    expect(answerOf(evidence, "reaction-b").ownModel).toBeCloseTo(22.5, 9);
    expect(answerOf(evidence, "max-moment").ownModel).toBeCloseTo(67.5, 9);
    // The moment at C equals the reference's wL²/8, and so does the mid-span deflection: a load
    // on the left half deflects the middle half as much as the same load per metre on the whole
    // span, and here it is doubled. Those two answers cannot tell this model from the reference;
    // the reactions and the load comparison do.
    const deflection = answerOf(evidence, "midspan-deflection");
    expect(deflection.ownModel).toBeCloseTo(deflection.reference ?? Number.NaN, 9);
    expect(verdictsOf(evidence)).toEqual({
      "reaction-a": "consistent-with-own-model",
      "reaction-b": "consistent-with-own-model",
      "max-moment": "correct",
      "midspan-deflection": "correct",
    });
  });

  test("(b) a load on the wrong node: the wind on C", () => {
    const model = portalWith((m) => {
      (m.nodalLoads[0] as { nodeId: string }).nodeId = "C";
    });
    const evidence = withReferenceAnswers(portal, model);
    // The force slides along its line of action, so the resultant is unchanged; the per-load
    // comparison is what shows the difference.
    expect(evidence.loads?.resultant.agrees).toBe(true);
    expect(evidence.loads?.comparisons[0]).toMatchObject({
      kind: "nodal",
      referenceTargetId: "B",
      learnerTargetId: "B",
      learnerLoadIds: [],
      status: "missing",
    });
    expect(evidence.loads?.extra).toEqual([
      { kind: "nodal", loadId: "wind-B", learnerTargetId: "C", referenceTargetId: "C" },
    ]);
    expect(summarizeEvidence(evidence).loads).toEqual({
      resultantAgrees: true,
      differing: 0,
      missing: 1,
      extra: 1,
    });
    // The results move by the shortening of the beam only: under 1 percent, so answers typed from
    // either model are correct; the own-model values are not the reference's.
    expect(verdictsOf(evidence)).toEqual(all(portal, "correct"));
    const sway = answerOf(evidence, "sway-b");
    expect(sway.ownModel).not.toBe(sway.reference);
    expect(sway.ownModelDifference).toBeLessThan(sway.ownModelAllowance ?? 0);
    expect(verdictsOf(withOwnAnswers(portal, model))).toEqual(all(portal, "correct"));
  });

  test("(c) a changed load is a changed fixed part and a load difference", () => {
    const model = choiceWith("I 400x180", (m) => {
      (m.memberUniformLoads[0] as { value: number }).value = -20;
    });
    const evidence = withOwnAnswers(choice, model);
    expect(evidence.fixedParts?.differences).toEqual([
      {
        list: "memberUniformLoads",
        id: "w-AC",
        status: "changed",
        counterpartId: null,
        changedFields: [{ field: "value", expected: -25, actual: -20 }],
      },
    ]);
    expect(evidence.loads?.comparisons.map((item) => item.status)).toEqual(["differs", "agrees"]);
    expect(answerOf(evidence, "max-moment").verdict).toBe("consistent-with-own-model");
  });
});

describe("typed answers", () => {
  test("(a) an answer 5 percent off", () => {
    const answers = referenceValuesOf(beam);
    answers["reaction-a"] = 45 * 1.05;
    answers["midspan-deflection"] = (answers["midspan-deflection"] ?? 0) * 0.95;
    const evidence = evidenceOf(beam, submissionOf(beam, copy(beam.referenceModel), answers));
    expect(verdictsOf(evidence)).toEqual({
      "reaction-a": "incorrect",
      "reaction-b": "correct",
      "max-moment": "correct",
      "midspan-deflection": "incorrect",
    });
    const reaction = answerOf(evidence, "reaction-a");
    expect(reaction).toMatchObject({ typed: 47.25, reference: 45, ownModel: 45, signError: false });
    expect(reaction.referenceAllowance).toBeCloseTo(0.45, 12);
    expect(reaction.referenceDifference).toBeCloseTo(2.25, 12);
    expect(reaction.ownModelDifference).toBeCloseTo(2.25, 12);
    const deflection = answerOf(evidence, "midspan-deflection");
    // 5 percent against a tolerance of 2 percent.
    expect((deflection.referenceDifference ?? 0) / (deflection.reference ?? 1)).toBeCloseTo(
      0.05,
      12,
    );
    expect((deflection.referenceAllowance ?? 0) / (deflection.reference ?? 1)).toBeCloseTo(
      0.02,
      12,
    );
    expect(summarizeEvidence(evidence).answers).toEqual({
      total: 4,
      correct: 2,
      consistentWithOwnModel: 0,
      incorrect: 2,
      missing: 0,
      pending: 0,
    });
  });

  test("(b) an answer 5 percent off, and one rounded as a learner would type it", () => {
    const answers = referenceValuesOf(portal);
    answers["moment-d"] = (answers["moment-d"] ?? 0) * 1.05;
    answers["sway-b"] = 7.8; // the reference is 7.783 mm
    answers["reaction-ax"] = 15.6; // the reference is 15.609 kN
    const evidence = evidenceOf(portal, submissionOf(portal, copy(portal.referenceModel), answers));
    expect(verdictsOf(evidence)).toEqual({ ...all(portal, "correct"), "moment-d": "incorrect" });
  });

  test("(c) an answer 5 percent off is judged against the chosen section's value", () => {
    const model = choiceWith("I 450x190");
    const answers = computedValues(choice, model);
    answers["deflection-ratio"] = (answers["deflection-ratio"] ?? 0) * 1.05;
    const evidence = evidenceOf(choice, submissionOf(choice, model, answers));
    expect(verdictsOf(evidence)).toEqual({
      "max-moment": "correct",
      "midspan-deflection": "correct",
      "deflection-ratio": "incorrect",
      "max-bending-stress": "missing",
    });
  });

  test("(b) a sign error on a signed answer", () => {
    const answers = referenceValuesOf(portal);
    answers["reaction-ax"] = -(answers["reaction-ax"] ?? 0);
    answers["reaction-dx"] = -(answers["reaction-dx"] ?? 0);
    answers["reaction-az"] = -(answers["reaction-az"] ?? 0); // unsigned: the sign is not compared
    const evidence = evidenceOf(portal, submissionOf(portal, copy(portal.referenceModel), answers));
    expect(verdictsOf(evidence)).toEqual({
      ...all(portal, "correct"),
      "reaction-ax": "incorrect",
      "reaction-dx": "incorrect",
    });
    const ax = answerOf(evidence, "reaction-ax");
    expect(ax.signed).toBe(true);
    expect(ax.signError).toBe(true);
    expect(ax.typed).toBe(-(ax.reference ?? 0));
    expect(ax.referenceDifference).toBeCloseTo(2 * 15.6094, 3);
    expect(answerOf(evidence, "reaction-dx").signError).toBe(true);
    expect(answerOf(evidence, "reaction-az")).toMatchObject({
      signed: false,
      referenceDifference: 0,
      signError: false,
      verdict: "correct",
    });
  });

  test("(a) a magnitude typed with a minus sign is not an error", () => {
    const answers = referenceValuesOf(beam);
    answers["midspan-deflection"] = -(answers["midspan-deflection"] ?? 0);
    const evidence = evidenceOf(beam, submissionOf(beam, copy(beam.referenceModel), answers));
    expect(verdictsOf(evidence)).toEqual(all(beam, "correct"));
  });

  test("an answer left out, in each task: absent, null or not a finite number", () => {
    const a = referenceValuesOf(beam);
    delete a["max-moment"];
    a["reaction-b"] = null as never;
    const ofBeam = evidenceOf(beam, submissionOf(beam, copy(beam.referenceModel), a));
    expect(verdictsOf(ofBeam)).toEqual({
      "reaction-a": "correct",
      "reaction-b": "missing",
      "max-moment": "missing",
      "midspan-deflection": "correct",
    });
    expect(answerOf(ofBeam, "max-moment")).toMatchObject({
      typed: null,
      referenceDifference: null,
      ownModelDifference: null,
      ownModelStatus: "computed",
    });
    expect(answerOf(ofBeam, "max-moment").reference).toBeCloseTo(67.5, 9);

    const ofPortal = evidenceOf(portal, submissionOf(portal, copy(portal.referenceModel), {}));
    expect(verdictsOf(ofPortal)).toEqual(all(portal, "missing"));
    expect(summarizeEvidence(ofPortal).answers).toMatchObject({ total: 8, missing: 8, correct: 0 });

    const c = referenceValuesOf(choice);
    c["midspan-deflection"] = Number.NaN;
    const ofChoice = evidenceOf(choice, submissionOf(choice, copy(choice.referenceModel), c));
    expect(verdictsOf(ofChoice)).toEqual({
      "max-moment": "correct",
      "midspan-deflection": "missing",
      "deflection-ratio": "correct",
      "max-bending-stress": "missing",
    });
    expect(ofChoice.submission.issues).toEqual([
      {
        code: "non-finite-answer",
        ids: ["midspan-deflection"],
        path: "answers.midspan-deflection",
      },
    ]);
  });

  test("(c) answers typed for the reference section while another section is chosen", () => {
    const model = choiceWith("I 500x200");
    const evidence = evidenceOf(choice, submissionOf(choice, model, referenceValuesOf(choice)));
    // The moment does not depend on the section; the deflection and its ratio do.
    expect(verdictsOf(evidence)).toEqual({
      "max-moment": "correct",
      "midspan-deflection": "incorrect",
      "deflection-ratio": "incorrect",
      "max-bending-stress": "missing",
    });
    const deflection = answerOf(evidence, "midspan-deflection");
    expect(deflection.typed).toBeCloseTo(16.437, 3);
    expect(deflection.reference).toBeCloseTo(8.084, 3);
    expect(deflection.ownModel).toBe(deflection.reference);
  });
});

describe("the model", () => {
  test("(a) an unstable model: no twist restraint", () => {
    const evidence = withReferenceAnswers(
      beam,
      beamWith((m) => {
        m.supports = [supportOn("A", ["ux", "uy", "uz"]), supportOn("B", ["uy", "uz"])];
      }),
    );
    expect(evidence.model).toEqual({
      parses: true,
      parseIssues: [],
      valid: true,
      issues: [],
      solve: "unstable",
      unstable: { nodeId: "C", dof: "rx", remaining: 1, referenceNodeId: "C" },
      unsupported: [],
      hasLoadCase: true,
    });
    expect(evidence.supports?.nodes[0]).toMatchObject({
      agrees: true,
      outOfPlaneDiffering: ["rx"],
    });
    for (const answer of evidence.answers) {
      expect(answer).toMatchObject({
        ownModelStatus: "not-solved",
        ownModel: null,
        ownModelDifference: null,
        verdict: "correct",
      });
    }
    // An answer that is not the reference's has no own-model value to be consistent with.
    const answers = referenceValuesOf(beam);
    answers["reaction-a"] = 36;
    const model = beamWith((m) => {
      m.supports = [supportOn("A", ["ux", "uy", "uz"]), supportOn("B", ["uy", "uz"])];
    });
    expect(
      answerOf(evidenceOf(beam, submissionOf(beam, model, answers)), "reaction-a").verdict,
    ).toBe("incorrect");
    expect(summarizeEvidence(evidence)).toMatchObject({
      modelValid: true,
      modelSolved: false,
      solveStatus: "unstable",
    });
  });

  test("(b) an unstable model: two pinned bases let the frame fall out of its plane", () => {
    const evidence = withReferenceAnswers(
      portal,
      portalWith((m) => {
        m.supports = [supportOn("A", ["ux", "uy", "uz"]), supportOn("D", ["ux", "uy", "uz"])];
      }),
    );
    expect(evidence.model.solve).toBe("unstable");
    expect(evidence.model.unstable).toEqual({
      nodeId: "B",
      dof: "uy",
      remaining: 1,
      referenceNodeId: "B",
    });
    expect(evidence.requirements).toEqual([
      {
        requirementId: "drift-limit",
        quantity: "drift",
        referenceNodeId: "B",
        learnerNodeId: "B",
        component: "ux",
        status: "not-solved",
        unit: "mm",
        value: null,
        allowable: (5 / 300) * 1000,
        ratio: null,
        satisfied: null,
      },
    ]);
    expect(summarizeEvidence(evidence)).toMatchObject({
      requirements: { total: 1, satisfied: 0, notSatisfied: 0, notComputed: 1 },
      requirementsMet: null,
      supports: { differing: 2, outOfPlaneDiffering: 2 },
    });
    expect(answerOf(evidence, "drift-ratio").ownModelStatus).toBe("not-solved");
  });

  test("(c) an unstable model: a support removed, which is also a missing fixed part", () => {
    const evidence = withReferenceAnswers(
      choice,
      choiceWith("I 400x180", (m) => {
        m.supports = m.supports.slice(1);
      }),
    );
    expect(evidence.model.solve).toBe("unstable");
    expect(evidence.fixedParts?.differences).toEqual([
      { list: "supports", id: "A", status: "missing", counterpartId: null, changedFields: [] },
    ]);
    expect(evidence.supports?.nodes[0]).toMatchObject({
      referenceNodeId: "A",
      learner: null,
      agrees: false,
      differing: ["ux", "uz"],
      outOfPlaneDiffering: ["uy", "rx"],
    });
  });

  test("no support at all: the model is not valid", () => {
    const evidence = withReferenceAnswers(beam, copy(beam.startingModel));
    expect(evidence.model).toMatchObject({
      valid: false,
      issues: [{ code: "no-support", ids: [], path: null }],
      solve: "invalid-model",
    });
    expect(evidence.matching?.members.map((member) => member.learnerMemberId)).toEqual([
      null,
      null,
    ]);
    expect(summarizeEvidence(evidence)).toMatchObject({
      modelValid: false,
      modelSolved: false,
      members: { missing: 2, different: 0, extra: 0, extraNodes: 0 },
      supports: { differing: 2, outOfPlaneDiffering: 2 },
      loads: { resultantAgrees: false, differing: 0, missing: 2, extra: 0 },
    });
  });

  test("(a) a changed fixed part: node C moved", () => {
    const evidence = withReferenceAnswers(
      beam,
      beamWith((m) => {
        (m.nodes[1] as { x: number }).x = 2.5;
      }),
    );
    expect(evidence.fixedParts).toEqual({
      checked: 6,
      differences: [
        {
          list: "nodes",
          id: "C",
          status: "changed",
          counterpartId: null,
          changedFields: [{ field: "x", expected: 3, actual: 2.5 }],
        },
      ],
    });
    // Nothing of the learner is at the reference's C any more, so what is read there is not found.
    expect(evidence.matching).toMatchObject({
      nodes: [
        { referenceNodeId: "A", learnerNodeId: "A" },
        { referenceNodeId: "C", learnerNodeId: null },
        { referenceNodeId: "B", learnerNodeId: "B" },
      ],
      extraNodeIds: ["C"],
      extraMemberIds: ["AC", "CB"],
    });
    expect(evidence.answers.map((answer) => [answer.answerId, answer.ownModelStatus])).toEqual([
      ["reaction-a", "computed"],
      ["reaction-b", "computed"],
      ["max-moment", "node-not-found"],
      ["midspan-deflection", "node-not-found"],
    ]);
    expect(summarizeEvidence(evidence)).toMatchObject({
      fixedParts: { checked: 6, missing: 0, changed: 1 },
      members: { missing: 2, different: 0, extra: 2, extraNodes: 1 },
    });
  });

  test("(a) a changed fixed part: a property of the section", () => {
    const model = beamWith((m) => {
      (m.sections[0] as { Iy: number }).Iy = 1e-4;
    });
    const evidence = withOwnAnswers(beam, model);
    expect(evidence.fixedParts?.differences).toEqual([
      {
        list: "sections",
        id: "I 300x150",
        status: "changed",
        counterpartId: null,
        changedFields: [
          { field: "Iy", expected: beam.referenceModel.sections[0]?.Iy, actual: 1e-4 },
        ],
      },
    ]);
    // A stiffer section changes the deflection and nothing else of a statically determinate beam.
    expect(verdictsOf(evidence)).toEqual({
      "reaction-a": "correct",
      "reaction-b": "correct",
      "max-moment": "correct",
      "midspan-deflection": "consistent-with-own-model",
    });
    const deflection = answerOf(evidence, "midspan-deflection");
    expect((deflection.ownModel ?? 0) / (deflection.reference ?? 1)).toBeCloseTo(
      (beam.referenceModel.sections[0]?.Iy ?? 0) / 1e-4,
      9,
    );
  });

  test("(b) a changed fixed part: the beam's section", () => {
    const model = portalWith((m) => {
      (m.members[1] as { sectionId: string }).sectionId = "I 300x150";
    });
    const evidence = withOwnAnswers(portal, model);
    expect(evidence.fixedParts?.differences).toEqual([
      {
        list: "members",
        id: "BC",
        status: "changed",
        counterpartId: null,
        changedFields: [{ field: "sectionId", expected: "I 400x180", actual: "I 300x150" }],
      },
    ]);
    expect(evidence.matching?.members[1]).toMatchObject({
      referenceMemberId: "BC",
      learnerSectionId: "I 300x150",
      differences: ["sectionId"],
    });
    expect(summarizeEvidence(evidence)).toMatchObject({
      fixedParts: { checked: 11, missing: 0, changed: 1 },
      members: { missing: 0, different: 1, extra: 0, extraNodes: 0 },
    });
    expect(answerOf(evidence, "sway-b").verdict).toBe("consistent-with-own-model");
  });

  test("(a) members drawn with other ids and in the other direction", () => {
    let model = redrawMember(beam.referenceModel, "AC", "beam-left", true);
    model = redrawMember(model, "CB", "7", true);
    model.members.reverse();
    const evidence = withReferenceAnswers(beam, model);
    expect(evidence.matching?.members).toEqual([
      {
        referenceMemberId: "AC",
        learnerMemberId: "beam-left",
        reversed: true,
        referenceSectionId: "I 300x150",
        learnerSectionId: "I 300x150",
        differences: [],
      },
      {
        referenceMemberId: "CB",
        learnerMemberId: "7",
        reversed: true,
        referenceSectionId: "I 300x150",
        learnerSectionId: "I 300x150",
        differences: [],
      },
    ]);
    expect(summarizeEvidence(evidence)).toEqual({
      ...summarizeEvidence(evidenceOf(beam, referenceSubmission(beam))),
    });
    expect(evidence.loads?.comparisons.map((item) => [item.learnerTargetId, item.status])).toEqual([
      ["beam-left", "agrees"],
      ["7", "agrees"],
    ]);
    expect(answerOf(evidence, "max-moment")).toMatchObject({
      ownModelStatus: "computed",
      ownModelLocation: { nodeId: "C", memberId: "beam-left", memberEnd: "start", piece: false },
      verdict: "correct",
    });
    for (const answer of evidence.answers) {
      expect(answer.ownModel).toBeCloseTo(answer.reference ?? Number.NaN, 9);
    }
  });

  test("(b) a member under another id: the fixed member is missing and its counterpart is named", () => {
    const model = redrawMember(portal.referenceModel, "DC", "right-column", true);
    const evidence = withReferenceAnswers(portal, model);
    expect(evidence.fixedParts?.differences).toEqual([
      {
        list: "members",
        id: "DC",
        status: "missing",
        counterpartId: "right-column",
        changedFields: [],
      },
    ]);
    expect(evidence.matching?.members[2]).toMatchObject({
      referenceMemberId: "DC",
      learnerMemberId: "right-column",
      reversed: true,
      differences: [],
    });
    expect(verdictsOf(evidence)).toEqual(all(portal, "correct"));
    for (const answer of evidence.answers) {
      expect(answer.ownModel).toBeCloseTo(answer.reference ?? Number.NaN, 9);
    }
  });

  test("(c) members under other ids: the choice is still read from the members between the nodes", () => {
    let model = redrawMember(choiceWith("I 450x190"), "AC", "m1", false);
    model = redrawMember(model, "CB", "m2", true);
    const evidence = evidenceOf(choice, submissionOf(choice, model, {}));
    expect(evidence.sectionChoice).toMatchObject({
      members: [
        { referenceMemberId: "AC", learnerMemberId: "m1", sectionId: "I 450x190" },
        { referenceMemberId: "CB", learnerMemberId: "m2", sectionId: "I 450x190" },
      ],
      status: "chosen",
      chosenSectionId: "I 450x190",
    });
    expect(evidence.loads?.comparisons.map((item) => item.status)).toEqual(["agrees", "agrees"]);
    expect(answerOf(evidence, "max-moment").ownModel).toBeCloseTo(153.125, 9);
  });

  test("(a) a member split by an extra node: the answers are found, the loads have no counterpart", () => {
    const model = beamWith((m) => {
      m.nodes.push({ id: "X", x: 1, y: 0, z: 0 });
      const [ac, cb] = m.members;
      const [load, other] = m.memberUniformLoads;
      if (ac === undefined || cb === undefined || load === undefined || other === undefined) {
        throw new Error("the beam has two members and two loads");
      }
      m.members = [{ ...ac, id: "p1", endNodeId: "X" }, { ...ac, id: "p2", startNodeId: "X" }, cb];
      m.memberUniformLoads = [
        { ...load, id: "l1", memberId: "p1" },
        { ...load, id: "l2", memberId: "p2" },
        other,
      ];
    });
    const evidence = withReferenceAnswers(beam, model);
    expect(verdictsOf(evidence)).toEqual(all(beam, "correct"));
    expect(answerOf(evidence, "max-moment")).toMatchObject({
      ownModelStatus: "computed",
      ownModelLocation: { nodeId: "C", memberId: "p2", memberEnd: "end", piece: true },
    });
    expect(answerOf(evidence, "max-moment").ownModel).toBeCloseTo(67.5, 9);
    expect(evidence.matching).toMatchObject({ extraNodeIds: ["X"], extraMemberIds: ["p1", "p2"] });
    expect(evidence.loads?.resultant.agrees).toBe(true);
    expect(evidence.loads?.comparisons.map((item) => item.status)).toEqual(["missing", "agrees"]);
    expect(evidence.loads?.extra.map((item) => item.loadId)).toEqual(["l1", "l2"]);
  });
});

describe("(c) the section choice", () => {
  test("a section that fails the limit", () => {
    const evidence = withOwnAnswers(choice, choiceWith("I 330x160"));
    expect(evidence.sectionChoice).toMatchObject({
      status: "chosen",
      chosenSectionId: "I 330x160",
      allowed: true,
      meetsRequirements: false,
      lighterAllowedSectionMeets: false,
      lightestMeetingSectionId: "I 400x180",
    });
    const [deflection] = evidence.requirements;
    expect(deflection).toMatchObject({ status: "computed", unit: "mm", satisfied: false });
    expect(deflection?.value).toBeCloseTo(32.0218, 4);
    expect(deflection?.allowable).toBeCloseTo(19.4444, 4);
    expect(deflection?.ratio).toBeCloseTo(1.6468, 4);
    // The reference values are those of the chosen section, so the learner's own readings are correct.
    expect(verdictsOf(evidence)).toEqual({
      "max-moment": "correct",
      "midspan-deflection": "correct",
      "deflection-ratio": "correct",
      "max-bending-stress": "missing",
    });
    expect(answerOf(evidence, "midspan-deflection")).toMatchObject({
      referenceBasis: "reference-model-with-chosen-section",
      referenceDifference: 0,
    });
    expect(answerOf(evidence, "midspan-deflection").reference).toBeCloseTo(32.0218, 4);
    expect(summarizeEvidence(evidence)).toMatchObject({
      requirements: { total: 1, satisfied: 0, notSatisfied: 1, notComputed: 0 },
      requirementsMet: false,
      sectionChoice: { allowed: true, meetsRequirements: false, lighterAllowedSectionMeets: false },
      fixedParts: { checked: 17, missing: 0, changed: 0 },
      members: { missing: 0, different: 0, extra: 0, extraNodes: 0 },
    });
  });

  test("the starting section, the lightest of the list, fails by more", () => {
    const evidence = withOwnAnswers(choice, copy(choice.startingModel));
    expect(evidence.sectionChoice).toMatchObject({
      chosenSectionId: "I 300x150",
      meetsRequirements: false,
      lighterAllowedSectionMeets: false,
    });
    expect(evidence.requirements[0]?.ratio).toBeCloseTo(2.3494, 4);
  });

  test("the lightest that passes", () => {
    const evidence = withOwnAnswers(choice, choiceWith("I 400x180"));
    expect(evidence.sectionChoice).toMatchObject({
      chosenSectionId: "I 400x180",
      allowed: true,
      meetsRequirements: true,
      lighterAllowedSectionMeets: false,
      lightestMeetingSectionId: "I 400x180",
      referenceSectionId: "I 400x180",
    });
    expect(evidence.requirements[0]).toMatchObject({ satisfied: true });
    expect(evidence.requirements[0]?.ratio).toBeCloseTo(0.8453, 4);
    expect(summarizeEvidence(evidence).requirementsMet).toBe(true);
  });

  test("a heavier one than needed", () => {
    const evidence = withOwnAnswers(choice, choiceWith("I 500x200"));
    expect(evidence.sectionChoice).toMatchObject({
      chosenSectionId: "I 500x200",
      allowed: true,
      chosenArea: 0.01108,
      meetsRequirements: true,
      lighterAllowedSectionMeets: true,
      lightestMeetingSectionId: "I 400x180",
    });
    expect(evidence.requirements[0]?.ratio).toBeCloseTo(0.4158, 4);
    expect(verdictsOf(evidence)).toMatchObject({
      "max-moment": "correct",
      "midspan-deflection": "correct",
      "deflection-ratio": "correct",
    });
    expect(summarizeEvidence(evidence).sectionChoice).toEqual({
      status: "chosen",
      chosenSectionId: "I 500x200",
      allowed: true,
      meetsRequirements: true,
      lighterAllowedSectionMeets: true,
    });
  });

  test("two different sections: no choice, and the reference values are the reference model's", () => {
    const model = choiceWith("I 400x180", (m) => {
      (m.members[1] as { sectionId: string }).sectionId = "I 500x200";
    });
    const evidence = withOwnAnswers(choice, model);
    expect(evidence.sectionChoice).toMatchObject({
      status: "mixed",
      chosenSectionId: null,
      allowed: null,
      meetsRequirements: null,
      lighterAllowedSectionMeets: null,
    });
    expect(answerOf(evidence, "midspan-deflection")).toMatchObject({
      referenceBasis: "reference-model",
      verdict: "consistent-with-own-model",
    });
    expect(answerOf(evidence, "midspan-deflection").reference).toBeCloseTo(16.437, 3);
  });

  test("a section that is not in the list", () => {
    const model = choiceWith("I 600x220", (m) => {
      m.sections.push(genericSection({ name: "I 600x220", h: 600, b: 220, tw: 12, tf: 19 }));
    });
    const evidence = withOwnAnswers(choice, model);
    expect(evidence.sectionChoice).toMatchObject({
      status: "chosen",
      chosenSectionId: "I 600x220",
      allowed: false,
      chosenArea: null,
      meetsRequirements: null,
      lighterAllowedSectionMeets: null,
    });
    // Part (f) still has the learner's own model: the deflection of the heavy section is within the limit.
    expect(evidence.requirements[0]?.satisfied).toBe(true);
    expect(answerOf(evidence, "midspan-deflection").referenceBasis).toBe("reference-model");
  });
});

/** The verdict of an answer entry, recomputed from the numbers the entry stores and nothing else. */
function verdictFromNumbers(answer: Evidence["answers"][number]): string {
  if (answer.typed === null) {
    return "missing";
  }
  if (answer.reference === null) {
    return "pending";
  }
  if ((answer.referenceDifference ?? Number.NaN) <= (answer.referenceAllowance ?? Number.NaN)) {
    return "correct";
  }
  if (
    answer.ownModel !== null &&
    (answer.ownModelDifference ?? Number.NaN) <= (answer.ownModelAllowance ?? Number.NaN)
  ) {
    return "consistent-with-own-model";
  }
  return "incorrect";
}

/** What must hold for every evidence: finite numbers, equal to its JSON copy, verdicts explained. */
function expectSound(evidence: Evidence, label: string): void {
  expect(nonFinitePaths(evidence), label).toEqual([]);
  expect(nonFinitePaths(summarizeEvidence(evidence)), label).toEqual([]);
  expect(JSON.parse(JSON.stringify(evidence)), label).toStrictEqual(evidence);
  for (const answer of evidence.answers) {
    expect(answer.verdict, `${label} ${answer.answerId}`).toBe(verdictFromNumbers(answer));
    expect(answer.ownModel === null, `${label} ${answer.answerId}`).toBe(
      answer.ownModelStatus !== "computed",
    );
    expect(answer.reference === null, `${label} ${answer.answerId}`).toBe(
      answer.referenceStatus !== "computed",
    );
  }
  for (const requirement of evidence.requirements) {
    expect(requirement.value === null, label).toBe(requirement.status !== "computed");
    expect(requirement.ratio === null, label).toBe(requirement.status !== "computed");
    expect(requirement.satisfied === null, label).toBe(requirement.status !== "computed");
  }
}

describe("numbers that are not finite do not reach the evidence (rework loop 1)", () => {
  test("(a) Iy = 1e-312: the deflection overflows; it is out of range and the typed 123456 is incorrect", () => {
    const model = beamWith((m) => {
      (m.sections[0] as { Iy: number }).Iy = 1e-312;
    });
    const submission = submissionOf(beam, model, { "midspan-deflection": 123456 });
    expect(validateSubmission(beam, submission)).toEqual([]);
    const evidence = evidenceOf(beam, submission);
    expect(evidence.model).toMatchObject({ parses: true, valid: true, solve: "solved" });
    const deflection = answerOf(evidence, "midspan-deflection");
    expect(deflection).toMatchObject({
      typed: 123456,
      referenceStatus: "computed",
      ownModelStatus: "out-of-range",
      ownModelLocation: null,
      ownModel: null,
      ownModelAllowance: null,
      ownModelDifference: null,
      signError: false,
      verdict: "incorrect",
    });
    expect(deflection.reference).toBeCloseTo(14.795, 3);
    expect(deflection.referenceDifference).toBeCloseTo(123456 - 14.795, 3);
    // The reactions and the moment of the statically determinate beam do not depend on Iy.
    expect(answerOf(evidence, "reaction-a")).toMatchObject({
      ownModelStatus: "computed",
      verdict: "missing",
    });
    expect(answerOf(evidence, "reaction-a").ownModel).toBeCloseTo(45, 9);
    expectSound(evidence, "beam Iy 1e-312");
  });

  test("(b) E and G at 1e-299, or a wind of 1e306 kN: the sway, its ratio and the requirement are out of range", () => {
    // With E and G at 1e-299 the frame solves and its sway in mm overflows; with the wind at 1e306
    // the sway is finite and beyond the bound. (All Iy at 1e-312, or E alone at 1e-300, make the
    // solver report this frame as unstable, which the sweep below covers.)
    for (const change of [
      (m: Model) => {
        (m.materials[0] as { E: number }).E = 1e-299;
        (m.materials[0] as { G: number }).G = 1e-299;
      },
      (m: Model) => {
        (m.nodalLoads[0] as { fx: number }).fx = 1e306;
      },
    ]) {
      const answers = Object.fromEntries(portal.answers.map((answer) => [answer.id, 123456]));
      const evidence = evidenceOf(portal, submissionOf(portal, portalWith(change), answers));
      expect(evidence.submission.issues).toEqual([]);
      expect(evidence.model.solve).toBe("solved");
      expect(answerOf(evidence, "sway-b")).toMatchObject({
        ownModelStatus: "out-of-range",
        ownModel: null,
      });
      expect(answerOf(evidence, "drift-ratio")).toMatchObject({
        ownModelStatus: "out-of-range",
        ownModel: null,
      });
      expect(verdictsOf(evidence)).toEqual(all(portal, "incorrect"));
      expect(evidence.requirements[0]).toMatchObject({
        status: "out-of-range",
        learnerNodeId: "B",
        value: null,
        ratio: null,
        satisfied: null,
      });
      expect(summarizeEvidence(evidence)).toMatchObject({
        requirements: { total: 1, satisfied: 0, notSatisfied: 0, notComputed: 1 },
        requirementsMet: null,
      });
      expectSound(evidence, "portal");
    }
  });

  test("(c) every section with Iy = 1e-312: the requirement is out of range; 5 mm and 0.2 are incorrect", () => {
    const model = choiceWith("I 400x180", (m) => {
      for (const section of m.sections) {
        section.Iy = 1e-312;
      }
    });
    const evidence = evidenceOf(
      choice,
      submissionOf(choice, model, { "midspan-deflection": 5, "deflection-ratio": 0.2 }),
    );
    expect(evidence.requirements[0]).toMatchObject({
      status: "out-of-range",
      value: null,
      ratio: null,
      satisfied: null,
    });
    expect(verdictsOf(evidence)).toEqual({
      "max-moment": "missing",
      "midspan-deflection": "incorrect",
      "deflection-ratio": "incorrect",
      "max-bending-stress": "missing",
    });
    expect(answerOf(evidence, "deflection-ratio").ownModelStatus).toBe("out-of-range");
    // The reference side is the task's own model with the chosen section, not the learner's sections.
    expect(answerOf(evidence, "midspan-deflection").reference).toBeCloseTo(16.437, 3);
    expectSound(evidence, "choice");
  });

  test("(a) a uniform load of −1e308: the model is not solved and the load is in no sum", () => {
    const model = beamWith((m) => {
      (m.memberUniformLoads[0] as { value: number }).value = -1e308;
    });
    const submission = submissionOf(beam, model, { "midspan-deflection": 123456 });
    expect(validateSubmission(beam, submission)).toEqual([]);
    const evidence = evidenceOf(beam, submission);
    expect(evidence.model).toMatchObject({ valid: true, solve: "non-finite" });
    // What is left is the load on C-B: 45 kN at x = 4.5 m.
    expect(evidence.loads?.resultant).toEqual({
      reference: { fx: 0, fy: 0, fz: -90, mx: 0, my: 270, mz: 0 },
      learner: { fx: 0, fy: 0, fz: -45, mx: 0, my: 202.5, mz: 0 },
      forceDifference: 45,
      forceAllowance: 0.9,
      momentDifference: 67.5,
      momentAllowance: 2.7,
      agrees: false,
    });
    expect(evidence.loads?.unresolvedLoadIds).toEqual(["w-AC"]);
    expect(evidence.loads?.comparisons).toMatchObject([
      {
        referenceTargetId: "AC",
        learnerLoadIds: [],
        learnerOutOfRangeLoadIds: ["w-AC"],
        learner: null,
        status: "missing",
      },
      {
        referenceTargetId: "CB",
        learnerLoadIds: ["w-CB"],
        learnerOutOfRangeLoadIds: [],
        status: "agrees",
      },
    ]);
    expect(answerOf(evidence, "midspan-deflection")).toMatchObject({
      ownModelStatus: "not-solved",
      verdict: "incorrect",
    });
    expectSound(evidence, "beam -1e308");
  });

  test("(a) a uniform load of −1e307 on a model that solves: the load and the results are out of range", () => {
    const model = beamWith((m) => {
      (m.memberUniformLoads[0] as { value: number }).value = -1e307;
    });
    const answers = Object.fromEntries(beam.answers.map((answer) => [answer.id, 1e308]));
    const evidence = evidenceOf(beam, submissionOf(beam, model, answers));
    expect(evidence.model.solve).toBe("solved");
    expect(evidence.loads?.unresolvedLoadIds).toEqual(["w-AC"]);
    expect(evidence.answers.map((answer) => answer.ownModelStatus)).toEqual([
      "out-of-range",
      "out-of-range",
      "out-of-range",
      "out-of-range",
    ]);
    expect(verdictsOf(evidence)).toEqual(all(beam, "incorrect"));
    // A typed value of 1e308 is stored, and its difference from the reference is finite.
    expect(answerOf(evidence, "reaction-a")).toMatchObject({
      typed: 1e308,
      referenceDifference: 1e308,
    });
    expectSound(evidence, "beam -1e307");
  });

  test("(b) a supported node at x = 1e300 carrying a load, and two loads of 1e308 on one node", () => {
    const far = portalWith((m) => {
      m.nodes.push({ id: "far", x: 1e300, y: 0, z: 0 });
      m.supports.push(supportOn("far", ["ux", "uy", "uz", "rx", "ry", "rz"]));
      m.nodalLoads.push({
        id: "far-load",
        loadCaseId: "LC1",
        nodeId: "far",
        fx: 0,
        fy: 0,
        fz: 1e10,
        mx: 0,
        my: 0,
        mz: 0,
      });
    });
    const ofFar = withReferenceAnswers(portal, far);
    expect(ofFar.model.solve).toBe("solved");
    expect(ofFar.loads?.unresolvedLoadIds).toEqual(["far-load"]);
    expect(ofFar.loads?.resultant.agrees).toBe(true);
    expect(ofFar.matching?.extraNodeIds).toEqual(["far"]);
    expectSound(ofFar, "portal far node");

    const twice = portalWith((m) => {
      const [wind] = m.nodalLoads;
      if (wind === undefined) {
        throw new Error("the portal has a nodal load");
      }
      m.nodalLoads = [
        { ...wind, id: "h1", fx: 1e308 },
        { ...wind, id: "h2", fx: 1e308 },
      ];
    });
    const ofTwice = withReferenceAnswers(portal, twice);
    expect(ofTwice.loads?.comparisons[0]).toMatchObject({
      referenceTargetId: "B",
      learnerLoadIds: [],
      learnerOutOfRangeLoadIds: ["h1", "h2"],
      learner: null,
      status: "missing",
    });
    expectSound(ofTwice, "portal two huge loads");
  });

  test("extreme but parseable models of each task: finite numbers, the JSON copy, explained verdicts", () => {
    const extremes = [1e-312, 1e-300, 1e300, 1e308, -1e300, -1e308];
    let count = 0;
    for (const task of seededTasks()) {
      const typed = Object.fromEntries(task.answers.map((answer) => [answer.id, 123456]));
      const changes: [string, (m: Model, value: number) => void][] = [
        ...(["A", "Iy", "Iz", "J", "depthY", "depthZ"] as const).map(
          (field): [string, (m: Model, value: number) => void] => [
            `sections.${field}`,
            (m, value) => {
              for (const section of m.sections) {
                section[field] = value;
              }
            },
          ],
        ),
        ...(["E", "G", "fy", "density"] as const).map(
          (field): [string, (m: Model, value: number) => void] => [
            `materials.${field}`,
            (m, value) => {
              for (const material of m.materials) {
                material[field] = value;
              }
            },
          ],
        ),
        [
          "uniform load value",
          (m, value) => {
            for (const load of m.memberUniformLoads) {
              load.value = value;
            }
          },
        ],
        [
          "nodal force and moment",
          (m, value) => {
            m.nodalLoads.push({
              id: "x1",
              loadCaseId: "LC1",
              nodeId: "A",
              fx: value,
              fy: 0,
              fz: value,
              mx: 0,
              my: value,
              mz: 0,
            });
            m.nodalLoads.push({
              id: "x2",
              loadCaseId: "LC1",
              nodeId: "B",
              fx: value,
              fy: value,
              fz: 0,
              mx: value,
              my: 0,
              mz: 0,
            });
          },
        ],
        [
          "point load",
          (m, value) => {
            const memberId = m.members[0]?.id ?? "";
            m.memberPointLoads.push({
              id: "x3",
              loadCaseId: "LC1",
              memberId,
              axes: "local",
              direction: "z",
              value,
              position: 1,
            });
          },
        ],
        [
          "a node's coordinate",
          (m, value) => {
            (m.nodes[1] as { x: number }).x = value;
          },
        ],
        [
          "an added, supported and loaded node",
          (m, value) => {
            m.nodes.push({ id: "far", x: value, y: -value, z: value });
            m.supports.push(supportOn("far", ["ux", "uy", "uz", "rx", "ry", "rz"]));
            m.nodalLoads.push({
              id: "x4",
              loadCaseId: "LC1",
              nodeId: "far",
              fx: 1,
              fy: 2,
              fz: 1e10,
              mx: 0,
              my: 0,
              mz: 0,
            });
          },
        ],
        [
          "a member to a far node, loaded",
          (m, value) => {
            const [first] = m.members;
            if (first === undefined) {
              throw new Error("the model has members");
            }
            m.nodes.push({ id: "far", x: value, y: 0, z: 0 });
            m.members.push({ ...first, id: "long", startNodeId: "A", endNodeId: "far" });
            m.memberUniformLoads.push({
              id: "x5",
              loadCaseId: "LC1",
              memberId: "long",
              axes: "global",
              direction: "z",
              value: -1,
            });
            m.memberPointLoads.push({
              id: "x6",
              loadCaseId: "LC1",
              memberId: "long",
              axes: "local",
              direction: "y",
              value: 3,
              position: 2,
            });
          },
        ],
        [
          "the roll angle",
          (m, value) => {
            for (const member of m.members) {
              member.rollAngleDeg = value;
            }
          },
        ],
      ];
      for (const [name, change] of changes) {
        for (const value of extremes) {
          const model = copy(task.referenceModel);
          change(model, value);
          const label = `${task.id}: ${name} = ${value}`;
          const submission = submissionOf(task, model, typed);
          expect(validateSubmission(task, submission), label).toEqual([]);
          const evidence = evidenceOf(task, submission);
          expectSound(evidence, label);
          // 123456 is far from every reference value, so nothing is correct; and it is within
          // tolerance of an own-model value only when that value is stored and says so.
          for (const answer of evidence.answers) {
            expect(answer.verdict, `${label} ${answer.answerId}`).not.toBe("correct");
            if (answer.verdict === "consistent-with-own-model") {
              expect(Math.abs((answer.ownModel ?? 0) - 123456), label).toBeLessThanOrEqual(
                0.02 * 123456,
              );
            }
          }
          count += 1;
        }
      }
    }
    expect(count).toBe(3 * 17 * 6);
  });

  test("typed answers at the largest doubles: stored, compared, and the evidence is still plain", () => {
    for (const task of seededTasks()) {
      for (const value of [1e308, Number.MAX_VALUE, -Number.MAX_VALUE, 5e-324]) {
        const typed = Object.fromEntries(task.answers.map((answer) => [answer.id, value]));
        const evidence = evidenceOf(task, submissionOf(task, copy(task.referenceModel), typed));
        expectSound(evidence, `${task.id} typed ${value}`);
        for (const answer of evidence.answers) {
          expect(answer.typed).toBe(value);
          expect(["incorrect", "pending"]).toContain(answer.verdict);
        }
      }
    }
  });

  test("every scenario of this file: finite numbers, and each verdict follows from its entry's numbers", () => {
    expect(built.length).toBeGreaterThan(350);
    for (const { task, submission } of built) {
      expectSound(buildEvidence(task, submission), task.id);
    }
  });
});

describe("a model without an applied load offers no own-model value (rework loop 1)", () => {
  test("(a) no loads: small typed values are incorrect, not consistent with a model that gives zero", () => {
    const model = beamWith((m) => {
      m.memberUniformLoads = [];
    });
    const small = Object.fromEntries(beam.answers.map((answer) => [answer.id, 0.03]));
    const evidence = evidenceOf(beam, submissionOf(beam, model, small));
    expect(evidence.model.solve).toBe("solved");
    expect(verdictsOf(evidence)).toEqual(all(beam, "incorrect"));
    expect(evidence.answers.map((answer) => answer.ownModelStatus)).toEqual([
      "no-loads",
      "no-loads",
      "no-loads",
      "no-loads",
    ]);
    // A deflection typed in metres (0.0148 for 14.8 mm), and zeros.
    const metres = evidenceOf(beam, submissionOf(beam, model, { "midspan-deflection": 0.0148 }));
    expect(answerOf(metres, "midspan-deflection").verdict).toBe("incorrect");
    const zeros = Object.fromEntries(beam.answers.map((answer) => [answer.id, 0]));
    expect(verdictsOf(evidenceOf(beam, submissionOf(beam, model, zeros)))).toEqual(
      all(beam, "incorrect"),
    );
  });

  test("(b) the loads in another load case, or loads of zero: the same", () => {
    const elsewhere = portalWith((m) => {
      m.loadCases.push({ id: "LC2", name: "Other" });
      for (const load of [...m.nodalLoads, ...m.memberUniformLoads]) {
        load.loadCaseId = "LC2";
      }
    });
    const zeroLoads = portalWith((m) => {
      (m.nodalLoads[0] as { fx: number }).fx = 0;
      (m.memberUniformLoads[0] as { value: number }).value = 0;
    });
    const zeros = Object.fromEntries(portal.answers.map((answer) => [answer.id, 0]));
    for (const model of [elsewhere, zeroLoads]) {
      const evidence = evidenceOf(portal, submissionOf(portal, model, zeros));
      expect(evidence.model.solve).toBe("solved");
      expect(verdictsOf(evidence)).toEqual(all(portal, "incorrect"));
      expect(new Set(evidence.answers.map((answer) => answer.ownModelStatus))).toEqual(
        new Set(["no-loads"]),
      );
    }
    // The requirement is still evaluated on the model: an unloaded frame does not sway.
    const evidence = evidenceOf(portal, submissionOf(portal, elsewhere, zeros));
    expect(evidence.requirements[0]).toMatchObject({
      status: "computed",
      value: 0,
      satisfied: true,
    });
    expect(evidence.loads?.otherLoadCaseLoadIds).toEqual(["w-BC", "wind-B"]);
  });

  test("(b) a loaded model whose value is zero keeps the verdict: the moment of a pinned base", () => {
    const model = portalWith((m) => {
      m.supports[0] = supportOn("A", ["ux", "uy", "uz"]);
    });
    const verdict = (typed: number) =>
      answerOf(evidenceOf(portal, submissionOf(portal, model, { "moment-a": typed })), "moment-a");
    expect(verdict(0)).toMatchObject({
      ownModelStatus: "computed",
      ownModel: 0,
      verdict: "consistent-with-own-model",
    });
    expect(verdict(0.0499).verdict).toBe("consistent-with-own-model");
    expect(verdict(0.0501).verdict).toBe("incorrect");
  });
});

describe("the worked example of the README", () => {
  test("task (b) with a pinned base A and seven answers read from that model, one without its sign", () => {
    const model = portalWith((m) => {
      m.supports[0] = supportOn("A", ["ux", "uy", "uz"]);
    });
    const evidence = evidenceOf(portal, {
      taskId: portal.id,
      model,
      answers: {
        "reaction-ax": 12.5,
        "reaction-dx": 32.5,
        "reaction-az": 115.1,
        "reaction-dz": 124.9,
        "moment-a": 0,
        "moment-d": 60.8,
        "sway-b": 4.98,
      },
      justification: "The sway is 4.98 mm, below 16.7 mm.",
      submittedAt: "2026-12-01T09:30:00Z",
    });
    expect(evidence.model).toMatchObject({ parses: true, valid: true, solve: "solved" });
    expect(evidence.fixedParts).toEqual({ checked: 11, differences: [] });
    expect(evidence.loads?.resultant.agrees).toBe(true);
    expect(evidence.loads?.comparisons.map((item) => item.status)).toEqual(["agrees", "agrees"]);
    expect(evidence.supports?.nodes[0]).toMatchObject({
      learner: { ux: true, uy: true, uz: true, rx: false, ry: false, rz: false },
      agrees: false,
      differing: ["ry"],
      outOfPlaneAgrees: false,
      outOfPlaneDiffering: ["rx", "rz"],
    });
    // The table of the README: typed, reference, its allowance and difference, own model, its
    // allowance and difference (to the three decimals the README prints), sign error, verdict.
    const rows = evidence.answers.map((answer) => [
      answer.answerId,
      answer.typed,
      ...[
        answer.reference,
        answer.referenceAllowance,
        answer.referenceDifference,
        answer.ownModel,
        answer.ownModelAllowance,
        answer.ownModelDifference,
      ].map((value) => (value === null ? null : Number(value.toFixed(3)))),
      answer.signError,
      answer.verdict,
    ]);
    expect(rows).toEqual([
      [
        "reaction-ax",
        12.5,
        15.609,
        0.156,
        3.109,
        12.527,
        0.125,
        0.027,
        false,
        "consistent-with-own-model",
      ],
      ["reaction-dx", 32.5, -35.609, 0.356, 68.109, -32.527, 0.325, 65.027, true, "incorrect"],
      ["reaction-az", 115.1, 114.302, 1.143, 0.798, 115.103, 1.151, 0.003, false, "correct"],
      ["reaction-dz", 124.9, 125.698, 1.257, 0.798, 124.897, 1.249, 0.003, false, "correct"],
      ["moment-a", 0, 15.363, 0.154, 15.363, 0, 0.05, 0, false, "consistent-with-own-model"],
      [
        "moment-d",
        60.8,
        69.781,
        0.698,
        8.981,
        60.827,
        0.608,
        0.027,
        false,
        "consistent-with-own-model",
      ],
      ["sway-b", 4.98, 7.783, 0.156, 2.803, 4.981, 0.1, 0.001, false, "consistent-with-own-model"],
      ["drift-ratio", null, 0.467, 0.009, null, 0.299, 0.006, null, false, "missing"],
    ]);
    const [drift] = evidence.requirements;
    expect(drift?.value).toBeCloseTo(4.981, 3);
    expect(drift?.allowable).toBeCloseTo(16.667, 3);
    expect(drift?.ratio).toBeCloseTo(0.299, 3);
    expect(drift?.satisfied).toBe(true);
    expect(summarizeEvidence(evidence)).toEqual({
      taskId: "portal-frame-wind-gravity",
      submissionValid: true,
      justificationPresent: true,
      modelParses: true,
      modelValid: true,
      modelSolved: true,
      solveStatus: "solved",
      answers: {
        total: 8,
        correct: 2,
        consistentWithOwnModel: 4,
        incorrect: 1,
        missing: 1,
        pending: 0,
      },
      members: { missing: 0, different: 0, extra: 0, extraNodes: 0 },
      fixedParts: { checked: 11, missing: 0, changed: 0 },
      supports: { differing: 1, outOfPlaneDiffering: 1 },
      loads: { resultantAgrees: true, differing: 0, missing: 0, extra: 0 },
      requirements: { total: 1, satisfied: 1, notSatisfied: 0, notComputed: 0 },
      requirementsMet: true,
      sectionChoice: null,
    });
  });
});

describe("the submission", () => {
  test("a wrong task id, an unknown answer and no justification are reported, and the evidence is still built", () => {
    const submission = referenceSubmission(beam);
    submission.taskId = "choose-the-beam";
    submission.answers.extra = 1;
    submission.justification = " \n ";
    const evidence = evidenceOf(beam, submission);
    expect(evidence.taskId).toBe("simply-supported-beam");
    expect(evidence.submission).toEqual({
      taskId: "choose-the-beam",
      taskIdMatches: false,
      justificationPresent: false,
      issues: [
        {
          code: "wrong-task-id",
          ids: ["choose-the-beam", "simply-supported-beam"],
          path: "taskId",
        },
        { code: "unknown-answer-id", ids: ["extra"], path: "answers.extra" },
      ],
    });
    expect(verdictsOf(evidence)).toEqual(all(beam, "correct"));
    expect(summarizeEvidence(evidence)).toMatchObject({
      submissionValid: false,
      justificationPresent: false,
    });
  });

  test("a model that does not parse: the parts that need a model are null", () => {
    const submission = referenceSubmission(choice);
    const broken = { ...submission, model: { nodes: [] } as unknown as Model };
    const evidence = evidenceOf(choice, broken);
    expect(evidence.model).toMatchObject({ parses: false, valid: false, solve: "not-run" });
    expect(evidence.model.parseIssues.length).toBeGreaterThan(0);
    expect(evidence.matching).toBeNull();
    expect(evidence.fixedParts).toBeNull();
    expect(evidence.supports).toBeNull();
    expect(evidence.loads).toBeNull();
    expect(evidence.requirements[0]).toMatchObject({ status: "model-not-read", value: null });
    expect(evidence.sectionChoice).toMatchObject({
      status: "model-not-read",
      chosenSectionId: null,
    });
    // The typed answers are still compared with the reference model as it is.
    expect(verdictsOf(evidence)).toMatchObject({
      "max-moment": "correct",
      "midspan-deflection": "correct",
    });
    expect(answerOf(evidence, "max-moment")).toMatchObject({
      referenceBasis: "reference-model",
      ownModelStatus: "model-not-read",
    });
    expect(summarizeEvidence(evidence)).toMatchObject({
      submissionValid: false,
      modelParses: false,
      modelSolved: false,
      solveStatus: "not-run",
      fixedParts: { checked: 0, missing: 0, changed: 0 },
      loads: { resultantAgrees: null, differing: 0, missing: 0, extra: 0 },
      requirementsMet: null,
    });
  });

  test("a model with dangling ids, repeated ids and stray entries is reported, and nothing throws", () => {
    const model = copy(portal.referenceModel);
    const [ab] = model.members;
    const [a] = model.nodes;
    if (ab === undefined || a === undefined) {
      throw new Error("the portal has members and nodes");
    }
    model.nodes.push({ ...a }, { id: "constructor", x: 9, y: 9, z: 9 });
    model.members.push(
      { ...ab },
      { ...ab, id: "loose", startNodeId: "nowhere", endNodeId: "A" },
      { ...ab, id: "point", startNodeId: "B", endNodeId: "B" },
    );
    model.supports.push(supportOn("nowhere", ["ux"]), supportOn("A", []));
    model.nodalLoads.push({
      id: "n",
      loadCaseId: "LC7",
      nodeId: "nowhere",
      fx: 1,
      fy: 0,
      fz: 0,
      mx: 0,
      my: 0,
      mz: 0,
    });
    model.memberUniformLoads.push(
      { id: "u1", loadCaseId: "LC1", memberId: "none", axes: "local", direction: "y", value: 1 },
      { id: "u2", loadCaseId: "LC1", memberId: "point", axes: "local", direction: "y", value: 1 },
    );
    model.memberPointLoads.push({
      id: "p",
      loadCaseId: "LC1",
      memberId: "loose",
      axes: "global",
      direction: "x",
      value: 1,
      position: 99,
    });
    const evidence = withReferenceAnswers(portal, model);
    expect(evidence.model).toMatchObject({ parses: true, valid: false, solve: "invalid-model" });
    expect(evidence.model.issues.map((issue) => issue.code)).toContain("duplicate-id");
    expect(evidence.loads?.unresolvedLoadIds).toEqual(["p", "u1", "u2"]);
    expect(evidence.loads?.otherLoadCaseLoadIds).toEqual(["n"]);
    expect(evidence.matching?.extraNodeIds).toEqual(["constructor"]);
    expect(evidence.matching?.extraMemberIds).toEqual(["loose", "point"]);
    expect(verdictsOf(evidence)).toEqual(all(portal, "correct"));
  });

  test("each entry of each reference model removed in turn: evidence is built and names the loss", () => {
    const lists = [
      "nodes",
      "members",
      "sections",
      "materials",
      "supports",
      "loadCases",
      "nodalLoads",
      "memberUniformLoads",
    ] as const;
    let count = 0;
    for (const task of seededTasks()) {
      for (const list of lists) {
        for (let index = 0; index < task.referenceModel[list].length; index++) {
          const model = copy(task.referenceModel);
          (model[list] as unknown[]).splice(index, 1);
          const evidence = withReferenceAnswers(task, model);
          const summary = summarizeEvidence(evidence);
          count += 1;
          // Something of the evidence must show that the model is not the reference.
          const shown =
            !summary.modelValid ||
            !summary.modelSolved ||
            summary.members.missing > 0 ||
            summary.fixedParts.missing > 0 ||
            summary.supports.differing + summary.supports.outOfPlaneDiffering > 0 ||
            summary.loads.missing > 0;
          expect(shown, `${task.id} without ${list}[${index}]`).toBe(true);
        }
      }
    }
    expect(count).toBe(12 + 15 + 17);
  });

  test("it does not throw for a value that is not a submission", () => {
    for (const value of [null, undefined, 4, "x", [], {}]) {
      const evidence = buildEvidence(beam, value as unknown as Submission);
      expect(evidence.model.parses).toBe(false);
      expect(verdictsOf(evidence)).toEqual(all(beam, "missing"));
      expect(evidence.submission.issues.length).toBeGreaterThan(0);
    }
  });
});

describe("determinism", () => {
  /** Whether a value holds `undefined`, a function, a negative zero or a number that is not finite. */
  function impure(value: unknown): boolean {
    if (typeof value === "number") {
      return !Number.isFinite(value) || Object.is(value, -0);
    }
    if (value === undefined || typeof value === "function") {
      return true;
    }
    if (typeof value === "object" && value !== null) {
      return Object.values(value).some(impure);
    }
    return false;
  }

  test("the scenarios above were collected", () => {
    expect(built.length).toBeGreaterThan(45);
    expect(new Set(built.map((item) => item.task.id)).size).toBe(3);
  });

  test("evidence built twice from the same input is identical, also as text", () => {
    for (const { task, submission } of built) {
      const first = buildEvidence(task, submission);
      const second = buildEvidence(task, copy(submission));
      expect(second).toStrictEqual(first);
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
      expect(summarizeEvidence(second)).toStrictEqual(summarizeEvidence(first));
    }
  });

  test("it survives JSON.stringify and JSON.parse unchanged, and so does its summary", () => {
    for (const { task, submission } of built) {
      const evidence = buildEvidence(task, submission);
      expect(impure(evidence)).toBe(false);
      expect(JSON.parse(JSON.stringify(evidence))).toStrictEqual(evidence);
      const summary = summarizeEvidence(evidence);
      expect(JSON.parse(JSON.stringify(summary))).toStrictEqual(summary);
    }
  });

  test("the task and the submission are not changed", () => {
    for (const task of seededTasks()) {
      const submission = referenceSubmission(task);
      const taskBefore = copy(task);
      const submissionBefore = copy(submission);
      buildEvidence(task, submission);
      expect(task).toStrictEqual(taskBefore);
      expect(submission).toStrictEqual(submissionBefore);
    }
  });

  test("the time of the submission and the key order of its model do not change the evidence", () => {
    const submission = referenceSubmission(portal);
    const later = { ...submission, submittedAt: "2027-01-01T00:00:00Z" };
    const shuffled = {
      ...submission,
      model: Object.fromEntries(Object.entries(submission.model).reverse()) as unknown as Model,
    };
    const text = JSON.stringify(buildEvidence(portal, submission));
    expect(JSON.stringify(buildEvidence(portal, later))).toBe(text);
    expect(JSON.stringify(buildEvidence(portal, shuffled))).toBe(text);
    expect(text).not.toContain("2026");
  });

  test("the keys of the evidence come in the order of its type", () => {
    const evidence = buildEvidence(beam, referenceSubmission(beam));
    expect(Object.keys(evidence)).toEqual([
      "version",
      "taskId",
      "submission",
      "model",
      "matching",
      "fixedParts",
      "supports",
      "loads",
      "answers",
      "requirements",
      "sectionChoice",
    ]);
    expect(Object.keys(evidence.answers[0] ?? {})).toEqual([
      "answerId",
      "kind",
      "unit",
      "signed",
      "tolerance",
      "typed",
      "referenceStatus",
      "referenceBasis",
      "reference",
      "referenceAllowance",
      "referenceDifference",
      "ownModelStatus",
      "ownModelLocation",
      "ownModel",
      "ownModelAllowance",
      "ownModelDifference",
      "signError",
      "verdict",
    ]);
    expect(evidence.version).toBe(1);
  });

  test("withoutNegativeZero replaces −0 and keeps everything else, the key order included", () => {
    const value = { b: -0, a: [0, -0, 1.5, "x", null, true], c: { z: -0, y: -2 } };
    const cleaned = withoutNegativeZero(value);
    expect(cleaned).toStrictEqual({ b: 0, a: [0, 0, 1.5, "x", null, true], c: { z: 0, y: -2 } });
    expect(Object.keys(cleaned)).toEqual(["b", "a", "c"]);
    expect(Object.keys(cleaned.c)).toEqual(["z", "y"]);
  });
});
