// Unit tests of the tools' geometry (card PX-02.4, ./workPlane.ts): the ray to the work plane, the snap, which
// node a pointer or a point means, the cursor, the texts and the grids. No WebGL and no DOM.
import { emptyModel, portalFrame } from "@bridle/model";
import { describe, expect, it } from "vitest";
import { placeCamera, VIEW_DIRECTIONS, VIEW_FOV_DEG } from "../viewport/camera";
import type { Point3, SceneBounds } from "../viewport/scene";
import {
  cursorFor,
  DEFAULT_SNAP_STEP,
  DEFAULT_WORK_PLANE,
  drawingBounds,
  emptyModelBounds,
  formatCoordinate,
  isSnapStep,
  MIN_PLANE_INCIDENCE,
  nodeAt,
  normalAxis,
  parseCoordinate,
  pickNodeOnScreen,
  planeThrough,
  pointText,
  rayToPlane,
  SNAP_STEPS,
  sameCursor,
  snapToPlane,
  snapValue,
  type WorkPlane,
  workPlaneGrid,
} from "./workPlane";

const XZ: WorkPlane = { kind: "xz", offset: 0 };
const XY: WorkPlane = { kind: "xy", offset: 0 };

describe("the defaults", () => {
  it("are the vertical plane at Y = 0 and a snap step of 0.5 m out of 0.1, 0.25, 0.5 and 1", () => {
    expect(DEFAULT_WORK_PLANE).toEqual({ kind: "xz", offset: 0 });
    expect(DEFAULT_SNAP_STEP).toBe(0.5);
    expect([...SNAP_STEPS]).toEqual([0.1, 0.25, 0.5, 1]);
    expect(isSnapStep(0.25)).toBe(true);
    expect(isSnapStep(0.2)).toBe(false);
    expect(normalAxis(XZ)).toBe(1);
    expect(normalAxis(XY)).toBe(2);
  });
});

describe("rayToPlane", () => {
  it("meets the vertical plane where a ray along +Y crosses it", () => {
    expect(rayToPlane([3, -10, 2], [0, 1, 0], XZ)).toEqual([3, 0, 2]);
    expect(rayToPlane([3, -10, 2], [0, 5, 0], XZ)).toEqual([3, 0, 2]);
  });

  it("meets a plane at another offset, and sets that coordinate to the offset exactly", () => {
    const hit = rayToPlane([1, -10, 1], [0.1, 1, 0.2], { kind: "xz", offset: 2.5 });
    expect(hit?.[0]).toBeCloseTo(2.25, 12);
    expect(hit?.[1]).toBe(2.5);
    expect(hit?.[2]).toBeCloseTo(3.5, 12);
  });

  it("meets the horizontal plane from above and from below", () => {
    expect(rayToPlane([2, 3, 10], [0, 0, -1], XY)).toEqual([2, 3, 0]);
    expect(rayToPlane([2, 3, -4], [0, 0, 2], { kind: "xy", offset: 3 })).toEqual([2, 3, 3]);
    const slanted = rayToPlane([0, 0, 10], [1, 1, -1], XY);
    expect(slanted?.[0]).toBeCloseTo(10, 12);
    expect(slanted?.[1]).toBeCloseTo(10, 12);
    expect(slanted?.[2]).toBe(0);
  });

  it("has no point for a ray that points away from the plane or starts on it", () => {
    expect(rayToPlane([0, -10, 0], [0, -1, 0], XZ)).toBeNull();
    expect(rayToPlane([0, 0, 5], [0, 0, 1], XY)).toBeNull();
    expect(rayToPlane([1, 0, 1], [0, 1, 0], XZ)).toBeNull();
  });

  it("has no point for a ray along the plane or nearly along it", () => {
    expect(rayToPlane([0, -10, 5], [1, 0, 0], XZ)).toBeNull();
    // Just under and just over the limit of incidence.
    const under = MIN_PLANE_INCIDENCE * 0.9;
    const over = MIN_PLANE_INCIDENCE * 1.1;
    expect(rayToPlane([0, 0, 10], [Math.sqrt(1 - under * under), 0, -under], XY)).toBeNull();
    expect(rayToPlane([0, 0, 10], [Math.sqrt(1 - over * over), 0, -over], XY)).not.toBeNull();
  });

  it("has no point for a ray without a direction or with a number that is not finite", () => {
    expect(rayToPlane([0, -10, 0], [0, 0, 0], XZ)).toBeNull();
    expect(rayToPlane([Number.NaN, -10, 0], [0, 1, 0], XZ)).toBeNull();
    expect(rayToPlane([0, -10, 0], [0, Infinity, 0], XZ)).toBeNull();
    expect(rayToPlane([0, -10, 0], [0, 1, 0], { kind: "xz", offset: Number.NaN })).toBeNull();
  });

  it("gives the point the front view's camera sees under the middle of the picture", () => {
    // The camera of the Front preset stands far away on the minus Y side (./camera.ts); a ray from it along
    // its line of sight meets the plane Y = 0 at the point it looks at.
    const bounds: SceneBounds = { min: [0, 0, 0], max: [8, 0, 5], center: [4, 0, 2.5] };
    const camera = placeCamera(bounds, VIEW_DIRECTIONS.front, VIEW_FOV_DEG.front, 960 / 672);
    const direction: Point3 = [
      camera.target[0] - camera.position[0],
      camera.target[1] - camera.position[1],
      camera.target[2] - camera.position[2],
    ];
    const hit = rayToPlane(camera.position, direction, XZ);
    expect(hit?.[0]).toBeCloseTo(4, 9);
    expect(hit?.[1]).toBe(0);
    expect(hit?.[2]).toBeCloseTo(2.5, 9);
    // The top view looks along the vertical plane: no point there, but one on the horizontal plane.
    const top = placeCamera(bounds, VIEW_DIRECTIONS.top, VIEW_FOV_DEG.top, 960 / 672);
    const down: Point3 = [
      top.target[0] - top.position[0],
      top.target[1] - top.position[1],
      top.target[2] - top.position[2],
    ];
    expect(rayToPlane(top.position, down, XZ)).toBeNull();
    expect(rayToPlane(top.position, down, XY)).not.toBeNull();
  });
});

