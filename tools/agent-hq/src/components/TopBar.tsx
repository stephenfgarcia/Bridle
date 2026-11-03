import type { CSSProperties } from "react";
import type { Agent, Project } from "../data/types";
import type { DataMode, LiveStatus } from "../data/useAgents";
import { overallProgress, statusCounts } from "../lib/derive";
import { useNow } from "../lib/hooks";
import { STATUS_META, STATUS_ORDER } from "../lib/status";
import { formatClock } from "../lib/time";
import { StatusIcon } from "./StatusIcon";

export type ViewMode = "office3d" | "iso" | "office" | "list";

interface Props {
  project: Project;
  agents: Agent[];
  mode: DataMode;
  liveStatus: LiveStatus;
  liveDetail?: string;
  onMode: (mode: DataMode) => void;
  view: ViewMode;
  onView: (view: ViewMode) => void;
  onTv: () => void;
}

const LIVE_NOTES: Record<LiveStatus, string> = {
  unconfigured: "no live source configured",
  connecting: "connecting to live data",
  connected: "live",
  error: "live data error",
};

export function TopBar({
  project,
  agents,
  mode,
  liveStatus,
  liveDetail,
  onMode,
  view,
  onView,
  onTv,
}: Props) {
  const now = useNow(1000);
  const overall = overallProgress(agents);
  const counts = statusCounts(agents);
  const showNote = mode === "live" ? liveStatus !== "connected" : liveStatus === "error";
  const note = liveDetail ? `${LIVE_NOTES[liveStatus]}: ${liveDetail}` : LIVE_NOTES[liveStatus];
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        Agent HQ
      </div>
      <span className="topbar-project">{project.name}</span>
      <div className="topbar-progress">
        <span className="sr-only">Overall progress</span>
        <div className="bar">
          <i style={{ width: `${overall}%` }} />
        </div>
        <span className="bar-value mono">{overall}%</span>
      </div>
      <div className="chips">
        {STATUS_ORDER.map((s) => (
          <span
            key={s}
            className={counts[s] === 0 ? "chip chip--zero" : "chip"}
            style={{ "--c": STATUS_META[s].color } as CSSProperties}
          >
            <StatusIcon status={s} size={12} />
            {STATUS_META[s].label}
            <b>{counts[s]}</b>
          </span>
        ))}
      </div>
      <time className="clock" dateTime={now.toISOString()}>
        {formatClock(now)}
      </time>
      <fieldset className="seg">
        <legend className="sr-only">Data source</legend>
        <button type="button" aria-pressed={mode === "demo"} onClick={() => onMode("demo")}>
          Demo
        </button>
        <button type="button" aria-pressed={mode === "live"} onClick={() => onMode("live")}>
          <span className={`live-dot live-dot--${liveStatus}`} aria-hidden="true" />
          Live
        </button>
      </fieldset>
      {showNote && (
        <span className={`live-note live-note--${liveStatus}`} title={note}>
          {note}
        </span>
      )}
      <fieldset className="seg">
        <legend className="sr-only">View</legend>
        <button type="button" aria-pressed={view === "office3d"} onClick={() => onView("office3d")}>
          3D Office
        </button>
        <button type="button" aria-pressed={view === "iso"} onClick={() => onView("iso")}>
          Iso Office
        </button>
        <button type="button" aria-pressed={view === "office"} onClick={() => onView("office")}>
          2D Office
        </button>
        <button type="button" aria-pressed={view === "list"} onClick={() => onView("list")}>
          List
        </button>
      </fieldset>
      <button type="button" className="btn btn--tv" onClick={onTv}>
        TV mode
      </button>
    </header>
  );
}
