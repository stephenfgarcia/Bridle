import { describe, expect, it } from "vitest";
import {
  emptyModel,
  type IssueCode,
  MODEL_UNITS,
  MODEL_VERSION,
  type Model,
  type ModelIssue,
  memberLocalAxes,
  PARSE_ISSUE_CODES,
  parseModel,
  planarTruss,
  portalFrame,
  serializeModel,
  simplySupportedBeam,
  VALIDATION_ISSUE_CODES,
  type Vec3,
  validateModel,
} from "./index";

const FIXTURES = { simplySupportedBeam, portalFrame, planarTruss };

/** The beam fixture with one point load at mid-span, so every list a test changes has an entry. */
function beam(): Model {
  const model = simplySupportedBeam();
  model.nodalLoads.push({
    id: "nl1",
    loadCaseId: "lc1",
    nodeId: "n2",
    fx: 5,
    fy: 0,
    fz: 0,
    mx: 0,
    my: 0,
    mz: 0,
  });
  model.memberPointLoads.push({
    id: "pl1",
    loadCaseId: "lc1",
    memberId: "m1",
    axes: "local",
    direction: "z",
    value: -15,
    position: 3,
  });
  return model;
}

function broken(change: (model: Model) => void): ModelIssue[] {
  const model = beam();
  change(model);
  return validateModel(model);
}

function first<T>(list: readonly T[]): T {
  const item = list[0];
  if (item === undefined) {
    throw new Error("the list is empty");
  }
  return item;
}

function expectClose(actual: Vec3 | undefined, expected: Vec3): void {
  expect(actual).toBeDefined();
  expect(actual?.x).toBeCloseTo(expected.x, 12);
  expect(actual?.y).toBeCloseTo(expected.y, 12);
  expect(actual?.z).toBeCloseTo(expected.z, 12);
}

describe("fixtures", () => {
  for (const [name, make] of Object.entries(FIXTURES)) {
    it(`${name} is valid`, () => {
      expect(validateModel(make())).toEqual([]);
    });

    it(`${name} is in the model's version and units`, () => {
      const model = make();
      expect(model.version).toBe(MODEL_VERSION);
      expect(model.units).toEqual({ force: "kN", length: "m" });
      expect(MODEL_UNITS).toEqual({ force: "kN", length: "m" });
    });

    it(`${name} is a new object on each call`, () => {
      const model = make();
      first(model.nodes).x = 99;
      expect(first(make().nodes).x).not.toBe(99);
    });
  }

  it("the beam is 6 m long with a uniform load", () => {
    const model = simplySupportedBeam();
    expect(model.nodes.map((node) => [node.x, node.y, node.z])).toEqual([
      [0, 0, 0],
      [6, 0, 0],
    ]);
    expect(model.memberUniformLoads).toEqual([
      { id: "ul1", loadCaseId: "lc1", memberId: "m1", axes: "global", direction: "z", value: -10 },
    ]);
  });

  it("the portal frame is 6 m wide and 4 m high with a lateral point load", () => {
    const model = portalFrame();
    expect(Math.max(...model.nodes.map((node) => node.x))).toBe(6);
    expect(Math.max(...model.nodes.map((node) => node.z))).toBe(4);
    expect(model.members.map((member) => member.kind)).toEqual(["frame", "frame", "frame"]);
    expect(model.nodalLoads.map((load) => [load.nodeId, load.fx, load.fz])).toEqual([
      ["n2", 20, 0],
    ]);
  });

  it("the truss has only truss members, all in the X-Z plane", () => {
    const model = planarTruss();
    expect(model.members).toHaveLength(7);
    expect(model.members.every((member) => member.kind === "truss")).toBe(true);
    expect(model.nodes.every((node) => node.y === 0)).toBe(true);
  });
});

