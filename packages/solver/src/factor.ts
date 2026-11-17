/**
 * The symmetric factorization the solver uses: P A Pᵀ = L D Lᵀ, with L unit lower triangular, D
 * diagonal and P a permutation (the same reordering of rows and of columns) that the factorization
 * chooses as it goes. For a symmetric positive definite matrix every entry of D (every "pivot") is
 * positive; the factorization stops when no remaining row has a pivot that is clearly positive
 * (see `factorize`).
 *
 * The matrix is dense. The inner loops index the `Float64Array` directly, without the
 * bounds-checked `at` and `addAt` of ./matrix.ts.
 */
import type { Matrix } from "./matrix";

/** A finished factorization P A Pᵀ = L D Lᵀ. Plain data. */
export interface Factorization {
  /** The number of rows of A. */
  size: number;
  /**
   * The order of elimination: `order[k]` is the row of A that was eliminated at step `k`. Row and
   * column `k` of L and D belong to row and column `order[k]` of A.
   */
  order: Int32Array;
  /**
   * `size` by `size`, row-major, in the order of elimination. Below the diagonal: the entries of L.
   * The diagonal and everything above it are not part of the factorization and must not be read.
   */
  lower: Float64Array;
  /** The diagonal of D in the order of elimination: the pivots, one per step. */
  pivots: Float64Array;
}

export type FactorizeResult =
  | { ok: true; factorization: Factorization }
  | {
      ok: false;
      /**
       * The row of A, among those not yet eliminated, whose pivot has the largest ratio to its
       * diagonal entry (the lowest row among equals): the best candidate left, which failed.
       */
      index: number;
      /** That row's pivot when the factorization stopped. */
      pivot: number;
      /** The diagonal entry of A in that row, before the factorization. */
      diagonal: number;
      /** How many rows were not eliminated, that row included. */
      remaining: number;
    };

/**
 * Factorizes the symmetric part of a square matrix: P A Pᵀ = L D Lᵀ.
 *
 * The matrix factorized is (a + aᵀ) / 2: each entry below the diagonal is taken as the average of
 * the two entries of `a` that mirror each other, so a matrix that is symmetric only up to rounding
 * is made exactly symmetric first. `a` is not changed.
 *
 * The order of elimination is chosen step by step (symmetric pivoting). The "ratio" of a row that
 * is not yet eliminated is its current pivot (its diagonal entry after the eliminations so far)
 * divided by its diagonal entry in A; it is 1 before any elimination, and it is taken as 0 for a row
 * whose diagonal entry in A is not positive. At each step the row with the largest ratio is
 * eliminated next; among rows with the same ratio, the one that comes first in A.
 *
 * The factorization stops when the largest ratio left is not above `relativeThreshold`, and returns
 * `{ ok: false, index, pivot, diagonal, remaining }` for that row. Every other row left has a ratio
 * that is no larger.
 *
 * The work of a step is proportional to the square of the number of nonzero entries in the column
 * being eliminated.
 *
 * @param a - a square matrix
 * @param relativeThreshold - the smallest accepted ratio of a pivot to its original diagonal entry
 */
