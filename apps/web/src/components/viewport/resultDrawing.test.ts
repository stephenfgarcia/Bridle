// Unit tests of what the viewport draws for the results (card PX-02.9, ./resultDrawing.ts): the automatic scale
// with its tidy rounding and the rule that keeps it still, the segments of the deflected shape, the largest
// displacement and its label's place, and the arrows and arcs of the reactions with their directions, their
// labels and what is left out as negligible. The results come from `solve` of @bridle/solver on the fixtures
// of @bridle/model, and the expected numbers from statics and beam formulas written out here.
import { type Model, planarTruss, portalFrame, simplySupportedBeam } from "@bridle/model";
import { type LoadCaseResult, memberValues, type SolveResult, solve } from "@bridle/solver";
import { describe, expect, it } from "vitest";
import { reactionRows } from "../analysis/results";
import {
  AUTO_SCALE_FRACTION,
  AUTO_SCALE_KEEP,
  DEFLECTION_STATIONS,
  deflectedLines,
  displacedPoint,
  formatMm,
  formatScale,
  idealScale,
  largestDisplacement,
  manualScale,
  modelSize,
  nextAutoScale,
  REACTION_GAP_PX,
  type ReactionForceGlyph,
  type ReactionGlyph,
  type ReactionMomentGlyph,
  reactionGlyphs,
  SCALE_MAX,
  SCALE_MIN,
  SUPPORT_DEPTH_PX,
  tidyScale,
} from "./resultDrawing";

type Solved = Extract<SolveResult, { ok: true }>;

function solved(model: Model): Solved {
  const result = solve(model);
  if (!result.ok) {
    throw new Error(`the model was not solved: ${result.reason}`);
  }
  return result;
}

function caseOf(result: Solved, id = "lc1"): LoadCaseResult {
  const loadCase = result.loadCases[id];
  if (loadCase === undefined) {
    throw new Error(`no load case ${id}`);
  }
  return loadCase;
}

/** The portal frame with its lateral load changed to `fx` kN. */
function portalWith(fx: number): Model {
  const model = portalFrame();
  const load = model.nodalLoads[0];
  if (load) {
    load.fx = fx;
  }
  return model;
}

/** A cantilever 6 m long along +X, fixed at `n1`, with 12 kN downward at its tip `n2`. */
function cantilever(): Model {
  const model = simplySupportedBeam();
  model.supports = [{ nodeId: "n1", ux: true, uy: true, uz: true, rx: true, ry: true, rz: true }];
  model.memberUniformLoads = [];
  model.nodalLoads = [
    { id: "nl1", loadCaseId: "lc1", nodeId: "n2", fx: 0, fy: 0, fz: -12, mx: 0, my: 0, mz: 0 },
  ];
  return model;
}

/** Point number `index` of the segment list: two points per segment. */
function pointAt(positions: readonly number[], index: number): [number, number, number] {
  return [
    positions[3 * index] ?? NaN,
    positions[3 * index + 1] ?? NaN,
    positions[3 * index + 2] ?? NaN,
  ];
}

/** The points of member number `member` along its length, from the segments. */
function memberPoints(
  positions: readonly number[],
  member: number,
  stations = DEFLECTION_STATIONS,
): [number, number, number][] {
  const first = 2 * (stations - 1) * member;
  const points = [pointAt(positions, first)];
  for (let segment = 0; segment < stations - 1; segment += 1) {
    points.push(pointAt(positions, first + 2 * segment + 1));
  }
  return points;
}

