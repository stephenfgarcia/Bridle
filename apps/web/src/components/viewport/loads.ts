/**
 * From a `Model` to the loads the viewport draws (card PX-02.5). Pure functions with no three.js import
 * (./loads.test.ts); ./LoadGlyphs.tsx only renders this output, and ./scene.ts puts it into the scene
 * description.
 *
 * Conventions, as in `@bridle/model`: global axes with Z up, kN, m and kN·m. A drawn force has a unit
 * `direction`, the way the force acts, and a `magnitude` that is never negative: the sign of the stored value
 * is in the direction, so a nodal load of -10 kN in Z has the direction [0, 0, -1] and the magnitude 10. The
 * arrow is drawn with its head at `point`, so it stands on the side the force comes from.
 */
import {
  type LoadAxes,
  type LoadDirection,
  type Model,
  memberLocalAxes,
  type NodalLoad,
} from "@bridle/model";

type Point3 = readonly [number, number, number];

/** The unit of a load's value: a force, a moment, or a force per length. */
export type LoadUnit = "kN" | "kNm" | "kNPerM";

/** The pieces of a load's label: the magnitude as text (never signed) and its unit. */
export interface LoadLabel {
  value: string;
  unit: LoadUnit;
}

/** A force at one point: a nodal force or a member point load. */
export interface DrawnForce {
  kind: "force";
  /** `<load id>:<component>` for a nodal load (`nl1:fx`), the load's id for a member point load. */
  key: string;
  loadId: string;
  /** What carries the load. */
  on: { kind: "node" | "member"; id: string };
  /** Where the force acts; the arrow's head is here. */
  point: Point3;
  /** Unit vector, the way the force acts. */
  direction: Point3;
  /** kN, not negative. */
  magnitude: number;
  label: LoadLabel;
}

/** A moment on a node. */
export interface DrawnMoment {
  kind: "moment";
  /** `<load id>:<component>` (`nl1:my`). */
  key: string;
  loadId: string;
  on: { kind: "node"; id: string };
  point: Point3;
  /** Unit vector: the moment turns about it by the right-hand rule. */
  axis: Point3;
  /** kN·m, not negative. */
  magnitude: number;
  label: LoadLabel;
}

/** A uniform load over a whole member. */
export interface DrawnUniformLoad {
  kind: "uniform";
  key: string;
  loadId: string;
  on: { kind: "member"; id: string };
  /** The member's start and end. */
  start: Point3;
  end: Point3;
  /** Unit vector, the way the load acts. */
  direction: Point3;
  /** kN/m, not negative. */
  magnitude: number;
  /** Where the heads of the row of arrows are: evenly spaced points of the member, its two ends included. */
  arrows: Point3[];
  /** Whether the load acts along the member itself (an axial load): the arrows then lie on the member. */
  alongMember: boolean;
  label: LoadLabel;
}

export type DrawnLoad = DrawnForce | DrawnMoment | DrawnUniformLoad;

/** A uniform load is drawn with at least this many spaces between its arrows, and at most `..._MAX`. */
export const UNIFORM_ARROW_SPACES_MIN = 2;
export const UNIFORM_ARROW_SPACES_MAX = 16;
/** The arrows of a uniform load are about this fraction of the model's largest dimension apart. */
export const UNIFORM_ARROW_SPACING_RATIO = 1 / 12;
/** A load whose direction is within this of the member's axis (as a cosine) counts as along the member. */
const ALONG_MEMBER_COSINE = 0.999;

const GLOBAL_AXES: Record<LoadDirection, Point3> = {
  x: [1, 0, 0],
  y: [0, 1, 0],
  z: [0, 0, 1],
};

const FORCE_COMPONENTS = [
  ["fx", "x"],
  ["fy", "y"],
  ["fz", "z"],
] as const;

const MOMENT_COMPONENTS = [
  ["mx", "x"],
  ["my", "y"],
  ["mz", "z"],
] as const;

