import { parseModel, serializeModel } from "@bridle/model";
import { solve } from "@bridle/solver";
import {
  chooseTheBeamTask,
  computeAnswers,
  FORCE_TOLERANCE,
  portalFrameTask,
  RATIO_TOLERANCE,
  type RequiredAnswer,
  seededTasks,
  simplySupportedBeamTask,
  type Task,
} from "@bridle/tasks";
import { describe, expect, test } from "vitest";
import {
  allowance,
  answerDifference,
  answerEvidence,
  findMemberEnd,
  ownModelValue,
  referenceValues,
  verdictOf,
  withinTolerance,
} from "./answers";
import { hasAppliedLoad } from "./loads";
import { matchModels } from "./matching";
import { examineModel } from "./modelState";
import { evaluateRequirements } from "./requirements";
import { computedValues, copy, redrawMember, referenceValuesOf, renameNodes } from "./testSupport";

const beam = simplySupportedBeamTask();
const portal = portalFrameTask();

/** The own-model value of one answer of `task` for `model`, as `buildEvidence` gets it. */
function own(task: Task, model: typeof task.referenceModel, answerId: string) {
  const examined = examineModel(task, parseModel(serializeModel(model)));
  const match = examined.model === null ? null : matchModels(task.referenceModel, examined.model);
  const answer = task.answers.find((item) => item.id === answerId);
  if (answer === undefined) {
    throw new Error(`no answer ${answerId}`);
  }
  return ownModelValue(
    task,
    answer,
    match,
    examined,
    evaluateRequirements(task, match, examined),
    examined.model !== null && hasAppliedLoad(examined.model, task.loadCaseId),
  );
}

describe("the tolerance rule", () => {
  test("the allowance is the larger of the relative and the absolute part", () => {
    expect(allowance(FORCE_TOLERANCE, 45)).toBe(0.45);
    expect(allowance(FORCE_TOLERANCE, -45)).toBe(0.45);
    expect(allowance(FORCE_TOLERANCE, 2)).toBe(0.05); // 1 percent of 2 is 0.02, below 0.05
    expect(allowance(FORCE_TOLERANCE, 0)).toBe(0.05);
    expect(allowance(RATIO_TOLERANCE, 0.5)).toBe(0.01);
    expect(allowance(RATIO_TOLERANCE, 0.1)).toBe(0.005);
  });

  test("a signed answer is compared with its sign, an unsigned one by magnitude", () => {
    expect(answerDifference(true, -15, 15)).toBe(30);
    expect(answerDifference(false, -15, 15)).toBe(0);
    expect(answerDifference(false, 14, -15)).toBe(1);
    expect(answerDifference(true, 14, 15)).toBe(1);
  });

  test("inside and outside the allowance, on both sides", () => {
    // Reference 45 kN, allowance 0.45 kN.
    expect(withinTolerance(false, FORCE_TOLERANCE, 45.44, 45)).toBe(true);
    expect(withinTolerance(false, FORCE_TOLERANCE, 44.56, 45)).toBe(true);
    expect(withinTolerance(false, FORCE_TOLERANCE, 45.46, 45)).toBe(false);
    expect(withinTolerance(false, FORCE_TOLERANCE, 44.54, 45)).toBe(false);
    // A small reference: the absolute part of 0.05 kN decides.
    expect(withinTolerance(true, FORCE_TOLERANCE, 2.04, 2)).toBe(true);
    expect(withinTolerance(true, FORCE_TOLERANCE, 2.06, 2)).toBe(false);
    // A difference equal to the allowance is within it (values chosen to be exact in binary).
    expect(withinTolerance(false, { relative: 0.5, absolute: 0.25 }, 3, 2)).toBe(true);
    expect(withinTolerance(false, { relative: 0.5, absolute: 0.25 }, 0.25, 0)).toBe(true);
  });
});

