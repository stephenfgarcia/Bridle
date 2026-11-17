// Unit tests of the model commands (card PX-02.3, ./commands.ts): what each one changes, what it refuses, the
// ids it gives, and that the lists it does not change stay the same arrays.
import {
  emptyModel,
  type Model,
  planarTruss,
  portalFrame,
  simplySupportedBeam,
  validateModel,
} from "@bridle/model";
import { describe, expect, it } from "vitest";
import {
  addLoadCase,
  addMaterial,
  addMember,
  addMemberPointLoad,
  addMemberUniformLoad,
  addNodalLoad,
  addNode,
  addSection,
  deleteMember,
  deleteNode,
  moveNode,
  nextId,
  nextLoadCaseId,
  nextMaterialId,
  nextMemberId,
  nextMemberPointLoadId,
  nextMemberUniformLoadId,
  nextNodalLoadId,
  nextNodeId,
  nextSectionId,
  removeMemberPointLoad,
  removeMemberUniformLoad,
  removeNodalLoad,
  removeSupport,
  replaceModel,
  setSupport,
  updateMember,
  updateMemberPointLoad,
  updateMemberUniformLoad,
  updateNodalLoad,
} from "./commands";

const LISTS = [
  "nodes",
  "members",
  "sections",
  "materials",
  "supports",
  "loadCases",
  "nodalLoads",
  "memberUniformLoads",
  "memberPointLoads",
] as const;

type ListName = (typeof LISTS)[number];

/** Checks that `after` is a new model in which exactly the lists named are new arrays. */
function expectChanged(before: Model, after: Model, changed: ListName[]): void {
  expect(after).not.toBe(before);
  for (const list of LISTS) {
    if (changed.includes(list)) {
      expect(after[list], list).not.toBe(before[list]);
    } else {
      expect(after[list], list).toBe(before[list]);
    }
  }
  expect(after.version).toBe(before.version);
  expect(after.units).toBe(before.units);
}

/** Runs a command on a deep-frozen model, so a command that wrote to its argument would throw. */
function frozen(model: Model): Model {
  const freeze = (value: unknown): void => {
    if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
      Object.freeze(value);
      for (const child of Object.values(value)) {
        freeze(child);
      }
    }
  };
  freeze(model);
  return model;
}

const SECTION = { name: "Box", A: 1e-2, Iy: 1e-4, Iz: 1e-4, J: 1e-4, depthY: 0.2, depthZ: 0.2 };
const MATERIAL = { name: "C30", E: 3.3e7, G: 1.4e7, fy: 3e4, density: 2500 };
const FIXED = { ux: true, uy: true, uz: true, rx: true, ry: true, rz: true };
const FREE = { ux: false, uy: false, uz: false, rx: false, ry: false, rz: false };

/** The beam with one more node `n3` at (3, 0, 2), a point load `pl1` at 2 m and a nodal load `nl1` on `n2`. */
function loadedBeam(): Model {
  let model = simplySupportedBeam();
  model = addNode(model, { x: 3, y: 0, z: 2 });
  model = addMemberPointLoad(model, { memberId: "m1", value: -5, position: 2 });
  model = addNodalLoad(model, { nodeId: "n2", fz: -1 });
  return frozen(model);
}

