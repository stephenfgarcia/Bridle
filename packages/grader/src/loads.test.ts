import type { Model } from "@bridle/model";
import { portalFrameTask, simplySupportedBeamTask } from "@bridle/tasks";
import { describe, expect, test } from "vitest";
import {
  compareLoads,
  compareResultants,
  hasAppliedLoad,
  loadAllowance,
  resolveLoads,
  resultantOf,
} from "./loads";
import { matchModels } from "./matching";
import { nonFinitePaths } from "./range";
import { copy, redrawMember } from "./testSupport";

const beam = simplySupportedBeamTask();
const portal = portalFrameTask();

function compare(reference: Model, learner: Model) {
  return compareLoads(reference, learner, matchModels(reference, learner), "LC1");
}

/** A model with one member from the origin to (3, 0, 4), 5 m long, and nothing else. */
function inclined(): Model {
  const model = copy(beam.referenceModel);
  model.nodes = [
    { id: "P", x: 0, y: 0, z: 0 },
    { id: "Q", x: 3, y: 0, z: 4 },
  ];
  const [first] = model.members;
  if (first === undefined) {
    throw new Error("the beam has members");
  }
  model.members = [{ ...first, id: "PQ", startNodeId: "P", endNodeId: "Q" }];
  model.supports = [];
  model.memberUniformLoads = [];
  return model;
}

describe("resolveLoads and resultantOf", () => {
  test("the beam: 90 kN downward, 270 kN·m about the origin", () => {
    // Two members of 3 m with 15 kN/m: 45 kN at x = 1.5 and 45 kN at x = 4.5.
    // Moment about the origin, r × F, y component: z·Fx − x·Fz = 1.5·45 + 4.5·45 = 270.
    const { loads, unresolvedIds } = resolveLoads(beam.referenceModel, "LC1");
    expect(unresolvedIds).toEqual([]);
    expect(
      loads.map((load) => [load.kind, load.id, load.targetId, load.force.z, load.point.x]),
    ).toEqual([
      ["member-uniform", "w-AC", "AC", -45, 1.5],
      ["member-uniform", "w-CB", "CB", -45, 4.5],
    ]);
    expect(resultantOf(loads)).toEqual({ fx: 0, fy: 0, fz: -90, mx: 0, my: 270, mz: 0 });
  });

  test("the portal: (20, 0, −240) kN and 1060 kN·m about Y", () => {
    // Wind: 20 kN along +X at B (0, 0, 5): moment about Y = z·Fx = 100.
    // Beam: 30 kN/m × 8 m = 240 kN downward at (4, 0, 5): moment about Y = −x·Fz = 960.
    const resultant = resultantOf(resolveLoads(portal.referenceModel, "LC1").loads);
    expect(resultant).toEqual({ fx: 20, fy: 0, fz: -240, mx: 0, my: 1060, mz: 0 });
  });

  test("a uniform load on an inclined member is per unit of the member's own length", () => {
    const model = inclined();
    model.memberUniformLoads = [
      { id: "g", loadCaseId: "LC1", memberId: "PQ", axes: "global", direction: "z", value: -10 },
    ];
    const [load] = resolveLoads(model, "LC1").loads;
    // 10 kN/m over 5 m is 50 kN, at the middle (1.5, 0, 2).
    expect(load?.force).toEqual({ x: -0, y: -0, z: -50 });
    expect(load?.point).toEqual({ x: 1.5, y: 0, z: 2 });
    expect(load?.intensity).toEqual({ x: -0, y: -0, z: -10 });
  });

  test("a load in local axes is turned with the member's axes", () => {
    const model = inclined();
    // Local x of P-Q is (0.6, 0, 0.8); local z is (−0.8, 0, 0.6) (`memberLocalAxes`).
    model.memberUniformLoads = [
      { id: "t", loadCaseId: "LC1", memberId: "PQ", axes: "local", direction: "z", value: 10 },
    ];
    model.memberPointLoads = [
      {
        id: "p",
        loadCaseId: "LC1",
        memberId: "PQ",
        axes: "local",
        direction: "x",
        value: 5,
        position: 2.5,
      },
    ];
    const [uniform, point] = resolveLoads(model, "LC1").loads;
    expect(uniform?.force.x).toBeCloseTo(-40, 12);
    expect(uniform?.force.y).toBeCloseTo(0, 12);
    expect(uniform?.force.z).toBeCloseTo(30, 12);
    expect(point?.kind).toBe("member-point");
    expect(point?.force.x).toBeCloseTo(3, 12);
    expect(point?.force.z).toBeCloseTo(4, 12);
    expect(point?.point.x).toBeCloseTo(1.5, 12);
    expect(point?.point.z).toBeCloseTo(2, 12);
  });

  test("a nodal load keeps its own moment and adds r × F", () => {
    const model = inclined();
    model.nodalLoads = [
      { id: "n", loadCaseId: "LC1", nodeId: "Q", fx: 0, fy: 2, fz: 0, mx: 1, my: 0, mz: 0 },
    ];
    // r = (3, 0, 4), F = (0, 2, 0): r × F = (0·0 − 4·2, 4·0 − 3·0, 3·2 − 0·0) = (−8, 0, 6).
    expect(resultantOf(resolveLoads(model, "LC1").loads)).toEqual({
      fx: 0,
      fy: 2,
      fz: 0,
      mx: -7,
      my: 0,
      mz: 6,
    });
  });

  test("loads of another load case are left out; loads on what the model lacks are unresolved", () => {
    const model = copy(portal.referenceModel);
    model.loadCases.push({ id: "LC2", name: "Other" });
    (model.nodalLoads[0] as { loadCaseId: string }).loadCaseId = "LC2";
    model.nodalLoads.push({
      id: "z-ghost",
      loadCaseId: "LC1",
      nodeId: "nowhere",
      fx: 1,
      fy: 0,
      fz: 0,
      mx: 0,
      my: 0,
      mz: 0,
    });
    model.memberUniformLoads.push({
      id: "a-ghost",
      loadCaseId: "LC1",
      memberId: "none",
      axes: "global",
      direction: "z",
      value: -1,
    });
    const resolved = resolveLoads(model, "LC1");
    expect(resolved.loads.map((load) => load.id)).toEqual(["w-BC"]);
    expect(resolved.unresolvedIds).toEqual(["a-ghost", "z-ghost"]);
    expect(resolveLoads(model, "LC2").loads.map((load) => load.id)).toEqual(["wind-B"]);
  });
});

