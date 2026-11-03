/** The office as the brains see it: nav grid, points of interest, and shared resources. */
import type { AgentStatus } from "../../data/types";
import {
  buildObstacles,
  CAFE,
  CAFE_SEATS,
  CAFE_TABLES,
  COUNTER_PICKUP,
  COUNTER_QUEUE_STEP,
  POD_APPROACH,
  POD_CHAIR,
  POD_STAND,
  type Pod,
  ROOM,
  type Seat,
  STROLL_SPOTS,
} from "../layout";
import { buildNavGrid, findPath, type NavGrid, type Vec2 } from "./navgrid";

export type ItemKind = "coffee" | "donut" | "sandwich" | "juice";
export const ITEMS: ItemKind[] = ["coffee", "donut", "sandwich", "juice"];

export interface Spot2 {
  pos: Vec2;
  heading: number;
}

export interface DeskSpots {
  chair: Spot2;
  approach: Spot2;
  stand: Spot2;
}

export interface SeatPick {
  index: number;
  seat: Spot2;
  approach: Spot2;
  table: number;
}

const APPROACH_DIST = 0.72;

export function facingOf(heading: number): Vec2 {
  return [Math.sin(heading), Math.cos(heading)];
}

export function headingTo(from: Vec2, to: Vec2): number {
  return Math.atan2(to[0] - from[0], to[1] - from[1]);
}

/** Owns the grid and every shared thing agents compete for. */
export class OfficeWorld {
  readonly grid: NavGrid;
  readonly desks = new Map<string, DeskSpots>();
  readonly seats: Seat[] = CAFE_SEATS;
  readonly strollSpots: Spot2[] = STROLL_SPOTS.map((s) => ({
    pos: [s.position[0], s.position[2]],
    heading: s.rotationY,
  }));
  private seatOwner = new Map<number, string>();
  private queue: string[] = [];
  readonly random: () => number;

  constructor(pods: Pod[], agentIds: string[], random: () => number = Math.random) {
    this.random = random;
    this.grid = buildNavGrid(
      { minX: ROOM.minX, maxX: ROOM.maxX, minZ: ROOM.minZ, maxZ: ROOM.maxZ },
      buildObstacles(pods),
    );
    agentIds.forEach((id, i) => {
      const pod = pods[i] ?? pods[pods.length - 1];
      if (!pod) return;
      const [px, , pz] = pod.position;
      this.desks.set(id, {
        chair: { pos: [px + POD_CHAIR[0], pz + POD_CHAIR[2]], heading: 0 },
        approach: { pos: [px + POD_APPROACH[0], pz + POD_APPROACH[2]], heading: 0 },
        stand: { pos: [px + POD_STAND[0], pz + POD_STAND[2]], heading: 0 },
      });
    });
  }

  path(from: Vec2, to: Vec2): Vec2[] {
    const p = findPath(this.grid, from, to);
    return p && p.length > 0 ? p : [[to[0], to[1]]];
  }

  desk(id: string): DeskSpots | undefined {
    return this.desks.get(id);
  }

  /** A stroll spot other than the one we are at, picked at random. */
  nextStroll(current: Vec2 | null): Spot2 {
    const candidates = this.strollSpots.filter(
      (s) => !current || Math.hypot(s.pos[0] - current[0], s.pos[1] - current[1]) > 1.5,
    );
    const pool = candidates.length > 0 ? candidates : this.strollSpots;
    const pick = pool[Math.floor(this.random() * pool.length)] ?? pool[0];
    if (!pick) throw new Error("no stroll spots");
    return pick;
  }

  // ---- counter queue ----

  joinQueue(id: string): number {
    if (!this.queue.includes(id)) this.queue.push(id);
    return this.queue.indexOf(id);
  }

  queueIndex(id: string): number {
    return this.queue.indexOf(id);
  }

  leaveQueue(id: string): void {
    this.queue = this.queue.filter((q) => q !== id);
  }

  queueSpot(index: number): Spot2 {
    const [x, , z] = COUNTER_PICKUP.position;
    return {
      pos: [x, z + index * COUNTER_QUEUE_STEP],
      heading: index === 0 ? COUNTER_PICKUP.rotationY : Math.PI,
    };
  }

  // ---- cafeteria seats ----

  seatOccupants(table: number): number {
    let n = 0;
    for (const [idx] of this.seatOwner) {
      const seat = this.seats[idx];
      if (seat && seat.table === CAFE_TABLES[table]) n += 1;
    }
    return n;
  }

  /** Prefers tables that already have company; then the nearest free seat. */
  chooseSeat(id: string, from: Vec2): SeatPick | null {
    const scored: { index: number; score: number }[] = [];
    this.seats.forEach((seat, index) => {
      if (this.seatOwner.has(index) && this.seatOwner.get(index) !== id) return;
      const table = CAFE_TABLES.indexOf(seat.table);
      const company = this.seatOccupants(table);
      if (company >= 4) return;
      const dist = Math.hypot(seat.position[0] - from[0], seat.position[2] - from[1]);
      scored.push({ index, score: (company > 0 ? -20 : 0) + dist + this.random() * 0.5 });
    });
    scored.sort((a, b) => a.score - b.score);
    const best = scored[0];
    if (!best) return null;
    const seat = this.seats[best.index];
    if (!seat) return null;
    this.seatOwner.set(best.index, id);
    const [fx, fz] = facingOf(seat.rotationY);
    return {
      index: best.index,
      table: CAFE_TABLES.indexOf(seat.table),
      seat: { pos: [seat.position[0], seat.position[2]], heading: seat.rotationY },
      approach: {
        pos: [seat.position[0] - fx * APPROACH_DIST, seat.position[2] - fz * APPROACH_DIST],
        heading: seat.rotationY,
      },
    };
  }

  releaseSeat(id: string): void {
    for (const [idx, owner] of this.seatOwner) if (owner === id) this.seatOwner.delete(idx);
  }

  seatOf(id: string): number | null {
    for (const [idx, owner] of this.seatOwner) if (owner === id) return idx;
    return null;
  }

  tableMates(table: number): string[] {
    const out: string[] = [];
    for (const [idx, owner] of this.seatOwner) {
      const seat = this.seats[idx];
      if (seat && CAFE_TABLES.indexOf(seat.table) === table) out.push(owner);
    }
    return out;
  }

  /** Where a status settles when nothing animates (first load). */
  restingSpot(id: string, status: AgentStatus, index: number): Spot2 {
    const desk = this.desk(id);
    switch (status) {
      case "working":
      case "thinking":
        return desk?.chair ?? { pos: [0, 0], heading: 0 };
      case "blocked":
        return desk?.stand ?? { pos: [0, 0], heading: 0 };
      case "waiting": {
        const s = this.strollSpots[index % this.strollSpots.length] ?? this.strollSpots[0];
        return s ?? { pos: [0, 0], heading: 0 };
      }
      case "idle":
      case "done": {
        const pick = this.chooseSeat(id, [CAFE.minX, 0]);
        return pick ? pick.seat : { pos: [CAFE.minX + 1, 0], heading: 0 };
      }
    }
  }

  deskApproach(id: string): Spot2 | undefined {
    return this.desk(id)?.approach;
  }
}
