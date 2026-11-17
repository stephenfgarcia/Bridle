# @bridle/solver

The linear-elastic 3D frame solver of the showcase (`docs/plan/pitch-plan.md`). So far it has the work of
pitch cards S2 to S4: the stiffness matrix of a 3D frame element in local axes, its transformation to global
axes, the assembly of the global stiffness matrix of a model, and `solve`, which applies the supports, the
nodal loads and the member loads (uniform and point) of each load case and returns the displacements of the
nodes, the reactions at the supports and the end forces of every member.

Card S6 added the values along a member ("Values along a member" below): `memberValues`, the axial force,
shears, torque, bending moments and deflection at stations along a member with their extreme values, and
`deflectedShape`, the deflected structure as polylines for drawing.

Card S8 added the illustrative member checks ("Illustrative member checks" below): `memberChecks`,
`structureChecks`, `governingChecks` and `spanDeflection`. They compare an elastic normal stress with the
yield strength, a deflection with span/n and a drift with height/n. They are not the checks of a design code.

Not yet: truss members and member end releases (card S5). `solve` refuses
a model that has a truss member or an end release. A uniform load covers the whole member; there are no
partial-length distributed loads, no moments applied along a member and no load combinations.

Card S9 added what runs `solve` off the main thread ("In a Web Worker" below): the messages, the function
that handles one request, the worker entry `@bridle/solver/worker`, the client `createSolverClient`, and a
speed test (`pnpm --filter @bridle/solver bench`, "Speed" below).

Plain TypeScript; the one runtime dependency is `@bridle/model`. The solver's functions are pure and keep no
state between calls. The source that an application loads uses no Node API and no DOM API; of the browser
it uses only the worker's own `self.onmessage` and `postMessage` (`src/worker.ts`), the worker object that
the caller gives the client (`src/client.ts`), and `performance.now()` in the speed test (`src/bench.ts`).
The tests of the worker (`src/worker.test.ts`) and the bench script (`bench/run.mjs`) use Node and Vite.

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
`pnpm --filter @bridle/solver typecheck`; `pnpm check` runs both through turbo. The speed test is
`pnpm --filter @bridle/solver bench`; `pnpm check` does not run it.

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
  not internal forces by a beam sign convention (those are in "Values along a member"). The member end forces that `solve`
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

| Function                                                                                            | What it returns                                                                                                                          |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `elementStiffnessLocal(properties)`                                                                 | The 12 by 12 stiffness matrix in local axes. Inputs are not checked.                                                                     |
| `elementTransformation(axes)`                                                                       | The 12 by 12 matrix T with u_local = T u_global: four copies of the 3 by 3 matrix whose rows are the local x, y, z unit vectors.         |
| `elementStiffnessGlobal(kLocal, T)`                                                                 | Tᵀ k T, the element matrix in global axes.                                                                                               |
| `assemble(model)`                                                                                   | The global stiffness matrix, the degree-of-freedom map and one `MemberElement` per member, or a refusal (below).                         |
| `solve(model)`                                                                                      | Per load case, the displacements of the nodes, the reactions at the supports and the member end forces, or a refusal (below).            |
| `equivalentNodalLoadsLocal(load, length, axes)`                                                     | The twelve equivalent nodal loads of one member load, in the member's local axes ("Member loads" below).                                 |
| `memberLoadLocalComponents(load, axes)`, `isMemberPointLoad(load)`                                  | A member load's value resolved along local x, y, z; whether a member load is a point load.                                               |
| `memberValues(model, result, loadCaseId, memberId, stations?, at?)`                                 | The internal actions N, Vy, Vz, T, My, Mz and the deflection at stations along one member, and their extremes ("Values along a member"). |
| `deflectedShape(model, result, loadCaseId, scale, stations?)`                                       | For every member a polyline of points, the undeformed axis plus `scale` times the deflection ("Values along a member").                  |
| `DEFAULT_STATIONS`, `MAX_STATIONS`, `MEMBER_QUANTITIES`                                             | 21, 1001, and the names of the quantities that `extremes` of `memberValues` has.                                                         |
| `factorize(matrix, relativeThreshold)`, `solveFactorized(factorization, b)`                         | The symmetric factorization L D Lᵀ that `solve` uses, and the solution of a system with it.                                              |
| `unsupportedMembers(model)`                                                                         | The members `assemble` refuses as not supported yet.                                                                                     |
| `buildDofMap(nodes)`, `dofIndex(map, nodeId, dof)`, `memberDofIndices(map, startNodeId, endNodeId)` | The numbering of the global rows.                                                                                                        |
| `PIVOT_THRESHOLD`, `REACTION_COMPONENTS`                                                            | The threshold of the instability test (below) and the names `fx`, `fy`, `fz`, `mx`, `my`, `mz` in the order of the degrees of freedom.   |
| `zeros`, `fromRows`, `at`, `addAt`, `transpose`, `multiply`, `multiplyVector`, `maxAbs`             | Helpers for the `Matrix` type.                                                                                                           |

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

### Values along a member

Card S6, `src/memberValues.ts`. Two pure functions that take the model and what `solve` returned for it:

- `memberValues(model, result, loadCaseId, memberId, stations = 21, at = [])` returns the internal actions
  and the deflection of one member at stations along its length, and the extreme values of each.
- `deflectedShape(model, result, loadCaseId, scale, stations = 21)` returns one polyline per member for
  drawing the deflected structure.

Neither changes its arguments or keeps state; both use no Node and no DOM API, so they run in the worker or
in the main thread. Neither checks that `result` is the result of that `model`.

```ts
const result = solve(model);
const v = memberValues(model, result, "lc1", "b1"); // undefined when it cannot be computed (below)
if (v) {
  v.x; // Float64Array: the distance of each station from the start node, m
  v.My; // Float64Array: the bending moment about local y at each station, kN·m
  v.extremes.My.max; // the largest My along the member, and v.extremes.My.maxX, where it is
  v.deflectionGlobal[3 * i + 2]; // the deflection along global Z at station i, m
}
const shape = deflectedShape(model, result, "lc1", 100); // deflections drawn 100 times larger
```

#### The sign convention of the internal actions

A figure in words. Stand at the start node and look along the member towards the end node: that direction
is local x. Cut the member at the distance x from the start node. The **part before the cut** is the piece
from the start node to the cut; the **part beyond the cut** is the piece from the cut to the end node. The
cut face of the part before the cut looks along +x; it is called the positive face. Local y and local z are
the member's other two axes (`memberLocalAxes`); the section has a −y side and a +y side, a −z side and a
+z side. All six values are in these local axes.

