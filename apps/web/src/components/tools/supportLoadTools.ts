/**
 * The rules of the Support tool, the Load tool, the "Restrain out of plane" helper and the rows of a nodal load
 * in the side panel (card PX-02.5). Pure functions with no React, no zustand and no three.js import
 * (./supportLoadTools.test.ts); ./toolActions.ts runs them on the stores. As in ./drawTools.ts, each returns
 * the model to use next: the model it was given when nothing changed, so the caller records no undo step.
 */
import type { LoadDirection, Model, NodalLoad, Support } from "@bridle/model";
import {
  addNodalLoad,
  nextNodalLoadId,
  removeSupport,
  setSupport,
  type UpdateNodalLoadArgs,
} from "../model/commands";
import { nodeOf, type ToolNotice } from "./drawTools";
import { SAME_PLACE_TOLERANCE, type ToolCursor } from "./workPlane";

/** The six restraints of a node, without the node: `true` is restrained. */
export type Restraints = Omit<Support, "nodeId">;

export const RESTRAINT_KEYS = ["ux", "uy", "uz", "rx", "ry", "rz"] as const;

export type RestraintKey = (typeof RESTRAINT_KEYS)[number];

const FREE: Restraints = { ux: false, uy: false, uz: false, rx: false, ry: false, rz: false };

/** The supports the Support tool places. */
export type SupportChoice = "fixed" | "pinned" | "roller";

export const SUPPORT_CHOICES: readonly SupportChoice[] = ["fixed", "pinned", "roller"];

export const DEFAULT_SUPPORT_CHOICE: SupportChoice = "fixed";

/**
 * What each choice of the Support tool restrains:
 * - `fixed`: the three translations and the three rotations;
 * - `pinned`: the three translations `ux`, `uy`, `uz`; the rotations are free;
 * - `roller`: `uy` and `uz`; `ux` and the rotations are free. For a frame in an X-Z plane that is a roller
 *   that carries vertical load, is held out of the plane and rolls along X. The choice does not depend on the
 *   work plane.
 */
export function supportRestraints(choice: SupportChoice): Restraints {
  if (choice === "fixed") {
    return { ux: true, uy: true, uz: true, rx: true, ry: true, rz: true };
  }
  if (choice === "pinned") {
    return { ...FREE, ux: true, uy: true, uz: true };
  }
  return { ...FREE, uy: true, uz: true };
}

/** The restraints of a node: those of its first support, or six times `false` when it has none. */
export function restraintsOf(model: Model, nodeId: string): Restraints {
  const support = model.supports.find((candidate) => candidate.nodeId === nodeId);
  if (support === undefined) {
    return FREE;
  }
  const { ux, uy, uz, rx, ry, rz } = support;
  return { ux, uy, uz, rx, ry, rz };
}

function sameRestraints(a: Restraints, b: Restraints): boolean {
  return RESTRAINT_KEYS.every((key) => a[key] === b[key]);
}

export interface NodeClickResult {
  model: Model;
  /** The node the click meant; `null` when it meant none. */
  nodeId: string | null;
  notice: ToolNotice | null;
}

/**
 * A click of the Support tool. On a node it sets the node's support to the restraints of `choice`, replacing
 * the support the node has; on a node whose support already is exactly those restraints it removes the
 * support. Away from a node it changes nothing and gives the notice `needs-node`.
 */
export function supportToolClick(
  model: Model,
  cursor: ToolCursor,
  choice: SupportChoice,
): NodeClickResult {
  const nodeId = nodeOf(model, cursor);
  if (nodeId === null) {
    return { model, nodeId: null, notice: "needs-node" };
  }
  const wanted = supportRestraints(choice);
  const has = model.supports.some((candidate) => candidate.nodeId === nodeId);
  const next =
    has && sameRestraints(restraintsOf(model, nodeId), wanted)
      ? removeSupport(model, { nodeId })
      : setSupport(model, { nodeId, ...wanted });
  return { model: next, nodeId, notice: next === model ? "refused" : null };
}

/** The node's support with one restraint set or cleared; the other five keep their values. */
export function withRestraint(
  model: Model,
  nodeId: string,
  key: RestraintKey,
  restrained: boolean,
): Model {
  return setSupport(model, { nodeId, ...restraintsOf(model, nodeId), [key]: restrained });
}

/** The restraints "Restrain out of plane" adds to every node of a frame in an X-Z plane. */
export const OUT_OF_PLANE_KEYS = ["uy", "rx", "rz"] as const;

/**
 * - `done`: the restraints were added;
 * - `already`: every node had them, nothing changed;
 * - `no-nodes`: the model has no node;
 * - `not-planar`: the nodes do not all lie in one X-Z plane (they do not share one Y, within
 *   `SAME_PLACE_TOLERANCE`), or a Y is not a finite number.
 */
export type OutOfPlaneOutcome = "done" | "already" | "no-nodes" | "not-planar";