export function factorize(a: Matrix, relativeThreshold: number): FactorizeResult {
  if (a.rows !== a.cols) {
    throw new RangeError(`factorize: the matrix is ${a.rows} by ${a.cols}, not square`);
  }
  const n = a.rows;
  const source = a.data;
  // Work on the lower triangle (with its diagonal) of the symmetric part.
  const lower = new Float64Array(n * n);
  const original = new Float64Array(n);
  const order = new Int32Array(n);
  const pivots = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const rowI = i * n;
    for (let j = 0; j < i; j++) {
      lower[rowI + j] = 0.5 * ((source[rowI + j] as number) + (source[j * n + i] as number));
    }
    lower[rowI + i] = source[rowI + i] as number;
    original[i] = source[rowI + i] as number;
    order[i] = i;
  }
  const column = new Float64Array(n);
  const nonzero = new Int32Array(n);

  for (let k = 0; k < n; k++) {
    // The remaining row with the largest ratio; among equals, the lowest row of A.
    let best = k;
    let bestRatio = Number.NEGATIVE_INFINITY;
    for (let i = k; i < n; i++) {
      const diagonal = original[i] as number;
      const ratio = diagonal > 0 ? (lower[i * n + i] as number) / diagonal : 0;
      if (
        ratio > bestRatio ||
        (ratio === bestRatio && (order[i] as number) < (order[best] as number))
      ) {
        best = i;
        bestRatio = ratio;
      }
    }
    if (!(bestRatio > relativeThreshold)) {
      return {
        ok: false,
        index: order[best] as number,
        pivot: lower[best * n + best] as number,
        diagonal: original[best] as number,
        remaining: n - k,
      };
    }

    if (best !== k) {
      // Exchange rows and columns k and best of the symmetric matrix held in the lower triangle.
      const rowK = k * n;
      const rowB = best * n;
      for (let j = 0; j < k; j++) {
        const t = lower[rowK + j] as number;
        lower[rowK + j] = lower[rowB + j] as number;
        lower[rowB + j] = t;
      }
      for (let i = k + 1; i < best; i++) {
        const t = lower[i * n + k] as number;
        lower[i * n + k] = lower[rowB + i] as number;
        lower[rowB + i] = t;
      }
      for (let i = best + 1; i < n; i++) {
        const t = lower[i * n + k] as number;
        lower[i * n + k] = lower[i * n + best] as number;
        lower[i * n + best] = t;
      }
      const d = lower[rowK + k] as number;
      lower[rowK + k] = lower[rowB + best] as number;
      lower[rowB + best] = d;
      const o = original[k] as number;
      original[k] = original[best] as number;
      original[best] = o;
      const p = order[k] as number;
      order[k] = order[best] as number;
      order[best] = p;
    }

    // Eliminate column k: a_ij -= a_ik · a_jk / d for the rows i >= j > k with a nonzero in column k.
    const pivot = lower[k * n + k] as number;
    pivots[k] = pivot;
    let count = 0;
    for (let i = k + 1; i < n; i++) {
      const value = lower[i * n + k] as number;
      if (value !== 0) {
        column[count] = value;
        nonzero[count] = i;
        count++;
        lower[i * n + k] = value / pivot;
      }
    }
    for (let p = 0; p < count; p++) {
      const rowI = (nonzero[p] as number) * n;
      const l = (column[p] as number) / pivot;
      for (let q = 0; q <= p; q++) {
        const at = rowI + (nonzero[q] as number);
        lower[at] = (lower[at] as number) - l * (column[q] as number);
      }
    }
  }
  return { ok: true, factorization: { size: n, order, lower, pivots } };
}

/**
 * Solves A x = b with a factorization of A: the entries of b are put in the order of elimination,
 * then L y = b, D z = y and Lᵀ w = z are solved, and the entries of w are put back in the order of A.
 *
 * @returns x, a new array; `b` is not changed
 */
export function solveFactorized(f: Factorization, b: ArrayLike<number>): Float64Array {
  const n = f.size;
  if (b.length !== n) {
    throw new RangeError(`solveFactorized: a vector of ${b.length} for a matrix of ${n} rows`);
  }
  const { lower, pivots, order } = f;
  const w = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    w[k] = b[order[k] as number] as number;
  }
  for (let i = 0; i < n; i++) {
    const rowI = i * n;
    let sum = w[i] as number;
    for (let k = 0; k < i; k++) {
      sum -= (lower[rowI + k] as number) * (w[k] as number);
    }
    w[i] = sum;
  }
  for (let i = 0; i < n; i++) {
    w[i] = (w[i] as number) / (pivots[i] as number);
  }
  for (let i = n - 1; i >= 0; i--) {
    const rowI = i * n;
    const wi = w[i] as number;
    if (wi !== 0) {
      for (let k = 0; k < i; k++) {
        w[k] = (w[k] as number) - (lower[rowI + k] as number) * wi;
      }
    }
  }
  const x = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    x[order[k] as number] = w[k] as number;
  }
  return x;
}
