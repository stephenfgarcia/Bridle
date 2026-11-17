// The state of the drawing tools of the workspace (card PX-02.4): the active tool, the work plane, the snap
// step, the Member tool's start node, the cursor of the active tool, a node drag in progress and the last
// notice. The pure parts are ./workPlane.ts and ./drawTools.ts; ./toolActions.ts changes this store together
// with the model store. The model and the selection are not here (../model/modelStore.ts,
// ../viewport/viewportStore.ts).
import { create } from "zustand";
import type { Point3 } from "../viewport/scene";
import type { ToolNotice } from "./drawTools";
import {
  DEFAULT_SNAP_STEP,
  DEFAULT_WORK_PLANE,
  type SnapStep,
  sameCursor,
  type ToolCursor,
  type WorkPlane,
} from "./workPlane";

export type Tool = "select" | "node" | "member";

export const TOOLS: readonly Tool[] = ["select", "node", "member"];

export const DEFAULT_TOOL: Tool = "select";

/** A node being dragged with the Select tool: where it would land on release. */
export interface NodeDrag {
  nodeId: string;
  point: Point3;
}

/**
 * Why the active drawing tool has no cursor while the pointer is over the viewport: `off-plane` when the
 * pointer's ray does not meet the work plane in this view (`rayToPlane` gave no point, for example because the
 * plane is seen edge-on); `null` otherwise.
 */
export type CursorProblem = "off-plane" | null;

export interface ToolState {
  tool: Tool;
  plane: WorkPlane;
  snapStep: SnapStep;
  /** The node the Member tool's next member starts at; `null` when no member is begun. */
  memberStart: string | null;
  /** Where the Node or the Member tool would act, under the pointer; `null` with the Select tool. */
  cursor: ToolCursor | null;
  cursorProblem: CursorProblem;
  drag: NodeDrag | null;
  notice: ToolNotice | null;

  /** Makes a tool the active one. It ends a member in progress and clears the cursor and the notice. */
  setTool: (tool: Tool) => void;
  setPlane: (plane: WorkPlane) => void;
  setSnapStep: (step: SnapStep) => void;
  setMemberStart: (nodeId: string | null) => void;
  /** Keeps the state object when the cursor and the problem are the ones it has. */
  setCursor: (cursor: ToolCursor | null, problem?: CursorProblem) => void;
  /** Keeps the state object when the drag is the one it has. */
  setDrag: (drag: NodeDrag | null) => void;
  setNotice: (notice: ToolNotice | null) => void;
  /** For another model: no member in progress, no cursor, no drag, no notice. Tool, plane and snap stay. */
  resetSession: () => void;
}

function sameDrag(a: NodeDrag | null, b: NodeDrag | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  return (
    a.nodeId === b.nodeId &&
    a.point[0] === b.point[0] &&
    a.point[1] === b.point[1] &&
    a.point[2] === b.point[2]
  );
}

const SESSION = { memberStart: null, cursor: null, cursorProblem: null, drag: null, notice: null };

export const useToolStore = create<ToolState>((set) => ({
  tool: DEFAULT_TOOL,
  plane: DEFAULT_WORK_PLANE,
  snapStep: DEFAULT_SNAP_STEP,
  ...SESSION,

  setTool: (tool) => set({ tool, ...SESSION }),
  setPlane: (plane) => set({ plane, cursor: null, cursorProblem: null }),
  setSnapStep: (snapStep) => set({ snapStep, cursor: null, cursorProblem: null }),
  setMemberStart: (memberStart) =>
    set((state) => (state.memberStart === memberStart ? state : { memberStart })),
  setCursor: (cursor, problem = null) =>
    set((state) =>
      sameCursor(state.cursor, cursor) && state.cursorProblem === problem
        ? state
        : { cursor, cursorProblem: problem },
    ),
  setDrag: (drag) => set((state) => (sameDrag(state.drag, drag) ? state : { drag })),
  setNotice: (notice) => set((state) => (state.notice === notice ? state : { notice })),
  resetSession: () => set({ ...SESSION }),
}));
