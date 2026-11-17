/**
 * Values along a member (pitch card S6): the internal actions and the deflection of a member's axis
 * at stations along its length, their extreme values, and the deflected shape of a whole structure
 * for drawing. Units are the model's: kN, kN·m and m. The convention below is also in ../README.md
 * ("Values along a member").
 *
 * THE CONVENTION OF THE INTERNAL ACTIONS
 *
 * Cut the member at the distance x from its start node. The part before the cut is the piece from
 * the start node to the cut; the part beyond it is the piece from the cut to the end node. All six
 * values are in the member's local axes (`memberLocalAxes` of `@bridle/model`; local x runs from the
 * start node to the end node).
 *
 *   N   axial force: positive in tension.
 *   T   torque: the moment about local +x (right-hand rule) that the part beyond the cut applies to
 *       the part before it.
 *   Vy  shear along local y: the sum, along +y, of the forces on the part before the cut (the start
 *       end force and the loads up to the cut).
 *   Vz  the same along local z.
 *   My  bending moment about local y (bending in the local x-z plane, stiffness E·Iy): positive when
 *       the fibre on the -z side of the section is in tension.
 *   Mz  bending moment about local z (bending in the local x-y plane, stiffness E·Iz): positive when
 *       the fibre on the -y side of the section is in tension.
 *
 * With these definitions the two bending planes read alike. With d the deflection along the plane's
 * transverse axis (uz for My and Vz, uy for Mz and Vy), p the load per unit length along that axis
 * and EI the plane's stiffness, in a stretch without a point load:
 *
 *   M = EI d'',   V = dM/dx,   dV/dx = p.
 *
 * So a positive moment bends the member concave towards the positive transverse axis, and a diagram
 * is on the tension side when the ordinate My is drawn from the axis towards -z and the ordinate Mz
 * towards -y (a negative value then falls on the +z or +y side).
 *
 * DERIVATION, by statics, from the start end force of `solve`
 *
 * `solve` reports for the start of a member the force F1 = (fx1, fy1, fz1) and the moment
 * M1 = (mx1, my1, mz1) that the start node applies to the member, positive along and about the
 * positive local axes. Take the part before the cut as a free body. On it act F1 and M1 at x = 0,
 * the loads between 0 and x (a force (px, py, pz) at each point ξ; for a uniform load per unit
 * length), and, at the cut, the force R and the moment C that the part beyond the cut applies
 * ("the actions on the positive face": the face whose outward normal is +x).
 *
 *   forces:                 F1 + Σ p + R = 0
 *   moments about the cut:  M1 + (-x, 0, 0) × F1 + Σ (ξ - x, 0, 0) × p + C = 0
 *
 * With (-x, 0, 0) × (fx, fy, fz) = (0, x·fz, -x·fy):
 *
 *   R = -F1 - Σ p
 *   Cx = -mx1
 *   Cy = -my1 - x·fz1 - Σ pz·(x - ξ)
 *   Cz = -mz1 + x·fy1 + Σ py·(x - ξ)
 *
 * (the shear term has opposite signs in the two planes). The stress σ on the positive face, positive
 * in tension, gives C = ∫ (0, y, z) × (σ, 0, 0) dA = (0, ∫ z σ dA, -∫ y σ dA). So a positive Cy is
 * tension on the +z side and a positive Cz is tension on the -y side. The values reported are
 *
 *   N  = Rx  = -fx1 - Σ px
 *   T  = Cx  = -mx1
 *   Vy = -Ry = fy1 + Σ py
 *   Vz = -Rz = fz1 + Σ pz
 *   My = -Cy = my1 + x·fz1 + Σ pz·(x - ξ)        (tension on the -z side)
 *   Mz = +Cz = -mz1 + x·fy1 + Σ py·(x - ξ)       (tension on the -y side)
 *
 * For a uniform load w over the whole member Σ p = w·x and Σ p·(x - ξ) = w·x²/2. A point load P at
 * a adds P and P·(x - a) once the cut has passed it.
 *
 * Why M = EI d'': Euler-Bernoulli bending in the x-z plane has the strain -z·uz'' at the height z, so
 * σ = -E z uz'' and My = -∫ z σ dA = E Iy uz''. In the x-y plane σ = -E y uy'' and
 * Mz = -∫ y σ dA = E Iz uy''.
 *
 * At the two ends. The first station is at x = 0 before any load, and R, C at the last station are
 * the end node's actions F2, M2 when every load has been passed. So
 *
 *   at the start:  N = -fx1,  Vy = +fy1,  Vz = +fz1,  T = -mx1,  My = +my1,  Mz = -mz1
 *   at the end:    N = +fx2,  Vy = -fy2,  Vz = -fz2,  T = +mx2,  My = -my2,  Mz = +mz2
 *
 * The values at the end are computed from the start end force and the loads; they agree with the
 * reported end force of the end node up to rounding.
 *
 * A point load at position 0 or at the length is on the member, not on the node, so the end forces
 * do not hold it: there are two stations at that end, and the one on the node's side has the values
 * of the list above.
 *
 * THE DEFLECTION
 *
 * The deflection of the member's axis at x is the element's interpolation of the displacements of
 * its two ends (the Hermite cubics of ./element.ts for local y and z, linear for local x) plus the
 * deflection that the member's own loads give a member fixed at both ends. The first part has the
 * end displacements and no load; the second has the load and no end displacement; their sum has
 * both and satisfies EI d'''' = p, so it is the Euler-Bernoulli deflection of the loaded member.
 * The second part, with b = L - a, ξ = L - x:
 *
 *   uniform w, transverse:      w x² (L - x)² / (24 EI)
 *   point P at a, transverse:   P b² x² (3aL - (3a + b) x) / (6 EI L³)      for x ≤ a
 *                               P a² ξ² (3bL - (3b + a) ξ) / (6 EI L³)      for x ≥ a
 *   uniform w, axial:           w x (L - x) / (2 EA)
 *   point P at a, axial:        P b x / (EA L) for x ≤ a,   P a ξ / (EA L) for x ≥ a
 *
 * Each is zero with zero slope (zero only, for the axial ones) at both ends and satisfies
 * EI d'''' = w (EA u'' = -w); the point-load ones are continuous with a jump of P in EI d''' (of -P
 * in EA u') at a. The slope enters the Hermite cubics as d(uy)/dx = +rz and d(uz)/dx = -ry
 * (./element.ts). The twist of the section about the axis does not move the axis and is not reported.
 *
 * These formulas are those of a member rigidly connected at both ends. `solve` refuses a model with
 * a truss member or an end release today; for such a member the functions here do not apply the
 * formulas (see `memberValues` and `deflectedShape`).
 */
