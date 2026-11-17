// Unit tests of what the viewport draws for loads (card PX-02.5, ./loads.ts): positions, unit directions,
// magnitudes and label pieces for each load type, the active load case, and what is not drawn.
import {
  type MemberPointLoad,
  type MemberUniformLoad,
  type Model,
  type NodalLoad,
  planarTruss,
  portalFrame,
  simplySupportedBeam,
} from "@bridle/model";
import { describe, expect, it } from "vitest";
import {
  activeLoadCaseId,
  buildLoads,
  type DrawnForce,
  type DrawnLoad,
  type DrawnMoment,
  type DrawnUniformLoad,
  formatLoadValue,
  loadCount,
  UNIFORM_ARROW_SPACES_MAX,
  UNIFORM_ARROW_SPACES_MIN,
  uniformArrowSpaces,
} from "./loads";

function freeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) {
      freeze(inner);
    }
  }
  return value;
}

const nodal = (id: string, nodeId: string, parts: Partial<NodalLoad> = {}): NodalLoad => ({
  id,
  loadCaseId: "lc1",
  nodeId,
  fx: 0,
  fy: 0,
  fz: 0,
  mx: 0,
  my: 0,
  mz: 0,
  ...parts,
});
const uniform = (id: string, memberId: string, parts: Partial<MemberUniformLoad> = {}) =>
  ({
    id,
    loadCaseId: "lc1",
    memberId,
    axes: "global",
    direction: "z",
    value: -10,
    ...parts,
  }) satisfies MemberUniformLoad;
const point = (id: string, memberId: string, parts: Partial<MemberPointLoad> = {}) =>
  ({
    id,
    loadCaseId: "lc1",
    memberId,
    axes: "global",
    direction: "z",
    value: -10,
    position: 1,
    ...parts,
  }) satisfies MemberPointLoad;

/** The portal frame (6 m by 4 m in the X-Z plane; c1 n1-n2 up, b1 n2-n3 along +X, c2 n4-n3 up) with these loads. */
function portalWith(loads: Partial<Model>): Model {
  return freeze({ ...portalFrame(), nodalLoads: [], ...loads });
}

const only = <T extends DrawnLoad>(loads: DrawnLoad[]): T => {
  expect(loads).toHaveLength(1);
  return loads[0] as T;
};
const close = (actual: readonly number[], expected: readonly number[]) => {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((value, index) => {
    expect(value).toBeCloseTo(expected[index] as number, 12);
  });
};

describe("formatLoadValue", () => {
  it("drops the sign and trailing zeros and keeps at most three decimals", () => {
    expect(formatLoadValue(-10)).toBe("10");
    expect(formatLoadValue(12.5)).toBe("12.5");
    expect(formatLoadValue(-0.12345)).toBe("0.123");
    expect(formatLoadValue(1e-9)).toBe("0");
    expect(formatLoadValue(2.5e3)).toBe("2500");
  });
});

describe("activeLoadCaseId and loadCount", () => {
  const model = freeze({
    ...portalFrame(),
    loadCases: [
      { id: "lc1", name: "LC1" },
      { id: "lc2", name: "Wind" },
    ],
    nodalLoads: [nodal("nl1", "n2", { fx: 20 }), nodal("nl2", "n3", { fz: -5, loadCaseId: "lc2" })],
    memberUniformLoads: [uniform("ul1", "b1")],
    memberPointLoads: [point("pl1", "b1", { loadCaseId: "lc2" })],
  });

  it("is the wanted load case when the model holds it, else the first, else none", () => {
    expect(activeLoadCaseId(model, "lc2")).toBe("lc2");
    expect(activeLoadCaseId(model, "gone")).toBe("lc1");
    expect(activeLoadCaseId(model, null)).toBe("lc1");
    expect(activeLoadCaseId(model, undefined)).toBe("lc1");
    expect(activeLoadCaseId({ ...model, loadCases: [] }, "lc1")).toBeNull();
  });

  it("counts the loads of the three lists per load case", () => {
    expect(loadCount(model, "lc1")).toBe(2);
    expect(loadCount(model, "lc2")).toBe(2);
    expect(loadCount(model, "lc3")).toBe(0);
  });

  it("only the loads of the asked load case are drawn", () => {
    expect(buildLoads(model, "lc1").map((load) => load.key)).toEqual(["nl1:fx", "ul1"]);
    expect(buildLoads(model, "lc2").map((load) => load.key)).toEqual(["nl2:fz", "pl1"]);
    expect(buildLoads(model, "lc3")).toEqual([]);
    expect(buildLoads(model, null)).toEqual([]);
  });
});

