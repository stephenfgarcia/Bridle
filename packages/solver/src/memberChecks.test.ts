import {
  type MemberPointLoad,
  type MemberUniformLoad,
  type Model,
  memberLocalAxes,
  type NodalLoad,
  portalFrame,
  type Section,
  type Support,
  simplySupportedBeam,
  VERTICAL_TOLERANCE,
} from "@bridle/model";
import { describe, expect, it } from "vitest";
import { buildingFrame } from "./bench";
import {
  COLLINEAR_TOLERANCE,
  DOFS,
  governingChecks,
  type LoadCaseResult,
  type MemberCheck,
  type MemberCheckOptions,
  type MemberChecks,
  memberChecks,
  memberValues,
  NOT_CHECKED,
  type SolveResult,
  type SpanDeflection,
  solve,
  spanDeflection,
  structureChecks,
} from "./index";

/**
 * Tolerances. Each test names the one it uses.
 * - REL: |computed - expected| <= 1e-12 · |expected|, for a value with a closed-form expression.
 * - ZERO: a value that is zero in exact arithmetic may be at most 1e-12 times a scale given in the
 *   test (a stress or a deflection of the same case).
 * - Wider tolerances are stated and explained where a test uses them.
 */
const REL = 1e-12;
const ZERO = 1e-12;

/** The fixtures' section and material (packages/model/src/fixtures.ts). */
const E = 2.1e8;
const G = 8.1e7;
const A = 5.4e-3;
const Iy = 8.4e-5;
const Iz = 6.0e-6;
const J = 2.0e-7;
const DEPTH_Y = 0.15;
const DEPTH_Z = 0.3;
const FY = 3.55e5;
/** The elastic section moduli of that section: W = I / (half the depth). */
const Wy = Iy / (DEPTH_Z / 2);
const Wz = Iz / (DEPTH_Y / 2);

type DofName = (typeof DOFS)[number];
const ALL: readonly DofName[] = DOFS;
/** The supports of the simply supported beam fixture. */
const PIN: readonly DofName[] = ["ux", "uy", "uz", "rx"];
const ROLLER: readonly DofName[] = ["uy", "uz"];

function support(nodeId: string, restrained: readonly DofName[]): Support {
  const has = (dof: DofName) => restrained.includes(dof);
  return {
    nodeId,
    ux: has("ux"),
    uy: has("uy"),
    uz: has("uz"),
    rx: has("rx"),
    ry: has("ry"),
    rz: has("rz"),
  };
}

function nodal(id: string, nodeId: string, components: Partial<NodalLoad>): NodalLoad {
  return { id, loadCaseId: "lc1", nodeId, fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0, ...components };
}

function uniform(
  id: string,
  memberId: string,
  axes: "global" | "local",
  direction: "x" | "y" | "z",
  value: number,
): MemberUniformLoad {
  return { id, loadCaseId: "lc1", memberId, axes, direction, value };
}

function point(
  id: string,
  memberId: string,
  axes: "global" | "local",
  direction: "x" | "y" | "z",
  value: number,
  position: number,
): MemberPointLoad {
  return { id, loadCaseId: "lc1", memberId, axes, direction, value, position };
}

interface Loads {
  nodal?: NodalLoad[];
  uniform?: MemberUniformLoad[];
  point?: MemberPointLoad[];
}

/** A model of frame members with the fixtures' section and material and the load case `lc1`. */
function frame(
  nodes: [id: string, x: number, y: number, z: number][],
  members: [id: string, start: string, end: string, rollAngleDeg?: number][],
  supports: Support[],
  loads: Loads = {},
): Model {
  return {
    version: 1,
    units: { force: "kN", length: "m" },
    nodes: nodes.map(([id, x, y, z]) => ({ id, x, y, z })),
    members: members.map(([id, startNodeId, endNodeId, rollAngleDeg]) => ({
      id,
      startNodeId,
      endNodeId,
      sectionId: "s1",
      materialId: "mat1",
      kind: "frame",
      rollAngleDeg: rollAngleDeg ?? 0,
      releases: {
        start: { rx: false, ry: false, rz: false },
        end: { rx: false, ry: false, rz: false },
      },
    })),
    sections: [{ id: "s1", name: "I 300x150", A, Iy, Iz, J, depthY: DEPTH_Y, depthZ: DEPTH_Z }],
    materials: [{ id: "mat1", name: "S355", E, G, fy: FY, density: 7850 }],
    supports,
    loadCases: [{ id: "lc1", name: "LC1" }],
    nodalLoads: loads.nodal ?? [],
    memberUniformLoads: loads.uniform ?? [],
    memberPointLoads: loads.point ?? [],
  };
}

type Solved = Extract<SolveResult, { ok: true }>;

function solved(model: Model): Solved {
  const result = solve(model);
  if (!result.ok) {
    throw new Error(`test: expected the model to solve, got ${result.reason}`);
  }
  return result;
}

function loadCase(result: Solved, id = "lc1"): LoadCaseResult {
  const found = result.loadCases[id];
  if (!found) {
    throw new Error(`test: no load case ${id}`);
  }
  return found;
}

/** `memberChecks` of a freshly solved model. */
function checks(model: Model, options?: MemberCheckOptions, loadCaseId = "lc1"): MemberChecks {
  const found = memberChecks(model, solved(model), loadCaseId, options);
  if (!found) {
    throw new Error("test: no checks");
  }
  return found;
}

/** The check of one member of a freshly solved model. */
function check(
  model: Model,
  memberId: string,
  options?: MemberCheckOptions,
  loadCaseId = "lc1",
): MemberCheck {
  const found = checks(model, options, loadCaseId).members.find(
    (member) => member.memberId === memberId,
  );
  if (!found) {
    throw new Error(`test: no check for ${memberId}`);
  }
  return found;
}

type SpanOk = Extract<SpanDeflection, { ok: true }>;

function spanOf(model: Model, memberIds: string[], divisor?: number, stations?: number): SpanOk {
  const found = spanDeflection(model, solved(model), "lc1", memberIds, divisor, stations);
  if (!found.ok) {
    throw new Error(`test: span refused: ${found.reason}`);
  }
  return found;
}

function expectRel(actual: number, expected: number, tolerance = REL, what = ""): void {
  expect(Math.abs(actual - expected), `${what}: ${actual} against ${expected}`).toBeLessThanOrEqual(
    tolerance * Math.abs(expected),
  );
}

function expectZero(actual: number, scale: number, what = "", tolerance = ZERO): void {
  expect(Math.abs(actual), `${what}: ${actual} should be zero`).toBeLessThanOrEqual(
    tolerance * scale,
  );
}

/** One member `m1` from `n1` (0, 0, 0) to `n2` (L, 0, 0) with the given supports. */
function span(
  startDofs: readonly DofName[],
  endDofs: readonly DofName[],
  loads: Loads,
  L = 6,
  roll = 0,
): Model {
  const supports = [support("n1", startDofs)];
  if (endDofs.length > 0) {
    supports.push(support("n2", endDofs));
  }
  return frame(
    [
      ["n1", 0, 0, 0],
      ["n2", L, 0, 0],
    ],
    [["m1", "n1", "n2", roll]],
    supports,
    loads,
  );
}

/** The simply supported beam of 6 m along +X (the fixture's supports) with the given loads. */
function beam(loads: Loads, roll = 0): Model {
  return span(PIN, ROLLER, loads, 6, roll);
}

const w = 10;
const L = 6;
/** The mid-span moment and deflection of the simply supported beam under w. */
const M_MID = (w * L * L) / 8;
const D_MID = (5 * w * L ** 4) / (384 * E * Iy);

