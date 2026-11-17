/**
 * Member geometry: the length of a member and its local axes. This file is the one place the local
 * axis convention is defined; the README repeats it in words.
 *
 * Convention (global axes right-handed, Z up):
 * - Local x is the unit vector from the start node to the end node.
 * - A member is "vertical" when the horizontal projection of its length is at most
 *   `VERTICAL_TOLERANCE` times its length.
 * - Not vertical, roll 0: local y is horizontal, the unit vector along (global Z) × (local x);
 *   local z = (local x) × (local y), which lies in the vertical plane through the member and has a
 *   positive global Z component. A member along global +X has its local axes equal to the global axes.
 * - Vertical, roll 0: local y is global +Y (made exactly perpendicular to local x), and
 *   local z = (local x) × (local y): global -X for a member that runs upward, global +X for one that
 *   runs downward.
 * - The roll angle rotates local y and z together about local x by the right-hand rule
 *   (counter-clockwise when seen from the end node looking back at the start node):
 *   y = y0 cos(roll) + z0 sin(roll), z = -y0 sin(roll) + z0 cos(roll).
 *
 * For a frame in the global X-Z plane whose columns run upward and whose beams run along +X, every
 * member with roll 0 has local y = global +Y, so in-plane bending is about local y and uses `Iy`.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface LocalAxes {
  x: Vec3;
  y: Vec3;
  z: Vec3;
}

/** A member shorter than this, in m, is reported by `validateModel` as `zero-length-member`. */
export const ZERO_LENGTH_TOLERANCE = 1e-9;

/** See the convention above: the limit of (horizontal projection) / (length) for a vertical member. */
export const VERTICAL_TOLERANCE = 1e-9;

/** The distance between two points, in the unit of their coordinates. */
export function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function unit(v: Vec3): Vec3 {
  const n = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / n, y: v.y / n, z: v.z / n };
}

function combine(a: Vec3, ka: number, b: Vec3, kb: number): Vec3 {
  return { x: a.x * ka + b.x * kb, y: a.y * ka + b.y * kb, z: a.z * ka + b.z * kb };
}

/**
 * The local axes of a member as unit vectors in global coordinates, by the convention at the top of
 * this file.
 *
 * @param start - the start node's position
 * @param end - the end node's position
 * @param rollAngleDeg - the member's roll angle, in degrees
 * @returns the three axes, or `undefined` when the two points are closer than `ZERO_LENGTH_TOLERANCE`
 *   or a coordinate is not a finite number
 */
export function memberLocalAxes(
  start: Vec3,
  end: Vec3,
  rollAngleDeg: number,
): LocalAxes | undefined {
  const length = distance(start, end);
  if (!(length >= ZERO_LENGTH_TOLERANCE) || !Number.isFinite(length)) {
    return undefined;
  }
  const x: Vec3 = {
    x: (end.x - start.x) / length,
    y: (end.y - start.y) / length,
    z: (end.z - start.z) / length,
  };
  let y0: Vec3;
  let z0: Vec3;
  if (Math.hypot(x.x, x.y) <= VERTICAL_TOLERANCE) {
    z0 = unit(cross(x, { x: 0, y: 1, z: 0 }));
    y0 = cross(z0, x);
  } else {
    y0 = unit(cross({ x: 0, y: 0, z: 1 }, x));
    z0 = cross(x, y0);
  }
  const roll = (rollAngleDeg * Math.PI) / 180;
  const c = Math.cos(roll);
  const s = Math.sin(roll);
  return { x, y: combine(y0, c, z0, s), z: combine(y0, -s, z0, c) };
}
