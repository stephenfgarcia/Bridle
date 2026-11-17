/**
 * The 3D frame element: its stiffness matrix in local axes, its transformation to global axes, and
 * its stiffness matrix in global axes.
 *
 * Theory: a straight, prismatic, linear-elastic member by Euler-Bernoulli beam theory (plane sections
 * stay plane and normal to the axis; no shear deformation), with uniform (St Venant) torsion and
 * small displacements. Axial force, torsion and the two bending planes are uncoupled in local axes,
 * which holds when local y and z are principal axes of the section and the shear centre is at the
 * centroid.
 *
 * Units: the model's (`@bridle/model`): kN and m, so E and G are in kN/m², translations in m,
 * rotations in rad, forces in kN and moments in kN·m.
 *
 * Sign conventions (also in ../README.md; they agree with `@bridle/model`):
 * - Global axes are right-handed with Z up. A member's local axes are the right-handed triad that
 *   `memberLocalAxes` of `@bridle/model` returns: local x from the start node to the end node.
 * - The degrees of freedom of a member are, in this order, ux, uy, uz, rx, ry, rz at the start node
 *   (rows 0 to 5) and the same six at the end node (rows 6 to 11).
 * - A translation is positive along the positive axis. A rotation is positive by the right-hand
 *   rule about the positive axis: thumb along the axis, fingers curl in the positive sense. So a
 *   positive rz turns local x towards local y, and a positive ry turns local z towards local x.
 * - A force is positive along the positive axis and a moment is positive by the right-hand rule,
 *   like the displacement it goes with. The matrix gives the forces and moments that the nodes
 *   apply to the member ends: f = k u. They are end actions in the axis directions at both ends,
 *   not internal forces by a beam sign convention.
 * - All of this is the same in local and in global axes; only the triad differs.
 *
 * Derivation of the bending terms and of their signs. Take one bending plane, a transverse
 * deflection d(x) and its slope s = dd/dx, with x from 0 at the start to L at the end. With no load
 * between the ends, EI d'''' = 0, so d is a cubic and is fixed by the end values (d1, s1, d2, s2)
 * through the Hermite shape functions (t = x/L):
 *   N1 = 1 - 3t² + 2t³,  N2 = L (t - 2t² + t³),  N3 = 3t² - 2t³,  N4 = L (-t² + t³).
 * The strain energy is U = ½ ∫ EI (d'')² dx, so the stiffness is k_ij = ∫ EI N_i'' N_j'' dx, which
 * gives, for (d1, s1, d2, s2):
 *   EI/L³ · [  12    6L   -12    6L  ]
 *           [  6L   4L²   -6L   2L²  ]
 *           [ -12   -6L    12   -6L  ]
 *           [  6L   2L²   -6L   4L²  ]
 * (for example k_12 = EI/L² ∫₀¹ (-6 + 12t)(-4 + 6t) dt = EI/L² (24 - 42 + 24) = 6EI/L²).
 *
 * What remains is how the slope relates to the rotation, and that differs between the two planes.
 * A small rotation θ moves the point r = (x, 0, 0) of the axis by θ × r = (0, θz·x, -θy·x):
 * - Local x-y plane (deflection uy, bending about local z, stiffness E·Iz): duy/dx = +rz. The slope
 *   is the rotation, so the matrix above applies as it is to (uy1, rz1, uy2, rz2).
 * - Local x-z plane (deflection uz, bending about local y, stiffness E·Iy): duz/dx = -ry. The slope
 *   is minus the rotation, so in terms of (uz1, ry1, uz2, ry2) every term that couples a deflection
 *   with a rotation changes sign, and the terms deflection-deflection and rotation-rotation do not.
 * So the uy-rz terms are +6EIz/L² at the start node and the uz-ry terms are -6EIy/L² there.
 * `elementStiffnessLocal` is written the same way: one plane-bending matrix in (d, s), placed twice
 * with the slope sign +1 and -1.
 *
 * Axial and torsion: with linear shape functions, ∫ EA N_i' N_j' dx gives EA/L · [1 -1; -1 1] for
 * (ux1, ux2), and GJ/L · [1 -1; -1 1] for (rx1, rx2).
 */
import type { LocalAxes } from "@bridle/model";
import { type Matrix, multiply, transpose, zeros } from "./matrix";

/** The number of degrees of freedom of one element: six at each of its two nodes. */
export const ELEMENT_DOFS = 12;

/** The rows of the local element matrix, by name. */
export const LOCAL_DOF = {
  ux1: 0,
  uy1: 1,
  uz1: 2,
  rx1: 3,
  ry1: 4,
  rz1: 5,
  ux2: 6,
  uy2: 7,
  uz2: 8,
  rx2: 9,
  ry2: 10,
  rz2: 11,
} as const;

