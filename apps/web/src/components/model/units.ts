/**
 * The units the interface shows section and material properties in (card PX-02.6), and the conversions from
 * and to the units a `Model` stores (`@bridle/model`: kN, m, kg). This file is the one place in apps/web that
 * holds these factors. Pure; tested in ./units.test.ts.
 *
 * | Quantity        | Stored | Shown  |
 * |-----------------|--------|--------|
 * | `area`          | m²     | cm²    |
 * | `inertia`       | m⁴     | cm⁴    |
 * | `sectionLength` | m      | mm     |
 * | `modulus`       | kN/m²  | GPa    |
 * | `strength`      | kN/m²  | MPa    |
 * | `density`       | kg/m³  | kg/m³  |
 */

export type Quantity = "area" | "inertia" | "sectionLength" | "modulus" | "strength" | "density";

// One stored unit is `shown / stored` shown units. Both numbers are whole, so that a round value converts to
// a round value (210 GPa is 210 × 1 000 000 kN/m², with no rounding).
const RATIO: Record<Quantity, { shown: number; stored: number }> = {
  area: { shown: 1e4, stored: 1 },
  inertia: { shown: 1e8, stored: 1 },
  sectionLength: { shown: 1e3, stored: 1 },
  modulus: { shown: 1, stored: 1e6 },
  strength: { shown: 1, stored: 1e3 },
  density: { shown: 1, stored: 1 },
};

/** A stored value in the unit the interface shows: 8.4e-5 m⁴ is 8400 cm⁴. */
export function toDisplay(value: number, quantity: Quantity): number {
  const { shown, stored } = RATIO[quantity];
  return (value * shown) / stored;
}

/** A value in the unit the interface shows, as the model stores it: 210 GPa is 2.1e8 kN/m². */
export function fromDisplay(value: number, quantity: Quantity): number {
  const { shown, stored } = RATIO[quantity];
  return (value * stored) / shown;
}

/** The number of significant digits `formatGrouped` keeps. */
export const PROPERTY_DIGITS = 4;

/** Between groups of three digits: a no-break space, so a number does not wrap. */
export const GROUP_SEPARATOR = " ";

/**
 * A number as an engineer writes a section property: rounded to `PROPERTY_DIGITS` significant digits, plain
 * decimals without trailing zeros, and the digits before the decimal point in groups of three ("8 147",
 * "53.8", "92 080", "0.0125"). "NaN", "Infinity" or "-Infinity" for a value that is not finite. The minus
 * sign is the ASCII hyphen.
 */
export function formatGrouped(value: number): string {
  if (!Number.isFinite(value)) {
    return String(value);
  }
  const rounded = Number(value.toPrecision(PROPERTY_DIGITS));
  if (rounded === 0) {
    return "0";
  }
  const magnitude = Math.floor(Math.log10(Math.abs(rounded)));
  const decimals = Math.min(20, Math.max(0, PROPERTY_DIGITS - 1 - magnitude));
  const [whole = "0", fraction = ""] = Math.abs(rounded).toFixed(decimals).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+$)/g, GROUP_SEPARATOR);
  const trimmed = fraction.replace(/0+$/, "");
  return `${rounded < 0 ? "-" : ""}${grouped}${trimmed === "" ? "" : `.${trimmed}`}`;
}

/** A stored value as text in the unit the interface shows: `formatGrouped(toDisplay(value, quantity))`. */
export function formatQuantity(value: number, quantity: Quantity): string {
  return formatGrouped(toDisplay(value, quantity));
}