describe("nodal loads", () => {
  it("the portal frame's 20 kN along +X is one force at the top of the left column", () => {
    expect(buildLoads(freeze(portalFrame()), "lc1")).toEqual([
      {
        kind: "force",
        key: "nl1:fx",
        loadId: "nl1",
        on: { kind: "node", id: "n2" },
        point: [0, 0, 4],
        direction: [1, 0, 0],
        magnitude: 20,
        label: { value: "20", unit: "kN" },
      },
    ]);
  });

  it("a load of -10 kN in Z points down, with the magnitude 10", () => {
    const force = only<DrawnForce>(
      buildLoads(portalWith({ nodalLoads: [nodal("nl1", "n3", { fz: -10 })] }), "lc1"),
    );
    expect(force.direction).toEqual([0, 0, -1]);
    expect(force.magnitude).toBe(10);
    expect(force.point).toEqual([6, 0, 4]);
    expect(force.label).toEqual({ value: "10", unit: "kN" });
  });

  it.each([
    ["fx", 5, [1, 0, 0]],
    ["fx", -5, [-1, 0, 0]],
    ["fy", 5, [0, 1, 0]],
    ["fy", -5, [0, -1, 0]],
    ["fz", 5, [0, 0, 1]],
    ["fz", -5, [0, 0, -1]],
  ] as const)("the force %s = %d acts along %j", (component, value, direction) => {
    const force = only<DrawnForce>(
      buildLoads(portalWith({ nodalLoads: [nodal("nl1", "n2", { [component]: value })] }), "lc1"),
    );
    expect(force.kind).toBe("force");
    expect(force.direction).toEqual(direction);
    expect(force.magnitude).toBe(5);
  });

  it.each([
    ["mx", 15, [1, 0, 0]],
    ["my", 15, [0, 1, 0]],
    ["my", -15, [0, -1, 0]],
    ["mz", -15, [0, 0, -1]],
  ] as const)(
    "the moment %s = %d turns about %j by the right-hand rule",
    (component, value, axis) => {
      const moment = only<DrawnMoment>(
        buildLoads(portalWith({ nodalLoads: [nodal("nl1", "n2", { [component]: value })] }), "lc1"),
      );
      expect(moment).toEqual({
        kind: "moment",
        key: `nl1:${component}`,
        loadId: "nl1",
        on: { kind: "node", id: "n2" },
        point: [0, 0, 4],
        axis,
        magnitude: 15,
        label: { value: "15", unit: "kNm" },
      });
    },
  );

  it("a load with several components gives one item per component that is not zero", () => {
    const loads = buildLoads(
      portalWith({ nodalLoads: [nodal("nl1", "n2", { fx: 20, fz: -7.5, my: 3 })] }),
      "lc1",
    );
    expect(loads.map((load) => [load.key, load.kind, load.label.value])).toEqual([
      ["nl1:fx", "force", "20"],
      ["nl1:fz", "force", "7.5"],
      ["nl1:my", "moment", "3"],
    ]);
  });

  it("the truss draws its two 20 kN loads downward on the top nodes", () => {
    const loads = buildLoads(freeze(planarTruss()), "lc1") as DrawnForce[];
    expect(loads.map((load) => [load.on.id, load.point, load.direction, load.magnitude])).toEqual([
      ["n4", [3, 0, 4], [0, 0, -1], 20],
      ["n5", [9, 0, 4], [0, 0, -1], 20],
    ]);
  });
});

