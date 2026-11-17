// Unit tests of the tools on the application's stores (card PX-02.4, ./toolActions.ts, ./toolStore.ts): a
// click of each tool as undo steps, Escape, the double click, deleting, moving, loading and "New model".
// The three stores are module singletons: each test starts from the portal frame and the default tool state.
import { portalFrame } from "@bridle/model";
import { beforeEach, describe, expect, it } from "vitest";
import { selectCanRedo, selectCanUndo, selectModel, useModelStore } from "../model/modelStore";
import { useViewportStore } from "../viewport/viewportStore";
import { NEW_MODEL_SOURCE, newModel } from "./newModel";
import {
  chooseTool,
  deleteSelection,
  escapeTool,
  hasChanges,
  loadModel,
  moveNodeAction,
  runToolKey,
  startNewModel,
  toolClick,
  toolDoubleClick,
} from "./toolActions";
import { DEFAULT_TOOL, useToolStore } from "./toolStore";
import { DEFAULT_SNAP_STEP, DEFAULT_WORK_PLANE, type ToolCursor } from "./workPlane";

const at = (x: number, y: number, z: number, nodeId: string | null = null): ToolCursor => ({
  point: [x, y, z],
  nodeId,
});
const model = () => selectModel(useModelStore.getState());
const tools = () => useToolStore.getState();
const selection = () => useViewportStore.getState().selection;
const counts = () => [model().nodes.length, model().members.length];
/** How many undo steps the model store holds. */
const steps = () => useModelStore.getState().history.past.length;

beforeEach(() => {
  useModelStore.getState().replaceModel(portalFrame(), "portal");
  useViewportStore.setState({ hover: null, selection: null });
  useToolStore.setState({
    tool: DEFAULT_TOOL,
    plane: DEFAULT_WORK_PLANE,
    snapStep: DEFAULT_SNAP_STEP,
    memberStart: null,
    cursor: null,
    cursorProblem: null,
    drag: null,
    notice: null,
  });
});

describe("the tool store", () => {
  it("starts with Select, the vertical plane at Y = 0 and a snap of 0.5 m", () => {
    expect(tools().tool).toBe("select");
    expect(tools().plane).toEqual({ kind: "xz", offset: 0 });
    expect(tools().snapStep).toBe(0.5);
  });

  it("keeps its state object for a cursor or a drag it already has", () => {
    tools().setCursor(at(1, 0, 2));
    const before = tools();
    tools().setCursor(at(1, 0, 2));
    expect(tools()).toBe(before);
    tools().setCursor(at(1, 0, 2.5));
    expect(tools()).not.toBe(before);
    tools().setDrag({ nodeId: "n1", point: [1, 0, 1] });
    const dragging = tools();
    tools().setDrag({ nodeId: "n1", point: [1, 0, 1] });
    expect(tools()).toBe(dragging);
  });

  it("a change of tool ends a member in progress and clears the cursor and the notice", () => {
    chooseTool("member");
    toolClick(at(0, 0, 0, "n1"));
    toolClick(at(0, 0, 4, "n2"));
    tools().setCursor(at(1, 0, 1));
    expect(tools().memberStart).toBe("n1");
    expect(tools().notice).toBe("duplicate-member");
    chooseTool("node");
    expect(tools().tool).toBe("node");
    expect(tools().memberStart).toBeNull();
    expect(tools().notice).toBeNull();
    expect(tools().cursor).toBeNull();
  });
});

describe("a click with the Select tool", () => {
  it("does nothing to the model", () => {
    toolClick(at(3, 0, 6));
    expect(counts()).toEqual([4, 3]);
    expect(steps()).toBe(0);
  });
});

describe("a click with the Node tool", () => {
  it("places a node as one undo step and selects it", () => {
    chooseTool("node");
    toolClick(at(3, 0, 6));
    expect(counts()).toEqual([5, 3]);
    expect(steps()).toBe(1);
    expect(model().nodes[4]).toEqual({ id: "n5", x: 3, y: 0, z: 6 });
    expect(selection()).toEqual({ kind: "node", id: "n5" });
    useModelStore.getState().undo();
    expect(counts()).toEqual([4, 3]);
  });

  it("selects the node that is at the point and records no step", () => {
    chooseTool("node");
    toolClick(at(6, 0, 4));
    expect(counts()).toEqual([4, 3]);
    expect(steps()).toBe(0);
    expect(selection()).toEqual({ kind: "node", id: "n3" });
  });
});

