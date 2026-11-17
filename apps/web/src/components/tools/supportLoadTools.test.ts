// Unit tests of the Support tool, the Load tool, "Restrain out of plane" and the lines of a nodal load
// (card PX-02.5, ./supportLoadTools.ts). The models are deep-frozen, so a write to an argument would throw.
import { type Model, planarTruss, portalFrame, type Support, validateModel } from "@bridle/model";
import { describe, expect, it } from "vitest";
import { supportGlyph } from "../viewport/scene";
import { newModel } from "./newModel";
import {
  DEFAULT_LOAD_FORM,
  DEFAULT_SUPPORT_CHOICE,
  formComponent,
  isMoment,
  loadToolClick,
  NODAL_COMPONENTS,
  nodalLoadEdit,
  nodalLoadRows,
  RESTRAINT_KEYS,
  restrainOutOfPlane,
  restraintsOf,
  SUPPORT_CHOICES,
  supportRestraints,
  supportToolClick,
  withRestraint,
} from "./supportLoadTools";
import type { ToolCursor } from "./workPlane";

function freeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) {
      freeze(inner);
    }
  }
  return value;
}

const at = (x: number, y: number, z: number, nodeId: string | null = null): ToolCursor => ({
  point: [x, y, z],
  nodeId,
});
const portal = () => freeze(portalFrame());
/** The restraints of a node as the names of the restrained ones, in the order ux .. rz. */
const held = (model: Model, nodeId: string) => {
  const restraints = restraintsOf(model, nodeId);
  return RESTRAINT_KEYS.filter((key) => restraints[key]).join(" ");
};
const supportOf = (model: Model, nodeId: string): Support | undefined =>
  model.supports.find((support) => support.nodeId === nodeId);

describe("the choices of the Support tool", () => {
  it("are Fixed, Pinned and Roller, Fixed first", () => {
    expect(SUPPORT_CHOICES).toEqual(["fixed", "pinned", "roller"]);
    expect(DEFAULT_SUPPORT_CHOICE).toBe("fixed");
  });

  it("Fixed restrains all six", () => {
    expect(supportRestraints("fixed")).toEqual({
      ux: true,
      uy: true,
      uz: true,
      rx: true,
      ry: true,
      rz: true,
    });
  });

  it("Pinned restrains the three translations and no rotation", () => {
    expect(supportRestraints("pinned")).toEqual({
      ux: true,
      uy: true,
      uz: true,
      rx: false,
      ry: false,
      rz: false,
    });
  });

  it("Roller restrains uz and the out-of-plane uy, and leaves ux and the rotations free", () => {
    expect(supportRestraints("roller")).toEqual({
      ux: false,
      uy: true,
      uz: true,
      rx: false,
      ry: false,
      rz: false,
    });
  });

  it("each choice is drawn with the glyph of its name", () => {
    for (const choice of SUPPORT_CHOICES) {
      expect(supportGlyph({ nodeId: "n1", ...supportRestraints(choice) })).toBe(choice);
    }
  });
});

describe("a click of the Support tool", () => {
  it("sets the chosen support on a node that has none", () => {
    const model = portal();
    const result = supportToolClick(model, at(0, 0, 4, "n2"), "pinned");
    expect(result.nodeId).toBe("n2");
    expect(result.notice).toBeNull();
    expect(result.model).not.toBe(model);
    expect(held(result.model, "n2")).toBe("ux uy uz");
    expect(result.model.supports).toHaveLength(3);
    expect(validateModel(result.model)).toEqual([]);
  });

  it("finds the node at the cursor's point when the pointer picked none", () => {
    const result = supportToolClick(portal(), at(6, 0, 4), "roller");
    expect(result.nodeId).toBe("n3");
    expect(held(result.model, "n3")).toBe("uy uz");
  });

  it("replaces another support of the node", () => {
    const model = portal();
    expect(held(model, "n1")).toBe("ux uy uz rx ry rz");
    const result = supportToolClick(model, at(0, 0, 0, "n1"), "roller");
    expect(held(result.model, "n1")).toBe("uy uz");
    expect(result.model.supports).toHaveLength(2);
    expect(result.notice).toBeNull();
  });

  it("removes the support of a node that already has exactly that support", () => {
    const model = portal();
    const result = supportToolClick(model, at(0, 0, 0, "n1"), "fixed");
    expect(supportOf(result.model, "n1")).toBeUndefined();
    expect(result.model.supports).toHaveLength(1);
    expect(result.nodeId).toBe("n1");
    expect(result.notice).toBeNull();
    // A second click sets it again.
    const again = supportToolClick(result.model, at(0, 0, 0, "n1"), "fixed");
    expect(held(again.model, "n1")).toBe("ux uy uz rx ry rz");
  });

  it("away from a node it changes nothing and asks for a node", () => {
    const model = portal();
    const result = supportToolClick(model, at(3, 0, 2), "fixed");
    expect(result.model).toBe(model);
    expect(result.nodeId).toBeNull();
    expect(result.notice).toBe("needs-node");
    // A picked node the model no longer holds, away from every node, is no node either.
    expect(supportToolClick(model, at(3, 0, 2, "gone"), "fixed").notice).toBe("needs-node");
  });
});