describe("memberChecks: the result", () => {
  it("is marked illustrative, lists what is not checked as ten stable codes, and reports the parameters it used (defaults: factor 1, span/360, height/300, 21 stations)", () => {
    const found = checks(portalFrame());
    expect(found.kind).toBe("illustrative");
    expect(found.loadCaseId).toBe("lc1");
    expect(found.notChecked).toEqual([
      "member-buckling",
      "plate-buckling",
      "lateral-torsional-buckling",
      "shear-stress",
      "torsion-stress",
      "design-code-interaction",
      "load-and-resistance-factors",
      "connections",
      "fatigue",
      "other-serviceability",
    ]);
    expect(found.notChecked).toEqual([...NOT_CHECKED]);
    expect(found.notChecked).not.toBe(NOT_CHECKED);
    expect(found.allowableFactor).toBe(1);
    expect(found.deflectionDivisor).toBe(360);
    expect(found.driftDivisor).toBe(300);
    expect(found.stations).toBe(21);
    expect(found.members.map((member) => member.memberId)).toEqual(["c1", "b1", "c2"]);
    expect(found.skipped).toEqual([]);
  });

  it("a vertical member has a drift and no deflection, any other member a deflection and no drift", () => {
    const found = checks(portalFrame());
    const [c1, b1, c2] = found.members as [MemberCheck, MemberCheck, MemberCheck];
    expect([c1.vertical, b1.vertical, c2.vertical]).toEqual([true, false, true]);
    expect(c1.deflection).toBeNull();
    expect(c2.deflection).toBeNull();
    expect(b1.drift).toBeNull();
    expect(c1.drift).not.toBeNull();
    expect(b1.deflection).not.toBeNull();
    expect([c1.length, b1.length, c2.length]).toEqual([4, 6, 4]);
  });

  it("is plain data (structuredClone gives an equal value), does not change its arguments, and gives the same result on a second call", () => {
    const model = portalFrame();
    model.memberUniformLoads.push(uniform("u", "b1", "global", "z", -w));
    const result = solved(model);
    const modelBefore = structuredClone(model);
    const resultBefore = structuredClone(result);
    const found = memberChecks(model, result, "lc1");
    expect(model).toEqual(modelBefore);
    expect(result).toEqual(resultBefore);
    expect(structuredClone(found)).toEqual(found);
    expect(JSON.parse(JSON.stringify(found))).toEqual(found);
    expect(memberChecks(model, result, "lc1")).toEqual(found);
    const governing = structureChecks(model, result, "lc1");
    expect(structuredClone(governing)).toEqual(governing);
    const one = spanDeflection(model, result, "lc1", ["b1"]);
    expect(structuredClone(one)).toEqual(one);
    expect(model).toEqual(modelBefore);
    expect(result).toEqual(resultBefore);
  });

  it("returns undefined for a result that is not ok and for a load case the result does not have", () => {
    const model = portalFrame();
    const result = solved(model);
    expect(memberChecks(model, result, "nope")).toBeUndefined();
    expect(memberChecks(model, result, "toString")).toBeUndefined();
    expect(structureChecks(model, result, "nope")).toBeUndefined();
    const unsupported = portalFrame();
    unsupported.supports = [];
    const refused = solve(unsupported);
    expect(refused.ok).toBe(false);
    expect(memberChecks(unsupported, refused, "lc1")).toBeUndefined();
    expect(structureChecks(unsupported, refused, "lc1")).toBeUndefined();
  });

  it("an option that is not a finite number above zero is replaced by its default; stations: a fraction is rounded down, below 5 is 5, above 1001 is 1001, not finite is 21", () => {
    const model = simplySupportedBeam();
    const bad = checks(model, {
      allowableFactor: 0,
      deflectionDivisor: -250,
      driftDivisor: Number.NaN,
      stations: Number.POSITIVE_INFINITY,
    });
    expect(bad).toEqual(checks(model));
    expect(checks(model, { allowableFactor: Number.POSITIVE_INFINITY }).allowableFactor).toBe(1);
    expect(checks(model, { stations: 2 }).stations).toBe(5);
    expect(checks(model, { stations: 7.9 }).stations).toBe(7);
    expect(checks(model, { stations: 5000 }).stations).toBe(1001);
    expect(checks(model, { stations: Number.NaN }).stations).toBe(21);
    const used = checks(model, { allowableFactor: 0.6, deflectionDivisor: 250, driftDivisor: 500 });
    expect([used.allowableFactor, used.deflectionDivisor, used.driftDivisor]).toEqual([
      0.6, 250, 500,
    ]);
  });

  it("lists a truss member, a member with a release and a member without values as skipped (a result of the portal frame given with a changed copy of its model)", () => {
    const model = portalFrame();
    const result = solved(model);
    const changed = structuredClone(model);
    const [c1, b1, c2] = changed.members as [
      Model["members"][number],
      Model["members"][number],
      Model["members"][number],
    ];
    c1.sectionId = "missing";
    b1.kind = "truss";
    c2.releases.end.ry = true;
    const found = memberChecks(changed, result, "lc1");
    expect(found?.members).toEqual([]);
    expect(found?.skipped).toEqual([
      { memberId: "c1", reason: "no-values" },
      { memberId: "b1", reason: "truss" },
      { memberId: "c2", reason: "release" },
    ]);
    expect(structureChecks(changed, result, "lc1")).toMatchObject({
      kind: "illustrative",
      stress: null,
      deflection: null,
      drift: null,
    });
  });
});

describe("memberChecks: the simply supported beam under a uniform load (6 m, 10 kN/m)", () => {
  it("sigma = M/W at mid-span with W = Iy/(depthZ/2): tension at a bottom corner, compression at a top corner; the ratio to fy (REL)", () => {
    const m1 = check(simplySupportedBeam(), "m1");
    const sigma = M_MID / Wy;
    // 45 kN·m · 0.15 m / 8.4e-5 m⁴ = 80 357.142857... kN/m² (80.36 MPa).
    expectRel(sigma, 80357.14285714286, 1e-15, "the hand value");
    expectRel(m1.stress.tension.value, sigma, REL, "tension");
    expectRel(m1.stress.compression.value, -sigma, REL, "compression");
    expect(m1.stress.tension.x).toBe(3);
    expect(m1.stress.compression.x).toBe(3);
    // Bottom: local z = global Z for this member, so z = -depthZ/2 is the lower face.
    expect(m1.stress.tension.z).toBe(-DEPTH_Z / 2);
    expect(m1.stress.compression.z).toBe(DEPTH_Z / 2);
    // Mz is zero: the two corners of a face tie, and the first in the order (-y before +y) is given.
    expect(m1.stress.tension.y).toBe(-DEPTH_Y / 2);
    expect(m1.stress.compression.y).toBe(-DEPTH_Y / 2);
    expectRel(m1.stress.largest, sigma, REL, "largest");
    expect(m1.stress.fy).toBe(FY);
    expect(m1.stress.allowable).toBe(FY);
    expectRel(m1.stress.ratio, sigma / FY, REL, "ratio");
    expectRel(sigma / FY, 0.2264, 2e-4, "0.2264 (README)");
    expect(m1.stress.passes).toBe(true);
  });

  it("the deflection ratio is (5wL⁴/384EI)/(L/360), at mid-span, downward (REL)", () => {
    const m1 = check(simplySupportedBeam(), "m1");
    const d = m1.deflection;
    if (!d) {
      throw new Error("test: no deflection");
    }
    expectRel(d.value, D_MID, REL, "value");
    expectRel(D_MID, 9.566326530612245e-3, 1e-14, "the hand value: 64 800 / 6 773 760 m");
    expect(d.x).toBe(3);
    expectRel(d.localZ, -D_MID, REL, "localZ");
    expect(d.localY).toBe(0);
    expect(d.span).toBe(6);
    expect(d.divisor).toBe(360);
    expect(d.limit).toBe(6 / 360);
    expectRel(d.ratio, D_MID / (L / 360), REL, "ratio");
    // 9.566e-3 m against 16.67e-3 m.
    expectRel(d.ratio, 0.5739795918367347, 1e-12, "the hand value of the ratio");
    expect(d.passes).toBe(true);
    expect(m1.drift).toBeNull();
  });

  it("the mid-span stress is exact when mid-span is not a station (6, 8 and 1000 stations; value at REL, position at 1e-12 · L)", () => {
    for (const stations of [6, 8, 1000]) {
      const m1 = check(simplySupportedBeam(), "m1", { stations });
      const v = memberValues(
        simplySupportedBeam(),
        solved(simplySupportedBeam()),
        "lc1",
        "m1",
        stations,
      );
      expect(Array.from(v?.x ?? []).includes(3), `${stations}: no station at 3`).toBe(false);
      expectRel(m1.stress.tension.value, M_MID / Wy, REL, `tension, ${stations}`);
      expectRel(m1.stress.compression.value, -M_MID / Wy, REL, `compression, ${stations}`);
      expectZero(m1.stress.tension.x - 3, L, `position, ${stations}`);
      expectZero(m1.stress.compression.x - 3, L, `position, ${stations}`);
      expect(m1.stress.tension.z).toBe(-DEPTH_Z / 2);
      expect(m1.stress.compression.z).toBe(DEPTH_Z / 2);
    }
  });

  it("the other bending plane: a load along global -Y bends about local z; tension on the -y side, sigma = M/(Iz/(depthY/2)); the deflection uses Iz (REL)", () => {
    const m1 = check(beam({ uniform: [uniform("u", "m1", "global", "y", -w)] }), "m1");
    const sigma = M_MID / Wz;
    expectRel(sigma, 562500, 1e-15, "the hand value: 45 · 0.075 / 6e-6");
    expectRel(m1.stress.tension.value, sigma, REL, "tension");
    expectRel(m1.stress.compression.value, -sigma, REL, "compression");
    // The beam bows towards -Y, so its -y face is the stretched one.
    expect(m1.stress.tension.y).toBe(-DEPTH_Y / 2);
    expect(m1.stress.compression.y).toBe(DEPTH_Y / 2);
    expect(m1.stress.tension.x).toBe(3);
    expectRel(m1.stress.ratio, sigma / FY, REL, "ratio");
    expect(m1.stress.passes).toBe(false);
    const d = m1.deflection;
    expectRel(d?.value ?? 0, (5 * w * L ** 4) / (384 * E * Iz), REL, "deflection");
    expectRel(d?.localY ?? 0, -(5 * w * L ** 4) / (384 * E * Iz), REL, "localY");
    expect(d?.localZ).toBe(0);
    expect(d?.passes).toBe(false);
  });

  it("a member rolled by 90 degrees under gravity: the weak axis governs, and the corner in tension is below the axis (REL)", () => {
    const model = beam({ uniform: [uniform("u", "m1", "global", "z", -w)] }, 90);
    const m1 = check(model, "m1");
    expectRel(m1.stress.tension.value, M_MID / Wz, REL, "tension");
    expectRel(m1.stress.compression.value, -M_MID / Wz, REL, "compression");
    expect(m1.stress.tension.x).toBe(3);
    const axes = memberLocalAxes({ x: 0, y: 0, z: 0 }, { x: 6, y: 0, z: 0 }, 90);
    if (!axes) {
      throw new Error("test: no axes");
    }
    // The global Z coordinate of a corner (y, z), from the axis.
    const height = (corner: { y: number; z: number }) => corner.y * axes.y.z + corner.z * axes.z.z;
    expectRel(height(m1.stress.tension), -DEPTH_Y / 2, 1e-12, "the tension corner is 75 mm below");
    expectRel(height(m1.stress.compression), DEPTH_Y / 2, 1e-12, "the compression corner above");
    expectRel(m1.stress.ratio, M_MID / Wz / FY, REL, "ratio");
    expectRel(m1.deflection?.value ?? 0, (5 * w * L ** 4) / (384 * E * Iz), REL, "deflection");
  });

  it("whichever way the beam is drawn and whatever its roll, the tension corner is on the side the load pushes towards and the compression corner on the other (gravity and a load along +Y; rolls 0, 30, 90, 180, -115)", () => {
    for (const reversed of [false, true]) {
      for (const roll of [0, 30, 90, 180, -115]) {
        for (const [direction, push] of [
          ["z", { y: 0, z: -1 }],
          ["y", { y: 1, z: 0 }],
        ] as const) {
          const value = direction === "z" ? -w : w;
          const model = frame(
            [
              ["n1", reversed ? 6 : 0, 0, 0],
              ["n2", reversed ? 0 : 6, 0, 0],
            ],
            [["m1", "n1", "n2", roll]],
            [support("n1", PIN), support("n2", ROLLER)],
            { uniform: [uniform("u", "m1", "global", direction, value)] },
          );
          const m1 = check(model, "m1");
          const what = `reversed ${reversed}, roll ${roll}, load along ${direction}`;
          const axes = memberLocalAxes(
            { x: reversed ? 6 : 0, y: 0, z: 0 },
            { x: reversed ? 0 : 6, y: 0, z: 0 },
            roll,
          );
          if (!axes) {
            throw new Error("test: no axes");
          }
          // The corner's offset from the axis in global Y and Z, projected on the load's direction.
          const towards = (corner: { y: number; z: number }) =>
            (corner.y * axes.y.y + corner.z * axes.z.y) * push.y +
            (corner.y * axes.y.z + corner.z * axes.z.z) * push.z;
          expect(towards(m1.stress.tension), what).toBeGreaterThan(0);
          expect(towards(m1.stress.compression), what).toBeLessThan(0);
          expect(m1.stress.tension.value, what).toBeGreaterThan(0);
          expectRel(m1.stress.compression.value, -m1.stress.tension.value, 1e-9, what);
          expectZero(m1.stress.tension.x - 3, L, what, 1e-9);
          // The load's components along local y and z give the two moments at mid-span.
          const py = axes.y.y * push.y + axes.y.z * push.z;
          const pz = axes.z.y * push.y + axes.z.z * push.z;
          const expected = (Math.abs(pz) * M_MID) / Wy + (Math.abs(py) * M_MID) / Wz;
          // 1e-9: the roll's sine and cosine are rounded, and the solve is a 12-row system.
          expectRel(m1.stress.tension.value, expected, 1e-9, what);
        }
      }
    }
  });
});

