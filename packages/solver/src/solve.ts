/**
 * The linear static solve: supports, nodal loads, displacements and reactions, for every load case
 * of a model. Units and signs are those of ./element.ts and ../README.md.
 */
import type { Model, ModelIssue } from "@bridle/model";
import { assemble, type UnsupportedMember, unsupportedMembers } from "./assemble";
import { DOFS, DOFS_PER_NODE, type Dof } from "./dof";
import { factorize, solveFactorized } from "./factor";
import { type Matrix, zeros } from "./matrix";

/**
 * The smallest ratio of a pivot of the factorization to the diagonal stiffness of the same degree
 * of freedom that `solve` accepts. When no remaining degree of freedom has a pivot above it, the
 * model is reported as unstable.
 *
 * The reason for a ratio, and for this value, is in ../README.md ("The instability test").
 */
export const PIVOT_THRESHOLD = 1e-12;

/** The displacement of one node in global axes: translations in m, rotations in rad. */
export interface NodeDisplacement {
  ux: number;
  uy: number;
  uz: number;
  rx: number;
  ry: number;
  rz: number;
}

/**
 * The reaction at one supported node in global axes: the force (kN) and the moment (kN·m) that the
 * support applies to the structure. A component the support does not restrain is 0.
 */
export interface NodeReaction {
  fx: number;
  fy: number;
  fz: number;
  mx: number;
  my: number;
  mz: number;
}

/** The names of the six reaction components, in the order of `DOFS`. */
export const REACTION_COMPONENTS = ["fx", "fy", "fz", "mx", "my", "mz"] as const;

/** The result of one load case. Plain data. */
export interface LoadCaseResult {
  loadCaseId: string;
  /** One entry per node of the model, by node id. */
  displacements: Record<string, NodeDisplacement>;
  /** One entry per support of the model, by the support's node id. */
  reactions: Record<string, NodeReaction>;
  /**
   * The same displacements as one vector: six numbers per node, in the order of `nodeIds` of the
   * result and, within a node, ux, uy, uz, rx, ry, rz.
   */
  displacementVector: Float64Array;
  /**
   * The same reactions as one vector in the same order (fx, fy, fz, mx, my, mz within a node); 0 in
   * every row that no support restrains.
   */
  reactionVector: Float64Array;
  /**
   * How much rounding in the stiffness matrix could matter to this result, as a number without
   * unit: ε · (Σ over i, j of |u_i| · |K_ij| · |u_j|) / (Σ over i of f_i · u_i), with ε =
   * `Number.EPSILON`, K the assembled matrix, u the displacements and f the nodal loads. It is the
   * relative change of the loads' work Σ f_i u_i (which equals uᵀ K u) that a relative change of ε
   * in every entry of K could cause for these displacements. 0 when every displacement is 0;
   * `Infinity` when a displacement is not 0 and the work is not positive. `solve` reports it and
   * does not act on it.
   */
  sensitivity: number;
}

/** A member load, which `solve` refuses until card S4. */
export interface UnsupportedMemberLoad {
  loadId: string;
  memberId: string;
  feature: "member-load";
}

export type SolveResult =
  | {
      ok: true;
      /** The node ids in the model's order: the order of the two vectors of each load case. */
      nodeIds: string[];
      /** One result per load case of the model, by load case id. */
      loadCases: Record<string, LoadCaseResult>;
    }
  | {
      ok: false;
      /** `validateModel` reported issues; nothing was solved. */
      reason: "invalid-model";
      issues: ModelIssue[];
    }
  | {
      ok: false;
      /** The model is valid but uses something this card does not solve. */
      reason: "not-supported-yet";
      unsupported: (UnsupportedMember | UnsupportedMemberLoad)[];
    }
  | {
      ok: false;
      /**
       * The supports do not hold the structure: the stiffness matrix of the unrestrained degrees
       * of freedom is not positive definite by the test of `PIVOT_THRESHOLD`.
       */
      reason: "unstable";
      /**
       * The node of the degree of freedom at which the elimination stopped: among those that could
       * not be eliminated, the one whose pivot has the largest ratio to its diagonal stiffness (the
       * first in the model's order among equals).
       */
      nodeId: string;
      /** That degree of freedom. */
      dof: Dof;
      /** Its pivot when the elimination stopped (kN/m for a translation, kN·m per rad for a rotation). */
      pivot: number;
      /** Its diagonal stiffness before the elimination, same unit. */
      diagonal: number;
      /** `PIVOT_THRESHOLD`: the test that failed is pivot > threshold · diagonal. */
      threshold: number;
      /** How many unrestrained degrees of freedom were not eliminated, that one included. */
      remaining: number;
    }
  | {
      ok: false;
      /**
       * A number overflowed: the stiffness matrix (`where: "stiffness"`), or the displacements or
       * reactions of a load case (`where: "load-case"`, with `loadCaseId`), hold a value that is not
       * finite.
       */
      reason: "non-finite";
      where: "stiffness" | "load-case";
      loadCaseId?: string;
    };