describe("ids", () => {
  it("gives the next number after the largest one with the prefix", () => {
    expect(nextId([], "n")).toBe("n1");
    expect(nextId([{ id: "n1" }, { id: "n4" }], "n")).toBe("n5");
    expect(nextId([{ id: "n4" }, { id: "n2" }], "n")).toBe("n5");
    // Ids of another shape do not count: another prefix, no number, a longer prefix.
    expect(
      nextId([{ id: "a" }, { id: "n" }, { id: "nl7" }, { id: "x9" }, { id: "n2b" }], "n"),
    ).toBe("n1");
    expect(nextId([{ id: "n007" }], "n")).toBe("n8");
    expect(nextId([{ id: "nl1" }, { id: "nl2" }], "nl")).toBe("nl3");
  });

  it("never gives an id in use", () => {
    // 16 digits are not read as a number; the id after 15 nines is skipped because it is taken.
    const list = [{ id: "n999999999999999" }, { id: "n1000000000000000" }];
    const id = nextId(list, "n");
    expect(list.map((item) => item.id)).not.toContain(id);
    expect(id).toBe("n1000000000000001");
  });

  it("names the next id of each list of the fixtures", () => {
    const portal = portalFrame();
    expect(nextNodeId(portal)).toBe("n5");
    // The portal frame's members are c1, b1, c2: none has the prefix m.
    expect(nextMemberId(portal)).toBe("m1");
    expect(nextMemberId(simplySupportedBeam())).toBe("m2");
    expect(nextSectionId(portal)).toBe("s2");
    expect(nextMaterialId(portal)).toBe("mat2");
    expect(nextLoadCaseId(portal)).toBe("lc2");
    expect(nextNodalLoadId(portal)).toBe("nl2");
    expect(nextNodalLoadId(planarTruss())).toBe("nl3");
    expect(nextMemberUniformLoadId(simplySupportedBeam())).toBe("ul2");
    expect(nextMemberPointLoadId(portal)).toBe("pl1");
  });

  it("gives a freed id again and counts on while adding", () => {
    let model = portalFrame();
    model = addNode(model, { x: 1, y: 0, z: 0 });
    model = addNode(model, { x: 2, y: 0, z: 0 });
    expect(model.nodes.map((node) => node.id)).toEqual(["n1", "n2", "n3", "n4", "n5", "n6"]);
    model = deleteNode(model, { id: "n6" });
    expect(nextNodeId(model)).toBe("n6");
    model = deleteNode(model, { id: "n2" });
    // n2 is free, but the next id follows the largest one: n6.
    expect(nextNodeId(model)).toBe("n6");
  });
});

describe("nodes", () => {
  it("addNode appends a node with the next id", () => {
    const before = frozen(portalFrame());
    const after = addNode(before, { x: 1.5, y: -2, z: 3 });
    expectChanged(before, after, ["nodes"]);
    expect(after.nodes).toHaveLength(5);
    expect(after.nodes[4]).toEqual({ id: "n5", x: 1.5, y: -2, z: 3 });
    expect(after.nodes[0]).toBe(before.nodes[0]);
  });

  it("addNode refuses a coordinate that is not finite, and accepts the place of another node", () => {
    const before = frozen(portalFrame());
    expect(addNode(before, { x: Number.NaN, y: 0, z: 0 })).toBe(before);
    expect(addNode(before, { x: 0, y: Number.POSITIVE_INFINITY, z: 0 })).toBe(before);
    expect(addNode(before, { x: 0, y: 0, z: 0 }).nodes).toHaveLength(5);
  });

  it("moveNode changes one node and keeps the others", () => {
    const before = frozen(portalFrame());
    const after = moveNode(before, { id: "n2", x: 0, y: 0, z: 5 });
    expectChanged(before, after, ["nodes"]);
    expect(after.nodes[1]).toEqual({ id: "n2", x: 0, y: 0, z: 5 });
    expect(after.nodes[0]).toBe(before.nodes[0]);
    expect(after.nodes[2]).toBe(before.nodes[2]);
  });

  it("moveNode returns the same model for the same place, a missing node or a bad coordinate", () => {
    const before = frozen(portalFrame());
    expect(moveNode(before, { id: "n2", x: 0, y: 0, z: 4 })).toBe(before);
    expect(moveNode(before, { id: "n9", x: 1, y: 1, z: 1 })).toBe(before);
    expect(moveNode(before, { id: "n2", x: 0, y: Number.NaN, z: 4 })).toBe(before);
  });

  it("deleteNode removes the node with its members, their loads, its support and its nodal loads", () => {
    // The beam: n1 carries the support, m1 (with the uniform load ul1 and the point load pl1) ends at n1.
    const before = loadedBeam();
    const after = deleteNode(before, { id: "n1" });
    expectChanged(before, after, [
      "nodes",
      "members",
      "supports",
      "memberUniformLoads",
      "memberPointLoads",
    ]);
    expect(after.nodes.map((node) => node.id)).toEqual(["n2", "n3"]);
    expect(after.members).toEqual([]);
    expect(after.supports.map((support) => support.nodeId)).toEqual(["n2"]);
    expect(after.memberUniformLoads).toEqual([]);
    expect(after.memberPointLoads).toEqual([]);
    expect(after.nodalLoads.map((load) => load.id)).toEqual(["nl1"]);
  });

  it("deleteNode removes the nodal loads on the node and keeps the members that do not touch it", () => {
    const before = frozen(portalFrame());
    // n2: the top of the left column, with the nodal load nl1, no support; c1 and b1 touch it.
    const after = deleteNode(before, { id: "n2" });
    expectChanged(before, after, ["nodes", "members", "nodalLoads"]);
    expect(after.members.map((member) => member.id)).toEqual(["c2"]);
    expect(after.members[0]).toBe(before.members[2]);
    expect(after.nodalLoads).toEqual([]);
    expect(after.supports).toHaveLength(2);
  });

  it("deleteNode of a node with nothing on it changes only the nodes, and refuses a missing id", () => {
    const before = loadedBeam();
    const after = deleteNode(before, { id: "n3" });
    expectChanged(before, after, ["nodes"]);
    expect(deleteNode(before, { id: "n9" })).toBe(before);
  });
});

