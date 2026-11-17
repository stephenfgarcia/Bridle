// Unit tests of the Node tool's click, the Member tool's state machine, moving a node and the preview
// (card PX-02.4, ./drawTools.ts). The models are deep-frozen, so a write to an argument would throw.
import { type Model, portalFrame, validateModel } from "@bridle/model";
import { describe, expect, it } from "vitest";
import type { Point3 } from "../viewport/scene";
import {
  MEMBER_TOOL_IDLE,
  type MemberToolState,
  memberToolStep,
  moveNodeTo,
  nodeToolClick,
  toolPreview,
} from "./drawTools";
import { newModel } from "./newModel";
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
const click = (cursor: ToolCursor) => ({ type: "click", cursor }) as const;
const fresh = () => freeze(newModel());
const portal = () => freeze(portalFrame());

/** Runs clicks one after another, as the workspace does. */
function chain(model: Model, cursors: ToolCursor[], state: MemberToolState = MEMBER_TOOL_IDLE) {
  let current = { state, model, notice: null as ReturnType<typeof memberToolStep>["notice"] };
  const models = [model];
  for (const cursor of cursors) {
    current = memberToolStep(current.state, current.model, click(cursor));
    models.push(current.model);
  }
  return { ...current, models };
}

describe("the model New model starts", () => {
  it("is empty but for the fixtures' section, material and load case, and a new object each time", () => {
    const model = newModel();
    const fixture = portalFrame();
    expect(model.nodes).toEqual([]);
    expect(model.members).toEqual([]);
    expect(model.supports).toEqual([]);
    expect(model.nodalLoads).toEqual([]);
    expect(model.memberUniformLoads).toEqual([]);
    expect(model.memberPointLoads).toEqual([]);
    expect(model.sections).toEqual(fixture.sections);
    expect(model.sections).toHaveLength(1);
    expect(model.materials).toEqual(fixture.materials);
    expect(model.materials).toHaveLength(1);
    expect(model.loadCases).toEqual(fixture.loadCases);
    expect(newModel()).not.toBe(model);
    expect(newModel().sections).not.toBe(model.sections);
    // Its one issue is that nothing is supported yet.
    expect(validateModel(model).map((issue) => issue.code)).toEqual(["no-support"]);
  });
});

describe("the Node tool", () => {
  it("places a node at the cursor's point and names it", () => {
    const model = fresh();
    const result = nodeToolClick(model, at(1.5, 0, 2));
    expect(result.nodeId).toBe("n1");
    expect(result.notice).toBeNull();
    expect(result.model).not.toBe(model);
    expect(result.model.nodes).toEqual([{ id: "n1", x: 1.5, y: 0, z: 2 }]);
  });

  it("finds the node that is at the point instead of placing a second one", () => {
    const model = portal();
    const byPoint = nodeToolClick(model, at(0, 0, 4));
    expect(byPoint).toEqual({ model, nodeId: "n2", notice: null });
    expect(byPoint.model).toBe(model);
    const byPick = nodeToolClick(model, at(6, 0, 4, "n3"));
    expect(byPick.model).toBe(model);
    expect(byPick.nodeId).toBe("n3");
  });

  it("places a node when the picked id is not in the model, and refuses a point that is not finite", () => {
    const model = portal();
    const placed = nodeToolClick(model, at(3, 0, 6, "gone"));
    expect(placed.nodeId).toBe("n5");
    expect(placed.model.nodes).toHaveLength(5);
    const refused = nodeToolClick(model, at(Number.NaN, 0, 0));
    expect(refused).toEqual({ model, nodeId: null, notice: "refused" });
    expect(refused.model).toBe(model);
  });
});