describe("tidyScale", () => {
  it("gives the nearest of 1, 2 and 5 times a power of ten, by ratio", () => {
    expect(tidyScale(1)).toBe(1);
    expect(tidyScale(1.4)).toBe(1);
    expect(tidyScale(1.5)).toBe(2);
    expect(tidyScale(3)).toBe(2);
    expect(tidyScale(3.2)).toBe(5);
    expect(tidyScale(7)).toBe(5);
    expect(tidyScale(7.1)).toBe(10);
    expect(tidyScale(137)).toBe(100);
    expect(tidyScale(160)).toBe(200);
    expect(tidyScale(420_000)).toBe(500_000);
    expect(tidyScale(0.0023)).toBe(0.002);
    expect(tidyScale(0.04)).toBe(0.05);
  });

  it("is always 1, 2 or 5 times a power of ten and within a factor of 1.59 of the value", () => {
    for (let value = 0.0011; value < 5e6; value *= 1.037) {
      const tidy = tidyScale(value);
      const exponent = Math.floor(Math.log10(tidy) + 1e-9);
      const mantissa = Number((tidy / 10 ** exponent).toPrecision(6));
      expect([1, 2, 5], `tidyScale(${value}) = ${tidy}`).toContain(mantissa);
      expect(tidy / value).toBeLessThan(1.59);
      expect(value / tidy).toBeLessThan(1.59);
    }
  });

  it("gives 1 for what is not a positive finite number and stays within the range of scales", () => {
    for (const value of [0, -3, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(tidyScale(value)).toBe(1);
    }
    expect(tidyScale(1e-12)).toBe(SCALE_MIN);
    expect(tidyScale(1e20)).toBe(SCALE_MAX);
  });
});

describe("the automatic scale", () => {
  it("modelSize is the largest dimension of the box around the nodes", () => {
    expect(modelSize(portalFrame())).toBe(6);
    expect(modelSize(planarTruss())).toBe(12);
    expect(modelSize({ ...portalFrame(), nodes: [] })).toBe(0);
    expect(modelSize({ ...portalFrame(), nodes: [{ id: "n1", x: 2, y: 3, z: 4 }] })).toBe(0);
  });

  it("idealScale draws the largest displacement a tenth of the model's size long", () => {
    expect(AUTO_SCALE_FRACTION).toBe(0.1);
    expect(idealScale(6, 0.005)).toBeCloseTo(120, 9);
    expect(idealScale(6, 0)).toBeNull();
    expect(idealScale(0, 0.005)).toBeNull();
    expect(idealScale(6, Number.NaN)).toBeNull();
  });

  it("starts from the tidy scale and keeps it while the ideal one is within a factor of two", () => {
    const first = nextAutoScale(null, "a", 120);
    expect(first).toEqual({ key: "a", scale: 100 });
    expect(AUTO_SCALE_KEEP).toBe(2);
    for (const ideal of [120, 100, 50, 200, 64.5, 199.9]) {
      expect(nextAutoScale(first, "a", ideal)).toBe(first);
    }
    expect(nextAutoScale(first, "a", 49.9)).toEqual({ key: "a", scale: 50 });
    expect(nextAutoScale(first, "a", 200.1)).toEqual({ key: "a", scale: 200 });
    expect(nextAutoScale(first, "a", 12)).toEqual({ key: "a", scale: 10 });
  });

  it("starts afresh for another key, and keeps the scale while nothing moves", () => {
    const first = nextAutoScale(null, "a", 120);
    expect(nextAutoScale(first, "b", 120)).toEqual({ key: "b", scale: 100 });
    expect(nextAutoScale(first, "b", 180)).toEqual({ key: "b", scale: 200 });
    expect(nextAutoScale(first, "a", null)).toBe(first);
    expect(nextAutoScale(first, "b", null)).toEqual({ key: "b", scale: 1 });
    expect(nextAutoScale(null, "a", null)).toEqual({ key: "a", scale: 1 });
  });

  it("gives the same answer when asked twice", () => {
    for (const ideal of [0.3, 12, 120, 199, 4321]) {
      const once = nextAutoScale(null, "a", ideal);
      expect(nextAutoScale(once, "a", ideal)).toBe(once);
    }
  });

  it("does not change while the load of the portal frame goes from 20 to 25 kN in steps, and does at 60 kN", () => {
    let held = null as ReturnType<typeof nextAutoScale> | null;
    const scales: number[] = [];
    for (const fx of [20, 21, 22, 23, 24, 25, 24, 20, 17]) {
      const model = portalWith(fx);
      const largest = largestDisplacement(model, solved(model), "lc1");
      held = nextAutoScale(held, "portal", idealScale(modelSize(model), largest?.value ?? 0));
      scales.push(held.scale);
    }
    // 0.1 times 6 m over 4.89 mm is 123: the tidy scale is 100.
    expect(scales).toEqual(scales.map(() => 100));
    const heavy = portalWith(60);
    const largest = largestDisplacement(heavy, solved(heavy), "lc1");
    held = nextAutoScale(held, "portal", idealScale(modelSize(heavy), largest?.value ?? 0));
    expect(held.scale).toBe(50);
  });

  it("manualScale takes a positive finite number, within the range of scales", () => {
    expect(manualScale(250)).toBe(250);
    expect(manualScale(1)).toBe(1);
    expect(manualScale(0)).toBeNull();
    expect(manualScale(-5)).toBeNull();
    expect(manualScale(Number.NaN)).toBeNull();
    expect(manualScale(1e-9)).toBe(SCALE_MIN);
    expect(manualScale(1e12)).toBe(SCALE_MAX);
  });

  it("formatScale writes a scale with at most four significant digits", () => {
    expect(formatScale(200)).toBe("200");
    expect(formatScale(0.05)).toBe("0.05");
    expect(formatScale(1)).toBe("1");
    expect(formatScale(123.456)).toBe("123.5");
  });
});

describe("deflectedLines", () => {
  it("draws 20 segments per member of the portal frame, in the model's order", () => {
    const model = portalFrame();
    const lines = deflectedLines(model, solved(model), "lc1", 100);
    expect(lines?.memberIds).toEqual(["c1", "b1", "c2"]);
    expect(lines?.stations).toBe(21);
    expect(lines?.positions).toHaveLength(3 * 20 * 6);
    expect(lines?.positions.every(Number.isFinite)).toBe(true);
  });

  it("joins each segment to the next and the members at the joints", () => {
    const model = portalFrame();
    const result = solved(model);
    const scale = 100;
    const positions = deflectedLines(model, result, "lc1", scale)?.positions ?? [];
    for (let member = 0; member < 3; member += 1) {
      for (let segment = 0; segment + 1 < 20; segment += 1) {
        const end = pointAt(positions, 2 * (20 * member + segment) + 1);
        const next = pointAt(positions, 2 * (20 * member + segment + 1));
        expect(end).toEqual(next);
      }
    }
    const [c1, b1, c2] = [0, 1, 2].map((member) => memberPoints(positions, member));
    const u = caseOf(result).displacements;
    // The fixed bases do not move; the joints n2 and n3 are where the node's displacement puts them.
    expect(c1?.[0]).toEqual([0, 0, 0]);
    expect(c2?.[0]).toEqual([6, 0, 0]);
    const n2 = [
      scale * (u.n2?.ux ?? NaN),
      scale * (u.n2?.uy ?? NaN),
      4 + scale * (u.n2?.uz ?? NaN),
    ];
    const n3 = [
      6 + scale * (u.n3?.ux ?? NaN),
      scale * (u.n3?.uy ?? NaN),
      4 + scale * (u.n3?.uz ?? NaN),
    ];
    for (const axis of [0, 1, 2] as const) {
      expect(c1?.[20]?.[axis]).toBeCloseTo(n2[axis] ?? NaN, 12);
      expect(b1?.[0]?.[axis]).toBeCloseTo(n2[axis] ?? NaN, 12);
      expect(b1?.[20]?.[axis]).toBeCloseTo(n3[axis] ?? NaN, 12);
      expect(c2?.[20]?.[axis]).toBeCloseTo(n3[axis] ?? NaN, 12);
    }
  });

  it("sways the portal frame the way the load pushes, the columns in double curvature from their bases", () => {
    const model = portalFrame();
    const positions = deflectedLines(model, solved(model), "lc1", 100)?.positions ?? [];
    for (const [member, baseX] of [
      [0, 0],
      [2, 6],
    ] as const) {
      const sway = memberPoints(positions, member).map((point) => point[0] - baseX);
      // Every point above the base moves along +X, more the higher it is.
      for (let station = 1; station <= 20; station += 1) {
        expect(sway[station]).toBeGreaterThan(sway[station - 1] ?? NaN);
      }
      // A fixed base: the column leaves it along its own axis, so the first step is much smaller than the
      // average step.
      expect(sway[1]).toBeLessThan((sway[20] ?? NaN) / 20 / 5);
      // Double curvature: the bend turns one way near the base and the other way near the top.
      const bend = (station: number) =>
        (sway[station + 1] ?? NaN) - 2 * (sway[station] ?? NaN) + (sway[station - 1] ?? NaN);
      expect(bend(2)).toBeGreaterThan(0);
      expect(bend(18)).toBeLessThan(0);
    }
    // The points stay in the frame's plane.
    for (let index = 1; index < positions.length; index += 3) {
      expect(Math.abs(positions[index] ?? NaN)).toBeLessThan(1e-9);
    }
  });

  it("makes the simply supported beam sag by 5wL⁴/(384EI) times the scale at mid-span", () => {
    const model = simplySupportedBeam();
    const scale = 50;
    const points = memberPoints(
      deflectedLines(model, solved(model), "lc1", scale)?.positions ?? [],
      0,
    );
    // w = 10 kN/m, L = 6 m, E = 2.1e8 kN/m², Iy = 8.4e-5 m⁴.
    const sag = (5 * 10 * 6 ** 4) / (384 * 2.1e8 * 8.4e-5);
    expect(sag).toBeCloseTo(0.0095663, 6);
    expect(points[10]?.[0]).toBeCloseTo(3, 12);
    expect(points[10]?.[2]).toBeCloseTo(-scale * sag, 9);
    expect(points[0]).toEqual([0, 0, 0]);
    expect(points[20]?.[2]).toBeCloseTo(0, 12);
    for (let station = 1; station < 20; station += 1) {
      expect(points[station]?.[2]).toBeLessThan(0);
      expect(points[station]?.[2]).toBeCloseTo(points[20 - station]?.[2] ?? NaN, 9);
    }
  });

  it("lies on the members at scale 0, and scales the displacements in proportion", () => {
    const model = portalFrame();
    const result = solved(model);
    const flat = memberPoints(deflectedLines(model, result, "lc1", 0)?.positions ?? [], 1);
    flat.forEach((point, station) => {
      expect(point[0]).toBeCloseTo(0.3 * station, 12);
      expect(point[1]).toBe(0);
      expect(point[2]).toBe(4);
    });
    const once = memberPoints(deflectedLines(model, result, "lc1", 100)?.positions ?? [], 1);
    const twice = memberPoints(deflectedLines(model, result, "lc1", 200)?.positions ?? [], 1);
    once.forEach((point, station) => {
      for (const axis of [0, 2] as const) {
        const rest = flat[station]?.[axis] ?? NaN;
        expect((twice[station]?.[axis] ?? NaN) - rest).toBeCloseTo(2 * (point[axis] - rest), 10);
      }
    });
  });

  it("gives nothing for a load case the result does not have and for a model that was not solved", () => {
    const model = portalFrame();
    expect(deflectedLines(model, solved(model), "lc9", 100)).toBeNull();
    expect(deflectedLines(model, solved(model), "toString", 100)).toBeNull();
    const truss = planarTruss();
    const refused = solve(truss);
    expect(refused.ok).toBe(false);
    expect(deflectedLines(truss, refused, "lc1", 100)).toBeNull();
    expect(largestDisplacement(truss, refused, "lc1")).toBeNull();
  });
});

describe("largestDisplacement", () => {
  it("is the mid-span sag of the simply supported beam, 3 m from its start node", () => {
    const model = simplySupportedBeam();
    const largest = largestDisplacement(model, solved(model), "lc1");
    expect(largest?.place).toEqual({
      kind: "member",
      memberId: "m1",
      startNodeId: "n1",
      distance: 3,
    });
    expect(largest?.value).toBeCloseTo((5 * 10 * 6 ** 4) / (384 * 2.1e8 * 8.4e-5), 12);
    expect(largest?.point).toEqual([3, 0, 0]);
    expect(largest?.displacement[0]).toBeCloseTo(0, 12);
    expect(largest?.displacement[2]).toBeCloseTo(-(largest?.value ?? NaN), 12);
    expect(formatMm(largest?.value ?? NaN)).toBe("9.566");
  });

  it("is at the tip node of a cantilever: PL³/(3EI)", () => {
    const model = cantilever();
    const largest = largestDisplacement(model, solved(model), "lc1");
    expect(largest?.place).toEqual({ kind: "node", nodeId: "n2" });
    expect(largest?.value).toBeCloseTo((12 * 6 ** 3) / (3 * 2.1e8 * 8.4e-5), 10);
    expect(largest?.point).toEqual([6, 0, 0]);
  });

  it("is not above the largest of 2001 points per member of the portal frame, and within 0.1 % of it", () => {
    const model = portalFrame();
    const result = solved(model);
    const largest = largestDisplacement(model, result, "lc1");
    let reference = 0;
    for (const member of model.members) {
      const values = memberValues(model, result, "lc1", member.id, 2001);
      const d = values?.deflectionGlobal ?? new Float64Array();
      for (let index = 0; index < d.length; index += 3) {
        reference = Math.max(
          reference,
          Math.hypot(d[index] ?? 0, d[index + 1] ?? 0, d[index + 2] ?? 0),
        );
      }
    }
    expect(largest?.value).toBeLessThanOrEqual(reference * (1 + 1e-12));
    expect(largest?.value).toBeGreaterThan(reference * 0.999);
    // The sway of the loaded joint is nearly all of it.
    const sway = caseOf(result).displacements.n2?.ux ?? NaN;
    expect(largest?.value).toBeGreaterThanOrEqual(sway);
    expect(largest?.value).toBeLessThan(sway * 1.01);
    expect(largest?.displacement[0]).toBeGreaterThan(0);
  });

  it("grows in proportion to the load", () => {
    const at = (fx: number) => {
      const model = portalWith(fx);
      return largestDisplacement(model, solved(model), "lc1")?.value ?? NaN;
    };
    expect(at(30) / at(20)).toBeCloseTo(1.5, 10);
    expect(at(2) / at(20)).toBeCloseTo(0.1, 10);
  });

  it("is nothing when nothing moves, and for a load case the result does not have", () => {
    const model = portalWith(0);
    expect(largestDisplacement(model, solved(model), "lc1")).toBeNull();
    const loaded = portalFrame();
    expect(largestDisplacement(loaded, solved(loaded), "lc9")).toBeNull();
  });

  it("puts the label on the deflected curve: the point plus the scale times its displacement", () => {
    const model = simplySupportedBeam();
    const result = solved(model);
    const largest = largestDisplacement(model, result, "lc1");
    if (!largest) {
      throw new Error("no largest displacement");
    }
    const at = displacedPoint(largest, 50);
    const curve = memberPoints(deflectedLines(model, result, "lc1", 50)?.positions ?? [], 0);
    expect(at[0]).toBeCloseTo(curve[10]?.[0] ?? NaN, 12);
    expect(at[1]).toBeCloseTo(curve[10]?.[1] ?? NaN, 12);
    expect(at[2]).toBeCloseTo(curve[10]?.[2] ?? NaN, 12);
    expect(displacedPoint(largest, 0)).toEqual([3, 0, 0]);
    // The portal frame sways along +X by 4.9 mm: at scale 100 the label is 0.49 m to the right of its point.
    const portal = portalFrame();
    const sway = largestDisplacement(portal, solved(portal), "lc1");
    if (!sway) {
      throw new Error("no largest displacement");
    }
    const label = displacedPoint(sway, 100);
    for (const axis of [0, 1, 2] as const) {
      expect(label[axis]).toBeCloseTo(sway.point[axis] + 100 * sway.displacement[axis], 12);
    }
    expect(label[0] - sway.point[0]).toBeGreaterThan(0.45);
    expect(label[0] - sway.point[0]).toBeLessThan(0.5);
  });
});

function force(glyphs: ReactionGlyph[], key: string): ReactionForceGlyph {
  const glyph = glyphs.find((candidate) => candidate.key === key);
  if (glyph?.kind !== "force") {
    throw new Error(`no force ${key}`);
  }
  return glyph;
}

function moment(glyphs: ReactionGlyph[], key: string): ReactionMomentGlyph {
  const glyph = glyphs.find((candidate) => candidate.key === key);
  if (glyph?.kind !== "moment") {
    throw new Error(`no moment ${key}`);
  }
  return glyph;
}

/** A load case that holds only the given reactions. */
function reactionsOnly(reactions: LoadCaseResult["reactions"]): LoadCaseResult {
  return {
    loadCaseId: "lc1",
    displacements: {},
    reactions,
    displacementVector: new Float64Array(),
    reactionVector: new Float64Array(),
    sensitivity: 0,
    memberEndForces: {},
  };
}

const NO_REACTION = { fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 };

describe("reactionGlyphs", () => {
  it("draws the in-plane components of the portal frame's two fixed bases, and no other", () => {
    const model = portalFrame();
    const result = solved(model);
    const glyphs = reactionGlyphs(model, caseOf(result), result.nodeIds);
    expect(glyphs.map((glyph) => glyph.key)).toEqual([
      "n1:fx",
      "n1:fz",
      "n1:my",
      "n4:fx",
      "n4:fz",
      "n4:my",
    ]);
    for (const glyph of glyphs) {
      expect(glyph.point).toEqual(glyph.nodeId === "n1" ? [0, 0, 0] : [6, 0, 0]);
      expect(glyph.magnitude).toBeGreaterThan(0);
    }
  });

  it("points each arrow of the portal frame the way its support pushes", () => {
    const model = portalFrame();
    const result = solved(model);
    const glyphs = reactionGlyphs(model, caseOf(result), result.nodeIds);
    // The load pushes along +X: both bases push back along -X, each arrow on the +X side with its head at
    // the node.
    for (const key of ["n1:fx", "n4:fx"]) {
      const glyph = force(glyphs, key);
      expect(glyph.direction).toEqual([-1, 0, 0]);
      expect(glyph.side).toEqual([1, 0, 0]);
      expect(glyph.nearEnd).toBe("head");
      expect(glyph.clearancePx).toBe(5 + REACTION_GAP_PX);
    }
    expect(force(glyphs, "n1:fx").magnitude + force(glyphs, "n4:fx").magnitude).toBeCloseTo(20, 9);
    // The load overturns the frame clockwise in the Front view: the left base holds it down, the right base
    // holds it up, by the same force. Both arrows stand below their support.
    const left = force(glyphs, "n1:fz");
    const right = force(glyphs, "n4:fz");
    expect(left.direction).toEqual([0, 0, -1]);
    expect(left.side).toEqual([0, 0, -1]);
    expect(left.nearEnd).toBe("tail");
    expect(right.direction).toEqual([0, 0, 1]);
    expect(right.side).toEqual([0, 0, -1]);
    expect(right.nearEnd).toBe("head");
    expect(left.magnitude).toBeCloseTo(right.magnitude, 9);
    expect(left.clearancePx).toBe(SUPPORT_DEPTH_PX.fixed + REACTION_GAP_PX);
    // Both bases turn the frame about -Y (counter-clockwise in the Front view, against the overturning), and
    // with the couple of the vertical reactions they balance the 20 kN at 4 m: 80 kN·m.
    const m1 = moment(glyphs, "n1:my");
    const m4 = moment(glyphs, "n4:my");
    expect(m1.axis).toEqual([0, -1, 0]);
    expect(m4.axis).toEqual([0, -1, 0]);
    expect(m1.magnitude + m4.magnitude + 6 * right.magnitude).toBeCloseTo(80, 8);
  });

  it("labels each component with the magnitude the Results section prints, without the sign", () => {
    const model = portalFrame();
    const result = solved(model);
    const loadCase = caseOf(result);
    const glyphs = reactionGlyphs(model, loadCase, result.nodeIds);
    const rows = reactionRows(loadCase, result.nodeIds);
    for (const glyph of glyphs) {
      const cell = rows
        .find((row) => row.nodeId === glyph.nodeId)
        ?.cells.find((candidate) => candidate.component === glyph.component);
      expect(glyph.label.value).toBe(cell?.text.replace("-", ""));
      expect(glyph.label.unit).toBe(glyph.kind === "force" ? "kN" : "kNm");
    }
    expect(force(glyphs, "n1:fx").label).toEqual({ value: "10.04", unit: "kN" });
    expect(force(glyphs, "n4:fz").label).toEqual({ value: "5.326", unit: "kN" });
    // The components the section prints as "0" are the ones not drawn.
    const drawn = new Set(glyphs.map((glyph) => glyph.key));
    for (const row of rows) {
      for (const cell of row.cells) {
        expect(drawn.has(`${row.nodeId}:${cell.component}`)).toBe(cell.text !== "0");
      }
    }
  });

  it("draws the two upward reactions of the beam below their supports, pointing up at them", () => {
    const model = simplySupportedBeam();
    const result = solved(model);
    const glyphs = reactionGlyphs(model, caseOf(result), result.nodeIds);
    expect(glyphs.map((glyph) => glyph.key)).toEqual(["n1:fz", "n2:fz"]);
    for (const key of ["n1:fz", "n2:fz"]) {
      const glyph = force(glyphs, key);
      expect(glyph.direction).toEqual([0, 0, 1]);
      expect(glyph.side).toEqual([0, 0, -1]);
      expect(glyph.nearEnd).toBe("head");
      expect(glyph.magnitude).toBeCloseTo(30, 9);
      expect(glyph.label).toEqual({ value: "30.00", unit: "kN" });
    }
    // n1 is drawn as a pinned support and n2 as a roller: each arrow starts below its symbol.
    expect(force(glyphs, "n1:fz").clearancePx).toBe(SUPPORT_DEPTH_PX.pinned + REACTION_GAP_PX);
    expect(force(glyphs, "n2:fz").clearancePx).toBe(SUPPORT_DEPTH_PX.roller + REACTION_GAP_PX);
  });

  it("gives every component its own direction, side and axis by its sign", () => {
    const model = portalFrame();
    const glyphs = reactionGlyphs(
      model,
      reactionsOnly({
        n1: { fx: 3, fy: -4, fz: 5, mx: 6, my: 7, mz: -8 },
        n4: { fx: -3, fy: 4, fz: -5, mx: -6, my: -7, mz: 8 },
      }),
      ["n1", "n2", "n3", "n4"],
    );
    expect(glyphs).toHaveLength(12);
    expect(force(glyphs, "n1:fx")).toMatchObject({ direction: [1, 0, 0], side: [-1, 0, 0] });
    expect(force(glyphs, "n4:fx")).toMatchObject({ direction: [-1, 0, 0], side: [1, 0, 0] });
    expect(force(glyphs, "n1:fy")).toMatchObject({ direction: [0, -1, 0], side: [0, 1, 0] });
    expect(force(glyphs, "n4:fy")).toMatchObject({ direction: [0, 1, 0], side: [0, -1, 0] });
    expect(force(glyphs, "n1:fz")).toMatchObject({ direction: [0, 0, 1], nearEnd: "head" });
    expect(force(glyphs, "n4:fz")).toMatchObject({ direction: [0, 0, -1], nearEnd: "tail" });
    expect(moment(glyphs, "n1:mx").axis).toEqual([1, 0, 0]);
    expect(moment(glyphs, "n4:mx").axis).toEqual([-1, 0, 0]);
    expect(moment(glyphs, "n1:my").axis).toEqual([0, 1, 0]);
    expect(moment(glyphs, "n4:my").axis).toEqual([0, -1, 0]);
    expect(moment(glyphs, "n1:mz").axis).toEqual([0, 0, -1]);
    expect(moment(glyphs, "n4:mz").axis).toEqual([0, 0, 1]);
    for (const glyph of glyphs) {
      expect(glyph.magnitude).toBeGreaterThan(0);
      expect(glyph.label.value.startsWith("-")).toBe(false);
    }
    expect(force(glyphs, "n1:fy").label.value).toBe("4.000");
    expect(moment(glyphs, "n1:mz").label.value).toBe("8.000");
  });

  it("draws nothing for a component that is zero or negligible beside the largest of its kind", () => {
    const model = portalFrame();
    const glyphs = reactionGlyphs(
      model,
      reactionsOnly({
        // 1e-9 of the largest force (20) is 2e-8; of the largest moment (50), 5e-8.
        n1: { fx: 20, fy: 1.9e-8, fz: 0, mx: 4e-8, my: 50, mz: 0 },
        n4: { fx: 2.1e-8, fy: -1e-15, fz: -0, mx: 6e-8, my: 0, mz: Number.NaN },
      }),
      ["n1", "n4"],
    );
    expect(glyphs.map((glyph) => glyph.key)).toEqual(["n1:fx", "n1:my", "n4:fx", "n4:mx"]);
    expect(
      reactionGlyphs(model, reactionsOnly({ n1: NO_REACTION, n4: NO_REACTION }), ["n1", "n4"]),
    ).toEqual([]);
  });

  it("leaves out a support whose node the model does not hold, and follows the order of the node ids", () => {
    const model = portalFrame();
    const loadCase = reactionsOnly({
      n4: { ...NO_REACTION, fz: 2 },
      gone: { ...NO_REACTION, fz: 9 },
      n1: { ...NO_REACTION, fz: 1 },
    });
    const glyphs = reactionGlyphs(model, loadCase, ["n1", "gone", "n4", "toString"]);
    expect(glyphs.map((glyph) => glyph.key)).toEqual(["n1:fz", "n4:fz"]);
    // A node without a support in the model has no symbol to clear: the gap alone.
    const bare = reactionGlyphs({ ...model, supports: [] }, loadCase, ["n1"]);
    expect(force(bare, "n1:fz").clearancePx).toBe(REACTION_GAP_PX);
  });
});
