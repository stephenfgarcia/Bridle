// Unit tests of the model store (card PX-02.3, ./modelStore.ts): the commands as undo steps, undo and redo,
// loading a model, the issues and the catalog message of every issue code. Each test makes its own store.
import { createTranslator } from "@bridle/i18n";
import {
  PARSE_ISSUE_CODES,
  planarTruss,
  portalFrame,
  simplySupportedBeam,
  VALIDATION_ISSUE_CODES,
} from "@bridle/model";
import { describe, expect, it } from "vitest";
import { createStore } from "zustand/vanilla";
import { HISTORY_LIMIT } from "./history";
import { ISSUE_MESSAGE } from "./issueMessages";
import {
  createModelState,
  INITIAL_SOURCE,
  issuesOf,
  type ModelState,
  selectCanRedo,
  selectCanUndo,
  selectFrameKey,
  selectIssues,
  selectModel,
  useModelStore,
} from "./modelStore";

function makeStore(limit?: number) {
  return createStore<ModelState>()(createModelState(portalFrame(), "portal", limit));
}

const FIXED = { ux: true, uy: true, uz: true, rx: true, ry: true, rz: true };

describe("the model store", () => {
  it("starts with its model and no step", () => {
    const store = makeStore();
    const state = store.getState();
    expect(selectModel(state)).toEqual(portalFrame());
    expect(selectCanUndo(state)).toBe(false);
    expect(selectCanRedo(state)).toBe(false);
    expect(state.source).toBe("portal");
    expect(selectFrameKey(state)).toBe("0");
  });

  it("the application's store starts with the portal frame", () => {
    const state = useModelStore.getState();
    expect(selectModel(state)).toEqual(portalFrame());
    expect(state.source).toBe(INITIAL_SOURCE);
    expect(selectCanUndo(state)).toBe(false);
    expect(selectCanRedo(state)).toBe(false);
    expect(selectIssues(state)).toEqual([]);
  });

  it("runs every command as an action: an add returns the new id, a change returns true", () => {
    const store = makeStore();
    const s = store.getState();
    expect(s.addNode({ x: 3, y: 0, z: 6 })).toBe("n5");
    expect(s.moveNode({ id: "n5", x: 3, y: 0, z: 5 })).toBe(true);
    expect(s.addMember({ startNodeId: "n2", endNodeId: "n5" })).toBe("m1");
    expect(s.updateMember({ id: "m1", kind: "truss" })).toBe(true);
    expect(s.setSupport({ nodeId: "n5", ...FIXED })).toBe(true);
    expect(s.removeSupport({ nodeId: "n5" })).toBe(true);
    expect(s.addNodalLoad({ nodeId: "n5", fz: -3 })).toBe("nl2");
    expect(s.updateNodalLoad({ id: "nl2", fz: -4 })).toBe(true);
    expect(s.removeNodalLoad({ id: "nl2" })).toBe(true);
    expect(s.addMemberUniformLoad({ memberId: "m1", value: -2 })).toBe("ul1");
    expect(s.updateMemberUniformLoad({ id: "ul1", value: -3 })).toBe(true);
    expect(s.removeMemberUniformLoad({ id: "ul1" })).toBe(true);
    expect(s.addMemberPointLoad({ memberId: "m1", value: -2, position: 1 })).toBe("pl1");
    expect(s.updateMemberPointLoad({ id: "pl1", position: 2 })).toBe(true);
    expect(s.removeMemberPointLoad({ id: "pl1" })).toBe(true);
    expect(
      s.addSection({ name: "Box", A: 1e-2, Iy: 1e-4, Iz: 1e-4, J: 1e-4, depthY: 0.2, depthZ: 0.2 }),
    ).toBe("s2");
    expect(s.addMaterial({ name: "C30", E: 3.3e7, G: 1.4e7, fy: 3e4, density: 2500 })).toBe("mat2");
    expect(s.addLoadCase({ name: "Wind" })).toBe("lc2");
    expect(s.deleteMember({ id: "m1" })).toBe(true);
    expect(s.deleteNode({ id: "n5" })).toBe(true);
    // Twenty commands, twenty undo steps.
    expect(store.getState().history.past).toHaveLength(20);
    const model = selectModel(store.getState());
    expect(model.nodes).toHaveLength(4);
    expect(model.members).toHaveLength(3);
    expect(model.sections).toHaveLength(2);
  });

  it("a refused command records no step, keeps the state object and tells no subscriber", () => {
    const store = makeStore();
    const before = store.getState();
    let told = 0;
    store.subscribe(() => {
      told += 1;
    });
    expect(before.addMember({ startNodeId: "n1", endNodeId: "n1" })).toBeNull();
    expect(before.addMember({ startNodeId: "n1", endNodeId: "n9" })).toBeNull();
    expect(before.moveNode({ id: "n1", x: 0, y: 0, z: 0 })).toBe(false);
    expect(before.deleteNode({ id: "n9" })).toBe(false);
    expect(before.apply((model) => model)).toBe(false);
    expect(store.getState()).toBe(before);
    expect(told).toBe(0);
    expect(selectCanUndo(store.getState())).toBe(false);
  });

  it("undoes and redoes one command at a time, with the same model objects", () => {
    const store = makeStore();
    const m0 = selectModel(store.getState());
    store.getState().addNode({ x: 3, y: 0, z: 6 });
    const m1 = selectModel(store.getState());
    store.getState().deleteMember({ id: "b1" });
    const m2 = selectModel(store.getState());
    expect(m1.nodes).toHaveLength(5);
    expect(m2.members).toHaveLength(2);
    // The second command left the nodes alone: the same array.
    expect(m2.nodes).toBe(m1.nodes);
    expect(selectCanUndo(store.getState())).toBe(true);
    expect(selectCanRedo(store.getState())).toBe(false);

    store.getState().undo();
    expect(selectModel(store.getState())).toBe(m1);
    expect(selectCanRedo(store.getState())).toBe(true);
    store.getState().undo();
    expect(selectModel(store.getState())).toBe(m0);
    expect(selectCanUndo(store.getState())).toBe(false);
    const atStart = store.getState();
    store.getState().undo();
    expect(store.getState()).toBe(atStart);

    store.getState().redo();
    expect(selectModel(store.getState())).toBe(m1);
    store.getState().redo();
    expect(selectModel(store.getState())).toBe(m2);
    expect(selectCanRedo(store.getState())).toBe(false);
    const atEnd = store.getState();
    store.getState().redo();
    expect(store.getState()).toBe(atEnd);
    // Undo and redo are not a load: the frame key did not move.
    expect(selectFrameKey(store.getState())).toBe("0");
  });

  it("a command after an undo discards the redo steps", () => {
    const store = makeStore();
    store.getState().addNode({ x: 1, y: 0, z: 0 });
    store.getState().addNode({ x: 2, y: 0, z: 0 });
    store.getState().undo();
    expect(selectCanRedo(store.getState())).toBe(true);
    expect(store.getState().addNode({ x: 9, y: 0, z: 0 })).toBe("n6");
    expect(selectCanRedo(store.getState())).toBe(false);
    expect(selectModel(store.getState()).nodes.map((node) => node.x)).toEqual([0, 0, 6, 6, 1, 9]);
    store.getState().redo();
    expect(selectModel(store.getState()).nodes).toHaveLength(6);
  });

  it("replaceModel loads the model, clears the history and moves the frame key", () => {
    const store = makeStore();
    store.getState().addNode({ x: 1, y: 0, z: 0 });
    store.getState().addNode({ x: 2, y: 0, z: 0 });
    store.getState().undo();
    expect(selectCanUndo(store.getState())).toBe(true);
    expect(selectCanRedo(store.getState())).toBe(true);
    const truss = planarTruss();
    store.getState().replaceModel(truss, "truss");
    const state = store.getState();
    expect(selectModel(state)).toBe(truss);
    expect(state.source).toBe("truss");
    expect(selectCanUndo(state)).toBe(false);
    expect(selectCanRedo(state)).toBe(false);
    expect(selectFrameKey(state)).toBe("1");
    state.undo();
    expect(selectModel(store.getState())).toBe(truss);
    // An edit keeps the frame key; a second load moves it again, also for the same object.
    store.getState().addNode({ x: 0, y: 0, z: 9 });
    expect(selectFrameKey(store.getState())).toBe("1");
    store.getState().replaceModel(truss);
    expect(selectFrameKey(store.getState())).toBe("2");
    expect(store.getState().source).toBe("");
    expect(selectCanUndo(store.getState())).toBe(false);
  });

  it("keeps HISTORY_LIMIT undo steps by default", () => {
    const store = makeStore();
    for (let i = 0; i < HISTORY_LIMIT + 3; i += 1) {
      store.getState().addNode({ x: i, y: 1, z: 0 });
    }
    expect(store.getState().history.past).toHaveLength(HISTORY_LIMIT);
    let steps = 0;
    while (selectCanUndo(store.getState())) {
      store.getState().undo();
      steps += 1;
    }
    expect(steps).toBe(HISTORY_LIMIT);
    // The three oldest steps are gone: the portal frame's four nodes and three more.
    expect(selectModel(store.getState()).nodes).toHaveLength(7);
  });

  it("keeps the number of steps it is made with", () => {
    const store = makeStore(2);
    for (let i = 0; i < 5; i += 1) {
      store.getState().addNode({ x: i, y: 1, z: 0 });
    }
    expect(store.getState().history.past).toHaveLength(2);
  });
});