describe("snapValue and snapToPlane", () => {
  it("rounds to the nearest multiple of the step, a half upwards", () => {
    expect(snapValue(1.24, 0.5)).toBe(1);
    expect(snapValue(1.25, 0.5)).toBe(1.5);
    expect(snapValue(1.26, 0.5)).toBe(1.5);
    expect(snapValue(-1.2, 0.5)).toBe(-1);
    expect(snapValue(-1.3, 0.5)).toBe(-1.5);
    expect(snapValue(3.4, 1)).toBe(3);
    expect(snapValue(0.37, 0.25)).toBe(0.25);
    expect(snapValue(0.38, 0.25)).toBe(0.5);
  });

  it("gives clean decimals for the step 0.1 and never a negative zero", () => {
    expect(snapValue(0.29, 0.1)).toBe(0.3);
    expect(snapValue(0.71, 0.1)).toBe(0.7);
    expect(snapValue(12.34, 0.1)).toBe(12.3);
    expect(Object.is(snapValue(-0.01, 0.1), 0)).toBe(true);
    expect(Object.is(snapValue(-0.2, 0.5), 0)).toBe(true);
    for (const step of SNAP_STEPS) {
      for (let i = -40; i <= 40; i += 1) {
        const exact = Number((i * step).toFixed(4)) + 0;
        expect(snapValue(i * step + step * 0.3, step)).toBe(exact);
        expect(snapValue(i * step - step * 0.3, step)).toBe(exact);
      }
    }
  });

  it("snaps the two coordinates in the plane and keeps the plane's offset", () => {
    expect(snapToPlane([1.26, 0.3333, 2.74], { kind: "xz", offset: 0.3333 }, 0.5)).toEqual([
      1.5, 0.3333, 2.5,
    ]);
    expect(snapToPlane([1.26, 7.9, 2.74], { kind: "xz", offset: 0 }, 0.5)).toEqual([1.5, 0, 2.5]);
    expect(snapToPlane([1.26, 2.74, 9], { kind: "xy", offset: 1.2 }, 0.25)).toEqual([
      1.25, 2.75, 1.2,
    ]);
  });

  it("planeThrough keeps the kind and takes the point's coordinate along the normal", () => {
    expect(planeThrough(XZ, [1, 2, 3])).toEqual({ kind: "xz", offset: 2 });
    expect(planeThrough({ kind: "xy" }, [1, 2, 3])).toEqual({ kind: "xy", offset: 3 });
  });
});

