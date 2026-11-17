// Unit tests of ./results.ts (card PX-02.8): the values of the Results section, from results of the real
// solver, with their units.
import { type Model, portalFrame, simplySupportedBeam } from "@bridle/model";
import { type LoadCaseResult, solve } from "@bridle/solver";
import { describe, expect, it } from "vitest";
import { removeSupport } from "../model/commands";
import { restrainOutOfPlane } from "../tools/supportLoadTools";
import { displacementCells, memberEndCells, reactionForceSums, reactionRows } from "./results";

function solved(model: Model, loadCaseId = "lc1"): { loadCase: LoadCaseResult; nodeIds: string[] } {
  const result = solve(model);
  if (!result.ok) {
    throw new Error(`the model did not solve: ${result.reason}`);
  }
  const loadCase = result.loadCases[loadCaseId];
  if (!loadCase) {
    throw new Error(`no result for ${loadCaseId}`);
  }
  return { loadCase, nodeIds: result.nodeIds };
}

/** A cantilever of 3 m along +X, fixed at n1, with 10 kN downward at its tip n2. */
function cantilever(): Model {
  const model = simplySupportedBeam();
  const [start, end] = model.nodes;
  if (!start || !end) {
    throw new Error("the beam fixture has no two nodes");
  }
  end.x = start.x + 3;
  model.supports = [
    { nodeId: start.id, ux: true, uy: true, uz: true, rx: true, ry: true, rz: true },
  ];
  model.memberUniformLoads = [];
  model.memberPointLoads = [];
  model.nodalLoads = [
    { id: "nl1", loadCaseId: "lc1", nodeId: end.id, fx: 0, fy: 0, fz: -10, mx: 0, my: 0, mz: 0 },
  ];
  return model;
}

const text = (cells: { component: string; text: string }[]) =>
  Object.fromEntries(cells.map((cell) => [cell.component, cell.text]));
const units = (cells: { unit: string }[]) => cells.map((cell) => cell.unit);

describe("reactionRows", () => {
  it("lists the supports of the portal frame in the model's order, six components each with units", () => {
    const { loadCase, nodeIds } = solved(portalFrame());
    const rows = reactionRows(loadCase, nodeIds);
    expect(rows.map((row) => row.nodeId)).toEqual(["n1", "n4"]);
    for (const row of rows) {
      expect(row.cells.map((cell) => cell.component)).toEqual(["fx", "fy", "fz", "mx", "my", "mz"]);
      expect(units(row.cells)).toEqual(["kN", "kN", "kN", "kNm", "kNm", "kNm"]);
    }
  });

  it("prints the horizontal reactions of the portal frame so that they sum to the 20 kN applied", () => {
    const { loadCase, nodeIds } = solved(portalFrame());
    const rows = reactionRows(loadCase, nodeIds);
    const fx = rows.map((row) => Number(text(row.cells).fx));
    expect(fx).toHaveLength(2);
    expect((fx[0] ?? 0) + (fx[1] ?? 0)).toBeCloseTo(-20, 1);
    // The printed values are the solver's, to four significant digits.
    expect(text(rows[0]?.cells ?? []).fx).toBe((loadCase.reactions.n1?.fx ?? 0).toPrecision(4));
  });

  it("prints 0 for the components that are zero by statics, whatever rounding left in them", () => {
    const { loadCase, nodeIds } = solved(portalFrame());
    // A plane frame loaded in its plane: no force along Y, no moment about X or Z.
    for (const row of reactionRows(loadCase, nodeIds)) {
      const cells = text(row.cells);
      expect(cells.fy).toBe("0");
      expect(cells.mx).toBe("0");
      expect(cells.mz).toBe("0");
      expect(cells.fx).not.toBe("0");
      expect(cells.my).not.toBe("0");
    }
  });

  it("gives the cantilever of the solver's worked example: fz = +10 kN and my = -30 kN·m", () => {
    const { loadCase, nodeIds } = solved(cantilever());
    const rows = reactionRows(loadCase, nodeIds);
    expect(rows).toHaveLength(1);
    expect(text(rows[0]?.cells ?? [])).toEqual({
      fx: "0",
      fy: "0",
      fz: "10.00",
      mx: "0",
      my: "-30.00",
      mz: "0",
    });
  });

  it("has a row for every node that has a support, also one that restrains out of plane only", () => {
    const model = restrainOutOfPlane(portalFrame()).model;
    const { loadCase, nodeIds } = solved(model);
    expect(reactionRows(loadCase, nodeIds).map((row) => row.nodeId)).toEqual([
      "n1",
      "n2",
      "n3",
      "n4",
    ]);
  });

  it("leaves out a node id the load case has no reaction for", () => {
    const { loadCase } = solved(portalFrame());
    expect(reactionRows(loadCase, ["n9", "toString", "n4"]).map((row) => row.nodeId)).toEqual([
      "n4",
    ]);
  });
});

