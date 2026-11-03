/**
 * The one hook the UI reads from.
 * Demo mode advances the seed data on a timer. When a live source is configured it streams the
 * office from the database, and the first live snapshot switches the app to Live automatically.
 */
import { useEffect, useRef, useState } from "react";
import { createSeed } from "./agents";
import { demoIntervalMs, demoStep, demoSwitch, demoSwitchIntervalMs } from "./demo";
import { readLiveConfig } from "./live/config";
import { type AgentSource, createSupabaseSource, type LiveStatus } from "./live/supabaseSource";
import type { HqSnapshot } from "./types";

export type DataMode = "demo" | "live";
export type { AgentSource, LiveStatus };

let defaultSource: AgentSource | null | undefined;

/** The source built from VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, or null when unset. */
function getDefaultSource(): AgentSource | null {
  if (defaultSource === undefined) {
    const config = readLiveConfig(import.meta.env as Record<string, string | undefined>);
    defaultSource = config ? createSupabaseSource(config) : null;
  }
  return defaultSource;
}

const EMPTY_LIVE: HqSnapshot = {
  project: { name: "Waiting for live data", deadline: "2026-12-31", milestones: [] },
  agents: [],
};

export interface UseAgentsOptions {
  /** Override the live source (tests, other backends). `null` disables live mode. */
  source?: AgentSource | null;
}

export interface UseAgentsResult extends HqSnapshot {
  mode: DataMode;
  setMode: (mode: DataMode) => void;
  liveStatus: LiveStatus;
  liveDetail?: string;
  /** True once the live source has delivered a snapshot and is still connected. */
  liveConnected: boolean;
}

export function useAgents(options: UseAgentsOptions = {}): UseAgentsResult {
  const source = options.source === undefined ? getDefaultSource() : options.source;
  const [demo, setDemo] = useState<HqSnapshot>(() => createSeed(new Date()));
  const [live, setLive] = useState<HqSnapshot | null>(null);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>(source ? "connecting" : "unconfigured");
  const [liveDetail, setLiveDetail] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<DataMode>("demo");
  const autoSwitched = useRef(false);

  useEffect(() => {
    if (!source) return;
    return source.subscribe({
      onSnapshot: (snapshot) => {
        setLive(snapshot);
        if (!autoSwitched.current) {
          autoSwitched.current = true;
          setMode("live");
        }
      },
      onStatus: (status, detail) => {
        setLiveStatus(status);
        setLiveDetail(detail);
      },
    });
  }, [source]);

  useEffect(() => {
    if (mode !== "demo") return;
    let timer = 0;
    const tick = () => {
      setDemo((current) => demoStep(current, Math.random, new Date()));
      timer = window.setTimeout(tick, demoIntervalMs(Math.random));
    };
    timer = window.setTimeout(tick, demoIntervalMs(Math.random));
    let switchTimer = 0;
    const flip = () => {
      setDemo((current) => demoSwitch(current, Math.random, new Date()));
      switchTimer = window.setTimeout(flip, demoSwitchIntervalMs(Math.random));
    };
    switchTimer = window.setTimeout(flip, demoSwitchIntervalMs(Math.random));
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(switchTimer);
    };
  }, [mode]);

  const snapshot = mode === "live" ? (live ?? EMPTY_LIVE) : demo;
  return {
    ...snapshot,
    mode,
    setMode,
    liveStatus,
    liveDetail,
    liveConnected: liveStatus === "connected" && live !== null,
  };
}