import {
  distance,
  type LocalAxes,
  type Member,
  type Model,
  memberLocalAxes,
  type Vec3,
} from "@bridle/model";
import { isMemberPointLoad, type MemberLoad, memberLoadLocalComponents } from "./memberLoads";
import type { LoadCaseResult, MemberEndAction, SolveResult } from "./solve";

/** The number of equally spaced stations when the caller gives none: the two ends and 19 between. */
export const DEFAULT_STATIONS = 21;

/** The largest number of equally spaced stations: a larger number asked for is taken as this one. */
export const MAX_STATIONS = 1001;

/**
 * A derivative of a deflection component at a station counts as zero when its size is at most this
 * times the largest size of that derivative over the member's stations (`memberValues`, extremes).
 */
const ZERO_SLOPE = 1e-12;

/** The fraction of an interval between two stations at which a zero derivative is replaced. */
const INSIDE = 2 ** -20;

/** The smallest and the largest value of one quantity along a member, with where they occur. */
export interface MemberExtreme {
  /** The smallest value (the most negative one). */
  min: number;
  /** Its distance from the start node, m: the first such position along the member. */
  minX: number;
  /** The largest value. */
  max: number;
  /** Its distance from the start node, m: the first such position along the member. */
  maxX: number;
}

/** The names of the quantities that `MemberValues.extremes` has an entry for. */
export const MEMBER_QUANTITIES = [
  "N",
  "Vy",
  "Vz",
  "T",
  "My",
  "Mz",
  "dLocalX",
  "dLocalY",
  "dLocalZ",
  "dGlobalX",
  "dGlobalY",
  "dGlobalZ",
] as const;

export type MemberQuantity = (typeof MEMBER_QUANTITIES)[number];

/**
 * The internal actions and the deflection of one member for one load case, at `count` stations.
 * Plain data: strings, numbers, plain objects and `Float64Array`s. The sign convention is at the top
 * of this file.
 */
