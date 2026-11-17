import { portalFrame } from "@bridle/model";
import { GENERIC_I_SECTION_DIMENSIONS } from "@bridle/tasks";
import { describe, expect, it } from "vitest";
import {
  addMaterial,
  addSection,
  removeMaterial,
  removeSection,
  updateMembers,
} from "../model/commands";
import { GROUP_SEPARATOR } from "../model/units";
import {
  builtInMaterialArgs,
  genericSectionArgs,
  materialChoices,
  materialRows,
  sectionChoices,
  sectionRows,
} from "./library";

const g = GROUP_SEPARATOR;

function withSecond() {
  const section = genericSectionArgs("I 400x180");
  const material = builtInMaterialArgs("S275");
  if (!section || !material) {
    throw new Error("the built-in lists have I 400x180 and S275");
  }
  return addMaterial(addSection(portalFrame(), section), material);
}

describe("sectionRows", () => {
  it("lists the fixture's section in cm², cm⁴ and mm", () => {
    expect(sectionRows(portalFrame())).toEqual([
      {
        id: "s1",
        name: "I 300x150",
        A: "54",
        Iy: `8${g}400`,
        Iz: "600",
        J: "20",
        depthZ: "300",
        depthY: "150",
        members: 3,
        removable: false,
      },
    ]);
  });

  it("lists an added generic section with the properties computed from its dimensions", () => {
    const [, added] = sectionRows(withSecond());
    // I 400x180: h 400, b 180, tw 9, tf 14 mm. A = 2·180·14 + 372·9 = 8388 mm² = 83.88 cm².
    // Iy = (180·400³ − 171·372³)/12 mm⁴ = 22 643.4 cm⁴; Iz = (2·14·180³ + 372·9³)/12 mm⁴ = 1363.1 cm⁴.
    // J = (2·180·14³ + 386·9³)/3 mm⁴ = 42.31 cm⁴.
    expect(added).toEqual({
      id: "s2",
      name: "I 400x180",
      A: "83.88",
      Iy: `22${g}640`,
      Iz: `1${g}363`,
      J: "42.31",
      depthZ: "400",
      depthY: "180",
      members: 0,
      removable: true,
    });
  });

  it("marks as removable exactly the sections removeSection removes", () => {
    let model = withSecond();
    model = updateMembers(model, { ids: ["c1"], sectionId: "s2" });
    for (const row of sectionRows(model)) {
      expect(removeSection(model, { id: row.id }) !== model, row.id).toBe(row.removable);
    }
    expect(sectionRows(model).map((row) => [row.id, row.members, row.removable])).toEqual([
      ["s1", 2, false],
      ["s2", 1, false],
    ]);
    model = updateMembers(model, { ids: ["b1", "c2"], sectionId: "s2" });
    expect(sectionRows(model).map((row) => [row.id, row.members, row.removable])).toEqual([
      ["s1", 0, true],
      ["s2", 3, false],
    ]);
    for (const row of sectionRows(model)) {
      expect(removeSection(model, { id: row.id }) !== model, row.id).toBe(row.removable);
    }
  });
});

describe("materialRows", () => {
  it("lists the materials in GPa, MPa and kg/m³", () => {
    expect(materialRows(withSecond())).toEqual([
      {
        id: "mat1",
        name: "S355",
        E: "210",
        G: "81",
        fy: "355",
        density: `7${g}850`,
        members: 3,
        removable: false,
      },
      {
        id: "mat2",
        name: "S275",
        E: "210",
        G: "81",
        fy: "275",
        density: `7${g}850`,
        members: 0,
        removable: true,
      },
    ]);
  });

  it("marks as removable exactly the materials removeMaterial removes", () => {
    let model = withSecond();
    for (const row of materialRows(model)) {
      expect(removeMaterial(model, { id: row.id }) !== model, row.id).toBe(row.removable);
    }
    model = updateMembers(model, { ids: ["c1", "b1", "c2"], materialId: "mat2" });
    expect(materialRows(model).map((row) => [row.id, row.removable])).toEqual([
      ["mat1", true],
      ["mat2", false],
    ]);
  });
});

describe("what can be added", () => {
  it("offers every generic I-section, without those the model has by name", () => {
    const choices = sectionChoices(portalFrame());
    expect(choices.map((choice) => choice.name)).toEqual(
      GENERIC_I_SECTION_DIMENSIONS.map((dimensions) => dimensions.name),
    );
    expect(choices.filter((choice) => !choice.available).map((choice) => choice.name)).toEqual([
      "I 300x150",
    ]);
    expect(
      sectionChoices(withSecond())
        .filter((choice) => !choice.available)
        .map((choice) => choice.name),
    ).toEqual(["I 300x150", "I 400x180"]);
  });

  it("genericSectionArgs has no id and is undefined for another name", () => {
    const args = genericSectionArgs("I 200x100");
    expect(args).toMatchObject({ name: "I 200x100", depthY: 0.1, depthZ: 0.2 });
    expect(args && "id" in args).toBe(false);
    expect(genericSectionArgs("HEB 200")).toBeUndefined();
  });

  it("offers S355 and S275, S355 with the values of the fixtures' material", () => {
    expect(materialChoices(portalFrame())).toEqual([
      { name: "S355", available: false },
      { name: "S275", available: true },
    ]);
    const { id: _id, ...fixture } = portalFrame().materials[0] ?? { id: "" };
    expect(builtInMaterialArgs("S355")).toEqual(fixture);
    expect(builtInMaterialArgs("S275")).toEqual({ ...fixture, name: "S275", fy: 2.75e5 });
    expect(builtInMaterialArgs("S460")).toBeUndefined();
  });
});
