/**
 * One agent's behaviour: a small state machine that turns a status into a sequence of steps
 * (walk, sit, stand up, queue, celebrate, stroll) and writes a RobotPose every frame.
 */
import type { AgentStatus } from "../../data/types";
import type { Vec2 } from "./navgrid";
import { facingOf, ITEMS, type ItemKind, type OfficeWorld, type Spot2 } from "./world";

export type Mode =
  | "sit-desk"
  | "stand-desk"
  | "walk"
  | "sit-cafe"
  | "stand"
  | "sitting-down"
  | "standing-up"
  | "queue"
  | "pickup"
  | "celebrate";

export type ArmPose = "rest" | "type" | "lean" | "headhand" | "hold" | "sip" | "up";

export interface Bubble {
  id: number;
  text: string;
  kind: "speech" | "onit" | "done";
}

export interface RobotPose {
  x: number;
  z: number;
  heading: number;
  /** 0 standing, 1 seated. */
  seated: number;
  /** Walk cycle phase in radians; stops advancing when still. */
  walk: number;
  speed: number;
  bob: number;
  arms: ArmPose;
  swivel: number;
  nod: number;
  laugh: number;
  carrying: ItemKind | null;
  bubble: Bubble | null;
  celebrate: number;
  mode: Mode;
}

type Step =
  | { kind: "walk"; to: Vec2; heading?: number }
  | { kind: "sit"; seat: Spot2; approach: Spot2; where: "desk" | "cafe" }
  | { kind: "stand"; seconds: number }
  | { kind: "queue" }
  | { kind: "celebrate" }
  | { kind: "bubble"; text: string; bkind: Bubble["kind"] }
  | { kind: "stroll" };

const WALK_SPEED = 1.7;
const SIT_SECONDS = 0.65;
const PICKUP_SECONDS = 1.8;
const CELEBRATE_SECONDS = 2.4;
const BUBBLE_SECONDS = 3.6;
const ARRIVE = 0.12;

let bubbleCounter = 0;

function dampAngle(from: number, to: number, smooth: number, dt: number): number {
  const diff = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + diff * (1 - Math.exp(-dt / smooth));
}

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

export class AgentBrain {
  readonly id: string;
  readonly index: number;
  status: AgentStatus;
  readonly pose: RobotPose;
  mode: Mode = "stand";
  /** Set by the crowd each frame before update(). */
  push: Vec2 = [0, 0];
  blockedAhead = false;

  private steps: Step[] = [];
  private path: Vec2[] = [];
  private pathIdx = 0;
  private walkHeading: number | undefined;
  private targetHeading = 0;
  private t = 0;
  private from: Spot2 | null = null;
  private to: Spot2 | null = null;
  private seatSpot: Spot2 | null = null;
  private approachSpot: Spot2 | null = null;
  private where: "desk" | "cafe" | null = null;
  private bubbleUntil = -1;
  private nextSip = 0;
  private sipUntil = -1;
  private nodUntil = -1;
  private laughUntil = -1;
  private queueTarget: Vec2 | null = null;
  constructor(id: string, index: number, status: AgentStatus, world: OfficeWorld) {
    this.id = id;
    this.index = index;
    this.status = status;
    const spot = world.restingSpot(id, status, index);
    this.pose = {
      x: spot.pos[0],
      z: spot.pos[1],
      heading: spot.heading,
      seated: 0,
      walk: 0,
      speed: 0,
      bob: 0,
      arms: "rest",
      swivel: 0,
      nod: 0,
      laugh: 0,
      carrying: null,
      bubble: null,
      celebrate: 0,
      mode: "stand",
    };
    this.targetHeading = spot.heading;
    this.settle(status, world);
  }