/** What the local stiffness matrix of one element is computed from, in the model's units. */
export interface ElementProperties {
  /** Modulus of elasticity, kN/m². */
  E: number;
  /** Shear modulus, kN/m². */
  G: number;
  /** Area, m². */
  A: number;
  /** Second moment of area about local y, m⁴ (bending in the local x-z plane). */
  Iy: number;
  /** Second moment of area about local z, m⁴ (bending in the local x-y plane). */
  Iz: number;
  /** Torsion constant, m⁴. */
  J: number;
  /** Length of the element, m. */
  length: number;
}

/**
 * The stiffness of one bending plane for (deflection at start, slope at start, deflection at end,
 * slope at end); see the derivation at the top of this file.
 */
function planeBending(EI: number, L: number): number[][] {
  const a = (12 * EI) / L ** 3;
  const b = (6 * EI) / L ** 2;
  const c = (4 * EI) / L;
  const d = (2 * EI) / L;
  return [
    [a, b, -a, b],
    [b, c, -b, d],
    [-a, -b, a, -b],
    [b, d, -b, c],
  ];
}

/**
 * Places a 4 by 4 or 2 by 2 block into the element matrix: block row `i` belongs to element row
 * `rows[i]`, and a block row whose degree of freedom has the opposite sense is given `signs[i]` = -1.
 */
function place(
  k: Matrix,
  block: readonly (readonly number[])[],
  rows: readonly number[],
  signs: readonly number[],
): void {
  block.forEach((blockRow, i) => {
    blockRow.forEach((value, j) => {
      const row = rows[i] as number;
      const col = rows[j] as number;
      k.data[row * k.cols + col] = (signs[i] as number) * (signs[j] as number) * value;
    });
  });
}

/**
 * The 12 by 12 stiffness matrix of a 3D frame element in its local axes, in kN/m, kN (per rad) and
 * kN·m (per rad). Degrees of freedom: ux, uy, uz, rx, ry, rz at the start node, then at the end node.
 * The theory, the units and the sign conventions are at the top of this file.
 *
 * The inputs are not checked here: `assemble` passes values that `validateModel` has found positive.
 * The result is exactly symmetric (entry (i, j) and entry (j, i) are the same number).
 */
export function elementStiffnessLocal(p: ElementProperties): Matrix {
  const k = zeros(ELEMENT_DOFS, ELEMENT_DOFS);
  const L = p.length;
  const D = LOCAL_DOF;

  const axial = (p.E * p.A) / L;
  place(
    k,
    [
      [axial, -axial],
      [-axial, axial],
    ],
    [D.ux1, D.ux2],
    [1, 1],
  );

  const torsion = (p.G * p.J) / L;
  place(
    k,
    [
      [torsion, -torsion],
      [-torsion, torsion],
    ],
    [D.rx1, D.rx2],
    [1, 1],
  );

  // Bending about local z, in the local x-y plane: the slope duy/dx is +rz.
  place(k, planeBending(p.E * p.Iz, L), [D.uy1, D.rz1, D.uy2, D.rz2], [1, 1, 1, 1]);

  // Bending about local y, in the local x-z plane: the slope duz/dx is -ry.
  place(k, planeBending(p.E * p.Iy, L), [D.uz1, D.ry1, D.uz2, D.ry2], [1, -1, 1, -1]);

  return k;
}

/**
 * The 12 by 12 transformation T of an element from global to local axes: u_local = T u_global and
 * f_local = T f_global, for the twelve degrees of freedom in the order of `elementStiffnessLocal`.
 *
 * T has the same 3 by 3 block R four times on its diagonal (start translations, start rotations, end
 * translations, end rotations). The rows of R are the local x, y and z unit vectors written in
 * global coordinates, so R times a global vector gives its components along the local axes. For
 * the orthonormal triad that `memberLocalAxes` returns, R and T are orthogonal: the inverse of T is
 * its transpose.
 *
 * @param axes - the member's local axes as unit vectors in global coordinates (`memberLocalAxes`)
 */
export function elementTransformation(axes: LocalAxes): Matrix {
  const t = zeros(ELEMENT_DOFS, ELEMENT_DOFS);
  const r = [
    [axes.x.x, axes.x.y, axes.x.z],
    [axes.y.x, axes.y.y, axes.y.z],
    [axes.z.x, axes.z.y, axes.z.z],
  ];
  for (let block = 0; block < 4; block++) {
    r.forEach((row, i) => {
      row.forEach((value, j) => {
        t.data[(3 * block + i) * t.cols + 3 * block + j] = value;
      });
    });
  }
  return t;
}

/**
 * The element stiffness matrix in global axes: Tᵀ k T, where `kLocal` is the matrix of
 * `elementStiffnessLocal` and `transformation` is the matrix of `elementTransformation`. Its rows are
 * the global ux, uy, uz, rx, ry, rz of the start node, then of the end node.
 *
 * (From f_local = k u_local, u_local = T u_global and f_global = Tᵀ f_local.) The product is
 * computed in floating point, so the result is symmetric up to rounding, not exactly.
 */
export function elementStiffnessGlobal(kLocal: Matrix, transformation: Matrix): Matrix {
  return multiply(multiply(transpose(transformation), kLocal), transformation);
}