describe("members", () => {
  it("addMember joins two nodes with the defaults", () => {
    const before = frozen(portalFrame());
    const after = addMember(before, { startNodeId: "n1", endNodeId: "n3" });
    expectChanged(before, after, ["members"]);
    expect(after.members[3]).toEqual({
      id: "m1",
      startNodeId: "n1",
      endNodeId: "n3",
      sectionId: "s1",
      materialId: "mat1",
      kind: "frame",
      rollAngleDeg: 0,
      releases: {
        start: { rx: false, ry: false, rz: false },
        end: { rx: false, ry: false, rz: false },
      },
    });
    expect(validateModel(after)).toEqual([]);
  });

  it("addMember takes the section, material, kind, roll angle and releases given", () => {
    let model = addSection(portalFrame(), SECTION);
    model = addMaterial(model, MATERIAL);
    const after = addMember(model, {
      startNodeId: "n4",
      endNodeId: "n2",
      sectionId: "s2",
      materialId: "mat2",
      kind: "truss",
      rollAngleDeg: 90,
      releases: { end: { ry: true } },
    });
    expect(after.members[3]).toMatchObject({
      id: "m1",
      sectionId: "s2",
      materialId: "mat2",
      kind: "truss",
      rollAngleDeg: 90,
      releases: {
        start: { rx: false, ry: false, rz: false },
        end: { rx: false, ry: true, rz: false },
      },
    });
    // Two members never share a release object.
    const [first, second] = [
      after.members[3],
      addMember(after, { startNodeId: "n1", endNodeId: "n3" }).members[4],
    ];
    expect(first?.releases.start).not.toBe(first?.releases.end);
    expect(first?.releases.start).not.toBe(second?.releases.start);
  });

  it("addMember refuses what it cannot join", () => {
    const before = frozen(portalFrame());
    const refused: Parameters<typeof addMember>[1][] = [
      { startNodeId: "n1", endNodeId: "n1" },
      { startNodeId: "n1", endNodeId: "n9" },
      { startNodeId: "n9", endNodeId: "n1" },
      // c1 already joins n1 and n2, in that direction.
      { startNodeId: "n1", endNodeId: "n2" },
      { startNodeId: "n2", endNodeId: "n1" },
      { startNodeId: "n1", endNodeId: "n3", sectionId: "s9" },
      { startNodeId: "n1", endNodeId: "n3", materialId: "mat9" },
      { startNodeId: "n1", endNodeId: "n3", kind: "cable" as never },
      { startNodeId: "n1", endNodeId: "n3", rollAngleDeg: Number.NaN },
    ];
    for (const args of refused) {
      expect(addMember(before, args), JSON.stringify(args)).toBe(before);
    }
  });

  it("addMember refuses two nodes at one place, and a model with no section or no material", () => {
    const twin = frozen(addNode(portalFrame(), { x: 0, y: 0, z: 0 }));
    expect(addMember(twin, { startNodeId: "n1", endNodeId: "n5" })).toBe(twin);
    let bare = addNode(emptyModel(), { x: 0, y: 0, z: 0 });
    bare = addNode(bare, { x: 1, y: 0, z: 0 });
    expect(addMember(bare, { startNodeId: "n1", endNodeId: "n2" })).toBe(bare);
    const withSection = addSection(bare, SECTION);
    expect(addMember(withSection, { startNodeId: "n1", endNodeId: "n2" })).toBe(withSection);
    const withBoth = addMaterial(withSection, MATERIAL);
    expect(addMember(withBoth, { startNodeId: "n1", endNodeId: "n2" }).members).toHaveLength(1);
  });

  it("deleteMember removes the member with its uniform and point loads, and keeps its nodes", () => {
    const before = loadedBeam();
    const after = deleteMember(before, { id: "m1" });
    expectChanged(before, after, ["members", "memberUniformLoads", "memberPointLoads"]);
    expect(after.members).toEqual([]);
    expect(after.memberUniformLoads).toEqual([]);
    expect(after.memberPointLoads).toEqual([]);
    expect(after.nodes).toHaveLength(3);
    expect(after.nodalLoads).toHaveLength(1);
  });

  it("deleteMember of a member without loads changes only the members, and refuses a missing id", () => {
    const before = frozen(portalFrame());
    const after = deleteMember(before, { id: "b1" });
    expectChanged(before, after, ["members"]);
    expect(after.members.map((member) => member.id)).toEqual(["c1", "c2"]);
    expect(deleteMember(before, { id: "m9" })).toBe(before);
  });

  it("updateMember changes the section, the material, the kind, the roll angle and the releases", () => {
    let model = addSection(portalFrame(), SECTION);
    model = frozen(addMaterial(model, MATERIAL));
    const cases: [Parameters<typeof updateMember>[1], object][] = [
      [{ id: "b1", sectionId: "s2" }, { sectionId: "s2" }],
      [{ id: "b1", materialId: "mat2" }, { materialId: "mat2" }],
      [{ id: "b1", kind: "truss" }, { kind: "truss" }],
      [{ id: "b1", rollAngleDeg: 45 }, { rollAngleDeg: 45 }],
      [
        { id: "b1", releases: { start: { rz: true } } },
        {
          releases: {
            start: { rx: false, ry: false, rz: true },
            end: { rx: false, ry: false, rz: false },
          },
        },
      ],
    ];
    for (const [args, expected] of cases) {
      const after = updateMember(model, args);
      expectChanged(model, after, ["members"]);
      expect(after.members[1]).toEqual({ ...model.members[1], ...expected });
      expect(after.members[0]).toBe(model.members[0]);
    }
    // A release of one end keeps the object of the other end.
    const released = updateMember(model, { id: "b1", releases: { start: { rz: true } } });
    expect(released.members[1]?.releases.end).toBe(model.members[1]?.releases.end);
  });

  it("updateMember returns the same model when nothing differs or an argument is refused", () => {
    const before = frozen(portalFrame());
    const same: Parameters<typeof updateMember>[1][] = [
      { id: "b1" },
      { id: "b1", sectionId: "s1", materialId: "mat1", kind: "frame", rollAngleDeg: 0 },
      { id: "b1", releases: { start: { rx: false }, end: {} } },
      { id: "m9", kind: "truss" },
      { id: "b1", sectionId: "s9" },
      { id: "b1", materialId: "mat9" },
      { id: "b1", kind: "cable" as never },
      { id: "b1", rollAngleDeg: Number.POSITIVE_INFINITY },
      // One refused part refuses the whole update.
      { id: "b1", kind: "truss", sectionId: "s9" },
    ];
    for (const args of same) {
      expect(updateMember(before, args), JSON.stringify(args)).toBe(before);
    }
  });
});