  /** First-load placement: everyone is already where their status says, no walking. */
  private settle(status: AgentStatus, world: OfficeWorld): void {
    switch (status) {
      case "working":
      case "thinking":
        this.enterSeat(
          "desk",
          world.desk(this.id)?.chair ?? null,
          world.deskApproach(this.id) ?? null,
        );
        break;
      case "blocked":
        this.mode = "stand-desk";
        break;
      case "waiting":
        this.mode = "stand";
        this.t = 4 + world.random() * 4;
        this.steps = [{ kind: "stroll" }];
        break;
      case "idle":
      case "done": {
        const idx = world.seatOf(this.id);
        const seat = idx !== null ? world.seats[idx] : undefined;
        if (seat) {
          const [fx, fz] = facingOf(seat.rotationY);
          const seatSpot: Spot2 = {
            pos: [seat.position[0], seat.position[2]],
            heading: seat.rotationY,
          };
          const approach: Spot2 = {
            pos: [seat.position[0] - fx * 0.72, seat.position[2] - fz * 0.72],
            heading: seat.rotationY,
          };
          this.pose.carrying = this.pickItem(world);
          this.enterSeat("cafe", seatSpot, approach);
          this.nextSip = 2 + world.random() * 5;
        } else {
          this.mode = "stand";
        }
        break;
      }
    }
    this.pose.mode = this.mode;
  }

  private enterSeat(where: "desk" | "cafe", seat: Spot2 | null, approach: Spot2 | null): void {
    if (!seat) {
      this.mode = "stand";
      return;
    }
    this.seatSpot = seat;
    this.approachSpot = approach ?? seat;
    this.where = where;
    this.pose.x = seat.pos[0];
    this.pose.z = seat.pos[1];
    this.pose.heading = seat.heading;
    this.targetHeading = seat.heading;
    this.pose.seated = 1;
    this.mode = where === "desk" ? "sit-desk" : "sit-cafe";
  }

  private pickItem(world: OfficeWorld): ItemKind {
    return ITEMS[Math.floor(world.random() * ITEMS.length)] ?? "coffee";
  }

  get pos(): Vec2 {
    return [this.pose.x, this.pose.z];
  }

  get moving(): boolean {
    return this.mode === "walk" || (this.mode === "queue" && this.path.length > 0);
  }

  get seatedNow(): boolean {
    return this.mode === "sit-desk" || this.mode === "sit-cafe";
  }

  speak(text: string, kind: Bubble["kind"] = "speech", now = 0, seconds = BUBBLE_SECONDS): void {
    bubbleCounter += 1;
    this.pose.bubble = { id: bubbleCounter, text, kind };
    this.bubbleUntil = now + seconds;
  }

  nod(now: number): void {
    this.nodUntil = now + 1.2;
  }

  laugh(now: number): void {
    this.laughUntil = now + 0.9;
  }

  /** Re-plans from wherever the agent is right now. */
  setStatus(status: AgentStatus, world: OfficeWorld, now: number): void {
    if (status === this.status) return;
    const previous = this.status;
    this.status = status;
    world.leaveQueue(this.id);
    this.queueTarget = null;
    const atDeskSeated = this.mode === "sit-desk";
    const atDeskStanding = this.mode === "stand-desk";
    const plan: Step[] = [];

    switch (status) {
      case "working":
      case "thinking": {
        if (atDeskSeated) {
          this.steps = [];
          this.path = [];
          return;
        }
        if (status === "working") plan.push({ kind: "bubble", text: "On it!", bkind: "onit" });
        plan.push(...this.toDeskSteps(world));
        break;
      }
      case "blocked": {
        const desk = world.desk(this.id);
        if (desk) plan.push({ kind: "walk", to: desk.stand.pos, heading: desk.stand.heading });
        break;
      }
      case "waiting":
        plan.push({ kind: "stroll" });
        break;
      case "idle":
        plan.push(...this.toCafeSteps());
        break;
      case "done": {
        if (previous !== "idle") plan.push({ kind: "celebrate" });
        plan.push(...this.toCafeSteps());
        break;
      }
    }

    if (this.where === "cafe" && status !== "idle" && status !== "done") {
      // Leaving the cafeteria: the seat frees up once we stand.
      this.releaseSeatAfterStanding = true;
    }
    if (atDeskStanding && status === "done") {
      // Celebrate right here, then go.
    }
    this.steps = plan;
    this.path = [];
    if (this.seatedNow) {
      this.beginStandUp();
    } else if (this.mode === "sitting-down" || this.mode === "standing-up") {
      // Let the transition finish; next() picks up the new plan.
    } else {
      this.next(world, now);
    }
  }

