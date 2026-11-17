/**
 * What a click does with the Node tool and with the Member tool, and moving a node to a point (card PX-02.4).
 * Pure functions `(state, model, event) => result` with no React, no zustand and no three.js import
 * (./drawTools.test.ts); ./toolActions.ts runs them on the stores. Each returns the model to use next: the
 * model it was given when nothing changed, so the caller records no undo step, or one new model per call, so
 * a member and a node it needed are one undo step.
 */
import type { Model } from "@bridle/model";
import { addMember, addNode, moveNode, nextNodeId } from "../model/commands";
import type { Point3 } from "../viewport/scene";
import { isAt, nodeAt, type ToolCursor } from "./workPlane";

/**
 * Why a tool left the model unchanged; the workspace shows a short message for each.
 * - `same-node`: a member from a node to itself;
 * - `duplicate-member`: the two nodes already have a member between them;
 * - `no-section`: the model has no section or no material for a new member;
 * - `occupied`: a node would be moved to the place of another node;
 * - `needs-node`: the Support or the Load tool was clicked where there is no node;
 * - `no-load-case`: the model has no load case for a new load;
 * - `position-outside`: a point load would stand before its member's start or beyond its end;
 * - `refused`: the model store refused for another reason.
 */
export type ToolNotice =
  | "same-node"
  | "duplicate-member"
  | "no-section"
  | "occupied"
  | "needs-node"
  | "no-load-case"
  | "position-outside"
  | "refused";

function hasNode(model: Model, id: string | null): id is string {
  return id !== null && model.nodes.some((node) => node.id === id);
}

/** The node a cursor means: the node the pointer picked, if the model holds it, else the node at its point. */
export function nodeOf(model: Model, cursor: ToolCursor): string | null {
  return hasNode(model, cursor.nodeId) ? cursor.nodeId : nodeAt(model, cursor.point);
}

export interface NodeToolResult {
  model: Model;
  /** The node to select: the one that was already there, or the new one; `null` after a refusal. */
  nodeId: string | null;
  notice: ToolNotice | null;
}

/**
 * A click of the Node tool: a new node at the cursor's point, or, when a node is there already, that node and
 * the model unchanged.
 */
export function nodeToolClick(model: Model, cursor: ToolCursor): NodeToolResult {
  const existing = nodeOf(model, cursor);
  if (existing !== null) {
    return { model, nodeId: existing, notice: null };
  }
  const id = nextNodeId(model);
  const next = addNode(model, { x: cursor.point[0], y: cursor.point[1], z: cursor.point[2] });
  return next === model
    ? { model, nodeId: null, notice: "refused" }
    : { model: next, nodeId: id, notice: null };
}

/** The Member tool between two clicks: the node the next member starts at, or `null` when none is begun. */
export interface MemberToolState {
  startNodeId: string | null;
}

export const MEMBER_TOOL_IDLE: MemberToolState = { startNodeId: null };

export type MemberToolEvent =
  | { type: "click"; cursor: ToolCursor }
  /** The second click of a double click has already arrived as a `click`. */
  | { type: "double-click" }
  | { type: "escape" };

export interface MemberToolResult {
  state: MemberToolState;
  model: Model;
  notice: ToolNotice | null;
}

function joined(model: Model, a: string, b: string): boolean {
  return model.members.some(
    (member) =>
      (member.startNodeId === a && member.endNodeId === b) ||
      (member.startNodeId === b && member.endNodeId === a),
  );
}

/**
 * One step of the Member tool.
 *
 * A click while no member is begun starts one at the cursor's node, or at a new node placed at the cursor's
 * point (the model changes by that node). A click while one is begun ends it: at the cursor's node, or at a new
 * node at the cursor's point, with a member from the start node that takes the model's first section and first
 * material; the next member starts at that end node. The new node and the member come back in one model.
 *
 * A refusal returns the model it was given (a node made for the member is not kept), keeps the start node
 * and names the reason: the start node itself, two nodes that already have a member, a model without a
 * section or a material, or anything else the commands refuse.
 *
 * `double-click` and `escape` end the chain: no start node, no notice, the model unchanged. A start node the
 * model no longer holds (it was undone or deleted) counts as none.
 */
