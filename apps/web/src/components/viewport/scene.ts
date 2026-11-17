/**
 * From a `Model` to what the viewport draws (card PX-02.2). Pure functions with no three.js import, so they are
 * unit-tested without WebGL (./scene.test.ts); the React components only render this output.
 *
 * Coordinates are the model's own: global axes, Z up, metres. Nothing is converted here; the canvas makes Z the
 * screen's up direction (./camera.ts, `SCENE_UP`).
 */
import type { Member, Model, Support } from "@bridle/model";
import { activeLoadCaseId, buildLoads, type DrawnLoad } from "./loads";

/** A point or a vector as `[x, y, z]` in the model's global axes. */
export type Point3 = readonly [number, number, number];

/** The symbol a support is drawn with (`supportGlyph`). */
export type SupportGlyph = "fixed" | "pinned" | "roller" | "plane" | "generic";

export interface DrawnNode {
  id: string;
  position: Point3;
}

export interface DrawnMember {
  id: string;
  kind: Member["kind"];
  start: Point3;
  end: Point3;
}

export interface DrawnSupport {
  nodeId: string;
  position: Point3;
  glyph: SupportGlyph;
}

/** The lengths of the model's own lists, whether or not every entry could be drawn. */
export interface SceneCounts {
  nodes: number;
  members: number;
  supports: number;
}

/** The axis-aligned box around the drawn nodes. */
export interface SceneBounds {
  min: Point3;
  max: Point3;
  center: Point3;
}

/** The ground grid: lines on the plane Z = 0, `step` metres apart, every `majorEvery`-th one a major line. */
export interface GridSpec {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  step: number;
  majorEvery: number;
}

export interface SceneDescription {
  nodes: DrawnNode[];
  members: DrawnMember[];
  supports: DrawnSupport[];
  /** The loads of the active load case (./loads.ts). */
  loads: DrawnLoad[];
  counts: SceneCounts;
  bounds: SceneBounds;
  grid: GridSpec;
}

/** Every `GRID_MAJOR_EVERY`-th grid line is a major line. */
export const GRID_MAJOR_EVERY = 5;

/** The grid keeps at most this many cells along its longer side; beyond it the step grows tenfold. */
export const GRID_MAX_CELLS = 200;

/**
 * The symbol for a support, decided from its six restraint flags:
 * - `fixed`: the three translations and the three rotations are restrained;
 * - `pinned`: the three translations are restrained and at least one rotation is free;
 * - `roller`: the translation along Z is restrained, at least one of the translations along X and Y is free,
 *   and of the rotations either none is restrained or exactly `rx` and `rz` are (a roller of a frame in an
 *   X-Z plane that "Restrain out of plane" was applied to; `ry`, the rotation in that plane, is free);
 * - `plane`: something is restrained, and only among `uy`, `rx` and `rz`: the restraints that hold a frame in
 *   its X-Z plane and carry none of its in-plane loads. Drawn as a small mark, not as a support symbol;
 * - `generic`: any other combination.
 */
export function supportGlyph(support: Support): SupportGlyph {
  const { ux, uy, uz, rx, ry, rz } = support;
  const translations = ux && uy && uz;
  const rotations = [rx, ry, rz].filter(Boolean).length;
  if (translations) {
    return rotations === 3 ? "fixed" : "pinned";
  }
  if (uz && (rotations === 0 || (rotations === 2 && rx && rz))) {
    return "roller";
  }
  if (!ux && !uz && !ry && (uy || rx || rz)) {
    return "plane";
  }
  return "generic";
}

function boundsOf(points: readonly Point3[]): SceneBounds {
  if (points.length === 0) {
    return { min: [0, 0, 0], max: [0, 0, 0], center: [0, 0, 0] };
  }
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const point of points) {
    for (const axis of [0, 1, 2] as const) {
      min[axis] = Math.min(min[axis], point[axis]);
      max[axis] = Math.max(max[axis], point[axis]);
    }
  }
  return {
    min,
    max,
    center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
  };
}

/** `roomForLoads` widens a box by this fraction of its largest dimension, on every side. */
export const LOAD_ROOM_RATIO = 0.12;

/**
 * The box the camera frames for a model that has loads drawn: `bounds` widened on every side by
 * `LOAD_ROOM_RATIO` of its largest dimension, so that arrows and their values around the model have room in
 * the picture. The centre stays; a box without extent stays as it is.
 */
export function roomForLoads(bounds: SceneBounds): SceneBounds {
  const room =
    Math.max(
      bounds.max[0] - bounds.min[0],
      bounds.max[1] - bounds.min[1],
      bounds.max[2] - bounds.min[2],
    ) * LOAD_ROOM_RATIO;
  return {
    min: [bounds.min[0] - room, bounds.min[1] - room, bounds.min[2] - room],
    max: [bounds.max[0] + room, bounds.max[1] + room, bounds.max[2] + room],
    center: bounds.center,
  };
}

