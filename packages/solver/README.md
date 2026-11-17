# @bridle/solver

The linear-elastic 3D frame solver of the showcase (`docs/plan/pitch-plan.md`). So far it has the work of
pitch card S2: the stiffness matrix of a 3D frame element in local axes, its transformation to global axes,
and the assembly of the global stiffness matrix of a model. It applies no supports and no loads and solves
nothing yet (cards S3 and S4).

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

| Function                                                                                            | What it returns                                                                                                                  |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `elementStiffnessLocal(properties)`                                                                 | The 12 by 12 stiffness matrix in local axes. Inputs are not checked.                                                             |
| `elementTransformation(axes)`                                                                       | The 12 by 12 matrix T with u_local = T u_global: four copies of the 3 by 3 matrix whose rows are the local x, y, z unit vectors. |
| `elementStiffnessGlobal(kLocal, T)`                                                                 | Tᵀ k T, the element matrix in global axes.                                                                                       |
| `assemble(model)`                                                                                   | The global stiffness matrix, the degree-of-freedom map and one `MemberElement` per member, or a refusal (below).                 |
| `unsupportedMembers(model)`                                                                         | The members `assemble` refuses as not supported yet.                                                                             |
| `buildDofMap(nodes)`, `dofIndex(map, nodeId, dof)`, `memberDofIndices(map, startNodeId, endNodeId)` | The numbering of the global rows.                                                                                                |
| `zeros`, `fromRows`, `at`, `addAt`, `transpose`, `multiply`, `multiplyVector`, `maxAbs`             | Helpers for the `Matrix` type.                                                                                                   |

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

`validateModel` does not check that every number is finite. For a member whose local axes cannot be computed
(an infinite coordinate, for example) `assemble` throws an `Error`.

The element matrix in global axes, and so the assembled matrix, is symmetric up to floating-point rounding
of the product Tᵀ k T, not always exactly; the local matrix is exactly symmetric.

## Tests

`src/index.test.ts`. The tolerances are stated in the tests. Among them: the local matrix against the
textbook terms for an element with round numbers; the cantilever tip deflection and slope formulas in both
bending planes; for eight orientations (along X, along Y, vertical upward and downward, skew, and three with
a roll angle of 30 degrees) the global element matrix times each of the six rigid-body motions; a check that
this rigid-body test fails for a matrix with the sign of one bending plane reversed; the orthogonality of
the transformation; a member along global Y against the local matrix with its axes permuted; two collinear
elements at their shared node; the symmetry of the portal frame's assembled matrix.
