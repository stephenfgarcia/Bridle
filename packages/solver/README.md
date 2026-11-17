# @bridle/solver

The linear-elastic 3D frame solver of the showcase (`docs/plan/pitch-plan.md`). So far it has the work of
pitch cards S2 and S3: the stiffness matrix of a 3D frame element in local axes, its transformation to global
axes, the assembly of the global stiffness matrix of a model, and `solve`, which applies the supports and the
nodal loads of each load case and returns the displacements of the nodes and the reactions at the supports.

Not yet: member loads (card S4), truss members and member end releases (card S5), member end forces and
values along a member (cards S4 and S6). `solve` refuses a model that has any of the first three.

Plain TypeScript; the one runtime dependency is `@bridle/model`. The functions are pure and keep no state
between calls, and the source uses no browser or Node API.

```ts
import { memberLocalAxes, portalFrame } from "@bridle/model";
import {
  assemble,
  dofIndex,
  elementStiffnessGlobal,
  elementStiffnessLocal,
  elementTransformation,
  solve,
} from "@bridle/solver";

// One element: E, G in kN/m², A in m², Iy, Iz, J in m⁴, length in m.
const k = elementStiffnessLocal({
  E: 2.1e8,
  G: 8.1e7,
  A: 5.4e-3,
  Iy: 8.4e-5,
  Iz: 6e-6,
  J: 2e-7,
  length: 4,
});
const axes = memberLocalAxes({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 4 }, 0);
if (axes) {
  const kGlobal = elementStiffnessGlobal(k, elementTransformation(axes)); // Tᵀ k T
}

// A whole model.
const result = assemble(portalFrame());
if (result.ok) {
  const row = dofIndex(result.dofMap, "n2", "ux"); // 6: node n2 is second, ux is its first row
  result.stiffness; // 24 by 24, dense, row-major Float64Array in `data`
}

// Solve it: the portal frame fixture has one load case, `lc1`, with 20 kN along +X on node n2.
const solved = solve(portalFrame());
if (solved.ok) {
  const lc1 = solved.loadCases.lc1;
  lc1?.displacements.n2?.ux; // the sway of node n2, in m
  lc1?.reactions.n1?.my; // the moment the support at n1 applies to the frame, in kN·m
} else {
  solved.reason; // "invalid-model", "not-supported-yet", "unstable" or "non-finite"
}
```

Run the tests with `pnpm --filter @bridle/solver test`, the type check with
`pnpm --filter @bridle/solver typecheck`; `pnpm check` runs both through turbo.

## Theory and limits

- A straight, prismatic, linear-elastic member by **Euler-Bernoulli beam theory**: plane sections stay plane
  and normal to the member's axis. **Shear deformation is not included** (this is not a Timoshenko element).
- Torsion is uniform (St Venant) torsion with stiffness GJ/L; warping is not included.
- Small displacements; no geometric (P-delta) stiffness.
- Axial force, torsion and the two bending planes are uncoupled in local axes. That holds when local y and z
  are principal axes of the section and the shear centre is at the centroid.

## Units

The model's (`packages/model/README.md`): forces in kN, lengths in m, so E and G are in kN/m², areas in m²,
second moments of area and the torsion constant in m⁴. Translations are in m and rotations in rad. A
stiffness entry is in kN/m (force per translation), kN (force per rotation, or moment per translation) or
kN·m (moment per rotation). The roll angle of a member is in degrees, as in the model.

## Sign conventions

Written once here and in the header of `src/element.ts`. They agree with `packages/model`.

- **Axes.** Global axes are right-handed with Z up. A member's local axes are the right-handed triad that
  `memberLocalAxes` of `@bridle/model` returns: local x runs from the start node to the end node; the rule for
  local y and z and for the roll angle is in `packages/model/src/geometry.ts`. `Iy` and `Iz` are second moments
  of area about local y and local z: `Iz` resists bending in the local x-y plane, `Iy` in the local x-z plane.
- **Degrees of freedom.** Six per node, in this order: `ux`, `uy`, `uz`, `rx`, `ry`, `rz`. An element has
  twelve: the six of its start node (rows 0 to 5), then the six of its end node (rows 6 to 11).
