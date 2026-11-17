/**
 * Illustrative member checks (pitch card S8): the elastic normal stress of a member against its
 * yield strength, the deflection of a member (or of a span of several members) against span/n, and
 * the drift of a vertical member against height/n. Everything is computed from `memberValues` and
 * the node displacements of `solve`, and is in the model's units: kN/m² for a stress, m for a
 * deflection, a length and a position. Nothing is converted to MPa or mm.
 *
 * These are NOT the checks of a design code. No design code is the basis of a limit: the allowable
 * factor and the two divisors n are parameters of the caller. `NOT_CHECKED` lists what is left out;
 * every result carries `kind: "illustrative"`.
 *
 * THE STRESS
 *
 * The normal stress at the point (y, z) of a cross-section (local axes, measured from the member's
 * axis), positive in tension:
 *
 *   σ = N/A − My·z/Iy − Mz·y/Iz
 *
 * The signs follow from the convention of ./memberValues.ts: N is positive in tension; a positive
 * My puts the −z side in tension, and −My·z/Iy is positive for a negative z; a positive Mz puts the
 * −y side in tension, and −Mz·y/Iz is positive for a negative y. (./memberValues.ts derives
 * My = −∫ z σ dA and Mz = −∫ y σ dA; with σ linear over a section whose centroid is on the axis and
 * whose local axes are principal axes, that gives the formula.)
 *
 * It is evaluated at the four corners of the section's bounding rectangle, y = ±depthY/2 and
 * z = ±depthZ/2. σ is linear in y and z, so over that rectangle its largest and smallest values are
 * at corners. For a section that reaches its corners (a rectangle, the flange tips of an I-shape)
 * these are stresses of the section. For one that does not (a round tube) no point of the section
 * has them: when both moments act at a position, the largest corner value there is above every
 * stress of the section and the smallest below.
 *
 * Along the member the stress of one corner is, between two consecutive stations of `memberValues`,
 * a polynomial of degree two in x (N is linear and the moments are of degree two, because the loads
 * are uniform or at points, and every point load has stations). Its derivative is
 *
 *   dσ/dx = (dN/dx)/A − Vz·z/Iy − Vy·y/Iz        (dMy/dx = Vz, dMz/dx = Vy)
 *
 * which is linear. Where it has opposite signs at the two stations, the point where it is zero and
 * the stress there are computed in closed form and taken with the station values. So the largest and
 * the smallest stress are those of the whole length of the member, up to rounding, whatever the
 * number of stations.
 *
 * THE DEFLECTION OF A MEMBER, measured from its chord
 *
 * With d(x) the deflection of the member's axis at x in local axes (`memberValues`), the relative
 * deflection is r(x) = d(x) − [d(0) + (x/L)·(d(L) − d(0))]: what remains when the straight line
 * between the two displaced ends is taken away. The value reported is the largest, over the
 * stations, of √(r_y² + r_z²), the part perpendicular to the member's undeformed axis. It is zero at
 * both ends by construction. It is taken at stations only, so it is never above the true largest
 * value; it is below it by at most h²·κ/8, with h the largest distance between two consecutive
 * stations and κ the largest curvature along the member, √((My/(E·Iy))² + (Mz/(E·Iz))²).
 *
 * THE DRIFT OF A VERTICAL MEMBER
 *
 * The horizontal distance between the displacements of its two nodes, √(ΔuX² + ΔuY²), against its
 * length divided by n. A member is vertical by the rule of `memberLocalAxes` of `@bridle/model`: the
 * horizontal projection of its length is at most `VERTICAL_TOLERANCE` times its length.
 */
import { distance, type Member, type Model, VERTICAL_TOLERANCE, type Vec3 } from "@bridle/model";
import { DEFAULT_STATIONS, MAX_STATIONS, type MemberValues, memberValues } from "./memberValues";
import type { SolveResult } from "./solve";

