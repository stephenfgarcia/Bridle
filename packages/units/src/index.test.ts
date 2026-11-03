import { describe, expect, it } from "vitest";
import { toMetres } from "./index";

describe("toMetres", () => {
  it("converts inches to metres", () => {
    expect(toMetres(12, "in")).toBeCloseTo(0.3048);
  });

  it("converts millimetres to metres", () => {
    expect(toMetres(1000, "mm")).toBe(1);
  });
});