/** The magnitude of a load as text: at most three decimals, no trailing zeros, no sign. */
export function formatLoadValue(value: number): string {
  return String(Number(Math.abs(value).toFixed(3)));
}

function signed(axis: Point3, value: number): Point3 {
  // `+ 0` turns a negative zero into zero.
  return value < 0 ? [-axis[0] + 0, -axis[1] + 0, -axis[2] + 0] : axis;
}

function drawable(value: number): boolean {
  return Number.isFinite(value) && value !== 0;
}

/**
 * The load case whose loads are shown and that a new load goes into: `wanted` when the model holds a load case
 * with that id, else the model's first load case; `null` for a model without a load case.
 */
export function activeLoadCaseId(model: Model, wanted: string | null | undefined): string | null {
  if (wanted != null && model.loadCases.some((loadCase) => loadCase.id === wanted)) {
    return wanted;
  }
  return model.loadCases[0]?.id ?? null;
}

/** How many loads of the three lists name a load case. */
export function loadCount(model: Model, loadCaseId: string): number {
  const inCase = (load: { loadCaseId: string }) => load.loadCaseId === loadCaseId;
  return (
    model.nodalLoads.filter(inCase).length +
    model.memberUniformLoads.filter(inCase).length +
    model.memberPointLoads.filter(inCase).length
  );
}

/**
 * How many spaces the row of arrows of a uniform load has on a member of `length` m, in a model whose largest
 * dimension is `modelSize` m: the arrows are about `UNIFORM_ARROW_SPACING_RATIO` of the model's size apart,
 * with at least `UNIFORM_ARROW_SPACES_MIN` and at most `UNIFORM_ARROW_SPACES_MAX` spaces.
 */
export function uniformArrowSpaces(length: number, modelSize: number): number {
  const spacing = modelSize * UNIFORM_ARROW_SPACING_RATIO;
  const spaces = spacing > 0 ? Math.round(length / spacing) : UNIFORM_ARROW_SPACES_MIN;
  return Math.min(UNIFORM_ARROW_SPACES_MAX, Math.max(UNIFORM_ARROW_SPACES_MIN, spaces));
}

function nodalLoadItems(load: NodalLoad, point: Point3): DrawnLoad[] {
  const items: DrawnLoad[] = [];
  const on = { kind: "node", id: load.nodeId } as const;
  for (const [component, axis] of FORCE_COMPONENTS) {
    const value = load[component];
    if (drawable(value)) {
      items.push({
        kind: "force",
        key: `${load.id}:${component}`,
        loadId: load.id,
        on,
        point,
        direction: signed(GLOBAL_AXES[axis], value),
        magnitude: Math.abs(value),
        label: { value: formatLoadValue(value), unit: "kN" },
      });
    }
  }
  for (const [component, axis] of MOMENT_COMPONENTS) {
    const value = load[component];
    if (drawable(value)) {
      items.push({
        kind: "moment",
        key: `${load.id}:${component}`,
        loadId: load.id,
        on,
        point,
        axis: signed(GLOBAL_AXES[axis], value),
        magnitude: Math.abs(value),
        label: { value: formatLoadValue(value), unit: "kNm" },
      });
    }
  }
  return items;
}

/**
 * What the viewport draws for the loads of one load case.
 *
 * - A nodal load gives one item per component that is not zero: a force for `fx`, `fy`, `fz` along the global
 *   axis, a moment for `mx`, `my`, `mz` about it.
 * - A member point load gives a force at `position` m from the start node along the member.
 * - A member uniform load gives a row of arrow heads along the member (`uniformArrowSpaces`).
 * - A member load in `local` axes takes its direction from `memberLocalAxes` of `@bridle/model` (with the
 *   member's roll angle); one in `global` axes from the global axis.
 * - Not drawn: a load of another load case; a value that is zero or not finite; a load whose node, member or
 *   member's node is missing or has a coordinate that is not finite; a load on a member without length; a
 *   point load whose position is not finite. A point load beyond its member's ends is drawn at the end.
 *
 * `loadCaseId` is the load case to draw; `null` draws nothing. The model is not changed.
 */
