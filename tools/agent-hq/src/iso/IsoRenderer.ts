/**
 * Draws the office with Canvas 2D in classic 2:1 isometric: static backdrop (skyline, floor,
 * walls, neon), then every furniture piece and robot depth-sorted by x+z (painter's algorithm).
 * Text lives in the HTML overlay (see IsoOffice); this file only draws shapes.
 */
import type { Agent } from "../data/types";
import { STATUS_META } from "../lib/status";
import {
  CAFE,
  CAFE_SEATS,
  CAFE_TABLES,
  PLANTS,
  POD_CHAIR,
  type Pod,
  ROOM,
  SOFA_CORNER,
  WATER_COOLER,
} from "../three/layout";
import { C, mulberry32 } from "../three/palette";
import type { RobotPose } from "../three/sim/brain";
import type { WaitPair } from "../three/sim/crowd";
import { type Camera, depthOf, ISO_H, ISO_X, ISO_Y, project, type ScreenPoint } from "./projection";

export interface FrameInput {
  agents: Agent[];
  poses: Map<string, RobotPose>;
  pods: Pod[];
  waitPairs: WaitPair[];
  selectedId: string | null;
  time: number;
  reduced: boolean;
}

interface Drawable {
  depth: number;
  draw: () => void;
}

/** Arc of the command wall: centre, radius, half-span (radians from straight back). */
export const ARC: { cx: number; cz: number; r: number; span: number } = {
  cx: 0,
  cz: -5.2,
  r: 9,
  span: Math.PI / 3,
};
export const GLOBE: { x: number; y: number; z: number } = { x: 0, y: 2.9, z: -9.6 };

export function arcPoint(angle: number, radius = ARC.r): { x: number; z: number } {
  return { x: ARC.cx + Math.sin(angle) * radius, z: ARC.cz - Math.cos(angle) * radius };
}

const SQ2 = Math.SQRT2;

interface Building {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  lights: { x: number; y: number; z: number; face: "x" | "z"; color: string }[];
}

const LIGHT_COLORS = ["#ffd9a0", "#9fe8ff", "#f4e8ff", "#ffb6e6"];

function skyline(): Building[] {
  const rng = mulberry32(2026);
  const out: Building[] = [];
  // Behind the left wall (x < minX) and behind the back wall (z < minZ).
  for (let k = 0; k < 9; k += 1) {
    const z = ROOM.minZ - 1 + k * 3.6 + rng();
    const w = 2 + rng() * 1.5;
    const d = 2 + rng() * 1.2;
    const x = ROOM.minX - 3.5 - rng() * 1.5 - w;
    out.push({ x, z, w, d, h: 5 + rng() * 9, lights: [] });
  }
  for (let k = 0; k < 10; k += 1) {
    const x = ROOM.minX - 1 + k * 3.4 + rng();
    const w = 2 + rng() * 1.5;
    const d = 2 + rng() * 1.2;
    const z = ROOM.minZ - 3.5 - rng() * 1.5 - d;
    out.push({ x, z, w, d, h: 6 + rng() * 10, lights: [] });
  }
  for (const b of out) {
    const rows = Math.floor(b.h / 1.3);
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        if (rng() < 0.45) continue;
        const color = LIGHT_COLORS[Math.floor(rng() * LIGHT_COLORS.length)] ?? "#ffd9a0";
        const y = 0.6 + r * 1.3;
        if (rng() < 0.5)
          b.lights.push({ x: b.x + b.w, y, z: b.z + 0.4 + c * (b.d / 3), face: "x", color });
        else b.lights.push({ x: b.x + 0.4 + c * (b.w / 3), y, z: b.z + b.d, face: "z", color });
      }
    }
  }
  return out;
}