describe("verdictOf", () => {
  const t = FORCE_TOLERANCE;
  test("the five verdicts, in the order of the tests", () => {
    expect(verdictOf(false, t, null, 45, 45)).toBe("missing");
    expect(verdictOf(false, t, null, null, null)).toBe("missing");
    expect(verdictOf(false, t, 45, null, 45)).toBe("pending");
    expect(verdictOf(false, t, 45.3, 45, 36)).toBe("correct");
    expect(verdictOf(false, t, 36.2, 45, 36)).toBe("consistent-with-own-model");
    expect(verdictOf(false, t, 40, 45, 36)).toBe("incorrect");
    expect(verdictOf(false, t, 40, 45, null)).toBe("incorrect");
  });

  test("a value within tolerance of both is correct", () => {
    expect(verdictOf(false, t, 45.2, 45, 45.4)).toBe("correct");
  });

  test("a sign error on a signed answer is incorrect; on an unsigned one it is no error", () => {
    expect(verdictOf(true, t, -15.6, 15.6, 15.6)).toBe("incorrect");
    expect(verdictOf(false, t, -45, 45, 45)).toBe("correct");
  });

  test("the allowance for the own-model value is taken from the own-model value", () => {
    // Own 10: allowance 0.1. Typed 10.3 is outside it, though within 1 percent of the reference 45.
    expect(verdictOf(false, t, 10.3, 45, 10)).toBe("incorrect");
    expect(verdictOf(false, t, 10.08, 45, 10)).toBe("consistent-with-own-model");
  });
});

describe("answerEvidence", () => {
  const answer: RequiredAnswer = {
    id: "h",
    prompt: "",
    kind: "force",
    unit: "kN",
    signed: true,
    tolerance: FORCE_TOLERANCE,
    source: { kind: "reaction", nodeId: "A", component: "fx" },
  };
  const reference = { status: "computed", basis: "reference-model", value: 15.6 } as const;
  const location = { nodeId: "A", memberId: null, memberEnd: null, piece: false };

  test("stores every number the verdict comes from", () => {
    const evidence = answerEvidence(answer, 12.5, reference, {
      status: "computed",
      location,
      value: 12.53,
    });
    expect(evidence).toEqual({
      answerId: "h",
      kind: "force",
      unit: "kN",
      signed: true,
      tolerance: { relative: 0.01, absolute: 0.05 },
      typed: 12.5,
      referenceStatus: "computed",
      referenceBasis: "reference-model",
      reference: 15.6,
      referenceAllowance: 0.156,
      referenceDifference: expect.closeTo(3.1, 12),
      ownModelStatus: "computed",
      ownModelLocation: location,
      ownModel: 12.53,
      ownModelAllowance: 0.1253,
      ownModelDifference: expect.closeTo(0.03, 12),
      signError: false,
      verdict: "consistent-with-own-model",
    });
  });

  test("a sign error against the learner's own model is flagged too", () => {
    // Reference −35.6, own model −32.5; typed +32.5: the magnitude of the own model, the wrong sign.
    const d = { status: "computed", basis: "reference-model", value: -35.6 } as const;
    const ownValue = { status: "computed", location, value: -32.5 } as const;
    expect(answerEvidence(answer, 32.5, d, ownValue)).toMatchObject({
      ownModelDifference: 65,
      signError: true,
      verdict: "incorrect",
    });
    expect(answerEvidence(answer, -32.5, d, ownValue)).toMatchObject({
      signError: false,
      verdict: "consistent-with-own-model",
    });
    expect(answerEvidence(answer, 0, d, ownValue)).toMatchObject({
      signError: false,
      verdict: "incorrect",
    });
  });

  test("a sign error is flagged for a signed answer only, and only when the magnitude is right", () => {
    const ownValue = { status: "computed", location, value: 15.6 } as const;
    expect(answerEvidence(answer, -15.6, reference, ownValue)).toMatchObject({
      referenceDifference: 31.2,
      signError: true,
      verdict: "incorrect",
    });
    expect(answerEvidence(answer, -14, reference, ownValue)).toMatchObject({
      signError: false,
      verdict: "incorrect",
    });
    expect(answerEvidence(answer, 15.6, reference, ownValue)).toMatchObject({
      signError: false,
      verdict: "correct",
    });
    expect(answerEvidence({ ...answer, signed: false }, -15.6, reference, ownValue)).toMatchObject({
      referenceDifference: 0,
      signError: false,
      verdict: "correct",
    });
  });

  test("the own-model value is converted to the display unit, and to a magnitude when unsigned", () => {
    const deflection: RequiredAnswer = {
      ...answer,
      kind: "displacement",
      unit: "mm",
      signed: false,
      source: { kind: "displacement", nodeId: "C", component: "uz" },
    };
    const evidence = answerEvidence(
      deflection,
      14.8,
      { ...reference, value: 14.79 },
      {
        status: "computed",
        location,
        value: -0.01479,
      },
    );
    expect(evidence.ownModel).toBe(0.01479 * 1000);
    expect(evidence.verdict).toBe("correct");
    expect(
      answerEvidence(answer, 1, reference, { status: "computed", location, value: -3 }).ownModel,
    ).toBe(-3);
  });

  test("without a typed value or without a reference the differences are null", () => {
    const none = { status: "not-solved", location: null, value: null } as const;
    expect(answerEvidence(answer, null, reference, none)).toMatchObject({
      typed: null,
      referenceAllowance: 0.156,
      referenceDifference: null,
      ownModel: null,
      ownModelAllowance: null,
      ownModelDifference: null,
      verdict: "missing",
    });
    const pending = { status: "pending", basis: "none", value: null } as const;
    expect(answerEvidence(answer, 3, pending, none)).toMatchObject({
      referenceStatus: "pending",
      reference: null,
      referenceAllowance: null,
      referenceDifference: null,
      verdict: "pending",
    });
  });
});