describe("memberChecks: the largest stress between stations", () => {
  // A beam with a uniform load w down and a uniform load p along +x, pinned at the start. With
  // c = depthZ/2: N = p(L - x), My = w x (L - x)/2, so
  //   bottom: sigma = p(L - x)/A + w x (L - x) c/(2 Iy), largest at x = L/2 - s,
  //   top:    sigma = p(L - x)/A - w x (L - x) c/(2 Iy), smallest at x = L/2 + s,
  // with s = p Iy/(A w c) = 0.5185 m for p = 50 kN/m.
  const p = 50;
  const c = DEPTH_Z / 2;
  const shift = (p * Iy) / (A * w * c);
  const bottom = (x: number) => (p * (L - x)) / A + (w * x * (L - x) * c) / (2 * Iy);
  const top = (x: number) => (p * (L - x)) / A - (w * x * (L - x) * c) / (2 * Iy);
  const model = () =>
    beam({
      uniform: [uniform("w", "m1", "global", "z", -w), uniform("p", "m1", "local", "x", p)],
    });

  it("axial force and bending that both vary: the largest tension and compression are at L/2 -+ p·Iy/(A·w·c), between stations, and exact with 5, 21 and 200 stations (value REL, position 1e-10 · L)", () => {
    expect(shift).toBeGreaterThan(0.5);
    for (const stations of [5, 21, 200]) {
      const m1 = check(model(), "m1", { stations });
      expectRel(m1.stress.tension.value, bottom(L / 2 - shift), REL, `tension, ${stations}`);
      expectZero(m1.stress.tension.x - (L / 2 - shift), L, `tension x, ${stations}`, 1e-10);
      expect(m1.stress.tension.z).toBe(-c);
      expectRel(m1.stress.compression.value, top(L / 2 + shift), REL, `compression, ${stations}`);
      expectZero(m1.stress.compression.x - (L / 2 + shift), L, `compression x, ${stations}`, 1e-10);
      expect(m1.stress.compression.z).toBe(c);
    }
  });

  it("that largest tension is above the value at every station (so the stations alone would miss it)", () => {
    const m1 = check(model(), "m1");
    for (let i = 0; i <= 20; i++) {
      expect(m1.stress.tension.value).toBeGreaterThan(bottom((L * i) / 20));
    }
  });

  it("a point load between stations: the largest stress is under the load, Pab/L / W (REL)", () => {
    const a = 3.7;
    const P = 20;
    const m1 = check(beam({ point: [point("p", "m1", "global", "z", -P, a)] }), "m1");
    expectRel(m1.stress.tension.value, (P * a * (L - a)) / L / Wy, REL, "tension");
    expect(m1.stress.tension.x).toBe(a);
    expect(m1.stress.tension.z).toBe(-c);
    expectRel(m1.stress.compression.value, -(P * a * (L - a)) / L / Wy, REL, "compression");
  });
});

describe("memberChecks: the stress does not depend on the number of stations", () => {
  // A skew member with a roll angle, fixed at both ends, under uniform and point loads in local
  // and global axes: N, My and Mz all vary along it.
  const model = () =>
    frame(
      [
        ["n1", 0, 0, 0],
        ["n2", 2, 3, 6],
      ],
      [["m1", "n1", "n2", 40]],
      [support("n1", ALL), support("n2", ALL)],
      {
        uniform: [
          uniform("g", "m1", "global", "z", -12),
          uniform("y", "m1", "local", "y", 3),
          uniform("x", "m1", "local", "x", -40),
        ],
        point: [
          point("p1", "m1", "global", "x", 25, 2.2),
          point("p2", "m1", "local", "z", -18, 5.1),
          point("p3", "m1", "local", "x", 60, 3.3),
        ],
      },
    );

  it("with 5, 21 and 1001 stations the two extremes are the same numbers (1e-10) at the same positions (1e-8 · L) and corners", () => {
    const fine = check(model(), "m1", { stations: 1001 }).stress;
    for (const stations of [5, 21]) {
      const coarse = check(model(), "m1", { stations }).stress;
      for (const key of ["tension", "compression"] as const) {
        expectRel(coarse[key].value, fine[key].value, 1e-10, `${key}, ${stations}`);
        expectZero(coarse[key].x - fine[key].x, 7, `${key} x, ${stations}`, 1e-8);
        expect([coarse[key].y, coarse[key].z]).toEqual([fine[key].y, fine[key].z]);
      }
    }
  });

  it("they bound the stress computed in the test at 1001 stations and four corners from N, My and Mz, and are within 1e-5 of it", () => {
    const v = memberValues(model(), solved(model()), "lc1", "m1", 1001);
    if (!v) {
      throw new Error("test: no values");
    }
    let largest = Number.NEGATIVE_INFINITY;
    let smallest = Number.POSITIVE_INFINITY;
    for (let i = 0; i < v.count; i++) {
      for (const y of [-DEPTH_Y / 2, DEPTH_Y / 2]) {
        for (const z of [-DEPTH_Z / 2, DEPTH_Z / 2]) {
          const sigma =
            (v.N[i] as number) / A -
            ((v.My[i] as number) * z) / Iy -
            ((v.Mz[i] as number) * y) / Iz;
          largest = Math.max(largest, sigma);
          smallest = Math.min(smallest, sigma);
        }
      }
    }
    const coarse = check(model(), "m1", { stations: 5 }).stress;
    expect(coarse.tension.value).toBeGreaterThanOrEqual(largest);
    expect(coarse.compression.value).toBeLessThanOrEqual(smallest);
    expectRel(coarse.tension.value, largest, 1e-5, "tension");
    expectRel(coarse.compression.value, smallest, 1e-5, "compression");
    expect(largest).toBeGreaterThan(0);
    expect(smallest).toBeLessThan(0);
  });
});