function allFinite(values: Float64Array): boolean {
  for (let i = 0; i < values.length; i++) {
    if (!Number.isFinite(values[i] as number)) {
      return false;
    }
  }
  return true;
}

/** A plain object with the given keys, in order. A key such as "__proto__" becomes an own property. */
function record<T>(entries: [string, T][]): Record<string, T> {
  return Object.fromEntries(entries);
}

/**
 * Solves a model for each of its load cases.
 *
 * Steps:
 * 1. `assemble` builds the stiffness matrix K of the free structure (6 rows per node). Its refusals
 *    are passed on (`invalid-model`, `not-supported-yet`); a model with any member load, in any load
 *    case, is refused as `not-supported-yet` too.
 * 2. A degree of freedom that a support restrains has the displacement 0. The others are the free
 *    degrees of freedom; the reduced matrix is K without the rows and columns of the restrained ones.
 * 3. The reduced matrix is factorized once (`factorize`: L D Lᵀ of its symmetric part, with
 *    symmetric pivoting). If the factorization stops by the test of `PIVOT_THRESHOLD` the result is
 *    `unstable` and nothing is solved.
 * 4. Per load case: f is the sum of the case's nodal loads at each degree of freedom; the free
 *    displacements solve (reduced K) u = (free rows of f); the reactions are the restrained rows of
 *    K u - f, computed with the whole matrix K as assembled.
 * 5. Per load case: the result's `sensitivity` is computed and reported.
 *
 * The function does not change the model and keeps no state between calls.
 */
