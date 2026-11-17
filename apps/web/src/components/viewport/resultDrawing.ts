/**
 * From a solved model to what the viewport draws for its results (card PX-02.9): the scale of the deflected
 * shape, its line segments, the largest displacement and its label, and the arrows and arcs of the reactions.
 * Pure functions with no React and no three.js import (./resultDrawing.test.ts); ./ResultGlyphs.tsx only
 * renders this output and ./useResultDrawing.ts calls it from the stores.
 *
 * Conventions, as in `@bridle/solver`: global axes with Z up; displacements in m and rad; reactions in kN and
 * kN·m, what the support applies to the structure, positive along and about the positive global axes. The
 * caller passes the model the result was computed for (`shownResults` of ../analysis/analysisState.ts), so
 * every point here is a point of that model.
 */
import type { Model } from "@bridle/model";
import {
  deflectedShape,
  type LoadCaseResult,
  memberValues,
  type SolveResult,
} from "@bridle/solver";
import { formatNumber, largestOf } from "../analysis/format";
import { FORCE_COMPONENTS, MOMENT_COMPONENTS } from "../analysis/results";
import { type Point3, type SupportGlyph, supportGlyph } from "./scene";

/** The points per member of the deflected shape, ends included (the solver's default). */
export const DEFLECTION_STATIONS = 21;

/**
 * The automatic scale aims at drawing the largest displacement this fraction of the model's largest dimension
 * long.
 */
export const AUTO_SCALE_FRACTION = 0.1;

/**
 * The automatic scale is kept while the scale it would aim at is within this factor of it, above or below
 * (`nextAutoScale`).
 */
export const AUTO_SCALE_KEEP = 2;

/** The smallest and the largest scale: a scale typed by hand is brought into this range. */
export const SCALE_MIN = 1e-4;
export const SCALE_MAX = 1e9;

/**
 * The tidy number nearest to `value`: 1, 2 or 5 times a power of ten, the one whose ratio to `value` is
 * nearest to 1 (so 1.4 gives 1 and 1.5 gives 2; 3 gives 2 and 3.2 gives 5; 7 gives 5 and 7.1 gives 10). The
 * result is within `SCALE_MIN` and `SCALE_MAX`; a value that is not a positive finite number gives 1.
 */
export function tidyScale(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }
  const bounded = Math.min(Math.max(value, SCALE_MIN), SCALE_MAX);
  const exponent = Math.floor(Math.log10(bounded));
  const mantissa = bounded / 10 ** exponent;
  let best = 1;
  let bestDistance = Infinity;
  for (const candidate of [1, 2, 5, 10]) {
    const distance = Math.abs(Math.log(mantissa / candidate));
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  // Written through text, so that 2 times 10 to the -3 is the number 0.002 and not 0.0020000000000000005.
  const tidy = Number(`${best}e${exponent}`);
  return Math.min(Math.max(tidy, SCALE_MIN), SCALE_MAX);
}

/** The largest dimension of the box around the model's nodes, in m; 0 without a node. */
export function modelSize(model: Model): number {
  let size = 0;
  for (const axis of ["x", "y", "z"] as const) {
    let min = Infinity;
    let max = -Infinity;
    for (const node of model.nodes) {
      const value = node[axis];
      if (Number.isFinite(value)) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    }
    if (max > min) {
      size = Math.max(size, max - min);
    }
  }
  return size;
}

/**
 * The scale that draws a displacement of `largest` metres `AUTO_SCALE_FRACTION` of `size` long; `null` when
 * there is nothing to scale by (no displacement, or a model without extent).
 */
export function idealScale(size: number, largest: number): number | null {
  if (!(size > 0) || !(largest > 0) || !Number.isFinite(size) || !Number.isFinite(largest)) {
    return null;
  }
  return (AUTO_SCALE_FRACTION * size) / largest;
}

/** The automatic scale in use, and what it was chosen for. */
export interface HeldScale {
  /** What the scale belongs to (the model that was opened and the load case): another key starts afresh. */
  key: string;
  scale: number;
}

/**
 * The automatic scale after a change of the results. The rule that keeps it from jumping while a load is
 * edited:
 * - with no scale held, or one held for another `key`, the scale is `tidyScale(ideal)`;
 * - a held scale is kept while `ideal` is within a factor of `AUTO_SCALE_KEEP` of it (from half of it to
 *   twice it, both included); outside that range it becomes `tidyScale(ideal)`;
 * - while `ideal` is `null` (nothing moves) a held scale of the same key is kept; without one the scale is 1.
 * A tidy scale is within a factor of 1.59 of the ideal one it was made from, so the scale just chosen is kept
 * for every change of the displacements by a factor below 1.26.
 */
