/** Walkway grid with A* pathfinding and line-of-sight smoothing. Pure, unit tested. */

export type Vec2 = [number, number];

export type Obstacle =
  | { kind: "rect"; x1: number; z1: number; x2: number; z2: number }
  | { kind: "circle"; x: number; z: number; r: number }
  | { kind: "arc"; cx: number; cz: number; r1: number; r2: number; a1: number; a2: number };

export interface NavGrid {
  minX: number;
  minZ: number;
  cols: number;
  rows: number;
  cell: number;
  blocked: Uint8Array;
}

export interface GridBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

function hits(ob: Obstacle, x: number, z: number, pad: number): boolean {
  switch (ob.kind) {
    case "rect":
      return x >= ob.x1 - pad && x <= ob.x2 + pad && z >= ob.z1 - pad && z <= ob.z2 + pad;
    case "circle":
      return Math.hypot(x - ob.x, z - ob.z) <= ob.r + pad;
    case "arc": {
      const d = Math.hypot(x - ob.cx, z - ob.cz);
      if (d < ob.r1 - pad || d > ob.r2 + pad) return false;
      // Angle measured from straight back (-z) toward +x, matching the command wall.
      const a = Math.atan2(x - ob.cx, -(z - ob.cz));
      return a >= ob.a1 && a <= ob.a2;
    }
  }
}

export function buildNavGrid(
  bounds: GridBounds,
  obstacles: Obstacle[],
  cell = 0.5,
  agentRadius = 0.32,
): NavGrid {
  const cols = Math.ceil((bounds.maxX - bounds.minX) / cell);
  const rows = Math.ceil((bounds.maxZ - bounds.minZ) / cell);
  const blocked = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = bounds.minX + (c + 0.5) * cell;
      const z = bounds.minZ + (r + 0.5) * cell;
      const edge =
        x < bounds.minX + agentRadius + 0.3 ||
        x > bounds.maxX - agentRadius - 0.3 ||
        z < bounds.minZ + agentRadius + 0.3 ||
        z > bounds.maxZ - agentRadius - 0.3;
      let b = edge;
      if (!b) {
        for (const ob of obstacles) {
          if (hits(ob, x, z, agentRadius)) {
            b = true;
            break;
          }
        }
      }
      blocked[r * cols + c] = b ? 1 : 0;
    }
  }
  return { minX: bounds.minX, minZ: bounds.minZ, cols, rows, cell, blocked };
}

export function toCell(grid: NavGrid, p: Vec2): [number, number] {
  const c = Math.min(grid.cols - 1, Math.max(0, Math.floor((p[0] - grid.minX) / grid.cell)));
  const r = Math.min(grid.rows - 1, Math.max(0, Math.floor((p[1] - grid.minZ) / grid.cell)));
  return [c, r];
}

export function toWorld(grid: NavGrid, c: number, r: number): Vec2 {
  return [grid.minX + (c + 0.5) * grid.cell, grid.minZ + (r + 0.5) * grid.cell];
}

export function isFree(grid: NavGrid, c: number, r: number): boolean {
  if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) return false;
  return grid.blocked[r * grid.cols + c] === 0;
}

export function isFreeAt(grid: NavGrid, p: Vec2): boolean {
  const [c, r] = toCell(grid, p);
  return isFree(grid, c, r);
}

/** Nearest free cell to a cell, searching outward in rings; null if nothing within `radius`. */
export function nearestFree(
  grid: NavGrid,
  c0: number,
  r0: number,
  radius = 6,
): [number, number] | null {
  if (isFree(grid, c0, r0)) return [c0, r0];
  for (let d = 1; d <= radius; d += 1) {
    let best: [number, number] | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let dc = -d; dc <= d; dc += 1) {
      for (let dr = -d; dr <= d; dr += 1) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== d) continue;
        const c = c0 + dc;
        const r = r0 + dr;
        if (!isFree(grid, c, r)) continue;
        const dist = dc * dc + dr * dr;
        if (dist < bestDist) {
          bestDist = dist;
          best = [c, r];
        }
      }
    }
    if (best) return best;
  }
  return null;
}

/** Binary min-heap on f-score. */
class Heap {
  private items: number[] = [];
  private f: Float64Array;
  constructor(f: Float64Array) {
    this.f = f;
  }
  get size(): number {
    return this.items.length;
  }
  push(i: number): void {
    const a = this.items;
    a.push(i);
    let k = a.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      const ak = a[k];
      const ap = a[p];
      if (ak === undefined || ap === undefined) break;
      if ((this.f[ak] ?? 0) >= (this.f[ap] ?? 0)) break;
      a[k] = ap;
      a[p] = ak;
      k = p;
    }
  }
  pop(): number | undefined {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length > 0 && last !== undefined) {
      a[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        const fm = () => this.f[a[m] ?? 0] ?? 0;
        if (l < a.length && (this.f[a[l] ?? 0] ?? 0) < fm()) m = l;
        if (r < a.length && (this.f[a[r] ?? 0] ?? 0) < fm()) m = r;
        if (m === k) break;
        const ak = a[k];
        const am = a[m];
        if (ak === undefined || am === undefined) break;
        a[k] = am;
        a[m] = ak;
        k = m;
      }
    }
    return top;
  }
}