export interface MemberValues {
  memberId: string;
  loadCaseId: string;
  /** The member's length, m. */
  length: number;
  /** The member's local axes as unit vectors in global coordinates. */
  axes: LocalAxes;
  /** The number of stations: the length of `x` and of each array of actions. */
  count: number;
  /**
   * The distance of each station from the start node, m, in increasing order. A position that holds
   * a point load appears twice: first the station just before the load, then the one just after it.
   */
  x: Float64Array;
  /** Axial force, kN: positive in tension. */
  N: Float64Array;
  /** Shear along local y, kN. */
  Vy: Float64Array;
  /** Shear along local z, kN. */
  Vz: Float64Array;
  /** Torque, kN·m. */
  T: Float64Array;
  /** Bending moment about local y, kN·m: positive with tension on the -z side. */
  My: Float64Array;
  /** Bending moment about local z, kN·m: positive with tension on the -y side. */
  Mz: Float64Array;
  /**
   * The deflection of the member's axis along its local x, y, z, m: three numbers per station
   * (station i at 3i, 3i + 1, 3i + 2).
   */
  deflectionLocal: Float64Array;
  /** The same deflection along global X, Y, Z, m: three numbers per station. */
  deflectionGlobal: Float64Array;
  /** The extreme values of each quantity; how they are found is in the comment of `memberValues`. */
  extremes: Record<MemberQuantity, MemberExtreme>;
}

/** The deflected shape of a structure for drawing (`deflectedShape`). Plain data. */
export interface DeflectedShape {
  loadCaseId: string;
  /** The factor the deflections were multiplied by. */
  scale: number;
  /** The number of points per member. */
  stations: number;
  /** The member ids in the model's order: the order of the polylines in `points`. */
  memberIds: string[];
  /**
   * Global coordinates, m: three numbers per point and `stations` points per member, from the
   * member's start node to its end node. Point s of member number m (from 0) is at
   * 3 · (m · stations + s). Each point is the point of the undeformed axis plus `scale` times the
   * deflection there.
   */
  points: Float64Array;
}

/** A point load, or the sum of the point loads at one position, in local components. */
interface LocalPointLoad {
  a: number;
  px: number;
  py: number;
  pz: number;
}

/** What the values of one member are computed from. */
interface MemberContext {
  member: Member;
  /** The positions of the start node and of the end node. */
  origin: Vec3;
  end: Vec3;
  length: number;
  axes: LocalAxes;
  EA: number;
  EIy: number;
  EIz: number;
  /** The displacements of the two ends in local axes, in the order of `LOCAL_DOF`. */
  u: Float64Array;
  start: MemberEndAction;
  /** The sum of the member's uniform loads of the load case, local components, kN/m. */
  wx: number;
  wy: number;
  wz: number;
  /** The member's point loads of the load case, one entry per position, by increasing position. */
  points: LocalPointLoad[];
}

interface Lookup {
  node: (id: string) => Vec3 | undefined;
  section: (id: string) => { A: number; Iy: number; Iz: number } | undefined;
  material: (id: string) => { E: number } | undefined;
  loads: (memberId: string) => MemberLoad[];
}

function hasRelease(member: Member): boolean {
  const { start, end } = member.releases;
  return start.rx || start.ry || start.rz || end.rx || end.ry || end.rz;
}

function dot(axis: Vec3, x: number, y: number, z: number): number {
  return axis.x * x + axis.y * y + axis.z * z;
}

function context(
  member: Member,
  loadCase: LoadCaseResult,
  lookup: Lookup,
): MemberContext | undefined {
  const startNode = lookup.node(member.startNodeId);
  const endNode = lookup.node(member.endNodeId);
  const section = lookup.section(member.sectionId);
  const material = lookup.material(member.materialId);
  const d1 = loadCase.displacements[member.startNodeId];
  const d2 = loadCase.displacements[member.endNodeId];
  const endForces = loadCase.memberEndForces[member.id];
  if (!startNode || !endNode || !section || !material || !d1 || !d2 || !endForces) {
    return undefined;
  }
  const axes = memberLocalAxes(startNode, endNode, member.rollAngleDeg);
  if (!axes) {
    return undefined;
  }
  const length = distance(startNode, endNode);
  const triad = [axes.x, axes.y, axes.z] as const;
  const u = new Float64Array(12);
  triad.forEach((axis, i) => {
    u[i] = dot(axis, d1.ux, d1.uy, d1.uz);
    u[3 + i] = dot(axis, d1.rx, d1.ry, d1.rz);
    u[6 + i] = dot(axis, d2.ux, d2.uy, d2.uz);
    u[9 + i] = dot(axis, d2.rx, d2.ry, d2.rz);
  });
  let wx = 0;
  let wy = 0;
  let wz = 0;
  const byPosition = new Map<number, LocalPointLoad>();
  for (const load of lookup.loads(member.id)) {
    const [px, py, pz] = memberLoadLocalComponents(load, axes);
    if (isMemberPointLoad(load)) {
      // The same rule as `equivalentNodalLoadsLocal`: a position past an end is that end.
      const a = Math.min(Math.max(load.position, 0), length);
      const at = byPosition.get(a);
      if (at) {
        at.px += px;
        at.py += py;
        at.pz += pz;
      } else {
        byPosition.set(a, { a, px, py, pz });
      }
    } else {
      wx += px;
      wy += py;
      wz += pz;
    }
  }
  return {
    member,
    origin: { x: startNode.x, y: startNode.y, z: startNode.z },
    end: { x: endNode.x, y: endNode.y, z: endNode.z },
    length,
    axes,
    EA: material.E * section.A,
    EIy: material.E * section.Iy,
    EIz: material.E * section.Iz,
    u,
    start: endForces.start,
    wx,
    wy,
    wz,
    points: [...byPosition.values()].sort((p, q) => p.a - q.a),
  };
}

