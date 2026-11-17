// Unit tests of the pure half of the viewport (card PX-02.2): what is drawn for a model (./scene.ts) and where
// the camera stands (./camera.ts). No WebGL and no three.js.
import {
  emptyModel,
  type Model,
  planarTruss,
  portalFrame,
  type Support,
  simplySupportedBeam,
} from "@bridle/model";
import { describe, expect, it } from "vitest";
import {
  FIT_MARGIN,
  MIN_FIT_DISTANCE,
  placeCamera,
  SCENE_UP,
  VIEW_DIRECTIONS,
  VIEW_FOV_DEG,
  viewBasis,
} from "./camera";
import {
  buildScene,
  GRID_MAX_CELLS,
  gridFor,
  gridLines,
  LOAD_ROOM_RATIO,
  type Point3,
  roomForLoads,
  type SceneBounds,
  supportGlyph,
} from "./scene";

function support(restrained: string): Support {
  const has = (key: string) => restrained.split(" ").includes(key);
  return {
    nodeId: "n1",
    ux: has("ux"),
    uy: has("uy"),
    uz: has("uz"),
    rx: has("rx"),
    ry: has("ry"),
    rz: has("rz"),
  };
}

describe("supportGlyph", () => {
  it.each([
    ["ux uy uz rx ry rz", "fixed"],
    ["ux uy uz", "pinned"],
    ["ux uy uz rx", "pinned"],
    ["ux uy uz rx ry", "pinned"],
    ["uy uz", "roller"],
    ["ux uz", "roller"],
    ["uz", "roller"],
    // A roller of a planar frame after "Restrain out of plane": rx and rz held, the in-plane ry free.
    ["uy uz rx rz", "roller"],
    ["uz rx rz", "roller"],
    ["ux uy uz rx rz", "pinned"],
    // Out-of-plane restraints only: the small mark.
    ["uy", "plane"],
    ["uy rx rz", "plane"],
    ["rx rz", "plane"],
    ["rx", "plane"],
    ["ux uy", "generic"],
    ["uz rx", "generic"],
    ["uy uz ry", "generic"],
    ["uy uz rx ry rz", "generic"],
    ["uy ry", "generic"],
    ["rx ry rz", "generic"],
    ["", "generic"],
  ])("restraints '%s' give the %s glyph", (restrained, glyph) => {
    expect(supportGlyph(support(restrained))).toBe(glyph);
  });
});