/**
 * What these checks leave out, as stable codes (not text to show: the interface translates them).
 * In words, in this order: buckling of members; buckling of plates (local buckling); lateral-
 * torsional buckling; shear stress; torsion stress; the interaction formulas of a design code; load
 * and resistance factors, other than the one allowable factor; connections; fatigue; serviceability
 * criteria other than the two limits (deflection and drift).
 */
export const NOT_CHECKED = [
  "member-buckling",
  "plate-buckling",
  "lateral-torsional-buckling",
  "shear-stress",
  "torsion-stress",
  "design-code-interaction",
  "load-and-resistance-factors",
  "connections",
  "fatigue",
  "other-serviceability",
] as const;

export type NotChecked = (typeof NOT_CHECKED)[number];

/** The allowable stress is `fy` times this factor when the caller gives none. */
export const DEFAULT_ALLOWABLE_FACTOR = 1;
/** The deflection limit is the span divided by this when the caller gives none. */
export const DEFAULT_DEFLECTION_DIVISOR = 360;
/** The drift limit is the height divided by this when the caller gives none. */
export const DEFAULT_DRIFT_DIVISOR = 300;
/** The smallest number of equally spaced stations the checks ask `memberValues` for. */
export const MIN_CHECK_STATIONS = 5;
/**
 * `spanDeflection`: each node of the span may be this times the span's length away from the straight
 * line between the span's two end nodes.
 */
export const COLLINEAR_TOLERANCE = 1e-9;

/**
 * The parameters of the checks. A value that is not a finite number greater than zero is replaced
 * by its default; the values used are in the result.
 */
export interface MemberCheckOptions {
  /** The allowable stress is the material's `fy` times this. Default 1. */
  allowableFactor?: number;
  /** n of the deflection limit span/n. Default 360. */
  deflectionDivisor?: number;
  /** n of the drift limit height/n. Default 300. */
  driftDivisor?: number;
  /**
   * The number of equally spaced stations per member. Default 21; a fraction is rounded down; a
   * number below 5 is taken as 5 and one above `MAX_STATIONS` (1001) as 1001.
   */
  stations?: number;
}

/** A normal stress at one corner of the section's bounding rectangle, at one position. */
export interface StressAtCorner {
  /** The stress, kN/m², positive in tension. */
  value: number;
  /** The distance from the start node, m. */
  x: number;
  /** The corner's local y, m: +depthY/2 or −depthY/2. */
  y: number;
  /** The corner's local z, m: +depthZ/2 or −depthZ/2. */
  z: number;
}

/** The stress check of one member. Stresses in kN/m² (1 MPa = 1000 kN/m²). */
export interface StressCheck {
  /**
   * The largest value of σ along the member and over the four corners (the largest tension). It is
   * negative when no corner is in tension anywhere.
   */
  tension: StressAtCorner;
  /**
   * The smallest value of σ along the member and over the four corners (the largest compression,
   * as a negative number). It is positive when no corner is in compression anywhere.
   */
  compression: StressAtCorner;
  /** The larger of |tension.value| and |compression.value|, kN/m². */
  largest: number;
  /** The material's `fy`, kN/m². */
  fy: number;
  /** `fy` times the allowable factor, kN/m². */
  allowable: number;
  /** `largest` / `allowable`. */
  ratio: number;
  /** Whether `ratio` is at most 1 (no tolerance). */
  passes: boolean;
}

/** The deflection check of one member that is not vertical. Lengths in m (1 m = 1000 mm). */
export interface DeflectionCheck {
  /** The largest deflection from the chord, perpendicular to the member, over the stations, m. */
  value: number;
  /** The distance from the start node of the station that has it, m (the first such station). */
  x: number;
  /** The local y component of the relative deflection at that station, m. */
  localY: number;
  /** The local z component of the relative deflection at that station, m. */
  localZ: number;
  /** The span: the member's length, m. */
  span: number;
  /** The divisor n. */
  divisor: number;
  /** `span` / `divisor`, m. */
  limit: number;
  /** `value` / `limit`. */
  ratio: number;
  /** Whether `ratio` is at most 1 (no tolerance). */
  passes: boolean;
}