/** Whether a cut at `x` has passed the point load at `a`; `after` decides for a cut at the load. */
function passed(a: number, x: number, after: boolean): boolean {
  return a < x || (after && a === x);
}

/** The six internal actions at a cut, in the order N, Vy, Vz, T, My, Mz (the header's formulas). */
function actionsAt(c: MemberContext, x: number, after: boolean, out: Float64Array): void {
  const f = c.start;
  let n = -f.fx - c.wx * x;
  let vy = f.fy + c.wy * x;
  let vz = f.fz + c.wz * x;
  let my = f.my + f.fz * x + (c.wz * x * x) / 2;
  let mz = -f.mz + f.fy * x + (c.wy * x * x) / 2;
  for (const p of c.points) {
    if (!passed(p.a, x, after)) {
      break; // the loads are in increasing order of position
    }
    n -= p.px;
    vy += p.py;
    vz += p.pz;
    my += p.pz * (x - p.a);
    mz += p.py * (x - p.a);
  }
  // The "+ 0" turns a negative zero into zero.
  out[0] = n + 0;
  out[1] = vy + 0;
  out[2] = vz + 0;
  out[3] = -f.mx + 0;
  out[4] = my + 0;
  out[5] = mz + 0;
}

/**
 * The deflection of the axis at x in local axes (out[0..2]) and its derivative with respect to x
 * (out[3..5]), by the header's formulas. `after` chooses the side for the axial slope at a point
 * load, which jumps there.
 */
function deflectionAt(c: MemberContext, x: number, after: boolean, out: Float64Array): void {
  const L = c.length;
  const t = x / L;
  const r = L - x;
  const u = c.u;
  // The Hermite cubics of ./element.ts and their derivatives with respect to x.
  const n1 = 1 - 3 * t * t + 2 * t * t * t;
  const n2 = L * (t - 2 * t * t + t * t * t);
  const n3 = 3 * t * t - 2 * t * t * t;
  const n4 = L * (-t * t + t * t * t);
  const s1 = (-6 * t + 6 * t * t) / L;
  const s2 = 1 - 4 * t + 3 * t * t;
  const s3 = -s1;
  const s4 = -2 * t + 3 * t * t;
  // Local x: linear, plus the bar fixed at both ends under the uniform load.
  let dx = (1 - t) * (u[0] as number) + t * (u[6] as number) + (c.wx * x * r) / (2 * c.EA);
  let sx = ((u[6] as number) - (u[0] as number)) / L + (c.wx * (L - 2 * x)) / (2 * c.EA);
  // Local y: the slope is +rz. Local z: the slope is -ry.
  const kyUniform = c.wy / (24 * c.EIz);
  const kzUniform = c.wz / (24 * c.EIy);
  const uniformValue = x * x * r * r;
  const uniformSlope = 2 * x * r * (L - 2 * x);
  let dy =
    n1 * (u[1] as number) +
    n2 * (u[5] as number) +
    n3 * (u[7] as number) +
    n4 * (u[11] as number) +
    kyUniform * uniformValue;
  let sy =
    s1 * (u[1] as number) +
    s2 * (u[5] as number) +
    s3 * (u[7] as number) +
    s4 * (u[11] as number) +
    kyUniform * uniformSlope;
  let dz =
    n1 * (u[2] as number) -
    n2 * (u[4] as number) +
    n3 * (u[8] as number) -
    n4 * (u[10] as number) +
    kzUniform * uniformValue;
  let sz =
    s1 * (u[2] as number) -
    s2 * (u[4] as number) +
    s3 * (u[8] as number) -
    s4 * (u[10] as number) +
    kzUniform * uniformSlope;
  for (const p of c.points) {
    const a = p.a;
    const b = L - a;
    let value: number; // the transverse deflection for P / (6 EI L³) = 1
    let slope: number;
    if (passed(a, x, after)) {
      const k = 3 * b + a;
      value = a * a * r * r * (3 * b * L - k * r);
      slope = -3 * a * a * r * (2 * b * L - k * r);
      dx += (p.px * a * r) / (c.EA * L);
      sx -= (p.px * a) / (c.EA * L);
    } else {
      const k = 3 * a + b;
      value = b * b * x * x * (3 * a * L - k * x);
      slope = 3 * b * b * x * (2 * a * L - k * x);
      dx += (p.px * b * x) / (c.EA * L);
      sx += (p.px * b) / (c.EA * L);
    }
    const ky = p.py / (6 * c.EIz * L * L * L);
    const kz = p.pz / (6 * c.EIy * L * L * L);
    dy += ky * value;
    sy += ky * slope;
    dz += kz * value;
    sz += kz * slope;
  }
  out[0] = dx + 0;
  out[1] = dy + 0;
  out[2] = dz + 0;
  out[3] = sx + 0;
  out[4] = sy + 0;
  out[5] = sz + 0;
}

