/**
 * Pure logic for POST /api/agent-status: request parsing, key checking, and turning a report
 * into a row update. No I/O here, so every rule is unit tested.
 */
import { timingSafeEqual } from "node:crypto";
import type { AgentRow } from "../src/data/live/rows.ts";
import type { ActivityKind, AgentStatus, Subtask } from "../src/data/types.ts";
import { STATUS_META } from "../src/lib/status.ts";

const STATUSES: readonly AgentStatus[] = [
  "working",
  "thinking",
  "waiting",
  "blocked",
  "idle",
  "done",
];
const KINDS: readonly ActivityKind[] = ["done", "start", "status", "note"];
const MAX_TEXT = 500;
const MAX_ACTIVITY_PER_REPORT = 20;
const MAX_SUBTASKS = 50;

export interface ReportedActivity {
  text: string;
  kind?: ActivityKind;
}

export interface StatusReport {
  agentId: string;
  status?: AgentStatus;
  currentTask?: string;
  taskDescription?: string;
  progress?: number;
  subtasks?: Subtask[];
  waitingOn?: string | null;
  blockedReason?: string | null;
  nextUp?: string;
  activity: ReportedActivity[];
}

export type ParseResult = { ok: true; report: StatusReport } | { ok: false; errors: string[] };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function readText(
  body: Record<string, unknown>,
  key: string,
  errors: string[],
  max = MAX_TEXT,
): string | undefined {
  const v = body[key];
  if (v === undefined) return undefined;
  if (typeof v !== "string") {
    errors.push(`${key} must be a string`);
    return undefined;
  }
  const trimmed = v.trim();
  if (trimmed.length > max) {
    errors.push(`${key} must be at most ${max} characters`);
    return undefined;
  }
  return trimmed;
}

function readNullableText(
  body: Record<string, unknown>,
  key: string,
  errors: string[],
): string | null | undefined {
  if (body[key] === null) return null;
  return readText(body, key, errors);
}

function readActivity(value: unknown, errors: string[]): ReportedActivity[] {
  if (value === undefined || value === null) return [];
  const items = Array.isArray(value) ? value : [value];
  if (items.length > MAX_ACTIVITY_PER_REPORT) {
    errors.push(`activity may hold at most ${MAX_ACTIVITY_PER_REPORT} entries per report`);
    return [];
  }
  const out: ReportedActivity[] = [];
  for (const item of items) {
    if (typeof item === "string") {
      const text = item.trim();
      if (text) out.push({ text: text.slice(0, MAX_TEXT) });
      continue;
    }
    if (isRecord(item) && typeof item.text === "string") {
      const text = item.text.trim().slice(0, MAX_TEXT);
      if (!text) continue;
      const kind = item.kind;
      if (kind !== undefined && !KINDS.includes(kind as ActivityKind)) {
        errors.push(`activity kind must be one of ${KINDS.join(", ")}`);
        continue;
      }
      out.push(kind === undefined ? { text } : { text, kind: kind as ActivityKind });
      continue;
    }
    errors.push("activity entries must be strings or { text, kind? } objects");
  }
  return out;
}

function readSubtasks(value: unknown, errors: string[]): Subtask[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > MAX_SUBTASKS) {
    errors.push(`subtasks must be an array of at most ${MAX_SUBTASKS} { label, done } items`);
    return undefined;
  }
  const out: Subtask[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.label !== "string") {
      errors.push("each subtask needs a string label");
      return undefined;
    }
    out.push({ label: item.label.trim().slice(0, MAX_TEXT), done: item.done === true });
  }
  return out;
}