  private releaseSeatAfterStanding = false;

  private toDeskSteps(world: OfficeWorld): Step[] {
    const desk = world.desk(this.id);
    if (!desk) return [];
    return [
      { kind: "walk", to: desk.approach.pos, heading: 0 },
      { kind: "sit", seat: desk.chair, approach: desk.approach, where: "desk" },
    ];
  }

  private toCafeSteps(): Step[] {
    return [{ kind: "queue" }];
  }

  private beginStandUp(): void {
    this.mode = "standing-up";
    this.t = 0;
    this.from = this.seatSpot ?? { pos: this.pos, heading: this.pose.heading };
    this.to = this.approachSpot ?? this.from;
  }

  private next(world: OfficeWorld, now: number): void {
    const step = this.steps.shift();
    if (!step) {
      // Nothing planned: stand where we are (at the desk when blocked).
      this.mode = this.status === "blocked" ? "stand-desk" : "stand";
      this.t = Number.POSITIVE_INFINITY;
      return;
    }
    switch (step.kind) {
      case "bubble":
        this.speak(step.text, step.bkind, now, 2.4);
        this.next(world, now);
        return;
      case "walk":
        this.startWalk(world, step.to, step.heading, now);
        return;
      case "sit":
        this.mode = "sitting-down";
        this.t = 0;
        this.from = { pos: this.pos, heading: this.pose.heading };
        this.to = step.seat;
        this.seatSpot = step.seat;
        this.approachSpot = step.approach;
        this.where = step.where;
        return;
      case "stand":
        this.mode = "stand";
        this.t = step.seconds;
        return;
      case "queue": {
        this.mode = "queue";
        world.joinQueue(this.id);
        this.queueTarget = null;
        this.path = [];
        return;
      }
      case "celebrate":
        this.mode = "celebrate";
        this.t = 0;
        this.speak("✓ Done!", "done", now, 2.6);
        return;
      case "stroll": {
        const spot = world.nextStroll(this.pos);
        this.steps.unshift(
          { kind: "walk", to: spot.pos, heading: spot.heading },
          { kind: "stand", seconds: 4 + world.random() * 4 },
          { kind: "stroll" },
        );
        this.next(world, now);
        return;
      }
    }
  }

  private startWalk(world: OfficeWorld, to: Vec2, heading: number | undefined, now: number): void {
    const here = this.pos;
    if (Math.hypot(to[0] - here[0], to[1] - here[1]) < ARRIVE) {
      if (heading !== undefined) this.targetHeading = heading;
      this.next(world, now);
      return;
    }
    this.path = world.path(here, to);
    this.pathIdx = 0;
    this.walkHeading = heading;
    this.mode = "walk";
  }

  private finishSit(): void {
    if (!this.to) return;
    this.pose.x = this.to.pos[0];
    this.pose.z = this.to.pos[1];
    this.pose.heading = this.to.heading;
    this.targetHeading = this.to.heading;
    this.pose.seated = 1;
    this.mode = this.where === "desk" ? "sit-desk" : "sit-cafe";
    this.nextSip = 2;
    this.t = 0;
  }