describe("loads whose numbers are out of range", () => {
  test("a load beyond the bound, or one whose r × F is, is unresolved and in no sum", () => {
    const model = copy(portal.referenceModel);
    model.nodes.push({ id: "far", x: 1e300, y: 0, z: 0 });
    model.nodalLoads.push(
      { id: "huge", loadCaseId: "LC1", nodeId: "B", fx: 1e308, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 },
      { id: "huge2", loadCaseId: "LC1", nodeId: "B", fx: 1e308, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 },
      {
        id: "over",
        loadCaseId: "LC1",
        nodeId: "B",
        fx: 0,
        fy: 0,
        fz: 0,
        mx: 1.01e100,
        my: 0,
        mz: 0,
      },
      {
        id: "at-bound",
        loadCaseId: "LC1",
        nodeId: "C",
        fx: 0,
        fy: 1e100,
        fz: 0,
        mx: 0,
        my: 0,
        mz: 0,
      },
      {
        id: "far-load",
        loadCaseId: "LC1",
        nodeId: "far",
        fx: 0,
        fy: 0,
        fz: 1e10,
        mx: 0,
        my: 0,
        mz: 0,
      },
    );
    (model.memberUniformLoads[0] as { value: number }).value = -1e308;
    const resolved = resolveLoads(model, "LC1");
    // "at-bound" acts at C (8, 0, 5): its r × F is 8e100, beyond the bound.
    expect(resolved.loads.map((load) => load.id)).toEqual(["wind-B"]);
    expect(resolved.unresolvedIds).toEqual([
      "at-bound",
      "far-load",
      "huge",
      "huge2",
      "over",
      "w-BC",
    ]);
    expect(resolved.outOfRange).toEqual([
      { kind: "nodal", id: "huge", targetId: "B" },
      { kind: "nodal", id: "huge2", targetId: "B" },
      { kind: "nodal", id: "over", targetId: "B" },
      { kind: "nodal", id: "at-bound", targetId: "C" },
      { kind: "nodal", id: "far-load", targetId: "far" },
      { kind: "member-uniform", id: "w-BC", targetId: "BC" },
    ]);
    const evidence = compare(portal.referenceModel, model);
    expect(nonFinitePaths(evidence)).toEqual([]);
    expect(evidence.unresolvedLoadIds).toEqual(resolved.unresolvedIds);
    expect(evidence.resultant.learner).toEqual({ fx: 20, fy: 0, fz: 0, mx: 0, my: 100, mz: 0 });
    expect(evidence.comparisons).toMatchObject([
      {
        referenceTargetId: "B",
        learnerLoadIds: ["wind-B"],
        learnerOutOfRangeLoadIds: ["huge", "huge2", "over"],
        status: "agrees",
      },
      {
        referenceTargetId: "BC",
        learnerLoadIds: [],
        learnerOutOfRangeLoadIds: ["w-BC"],
        learner: null,
        status: "missing",
      },
    ]);
    expect(evidence.extra).toEqual([]);
  });

  test("a load exactly at the bound that acts at the origin is resolved", () => {
    const model = copy(portal.referenceModel);
    model.nodalLoads.push({
      id: "edge",
      loadCaseId: "LC1",
      nodeId: "A",
      fx: 1e100,
      fy: 0,
      fz: 0,
      mx: 0,
      my: -1e100,
      mz: 0,
    });
    expect(resolveLoads(model, "LC1").unresolvedIds).toEqual([]);
    expect(nonFinitePaths(compare(portal.referenceModel, model))).toEqual([]);
  });

  test("hasAppliedLoad: a load with a component that is not zero, in the load case, resolved", () => {
    expect(hasAppliedLoad(portal.referenceModel, "LC1")).toBe(true);
    expect(hasAppliedLoad(portal.referenceModel, "LC2")).toBe(false);
    const zero = copy(portal.referenceModel);
    (zero.nodalLoads[0] as { fx: number }).fx = 0;
    zero.memberUniformLoads = [];
    expect(hasAppliedLoad(zero, "LC1")).toBe(false);
    (zero.nodalLoads[0] as { my: number }).my = 2;
    expect(hasAppliedLoad(zero, "LC1")).toBe(true);
    (zero.nodalLoads[0] as { my: number }).my = 1e200;
    expect(hasAppliedLoad(zero, "LC1")).toBe(false);
  });
});

