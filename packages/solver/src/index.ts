/**
 * `@bridle/solver`: the linear-elastic 3D frame solver of the showcase. So far (pitch cards S2 and
 * S3): the frame element's stiffness matrix, its transformation, the assembly of the global
 * stiffness matrix, and the solve for supports and nodal loads (displacements and reactions).
 * Theory, units and sign conventions are in ../README.md and ./element.ts.
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
export { type Factorization, type FactorizeResult, factorize, solveFactorized } from "./factor";
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
export {
  type LoadCaseResult,
  type NodeDisplacement,
  type NodeReaction,
  PIVOT_THRESHOLD,
  REACTION_COMPONENTS,
  type SolveResult,
  solve,
  type UnsupportedMemberLoad,
} from "./solve";