describe("clicks with the Member tool", () => {
  it("a member with the node it needed is one undo step; a start at a node is none", () => {
    chooseTool("member");
    toolClick(at(0, 0, 4, "n2"));
    expect(tools().memberStart).toBe("n2");
    expect(steps()).toBe(0);
    toolClick(at(3, 0, 6));
    expect(counts()).toEqual([5, 4]);
    expect(steps()).toBe(1);
    expect(tools().memberStart).toBe("n5");
    toolClick(at(6, 0, 4, "n3"));
    expect(counts()).toEqual([5, 5]);
    expect(steps()).toBe(2);
    expect(tools().memberStart).toBe("n3");
    // One undo takes the last member; the next one the member and its node together.
    useModelStore.getState().undo();
    expect(counts()).toEqual([5, 4]);
    useModelStore.getState().undo();
    expect(counts()).toEqual([4, 3]);
    expect(selectCanUndo(useModelStore.getState())).toBe(false);
  });

  it("a start at an empty point is one undo step of its own", () => {
    loadModel(newModel(), NEW_MODEL_SOURCE);
    chooseTool("member");
    toolClick(at(1, 0, 0));
    expect(counts()).toEqual([1, 0]);
    expect(steps()).toBe(1);
    toolClick(at(1, 0, 3));
    expect(counts()).toEqual([2, 1]);
    expect(steps()).toBe(2);
    expect(model().members[0]).toMatchObject({
      sectionId: model().sections[0]?.id,
      materialId: model().materials[0]?.id,
    });
  });

  it("a refusal leaves the model and the undo steps as they were and sets a notice", () => {
    chooseTool("member");
    toolClick(at(0, 0, 0, "n1"));
    const before = model();
    toolClick(at(0, 0, 0, "n1"));
    expect(tools().notice).toBe("same-node");
    toolClick(at(0, 0, 4, "n2"));
    expect(tools().notice).toBe("duplicate-member");
    expect(model()).toBe(before);
    expect(steps()).toBe(0);
    expect(tools().memberStart).toBe("n1");
    // The next member that can be made clears the notice.
    toolClick(at(6, 0, 4, "n3"));
    expect(tools().notice).toBeNull();
    expect(counts()).toEqual([4, 4]);
  });

  it("a double click ends the chain and keeps the tool; Escape ends it and returns to Select", () => {
    chooseTool("member");
    toolClick(at(0, 0, 0, "n1"));
    toolClick(at(0, 0, 0, "n1"));
    toolDoubleClick();
    expect(tools().memberStart).toBeNull();
    expect(tools().notice).toBeNull();
    expect(tools().tool).toBe("member");
    toolClick(at(0, 0, 0, "n1"));
    expect(tools().memberStart).toBe("n1");
    escapeTool();
    expect(tools().memberStart).toBeNull();
    expect(tools().tool).toBe("select");
    expect(counts()).toEqual([4, 3]);
  });

  it("a double click with another tool does nothing", () => {
    chooseTool("node");
    toolDoubleClick();
    expect(tools().tool).toBe("node");
    expect(steps()).toBe(0);
  });

  it("after an undo removed the start node, the next click starts again", () => {
    loadModel(newModel(), NEW_MODEL_SOURCE);
    chooseTool("member");
    toolClick(at(1, 0, 0));
    useModelStore.getState().undo();
    expect(counts()).toEqual([0, 0]);
    toolClick(at(2, 0, 0));
    expect(counts()).toEqual([1, 0]);
    expect(tools().memberStart).toBe("n1");
  });
});

describe("the keys", () => {
  it("choose a tool, escape and delete", () => {
    runToolKey({ type: "tool", tool: "member" });
    expect(tools().tool).toBe("member");
    runToolKey({ type: "escape" });
    expect(tools().tool).toBe("select");
    useViewportStore.getState().select({ kind: "member", id: "b1" });
    runToolKey({ type: "delete" });
    expect(counts()).toEqual([4, 2]);
  });
});