export function solve(model: Model): SolveResult {
  const assembled = assemble(model);
  if (!assembled.ok && assembled.reason === "invalid-model") {
    return assembled;
  }
  const memberLoads: UnsupportedMemberLoad[] = [
    ...model.memberUniformLoads,
    ...model.memberPointLoads,
  ].map((load) => ({ loadId: load.id, memberId: load.memberId, feature: "member-load" }));
  if (!assembled.ok || memberLoads.length > 0) {
    return {
      ok: false,
      reason: "not-supported-yet",
      unsupported: [...unsupportedMembers(model), ...memberLoads],
    };
  }

  const { stiffness, dofMap } = assembled;
  const size = dofMap.size;
  const K = stiffness.data;
  if (!allFinite(K)) {
    return { ok: false, reason: "non-finite", where: "stiffness" };
  }

  // Which rows are restrained, and the list of the free rows in increasing order.
  const restrained = new Uint8Array(size);
  for (const support of model.supports) {
    const node = dofMap.nodeIndex.get(support.nodeId);
    if (node === undefined) {
      continue; // validateModel reports a support on a missing node, so this is not reached.
    }
    DOFS.forEach((dof, d) => {
      if (support[dof]) {
        restrained[DOFS_PER_NODE * node + d] = 1;
      }
    });
  }
  const free: number[] = [];
  for (let row = 0; row < size; row++) {
    if (restrained[row] === 0) {
      free.push(row);
    }
  }

  const reduced: Matrix = zeros(free.length, free.length);
  for (let i = 0; i < free.length; i++) {
    const from = (free[i] as number) * size;
    const to = i * free.length;
    for (let j = 0; j < free.length; j++) {
      reduced.data[to + j] = K[from + (free[j] as number)] as number;
    }
  }

  const factorized = factorize(reduced, PIVOT_THRESHOLD);
  if (!factorized.ok) {
    const row = free[factorized.index] as number;
    return {
      ok: false,
      reason: "unstable",
      nodeId: dofMap.nodeIds[Math.floor(row / DOFS_PER_NODE)] as string,
      dof: DOFS[row % DOFS_PER_NODE] as Dof,
      pivot: factorized.pivot,
      diagonal: factorized.diagonal,
      threshold: PIVOT_THRESHOLD,
      remaining: factorized.remaining,
    };
  }

  const results: [string, LoadCaseResult][] = [];
  for (const loadCase of model.loadCases) {
    const f = new Float64Array(size);
    for (const load of model.nodalLoads) {
      const node = load.loadCaseId === loadCase.id ? dofMap.nodeIndex.get(load.nodeId) : undefined;
      if (node === undefined) {
        continue;
      }
      REACTION_COMPONENTS.forEach((component, d) => {
        const row = DOFS_PER_NODE * node + d;
        f[row] = (f[row] as number) + load[component];
      });
    }

    const uFree = solveFactorized(
      factorized.factorization,
      free.map((row) => f[row] as number),
    );
    const u = new Float64Array(size);
    free.forEach((row, i) => {
      u[row] = uFree[i] as number;
    });

    // Reactions: the restrained rows of K u - f, with the matrix as assembled (not the reduced one).
    const r = new Float64Array(size);
    for (let row = 0; row < size; row++) {
      if (restrained[row] === 0) {
        continue;
      }
      const from = row * size;
      let sum = 0;
      for (let col = 0; col < size; col++) {
        sum += (K[from + col] as number) * (u[col] as number);
      }
      r[row] = sum - (f[row] as number);
    }

    if (!allFinite(u) || !allFinite(r)) {
      return { ok: false, reason: "non-finite", where: "load-case", loadCaseId: loadCase.id };
    }

    // The sensitivity: ε · Σ |u_i| |K_ij| |u_j| over the loads' work Σ f_i u_i.
    let work = 0;
    let absolute = 0;
    for (let row = 0; row < size; row++) {
      const ui = u[row] as number;
      if (ui === 0) {
        continue;
      }
      work += (f[row] as number) * ui;
      const from = row * size;
      let sum = 0;
      for (let col = 0; col < size; col++) {
        sum += Math.abs(K[from + col] as number) * Math.abs(u[col] as number);
      }
      absolute += Math.abs(ui) * sum;
    }
    let sensitivity = 0;
    if (absolute > 0) {
      sensitivity = work > 0 ? (Number.EPSILON * absolute) / work : Number.POSITIVE_INFINITY;
    }
    const six = (vector: Float64Array, node: number, d: number): number =>
      vector[DOFS_PER_NODE * node + d] as number;
    const displacements = dofMap.nodeIds.map((nodeId, node): [string, NodeDisplacement] => [
      nodeId,
      {
        ux: six(u, node, 0),
        uy: six(u, node, 1),
        uz: six(u, node, 2),
        rx: six(u, node, 3),
        ry: six(u, node, 4),
        rz: six(u, node, 5),
      },
    ]);
    const reactions: [string, NodeReaction][] = [];
    for (const support of model.supports) {
      const node = dofMap.nodeIndex.get(support.nodeId);
      if (node !== undefined) {
        reactions.push([
          support.nodeId,
          {
            fx: six(r, node, 0),
            fy: six(r, node, 1),
            fz: six(r, node, 2),
            mx: six(r, node, 3),
            my: six(r, node, 4),
            mz: six(r, node, 5),
          },
        ]);
      }
    }
    results.push([
      loadCase.id,
      {
        loadCaseId: loadCase.id,
        displacements: record(displacements),
        reactions: record(reactions),
        displacementVector: u,
        reactionVector: r,
        sensitivity,
      },
    ]);
  }

  return { ok: true, nodeIds: [...dofMap.nodeIds], loadCases: record(results) };
}