export interface OutOfPlaneResult {
  model: Model;
  outcome: OutOfPlaneOutcome;
  /** How many nodes got a restraint they did not have. */
  changed: number;
}

/**
 * "Restrain out of plane": for a model whose nodes all lie in one X-Z plane, every node gets the restraints
 * `uy`, `rx` and `rz` in addition to the ones it has (a node without a support gets a support with these
 * three). It comes back as one model, so it is one undo step. Any other model comes back unchanged, with the
 * outcome that says why.
 */
export function restrainOutOfPlane(model: Model): OutOfPlaneResult {
  const first = model.nodes[0];
  if (first === undefined) {
    return { model, outcome: "no-nodes", changed: 0 };
  }
  const planar = model.nodes.every(
    (node) => Number.isFinite(node.y) && Math.abs(node.y - first.y) <= SAME_PLACE_TOLERANCE,
  );
  if (!planar) {
    return { model, outcome: "not-planar", changed: 0 };
  }
  let next = model;
  let changed = 0;
  const seen = new Set<string>();
  for (const node of model.nodes) {
    if (seen.has(node.id)) {
      continue;
    }
    seen.add(node.id);
    const after = setSupport(next, {
      nodeId: node.id,
      ...restraintsOf(next, node.id),
      uy: true,
      rx: true,
      rz: true,
    });
    if (after !== next) {
      changed += 1;
      next = after;
    }
  }
  return { model: next, outcome: changed === 0 ? "already" : "done", changed };
}

/** The six components of a nodal load: forces along and moments about the global axes. */
export const NODAL_COMPONENTS = ["fx", "fy", "fz", "mx", "my", "mz"] as const;

export type NodalComponent = (typeof NODAL_COMPONENTS)[number];

/** Whether a component is a moment (kN·m) and not a force (kN). */
export function isMoment(component: NodalComponent): boolean {
  return component.startsWith("m");
}

/** What the Load tool places on a node: a force along, or a moment about, one global axis. */
export interface LoadToolForm {
  kind: "force" | "moment";
  direction: LoadDirection;
  /** kN for a force, kN·m for a moment; signed along or about the axis. */
  value: number;
}

/** A force of 10 kN downward. */
export const DEFAULT_LOAD_FORM: LoadToolForm = { kind: "force", direction: "z", value: -10 };

/** The component of a nodal load that a form of the Load tool sets. */
export function formComponent(form: Pick<LoadToolForm, "kind" | "direction">): NodalComponent {
  return `${form.kind === "moment" ? "m" : "f"}${form.direction}`;
}

export interface LoadClickResult extends NodeClickResult {
  /** The id of the load that was added; `null` when none was. */
  loadId: string | null;
}

/**
 * A click of the Load tool: on a node, a new nodal load in the load case `loadCaseId` with the form's value in
 * the form's component and zero in the other five. Away from a node: nothing, with the notice `needs-node`.
 * Without a load case (`loadCaseId` is `null`): nothing, with `no-load-case`. Anything else the command
 * refuses (a value that is not finite, a load case the model does not hold): nothing, with `refused`.
 */
export function loadToolClick(
  model: Model,
  cursor: ToolCursor,
  form: LoadToolForm,
  loadCaseId: string | null,
): LoadClickResult {
  const nodeId = nodeOf(model, cursor);
  if (nodeId === null) {
    return { model, nodeId: null, loadId: null, notice: "needs-node" };
  }
  if (loadCaseId === null) {
    return { model, nodeId, loadId: null, notice: "no-load-case" };
  }
  const loadId = nextNodalLoadId(model);
  const next = addNodalLoad(model, { nodeId, loadCaseId, [formComponent(form)]: form.value });
  return next === model
    ? { model, nodeId, loadId: null, notice: "refused" }
    : { model: next, nodeId, loadId, notice: null };
}

/** One line of a nodal load in the side panel: one component and its value. */
export interface NodalLoadRow {
  component: NodalComponent;
  value: number;
}

/**
 * The lines the side panel shows for a nodal load: one per component that is not zero, in the order `fx`,
 * `fy`, `fz`, `mx`, `my`, `mz`; for a load whose six components are zero, one line `fz` with the value 0.
 */
export function nodalLoadRows(load: NodalLoad): NodalLoadRow[] {
  const rows = NODAL_COMPONENTS.filter((component) => load[component] !== 0).map((component) => ({
    component,
    value: load[component],
  }));
  return rows.length > 0 ? rows : [{ component: "fz", value: 0 }];
}

/**
 * The update of a nodal load for an edit of one of its lines: the line's component `from` becomes zero and
 * the component `to` takes `value` (the same component twice changes the value only; a component that
 * already had a value is overwritten). The other components are not in the update and keep their values.
 */
export function nodalLoadEdit(
  load: NodalLoad,
  from: NodalComponent,
  to: NodalComponent,
  value: number,
): UpdateNodalLoadArgs {
  return from === to ? { id: load.id, [to]: value } : { id: load.id, [from]: 0, [to]: value };
}
