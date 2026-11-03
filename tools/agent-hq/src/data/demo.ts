/**
 * Demo mode: a pure step function that nudges the office forward so it feels alive.
 * Deterministic given the `rng`, so it can be unit tested.
 */
import { BLOCK_REASONS, TASK_POOL, WAITING_NEEDS } from "./agents";
import type { ActivityEntry, ActivityKind, Agent, AgentStatus, HqSnapshot } from "./types";

export type Rng = () => number;

const MAX_ACTIVITY = 40;

/** 4 to 6 seconds between ticks. */
export function demoIntervalMs(rng: Rng): number {
  return 4000 + Math.floor(rng() * 2000);
}

const lower = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

function pick<T>(items: readonly T[], rng: Rng): T {
  const item = items[Math.floor(rng() * items.length)] ?? items[0];
  if (item === undefined) throw new Error("pick: empty list");
  return item;
}

function addActivity(agent: Agent, now: Date, text: string, kind: ActivityKind): Agent {
  const entry: ActivityEntry = { time: now.toISOString(), text, kind };
  const activity = [...agent.activity, entry].slice(-MAX_ACTIVITY);
  return { ...agent, activity };
}

function setStatus(agent: Agent, status: AgentStatus, now: Date, text: string): Agent {
  const kind: ActivityKind = status === "done" ? "done" : "status";
  return addActivity({ ...agent, status, statusSince: now.toISOString() }, now, text, kind);
}

/** Moves progress and ticks subtasks off in order; returns the labels newly completed. */
function withProgress(agent: Agent, progress: number): { agent: Agent; completed: string[] } {
  const clamped = Math.max(0, Math.min(100, Math.round(progress)));
  const shouldBeDone = Math.floor((clamped / 100) * agent.subtasks.length);
  const completed: string[] = [];
  const subtasks = agent.subtasks.map((s, i) => {
    if (!s.done && i < shouldBeDone) {
      completed.push(s.label);
      return { ...s, done: true };
    }
    return s;
  });
  return { agent: { ...agent, progress: clamped, subtasks }, completed };
}

function startTask(agent: Agent, now: Date, rng: Rng): Agent {
  const pool = TASK_POOL[agent.role] ?? [];
  const candidates = pool.filter((t) => t.task !== agent.currentTask);
  const next = candidates.length > 0 ? pick(candidates, rng) : pool[0];
  if (!next) return agent;
  const nextUpCandidates = pool.filter((t) => t.task !== next.task);
  const nextUp = nextUpCandidates.length > 0 ? pick(nextUpCandidates, rng).task : next.task;
  const started: Agent = {
    ...agent,
    status: "working",
    statusSince: now.toISOString(),
    currentTask: next.task,
    taskDescription: next.description,
    subtasks: next.subtasks.map((label) => ({ label, done: false })),
    progress: Math.floor(rng() * 9),
    nextUp,
    waitingOn: undefined,
    blockedReason: undefined,
  };
  return addActivity(started, now, `${agent.name} picked up ${lower(next.task)}`, "start");
}

function pickOther(agent: Agent, all: Agent[], rng: Rng): string {
  const others = all.filter((a) => a.id !== agent.id);
  if (others.length === 0 || rng() < 0.25) return "human";
  return pick(others, rng).id;
}

function nameOf(id: string | undefined, all: Agent[]): string {
  if (!id || id === "human") return "you";
  return all.find((a) => a.id === id)?.name ?? id;
}

function advanceWorking(agent: Agent, all: Agent[], now: Date, rng: Rng): Agent {
  const roll = rng();
  if (roll < 0.08) {
    return setStatus(
      agent,
      "thinking",
      now,
      `${agent.name} is thinking through ${lower(agent.currentTask)}`,
    );
  }
  if (roll < 0.14) {
    const target = pickOther(agent, all, rng);
    const need = pick(WAITING_NEEDS, rng);
    return {
      ...setStatus(
        agent,
        "waiting",
        now,
        `${agent.name} is waiting on ${nameOf(target, all)} for ${need}`,
      ),
      waitingOn: target,
    };
  }
  if (roll < 0.18) {
    const reason = pick(BLOCK_REASONS, rng);
    return {
      ...setStatus(agent, "blocked", now, `${agent.name} hit a blocker: ${lower(reason)}`),
      blockedReason: reason,
    };
  }
  const step = 4 + Math.floor(rng() * 9);
  const { agent: moved, completed } = withProgress(agent, agent.progress + step);
  if (moved.progress >= 100) {
    const finished = withProgress(moved, 100).agent;
    return setStatus(finished, "done", now, `${agent.name} finished ${lower(agent.currentTask)}`);
  }
  const first = completed[0];
  if (first !== undefined) {
    return addActivity(moved, now, `${agent.name} checked off "${first}"`, "note");
  }
  if (rng() < 0.25) {
    return addActivity(
      moved,
      now,
      `${agent.name} shared an update on ${lower(agent.currentTask)}`,
      "note",
    );
  }
  return moved;
}