describe("supports", () => {
  it("setSupport adds a support to a node without one", () => {
    const before = frozen(portalFrame());
    const after = setSupport(before, { nodeId: "n2", ...FREE, uz: true });
    expectChanged(before, after, ["supports"]);
    expect(after.supports).toHaveLength(3);
    expect(after.supports[2]).toEqual({ nodeId: "n2", ...FREE, uz: true });
  });

  it("setSupport replaces the support a node has, in its place", () => {
    const before = frozen(portalFrame());
    const after = setSupport(before, { nodeId: "n1", ...FIXED, rx: false, ry: false, rz: false });
    expectChanged(before, after, ["supports"]);
    expect(after.supports).toHaveLength(2);
    expect(after.supports[0]).toEqual({ nodeId: "n1", ...FIXED, rx: false, ry: false, rz: false });
    expect(after.supports[1]).toBe(before.supports[1]);
  });

  it("setSupport returns the same model for the same restraints or a missing node", () => {
    const before = frozen(portalFrame());
    expect(setSupport(before, { nodeId: "n1", ...FIXED })).toBe(before);
    expect(setSupport(before, { nodeId: "n9", ...FIXED })).toBe(before);
  });

  it("setSupport with nothing restrained removes the support", () => {
    const before = frozen(portalFrame());
    const after = setSupport(before, { nodeId: "n1", ...FREE });
    expect(after.supports.map((support) => support.nodeId)).toEqual(["n4"]);
    // On a node without a support there is nothing to remove.
    expect(setSupport(before, { nodeId: "n2", ...FREE })).toBe(before);
  });

  it("setSupport leaves one support on a node that had two", () => {
    const portal = portalFrame();
    const doubled = frozen({
      ...portal,
      supports: [...portal.supports, { nodeId: "n1", ...FREE, ux: true }],
    });
    const after = setSupport(doubled, { nodeId: "n1", ...FIXED });
    expect(after.supports).toEqual([
      { nodeId: "n1", ...FIXED },
      { nodeId: "n4", ...FIXED },
    ]);
  });

  it("removeSupport removes the support of a node, and refuses a node without one", () => {
    const before = frozen(portalFrame());
    const after = removeSupport(before, { nodeId: "n4" });
    expectChanged(before, after, ["supports"]);
    expect(after.supports.map((support) => support.nodeId)).toEqual(["n1"]);
    expect(removeSupport(before, { nodeId: "n2" })).toBe(before);
    expect(removeSupport(before, { nodeId: "n9" })).toBe(before);
  });
});

