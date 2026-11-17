# @bridle/solver

The linear-elastic 3D frame solver of the showcase (`docs/plan/pitch-plan.md`). So far it has the work of
pitch cards S2 to S4: the stiffness matrix of a 3D frame element in local axes, its transformation to global
axes, the assembly of the global stiffness matrix of a model, and `solve`, which applies the supports, the
nodal loads and the member loads (uniform and point) of each load case and returns the displacements of the
nodes, the reactions at the supports and the end forces of every member.

Not yet: truss members and member end releases (card S5), values along a member (card S6). `solve` refuses
a model that has a truss member or an end release. A uniform load covers the whole member; there are no
partial-length distributed loads, no moments applied along a member and no load combinations.

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
// Here a uniform load of 10 kN/m downward is added on the beam b1.
const frame = portalFrame();
frame.memberUniformLoads.push({
  id: "ul1",
  loadCaseId: "lc1",
  memberId: "b1",
  axes: "global",
  direction: "z",
  value: -10,
});
const solved = solve(frame);
if (solved.ok) {
  const lc1 = solved.loadCases.lc1;
  lc1?.displacements.n2?.ux; // the sway of node n2, in m
  lc1?.reactions.n1?.my; // the moment the support at n1 applies to the frame, in kN·m
  lc1?.memberEndForces.b1?.start.my; // the moment node n2 applies to the start of b1, local axes, kN·m
  solved.smallestPivotRatio; // how close the model is to the instability threshold
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
  not internal forces by a beam sign convention (card S6 derives those). The member end forces that `solve`
  reports follow this same rule ("Member end forces" below).
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
| `solve(model)`                                                                                      | Per load case, the displacements of the nodes, the reactions at the supports and the member end forces, or a refusal (below).          |
| `equivalentNodalLoadsLocal(load, length, axes)`                                                     | The twelve equivalent nodal loads of one member load, in the member's local axes ("Member loads" below).                               |
| `memberLoadLocalComponents(load, axes)`, `isMemberPointLoad(load)`                                  | A member load's value resolved along local x, y, z; whether a member load is a point load.                                             |
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

For each load case of the model, `solve` finds the displacements of the nodes, the reactions at the
supports and the end forces of the members. It does not change the model and keeps no state between calls.

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
   `ry`, `rz`) and of the equivalent nodal loads of the case's member loads ("Member loads" below). The free
   displacements are the solution of (reduced K) u = (free rows of f).
5. **Reactions.** The reactions are the restrained rows of K u − f, computed with the whole matrix K as
   `assemble` returned it, not with the reduced matrix, and with the whole f. So a load applied directly on
   a restrained degree of freedom appears in that reaction with the opposite sign, and so does the part of
   a member load that goes straight into a support: a beam fixed at both ends under a uniform load has no
   displacement at all, and its reactions are wL/2 and wL²/12.
6. **Member end forces.** For each member, k · T · u − Q in its local axes ("Member end forces" below).
7. **Sensitivity.** A number that indicates how much rounding in K could matter to the result is computed
   for the load case and reported with it (below). `solve` does not act on it.

`solve` returns one of:

- `{ ok: true, nodeIds, memberIds, smallestPivotRatio, loadCases }`: `loadCases` has one `LoadCaseResult`
  per load case of the model, under the load case's id. A model with no load case gives an empty
  `loadCases`; it is still checked for instability. `nodeIds` and `memberIds` are the ids in the model's
  order; `smallestPivotRatio` is described under "The smallest pivot ratio".
- `{ ok: false, reason: "invalid-model", issues }`: the issues of `validateModel`. A model with no support
  is refused here (`no-support`).
- `{ ok: false, reason: "not-supported-yet", unsupported }`: the entries of `assemble` for truss members and
  end releases (`{ memberId, feature }`). A member load is not a reason for refusal.
- `{ ok: false, reason: "unstable", nodeId, dof, pivot, diagonal, threshold, remaining }`: see "The
  instability test".
- `{ ok: false, reason: "non-finite", where: "stiffness" }` when an entry of K is not a finite number, and
  `{ ok: false, reason: "non-finite", where: "load-case", loadCaseId }` when a displacement, a reaction or a
  member end force of that load case is not (numbers so large that a product overflows a double).