describe("validateModel", () => {
  it("accepts the beam the cases below break", () => {
    expect(validateModel(beam())).toEqual([]);
  });

  it("gives every issue its code, its message key and its ids", () => {
    const issues = broken((model) => {
      first(model.members).sectionId = "nope";
    });
    expect(issues).toEqual([
      {
        code: "missing-section",
        messageKey: "model.issue.missing-section",
        ids: ["m1", "nope"],
        path: "members[0].sectionId",
      },
    ]);
  });

  const cases: [string, IssueCode, (model: Model) => void, string[], string | undefined][] = [
    [
      "a duplicate node id",
      "duplicate-id",
      (m) => m.nodes.push({ id: "n1", x: 1, y: 1, z: 1 }),
      ["n1"],
      "nodes[2].id",
    ],
    [
      "a duplicate member id",
      "duplicate-id",
      (m) => m.members.push({ ...first(m.members) }),
      ["m1"],
      "members[1].id",
    ],
    [
      "a duplicate section id",
      "duplicate-id",
      (m) => m.sections.push({ ...first(m.sections) }),
      ["s1"],
      "sections[1].id",
    ],
    [
      "a duplicate material id",
      "duplicate-id",
      (m) => m.materials.push({ ...first(m.materials) }),
      ["mat1"],
      "materials[1].id",
    ],
    [
      "a duplicate load case id",
      "duplicate-id",
      (m) => m.loadCases.push({ id: "lc1", name: "again" }),
      ["lc1"],
      "loadCases[1].id",
    ],
    [
      "a duplicate load id",
      "duplicate-id",
      (m) => m.memberUniformLoads.push({ ...first(m.memberUniformLoads) }),
      ["ul1"],
      "memberUniformLoads[1].id",
    ],
    [
      "a second support on a node",
      "duplicate-support",
      (m) => m.supports.push({ ...first(m.supports) }),
      ["n1"],
      "supports[2].nodeId",
    ],
    [
      "a member with a missing start node",
      "missing-node",
      (m) => {
        first(m.members).startNodeId = "ghost";
      },
      ["m1", "ghost"],
      "members[0].startNodeId",
    ],
    [
      "a member with a missing end node",
      "missing-node",
      (m) => {
        first(m.members).endNodeId = "ghost";
      },
      ["m1", "ghost"],
      "members[0].endNodeId",
    ],
    [
      "a member with a missing section",
      "missing-section",
      (m) => {
        first(m.members).sectionId = "ghost";
      },
      ["m1", "ghost"],
      "members[0].sectionId",
    ],
    [
      "a member with a missing material",
      "missing-material",
      (m) => {
        first(m.members).materialId = "ghost";
      },
      ["m1", "ghost"],
      "members[0].materialId",
    ],
    [
      "a member between two nodes at one point",
      "zero-length-member",
      (m) => {
        const end = m.nodes[1];
        if (end) {
          end.x = 0;
        }
      },
      ["m1"],
      "members[0]",
    ],
    [
      "a member from a node to itself",
      "zero-length-member",
      (m) => {
        first(m.members).endNodeId = "n1";
      },
      ["m1"],
      "members[0]",
    ],
    [
      "a support on a missing node",
      "missing-node",
      (m) => {
        first(m.supports).nodeId = "ghost";
      },
      ["ghost"],
      "supports[0].nodeId",
    ],
    [
      "a nodal load on a missing node",
      "missing-node",
      (m) => {
        first(m.nodalLoads).nodeId = "ghost";
      },
      ["nl1", "ghost"],
      "nodalLoads[0].nodeId",
    ],
    [
      "a uniform load on a missing member",
      "missing-member",
      (m) => {
        first(m.memberUniformLoads).memberId = "ghost";
      },
      ["ul1", "ghost"],
      "memberUniformLoads[0].memberId",
    ],
    [
      "a point load on a missing member",
      "missing-member",
      (m) => {
        first(m.memberPointLoads).memberId = "ghost";
      },
      ["pl1", "ghost"],
      "memberPointLoads[0].memberId",
    ],
    [
      "a nodal load in a missing load case",
      "missing-load-case",
      (m) => {
        first(m.nodalLoads).loadCaseId = "ghost";
      },
      ["nl1", "ghost"],
      "nodalLoads[0].loadCaseId",
    ],
    [
      "a uniform load in a missing load case",
      "missing-load-case",
      (m) => {
        first(m.memberUniformLoads).loadCaseId = "ghost";
      },
      ["ul1", "ghost"],
      "memberUniformLoads[0].loadCaseId",
    ],
    [
      "a point load in a missing load case",
      "missing-load-case",
      (m) => {
        first(m.memberPointLoads).loadCaseId = "ghost";
      },
      ["pl1", "ghost"],
      "memberPointLoads[0].loadCaseId",
    ],
    [
      "a point load beyond the end of the member",
      "load-position-outside-member",
      (m) => {
        first(m.memberPointLoads).position = 6.5;
      },
      ["pl1", "m1"],
      "memberPointLoads[0].position",
    ],
    [
      "a point load before the start of the member",
      "load-position-outside-member",
      (m) => {
        first(m.memberPointLoads).position = -0.1;
      },
      ["pl1", "m1"],
      "memberPointLoads[0].position",
    ],
    [
      "a model with no support",
      "no-support",
      (m) => {
        m.supports = [];
      },
      [],
      undefined,
    ],
    [
      "a model whose supports restrain nothing",
      "no-support",
      (m) => {
        m.supports = m.supports.map((s) => ({
          nodeId: s.nodeId,
          ux: false,
          uy: false,
          uz: false,
          rx: false,
          ry: false,
          rz: false,
        }));
      },
      [],
      undefined,
    ],
  ];

  for (const [name, code, change, ids, path] of cases) {
    it(`reports ${name} as ${code}`, () => {
      const issues = broken(change);
      const expected: ModelIssue = { code, messageKey: `model.issue.${code}`, ids };
      if (path !== undefined) {
        expected.path = path;
      }
      expect(issues).toEqual([expected]);
    });
  }

  for (const field of ["A", "Iy", "Iz", "J", "depthY", "depthZ"] as const) {
    for (const value of [0, -1]) {
      it(`reports a section's ${field} of ${value} as non-positive-value`, () => {
        const issues = broken((m) => {
          first(m.sections)[field] = value;
        });
        expect(issues).toEqual([
          {
            code: "non-positive-value",
            messageKey: "model.issue.non-positive-value",
            ids: ["s1"],
            path: `sections[0].${field}`,
          },
        ]);
      });
    }
  }

  for (const field of ["E", "G", "fy"] as const) {
    for (const value of [0, -1]) {
      it(`reports a material's ${field} of ${value} as non-positive-value`, () => {
        const issues = broken((m) => {
          first(m.materials)[field] = value;
        });
        expect(issues).toEqual([
          {
            code: "non-positive-value",
            messageKey: "model.issue.non-positive-value",
            ids: ["mat1"],
            path: `materials[0].${field}`,
          },
        ]);
      });
    }
  }

  it("the cases above cover every validation code", () => {
    const covered = new Set<string>(cases.map(([, code]) => code));
    covered.add("non-positive-value");
    expect([...covered].sort()).toEqual([...VALIDATION_ISSUE_CODES].sort());
  });

  it("accepts a point load at either end of the member", () => {
    for (const position of [0, 6]) {
      expect(
        broken((m) => {
          first(m.memberPointLoads).position = position;
        }),
      ).toEqual([]);
    }
  });

  it("reports several problems together", () => {
    const codes = validateModel(emptyModel()).map((item) => item.code);
    expect(codes).toEqual(["no-support"]);
    const issues = broken((m) => {
      first(m.sections).A = 0;
      first(m.materials).E = 0;
      m.supports = [];
    });
    expect(issues.map((item) => item.code)).toEqual([
      "non-positive-value",
      "non-positive-value",
      "no-support",
    ]);
  });
});

