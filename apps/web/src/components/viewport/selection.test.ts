import { portalFrame } from "@bridle/model";
import { describe, expect, it } from "vitest";
import {
  type ItemRef,
  isSelected,
  NO_SELECTION,
  type Selection,
  selectedIds,
  selectedItems,
  selectionAfterClick,
  singleItem,
} from "./selection";

const c1: ItemRef = { kind: "member", id: "c1" };
const c2: ItemRef = { kind: "member", id: "c2" };
const n1: ItemRef = { kind: "node", id: "n1" };

describe("selectionAfterClick", () => {
  it("selects the clicked item alone without Shift", () => {
    expect(selectionAfterClick(NO_SELECTION, c1, false)).toEqual([c1]);
    expect(selectionAfterClick([c1, n1], c2, false)).toEqual([c2]);
    // An item of a larger selection becomes the only one.
    expect(selectionAfterClick([c1, c2], c1, false)).toEqual([c1]);
  });

  it("adds an item with Shift, at the end, and keeps nodes and members together", () => {
    const one = selectionAfterClick(NO_SELECTION, c1, true);
    const two = selectionAfterClick(one, c2, true);
    const three = selectionAfterClick(two, n1, true);
    expect(one).toEqual([c1]);
    expect(two).toEqual([c1, c2]);
    expect(three).toEqual([c1, c2, n1]);
  });

  it("removes a selected item with Shift", () => {
    expect(selectionAfterClick([c1, c2, n1], { kind: "member", id: "c2" }, true)).toEqual([c1, n1]);
    expect(selectionAfterClick([c1], c1, true)).toBe(NO_SELECTION);
  });

  it("tells a node from a member with the same id", () => {
    const node: ItemRef = { kind: "node", id: "a" };
    const member: ItemRef = { kind: "member", id: "a" };
    expect(selectionAfterClick([node], member, true)).toEqual([node, member]);
    expect(selectionAfterClick([node, member], node, true)).toEqual([member]);
  });

  it("clears on a click on nothing without Shift and keeps the selection with Shift", () => {
    const selection: Selection = [c1, c2];
    expect(selectionAfterClick(selection, null, false)).toBe(NO_SELECTION);
    expect(selectionAfterClick(selection, null, true)).toBe(selection);
  });

  it("returns the array it was given when nothing changes", () => {
    const selection: Selection = [c1];
    expect(selectionAfterClick(selection, { kind: "member", id: "c1" }, false)).toBe(selection);
    expect(selectionAfterClick(NO_SELECTION, null, false)).toBe(NO_SELECTION);
    const empty: Selection = [];
    expect(selectionAfterClick(empty, null, false)).toBe(empty);
  });

  it("does not change the array it was given", () => {
    const selection: Selection = [c1, c2];
    selectionAfterClick(selection, n1, true);
    selectionAfterClick(selection, c1, true);
    expect(selection).toEqual([c1, c2]);
  });
});

describe("singleItem, selectedIds, isSelected", () => {
  it("singleItem is the item of a selection of exactly one", () => {
    expect(singleItem(NO_SELECTION)).toBeNull();
    expect(singleItem([n1])).toEqual(n1);
    expect(singleItem([n1, c1])).toBeNull();
  });

  it("selectedIds lists the ids of one kind in the order of the selection", () => {
    expect(selectedIds([c2, n1, c1], "member")).toEqual(["c2", "c1"]);
    expect(selectedIds([c2, n1, c1], "node")).toEqual(["n1"]);
    expect(selectedIds(NO_SELECTION, "node")).toEqual([]);
  });

  it("isSelected compares kind and id", () => {
    expect(isSelected([c1], { kind: "member", id: "c1" })).toBe(true);
    expect(isSelected([c1], { kind: "node", id: "c1" })).toBe(false);
  });
});

describe("selectedItems", () => {
  it("returns the model's nodes and members in the order of the selection", () => {
    const model = portalFrame();
    const items = selectedItems(model, [c2, n1, c1]);
    expect(items.members.map((member) => member.id)).toEqual(["c2", "c1"]);
    expect(items.nodes).toEqual([model.nodes[0]]);
  });

  it("leaves out what the model does not hold", () => {
    const items = selectedItems(portalFrame(), [
      { kind: "member", id: "gone" },
      { kind: "node", id: "gone" },
      c1,
    ]);
    expect(items.nodes).toEqual([]);
    expect(items.members.map((member) => member.id)).toEqual(["c1"]);
  });
});
