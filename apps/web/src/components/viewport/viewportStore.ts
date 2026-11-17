// What the pointer is over, what is selected in the viewport (card PX-02.2; a set of items since card
// PX-02.6) and whether the members are coloured by section (card PX-02.6). The viewport writes the hover and
// the selection; the side panel reads the selection. The model is not in this store: the viewport takes it as
// a prop.
import { create } from "zustand";
import {
  type ItemRef,
  NO_SELECTION,
  type Selection,
  sameItem,
  selectionAfterClick,
} from "./selection";

export type { ItemRef, Selection } from "./selection";

interface ViewportState {
  hover: ItemRef | null;
  /**
   * The selected nodes and members (./selection.ts). A feature that acts on one item reads it with
   * `singleItem`; an id may name an item the model no longer holds (`selectedItems` leaves those out).
   */
  selection: Selection;
  /** Whether the members are drawn in the colour of their section (./sectionColors.ts). */
  colorBySection: boolean;
  setHover: (item: ItemRef | null) => void;
  /** A click without Shift: `item` becomes the whole selection; `null` clears it. */
  select: (item: ItemRef | null) => void;
  /** A click with Shift: `item` is added to the selection, or removed from it when it was selected. */
  toggle: (item: ItemRef) => void;
  setColorBySection: (on: boolean) => void;
}

// The setters keep the state object when nothing changes, so a pointer that moves along one member notifies
// no subscriber.
export const useViewportStore = create<ViewportState>((set) => {
  const click = (item: ItemRef | null, shift: boolean) =>
    set((state) => {
      const selection = selectionAfterClick(state.selection, item, shift);
      return selection === state.selection ? state : { selection };
    });
  return {
    hover: null,
    selection: NO_SELECTION,
    colorBySection: false,
    setHover: (item) => set((state) => (sameItem(state.hover, item) ? state : { hover: item })),
    select: (item) => click(item, false),
    toggle: (item) => click(item, true),
    setColorBySection: (on) =>
      set((state) => (state.colorBySection === on ? state : { colorBySection: on })),
  };
});
