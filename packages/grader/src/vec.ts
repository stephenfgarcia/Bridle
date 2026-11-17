/** Small vector helpers for positions and loads in global axes. */
import type { Vec3 } from "@bridle/model";

export const ZERO: Vec3 = { x: 0, y: 0, z: 0 };

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(a: Vec3, k: number): Vec3 {
  return { x: a.x * k, y: a.y * k, z: a.z * k };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

export function norm(a: Vec3): number {
  return Math.hypot(a.x, a.y, a.z);
}

/** Ids in the order of their UTF-16 code units, the same on every machine. */
export function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The first entry of each id; a later entry with a repeated id is ignored. */
export function firstById<T extends { id: string }>(list: readonly T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of list) {
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  }
  return map;
}
