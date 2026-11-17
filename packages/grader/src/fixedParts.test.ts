import { chooseTheBeamTask, portalFrameTask, seededTasks } from "@bridle/tasks";
import { describe, expect, test } from "vitest";
import { compareFixedParts } from "./fixedParts";
import { copy, redrawMember } from "./testSupport";

const portal = portalFrameTask();
const choice = chooseTheBeamTask();

describe("compareFixedParts", () => {
  test("the reference model of each task has every fixed part unchanged", () => {
    expect(seededTasks().map((task) => compareFixedParts(task, copy(task.referenceModel)))).toEqual(
      [
        { checked: 6, differences: [] },
        { checked: 11, differences: [] },
        { checked: 17, differences: [] },
      ],
    );
  });

  test("a changed field of each kind of part is named with its two values", () => {
    const learner = copy(choice.referenceModel);
    (learner.nodes[1] as { x: number }).x = 3.4;
    (learner.members[0] as { rollAngleDeg: number }).rollAngleDeg = 90;
    (learner.members[1] as { releases: { end: { ry: boolean } } }).releases.end.ry = true;
    (learner.sections[3] as { Iy: number }).Iy = 0.001;
    (learner.materials[0] as { E: number }).E = 2e8;
    (learner.supports[1] as { ux: boolean }).ux = true;
    (learner.loadCases[0] as { name: string }).name = "Mine";
    (learner.memberUniformLoads[0] as { value: number }).value = -20;
    (learner.memberUniformLoads[1] as { direction: string }).direction = "y";
    expect(compareFixedParts(choice, learner)).toEqual({
      checked: 17,
      differences: [
        {
          list: "nodes",
          id: "C",
          status: "changed",
          counterpartId: null,
          changedFields: [{ field: "x", expected: 3.5, actual: 3.4 }],
        },
        {
          list: "members",
          id: "AC",
          status: "changed",
          counterpartId: null,
          changedFields: [{ field: "rollAngleDeg", expected: 0, actual: 90 }],
        },
        {
          list: "members",
          id: "CB",
          status: "changed",
          counterpartId: null,
          changedFields: [{ field: "releases.end.ry", expected: false, actual: true }],
        },
        {
          list: "sections",
          id: "I 400x180",
          status: "changed",
          counterpartId: null,
          changedFields: [
            { field: "Iy", expected: choice.startingModel.sections[3]?.Iy, actual: 0.001 },
          ],
        },
        {
          list: "materials",
          id: "steel",
          status: "changed",
          counterpartId: null,
          changedFields: [{ field: "E", expected: 2.1e8, actual: 2e8 }],
        },
        {
          list: "supports",
          id: "B",
          status: "changed",
          counterpartId: null,
          changedFields: [{ field: "ux", expected: false, actual: true }],
        },
        {
          list: "loadCases",
          id: "LC1",
          status: "changed",
          counterpartId: null,
          changedFields: [{ field: "name", expected: "Service loads", actual: "Mine" }],
        },
        {
          list: "memberUniformLoads",
          id: "w-AC",
          status: "changed",
          counterpartId: null,
          changedFields: [{ field: "value", expected: -25, actual: -20 }],
        },
        {
          list: "memberUniformLoads",
          id: "w-CB",
          status: "changed",
          counterpartId: null,
          changedFields: [{ field: "direction", expected: "z", actual: "y" }],
        },
      ],
    });
  });

  test("the section of a member of the section choice is not compared; another member's is", () => {
    const learner = copy(choice.referenceModel); // I 400x180 where the starting model has I 300x150
    expect(compareFixedParts(choice, learner).differences).toEqual([]);
    const frame = copy(portal.referenceModel);
    (frame.members[1] as { sectionId: string }).sectionId = "I 300x150";
    expect(compareFixedParts(portal, frame).differences).toEqual([
      {
        list: "members",
        id: "BC",
        status: "changed",
        counterpartId: null,
        changedFields: [{ field: "sectionId", expected: "I 400x180", actual: "I 300x150" }],
      },
    ]);
  });

  test("a missing part of each list; a node or member that was replaced names its counterpart", () => {
    let learner = redrawMember(portal.referenceModel, "AB", "left", true);
    learner = redrawMember(learner, "DC", "gone", false);
    learner.members = learner.members.filter((member) => member.id !== "gone");
    learner.nodes = learner.nodes.map((node) => (node.id === "C" ? { ...node, id: "c2" } : node));
    learner.nodes = learner.nodes.filter((node) => node.id !== "D");
    learner.sections = learner.sections.filter((section) => section.id !== "I 400x180");
    learner.materials = [];
    learner.loadCases = [];
    // Member BC still names the node id "C": its fields are compared as ids and none differs.
    expect(compareFixedParts(portal, learner).differences).toEqual([
      { list: "nodes", id: "C", status: "missing", counterpartId: "c2", changedFields: [] },
      { list: "nodes", id: "D", status: "missing", counterpartId: null, changedFields: [] },
      { list: "members", id: "AB", status: "missing", counterpartId: "left", changedFields: [] },
      { list: "members", id: "DC", status: "missing", counterpartId: null, changedFields: [] },
      {
        list: "sections",
        id: "I 400x180",
        status: "missing",
        counterpartId: null,
        changedFields: [],
      },
      { list: "materials", id: "steel", status: "missing", counterpartId: null, changedFields: [] },
      { list: "loadCases", id: "LC1", status: "missing", counterpartId: null, changedFields: [] },
    ]);
  });

  test("a missing support and a missing load", () => {
    const learner = copy(choice.referenceModel);
    learner.supports = learner.supports.filter((support) => support.nodeId !== "A");
    learner.memberUniformLoads = learner.memberUniformLoads.filter((load) => load.id !== "w-CB");
    expect(compareFixedParts(choice, learner).differences).toEqual([
      { list: "supports", id: "A", status: "missing", counterpartId: null, changedFields: [] },
      {
        list: "memberUniformLoads",
        id: "w-CB",
        status: "missing",
        counterpartId: null,
        changedFields: [],
      },
    ]);
  });
});