/**
 * The ground grid for a model with these bounds: it covers the model's plan (its X and Y extent) with a margin
 * of half the longer plan dimension, at least 2 m, and its edges are major lines. The step is 1 m, or the
 * power of ten that keeps the longer side at `GRID_MAX_CELLS` cells or fewer.
 */
export function gridFor(bounds: SceneBounds): GridSpec {
  const spanX = bounds.max[0] - bounds.min[0];
  const spanY = bounds.max[1] - bounds.min[1];
  const margin = Math.max(2, Math.max(spanX, spanY) / 2);
  let step = 1;
  for (;;) {
    const major = step * GRID_MAJOR_EVERY;
    // `+ 0` turns a negative zero into zero.
    const spec: GridSpec = {
      minX: Math.floor((bounds.min[0] - margin) / major) * major + 0,
      maxX: Math.ceil((bounds.max[0] + margin) / major) * major + 0,
      minY: Math.floor((bounds.min[1] - margin) / major) * major + 0,
      maxY: Math.ceil((bounds.max[1] + margin) / major) * major + 0,
      step,
      majorEvery: GRID_MAJOR_EVERY,
    };
    if (Math.max(spec.maxX - spec.minX, spec.maxY - spec.minY) / step <= GRID_MAX_CELLS) {
      return spec;
    }
    step *= 10;
  }
}

/**
 * The line segments of a grid as flat coordinate lists (`x, y, z` of the start, then of the end, per line), the
 * major lines apart from the minor ones. A line is major when its coordinate is a multiple of
 * `step * majorEvery`.
 */
export function gridLines(grid: GridSpec): { minor: number[]; major: number[] } {
  const minor: number[] = [];
  const major: number[] = [];
  const countX = Math.round((grid.maxX - grid.minX) / grid.step);
  const countY = Math.round((grid.maxY - grid.minY) / grid.step);
  const firstX = Math.round(grid.minX / grid.step);
  const firstY = Math.round(grid.minY / grid.step);
  for (let i = 0; i <= countX; i += 1) {
    const x = (firstX + i) * grid.step;
    ((firstX + i) % grid.majorEvery === 0 ? major : minor).push(x, grid.minY, 0, x, grid.maxY, 0);
  }
  for (let j = 0; j <= countY; j += 1) {
    const y = (firstY + j) * grid.step;
    ((firstY + j) % grid.majorEvery === 0 ? major : minor).push(grid.minX, y, 0, grid.maxX, y, 0);
  }
  return { minor, major };
}

/**
 * What the viewport draws for a model.
 *
 * - A node is drawn when its three coordinates are finite numbers; of two nodes with one id, the first.
 * - A member is drawn when both of its nodes are drawn; a support when its node is, and of two supports on one
 *   node, the first.
 * - `counts` are the lengths of the model's lists, so they also count an entry that is not drawn.
 * - `bounds` is the box around the drawn nodes (the origin for a model without one).
 * - `loads` are the loads of one load case, as `buildLoads` of ./loads.ts draws them: the load case with the
 *   id `loadCaseId` when the model holds it, else the model's first load case (`activeLoadCaseId`).
 *
 * The model is not validated here and is not changed.
 */
export function buildScene(model: Model, loadCaseId: string | null = null): SceneDescription {
  const nodes: DrawnNode[] = [];
  const positions = new Map<string, Point3>();
  for (const node of model.nodes) {
    if (positions.has(node.id) || ![node.x, node.y, node.z].every(Number.isFinite)) {
      continue;
    }
    const position: Point3 = [node.x, node.y, node.z];
    positions.set(node.id, position);
    nodes.push({ id: node.id, position });
  }

  const members: DrawnMember[] = [];
  for (const member of model.members) {
    const start = positions.get(member.startNodeId);
    const end = positions.get(member.endNodeId);
    if (start !== undefined && end !== undefined) {
      members.push({ id: member.id, kind: member.kind, start, end });
    }
  }

  const supports: DrawnSupport[] = [];
  const supported = new Set<string>();
  for (const support of model.supports) {
    const position = positions.get(support.nodeId);
    if (position !== undefined && !supported.has(support.nodeId)) {
      supported.add(support.nodeId);
      supports.push({ nodeId: support.nodeId, position, glyph: supportGlyph(support) });
    }
  }

  const bounds = boundsOf(nodes.map((node) => node.position));
  return {
    nodes,
    members,
    supports,
    loads: buildLoads(model, activeLoadCaseId(model, loadCaseId)),
    counts: {
      nodes: model.nodes.length,
      members: model.members.length,
      supports: model.supports.length,
    },
    bounds,
    grid: gridFor(bounds),
  };
}
