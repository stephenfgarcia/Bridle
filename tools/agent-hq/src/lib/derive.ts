import type { ActivityKind, Agent, AgentStatus } from "../data/types";
import { STATUS_ORDER } from "./status";

export function overallProgress(agents: readonly Agent[]): number {
  if (agents.length === 0) return 0;
  const sum = agents.reduce((acc, a) => acc + a.progress, 0);
  return Math.round(sum / agents.length);
}

export function statusCounts(agents: readonly Agent[]): Record<AgentStatus, number> {
  const counts: Record<AgentStatus, number> = {
    working: 0,
    thinking: 0,
    waiting: 0,
    blocked: 0,
    idle: 0,
    done: 0,
  };
  for (const a of agents) counts[a.status] += 1;
  return counts;
}

export interface FeedItem {
  key: string;
  agentId: string;
  name: string;
  color: string;
  time: string;
  text: string;
  kind?: ActivityKind;
}

/** Every agent's activity merged, newest first. */
export function mergedFeed(agents: readonly Agent[], limit = 50): FeedItem[] {
  const items: FeedItem[] = [];
  for (const a of agents) {
    a.activity.forEach((entry, i) => {
      items.push({
        key: `${a.id}:${entry.time}:${i}`,
        agentId: a.id,
        name: a.name,
        color: a.color,
        time: entry.time,
        text: entry.text,
        kind: entry.kind,
      });
    });
  }
  items.sort((x, y) => (x.time < y.time ? 1 : x.time > y.time ? -1 : 0));
  return items.slice(0, limit);
}

export interface HourBucket {
  /** Hour of day, 0..23. */
  hour: number;
  count: number;
}

/** Tasks completed in each of the last `hours` hours (oldest first, current hour last). */
export function completedByHour(agents: readonly Agent[], now: Date, hours = 12): HourBucket[] {
  const buckets: HourBucket[] = [];
  const currentHourStart = new Date(now);
  currentHourStart.setMinutes(0, 0, 0);
  for (let i = hours - 1; i >= 0; i -= 1) {
    const start = currentHourStart.getTime() - i * 3_600_000;
    const end = start + 3_600_000;
    let count = 0;
    for (const a of agents) {
      for (const entry of a.activity) {
        if (entry.kind !== "done") continue;
        const t = new Date(entry.time).getTime();
        if (t >= start && t < end) count += 1;
      }
    }
    buckets.push({ hour: new Date(start).getHours(), count });
  }
  return buckets;
}

export function completedToday(agents: readonly Agent[], now: Date): number {
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  let count = 0;
  for (const a of agents) {
    for (const entry of a.activity) {
      if (entry.kind === "done" && new Date(entry.time).getTime() >= dayStart) count += 1;
    }
  }
  return count;
}

export const STATUSES = STATUS_ORDER;