describe("memberChecks: cantilevers (6 m, fixed at the start)", () => {
  const P = 10;

  it("under a uniform load the largest tension is at the top at the fixed end, wL²/2 / W, and the largest compression at the bottom there (REL)", () => {
    const m1 = check(span(ALL, [], { uniform: [uniform("u", "m1", "global", "z", -w)] }), "m1");
    const sigma = (w * L * L) / 2 / Wy;
    expectRel(m1.stress.tension.value, sigma, REL, "tension");
    expect(m1.stress.tension.x).toBe(0);
    expect(m1.stress.tension.z).toBe(DEPTH_Z / 2);
    expectRel(m1.stress.compression.value, -sigma, REL, "compression");
    expect(m1.stress.compression.x).toBe(0);
    expect(m1.stress.compression.z).toBe(-DEPTH_Z / 2);
  });

  // Tip load P: d(x) = P x² (3L - x)/(6EI) and the chord is (x/L) · PL³/(3EI), so the deflection
  // from the chord is r(x) = P (2L²x - 3Lx² + x³)/(6EI): zero at both ends, largest at
  // x = L(1 - 1/√3) = 0.4226 L, where it is PL³/(9√3·EI) = 0.19245 of the tip deflection.
  const r = (x: number) => (P * (2 * L * L * x - 3 * L * x * x + x ** 3)) / (6 * E * Iy);
  const largest = (P * L ** 3) / (9 * Math.sqrt(3) * E * Iy);
  const tipLoad = () => span(ALL, [], { nodal: [nodal("p", "n2", { fz: -P })] });

  it("the deflection from the chord is not the tip deflection: with a tip load it is the largest over the stations of P(2L²x - 3Lx² + x³)/(6EI) (1e-10; the value is the difference of two larger numbers)", () => {
    for (const stations of [5, 21]) {
      const d = check(tipLoad(), "m1", { stations }).deflection;
      if (!d) {
        throw new Error("test: no deflection");
      }
      let expected = 0;
      let at = 0;
      for (let i = 0; i < stations; i++) {
        const x = (L * i) / (stations - 1);
        if (r(x) > expected) {
          expected = r(x);
          at = x;
        }
      }
      expectRel(d.value, expected, 1e-10, `value, ${stations}`);
      expect(d.x).toBe(at);
      // The chord goes down to the tip and the axis stays above it.
      expectRel(d.localZ, expected, 1e-10, `localZ, ${stations}`);
      expect(d.localY).toBe(0);
    }
    expect(check(tipLoad(), "m1").deflection?.x).toBe(2.4);
  });

  it("it is never above the true largest value PL³/(9√3·EI), and below it by at most h²·κ/8 with κ = PL/(EI) (5, 21 and 1001 stations); with 1001 stations it is 0.19245 of the tip deflection (2e-6)", () => {
    const tip = (P * L ** 3) / (3 * E * Iy);
    for (const stations of [5, 21, 1001]) {
      const d = check(tipLoad(), "m1", { stations }).deflection;
      const value = d?.value ?? Number.NaN;
      const h = L / (stations - 1);
      const bound = (h * h * ((P * L) / (E * Iy))) / 8;
      expect(value, `${stations}`).toBeLessThanOrEqual(largest * (1 + 1e-10));
      expect(largest - value, `${stations}`).toBeLessThanOrEqual(bound);
      expect(value).toBeLessThan(0.2 * tip);
    }
    const fine = check(tipLoad(), "m1", { stations: 1001 }).deflection;
    expectRel(fine?.value ?? 0, largest, 2e-6, "1001 stations");
    expectRel((fine?.value ?? 0) / tip, 1 / (3 * Math.sqrt(3)), 2e-6, "share of the tip");
    expectRel(1 / (3 * Math.sqrt(3)), 0.19245, 1e-5, "0.19245");
    expectZero((fine?.x ?? 0) - L * (1 - 1 / Math.sqrt(3)), L, "position", 1e-3);
  });

  it("under a uniform load the deflection from the chord is 0.019686·wL⁴/(EI) at 0.37 L, 0.1575 of the tip deflection wL⁴/(8EI) (1001 stations, 2e-6)", () => {
    const d = check(span(ALL, [], { uniform: [uniform("u", "m1", "global", "z", -w)] }), "m1", {
      stations: 1001,
    }).deflection;
    // r = w (3L³x - 6L²x² + 4Lx³ - x⁴)/(24EI); r' = 0 at t = x/L = 1 - 4^(-1/3).
    const t = 1 - 4 ** (-1 / 3);
    const expected = ((3 * t - 6 * t * t + 4 * t ** 3 - t ** 4) * w * L ** 4) / (24 * E * Iy);
    expectRel(d?.value ?? 0, expected, 2e-6, "value");
    expectRel(expected / ((w * L ** 4) / (E * Iy)), 0.019686, 1e-4, "0.019686");
    expectRel(expected / ((w * L ** 4) / (8 * E * Iy)), 0.1575, 1e-3, "0.1575");
    expectZero((d?.x ?? 0) - t * L, L, "position", 1e-3);
    expectRel(t, 0.37, 1e-3, "0.37");
  });

  it("axial force and bending together: the two extreme stresses differ by 2M/W and their mean is N/A (tip pull 100 kN, tip load 10 kN; REL)", () => {
    const N = 100;
    const m1 = check(span(ALL, [], { nodal: [nodal("p", "n2", { fx: N, fz: -P })] }), "m1");
    const bending = (P * L) / Wy;
    expectRel(m1.stress.tension.value, N / A + bending, REL, "tension");
    expectRel(m1.stress.compression.value, N / A - bending, REL, "compression");
    expectRel(
      m1.stress.tension.value - m1.stress.compression.value,
      2 * bending,
      REL,
      "difference",
    );
    expectRel(
      (m1.stress.tension.value + m1.stress.compression.value) / 2,
      N / A,
      1e-11,
      "mean (1e-11: a small number from two larger ones)",
    );
    expect(m1.stress.tension.x).toBe(0);
    expect(m1.stress.tension.z).toBe(DEPTH_Z / 2);
    expect(m1.stress.compression.x).toBe(0);
    expect(m1.stress.compression.z).toBe(-DEPTH_Z / 2);
    expectRel(m1.stress.largest, N / A + bending, REL, "largest");
  });

  it("a push larger than the bending: no corner is in tension, so the 'tension' value is negative and the ratio uses the compression (REL)", () => {
    const N = 5000;
    const m1 = check(span(ALL, [], { nodal: [nodal("p", "n2", { fx: -N, fz: -P })] }), "m1");
    const bending = (P * L) / Wy;
    // The least compressed corner: where the bending tension is largest, at the fixed end.
    expectRel(m1.stress.tension.value, -N / A + bending, REL, "tension");
    expect(m1.stress.tension.value).toBeLessThan(0);
    expectRel(m1.stress.compression.value, -N / A - bending, REL, "compression");
    expectRel(m1.stress.largest, N / A + bending, REL, "largest");
    expectRel(m1.stress.ratio, (N / A + bending) / FY, REL, "ratio");
  });

  it("a bar in pure tension: the same stress N/A at every corner and position; the first position and the first corner are reported", () => {
    const m1 = check(span(ALL, [], { nodal: [nodal("p", "n2", { fx: 54 })] }), "m1");
    expectRel(m1.stress.tension.value, 54 / A, REL, "tension");
    expectRel(m1.stress.compression.value, 54 / A, REL, "compression");
    for (const extreme of [m1.stress.tension, m1.stress.compression]) {
      expect(extreme.x).toBe(0);
      expect(extreme.y).toBe(-DEPTH_Y / 2);
      expect(extreme.z).toBe(-DEPTH_Z / 2);
    }
    expect(m1.deflection?.value).toBe(0);
    expect(m1.deflection?.ratio).toBe(0);
  });

  it("cantilevers along X, along Y, skew, inclined and vertical, with roll angles, under a tip force in a general direction: at the fixed end, sigma = N/A +- (|Fz|L/Wy + |Fy|L/Wz), with the tension corner on the side away from the force (1e-9)", () => {
    const cases: [end: [number, number, number], roll: number][] = [
      [[6, 0, 0], 0],
      [[-6, 0, 0], 30],
      [[0, 5, 0], 90],
      [[2, 3, 6], 40],
      [[3, 0, 4], -115],
      [[0, 0, 4], 0],
      [[0, 0, -4], 20],
      [[0, 0, 4], 180],
    ];
    const F = { x: 3, y: -7, z: -11 };
    for (const [end, roll] of cases) {
      const model = frame(
        [
          ["n1", 0, 0, 0],
          ["n2", ...end],
        ],
        [["m1", "n1", "n2", roll]],
        [support("n1", ALL)],
        { nodal: [nodal("p", "n2", { fx: F.x, fy: F.y, fz: F.z })] },
      );
      const what = `to (${end.join(", ")}), roll ${roll}`;
      const m1 = check(model, "m1");
      const axes = memberLocalAxes({ x: 0, y: 0, z: 0 }, { x: end[0], y: end[1], z: end[2] }, roll);
      if (!axes) {
        throw new Error("test: no axes");
      }
      const length = Math.hypot(...end);
      const along = (axis: { x: number; y: number; z: number }) =>
        axis.x * F.x + axis.y * F.y + axis.z * F.z;
      const [Fx, Fy, Fz] = [along(axes.x), along(axes.y), along(axes.z)];
      const bending = (Math.abs(Fz) * length) / Wy + (Math.abs(Fy) * length) / Wz;
      expectRel(m1.stress.tension.value, Fx / A + bending, 1e-9, `tension, ${what}`);
      expectRel(m1.stress.compression.value, Fx / A - bending, 1e-9, `compression, ${what}`);
      expect(m1.stress.tension.x, what).toBe(0);
      expect(m1.stress.compression.x, what).toBe(0);
      // The corner's offset from the axis, projected on the force: local y·Fy + z·Fz.
      const towards = (corner: { y: number; z: number }) => corner.y * Fy + corner.z * Fz;
      expect(towards(m1.stress.tension), what).toBeLessThan(0);
      expect(towards(m1.stress.compression), what).toBeGreaterThan(0);
      expect(Math.abs(m1.stress.tension.y)).toBe(DEPTH_Y / 2);
      expect(Math.abs(m1.stress.tension.z)).toBe(DEPTH_Z / 2);
      expect(m1.vertical, what).toBe(end[0] === 0 && end[1] === 0);
    }
  });
});

describe("memberChecks: biaxial bending", () => {
  it("gravity 10 kN/m and 4 kN/m along +Y on the simply supported beam: the governing corner is bottom and +y, sigma = My/Wy + Mz/Wz; the opposite corner has the compression (REL)", () => {
    const m1 = check(
      beam({
        uniform: [uniform("g", "m1", "global", "z", -w), uniform("h", "m1", "global", "y", 4)],
      }),
      "m1",
    );
    const sigma = M_MID / Wy + (4 * L * L) / 8 / Wz;
    // 80 357.14 + 225 000 kN/m².
    expectRel(sigma, 305357.14285714284, 1e-15, "the hand value");
    expectRel(m1.stress.tension.value, sigma, REL, "tension");
    expect(m1.stress.tension).toMatchObject({ x: 3, y: DEPTH_Y / 2, z: -DEPTH_Z / 2 });
    expectRel(m1.stress.compression.value, -sigma, REL, "compression");
    expect(m1.stress.compression).toMatchObject({ x: 3, y: -DEPTH_Y / 2, z: DEPTH_Z / 2 });
    const dz = (5 * w * L ** 4) / (384 * E * Iy);
    const dy = (5 * 4 * L ** 4) / (384 * E * Iz);
    expectRel(m1.deflection?.value ?? 0, Math.hypot(dy, dz), REL, "deflection");
    expectRel(m1.deflection?.localY ?? 0, dy, REL, "localY");
    expectRel(m1.deflection?.localZ ?? 0, -dz, REL, "localZ");
  });
});

