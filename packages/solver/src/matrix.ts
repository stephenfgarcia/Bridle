/**
 * A small dense matrix type for the solver: a `Float64Array` in row-major order. Models of the
 * showcase have at most about 200 members, so dense storage is enough.
 *
 * Every function here is pure: it returns a new matrix or vector and changes none of its arguments,
 * except `addAt`, which is the one function that writes into a matrix it is given.
 */

/** A dense matrix. The entry of row `i` and column `j` (both from 0) is `data[i * cols + j]`. */
export interface Matrix {
  rows: number;
  cols: number;
  data: Float64Array;
}

/** A `rows` by `cols` matrix of zeros. */
export function zeros(rows: number, cols: number): Matrix {
  return { rows, cols, data: new Float64Array(rows * cols) };
}

/** A matrix from its rows, for tests and small literal matrices. Every row must have the same length. */
export function fromRows(rows: readonly (readonly number[])[]): Matrix {
  const cols = rows[0]?.length ?? 0;
  const m = zeros(rows.length, cols);
  rows.forEach((row, i) => {
    if (row.length !== cols) {
      throw new RangeError(`fromRows: row ${i} has ${row.length} entries, expected ${cols}`);
    }
    m.data.set(row, i * cols);
  });
  return m;
}

/** The entry of row `i` and column `j`. Throws a `RangeError` outside the matrix. */
export function at(m: Matrix, i: number, j: number): number {
  const value = i >= 0 && i < m.rows && j >= 0 && j < m.cols ? m.data[i * m.cols + j] : undefined;
  if (value === undefined) {
    throw new RangeError(`at: (${i}, ${j}) is outside a ${m.rows} by ${m.cols} matrix`);
  }
  return value;
}

/** Adds `value` to the entry of row `i` and column `j` of `m`, in place. */
export function addAt(m: Matrix, i: number, j: number, value: number): void {
  m.data[i * m.cols + j] = at(m, i, j) + value;
}

/** The transpose of `m`. */
export function transpose(m: Matrix): Matrix {
  const t = zeros(m.cols, m.rows);
  for (let i = 0; i < m.rows; i++) {
    for (let j = 0; j < m.cols; j++) {
      t.data[j * t.cols + i] = at(m, i, j);
    }
  }
  return t;
}

/** The product `a` times `b`. Throws a `RangeError` when `a.cols` differs from `b.rows`. */
export function multiply(a: Matrix, b: Matrix): Matrix {
  if (a.cols !== b.rows) {
    throw new RangeError(`multiply: ${a.rows} by ${a.cols} times ${b.rows} by ${b.cols}`);
  }
  const p = zeros(a.rows, b.cols);
  for (let i = 0; i < a.rows; i++) {
    for (let k = 0; k < a.cols; k++) {
      const aik = at(a, i, k);
      if (aik === 0) {
        continue;
      }
      for (let j = 0; j < b.cols; j++) {
        addAt(p, i, j, aik * at(b, k, j));
      }
    }
  }
  return p;
}

/** The product of `m` and the column vector `v`. Throws a `RangeError` when `m.cols` differs from `v.length`. */
export function multiplyVector(m: Matrix, v: ArrayLike<number>): Float64Array {
  if (m.cols !== v.length) {
    throw new RangeError(`multiplyVector: ${m.rows} by ${m.cols} times a vector of ${v.length}`);
  }
  const out = new Float64Array(m.rows);
  for (let i = 0; i < m.rows; i++) {
    let sum = 0;
    for (let j = 0; j < m.cols; j++) {
      sum += at(m, i, j) * (v[j] as number);
    }
    out[i] = sum;
  }
  return out;
}

/** The largest absolute value of an entry of `m` (0 for an empty matrix). */
export function maxAbs(m: Matrix): number {
  let max = 0;
  for (const value of m.data) {
    max = Math.max(max, Math.abs(value));
  }
  return max;
}