- **Displacements.** A translation is positive along the positive axis. A rotation is positive by the
  right-hand rule about the positive axis (thumb along the axis, fingers curl in the positive sense). So a
  positive rotation about z turns x towards y, and a positive rotation about y turns z towards x.
- **Forces and moments.** A force is positive along the positive axis and a moment is positive by the
  right-hand rule about it, like the displacement it goes with. The element matrix gives the forces and
  moments that the nodes apply to the member's ends, f = k u, in the axis directions at both ends. They are
  not internal forces by a beam sign convention (card S6 derives those).
- **Local and global.** The same rules hold in local and in global axes; only the triad differs. Global
  rotations and moments follow the right-hand rule about global X, Y, Z, as the model's `NodalLoad` says.

### What the convention does to the bending terms

A small rotation θ moves the point (x, 0, 0) of the member's axis by θ × r = (0, θz·x, −θy·x). So:

- in the local x-y plane the slope of the deflection is the rotation: d(uy)/dx = +rz;
- in the local x-z plane the slope of the deflection is minus the rotation: d(uz)/dx = −ry.

The stiffness of one bending plane in terms of deflection and slope is the same in both planes (derived in
the header of `src/element.ts` from the cubic shape functions). Because of the minus sign above, every term
that couples a deflection with a rotation has opposite signs in the two planes:

| Term                                                 | x-y plane (uy, rz, E·Iz) | x-z plane (uz, ry, E·Iy) |
| ---------------------------------------------------- | ------------------------ | ------------------------ |
| deflection at start with rotation at start or end    | +6EIz/L²                 | −6EIy/L²                 |
| deflection at end with rotation at start or end      | −6EIz/L²                 | +6EIy/L²                 |
| deflection with deflection, same end / opposite ends | +12EIz/L³ / −12EIz/L³    | +12EIy/L³ / −12EIy/L³    |
| rotation with rotation, same end / opposite ends     | +4EIz/L / +2EIz/L        | +4EIy/L / +2EIy/L        |

Axial: +EA/L on the diagonal of `ux` and −EA/L between the two ends. Torsion: +GJ/L on the diagonal of `rx`
and −GJ/L between the two ends.

## Functions

| Function                                                                                            | What it returns                                                                                                                        |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `elementStiffnessLocal(properties)`                                                                 | The 12 by 12 stiffness matrix in local axes. Inputs are not checked.                                                                   |
| `elementTransformation(axes)`                                                                       | The 12 by 12 matrix T with u_local = T u_global: four copies of the 3 by 3 matrix whose rows are the local x, y, z unit vectors.       |
| `elementStiffnessGlobal(kLocal, T)`                                                                 | Tᵀ k T, the element matrix in global axes.                                                                                             |
| `assemble(model)`                                                                                   | The global stiffness matrix, the degree-of-freedom map and one `MemberElement` per member, or a refusal (below).                       |
| `solve(model)`                                                                                      | Per load case, the displacements of the nodes and the reactions at the supports, or a refusal (below).                                 |
| `factorize(matrix, relativeThreshold)`, `solveFactorized(factorization, b)`                         | The symmetric factorization L D Lᵀ that `solve` uses, and the solution of a system with it.                                            |
| `unsupportedMembers(model)`                                                                         | The members `assemble` refuses as not supported yet.                                                                                   |
| `buildDofMap(nodes)`, `dofIndex(map, nodeId, dof)`, `memberDofIndices(map, startNodeId, endNodeId)` | The numbering of the global rows.                                                                                                      |
| `PIVOT_THRESHOLD`, `REACTION_COMPONENTS`                                                            | The threshold of the instability test (below) and the names `fx`, `fy`, `fz`, `mx`, `my`, `mz` in the order of the degrees of freedom. |
| `zeros`, `fromRows`, `at`, `addAt`, `transpose`, `multiply`, `multiplyVector`, `maxAbs`             | Helpers for the `Matrix` type.                                                                                                         |

### The matrix type

`Matrix` is `{ rows, cols, data }` with `data` a `Float64Array` in row-major order: the entry of row `i` and
column `j` is `data[i * cols + j]`. Storage is dense.

### The degree-of-freedom map