export function memberToolStep(
  state: MemberToolState,
  model: Model,
  event: MemberToolEvent,
): MemberToolResult {
  if (event.type !== "click") {
    return { state: MEMBER_TOOL_IDLE, model, notice: null };
  }
  const { cursor } = event;
  const start = hasNode(model, state.startNodeId) ? state.startNodeId : null;
  const target = nodeOf(model, cursor);
  const args = { x: cursor.point[0], y: cursor.point[1], z: cursor.point[2] };

  if (start === null) {
    if (target !== null) {
      return { state: { startNodeId: target }, model, notice: null };
    }
    const id = nextNodeId(model);
    const next = addNode(model, args);
    return next === model
      ? { state: MEMBER_TOOL_IDLE, model, notice: "refused" }
      : { state: { startNodeId: id }, model: next, notice: null };
  }

  const refuse = (notice: ToolNotice): MemberToolResult => ({
    state: { startNodeId: start },
    model,
    notice,
  });
  if (target === start) {
    return refuse("same-node");
  }
  if (target !== null && joined(model, start, target)) {
    return refuse("duplicate-member");
  }
  if (model.sections.length === 0 || model.materials.length === 0) {
    return refuse("no-section");
  }
  const endId = target ?? nextNodeId(model);
  const withEnd = target === null ? addNode(model, args) : model;
  if (target === null && withEnd === model) {
    return refuse("refused");
  }
  const withMember = addMember(withEnd, { startNodeId: start, endNodeId: endId });
  if (withMember === withEnd) {
    return refuse("refused");
  }
  return { state: { startNodeId: endId }, model: withMember, notice: null };
}

export interface MoveNodeResult {
  model: Model;
  notice: ToolNotice | null;
}

/**
 * A node moved to `point`. The model comes back unchanged, with the notice `occupied`, when another node is at
 * that point already; unchanged and without a notice when the node is there already, is not in the model, or
 * a coordinate is not finite.
 */
export function moveNodeTo(model: Model, id: string, point: Point3): MoveNodeResult {
  const occupied = model.nodes.some((node) => node.id !== id && isAt(node, point));
  if (occupied && hasNode(model, id)) {
    return { model, notice: "occupied" };
  }
  return { model: moveNode(model, { id, x: point[0], y: point[1], z: point[2] }), notice: null };
}

/** What the viewport draws for the tool in use, over the model. */
export interface ToolPreview {
  /** Where the marker is; `null` when there is none. */
  marker: Point3 | null;
  /** Preview lines as flat coordinates, six numbers per line (`x, y, z` of the start, then of the end). */
  segments: number[];
}

const NO_PREVIEW: ToolPreview = { marker: null, segments: [] };

/**
 * The preview of the tool in use.
 * - While a node is dragged: the marker where the node would land, and a line from there to the other end of
 *   each member of that node.
 * - Node or Member tool with a cursor: the marker at the cursor; for the Member tool with a member begun, a
 *   line from the start node to the cursor, unless the cursor is the start node itself.
 * - Support or Load tool: the marker on the node the cursor is at, and no marker away from a node (these
 *   tools act on nodes only).
 * - Otherwise nothing.
 */
export function toolPreview(
  tools: {
    tool: "select" | "node" | "member" | "support" | "load";
    cursor: ToolCursor | null;
    memberStart: string | null;
    drag: { nodeId: string; point: Point3 } | null;
  },
  model: Model,
): ToolPreview {
  const place = (id: string): Point3 | null => {
    const node = model.nodes.find((candidate) => candidate.id === id);
    return node ? [node.x, node.y, node.z] : null;
  };
  if (tools.drag !== null) {
    const { nodeId, point } = tools.drag;
    const segments: number[] = [];
    for (const member of model.members) {
      const otherId =
        member.startNodeId === nodeId
          ? member.endNodeId
          : member.endNodeId === nodeId
            ? member.startNodeId
            : null;
      const other = otherId === null || otherId === nodeId ? null : place(otherId);
      if (other !== null) {
        segments.push(...other, ...point);
      }
    }
    return { marker: point, segments };
  }
  if (tools.tool === "select" || tools.cursor === null) {
    return NO_PREVIEW;
  }
  const { cursor } = tools;
  if (tools.tool === "support" || tools.tool === "load") {
    return cursor.nodeId === null ? NO_PREVIEW : { marker: cursor.point, segments: [] };
  }
  const start =
    tools.tool === "member" && tools.memberStart !== null && tools.memberStart !== cursor.nodeId
      ? place(tools.memberStart)
      : null;
  return { marker: cursor.point, segments: start === null ? [] : [...start, ...cursor.point] };
}
