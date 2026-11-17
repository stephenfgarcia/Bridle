/**
 * The selection of the viewport as a set of nodes and members (card PX-02.6), and what a click does to it.
 * Pure functions, tested without a browser (./selection.test.ts); ./viewportStore.ts holds the selection and
 * calls them.
 */
import type { Member, Model, Node as ModelNode } from "@bridle/model";

/** A node or a member of the model on screen, by its id. */
export interface ItemRef {
  kind: "node" | "member";
  id: string;
}

/** The selected items in the order they were selected; no item is in it twice. */
export type Selection = readonly ItemRef[];

/** The empty selection. `selectionAfterClick` returns this object whenever its result is empty. */
export const NO_SELECTION: Selection = Object.freeze([]);

export function sameItem(a: ItemRef | null, b: ItemRef | null): boolean {
  return a === b || (a !== null && b !== null && a.kind === b.kind && a.id === b.id);
}

export function isSelected(selection: Selection, item: ItemRef): boolean {
  return selection.some((candidate) => sameItem(candidate, item));
}

/**
 * The selection after a click on `item` (`null`: a click on nothing), with or without Shift:
 * - without Shift, an item: that item alone; nothing: the empty selection;
 * - with Shift, an item: the selection without it when it was selected, else with it added at the end;
 *   nothing: the selection as it was.
 * The array it was given is returned when the result holds the same items in the same order.
 */
export function selectionAfterClick(
  selection: Selection,
  item: ItemRef | null,
  shift: boolean,
): Selection {
  if (item === null) {
    return shift || selection.length === 0 ? selection : NO_SELECTION;
  }
  if (!shift) {
    return selection.length === 1 && sameItem(selection[0] ?? null, item) ? selection : [item];
  }
  if (!isSelected(selection, item)) {
    return [...selection, item];
  }
  const rest = selection.filter((candidate) => !sameItem(candidate, item));
  return rest.length === 0 ? NO_SELECTION : rest;
}

/** The selected item when exactly one item is selected, else `null`. */
export function singleItem(selection: Selection): ItemRef | null {
  return selection.length === 1 ? (selection[0] ?? null) : null;
}

/** The ids of the selected items of one kind, in the order of the selection. */
export function selectedIds(selection: Selection, kind: ItemRef["kind"]): string[] {
  return selection.filter((item) => item.kind === kind).map((item) => item.id);
}

/** The selected nodes and members that a model holds. */
export interface SelectedItems {
  nodes: ModelNode[];
  members: Member[];
}

/**
 * The nodes and the members of `model` that the selection names, each list in the order of the selection.
 * An id the model does not hold (the item was deleted, or an undo removed it) is left out.
 */
export function selectedItems(model: Model, selection: Selection): SelectedItems {
  const nodes: ModelNode[] = [];
  const members: Member[] = [];
  for (const item of selection) {
    if (item.kind === "node") {
      const node = model.nodes.find((candidate) => candidate.id === item.id);
      if (node) {
        nodes.push(node);
      }
    } else {
      const member = model.members.find((candidate) => candidate.id === item.id);
      if (member) {
        members.push(member);
      }
    }
  }
  return { nodes, members };
}