`DofMap` is `{ nodeIds, nodeIndex, size }`. The nodes are in the model's order; node number `n` (from 0) owns
rows `6n` to `6n + 5` of the global matrix, in the order `ux`, `uy`, `uz`, `rx`, `ry`, `rz`, in global axes.
`dofIndex(map, nodeId, dof)` gives the row, or `undefined` for a node the map does not have.

### `assemble(model)`

Returns one of:

- `{ ok: true, stiffness, dofMap, elements }`. `stiffness` is square, of size six times the number of nodes.
  No support is applied, so it is the matrix of the free structure and is singular. `elements` has, for
  each member in the model's order, its id, length, local axes, local matrix, transformation and its twelve
  global rows; later cards compute member results from these.
- `{ ok: false, reason: "invalid-model", issues }` when `validateModel` of `@bridle/model` reports issues;
  `issues` is its list.
- `{ ok: false, reason: "not-supported-yet", unsupported }` when the model is valid but has a member of kind
  `truss` (`feature: "truss-member"`) or a member with any end release (`feature: "end-release"`).
  **Truss members and end releases are not supported yet**; card S5 adds them.

`validateModel` reports a number of the model that is not finite (`non-finite-value`), so such a model is
refused as `invalid-model`. `assemble` does not check the entries of the matrix: finite numbers whose product
overflows a double (E times A, for example) give entries that are not finite. `solve` checks for that.

The element matrix in global axes, and so the assembled matrix, is symmetric up to floating-point rounding
of the product Tᵀ k T, not always exactly; the local matrix is exactly symmetric.

### `solve(model)`

For each load case of the model, `solve` finds the displacements of the nodes and the reactions at the
supports. It does not change the model and keeps no state between calls.

What it does:

1. It calls `assemble`, which gives the stiffness matrix K of the structure without supports (six rows per
   node). The refusals of `assemble` are passed on.
2. **Supports.** A degree of freedom that a `Support` restrains (a flag that is `true`) has the displacement
   zero. There are no prescribed displacements and no spring supports. The other degrees of freedom are
   free; the reduced matrix is K without the rows and columns of the restrained ones.
3. **Factorization.** The reduced matrix is factorized once, as L D Lᵀ with symmetric pivoting (below),
   which is also the check for instability (below). The factorization is used for every load case.
4. **Loads.** For a load case, the load vector f has, at each degree of freedom, the sum of the components
   of the case's nodal loads on that node (`fx`, `fy`, `fz`, `mx`, `my`, `mz` go to `ux`, `uy`, `uz`, `rx`,
   `ry`, `rz`). The free displacements are the solution of (reduced K) u = (free rows of f).
5. **Reactions.** The reactions are the restrained rows of K u − f, computed with the whole matrix K as
   `assemble` returned it, not with the reduced matrix. So a load applied directly on a restrained degree of
   freedom appears in that reaction with the opposite sign.
6. **Sensitivity.** A number that indicates how much rounding in K could matter to the result is computed
   for the load case and reported with it (below). `solve` does not act on it.

`solve` returns one of:

- `{ ok: true, nodeIds, loadCases }`: `loadCases` has one `LoadCaseResult` per load case of the model, under
  the load case's id. A model with no load case gives an empty `loadCases`; it is still checked for
  instability.
- `{ ok: false, reason: "invalid-model", issues }`: the issues of `validateModel`. A model with no support
  is refused here (`no-support`).
- `{ ok: false, reason: "not-supported-yet", unsupported }`: the entries of `assemble` for truss members and
  end releases (`{ memberId, feature }`), then one `{ loadId, memberId, feature: "member-load" }` for each
  entry of `memberUniformLoads` and then of `memberPointLoads`, whatever its load case. **Member loads are
  not supported yet**; card S4 adds them.
- `{ ok: false, reason: "unstable", nodeId, dof, pivot, diagonal, threshold, remaining }`: see "The
  instability test".
- `{ ok: false, reason: "non-finite", where: "stiffness" }` when an entry of K is not a finite number, and
  `{ ok: false, reason: "non-finite", where: "load-case", loadCaseId }` when a displacement or a reaction of
  that load case is not (numbers so large that a product overflows a double).

#### The result of a load case