describe("one restraint of a node (the checkboxes)", () => {
  it("sets and clears one restraint and keeps the other five", () => {
    const model = portal();
    const free = withRestraint(model, "n1", "ry", false);
    expect(held(free, "n1")).toBe("ux uy uz rx rz");
    const added = withRestraint(model, "n2", "uy", true);
    expect(held(added, "n2")).toBe("uy");
    expect(added.supports).toHaveLength(3);
    // Any combination can be reached.
    const mixed = withRestraint(withRestraint(added, "n2", "rz", true), "n2", "ux", true);
    expect(held(mixed, "n2")).toBe("ux uy rz");
  });

  it("clearing the last one removes the support, and the value it has changes nothing", () => {
    const model = withRestraint(portal(), "n2", "uy", true);
    const cleared = withRestraint(model, "n2", "uy", false);
    expect(supportOf(cleared, "n2")).toBeUndefined();
    expect(withRestraint(model, "n2", "uy", true)).toBe(model);
    expect(withRestraint(model, "n3", "uy", false)).toBe(model);
    expect(withRestraint(model, "gone", "uy", true)).toBe(model);
  });
});

describe("Restrain out of plane", () => {
  it("adds uy, rx and rz to every node of a frame in one X-Z plane and keeps what they had", () => {
    const model = portal();
    const result = restrainOutOfPlane(model);
    expect(result.outcome).toBe("done");
    // n1 and n4 are fixed already; n2 and n3 had no support.
    expect(result.changed).toBe(2);
    expect(result.model).not.toBe(model);
    expect(result.model.supports).toHaveLength(4);
    expect(held(result.model, "n1")).toBe("ux uy uz rx ry rz");
    expect(held(result.model, "n2")).toBe("uy rx rz");
    expect(held(result.model, "n3")).toBe("uy rx rz");
    expect(held(result.model, "n4")).toBe("ux uy uz rx ry rz");
    expect(validateModel(result.model)).toEqual([]);
    // The model given is untouched (it is frozen) and its own lists are kept where nothing changed.
    expect(result.model.nodes).toBe(model.nodes);
    expect(result.model.members).toBe(model.members);
  });

  it("the supports it creates are drawn as the small mark, the real ones keep their glyphs", () => {
    const truss = restrainOutOfPlane(freeze(planarTruss()));
    expect(truss.outcome).toBe("done");
    expect(truss.changed).toBe(5);
    expect(held(truss.model, "n1")).toBe("ux uy uz rx rz");
    expect(held(truss.model, "n3")).toBe("uy uz rx rz");
    expect(held(truss.model, "n2")).toBe("uy rx rz");
    expect(truss.model.supports.map((support) => [support.nodeId, supportGlyph(support)])).toEqual([
      ["n1", "pinned"],
      ["n2", "plane"],
      ["n3", "roller"],
      ["n4", "plane"],
      ["n5", "plane"],
    ]);
  });

  it("a second time changes nothing and says that every node has them", () => {
    const once = restrainOutOfPlane(portal()).model;
    const twice = restrainOutOfPlane(once);
    expect(twice.model).toBe(once);
    expect(twice.outcome).toBe("already");
    expect(twice.changed).toBe(0);
  });

  it("works in an X-Z plane away from Y = 0", () => {
    const base = portalFrame();
    const moved = freeze({ ...base, nodes: base.nodes.map((node) => ({ ...node, y: 2.5 })) });
    expect(restrainOutOfPlane(moved).outcome).toBe("done");
  });

  it("refuses a model without a node", () => {
    const model = freeze(newModel());
    expect(restrainOutOfPlane(model)).toEqual({ model, outcome: "no-nodes", changed: 0 });
  });

  it("refuses a model whose nodes do not share one Y, or whose Y is not a finite number", () => {
    const base = portalFrame();
    const spatial = freeze({
      ...base,
      nodes: base.nodes.map((node) => (node.id === "n3" ? { ...node, y: 0.5 } : node)),
    });
    const refused = restrainOutOfPlane(spatial);
    expect(refused.model).toBe(spatial);
    expect(refused.outcome).toBe("not-planar");
    expect(refused.changed).toBe(0);
    const broken = freeze({
      ...base,
      nodes: base.nodes.map((node) => ({ ...node, y: Number.NaN })),
    });
    expect(restrainOutOfPlane(broken).outcome).toBe("not-planar");
    // A frame in an X-Y plane (a plan) is not in one X-Z plane either.
    const plan = freeze({
      ...base,
      nodes: base.nodes.map((node) => ({ ...node, y: node.z, z: 0 })),
    });
    expect(restrainOutOfPlane(plan).outcome).toBe("not-planar");
  });
});

