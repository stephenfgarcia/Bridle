/**
 * An undo history (card PX-02.3): the values before the present one, the present one and the values undone
 * from it. Pure functions with no React or zustand import; ./modelStore.ts keeps a `History<Model>`.
 *
 * Every function returns the history it was given when it has nothing to do, and a new history object
 * otherwise; it never changes its argument.
 */

/** How many undo steps a history keeps unless `record` is told otherwise. */
export const HISTORY_LIMIT = 200;

export interface History<T> {
  /** The earlier values, oldest first: the last one is what `undo` brings back. */
  readonly past: readonly T[];
  readonly present: T;
  /** The undone values, the next one to redo first. */
  readonly future: readonly T[];
}

/** A history with one value and nothing to undo or redo. */
export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

/**
 * Makes `next` the present value as one undo step and drops the redo steps. The same value as the present
 * one (by identity) records nothing. When the undo steps would then number more than `limit`, the oldest
 * are dropped. `limit` is `HISTORY_LIMIT` by default; a limit below 1 or not an integer counts as 1 or is
 * rounded down.
 */
export function record<T>(history: History<T>, next: T, limit: number = HISTORY_LIMIT): History<T> {
  if (Object.is(next, history.present)) {
    return history;
  }
  const keep = Math.max(1, Math.floor(limit));
  const past = [...history.past, history.present];
  return {
    past: past.length > keep ? past.slice(past.length - keep) : past,
    present: next,
    future: [],
  };
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0;
}

/** One step back: the last earlier value becomes the present one, which becomes the first redo step. */
export function undo<T>(history: History<T>): History<T> {
  if (history.past.length === 0) {
    return history;
  }
  const previous = history.past[history.past.length - 1] as T;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

/** One step forward again: the first redo step becomes the present value. */
export function redo<T>(history: History<T>): History<T> {
  if (history.future.length === 0) {
    return history;
  }
  const next = history.future[0] as T;
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  };
}