| Field                | Content                                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `loadCaseId`         | The load case's id.                                                                                                              |
| `displacements`      | An object with one entry per node of the model, under the node's id: `{ ux, uy, uz, rx, ry, rz }`.                               |
| `reactions`          | An object with one entry per support of the model, under the support's node id: `{ fx, fy, fz, mx, my, mz }`.                    |
| `displacementVector` | A `Float64Array` with the same displacements: six numbers per node, nodes in the order of `nodeIds`, `ux` to `rz` within a node. |
| `reactionVector`     | A `Float64Array` with the same reactions in the same order (`fx` to `mz` within a node); 0 in every row no support restrains.    |
| `sensitivity`        | The number of "The sensitivity of a result".                                                                                     |

`nodeIds` of the result is the list of node ids in the model's order.

**Units.** Translations `ux`, `uy`, `uz` are in m; rotations `rx`, `ry`, `rz` are in rad. Reaction forces
`fx`, `fy`, `fz` are in kN; reaction moments `mx`, `my`, `mz` are in kN·m.

**Signs.** Everything is in the global axes, by the conventions above:

- A displacement is positive along the positive global axis; a rotation is positive by the right-hand rule
  about it. A node that sinks has a negative `uz`.
- A reaction is the force and the moment that the support applies to the structure, positive along and
  about the positive global axes, like a nodal load. A support that carries a downward load has a positive
  `fz`. For a cantilever along +X fixed at its start with a downward force P at its tip (length L), the
  reaction is `fz` = +P and `my` = −P·L.
- For each load case the nodal loads and the reactions together are in equilibrium: their forces sum to
  zero and their moments about any point sum to zero, up to rounding.
- A component of a reaction that its support does not restrain is exactly 0. A support that restrains
  nothing still has an entry, of six zeros.

**Plain data.** A result holds objects, arrays, strings, numbers, booleans and, per load case, two
`Float64Array`s: no function, no `Map` and no class instance. A test checks that `structuredClone` of a
result (the copy a Web Worker message makes) equals the result. `JSON.stringify` does not keep a
`Float64Array` as an array; the records `displacements` and `reactions` hold the same numbers as plain
objects. The order of the keys of a record is not part of the result (JavaScript lists keys that look like
whole numbers first); use `nodeIds` for the order of the nodes.

#### The factorization

`factorize` computes P A Pᵀ = L D Lᵀ (L unit lower triangular, D diagonal, P a reordering of the rows and
columns), written in `src/factor.ts`. It works on a dense matrix and indexes the `Float64Array` directly.

- The assembled matrix is symmetric only up to rounding, so `factorize` first makes it exactly symmetric:
  each entry below the diagonal is the average of the two entries that mirror each other. It factorizes
  that lower triangle.
- The entries of D are the pivots. The pivot of a degree of freedom is its stiffness when the degrees of
  freedom eliminated before it are free to move and all the others are held. Its **ratio** is the pivot
  divided by its diagonal entry of K (its stiffness when every other degree of freedom is held); the ratio
  is 1 before anything is eliminated and can only fall, in exact arithmetic, as more is eliminated.
- **Symmetric pivoting.** The order of elimination is not the order of the nodes. At each step `factorize`
  eliminates, of the degrees of freedom that are left, the one with the largest ratio; among equal ratios,
  the one that comes first in the model's order (nodes in the model's order, `ux` to `rz` within a node,
  restrained ones left out). `solveFactorized` reorders the right-hand side, solves with L, D and Lᵀ, and
  puts the solution back in the model's order.
- The update of one step costs about half the square of the number of nonzero entries in the column that
  is eliminated; each step also scans the diagonal entries that are left.

#### The instability test

A structure that its supports hold has a positive definite reduced matrix, and then every pivot is
positive, in any order of elimination. The factorization stops when, of the degrees of freedom that are
left, even the largest ratio is not above the threshold:

    largest ratio left ≤ PIVOT_THRESHOLD,   PIVOT_THRESHOLD = 1e-12.

`solve` then returns `unstable` and solves nothing. The result names the degree of freedom that had that
largest ratio (`nodeId` and `dof`: `ux`, `uy`, `uz`, `rx`, `ry` or `rz`; the first in the model's order
among equals), its `pivot`, its `diagonal` entry of K, the `threshold`, and `remaining`: how many degrees of
freedom were not eliminated.