describe("reactionForceSums", () => {
  it("sums the reaction forces: minus the applied load along X, 0 along Y and Z", () => {
    const { loadCase } = solved(portalFrame());
    const sums = reactionForceSums(loadCase);
    expect(units(sums)).toEqual(["kN", "kN", "kN"]);
    expect(text(sums)).toEqual({ fx: "-20.00", fy: "0", fz: "0" });
  });

  it("carries the whole load on the one support that is left", () => {
    const model = removeSupport(portalFrame(), { nodeId: "n4" });
    const { loadCase, nodeIds } = solved(model);
    const rows = reactionRows(loadCase, nodeIds);
    expect(rows.map((row) => row.nodeId)).toEqual(["n1"]);
    expect(text(rows[0]?.cells ?? []).fx).toBe("-20.00");
    expect(text(reactionForceSums(loadCase)).fx).toBe("-20.00");
  });
});

describe("displacementCells", () => {
  it("gives translations in mm and rotations in rad", () => {
    const { loadCase } = solved(cantilever());
    const cells = displacementCells(loadCase, "n2");
    expect(cells?.map((cell) => cell.component)).toEqual(["ux", "uy", "uz", "rx", "ry", "rz"]);
    expect(units(cells ?? [])).toEqual(["mm", "mm", "mm", "rad", "rad", "rad"]);
    const tip = loadCase.displacements.n2;
    if (!tip) {
      throw new Error("no displacement of n2");
    }
    // The solver's metres times 1000, to four significant digits; the tip sinks.
    expect(tip.uz).toBeLessThan(0);
    expect(text(cells ?? []).uz).toBe((tip.uz * 1000).toPrecision(4));
    expect(text(cells ?? []).ry).toBe(tip.ry.toPrecision(4));
    expect(text(cells ?? []).ux).toBe("0");
    expect(text(cells ?? []).uy).toBe("0");
  });

  it("gives zeros at a fixed support", () => {
    const { loadCase } = solved(cantilever());
    expect(text(displacementCells(loadCase, "n1") ?? [])).toEqual({
      ux: "0",
      uy: "0",
      uz: "0",
      rx: "0",
      ry: "0",
      rz: "0",
    });
  });

  it("gives null for a node the result does not have", () => {
    const { loadCase } = solved(cantilever());
    expect(displacementCells(loadCase, "n9")).toBeNull();
    expect(displacementCells(loadCase, "constructor")).toBeNull();
  });
});

describe("memberEndCells", () => {
  it("gives the end forces of the cantilever as the solver's worked example has them", () => {
    const model = cantilever();
    const { loadCase } = solved(model);
    const memberId = model.members[0]?.id ?? "";
    const cells = memberEndCells(loadCase, memberId);
    expect(units(cells?.start ?? [])).toEqual(["kN", "kN", "kN", "kNm", "kNm", "kNm"]);
    expect(text(cells?.start ?? [])).toEqual({
      fx: "0",
      fy: "0",
      fz: "10.00",
      mx: "0",
      my: "-30.00",
      mz: "0",
    });
    expect(text(cells?.end ?? [])).toEqual({
      fx: "0",
      fy: "0",
      fz: "-10.00",
      mx: "0",
      my: "0",
      mz: "0",
    });
  });

  it("gives null for a member the result does not have", () => {
    const { loadCase } = solved(cantilever());
    expect(memberEndCells(loadCase, "m9")).toBeNull();
    expect(memberEndCells(loadCase, "hasOwnProperty")).toBeNull();
  });
});