describe("member uniform loads", () => {
  it("the beam's 10 kN/m downward is a row of arrow heads from end to end of the member", () => {
    const load = only<DrawnUniformLoad>(buildLoads(freeze(simplySupportedBeam()), "lc1"));
    expect(load.kind).toBe("uniform");
    expect(load.key).toBe("ul1");
    expect(load.on).toEqual({ kind: "member", id: "m1" });
    expect(load.start).toEqual([0, 0, 0]);
    expect(load.end).toEqual([6, 0, 0]);
    expect(load.direction).toEqual([0, 0, -1]);
    expect(load.magnitude).toBe(10);
    expect(load.label).toEqual({ value: "10", unit: "kNPerM" });
    expect(load.alongMember).toBe(false);
    // The model is 6 m across: an arrow every 0.5 m, 12 spaces.
    expect(load.arrows).toHaveLength(13);
    expect(load.arrows[0]).toEqual([0, 0, 0]);
    expect(load.arrows[12]).toEqual([6, 0, 0]);
    load.arrows.forEach((arrow, index) => {
      close(arrow, [index * 0.5, 0, 0]);
    });
  });

  it("a positive value in global Z points up", () => {
    const load = only<DrawnUniformLoad>(
      buildLoads(portalWith({ memberUniformLoads: [uniform("ul1", "b1", { value: 4 })] }), "lc1"),
    );
    expect(load.direction).toEqual([0, 0, 1]);
    expect(load.magnitude).toBe(4);
  });

  it("local axes follow memberLocalAxes: local z of an upward column is global -X", () => {
    // c1 runs from n1 (0, 0, 0) up to n2 (0, 0, 4): local x = +Z, local y = +Y, local z = -X.
    const local = (direction: "x" | "y" | "z", value: number) =>
      only<DrawnUniformLoad>(
        buildLoads(
          portalWith({
            memberUniformLoads: [uniform("ul1", "c1", { axes: "local", direction, value })],
          }),
          "lc1",
        ),
      );
    close(local("z", 5).direction, [-1, 0, 0]);
    close(local("z", -5).direction, [1, 0, 0]);
    close(local("y", 5).direction, [0, 1, 0]);
    const axial = local("x", -5);
    close(axial.direction, [0, 0, -1]);
    expect(axial.alongMember).toBe(true);
    expect(local("z", 5).alongMember).toBe(false);
    // The same direction in global axes is the global axis, whatever the member.
    const global = only<DrawnUniformLoad>(
      buildLoads(
        portalWith({ memberUniformLoads: [uniform("ul1", "c1", { direction: "x", value: 5 })] }),
        "lc1",
      ),
    );
    expect(global.direction).toEqual([1, 0, 0]);
    expect(global.arrows[0]).toEqual([0, 0, 0]);
    expect(global.arrows.at(-1)).toEqual([0, 0, 4]);
  });

  it("local axes turn with the member's roll angle", () => {
    const model = portalWith({
      memberUniformLoads: [uniform("ul1", "b1", { axes: "local", direction: "z", value: 5 })],
    });
    // b1 runs along +X: local z is +Z at roll 0 and -Y at roll 90 (y = z0, z = -y0).
    close(only<DrawnUniformLoad>(buildLoads(model, "lc1")).direction, [0, 0, 1]);
    const rolled = freeze({
      ...model,
      members: model.members.map((member) =>
        member.id === "b1" ? { ...member, rollAngleDeg: 90 } : member,
      ),
    });
    close(only<DrawnUniformLoad>(buildLoads(rolled, "lc1")).direction, [0, -1, 0]);
  });

  it("on an inclined member the heads are on the member and local z is perpendicular to it", () => {
    // t4 of the truss runs from n1 (0, 0, 0) to n4 (3, 0, 4): length 5, local x = (0.6, 0, 0.8).
    const model = freeze({
      ...planarTruss(),
      nodalLoads: [],
      memberUniformLoads: [uniform("ul1", "t4", { axes: "local", direction: "z", value: -2 })],
    });
    const load = only<DrawnUniformLoad>(buildLoads(model, "lc1"));
    close(load.direction, [0.8, 0, -0.6]);
    // The truss is 12 m across: an arrow about every metre, five spaces on 5 m.
    expect(load.arrows).toHaveLength(6);
    close(load.arrows[1] ?? [], [0.6, 0, 0.8]);
    close(load.arrows[5] ?? [], [3, 0, 4]);
  });

  it("the number of spaces follows the model's size, between the two limits", () => {
    expect(uniformArrowSpaces(6, 6)).toBe(12);
    expect(uniformArrowSpaces(5, 12)).toBe(5);
    expect(uniformArrowSpaces(0.1, 12)).toBe(UNIFORM_ARROW_SPACES_MIN);
    expect(uniformArrowSpaces(40, 12)).toBe(UNIFORM_ARROW_SPACES_MAX);
    expect(uniformArrowSpaces(3, 0)).toBe(UNIFORM_ARROW_SPACES_MIN);
  });
});