| Value | What it is                                     | Positive when                                                                                           | Unit |
| ----- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---- |
| `N`   | axial force                                    | the member is in tension at the cut                                                                     | kN   |
| `Vy`  | shear along local y                            | the forces on the part before the cut (start end force and loads up to the cut) sum to a force along +y | kN   |
| `Vz`  | shear along local z                            | the same, along +z                                                                                      | kN   |
| `T`   | torque                                         | the part beyond the cut applies, to the positive face, a moment about +x by the right-hand rule         | kN·m |
| `My`  | bending moment about local y (x-z plane, E·Iy) | the fibre on the **−z side** is in tension                                                              | kN·m |
| `Mz`  | bending moment about local z (x-y plane, E·Iz) | the fibre on the **−y side** is in tension                                                              | kN·m |

- **The two bending planes read alike.** With d the deflection along the plane's transverse axis (local z
  for `My` and `Vz`, local y for `Mz` and `Vy`), p the load per unit length along that axis and EI the
  plane's stiffness, in a stretch without a point load: M = EI·d″, V = dM/dx and dV/dx = p. A positive moment
  bends the member concave towards the positive transverse axis.
- **The same along the member.** These are internal actions: a state of stress has one sign wherever the
  cut is, also at the two ends. The end forces of `solve` do not have that property (a sagging moment M is
  `my` = +M as a start end force and −M as an end end force).
- **Drawing on the tension side.** Draw the ordinate `My` from the member's axis towards −z (a negative
  value then falls on the +z side) and the ordinate `Mz` towards −y. As vectors in global axes: the
  ordinate of `My` at a station is −`My` · (local z) and that of `Mz` is −`Mz` · (local y); `axes` of the
  result holds the local unit vectors.
- **"Sagging positive".** A member that is not vertical and has roll 0 has its local z in the vertical
  plane through the member, pointing upward. For such a member the −z side is the lower side, so a positive
  `My` is a sagging moment and a negative one a hogging moment. The simply supported beam fixture (6 m
  along +X, 10 kN/m downward) has `My` = +wL²/8 = +45 kN·m at mid-span, `Vz` = +30 kN at its start and
  −30 kN at its end, and `Mz` = 0.
- **Columns and rolled members: sagging has no meaning; the local axes decide.** A vertical member with
  roll 0 that runs upward has local z = global −X, and one that runs downward has local z = global +X
  (`packages/model`). A cantilever column fixed at its base under wind along +X has its tension on the −X
  face at the base, moment wH²/2: the upward column reports `My` = −wH²/2 there and the downward one
  `My` = +wH²/2. Drawn by the rule above, both diagrams are on the −X side. With a roll of 90 degrees a
  beam along +X has local y = global +Z, so gravity bends it about local z and a sagging moment is a
  positive `Mz`; with a roll of 180 degrees local z points downward and a sagging moment is a negative
  `My`. An interface that wants the words "sagging" and "hogging" may use them for `My` only, and only
  where local z points upward.
- **`Mz` of a beam with roll 0 is sideways bending and has no sagging or hogging.** Its local y is
  horizontal and turns with the member's direction (global +Y for a beam along +X, global −Y for one along
  −X), so the same sideways load on the same beam gives `Mz` of opposite signs for the two directions of
  the member (tested: +wL²/8 and −wL²/8 at mid-span of a simply supported beam under a load along −Y).
  The drawing rule above puts both ordinates on the same side, the tension side.
- **At a rigid joint** the moments of the members balance as vectors; the signs of `My` of two members that
  meet there are equal or opposite depending on their local axes. In the portal frame fixture (columns
  running upward, beam along +X) the column's `My` at its top equals the beam's `My` at the left joint and
  is its opposite at the right joint.

**The relation to the member end forces.** With (fx, fy, fz, mx, my, mz) the end forces of `solve`:

| Value | At the start node (x = 0) | At the end node (x = L) |
| ----- | ------------------------- | ----------------------- |
| `N`   | −`start.fx`               | +`end.fx`               |
| `Vy`  | +`start.fy`               | −`end.fy`               |
| `Vz`  | +`start.fz`               | −`end.fz`               |
| `T`   | −`start.mx`               | +`end.mx`               |
| `My`  | +`start.my`               | −`end.my`               |
| `Mz`  | −`start.mz`               | +`end.mz`               |

**How they are computed.** By statics of the part before the cut, from the start end force and the member's
loads of the load case, resolved into local axes with `memberLoadLocalComponents` as `solve` does. With
(px, py, pz) a load at the distance ξ from the start (per unit length for a uniform load) and the sums
taken over the loads before the cut:

    N  = −fx₁ − Σ px                         T  = −mx₁
    Vy = +fy₁ + Σ py                         Vz = +fz₁ + Σ pz
    My = +my₁ + x·fz₁ + Σ pz·(x − ξ)         Mz = −mz₁ + x·fy₁ + Σ py·(x − ξ)

For a uniform load w over the whole member Σ p = w·x and Σ p·(x − ξ) = w·x²/2. The derivation (the
equilibrium of forces and of moments about the cut, and which fibre is in tension) is in the header of
`src/memberValues.ts`. No interpolation is involved, so the values are those of statics for the uniform and
point loads the solver has, up to floating-point rounding; the values at the end node are computed from
the start and agree with the end node's end force up to rounding.

**Worked example.** The simply supported beam fixture: `start` = { `fz`: +30, `my`: 0 }, pz = −10 kN/m. At
x = 3 m: `Vz` = 30 − 10·3 = 0 and `My` = 0 + 3·30 − 10·3²/2 = +45 kN·m. At x = 6 m: `Vz` = 30 − 60 = −30,
which is −`end.fz` (`end.fz` = +30), and `My` = 180 − 180 = 0.

#### Stations

- `stations` equally spaced positions from 0 to the member's length, both included; the default is 21. A
  number below 2 is taken as 2, a number above `MAX_STATIONS` (1001) is taken as 1001, a fraction is
  rounded down, and a value that is not finite is taken as 21. The length of `at` is not limited.
- Each position of `at` (m from the start node) gets a station; a position outside the member is taken as
  the nearer end, and one that is not a finite number is left out.
- **At a point load there are two stations with the same `x`**: first the values just before the load, then
  the values just after it, so the jump of the shear (or of the axial force) is in the arrays. A point
  load's position past an end is taken as that end, as in `solve`; several point loads at one position
  act together between the same two stations.
- Positions that are equal as numbers are one position: an equally spaced station or a position of `at`
  that is exactly at a point load adds nothing to the two stations there. Positions that differ by rounding
  only stay separate stations.
