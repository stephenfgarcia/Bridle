import { type Model, portalFrame } from "@bridle/model";
import { describe, expect, it } from "vitest";
import { addSection, updateMember } from "../model/commands";
import { SECTION_COLOR_TOKENS, sectionColors } from "./sectionColors";

const BOX = { A: 1e-2, Iy: 1e-4, Iz: 1e-4, J: 1e-4, depthY: 0.2, depthZ: 0.2 };

describe("sectionColors", () => {
  it("gives the one section of the portal frame the first colour", () => {
    const { legend, byMember } = sectionColors(portalFrame());
    expect(legend).toEqual([{ sectionId: "s1", name: "I 300x150", color: 0, members: 3 }]);
    expect([...byMember]).toEqual([
      ["c1", 0],
      ["b1", 0],
      ["c2", 0],
    ]);
  });

  it("lists only the sections in use, in the model's order", () => {
    let model = addSection(portalFrame(), { ...BOX, name: "Unused" });
    model = addSection(model, { ...BOX, name: "Columns" });
    model = updateMember(model, { id: "c1", sectionId: "s3" });
    model = updateMember(model, { id: "c2", sectionId: "s3" });
    const { legend, byMember } = sectionColors(model);
    expect(legend).toEqual([
      { sectionId: "s1", name: "I 300x150", color: 0, members: 1 },
      { sectionId: "s3", name: "Columns", color: 1, members: 2 },
    ]);
    expect(byMember.get("c1")).toBe(1);
    expect(byMember.get("b1")).toBe(0);
    expect(byMember.get("c2")).toBe(1);
  });

  it("has six colours; a seventh section in use gets the plain colour", () => {
    expect(SECTION_COLOR_TOKENS).toHaveLength(6);
    expect(new Set(SECTION_COLOR_TOKENS).size).toBe(6);
    const base = portalFrame();
    const template = base.members[0];
    if (!template) {
      throw new Error("the portal frame has members");
    }
    let model: Model = { ...base, members: [] };
    for (let index = 2; index <= 7; index += 1) {
      model = addSection(model, { ...BOX, name: `Box ${index}` });
    }
    model = {
      ...model,
      members: model.sections.map((section, index) => ({
        ...template,
        id: `m${index + 1}`,
        sectionId: section.id,
      })),
    };
    const { legend, byMember } = sectionColors(model);
    expect(legend.map((entry) => entry.color)).toEqual([0, 1, 2, 3, 4, 5, null]);
    expect(byMember.get("m6")).toBe(5);
    expect(byMember.get("m7")).toBeNull();
  });

  it("keeps a section id that only a member names, after the model's sections, under its id", () => {
    const base = portalFrame();
    const model: Model = {
      ...base,
      members: base.members.map((member) =>
        member.id === "c1" ? { ...member, sectionId: "lost" } : member,
      ),
    };
    expect(sectionColors(model).legend).toEqual([
      { sectionId: "s1", name: "I 300x150", color: 0, members: 2 },
      { sectionId: "lost", name: "lost", color: 1, members: 1 },
    ]);
  });

  it("uses no token of the loads, the selection or the hover", () => {
    for (const token of SECTION_COLOR_TOKENS) {
      expect(["--viz-case-E", "--canvas-selection", "--canvas-hover"]).not.toContain(token);
    }
  });

  it("has an empty legend for a model without members", () => {
    const { legend, byMember } = sectionColors({ ...portalFrame(), members: [] });
    expect(legend).toEqual([]);
    expect(byMember.size).toBe(0);
  });
});