export function parseReport(body: unknown): ParseResult {
  if (!isRecord(body)) return { ok: false, errors: ["body must be a JSON object"] };
  const errors: string[] = [];

  const agentId = typeof body.agentId === "string" ? body.agentId.trim() : "";
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(agentId)) {
    errors.push("agentId is required: 1 to 64 letters, digits, '-' or '_'");
  }

  let status: AgentStatus | undefined;
  if (body.status !== undefined) {
    if (typeof body.status === "string" && STATUSES.includes(body.status as AgentStatus)) {
      status = body.status as AgentStatus;
    } else {
      errors.push(`status must be one of ${STATUSES.join(", ")}`);
    }
  }

  let progress: number | undefined;
  if (body.progress !== undefined) {
    const n = typeof body.progress === "number" ? body.progress : Number.NaN;
    if (Number.isFinite(n) && n >= 0 && n <= 100) progress = Math.round(n);
    else errors.push("progress must be a number from 0 to 100");
  }

  const currentTask = readText(body, "currentTask", errors, 200);
  const taskDescription = readText(body, "taskDescription", errors);
  const nextUp = readText(body, "nextUp", errors, 200);
  const waitingOn = readNullableText(body, "waitingOn", errors);
  const blockedReason = readNullableText(body, "blockedReason", errors);
  const subtasks = readSubtasks(body.subtasks, errors);
  const activity = readActivity(body.activity, errors);

  if (errors.length > 0) return { ok: false, errors };
  const report: StatusReport = { agentId, activity };
  if (status !== undefined) report.status = status;
  if (currentTask !== undefined) report.currentTask = currentTask;
  if (taskDescription !== undefined) report.taskDescription = taskDescription;
  if (progress !== undefined) report.progress = progress;
  if (subtasks !== undefined) report.subtasks = subtasks;
  if (waitingOn !== undefined) report.waitingOn = waitingOn;
  if (blockedReason !== undefined) report.blockedReason = blockedReason;
  if (nextUp !== undefined) report.nextUp = nextUp;
  return { ok: true, report };
}

/** Constant-time comparison of the presented key against the configured one. */
export function checkApiKey(presented: string | undefined, expected: string): boolean {
  if (!presented || !expected) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

/** Reads the key from `x-api-key` or `Authorization: Bearer <key>`. */
export function presentedKey(
  headers: Record<string, string | string[] | undefined>,
): string | undefined {
  const direct = headers["x-api-key"];
  if (typeof direct === "string" && direct) return direct.trim();
  const auth = headers.authorization;
  if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer "))
    return auth.slice(7).trim();
  return undefined;
}

export interface AgentUpdate {
  patch: Partial<AgentRow>;
  /** Activity rows to insert alongside the update. */
  activity: ReportedActivity[];
  statusChanged: boolean;
}

const lower = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

function describeStatus(row: AgentRow, status: AgentStatus, patch: Partial<AgentRow>): string {
  const task = lower(patch.current_task ?? row.current_task) || "its task";
  switch (status) {
    case "working":
      return `${row.name} is working on ${task}`;
    case "thinking":
      return `${row.name} is thinking through ${task}`;
    case "waiting": {
      const who = patch.waiting_on ?? row.waiting_on;
      return who
        ? `${row.name} is waiting on ${who === "human" ? "you" : who}`
        : `${row.name} is waiting`;
    }
    case "blocked": {
      const why = patch.blocked_reason ?? row.blocked_reason;
      return why ? `${row.name} is blocked: ${lower(why)}` : `${row.name} is blocked`;
    }
    case "idle":
      return `${row.name} is ${STATUS_META.idle.verb}`;
    case "done":
      return `${row.name} finished ${task}`;
  }
}

/** Turns a validated report into the row patch and the activity to log. */
export function buildAgentUpdate(row: AgentRow, report: StatusReport, now: Date): AgentUpdate {
  const patch: Partial<AgentRow> = {};
  if (report.currentTask !== undefined) patch.current_task = report.currentTask;
  if (report.taskDescription !== undefined) patch.task_description = report.taskDescription;
  if (report.progress !== undefined) patch.progress = report.progress;
  if (report.subtasks !== undefined) patch.subtasks = report.subtasks;
  if (report.nextUp !== undefined) patch.next_up = report.nextUp;
  if (report.waitingOn !== undefined) patch.waiting_on = report.waitingOn;
  if (report.blockedReason !== undefined) patch.blocked_reason = report.blockedReason;

  const statusChanged = report.status !== undefined && report.status !== row.status;
  if (report.status !== undefined) {
    patch.status = report.status;
    if (statusChanged) patch.status_since = now.toISOString();
    if (report.status !== "waiting" && report.waitingOn === undefined) patch.waiting_on = null;
    if (report.status !== "blocked" && report.blockedReason === undefined)
      patch.blocked_reason = null;
  }

  const activity = [...report.activity];
  if (statusChanged && activity.length === 0 && report.status) {
    activity.push({
      text: describeStatus(row, report.status, patch),
      kind: report.status === "done" ? "done" : "status",
    });
  }
  return { patch, activity, statusChanged };
}