/** Turns three local components at `from` into three global ones at `to`. */
function toGlobal(
  axes: LocalAxes,
  local: Float64Array,
  from: number,
  out: Float64Array,
  to: number,
): void {
  const a = local[from] as number;
  const b = local[from + 1] as number;
  const c = local[from + 2] as number;
  out[to] = axes.x.x * a + axes.y.x * b + axes.z.x * c + 0;
  out[to + 1] = axes.x.y * a + axes.y.y * b + axes.z.y * c + 0;
  out[to + 2] = axes.x.z * a + axes.y.z * b + axes.z.z * c + 0;
}

function stationCount(stations: number): number {
  return Number.isFinite(stations)
    ? Math.min(MAX_STATIONS, Math.max(2, Math.floor(stations)))
    : DEFAULT_STATIONS;
}

/** The position of station `i` of `n` equally spaced ones; the last is the length itself. */
function stationPosition(i: number, n: number, length: number): number {
  return i === n - 1 ? length : (length * i) / (n - 1);
}

function lookupOf(model: Model, loadCaseId: string, indexed: boolean): Lookup {
  const loads = (memberId: string): MemberLoad[] => [
    ...model.memberUniformLoads.filter(
      (load) => load.loadCaseId === loadCaseId && load.memberId === memberId,
    ),
    ...model.memberPointLoads.filter(
      (load) => load.loadCaseId === loadCaseId && load.memberId === memberId,
    ),
  ];
  if (!indexed) {
    return {
      node: (id) => model.nodes.find((node) => node.id === id),
      section: (id) => model.sections.find((section) => section.id === id),
      material: (id) => model.materials.find((material) => material.id === id),
      loads,
    };
  }
  // The first entry of an id wins, as with `find`.
  const first = <T extends { id: string }>(list: readonly T[]): Map<string, T> => {
    const map = new Map<string, T>();
    for (const item of list) {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    }
    return map;
  };
  const nodes = first(model.nodes);
  const sections = first(model.sections);
  const materials = first(model.materials);
  const byMember = new Map<string, MemberLoad[]>();
  for (const load of [...model.memberUniformLoads, ...model.memberPointLoads]) {
    if (load.loadCaseId === loadCaseId) {
      const list = byMember.get(load.memberId);
      if (list) {
        list.push(load);
      } else {
        byMember.set(load.memberId, [load]);
      }
    }
  }
  return {
    node: (id) => nodes.get(id),
    section: (id) => sections.get(id),
    material: (id) => materials.get(id),
    loads: (memberId) => byMember.get(memberId) ?? [],
  };
}

function newExtreme(): MemberExtreme {
  return { min: Number.POSITIVE_INFINITY, minX: 0, max: Number.NEGATIVE_INFINITY, maxX: 0 };
}

/** Takes a candidate into an extreme; of equal values the smaller position is kept. */
function take(extreme: MemberExtreme, value: number, x: number): void {
  if (value < extreme.min || (value === extreme.min && x < extreme.minX)) {
    extreme.min = value;
    extreme.minX = x;
  }
  if (value > extreme.max || (value === extreme.max && x < extreme.maxX)) {
    extreme.max = value;
    extreme.maxX = x;
  }
}

