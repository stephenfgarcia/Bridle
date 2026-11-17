/**
 * Where the viewport's camera stands (card PX-02.2). Pure functions with no three.js import (./scene.test.ts);
 * ViewportCanvas.tsx applies their output to the three.js camera and the orbit controls.
 *
 * This file is the one place that says which way is up: `SCENE_UP`. three.js takes Y for up by default; the
 * canvas gives `SCENE_UP` to its camera, the orbit controls read it from the camera, the placement below is
 * computed with it, and the grid is built on the plane Z = 0 (./scene.ts, `gridLines`).
 */
import type { Point3, SceneBounds } from "./scene";

/** The model's Z axis is up on screen. */
export const SCENE_UP: Point3 = [0, 0, 1];

export type ViewPreset = "3d" | "front" | "top";

/**
 * The vertical field of view of the camera in each preset, in degrees. There is one perspective camera. In the
 * front and top presets its field of view is half a degree and it stands far away, so that the picture is close
 * to a parallel projection: a column seen from the top covers its base to within a few pixels, and it would not
 * with a wide field of view. Orbiting keeps the field of view of the last preset.
 */
export const VIEW_FOV_DEG: Record<ViewPreset, number> = { "3d": 40, front: 0.5, top: 0.5 };

function unit(v: Point3): Point3 {
  const n = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / n, v[1] / n, v[2] / n];
}

function dot(a: Point3, b: Point3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Point3, b: Point3): Point3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/**
 * For each preset, the unit vector from the point looked at to the camera.
 * - `3d`: from the front right and above, so +X runs to the right and +Z up.
 * - `front`: the camera stands on the minus Y side and looks along +Y at the X-Z plane (+X right, +Z up).
 * - `top`: the camera looks down the Z axis (+X right, +Y up). It leans one thousandth towards minus Y:
 *   exactly along Z, the view direction would be parallel to `SCENE_UP` and the screen's up undefined.
 */
export const VIEW_DIRECTIONS: Record<ViewPreset, Point3> = {
  "3d": unit([0.55, -1, 0.45]),
  front: [0, -1, 0],
  top: unit([0, -0.001, 1]),
};

/** Free room around the fitted model: the distance is the tight one times this. */
export const FIT_MARGIN = 1.35;

/** The smallest distance `placeCamera` returns, in m (a model of one node has no extent to fit). */
export const MIN_FIT_DISTANCE = 4;

export interface CameraPlacement {
  position: Point3;
  target: Point3;
  distance: number;
}

/**
 * The camera's right and up vectors when it looks against `direction` (from the camera to the target) with
 * `SCENE_UP` up. When `direction` is parallel to `SCENE_UP`, right is +X.
 */
export function viewBasis(direction: Point3): { right: Point3; up: Point3 } {
  const d = unit(direction);
  const forward: Point3 = [-d[0], -d[1], -d[2]];
  const side = cross(forward, SCENE_UP);
  const right: Point3 = Math.hypot(side[0], side[1], side[2]) < 1e-9 ? [1, 0, 0] : unit(side);
  const up = cross(right, forward);
  // `+ 0` turns a negative zero into zero.
  return {
    right: [right[0] + 0, right[1] + 0, right[2] + 0],
    up: [up[0] + 0, up[1] + 0, up[2] + 0],
  };
}

/**
 * The placement of a perspective camera that frames the whole box `bounds`: it looks at the centre of the box
 * from `direction` (the vector from that centre to the camera, any length), far enough for the eight corners
 * to be inside the vertical field of view `fovDeg` and the horizontal one that `aspect` (width / height)
 * gives, times `FIT_MARGIN`, and never nearer than `MIN_FIT_DISTANCE`.
 */
export function placeCamera(
  bounds: SceneBounds,
  direction: Point3,
  fovDeg: number,
  aspect: number,
): CameraPlacement {
  const d = unit(direction);
  const { right, up } = viewBasis(d);
  const tanV = Math.tan((fovDeg * Math.PI) / 360);
  const tanH = tanV * aspect;
  let distance = 0;
  for (const x of [bounds.min[0], bounds.max[0]]) {
    for (const y of [bounds.min[1], bounds.max[1]]) {
      for (const z of [bounds.min[2], bounds.max[2]]) {
        const rel: Point3 = [x - bounds.center[0], y - bounds.center[1], z - bounds.center[2]];
        const towards = dot(rel, d);
        distance = Math.max(
          distance,
          towards + Math.abs(dot(rel, up)) / tanV,
          towards + Math.abs(dot(rel, right)) / tanH,
        );
      }
    }
  }
  distance = Math.max(distance * FIT_MARGIN, MIN_FIT_DISTANCE);
  return {
    position: [
      bounds.center[0] + d[0] * distance,
      bounds.center[1] + d[1] * distance,
      bounds.center[2] + d[2] * distance,
    ],
    target: bounds.center,
    distance,
  };
}