describe("nodal loads", () => {
  it("addNodalLoad adds a load with the next id, the first load case and zeros for what is left out", () => {
    const before = frozen(portalFrame());
    const after = addNodalLoad(before, { nodeId: "n3", fz: -12, my: 3 });
    expectChanged(before, after, ["nodalLoads"]);
    expect(after.nodalLoads[1]).toEqual({
      id: "nl2",
      loadCaseId: "lc1",
      nodeId: "n3",
      fx: 0,
      fy: 0,
      fz: -12,
      mx: 0,
      my: 3,
      mz: 0,
    });
    const other = addNodalLoad(addLoadCase(before, { name: "Wind" }), {
      nodeId: "n3",
      loadCaseId: "lc2",
    });
    expect(other.nodalLoads[1]?.loadCaseId).toBe("lc2");
  });

  it("addNodalLoad refuses a missing node, a missing load case and a component that is not finite", () => {
    const before = frozen(portalFrame());
    expect(addNodalLoad(before, { nodeId: "n9", fz: -1 })).toBe(before);
    expect(addNodalLoad(before, { nodeId: "n3", loadCaseId: "lc9" })).toBe(before);
    expect(addNodalLoad(before, { nodeId: "n3", mz: Number.NaN })).toBe(before);
    const noCase = frozen({ ...portalFrame(), loadCases: [] });
    expect(addNodalLoad(noCase, { nodeId: "n3", fz: -1 })).toBe(noCase);
  });

  it("updateNodalLoad changes what is given", () => {
    const before = frozen(addLoadCase(portalFrame(), { name: "Wind" }));
    const after = updateNodalLoad(before, { id: "nl1", fx: 25, nodeId: "n3", loadCaseId: "lc2" });
    expectChanged(before, after, ["nodalLoads"]);
    expect(after.nodalLoads[0]).toEqual({
      ...before.nodalLoads[0],
      fx: 25,
      nodeId: "n3",
      loadCaseId: "lc2",
    });
  });

  it("updateNodalLoad returns the same model when nothing differs or an argument is refused", () => {
    const before = frozen(portalFrame());
    const same: Parameters<typeof updateNodalLoad>[1][] = [
      { id: "nl1" },
      { id: "nl1", fx: 20, nodeId: "n2" },
      { id: "nl9", fx: 1 },
      { id: "nl1", nodeId: "n9" },
      { id: "nl1", loadCaseId: "lc9" },
      { id: "nl1", fx: 1, fz: Number.NaN },
    ];
    for (const args of same) {
      expect(updateNodalLoad(before, args), JSON.stringify(args)).toBe(before);
    }
  });

  it("removeNodalLoad removes the load, and refuses a missing id", () => {
    const before = frozen(planarTruss());
    const after = removeNodalLoad(before, { id: "nl1" });
    expectChanged(before, after, ["nodalLoads"]);
    expect(after.nodalLoads.map((load) => load.id)).toEqual(["nl2"]);
    expect(removeNodalLoad(before, { id: "nl9" })).toBe(before);
  });
});