describe("referenceValues", () => {
  test("for each task they are the display values of referenceAnswers", () => {
    for (const task of seededTasks()) {
      const expected = referenceValuesOf(task);
      const values = referenceValues(task, null);
      for (const answer of task.answers) {
        if (answer.source.kind === "pending") {
          expect(values(answer.id)).toEqual({ status: "pending", basis: "none", value: null });
        } else {
          expect(values(answer.id)).toEqual({
            status: "computed",
            basis: "reference-model",
            value: expected[answer.id],
          });
        }
      }
    }
  });

  test("with a chosen section they are computed for the reference model with that section", () => {
    const task = chooseTheBeamTask();
    const withSection = copy(task.referenceModel);
    for (const member of withSection.members) {
      member.sectionId = "I 500x200";
    }
    const expected = computedValues(task, withSection);
    const values = referenceValues(task, "I 500x200");
    expect(values("midspan-deflection")).toEqual({
      status: "computed",
      basis: "reference-model-with-chosen-section",
      value: expected["midspan-deflection"],
    });
    expect(values("midspan-deflection").value).toBeCloseTo(8.084, 3);
    expect(values("max-moment").value).toBeCloseTo(153.125, 9);
    expect(values("max-bending-stress")).toEqual({ status: "pending", basis: "none", value: null });
  });

  test("a section outside the list, or a task without a choice, uses the reference model as it is", () => {
    const task = chooseTheBeamTask();
    expect(referenceValues(task, "I 600x220")("midspan-deflection")).toEqual(
      referenceValues(task, null)("midspan-deflection"),
    );
    expect(referenceValues(beam, "I 300x150")("reaction-a").basis).toBe("reference-model");
  });

  test("an answer the reference model has no value for is unavailable", () => {
    const task = copy(beam);
    task.answers[0] = {
      ...(task.answers[0] as RequiredAnswer),
      source: { kind: "reaction", nodeId: "C", component: "fz" },
    };
    expect(referenceValues(task, null)("reaction-a")).toEqual({
      status: "unavailable",
      basis: "none",
      value: null,
    });
    const unsolved = { ...beam, referenceModel: { ...beam.referenceModel, supports: [] } };
    expect(referenceValues(unsolved, null)("reaction-b").status).toBe("unavailable");
  });
});

