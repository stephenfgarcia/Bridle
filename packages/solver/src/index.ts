/**
 * `@bridle/solver`: the linear-elastic 3D frame solver of the showcase. So far (pitch card S2): the
 * frame element's stiffness matrix, its transformation, and the assembly of the global stiffness
 * matrix. Theory, units and sign conventions are in ../README.md and ./element.ts.
 */
export {
  type AssembleResult,
  assemble,
  type MemberElement,
  type UnsupportedFeature,
  type UnsupportedMember,
  unsupportedMembers,
} from "./assemble";
export {
  buildDofMap,
  DOFS,
  DOFS_PER_NODE,
  type Dof,
  type DofMap,
  dofIndex,
  memberDofIndices,
} from "./dof";
export {
  ELEMENT_DOFS,
  type ElementProperties,
  elementStiffnessGlobal,
  elementStiffnessLocal,
  elementTransformation,
  LOCAL_DOF,
} from "./element";
export {
  addAt,
  at,
  fromRows,
  type Matrix,
  maxAbs,
  multiply,
  multiplyVector,
  transpose,
  zeros,
} from "./matrix";