export function nextAutoScale(
  held: HeldScale | null,
  key: string,
  ideal: number | null,
): HeldScale {
  const current = held !== null && held.key === key ? held : null;
  if (ideal === null) {
    return current ?? { key, scale: 1 };
  }
  if (
    current !== null &&
    ideal >= current.scale / AUTO_SCALE_KEEP &&
    ideal <= current.scale * AUTO_SCALE_KEEP
  ) {
    return current;
  }
  return { key, scale: tidyScale(ideal) };
}

/**
 * A scale typed by hand: the number, brought into `SCALE_MIN` to `SCALE_MAX`; `null` for what is not a
 * positive finite number (the scale then stays as it was).
 */
export function manualScale(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.min(Math.max(value, SCALE_MIN), SCALE_MAX);
}

/** A scale as text, with at most four significant digits: "200", "0.05", "1.5", "20000000". */
export function formatScale(scale: number): string {
  return String(Number(scale.toPrecision(4)));
}

function loadCaseOf(result: SolveResult, loadCaseId: string): LoadCaseResult | undefined {
  if (!result.ok || !Object.hasOwn(result.loadCases, loadCaseId)) {
    return undefined;
  }
  return result.loadCases[loadCaseId];
}

/** The deflected shape as line segments. */
export interface DeflectedLines {
  /** The members drawn, in the model's order. */
  memberIds: string[];
  /** The points per member (`DEFLECTION_STATIONS`). */
  stations: number;
  /**
   * The segments as flat coordinates: `x, y, z` of a segment's start, then of its end. A member has
   * `stations - 1` segments, each from one point of the solver's shape to the next, so its segments start at
   * index `6 * (stations - 1) * m` for member number `m`.
   */
  positions: number[];
}

/**
 * The deflected structure of one load case, the displacements drawn `scale` times larger: the points of
 * `deflectedShape` of `@bridle/solver` (21 per member, the member's own loads included) joined into segments.
 * `null` when the solver gives no shape (no such load case in the result, or a member it cannot compute).
 */
export function deflectedLines(
  model: Model,
  result: SolveResult,
  loadCaseId: string,
  scale: number,
): DeflectedLines | null {
  const shape = deflectedShape(model, result, loadCaseId, scale, DEFLECTION_STATIONS);
  if (shape === undefined) {
    return null;
  }
  const { points, stations, memberIds } = shape;
  const positions: number[] = [];
  for (let member = 0; member < memberIds.length; member += 1) {
    for (let station = 0; station + 1 < stations; station += 1) {
      const from = 3 * (member * stations + station);
      for (let index = from; index < from + 6; index += 1) {
        positions.push(points[index] ?? 0);
      }
    }
  }
  return { memberIds: [...memberIds], stations, positions };
}

/** Where the largest displacement is. */
export type DisplacementPlace =
  | { kind: "node"; nodeId: string }
  | {
      kind: "member";
      memberId: string;
      /** The node the distance is measured from: the member's start node. */
      startNodeId: string;
      /** The distance from the start node along the member, m. */
      distance: number;
    };

/** The largest displacement of the structure in one load case. */
export interface LargestDisplacement {
  /** The length of the displacement vector there, m. */
  value: number;
  place: DisplacementPlace;
  /** The point of the undeformed structure. */
  point: Point3;
  /** Its displacement along global X, Y, Z, m. */
  displacement: Point3;
}

function length3(x: number, y: number, z: number): number {
  return Math.hypot(x, y, z);
}

/**
 * The largest displacement of the structure in one load case: the point whose displacement vector (the three
 * translations) is longest. Looked at: every node; on every member, the `DEFLECTION_STATIONS` stations of
 * `memberValues` of `@bridle/solver` and the positions where one of the three global components of the
 * deflection is largest or smallest along the member (its `extremes`). Each value is the displacement of a
 * point of the structure, so the value reported is not above the true largest one; it can be below it by what
 * the vector's length gains between those positions. Of equal values the first counts: the nodes in the
 * model's order, then the members in the model's order.
 *
 * `null` when the result has no such load case, or when nothing moves.
 */
