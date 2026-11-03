/**
 * Pure layout for the 3D office: room bounds, desk pods for N agents, cafeteria seats, waiting
 * spots, camera presets, and where each robot stands or sits given its status.
 * Axes: x right, y up, z toward the camera. Robots face +z by default.
 */
import type { AgentStatus } from "../data/types";
import type { Obstacle } from "./sim/navgrid";

export type Vec3 = [number, number, number];

export const ROOM = { minX: -16, maxX: 16, minZ: -14, maxZ: 16, height: 6 } as const;

/** Right-hand zone for the cafeteria; everything left of it is work floor. */
export const CAFE = { minX: 9.5, maxX: 15.5 } as const;

export interface Pod {
  id: string;
  /** Desk centre on the floor. */
  position: Vec3;
  rotationY: number;
  cluster: number;
}

export interface Spot {
  position: Vec3;
  rotationY: number;
}

export interface Seat extends Spot {
  table: Vec3;
}

export interface Placement extends Spot {
  seated: boolean;
  item?: "mug" | "donut";
  /** Where the robot is, for walkways and camera jumps. */
  zone: "work" | "cafeteria" | "waiting";
}

export interface CameraPreset {
  position: Vec3;
  target: Vec3;
}

export const CAMERA_PRESETS: Record<"overview" | "work" | "cafeteria" | "wall", CameraPreset> = {
  overview: { position: [0, 24, 31], target: [-1, 0, 0] },
  work: { position: [-3.3, 13, 12], target: [-3.3, 0, 0] },
  cafeteria: { position: [12.5, 9, 13], target: [12.5, 0, 2] },
  wall: { position: [0, 5, -1], target: [0, 3, -13] },
};

/** Robot offsets inside a pod (pod space, robot facing +z). */
export const POD_CHAIR: Vec3 = [0, 0, -0.95];
export const POD_STAND: Vec3 = [-0.6, 0, 1.75];
/** Where a robot stands before sitting down (behind the chair). */
export const POD_APPROACH: Vec3 = [0, 0, -1.75];

const CLUSTER_COLS = [-12, -3.3, 5.4];
const CLUSTER_ROWS = [-5.4, 4.0, 13.0];
const PODS_IN_CLUSTER: Vec3[] = [
  [-1.9, 0, -2.3],
  [1.9, 0, -2.3],
  [-1.9, 0, 2.3],
  [1.9, 0, 2.3],
];
const LAST_ROW_Z = 13.0;
const ROW_STEP = 8.6;
const WORK_CENTER_X = -3.3;
const CLUSTER_SPACING = 8.7;

/** Desk pods in 2x2 clusters, filled left to right and front to back; small teams sit centred. */
export function layoutPods(count: number): Pod[] {
  if (count <= 0) return [];
  const clusters = Math.ceil(count / 4);
  const cols = Math.min(clusters, CLUSTER_COLS.length);
  const xs =
    clusters >= CLUSTER_COLS.length
      ? CLUSTER_COLS
      : Array.from(
          { length: cols },
          (_, i) => WORK_CENTER_X + (i - (cols - 1) / 2) * CLUSTER_SPACING,
        );
  const pods: Pod[] = [];
  for (let i = 0; i < count; i += 1) {
    const cluster = Math.floor(i / 4);
    const col = cluster % cols;
    const row = Math.floor(cluster / cols);
    const cx = xs[col] ?? WORK_CENTER_X;
    const cz = CLUSTER_ROWS[row] ?? LAST_ROW_Z + (row - CLUSTER_ROWS.length + 1) * ROW_STEP;
    const local: Vec3 = PODS_IN_CLUSTER[i % 4] ?? [0, 0, 0];
    pods.push({
      id: `pod-${i}`,
      position: [cx + local[0], 0, cz + local[2]],
      rotationY: 0,
      cluster,
    });
  }
  return pods;
}

