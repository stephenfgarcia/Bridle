/**
 * The live source: loads the office from Supabase and applies realtime changes as they stream in.
 * Implements the AgentSource seam used by useAgents().
 */
import {
  createClient,
  type RealtimePostgresChangesPayload,
  type SupabaseClient,
} from "@supabase/supabase-js";
import type { HqSnapshot } from "../types";
import type { LiveConfig } from "./config";
import type { ActivityRow, AgentRow, ProjectRow } from "./rows";
import {
  applyActivityInsert,
  applyAgentEvent,
  applyProjectEvent,
  buildState,
  emptyState,
  type LiveState,
  MAX_LIVE_ACTIVITY,
  toSnapshot,
} from "./state";

export type LiveStatus = "unconfigured" | "connecting" | "connected" | "error";

export interface LiveListener {
  onSnapshot(snapshot: HqSnapshot): void;
  onStatus(status: LiveStatus, detail?: string): void;
}

export interface AgentSource {
  /** Starts streaming; returns a function that stops it. */
  subscribe(listener: LiveListener): () => void;
}

/** Safety net: a full refetch this often, in case a realtime event was ever missed. */
export const RESYNC_INTERVAL_MS = 60_000;

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

async function loadProject(client: SupabaseClient, projectId?: string): Promise<ProjectRow | null> {
  let query = client.from("projects").select("*");
  query = projectId ? query.eq("id", projectId) : query.order("created_at", { ascending: true });
  const { data, error } = await query.limit(1);
  if (error) throw new Error(error.message);
  return (data?.[0] as ProjectRow | undefined) ?? null;
}

async function loadAgents(client: SupabaseClient, projectId: string): Promise<AgentRow[]> {
  const { data, error } = await client.from("agents").select("*").eq("project_id", projectId);
  if (error) throw new Error(error.message);
  return (data ?? []) as AgentRow[];
}

async function loadActivity(client: SupabaseClient, agentIds: string[]): Promise<ActivityRow[]> {
  if (agentIds.length === 0) return [];
  const { data, error } = await client
    .from("agent_activity")
    .select("*")
    .in("agent_id", agentIds)
    .order("time", { ascending: false })
    .limit(MAX_LIVE_ACTIVITY * agentIds.length);
  if (error) throw new Error(error.message);
  return (data ?? []) as ActivityRow[];
}

/** The row a change payload carries: the new row, or for deletes the old one. */
function rowOf<T extends object>(payload: RealtimePostgresChangesPayload<T>): Partial<T> {
  return payload.eventType === "DELETE" ? payload.old : (payload.new as Partial<T>);
}

export function createSupabaseSource(config: LiveConfig): AgentSource {
  return {
    subscribe(listener) {
      const client = createClient(config.url, config.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      let state: LiveState = emptyState();
      let ready = false;
      let stopped = false;
      let pending: Array<(s: LiveState) => LiveState> = [];

      const emit = () => {
        const snapshot = toSnapshot(state);
        if (snapshot) listener.onSnapshot(snapshot);
      };

      const apply = (reducer: (s: LiveState) => LiveState) => {
        if (!ready) {
          pending.push(reducer);
          return;
        }
        state = reducer(state);
        emit();
      };

      const load = async () => {
        ready = false;
        try {
          const project = await loadProject(client, config.projectId);
          if (stopped) return;
          if (!project) {
            listener.onStatus("error", "no project row yet (run the seed)");
            return;
          }
          const agents = await loadAgents(client, project.id);
          const activity = await loadActivity(
            client,
            agents.map((a) => a.id),
          );
          if (stopped) return;
          state = buildState(project, agents, activity);
          for (const reducer of pending) state = reducer(state);
          pending = [];
          ready = true;
          listener.onStatus("connected");
          emit();
        } catch (e) {
          if (!stopped) listener.onStatus("error", errorMessage(e));
        }
      };

      const channel = client
        .channel("agent-hq")
        .on<AgentRow>(
          "postgres_changes",
          { event: "*", schema: "public", table: "agents" },
          (payload) => apply((s) => applyAgentEvent(s, payload.eventType, rowOf(payload))),
        )
        .on<ActivityRow>(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "agent_activity" },
          (payload) => apply((s) => applyActivityInsert(s, payload.new as ActivityRow)),
        )
        .on<ProjectRow>(
          "postgres_changes",
          { event: "*", schema: "public", table: "projects" },
          (payload) => apply((s) => applyProjectEvent(s, payload.eventType, rowOf(payload))),
        )
        .subscribe((status, err) => {
          if (stopped) return;
          if (status === "SUBSCRIBED") {
            void load();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            listener.onStatus(
              "error",
              err ? errorMessage(err) : `realtime ${status.toLowerCase()}`,
            );
          } else if (status === "CLOSED") {
            listener.onStatus("connecting", "reconnecting");
          }
        });

      listener.onStatus("connecting");

      const resync = window.setInterval(() => {
        if (ready) void load();
      }, RESYNC_INTERVAL_MS);
      const onVisible = () => {
        if (document.visibilityState === "visible" && ready) void load();
      };
      document.addEventListener("visibilitychange", onVisible);

      return () => {
        stopped = true;
        window.clearInterval(resync);
        document.removeEventListener("visibilitychange", onVisible);
        void client.removeChannel(channel);
      };
    },
  };
}
