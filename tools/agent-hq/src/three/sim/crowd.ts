/**
 * The whole crowd, framework-free: brains kept in sync with the agent list, separation
 * avoidance, blocked-ahead slowdown, and cafeteria table chatter. Both the 3D and the isometric
 * views step one of these each frame, so their behaviour cannot drift apart.
 */
import type { Agent } from "../../data/types";
import type { Pod } from "../layout";
import { AgentBrain, type RobotPose } from "./brain";
import { OfficeWorld } from "./world";

export const GENERIC_LINES = [
  "Coffee's good today ☕",
  "Nice work on that!",
  "Almost launch week 🚀",
  "Did you see the new designs?",
  "Taking five ✨",
  "😄",
  "👍",
  "Same time tomorrow?",
  "That blocker was brutal",
  "Who's on QA tonight?",
  "Snack break!",
  "🍩",
];

/** A short friendly line, sometimes about the agent's latest finished or started task. */
export function lineFor(agent: Agent, rng: () => number): string {
  const latest = [...agent.activity].reverse().find((a) => a.kind === "done" || a.kind === "start");
  if (latest && rng() < 0.5) {
    const finished = latest.text.match(/^\S+ finished (.+)$/);
    if (finished?.[1]) return `Just finished the ${finished[1].replace(/^the /, "")}!`;
    const started = latest.text.match(/^\S+ picked up (.+)$/);
    if (started?.[1]) return `Starting on ${started[1]} next 💪`;
  }
  return GENERIC_LINES[Math.floor(rng() * GENERIC_LINES.length)] ?? "👍";
}

const TABLES = [0, 1, 2];
const SEPARATION = 0.95;

export interface WaitPair {
  id: string;
  from: RobotPose;
  to: RobotPose;
}

export class CrowdSim {
  readonly world: OfficeWorld;
  readonly brains = new Map<string, AgentBrain>();
  private agents: Agent[] = [];
  private readonly talkNext = new Map<number, number>();
  private readonly talkTurn = new Map<number, number>();
  private clock = 0;
  private posesCache: Map<string, RobotPose> | null = null;

  constructor(pods: Pod[], agentIds: string[], random: () => number = Math.random) {
    this.world = new OfficeWorld(pods, agentIds, random);
  }

  /** Creates brains for new agents, re-plans changed statuses, drops agents that left. */
  sync(agents: Agent[]): void {
    this.agents = agents;
    let changed = false;
    agents.forEach((agent, i) => {
      const brain = this.brains.get(agent.id);
      if (!brain) {
        this.brains.set(agent.id, new AgentBrain(agent.id, i, agent.status, this.world));
        changed = true;
      } else if (brain.status !== agent.status) {
        brain.setStatus(agent.status, this.world, this.clock);
      }
    });
    for (const id of [...this.brains.keys()]) {
      if (!agents.some((a) => a.id === id)) {
        this.brains.delete(id);
        changed = true;
      }
    }
    if (changed) this.posesCache = null;
  }

  /** Live pose objects by agent id (the same objects every frame, mutated in place). */
  get poses(): Map<string, RobotPose> {
    if (!this.posesCache) {
      this.posesCache = new Map([...this.brains].map(([id, b]) => [id, b.pose]));
    }
    return this.posesCache;
  }

  pose(id: string): RobotPose | undefined {
    return this.brains.get(id)?.pose;
  }

  /** Dashed-line pairs for agents waiting on another agent. */
  waitPairs(): WaitPair[] {
    const out: WaitPair[] = [];
    for (const agent of this.agents) {
      if (agent.status !== "waiting" || !agent.waitingOn || agent.waitingOn === "human") continue;
      const from = this.pose(agent.id);
      const to = this.pose(agent.waitingOn);
      if (from && to) out.push({ id: `${agent.id}->${agent.waitingOn}`, from, to });
    }
    return out;
  }

  /** One simulation frame. `now` is a monotonic clock in seconds. */
  step(rawDt: number, now: number): void {
    this.clock = now;
    const dt = Math.min(rawDt, 0.1);
    const list = [...this.brains.values()];
    const world = this.world;

    for (const b of list) {
      b.push = [0, 0];
      b.blockedAhead = false;
      if (!b.moving) continue;
      const fx = Math.sin(b.pose.heading);
      const fz = Math.cos(b.pose.heading);
      for (const o of list) {
        if (o === b) continue;
        const dx = b.pose.x - o.pose.x;
        const dz = b.pose.z - o.pose.z;
        const d = Math.hypot(dx, dz);
        if (d > SEPARATION || d < 1e-4) continue;
        const k = ((SEPARATION - d) / SEPARATION) * 2.4;
        b.push = [b.push[0] + (dx / d) * k, b.push[1] + (dz / d) * k];
        const ahead = (-dx * fx - dz * fz) / d;
        if (ahead > 0.7 && d < 0.8 && !o.moving) b.blockedAhead = true;
      }
    }
    for (const b of list) b.update(dt, world, now);

    for (const table of TABLES) {
      const mates = world
        .tableMates(table)
        .map((id) => this.brains.get(id))
        .filter((b): b is AgentBrain => !!b && b.mode === "sit-cafe");
      if (mates.length < 2) {
        this.talkNext.set(table, now + 3);
        continue;
      }
      const nextAt = this.talkNext.get(table);
      if (nextAt === undefined) {
        this.talkNext.set(table, now + 3 + world.random() * 3);
        continue;
      }
      if (now < nextAt) continue;
      const turn = this.talkTurn.get(table) ?? 0;
      const speaker = mates[turn % mates.length];
      if (speaker) {
        const agent = this.agents.find((a) => a.id === speaker.id);
        if (agent) speaker.speak(lineFor(agent, world.random), "speech", now);
        for (const m of mates) {
          if (m === speaker) continue;
          m.nod(now + 0.6);
          if (world.random() < 0.3) m.laugh(now + 0.9);
        }
      }
      this.talkTurn.set(table, turn + 1);
      this.talkNext.set(table, now + 5 + world.random() * 4);
    }
  }
}
