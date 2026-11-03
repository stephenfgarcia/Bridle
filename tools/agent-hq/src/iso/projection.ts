/** Classic 2:1 isometric projection. World: x right, y up, z toward the viewer (same as 3D). */

/** Screen pixels per world unit along the iso axes at zoom 1. */
export const ISO_X = 34;
export const ISO_Y = 17;
/** Screen pixels per world unit of height at zoom 1. */
export const ISO_H = 30;

export interface ScreenPoint {
  sx: number;
  sy: number;
}

export interface Camera {
  /** World point (on the floor) shown at the canvas centre. */
  cx: number;
  cz: number;
  zoom: number;
}

/** World to unscaled iso space (zoom 1, origin at world 0,0,0). */
export function project(x: number, y: number, z: number): ScreenPoint {
  return { sx: (x - z) * ISO_X, sy: (x + z) * ISO_Y - y * ISO_H };
}

/** Iso space back to the floor plane (y = 0), or any plane at height `y`. */
export function unproject(sx: number, sy: number, y = 0): { x: number; z: number } {
  const a = sx / ISO_X;
  const b = (sy + y * ISO_H) / ISO_Y;
  return { x: (a + b) / 2, z: (b - a) / 2 };
}

/** Painter's order: larger values are drawn later (closer to the viewer). */
export function depthOf(x: number, z: number): number {
  return x + z;
}

/** World to canvas CSS pixels for a camera and canvas size. */
export function toScreen(
  cam: Camera,
  width: number,
  height: number,
  x: number,
  y: number,
  z: number,
): ScreenPoint {
  const p = project(x, y, z);
  const c = project(cam.cx, 0, cam.cz);
  return { sx: (p.sx - c.sx) * cam.zoom + width / 2, sy: (p.sy - c.sy) * cam.zoom + height / 2 };
}

/** Canvas CSS pixels to the floor plane for a camera and canvas size. */
export function fromScreen(
  cam: Camera,
  width: number,
  height: number,
  sx: number,
  sy: number,
  y = 0,
): { x: number; z: number } {
  const c = project(cam.cx, 0, cam.cz);
  return unproject((sx - width / 2) / cam.zoom + c.sx, (sy - height / 2) / cam.zoom + c.sy, y);
}

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
}

/** The zoom and centre that fit a room's floor and walls into the canvas with a margin. */
export function fitCamera(bounds: Bounds, width: number, height: number, margin = 24): Camera {
  const corners = [
    project(bounds.minX, 0, bounds.minZ),
    project(bounds.maxX, 0, bounds.minZ),
    project(bounds.maxX, 0, bounds.maxZ),
    project(bounds.minX, 0, bounds.maxZ),
    project(bounds.minX, bounds.height, bounds.minZ),
    project(bounds.maxX, bounds.height, bounds.minZ),
    project(bounds.minX, bounds.height, bounds.maxZ),
  ];
  const minSx = Math.min(...corners.map((c) => c.sx));
  const maxSx = Math.max(...corners.map((c) => c.sx));
  const minSy = Math.min(...corners.map((c) => c.sy));
  const maxSy = Math.max(...corners.map((c) => c.sy));
  const zoom = Math.min(
    (width - margin * 2) / (maxSx - minSx),
    (height - margin * 2) / (maxSy - minSy),
  );
  const centre = unproject((minSx + maxSx) / 2, (minSy + maxSy) / 2);
  return { cx: centre.x, cz: centre.z, zoom };
}

export function clampCamera(cam: Camera, bounds: Bounds, minZoom: number, maxZoom: number): Camera {
  return {
    cx: Math.min(bounds.maxX, Math.max(bounds.minX, cam.cx)),
    cz: Math.min(bounds.maxZ, Math.max(bounds.minZ, cam.cz)),
    zoom: Math.min(maxZoom, Math.max(minZoom, cam.zoom)),
  };
}