describe("buildScene", () => {
  it("draws the simply supported beam", () => {
    const scene = buildScene(simplySupportedBeam());
    expect(scene.counts).toEqual({ nodes: 2, members: 1, supports: 2 });
    expect(scene.nodes).toEqual([
      { id: "n1", position: [0, 0, 0] },
      { id: "n2", position: [6, 0, 0] },
    ]);
    expect(scene.members).toEqual([{ id: "m1", kind: "frame", start: [0, 0, 0], end: [6, 0, 0] }]);
    expect(scene.supports).toEqual([
      { nodeId: "n1", position: [0, 0, 0], glyph: "pinned" },
      { nodeId: "n2", position: [6, 0, 0], glyph: "roller" },
    ]);
    expect(scene.bounds).toEqual({ min: [0, 0, 0], max: [6, 0, 0], center: [3, 0, 0] });
  });

  it("draws the portal frame", () => {
    const scene = buildScene(portalFrame());
    expect(scene.counts).toEqual({ nodes: 4, members: 3, supports: 2 });
    expect(scene.nodes.map((node) => [node.id, ...node.position])).toEqual([
      ["n1", 0, 0, 0],
      ["n2", 0, 0, 4],
      ["n3", 6, 0, 4],
      ["n4", 6, 0, 0],
    ]);
    expect(scene.members).toEqual([
      { id: "c1", kind: "frame", start: [0, 0, 0], end: [0, 0, 4] },
      { id: "b1", kind: "frame", start: [0, 0, 4], end: [6, 0, 4] },
      { id: "c2", kind: "frame", start: [6, 0, 0], end: [6, 0, 4] },
    ]);
    expect(scene.supports).toEqual([
      { nodeId: "n1", position: [0, 0, 0], glyph: "fixed" },
      { nodeId: "n4", position: [6, 0, 0], glyph: "fixed" },
    ]);
    expect(scene.bounds).toEqual({ min: [0, 0, 0], max: [6, 0, 4], center: [3, 0, 2] });
  });

  it("draws the planar truss", () => {
    const scene = buildScene(planarTruss());
    expect(scene.counts).toEqual({ nodes: 5, members: 7, supports: 5 });
    expect(scene.nodes).toHaveLength(5);
    expect(scene.members.map((member) => member.id)).toEqual([
      "t1",
      "t2",
      "t3",
      "t4",
      "t5",
      "t6",
      "t7",
    ]);
    expect(scene.members.every((member) => member.kind === "truss")).toBe(true);
    expect(scene.members[3]).toEqual({ id: "t4", kind: "truss", start: [0, 0, 0], end: [3, 0, 4] });
    expect(scene.supports.map((item) => [item.nodeId, item.glyph])).toEqual([
      ["n1", "pinned"],
      ["n2", "plane"],
      ["n3", "roller"],
      ["n4", "plane"],
      ["n5", "plane"],
    ]);
    expect(scene.bounds).toEqual({ min: [0, 0, 0], max: [12, 0, 4], center: [6, 0, 2] });
  });

  it("gives an empty model no item, bounds at the origin and a grid around it", () => {
    const scene = buildScene(emptyModel());
    expect(scene.counts).toEqual({ nodes: 0, members: 0, supports: 0 });
    expect(scene.nodes).toEqual([]);
    expect(scene.members).toEqual([]);
    expect(scene.supports).toEqual([]);
    expect(scene.bounds).toEqual({ min: [0, 0, 0], max: [0, 0, 0], center: [0, 0, 0] });
    expect(scene.grid).toEqual({ minX: -5, maxX: 5, minY: -5, maxY: 5, step: 1, majorEvery: 5 });
  });

  it("counts what the model lists and leaves out what it cannot draw", () => {
    const model: Model = portalFrame();
    const first = model.members[0];
    const base = model.supports[0];
    if (first === undefined || base === undefined) {
      throw new Error("the portal frame fixture has members and supports");
    }
    model.nodes.push({ id: "n1", x: 9, y: 9, z: 9 }, { id: "bad", x: Number.NaN, y: 0, z: 0 });
    model.members.push(
      { ...first, id: "ghost", endNodeId: "nowhere" },
      { ...first, id: "toBad", endNodeId: "bad" },
    );
    model.supports.push({ ...base, nodeId: "nowhere" }, { ...base, ux: false });
    const scene = buildScene(model);
    expect(scene.counts).toEqual({ nodes: 6, members: 5, supports: 4 });
    expect(scene.nodes.map((node) => node.id)).toEqual(["n1", "n2", "n3", "n4"]);
    expect(scene.nodes[0]?.position).toEqual([0, 0, 0]);
    expect(scene.members.map((member) => member.id)).toEqual(["c1", "b1", "c2"]);
    expect(scene.supports).toEqual([
      { nodeId: "n1", position: [0, 0, 0], glyph: "fixed" },
      { nodeId: "n4", position: [6, 0, 0], glyph: "fixed" },
    ]);
    expect(scene.bounds.max).toEqual([6, 0, 4]);
  });

  it("does not change the model", () => {
    const model = planarTruss();
    const before = JSON.stringify(model);
    buildScene(model);
    expect(JSON.stringify(model)).toBe(before);
  });

  it("describes a 200-member model with one entry per member", () => {
    const model = emptyModel();
    const template = portalFrame().members[0];
    if (template === undefined) {
      throw new Error("the portal frame fixture has members");
    }
    for (let i = 0; i <= 200; i += 1) {
      model.nodes.push({ id: `n${i}`, x: i, y: 0, z: i % 2 });
    }
    for (let i = 0; i < 200; i += 1) {
      model.members.push({
        ...template,
        id: `m${i}`,
        startNodeId: `n${i}`,
        endNodeId: `n${i + 1}`,
      });
    }
    const scene = buildScene(model);
    expect(scene.members).toHaveLength(200);
    expect(scene.nodes).toHaveLength(201);
    expect(scene.members[199]).toMatchObject({ id: "m199", start: [199, 0, 1], end: [200, 0, 0] });
  });
});

