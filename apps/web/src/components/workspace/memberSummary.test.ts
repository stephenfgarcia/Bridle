import { type Member, type Model, planarTruss, portalFrame } from "@bridle/model";
import { describe, expect, it } from "vitest";
import { addSection, updateMember } from "../model/commands";
import { commonValue, releasedRotations, summarizeMembers } from "./memberSummary";

function members(model: Model, ...ids: string[]): Member[] {
  return ids.map((id) => {
    const member = model.members.find((candidate) => candidate.id === id);
    if (!member) {
      throw new Error(`no member ${id}`);
    }
    return member;
  });
}

describe("commonValue", () => {
  it("is none for no value, same for equal values and mixed otherwise", () => {
    expect(commonValue([])).toEqual({ state: "none" });
    expect(commonValue(["s1"])).toEqual({ state: "same", value: "s1" });
    expect(commonValue(["s1", "s1", "s1"])).toEqual({ state: "same", value: "s1" });
    expect(commonValue(["s1", "s2", "s1"])).toEqual({ state: "mixed" });
    expect(commonValue([0, 0])).toEqual({ state: "same", value: 0 });
    expect(commonValue([0, 90])).toEqual({ state: "mixed" });
  });

  it("compares with the function given", () => {
    const close = (a: number, b: number) => Math.abs(a - b) < 0.01;
    expect(commonValue([1, 1.001], close)).toEqual({ state: "same", value: 1 });
    expect(commonValue([1, 1.1], close)).toEqual({ state: "mixed" });
  });
});

describe("releasedRotations", () => {
  it("lists the released rotations in the order rx, ry, rz", () => {
    expect(releasedRotations({ rx: false, ry: false, rz: false })).toEqual([]);
    expect(releasedRotations({ rx: false, ry: true, rz: true })).toEqual(["ry", "rz"]);
  });
});

describe("summarizeMembers", () => {
  it("gives the values of one member", () => {
    const model = portalFrame();
    expect(summarizeMembers(model, members(model, "b1"))).toEqual({
      ids: ["b1"],
      sectionId: { state: "same", value: "s1" },
      materialId: { state: "same", value: "mat1" },
      rollAngleDeg: { state: "same", value: 0 },
      kind: { state: "same", value: "frame" },
      releases: { state: "same", value: { start: [], end: [] } },
      length: { state: "same", value: "6" },
    });
  });

  it("gives what the two columns of the portal share", () => {
    const model = portalFrame();
    const summary = summarizeMembers(model, members(model, "c1", "c2"));
    expect(summary.ids).toEqual(["c1", "c2"]);
    expect(summary.sectionId).toEqual({ state: "same", value: "s1" });
    expect(summary.rollAngleDeg).toEqual({ state: "same", value: 0 });
    expect(summary.length).toEqual({ state: "same", value: "4" });
  });

  it("says mixed for each field in which the members differ, and only for those", () => {
    let model = addSection(portalFrame(), {
      name: "Box",
      A: 1e-2,
      Iy: 1e-4,
      Iz: 1e-4,
      J: 1e-4,
      depthY: 0.2,
      depthZ: 0.2,
    });
    model = updateMember(model, { id: "c1", sectionId: "s2", rollAngleDeg: 90 });
    model = updateMember(model, { id: "b1", releases: { end: { ry: true } } });
    const summary = summarizeMembers(model, members(model, "c1", "b1", "c2"));
    expect(summary.sectionId).toEqual({ state: "mixed" });
    expect(summary.rollAngleDeg).toEqual({ state: "mixed" });
    expect(summary.releases).toEqual({ state: "mixed" });
    expect(summary.length).toEqual({ state: "mixed" });
    expect(summary.materialId).toEqual({ state: "same", value: "mat1" });
    expect(summary.kind).toEqual({ state: "same", value: "frame" });
    // Two members with the same releases share them.
    const released = updateMember(model, { id: "c2", releases: { end: { ry: true } } });
    expect(summarizeMembers(released, members(released, "b1", "c2")).releases).toEqual({
      state: "same",
      value: { start: [], end: ["ry"] },
    });
  });

  it("says mixed for the kind of a frame member beside a truss member", () => {
    const truss = planarTruss();
    const first = truss.members[0];
    const frame = portalFrame().members[0];
    if (!first || !frame) {
      throw new Error("the fixtures have members");
    }
    expect(summarizeMembers(truss, [first]).kind).toEqual({ state: "same", value: "truss" });
    expect(summarizeMembers(truss, [first, { ...frame, kind: "frame" }]).kind).toEqual({
      state: "mixed",
    });
  });

  it("has nothing in common for no member, and no length for a member without its node", () => {
    const model = portalFrame();
    const none = summarizeMembers(model, []);
    expect(none.ids).toEqual([]);
    expect(none.sectionId).toEqual({ state: "none" });
    expect(none.length).toEqual({ state: "none" });
    const [c1] = members(model, "c1");
    const broken = { ...model, nodes: model.nodes.filter((node) => node.id !== "n1") };
    expect(summarizeMembers(broken, c1 ? [c1] : []).length).toEqual({
      state: "same",
      value: null,
    });
  });
});