  update(dt: number, world: OfficeWorld, now: number): void {
    const p = this.pose;
    if (p.bubble && now > this.bubbleUntil) p.bubble = null;
    p.speed = 0;
    p.bob = 0;
    p.celebrate = 0;
    p.swivel = 0;
    p.nod = now < this.nodUntil ? Math.sin(now * 11) * 0.12 : 0;
    p.laugh = now < this.laughUntil ? Math.abs(Math.sin(now * 13)) * 0.07 : 0;

    switch (this.mode) {
      case "walk":
        this.walkAlong(dt, world, now);
        break;
      case "queue":
        this.updateQueue(dt, world, now);
        break;
      case "pickup":
        this.t += dt;
        p.arms = "rest";
        if (this.t >= PICKUP_SECONDS) {
          p.carrying = this.pickItem(world);
          world.leaveQueue(this.id);
          this.goToSeat(world, now);
        }
        break;
      case "sitting-down": {
        this.t += dt / SIT_SECONDS;
        const k = smoothstep(Math.min(1, this.t));
        if (this.from && this.to) {
          p.x = this.from.pos[0] + (this.to.pos[0] - this.from.pos[0]) * k;
          p.z = this.from.pos[1] + (this.to.pos[1] - this.from.pos[1]) * k;
          this.targetHeading = this.to.heading;
        }
        p.seated = k;
        if (this.t >= 1) this.finishSit();
        break;
      }
      case "standing-up": {
        this.t += dt / SIT_SECONDS;
        const k = smoothstep(Math.min(1, this.t));
        if (this.from && this.to) {
          p.x = this.from.pos[0] + (this.to.pos[0] - this.from.pos[0]) * k;
          p.z = this.from.pos[1] + (this.to.pos[1] - this.from.pos[1]) * k;
        }
        p.seated = 1 - k;
        if (this.t >= 1) {
          p.seated = 0;
          if (this.releaseSeatAfterStanding) {
            world.releaseSeat(this.id);
            this.releaseSeatAfterStanding = false;
            p.carrying = null;
          }
          this.where = null;
          this.mode = "stand";
          this.next(world, now);
        }
        break;
      }
      case "celebrate": {
        this.t += dt;
        const k = this.t / CELEBRATE_SECONDS;
        p.celebrate = Math.min(1, k);
        p.arms = "up";
        if (this.t < 1.7) p.bob = Math.abs(Math.sin(this.t * Math.PI * 1.25)) * 0.22;
        if (this.t >= CELEBRATE_SECONDS) {
          this.mode = "stand";
          this.next(world, now);
        }
        break;
      }
      case "stand":
        this.t -= dt;
        if (this.t <= 0) this.next(world, now);
        break;
      case "sit-desk":
      case "stand-desk":
      case "sit-cafe":
        break;
    }

    // Pose details per mode and status.
    switch (this.mode) {
      case "sit-desk":
        if (this.status === "thinking") {
          p.arms = "lean";
          p.swivel = Math.sin(now * 0.55 + this.index) * 0.38;
        } else {
          p.arms = "type";
        }
        break;
      case "stand-desk":
        p.arms = this.status === "blocked" ? "headhand" : "rest";
        break;
      case "sit-cafe": {
        if (now >= this.nextSip && this.sipUntil < now) {
          this.sipUntil = now + 0.9;
          this.nextSip = now + 4 + world.random() * 3;
        }
        p.arms = now < this.sipUntil ? "sip" : p.carrying ? "hold" : "rest";
        break;
      }
      case "walk":
      case "queue":
        p.arms = p.carrying ? "hold" : "rest";
        break;
      case "stand":
        p.arms = this.status === "blocked" ? "headhand" : p.carrying ? "hold" : "rest";
        break;
      case "pickup":
      case "sitting-down":
      case "standing-up":
        p.arms = p.carrying ? "hold" : "rest";
        break;
      case "celebrate":
        break;
    }

    if (this.mode !== "walk" && !(this.mode === "queue" && this.path.length > 0)) {
      p.heading = dampAngle(p.heading, this.targetHeading, 0.18, dt);
    }
    p.mode = this.mode;
  }

