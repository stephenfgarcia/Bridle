/**
 * The one place that decides whether a computed number may enter the evidence. Every number the
 * evidence computes from a learner's model (a converted value, a ratio, a load resolved to global
 * axes) passes `inRange` first; what fails is reported with a status and never stored.
 */
import { VALUE_BOUND } from "./types";

/** Whether `value` is a finite number whose magnitude is at most `VALUE_BOUND`. */
export function inRange(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) <= VALUE_BOUND;
}

/** Whether every one of `values` is `inRange`. */
export function allInRange(values: readonly number[]): boolean {
  return values.every(inRange);
}

/**
 * The paths of the numbers in plain data that are not finite (`NaN`, `Infinity`, `-Infinity`), for
 * example `answers[3].ownModel`; an empty list when every number is finite. The tests run it over
 * whole evidences.
 */
export function nonFinitePaths(value: unknown, path = ""): string[] {
  if (typeof value === "number") {
    return Number.isFinite(value) ? [] : [path];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => nonFinitePaths(item, `${path}[${index}]`));
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, item]) =>
      nonFinitePaths(item, path === "" ? key : `${path}.${key}`),
    );
  }
  return [];
}
