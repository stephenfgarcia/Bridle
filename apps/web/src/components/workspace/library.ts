/**
 * The sections and the materials of a model as the "Sections and materials" dialog lists them (card PX-02.6):
 * their properties as text in the interface's units (../model/units.ts), how many members use each, whether
 * it can be removed, and what can be added. Pure; tested in ./library.test.ts.
 */
import type { Model } from "@bridle/model";
import { GENERIC_I_SECTION_DIMENSIONS, genericSection } from "@bridle/tasks";
import type { AddMaterialArgs, AddSectionArgs } from "../model/commands";
import { formatQuantity, fromDisplay } from "../model/units";

/** A section of the model: its properties as text, without units (the table's header names them). */
export interface SectionRow {
  id: string;
  name: string;
  /** cm². */
  A: string;
  /** cm⁴. */
  Iy: string;
  /** cm⁴. */
  Iz: string;
  /** cm⁴. */
  J: string;
  /** The dimension along local z, mm. */
  depthZ: string;
  /** The dimension along local y, mm. */
  depthY: string;
  /** How many members use the section. */
  members: number;
  /** Whether `removeSection` would remove it: no member uses it. */
  removable: boolean;
}

function uses(model: Model, key: "sectionId" | "materialId", id: string): number {
  return model.members.filter((member) => member[key] === id).length;
}

/** One row per section of the model, in the model's order. */
export function sectionRows(model: Model): SectionRow[] {
  return model.sections.map((section) => {
    const members = uses(model, "sectionId", section.id);
    return {
      id: section.id,
      name: section.name,
      A: formatQuantity(section.A, "area"),
      Iy: formatQuantity(section.Iy, "inertia"),
      Iz: formatQuantity(section.Iz, "inertia"),
      J: formatQuantity(section.J, "inertia"),
      depthZ: formatQuantity(section.depthZ, "sectionLength"),
      depthY: formatQuantity(section.depthY, "sectionLength"),
      members,
      removable: members === 0,
    };
  });
}

/** A material of the model: its properties as text, without units. */
export interface MaterialRow {
  id: string;
  name: string;
  /** GPa. */
  E: string;
  /** GPa. */
  G: string;
  /** MPa. */
  fy: string;
  /** kg/m³. */
  density: string;
  members: number;
  /** Whether `removeMaterial` would remove it: no member uses it. */
  removable: boolean;
}

/** One row per material of the model, in the model's order. */
export function materialRows(model: Model): MaterialRow[] {
  return model.materials.map((material) => {
    const members = uses(model, "materialId", material.id);
    return {
      id: material.id,
      name: material.name,
      E: formatQuantity(material.E, "modulus"),
      G: formatQuantity(material.G, "modulus"),
      fy: formatQuantity(material.fy, "strength"),
      density: formatQuantity(material.density, "density"),
      members,
      removable: members === 0,
    };
  });
}

/** Something the dialog offers to add, by name; not `available` when the model has an entry of that name. */
export interface Choice {
  name: string;
  available: boolean;
}

/** The generic I-sections of `@bridle/tasks`, in its order (lightest first). */
export function sectionChoices(model: Model): Choice[] {
  return GENERIC_I_SECTION_DIMENSIONS.map(({ name }) => ({
    name,
    available: !model.sections.some((section) => section.name === name),
  }));
}

/**
 * What `addSection` takes for the generic I-section with this name: its properties in the model's units, as
 * `genericSection` of `@bridle/tasks` computes them from its dimensions. `undefined` for another name.
 */
export function genericSectionArgs(name: string): AddSectionArgs | undefined {
  const dimensions = GENERIC_I_SECTION_DIMENSIONS.find((candidate) => candidate.name === name);
  if (!dimensions) {
    return undefined;
  }
  const { id: _id, ...section } = genericSection(dimensions);
  return section;
}

// The built-in materials, in the interface's units: E and G in GPa, fy in MPa, the density in kg/m³. S355 has
// the values of the material of the fixtures of @bridle/model; S275 differs from it in its yield strength.
const BUILT_IN_MATERIALS = [
  { name: "S355", E: 210, G: 81, fy: 355, density: 7850 },
  { name: "S275", E: 210, G: 81, fy: 275, density: 7850 },
] as const;

/** The built-in materials, in the order the dialog offers them. */
export function materialChoices(model: Model): Choice[] {
  return BUILT_IN_MATERIALS.map(({ name }) => ({
    name,
    available: !model.materials.some((material) => material.name === name),
  }));
}

/** What `addMaterial` takes for the built-in material with this name, in the model's units; else `undefined`. */
export function builtInMaterialArgs(name: string): AddMaterialArgs | undefined {
  const material = BUILT_IN_MATERIALS.find((candidate) => candidate.name === name);
  return (
    material && {
      name: material.name,
      E: fromDisplay(material.E, "modulus"),
      G: fromDisplay(material.G, "modulus"),
      fy: fromDisplay(material.fy, "strength"),
      density: fromDisplay(material.density, "density"),
    }
  );
}