describe("nodeAt and pickNodeOnScreen", () => {
  it("nodeAt finds the node at a point and nothing beside it", () => {
    const model = portalFrame();
    expect(nodeAt(model, [0, 0, 4])).toBe("n2");
    expect(nodeAt(model, [6, 0, 0])).toBe("n4");
    expect(nodeAt(model, [0, 0, 4 + 1e-9])).toBe("n2");
    expect(nodeAt(model, [0, 0, 4.001])).toBeNull();
    expect(nodeAt(model, [0, 0.5, 4])).toBeNull();
    expect(nodeAt(emptyModel(), [0, 0, 0])).toBeNull();
  });

  it("pickNodeOnScreen takes the nearest node within the radius", () => {
    const nodes = [
      { id: "a", x: 100, y: 100 },
      { id: "b", x: 110, y: 100 },
      { id: "c", x: 300, y: 300 },
    ];
    expect(pickNodeOnScreen(nodes, { x: 102, y: 101 }, 9)).toBe("a");
    expect(pickNodeOnScreen(nodes, { x: 107, y: 100 }, 9)).toBe("b");
    expect(pickNodeOnScreen(nodes, { x: 105, y: 100 }, 9)).toBe("a");
    expect(pickNodeOnScreen(nodes, { x: 100, y: 109 }, 9)).toBe("a");
    expect(pickNodeOnScreen(nodes, { x: 100, y: 109.5 }, 9)).toBeNull();
    expect(pickNodeOnScreen(nodes, { x: 200, y: 200 }, 9)).toBeNull();
    expect(pickNodeOnScreen([], { x: 0, y: 0 })).toBeNull();
  });
});

describe("cursorFor", () => {
  const model = portalFrame();
  const base = { model, plane: XZ, step: 0.5 };

  it("is the snapped point of the plane, with the node that is there", () => {
    expect(cursorFor({ ...base, hit: [2.9, 0, 1.2], pickedNodeId: null })).toEqual({
      point: [3, 0, 1],
      nodeId: null,
    });
    expect(cursorFor({ ...base, hit: [0.1, 0, 3.9], pickedNodeId: null })).toEqual({
      point: [0, 0, 4],
      nodeId: "n2",
    });
  });

  it("is the picked node, also when the node is off the plane or there is no point of the plane", () => {
    const off = { ...model, nodes: [...model.nodes, { id: "n9", x: 1.23, y: 3, z: 0.77 }] };
    expect(cursorFor({ ...base, model: off, hit: [5, 0, 5], pickedNodeId: "n9" })).toEqual({
      point: [1.23, 3, 0.77],
      nodeId: "n9",
    });
    expect(cursorFor({ ...base, hit: null, pickedNodeId: "n3" })).toEqual({
      point: [6, 0, 4],
      nodeId: "n3",
    });
  });

  it("is nothing without a point and a node, and ignores a picked id the model does not hold", () => {
    expect(cursorFor({ ...base, hit: null, pickedNodeId: null })).toBeNull();
    expect(cursorFor({ ...base, hit: null, pickedNodeId: "gone" })).toBeNull();
    expect(cursorFor({ ...base, hit: [1, 0, 1], pickedNodeId: "gone" })).toEqual({
      point: [1, 0, 1],
      nodeId: null,
    });
  });

  it("sameCursor compares the point and the node", () => {
    const a = { point: [1, 0, 2] as Point3, nodeId: null };
    expect(sameCursor(a, { point: [1, 0, 2], nodeId: null })).toBe(true);
    expect(sameCursor(a, { point: [1, 0, 2.5], nodeId: null })).toBe(false);
    expect(sameCursor(a, { point: [1, 0, 2], nodeId: "n1" })).toBe(false);
    expect(sameCursor(a, null)).toBe(false);
    expect(sameCursor(null, null)).toBe(true);
  });
});