- **A point load at position 0 or at the length is on the member, not on the node.** The end forces of
  `solve` do not hold it, so there are two stations at that end: the one on the node's side has the values
  of the table above, and the other differs by the load. A nodal load on the node is not part of the
  member's values at all.
- `count` is the number of stations. `x`, `N`, `Vy`, `Vz`, `T`, `My`, `Mz` are `Float64Array`s of that length.

#### Deflections

`deflectionLocal` and `deflectionGlobal` are `Float64Array`s with three numbers per station (station i at
3i, 3i + 1, 3i + 2): the displacement of the point of the member's axis, in m, along local x, y, z and along
global X, Y, Z. The twist of the section about the axis is not reported.

The deflection at x is the sum of two parts:

1. the element's interpolation of the displacements of its two ends, turned into local axes: the cubic
   shape functions of `src/element.ts` for local y (with the slope +rz) and for local z (with the slope
   −ry), and a straight line for local x;
2. the deflection that the member's own loads give a member fixed at both ends. With b = L − a and
   r = L − x:

| Load                           | Deflection of the member fixed at both ends                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------- |
| uniform w, transverse          | w·x²·(L − x)²/(24EI)                                                                         |
| point P at a, transverse       | P·b²·x²·(3aL − (3a + b)·x)/(6EI·L³) for x ≤ a; P·a²·r²·(3bL − (3b + a)·r)/(6EI·L³) for x ≥ a |
| uniform w, along the member    | w·x·(L − x)/(2EA)                                                                            |
| point P at a, along the member | P·b·x/(EA·L) for x ≤ a; P·a·r/(EA·L) for x ≥ a                                               |

EI is E·Iz for a load along local y and E·Iy for a load along local z. The first part alone is the shape of
a member without loads; with a load on the member it is not the deflection between the nodes. With both
parts a simply supported beam modelled as one member has the mid-span deflection 5wL⁴/(384EI) under a
uniform load (tested at relative 1e-12 in both planes).

**Limit.** These formulas are those of a frame member rigidly connected to its nodes at both ends. `solve`
refuses a model with a truss member or an end release today (card S5). For a member of kind `truss` or with
any end release `memberValues` returns `undefined`, and `deflectedShape` draws the straight line between
its two displaced ends.

#### Extreme values

`extremes` has one entry per name of `MEMBER_QUANTITIES` (`N`, `Vy`, `Vz`, `T`, `My`, `Mz`, `dLocalX`,
`dLocalY`, `dLocalZ`, `dGlobalX`, `dGlobalY`, `dGlobalZ`): `{ min, minX, max, maxX }`, the smallest (most
negative) and the largest value and the distance from the start node where each occurs (of equal values,
the first position along the member). The largest magnitude is the larger of |min| and |max|.

- `N`, `Vy`, `Vz`, `T`: taken over the stations. Between two neighbouring point-load positions or member
  ends each of them is linear in x, and those positions are stations.
