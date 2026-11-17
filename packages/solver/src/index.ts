/**
 * `@bridle/solver`: the linear-elastic 3D frame solver of the showcase. So far (pitch cards S2 to
 * S4): the frame element's stiffness matrix, its transformation, the assembly of the global
 * stiffness matrix, and the solve for supports, nodal loads and member loads (displacements,
 * reactions and member end forces). Theory, units and sign conventions are in ../README.md,
 * ./element.ts and ./memberLoads.ts.
 *
 * Card S6: the values along a member (./memberValues.ts): internal actions, deflections, extremes
 * and the deflected shape.
 *
 * Card S8: the illustrative member checks (./memberChecks.ts): the elastic normal stress against
 * the yield strength, the deflection against span/n and the drift against height/n. They are not
 * the checks of a design code.
 *
 * Card S9: the messages, the handler and the client for running `solve` in a worker. The worker
 * entry is not exported here: it is `@bridle/solver/worker` (./worker.ts), and the client is also
 * `@bridle/solver/client` (./client.ts), which does not import the solver's code.
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
  createSolverClient,
  type SolveOutcome,
  type SolverClient,
  type SolverFailure,
  type SolverWorker,
  type SolverWorkerEvent,
} from "./client";
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
export { type HandledRequest, handleSolveRequest, transferList } from "./handler";
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
  COLLINEAR_TOLERANCE,
  DEFAULT_ALLOWABLE_FACTOR,
  DEFAULT_DEFLECTION_DIVISOR,
  DEFAULT_DRIFT_DIVISOR,
  type DeflectionCheck,
  type DriftCheck,
  type GoverningRatio,
  governingChecks,
  type MemberCheck,
  type MemberCheckOptions,
  type MemberChecks,
  MIN_CHECK_STATIONS,
  memberChecks,
  NOT_CHECKED,
  type NotChecked,
  type SkippedReason,
  type SpanDeflection,
  type SpanDeflectionRefusal,
  type StressAtCorner,
  type StressCheck,
  type StructureChecks,
  spanDeflection,
  structureChecks,
} from "./memberChecks";
export {
  equivalentNodalLoadsLocal,
  isMemberPointLoad,
  type MemberLoad,
  memberLoadLocalComponents,
} from "./memberLoads";
export {
  DEFAULT_STATIONS,
  type DeflectedShape,
  deflectedShape,
  MAX_STATIONS,
  MEMBER_QUANTITIES,
  type MemberExtreme,
  type MemberQuantity,
  type MemberValues,
  memberValues,
} from "./memberValues";
export {
  isSolveRequest,
  isSolveResponse,
  type SolveErrorInfo,
  type SolveRequest,
  type SolveResponse,
} from "./messages";
export {
  type LoadCaseResult,
  type MemberEndAction,
  type MemberEndForces,
  type NodeDisplacement,
  type NodeReaction,
  PIVOT_THRESHOLD,
  REACTION_COMPONENTS,
  type SolveResult,
  solve,
} from "./solve";
