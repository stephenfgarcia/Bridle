/**
 * `@bridle/units`: dimension-tagged SI conversion (architecture section 16).
 *
 * This is the workspace skeleton's hello package: one unit table and one conversion. The real
 * dimension tags, quanta and the schema-driven unit registry arrive with the schema package.
 */

/** Metres per unit for every supported length unit (exact definitions; 1 in = 0.0254 m). */
export const LENGTH_IN_METRES = {
  m: 1,
  mm: 0.001,
  cm: 0.01,
  km: 1000,
  in: 0.0254,
  ft: 0.3048,
} as const;

/** A length unit this package can convert: `m`, `mm`, `cm`, `km`, `in` or `ft`. */
export type LengthUnit = keyof typeof LENGTH_IN_METRES;

/**
 * Converts a length to metres.
 *
 * @param value - the length, in `unit`
 * @param unit - the unit `value` is expressed in
 * @returns the same length in metres (`value * LENGTH_IN_METRES[unit]`)
 */
export function toMetres(value: number, unit: LengthUnit): number {
  return value * LENGTH_IN_METRES[unit];
}
