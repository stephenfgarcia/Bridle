// The model of the workspace (card PX-02.3): one zustand store that holds the model with its undo history and
// runs the commands of ./commands.ts on it. The commands and the history (./history.ts) are pure; this file
// only wires them. What is hovered and selected in the viewport is in ../viewport/viewportStore.ts.
import { type Model, type ModelIssue, portalFrame, validateModel } from "@bridle/model";
import { create, type StateCreator } from "zustand";
import * as commands from "./commands";
import {
  canRedo,
  canUndo,
  createHistory,
  HISTORY_LIMIT,
  type History,
  record,
  redo,
  undo,
} from "./history";

/** Runs a command that changes an entry; `true` when the model changed, `false` when the command refused. */
type Change<A> = (args: A) => boolean;
/** Runs a command that adds an entry; the id of the new entry, or `null` when the command refused. */
type Add<A> = (args: A) => string | null;

export interface ModelState {
  /** The model on screen is `history.present`; read it with `selectModel`. */
  history: History<Model>;
  /** The tag given with the model that was last loaded (`replaceModel`), for example the name of an example. */
  source: string;
  /** How many times a whole model was loaded since the store was made; it does not change on an edit or an undo. */
  loadCount: number;

  /** One step back; nothing when there is none. */
  undo: () => void;
  /** One undone step forward again; nothing when there is none. */
  redo: () => void;
  /**
   * Loads another model: it becomes the present one, the undo and redo steps are dropped and `loadCount`
   * goes up by one, also when the model is the object already on screen. Not an undo step.
   */
  replaceModel: (model: Model, source?: string) => void;
  /**
   * Runs any pure change of the model as one undo step. A change that returns the model it was given records
   * nothing and returns `false`. The named actions below are this with one command of ./commands.ts each.
   */
  apply: (change: (model: Model) => Model) => boolean;

  addNode: Add<commands.AddNodeArgs>;
  moveNode: Change<commands.MoveNodeArgs>;
  deleteNode: Change<commands.DeleteNodeArgs>;
  addMember: Add<commands.AddMemberArgs>;
  deleteMember: Change<commands.DeleteMemberArgs>;
  updateMember: Change<commands.UpdateMemberArgs>;
  setSupport: Change<commands.SetSupportArgs>;
  removeSupport: Change<commands.RemoveSupportArgs>;
  addNodalLoad: Add<commands.AddNodalLoadArgs>;
  updateNodalLoad: Change<commands.UpdateNodalLoadArgs>;
  removeNodalLoad: Change<commands.RemoveLoadArgs>;
  addMemberUniformLoad: Add<commands.AddMemberUniformLoadArgs>;
  updateMemberUniformLoad: Change<commands.UpdateMemberUniformLoadArgs>;
  removeMemberUniformLoad: Change<commands.RemoveLoadArgs>;
  addMemberPointLoad: Add<commands.AddMemberPointLoadArgs>;
  updateMemberPointLoad: Change<commands.UpdateMemberPointLoadArgs>;
  removeMemberPointLoad: Change<commands.RemoveLoadArgs>;
  addSection: Add<commands.AddSectionArgs>;
  addMaterial: Add<commands.AddMaterialArgs>;
  addLoadCase: Add<commands.AddLoadCaseArgs>;
}

/**
 * The state and the actions of a model store that starts with `initial`. `limit` is the number of undo steps
 * it keeps (`HISTORY_LIMIT` by default). The application has one store, `useModelStore`; a test makes its own
 * with `createStore(createModelState(model, ""))` from `zustand/vanilla`.
 */