export function largestDisplacement(
  model: Model,
  result: SolveResult,
  loadCaseId: string,
): LargestDisplacement | null {
  const loadCase = loadCaseOf(result, loadCaseId);
  if (!result.ok || loadCase === undefined) {
    return null;
  }
  const positions = new Map<string, Point3>();
  for (const node of model.nodes) {
    if (!positions.has(node.id)) {
      positions.set(node.id, [node.x, node.y, node.z]);
    }
  }
  // In an object, so that the type checker follows the assignments made inside `offer`.
  const found: { best: LargestDisplacement | null } = { best: null };
  const offer = (
    place: DisplacementPlace,
    point: Point3,
    dx: number,
    dy: number,
    dz: number,
  ): void => {
    const value = length3(dx, dy, dz);
    if (Number.isFinite(value) && value > (found.best?.value ?? 0)) {
      found.best = { value, place, point, displacement: [dx, dy, dz] };
    }
  };

  result.nodeIds.forEach((nodeId, index) => {
    const point = positions.get(nodeId);
    if (point !== undefined) {
      const u = loadCase.displacementVector;
      offer(
        { kind: "node", nodeId },
        point,
        u[6 * index] ?? 0,
        u[6 * index + 1] ?? 0,
        u[6 * index + 2] ?? 0,
      );
    }
  });

  for (const member of model.members) {
    const start = positions.get(member.startNodeId);
    const end = positions.get(member.endNodeId);
    const values = memberValues(model, result, loadCaseId, member.id, DEFLECTION_STATIONS);
    if (start === undefined || end === undefined || values === undefined || !(values.length > 0)) {
      continue;
    }
    const { length } = values;
    const inside = (x: number) => x > 0 && x < length;
    const offerStations = (x: Float64Array, deflection: Float64Array, only?: Set<number>) => {
      for (let station = 0; station < x.length; station += 1) {
        const distance = x[station] ?? 0;
        // The two ends are the nodes, which were looked at above.
        if (!inside(distance) || (only !== undefined && !only.has(distance))) {
          continue;
        }
        const t = distance / length;
        offer(
          { kind: "member", memberId: member.id, startNodeId: member.startNodeId, distance },
          [
            start[0] + t * (end[0] - start[0]),
            start[1] + t * (end[1] - start[1]),
            start[2] + t * (end[2] - start[2]),
          ],
          deflection[3 * station] ?? 0,
          deflection[3 * station + 1] ?? 0,
          deflection[3 * station + 2] ?? 0,
        );
      }
    };
    offerStations(values.x, values.deflectionGlobal);
    // The positions between stations where a global component is extreme.
    const stations = new Set(values.x);
    const between = new Set<number>();
    for (const quantity of ["dGlobalX", "dGlobalY", "dGlobalZ"] as const) {
      const extreme = values.extremes[quantity];
      for (const x of [extreme.minX, extreme.maxX]) {
        if (inside(x) && !stations.has(x)) {
          between.add(x);
        }
      }
    }
    if (between.size > 0) {
      const more = memberValues(model, result, loadCaseId, member.id, 2, [...between]);
      if (more !== undefined) {
        offerStations(more.x, more.deflectionGlobal, between);
      }
    }
  }
  return found.best;
}

/** Where the label of the largest displacement goes: the point on the deflected curve drawn at `scale`. */
export function displacedPoint(largest: LargestDisplacement, scale: number): Point3 {
  return [
    largest.point[0] + scale * largest.displacement[0],
    largest.point[1] + scale * largest.displacement[1],
    largest.point[2] + scale * largest.displacement[2],
  ];
}

/** A displacement in m as text in mm, with the four significant digits of the Results section. */
export function formatMm(metres: number): string {
  return formatNumber(metres * 1000);
}

/** The pieces of a reaction's label: the magnitude as text (never signed) and its unit. */
export interface ReactionLabel {
  value: string;
  unit: "kN" | "kNm";
}

/**
 * How far below its node a support symbol reaches on screen, in CSS pixels, by the symbol's kind: the sizes of
 * the glyphs of ./ModelScene.tsx (34 px per unit: the block of a fixed support is 0.4 of it high, a pinned
 * support 0.86, a roller 0.9, the wire of a generic one 0.55 and the small mark of `plane` 0.23), rounded up.
 */
export const SUPPORT_DEPTH_PX: Record<SupportGlyph, number> = {
  fixed: 14,
  pinned: 30,
  roller: 31,
  generic: 19,
  plane: 8,
};

/** The gap, in CSS pixels, between a support symbol or a node marker and the arrow of a reaction beside it. */
export const REACTION_GAP_PX = 5;
/** The node marker is 10 px across (./ModelScene.tsx): a horizontal arrow stops this far from the node. */
const NODE_CLEARANCE_PX = 5 + REACTION_GAP_PX;