#### The result of a load case

| Field                | Content                                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `loadCaseId`         | The load case's id.                                                                                                              |
| `displacements`      | An object with one entry per node of the model, under the node's id: `{ ux, uy, uz, rx, ry, rz }`.                               |
| `reactions`          | An object with one entry per support of the model, under the support's node id: `{ fx, fy, fz, mx, my, mz }`.                    |
| `displacementVector` | A `Float64Array` with the same displacements: six numbers per node, nodes in the order of `nodeIds`, `ux` to `rz` within a node. |
| `reactionVector`     | A `Float64Array` with the same reactions in the same order (`fx` to `mz` within a node); 0 in every row no support restrains.    |
| `sensitivity`        | The number of "The sensitivity of a result".                                                                                     |
| `memberEndForces`    | An object with one entry per member of the model, under the member's id: `{ start, end }`, each `{ fx, fy, fz, mx, my, mz }`.    |

`nodeIds` of the result is the list of node ids in the model's order, and `memberIds` the list of member
ids in the model's order.

**Units.** Translations `ux`, `uy`, `uz` are in m; rotations `rx`, `ry`, `rz` are in rad. Reaction forces
and member end forces `fx`, `fy`, `fz` are in kN; reaction moments and member end moments `mx`, `my`, `mz`
are in kN·m.