describe("serializeModel and parseModel", () => {
  for (const [name, make] of Object.entries({ ...FIXTURES, beamWithPointLoad: beam })) {
    it(`round-trips ${name}`, () => {
      const model = make();
      const text = serializeModel(model);
      const parsed = parseModel(text);
      expect(parsed).toEqual({ ok: true, model });
      if (parsed.ok) {
        expect(serializeModel(parsed.model)).toBe(text);
      }
    });
  }

  it("round-trips a model that validateModel would reject", () => {
    const model = emptyModel();
    expect(parseModel(serializeModel(model))).toEqual({ ok: true, model });
  });

  it("writes the keys in the order of the types, whatever order the object has", () => {
    const model = simplySupportedBeam();
    const shuffled = Object.fromEntries(Object.entries(model).reverse()) as unknown as Model;
    expect(Object.keys(shuffled)[0]).not.toBe("version");
    const text = serializeModel(shuffled);
    expect(text).toBe(serializeModel(model));
    expect(Object.keys(JSON.parse(text))).toEqual([
      "version",
      "units",
      "nodes",
      "members",
      "sections",
      "materials",
      "supports",
      "loadCases",
      "nodalLoads",
      "memberUniformLoads",
      "memberPointLoads",
    ]);
    expect(text.endsWith("}\n")).toBe(true);
  });

  it("serializeModel throws on a number JSON cannot hold", () => {
    const model = simplySupportedBeam();
    first(model.nodes).x = Number.NaN;
    expect(() => serializeModel(model)).toThrow("nodes[0].x");
  });

  function refused(json: string): ModelIssue[] {
    let result: ReturnType<typeof parseModel> | undefined;
    expect(() => {
      result = parseModel(json);
    }).not.toThrow();
    if (result === undefined || result.ok) {
      throw new Error("parseModel accepted the text");
    }
    return result.issues;
  }

  function changed(change: (json: Record<string, unknown>) => void): string {
    const json = JSON.parse(serializeModel(beam())) as Record<string, unknown>;
    change(json);
    return JSON.stringify(json);
  }

  function entry(json: Record<string, unknown>, list: string): Record<string, unknown> {
    return first(json[list] as Record<string, unknown>[]);
  }

  it("refuses text that is not JSON", () => {
    for (const text of ["", "{", "not json"]) {
      expect(refused(text)).toEqual([
        { code: "invalid-json", messageKey: "model.issue.invalid-json", ids: [] },
      ]);
    }
  });

  it("refuses JSON that is not an object", () => {
    for (const text of ["null", "[]", "3", '"model"', "true"]) {
      expect(refused(text)).toEqual([
        { code: "invalid-shape", messageKey: "model.issue.invalid-shape", ids: [], path: "" },
      ]);
    }
  });

  it("refuses an empty object, naming every missing key", () => {
    expect(refused("{}").map((item) => [item.code, item.path])).toEqual([
      ["invalid-shape", "version"],
      ["invalid-shape", "units"],
      ["invalid-shape", "nodes"],
      ["invalid-shape", "members"],
      ["invalid-shape", "sections"],
      ["invalid-shape", "materials"],
      ["invalid-shape", "supports"],
      ["invalid-shape", "loadCases"],
      ["invalid-shape", "nodalLoads"],
      ["invalid-shape", "memberUniformLoads"],
      ["invalid-shape", "memberPointLoads"],
    ]);
  });

  it("refuses another version", () => {
    const text = changed((json) => {
      json.version = 2;
    });
    expect(refused(text)).toEqual([
      {
        code: "unsupported-version",
        messageKey: "model.issue.unsupported-version",
        ids: [],
        path: "version",
      },
    ]);
  });

  it("refuses other units", () => {
    for (const units of [
      { force: "N", length: "m" },
      { force: "kN", length: "mm" },
      { force: "kN", length: "m", time: "s" },
    ]) {
      const text = changed((json) => {
        json.units = units;
      });
      expect(refused(text)).toEqual([
        {
          code: "unsupported-units",
          messageKey: "model.issue.unsupported-units",
          ids: [],
          path: "units",
        },
      ]);
    }
  });

  const shapes: [string, (json: Record<string, unknown>) => void, string][] = [
    ["a version that is not a number", (j) => (j.version = "1"), "version"],
    ["units that are not an object", (j) => (j.units = "kN, m"), "units"],
    ["a list that is not a list", (j) => (j.nodes = {}), "nodes"],
    ["a list entry that is not an object", (j) => (j.nodes = [1]), "nodes[0]"],
    ["a coordinate that is a string", (j) => (entry(j, "nodes").x = "0"), "nodes[0].x"],
    ["a coordinate that is null", (j) => (entry(j, "nodes").x = null), "nodes[0].x"],
    ["a missing coordinate", (j) => delete entry(j, "nodes").z, "nodes[0].z"],
    ["an id that is a number", (j) => (entry(j, "nodes").id = 1), "nodes[0].id"],
    ["an empty id", (j) => (entry(j, "members").id = ""), "members[0].id"],
    ["an unknown member kind", (j) => (entry(j, "members").kind = "cable"), "members[0].kind"],
    ["missing releases", (j) => delete entry(j, "members").releases, "members[0].releases"],
    [
      "a release that is not a boolean",
      (j) => {
        const releases = entry(j, "members").releases as { start: Record<string, unknown> };
        releases.start.ry = 1;
      },
      "members[0].releases.start.ry",
    ],
    [
      "a restraint that is not a boolean",
      (j) => (entry(j, "supports").ux = "yes"),
      "supports[0].ux",
    ],
    [
      "an unknown load direction",
      (j) => (entry(j, "memberUniformLoads").direction = "down"),
      "memberUniformLoads[0].direction",
    ],
    [
      "unknown load axes",
      (j) => (entry(j, "memberPointLoads").axes = "projected"),
      "memberPointLoads[0].axes",
    ],
    ["a key the format does not have", (j) => (j.extra = 1), "extra"],
    [
      "a key an entry does not have",
      (j) => (entry(j, "sections").colour = "red"),
      "sections[0].colour",
    ],
  ];

  for (const [name, change, path] of shapes) {
    it(`refuses ${name}`, () => {
      expect(refused(changed(change))).toEqual([
        { code: "invalid-shape", messageKey: "model.issue.invalid-shape", ids: [], path },
      ]);
    });
  }

  it("the cases above cover every parse code", () => {
    expect([...PARSE_ISSUE_CODES].sort()).toEqual([
      "invalid-json",
      "invalid-shape",
      "unsupported-units",
      "unsupported-version",
    ]);
  });
});

