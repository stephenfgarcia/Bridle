# @bridle/model

The types of a structural model, its validation, its JSON format and three fixture models (pitch card S1,
`docs/plan/pitch-plan.md`). Plain TypeScript with no runtime dependency. It does no analysis: the solver
(`packages/solver`, cards S2 onwards) builds on these types.

```ts
import { parseModel, portalFrame, serializeModel, validateModel } from "@bridle/model";

const model = portalFrame();
validateModel(model); // [] for a valid model
const text = serializeModel(model);
const result = parseModel(text); // { ok: true, model } or { ok: false, issues }
```

Run the tests with `pnpm --filter @bridle/model test`, the type check with `pnpm --filter @bridle/model typecheck`;
`pnpm check` runs both through turbo.

## Conventions

### Global axes

Right-handed, **Z up**. Gravity acts along **minus Z**: a downward force has a negative Z component.

### Units stored in a model

| Quantity                                            | Unit    |
| --------------------------------------------------- | ------- |
| Force                                               | kN      |
| Length, coordinates, section depths, load positions | m       |
| Moment                                              | kN·m    |
| Distributed load                                    | kN/m    |
| E, G, fy (and any stress)                           | kN/m²   |
| Area                                                | m²      |
| Second moment of area, torsion constant             | m⁴      |
| Roll angle                                          | degrees |
| Density                                             | kg/m³   |

`Model.units` is always `{ "force": "kN", "length": "m" }` (`MODEL_UNITS`); `parseModel` refuses anything else.

### Units the interface displays

The interface shows stress in **MPa** and deflection in **mm**; forces, lengths and moments are shown in the
stored units (kN, m, kN·m).

- Deflection: 1 m = 1000 mm. `packages/units` has this conversion: `LENGTH_IN_METRES.mm` is 0.001, so a
  deflection in mm is the stored value divided by `LENGTH_IN_METRES.mm`.
- Stress: 1 MPa = 1000 kN/m², so a stress in MPa is the stored value divided by 1000. `packages/units` has
  no stress conversion at the time of this card, so the factor is stated here.

This package converts nothing itself.

### Member local axes

Defined once, in `src/geometry.ts` (`memberLocalAxes`, covered by tests); in words:

- **Local x** runs from the start node to the end node.
- **Roll 0, member not vertical:** local y is horizontal, along (global Z) × (local x); local z = (local x) ×
  (local y), which lies in the vertical plane through the member and points upward. A member along global +X
  has local axes equal to the global axes.
- **Roll 0, vertical member** (horizontal projection at most `VERTICAL_TOLERANCE` times the length): local y is
  global +Y, and local z = (local x) × (local y), which is global −X for a member that runs upward and global
  +X for one that runs downward.
- **Roll angle** (`rollAngleDeg`, degrees): rotates local y and z together about local x by the right-hand
  rule, counter-clockwise when seen from the end node looking back at the start node.

`Iy` and `Iz` are second moments of area about local y and local z. For a frame in the global X-Z plane whose
columns run upward and whose beams run along +X, every member with roll 0 has local y = global +Y, so
in-plane bending uses `Iy`. `depthZ` and `depthY` are the overall dimensions of the section along local z and
y.

### Supports, releases, loads

- A `Support` restrains a node along (`ux`, `uy`, `uz`) and about (`rx`, `ry`, `rz`) the global axes; `true`
  means restrained.
- A member's `releases.start` and `releases.end` are rotational releases about the member's local axes
  (`rx` torsion, `ry` and `rz` bending); `true` means released.
- A `NodalLoad` has six components in the global axes (`fx`, `fy`, `fz` in kN; `mx`, `my`, `mz` in kN·m). A node
  has no local axes, so its direction is always global.