describe("the form of the Load tool", () => {
  it("starts as 10 kN downward", () => {
    expect(DEFAULT_LOAD_FORM).toEqual({ kind: "force", direction: "z", value: -10 });
    expect(formComponent(DEFAULT_LOAD_FORM)).toBe("fz");
  });

  it("names one of the six components", () => {
    expect(formComponent({ kind: "force", direction: "x" })).toBe("fx");
    expect(formComponent({ kind: "moment", direction: "y" })).toBe("my");
    expect(NODAL_COMPONENTS.filter(isMoment)).toEqual(["mx", "my", "mz"]);
  });
});

describe("a click of the Load tool", () => {
  it("adds the form's force to the node, in the given load case, with the other components zero", () => {
    const model = portal();
    const result = loadToolClick(
      model,
      at(6, 0, 4, "n3"),
      { kind: "force", direction: "z", value: -10 },
      "lc1",
    );
    expect(result.notice).toBeNull();
    expect(result.nodeId).toBe("n3");
    expect(result.loadId).toBe("nl2");
    expect(result.model.nodalLoads).toHaveLength(2);
    expect(result.model.nodalLoads[1]).toEqual({
      id: "nl2",
      loadCaseId: "lc1",
      nodeId: "n3",
      fx: 0,
      fy: 0,
      fz: -10,
      mx: 0,
      my: 0,
      mz: 0,
    });
    expect(validateModel(result.model)).toEqual([]);
  });

  it("adds a moment about an axis", () => {
    const result = loadToolClick(
      portal(),
      at(0, 0, 4),
      { kind: "moment", direction: "y", value: 15 },
      "lc1",
    );
    expect(result.nodeId).toBe("n2");
    expect(result.model.nodalLoads[1]).toMatchObject({ nodeId: "n2", fx: 0, fz: 0, my: 15 });
  });

  it("away from a node it changes nothing and asks for a node", () => {
    const model = portal();
    const result = loadToolClick(model, at(3, 0, 2), DEFAULT_LOAD_FORM, "lc1");
    expect(result).toEqual({ model, nodeId: null, loadId: null, notice: "needs-node" });
    expect(result.model).toBe(model);
  });

  it("without a load case it changes nothing and says so", () => {
    const model = freeze({ ...portalFrame(), loadCases: [], nodalLoads: [] });
    const result = loadToolClick(model, at(0, 0, 4, "n2"), DEFAULT_LOAD_FORM, null);
    expect(result.model).toBe(model);
    expect(result.notice).toBe("no-load-case");
  });

  it("what the command refuses leaves the model as it was", () => {
    const model = portal();
    const notFinite = loadToolClick(
      model,
      at(0, 0, 4, "n2"),
      { kind: "force", direction: "x", value: Number.NaN },
      "lc1",
    );
    expect(notFinite.model).toBe(model);
    expect(notFinite.notice).toBe("refused");
    expect(notFinite.loadId).toBeNull();
    const noCase = loadToolClick(model, at(0, 0, 4, "n2"), DEFAULT_LOAD_FORM, "gone");
    expect(noCase.model).toBe(model);
    expect(noCase.notice).toBe("refused");
  });
});

describe("the lines of a nodal load in the side panel", () => {
  const load = {
    id: "nl1",
    loadCaseId: "lc1",
    nodeId: "n2",
    fx: 20,
    fy: 0,
    fz: -5,
    mx: 0,
    my: 0,
    mz: 3,
  };

  it("one line per component that is not zero, forces first", () => {
    expect(nodalLoadRows(load)).toEqual([
      { component: "fx", value: 20 },
      { component: "fz", value: -5 },
      { component: "mz", value: 3 },
    ]);
  });

  it("a load of six zeros has one line, fz = 0", () => {
    expect(nodalLoadRows({ ...load, fx: 0, fz: 0, mz: 0 })).toEqual([
      { component: "fz", value: 0 },
    ]);
  });

  it("an edit of the value changes that component only", () => {
    expect(nodalLoadEdit(load, "fx", "fx", 35)).toEqual({ id: "nl1", fx: 35 });
  });

  it("an edit of the component moves the value there and zeroes the old one", () => {
    expect(nodalLoadEdit(load, "fx", "fy", 20)).toEqual({ id: "nl1", fx: 0, fy: 20 });
    expect(nodalLoadEdit(load, "fz", "my", -5)).toEqual({ id: "nl1", fz: 0, my: -5 });
  });
});