describe("memberLocalAxes", () => {
  const origin = { x: 0, y: 0, z: 0 };

  it("a member along global +X has the global axes", () => {
    const axes = memberLocalAxes(origin, { x: 6, y: 0, z: 0 }, 0);
    expectClose(axes?.x, { x: 1, y: 0, z: 0 });
    expectClose(axes?.y, { x: 0, y: 1, z: 0 });
    expectClose(axes?.z, { x: 0, y: 0, z: 1 });
  });

  it("a member along global -X keeps local z up", () => {
    const axes = memberLocalAxes(origin, { x: -6, y: 0, z: 0 }, 0);
    expectClose(axes?.y, { x: 0, y: -1, z: 0 });
    expectClose(axes?.z, { x: 0, y: 0, z: 1 });
  });

  it("an inclined member has a horizontal local y and a local z that points upward", () => {
    const axes = memberLocalAxes(origin, { x: 3, y: 0, z: 4 }, 0);
    expectClose(axes?.x, { x: 0.6, y: 0, z: 0.8 });
    expectClose(axes?.y, { x: 0, y: 1, z: 0 });
    expectClose(axes?.z, { x: -0.8, y: 0, z: 0.6 });
  });

  it("a vertical member that runs upward has local y = global +Y and local z = global -X", () => {
    const axes = memberLocalAxes(origin, { x: 0, y: 0, z: 4 }, 0);
    expectClose(axes?.x, { x: 0, y: 0, z: 1 });
    expectClose(axes?.y, { x: 0, y: 1, z: 0 });
    expectClose(axes?.z, { x: -1, y: 0, z: 0 });
  });

  it("a vertical member that runs downward has local y = global +Y and local z = global +X", () => {
    const axes = memberLocalAxes({ x: 0, y: 0, z: 4 }, origin, 0);
    expectClose(axes?.y, { x: 0, y: 1, z: 0 });
    expectClose(axes?.z, { x: 1, y: 0, z: 0 });
  });

  it("a roll of 90 degrees turns local y to where local z was", () => {
    const axes = memberLocalAxes(origin, { x: 6, y: 0, z: 0 }, 90);
    expectClose(axes?.y, { x: 0, y: 0, z: 1 });
    expectClose(axes?.z, { x: 0, y: -1, z: 0 });
  });

  it("the axes are orthonormal and right-handed", () => {
    for (const end of [
      { x: 1, y: 2, z: 3 },
      { x: -4, y: 1, z: -2 },
      { x: 0, y: 0, z: -5 },
      { x: 0, y: 7, z: 0 },
    ]) {
      const axes = memberLocalAxes(origin, end, 37);
      if (axes === undefined) {
        throw new Error("no axes");
      }
      const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
      expect(dot(axes.x, axes.x)).toBeCloseTo(1, 12);
      expect(dot(axes.y, axes.y)).toBeCloseTo(1, 12);
      expect(dot(axes.z, axes.z)).toBeCloseTo(1, 12);
      expect(dot(axes.x, axes.y)).toBeCloseTo(0, 12);
      expect(dot(axes.y, axes.z)).toBeCloseTo(0, 12);
      expectClose(axes.z, {
        x: axes.x.y * axes.y.z - axes.x.z * axes.y.y,
        y: axes.x.z * axes.y.x - axes.x.x * axes.y.z,
        z: axes.x.x * axes.y.y - axes.x.y * axes.y.x,
      });
    }
  });

  it("gives nothing for two points at one place", () => {
    expect(memberLocalAxes(origin, origin, 0)).toBeUndefined();
  });

  it("every member of the portal frame has local y = global +Y", () => {
    const model = portalFrame();
    for (const member of model.members) {
      const start = model.nodes.find((node) => node.id === member.startNodeId);
      const end = model.nodes.find((node) => node.id === member.endNodeId);
      if (start === undefined || end === undefined) {
        throw new Error("the fixture names a missing node");
      }
      expectClose(memberLocalAxes(start, end, member.rollAngleDeg)?.y, { x: 0, y: 1, z: 0 });
    }
  });
});