export function createModelState(
  initial: Model,
  source: string,
  limit: number = HISTORY_LIMIT,
): StateCreator<ModelState> {
  return (set, get) => {
    const apply = (change: (model: Model) => Model): boolean => {
      const { history } = get();
      const next = record(history, change(history.present), limit);
      if (next === history) {
        return false;
      }
      set({ history: next });
      return true;
    };
    const change =
      <A>(command: (model: Model, args: A) => Model): Change<A> =>
      (args) =>
        apply((model) => command(model, args));
    const add =
      <A>(command: (model: Model, args: A) => Model, idOf: (model: Model) => string): Add<A> =>
      (args) => {
        const id = idOf(get().history.present);
        return apply((model) => command(model, args)) ? id : null;
      };
    return {
      history: createHistory(initial),
      source,
      loadCount: 0,

      // `undo` and `redo` of ./history.ts return the history they were given when there is no step: the
      // state then stays the same object and no subscriber is told.
      undo: () =>
        set((state) => {
          const history = undo(state.history);
          return history === state.history ? state : { history };
        }),
      redo: () =>
        set((state) => {
          const history = redo(state.history);
          return history === state.history ? state : { history };
        }),
      replaceModel: (model, nextSource = "") =>
        set((state) => ({
          history: createHistory(commands.replaceModel(state.history.present, { model })),
          source: nextSource,
          loadCount: state.loadCount + 1,
        })),
      apply,

      addNode: add(commands.addNode, commands.nextNodeId),
      moveNode: change(commands.moveNode),
      deleteNode: change(commands.deleteNode),
      addMember: add(commands.addMember, commands.nextMemberId),
      deleteMember: change(commands.deleteMember),
      updateMember: change(commands.updateMember),
      setSupport: change(commands.setSupport),
      removeSupport: change(commands.removeSupport),
      addNodalLoad: add(commands.addNodalLoad, commands.nextNodalLoadId),
      updateNodalLoad: change(commands.updateNodalLoad),
      removeNodalLoad: change(commands.removeNodalLoad),
      addMemberUniformLoad: add(commands.addMemberUniformLoad, commands.nextMemberUniformLoadId),
      updateMemberUniformLoad: change(commands.updateMemberUniformLoad),
      removeMemberUniformLoad: change(commands.removeMemberUniformLoad),
      addMemberPointLoad: add(commands.addMemberPointLoad, commands.nextMemberPointLoadId),
      updateMemberPointLoad: change(commands.updateMemberPointLoad),
      removeMemberPointLoad: change(commands.removeMemberPointLoad),
      addSection: add(commands.addSection, commands.nextSectionId),
      addMaterial: add(commands.addMaterial, commands.nextMaterialId),
      addLoadCase: add(commands.addLoadCase, commands.nextLoadCaseId),
    };
  };
}

/** The tag of the model the application starts with: the portal frame of `@bridle/model`. */
export const INITIAL_SOURCE = "portal";

/** The model store of the application. It starts with the portal frame and lives as long as the page. */
export const useModelStore = create<ModelState>()(createModelState(portalFrame(), INITIAL_SOURCE));

// --- Selectors: `useModelStore(selectModel)` in a component, `selectModel(useModelStore.getState())` outside.

/** The model on screen. The same object until a command changes it, an undo or redo replaces it, or a model is loaded. */
export const selectModel = (state: ModelState): Model => state.history.present;
export const selectCanUndo = (state: ModelState): boolean => canUndo(state.history);
export const selectCanRedo = (state: ModelState): boolean => canRedo(state.history);
/** A key that changes only when a whole model is loaded: the viewport frames the model again when it changes. */
export const selectFrameKey = (state: ModelState): string => String(state.loadCount);

const issuesByModel = new WeakMap<Model, ModelIssue[]>();

/**
 * The issues `validateModel` finds in a model, computed once per model object: a second call with the same
 * object returns the same array, also after an undo brings the object back.
 */
export function issuesOf(model: Model): ModelIssue[] {
  let issues = issuesByModel.get(model);
  if (issues === undefined) {
    issues = validateModel(model);
    issuesByModel.set(model, issues);
  }
  return issues;
}

/** The issues of the model on screen (`issuesOf`). */
export const selectIssues = (state: ModelState): ModelIssue[] => issuesOf(state.history.present);