/** Where a waiting robot can stand: windows, the water cooler, the command wall. */
export const WAITING_SPOTS: Spot[] = [
  { position: [-14.4, 0, -9], rotationY: -Math.PI / 2 },
  { position: [-1.8, 0, -10.6], rotationY: Math.PI },
  { position: [-13.2, 0, 8], rotationY: -Math.PI / 2 },
  { position: [1.8, 0, -10.6], rotationY: Math.PI },
  { position: [-14.4, 0, 1], rotationY: -Math.PI / 2 },
  { position: [-14.4, 0, 12.5], rotationY: -Math.PI / 2 },
];

export const WATER_COOLER: Vec3 = [-14.4, 0, 8];

export const PLANTS: { position: Vec3; scale: number }[] = [
  { position: [-14.6, 0, -12.6], scale: 1 },
  { position: [7.6, 0, -12.6], scale: 0.9 },
  { position: [-15, 0, 15.2], scale: 1 },
  { position: [8.4, 0, 15.3], scale: 0.85 },
  { position: [15.1, 0, -12.9], scale: 0.8 },
];

/** Where waiting robots wander: windows, plants, the water cooler, the command wall. */
export const STROLL_SPOTS: Spot[] = [
  { position: [-14.4, 0, -9], rotationY: -Math.PI / 2 },
  { position: [-2.4, 0, -11], rotationY: Math.PI },
  { position: [-13.2, 0, 8], rotationY: -Math.PI / 2 },
  { position: [2.4, 0, -11], rotationY: Math.PI },
  { position: [-14.4, 0, 1], rotationY: -Math.PI / 2 },
  { position: [-13.6, 0, -12], rotationY: -Math.PI * 0.75 },
  { position: [6.6, 0, -12], rotationY: Math.PI * 0.85 },
  { position: [-14.4, 0, 12.5], rotationY: -Math.PI / 2 },
  { position: [-14, 0, 14.4], rotationY: -Math.PI * 0.75 },
];

/** The cafeteria counter: pick-up point, and the queue forming behind it along +z. */
export const COUNTER_PICKUP: Spot = { position: [13.6, 0, -5.4], rotationY: Math.PI / 2 };
export const COUNTER_QUEUE_STEP = 1.0;

/** Everything robots must walk around. Chairs and stools stay walkable: they are destinations. */
export function buildObstacles(pods: readonly Pod[]): Obstacle[] {
  const out: Obstacle[] = [];
  for (const pod of pods) {
    const [x, , z] = pod.position;
    out.push({ kind: "rect", x1: x - 1.35, z1: z - 0.5, x2: x + 1.35, z2: z + 0.5 });
    out.push({ kind: "rect", x1: x + 0.65, z1: z + 0.2, x2: x + 1.55, z2: z + 1.75 });
  }
  out.push({ kind: "circle", x: 0, z: -9.6, r: 1.7 });
  out.push({ kind: "arc", cx: 0, cz: -5.2, r1: 8.4, r2: 9.8, a1: -1.06, a2: 1.06 });
  out.push({ kind: "rect", x1: 14.4, z1: -7.4, x2: 15.7, z2: -1.0 });
  out.push({ kind: "rect", x1: 14.6, z1: 0.4, x2: 15.7, z2: 1.4 });
  for (const t of CAFE_TABLES) out.push({ kind: "circle", x: t[0], z: t[2], r: 0.8 });
  const [sx, , sz] = SOFA_CORNER;
  out.push({ kind: "rect", x1: sx - 1.5, z1: sz + 0.5, x2: sx + 1.5, z2: sz + 1.5 });
  out.push({ kind: "circle", x: sx, z: sz - 1.2, r: 0.55 });
  for (const p of PLANTS) out.push({ kind: "circle", x: p.position[0], z: p.position[2], r: 0.45 });
  out.push({
    kind: "rect",
    x1: WATER_COOLER[0] - 0.3,
    z1: WATER_COOLER[2] - 0.3,
    x2: WATER_COOLER[0] + 0.3,
    z2: WATER_COOLER[2] + 0.3,
  });
  return out;
}