describe("memberChecks: the portal frame fixture (6 m by 4 m, 20 kN along +X on n2)", () => {
  function loaded(): Model {
    const model = portalFrame();
    model.memberUniformLoads.push(uniform("u", "b1", "global", "z", -w));
    return model;
  }

  it("the drift of each column is the solver's displacement of its top node (the bases are fixed), against 4 m / 300", () => {
    const model = loaded();
    const result = solved(model);
    const found = memberChecks(model, result, "lc1") as MemberChecks;
    const displacements = loadCase(result).displacements;
    for (const [memberId, top] of [
      ["c1", "n2"],
      ["c2", "n3"],
    ] as const) {
      const drift = found.members.find((member) => member.memberId === memberId)?.drift;
      const node = displacements[top];
      if (!drift || !node) {
        throw new Error("test: no drift");
      }
      expect(drift.dX).toBe(node.ux);
      expect(drift.dY).toBe(0);
      expect(drift.value).toBe(Math.abs(node.ux));
      expect(drift.value).toBeGreaterThan(0);
      expect(drift.height).toBe(4);
      expect(drift.divisor).toBe(300);
      expect(drift.limit).toBe(4 / 300);
      expect(drift.ratio).toBe(Math.abs(node.ux) / (4 / 300));
      expect(drift.passes).toBe(drift.ratio <= 1);
    }
  });

  it("the beam's deflection from the chord excludes the sway and the movement of its nodes: at every station it is the deflection of a simply supported beam under the load and the two end moments of the solver (1e-9)", () => {
    const model = loaded();
    const result = solved(model);
    const b1 = (memberChecks(model, result, "lc1") as MemberChecks).members[1] as MemberCheck;
    const ends = loadCase(result).memberEndForces.b1;
    if (!ends || !b1.deflection) {
      throw new Error("test: no end forces");
    }
    // My at the start is +my1 and at the end -my2 (README, "The relation to the member end forces").
    const M1 = ends.start.my;
    const M2 = -ends.end.my;
    const EI = E * Iy;
    const r = (x: number) =>
      (M1 * ((x * x) / 2 - x ** 3 / (6 * L) - (L * x) / 3)) / EI +
      (M2 * (x ** 3 / (6 * L) - (L * x) / 6)) / EI +
      (-w * x * (L ** 3 - 2 * L * x * x + x ** 3)) / (24 * EI);
    let expected = 0;
    let at = 0;
    for (let i = 1; i < 20; i++) {
      const x = (L * i) / 20;
      if (Math.abs(r(x)) > Math.abs(expected)) {
        expected = r(x);
        at = x;
      }
    }
    expectRel(b1.deflection.localZ, expected, 1e-9, "localZ");
    expectRel(b1.deflection.value, Math.abs(expected), 1e-9, "value");
    expect(b1.deflection.x).toBe(at);
    expect(b1.deflection.localY).toBe(0);
    // The sway of the frame is larger than the beam's own bending deflection, and is not in it.
    const sway = Math.abs(loadCase(result).displacements.n2?.ux ?? 0);
    expect(sway).toBeGreaterThan(b1.deflection.value);
  });

  it("structureChecks names the governing member and value of each ratio and whether it is at most 1, and equals governingChecks of memberChecks", () => {
    const model = loaded();
    const result = solved(model);
    const all = memberChecks(model, result, "lc1") as MemberChecks;
    const governing = structureChecks(model, result, "lc1");
    if (!governing) {
      throw new Error("test: no structure checks");
    }
    expect(governing).toEqual(governingChecks(all));
    expect(governing.kind).toBe("illustrative");
    expect(governing.loadCaseId).toBe("lc1");
    expect(governing.notChecked).toEqual([...NOT_CHECKED]);
    const ratios = (pick: (member: MemberCheck) => number | undefined) =>
      all.members.map((member) => pick(member) ?? Number.NEGATIVE_INFINITY);
    const stress = ratios((member) => member.stress.ratio);
    const drift = ratios((member) => member.drift?.ratio);
    expect(governing.stress?.ratio).toBe(Math.max(...stress));
    expect(governing.stress?.memberId).toBe(
      all.members[stress.indexOf(Math.max(...stress))]?.memberId,
    );
    expect(governing.stress?.passes).toBe(Math.max(...stress) <= 1);
    expect(governing.deflection).toEqual({
      memberId: "b1",
      ratio: all.members[1]?.deflection?.ratio,
      passes: true,
    });
    expect(governing.drift?.ratio).toBe(Math.max(...drift));
    expect(governing.drift?.memberId).toBe(
      all.members[drift.indexOf(Math.max(...drift))]?.memberId,
    );
    expect(["c1", "c2"]).toContain(governing.drift?.memberId);
    expect(governing.drift?.passes).toBe(Math.max(...drift) <= 1);
  });

  it("structureChecks: a ratio above 1 does not pass; the options reach it; no vertical member gives drift null; of equal ratios the first member governs", () => {
    const model = loaded();
    const result = solved(model);
    const loose = structureChecks(model, result, "lc1");
    const tight = structureChecks(model, result, "lc1", {
      allowableFactor: 0.01,
      deflectionDivisor: 1e6,
      driftDivisor: 1e6,
    });
    expect(tight?.stress?.passes).toBe(false);
    expect(tight?.deflection?.passes).toBe(false);
    expect(tight?.drift?.passes).toBe(false);
    expectRel(tight?.stress?.ratio ?? 0, (loose?.stress?.ratio ?? 0) * 100, 1e-12, "factor 0.01");
    expectRel(tight?.drift?.ratio ?? 0, ((loose?.drift?.ratio ?? 0) * 1e6) / 300, 1e-12, "n");
    const beamOnly = structureChecks(simplySupportedBeam(), solved(simplySupportedBeam()), "lc1");
    expect(beamOnly?.drift).toBeNull();
    expect(beamOnly?.stress?.memberId).toBe("m1");
    expect(beamOnly?.deflection?.memberId).toBe("m1");
    // Two equal bays side by side: the two beams have the same ratios, and the first governs.
    const twin = frame(
      [
        ["a1", 0, 0, 0],
        ["a2", 6, 0, 0],
        ["b1", 0, 10, 0],
        ["b2", 6, 10, 0],
      ],
      [
        ["second", "b1", "b2"],
        ["first", "a1", "a2"],
      ],
      [support("a1", PIN), support("a2", ROLLER), support("b1", PIN), support("b2", ROLLER)],
      {
        uniform: [
          uniform("u1", "first", "global", "z", -w),
          uniform("u2", "second", "global", "z", -w),
        ],
      },
    );
    const twins = checks(twin);
    expect(twins.members[0]?.stress.ratio).toBe(twins.members[1]?.stress.ratio);
    expect(governingChecks(twins).stress?.memberId).toBe("second");
    expect(governingChecks(twins).deflection?.memberId).toBe("second");
  });
});

describe("memberChecks: vertical members", () => {
  it("a cantilever column of 4 m with tip forces along X and Y: the drift is the hypotenuse of PxH³/(3EIy) and PyH³/(3EIz), running upward or downward (REL)", () => {
    const H = 4;
    for (const upward of [true, false]) {
      // Upward: fixed at the bottom node. Downward: the member starts at the free top node.
      const model = frame(
        [
          ["bottom", 0, 0, 0],
          ["top", 0, 0, H],
        ],
        [upward ? ["m1", "bottom", "top"] : ["m1", "top", "bottom"]],
        [support("bottom", ALL)],
        { nodal: [nodal("p", "top", { fx: 3, fy: -1 })] },
      );
      const m1 = check(model, "m1");
      const dx = (3 * H ** 3) / (3 * E * Iy);
      const dy = (1 * H ** 3) / (3 * E * Iz);
      expect(m1.vertical).toBe(true);
      expect(m1.deflection).toBeNull();
      expectRel(m1.drift?.value ?? 0, Math.hypot(dx, dy), REL, "value");
      // End minus start: the sign turns with the member's direction.
      expectRel(m1.drift?.dX ?? 0, upward ? dx : -dx, REL, "dX");
      expectRel(m1.drift?.dY ?? 0, upward ? -dy : dy, REL, "dY");
      expect(m1.drift?.height).toBe(H);
      expectRel(m1.drift?.ratio ?? 0, Math.hypot(dx, dy) / (H / 300), REL, "ratio");
      expect(m1.drift?.passes).toBe(false);
      expectRel(check(model, "m1", { driftDivisor: 100 }).drift?.limit ?? 0, H / 100, REL, "n");
    }
  });

  it("vertical by the rule of memberLocalAxes: a member that leans by 1e-9 of its length or less has a drift, one that leans by 2e-9 a deflection", () => {
    expect(VERTICAL_TOLERANCE).toBe(1e-9);
    const leaning = (lean: number): MemberCheck =>
      check(
        frame(
          [
            ["n1", 0, 0, 0],
            ["n2", lean, 0, 4],
          ],
          [["m1", "n1", "n2"]],
          [support("n1", ALL)],
          { nodal: [nodal("p", "n2", { fx: 3 })] },
        ),
        "m1",
      );
    expect(leaning(0).vertical).toBe(true);
    expect(leaning(2e-9).vertical).toBe(true); // 2e-9 m in 4 m is 5e-10 of the length
    expect(leaning(2e-9).drift).not.toBeNull();
    expect(leaning(8e-9).vertical).toBe(false); // 2e-9 of the length
    expect(leaning(8e-9).drift).toBeNull();
    expect(leaning(8e-9).deflection).not.toBeNull();
  });

  it("the stress of a column: a compression of 540 kN and a tip force of 3 kN along X on 4 m: -N/A -+ M/Wy at the base (REL)", () => {
    const m1 = check(
      frame(
        [
          ["n1", 0, 0, 0],
          ["n2", 0, 0, 4],
        ],
        [["m1", "n1", "n2"]],
        [support("n1", ALL)],
        { nodal: [nodal("p", "n2", { fx: 3, fz: -540 })] },
      ),
      "m1",
    );
    expectRel(m1.stress.compression.value, -540 / A - 12 / Wy, REL, "compression");
    expectRel(m1.stress.tension.value, -540 / A + 12 / Wy, REL, "tension");
    expect(m1.stress.compression.x).toBe(0);
    // Upward column, roll 0: local z is global -X. The force pushes towards +X, so the side in
    // compression at the base is the +X side: z = -depthZ/2.
    expect(m1.stress.compression.z).toBe(-DEPTH_Z / 2);
    expect(m1.stress.tension.z).toBe(DEPTH_Z / 2);
  });
});