What the named degree of freedom means: it is where the elimination stopped, not a diagnosis. With the
degrees of freedom eliminated before it free to move, the structure moves there without resistance, as
far as the test can tell, and so it does at the others that remain. A mechanism usually involves several
degrees of freedom on several nodes; which of them is left last depends on the stiffness terms. For a
beam free to spin about its own axis the tests find a rotation of one of its nodes; for a node that no
member connects, the `ux` of that node, with `remaining` = 6.

Why a ratio to the degree of freedom's own diagonal entry: the entries of K differ by several orders of
magnitude by nature (for the fixtures' section a torsion term G·J/L is a few kN·m and an axial term E·A/L
is of the order of 1e5 kN/m), and translations and rotations have different units, so one absolute
threshold, or one relative to the largest entry of the matrix, would compare unlike quantities. The ratio
has no unit and does not change when the units of force or length change. A degree of freedom with no
stiffness at all (a node that no member connects) has a diagonal entry of 0; its ratio is taken as 0.

Why the largest ratio left, and not the pivots in the order of the nodes: a pivot that is small but real
makes the pivots after it inaccurate, because they are divided by it. A beam pinned at both ends that is
nearly, but not exactly, parallel to a global axis is free to spin, and in the order of the nodes the
last-but-one rotation has a small real pivot; the rounding it leaves in the last pivot can be positive and
far above any reasonable threshold. Eliminating the largest ratio first keeps the divisors as large as
they can be, so what is left for a mechanism is rounding of the size of the machine precision.

Why 1e-12: in exact arithmetic a mechanism leaves a ratio of zero; in floating point, zero or a small
number of either sign. The value sits between what the tests of this package measure on the two sides.

- Unstable models: in every one of them the pivot that is left is at most 1e-13 of its diagonal entry in
  size, a tenth of the threshold. The tests: a beam along X free to slide or to spin (the pivot left is
  exactly 0); a skew beam free to spin; four nearly level beams pinned at both ends (a rise of 0.1 mm over
  10 m along X; rises of 5 mm and of 4 mm over plan diagonals of 14 m and 28 m), in both node orders; a
  sweep of 702 beams pinned at both ends with slopes from 1e-7 to 1e-3 against a global axis or a
  direction in plan; 400 random beams of one to three collinear members with four sections; a chain of 200 members; the portal
  frame fixture on two pinned bases; a 96-member space frame pinned along one line of bases, or on one pin
  and two rollers, with its area multiplied by 1, 100, 1e5 and 1e8, with a load, with a load that does not
  move the mechanism and with no load case, in both node orders.
- Stable models that must pass, and do: each of the 702 beams above with one rotation held at one end and
  each of the 400 with the three rotations held at one end (smallest ratio above 1e-6); the 96-member space frame fixed at its bases with its area
  multiplied by up to 1e5; a stepped cantilever whose two segments differ by a factor of 6.4e7 in 12EI/L³,
  in both node orders; a cantilever of 200 elements along a skew line; a frame of 16 mm steel rods 15 m
  high under a concrete girder of 2 m² (smallest ratio above 1e-10); the 4 m by 6 m portal frame with its
  area multiplied by 1e6, 1e8 and 1e10.

The limits of the test, each covered by a test:

- **A stable model is reported as unstable when its stiffness terms differ too much**, and how much is too
  much depends on the geometry. The 4 m by 6 m portal frame solves with its area multiplied by 1e10 and is
  reported `unstable` with 1e12. A portal 30 m high and 2 m wide solves with 1e7 and is reported
  `unstable` with 1e8. A cantilever of 30 m with a stub of 0.1 m at its tip solves when the stub has 1000
  times the second moments of area (and 100 times the area) and is reported `unstable` when it has 10 000
  times. In these results
  the pivot is positive: it is real stiffness, too small against its diagonal entry to be told from
  rounding.
- **A model that is accepted close to the threshold has lost digits.** A ratio r leaves the pivot a
  relative rounding error of the order of ε/r (ε is about 2.2e-16). The 10 m by 10 m portal frame with
  its area multiplied by 1e9 has a smallest ratio between 1e-12 and 1e-11; it solves, and its sway
  differs from the slope-deflection value by more than 1e-6 and less than 1e-4 of it.
- **The ratio falls as a member is cut into more elements.** For a cantilever of n equal elements along a
  global axis the smallest ratio is 1/(4n³) (tested for n = 50, 100 and 200; it is 3.1e-8 for n = 200). By that
  law it would reach 1e-12 near n = 6300; that was not run.
