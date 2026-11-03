import { MotionConfig } from "motion/react";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { AgentDrawer } from "./components/AgentDrawer";
import { ListView } from "./components/ListView";
import { OfficeScene } from "./components/OfficeScene";
import { TopBar, type ViewMode } from "./components/TopBar";
import { useAgents } from "./data/useAgents";
import { useMediaQuery } from "./lib/hooks";

const Office3D = lazy(() => import("./three/Office3D"));
const IsoOffice = lazy(() => import("./iso/IsoOffice"));

export function App() {
  const hq = useAgents();
  const isPhone = useMediaQuery("(max-width: 720px)");
  const [viewChoice, setViewChoice] = useState<ViewMode | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tv, setTv] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(false);

  const chosen: ViewMode = viewChoice ?? (isPhone ? "list" : "office3d");
  const view: ViewMode = tv && chosen === "list" ? "office3d" : chosen;
  const selected = hq.agents.find((a) => a.id === selectedId) ?? null;

  const enterTv = () => {
    setTv(true);
    setSelectedId(null);
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => undefined);
  };

  const exitTv = useCallback(() => {
    setTv(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!tv) return;
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setTv(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") exitTv();
    };
    let hideTimer = 0;
    const onMove = () => {
      setCursorVisible(true);
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setCursorVisible(false), 2200);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousemove", onMove);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousemove", onMove);
      window.clearTimeout(hideTimer);
      setCursorVisible(false);
    };
  }, [tv, exitTv]);

  const appClass = ["app", tv ? "app--tv" : "", tv && cursorVisible ? "app--cursor" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <MotionConfig reducedMotion="user">
      <div className={appClass}>
        {!tv && (
          <TopBar
            project={hq.project}
            agents={hq.agents}
            mode={hq.mode}
            liveStatus={hq.liveStatus}
            liveDetail={hq.liveDetail}
            onMode={hq.setMode}
            view={view}
            onView={setViewChoice}
            onTv={enterTv}
          />
        )}
        <main className="app-main">
          {view === "office3d" && (
            <Suspense fallback={<div className="webgl-fallback">Loading the 3D office…</div>}>
              <Office3D
                project={hq.project}
                agents={hq.agents}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onFallback={() => setViewChoice("office")}
                tv={tv}
              />
            </Suspense>
          )}
          {view === "iso" && (
            <Suspense
              fallback={<div className="webgl-fallback">Loading the isometric office…</div>}
            >
              <IsoOffice
                project={hq.project}
                agents={hq.agents}
                selectedId={selectedId}
                onSelect={setSelectedId}
                tv={tv}
              />
            </Suspense>
          )}
          {view === "office" && (
            <OfficeScene
              project={hq.project}
              agents={hq.agents}
              selectedId={selectedId}
              onSelect={setSelectedId}
              tv={tv}
            />
          )}
          {view === "list" && <ListView agents={hq.agents} onSelect={setSelectedId} />}
        </main>
        {!tv && (
          <AgentDrawer
            agent={selected}
            agents={hq.agents}
            onClose={() => setSelectedId(null)}
            modal={view !== "office3d" && view !== "iso"}
          />
        )}
        {tv && (
          <button type="button" className="btn tv-exit" onClick={exitTv}>
            Exit TV mode
          </button>
        )}
      </div>
    </MotionConfig>
  );
}