/** The drift check of one vertical member. Lengths in m. */
export interface DriftCheck {
  /** The horizontal distance between the displacements of the two nodes, m: √(dX² + dY²). */
  value: number;
  /** The end node's displacement along global X minus the start node's, m. */
  dX: number;
  /** The end node's displacement along global Y minus the start node's, m. */
  dY: number;
  /** The height: the member's length, m. */
  height: number;
  /** The divisor n. */
  divisor: number;
  /** `height` / `divisor`, m. */
  limit: number;
  /** `value` / `limit`. */
  ratio: number;
  /** Whether `ratio` is at most 1 (no tolerance). */
  passes: boolean;
}

/** The checks of one member. Exactly one of `deflection` and `drift` is not `null`. */
export interface MemberCheck {
  memberId: string;
  /** The member's length, m. */
  length: number;
  /** Whether the member is vertical by the rule of `memberLocalAxes`. */
  vertical: boolean;
  stress: StressCheck;
  /** `null` for a vertical member. */
  deflection: DeflectionCheck | null;
  /** `null` for a member that is not vertical. */
  drift: DriftCheck | null;
}

/**
 * Why a member has no checks: it is of kind `truss`; it is a frame member with an end release; or
 * `memberValues` has no values for it for another reason (its nodes, section or material are not in
 * the model, or its nodes or end forces are not in the result).
 */
export type SkippedReason = "truss" | "release" | "no-values";

/** The checks of the members of a model for one load case. Plain data. */
export interface MemberChecks {
  /** These are illustrative checks, not those of a design code. */
  kind: "illustrative";
  loadCaseId: string;
  /** What is not checked: a copy of `NOT_CHECKED`. */
  notChecked: NotChecked[];
  /** The allowable factor used. */
  allowableFactor: number;
  /** The n used for span/n. */
  deflectionDivisor: number;
  /** The n used for height/n. */
  driftDivisor: number;
  /** The number of equally spaced stations asked of `memberValues`. */
  stations: number;
  /** One entry per member that was checked, in the model's order. */
  members: MemberCheck[];
  /** The members that were not checked, in the model's order. */
  skipped: { memberId: string; reason: SkippedReason }[];
}

/** The member with the largest ratio of one kind. */
export interface GoverningRatio {
  memberId: string;
  ratio: number;
  /** Whether `ratio` is at most 1 (no tolerance). */
  passes: boolean;
}

/** The governing member of each of the three ratios. Plain data. */
export interface StructureChecks {
  kind: "illustrative";
  loadCaseId: string;
  /** What is not checked: a copy of `NOT_CHECKED`. */
  notChecked: NotChecked[];
  /** The largest stress ratio; `null` when no member was checked. */
  stress: GoverningRatio | null;
  /** The largest deflection ratio of a single member; `null` when no checked member has one. */
  deflection: GoverningRatio | null;
  /** The largest drift ratio; `null` when no checked member is vertical. */
  drift: GoverningRatio | null;
}

