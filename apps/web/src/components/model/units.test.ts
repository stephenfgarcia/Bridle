import { portalFrame } from "@bridle/model";
import { describe, expect, it } from "vitest";
import {
  formatGrouped,
  formatQuantity,
  fromDisplay,
  GROUP_SEPARATOR,
  type Quantity,
  toDisplay,
} from "./units";

const QUANTITIES: Quantity[] = [
  "area",
  "inertia",
  "sectionLength",
  "modulus",
  "strength",
  "density",
];

describe("toDisplay and fromDisplay", () => {
  it("converts the stored units to the shown ones", () => {
    // 1 m² = 10 000 cm²; 1 m⁴ = 100 000 000 cm⁴; 1 m = 1000 mm.
    expect(toDisplay(1, "area")).toBe(1e4);
    expect(toDisplay(1, "inertia")).toBe(1e8);
    expect(toDisplay(1, "sectionLength")).toBe(1000);
    // 1 GPa = 1 000 000 kN/m²; 1 MPa = 1000 kN/m².
    expect(toDisplay(1e6, "modulus")).toBe(1);
    expect(toDisplay(1e3, "strength")).toBe(1);
    expect(toDisplay(7850, "density")).toBe(7850);
  });

  it("converts the shown units to the stored ones", () => {
    expect(fromDisplay(1, "area")).toBe(1e-4);
    expect(fromDisplay(1, "inertia")).toBe(1e-8);
    expect(fromDisplay(300, "sectionLength")).toBe(0.3);
    expect(fromDisplay(210, "modulus")).toBe(2.1e8);
    expect(fromDisplay(81, "modulus")).toBe(8.1e7);
    expect(fromDisplay(355, "strength")).toBe(3.55e5);
    expect(fromDisplay(7850, "density")).toBe(7850);
  });

  it("gives the fixtures' section and material in the customary units", () => {
    const { sections, materials } = portalFrame();
    const section = sections[0];
    const material = materials[0];
    if (!section || !material) {
      throw new Error("the portal frame has a section and a material");
    }
    expect(toDisplay(section.A, "area")).toBeCloseTo(54, 9);
    expect(toDisplay(section.Iy, "inertia")).toBeCloseTo(8400, 6);
    expect(toDisplay(section.Iz, "inertia")).toBeCloseTo(600, 6);
    expect(toDisplay(section.J, "inertia")).toBeCloseTo(20, 6);
    expect(toDisplay(section.depthZ, "sectionLength")).toBe(300);
    expect(toDisplay(section.depthY, "sectionLength")).toBe(150);
    expect(toDisplay(material.E, "modulus")).toBe(210);
    expect(toDisplay(material.G, "modulus")).toBe(81);
    expect(toDisplay(material.fy, "strength")).toBe(355);
  });

  it("goes there and back", () => {
    for (const quantity of QUANTITIES) {
      for (const value of [0, 1, 0.3, 8.147e-5, 2.1e8, 7850, -12.5]) {
        const back = fromDisplay(toDisplay(value, quantity), quantity);
        expect(back, `${quantity} ${value}`).toBeCloseTo(
          value,
          12 - Math.ceil(Math.log10(Math.abs(value) + 1)),
        );
        const forth = toDisplay(fromDisplay(value, quantity), quantity);
        expect(forth, `${quantity} ${value}`).toBeCloseTo(
          value,
          12 - Math.ceil(Math.log10(Math.abs(value) + 1)),
        );
      }
    }
  });
});

describe("formatGrouped", () => {
  const g = GROUP_SEPARATOR;

  it("keeps four significant digits and groups the digits before the point", () => {
    expect(formatGrouped(8147.3)).toBe(`8${g}147`);
    expect(formatGrouped(92083.4)).toBe(`92${g}080`);
    expect(formatGrouped(1234567)).toBe(`1${g}235${g}000`);
    expect(formatGrouped(7850)).toBe(`7${g}850`);
    expect(formatGrouped(999.96)).toBe(`1${g}000`);
  });

  it("writes plain decimals without trailing zeros", () => {
    expect(formatGrouped(53.8)).toBe("53.8");
    expect(formatGrouped(53.812)).toBe("53.81");
    expect(formatGrouped(210)).toBe("210");
    expect(formatGrouped(16.614)).toBe("16.61");
    expect(formatGrouped(0.0125)).toBe("0.0125");
    expect(formatGrouped(0.000012346)).toBe("0.00001235");
    expect(formatGrouped(300)).toBe("300");
  });

  it("writes zero, negative and non-finite values", () => {
    expect(formatGrouped(0)).toBe("0");
    expect(formatGrouped(-0)).toBe("0");
    expect(formatGrouped(-8147.3)).toBe(`-8${g}147`);
    expect(formatGrouped(Number.NaN)).toBe("NaN");
    expect(formatGrouped(Number.POSITIVE_INFINITY)).toBe("Infinity");
  });

  it("uses a no-break space between the groups", () => {
    expect(GROUP_SEPARATOR).toBe(" ");
  });
});

describe("formatQuantity", () => {
  it("converts, then formats", () => {
    expect(formatQuantity(8.1473e-5, "inertia")).toBe(`8${GROUP_SEPARATOR}147`);
    expect(formatQuantity(5.4e-3, "area")).toBe("54");
    expect(formatQuantity(0.3, "sectionLength")).toBe("300");
    expect(formatQuantity(2.1e8, "modulus")).toBe("210");
    expect(formatQuantity(3.55e5, "strength")).toBe("355");
    expect(formatQuantity(7850, "density")).toBe(`7${GROUP_SEPARATOR}850`);
  });
});
