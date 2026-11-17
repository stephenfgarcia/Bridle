import { portalFrameTask, seededTasks, simplySupportedBeamTask } from "@bridle/tasks";
import { describe, expect, test } from "vitest";
import { matchModels } from "./matching";
import { compareSupports, modelPlane } from "./supports";
import { copy, renameNodes, supportOn } from "./testSupport";

const beam = simplySupportedBeamTask();
const portal = portalFrameTask();

function compare(reference: typeof beam.referenceModel, learner: typeof beam.referenceModel) {
  return compareSupports(reference, learner, matchModels(reference, learner));
}

describe("modelPlane", () => {
  test("the three reference models lie in an X-Z plane; a model with a node off it does not", () => {
    expect(seededTasks().map((task) => modelPlane(task.referenceModel))).toEqual([
      "xz",
      "xz",
      "xz",
    ]);
    const spatial = copy(portal.referenceModel);
    (spatial.nodes[2] as { y: number }).y = 0.5;
    expect(modelPlane(spatial)).toBeNull();
    expect(modelPlane({ ...spatial, nodes: [] })).toBeNull();
  });
});

describe("compareSupports", () => {
  test("the reference against itself: every node agrees, in the plane and out of it", () => {
    expect(compare(beam.referenceModel, copy(beam.referenceModel))).toEqual({
      plane: "xz",
      compared: ["ux", "uz", "ry"],
      outOfPlane: ["uy", "rx", "rz"],
      nodes: [
        {
          referenceNodeId: "A",
          learnerNodeId: "A",
          reference: { ux: true, uy: true, uz: true, rx: true, ry: false, rz: false },
          learner: { ux: true, uy: true, uz: true, rx: true, ry: false, rz: false },
          agrees: true,
          differing: [],
          outOfPlaneAgrees: true,
          outOfPlaneDiffering: [],
        },
        {
          referenceNodeId: "B",
          learnerNodeId: "B",
          reference: { ux: false, uy: true, uz: true, rx: false, ry: false, rz: false },
          learner: { ux: false, uy: true, uz: true, rx: false, ry: false, rz: false },
          agrees: true,
          differing: [],
          outOfPlaneAgrees: true,
          outOfPlaneDiffering: [],
        },
      ],
    });
  });

  test("a pinned base where the reference is fixed differs in ry; rx and rz are counted apart", () => {
    const learner = copy(portal.referenceModel);
    learner.supports = [
      supportOn("A", ["ux", "uy", "uz"]),
      supportOn("D", ["ux", "uy", "uz", "rx", "ry", "rz"]),
    ];
    const [a, d] = compare(portal.referenceModel, learner).nodes;
    expect(a).toMatchObject({
      referenceNodeId: "A",
      agrees: false,
      differing: ["ry"],
      outOfPlaneAgrees: false,
      outOfPlaneDiffering: ["rx", "rz"],
    });
    expect(d).toMatchObject({ agrees: true, differing: [], outOfPlaneAgrees: true });
  });

  test("out-of-plane restraints added or left out do not change `agrees`", () => {
    const added = copy(beam.referenceModel);
    added.supports = [
      supportOn("A", ["ux", "uy", "uz", "rx", "rz"]),
      supportOn("B", ["uy", "uz", "rx"]),
    ];
    expect(
      compare(beam.referenceModel, added).nodes.map((node) => [
        node.agrees,
        node.differing,
        node.outOfPlaneAgrees,
        node.outOfPlaneDiffering,
      ]),
    ).toEqual([
      [true, [], false, ["rz"]],
      [true, [], false, ["rx"]],
    ]);
    const leftOut = copy(beam.referenceModel);
    leftOut.supports = [supportOn("A", ["ux", "uz"]), supportOn("B", ["uz"])];
    expect(
      compare(beam.referenceModel, leftOut).nodes.map((node) => [
        node.agrees,
        node.differing,
        node.outOfPlaneAgrees,
        node.outOfPlaneDiffering,
      ]),
    ).toEqual([
      [true, [], false, ["uy", "rx"]],
      [true, [], false, ["uy"]],
    ]);
  });

  test("a roller where the reference has a pin, a held bending rotation, a support on another node", () => {
    const learner = copy(beam.referenceModel);
    learner.supports = [
      supportOn("B", ["ux", "uy", "uz", "ry"]),
      supportOn("C", ["uz"]),
      supportOn("A", ["uy", "uz", "rx"]),
    ];
    expect(compare(beam.referenceModel, learner).nodes).toEqual([
      {
        referenceNodeId: "A",
        learnerNodeId: "A",
        reference: { ux: true, uy: true, uz: true, rx: true, ry: false, rz: false },
        learner: { ux: false, uy: true, uz: true, rx: true, ry: false, rz: false },
        agrees: false,
        differing: ["ux"],
        outOfPlaneAgrees: true,
        outOfPlaneDiffering: [],
      },
      {
        referenceNodeId: "B",
        learnerNodeId: "B",
        reference: { ux: false, uy: true, uz: true, rx: false, ry: false, rz: false },
        learner: { ux: true, uy: true, uz: true, rx: false, ry: true, rz: false },
        agrees: false,
        differing: ["ux", "ry"],
        outOfPlaneAgrees: true,
        outOfPlaneDiffering: [],
      },
      {
        referenceNodeId: "C",
        learnerNodeId: "C",
        reference: null,
        learner: { ux: false, uy: false, uz: true, rx: false, ry: false, rz: false },
        agrees: false,
        differing: ["uz"],
        outOfPlaneAgrees: true,
        outOfPlaneDiffering: [],
      },
    ]);
  });

  test("no support in the learner's model: each reference support is compared with all free", () => {
    const learner = { ...copy(portal.referenceModel), supports: [] };
    expect(
      compare(portal.referenceModel, learner).nodes.map((node) => [
        node.referenceNodeId,
        node.learner,
        node.differing,
        node.outOfPlaneDiffering,
      ]),
    ).toEqual([
      ["A", null, ["ux", "uz", "ry"], ["uy", "rx", "rz"]],
      ["D", null, ["ux", "uz", "ry"], ["uy", "rx", "rz"]],
    ]);
  });

  test("supports are found by the node's position, whatever its id", () => {
    const learner = renameNodes(beam.referenceModel);
    expect(
      compare(beam.referenceModel, learner).nodes.map((node) => [
        node.referenceNodeId,
        node.learnerNodeId,
        node.agrees,
        node.outOfPlaneAgrees,
      ]),
    ).toEqual([
      ["A", "n1", true, true],
      ["B", "n3", true, true],
    ]);
  });

  test("a learner's support on a node at no reference node, and one on a node the model lacks", () => {
    const learner = copy(beam.referenceModel);
    learner.nodes.push({ id: "X", x: 1, y: 0, z: 0 });
    learner.supports.push(supportOn("ghost", ["rz"]), supportOn("X", ["ux"]));
    expect(
      compare(beam.referenceModel, learner)
        .nodes.slice(2)
        .map((node) => [
          node.referenceNodeId,
          node.learnerNodeId,
          node.agrees,
          node.outOfPlaneAgrees,
        ]),
    ).toEqual([
      [null, "X", false, true],
      [null, "ghost", true, false],
    ]);
  });

  test("a reference that is not planar: all six restraints are the compared ones", () => {
    const reference = copy(portal.referenceModel);
    (reference.nodes[2] as { y: number }).y = 1;
    const learner = copy(reference);
    learner.supports = [
      supportOn("A", ["ux", "uy", "uz", "ry"]),
      supportOn("D", ["ux", "uy", "uz", "rx", "ry", "rz"]),
    ];
    const evidence = compare(reference, learner);
    expect(evidence.plane).toBeNull();
    expect(evidence.compared).toEqual(["ux", "uy", "uz", "rx", "ry", "rz"]);
    expect(evidence.outOfPlane).toEqual([]);
    expect(evidence.nodes[0]).toMatchObject({
      agrees: false,
      differing: ["rx", "rz"],
      outOfPlaneAgrees: true,
      outOfPlaneDiffering: [],
    });
  });
});
