/**
 * The generic steel I-sections of the tasks (pitch card T2). Card S8 will make its catalog from this
 * list. They are doubly symmetric I-shapes made of three rectangles (two flanges and a web, no root
 * fillets), with round dimensions chosen for these tasks. They are not the sections of any
 * manufacturer's or standard's table, and the names are not catalog designations: "I 300x150" means
 * an I-shape 300 mm deep and 150 mm wide.
 *
 * Dimensions are written in mm (h overall depth, b flange width, tw web thickness, tf flange
 * thickness); `genericSection` converts them to m and computes the properties in the units of
 * `@bridle/model` (m², m⁴):
 *
 *   A  = 2·b·tf + (h − 2·tf)·tw
 *   Iy = [b·h³ − (b − tw)·(h − 2·tf)³] / 12          strong axis, about local y (bending in the web's plane)
 *   Iz = [2·tf·b³ + (h − 2·tf)·tw³] / 12             weak axis, about local z
 *   J  = [2·b·tf³ + (h − tf)·tw³] / 3                thin-walled open section: the sum of (length × thickness³)/3,
 *                                                    the web taken between the flange centre lines
 *
 * `depthZ` is h and `depthY` is b, as `Section` of `@bridle/model` defines them (local z is in the
 * web's plane for a member with roll 0).
 */
import type { Section } from "@bridle/model";

/** The dimensions of a generic I-section, in mm. */
export interface ISectionDimensions {
  /** The name, also used as the section's id: "I 300x150" is 300 mm deep and 150 mm wide. */
  name: string;
  /** Overall depth, mm. */
  h: number;
  /** Flange width, mm. */
  b: number;
  /** Web thickness, mm. */
  tw: number;
  /** Flange thickness, mm. */
  tf: number;
}

/** The list, lightest first. */
export const GENERIC_I_SECTION_DIMENSIONS: readonly ISectionDimensions[] = [
  { name: "I 200x100", h: 200, b: 100, tw: 6, tf: 9 },
  { name: "I 240x120", h: 240, b: 120, tw: 6, tf: 10 },
  { name: "I 270x135", h: 270, b: 135, tw: 7, tf: 10 },
  { name: "I 300x150", h: 300, b: 150, tw: 7, tf: 11 },
  { name: "I 330x160", h: 330, b: 160, tw: 8, tf: 12 },
  { name: "I 360x170", h: 360, b: 170, tw: 8, tf: 13 },
  { name: "I 400x180", h: 400, b: 180, tw: 9, tf: 14 },
  { name: "I 450x190", h: 450, b: 190, tw: 9, tf: 15 },
  { name: "I 500x200", h: 500, b: 200, tw: 10, tf: 16 },
  { name: "I 550x210", h: 550, b: 210, tw: 11, tf: 17 },
  { name: "I 600x220", h: 600, b: 220, tw: 12, tf: 19 },
];

/** The `Section` of an I-shape with the given dimensions (mm), by the formulas in this file's header. */
export function genericSection(dimensions: ISectionDimensions): Section {
  const h = dimensions.h / 1000;
  const b = dimensions.b / 1000;
  const tw = dimensions.tw / 1000;
  const tf = dimensions.tf / 1000;
  const web = h - 2 * tf;
  return {
    id: dimensions.name,
    name: dimensions.name,
    A: 2 * b * tf + web * tw,
    Iy: (b * h ** 3 - (b - tw) * web ** 3) / 12,
    Iz: (2 * tf * b ** 3 + web * tw ** 3) / 12,
    J: (2 * b * tf ** 3 + (h - tf) * tw ** 3) / 3,
    depthY: b,
    depthZ: h,
  };
}

/** The dimensions of the generic section with this name, or `undefined`. */
export function genericSectionDimensions(name: string): ISectionDimensions | undefined {
  return GENERIC_I_SECTION_DIMENSIONS.find((dimensions) => dimensions.name === name);
}

/** A new `Section` for each entry of `GENERIC_I_SECTION_DIMENSIONS`, in that order. */
export function genericSections(): Section[] {
  return GENERIC_I_SECTION_DIMENSIONS.map(genericSection);
}

/** The density of steel the tasks use for the mass of a section, kg/m³. */
export const STEEL_DENSITY = 7850;

/** The mass of a section per metre of member, in kg/m: its area times `STEEL_DENSITY`. */
export function massPerMetre(section: Section): number {
  return section.A * STEEL_DENSITY;
}