describe("member point loads", () => {
  it("is one force at its position from the start node", () => {
    const force = only<DrawnForce>(
      buildLoads(
        portalWith({ memberPointLoads: [point("pl1", "b1", { value: -30, position: 4.5 })] }),
        "lc1",
      ),
    );
    expect(force).toEqual({
      kind: "force",
      key: "pl1",
      loadId: "pl1",
      on: { kind: "member", id: "b1" },
      point: [4.5, 0, 4],
      direction: [0, 0, -1],
      magnitude: 30,
      label: { value: "30", unit: "kN" },
    });
  });

  it("measures the position along the member, and takes local axes from the member", () => {
    // c2 runs from n4 (6, 0, 0) up to n3 (6, 0, 4).
    const force = only<DrawnForce>(
      buildLoads(
        portalWith({
          memberPointLoads: [
            point("pl1", "c2", { axes: "local", direction: "z", value: 8, position: 1.5 }),
          ],
        }),
        "lc1",
      ),
    );
    close(force.point, [6, 0, 1.5]);
    close(force.direction, [-1, 0, 0]);
  });

  it("a position beyond the member's ends is drawn at the end", () => {
    const at = (position: number) =>
      only<DrawnForce>(
        buildLoads(portalWith({ memberPointLoads: [point("pl1", "b1", { position })] }), "lc1"),
      ).point;
    close(at(9), [6, 0, 4]);
    close(at(-1), [0, 0, 4]);
  });
});

describe("what is not drawn", () => {
  it("a zero value, a value or a position that is not finite", () => {
    const model = portalWith({
      nodalLoads: [nodal("nl1", "n2"), nodal("nl2", "n2", { fx: Number.NaN, mz: Infinity })],
      memberUniformLoads: [uniform("ul1", "b1", { value: 0 })],
      memberPointLoads: [
        point("pl1", "b1", { value: 0 }),
        point("pl2", "b1", { position: Number.NaN }),
      ],
    });
    expect(buildLoads(model, "lc1")).toEqual([]);
  });

  it("a load on a node or a member the model does not hold, or on a member without length", () => {
    const base = portalFrame();
    const model = freeze({
      ...base,
      nodes: [
        ...base.nodes,
        { id: "n5", x: 0, y: 0, z: 4 },
        { id: "n6", x: Number.NaN, y: 0, z: 0 },
      ],
      members: [
        ...base.members,
        {
          ...(base.members[0] as Model["members"][number]),
          id: "zero",
          startNodeId: "n2",
          endNodeId: "n5",
        },
        {
          ...(base.members[0] as Model["members"][number]),
          id: "open",
          startNodeId: "n2",
          endNodeId: "gone",
        },
      ],
      nodalLoads: [nodal("nl1", "gone", { fx: 1 }), nodal("nl2", "n6", { fx: 1 })],
      memberUniformLoads: [uniform("ul1", "gone"), uniform("ul2", "zero"), uniform("ul3", "open")],
      memberPointLoads: [point("pl1", "gone"), point("pl2", "zero", { position: 0 })],
    });
    expect(buildLoads(model, "lc1")).toEqual([]);
  });
});