/**
 * The internal actions and the deflection along one member for one load case.
 *
 * Stations. `stations` equally spaced positions from 0 to the member's length, both included
 * (default 21; a number below 2 is taken as 2, one above `MAX_STATIONS` (1001) as 1001, a fraction
 * is rounded down, a value that is not
 * finite is taken as 21), plus the positions of `at` (m from the start node; a position outside the
 * member is taken as the nearer end, one that is not finite is left out), plus two stations at each
 * position that holds a point load of the member in this load case: the first has the actions just
 * before the load, the second just after it. Positions that are equal as numbers are one position:
 * an equally spaced station or a position of `at` that is exactly at a point load is not added to
 * the two stations there. A point load's position past an end is taken as that end, as `solve` does.
 *
 * Internal actions: by statics from the start end force of `result` and the member's loads of the
 * load case, resolved with `memberLoadLocalComponents` (the header's formulas).
 *
 * Deflection: the header's formulas; the second station at a point load has the numbers of the first.
 *
 * Extremes (`extremes`), for each quantity the smallest and the largest value with their positions:
 * - N, Vy, Vz, T: over the stations. Between two consecutive point-load positions or ends each of
 *   them is linear in x, and those positions and the ends are stations.
 * - My, Mz: over the stations and over each point between two consecutive stations where the shear
 *   of that plane is zero (the shear is linear there, so the point is the station's position minus
 *   its shear over the load intensity, and the moment there is the station's moment minus the
 *   square of its shear over twice the load intensity).
 * - The six deflection components: over the stations and, for each pair of consecutive stations at
 *   different positions, over one more point when the component's derivative has opposite signs at
 *   the two ends of the pair: the point where it changes sign, found by bisection of the derivative.
 *   The derivative at an end of the pair is the one computed at that station, unless its size is at
 *   most 1e-12 times the largest size of that derivative over the member's stations (it is exactly
 *   zero at a fixed end): then the derivative at 2⁻²⁰ of the pair's length inside the pair is taken
 *   in its place, and the bisection starts from that point. What is not found: the points of a pair
 *   in which the derivative changes sign an even number of times, and a change of sign within that
 *   2⁻²⁰ of the pair's length next to such a station. Every value taken is a value of the deflection
 *   at a point of the member, so a reported largest value is never above the true one and a reported
 *   smallest never below it.
 *
 * Returns `undefined` when `result` is not an `ok` result, when it has no load case `loadCaseId`,
 * when the model has no member `memberId`, when the member's nodes, section or material are not in
 * the model or its nodes or end forces not in the result, and for a member of kind `truss` or with
 * an end release. The function does not check that `result` is the result of this `model`.
 *
 * It does not change its arguments and keeps no state. Each call searches the model's lists of
 * members, nodes, sections, materials and member loads.
 *
 * @param model - the model that was solved
 * @param result - what `solve(model)` returned
 * @param loadCaseId - the load case
 * @param memberId - the member
 * @param stations - the number of equally spaced stations, ends included
 * @param at - further positions to add a station at, m from the start node
 */
