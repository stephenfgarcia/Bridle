/**
 * The geometry of the drawing tools (card PX-02.4): the work plane, the point of it under a pointer ray, the
 * snap to a grid, and which node a pointer or a point means. Pure functions with no three.js and no React
 * import, so they are unit-tested without WebGL (./workPlane.test.ts); ../viewport/ToolLayer.tsx hands them the
 * camera's ray and the nodes' places on screen.
 *
 * Coordinates are the model's: global axes, Z up, metres.
 */
import type { Model } from "@bridle/model";
import {
  type GridSpec,
  gridFor,
  gridLines,
  type Point3,
  type SceneBounds,
} from "../viewport/scene";

/**
 * The plane the tools place points on.
 * - `xz`: the vertical plane of X and Z at `Y = offset` (a frame drawn in elevation);
 * - `xy`: the horizontal plane of X and Y at `Z = offset` (a plan).
 */
export interface WorkPlane {
  kind: WorkPlaneKind;
  /** The coordinate, in m, of the plane along the axis it is normal to: Y for `xz`, Z for `xy`. */
  offset: number;
}

export type WorkPlaneKind = "xz" | "xy";

export const WORK_PLANE_KINDS: readonly WorkPlaneKind[] = ["xz", "xy"];

export const DEFAULT_WORK_PLANE: WorkPlane = { kind: "xz", offset: 0 };

/** The snap steps the workspace offers, in m. */
export const SNAP_STEPS = [0.1, 0.25, 0.5, 1] as const;

export type SnapStep = (typeof SNAP_STEPS)[number];

export const DEFAULT_SNAP_STEP: SnapStep = 0.5;

export function isSnapStep(value: number): value is SnapStep {
  return (SNAP_STEPS as readonly number[]).includes(value);
}

/**
 * A ray that meets the plane at less than this (the absolute cosine of the angle between the ray and the
 * plane's normal, about 3 degrees off the plane) has no point: the plane is seen edge-on, and a pixel of
 * pointer movement would move the point by metres.
 */
export const MIN_PLANE_INCIDENCE = 0.05;

/** Two places closer than this, in m, are the same place for the tools (a node "at" a point). */
export const SAME_PLACE_TOLERANCE = 1e-6;

/** How near the pointer must be to a node on screen, in CSS pixels, to mean that node. */
export const NODE_PICK_RADIUS_PX = 9;

/** The index in a `Point3` of the axis the plane is normal to: 1 (Y) for `xz`, 2 (Z) for `xy`. */
export function normalAxis(plane: Pick<WorkPlane, "kind">): 1 | 2 {
  return plane.kind === "xz" ? 1 : 2;
}

/**
 * Where a ray meets the work plane: the point `origin + t * direction` with `t > 0` that lies on the plane,
 * its coordinate along the plane's normal set to the plane's offset exactly. `null` when the ray runs along the
 * plane (`MIN_PLANE_INCIDENCE`), points away from it, starts on it, or holds a number that is not finite.
 * `direction` may have any length above zero.
 */
export function rayToPlane(origin: Point3, direction: Point3, plane: WorkPlane): Point3 | null {
  if (![...origin, ...direction, plane.offset].every(Number.isFinite)) {
    return null;
  }
  const length = Math.hypot(direction[0], direction[1], direction[2]);
  if (!(length > 0)) {
    return null;
  }
  const axis = normalAxis(plane);
  if (Math.abs(direction[axis]) / length < MIN_PLANE_INCIDENCE) {
    return null;
  }
  const t = (plane.offset - origin[axis]) / direction[axis];
  if (!(t > 0)) {
    return null;
  }
  const point: [number, number, number] = [
    origin[0] + t * direction[0],
    origin[1] + t * direction[1],
    origin[2] + t * direction[2],
  ];
  point[axis] = plane.offset;
  return point;
}

/**
 * The multiple of `step` nearest to `value` (a half rounds up), written with at most four decimals so that
 * 3 steps of 0.1 are 0.3 and not 0.30000000000000004. Never a negative zero.
 */