  private walkAlong(dt: number, world: OfficeWorld, now: number): void {
    const p = this.pose;
    const target = this.path[this.pathIdx];
    if (!target) {
      this.arrive(world, now);
      return;
    }
    const dx = target[0] - p.x;
    const dz = target[1] - p.z;
    const d = Math.hypot(dx, dz);
    const last = this.pathIdx === this.path.length - 1;
    if (d < ARRIVE) {
      if (last) {
        p.x = target[0];
        p.z = target[1];
        this.arrive(world, now);
        return;
      }
      this.pathIdx += 1;
      return;
    }
    let speed = WALK_SPEED;
    if (this.blockedAhead) speed *= 0.3;
    if (last && d < 0.6) speed *= Math.max(0.45, d / 0.6);
    let vx = (dx / d) * speed + this.push[0];
    let vz = (dz / d) * speed + this.push[1];
    const vlen = Math.hypot(vx, vz);
    if (vlen > WALK_SPEED * 1.15) {
      vx = (vx / vlen) * WALK_SPEED * 1.15;
      vz = (vz / vlen) * WALK_SPEED * 1.15;
    }
    const stepLen = Math.min(d, Math.hypot(vx, vz) * dt);
    const mlen = Math.hypot(vx, vz) || 1;
    p.x += (vx / mlen) * stepLen;
    p.z += (vz / mlen) * stepLen;
    p.speed = stepLen / Math.max(dt, 1e-4);
    p.walk += p.speed * dt * 4.2;
    this.targetHeading = Math.atan2(vx, vz);
    p.heading = dampAngle(p.heading, this.targetHeading, 0.12, dt);
  }

  private arrive(world: OfficeWorld, now: number): void {
    this.path = [];
    if (this.walkHeading !== undefined) this.targetHeading = this.walkHeading;
    this.walkHeading = undefined;
    if (this.mode === "queue") {
      this.mode = "queue";
      return;
    }
    this.mode = "stand";
    this.next(world, now);
  }

  private updateQueue(dt: number, world: OfficeWorld, now: number): void {
    const index = world.queueIndex(this.id);
    if (index < 0) {
      world.joinQueue(this.id);
      return;
    }
    const spot = world.queueSpot(index);
    const changed =
      !this.queueTarget ||
      Math.hypot(spot.pos[0] - this.queueTarget[0], spot.pos[1] - this.queueTarget[1]) > 0.05;
    if (changed) {
      this.queueTarget = spot.pos;
      const here = this.pos;
      if (Math.hypot(spot.pos[0] - here[0], spot.pos[1] - here[1]) < ARRIVE) {
        this.path = [];
      } else {
        this.path = world.path(here, spot.pos);
        this.pathIdx = 0;
        this.walkHeading = spot.heading;
      }
    }
    if (this.path.length > 0) {
      this.walkAlong(dt, world, now);
      return;
    }
    this.targetHeading = spot.heading;
    if (index === 0) {
      this.mode = "pickup";
      this.t = 0;
    }
  }

  private goToSeat(world: OfficeWorld, now: number): void {
    const pick = world.chooseSeat(this.id, this.pos);
    if (!pick) {
      // Full house: wait near the counter and try again shortly.
      this.steps = [{ kind: "stand", seconds: 3 }, { kind: "queue" }];
      this.mode = "stand";
      this.t = 3;
      return;
    }
    this.steps = [
      { kind: "walk", to: pick.approach.pos, heading: pick.approach.heading },
      { kind: "sit", seat: pick.seat, approach: pick.approach, where: "cafe" },
    ];
    this.mode = "stand";
    this.next(world, now);
  }

  /** For tests and the camera: where this robot is heading, if walking. */
  get destination(): Vec2 | null {
    const last = this.path[this.path.length - 1];
    return last ? [last[0], last[1]] : null;
  }
}