- The test is a numerical test, not a proof. Whether a ratio near the threshold falls on one side or the
  other can depend on rounding in `Math.sin`, `Math.cos` and `Math.hypot`; the tests were run on Node 22.

#### The sensitivity of a result

For the result of each load case `solve` computes

    sensitivity = ε · ( Σ over i and j of |u_i| · |K_ij| · |u_j| ) / ( Σ over i of f_i · u_i ),

with ε = `Number.EPSILON` (about 2.2e-16), K the assembled matrix, u the displacements and f the nodal
loads. The denominator is the work of the loads, which for the exact solution equals uᵀ K u. The quotient
is the relative change of that work that a relative change of ε in every entry of K could cause, for these
displacements. It has no unit and does not change with the units of force or length. It is 0 when every
displacement is 0, and `Infinity` when the displacements are not all 0 and the work is not positive.

`solve` reports the number and does not act on it: no result is refused because of it. It is an
indication of how many digits the stiffness contrast of the model has cost, not a bound on the error, and
it is not a test of stability. The tests measure ε for an axial bar, 13 ε for a tip-loaded cantilever, and
a value between 1e-4 and 1e-3 for the 10 m by 10 m portal frame with its area multiplied by 1e9, whose
sway is off by less than 1e-4.

## Tests

Element and assembly: `src/index.test.ts`. The tolerances are stated in the tests. Among them: the local matrix against the
textbook terms for an element with round numbers; the cantilever tip deflection and slope formulas in both
bending planes; for eight orientations (along X, along Y, vertical upward and downward, skew, and three with
a roll angle of 30 degrees) the global element matrix times each of the six rigid-body motions; a check that
this rigid-body test fails for a matrix with the sign of one bending plane reversed; the orthogonality of
the transformation; a member along global Y against the local matrix with its axes permuted; two collinear
elements at their shared node; the symmetry of the portal frame's assembled matrix.

Factorization and solve: `src/solve.test.ts`. The tolerances are stated in the tests. "Relative 1e-12" means
|computed − expected| ≤ 1e-12 · |expected|; a value that is zero in exact arithmetic is allowed 1e-12 times
a scale given in the test (a force, a moment or a displacement of the same case).

- Closed-form cases at relative 1e-12, with the section and material of the fixtures: a cantilever along X
  with a tip force in each bending plane (tip deflection P L³/(3EI), tip rotation P L²/(2EI), the fixed-end
  force and the fixed-end moment with its sign); the same cantilever with a tip moment about Y and about Z;
  an axial bar (P L/(EA)); a propped cantilever of two elements with a load at the joint (roller reaction
  5P/16, fixed-end reaction 11P/16, fixed-end moment 3PS/16, deflection 7PS³/(768EI), end rotation
  PS²/(32EI)); a cantilever column with tip forces along X and Y and a torque about Z.
- The portal frame fixture: the six sums of loads and reactions (forces, and moments about the origin) are
  zero within 1e-12 · 80 kN·m; the signs of the reactions; no displacement or reaction out of the frame's
  plane. With the area multiplied by 1e6, the sway, the joint rotation, the base moments and the base shears
  agree with the slope-deflection values for inextensible members at relative 1e-7; that tolerance bounds
  what the remaining axial deformation changes, not rounding.
- Two load cases in one model, each compared exactly with the same case solved alone; an empty load case;
  several loads on one node; a load on a restrained degree of freedom; a support with unrestrained
  components; a model with every degree of freedom restrained.
- The unstable models and the limits named in "The instability test", and the refusals (invalid model,
  member loads, truss members and releases, overflow).
- Stiff next to soft: the stepped cantilever and the 200-element cantilever against their closed-form tip
  deflections at relative 1e-7. That tolerance is wider because these systems are ill-conditioned; the
  largest differences measured are about 5e-9 and 2e-8.
- `factorize` and `solveFactorized` on a 3 by 3 matrix whose order of elimination and factors are worked
  by hand, on a matrix that is not symmetric, on a tridiagonal matrix, on 20 full matrices of 15 rows
  against Gaussian elimination with partial pivoting, and on singular, zero-row and indefinite matrices.