describe("the ratio at exactly 1", () => {
  it("a yield strength chosen by hand so that M/W = fy: the ratio is 1 within 1e-12; with fy set to the reported stress it is exactly 1 and passes; one bit less of fy does not pass", () => {
    const byHand = simplySupportedBeam();
    (byHand.materials[0] as Model["materials"][number]).fy = (w * L * L * (DEPTH_Z / 2)) / (8 * Iy);
    expectRel(check(byHand, "m1").stress.ratio, 1, 1e-12, "by hand");

    const reported = check(simplySupportedBeam(), "m1").stress.largest;
    const exact = simplySupportedBeam();
    (exact.materials[0] as Model["materials"][number]).fy = reported;
    expect(check(exact, "m1").stress.ratio).toBe(1);
    expect(check(exact, "m1").stress.passes).toBe(true);

    const below = simplySupportedBeam();
    (below.materials[0] as Model["materials"][number]).fy = reported * (1 - 2 ** -52);
    expect(check(below, "m1").stress.ratio).toBeGreaterThan(1);
    expect(check(below, "m1").stress.passes).toBe(false);
  });

  it("a depth chosen so that the ratio is 1 under 10 kN/m: depthZ = 2·fy·Iy·8/(wL²) (1e-12), and an allowable factor of 0.6 divides the allowable stress", () => {
    const model = simplySupportedBeam();
    const depth = (2 * FY * Iy * 8) / (w * L * L);
    (model.sections[0] as Section).depthZ = depth;
    expectRel(check(model, "m1").stress.ratio, 1, 1e-12, "ratio");
    expect(check(model, "m1").stress.tension.z).toBe(-depth / 2);
    const factored = check(model, "m1", { allowableFactor: 0.6 }).stress;
    expectRel(factored.allowable, 0.6 * FY, REL, "allowable");
    expectRel(factored.ratio, 1 / 0.6, 1e-12, "ratio with the factor");
    expect(factored.passes).toBe(false);
  });

  it("the deflection and the drift at exactly 1: a divisor chosen as span / (the reported value) gives a ratio within 1e-15 of 1; the limit equal to the value passes", () => {
    const d = check(simplySupportedBeam(), "m1").deflection;
    const tuned = check(simplySupportedBeam(), "m1", { deflectionDivisor: 6 / (d?.value ?? 1) });
    expectRel(tuned.deflection?.ratio ?? 0, 1, 1e-15, "deflection ratio");
    expect(tuned.deflection?.passes).toBe((tuned.deflection?.ratio ?? 2) <= 1);
    expect(check(simplySupportedBeam(), "m1", { deflectionDivisor: 600 }).deflection?.passes).toBe(
      true,
    );
    expect(check(simplySupportedBeam(), "m1", { deflectionDivisor: 650 }).deflection?.passes).toBe(
      false,
    );
  });
});