export function memberValues(
  model: Model,
  result: SolveResult,
  loadCaseId: string,
  memberId: string,
  stations: number = DEFAULT_STATIONS,
  at: readonly number[] = [],
): MemberValues | undefined {
  if (!result.ok || !Object.hasOwn(result.loadCases, loadCaseId)) {
    return undefined;
  }
  const loadCase = result.loadCases[loadCaseId];
  const member = model.members.find((candidate) => candidate.id === memberId);
  if (!loadCase || !member || member.kind !== "frame" || hasRelease(member)) {
    return undefined;
  }
  if (
    !Object.hasOwn(loadCase.memberEndForces, memberId) ||
    !Object.hasOwn(loadCase.displacements, member.startNodeId) ||
    !Object.hasOwn(loadCase.displacements, member.endNodeId)
  ) {
    return undefined;
  }
  const c = context(member, loadCase, lookupOf(model, loadCaseId, false));
  if (!c) {
    return undefined;
  }
  const L = c.length;

  // The stations: [position, after]. A point-load position gets two; any other position one.
  const loadPositions = new Set(c.points.map((p) => p.a));
  const plain = new Set<number>();
  const n = stationCount(stations);
  for (let i = 0; i < n; i++) {
    plain.add(stationPosition(i, n, L));
  }
  for (const position of at) {
    if (Number.isFinite(position)) {
      plain.add(Math.min(Math.max(position, 0), L) + 0);
    }
  }
  const list: [number, boolean][] = [];
  for (const position of plain) {
    if (!loadPositions.has(position)) {
      list.push([position, true]);
    }
  }
  for (const position of loadPositions) {
    list.push([position, false], [position, true]);
  }
  list.sort((p, q) => p[0] - q[0] || Number(p[1]) - Number(q[1]));

  const count = list.length;
  const x = new Float64Array(count);
  const actions = [0, 1, 2, 3, 4, 5].map(() => new Float64Array(count));
  const deflectionLocal = new Float64Array(3 * count);
  const deflectionGlobal = new Float64Array(3 * count);
  const slopes = new Float64Array(6 * count); // local x, y, z, then global X, Y, Z, per station
  const extremes = Object.fromEntries(
    MEMBER_QUANTITIES.map((quantity) => [quantity, newExtreme()]),
  ) as Record<MemberQuantity, MemberExtreme>;
  const six = new Float64Array(6);

  list.forEach(([position, after], i) => {
    x[i] = position;
    actionsAt(c, position, after, six);
    actions.forEach((array, k) => {
      array[i] = six[k] as number;
      take(extremes[MEMBER_QUANTITIES[k] as MemberQuantity], six[k] as number, position);
    });
    deflectionAt(c, position, after, six);
    if (i > 0 && x[i - 1] === position) {
      // The second station at a point load: the deflection is continuous, so it is the first's.
      deflectionLocal.copyWithin(3 * i, 3 * (i - 1), 3 * i);
    } else {
      deflectionLocal.set(six.subarray(0, 3), 3 * i);
    }
    toGlobal(c.axes, deflectionLocal, 3 * i, deflectionGlobal, 3 * i);
    slopes.set(six.subarray(3, 6), 6 * i);
    toGlobal(c.axes, six, 3, slopes, 6 * i + 3);
    for (let k = 0; k < 3; k++) {
      take(
        extremes[MEMBER_QUANTITIES[6 + k] as MemberQuantity],
        deflectionLocal[3 * i + k] as number,
        position,
      );
      take(
        extremes[MEMBER_QUANTITIES[9 + k] as MemberQuantity],
        deflectionGlobal[3 * i + k] as number,
        position,
      );
    }
  });

  // Between two consecutive stations at different positions there is no point load.
  const [, Vy, Vz, , My, Mz] = actions as [
    Float64Array,
    Float64Array,
    Float64Array,
    Float64Array,
    Float64Array,
    Float64Array,
  ];
  const pair = new Float64Array(6);
  /** The derivative of deflection component k (local x, y, z, then global X, Y, Z) at a position. */
  const slopeAt = (position: number, k: number): number => {
    deflectionAt(c, position, true, six);
    if (k < 3) {
      return six[3 + k] as number;
    }
    toGlobal(c.axes, six, 3, pair, 0);
    return pair[k - 3] as number;
  };
  const slopeScale = new Float64Array(6);
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < 6; k++) {
      slopeScale[k] = Math.max(slopeScale[k] as number, Math.abs(slopes[6 * i + k] as number));
    }
  }
  for (let i = 0; i + 1 < count; i++) {
    const lo = x[i] as number;
    const hi = x[i + 1] as number;
    if (!(lo < hi)) {
      continue;
    }
    // Moments: where the linear shear is zero.
    for (const [w, V, M, quantity] of [
      [c.wz, Vz, My, "My"],
      [c.wy, Vy, Mz, "Mz"],
    ] as const) {
      if (w === 0) {
        continue;
      }
      const shear = V[i] as number;
      const position = lo - shear / w;
      if (position > lo && position < hi) {
        take(extremes[quantity], (M[i] as number) - (shear * shear) / (2 * w) + 0, position);
      }
    }
    // Deflections: where the derivative of a component changes sign. A derivative that counts as
    // zero at a station (a fixed end) is replaced by the one a small step inside the interval.
    const inside = (hi - lo) * INSIDE;
    for (let k = 0; k < 6; k++) {
      const zero = ZERO_SLOPE * (slopeScale[k] as number);
      let sLo = slopes[6 * i + k] as number;
      let sHi = slopes[6 * (i + 1) + k] as number;
      let left = lo;
      let right = hi;
      if (Math.abs(sLo) <= zero) {
        left = lo + inside;
        sLo = slopeAt(left, k);
      }
      if (Math.abs(sHi) <= zero) {
        right = hi - inside;
        sHi = slopeAt(right, k);
      }
      if (!(sLo * sHi < 0)) {
        continue;
      }
      let middle = (left + right) / 2;
      for (let step = 0; step < 100 && middle > left && middle < right; step++) {
        const slope = slopeAt(middle, k);
        if (slope === 0) {
          break;
        }
        if (slope * sLo > 0) {
          left = middle;
        } else {
          right = middle;
        }
        middle = (left + right) / 2;
      }
      deflectionAt(c, middle, true, six);
      let value = six[k] as number;
      if (k >= 3) {
        toGlobal(c.axes, six, 0, pair, 0);
        value = pair[k - 3] as number;
      }
      take(extremes[MEMBER_QUANTITIES[6 + k] as MemberQuantity], value, middle);
    }
  }

  return {
    memberId,
    loadCaseId,
    length: L,
    axes: {
      x: { x: c.axes.x.x, y: c.axes.x.y, z: c.axes.x.z },
      y: { x: c.axes.y.x, y: c.axes.y.y, z: c.axes.y.z },
      z: { x: c.axes.z.x, y: c.axes.z.y, z: c.axes.z.z },
    },
    count,
    x,
    N: actions[0] as Float64Array,
    Vy,
    Vz,
    T: actions[3] as Float64Array,
    My,
    Mz,
    deflectionLocal,
    deflectionGlobal,
    extremes,
  };
}