describe("member uniform loads", () => {
  it("addMemberUniformLoad adds a load with the next id and the defaults", () => {
    const before = frozen(simplySupportedBeam());
    const after = addMemberUniformLoad(before, { memberId: "m1", value: -4 });
    expectChanged(before, after, ["memberUniformLoads"]);
    expect(after.memberUniformLoads[1]).toEqual({
      id: "ul2",
      loadCaseId: "lc1",
      memberId: "m1",
      axes: "global",
      direction: "z",
      value: -4,
    });
    const local = addMemberUniformLoad(before, {
      memberId: "m1",
      value: 2,
      axes: "local",
      direction: "y",
    });
    expect(local.memberUniformLoads[1]).toMatchObject({ axes: "local", direction: "y", value: 2 });
  });

  it("addMemberUniformLoad refuses what it cannot place", () => {
    const before = frozen(simplySupportedBeam());
    const refused: Parameters<typeof addMemberUniformLoad>[1][] = [
      { memberId: "m9", value: -4 },
      { memberId: "m1", value: Number.NaN },
      { memberId: "m1", value: -4, loadCaseId: "lc9" },
      { memberId: "m1", value: -4, axes: "world" as never },
      { memberId: "m1", value: -4, direction: "w" as never },
    ];
    for (const args of refused) {
      expect(addMemberUniformLoad(before, args), JSON.stringify(args)).toBe(before);
    }
  });

  it("updateMemberUniformLoad changes what is given, and returns the same model otherwise", () => {
    const before = frozen(simplySupportedBeam());
    const after = updateMemberUniformLoad(before, { id: "ul1", value: -15, axes: "local" });
    expectChanged(before, after, ["memberUniformLoads"]);
    expect(after.memberUniformLoads[0]).toEqual({
      ...before.memberUniformLoads[0],
      value: -15,
      axes: "local",
    });
    const same: Parameters<typeof updateMemberUniformLoad>[1][] = [
      { id: "ul1" },
      { id: "ul1", value: -10, direction: "z" },
      { id: "ul9", value: 1 },
      { id: "ul1", memberId: "m9" },
      { id: "ul1", loadCaseId: "lc9" },
      { id: "ul1", axes: "world" as never },
      { id: "ul1", direction: "w" as never },
      { id: "ul1", value: Number.NaN },
    ];
    for (const args of same) {
      expect(updateMemberUniformLoad(before, args), JSON.stringify(args)).toBe(before);
    }
  });

  it("removeMemberUniformLoad removes the load, and refuses a missing id", () => {
    const before = frozen(simplySupportedBeam());
    const after = removeMemberUniformLoad(before, { id: "ul1" });
    expectChanged(before, after, ["memberUniformLoads"]);
    expect(after.memberUniformLoads).toEqual([]);
    expect(removeMemberUniformLoad(before, { id: "ul9" })).toBe(before);
  });
});