export function snapValue(value: number, step: number): number {
  return Number((Math.round(value / step) * step).toFixed(4)) + 0;
}

/**
 * A point of the work plane moved to the plane's snap grid: its two coordinates in the plane are snapped to
 * multiples of `step`, and its coordinate along the plane's normal is the plane's offset, not snapped.
 */
export function snapToPlane(point: Point3, plane: WorkPlane, step: number): Point3 {
  const axis = normalAxis(plane);
  const snapped: [number, number, number] = [
    snapValue(point[0], step),
    snapValue(point[1], step),
    snapValue(point[2], step),
  ];
  snapped[axis] = plane.offset;
  return snapped;
}

/** The plane of the same kind as `plane` that passes through `point` (a node is dragged on this plane). */
export function planeThrough(plane: Pick<WorkPlane, "kind">, point: Point3): WorkPlane {
  return { kind: plane.kind, offset: point[normalAxis(plane)] };
}

/** Whether a node is within `tolerance` of `point` along every axis. */
export function isAt(
  node: { x: number; y: number; z: number },
  point: Point3,
  tolerance: number = SAME_PLACE_TOLERANCE,
): boolean {
  return (
    Math.abs(node.x - point[0]) <= tolerance &&
    Math.abs(node.y - point[1]) <= tolerance &&
    Math.abs(node.z - point[2]) <= tolerance
  );
}

/** The id of the first node of the model within `tolerance` of `point` along every axis, or `null`. */
export function nodeAt(
  model: Model,
  point: Point3,
  tolerance: number = SAME_PLACE_TOLERANCE,
): string | null {
  const found = model.nodes.find((node) => isAt(node, point, tolerance));
  return found ? found.id : null;
}

/** A node's place on screen, in CSS pixels from the top left corner of the canvas. */
export interface ScreenNode {
  id: string;
  x: number;
  y: number;
}

/**
 * The node the pointer means: the one nearest to the pointer on screen among those within `radiusPx`, the
 * earlier one of two at the same distance; `null` when none is that near.
 */
export function pickNodeOnScreen(
  nodes: readonly ScreenNode[],
  pointer: { x: number; y: number },
  radiusPx: number = NODE_PICK_RADIUS_PX,
): string | null {
  let best: string | null = null;
  let bestDistance = radiusPx;
  for (const node of nodes) {
    const distance = Math.hypot(node.x - pointer.x, node.y - pointer.y);
    if (distance <= radiusPx && (best === null || distance < bestDistance)) {
      best = node.id;
      bestDistance = distance;
    }
  }
  return best;
}

/** Where a tool would act: a point, and the node that is there, if any. */
export interface ToolCursor {
  point: Point3;
  nodeId: string | null;
}

/**
 * The cursor of a drawing tool.
 * - When the pointer is on a node of the model (`pickedNodeId`), the cursor is that node, wherever it lies:
 *   a node off the work plane can be picked too.
 * - Otherwise it is the snapped point of the work plane under the pointer (`hit` is `rayToPlane`'s result),
 *   with the node that already is at that point, if any.
 * - `null` when there is neither.
 */
export function cursorFor(input: {
  model: Model;
  plane: WorkPlane;
  step: number;
  hit: Point3 | null;
  pickedNodeId: string | null;
}): ToolCursor | null {
  const picked =
    input.pickedNodeId === null
      ? undefined
      : input.model.nodes.find((node) => node.id === input.pickedNodeId);
  if (picked) {
    return { point: [picked.x, picked.y, picked.z], nodeId: picked.id };
  }
  if (input.hit === null) {
    return null;
  }
  const point = snapToPlane(input.hit, input.plane, input.step);
  return { point, nodeId: nodeAt(input.model, point) };
}