**Signs.** Displacements and reactions are in the global axes, by the conventions above (member end forces
are in each member's local axes; see "Member end forces"):

- A displacement is positive along the positive global axis; a rotation is positive by the right-hand rule
  about it. A node that sinks has a negative `uz`.
- A reaction is the force and the moment that the support applies to the structure, positive along and
  about the positive global axes, like a nodal load. A support that carries a downward load has a positive
  `fz`. For a cantilever along +X fixed at its start with a downward force P at its tip (length L), the
  reaction is `fz` = +P and `my` = −P·L.
- For each load case the nodal loads, the member loads and the reactions together are in equilibrium:
  their forces sum to zero and their moments about any point sum to zero, up to rounding.
- A component of a reaction that its support does not restrain is exactly 0. A support that restrains
  nothing still has an entry, of six zeros.

**Plain data.** A result holds objects, arrays, strings, numbers, booleans and, per load case, two
`Float64Array`s: no function, no `Map` and no class instance. A test checks that `structuredClone` of a
result (the copy a Web Worker message makes) equals the result. `JSON.stringify` does not keep a
`Float64Array` as an array; the records `displacements` and `reactions` hold the same numbers as plain
objects, and `memberEndForces` is plain objects only. The order of the keys of a record is not part of the result (JavaScript lists keys that look like
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
  relative rounding error of the order of ε/r (ε is about 2.2e-16). The smallest ratio of an accepted model
  is in the result as `smallestPivotRatio`. The 10 m by 10 m portal frame with
  its area multiplied by 1e9 has a smallest ratio between 1e-12 and 1e-11; it solves, and its sway
  differs from the slope-deflection value by more than 1e-6 and less than 1e-4 of it.
- **The ratio falls as a member is cut into more elements.** For a cantilever of n equal elements along a
  global axis the smallest ratio is 1/(4n³) for n = 50, 100 and 200 (tested; it is 3.1e-8 for n = 200). The
  law does not hold for every n: the review of card PX-01.4 measured 1/64, not 1/108, for n = 3. If the
  ratio kept falling with the cube of n it would reach 1e-12 near n = 6300; that was not run.
- The test is a numerical test, not a proof. Whether a ratio near the threshold falls on one side or the
  other can depend on rounding in `Math.sin`, `Math.cos` and `Math.hypot`; the tests were run on Node 22.

#### Member loads

A `MemberUniformLoad` (kN/m over the whole member) and a `MemberPointLoad` (kN at `position` metres from
the start node) act along one axis, named by `axes` (`"local"` or `"global"`) and `direction` (`"x"`, `"y"`
or `"z"`), as `@bridle/model` defines them.

- **Resolution into local axes.** A load in local axes is a load along that local axis. A load in global
  axes is a vector along that global axis; its local components are its dot products with the member's
  local x, y and z unit vectors. On an inclined member a global vertical load therefore has an axial part
  and a transverse part. A uniform load is per unit of the member's own length, also for a global
  direction: the total of a global vertical load w on a member of length L is w · L, whatever its slope
  (for a member from (0, 0, 0) to (3, 0, 4) and w = 10 kN/m the total is 50 kN, not 30 kN).
- **Equivalent nodal loads.** Each load is replaced by twelve loads Q on the member's two nodes, in local
  axes: the fixed-end forces of the load (the end actions of the member with both ends fixed) with the
  opposite sign. `equivalentNodalLoadsLocal(load, length, axes)` returns them. `solve` turns them to global
  axes with Tᵀ and adds them to the load vector. The derivation is in the header of `src/memberLoads.ts`:
  by Betti's theorem the fixed-end force at a degree of freedom is minus the integral of the load times the
  element's shape function of that degree of freedom, and the shape functions are the exact deflected
  shapes of an unloaded Euler-Bernoulli member, so the result is exact for this element, not an
  approximation that improves with more elements.
- **Position of a point load.** `validateModel` accepts a position up to 1e-9 m past either end; such a
  position is taken as the end. A point load at an end is that force on that node and nothing else.
- A load acts on the member's axis, so it gives no torque about local x.

The equivalent nodal loads of a load with the local components (px, py, pz), in the order of the degrees of
freedom. For a uniform load p is in kN/m; for a point load p is in kN, at a from the start, with b = L − a.

| Component  | Uniform load | Point load       | Remark                         |
| ---------- | ------------ | ---------------- | ------------------------------ |
| start `ux` | px·L/2       | px·b/L           |                                |
| start `uy` | py·L/2       | py·b²(3a + b)/L³ |                                |
| start `uz` | pz·L/2       | pz·b²(3a + b)/L³ |                                |
| start `rx` | 0            | 0                |                                |
| start `ry` | −pz·L²/12    | −pz·a·b²/L²      | minus: d(uz)/dx = −ry          |
| start `rz` | +py·L²/12    | +py·a·b²/L²      | plus: d(uy)/dx = +rz           |
| end `ux`   | px·L/2       | px·a/L           |                                |
| end `uy`   | py·L/2       | py·a²(a + 3b)/L³ |                                |
| end `uz`   | pz·L/2       | pz·a²(a + 3b)/L³ |                                |
| end `rx`   | 0            | 0                |                                |
| end `ry`   | +pz·L²/12    | +pz·a²·b/L²      | the opposite sign of the start |
| end `rz`   | −py·L²/12    | −py·a²·b/L²      | the opposite sign of the start |

The moments have opposite signs in the two bending planes for the reason given in "What the convention
does to the bending terms". A check by statics: a load along +z at a distance x from the start node has
the moment (x, 0, 0) × (0, 0, P) = (0, −x·P, 0) about that node, negative about y, and the equivalent moment
at the start is negative about y too.

#### Member end forces

For each load case and each member, `memberEndForces[memberId]` is `{ start, end }`: the force and the
moment that the start node and the end node apply to the member's ends,

    f = k · T · u − Q,

with k the member's local stiffness matrix, T its transformation, u the displacements of its two nodes in
global axes and Q the sum of the equivalent nodal loads of the member's own loads of that load case (zero
for a member without loads).

**The sign convention.** The values are in the member's **local axes**, and they are **end actions in the
axis directions at both ends**: at the start and at the end alike, a force is positive along the positive
local axis and a moment is positive by the right-hand rule about the positive local axis. They are what
the node does to the member, not what the member does to the node, and not internal forces by a beam sign
convention with opposite positive senses on the two faces of a cut.

| Component  | What it is                                   | Positive at the start                               | Positive at the end                              |
| ---------- | -------------------------------------------- | --------------------------------------------------- | ------------------------------------------------ |
| `fx`       | axial force                                  | the node pushes into the member (compression there) | the node pulls out of the member (tension there) |
| `fy`, `fz` | shear along local y, local z                 | the node pushes the end along +y, +z                | the same                                         |
| `mx`       | torque                                       | right-hand rule about +x                            | the same                                         |
| `my`       | bending moment about local y (x-z plane, Iy) | right-hand rule about +y: turns z towards x         | the same                                         |
| `mz`       | bending moment about local z (x-y plane, Iz) | right-hand rule about +z: turns x towards y         | the same                                         |

Because local x points into the member at the start and out of it at the end, the same physical state has
opposite signs at the two ends. A member in tension with no axial load along it has `start.fx` = −N and
`end.fx` = +N. For a beam along +X with roll 0 that sags under a downward load (tension in the bottom
fibre, moment M), a cut end that is a start has `my` = +M and one that is an end has `my` = −M; a hogging
moment has the opposite signs. In the other plane the signs are reversed: under a load along −y, sagging
towards −y gives `mz` = −M at a start and `mz` = +M at an end.

**Equilibrium.** The two end actions of a member and the member's own loads are in equilibrium. At a node,
the nodal loads, the reaction and the opposites of the end actions of the members that meet there, turned
to global axes, sum to zero.

**Worked example.** A cantilever of 3 m along +X (local axes equal to the global axes), fixed at its start
node, with a nodal load of 10 kN downward (`fz` = −10) on its end node:

| End   | `fx` | `fy` | `fz` | `mx` | `my` | `mz` |
| ----- | ---- | ---- | ---- | ---- | ---- | ---- |
| start | 0    | 0    | +10  | 0    | −30  | 0    |
| end   | 0    | 0    | −10  | 0    | 0    | 0    |

At the start the node is the support: it pushes the member up with 10 kN and applies −30 kN·m about y, the
same numbers as the reaction (the load's moment about the fixed end is (3, 0, 0) × (0, 0, −10) = (0, +30, 0),
and the support balances it). At the end the node passes the load on to the member: 10 kN downward, and no
moment, because the tip is free. If the same 10 kN is given as a member point load at `position` 3 and not
as a nodal load, the start is the same and the end is all zeros: the load then acts on the member itself
and the node applies nothing to it. With a nodal load of 10 kN along +X on the end node the member is in
tension: `start.fx` = −10 and `end.fx` = +10.

A second example: a beam of 6 m along +X fixed at both ends, with 10 kN/m downward. Start: `fz` = +30,
`my` = −30 (−wL²/12). End: `fz` = +30, `my` = +30 (+wL²/12). Both ends hog. No node moves, so k · T · u is
zero and the end forces are −Q.

#### The smallest pivot ratio

`smallestPivotRatio` of a result is the smallest ratio that the factorization met: over the unrestrained
degrees of freedom, the smallest pivot divided by its diagonal entry of K ("The factorization" above
defines the ratio). It belongs to the model and its supports and is the same for every load case. It has
no unit. It is above `PIVOT_THRESHOLD` (1e-12), because otherwise the result would be `unstable`, and it is
1 when no degree of freedom is free (every one is restrained, so nothing was factorized).

What it tells: how near the model is to being reported as unstable, and how many digits the results may
have lost. A ratio r leaves the pivot a relative rounding error of the order of ε/r (ε is about 2.2e-16).
A cantilever of one element has 1/4; a cantilever of 50, 100 or 200 equal elements along a global axis
has 1/(4n³) (other n can differ from that law); the
10 m by 10 m portal frame with its area multiplied by 1e9, whose sway is off by more than 1e-6 of the
slope-deflection value, has a ratio between 1e-12 and 1e-11. An interface can warn when the number is
within a few orders of magnitude of 1e-12. The solver sets no warning level and does not act on the number.

#### The sensitivity of a result

For the result of each load case `solve` computes

    sensitivity = ε · ( Σ over i and j of |u_i| · |K_ij| · |u_j| ) / ( Σ over i of f_i · u_i ),

with ε = `Number.EPSILON` (about 2.2e-16), K the assembled matrix, u the displacements and f the load
vector (the nodal loads plus the equivalent nodal loads of the member loads). The denominator is the work
of those loads on the nodes, which for the exact solution equals uᵀ K u. The quotient
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
  truss members and releases, overflow). Every test that measures a smallest ratio also checks that
  `solve` reports the same number as `smallestPivotRatio`.
