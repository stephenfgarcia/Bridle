/**
 * How the numbers of the results are written (card PX-02.8). Pure.
 *
 * One rule for every value: four significant digits, and a value whose size is at most `NEGLIGIBLE` times the
 * largest value of its group prints as "0". The group is what the value is compared with: the reaction forces
 * of a load case, its reaction moments, and so on (./results.ts chooses the groups). The rule is there for a
 * value that is zero by statics (the out-of-plane reaction of a plane frame, for example) and that floating-point
 * rounding may leave as a very small number: it prints as "0", not as "3.000e-15".
 */

/** The number of significant digits of a printed value. */
export const SIGNIFICANT_DIGITS = 4;

/** A value at most this fraction of the largest value of its group prints as "0". */
export const NEGLIGIBLE = 1e-9;

/** The largest absolute value of a list; 0 for an empty list. Values that are not finite are left out. */
export function largestOf(values: Iterable<number>): number {
  let largest = 0;
  for (const value of values) {
    const size = Math.abs(value);
    if (Number.isFinite(size) && size > largest) {
      largest = size;
    }
  }
  return largest;
}

/**
 * A value as text, with `SIGNIFICANT_DIGITS` significant digits:
 * - "0" for 0 and for a value whose size is at most `NEGLIGIBLE` times `largest` (by default the value's own
 *   size, so that only an exact 0 prints as "0");
 * - plain decimals from 0.001 up to, not including, 1 000 000 in size ("20.00", "-0.001234", "12350");
 * - an exponent outside that range ("1.235e+6", "5.000e-4");
 * - "NaN", "Infinity" or "-Infinity" for a value that is not finite.
 * The minus sign is the ASCII hyphen.
 */
export function formatNumber(value: number, largest: number = Math.abs(value)): string {
  if (!Number.isFinite(value)) {
    return String(value);
  }
  const size = Math.abs(value);
  if (size === 0 || size <= NEGLIGIBLE * largest) {
    return "0";
  }
  // The size after rounding decides the notation, so that 999999.9 prints as "1.000e+6", not "1000000".
  const rounded = Math.abs(Number(value.toPrecision(SIGNIFICANT_DIGITS)));
  if (rounded >= 1e6 || rounded < 1e-3) {
    return value.toExponential(SIGNIFICANT_DIGITS - 1);
  }
  if (rounded >= 10 ** (SIGNIFICANT_DIGITS - 1)) {
    // toPrecision would switch to an exponent here: 12345.6 is written "12350".
    return String(Number(value.toPrecision(SIGNIFICANT_DIGITS)));
  }
  return value.toPrecision(SIGNIFICANT_DIGITS);
}

/** A duration in ms as text: one decimal below 10 ms ("3.4"), whole milliseconds from there ("27"). */
export function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) {
    return "0";
  }
  return ms < 9.95 ? ms.toFixed(1) : String(Math.round(ms));
}

/** A ratio without unit as text: two significant digits with an exponent ("3.1e-10"). */
export function formatRatio(ratio: number): string {
  return Number.isFinite(ratio) ? ratio.toExponential(1) : String(ratio);
}