describe("the Member tool", () => {
  it("starts at an existing node without changing the model", () => {
    const model = portal();
    const byPick = memberToolStep(MEMBER_TOOL_IDLE, model, click(at(0, 0, 0, "n1")));
    expect(byPick.state).toEqual({ startNodeId: "n1" });
    expect(byPick.model).toBe(model);
    expect(byPick.notice).toBeNull();
    const byPoint = memberToolStep(MEMBER_TOOL_IDLE, model, click(at(6, 0, 4)));
    expect(byPoint.state).toEqual({ startNodeId: "n3" });
    expect(byPoint.model).toBe(model);
  });

  it("starts at an empty point by placing a node there", () => {
    const model = fresh();
    const result = memberToolStep(MEMBER_TOOL_IDLE, model, click(at(1, 0, 0)));
    expect(result.state).toEqual({ startNodeId: "n1" });
    expect(result.notice).toBeNull();
    expect(result.model.nodes).toEqual([{ id: "n1", x: 1, y: 0, z: 0 }]);
    expect(result.model.members).toEqual([]);
  });

  it("ends at a new point: the node and the member come in one model, and the next starts there", () => {
    const model = fresh();
    const started = memberToolStep(MEMBER_TOOL_IDLE, model, click(at(1, 0, 0)));
    const ended = memberToolStep(started.state, started.model, click(at(1, 0, 3)));
    expect(ended.state).toEqual({ startNodeId: "n2" });
    expect(ended.notice).toBeNull();
    expect(ended.model.nodes).toHaveLength(2);
    expect(ended.model.members).toHaveLength(1);
    // The member takes the first section and the first material of the model.
    expect(ended.model.members[0]).toMatchObject({
      id: "m1",
      startNodeId: "n1",
      endNodeId: "n2",
      sectionId: model.sections[0]?.id,
      materialId: model.materials[0]?.id,
      kind: "frame",
    });
    // One step from the model before the click: the model in between (the node alone) is never returned.
    expect(started.model.nodes).toHaveLength(1);
  });

  it("ends at an existing node without adding a node", () => {
    const model = portal();
    const result = chain(model, [at(0, 0, 0, "n1"), at(6, 0, 4, "n3")]);
    expect(result.state).toEqual({ startNodeId: "n3" });
    expect(result.model.nodes).toBe(model.nodes);
    expect(result.model.members).toHaveLength(4);
    expect(result.model.members[3]).toMatchObject({ startNodeId: "n1", endNodeId: "n3" });
  });

  it("draws a chain: a portal frame from four clicks, with no issue but the missing support", () => {
    const result = chain(fresh(), [at(0, 0, 0), at(0, 0, 4), at(6, 0, 4), at(6, 0, 0)]);
    expect(result.state).toEqual({ startNodeId: "n4" });
    expect(result.model.nodes.map((node) => [node.x, node.y, node.z])).toEqual([
      [0, 0, 0],
      [0, 0, 4],
      [6, 0, 4],
      [6, 0, 0],
    ]);
    expect(result.model.members.map((m) => [m.startNodeId, m.endNodeId])).toEqual([
      ["n1", "n2"],
      ["n2", "n3"],
      ["n3", "n4"],
    ]);
    expect(validateModel(result.model).map((issue) => issue.code)).toEqual(["no-support"]);
    // Each click gave one new model: the start node, then a node and a member per click.
    expect(result.models.map((m) => [m.nodes.length, m.members.length])).toEqual([
      [0, 0],
      [1, 0],
      [2, 1],
      [3, 2],
      [4, 3],
    ]);
  });

  it("refuses the start node itself: the model and the start stay, with the notice same-node", () => {
    const model = portal();
    const state = { startNodeId: "n1" };
    for (const cursor of [at(0, 0, 0, "n1"), at(0, 0, 0)]) {
      const result = memberToolStep(state, model, click(cursor));
      expect(result.model).toBe(model);
      expect(result.state).toEqual(state);
      expect(result.notice).toBe("same-node");
    }
  });

  it("refuses a second member between two nodes, in either direction", () => {
    const model = portal();
    for (const [start, end] of [
      ["n1", "n2"],
      ["n2", "n1"],
      ["n3", "n4"],
    ] as const) {
      const result = memberToolStep({ startNodeId: start }, model, click(at(9, 9, 9, end)));
      expect(result.model).toBe(model);
      expect(result.state).toEqual({ startNodeId: start });
      expect(result.notice).toBe("duplicate-member");
    }
  });

  it("refuses in a model without a section or a material, and keeps no node it would have made", () => {
    for (const bare of [
      freeze({ ...portalFrame(), sections: [] }),
      freeze({ ...portalFrame(), materials: [] }),
    ]) {
      const toPoint = memberToolStep({ startNodeId: "n1" }, bare, click(at(3, 0, 6)));
      expect(toPoint.model).toBe(bare);
      expect(toPoint.state).toEqual({ startNodeId: "n1" });
      expect(toPoint.notice).toBe("no-section");
      const toNode = memberToolStep({ startNodeId: "n1" }, bare, click(at(6, 0, 4, "n3")));
      expect(toNode.model).toBe(bare);
      expect(toNode.notice).toBe("no-section");
    }
  });

  it("refuses a point that is not finite, with the notice refused", () => {
    const model = portal();
    const started = memberToolStep(MEMBER_TOOL_IDLE, model, click(at(Number.NaN, 0, 0)));
    expect(started).toEqual({ state: MEMBER_TOOL_IDLE, model, notice: "refused" });
    const ended = memberToolStep({ startNodeId: "n1" }, model, click(at(0, Infinity, 0)));
    expect(ended.model).toBe(model);
    expect(ended.state).toEqual({ startNodeId: "n1" });
    expect(ended.notice).toBe("refused");
  });

  it("a click after a refusal works and clears the notice", () => {
    const model = portal();
    const refused = memberToolStep({ startNodeId: "n1" }, model, click(at(0, 0, 4, "n2")));
    expect(refused.notice).toBe("duplicate-member");
    const next = memberToolStep(refused.state, refused.model, click(at(6, 0, 4, "n3")));
    expect(next.notice).toBeNull();
    expect(next.model.members).toHaveLength(4);
    expect(next.state).toEqual({ startNodeId: "n3" });
  });

  it("Escape and a double click end the chain and leave the model as it is", () => {
    const model = portal();
    for (const type of ["escape", "double-click"] as const) {
      const begun = memberToolStep({ startNodeId: "n2" }, model, { type });
      expect(begun).toEqual({ state: MEMBER_TOOL_IDLE, model, notice: null });
      expect(begun.model).toBe(model);
      const idle = memberToolStep(MEMBER_TOOL_IDLE, model, { type });
      expect(idle.state).toEqual(MEMBER_TOOL_IDLE);
      expect(idle.model).toBe(model);
    }
  });

  it("a double click: its second click is refused as the same node, then the chain ends without a notice", () => {
    // The browser sends click, click, dblclick: the first click ends a member at the point.
    const first = chain(fresh(), [at(0, 0, 0), at(0, 0, 4)]);
    const second = memberToolStep(first.state, first.model, click(at(0, 0, 4)));
    expect(second.notice).toBe("same-node");
    expect(second.model).toBe(first.model);
    const done = memberToolStep(second.state, second.model, { type: "double-click" });
    expect(done).toEqual({ state: MEMBER_TOOL_IDLE, model: first.model, notice: null });
    // The next click starts a new chain: no member from the old end.
    const again = memberToolStep(done.state, done.model, click(at(6, 0, 0)));
    expect(again.model.members).toHaveLength(1);
    expect(again.state).toEqual({ startNodeId: "n3" });
  });

  it("a start node the model no longer holds counts as none", () => {
    const model = portal();
    const result = memberToolStep({ startNodeId: "undone" }, model, click(at(0, 0, 4, "n2")));
    expect(result.state).toEqual({ startNodeId: "n2" });
    expect(result.model).toBe(model);
    expect(result.notice).toBeNull();
  });
});

