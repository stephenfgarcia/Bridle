// What the tools do to the stores (card PX-02.4): each function reads the tool store, the model store and the
// selection, runs a pure function of ./drawTools.ts and writes the result back. The pointer handlers of the
// viewport (../viewport/ToolLayer.tsx), the key handler of the workspace and the buttons call these; they are
// tested against the application's stores without a browser (./toolActions.test.ts).
import type { Model } from "@bridle/model";
import type * as commands from "../model/commands";
import { type ModelState, selectCanUndo, selectModel, useModelStore } from "../model/modelStore";
import { activeLoadCaseId } from "../viewport/loads";
import type { Point3 } from "../viewport/scene";
import { useViewportStore } from "../viewport/viewportStore";
import {
  type MemberToolEvent,
  type MemberToolResult,
  memberToolStep,
  moveNodeTo,
  type NodeToolResult,
  nodeToolClick,
  type ToolNotice,
} from "./drawTools";
import { NEW_MODEL_SOURCE, newModel } from "./newModel";
import {
  loadToolClick,
  type OutOfPlaneResult,
  type RestraintKey,
  restrainOutOfPlane,
  supportToolClick,
  withRestraint,
} from "./supportLoadTools";
import type { ToolKeyAction } from "./toolKeys";
import { type Tool, useToolStore } from "./toolStore";
import type { ToolCursor } from "./workPlane";

/**
 * Runs a pure step on the model of the model store as one undo step and returns what the step returned.
 * A step that returns the model it was given records nothing.
 */
function run<R extends { model: Model }>(step: (model: Model) => R): R {
  let result: R | undefined;
  useModelStore.getState().apply((model) => {
    result = step(model);
    return result.model;
  });
  // `apply` calls its argument once, synchronously.
  return result as R;
}

function memberEvent(event: MemberToolEvent): MemberToolResult {
  const tools = useToolStore.getState();
  const result = run((model) => memberToolStep({ startNodeId: tools.memberStart }, model, event));
  tools.setMemberStart(result.state.startNodeId);
  tools.setNotice(result.notice);
  return result;
}

/**
 * A click of the active tool at a cursor. Node tool: places a node (one undo step) or finds the one that is
 * there, and selects it. Member tool: one step of `memberToolStep` (a member with a node it needed is one undo
 * step). Support tool: sets, replaces or removes the support of the node at the cursor (`supportToolClick`).
 * Load tool: adds the form's nodal load to that node, in the active load case (`loadToolClick`). Both are one
 * undo step, select the node they acted on, and leave a notice when they changed nothing. Select tool: nothing;
 * the viewport's own handlers select.
 */
export function toolClick(cursor: ToolCursor): void {
  const tools = useToolStore.getState();
  if (tools.tool === "node") {
    const result: NodeToolResult = run((model) => nodeToolClick(model, cursor));
    tools.setNotice(result.notice);
    if (result.nodeId !== null) {
      useViewportStore.getState().select({ kind: "node", id: result.nodeId });
    }
  } else if (tools.tool === "member") {
    memberEvent({ type: "click", cursor });
  } else if (tools.tool === "support" || tools.tool === "load") {
    const result = run((model) =>
      tools.tool === "support"
        ? supportToolClick(model, cursor, tools.supportChoice)
        : loadToolClick(model, cursor, tools.loadForm, activeLoadCaseId(model, tools.loadCaseId)),
    );
    tools.setNotice(result.notice);
    if (result.nodeId !== null && result.notice === null) {
      useViewportStore.getState().select({ kind: "node", id: result.nodeId });
    }
  }
}

/**
 * Sets or clears one restraint of a node (a checkbox of the side panel) as one undo step; clearing the last
 * one removes the support. `false`, with the notice `refused`, when the model did not change.
 */
export function setRestraintAction(
  nodeId: string,
  key: RestraintKey,
  restrained: boolean,
): boolean {
  const changed = useModelStore
    .getState()
    .apply((model) => withRestraint(model, nodeId, key, restrained));
  useToolStore.getState().setNotice(changed ? null : "refused");
  return changed;
}

/**
 * "Restrain out of plane" (`restrainOutOfPlane`) on the model of the store, as one undo step. It returns the
 * outcome with the model the store then holds; a refusal leaves the store as it was.
 */
export function restrainOutOfPlaneAction(): OutOfPlaneResult {
  const result = run((model) => restrainOutOfPlane(model));
  useToolStore.getState().setNotice(null);
  return result;
}