/** One component of a reaction force, drawn as a straight arrow. */
export interface ReactionForceGlyph {
  kind: "force";
  /** `<node id>:<component>` (`n1:fz`). */
  key: string;
  nodeId: string;
  component: "fx" | "fy" | "fz";
  /** The supported node. */
  point: Point3;
  /** Unit vector: the way the support pushes the structure. The arrow points along it. */
  direction: Point3;
  /**
   * Unit vector from the node to the side the arrow stands on. A vertical component (`fz`) stands below the
   * support whatever its sign, where engineers draw it: [0, 0, -1]. A horizontal component stands on the
   * side it comes from, minus `direction`, as the arrows of the loads do.
   */
  side: Point3;
  /**
   * Which end of the arrow is the one next to the node: its `head` when the arrow points at the node (an
   * upward reaction drawn below the support, and every horizontal component), its `tail` when it points away
   * from it (a support that pulls the structure down).
   */
  nearEnd: "head" | "tail";
  /** The gap between the node and that end, in CSS pixels: the support symbol, or the node marker, and a gap. */
  clearancePx: number;
  /** kN, not negative. */
  magnitude: number;
  label: ReactionLabel;
}

/** One component of a reaction moment, drawn as an arc with an arrow head. */
export interface ReactionMomentGlyph {
  kind: "moment";
  /** `<node id>:<component>` (`n1:my`). */
  key: string;
  nodeId: string;
  component: "mx" | "my" | "mz";
  point: Point3;
  /** Unit vector: the support turns the structure about it by the right-hand rule. */
  axis: Point3;
  /** kN·m, not negative. */
  magnitude: number;
  label: ReactionLabel;
}

export type ReactionGlyph = ReactionForceGlyph | ReactionMomentGlyph;

const AXIS_OF = { fx: 0, fy: 1, fz: 2, mx: 0, my: 1, mz: 2 } as const;

function unit(axis: 0 | 1 | 2, sign: number): [number, number, number] {
  const vector: [number, number, number] = [0, 0, 0];
  vector[axis] = sign;
  return vector;
}

/**
 * What is drawn for the reactions of a load case: per support, in the order of `nodeIds` (the node ids of the
 * solved model), one arrow per force component and one arc per moment component, the forces first, in the
 * order x, y, z.
 *
 * A component is left out when the Results section prints it as "0" (`formatNumber` of ../analysis/format.ts:
 * exactly 0, or at most 1e-9 of the largest reaction force of the load case, for a moment of its largest
 * reaction moment). The sign is in the direction: the label holds the magnitude, with the four significant
 * digits of the Results section. A support whose node the model does not hold is left out.
 */
export function reactionGlyphs(
  model: Model,
  loadCase: LoadCaseResult,
  nodeIds: readonly string[],
): ReactionGlyph[] {
  const reactions = Object.values(loadCase.reactions);
  const largestForce = largestOf(
    reactions.flatMap((reaction) => FORCE_COMPONENTS.map((component) => reaction[component])),
  );
  const largestMoment = largestOf(
    reactions.flatMap((reaction) => MOMENT_COMPONENTS.map((component) => reaction[component])),
  );
  const glyphs: ReactionGlyph[] = [];
  for (const nodeId of nodeIds) {
    const reaction = Object.hasOwn(loadCase.reactions, nodeId)
      ? loadCase.reactions[nodeId]
      : undefined;
    const node = model.nodes.find((candidate) => candidate.id === nodeId);
    if (reaction === undefined || node === undefined) {
      continue;
    }
    const point: Point3 = [node.x, node.y, node.z];
    const support = model.supports.find((candidate) => candidate.nodeId === nodeId);
    const depth = support === undefined ? 0 : SUPPORT_DEPTH_PX[supportGlyph(support)];
    for (const component of FORCE_COMPONENTS) {
      const value = reaction[component];
      const text = formatNumber(Math.abs(value), largestForce);
      if (text === "0" || !Number.isFinite(value)) {
        continue;
      }
      const direction = unit(AXIS_OF[component], Math.sign(value));
      const vertical = component === "fz";
      glyphs.push({
        kind: "force",
        key: `${nodeId}:${component}`,
        nodeId,
        component,
        point,
        direction,
        side: vertical ? [0, 0, -1] : unit(AXIS_OF[component], -Math.sign(value)),
        nearEnd: vertical && value < 0 ? "tail" : "head",
        clearancePx: vertical ? depth + REACTION_GAP_PX : NODE_CLEARANCE_PX,
        magnitude: Math.abs(value),
        label: { value: text, unit: "kN" },
      });
    }
    for (const component of MOMENT_COMPONENTS) {
      const value = reaction[component];
      const text = formatNumber(Math.abs(value), largestMoment);
      if (text === "0" || !Number.isFinite(value)) {
        continue;
      }
      glyphs.push({
        kind: "moment",
        key: `${nodeId}:${component}`,
        nodeId,
        component,
        point,
        axis: unit(AXIS_OF[component], Math.sign(value)),
        magnitude: Math.abs(value),
        label: { value: text, unit: "kNm" },
      });
    }
  }
  return glyphs;
}