describe("spanDeflection: a beam of several members in a line", () => {
  /** The simply supported beam of 6 m cut at `at`, each piece drawn forward or backward. */
  function twoPieces(at: number, firstForward = true, secondForward = true): Model {
    return frame(
      [
        ["a", 0, 0, 0],
        ["c", at, 0, 0],
        ["b", 6, 0, 0],
      ],
      [
        firstForward ? ["ac", "a", "c"] : ["ac", "c", "a"],
        secondForward ? ["cb", "c", "b"] : ["cb", "b", "c"],
      ],
      [support("a", PIN), support("b", ROLLER)],
      {
        uniform: [uniform("u1", "ac", "global", "z", -w), uniform("u2", "cb", "global", "z", -w)],
      },
    );
  }

  it("two collinear members with the load across both: the span deflection is the single member's 5wL⁴/(384EI), whichever way each member is drawn and whichever end the list starts at (1e-11: two more unknowns in the solve)", () => {
    const single = check(simplySupportedBeam(), "m1").deflection;
    for (const firstForward of [true, false]) {
      for (const secondForward of [true, false]) {
        for (const order of [
          ["ac", "cb"],
          ["cb", "ac"],
        ]) {
          const what = `${firstForward}, ${secondForward}, ${order.join("+")}`;
          const found = spanOf(twoPieces(3, firstForward, secondForward), order);
          expect(found.kind).toBe("illustrative");
          expectRel(found.value, D_MID, 1e-11, what);
          expectRel(found.value, single?.value ?? 0, 1e-11, what);
          expect(found.span).toBe(6);
          expect(found.distance).toBe(3);
          expect(found.memberIds).toEqual(order);
          expect(found.startNodeId).toBe(order[0] === "ac" ? "a" : "b");
          expect(found.endNodeId).toBe(order[0] === "ac" ? "b" : "a");
          // The first station along the span that has the value: the far end of the first member.
          expect(found.memberId).toBe(order[0]);
          // Node c is at x = 3 of a member drawn a to c or b to c, and at x = 0 of one drawn from c.
          const startsAtC = order[0] === "ac" ? !firstForward : secondForward;
          expect(found.x).toBe(startsAtC ? 0 : 3);
          expect(found.divisor).toBe(360);
          expect(found.limit).toBe(6 / 360);
          expectRel(found.ratio, D_MID / (6 / 360), 1e-11, what);
          expect(found.passes).toBe(true);
        }
      }
    }
  });

  it("a node at 2 m of 6: mid-span is a station of the longer member, and the value is again 5wL⁴/(384EI) (1e-11); the divisor is a parameter", () => {
    const found = spanOf(twoPieces(2), ["ac", "cb"], 250);
    expectRel(found.value, D_MID, 1e-11, "value");
    expect(found.memberId).toBe("cb");
    expect(found.x).toBe(1);
    expect(found.distance).toBe(3);
    expect(found.divisor).toBe(250);
    expect(found.limit).toBe(6 / 250);
    const back = spanOf(twoPieces(2, false, false), ["cb", "ac"]);
    expectRel(back.value, D_MID, 1e-11, "value, from the other end");
    expect(back.memberId).toBe("cb");
    expect(back.x).toBe(3);
    expect(back.distance).toBe(3);
    expect(spanOf(twoPieces(2), ["ac", "cb"], 0).divisor).toBe(360);
    expect(spanOf(twoPieces(2), ["ac", "cb"], Number.NaN).divisor).toBe(360);
  });

  it("each piece's own check measures from its own chord and is smaller: for the half A-C it is the largest over its stations of d(x) - (x/3)·d(3) (1e-10), about a quarter of the span's value", () => {
    const half = check(twoPieces(3), "ac").deflection;
    const d = (x: number) => (w * x * (L ** 3 - 2 * L * x * x + x ** 3)) / (24 * E * Iy);
    let expected = 0;
    for (let i = 0; i <= 20; i++) {
      const x = (3 * i) / 20;
      expected = Math.max(expected, d(x) - (x / 3) * d(3));
    }
    expectRel(half?.value ?? 0, expected, 1e-10, "the half's own value");
    expect(half?.span).toBe(3);
    expect((half?.value ?? 1) / D_MID).toBeLessThan(0.3);
    expect((half?.value ?? 0) / D_MID).toBeGreaterThan(0.2);
  });

  it("one member: the span deflection is the member's own check (the same numbers)", () => {
    const model = portalFrame();
    model.memberUniformLoads.push(uniform("u", "b1", "global", "z", -w));
    const own = check(model, "b1").deflection;
    const found = spanOf(model, ["b1"]);
    expectRel(found.value, own?.value ?? 0, 1e-12, "value");
    expect(found.x).toBe(own?.x);
    expect(found.span).toBe(6);
    expect([found.startNodeId, found.endNodeId]).toEqual(["n2", "n3"]);
  });

  it("a span whose ends move: the portal's beam cut in three unequal pieces has, at the same stations, the span deflection of the uncut beam (1e-9)", () => {
    const whole = portalFrame();
    whole.memberUniformLoads.push(uniform("u", "b1", "global", "z", -w));
    const own = check(whole, "b1").deflection;
    if (!own) {
      throw new Error("test: no deflection");
    }
    // The uncut beam's largest station is at own.x; the cuts are at 1.5 m and at that station.
    expect(own.x).toBeGreaterThan(1.5);
    const cut = frame(
      [
        ["n1", 0, 0, 0],
        ["n2", 0, 0, 4],
        ["p", 1.5, 0, 4],
        ["q", own.x, 0, 4],
        ["n3", 6, 0, 4],
        ["n4", 6, 0, 0],
      ],
      [
        ["c1", "n1", "n2"],
        ["b1a", "n2", "p"],
        ["b1b", "q", "p"],
        ["b1c", "q", "n3"],
        ["c2", "n4", "n3"],
      ],
      [support("n1", ALL), support("n4", ALL)],
      {
        nodal: [nodal("nl1", "n2", { fx: 20 })],
        uniform: ["b1a", "b1b", "b1c"].map((id) => uniform(`u-${id}`, id, "global", "z", -w)),
      },
    );
    // The reference: the uncut beam's deflection at the positions of the pieces' stations (21 per
    // piece), from its own chord.
    const positions: number[] = [];
    for (const [from, to] of [
      [0, 1.5],
      [1.5, own.x],
      [own.x, 6],
    ] as const) {
      for (let i = 0; i <= 20; i++) {
        positions.push(from + ((to - from) * i) / 20);
      }
    }
    const v = memberValues(whole, solved(whole), "lc1", "b1", 2, positions);
    if (!v) {
      throw new Error("test: no values");
    }
    const z = (i: number) => v.deflectionLocal[3 * i + 2] as number;
    let expected = 0;
    let at = 0;
    for (let i = 0; i < v.count; i++) {
      const x = v.x[i] as number;
      const r = Math.abs(z(i) - (z(0) + (x / 6) * (z(v.count - 1) - z(0))));
      if (r > expected) {
        expected = r;
        at = x;
      }
    }
    const found = spanOf(cut, ["b1a", "b1b", "b1c"]);
    expectRel(found.value, expected, 1e-9, "against the uncut beam");
    expectZero(found.distance - at, L, "position", 1e-12);
    expect(found.value).toBeGreaterThanOrEqual(own.value * (1 - 1e-9));
    expect(found.span).toBe(6);
    expect([found.startNodeId, found.endNodeId]).toEqual(["n2", "n3"]);
    const reversed = spanOf(cut, ["b1c", "b1b", "b1a"]);
    expectRel(reversed.value, expected, 1e-9, "from the other end");
    expectZero(reversed.distance - (6 - at), L, "position from the other end", 1e-12);
    expect([reversed.startNodeId, reversed.endNodeId]).toEqual(["n3", "n2"]);
  });

  it("a vertical span: a cantilever column of two members under a tip force has the deflection from the chord of the one-member column, PH³/(9√3·EI) (1001 stations, 2e-6)", () => {
    const H = 4;
    const model = frame(
      [
        ["n1", 0, 0, 0],
        ["n2", 0, 0, 1.5],
        ["n3", 0, 0, H],
      ],
      [
        ["lower", "n1", "n2"],
        ["upper", "n3", "n2"],
      ],
      [support("n1", ALL)],
      { nodal: [nodal("p", "n3", { fx: 3 })] },
    );
    const found = spanOf(model, ["lower", "upper"], 360, 1001);
    expectRel(found.value, (3 * H ** 3) / (9 * Math.sqrt(3) * E * Iy), 2e-6, "value");
    expect(found.span).toBe(H);
  });

  it("refuses with a typed reason: no result, no members, a repeated member, an unknown member, a member without values", () => {
    const model = twoPieces(3);
    const result = solved(model);
    expect(spanDeflection(model, result, "nope", ["ac", "cb"])).toEqual({
      ok: false,
      reason: "no-result",
    });
    const unsupported = twoPieces(3);
    unsupported.supports = [];
    expect(spanDeflection(unsupported, solve(unsupported), "lc1", ["ac", "cb"])).toEqual({
      ok: false,
      reason: "no-result",
    });
    expect(spanDeflection(model, result, "lc1", [])).toEqual({ ok: false, reason: "no-members" });
    expect(spanDeflection(model, result, "lc1", ["ac", "cb", "ac"])).toEqual({
      ok: false,
      reason: "repeated-member",
      memberId: "ac",
    });
    expect(spanDeflection(model, result, "lc1", ["ac", "zz"])).toEqual({
      ok: false,
      reason: "unknown-member",
      memberId: "zz",
    });
    const changed = structuredClone(model);
    (changed.members[1] as Model["members"][number]).kind = "truss";
    expect(spanDeflection(changed, result, "lc1", ["ac", "cb"])).toEqual({
      ok: false,
      reason: "no-values",
      memberId: "cb",
    });
  });

  it("refuses members that are not connected in the order given, and members that are connected but not in one line (a corner, a line that runs back, a closed triangle, a node 1e-8 of the span off the line)", () => {
    const portal = portalFrame();
    const result = solved(portal);
    expect(spanDeflection(portal, result, "lc1", ["c1", "c2"])).toEqual({
      ok: false,
      reason: "not-connected",
      memberId: "c2",
    });
    expect(spanDeflection(portal, result, "lc1", ["c1", "b1"])).toEqual({
      ok: false,
      reason: "not-collinear",
      memberId: "c1",
    });
    expect(spanDeflection(portal, result, "lc1", ["c1", "b1", "c2"])).toEqual({
      ok: false,
      reason: "not-collinear",
      memberId: "c1",
    });

    // Four collinear members a-b-c-d-e; the list skips one, or is out of order.
    const line = frame(
      [
        ["a", 0, 0, 0],
        ["b", 1, 0, 0],
        ["c", 2, 0, 0],
        ["d", 3, 0, 0],
        ["e", 4, 0, 0],
      ],
      [
        ["ab", "a", "b"],
        ["bc", "c", "b"],
        ["cd", "c", "d"],
        ["de", "e", "d"],
      ],
      [support("a", PIN), support("e", ROLLER)],
      { uniform: [uniform("u", "bc", "global", "z", -w)] },
    );
    const lineResult = solved(line);
    expect(spanDeflection(line, lineResult, "lc1", ["ab", "bc", "cd", "de"]).ok).toBe(true);
    expect(spanDeflection(line, lineResult, "lc1", ["de", "cd", "bc", "ab"]).ok).toBe(true);
    expect(spanDeflection(line, lineResult, "lc1", ["bc", "cd"]).ok).toBe(true);
    expect(spanDeflection(line, lineResult, "lc1", ["ab", "cd", "de"])).toEqual({
      ok: false,
      reason: "not-connected",
      memberId: "cd",
    });
    expect(spanDeflection(line, lineResult, "lc1", ["ab", "bc", "de"])).toEqual({
      ok: false,
      reason: "not-connected",
      memberId: "de",
    });
    expect(spanDeflection(line, lineResult, "lc1", ["ab", "cd", "bc"])).toEqual({
      ok: false,
      reason: "not-connected",
      memberId: "cd",
    });

    // a (0) to b (4), then back to c (2): connected, on one line, but running back.
    const back = frame(
      [
        ["a", 0, 0, 0],
        ["b", 4, 0, 0],
        ["c", 2, 0, 0],
      ],
      [
        ["ab", "a", "b"],
        ["bc", "b", "c"],
      ],
      [support("a", ALL)],
      { nodal: [nodal("p", "c", { fz: -1 })] },
    );
    expect(spanDeflection(back, solved(back), "lc1", ["ab", "bc"])).toEqual({
      ok: false,
      reason: "not-collinear",
      memberId: "bc",
    });

    const triangle = frame(
      [
        ["a", 0, 0, 0],
        ["b", 4, 0, 0],
        ["c", 2, 0, 3],
      ],
      [
        ["ab", "a", "b"],
        ["bc", "b", "c"],
        ["ca", "c", "a"],
      ],
      [support("a", ALL)],
      { nodal: [nodal("p", "c", { fz: -1 })] },
    );
    expect(spanDeflection(triangle, solved(triangle), "lc1", ["ab", "bc", "ca"])).toEqual({
      ok: false,
      reason: "not-collinear",
      memberId: "bc",
    });

    expect(COLLINEAR_TOLERANCE).toBe(1e-9);
    const kinked = (offset: number) => {
      const model = twoPieces(3);
      (model.nodes[1] as Model["nodes"][number]).z = offset;
      return spanDeflection(model, solved(model), "lc1", ["ac", "cb"]);
    };
    expect(kinked(3e-9).ok).toBe(true); // 5e-10 of the span of 6 m
    expect(kinked(6e-8)).toEqual({ ok: false, reason: "not-collinear", memberId: "ac" });
  });
});