describe("the grid", () => {
  it("covers the portal frame's plan with a margin, its edges on major lines", () => {
    const grid = buildScene(portalFrame()).grid;
    expect(grid).toEqual({ minX: -5, maxX: 10, minY: -5, maxY: 5, step: 1, majorEvery: 5 });
  });

  it("has a line at every step, major at every fifth, all on the plane Z = 0", () => {
    const { minor, major } = gridLines({
      minX: -5,
      maxX: 10,
      minY: -5,
      maxY: 5,
      step: 1,
      majorEvery: 5,
    });
    // 16 lines along Y (x = -5 .. 10) and 11 along X (y = -5 .. 5); majors at x = -5, 0, 5, 10 and y = -5, 0, 5.
    expect(major).toHaveLength(7 * 6);
    expect(minor).toHaveLength((16 + 11 - 7) * 6);
    expect(major.slice(0, 6)).toEqual([-5, -5, 0, -5, 5, 0]);
    expect(major.slice(6, 12)).toEqual([0, -5, 0, 0, 5, 0]);
    const zs = [...minor, ...major].filter((_, index) => index % 3 === 2);
    expect(zs.every((z) => z === 0)).toBe(true);
  });

  it("widens its step for a large model instead of drawing thousands of lines", () => {
    const bounds: SceneBounds = { min: [0, 0, 0], max: [1000, 20, 0], center: [500, 10, 0] };
    const grid = gridFor(bounds);
    expect(grid.step).toBe(10);
    expect((grid.maxX - grid.minX) / grid.step).toBeLessThanOrEqual(GRID_MAX_CELLS);
    expect(grid.minX).toBeLessThanOrEqual(-500);
    expect(grid.maxX).toBeGreaterThanOrEqual(1500);
    expect(Math.abs(grid.minX % 50)).toBe(0);
  });
});

