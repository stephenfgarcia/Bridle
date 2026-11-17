/**
 * Member loads: the equivalent nodal loads of a uniform load and of a point load on a member, in the
 * member's local axes. `solve` (./solve.ts) adds them to the load vector and subtracts them again
 * when it computes the member end forces.
 *
 * Units and signs are those of ./element.ts: kN and m; a force is positive along the positive local
 * axis and a moment is positive by the right-hand rule about it; the twelve components are in the
 * order ux, uy, uz, rx, ry, rz at the start node and then at the end node (`LOCAL_DOF`).
 *
 * What "equivalent nodal loads" means. The element of ./element.ts knows a member only through its
 * twelve end displacements. A load between the ends is replaced by twelve loads Q on the two nodes,
 * chosen so that the nodes move exactly as they would under the real load. For the load case the
 * solver then solves K u = F + (the Q of all members), and the forces and moments that the nodes
 * apply to the ends of a member are
 *
 *   f = k u - Q                                   (local axes; `solve` reports them)
 *
 * With every end displacement zero (a member fixed at both ends) this is f = -Q: the fixed-end
 * forces are the equivalent nodal loads with the opposite sign.
 *
 * Derivation, from the package's own convention and not from a table. Take one bending plane with a
 * transverse deflection d(x) and slope s = dd/dx, as in ./element.ts, and its Hermite shape functions
 * (t = x/L):
 *   N1 = 1 - 3t² + 2t³,  N2 = L (t - 2t² + t³),  N3 = 3t² - 2t³,  N4 = L (-t² + t³).
 * N_i is the deflected shape of the member with no load between its ends when the i-th of
 * (d1, s1, d2, s2) is 1 and the other three are 0, and it is the exact shape, because an unloaded
 * prismatic Euler-Bernoulli member deflects as a cubic. Now compare two states of the same member:
 *   state A: that unit end displacement, no load between the ends;
 *   state B: both ends fixed, the load q(x) per unit length between them, end actions F1..F4 (the
 *            fixed-end forces, conjugate to d1, s1, d2, s2).
 * By Betti's reciprocal theorem the forces of A do the same work on the displacements of B as the
 * forces of B on the displacements of A. The first is zero: A has forces only at the ends, and the
 * ends of B do not move. The second is F_i · 1 + ∫ q N_i dx. So
 *
 *   F_i = -∫ q N_i dx,   and   Q_i = -F_i = ∫ q(x) N_i(x) dx   (the consistent nodal loads).
 *
 * The same holds for the axial direction with the linear functions M1 = 1 - t, M2 = t, which are
 * the exact shapes of an unloaded bar.
 *
 * The weights. For a uniform load of intensity w over the whole length, Q_i = w ∫₀ᴸ N_i dx:
 *   ∫N1 = L/2,  ∫N2 = L²/12,  ∫N3 = L/2,  ∫N4 = -L²/12;   ∫M1 = ∫M2 = L/2.
 * For a point load P at x = a (b = L - a), Q_i = P N_i(a):
 *   N1(a) = b²(3a + b)/L³,  N2(a) = a b²/L²,  N3(a) = a²(a + 3b)/L³,  N4(a) = -a² b/L²;
 *   M1(a) = b/L,  M2(a) = a/L.
 * These are the textbook fixed-end values: shears wL/2 and moments wL²/12; shears Pb²(3a + b)/L³ and
 * Pa²(a + 3b)/L³ and moments Pab²/L² and Pa²b/L².
 *
 * From (d, s) to the package's degrees of freedom, where the two bending planes differ. Q2 and Q4
 * are conjugate to the slope: they do the work Q · s.
 * - Local x-y plane (load along local y, deflection uy): s = +rz (./element.ts), so the work is
 *   Q · rz and the moment about local z is +Q. A load along +y gives Mz = +(weight 2) at the start
 *   and +(weight 4), a negative number, at the end.
 * - Local x-z plane (load along local z, deflection uz): s = -ry, so the work is Q · (-ry) and the
 *   moment about local y is -Q. A load along +z gives My = -(weight 2) at the start and
 *   -(weight 4), a positive number, at the end.
 * A check by statics: a load along +z at x > 0 has the moment (x, 0, 0) × (0, 0, P) = (0, -x P, 0)
 * about the start node, negative about y, and the equivalent moment at the start is negative too.
 *
 * So, for a load with the local components (px, py, pz), with h1..h4 and m1, m2 the weights above:
 *   start: ux = px m1,  uy = py h1,  uz = pz h1,  rx = 0,  ry = -pz h2,  rz = +py h2
 *   end:   ux = px m2,  uy = py h3,  uz = pz h3,  rx = 0,  ry = -pz h4,  rz = +py h4
 * A load acts on the member's axis (through the shear centre), so it gives no torque.
 *
 * A load given in global axes is resolved first: the force (or the force per unit of the member's
 * own length) along the global axis is a vector, and its local components are its dot products with
 * the local x, y and z unit vectors. A global vertical load on an inclined member therefore has an
 * axial and a transverse part, and its total is the value times the member's length, not times its
 * horizontal projection.
 */