describe("deleteSelection", () => {
  it("removes the selected node with its members as one undo step and clears the selection", () => {
    useViewportStore.getState().select({ kind: "node", id: "n2" });
    expect(deleteSelection()).toBe(true);
    expect(counts()).toEqual([3, 1]);
    expect(model().nodalLoads).toEqual([]);
    expect(selection()).toBeNull();
    expect(steps()).toBe(1);
    useModelStore.getState().undo();
    expect(model()).toEqual(portalFrame());
  });

  it("removes the selected member and keeps its nodes", () => {
    useViewportStore.getState().select({ kind: "member", id: "c1" });
    expect(deleteSelection()).toBe(true);
    expect(counts()).toEqual([4, 2]);
    expect(steps()).toBe(1);
  });

  it("does nothing without a selection or for an item the model does not hold", () => {
    expect(deleteSelection()).toBe(false);
    useViewportStore.getState().select({ kind: "node", id: "gone" });
    expect(deleteSelection()).toBe(false);
    expect(counts()).toEqual([4, 3]);
    expect(steps()).toBe(0);
  });
});

describe("moveNodeAction", () => {
  it("moves a node as one undo step", () => {
    expect(moveNodeAction("n2", [0.5, 0, 4.5])).toBe(true);
    expect(model().nodes[1]).toEqual({ id: "n2", x: 0.5, y: 0, z: 4.5 });
    expect(steps()).toBe(1);
    expect(tools().notice).toBeNull();
  });

  it("refuses the place of another node with a notice, and the node's own place without one", () => {
    expect(moveNodeAction("n2", [6, 0, 4])).toBe(false);
    expect(tools().notice).toBe("occupied");
    expect(moveNodeAction("n2", [0, 0, 4])).toBe(false);
    expect(tools().notice).toBeNull();
    expect(model()).toEqual(portalFrame());
    expect(steps()).toBe(0);
  });
});

describe("loading a model and New model", () => {
  it("loadModel drops the steps, the selection and a member in progress, and keeps the tool settings", () => {
    chooseTool("member");
    tools().setSnapStep(0.25);
    tools().setPlane({ kind: "xy", offset: 3 });
    toolClick(at(3, 0, 6));
    useViewportStore.getState().select({ kind: "node", id: "n1" });
    const loads = useModelStore.getState().loadCount;
    loadModel(portalFrame(), "portal");
    expect(steps()).toBe(0);
    expect(selection()).toBeNull();
    expect(tools().memberStart).toBeNull();
    expect(tools().tool).toBe("member");
    expect(tools().snapStep).toBe(0.25);
    expect(tools().plane).toEqual({ kind: "xy", offset: 3 });
    expect(useModelStore.getState().loadCount).toBe(loads + 1);
  });

  it("startNewModel does not ask when the model has no change", () => {
    let asked = 0;
    expect(hasChanges()).toBe(false);
    expect(
      startNewModel(() => {
        asked += 1;
        return false;
      }),
    ).toBe(true);
    expect(asked).toBe(0);
    expect(model()).toEqual(newModel());
    expect(useModelStore.getState().source).toBe(NEW_MODEL_SOURCE);
    expect(selectCanUndo(useModelStore.getState())).toBe(false);
    expect(selectCanRedo(useModelStore.getState())).toBe(false);
  });

  it("startNewModel asks when the model has changes, and a no keeps everything", () => {
    useModelStore.getState().addNode({ x: 1, y: 1, z: 1 });
    expect(hasChanges()).toBe(true);
    const before = model();
    let asked = 0;
    expect(
      startNewModel(() => {
        asked += 1;
        return false;
      }),
    ).toBe(false);
    expect(asked).toBe(1);
    expect(model()).toBe(before);
    expect(steps()).toBe(1);
    expect(startNewModel(() => true)).toBe(true);
    expect(counts()).toEqual([0, 0]);
    expect(model().sections).toHaveLength(1);
    expect(model().materials).toHaveLength(1);
  });
});