function minus(a: Point3, b: Point3): Point3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dot(a: Point3, b: Point3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

describe("the camera", () => {
  it("has Z for up", () => {
    expect(SCENE_UP).toEqual([0, 0, 1]);
  });

  it("looks along +Y at the X-Z plane in the front preset, with +X right and +Z up", () => {
    expect(VIEW_DIRECTIONS.front).toEqual([0, -1, 0]);
    const { right, up } = viewBasis(VIEW_DIRECTIONS.front);
    expect(right).toEqual([1, 0, 0]);
    expect(up).toEqual([0, 0, 1]);
  });

  it("looks down the Z axis in the top preset, with +X right and +Y up", () => {
    const direction = VIEW_DIRECTIONS.top;
    expect(direction[0]).toBe(0);
    expect(direction[2]).toBeGreaterThan(0.999999);
    const { right, up } = viewBasis(direction);
    expect(right[0]).toBeCloseTo(1, 9);
    expect(right[1]).toBeCloseTo(0, 9);
    expect(up[1]).toBeCloseTo(1, 5);
  });

  it("stands above the ground in the 3D preset, with Z up on screen", () => {
    const direction = VIEW_DIRECTIONS["3d"];
    expect(Math.hypot(...direction)).toBeCloseTo(1, 12);
    expect(direction[2]).toBeGreaterThan(0);
    const { right, up } = viewBasis(direction);
    expect(right[2]).toBeCloseTo(0, 12);
    expect(up[2]).toBeGreaterThan(0);
  });

  it.each(["3d", "front", "top"] as const)(
    "frames every corner of the box in the %s preset",
    (preset) => {
      for (const model of [simplySupportedBeam(), portalFrame(), planarTruss()]) {
        const { bounds } = buildScene(model);
        for (const aspect of [960 / 672, 0.6]) {
          const direction = VIEW_DIRECTIONS[preset];
          const fov = VIEW_FOV_DEG[preset];
          const placement = placeCamera(bounds, direction, fov, aspect);
          expect(placement.target).toEqual(bounds.center);
          expect(placement.distance).toBeGreaterThanOrEqual(MIN_FIT_DISTANCE);
          const fromTarget = minus(placement.position, placement.target);
          expect(Math.hypot(...fromTarget)).toBeCloseTo(placement.distance, 9);
          expect(dot(fromTarget, direction)).toBeCloseTo(placement.distance, 9);
          const { right, up } = viewBasis(direction);
          const tanV = Math.tan((fov * Math.PI) / 360);
          let widest = 0;
          for (const x of [bounds.min[0], bounds.max[0]]) {
            for (const z of [bounds.min[2], bounds.max[2]]) {
              // The three fixtures lie in the plane Y = 0, so these four corners are the whole box.
              expect([bounds.min[1], bounds.max[1]]).toEqual([0, 0]);
              const rel = minus([x, 0, z], placement.position);
              const depth = -dot(rel, direction);
              expect(depth).toBeGreaterThan(0);
              const v = Math.abs(dot(rel, up)) / (depth * tanV);
              const h = Math.abs(dot(rel, right)) / (depth * tanV * aspect);
              // 1 is the edge of the picture; the margin keeps every corner inside 1 / FIT_MARGIN of it.
              expect(Math.max(v, h)).toBeLessThanOrEqual(1 / FIT_MARGIN + 1e-9);
              widest = Math.max(widest, v, h);
            }
          }
          // The fit is tight. Seen from the front these boxes have no depth, so unless the minimum distance
          // decided the placement, a corner sits exactly on that inner frame.
          if (preset === "front" && placement.distance > MIN_FIT_DISTANCE + 1e-9) {
            expect(widest).toBeCloseTo(1 / FIT_MARGIN, 9);
          }
        }
      }
    },
  );

  it("is close to a parallel projection in the front and top presets", () => {
    expect(VIEW_FOV_DEG["3d"]).toBe(40);
    for (const preset of ["front", "top"] as const) {
      const { bounds } = buildScene(portalFrame());
      const placement = placeCamera(
        bounds,
        VIEW_DIRECTIONS[preset],
        VIEW_FOV_DEG[preset],
        960 / 672,
      );
      // The frame is 6 m wide and 4 m high: from a hundred times that, the lines of sight are nearly parallel.
      expect(placement.distance).toBeGreaterThan(600);
    }
  });

  it("keeps its distance from a model of one point", () => {
    const point: SceneBounds = { min: [2, 3, 4], max: [2, 3, 4], center: [2, 3, 4] };
    const placement = placeCamera(point, [0, -2, 0], VIEW_FOV_DEG["3d"], 1.5);
    expect(placement.distance).toBe(MIN_FIT_DISTANCE);
    expect(placement.position).toEqual([2, 3 - MIN_FIT_DISTANCE, 4]);
  });
});

describe("the loads of a scene (card PX-02.5)", () => {
  it("are those of the model's first load case unless another one is asked for", () => {
    const base = portalFrame();
    const model = {
      ...base,
      loadCases: [...base.loadCases, { id: "lc2", name: "Wind" }],
      nodalLoads: [
        ...base.nodalLoads,
        {
          ...(base.nodalLoads[0] as (typeof base.nodalLoads)[number]),
          id: "nl2",
          loadCaseId: "lc2",
          fx: -5,
        },
      ],
    };
    expect(buildScene(model).loads.map((load) => load.key)).toEqual(["nl1:fx"]);
    expect(buildScene(model, "lc1").loads.map((load) => load.key)).toEqual(["nl1:fx"]);
    expect(buildScene(model, "lc2").loads.map((load) => load.key)).toEqual(["nl2:fx"]);
    // A load case the model does not hold (one that an undo removed) falls back to the first.
    expect(buildScene(model, "gone").loads.map((load) => load.key)).toEqual(["nl1:fx"]);
    expect(buildScene(emptyModel()).loads).toEqual([]);
  });

  it("do not change the bounds or the counts", () => {
    const scene = buildScene(simplySupportedBeam());
    expect(scene.loads).toHaveLength(1);
    expect(scene.bounds).toEqual({ min: [0, 0, 0], max: [6, 0, 0], center: [3, 0, 0] });
    expect(scene.counts).toEqual({ nodes: 2, members: 1, supports: 2 });
  });

  it("roomForLoads widens the box on every side by a share of its largest dimension", () => {
    const { bounds } = buildScene(portalFrame());
    const room = 6 * LOAD_ROOM_RATIO;
    const wider = roomForLoads(bounds);
    expect(wider.center).toEqual([3, 0, 2]);
    wider.min.forEach((value, axis) => {
      expect(value).toBeCloseTo((bounds.min[axis] as number) - room, 12);
    });
    wider.max.forEach((value, axis) => {
      expect(value).toBeCloseTo((bounds.max[axis] as number) + room, 12);
    });
    const point: SceneBounds = { min: [2, 3, 4], max: [2, 3, 4], center: [2, 3, 4] };
    expect(roomForLoads(point)).toEqual(point);
  });
});