export function buildLoads(model: Model, loadCaseId: string | null): DrawnLoad[] {
  if (loadCaseId === null) {
    return [];
  }
  const positions = new Map<string, Point3>();
  for (const node of model.nodes) {
    if (!positions.has(node.id) && [node.x, node.y, node.z].every(Number.isFinite)) {
      positions.set(node.id, [node.x, node.y, node.z]);
    }
  }
  let size = 0;
  for (const axis of [0, 1, 2] as const) {
    const values = [...positions.values()].map((position) => position[axis]);
    if (values.length > 0) {
      size = Math.max(size, Math.max(...values) - Math.min(...values));
    }
  }

  const memberFrame = (memberId: string, axes: LoadAxes, direction: LoadDirection) => {
    const member = model.members.find((candidate) => candidate.id === memberId);
    const start = member && positions.get(member.startNodeId);
    const end = member && positions.get(member.endNodeId);
    if (!member || !start || !end) {
      return undefined;
    }
    const a = { x: start[0], y: start[1], z: start[2] };
    const b = { x: end[0], y: end[1], z: end[2] };
    const local = memberLocalAxes(
      a,
      b,
      Number.isFinite(member.rollAngleDeg) ? member.rollAngleDeg : 0,
    );
    if (local === undefined) {
      return undefined;
    }
    const along: Point3 = [local.x.x, local.x.y, local.x.z];
    const picked = local[direction];
    const axis: Point3 = axes === "local" ? [picked.x, picked.y, picked.z] : GLOBAL_AXES[direction];
    const length = Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
    const at = (distance: number): Point3 => [
      start[0] + along[0] * distance,
      start[1] + along[1] * distance,
      start[2] + along[2] * distance,
    ];
    const cosine = Math.abs(axis[0] * along[0] + axis[1] * along[1] + axis[2] * along[2]);
    return { start, end, axis, length, at, alongMember: cosine >= ALONG_MEMBER_COSINE };
  };

  const loads: DrawnLoad[] = [];
  for (const load of model.nodalLoads) {
    const point = positions.get(load.nodeId);
    if (load.loadCaseId === loadCaseId && point !== undefined) {
      loads.push(...nodalLoadItems(load, point));
    }
  }
  for (const load of model.memberUniformLoads) {
    if (load.loadCaseId !== loadCaseId || !drawable(load.value)) {
      continue;
    }
    const frame = memberFrame(load.memberId, load.axes, load.direction);
    if (frame === undefined) {
      continue;
    }
    const spaces = uniformArrowSpaces(frame.length, size);
    const arrows: Point3[] = [];
    for (let index = 0; index <= spaces; index += 1) {
      arrows.push(
        index === 0
          ? frame.start
          : index === spaces
            ? frame.end
            : frame.at((frame.length * index) / spaces),
      );
    }
    loads.push({
      kind: "uniform",
      key: load.id,
      loadId: load.id,
      on: { kind: "member", id: load.memberId },
      start: frame.start,
      end: frame.end,
      direction: signed(frame.axis, load.value),
      magnitude: Math.abs(load.value),
      arrows,
      alongMember: frame.alongMember,
      label: { value: formatLoadValue(load.value), unit: "kNPerM" },
    });
  }
  for (const load of model.memberPointLoads) {
    if (
      load.loadCaseId !== loadCaseId ||
      !drawable(load.value) ||
      !Number.isFinite(load.position)
    ) {
      continue;
    }
    const frame = memberFrame(load.memberId, load.axes, load.direction);
    if (frame === undefined) {
      continue;
    }
    loads.push({
      kind: "force",
      key: load.id,
      loadId: load.id,
      on: { kind: "member", id: load.memberId },
      point: frame.at(Math.min(frame.length, Math.max(0, load.position))),
      direction: signed(frame.axis, load.value),
      magnitude: Math.abs(load.value),
      label: { value: formatLoadValue(load.value), unit: "kN" },
    });
  }
  return loads;
}