describe("member point loads", () => {
  it("addMemberPointLoad adds a load with the next id and the defaults", () => {
    const before = frozen(simplySupportedBeam());
    const after = addMemberPointLoad(before, { memberId: "m1", value: -5, position: 2 });
    expectChanged(before, after, ["memberPointLoads"]);
    expect(after.memberPointLoads[0]).toEqual({
      id: "pl1",
      loadCaseId: "lc1",
      memberId: "m1",
      axes: "global",
      direction: "z",
      value: -5,
      position: 2,
    });
    // Both ends of the 6 m member are places on it.
    expect(addMemberPointLoad(before, { memberId: "m1", value: 1, position: 0 })).not.toBe(before);
    expect(addMemberPointLoad(before, { memberId: "m1", value: 1, position: 6 })).not.toBe(before);
    expect(validateModel(after)).toEqual([]);
  });

  it("addMemberPointLoad refuses what it cannot place", () => {
    const before = frozen(simplySupportedBeam());
    const refused: Parameters<typeof addMemberPointLoad>[1][] = [
      { memberId: "m9", value: -5, position: 2 },
      { memberId: "m1", value: Number.NaN, position: 2 },
      { memberId: "m1", value: -5, position: Number.NaN },
      { memberId: "m1", value: -5, position: -0.1 },
      { memberId: "m1", value: -5, position: 6.1 },
      { memberId: "m1", value: -5, position: 2, loadCaseId: "lc9" },
      { memberId: "m1", value: -5, position: 2, axes: "world" as never },
      { memberId: "m1", value: -5, position: 2, direction: "w" as never },
    ];
    for (const args of refused) {
      expect(addMemberPointLoad(before, args), JSON.stringify(args)).toBe(before);
    }
  });

  it("updateMemberPointLoad changes what is given, and returns the same model otherwise", () => {
    const before = loadedBeam();
    const after = updateMemberPointLoad(before, { id: "pl1", position: 4, value: -8 });
    expectChanged(before, after, ["memberPointLoads"]);
    expect(after.memberPointLoads[0]).toEqual({
      ...before.memberPointLoads[0],
      position: 4,
      value: -8,
    });
    const same: Parameters<typeof updateMemberPointLoad>[1][] = [
      { id: "pl1" },
      { id: "pl1", position: 2, value: -5 },
      { id: "pl9", value: 1 },
      { id: "pl1", memberId: "m9" },
      { id: "pl1", loadCaseId: "lc9" },
      { id: "pl1", axes: "world" as never },
      { id: "pl1", direction: "w" as never },
      { id: "pl1", value: Number.NaN },
      { id: "pl1", position: Number.NaN },
      { id: "pl1", position: 7 },
      { id: "pl1", position: -1 },
    ];
    for (const args of same) {
      expect(updateMemberPointLoad(before, args), JSON.stringify(args)).toBe(before);
    }
  });

  it("updateMemberPointLoad checks the position against the member the load moves to", () => {
    // A second member m2 from n2 to n3, about 3.6 m long: a load at 5 m fits m1 (6 m) and not m2.
    let model = loadedBeam();
    model = addMember(model, { startNodeId: "n2", endNodeId: "n3" });
    model = frozen(updateMemberPointLoad(model, { id: "pl1", position: 5 }));
    expect(model.memberPointLoads[0]?.position).toBe(5);
    expect(updateMemberPointLoad(model, { id: "pl1", memberId: "m2" })).toBe(model);
    const moved = updateMemberPointLoad(model, { id: "pl1", memberId: "m2", position: 1 });
    expect(moved.memberPointLoads[0]).toMatchObject({ memberId: "m2", position: 1 });
  });

  it("removeMemberPointLoad removes the load, and refuses a missing id", () => {
    const before = loadedBeam();
    const after = removeMemberPointLoad(before, { id: "pl1" });
    expectChanged(before, after, ["memberPointLoads"]);
    expect(after.memberPointLoads).toEqual([]);
    expect(removeMemberPointLoad(before, { id: "pl9" })).toBe(before);
  });
});