describe("moveNodeTo", () => {
  it("moves a node, and refuses the place of another node", () => {
    const model = portal();
    const moved = moveNodeTo(model, "n2", [0, 0, 5]);
    expect(moved.notice).toBeNull();
    expect(moved.model.nodes[1]).toEqual({ id: "n2", x: 0, y: 0, z: 5 });
    const occupied = moveNodeTo(model, "n2", [6, 0, 4]);
    expect(occupied).toEqual({ model, notice: "occupied" });
    expect(occupied.model).toBe(model);
  });

  it("changes nothing, without a notice, for the node's own place, an unknown node or a bad number", () => {
    const model = portal();
    for (const [id, point] of [
      ["n2", [0, 0, 4]],
      ["gone", [1, 1, 1]],
      ["gone", [6, 0, 4]],
      ["n2", [Number.NaN, 0, 4]],
    ] as [string, Point3][]) {
      const result = moveNodeTo(model, id, point);
      expect(result.model).toBe(model);
      expect(result.notice).toBeNull();
    }
  });
});

describe("toolPreview", () => {
  const model = portal();
  const idle = { tool: "select", cursor: null, memberStart: null, drag: null } as const;

  it("is nothing with the Select tool and without a cursor", () => {
    expect(toolPreview(idle, model)).toEqual({ marker: null, segments: [] });
    expect(toolPreview({ ...idle, cursor: at(1, 0, 1) }, model).marker).toBeNull();
    expect(toolPreview({ ...idle, tool: "member", memberStart: "n1" }, model)).toEqual({
      marker: null,
      segments: [],
    });
  });

  it("is the marker at the cursor for the Node tool and for the Member tool before its first click", () => {
    for (const tool of ["node", "member"] as const) {
      expect(toolPreview({ ...idle, tool, cursor: at(1, 0, 2) }, model)).toEqual({
        marker: [1, 0, 2],
        segments: [],
      });
    }
    // The Node tool draws no line, whatever the start node says.
    expect(
      toolPreview({ ...idle, tool: "node", cursor: at(1, 0, 2), memberStart: "n1" }, model)
        .segments,
    ).toEqual([]);
  });

  it("is a line from the start node to the cursor for a member in progress", () => {
    const preview = toolPreview(
      { ...idle, tool: "member", memberStart: "n2", cursor: at(3, 0, 2) },
      model,
    );
    expect(preview).toEqual({ marker: [3, 0, 2], segments: [0, 0, 4, 3, 0, 2] });
    // No line to the start node itself, and none from a start node that is gone.
    expect(
      toolPreview({ ...idle, tool: "member", memberStart: "n2", cursor: at(0, 0, 4, "n2") }, model)
        .segments,
    ).toEqual([]);
    expect(
      toolPreview({ ...idle, tool: "member", memberStart: "gone", cursor: at(3, 0, 2) }, model)
        .segments,
    ).toEqual([]);
  });

  it("is the dragged node's new place with a line to the other end of each of its members", () => {
    const preview = toolPreview({ ...idle, drag: { nodeId: "n2", point: [1, 0, 5] } }, model);
    expect(preview.marker).toEqual([1, 0, 5]);
    // n2 ends c1 (from n1) and starts b1 (to n3).
    expect(preview.segments).toEqual([0, 0, 0, 1, 0, 5, 6, 0, 4, 1, 0, 5]);
    const lone = toolPreview({ ...idle, drag: { nodeId: "n9", point: [1, 0, 5] } }, model);
    expect(lone).toEqual({ marker: [1, 0, 5], segments: [] });
  });
});