function advanceAgent(agent: Agent, all: Agent[], now: Date, rng: Rng): Agent {
  switch (agent.status) {
    case "working":
      return advanceWorking(agent, all, now, rng);
    case "thinking": {
      if (rng() < 0.5) {
        return setStatus(
          agent,
          "working",
          now,
          `${agent.name} resumed ${lower(agent.currentTask)}`,
        );
      }
      return withProgress(agent, agent.progress + 1 + Math.floor(rng() * 2)).agent;
    }
    case "waiting": {
      if (rng() < 0.35) {
        const who = nameOf(agent.waitingOn, all);
        return {
          ...setStatus(agent, "working", now, `${agent.name} got what it needed from ${who}`),
          waitingOn: undefined,
        };
      }
      return agent;
    }
    case "blocked": {
      if (rng() < 0.3) {
        return {
          ...setStatus(
            agent,
            "working",
            now,
            `${agent.name} is unblocked and back on ${lower(agent.currentTask)}`,
          ),
          blockedReason: undefined,
        };
      }
      return agent;
    }
    case "idle":
      return rng() < 0.3 ? startTask(agent, now, rng) : agent;
    case "done":
      return rng() < 0.25 ? startTask(agent, now, rng) : agent;
  }
}

/** 10 to 15 seconds between guaranteed status switches. */
export function demoSwitchIntervalMs(rng: Rng): number {
  return 10_000 + Math.floor(rng() * 5000);
}

/**
 * Guarantees visible movement: sends a working agent to rest (idle, waiting or done) or brings a
 * resting one back to work.
 */
export function demoSwitch(snapshot: HqSnapshot, rng: Rng, now: Date = new Date()): HqSnapshot {
  const agents = [...snapshot.agents];
  const workers = agents.flatMap((a, i) =>
    a.status === "working" || a.status === "thinking" ? [i] : [],
  );
  const resting = agents.flatMap((a, i) =>
    a.status === "working" || a.status === "thinking" ? [] : [i],
  );
  const sendToRest = resting.length === 0 || (workers.length > 0 && rng() < 0.5);
  if (sendToRest && workers.length > 0) {
    const i = pick(workers, rng);
    const agent = agents[i];
    if (!agent) return snapshot;
    const roll = rng();
    if (roll < 0.4) {
      agents[i] = setStatus(agent, "idle", now, `${agent.name} is taking a break`);
    } else if (roll < 0.7) {
      const target = pickOther(agent, agents, rng);
      agents[i] = {
        ...setStatus(
          agent,
          "waiting",
          now,
          `${agent.name} is waiting on ${nameOf(target, agents)} for ${pick(WAITING_NEEDS, rng)}`,
        ),
        waitingOn: target,
      };
    } else {
      const finished = withProgress(agent, 100).agent;
      agents[i] = setStatus(
        finished,
        "done",
        now,
        `${agent.name} finished ${lower(agent.currentTask)}`,
      );
    }
    return { project: snapshot.project, agents };
  }
  if (resting.length === 0) return snapshot;
  const i = pick(resting, rng);
  const agent = agents[i];
  if (!agent) return snapshot;
  switch (agent.status) {
    case "idle":
    case "done":
      agents[i] = startTask(agent, now, rng);
      break;
    case "waiting":
      agents[i] = {
        ...setStatus(
          agent,
          "working",
          now,
          `${agent.name} got what it needed from ${nameOf(agent.waitingOn, agents)}`,
        ),
        waitingOn: undefined,
      };
      break;
    case "blocked":
      agents[i] = {
        ...setStatus(
          agent,
          "working",
          now,
          `${agent.name} is unblocked and back on ${lower(agent.currentTask)}`,
        ),
        blockedReason: undefined,
      };
      break;
    default:
      return snapshot;
  }
  return { project: snapshot.project, agents };
}

/** One demo tick: advances one or two agents and returns a new snapshot. */
export function demoStep(snapshot: HqSnapshot, rng: Rng, now: Date = new Date()): HqSnapshot {
  const agents = [...snapshot.agents];
  if (agents.length === 0) return snapshot;
  const howMany = rng() < 0.35 ? 2 : 1;
  const chosen = new Set<number>();
  while (chosen.size < Math.min(howMany, agents.length)) {
    chosen.add(Math.floor(rng() * agents.length));
  }
  for (const index of chosen) {
    const agent = agents[index];
    if (agent) agents[index] = advanceAgent(agent, agents, now, rng);
  }
  return { project: snapshot.project, agents };
}