- `My`, `Mz`: taken over the stations and over every point between two consecutive stations where the
  shear of that plane is zero. Between two consecutive stations the shear is linear (there is no point
  load between them), so that point is found by one division, x = (station's x) − V/w, and the moment
  there is M − V²/(2w), with V and M the station's shear and moment and w the uniform load of that plane.
  Where the shear changes sign by a jump at a point load, the two stations there hold the moment.
- The six deflection components: taken over the stations and, for each pair of consecutive stations at
  different positions, over one more point when the derivative of that component has opposite signs at
  the two ends of the pair: the point where it changes sign, found by bisection of the derivative
  (computed from the formulas, not from differences). The derivative at an end of the pair is the one
  computed at that station, unless its size is at most 1e-12 times the largest size of that derivative
  over the member's stations, as at a fixed end, where it is exactly zero: then the derivative at 2⁻²⁰ of
  the pair's length inside the pair is taken in its place, and the bisection starts from that point. So
  an extreme between a fixed end and the next station is found (two tests). What is not found: the
  points of a pair in which the derivative changes sign an even number of times (twice, for example), and
  a change of sign within that 2⁻²⁰ of the pair's length next to such a station; more stations make the
  pairs shorter. Every value taken is the deflection at a point of the member, so a reported largest
  value is never above the true one and a reported smallest never below it.

#### `memberValues` returns `undefined`

when `result` is not an `ok` result; when it has no load case `loadCaseId`; when the model has no member
`memberId`; when the member's nodes, section or material are not in the model, or its nodes or end forces
not in the result; and for a member of kind `truss` or with an end release.

#### `deflectedShape`

Returns `{ loadCaseId, scale, stations, memberIds, points }`. `memberIds` are the member ids in the model's
order. `points` is one `Float64Array` with three global coordinates per point and `stations` points per
member, from the start node to the end node, equally spaced along the member: point s of member number m
(from 0) starts at index 3·(m·`stations` + s). A point is the point of the undeformed axis plus `scale`
times the deflection there (the deflection of "Deflections" above, the member's loads included); with
`scale` 0 the points are on the undeformed members. `stations` is read as in `memberValues`; there are no
extra points at point loads, because the deflection has no jump. The first and the last point of a member
are its nodes' positions plus `scale` times the nodes' displacements, up to rounding. It returns `undefined`
when `result` is not an `ok` result, when it has no load case `loadCaseId`, or when a member cannot be
computed for one of the reasons above other than its kind or a release.

#### Size and cost

The result of `memberValues` holds 7 arrays of `count` numbers and 2 of 3·`count`, the twelve extremes, the
axes and two ids. For 200 members at 21 stations without point loads that is 200 · 273 numbers, 436 800
bytes of `Float64Array`s in all; the deflected shape of 200 members at 21 points is one array of 100 800
bytes (both asserted in `src/memberValues.test.ts`).

Measured, not guaranteed: for the 200-member building frame of "Speed" below (load case `gravity`, 21
stations), calling `memberValues` for every member took 3.7 ms (median of 20 runs after 3 that were not
timed; smallest 3.4, largest 7.6) and one `deflectedShape` took 0.3 ms, on an Apple M4 Pro, macOS, Node
v22.23.4, on 2026-11-18, inside the test runner. The test suite asserts only a loose bound: both together
in under 1 second. Each call of `memberValues` searches the model's lists of members, nodes, sections,
materials and member loads; `deflectedShape` indexes them once per call.

### Illustrative member checks

Card S8, `src/memberChecks.ts`. Pure functions that take the model and what `solve` returned for it and
return plain data (strings, numbers, booleans, `null`, plain objects and arrays). They compute from
`memberValues` and from the node displacements of the result. None changes its arguments or keeps state;
none checks that `result` is the result of that `model`.

**These are not the checks of a design code.** They answer "how hard is each member working" with three
simple ratios. No design code is the basis of a limit: the allowable factor and the two divisors are
parameters of the caller with the defaults named below. Every result carries `kind: "illustrative"`.

- `memberChecks(model, result, loadCaseId, options?)`: the three checks for every member.
- `governingChecks(checks)`: the member with the largest ratio of each kind, from a `memberChecks` result.
- `structureChecks(model, result, loadCaseId, options?)`: `governingChecks(memberChecks(...))`.
- `spanDeflection(model, result, loadCaseId, memberIds, divisor = 360, stations = 21)`: the deflection of a
  beam made of several members in one line.

```ts
const result = solve(model);
const checks = memberChecks(model, result, "lc1", { allowableFactor: 1, deflectionDivisor: 360 });
if (checks) {
  checks.kind; // "illustrative"
  checks.notChecked; // ["member-buckling", "plate-buckling", ...]: what these checks leave out
  for (const member of checks.members) {
    member.stress.ratio; // largest |σ| / (fy · allowableFactor)
    member.stress.tension.value; // kN/m²; divide by 1000 for MPa
    member.deflection?.ratio; // a member that is not vertical
    member.drift?.ratio; // a vertical member
  }
  const governing = governingChecks(checks); // { stress, deflection, drift }, each { memberId, ratio, passes } or null
}
const span = spanDeflection(model, result, "lc1", ["AC", "CB"]); // { ok: true, value, ratio, ... } or { ok: false, reason }
```

#### What is not checked

`NOT_CHECKED` is the list, as stable codes for the interface to translate; `memberChecks` and
`structureChecks` return a copy of it as `notChecked`. In full:

| Code                          | Not checked                                                              |
| ----------------------------- | ------------------------------------------------------------------------ |
| `member-buckling`             | buckling of members (a column in compression is compared with `fy` only) |
| `plate-buckling`              | buckling of the plates of a section (local buckling)                     |
| `lateral-torsional-buckling`  | lateral-torsional buckling of beams                                      |
| `shear-stress`                | shear stress                                                             |
| `torsion-stress`              | torsion stress                                                           |
| `design-code-interaction`     | the interaction formulas of a design code                                |
| `load-and-resistance-factors` | load factors and resistance factors, other than the one allowable factor |
| `connections`                 | connections                                                              |
| `fatigue`                     | fatigue                                                                  |
| `other-serviceability`        | serviceability criteria other than the two limits (deflection and drift) |

The loads are used as the model gives them. The analysis behind the numbers has the limits of "Theory and
limits" above (linear-elastic, small displacements, no shear deformation).

#### Units

All values are in the model's units: a stress in **kN/m²**, a deflection, a drift, a length, a limit and a
position in **m**. Ratios have no unit. Nothing is converted: the interface divides a stress by 1000 for MPa
and multiplies a length by 1000 for mm.

#### Which members

Every member of kind `frame` without an end release that `memberValues` has values for gets one entry in
`members`, in the model's order. Every other member is in `skipped` with a reason: `"truss"`, `"release"`
(a frame member with any end release), or `"no-values"` (its nodes, section or material are not in the
model, or its nodes or end forces are not in the result). `memberChecks` returns `undefined` when `result`
is not an `ok` result or has no load case `loadCaseId`.

#### Options

| Option              | Default | Meaning                                                             |
| ------------------- | ------- | ------------------------------------------------------------------- |
| `allowableFactor`   | 1       | the allowable stress is the material's `fy` times this              |
| `deflectionDivisor` | 360     | n of the deflection limit span/n                                    |
| `driftDivisor`      | 300     | n of the drift limit height/n                                       |
| `stations`          | 21      | the number of equally spaced stations per member for `memberValues` |

A factor or divisor that is not a finite number greater than zero is replaced by its default. `stations` is
rounded down; a number below 5 is taken as 5, one above 1001 as 1001, and a value that is not finite as 21.
The values used are in the result (`allowableFactor`, `deflectionDivisor`, `driftDivisor`, `stations`).

#### The stress

The normal stress at the point (y, z) of a cross-section, in the member's local axes measured from its
axis, positive in tension:

σ = N/A − My·z/Iy − Mz·y/Iz

Where the signs come from: `N` is positive in tension. A positive `My` puts the −z side in tension ("The
sign convention of the internal actions"), and −My·z/Iy is positive for a negative z. A positive `Mz` puts
the −y side in tension, and −Mz·y/Iz is positive for a negative y. The formula holds for a section whose
centroid is on the member's axis and whose local y and z are principal axes, which "Theory and limits"
already assumes.

- **Where on the section.** At the four corners of the section's bounding rectangle, y = ±`depthY`/2 and
  z = ±`depthZ`/2: the section is taken as symmetric about both local axes. σ is linear in y and z, so its
  largest and smallest values over that rectangle are at corners. For a section that reaches its corners
  (a rectangle, the flange tips of an I-shape) these are stresses of the section. For one that does not (a
  round tube) no point of the section has them: where both moments act, the largest corner value is above
  every stress of the section and the smallest below.
- **Where along the member.** Over the whole length, not only at the stations. Between two consecutive
  stations the stress of one corner is a polynomial of degree two in x, because `N` is linear and the
  moments are of degree two there (the loads are uniform or at points, and every point load has stations).
  Its derivative, (dN/dx)/A − Vz·z/Iy − Vy·y/Iz, is linear; where it has opposite signs at the two
  stations, the point where it is zero and the stress there are computed in closed form and taken together
  with the station values. So the two extremes do not depend on the number of stations beyond rounding
  (tested with 5, 21 and 1001 stations at 1e-10), and the mid-span stress of a simply supported beam under
  a uniform load is M/W also when mid-span is not a station (tested at relative 1e-12).
- `stress.tension` is the largest value of σ and `stress.compression` the smallest, each as
  `{ value, x, y, z }`: the stress, the distance from the start node, and the corner's local coordinates.
  Of equal values the first position along the member is given, and there the first corner in the order
  (−y, −z), (+y, −z), (−y, +z), (+y, +z). So with bending about one axis only, the corner given is one of
  the two that share the value; in a bar under pure tension all corners and positions share it.
  `tension.value` is negative when no corner is in tension anywhere along the member, and
  `compression.value` is positive when none is in compression.
- `stress.largest` is the larger of |`tension.value`| and |`compression.value`|; `stress.allowable` is
  `fy` times the allowable factor; `stress.ratio` is `largest`/`allowable`; `stress.passes` is
  `ratio <= 1`. Tension and compression are compared with the same allowable stress.
- The corner is in local axes. Which side that is in space depends on the member's direction and roll:
  a corner (y, z) is at y·(local y) + z·(local z) from the axis, with the axes of `memberLocalAxes`.

#### The deflection of a member

For a member that is **not vertical**. With d(x) the deflection of the member's axis in local axes
(`memberValues`), the relative deflection is

r(x) = d(x) − [d(0) + (x/L)·(d(L) − d(0))]

which is what remains when the straight line between the member's two displaced ends (the chord) is taken
away. `deflection.value` is the largest, over the stations, of √(r_y² + r_z²): the part perpendicular to
the member's undeformed axis. `deflection.x` is the station that has it (the first of equal ones), and
`deflection.localY`, `deflection.localZ` are r_y and r_z there. `span` is the member's length, `limit` is
`span`/`divisor`, `ratio` is `value`/`limit`, and `passes` is `ratio <= 1`.

- **A movement of the whole member is not in it**: the sway of a frame, the settlement of both ends, and a
  rotation of the member as a rigid body leave r unchanged. What is left is the bending of the member
  between its two ends.
- **It is taken at stations only.** The value is never above the true largest value of √(r_y² + r_z²)
  along the member, and it is below it by at most h²·κ/8, with h the largest distance between two
  consecutive stations and κ the largest curvature along the member, √((My/(E·Iy))² + (Mz/(E·Iz))²). With
  the default 21 stations the mid-span of a member is a station, so the simply supported beam under a
  uniform load has exactly 5wL⁴/(384EI) (tested at relative 1e-12).
- **For a cantilever it is not the tip deflection.** The chord of a cantilever runs from the fixed end to
  the displaced tip, and the value is the distance of the bent axis from that line, which is zero at both
  ends. For a tip load it is PL³/(9√3·EI) at 0.42 L from the fixed end, 0.192 of the tip deflection
  PL³/(3EI); for a uniform load it is 0.0197·wL⁴/(EI) at 0.37 L, 0.1575 of the tip deflection wL⁴/(8EI). So
  for a cantilever the ratio of this check is far below the ratio of the tip deflection to the limit. These
  functions do not report a tip deflection relative to the fixed end; the node displacements of `solve` hold
  it.
- **It is the member's own length.** For a beam that is modelled as several members between its supports,
  each member is measured from its own chord over its own length, and that is smaller than the deflection of
  the span: for one half of a simply supported beam cut at mid-span it is between 0.2 and 0.3 of the span's
  mid-span deflection (tested). Use `spanDeflection` for such a beam.
- An inclined member is not vertical and gets this check, over its own length along the incline.

#### The drift of a vertical member

A member is **vertical** by the rule of `memberLocalAxes` (`packages/model/src/geometry.ts`): the horizontal
projection of its length is at most `VERTICAL_TOLERANCE` (1e-9) times its length. `MemberCheck.vertical`
says which a member is; a vertical member has `drift` and `deflection: null`, any other member `deflection`
and `drift: null`.

`drift.dX` and `drift.dY` are the end node's displacement minus the start node's along global X and Y, from
the result of `solve`; `drift.value` is √(dX² + dY²). `height` is the member's length, `limit` is
`height`/`divisor`, `ratio` is `value`/`limit`, `passes` is `ratio <= 1`. It is the drift of one member
between its two nodes: a column modelled as several members has one drift per member, and no drift of a
whole storey or building is computed.

#### `passes`

`passes` is `ratio <= 1` on the computed number, with no tolerance: a ratio that rounding puts just above 1
does not pass.

#### The governing ratios

`governingChecks(checks)` returns `{ kind, loadCaseId, notChecked, stress, deflection, drift }`. Each of the
last three is `{ memberId, ratio, passes }` for the member with the largest ratio of that kind (of equal
ratios, the first member in the model's order), or `null` when no checked member has that ratio: `drift`
is `null` for a model without vertical members. The deflection ratio is that of single members;
`spanDeflection` is separate. `structureChecks` returns `undefined` when `memberChecks` does.

#### `spanDeflection`

For a beam made of several members in one straight line: a span between supports modelled with intermediate
nodes. `memberIds` are its members in order from one end to the other. Each member may be drawn either
way: the walk goes from member to member through the node they share, and the span's start node is the end
of the first member that the second does not share (the first member's start node when it is the only one).

At each station of each member (`stations` equally spaced ones per member, read as in "Options", plus those
`memberValues` adds at point loads), the straight line between the displacements of the span's two end
nodes, D0 + (s/S)·(D1 − D0), is subtracted from the deflection in global axes; s is the station's distance
from the start node along the span and S the span, the distance between the two end nodes. `value` is the
largest size of the part of that difference perpendicular to the span. It is taken at stations only, so it
is never above the true largest value. The result also has `memberId` and `x` (the member and the distance
from its start node of the station with the value; of equal values the first station along the span),
`distance` (s of that station), `span`, `divisor`, `limit` = `span`/`divisor`, `ratio`, `passes`,
`startNodeId`, `endNodeId`, `memberIds` and `kind: "illustrative"`. A `divisor` that is not a finite number
greater than zero is taken as 360.

The span may have any direction; for a span that is not horizontal the deflection is still measured
perpendicular to it. The function does not look at the supports: it measures between the two end nodes of
the list it is given, whether or not they are supported. Given one member that is not vertical, `value` is
the `deflection.value` of that member's own check, up to rounding.

It refuses with `{ ok: false, reason, memberId? }`:

| `reason`          | When                                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| `no-result`       | `result` is not an `ok` result or has no load case `loadCaseId`                                      |
| `no-members`      | `memberIds` is empty                                                                                 |
| `repeated-member` | an id is in the list twice (`memberId`: that id)                                                     |
| `unknown-member`  | the model has no member with that id (`memberId`)                                                    |
| `no-values`       | `memberValues` has no values for a member: a truss member, an end release, missing data (`memberId`) |
| `not-connected`   | a member has neither end at the node where the member before it ended (`memberId`: the later member) |
| `not-collinear`   | the members are connected but not in one straight line running one way (`memberId` below)            |

Collinear means: no node of the span is further than `COLLINEAR_TOLERANCE` (1e-9) times the span from the
line between its two end nodes, and each node is further along that line than the node before it. The
`memberId` of `not-collinear` is the first member whose far node fails this, or the second member (the only
one, for a list of one) when the walk ends where it started.

#### A worked example

The simply supported beam fixture: 6 m, 10 kN/m downward, the section of the fixtures (`Iy` = 8.4e-5 m⁴,
`depthZ` = 0.3 m), `fy` = 3.55e5 kN/m², E = 2.1e8 kN/m². The stress, the deflection, the limit and the two
ratios of this table are asserted in `src/memberChecks.test.ts`.

| Quantity                         | By hand                         | Model units     | Display units |
| -------------------------------- | ------------------------------- | --------------- | ------------- |
| mid-span moment                  | wL²/8                           | 45 kN·m         | 45 kN·m       |
| section modulus W                | Iy/(depthZ/2) = 8.4e-5/0.15     | 5.6e-4 m³       |               |
| `stress.tension.value` (bottom)  | M/W                             | 80 357.1 kN/m²  | 80.36 MPa     |
| `stress.compression.value` (top) | −M/W                            | −80 357.1 kN/m² | −80.36 MPa    |
| `stress.ratio`                   | 80 357.1/355 000                | 0.2264          |               |
| `deflection.value`               | 5wL⁴/(384EI) = 64 800/6 773 760 | 9.566e-3 m      | 9.57 mm       |
| `deflection.limit`               | 6/360                           | 1.6667e-2 m     | 16.67 mm      |
| `deflection.ratio`               | 9.566e-3/1.6667e-2              | 0.5740          |               |

The tension is at x = 3 m at the corner z = −0.15 m, which is the bottom face for this member (local z is
global Z); the compression is at z = +0.15 m.

#### Cost

Measured, not guaranteed: `memberChecks` for the 200-member building frame of "Speed" below (load case
`gravity`, 21 stations) took 4.4 ms (median of 20 runs after 3 that were not timed; smallest 3.8, largest
9.1), on an Apple M4 Pro, macOS, Node v22.23.4, on 2026-11-18, inside the test runner. `governingChecks` of
that result took about 0.01 ms. The test suite asserts only a loose bound: `memberChecks` and
`structureChecks` together in under 1 second. `memberChecks` calls `memberValues` once per member, and each
of those calls searches the model's lists.

## In a Web Worker

`solve` is synchronous: while it runs, the thread that called it does nothing else. An application calls it
in a worker so that the page stays responsive. The package has four parts for that, one file each.

| File              | Import                                          | What it is                                                                  |
| ----------------- | ----------------------------------------------- | --------------------------------------------------------------------------- |
| `src/messages.ts` | `@bridle/solver` (types and guards)             | `SolveRequest`, `SolveResponse`, `isSolveRequest`, `isSolveResponse`.       |
| `src/handler.ts`  | `@bridle/solver`                                | `handleSolveRequest(request)`: one request in, one response out; no worker. |
| `src/worker.ts`   | `@bridle/solver/worker`                         | The worker entry: wires the handler to `self.onmessage` and `postMessage`.  |
| `src/client.ts`   | `@bridle/solver/client` (also `@bridle/solver`) | `createSolverClient(makeWorker)`, for the main thread.                      |

`@bridle/solver/client` imports types and one guard only, so importing it does not put the solver's code in
the bundle of the main thread; importing the client from `@bridle/solver` leaves that to the bundler.

### Use

```ts
import { createSolverClient } from "@bridle/solver/client";

const client = createSolverClient(
  () => new Worker(new URL("@bridle/solver/worker", import.meta.url), { type: "module" }),
);

const outcome = await client.solve(model); // never rejects
if (outcome.status === "solved") {
  outcome.result; // what solve(model) returns: results (`ok: true`) or a refusal (`ok: false`)
} else if (outcome.status === "failed") {
  outcome.failure; // "solve-threw", "worker-error" or "not-sent"
} // else "superseded" (a newer call was made) or "disposed": nothing to show

client.dispose(); // when the page or the component goes away
```

The package is TypeScript source (its `exports` name `src/*.ts`), like `@bridle/model`, so the application's
bundler must compile it: in `apps/web`, `@bridle/solver` has to be added to the dependencies and to
`transpilePackages` of `next.config.mjs`. **This card did not create a worker in `apps/web` or in a
browser** (that is card W8). What is tested here: the entry bundled by Vite into one file with no import,
run in a Node worker thread (`src/worker.test.ts`), and, by the type check, that a DOM `Worker` is accepted
by `createSolverClient`. If the bundler of `apps/web` does not resolve a package name inside `new URL(...)`,
put a one-line file next to the code that makes the worker, `solver.worker.ts` with
`import "@bridle/solver/worker";`, and use `new Worker(new URL("./solver.worker.ts", import.meta.url), { type: "module" })`.

### Messages

- Request, main thread to worker: `{ type: "solve", id, model }`. `id` is a number chosen by the sender.
- Response, worker to main thread, with the request's `id`: `{ type: "solve-result", id, result }`, where
  `result` is what `solve(model)` returned (results or a refusal; a refusal is an answer, not an error), or
  `{ type: "solve-error", id, error: { name, message } }` when `solve` threw. `solve` returns a refusal for
  an invalid model and does not throw for it; it throws for a value that is not a model at all (a test
  sends `{}`).
- `handleSolveRequest(request)` returns `{ response, transfer }`. `transfer` lists the buffers of the two
  `Float64Array`s of every load case of a solved result, each once, and is empty otherwise. The worker
  entry posts the response with that list, so the vectors are moved to the main thread, not copied; the
  records (`displacements`, `reactions`, `memberEndForces`) and the model in the request are copied by the
  structured clone of `postMessage`.
- The worker entry ignores a message that is not a request (`isSolveRequest`), and the client ignores one
  that is not a response with the `id` of the request the worker has not answered yet (`isSolveResponse`).

### The client

`createSolverClient(makeWorker)` returns `{ solve(model), dispose() }`. `makeWorker` is called when a worker
is needed, not before: at the first `solve` call and at the first one after a worker error.

- **One worker at a time.** It is reused by every call. Its `onmessage`, `onerror` and `onmessageerror`
  properties are set when it is made and set to `null` when the client lets go of it; the client adds no
  other listener.
- **Latest wins.** When `solve` is called while an older call has no answer yet, the older promise resolves
  at once with `{ status: "superseded" }`, and the answer to its request, when it comes, is dropped.
- **The worker is not terminated for a superseded request.** It finishes the request it is computing. The
  client does not post the newer model while the worker is busy: it keeps only the newest one and posts it
  when the worker answers. So, however many calls arrive while the worker is busy (a drag in the interface
  could make one per pointer event), the worker computes at most one request that nobody waits for, and the newest
  call waits at most for the rest of that one before its own starts. Why not terminate and start a new
  worker: a new worker has to load and compile the solver again before it can start, and that would be
  paid at every superseded call; with solves of the size in "Speed" below (medians of 7 to 76 ms measured), waiting
  for the one in progress costs at most one such solve. The start time of a worker in a browser was not
  measured in this card. What this choice does not cover: a `solve` call that never ends would block the
  worker for good; the client has no timeout.
- **Failures.** `{ status: "failed", failure }`, with `failure.kind`:
  `"solve-threw"` (`error: { name, message }`; the worker answered with `solve-error`; the worker is kept);
  `"worker-error"` (`message`; the worker reported an error or a message that could not be read, or
  `makeWorker` threw; that worker is terminated and the next call makes a new one);
  `"not-sent"` (`message`; `postMessage` threw, for example for a model that cannot be cloned; the worker is kept).
  If the worker fails while it computes a superseded request, the newest call is not failed: it is posted
  to a new worker.
- **`dispose()`** terminates the worker and resolves a waiting call with `{ status: "disposed" }`. A
  `solve` call made after it resolves with `disposed` and makes no worker. A second `dispose()` does
  nothing.
- A promise of `solve` never rejects.

## Speed

`pnpm --filter @bridle/solver bench` bundles `src/bench.ts` with Vite (not minified), runs it in Node and
prints, for four models, the median, the smallest and the largest time of 15 calls of `solve` after 3 calls
that are not timed. The models are generated without random numbers (`buildingFrame` and `cantilever` in
`src/bench.ts`): two building frames with fixed column bases and two load cases (a uniform load on every
beam; nodal wind loads), and a 10 m cantilever cut into 200 members with a tip load.

Measured on one machine on one date: Apple M4 Pro, macOS (darwin arm64), Node v22.23.4, 2026-11-18, one run
of the script. These are measurements, not guarantees; another machine, a browser, or the same machine
under load gives other numbers.

| model                                     | members | nodes | free dofs | load cases | median ms | min ms | max ms | smallest pivot ratio |
| ----------------------------------------- | ------- | ----- | --------- | ---------- | --------- | ------ | ------ | -------------------- |
| frame, 3 x 3 bays, 5 storeys              | 200     | 96    | 480       | 2          | 6.9       | 6.1    | 22.8   | 8.93e-4              |
| frame, 3 x 3 bays, 10 storeys             | 400     | 176   | 960       | 2          | 30.4      | 28.9   | 31.8   | 5.47e-4              |
| cantilever, 200 elements, along X         | 200     | 201   | 1200      | 1          | 11.5      | 10.3   | 42.3   | 3.12e-8              |
| cantilever, 200 elements, along (2, 3, 6) | 200     | 201   | 1200      | 1          | 76.1      | 75.0   | 81.0   | 6.37e-9              |

- The target of the pitch plan, a frame of 200 members in under 100 ms on the development machine, is met
  by this measurement: 200 members took 6.9 ms (median).
- **The cost grows steeply with the number of free degrees of freedom.** The matrices are dense (no band or
  sparse storage): the memory grows with the square of the number of nodes (the assembled matrix alone is
  8 · (6 · nodes)² bytes), and the time of a dense factorization grows, at worst, with the cube of the
  number of free degrees of freedom. In the table, twice the degrees of freedom (480 to 960) took about
  four times as long.
- The number of members is not what decides the time: the two cantilevers have 200 members and the same
  1200 free degrees of freedom, and the skew one took six to seven times as long as the one along X. This
  card did not examine why; the review of card S3 put it down to how much the pivoted order fills the
  factor. The skew cantilever, 201 nodes, is already near 100 ms; larger models were not measured, and a
  model with more nodes than these (a member cut into many pieces, for example) can be expected to exceed
  100 ms.
- The time is that of `solve` alone. In a worker, the copy of the model to the worker and of the result
  back is added; it was not measured.

The test suite asserts only a loose bound, so that it cannot fail on a slow machine: the 200-member frame
in under 2 seconds (median of 5 calls, `src/bench.test.ts`).

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

Values along a member (card S6): `src/memberValues.test.ts`. The tolerances are stated in the tests;
"relative 1e-12" and the zero rule are as above. The section and material are those of the fixtures.

- Stations and shape of the result: 21 stations by default; how the number is read; two stations at a
  point load between stations, on a station, at position 0, at the length and within the slack past an
  end; loads at one position merged; the positions of `at`; `structuredClone`; the arguments unchanged;
  the cases that return `undefined`.
- The simply supported beam fixture as one member, at relative 1e-12: `My` = wL²/8 at mid-span and 3wL²/32
  at the quarter points, `Vz` = ±wL/2 at the ends, deflections 5wL⁴/(384EI) and 57wL⁴/(6144EI), and the
  formulas of M, V and the deflection at every station; the same in the other plane (load along −Y:
  positive `Mz`, E·Iz); a load along +Y and an upward load (negative moments); the beam drawn from right
  to left and along +Y; roll angles of 90 and 180 degrees; the mid-span extremes found with 4 stations.
- Cantilevers at every station: under a uniform load and under a tip load given as a nodal load and as a
  point load at the length; a tip load in the other plane; an axial pull, a push and a torque; an axial
  uniform load.
- A beam fixed at both ends (no node moves, so the deflection is the second part alone): uniform load
  (−wL²/12, +wL²/24, zero moment at L(1/2 ± √3/6), deflection at every station); the deflection at 1e-6 · L
  from each end equals M·h²/(2EI) with M the end moment, at relative 1e-5, in both planes, for uniform and
  point loads (zero value and zero slope at the ends); an off-centre point load in both planes; a bar held
  at both ends under an axial uniform load and an axial point load.
- Extremes next to a fixed end, where the derivative of the deflection is zero at the station: a
  cantilever with a tip load of 10 kN down and 3.4 kN/m upward (largest uz 6.27785e-7 m at 0.236884 m,
  with 21, 5 and 2 stations, and with the member reversed) and a fixed-fixed member with a point load
  0.336 m from an end, both at relative 1e-9 against the hand formulas; a fixed end that is itself the
  extreme (value 0 at position 0). The clamp of `stations` at 1001.
- Extremes between stations: a simply supported beam with a point load at 4 m of 6 m (shear jump, largest
  moment Pab/L under the load, largest deflection Pb(L² − b²)^1.5/(9√3·L·EI) at √((L² − b²)/3) from the far
  end, position at relative 1e-9) and its mirror; a propped cantilever under a uniform load (largest
  sagging moment 9wL²/128 at 5L/8 from the fixed end, largest deflection at 0.4215 L from the roller), in
  both planes; a uniform load with a point load.
- Inclined members and columns: the member from (0, 0, 0) to (3, 0, 4) under a global vertical load (`N`
  from −20 to +20 kN, `My` = 15x − 3x²); a cantilever column running upward and one running downward under
  wind along +X (opposite signs of `My`, the same side when drawn, the same sway) and along +Y; a column
  under vertical loads (compression whichever way it runs).
- The ends against the end forces: the table of "The relation to the member end forces" on a space frame
  of three skew members with roll angles of 40, −25 and 110 degrees, with point loads at position 0 and at
  the length; a nodal load against a point load at position 0.
- Frames: on the portal frame fixture with a beam load, a wind load and three point loads, and on the
  space frame, every station of every member is in equilibrium with the end node's end force and the loads
  beyond the station (within 1e-12 · 300 kN·m; `memberValues` computes from the start, so this uses the
  other end), and a check that this fails for an end force changed by 1e-6; moment continuity at the two
  joints of the portal; the portal under a beam load alone (hogging at the joints, sagging at mid-span,
  tension on the outer face at the column tops).
- Against a finer model, at 1e-9 of the largest value: for a skew rolled member with uniform and point
  loads in local and global axes, the deflections and the six actions at its eighth points equal the node
  displacements and the end forces of the same member cut into eight pieces (the reference carries the
  point loads as nodal loads).
- `deflectedShape`: the beam fixture with 5 points and a scale of 100, and with a scale of 0; the space
  frame (order, ends at the displaced nodes, agreement with `memberValues`); load cases kept apart; a
  truss member drawn as a straight line.
- Size and a loose time bound for 200 members ("Size and cost").

Illustrative member checks (card S8): `src/memberChecks.test.ts`. The tolerances are stated in the tests;
"relative 1e-12" and the zero rule are as above. The section and material are those of the fixtures unless
a test says otherwise.

- The result: the `illustrative` marker, the ten codes of `notChecked`, the parameters used and their
  defaults, options that are not valid, plain data, arguments unchanged, the cases that return `undefined`,
  the three reasons of `skipped`.
- The simply supported beam fixture: σ = M/W at mid-span with tension at the bottom and compression at the
  top, and the deflection ratio (5wL⁴/384EI)/(L/360), at relative 1e-12; the same stress with 6, 8 and 1000
  stations, where mid-span is not a station; the other bending plane (a load along −Y, `Iz`); a roll of 90
  degrees (the weak axis governs, the tension corner is below the axis); the beam drawn both ways with
  five roll angles under gravity and under a load along +Y (the tension corner is on the side the load
  pushes towards).
- The largest stress between stations: a beam with a uniform transverse load and a uniform load along its
  axis (the extremes are at L/2 ∓ p·Iy/(A·w·c), exact with 5, 21 and 200 stations); a point load between
  stations; a skew rolled member fixed at both ends under six loads (5, 21 and 1001 stations agree at
  1e-10, and bound a calculation in the test from `N`, `My`, `Mz` at 1001 stations).
- Cantilevers: tension at the top at the fixed end under a uniform load; the deflection from the chord for
  a tip load against P(2L²x − 3Lx² + x³)/(6EI) at the stations, against the true largest value PL³/(9√3·EI)
  with the bound h²·κ/8, and for a uniform load; axial force and bending together (the two extremes differ
  by 2M/W and their mean is N/A); a push larger than the bending; a bar in pure tension; eight cantilevers
  along X, along Y, skew, inclined and vertical with roll angles under a tip force in a general direction
  (the stresses at the fixed end and the side of the tension corner, at 1e-9).
- Biaxial bending: the governing corner and its value, and the deflection as the hypotenuse of the two
  planes' values.
- The portal frame fixture with a beam load: the drift of each column equals the solver's displacement of
  its top node; the beam's deflection from the chord against the deflection of a simply supported beam
  under the load and the solver's two end moments (1e-9); `structureChecks` and `governingChecks`.
- Vertical members: a cantilever column with tip forces along X and Y, running upward and downward; the
  vertical rule at a lean of 5e-10 and of 2e-9 of the length; the stress of a column.
- The ratio at exactly 1: a yield strength and a depth chosen by hand (1e-12); `fy` set to the reported
  stress (exactly 1, passes) and one bit below (does not pass); the allowable factor; the divisors.
- `spanDeflection`: two collinear members with the load across both against 5wL⁴/(384EI), for both
  directions of each member and both orders of the list; a node at a third of the span; a member's own
  check against its own chord; one member; the portal's beam cut in three unequal pieces, one of them
  reversed, against the uncut beam at the same stations; a vertical span; the seven reasons of a refusal.
- The reference models of the three seeded tasks, rebuilt in the test without importing `packages/tasks`
  (the generic I-sections' formulas and dimensions are typed in the test from
  `packages/tasks/src/sections.ts`): the 7 m beam with "I 400x180" under 25 kN/m (bending stress
  135 253.65 kN/m², span deflection ratio 0.845), the 6 m beam, and the portal frame.
- The 200-member frame: every member checked in both load cases, and the loose time bound.

Worker (card S9), four files:

- `src/handler.test.ts`, without a worker: the response has the request's id and equals a direct `solve`;
  the transfer list has the two buffers of each of two load cases, each once; after
  `structuredClone(response, { transfer })` the copy equals a direct `solve` and the sender's arrays are
  empty; a refusal has nothing to transfer; a thrown `Error` and a thrown string become `solve-error`; the
  real `solve` given `{}` throws and becomes `solve-error`; the request's model is not changed; the two
  guards.
- `src/client.test.ts`, with a fake worker object whose messages and errors the test delivers: no worker
  before the first call; the request posted; one worker reused with ids 1, 2, 3; messages that are not the
  awaited response ignored; the superseded outcome at once, the worker not terminated, the newer request
  posted only after the older answer, and of 50 calls made while the worker is busy only the first and the
  last posted; a response with another id does not free the worker; `solve-error`; a worker error (call
  failed, worker terminated, handlers removed, a new worker at the next call); `messageerror`; a worker
  error during a superseded request; a worker error with no call waiting; `makeWorker` throwing;
  `postMessage` throwing; `dispose` with a waiting call, with a superseded and a waiting call, twice, and
  before any call. The type check of this file checks that a DOM `Worker` is accepted.
- `src/worker.test.ts`, across a real thread boundary: `src/worker.ts` is bundled with Vite and run in a
  `node:worker_threads` worker, with a few lines of glue that give the thread `self`, `postMessage` and the
  delivery to `self.onmessage`. The bundle is one file with no `import` and no `require`. Through the real
  client: the portal frame fixture's result equals a direct `solve` (the vectors are `Float64Array`s with
  the same numbers); one thread answers several calls, a refusal among them, and a superseded call; `{}`
  as the model comes back as `solve-threw` and the thread still answers the next call.
- `src/bench.test.ts`: the four models of the speed test are valid and have the sizes of the table; the
  generators give equal models on every call; the 200-member frame is in equilibrium in both load cases
  (sums of the reactions against the total loads, 1e-9); the cantilever's tip deflection is P L³/(3 E Iy)
  along X and along (2, 3, 0), at relative 1e-7; the loose speed bound.