/** The model store's actions that edit a load or a load case. */
type LoadEdits = Pick<
  ModelState,
  | "addNodalLoad"
  | "updateNodalLoad"
  | "removeNodalLoad"
  | "addMemberUniformLoad"
  | "updateMemberUniformLoad"
  | "removeMemberUniformLoad"
  | "addMemberPointLoad"
  | "updateMemberPointLoad"
  | "removeMemberPointLoad"
>;

/**
 * Runs one load action of the model store from the side panel (one undo step). When the store refuses, the
 * model is unchanged and the viewport shows `refusal` as the notice; when it does not, the notice is cleared.
 * Returns whether the model changed.
 */
export function editLoad(
  edit: (store: LoadEdits) => boolean | string | null,
  refusal: ToolNotice = "refused",
): boolean {
  const result = edit(useModelStore.getState());
  const changed = result !== false && result !== null;
  useToolStore.getState().setNotice(changed ? null : refusal);
  return changed;
}

/**
 * Adds a load case with a name and makes it the active one (one undo step; an undo leaves the active load
 * case to fall back to the model's first). Returns the new id.
 */
export function addLoadCaseAction(args: commands.AddLoadCaseArgs): string | null {
  const id = useModelStore.getState().addLoadCase(args);
  if (id !== null) {
    useToolStore.getState().setLoadCaseId(id);
  }
  return id;
}

/** A double click in the viewport: with the Member tool, the chain of members ends; the tool stays. */
export function toolDoubleClick(): void {
  if (useToolStore.getState().tool === "member") {
    memberEvent({ type: "double-click" });
  }
}

/** Makes a tool the active one; a member in progress ends, and the hover of the other tool is dropped. */
export function chooseTool(tool: Tool): void {
  useToolStore.getState().setTool(tool);
  useViewportStore.getState().setHover(null);
}

/** Escape: back to the Select tool, ending a member in progress. */
export function escapeTool(): void {
  chooseTool("select");
}

/**
 * Deletes the selected node (with its members, their loads, its support and its loads) or the selected member
 * (with its loads) as one undo step, and clears the selection. `false` when nothing was deleted.
 */
export function deleteSelection(): boolean {
  const { selection, select } = useViewportStore.getState();
  if (selection === null) {
    return false;
  }
  const store = useModelStore.getState();
  const deleted =
    selection.kind === "node"
      ? store.deleteNode({ id: selection.id })
      : store.deleteMember({ id: selection.id });
  if (deleted) {
    select(null);
    useViewportStore.getState().setHover(null);
    useToolStore.getState().setNotice(null);
  }
  return deleted;
}

/**
 * Moves a node to a point as one undo step. `false`, with the notice `occupied`, when another node is there;
 * `false` without a notice when nothing would change.
 */
export function moveNodeAction(id: string, point: Point3): boolean {
  const before = selectModel(useModelStore.getState());
  const result = run((model) => moveNodeTo(model, id, point));
  useToolStore.getState().setNotice(result.notice);
  return result.model !== before;
}

/** Runs a key of the tools (`toolKeyAction`). */
export function runToolKey(action: ToolKeyAction): void {
  if (action.type === "escape") {
    escapeTool();
  } else if (action.type === "delete") {
    deleteSelection();
  } else {
    chooseTool(action.tool);
  }
}

/**
 * Loads another model into the model store: the undo steps, the selection, the hover, a member in progress,
 * the notice and the chosen load case are dropped; the tool, its settings, the work plane and the snap step
 * stay.
 */
export function loadModel(model: Model, source: string): void {
  useViewportStore.getState().select(null);
  useViewportStore.getState().setHover(null);
  useToolStore.getState().resetSession();
  useModelStore.getState().replaceModel(model, source);
}

/** Whether the model on screen was changed since it was loaded (there is a step to undo). */
export function hasChanges(): boolean {
  return selectCanUndo(useModelStore.getState());
}

/**
 * "New model": an empty model with the default section and material (./newModel.ts). When the present model
 * has changes, `confirm` is asked first and a `false` leaves everything as it is. Returns whether a new model
 * was started.
 */
export function startNewModel(confirm: () => boolean): boolean {
  if (hasChanges() && !confirm()) {
    return false;
  }
  loadModel(newModel(), NEW_MODEL_SOURCE);
  return true;
}