const SQRT2 = Math.SQRT2;

/** A* over 8-connected cells (no corner cutting). Returns world-space waypoints, or null. */
export function findPath(grid: NavGrid, from: Vec2, to: Vec2): Vec2[] | null {
  const [sc0, sr0] = toCell(grid, from);
  const [tc0, tr0] = toCell(grid, to);
  const start = nearestFree(grid, sc0, sr0);
  const goal = nearestFree(grid, tc0, tr0);
  if (!start || !goal) return null;
  const [sc, sr] = start;
  const [tc, tr] = goal;
  const n = grid.cols * grid.rows;
  const g = new Float64Array(n).fill(Number.POSITIVE_INFINITY);
  const f = new Float64Array(n).fill(Number.POSITIVE_INFINITY);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const idx = (c: number, r: number) => r * grid.cols + c;
  const h = (c: number, r: number) => {
    const dx = Math.abs(c - tc);
    const dr = Math.abs(r - tr);
    return Math.max(dx, dr) + (SQRT2 - 1) * Math.min(dx, dr);
  };
  const s = idx(sc, sr);
  const t = idx(tc, tr);
  g[s] = 0;
  f[s] = h(sc, sr);
  const open = new Heap(f);
  open.push(s);
  while (open.size > 0) {
    const cur = open.pop();
    if (cur === undefined) break;
    if (closed[cur]) continue;
    if (cur === t) break;
    closed[cur] = 1;
    const cc = cur % grid.cols;
    const cr = Math.floor(cur / grid.cols);
    for (let dc = -1; dc <= 1; dc += 1) {
      for (let dr = -1; dr <= 1; dr += 1) {
        if (dc === 0 && dr === 0) continue;
        const nc = cc + dc;
        const nr = cr + dr;
        if (!isFree(grid, nc, nr)) continue;
        if (dc !== 0 && dr !== 0 && (!isFree(grid, cc + dc, cr) || !isFree(grid, cc, cr + dr)))
          continue;
        const ni = idx(nc, nr);
        if (closed[ni]) continue;
        const cost = (g[cur] ?? 0) + (dc !== 0 && dr !== 0 ? SQRT2 : 1);
        if (cost < (g[ni] ?? Number.POSITIVE_INFINITY)) {
          g[ni] = cost;
          f[ni] = cost + h(nc, nr);
          came[ni] = cur;
          open.push(ni);
        }
      }
    }
  }
  if (came[t] === -1 && t !== s) return null;
  const cells: Vec2[] = [];
  let cur = t;
  while (cur !== -1) {
    cells.push(toWorld(grid, cur % grid.cols, Math.floor(cur / grid.cols)));
    if (cur === s) break;
    cur = came[cur] ?? -1;
  }
  cells.reverse();
  // Start from the exact position when it is walkable, so there is no hop onto the cell centre.
  if (isFreeAt(grid, from) && cells.length > 0) cells[0] = [from[0], from[1]];
  const path = smoothPath(grid, cells);
  // Walk to the exact requested point when it is free, otherwise to the nearest free cell.
  const last = path[path.length - 1];
  if (isFreeAt(grid, to) && last && Math.hypot(last[0] - to[0], last[1] - to[1]) > 0.05) {
    if (lineOfSight(grid, last, to)) path[path.length - 1] = [to[0], to[1]];
    else path.push([to[0], to[1]]);
  }
  return path;
}

/** True when every cell along the segment is free (supercover sampling). */
export function lineOfSight(grid: NavGrid, a: Vec2, b: Vec2): boolean {
  const steps = Math.max(2, Math.ceil((Math.hypot(b[0] - a[0], b[1] - a[1]) / grid.cell) * 2));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    if (!isFreeAt(grid, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])) return false;
  }
  return true;
}

/** Greedy string-pulling: skip ahead to the farthest waypoint still in line of sight. */
export function smoothPath(grid: NavGrid, path: Vec2[]): Vec2[] {
  if (path.length <= 2) return path.map((p) => [p[0], p[1]]);
  const out: Vec2[] = [];
  const first = path[0];
  if (!first) return [];
  out.push([first[0], first[1]]);
  let i = 0;
  while (i < path.length - 1) {
    let j = path.length - 1;
    const from = path[i];
    if (!from) break;
    while (j > i + 1) {
      const to = path[j];
      if (to && lineOfSight(grid, from, to)) break;
      j -= 1;
    }
    const next = path[j];
    if (!next) break;
    out.push([next[0], next[1]]);
    i = j;
  }
  return out;
}