- A `MemberUniformLoad` (kN/m over the whole member, per unit of the member's own length) and a
  `MemberPointLoad` (kN at `position` m from the start node) act along one axis: `axes` is `"global"` or
  `"local"`, `direction` is `"x"`, `"y"` or `"z"`, and `value` is signed along that axis.
- Every load names a `LoadCase` by `loadCaseId`. There are no load combinations.

### Ids

Ids are non-empty strings, unique within their own list: a node and a member may share an id, two nodes may
not. The three load lists are three lists. A support has no id; it is identified by its node.

## Validation

`validateModel(model)` returns a list of issues and an empty list for a valid model. Each issue has a `code`,
a `messageKey` (`model.issue.<code>`), the `ids` it concerns and, where it has a place, a `path` such as
`sections[0].A`. This package exports no text for a user: the message catalog (`packages/i18n`) does not hold
these keys yet; the card that first shows an issue on screen adds them.

| Code                           | Reported when                                                                                                                              | `ids`                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `duplicate-id`                 | an id appears a second time in one list                                                                                                    | the id                                                               |
| `duplicate-support`            | a node has a second support                                                                                                                | the node id                                                          |
| `missing-node`                 | a member, support or nodal load names a node that is not there                                                                             | member or load id, then the node id; for a support the node id alone |
| `missing-section`              | a member names a section that is not there                                                                                                 | member id, section id                                                |
| `missing-material`             | a member names a material that is not there                                                                                                | member id, material id                                               |
| `missing-member`               | a member load names a member that is not there                                                                                             | load id, member id                                                   |
| `missing-load-case`            | a load names a load case that is not there                                                                                                 | load id, load case id                                                |
| `non-finite-value`             | a number is NaN, Infinity or -Infinity (the list of numbers checked is below the table)                                                    | the id of the node, member, section, material or load                |
| `zero-length-member`           | a member's two ends are the same node, or closer than `ZERO_LENGTH_TOLERANCE` (1e-9 m)                                                     | member id                                                            |
| `non-positive-value`           | a section's `A`, `Iy`, `Iz`, `J`, `depthY` or `depthZ`, or a material's `E`, `G` or `fy`, is a finite number that is not greater than zero | section or material id                                               |
| `load-position-outside-member` | a point load's `position` is a finite number below 0 or beyond the member's length                                                         | load id, member id                                                   |
| `no-support`                   | no support on an existing node restrains anything                                                                                          | none                                                                 |

`non-finite-value` is checked for: a node's `x`, `y`, `z`; a member's `rollAngleDeg`; a section's `A`, `Iy`,
`Iz`, `J`, `depthY`, `depthZ`; a material's `E`, `G`, `fy`, `density`; a nodal load's six components; a uniform
load's `value`; a point load's `value` and `position`. The `path` names the field (`nodes[1].z`). A number that
is not finite gets this code only: it is not also reported as `non-positive-value` or
`load-position-outside-member`, and a member with such a coordinate at one of its nodes is not reported as
`zero-length-member`. A member whose length is not finite although its nodes' coordinates are (their difference
overflows a double) is reported with this code too, with the member's id and `members[i]` as the path.
`parseModel` accepts only finite numbers, so the check matters for a model built in code.

`validateModel` does not decide whether the structure is stable; that is the solver's job (`solve` of `packages/solver`).

## JSON format

The format is the `Model` type as JSON, with `"version": 1`. `serializeModel(model)` writes it with two-space
indentation and keys in a fixed order. `parseModel(text)` returns `{ ok: true, model }` or
`{ ok: false, issues }`; it checks the shape only, so a model in progress (one with no support yet, say) can
be saved and loaded, and `validateModel` is run on the result separately.

| Code                  | Reported when                                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `invalid-json`        | the text is not JSON                                                                                                         |
| `invalid-shape`       | a key is missing, a value has the wrong type, an id is empty, or there is a key the format does not have (`path` says where) |
| `unsupported-version` | `version` is a number other than 1                                                                                           |
| `unsupported-units`   | `units` is not exactly `{ "force": "kN", "length": "m" }`                                                                    |

`serializeModel` throws when the value passed does not have that shape (for example a coordinate that is NaN,
which JSON cannot hold).

## Fixtures

Each is a function that returns a new model, valid by `validateModel`, in kN and m. All three use one section
(`s1`, round illustrative values for a steel I-shape about 300 mm deep, not from a section table) and one
material (`mat1`: E = 2.1e8 kN/m², G = 8.1e7 kN/m², fy = 3.55e5 kN/m², 7850 kg/m³), and one load case `lc1`.

| Function                | Model                                                                                                                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `simplySupportedBeam()` | 6 m beam along X, one frame member, uniform load of 10 kN/m downward. `n1` holds `ux`, `uy`, `uz`, `rx`; `n2` holds `uy`, `uz`.                                                                                                 |
| `portalFrame()`         | In the X-Z plane, 6 m wide and 4 m high, three frame members, both bases fixed, 20 kN along +X at the top of the left column.                                                                                                   |
| `planarTruss()`         | In the X-Z plane, span 12 m, height 4 m, five nodes, seven truss members, 20 kN downward on each top node. `n1` holds `ux`, `uy`, `uz`; `n3` holds `uy`, `uz`; the other three nodes hold `uy` only. No rotation is restrained. |