describe("ownModelValue", () => {
  test("for a model with the reference's ids it equals computeAnswers, bit for bit", () => {
    for (const task of seededTasks()) {
      const model = copy(task.referenceModel);
      // Make the model differ from the reference so that the values are the model's own.
      for (const load of model.memberUniformLoads) {
        load.value *= 0.8;
      }
      const result = computeAnswers(task, model);
      if (!result.ok) {
        throw new Error("the model solves");
      }
      for (const computed of result.answers) {
        const value = own(task, model, computed.answerId);
        if (computed.status !== "computed") {
          expect(value).toEqual({ status: "pending", location: null, value: null });
          continue;
        }
        const answer = task.answers.find((item) => item.id === computed.answerId);
        expect(answer?.signed ? value.value : Math.abs(value.value ?? Number.NaN)).toBe(
          computed.value,
        );
      }
    }
  });

  test("with other node and member ids and directions the values are the same", () => {
    let learner = renameNodes(portal.referenceModel);
    learner = redrawMember(learner, "AB", "left", true);
    learner = redrawMember(learner, "DC", "right", true);
    const expected = computeAnswers(portal, portal.referenceModel);
    if (!expected.ok) {
      throw new Error("the reference solves");
    }
    for (const computed of expected.answers) {
      if (computed.status === "computed") {
        const value = own(portal, learner, computed.answerId);
        const answer = portal.answers.find((item) => item.id === computed.answerId);
        const shown = answer?.signed ? value.value : Math.abs(value.value ?? Number.NaN);
        expect(shown).toBeCloseTo(computed.value, 9);
      }
    }
    expect(own(portal, learner, "reaction-ax").location).toEqual({
      nodeId: "n1",
      memberId: null,
      memberEnd: null,
      piece: false,
    });
  });

  test("why a value is not computed", () => {
    const noSupport = copy(portal.referenceModel);
    noSupport.supports = noSupport.supports.slice(1);
    // Fixed at D only, the frame still solves; node A has no support and so no reaction.
    expect(own(portal, noSupport, "reaction-ax")).toEqual({
      status: "no-support",
      location: null,
      value: null,
    });
    expect(own(portal, noSupport, "sway-b").status).toBe("computed");

    const moved = copy(beam.referenceModel);
    (moved.nodes[1] as { x: number }).x = 2.5;
    expect(own(beam, moved, "midspan-deflection").status).toBe("node-not-found");
    expect(own(beam, moved, "max-moment").status).toBe("node-not-found");
    expect(own(beam, moved, "reaction-a").status).toBe("computed");

    const unstable = { ...copy(beam.referenceModel), supports: [] };
    expect(own(beam, unstable, "reaction-a").status).toBe("not-solved");

    const otherCase = copy(beam.referenceModel);
    otherCase.loadCases = [{ id: "LC9", name: "Other" }];
    for (const load of otherCase.memberUniformLoads) {
      load.loadCaseId = "LC9";
    }
    expect(own(beam, otherCase, "reaction-a").status).toBe("no-load-case");

    const examinedBroken = examineModel(beam, parseModel("{}"));
    const first = beam.answers[0] as RequiredAnswer;
    expect(ownModelValue(beam, first, null, examinedBroken, [], false).status).toBe(
      "model-not-read",
    );
  });

  test("the limit ratio is the requirement's ratio on the learner's model", () => {
    const softer = copy(portal.referenceModel);
    (softer.nodalLoads[0] as { fx: number }).fx = 40;
    const sway = own(portal, softer, "sway-b").value ?? Number.NaN;
    expect(own(portal, softer, "drift-ratio")).toEqual({
      status: "computed",
      location: { nodeId: "B", memberId: null, memberEnd: null, piece: false },
      value: Math.abs(sway) / (5 / 300),
    });
  });
});