- Stiff next to soft: the stepped cantilever and the 200-element cantilever against their closed-form tip
  deflections at relative 1e-7. That tolerance is wider because these systems are ill-conditioned; the
  largest differences measured are about 5e-9 and 2e-8.
- `factorize` and `solveFactorized` on a 3 by 3 matrix whose order of elimination and factors are worked
  by hand, on a matrix that is not symmetric, on a tridiagonal matrix, on 20 full matrices of 15 rows
  against Gaussian elimination with partial pivoting, and on singular, zero-row and indefinite matrices.

Member loads and member end forces: `src/memberLoads.test.ts`. The tolerances are stated in the tests;
"relative 1e-12" and the zero rule are as above. The section and material are those of the fixtures.

- `equivalentNodalLoadsLocal` alone: the twelve numbers for a uniform load and for a point load along each
  local axis, with their signs in both bending planes; a point load at an end, past an end and 1 µm from
  an end; a global vertical load on a member that rises 4 in 3; a roll of 90 degrees; and for six members
  (along X, vertical upward and downward, skew, with roll angles of 0, 20, 40 and −115 degrees), uniform
  and point loads in local and global axes along x, y and z: the twelve numbers have the same force and
  the same moment about the start node as the load.
- Closed-form cases through `solve` at relative 1e-12, in both bending planes where the case has one:
  a simply supported beam with a node at mid-span under a uniform load (reactions wL/2, deflection
  5wL⁴/(384EI), end rotations wL³/(24EI), mid-span moment wL²/8 in the end forces); the simply supported
  beam fixture under its own load; a beam fixed at both ends under a uniform load (no displacement, end
  moments wL²/12 with their signs), and the same with a node at mid-span (deflection wL⁴/(384EI), moment
  wL²/24); a cantilever under a uniform load (tip deflection wL⁴/(8EI), rotation wL³/(6EI), moment wL²/2);
  a cantilever under a point load at 2 m, at mid-span, 1 mm from the fixed end, 1 mm from the tip and at
  the tip of 6 m (tip deflection Pa²(3L − a)/(6EI), rotation Pa²/(2EI)); a propped cantilever under a
  uniform load (reactions 5wL/8 and 3wL/8, moment wL²/8, rotation wL³/(48EI)); a beam fixed at both ends
  with an off-centre point load (shears Pb²(3a + b)/L³ and Pa²(a + 3b)/L³, moments Pab²/L² and Pa²b/L²); a
  bar under an axial uniform load (pL²/(2EA)) and under an axial point load, fixed at one end (Pa/(EA)) and
  at both (Pb/L and Pa/L); the worked example above.