describe("the texts", () => {
  it("formatCoordinate and pointText write short numbers", () => {
    expect(formatCoordinate(4)).toBe("4");
    expect(formatCoordinate(0.5)).toBe("0.5");
    expect(formatCoordinate(1.23456)).toBe("1.2346");
    expect(formatCoordinate(-0)).toBe("0");
    expect(formatCoordinate(-0.00001)).toBe("0");
    expect(pointText([0, 0, 4])).toBe("0,0,4");
    expect(pointText([1.5, -2, 0.25])).toBe("1.5,-2,0.25");
  });

  it("parseCoordinate reads a number and refuses anything else", () => {
    expect(parseCoordinate("3")).toBe(3);
    expect(parseCoordinate(" -2.5 ")).toBe(-2.5);
    expect(parseCoordinate("1,25")).toBe(1.25);
    expect(parseCoordinate("1e2")).toBe(100);
    expect(Object.is(parseCoordinate("-0"), 0)).toBe(true);
    expect(parseCoordinate("")).toBeNull();
    expect(parseCoordinate("   ")).toBeNull();
    expect(parseCoordinate("abc")).toBeNull();
    expect(parseCoordinate("1.2.3")).toBeNull();
    expect(parseCoordinate("Infinity")).toBeNull();
    expect(parseCoordinate("NaN")).toBeNull();
  });
});

describe("the drawing area and the grid of the work plane", () => {
  it("emptyModelBounds is 8 m by 5 m on the plane", () => {
    expect(emptyModelBounds(XZ)).toEqual({ min: [0, 0, 0], max: [8, 0, 5], center: [4, 0, 2.5] });
    expect(emptyModelBounds({ kind: "xz", offset: 2 })).toEqual({
      min: [0, 2, 0],
      max: [8, 2, 5],
      center: [4, 2, 2.5],
    });
    expect(emptyModelBounds({ kind: "xy", offset: 3 })).toEqual({
      min: [0, 0, 3],
      max: [8, 5, 3],
      center: [4, 2.5, 3],
    });
  });

  it("drawingBounds is that area for an empty model, and the union with the model's box otherwise", () => {
    const origin: SceneBounds = { min: [0, 0, 0], max: [0, 0, 0], center: [0, 0, 0] };
    expect(drawingBounds(origin, false, XZ)).toEqual(emptyModelBounds(XZ));
    const one: SceneBounds = { min: [1, 0, 1], max: [1, 0, 1], center: [1, 0, 1] };
    expect(drawingBounds(one, true, XZ)).toEqual(emptyModelBounds(XZ));
    const wide: SceneBounds = { min: [-2, -1, 0], max: [12, 3, 4], center: [5, 1, 2] };
    expect(drawingBounds(wide, true, XZ)).toEqual({
      min: [-2, -1, 0],
      max: [12, 3, 5],
      center: [5, 1, 2.5],
    });
  });

  it("workPlaneGrid lies on the plane and covers the bounds", () => {
    for (const plane of [XZ, { kind: "xz", offset: 2 }, { kind: "xy", offset: 3 }] as WorkPlane[]) {
      const bounds = emptyModelBounds(plane);
      const grid = workPlaneGrid(plane, bounds);
      const axis = normalAxis(plane);
      const other = plane.kind === "xz" ? 2 : 1;
      const all = [...grid.minor, ...grid.major, ...grid.corners.flat()];
      expect(all.length % 3).toBe(0);
      const along = [0, 1, 2].map((k) => all.filter((_, index) => index % 3 === k));
      expect(new Set(along[axis])).toEqual(new Set([plane.offset]));
      expect(Math.min(...(along[0] as number[]))).toBeLessThanOrEqual(-2);
      expect(Math.max(...(along[0] as number[]))).toBeGreaterThanOrEqual(10);
      expect(Math.min(...(along[other] as number[]))).toBeLessThanOrEqual(-2);
      expect(Math.max(...(along[other] as number[]))).toBeGreaterThanOrEqual(7);
      // Six numbers per line, and more minor lines than major ones.
      expect(grid.minor.length % 6).toBe(0);
      expect(grid.major.length % 6).toBe(0);
      expect(grid.minor.length).toBeGreaterThan(grid.major.length);
      expect(grid.major.length).toBeGreaterThan(0);
    }
  });
});