describe("issues", () => {
  it("has none for the three fixtures", () => {
    for (const model of [portalFrame(), planarTruss(), simplySupportedBeam()]) {
      expect(issuesOf(model)).toEqual([]);
    }
  });

  it("computes the issues once per model object", () => {
    const store = makeStore();
    const first = selectIssues(store.getState());
    expect(selectIssues(store.getState())).toBe(first);
    // A refused command keeps the model, so the issues are the same array.
    store.getState().deleteNode({ id: "n9" });
    expect(selectIssues(store.getState())).toBe(first);

    store.getState().removeSupport({ nodeId: "n1" });
    store.getState().removeSupport({ nodeId: "n4" });
    const bare = selectIssues(store.getState());
    expect(bare).not.toBe(first);
    expect(bare.map((issue) => issue.code)).toEqual(["no-support"]);
    expect(selectIssues(store.getState())).toBe(bare);

    // Undo twice brings the first model object back, and with it the first array.
    store.getState().undo();
    store.getState().undo();
    expect(selectIssues(store.getState())).toBe(first);
    store.getState().redo();
    store.getState().redo();
    expect(selectIssues(store.getState())).toBe(bare);
  });

  it("reports what the commands do not refuse", () => {
    const store = makeStore();
    // Moving n2 onto n1 gives the column c1 zero length.
    store.getState().moveNode({ id: "n2", x: 0, y: 0, z: 0 });
    expect(selectIssues(store.getState())).toEqual([
      {
        code: "zero-length-member",
        messageKey: "model.issue.zero-length-member",
        ids: ["c1"],
        path: "members[0]",
      },
    ]);
  });

  it("has a catalog message for every issue code", () => {
    const t = createTranslator("en");
    const codes = [...VALIDATION_ISSUE_CODES, ...PARSE_ISSUE_CODES];
    expect(Object.keys(ISSUE_MESSAGE).sort()).toEqual([...codes].sort());
    const ids = codes.map((code) => ISSUE_MESSAGE[code]);
    expect(new Set(ids).size).toBe(codes.length);
    for (const id of ids) {
      expect(t(id), id).toMatch(/\.$/);
    }
  });
});