/**
 * The deflected shape of the whole structure for one load case, for drawing: for every member of
 * the model, in the model's order, `stations` points from its start node to its end node (equally
 * spaced along the member, both ends included; the number is read as in `memberValues`). Each point
 * is the point of the undeformed axis plus `scale` times the deflection there.
 *
 * For a frame member without end releases the deflection is that of `memberValues` (the header's
 * formulas, the member's loads included). For a member of kind `truss` or with an end release the
 * points are on the straight line between its two displaced ends: the deflection is interpolated
 * linearly between the two nodes.
 *
 * Returns `undefined` when `result` is not an `ok` result, when it has no load case `loadCaseId`,
 * or when a member's nodes, section or material are not in the model or its nodes or end forces not
 * in the result. The function does not check that `result` is the result of this `model`. It does
 * not change its arguments and keeps no state.
 *
 * @param model - the model that was solved
 * @param result - what `solve(model)` returned
 * @param loadCaseId - the load case
 * @param scale - the factor on the deflections (1 draws them at their true size)
 * @param stations - the number of points per member, ends included
 */
export function deflectedShape(
  model: Model,
  result: SolveResult,
  loadCaseId: string,
  scale: number,
  stations: number = DEFAULT_STATIONS,
): DeflectedShape | undefined {
  if (!result.ok || !Object.hasOwn(result.loadCases, loadCaseId)) {
    return undefined;
  }
  const loadCase = result.loadCases[loadCaseId];
  if (!loadCase) {
    return undefined;
  }
  const n = stationCount(stations);
  const lookup = lookupOf(model, loadCaseId, true);
  const points = new Float64Array(3 * n * model.members.length);
  const six = new Float64Array(6);
  const global = new Float64Array(3);
  for (let m = 0; m < model.members.length; m++) {
    const member = model.members[m] as Member;
    if (
      !Object.hasOwn(loadCase.memberEndForces, member.id) ||
      !Object.hasOwn(loadCase.displacements, member.startNodeId) ||
      !Object.hasOwn(loadCase.displacements, member.endNodeId)
    ) {
      return undefined;
    }
    const c = context(member, loadCase, lookup);
    if (!c) {
      return undefined;
    }
    const chord = member.kind !== "frame" || hasRelease(member);
    for (let s = 0; s < n; s++) {
      const position = stationPosition(s, n, c.length);
      const t = s === n - 1 ? 1 : s / (n - 1);
      if (chord) {
        for (let k = 0; k < 3; k++) {
          six[k] = (1 - t) * (c.u[k] as number) + t * (c.u[6 + k] as number);
        }
      } else {
        deflectionAt(c, position, true, six);
      }
      toGlobal(c.axes, six, 0, global, 0);
      const to = 3 * (m * n + s);
      // The undeformed point: exactly the start node for s = 0 and the end node for the last s.
      points[to] = (1 - t) * c.origin.x + t * c.end.x + scale * (global[0] as number);
      points[to + 1] = (1 - t) * c.origin.y + t * c.end.y + scale * (global[1] as number);
      points[to + 2] = (1 - t) * c.origin.z + t * c.end.z + scale * (global[2] as number);
    }
  }
  return {
    loadCaseId,
    scale,
    stations: n,
    memberIds: model.members.map((member) => member.id),
    points,
  };
}