describe("sections, materials, load cases", () => {
  it("addSection adds a section with the next id", () => {
    const before = frozen(portalFrame());
    const after = addSection(before, SECTION);
    expectChanged(before, after, ["sections"]);
    expect(after.sections[1]).toEqual({ id: "s2", ...SECTION });
  });

  it("addSection refuses a value that is not a finite number above zero", () => {
    const before = frozen(portalFrame());
    for (const field of ["A", "Iy", "Iz", "J", "depthY", "depthZ"] as const) {
      for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(addSection(before, { ...SECTION, [field]: bad }), `${field} ${bad}`).toBe(before);
      }
    }
  });

  it("addMaterial adds a material with the next id", () => {
    const before = frozen(portalFrame());
    const after = addMaterial(before, MATERIAL);
    expectChanged(before, after, ["materials"]);
    expect(after.materials[1]).toEqual({ id: "mat2", ...MATERIAL });
    // A density of zero is accepted.
    expect(addMaterial(before, { ...MATERIAL, density: 0 }).materials).toHaveLength(2);
  });

  it("addMaterial refuses E, G or fy that is not above zero and a density below zero or not finite", () => {
    const before = frozen(portalFrame());
    for (const field of ["E", "G", "fy"] as const) {
      for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(addMaterial(before, { ...MATERIAL, [field]: bad }), `${field} ${bad}`).toBe(before);
      }
    }
    expect(addMaterial(before, { ...MATERIAL, density: -1 })).toBe(before);
    expect(addMaterial(before, { ...MATERIAL, density: Number.NaN })).toBe(before);
  });

  it("addLoadCase adds a load case with the next id", () => {
    const before = frozen(portalFrame());
    const after = addLoadCase(before, { name: "Wind" });
    expectChanged(before, after, ["loadCases"]);
    expect(after.loadCases).toEqual([
      { id: "lc1", name: "LC1" },
      { id: "lc2", name: "Wind" },
    ]);
  });
});

describe("the whole model", () => {
  it("replaceModel returns the model given, the same object", () => {
    const before = frozen(portalFrame());
    const next = planarTruss();
    expect(replaceModel(before, { model: next })).toBe(next);
    expect(replaceModel(before, { model: before })).toBe(before);
  });

  it("a model built with the commands from the empty model is valid", () => {
    let model = emptyModel();
    model = addSection(model, SECTION);
    model = addMaterial(model, MATERIAL);
    model = addLoadCase(model, { name: "Dead" });
    model = addNode(model, { x: 0, y: 0, z: 0 });
    model = addNode(model, { x: 4, y: 0, z: 0 });
    model = addMember(model, { startNodeId: "n1", endNodeId: "n2" });
    model = setSupport(model, { nodeId: "n1", ...FIXED });
    model = addMemberUniformLoad(model, { memberId: "m1", value: -3 });
    model = addMemberPointLoad(model, { memberId: "m1", value: -3, position: 4 });
    model = addNodalLoad(model, { nodeId: "n2", fz: -10 });
    expect(validateModel(model)).toEqual([]);
    expect(model.members[0]).toMatchObject({ id: "m1", sectionId: "s1", materialId: "mat1" });
    expect(model.memberUniformLoads[0]?.id).toBe("ul1");
    expect(model.memberPointLoads[0]?.id).toBe("pl1");
    expect(model.nodalLoads[0]).toMatchObject({ id: "nl1", loadCaseId: "lc1" });
  });
});