describe("the reference models of the three seeded tasks, rebuilt here", () => {
  // The generic I-sections of packages/tasks/src/sections.ts (card T2), typed here from that
  // file: three rectangles, no root fillets; dimensions in mm h, b, tw, tf:
  //   "I 300x150": 300, 150, 7, 11        "I 400x180": 400, 180, 9, 14
  //   A  = 2·b·tf + (h - 2·tf)·tw
  //   Iy = [b·h³ - (b - tw)·(h - 2·tf)³]/12
  //   Iz = [2·tf·b³ + (h - 2·tf)·tw³]/12
  //   J  = [2·b·tf³ + (h - tf)·tw³]/3
  //   depthY = b, depthZ = h
  function iSection(name: string, hMm: number, bMm: number, twMm: number, tfMm: number): Section {
    const [h, b, tw, tf] = [hMm / 1000, bMm / 1000, twMm / 1000, tfMm / 1000];
    const web = h - 2 * tf;
    return {
      id: name,
      name,
      A: 2 * b * tf + web * tw,
      Iy: (b * h ** 3 - (b - tw) * web ** 3) / 12,
      Iz: (2 * tf * b ** 3 + web * tw ** 3) / 12,
      J: (2 * b * tf ** 3 + (h - tf) * tw ** 3) / 3,
      depthY: b,
      depthZ: h,
    };
  }
  const I300 = iSection("I 300x150", 300, 150, 7, 11);
  const I400 = iSection("I 400x180", 400, 180, 9, 14);
  // The tasks' steel (packages/tasks/src/parts.ts): E = 210 000 MPa, fy = 355 MPa.
  const STEEL = { id: "steel", name: "S355", E: 2.1e8, G: 8.1e7, fy: 3.55e5, density: 7850 };

  function taskModel(
    sections: Section[],
    nodes: [string, number, number, number][],
    members: [id: string, start: string, end: string, sectionId: string][],
    supports: Support[],
    loads: Loads,
  ): Model {
    const model = frame(
      nodes,
      members.map(([id, start, end]) => [id, start, end]),
      supports,
      loads,
    );
    model.sections = sections;
    model.materials = [STEEL];
    model.members.forEach((member, i) => {
      member.sectionId = (members[i] as [string, string, string, string])[3];
      member.materialId = "steel";
    });
    return model;
  }

  /** Tasks (a) and (c): nodes A, C (mid-span), B; members A-C and C-B; pin at A, roller at B. */
  function taskBeam(section: Section, spanLength: number, load: number): Model {
    return taskModel(
      [section],
      [
        ["A", 0, 0, 0],
        ["C", spanLength / 2, 0, 0],
        ["B", spanLength, 0, 0],
      ],
      [
        ["AC", "A", "C", section.id],
        ["CB", "C", "B", section.id],
      ],
      [support("A", PIN), support("B", ROLLER)],
      {
        uniform: [
          uniform("w-AC", "AC", "global", "z", -load),
          uniform("w-CB", "CB", "global", "z", -load),
        ],
      },
    );
  }

  it("the properties of I 400x180 by those formulas: A = 8.388e-3 m², Iy = 2.26426416e-4 m⁴, Iz = 1.3630599e-5 m⁴, depth 0.4 m (1e-12)", () => {
    expectRel(I400.A, 8.388e-3, 1e-12, "A");
    expectRel(I400.Iy, 2.26426416e-4, 1e-12, "Iy");
    expectRel(I400.Iz, 1.3630599e-5, 1e-12, "Iz");
    expect(I400.depthZ).toBe(0.4);
    expect(I400.depthY).toBe(0.18);
    expectRel(I300.Iy, 8.14709886666667e-5, 1e-12, "Iy of I 300x150");
  });

  it("task (c), the 7 m beam with I 400x180 under 25 kN/m: the bending stress is M/W = 153.125 kN·m / (Iy/0.2 m) = 135 253.65 kN/m² (135.25 MPa), in both members at node C; ratio 0.381 of fy (1e-11)", () => {
    const model = taskBeam(I400, 7, 25);
    const found = checks(model);
    const M = (25 * 7 * 7) / 8;
    expect(M).toBe(153.125);
    const sigma = M / (I400.Iy / 0.2);
    // The value recorded in the card for card T6.
    expectRel(sigma, 135253.65344298, 1e-13, "the recorded value, kN/m²");
    expectRel(sigma / 1000, 135.25, 1e-4, "MPa, to two decimals");
    const [AC, CB] = found.members as [MemberCheck, MemberCheck];
    expectRel(AC.stress.tension.value, sigma, 1e-11, "AC tension");
    expect(AC.stress.tension.x).toBe(3.5);
    expect(AC.stress.tension.z).toBe(-0.2);
    expectRel(AC.stress.compression.value, -sigma, 1e-11, "AC compression");
    expect(AC.stress.compression.z).toBe(0.2);
    expectRel(CB.stress.tension.value, sigma, 1e-11, "CB tension");
    expect(CB.stress.tension.x).toBe(0);
    expectRel(AC.stress.ratio, sigma / 3.55e5, 1e-11, "ratio");
    expectRel(sigma / 3.55e5, 0.381, 1e-3, "0.381");
    const governing = governingChecks(found);
    expect(governing.stress?.passes).toBe(true);
    expect(governing.drift).toBeNull();
  });

  it("task (c): the span deflection of A-C-B is 5wL⁴/(384·E·Iy) = 16.44 mm, 0.845 of span/360 (1e-11); the starting section I 300x150 does not meet the limit (ratio 2.35)", () => {
    const found = spanOf(taskBeam(I400, 7, 25), ["AC", "CB"]);
    const d = (5 * 25 * 7 ** 4) / (384 * 2.1e8 * I400.Iy);
    expectRel(found.value, d, 1e-11, "value");
    expectRel(d * 1000, 16.44, 1e-3, "16.44 mm");
    expect(found.span).toBe(7);
    expect(found.distance).toBe(3.5);
    expectRel(found.ratio, d / (7 / 360), 1e-11, "ratio");
    expectRel(found.ratio, 0.845, 1e-3, "0.845");
    expect(found.passes).toBe(true);
    const starting = spanOf(taskBeam(I300, 7, 25), ["AC", "CB"]);
    expectRel(
      starting.ratio,
      (5 * 25 * 7 ** 4) / (384 * 2.1e8 * I300.Iy) / (7 / 360),
      1e-11,
      "I 300x150",
    );
    expectRel(starting.ratio, 2.35, 2e-3, "2.35");
    expect(starting.passes).toBe(false);
  });

  it("task (a), the 6 m beam with I 300x150 under 15 kN/m: stress 67.5 kN·m / (Iy/0.15 m) = 124.3 MPa, span deflection 5wL⁴/(384·E·Iy) = 14.8 mm (1e-11)", () => {
    const model = taskBeam(I300, 6, 15);
    const sigma = 67.5 / (I300.Iy / 0.15);
    expectRel(sigma / 1000, 124.3, 1e-3, "124.3 MPa");
    const AC = check(model, "AC");
    expectRel(AC.stress.tension.value, sigma, 1e-11, "tension");
    expect(AC.stress.tension.x).toBe(3);
    expect(AC.stress.tension.z).toBe(-0.15);
    expect(AC.stress.passes).toBe(true);
    const found = spanOf(model, ["AC", "CB"]);
    const d = (5 * 15 * 6 ** 4) / (384 * 2.1e8 * I300.Iy);
    expectRel(found.value, d, 1e-11, "deflection");
    expectRel(d * 1000, 14.8, 3e-3, "14.8 mm");
    expectRel(found.ratio, d / (6 / 360), 1e-11, "ratio");
    expect(found.passes).toBe(true);
  });

  it("task (b), the portal of 8 m by 5 m (columns I 300x150, beam I 400x180, 30 kN/m and 20 kN): both columns drift by the sway of their tops, within 2 percent of PH³(3k+2)/(12·E·Ic·(6k+1)); every member has tension and compression; the largest stress is at a column top or beam end", () => {
    const model = taskModel(
      [I300, I400],
      [
        ["A", 0, 0, 0],
        ["B", 0, 0, 5],
        ["C", 8, 0, 5],
        ["D", 8, 0, 0],
      ],
      [
        ["AB", "A", "B", "I 300x150"],
        ["BC", "B", "C", "I 400x180"],
        ["DC", "D", "C", "I 300x150"],
      ],
      [support("A", ALL), support("D", ALL)],
      {
        nodal: [nodal("wind-B", "B", { fx: 20 })],
        uniform: [uniform("w-BC", "BC", "global", "z", -30)],
      },
    );
    const result = solved(model);
    const found = memberChecks(model, result, "lc1") as MemberChecks;
    const [AB, BC, DC] = found.members as [MemberCheck, MemberCheck, MemberCheck];
    const displacements = loadCase(result).displacements;
    expect(AB.drift?.value).toBe(Math.abs(displacements.B?.ux ?? Number.NaN));
    expect(DC.drift?.value).toBe(Math.abs(displacements.C?.ux ?? Number.NaN));
    // The closed form for members that do not change length (packages/tasks, portalFrame.ts); the
    // solver includes axial deformation, hence 2 percent.
    const k = I400.Iy / 8 / (I300.Iy / 5);
    const sway = (20 * 5 ** 3 * (3 * k + 2)) / (12 * 2.1e8 * I300.Iy * (6 * k + 1));
    expectRel(AB.drift?.value ?? 0, sway, 2e-2, "sway of B");
    expectRel(DC.drift?.value ?? 0, sway, 2e-2, "sway of C");
    expect(AB.drift?.height).toBe(5);
    expect(AB.drift?.limit).toBe(5 / 300);
    expectRel(AB.drift?.ratio ?? 0, (AB.drift?.value ?? 0) / (5 / 300), 1e-12, "ratio");
    for (const member of [AB, BC, DC]) {
      expect(member.stress.tension.value).toBeGreaterThan(0);
      expect(member.stress.compression.value).toBeLessThan(0);
      expect(member.stress.ratio).toBeGreaterThan(0);
      expect(Number.isFinite(member.stress.ratio)).toBe(true);
    }
    // The columns are in compression overall: the compression is the larger of the two.
    expect(Math.abs(AB.stress.compression.value)).toBeGreaterThan(AB.stress.tension.value);
    expect(Math.abs(DC.stress.compression.value)).toBeGreaterThan(DC.stress.tension.value);
    // The beam hogs at C (gravity and wind add there): its largest stress is at an end or in the span.
    expect(BC.deflection?.span).toBe(8);
    expect(BC.deflection?.value ?? 0).toBeGreaterThan(0);
    // The beam's bending deflection is below that of the same beam simply supported.
    expect(BC.deflection?.value ?? 0).toBeLessThan((5 * 30 * 8 ** 4) / (384 * 2.1e8 * I400.Iy));
    const governing = governingChecks(found);
    expect(["AB", "DC"]).toContain(governing.drift?.memberId);
    expect(governing.deflection?.memberId).toBe("BC");
  });
});

describe("the cost of the checks", () => {
  it("the 200-member building frame: 200 members checked in each load case, none skipped; columns have a drift and beams a deflection", () => {
    const model = buildingFrame(3, 3, 5);
    expect(model.members.length).toBe(200);
    const result = solved(model);
    for (const loadCaseId of ["gravity", "wind"]) {
      const found = memberChecks(model, result, loadCaseId);
      expect(found?.members.length).toBe(200);
      expect(found?.skipped).toEqual([]);
      const vertical = found?.members.filter((member) => member.vertical) ?? [];
      expect(vertical.length).toBe(80);
      expect(vertical.every((member) => member.drift !== null && member.deflection === null)).toBe(
        true,
      );
      const governing = structureChecks(model, result, loadCaseId);
      expect(governing?.stress?.ratio).toBeGreaterThan(0);
      expect(governing?.deflection).not.toBeNull();
      expect(governing?.drift).not.toBeNull();
    }
  });

  // A loose bound, far above the measured time (README, "Illustrative member checks"), so that a
  // slow machine passes.
  it("memberChecks and structureChecks of 200 members take under 1 second together", () => {
    const model = buildingFrame(3, 3, 5);
    const result = solved(model);
    const started = performance.now();
    memberChecks(model, result, "gravity");
    structureChecks(model, result, "gravity");
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