import type { LocalAxes, MemberPointLoad, MemberUniformLoad, Vec3 } from "@bridle/model";
import { ELEMENT_DOFS, LOCAL_DOF } from "./element";

/** A load on a member: uniform over its whole length, or a force at one point. */
export type MemberLoad = MemberUniformLoad | MemberPointLoad;

/** Whether a member load is a point load (it has a `position`) and not a uniform load. */
export function isMemberPointLoad(load: MemberLoad): load is MemberPointLoad {
  return "position" in load;
}

/**
 * The components of a member load's value along the member's local x, y and z: kN/m for a uniform
 * load, kN for a point load. For `axes: "local"` the value is on the axis that `direction` names.
 * For `axes: "global"` the value lies along that global axis and each local component is the value
 * times that global component of the local axis.
 *
 * @param load - the member load
 * @param axes - the member's local axes as unit vectors in global coordinates (`memberLocalAxes`)
 */
export function memberLoadLocalComponents(
  load: MemberLoad,
  axes: LocalAxes,
): [px: number, py: number, pz: number] {
  const { direction, value } = load;
  if (load.axes === "local") {
    return [
      direction === "x" ? value : 0,
      direction === "y" ? value : 0,
      direction === "z" ? value : 0,
    ];
  }
  // The "+ 0" turns a negative zero (a negative value times a zero component) into zero.
  const along = (axis: Vec3): number => value * axis[direction] + 0;
  return [along(axes.x), along(axes.y), along(axes.z)];
}

/**
 * The equivalent nodal loads of one member load, in the member's local axes: twelve numbers in the
 * order of `LOCAL_DOF` (forces in kN, moments in kN·m), by the derivation at the top of this file.
 * They are the fixed-end forces of the load with the opposite sign.
 *
 * A point load's `position` is the distance from the start node; a position below 0 is taken as 0
 * and one beyond the length as the length (`validateModel` allows 1e-9 m of slack past either end).
 * A point load at an end gives that force on that node and nothing else.
 *
 * The inputs are not checked: `solve` passes loads and members that `validateModel` has accepted.
 *
 * @param load - a uniform load or a point load of the member
 * @param length - the member's length, m
 * @param axes - the member's local axes as unit vectors in global coordinates (`memberLocalAxes`)
 */
export function equivalentNodalLoadsLocal(
  load: MemberLoad,
  length: number,
  axes: LocalAxes,
): Float64Array {
  const L = length;
  // The weights of the derivation: h1..h4 for a transverse load, m1 and m2 for an axial load.
  let h1: number;
  let h2: number;
  let h3: number;
  let h4: number;
  let m1: number;
  let m2: number;
  if (isMemberPointLoad(load)) {
    const a = Math.min(Math.max(load.position, 0), L);
    const b = L - a;
    h1 = (b * b * (3 * a + b)) / L ** 3;
    h2 = (a * b * b) / L ** 2;
    h3 = (a * a * (a + 3 * b)) / L ** 3;
    h4 = (-a * a * b) / L ** 2;
    m1 = b / L;
    m2 = a / L;
  } else {
    h1 = L / 2;
    h2 = L ** 2 / 12;
    h3 = L / 2;
    h4 = -(L ** 2) / 12;
    m1 = L / 2;
    m2 = L / 2;
  }
  const [px, py, pz] = memberLoadLocalComponents(load, axes);
  const D = LOCAL_DOF;
  const q = new Float64Array(ELEMENT_DOFS);
  q[D.ux1] = px * m1;
  q[D.ux2] = px * m2;
  // Local x-y plane: the slope duy/dx is +rz, so the moment about z is +(the slope's load).
  q[D.uy1] = py * h1;
  q[D.rz1] = py * h2;
  q[D.uy2] = py * h3;
  q[D.rz2] = py * h4;
  // Local x-z plane: the slope duz/dx is -ry, so the moment about y is -(the slope's load).
  q[D.uz1] = pz * h1;
  q[D.ry1] = -(pz * h2);
  q[D.uz2] = pz * h3;
  q[D.ry2] = -(pz * h4);
  for (let i = 0; i < ELEMENT_DOFS; i++) {
    q[i] = (q[i] as number) + 0; // a negative zero becomes zero
  }
  return q;
}