export const CAFE_TABLES: Vec3[] = [
  [11.6, 0, -5],
  [11.6, 0, 0.8],
  [13, 0, 6.4],
];

const SEAT_RADIUS = 1.15;

function seatsFor(table: Vec3): Seat[] {
  return [0, 1, 2, 3].map((k) => {
    const angle = (k * Math.PI) / 2 + Math.PI / 4;
    const x = table[0] + Math.cos(angle) * SEAT_RADIUS;
    const z = table[2] + Math.sin(angle) * SEAT_RADIUS;
    // Face the table centre: default facing is +z, so rotate from the +z axis toward the table.
    const rotationY = Math.atan2(table[0] - x, table[2] - z);
    return { position: [x, 0, z], rotationY, table };
  });
}

export const CAFE_SEATS: Seat[] = CAFE_TABLES.flatMap(seatsFor);

export const SOFA_CORNER: Vec3 = [12.6, 0, 13.3];

interface PlaceableAgent {
  id: string;
  status: AgentStatus;
}

function takeFree<T>(pool: readonly T[], taken: Set<number>, start: number): [T, number] {
  for (let k = 0; k < pool.length; k += 1) {
    const idx = (start + k) % pool.length;
    const item = pool[idx];
    if (!taken.has(idx) && item !== undefined) {
      taken.add(idx);
      return [item, idx];
    }
  }
  const idx = start % pool.length;
  const fallback = pool[idx];
  if (fallback === undefined) throw new Error("empty pool");
  return [fallback, idx];
}

/** Each robot's place for its status. Stable: an agent keeps its spot while others change. */
export function placeAgents(
  agents: readonly PlaceableAgent[],
  pods: readonly Pod[],
): Map<string, Placement> {
  const out = new Map<string, Placement>();
  const takenSpots = new Set<number>();
  const takenSeats = new Set<number>();
  agents.forEach((agent, i) => {
    const pod = pods[i] ?? pods[pods.length - 1];
    if (!pod) return;
    const [px, , pz] = pod.position;
    switch (agent.status) {
      case "working":
      case "thinking":
        out.set(agent.id, {
          position: [px + POD_CHAIR[0], 0, pz + POD_CHAIR[2]],
          rotationY: 0,
          seated: true,
          zone: "work",
        });
        break;
      case "blocked":
        out.set(agent.id, {
          position: [px + POD_STAND[0], 0, pz + POD_STAND[2]],
          rotationY: 0,
          seated: false,
          zone: "work",
        });
        break;
      case "waiting": {
        const [spot, idx] = takeFree(WAITING_SPOTS, takenSpots, i);
        const wrap = Math.floor(takenSpots.size / WAITING_SPOTS.length);
        const lateral = wrap * 0.9 * (idx % 2 === 0 ? 1 : -1);
        const sideways: Vec3 = spot.rotationY === Math.PI ? [lateral, 0, 0] : [0, 0, lateral];
        out.set(agent.id, {
          position: [spot.position[0] + sideways[0], 0, spot.position[2] + sideways[2]],
          rotationY: spot.rotationY,
          seated: false,
          zone: "waiting",
        });
        break;
      }
      case "idle":
      case "done": {
        const [seat] = takeFree(CAFE_SEATS, takenSeats, i);
        out.set(agent.id, {
          position: seat.position,
          rotationY: seat.rotationY,
          seated: true,
          item: agent.status === "done" ? "donut" : "mug",
          zone: "cafeteria",
        });
        break;
      }
    }
  });
  return out;
}

/** Camera position for looking at a robot from the front-above. */
export function cameraForPose(x: number, z: number, heading: number): CameraPreset {
  const facingX = Math.sin(heading);
  const facingZ = Math.cos(heading);
  return {
    position: [x + facingX * 4.5, 4.5, z + facingZ * 4.5],
    target: [x, 1.2, z],
  };
}

export function cameraForAgent(placement: Placement): CameraPreset {
  return cameraForPose(placement.position[0], placement.position[2], placement.rotationY);
}