export class IsoRenderer {
  private ctx: CanvasRenderingContext2D;
  private width = 1;
  private height = 1;
  private dpr = 1;
  private readonly buildings = skyline();
  private rotation = 0;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D unavailable");
    this.ctx = ctx;
  }

  resize(width: number, height: number, dpr: number): void {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
  }

  // ---------- primitives (iso space; the canvas transform applies zoom and pan) ----------

  private poly(
    points: ScreenPoint[],
    fill: string | CanvasGradient,
    stroke?: string,
    lineWidth = 1,
  ): void {
    const ctx = this.ctx;
    const first = points[0];
    if (!first) return;
    ctx.beginPath();
    ctx.moveTo(first.sx, first.sy);
    for (let i = 1; i < points.length; i += 1) {
      const p = points[i];
      if (p) ctx.lineTo(p.sx, p.sy);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  private box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    top: string,
    left: string,
    right: string,
    edge?: string,
  ): void {
    const p = project;
    this.poly(
      [p(x, y, z + d), p(x + w, y, z + d), p(x + w, y + h, z + d), p(x, y + h, z + d)],
      left,
    );
    this.poly(
      [p(x + w, y, z), p(x + w, y, z + d), p(x + w, y + h, z + d), p(x + w, y + h, z)],
      right,
    );
    this.poly(
      [p(x, y + h, z), p(x + w, y + h, z), p(x + w, y + h, z + d), p(x, y + h, z + d)],
      top,
      edge,
      0.6,
    );
  }

  private ellipse(
    sx: number,
    sy: number,
    rx: number,
    ry: number,
    fill: string | CanvasGradient,
    stroke?: string,
    lw = 1,
  ): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.ellipse(sx, sy, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  }

  /** A vertical cylinder standing on the floor plane at (x, z). */
  private cylinder(
    x: number,
    y: number,
    z: number,
    r: number,
    h: number,
    side: string,
    top: string,
    stroke?: string,
  ): void {
    const ctx = this.ctx;
    const b = project(x, y, z);
    const t = project(x, y + h, z);
    const rx = r * SQ2 * ISO_X;
    const ry = r * SQ2 * ISO_Y;
    ctx.beginPath();
    ctx.moveTo(b.sx - rx, b.sy);
    ctx.lineTo(t.sx - rx, t.sy);
    ctx.lineTo(t.sx + rx, t.sy);
    ctx.lineTo(b.sx + rx, b.sy);
    ctx.ellipse(b.sx, b.sy, rx, ry, 0, 0, Math.PI, false);
    ctx.closePath();
    ctx.fillStyle = side;
    ctx.fill();
    this.ellipse(t.sx, t.sy, rx, ry, top, stroke, 0.6);
  }

  private glow(
    sx: number,
    sy: number,
    radius: number,
    color: string,
    alpha: number,
    ry = radius,
  ): void {
    const ctx = this.ctx;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
    g.addColorStop(0, hexAlpha(color, alpha));
    g.addColorStop(1, hexAlpha(color, 0));
    ctx.save();
    ctx.scale(1, ry / radius);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, (sy * radius) / ry, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private floorShadow(x: number, z: number, r: number, alpha = 0.5, rz = r): void {
    const p = project(x, 0, z);
    this.glow(p.sx, p.sy, r * SQ2 * ISO_X, "#000000", alpha, rz * SQ2 * ISO_Y);
  }

  private line(
    a: ScreenPoint,
    b: ScreenPoint,
    color: string,
    width: number,
    dash?: number[],
  ): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash ?? []);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private neon(a: ScreenPoint, b: ScreenPoint, color: string, width = 2): void {
    this.line(a, b, hexAlpha(color, 0.18), width * 5);
    this.line(a, b, hexAlpha(color, 0.5), width * 2.2);
    this.line(a, b, color, width);
  }

  // ---------- frame ----------

  render(cam: Camera, input: FrameInput): void {
    const ctx = this.ctx;
    const { width, height, dpr } = this;
    const c = project(cam.cx, 0, cam.cz);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, width * dpr, height * dpr);
    ctx.setTransform(
      dpr * cam.zoom,
      0,
      0,
      dpr * cam.zoom,
      dpr * (width / 2 - c.sx * cam.zoom),
      dpr * (height / 2 - c.sy * cam.zoom),
    );
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    if (!input.reduced) this.rotation = input.time * 0.25;
    this.drawSkyline();
    this.drawFloor(input);
    this.drawWalls();
    this.drawWaitLines(input.waitPairs);

    const items: Drawable[] = [];
    this.collectCommandWall(items);
    this.collectCafeteria(items);
    this.collectProps(items);
    input.pods.forEach((pod, i) => {
      const agent = input.agents[i];
      if (agent) this.collectPod(items, pod, agent, input.time);
    });
    for (const agent of input.agents) {
      const pose = input.poses.get(agent.id);
      if (pose) this.collectRobot(items, agent, pose, agent.id === input.selectedId, input.time);
    }
    items.sort((a, b) => a.depth - b.depth);
    for (const item of items) item.draw();
    this.drawHaze(input);
  }

  private drawSkyline(): void {
    const moon = project(ROOM.minX - 14, 14, ROOM.minZ - 10);
    this.glow(moon.sx, moon.sy, 160, "#a78bfa", 0.22);
    this.ellipse(moon.sx, moon.sy, 36, 36, "#efe6ff");
    for (const b of this.buildings) {
      this.box(b.x, 0, b.z, b.w, b.h, b.d, "#14112a", "#0d0a1c", "#0a0816");
      for (const l of b.lights) {
        const p = project(l.x, l.y, l.z);
        this.ctx.fillStyle = l.color;
        if (l.face === "x") this.ctx.fillRect(p.sx - 1, p.sy - 6, 5, 8);
        else this.ctx.fillRect(p.sx - 4, p.sy - 6, 5, 8);
      }
    }
    const haze = project(ROOM.minX - 6, 2, ROOM.minZ - 6);
    this.glow(haze.sx, haze.sy, 900, C.magenta, 0.06, 300);
  }

  private drawFloor(input: FrameInput): void {
    const ctx = this.ctx;
    const p = project;
    const a = p(ROOM.minX, 0, ROOM.minZ);
    const b = p(ROOM.maxX, 0, ROOM.minZ);
    const cpt = p(ROOM.maxX, 0, ROOM.maxZ);
    const d = p(ROOM.minX, 0, ROOM.maxZ);
    const g = ctx.createLinearGradient(a.sx, a.sy, cpt.sx, cpt.sy);
    g.addColorStop(0, "#16122f");
    g.addColorStop(0.5, "#0f0c20");
    g.addColorStop(1, "#0a0816");
    this.poly([a, b, cpt, d], g);
    // cafeteria tint
    this.poly(
      [
        p(CAFE.minX, 0, -8),
        p(ROOM.maxX, 0, -8),
        p(ROOM.maxX, 0, ROOM.maxZ),
        p(CAFE.minX, 0, ROOM.maxZ),
      ],
      "rgba(32, 22, 60, 0.45)",
    );
    // grid
    ctx.strokeStyle = "rgba(139, 92, 246, 0.13)";
    ctx.lineWidth = 0.8;
    for (let x = ROOM.minX; x <= ROOM.maxX; x += 2) {
      const s = p(x, 0, ROOM.minZ);
      const e = p(x, 0, ROOM.maxZ);
      ctx.beginPath();
      ctx.moveTo(s.sx, s.sy);
      ctx.lineTo(e.sx, e.sy);
      ctx.stroke();
    }
    for (let z = ROOM.minZ; z <= ROOM.maxZ; z += 2) {
      const s = p(ROOM.minX, 0, z);
      const e = p(ROOM.maxX, 0, z);
      ctx.beginPath();
      ctx.moveTo(s.sx, s.sy);
      ctx.lineTo(e.sx, e.sy);
      ctx.stroke();
    }
    // walkways
    const walk = (x1: number, z1: number, x2: number, z2: number) =>
      this.poly(
        [p(x1, 0.01, z1), p(x2, 0.01, z1), p(x2, 0.01, z2), p(x1, 0.01, z2)],
        "rgba(60, 48, 110, 0.35)",
        "rgba(139, 92, 246, 0.35)",
        0.8,
      );
    walk(-15, -9.3, 15.5, -7.9);
    walk(8.2, -9.3, 9.6, 15.5);
    walk(-15, 14.4, 9.6, 15.6);
    // rugs and desk shadows
    input.pods.forEach((pod, i) => {
      const agent = input.agents[i];
      if (!agent) return;
      const [px, , pz] = pod.position;
      this.poly(
        [
          p(px - 1.45, 0.012, pz - 1.45),
          p(px + 2.05, 0.012, pz - 1.45),
          p(px + 2.05, 0.012, pz + 1.95),
          p(px - 1.45, 0.012, pz + 1.95),
        ],
        hexAlpha(agent.color, 0.22),
      );
      this.floorShadow(px + 0.15, pz + 0.35, 1.6, 0.4, 1.1);
    });
    // sofa corner rug
    this.poly(
      [
        p(SOFA_CORNER[0] - 2.3, 0.01, SOFA_CORNER[2] - 2.4),
        p(SOFA_CORNER[0] + 2.3, 0.01, SOFA_CORNER[2] - 2.4),
        p(SOFA_CORNER[0] + 2.3, 0.01, SOFA_CORNER[2] + 1.6),
        p(SOFA_CORNER[0] - 2.3, 0.01, SOFA_CORNER[2] + 1.6),
      ],
      "rgba(139, 92, 246, 0.14)",
    );
  }

  private drawWalls(): void {
    const p = project;
    const H = ROOM.height;
    // back wall (z = minZ) and left wall (x = minX) as glass with mullions
    const pane = (pts: ScreenPoint[]) =>
      this.poly(pts, "rgba(109, 91, 208, 0.12)", "rgba(28, 25, 48, 0.9)", 1.2);
    pane([
      p(ROOM.minX, 0, ROOM.minZ),
      p(ROOM.minX, 0, ROOM.maxZ),
      p(ROOM.minX, H, ROOM.maxZ),
      p(ROOM.minX, H, ROOM.minZ),
    ]);
    pane([
      p(ROOM.minX, 0, ROOM.minZ),
      p(ROOM.maxX, 0, ROOM.minZ),
      p(ROOM.maxX, H, ROOM.minZ),
      p(ROOM.minX, H, ROOM.minZ),
    ]);
    // solid band behind the command wall
    this.poly(
      [p(-9.6, 0, ROOM.minZ), p(9.6, 0, ROOM.minZ), p(9.6, H, ROOM.minZ), p(-9.6, H, ROOM.minZ)],
      "#120f22",
    );
    for (let z = ROOM.minZ; z <= ROOM.maxZ; z += 3)
      this.line(p(ROOM.minX, 0, z), p(ROOM.minX, H, z), "#1c1930", 1.4);
    for (let x = ROOM.minX; x <= ROOM.maxX; x += 3) {
      if (x > -9.6 && x < 9.6) continue;
      this.line(p(x, 0, ROOM.minZ), p(x, H, ROOM.minZ), "#1c1930", 1.4);
    }
    this.neon(p(ROOM.minX, H, ROOM.minZ), p(ROOM.minX, H, ROOM.maxZ), C.violet, 1.2);
    this.neon(p(ROOM.minX, H, ROOM.minZ), p(ROOM.maxX, H, ROOM.minZ), C.violet, 1.2);
    // ceiling strips
    this.neon(p(-14, 5.9, -11.5), p(14, 5.9, -11.5), C.magenta, 1.4);
    this.neon(p(-14, 5.9, -2.5), p(8, 5.9, -2.5), C.violet, 1.4);
    this.neon(p(-14, 5.9, 5.5), p(8, 5.9, 5.5), C.emerald, 1.4);
    this.neon(p(-14, 5.9, 13.5), p(8, 5.9, 13.5), C.magenta, 1.4);
    this.neon(p(8.9, 5.9, -11.5), p(8.9, 5.9, 15), C.violet, 1.4);
  }

  private drawWaitLines(pairs: WaitPair[]): void {
    for (const pair of pairs) {
      const a = project(pair.from.x, 0.05, pair.from.z);
      const b = project(pair.to.x, 0.05, pair.to.z);
      this.line(a, b, hexAlpha(C.amber, 0.2), 6);
      this.line(a, b, C.amber, 1.6, [7, 6]);
    }
  }

  private drawHaze(input: FrameInput): void {
    const ctx = this.ctx;
    const t = input.reduced ? 0 : input.time;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const puffs: [number, number, string, number][] = [
      [-6 + Math.sin(t * 0.05) * 2, -4 + Math.cos(t * 0.04) * 1.5, "#5b4b9a", 0],
      [6 + Math.sin(t * 0.045 + 2) * 2, 5 + Math.cos(t * 0.05 + 1) * 1.5, "#6b2d7a", 1],
      [-9 + Math.sin(t * 0.04 + 4) * 2, 10 + Math.cos(t * 0.06 + 3) * 1.5, "#3b3a8a", 2],
    ];
    for (const [x, z, color] of puffs) {
      const s = project(x, 2.5, z);
      this.glow(s.sx, s.sy, 420, color, 0.05, 220);
    }
    ctx.restore();
  }

  // ---------- sorted items ----------

  private collectCommandWall(items: Drawable[]): void {
    const segs = 26;
    for (let i = 0; i < segs; i += 1) {
      const a0 = -ARC.span + (i / segs) * ARC.span * 2;
      const a1 = -ARC.span + ((i + 1) / segs) * ARC.span * 2;
      const p0 = arcPoint(a0);
      const p1 = arcPoint(a1);
      const mid = arcPoint((a0 + a1) / 2);
      items.push({
        depth: depthOf(mid.x, mid.z) - 0.5,
        draw: () => {
          this.poly(
            [
              project(p0.x, 0.9, p0.z),
              project(p1.x, 0.9, p1.z),
              project(p1.x, 5.9, p1.z),
              project(p0.x, 5.9, p0.z),
            ],
            i % 2 ? "#110e22" : "#130f27",
          );
          this.neon(project(p0.x, 0.9, p0.z), project(p1.x, 0.9, p1.z), C.magenta, 1.2);
          this.neon(project(p0.x, 5.9, p0.z), project(p1.x, 5.9, p1.z), C.violet, 1.2);
          if (i % 2 === 0 && i > 1 && i < segs - 2) {
            const q0 = arcPoint(a0 + 0.015, ARC.r - 0.08);
            const q1 = arcPoint(a1 - 0.015, ARC.r - 0.08);
            const colors = [C.magenta, C.violet, C.emerald];
            this.poly(
              [
                project(q0.x, 4.95, q0.z),
                project(q1.x, 4.95, q1.z),
                project(q1.x, 5.45, q1.z),
                project(q0.x, 5.45, q0.z),
              ],
              hexAlpha(colors[(i / 2) % 3] ?? C.violet, 0.7),
            );
          }
        },
      });
    }
    // console + globe
    items.push({
      depth: depthOf(GLOBE.x, GLOBE.z),
      draw: () => {
        const base = project(GLOBE.x, 0, GLOBE.z);
        this.floorShadow(GLOBE.x, GLOBE.z, 1.6, 0.45);
        this.glow(base.sx, base.sy, 70, C.magenta, 0.25, 35);
        this.cylinder(GLOBE.x, 0, GLOBE.z, 1.4, 0.4, "#15121f", "#1a1728", "#3a3452");
        const ring = project(GLOBE.x, 0.42, GLOBE.z);
        this.ellipse(
          ring.sx,
          ring.sy,
          1.1 * SQ2 * ISO_X,
          1.1 * SQ2 * ISO_Y,
          "rgba(0,0,0,0)",
          C.magenta,
          2.2,
        );
        this.cylinder(GLOBE.x, 0.4, GLOBE.z, 0.32, 1.2, "#1c1830", "#201c33");
        const top = project(GLOBE.x, 1.6, GLOBE.z);
        const g = project(GLOBE.x, GLOBE.y, GLOBE.z);
        const gr = ctx2(this.ctx).createLinearGradient(top.sx, top.sy, g.sx, g.sy);
        gr.addColorStop(0, hexAlpha(C.violet, 0.28));
        gr.addColorStop(1, hexAlpha(C.violet, 0));
        this.poly(
          [
            { sx: top.sx - 14, sy: top.sy },
            { sx: top.sx + 14, sy: top.sy },
            { sx: g.sx + 34, sy: g.sy },
            { sx: g.sx - 34, sy: g.sy },
          ],
          gr,
        );
        const r = 1.05 * ISO_H * 1.15;
        this.glow(g.sx, g.sy, r * 2.2, C.violet, 0.3);
        this.ellipse(g.sx, g.sy, r, r, hexAlpha(C.violet, 0.16), hexAlpha("#c4b5fd", 0.85), 1.4);
        const ctx = this.ctx;
        ctx.strokeStyle = hexAlpha("#e9d5ff", 0.5);
        ctx.lineWidth = 0.9;
        for (let k = 0; k < 4; k += 1) {
          const phase = this.rotation + (k * Math.PI) / 4;
          const rx = Math.abs(Math.cos(phase)) * r;
          ctx.beginPath();
          ctx.ellipse(g.sx, g.sy, Math.max(0.5, rx), r, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        for (const lat of [-0.5, 0, 0.5]) {
          ctx.beginPath();
          ctx.ellipse(
            g.sx,
            g.sy - lat * r,
            r * Math.sqrt(1 - lat * lat),
            r * 0.22,
            0,
            0,
            Math.PI * 2,
          );
          ctx.stroke();
        }
        const ox = Math.cos(this.rotation * 2.4) * r * 1.2;
        this.ellipse(g.sx + ox, g.sy + 4, 3, 3, C.emerald);
        this.ellipse(g.sx - ox * 0.8, g.sy - 10, 2.5, 2.5, C.magenta);
      },
    });
  }

  private collectCafeteria(items: Drawable[]): void {
    const push = (x: number, z: number, draw: () => void, bias = 0) =>
      items.push({ depth: depthOf(x, z) + bias, draw });
    // counter
    push(15.6, -1.1, () => {
      this.box(14.4, 0, -7.3, 1.2, 1.0, 6.2, "#2a2638", "#1a1728", "#15131f", "#3b3650");
      this.box(14.35, 0.98, -7.35, 1.3, 0.08, 6.3, "#b7bfcd", "#7c8597", "#6b7384");
      this.neon(project(14.4, 0.14, -1.1), project(14.4, 0.14, -7.3), C.magenta, 1);
      // coffee machine
      this.box(14.7, 1.06, -6.9, 0.55, 0.64, 0.5, "#2a2740", "#1d1b2a", "#15131f");
      const led = project(14.72, 1.5, -6.6);
      this.glow(led.sx, led.sy, 9, C.emerald, 0.8);
      // snack display
      this.box(14.5, 1.06, -4.6, 1.0, 0.04, 0.6, "#3b3650", "#2a2638", "#201c33");
      this.poly(
        [
          project(14.5, 1.1, -4.0),
          project(15.5, 1.1, -4.0),
          project(15.5, 1.62, -4.0),
          project(14.5, 1.62, -4.0),
        ],
        "rgba(196, 181, 253, 0.16)",
        "rgba(196, 181, 253, 0.5)",
        0.8,
      );
      const snacks = ["#f472b6", "#ffb020", "#fde047", "#19f5a1", "#fb923c", "#a78bfa"];
      snacks.forEach((color, i) => {
        const s = project(14.65 + (i % 3) * 0.32, 1.2, -4.5 + (i < 3 ? 0 : 0.25));
        this.ellipse(s.sx, s.sy, 4, 3, color);
      });
      // lamp
      this.cylinder(14.9, 1.06, -2.2, 0.06, 1.0, "#2a2a3a", "#3a3a54");
      const bulb = project(14.9, 2.0, -2.2);
      this.glow(bulb.sx, bulb.sy, 60, C.amber, 0.45);
      this.poly(
        [
          { sx: bulb.sx - 12, sy: bulb.sy },
          { sx: bulb.sx + 12, sy: bulb.sy },
          { sx: bulb.sx + 4, sy: bulb.sy - 12 },
          { sx: bulb.sx - 4, sy: bulb.sy - 12 },
        ],
        "#2a2a3a",
      );
    });
    // fridge
    push(15.6, 1.4, () => {
      const face = project(14.6, 1.0, 0.9);
      this.glow(face.sx - 20, face.sy, 70, "#22d3ee", 0.35, 45);
      this.box(14.6, 0, 0.5, 1.0, 2.0, 0.8, "#2a2740", "#22d3ee", "#15131f");
      this.poly(
        [
          project(14.6, 0.15, 0.55),
          project(14.6, 0.15, 1.25),
          project(14.6, 1.9, 1.25),
          project(14.6, 1.9, 0.55),
        ],
        "rgba(34, 211, 238, 0.28)",
        "rgba(159, 232, 255, 0.6)",
        0.8,
      );
      const bottles = ["#22d3ee", "#19f5a1", "#ff2bd6", "#ffb020", "#8b5cf6", "#f472b6"];
      bottles.forEach((color, i) => {
        const s = project(14.62, i < 3 ? 1.35 : 0.75, 0.62 + (i % 3) * 0.22);
        this.ctx.fillStyle = color;
        this.ctx.fillRect(s.sx - 2, s.sy - 8, 4, 9);
      });
    });
    // tables and stools
    for (const t of CAFE_TABLES) {
      push(
        t[0],
        t[2],
        () => {
          this.floorShadow(t[0], t[2], 1.0, 0.45);
          this.cylinder(t[0], 0, t[2], 0.42, 0.06, "#1a1a26", "#23222f");
          this.cylinder(t[0], 0.06, t[2], 0.07, 0.7, "#2a2a3a", "#3a3a54");
          this.cylinder(t[0], 0.73, t[2], 0.72, 0.06, "#2a2638", "#4a4466", "#5b5577");
        },
        -0.4,
      );
    }
    for (const s of CAFE_SEATS) {
      push(
        s.position[0],
        s.position[2],
        () => {
          this.cylinder(s.position[0], 0, s.position[2], 0.2, 0.04, "#15151f", "#1a1a26");
          this.cylinder(s.position[0], 0.04, s.position[2], 0.04, 0.42, "#2a2a3a", "#3a3a54");
          this.cylinder(
            s.position[0],
            0.44,
            s.position[2],
            0.24,
            0.07,
            "#15151f",
            "#1b1a28",
            "#2a2940",
          );
        },
        -0.6,
      );
    }
    // sofa corner
    const [sx, , sz] = SOFA_CORNER;
    push(sx + 1.3, sz + 1.5, () => {
      this.floorShadow(sx, sz + 1.0, 1.4, 0.4, 0.6);
      this.box(sx - 1.3, 0, sz + 0.55, 2.6, 0.5, 0.95, "#4c3a85", "#3b2a6b", "#2f2258");
      this.box(sx - 1.3, 0.5, sz + 0.5, 2.6, 0.6, 0.26, "#4c3a85", "#3b2a6b", "#2f2258");
      for (const cx of [-0.85, 0, 0.85])
        this.box(sx + cx - 0.38, 0.5, sz + 0.65, 0.76, 0.12, 0.78, "#5a4799", "#4c3a85", "#3b2a6b");
      this.cylinder(sx, 0, sz - 1.2, 0.5, 0.42, "#2a2638", "#3b3650", "#4a4466");
      this.cylinder(sx, 0.42, sz - 1.2, 0.07, 0.12, "#f4f2ff", "#ffffff");
    });
  }

  private collectProps(items: Drawable[]): void {
    for (const plant of PLANTS) {
      const [x, , z] = plant.position;
      items.push({
        depth: depthOf(x, z),
        draw: () => {
          const s = plant.scale;
          this.floorShadow(x, z, 0.5 * s, 0.4);
          this.cylinder(x, 0, z, 0.26 * s, 0.5 * s, "#2a2638", "#3b3650", "#4a4466");
          const top = project(x, 0.5 * s, z);
          const ctx = this.ctx;
          for (let k = 0; k < 6; k += 1) {
            const a = (k / 6) * Math.PI * 2;
            ctx.save();
            ctx.translate(top.sx + Math.cos(a) * 6 * s, top.sy - 14 * s + Math.sin(a) * 3 * s);
            ctx.rotate(a);
            ctx.beginPath();
            ctx.ellipse(10 * s, 0, 12 * s, 5 * s, 0, 0, Math.PI * 2);
            ctx.fillStyle = k % 2 ? "#1f6b48" : "#2f8a5a";
            ctx.fill();
            ctx.strokeStyle = hexAlpha(C.emerald, 0.35);
            ctx.lineWidth = 0.8;
            ctx.stroke();
            ctx.restore();
          }
        },
      });
    }
    items.push({
      depth: depthOf(WATER_COOLER[0], WATER_COOLER[2]),
      draw: () => {
        const [x, , z] = WATER_COOLER;
        this.floorShadow(x, z, 0.45, 0.4);
        this.box(x - 0.25, 0, z - 0.25, 0.5, 1.0, 0.5, "#3b3650", "#1d1b2a", "#15131f");
        this.cylinder(
          x,
          1.02,
          z,
          0.21,
          0.7,
          "rgba(34, 211, 238, 0.45)",
          "rgba(159, 232, 255, 0.6)",
        );
        const led = project(x, 0.78, z + 0.26);
        this.glow(led.sx, led.sy, 8, C.emerald, 0.9);
      },
    });
  }

  private collectPod(items: Drawable[], pod: Pod, agent: Agent, time: number): void {
    const [px, , pz] = pod.position;
    const accent = agent.color;
    const status = STATUS_META[agent.status].color;
    const screen = agent.status === "done" ? C.white : status;
    const dim = agent.status === "idle";
    const steel: [string, string, string] = ["#b7bfcd", "#7c8597", "#5f677a"];
    const dark: [string, string, string] = ["#3b4252", "#262b36", "#1a1e28"];

    // chair (behind the desk)
    const cz = pz + POD_CHAIR[2];
    items.push({
      depth: depthOf(px, cz) - 0.2,
      draw: () => {
        this.cylinder(px, 0, cz, 0.32, 0.05, "#1a1a26", "#23222f");
        this.cylinder(px, 0.05, cz, 0.05, 0.4, "#2a2a3a", "#3a3a54");
        // back rest: a vertical panel facing +z, behind the seat
        const bz = cz - 0.3;
        this.poly(
          [
            project(px - 0.32, 0.5, bz),
            project(px + 0.32, 0.5, bz),
            project(px + 0.32, 1.65, bz),
            project(px - 0.32, 1.65, bz),
          ],
          "#15151f",
          "#2a2a3a",
          0.8,
        );
        this.line(
          project(px - 0.22, 0.55, bz + 0.01),
          project(px - 0.22, 1.5, bz + 0.01),
          hexAlpha(accent, 0.7),
          1.2,
        );
        this.line(
          project(px + 0.22, 0.55, bz + 0.01),
          project(px + 0.22, 1.5, bz + 0.01),
          hexAlpha(accent, 0.7),
          1.2,
        );
        this.box(px - 0.31, 0.44, cz - 0.3, 0.62, 0.12, 0.6, "#1c1c28", "#15151f", "#111119");
      },
    });

    // desk, monitor, keyboard, return, item (in front of the chair)
    items.push({
      depth: depthOf(px + 1.3, pz + 0.45) + 0.1,
      draw: () => {
        // pedestals
        this.box(px - 1.26, 0, pz - 0.4, 0.42, 0.72, 0.8, dark[0], dark[1], dark[2]);
        // main slab
        this.box(px - 1.3, 0.7, pz - 0.45, 2.6, 0.08, 0.9, steel[0], steel[1], steel[2], "#d5dbe6");
        // LED strip on the front edge
        this.neon(
          project(px - 1.3, 0.71, pz + 0.46),
          project(px + 1.3, 0.71, pz + 0.46),
          accent,
          1.4,
        );
        // monitor glow + panel (facing the viewer)
        const mp = project(px - 0.35, 1.3, pz - 0.08);
        this.glow(mp.sx, mp.sy, 54, screen, dim ? 0.12 : 0.42);
        this.cylinder(px - 0.35, 0.78, pz - 0.08, 0.17, 0.05, "#2b3040", "#3b4252");
        this.line(
          project(px - 0.35, 0.83, pz - 0.08),
          project(px - 0.35, 1.08, pz - 0.08),
          "#2b3040",
          3,
        );
        const mx0 = px - 0.83;
        const mx1 = px + 0.13;
        const mz = pz - 0.08;
        this.poly(
          [
            project(mx0, 1.05, mz),
            project(mx1, 1.05, mz),
            project(mx1, 1.63, mz),
            project(mx0, 1.63, mz),
          ],
          "#0b0b14",
          "#2c2c3e",
          0.8,
        );
        const sg = this.ctx.createLinearGradient(
          project(mx0, 1.6, mz).sx,
          project(mx0, 1.6, mz).sy,
          project(mx0, 1.08, mz).sx,
          project(mx0, 1.08, mz).sy,
        );
        sg.addColorStop(0, hexAlpha(screen, dim ? 0.25 : 0.75));
        sg.addColorStop(1, hexAlpha(screen, dim ? 0.08 : 0.2));
        this.poly(
          [
            project(mx0 + 0.04, 1.09, mz),
            project(mx1 - 0.04, 1.09, mz),
            project(mx1 - 0.04, 1.59, mz),
            project(mx0 + 0.04, 1.59, mz),
          ],
          sg,
        );
        if (agent.status === "working") {
          const widths = [0.42, 0.26, 0.5, 0.34, 0.2, 0.46];
          const offset = (time * 0.18) % 0.45;
          widths.forEach((w, i) => {
            const y = 1.13 + ((i * 0.075 + offset) % 0.45);
            const a = project(mx0 + 0.08, y, mz);
            const b = project(mx0 + 0.08 + w, y, mz);
            this.line(a, b, hexAlpha(accent, 0.85), 1.3);
          });
        }
        // keyboard
        this.box(px - 0.35, 0.78, pz + 0.14, 0.7, 0.03, 0.22, "#1f1f2e", "#15151f", "#111119");
        // return + pedestal + item
        this.box(px + 0.8, 0, pz + 1.1, 0.6, 0.72, 0.5, dark[0], dark[1], dark[2]);
        this.box(px + 0.7, 0.7, pz + 0.2, 0.8, 0.08, 1.5, steel[0], steel[1], steel[2], "#d5dbe6");
        this.drawItem(agent.role, px + 1.1, 0.78, pz + 0.75, accent, screen);
      },
    });
  }

  private drawItem(
    role: string,
    x: number,
    y: number,
    z: number,
    accent: string,
    screen: string,
  ): void {
    const ctx = this.ctx;
    switch (role) {
      case "Researcher":
        [C.violet, C.magenta, C.emerald].forEach((color, i) => {
          this.box(
            x - 0.17,
            y + i * 0.06,
            z - 0.12,
            0.34,
            0.055,
            0.24,
            color,
            shade(color, 0.7),
            shade(color, 0.5),
          );
        });
        break;
      case "Designer": {
        this.box(x - 0.25, y, z - 0.18, 0.5, 0.03, 0.36, "#2a2a3a", "#1b1b28", "#15151f");
        this.poly(
          [
            project(x - 0.21, y + 0.035, z - 0.14),
            project(x + 0.21, y + 0.035, z - 0.14),
            project(x + 0.21, y + 0.035, z + 0.14),
            project(x - 0.21, y + 0.035, z + 0.14),
          ],
          hexAlpha(C.lavender, 0.75),
        );
        break;
      }
      case "Developer": {
        const mp = project(x, y + 0.55, z);
        this.glow(mp.sx, mp.sy, 36, screen, 0.3);
        this.cylinder(x, y, z, 0.15, 0.05, "#2b3040", "#3b4252");
        this.poly(
          [
            project(x, y + 0.27, z - 0.44),
            project(x, y + 0.27, z + 0.44),
            project(x, y + 0.85, z + 0.44),
            project(x, y + 0.85, z - 0.44),
          ],
          "#0b0b14",
          "#2c2c3e",
          0.8,
        );
        this.poly(
          [
            project(x, y + 0.31, z - 0.4),
            project(x, y + 0.31, z + 0.4),
            project(x, y + 0.81, z + 0.4),
            project(x, y + 0.81, z - 0.4),
          ],
          hexAlpha(screen, 0.55),
        );
        break;
      }
      case "Copywriter":
        this.box(x - 0.15, y, z - 0.2, 0.3, 0.04, 0.4, "#f4f2ff", "#cfc9e8", "#b5aed6");
        this.cylinder(x - 0.3, y, z + 0.1, 0.07, 0.14, "#2e2e40", "#3b3b52");
        break;
      case "Orchestrator": {
        this.cylinder(x, y, z, 0.13, 0.05, "#2a2a3a", "#3a3a54");
        this.line(project(x, y + 0.05, z), project(x + 0.22, y + 0.5, z), "#3a3a54", 2);
        const bulb = project(x + 0.24, y + 0.46, z);
        this.glow(bulb.sx, bulb.sy, 34, C.amber, 0.7);
        this.ellipse(bulb.sx, bulb.sy, 3.5, 3.5, C.amber);
        break;
      }
      case "Social Media": {
        this.box(x - 0.07, y, z - 0.06, 0.14, 0.06, 0.12, "#2a2a3a", "#1b1b28", "#15151f");
        const s = project(x, y + 0.2, z);
        ctx.fillStyle = "#0b0b14";
        ctx.fillRect(s.sx - 4, s.sy - 10, 8, 14);
        ctx.fillStyle = accent;
        ctx.fillRect(s.sx - 3, s.sy - 9, 6, 12);
        break;
      }
      case "QA Tester": {
        this.box(x - 0.11, y, z - 0.08, 0.22, 0.12, 0.16, C.emerald, "#1b1b28", "#15151f");
        const m = project(x + 0.28, y + 0.03, z + 0.1);
        this.ellipse(m.sx, m.sy, 5, 4, "rgba(0,0,0,0)", "#9aa3b5", 1.4);
        this.line(m, { sx: m.sx + 7, sy: m.sy + 6 }, "#3a3a54", 1.6);
        break;
      }
      case "Analyst":
        [0.14, 0.26, 0.2, 0.32].forEach((h, i) => {
          const color = i % 2 ? C.violet : C.emerald;
          this.box(
            x - 0.15 + i * 0.1 - 0.035,
            y,
            z - 0.035,
            0.07,
            h,
            0.07,
            color,
            shade(color, 0.7),
            shade(color, 0.5),
          );
        });
        break;
      default:
        this.cylinder(x, y, z, 0.07, 0.14, "#2e2e40", "#3b3b52");
    }
  }

  private collectRobot(
    items: Drawable[],
    agent: Agent,
    pose: RobotPose,
    selected: boolean,
    time: number,
  ): void {
    items.push({
      depth: depthOf(pose.x, pose.z) + 0.05,
      draw: () => this.drawRobot(agent, pose, selected, time),
    });
  }

  private drawRobot(agent: Agent, pose: RobotPose, selected: boolean, time: number): void {
    const ctx = this.ctx;
    const accent = agent.color;
    const visor = agent.status === "done" ? C.white : accent;
    const feet = project(pose.x, 0, pose.z);
    // facing in screen space
    const fx = Math.sin(pose.heading);
    const fz = Math.cos(pose.heading);
    const sdx = (fx - fz) * ISO_X;
    const sdy = (fx + fz) * ISO_Y;
    const len = Math.hypot(sdx, sdy) || 1;
    const ux = sdx / len;
    const uy = sdy / len;
    const side = ux >= 0 ? 1 : -1;
    const walking = pose.speed > 0.05;
    const swing = walking ? Math.sin(pose.walk) : 0;
    const bob =
      (pose.bob + pose.laugh + (walking ? Math.abs(Math.sin(pose.walk)) * 0.035 : 0)) * ISO_H;
    const hipY = (0.92 - 0.42 * pose.seated) * ISO_H;
    const bx = feet.sx;
    const hip = feet.sy - hipY - bob;

    this.floorShadow(pose.x, pose.z, 0.55, 0.5);
    if (selected) {
      this.ellipse(
        feet.sx,
        feet.sy,
        0.7 * SQ2 * ISO_X,
        0.7 * SQ2 * ISO_Y,
        "rgba(0,0,0,0)",
        accent,
        2.2,
      );
    }

    // legs
    const legDx = -uy * 6;
    const legDy = ux * 3;
    ctx.strokeStyle = C.limb;
    ctx.lineCap = "round";
    ctx.lineWidth = 6;
    const drawLeg = (sign: number, phase: number) => {
      const hx = bx + legDx * sign;
      const hy = hip + legDy * sign + 2;
      if (pose.seated > 0.5) {
        const kx = hx + ux * 11;
        const ky = hy + uy * 5 + 2;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(kx, ky);
        ctx.lineTo(kx, ky + 12);
        ctx.stroke();
      } else {
        const sw = swing * phase * 7;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx + ux * sw, feet.sy - bob + uy * sw * 0.5 - legDy * sign * 0.5);
        ctx.stroke();
      }
    };
    drawLeg(-1, 1);
    drawLeg(1, -1);

    // arms: back arm first, body, then front arm
    const shoulderY = hip - 0.68 * ISO_H;
    const armFor = (which: "left" | "right"): { dx: number; dy: number } => {
      const base = { dx: 0, dy: 18 };
      const swingArm = walking ? -swing * (which === "left" ? 1 : -1) * 6 : 0;
      switch (pose.arms) {
        case "type":
          return { dx: ux * 12 + swingArm * 0, dy: 10 + uy * 6 };
        case "lean":
          return { dx: ux * 4, dy: 14 };
        case "headhand":
          return which === "right" ? { dx: ux * 3, dy: -14 } : base;
        case "hold":
          return which === "right"
            ? { dx: ux * 12, dy: 6 + uy * 4 }
            : { dx: ux * swingArm, dy: 18 };
        case "sip":
          return which === "right" ? { dx: ux * 6, dy: -6 } : base;
        case "up":
          return { dx: (which === "left" ? -1 : 1) * 5, dy: -16 };
        default:
          return { dx: ux * swingArm, dy: 18 - Math.abs(swingArm) * 0.3 };
      }
    };
    const backSide = side > 0 ? "left" : "right";
    const frontSide = side > 0 ? "right" : "left";
    const drawArm = (which: "left" | "right", color: string) => {
      const sx = bx + (which === "left" ? -11 : 11);
      const sy = shoulderY + (which === "left" ? -legDy : legDy) * 0.5;
      const a = armFor(which);
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + a.dx, sy + a.dy);
      ctx.stroke();
      this.ellipse(sx + a.dx, sy + a.dy, 3.2, 3.2, C.joint);
      if (which === "right" && pose.carrying) this.drawHeld(pose.carrying, sx + a.dx, sy + a.dy);
    };
    drawArm(backSide, "#2a2a3e");

    // body
    const bodyTop = hip - 0.95 * ISO_H;
    ctx.save();
    if (pose.arms === "lean") ctx.translate(-ux * 3, 0);
    roundRect(ctx, bx - 11, bodyTop, 22, hip - bodyTop + 4, 9);
    ctx.fillStyle = C.robot;
    ctx.fill();
    ctx.strokeStyle = "#3e3e58";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.fillRect(bx - 3 + ux * 4, bodyTop + 12, 6, 3);
    ctx.restore();

    drawArm(frontSide, C.limb);

    // head
    const headY = hip - 1.2 * ISO_H - (pose.seated > 0.5 ? 0 : 0);
    const tilt = pose.arms === "lean" ? Math.sin(time * 0.9) * 2 : pose.nod * 10;
    this.ellipse(bx, headY + tilt, 11, 10, C.robotHead, "#46466a", 1);
    const vx = bx + ux * 5;
    const vy = headY + tilt + 1 + uy * 2;
    this.glow(vx, vy, 16, visor, 0.5);
    roundRect(ctx, vx - 8, vy - 3, 16, 6, 3);
    ctx.fillStyle = visor;
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(vx - 5, vy - 1.5, 3, 2.5);
    ctx.fillRect(vx + 2, vy - 1.5, 3, 2.5);
    this.line({ sx: bx, sy: headY + tilt - 9 }, { sx: bx, sy: headY + tilt - 15 }, C.joint, 1.4);
    this.ellipse(bx, headY + tilt - 16, 2.2, 2.2, accent);

    // status effects above the head
    const fxY = headY - 30;
    if (agent.status === "blocked") {
      const pulse = 1 + Math.sin(time * 4) * 0.12;
      this.glow(bx, fxY, 22 * pulse, C.red, 0.6);
      this.poly(
        [
          { sx: bx, sy: fxY - 8 * pulse },
          { sx: bx + 6 * pulse, sy: fxY },
          { sx: bx, sy: fxY + 8 * pulse },
          { sx: bx - 6 * pulse, sy: fxY },
        ],
        C.red,
      );
    } else if (agent.status === "waiting") {
      const spin = Math.cos(time * 1.6);
      this.glow(bx, fxY, 18, C.amber, 0.45);
      this.poly(
        [
          { sx: bx - 6 * spin, sy: fxY - 8 },
          { sx: bx + 6 * spin, sy: fxY - 8 },
          { sx: bx, sy: fxY },
        ],
        C.amber,
      );
      this.poly(
        [
          { sx: bx - 6 * spin, sy: fxY + 8 },
          { sx: bx + 6 * spin, sy: fxY + 8 },
          { sx: bx, sy: fxY },
        ],
        C.amber,
      );
    } else if (agent.status === "thinking" && pose.seated > 0.9) {
      const tx = bx + 16;
      const ty = headY - 22;
      this.ellipse(bx + 8, headY - 10, 2, 2, C.lavender);
      this.ellipse(bx + 12, headY - 15, 3, 3, C.lavender);
      this.ellipse(tx, ty, 13, 9, hexAlpha(C.lavender, 0.3), C.lavender, 1);
      [-5, 0, 5].forEach((dx, i) => {
        const k = 0.5 + 0.5 * Math.sin(time * 4 + i);
        this.ellipse(tx + dx, ty, 1.6, 1.6, hexAlpha("#ffffff", 0.4 + 0.6 * k));
      });
    }
    if (pose.mode === "celebrate") {
      const k = pose.celebrate;
      ctx.strokeStyle = C.emerald;
      ctx.lineWidth = 2;
      ctx.globalAlpha = Math.max(0, 1 - k);
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        const r0 = 10 + k * 26;
        const r1 = r0 + 7;
        ctx.beginPath();
        ctx.moveTo(bx + Math.cos(a) * r0, headY - 6 + Math.sin(a) * r0);
        ctx.lineTo(bx + Math.cos(a) * r1, headY - 6 + Math.sin(a) * r1);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  private drawHeld(kind: string, hx: number, hy: number): void {
    const ctx = this.ctx;
    switch (kind) {
      case "donut":
        this.ellipse(hx + 2, hy, 5, 3.5, "#f472b6", "#d13f93", 1);
        this.ellipse(hx + 2, hy, 1.6, 1.2, C.robot);
        break;
      case "sandwich":
        this.poly(
          [
            { sx: hx - 4, sy: hy + 3 },
            { sx: hx + 6, sy: hy + 3 },
            { sx: hx + 1, sy: hy - 4 },
          ],
          "#e3b97a",
          C.emerald,
          1,
        );
        break;
      case "juice":
        ctx.fillStyle = "#fb923c";
        ctx.fillRect(hx - 1, hy - 6, 4, 8);
        this.line({ sx: hx + 2, sy: hy - 6 }, { sx: hx + 4, sy: hy - 11 }, "#f4f2ff", 1);
        break;
      default:
        ctx.fillStyle = "#2e2e40";
        ctx.fillRect(hx - 1, hy - 5, 5, 6);
        ctx.strokeStyle = "#4a4a66";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(hx + 4.5, hy - 2, 1.8, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
    }
  }
}

function ctx2(ctx: CanvasRenderingContext2D): CanvasRenderingContext2D {
  return ctx;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** "#rrggbb" plus alpha to an rgba() string; passes other colour strings through. */
export function hexAlpha(hex: string, alpha: number): string {
  if (!hex.startsWith("#") || hex.length !== 7) return hex;
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function shade(hex: string, k: number): string {
  if (!hex.startsWith("#") || hex.length !== 7) return hex;
  const r = Math.round(Number.parseInt(hex.slice(1, 3), 16) * k);
  const g = Math.round(Number.parseInt(hex.slice(3, 5), 16) * k);
  const b = Math.round(Number.parseInt(hex.slice(5, 7), 16) * k);
  return `rgb(${r}, ${g}, ${b})`;
}