describe("a member end, resolved through the node", () => {
  /** Task (a) with its moment answer made signed, so that the sign is tested. */
  function signedMomentTask(): Task {
    const task = simplySupportedBeamTask();
    task.answers = task.answers.map((answer) =>
      answer.id === "max-moment" ? { ...answer, signed: true } : answer,
    );
    return task;
  }

  test("the reference: the end of A-C at C has my = −wL²/8 (a sagging moment at a member's end)", () => {
    const value = own(signedMomentTask(), beam.referenceModel, "max-moment");
    expect(value.value).toBeCloseTo(-67.5, 9);
    expect(value.location).toEqual({ nodeId: "C", memberId: "AC", memberEnd: "end", piece: false });
  });

  test("a member drawn from C to A: the value is read at its start and keeps the reference's sign", () => {
    const learner = redrawMember(beam.referenceModel, "AC", "CA", true);
    const value = own(signedMomentTask(), learner, "max-moment");
    expect(value.location).toEqual({
      nodeId: "C",
      memberId: "CA",
      memberEnd: "start",
      piece: false,
    });
    expect(value.value).toBeCloseTo(-67.5, 9);
    // The solver's own number for that end, in the reversed member's axes, has the other sign.
    const solved = solve(learner);
    if (!solved.ok) {
      throw new Error("the model solves");
    }
    expect(solved.loadCases.LC1?.memberEndForces.CA?.start.my).toBeCloseTo(67.5, 9);
  });

  test("a member rolled by 90 degrees: the moment is still the one about the reference's local y", () => {
    const learner = copy(beam.referenceModel);
    for (const member of learner.members) {
      member.rollAngleDeg = 90;
    }
    // Rolled, the beam bends about its weak axis: local z of the learner's member is global −Y, so
    // the solver reports the bending moment as mz and no my.
    const solved = solve(learner);
    if (!solved.ok) {
      throw new Error("the model solves");
    }
    const raw = solved.loadCases.LC1?.memberEndForces.AC?.end;
    expect(raw?.my).toBeCloseTo(0, 9);
    expect(Math.abs(raw?.mz ?? 0)).toBeCloseTo(67.5, 9);
    expect(own(signedMomentTask(), learner, "max-moment").value).toBeCloseTo(-67.5, 9);
  });

  test("a member split by an extra node: the piece that arrives at C gives the value", () => {
    const learner = copy(beam.referenceModel);
    learner.nodes.push({ id: "X", x: 1, y: 0, z: 0 });
    const [ac, cb] = learner.members;
    const [load] = learner.memberUniformLoads;
    if (ac === undefined || cb === undefined || load === undefined) {
      throw new Error("the beam has two members and two loads");
    }
    learner.members = [
      { ...ac, id: "p1", endNodeId: "X" },
      { ...ac, id: "p2", startNodeId: "X" },
      cb,
    ];
    learner.memberUniformLoads = [
      { ...load, id: "l1", memberId: "p1" },
      { ...load, id: "l2", memberId: "p2" },
      ...learner.memberUniformLoads.slice(1),
    ];
    const value = own(signedMomentTask(), learner, "max-moment");
    expect(value.location).toEqual({ nodeId: "C", memberId: "p2", memberEnd: "end", piece: true });
    expect(value.value).toBeCloseTo(-67.5, 9);
    // The piece drawn the other way gives the same value.
    const reversed = redrawMember(learner, "p2", "p2r", true);
    const again = own(signedMomentTask(), reversed, "max-moment");
    expect(again.location).toEqual({
      nodeId: "C",
      memberId: "p2r",
      memberEnd: "start",
      piece: true,
    });
    expect(again.value).toBeCloseTo(-67.5, 9);
  });

  test("findMemberEnd: no member, a member off the axis, and two pieces give member-not-found", () => {
    const [ac] = beam.referenceModel.members;
    if (ac === undefined) {
      throw new Error("the beam has members");
    }
    const find = (learner: typeof beam.referenceModel) =>
      findMemberEnd(
        beam.referenceModel,
        learner,
        matchModels(beam.referenceModel, learner),
        ac,
        "end",
      );

    const none = copy(beam.referenceModel);
    none.members = none.members.slice(1); // only C-B, which leaves C on the other side
    expect(find(none)).toBe("member-not-found");

    const off = copy(none);
    off.nodes.push({ id: "X", x: 1, y: 0, z: 0.5 });
    off.members.push({ ...ac, id: "skew", startNodeId: "X", endNodeId: "C" });
    expect(find(off)).toBe("member-not-found");

    const two = copy(none);
    two.nodes.push({ id: "X", x: 1, y: 0, z: 0 }, { id: "Y", x: 2, y: 0, z: 0 });
    two.members.push(
      { ...ac, id: "one", startNodeId: "X", endNodeId: "C" },
      { ...ac, id: "two", startNodeId: "Y", endNodeId: "C" },
    );
    expect(find(two)).toBe("member-not-found");

    const beyond = copy(none);
    beyond.nodes.push({ id: "X", x: -1, y: 0, z: 0 });
    beyond.members.push({ ...ac, id: "long", startNodeId: "X", endNodeId: "C" });
    expect(find(beyond)).toBe("member-not-found");

    const noNode = copy(beam.referenceModel);
    (noNode.nodes[1] as { z: number }).z = 0.2;
    expect(find(noNode)).toBe("node-not-found");
  });
});