function positive(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function checkStations(stations: number | undefined): number {
  return typeof stations === "number" && Number.isFinite(stations)
    ? Math.min(MAX_STATIONS, Math.max(MIN_CHECK_STATIONS, Math.floor(stations)))
    : DEFAULT_STATIONS;
}

function hasRelease(member: Member): boolean {
  const { start, end } = member.releases;
  return start.rx || start.ry || start.rz || end.rx || end.ry || end.rz;
}

const of = (array: Float64Array, i: number): number => array[i] as number;

/** The corners in the order they are tried; of equal stresses the earlier corner is reported. */
const CORNER_SIGNS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

/** The stress extremes of a member (the header's "THE STRESS"). */
function stressExtremes(
  v: MemberValues,
  A: number,
  Iy: number,
  Iz: number,
  halfY: number,
  halfZ: number,
): { tension: StressAtCorner; compression: StressAtCorner } {
  const tension: StressAtCorner = { value: Number.NEGATIVE_INFINITY, x: 0, y: 0, z: 0 };
  const compression: StressAtCorner = { value: Number.POSITIVE_INFINITY, x: 0, y: 0, z: 0 };
  const take = (value: number, x: number, y: number, z: number): void => {
    if (value > tension.value) {
      tension.value = value;
      tension.x = x;
      tension.y = y;
      tension.z = z;
    }
    if (value < compression.value) {
      compression.value = value;
      compression.x = x;
      compression.y = y;
      compression.z = z;
    }
  };
  for (let i = 0; i < v.count; i++) {
    const x = of(v.x, i);
    const next = i + 1 < v.count ? of(v.x, i + 1) : x;
    const h = next - x;
    // N is linear between two stations at different positions.
    const slopeN = h > 0 ? (of(v.N, i + 1) - of(v.N, i)) / h : 0;
    for (const [signY, signZ] of CORNER_SIGNS) {
      const y = signY * halfY;
      const z = signZ * halfZ;
      const sigma = of(v.N, i) / A - (of(v.My, i) * z) / Iy - (of(v.Mz, i) * y) / Iz + 0;
      take(sigma, x, y, z);
      if (!(h > 0)) {
        continue;
      }
      // dσ/dx at the two stations; it is linear between them.
      const here = slopeN / A - (of(v.Vz, i) * z) / Iy - (of(v.Vy, i) * y) / Iz;
      const there = slopeN / A - (of(v.Vz, i + 1) * z) / Iy - (of(v.Vy, i + 1) * y) / Iz;
      if (here * there < 0) {
        const step = (h * here) / (here - there);
        take(sigma + (here * step) / 2 + 0, x + step, y, z);
      }
    }
  }
  return { tension, compression };
}

/** The deflection of a member from its chord (the header's "THE DEFLECTION OF A MEMBER"). */
function chordDeflection(
  v: MemberValues,
): Pick<DeflectionCheck, "value" | "x" | "localY" | "localZ"> {
  const lastIndex = v.count - 1;
  const y0 = of(v.deflectionLocal, 1);
  const z0 = of(v.deflectionLocal, 2);
  const y1 = of(v.deflectionLocal, 3 * lastIndex + 1);
  const z1 = of(v.deflectionLocal, 3 * lastIndex + 2);
  const found = { value: 0, x: 0, localY: 0, localZ: 0 };
  // The first and the last station are the ends, where the relative deflection is zero.
  for (let i = 1; i < lastIndex; i++) {
    const x = of(v.x, i);
    const t = x / v.length;
    const ry = of(v.deflectionLocal, 3 * i + 1) - (y0 + t * (y1 - y0));
    const rz = of(v.deflectionLocal, 3 * i + 2) - (z0 + t * (z1 - z0));
    const value = Math.hypot(ry, rz);
    if (value > found.value) {
      found.value = value;
      found.x = x;
      found.localY = ry + 0;
      found.localZ = rz + 0;
    }
  }
  return found;
}

/**
 * The illustrative checks of every member of a model for one load case (this file's header has the
 * formulas and their limits).
 *
 * For each frame member without end releases that `memberValues` has values for:
 * - `stress`: the largest and the smallest normal stress σ = N/A − My·z/Iy − Mz·y/Iz (tension
 *   positive) along the member and over the four corners of the section's bounding rectangle, each
 *   with its position and corner (of equal values: the first position along the member, then the
 *   first corner in the order (−y, −z), (+y, −z), (−y, +z), (+y, +z)); the larger of their sizes;
 *   and its ratio to `fy` times the allowable factor.
 * - `deflection`, for a member that is not vertical: the largest deflection from the chord between
 *   its displaced ends, perpendicular to the member, over the stations; the limit, the member's
 *   length over n; and their ratio.
 * - `drift`, for a vertical member: the relative horizontal displacement of its two nodes; the
 *   limit, the member's length over n; and their ratio.
 *
 * A truss member, a member with an end release and a member without values are listed in `skipped`.
 *
 * Returns `undefined` when `result` is not an `ok` result or has no load case `loadCaseId`. The
 * function does not check that `result` is the result of this `model`. It does not change its
 * arguments and keeps no state.
 *
 * @param model - the model that was solved
 * @param result - what `solve(model)` returned
 * @param loadCaseId - the load case
 * @param options - the allowable factor, the two divisors and the number of stations
 */
export function memberChecks(
  model: Model,
  result: SolveResult,
  loadCaseId: string,
  options: MemberCheckOptions = {},
): MemberChecks | undefined {
  if (!result.ok || !Object.hasOwn(result.loadCases, loadCaseId)) {
    return undefined;
  }
  const loadCase = result.loadCases[loadCaseId];
  if (!loadCase) {
    return undefined;
  }
  const allowableFactor = positive(options.allowableFactor, DEFAULT_ALLOWABLE_FACTOR);
  const deflectionDivisor = positive(options.deflectionDivisor, DEFAULT_DEFLECTION_DIVISOR);
  const driftDivisor = positive(options.driftDivisor, DEFAULT_DRIFT_DIVISOR);
  const stations = checkStations(options.stations);
  const members: MemberCheck[] = [];
  const skipped: MemberChecks["skipped"] = [];
  for (const member of model.members) {
    const memberId = member.id;
    if (member.kind !== "frame") {
      skipped.push({ memberId, reason: "truss" });
      continue;
    }
    if (hasRelease(member)) {
      skipped.push({ memberId, reason: "release" });
      continue;
    }
    const v = memberValues(model, result, loadCaseId, memberId, stations);
    const section = model.sections.find((candidate) => candidate.id === member.sectionId);
    const material = model.materials.find((candidate) => candidate.id === member.materialId);
    const d1 = loadCase.displacements[member.startNodeId];
    const d2 = loadCase.displacements[member.endNodeId];
    if (!v || !section || !material || !d1 || !d2) {
      skipped.push({ memberId, reason: "no-values" });
      continue;
    }
    const { tension, compression } = stressExtremes(
      v,
      section.A,
      section.Iy,
      section.Iz,
      section.depthY / 2,
      section.depthZ / 2,
    );
    const largest = Math.max(Math.abs(tension.value), Math.abs(compression.value));
    const allowable = material.fy * allowableFactor;
    const stressRatio = largest / allowable;
    // The rule of `memberLocalAxes`, on the unit vector it computed.
    const vertical = Math.hypot(v.axes.x.x, v.axes.x.y) <= VERTICAL_TOLERANCE;
    let deflection: DeflectionCheck | null = null;
    let drift: DriftCheck | null = null;
    if (vertical) {
      const dX = d2.ux - d1.ux + 0;
      const dY = d2.uy - d1.uy + 0;
      const value = Math.hypot(dX, dY);
      const limit = v.length / driftDivisor;
      const ratio = value / limit;
      drift = {
        value,
        dX,
        dY,
        height: v.length,
        divisor: driftDivisor,
        limit,
        ratio,
        passes: ratio <= 1,
      };
    } else {
      const limit = v.length / deflectionDivisor;
      const found = chordDeflection(v);
      const ratio = found.value / limit;
      deflection = {
        ...found,
        span: v.length,
        divisor: deflectionDivisor,
        limit,
        ratio,
        passes: ratio <= 1,
      };
    }
    members.push({
      memberId,
      length: v.length,
      vertical,
      stress: {
        tension,
        compression,
        largest,
        fy: material.fy,
        allowable,
        ratio: stressRatio,
        passes: stressRatio <= 1,
      },
      deflection,
      drift,
    });
  }
  return {
    kind: "illustrative",
    loadCaseId,
    notChecked: [...NOT_CHECKED],
    allowableFactor,
    deflectionDivisor,
    driftDivisor,
    stations,
    members,
    skipped,
  };
}

/**
 * The governing member of each of the three ratios of a `memberChecks` result: the member with the
 * largest stress ratio, the one with the largest deflection ratio and the one with the largest
 * drift ratio (of equal ratios, the first member in the result's order), each with whether the
 * ratio is at most 1. An entry is `null` when no checked member has that ratio. The deflection
 * ratio is that of single members, each over its own length; `spanDeflection` measures a span of
 * several members.
 *
 * @param checks - what `memberChecks` returned
 */
export function governingChecks(checks: MemberChecks): StructureChecks {
  let stress: GoverningRatio | null = null;
  let deflection: GoverningRatio | null = null;
  let drift: GoverningRatio | null = null;
  const larger = (
    current: GoverningRatio | null,
    memberId: string,
    ratio: number,
  ): GoverningRatio | null =>
    current === null || ratio > current.ratio ? { memberId, ratio, passes: ratio <= 1 } : current;
  for (const member of checks.members) {
    stress = larger(stress, member.memberId, member.stress.ratio);
    if (member.deflection) {
      deflection = larger(deflection, member.memberId, member.deflection.ratio);
    }
    if (member.drift) {
      drift = larger(drift, member.memberId, member.drift.ratio);
    }
  }
  return {
    kind: "illustrative",
    loadCaseId: checks.loadCaseId,
    notChecked: [...checks.notChecked],
    stress,
    deflection,
    drift,
  };
}

/**
 * `governingChecks` of `memberChecks(model, result, loadCaseId, options)`: the governing member and
 * value of the stress ratio, of the deflection ratio and of the drift ratio, and whether each is at
 * most 1. Returns `undefined` when `memberChecks` does.
 *
 * @param model - the model that was solved
 * @param result - what `solve(model)` returned
 * @param loadCaseId - the load case
 * @param options - as for `memberChecks`
 */
export function structureChecks(
  model: Model,
  result: SolveResult,
  loadCaseId: string,
  options: MemberCheckOptions = {},
): StructureChecks | undefined {
  const checks = memberChecks(model, result, loadCaseId, options);
  return checks ? governingChecks(checks) : undefined;
}

/**
 * Why `spanDeflection` has no value:
 * - `no-result`: `result` is not an `ok` result or has no load case `loadCaseId`.
 * - `no-members`: `memberIds` is empty.
 * - `repeated-member`: an id is in `memberIds` twice (`memberId`: that id).
 * - `unknown-member`: the model has no member with an id of the list (`memberId`: that id).
 * - `no-values`: `memberValues` has no values for a member: a truss member, a member with an end
 *   release, or one whose nodes, section, material or results are missing (`memberId`).
 * - `not-connected`: a member does not start or end at the node where the member before it in the
 *   list ended (`memberId`: the later member).
 * - `not-collinear`: the members are connected but not in one straight line running one way
 *   (`memberId`: the first member whose far node is off the line between the span's two end nodes
 *   or is not further along it than its near node; the second member, or the only one, when the
 *   walk ends where it started).
 */
export type SpanDeflectionRefusal =
  | "no-result"
  | "no-members"
  | "repeated-member"
  | "unknown-member"
  | "no-values"
  | "not-connected"
  | "not-collinear";

/** The deflection of a span of collinear members from the chord between its two ends. Plain data. */
export type SpanDeflection =
  | {
      ok: true;
      /** An illustrative check, not that of a design code. */
      kind: "illustrative";
      loadCaseId: string;
      /** The members of the span, in the order given. */
      memberIds: string[];
      /** The node the span starts at: the end of the first member that the second does not share. */
      startNodeId: string;
      /** The node the span ends at. */
      endNodeId: string;
      /** The distance between the two end nodes, m. */
      span: number;
      /**
       * The largest deflection from the straight line between the span's two displaced ends,
       * perpendicular to the span, over the stations of all its members, m.
       */
      value: number;
      /** The member that has the station with that value (the first such station along the span). */
      memberId: string;
      /** That station's distance from that member's start node, m. */
      x: number;
      /** That station's distance from the span's start node, along the span, m. */
      distance: number;
      /** The divisor n. */
      divisor: number;
      /** `span` / `divisor`, m. */
      limit: number;
      /** `value` / `limit`. */
      ratio: number;
      /** Whether `ratio` is at most 1 (no tolerance). */
      passes: boolean;
    }
  | { ok: false; reason: SpanDeflectionRefusal; memberId?: string };

function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * The deflection of a beam made of several members in one straight line (a span between supports
 * modelled with intermediate nodes), against span/n.
 *
 * `memberIds` are the members of the span in order from one end to the other. Each may run either
 * way: the walk goes from member to member through the node they share. The span's start node is
 * the end of the first member that the second member does not share (the first member's start node
 * when it is the only one). The members must be in one straight line: no node of the span may be
 * further than `COLLINEAR_TOLERANCE` (1e-9) times the span from the line between the two end nodes,
 * and every member must run forward along that line. The span may have any direction.
 *
 * At each station of each member (`stations` equally spaced ones per member, read as in
 * `memberChecks`, plus those `memberValues` adds at point loads) the deflection in global axes has
 * subtracted from it the straight line between the displacements of the span's two end nodes,
 * D0 + (s/S)·(D1 − D0), with s the station's distance from the start node along the span and S the
 * span. The value is the largest size of the part of that difference perpendicular to the span. It
 * is taken at stations only, so it is never above the true largest value.
 *
 * It does not change its arguments and keeps no state, and does not check that `result` is the
 * result of this `model`.
 *
 * @param model - the model that was solved
 * @param result - what `solve(model)` returned
 * @param loadCaseId - the load case
 * @param memberIds - the members of the span, in order
 * @param divisor - n of the limit span/n; a value that is not a finite number above zero is 360
 * @param stations - the number of equally spaced stations per member (default 21)
 */
export function spanDeflection(
  model: Model,
  result: SolveResult,
  loadCaseId: string,
  memberIds: readonly string[],
  divisor: number = DEFAULT_DEFLECTION_DIVISOR,
  stations: number = DEFAULT_STATIONS,
): SpanDeflection {
  if (!result.ok || !Object.hasOwn(result.loadCases, loadCaseId)) {
    return { ok: false, reason: "no-result" };
  }
  const loadCase = result.loadCases[loadCaseId];
  if (!loadCase) {
    return { ok: false, reason: "no-result" };
  }
  if (memberIds.length === 0) {
    return { ok: false, reason: "no-members" };
  }
  const n = checkStations(stations);
  const members: Member[] = [];
  const values: MemberValues[] = [];
  for (const memberId of memberIds) {
    if (members.some((member) => member.id === memberId)) {
      return { ok: false, reason: "repeated-member", memberId };
    }
    const member = model.members.find((candidate) => candidate.id === memberId);
    if (!member) {
      return { ok: false, reason: "unknown-member", memberId };
    }
    const v = memberValues(model, result, loadCaseId, memberId, n);
    if (!v) {
      return { ok: false, reason: "no-values", memberId };
    }
    members.push(member);
    values.push(v);
  }

  // The walk: nodeIds[j] and nodeIds[j + 1] are the ends of member j, in the span's direction.
  const first = members[0] as Member;
  const second = members[1];
  let current = first.startNodeId;
  if (second) {
    const startShared =
      first.startNodeId === second.startNodeId || first.startNodeId === second.endNodeId;
    const endShared =
      first.endNodeId === second.startNodeId || first.endNodeId === second.endNodeId;
    if (!startShared && !endShared) {
      return { ok: false, reason: "not-connected", memberId: second.id };
    }
    // When the second member shares both nodes, it runs back along the first: refused below.
    current = endShared ? first.startNodeId : first.endNodeId;
  }
  const nodeIds = [current];
  for (const member of members) {
    if (member.startNodeId === current) {
      current = member.endNodeId;
    } else if (member.endNodeId === current) {
      current = member.startNodeId;
    } else {
      return { ok: false, reason: "not-connected", memberId: member.id };
    }
    nodeIds.push(current);
  }
  const points: Vec3[] = [];
  for (const nodeId of nodeIds) {
    // `memberValues` had values for every member, so every node is in the model.
    points.push(model.nodes.find((node) => node.id === nodeId) as Vec3);
  }
  const origin = points[0] as Vec3;
  const far = points[points.length - 1] as Vec3;
  const span = distance(origin, far);
  const longest = Math.max(...values.map((v) => v.length));
  if (!(span > COLLINEAR_TOLERANCE * longest)) {
    // The walk comes back to where it started.
    return { ok: false, reason: "not-collinear", memberId: (members[1] ?? first).id };
  }
  const e: Vec3 = {
    x: (far.x - origin.x) / span,
    y: (far.y - origin.y) / span,
    z: (far.z - origin.z) / span,
  };
  const along: number[] = [];
  for (const [j, point] of points.entries()) {
    const offset = subtract(point, origin);
    const s = dot(offset, e);
    const away = Math.hypot(offset.x - s * e.x, offset.y - s * e.y, offset.z - s * e.z);
    const previous = along[j - 1];
    if (away > COLLINEAR_TOLERANCE * span || (previous !== undefined && !(s > previous))) {
      // Node j is the far end of member j − 1.
      return { ok: false, reason: "not-collinear", memberId: (members[j - 1] ?? first).id };
    }
    along.push(s);
  }

  const startNodeId = nodeIds[0] as string;
  const endNodeId = nodeIds[nodeIds.length - 1] as string;
  const D0 = loadCase.displacements[startNodeId];
  const D1 = loadCase.displacements[endNodeId];
  if (!D0 || !D1) {
    return { ok: false, reason: "no-values", memberId: first.id };
  }
  const found = { value: 0, memberId: first.id, x: 0, distance: 0 };
  for (const [j, v] of values.entries()) {
    const member = members[j] as Member;
    const forward = member.startNodeId === nodeIds[j];
    const from = along[forward ? j : j + 1] as number;
    const to = along[forward ? j + 1 : j] as number;
    // Stations in the order of the span, so that of equal values the first along the span is kept.
    for (let k = 0; k < v.count; k++) {
      const i = forward ? k : v.count - 1 - k;
      const x = of(v.x, i);
      const s = from + (x / v.length) * (to - from);
      const t = s / span;
      const rx = of(v.deflectionGlobal, 3 * i) - (D0.ux + t * (D1.ux - D0.ux));
      const ry = of(v.deflectionGlobal, 3 * i + 1) - (D0.uy + t * (D1.uy - D0.uy));
      const rz = of(v.deflectionGlobal, 3 * i + 2) - (D0.uz + t * (D1.uz - D0.uz));
      const axial = rx * e.x + ry * e.y + rz * e.z;
      const value = Math.hypot(rx - axial * e.x, ry - axial * e.y, rz - axial * e.z);
      if (value > found.value) {
        found.value = value;
        found.memberId = member.id;
        found.x = x;
        found.distance = s;
      }
    }
  }
  const used = positive(divisor, DEFAULT_DEFLECTION_DIVISOR);
  const limit = span / used;
  const ratio = found.value / limit;
  return {
    ok: true,
    kind: "illustrative",
    loadCaseId,
    memberIds: [...memberIds],
    startNodeId,
    endNodeId,
    span,
    value: found.value,
    memberId: found.memberId,
    x: found.x,
    distance: found.distance,
    divisor: used,
    limit,
    ratio,
    passes: ratio <= 1,
  };
}
