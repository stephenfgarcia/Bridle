// What the pointer is over and what is selected in the viewport (card PX-02.2). The viewport writes both; the
// side panel reads the selection. The model is not in this store: the viewport takes it as a prop.
import { create } from "zustand";

/** A node or a member of the model on screen, by its id. */
export interface ItemRef {
  kind: "node" | "member";
  id: string;
}

interface ViewportState {
  hover: ItemRef | null;
  selection: ItemRef | null;
  setHover: (item: ItemRef | null) => void;
  select: (item: ItemRef | null) => void;
}

function same(a: ItemRef | null, b: ItemRef | null): boolean {
  return a === b || (a !== null && b !== null && a.kind === b.kind && a.id === b.id);
}

// Both setters keep the state object when nothing changes, so a pointer that moves along one member notifies
// no subscriber.
export const useViewportStore = create<ViewportState>((set) => ({
  hover: null,
  selection: null,
  setHover: (item) => set((state) => (same(state.hover, item) ? state : { hover: item })),
  select: (item) => set((state) => (same(state.selection, item) ? state : { selection: item })),
}));