describe("compareResultants", () => {
  const reference = { fx: 0, fy: 0, fz: -90, mx: 0, my: 270, mz: 0 };

  test("the allowance is 1 percent of the reference's length, and at least 1e-9", () => {
    expect(loadAllowance(90)).toBe(0.9);
    expect(loadAllowance(0)).toBe(1e-9);
  });

  test("within 1 percent in force and in moment agrees; beyond it in either does not", () => {
    expect(compareResultants(reference, { ...reference, fz: -90.8, my: 272 })).toMatchObject({
      forceAllowance: 0.9,
      momentAllowance: 2.7,
      agrees: true,
    });
    expect(compareResultants(reference, { ...reference, fz: -91 }).agrees).toBe(false);
    expect(compareResultants(reference, { ...reference, my: 273 }).agrees).toBe(false);
    // The difference is the length of a vector: 0.7 in two directions is 0.99, beyond 0.9.
    const skew = compareResultants(reference, { ...reference, fx: 0.7, fz: -90.7 });
    expect(skew.forceDifference).toBeCloseTo(Math.hypot(0.7, 0.7), 12);
    expect(skew.agrees).toBe(false);
  });
});

describe("compareLoads", () => {
  test("the reference against itself", () => {
    expect(compare(portal.referenceModel, copy(portal.referenceModel))).toEqual({
      loadCaseId: "LC1",
      resultant: {
        reference: { fx: 20, fy: 0, fz: -240, mx: 0, my: 1060, mz: 0 },
        learner: { fx: 20, fy: 0, fz: -240, mx: 0, my: 1060, mz: 0 },
        forceDifference: 0,
        forceAllowance: 0.01 * Math.hypot(20, 240),
        momentDifference: 0,
        momentAllowance: 10.6,
        agrees: true,
      },
      comparisons: [
        {
          kind: "nodal",
          referenceTargetId: "B",
          referenceLoadIds: ["wind-B"],
          learnerTargetId: "B",
          learnerLoadIds: ["wind-B"],
          learnerOutOfRangeLoadIds: [],
          reference: { fx: 20, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 },
          learner: { fx: 20, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 },
          forceDifference: 0,
          forceAllowance: 0.2,
          momentDifference: 0,
          momentAllowance: 1e-9,
          status: "agrees",
        },
        {
          kind: "member-uniform",
          referenceTargetId: "BC",
          referenceLoadIds: ["w-BC"],
          learnerTargetId: "BC",
          learnerLoadIds: ["w-BC"],
          learnerOutOfRangeLoadIds: [],
          reference: { fx: 0, fy: 0, fz: -30, mx: 0, my: 0, mz: 0 },
          learner: { fx: 0, fy: 0, fz: -30, mx: 0, my: 0, mz: 0 },
          forceDifference: 0,
          forceAllowance: 0.3,
          momentDifference: 0,
          momentAllowance: 1e-9,
          status: "agrees",
        },
      ],
      extra: [],
      unresolvedLoadIds: [],
      otherLoadCaseLoadIds: [],
    });
  });

  test("a missing load has no counterpart", () => {
    const learner = { ...copy(portal.referenceModel), nodalLoads: [] };
    const evidence = compare(portal.referenceModel, learner);
    expect(evidence.comparisons[0]).toMatchObject({
      kind: "nodal",
      referenceTargetId: "B",
      learnerTargetId: "B",
      learnerLoadIds: [],
      learner: null,
      forceDifference: null,
      momentDifference: null,
      status: "missing",
    });
    expect(evidence.comparisons[1]?.status).toBe("agrees");
    expect(evidence.resultant.learner).toEqual({ fx: 0, fy: 0, fz: -240, mx: 0, my: 960, mz: 0 });
    expect(evidence.resultant.forceDifference).toBe(20);
    expect(evidence.resultant.momentDifference).toBe(100);
    expect(evidence.resultant.agrees).toBe(false);
  });

  test("a load of the wrong size differs; one within 1 percent agrees", () => {
    const learner = copy(beam.referenceModel);
    (learner.memberUniformLoads[0] as { value: number }).value = -12;
    (learner.memberUniformLoads[1] as { value: number }).value = -15.1;
    const evidence = compare(beam.referenceModel, learner);
    expect(
      evidence.comparisons.map((item) => [item.status, item.forceDifference, item.forceAllowance]),
    ).toEqual([
      ["differs", 3, 0.15],
      ["agrees", expect.closeTo(0.1, 12), 0.15],
    ]);
    // 36 kN at x = 1.5 and 45.3 kN at x = 4.5.
    expect(evidence.resultant.learner.fz).toBeCloseTo(-81.3, 12);
    expect(evidence.resultant.learner.my).toBeCloseTo(36 * 1.5 + 45.3 * 4.5, 12);
    expect(evidence.resultant.agrees).toBe(false);
  });

  test("a load on the wrong node: the same resultant, no counterpart, one extra load", () => {
    const learner = copy(portal.referenceModel);
    (learner.nodalLoads[0] as { nodeId: string }).nodeId = "C";
    const evidence = compare(portal.referenceModel, learner);
    // The force slides along its own line of action from B to C, so the resultant is the same.
    expect(evidence.resultant.learner).toEqual(evidence.resultant.reference);
    expect(evidence.resultant.agrees).toBe(true);
    expect(evidence.comparisons[0]).toMatchObject({ referenceTargetId: "B", status: "missing" });
    expect(evidence.extra).toEqual([
      { kind: "nodal", loadId: "wind-B", learnerTargetId: "C", referenceTargetId: "C" },
    ]);
  });

  test("a load on the wrong member: both loads on A-C", () => {
    const learner = copy(beam.referenceModel);
    (learner.memberUniformLoads[1] as { memberId: string }).memberId = "AC";
    const evidence = compare(beam.referenceModel, learner);
    expect(evidence.comparisons).toMatchObject([
      {
        referenceTargetId: "AC",
        learnerLoadIds: ["w-AC", "w-CB"],
        learner: { fz: -30 },
        forceDifference: 15,
        status: "differs",
      },
      { referenceTargetId: "CB", learnerLoadIds: [], status: "missing" },
    ]);
    expect(evidence.extra).toEqual([]);
    // 90 kN in all, as the reference, but at x = 1.5: 135 kN·m against 270.
    expect(evidence.resultant).toMatchObject({
      forceDifference: 0,
      momentDifference: 135,
      agrees: false,
    });
  });

  test("a load in the wrong direction, and one of the wrong kind", () => {
    const upward = copy(beam.referenceModel);
    (upward.memberUniformLoads[0] as { value: number }).value = 15;
    expect(compare(beam.referenceModel, upward).comparisons[0]).toMatchObject({
      forceDifference: 30,
      status: "differs",
    });
    const asPoint = copy(beam.referenceModel);
    asPoint.memberUniformLoads = asPoint.memberUniformLoads.slice(1);
    asPoint.memberPointLoads = [
      {
        id: "p",
        loadCaseId: "LC1",
        memberId: "AC",
        axes: "global",
        direction: "z",
        value: -45,
        position: 1.5,
      },
    ];
    const evidence = compare(beam.referenceModel, asPoint);
    // The same resultant, but the uniform load of A-C has no counterpart of its kind.
    expect(evidence.resultant.agrees).toBe(true);
    expect(evidence.comparisons.map((item) => item.status)).toEqual(["missing", "agrees"]);
    expect(evidence.extra).toEqual([
      { kind: "member-point", loadId: "p", learnerTargetId: "AC", referenceTargetId: "AC" },
    ]);
  });

  test("several loads on one member are summed, and a local-axes load equals its global twin", () => {
    const learner = copy(beam.referenceModel);
    learner.memberUniformLoads = [
      { id: "b", loadCaseId: "LC1", memberId: "AC", axes: "global", direction: "z", value: -10 },
      { id: "a", loadCaseId: "LC1", memberId: "AC", axes: "local", direction: "z", value: -5 },
      { id: "c", loadCaseId: "LC1", memberId: "CB", axes: "local", direction: "z", value: -15 },
    ];
    const evidence = compare(beam.referenceModel, learner);
    expect(evidence.comparisons.map((item) => [item.learnerLoadIds, item.status])).toEqual([
      [["a", "b"], "agrees"],
      [["c"], "agrees"],
    ]);
    expect(evidence.resultant.agrees).toBe(true);
  });

  test("a load on a member drawn with another id and direction is its counterpart", () => {
    const learner = redrawMember(beam.referenceModel, "AC", "m1", true);
    const evidence = compare(beam.referenceModel, learner);
    expect(evidence.comparisons[0]).toMatchObject({
      referenceTargetId: "AC",
      learnerTargetId: "m1",
      learnerLoadIds: ["w-AC"],
      status: "agrees",
    });
    // A local-axes load on the reversed member: local z is still up, so −15 is still downward.
    (learner.memberUniformLoads[0] as { axes: string }).axes = "local";
    expect(compare(beam.referenceModel, learner).comparisons[0]?.status).toBe("agrees");
    // Along local y, which is −Y on the reversed member, it is another load.
    (learner.memberUniformLoads[0] as { direction: string }).direction = "y";
    expect(compare(beam.referenceModel, learner).comparisons[0]).toMatchObject({
      learner: { fx: 0, fy: 15, fz: 0 },
      status: "differs",
    });
  });

  test("point loads are compared by force and by moment about the reference member's start", () => {
    const reference = copy(beam.referenceModel);
    reference.memberUniformLoads = [];
    reference.memberPointLoads = [
      {
        id: "p",
        loadCaseId: "LC1",
        memberId: "CB",
        axes: "global",
        direction: "z",
        value: -10,
        position: 1,
      },
    ];
    const same = redrawMember(reference, "CB", "BC", true);
    // On the member drawn from B to C the same point is 2 m from its start.
    (same.memberPointLoads[0] as { position: number }).position = 2;
    const agreeing = compare(reference, same).comparisons[0];
    expect(agreeing?.reference).toEqual({ fx: 0, fy: 0, fz: -10, mx: 0, my: 10, mz: 0 });
    expect(agreeing?.learner?.my).toBeCloseTo(10, 12);
    expect(agreeing?.status).toBe("agrees");
    const moved = copy(reference);
    (moved.memberPointLoads[0] as { position: number }).position = 2;
    expect(compare(reference, moved).comparisons[0]).toMatchObject({
      forceDifference: 0,
      momentDifference: 10,
      momentAllowance: 0.1,
      status: "differs",
    });
  });

  test("loads in another load case, and loads on what the model lacks, are listed apart", () => {
    const learner = copy(portal.referenceModel);
    learner.loadCases.push({ id: "LC2", name: "Other" });
    (learner.memberUniformLoads[0] as { loadCaseId: string }).loadCaseId = "LC2";
    learner.nodalLoads.push({
      id: "ghost",
      loadCaseId: "LC1",
      nodeId: "nowhere",
      fx: 9,
      fy: 0,
      fz: 0,
      mx: 0,
      my: 0,
      mz: 0,
    });
    const evidence = compare(portal.referenceModel, learner);
    expect(evidence.otherLoadCaseLoadIds).toEqual(["w-BC"]);
    expect(evidence.unresolvedLoadIds).toEqual(["ghost"]);
    expect(evidence.extra).toEqual([]);
    expect(evidence.comparisons.map((item) => item.status)).toEqual(["agrees", "missing"]);
    expect(evidence.resultant.learner).toEqual({ fx: 20, fy: 0, fz: 0, mx: 0, my: 100, mz: 0 });
  });
});