export function sameCursor(a: ToolCursor | null, b: ToolCursor | null): boolean {
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

/** A coordinate as text: at most four decimals, no trailing zeros, never "-0". */
export function formatCoordinate(value: number): string {
  return String(Number(value.toFixed(4)) + 0);
}

/**
 * The number a person typed in a coordinate field: surrounding white space is dropped and a decimal comma is
 * read as a point. `null` for an empty text and for anything that is not a finite number.
 */
export function parseCoordinate(text: string): number | null {
  const trimmed = text.trim().replace(",", ".");
  if (trimmed === "") {
    return null;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value + 0 : null;
}

/** A point as `x,y,z` (`formatCoordinate` each): the text of the viewport's `data-cursor` attribute. */
export function pointText(point: Point3): string {
  return point.map(formatCoordinate).join(",");
}

/**
 * The box the drawing area of an empty model covers, on the work plane: 8 m along X from the origin and 5 m
 * along the plane's other axis. The camera frames it when an empty model is opened, and the grids always
 * cover it (`drawingBounds`).
 */
export function emptyModelBounds(plane: WorkPlane): SceneBounds {
  const min: [number, number, number] = [0, 0, 0];
  const max: [number, number, number] = plane.kind === "xz" ? [8, 0, 5] : [8, 5, 0];
  const axis = normalAxis(plane);
  min[axis] = plane.offset;
  max[axis] = plane.offset;
  return {
    min,
    max,
    center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
  };
}

/**
 * The box the grids are sized for: the model's box and the drawing area of an empty model together, so the
 * grids do not change size while the first nodes of a model are placed inside that area.
 */
export function drawingBounds(
  model: SceneBounds,
  hasNodes: boolean,
  plane: WorkPlane,
): SceneBounds {
  const area = emptyModelBounds(plane);
  if (!hasNodes) {
    return area;
  }
  const min: Point3 = [
    Math.min(model.min[0], area.min[0]),
    Math.min(model.min[1], area.min[1]),
    Math.min(model.min[2], area.min[2]),
  ];
  const max: Point3 = [
    Math.max(model.max[0], area.max[0]),
    Math.max(model.max[1], area.max[1]),
    Math.max(model.max[2], area.max[2]),
  ];
  return {
    min,
    max,
    center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
  };
}

/** The grid drawn on the work plane: line segments as flat coordinate lists, and the four corners of its area. */
export interface WorkPlaneGrid {
  minor: number[];
  major: number[];
  /** The corners of the gridded rectangle, in order around it. */
  corners: [Point3, Point3, Point3, Point3];
}

/**
 * The grid of the work plane around `bounds`: 1 m cells with a major line every 5 m (or the wider step
 * `gridFor` chooses for a large model), covering the extent of `bounds` in the plane with `gridFor`'s margin.
 * The lines show where the plane is; they are not the snap grid, whose step may be finer.
 */
export function workPlaneGrid(plane: WorkPlane, bounds: SceneBounds): WorkPlaneGrid {
  // `gridFor` and `gridLines` work on X and Y at Z = 0: for the vertical plane, the model's Z plays Y there.
  const inPlane = (point: Point3): Point3 =>
    plane.kind === "xz" ? [point[0], point[2], 0] : [point[0], point[1], 0];
  const flat: SceneBounds = {
    min: inPlane(bounds.min),
    max: inPlane(bounds.max),
    center: inPlane(bounds.center),
  };
  const spec: GridSpec = gridFor(flat);
  const place = (u: number, v: number): Point3 =>
    plane.kind === "xz" ? [u, plane.offset, v] : [u, v, plane.offset];
  const remap = (flatLines: number[]): number[] => {
    const out: number[] = [];
    for (let i = 0; i < flatLines.length; i += 3) {
      out.push(...place(flatLines[i] as number, flatLines[i + 1] as number));
    }
    return out;
  };
  const lines = gridLines(spec);
  return {
    minor: remap(lines.minor),
    major: remap(lines.major),
    corners: [
      place(spec.minX, spec.minY),
      place(spec.maxX, spec.minY),
      place(spec.maxX, spec.maxY),
      place(spec.minX, spec.maxY),
    ],
  };
}