- Inclined, vertical and rolled members: the member from (0, 0, 0) to (3, 0, 4) under a global vertical
  uniform load, on a pin and a roller (total reaction w times the length) and as a cantilever; a column
  running upward and one running downward under wind along +X and along +Y; a cantilever with a roll of 90
  degrees (deflection with Iz) and with a roll of 30 degrees (it moves sideways; the reactions do not
  depend on the roll); a skew cantilever along (2, 3, 6) with a roll of 40 degrees under three loads, at
  1e-11.
- Frames: the portal frame fixture with a beam load, a column wind load and two point loads: every member,
  every node and the whole structure in equilibrium within 1e-12 · 300 kN·m, and a check that these
  equilibrium tests fail for a changed end force; the portal frame under a beam load with its area
  multiplied by 1e6 against the slope-deflection values at relative 1e-7.
- Against a finer model, at 1e-10 of the largest value: a space frame of three skew members with roll
  angles, where a point load inside a member is compared with the same force on a node placed there
  (a reference that uses nodal loads only), and a uniform load with the same load on the member cut into
  three pieces.
- Load cases (a member load acts in its own load case only; a case with all the loads is the sum of the
  others), plain data and `structuredClone`, a member id that is a name of `Object.prototype`, the
  smallest pivot ratio, an overflowing member load.
