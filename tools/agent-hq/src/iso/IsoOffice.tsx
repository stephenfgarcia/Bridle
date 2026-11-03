import { useReducedMotion } from "motion/react";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentTag } from "../components/AgentTag";
import { FeedPanel, OverviewPanel, StatsPanel } from "../components/ScreenWall";
import type { Agent, Project } from "../data/types";
import { useMediaQuery } from "../lib/hooks";
import { layoutPods, ROOM } from "../three/layout";
import type { Bubble, Mode } from "../three/sim/brain";
import { CrowdSim } from "../three/sim/crowd";
import { ARC, arcPoint, IsoRenderer } from "./IsoRenderer";
import {
  type Camera,
  clampCamera,
  fitCamera,
  fromScreen,
  ISO_X,
  ISO_Y,
  toScreen,
} from "./projection";

interface Props {
  project: Project;
  agents: Agent[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  tv: boolean;
}

type ZoneKey = "overview" | "work" | "cafeteria" | "wall";

const ZONES: { key: ZoneKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "work", label: "Work floor" },
  { key: "cafeteria", label: "Cafeteria" },
  { key: "wall", label: "Command wall" },
];

/** Zone presets as a floor centre plus a zoom factor relative to the fit-to-room zoom. */
const ZONE_VIEWS: Record<ZoneKey, { cx: number; cz: number; k: number }> = {
  overview: { cx: 0, cz: 1, k: 1 },
  work: { cx: -3.3, cz: 0.8, k: 2.1 },
  cafeteria: { cx: 12.4, cz: 1.6, k: 2.3 },
  wall: { cx: 0, cz: -9.5, k: 2.1 },
};

const TOUR: { key: ZoneKey; seconds: number }[] = [
  { key: "work", seconds: 14 },
  { key: "wall", seconds: 12 },
  { key: "cafeteria", seconds: 12 },
  { key: "overview", seconds: 12 },
];

const PANEL_ANGLES: { key: "feed" | "overview" | "stats"; angle: number; wide: boolean }[] = [
  { key: "feed", angle: -0.72, wide: false },
  { key: "overview", angle: 0, wide: true },
  { key: "stats", angle: 0.72, wide: false },
];

const bounds = { ...ROOM };

function damp(current: number, target: number, smooth: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-dt / smooth));
}

/** The isometric 2.5D office: Canvas 2D for shapes, HTML overlay for every piece of text. */
export default function IsoOffice({ project, agents, selectedId, onSelect, tv }: Props) {
  const reduced = useReducedMotion() === true;
  const isPhone = useMediaQuery("(max-width: 720px)");
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<IsoRenderer | null>(null);
  const sizeRef = useRef({ w: 1, h: 1, dpr: 1 });
  const camRef = useRef<Camera>({ cx: 0, cz: 1, zoom: 0.5 });
  const fitZoomRef = useRef(0.5);
  const fittedRef = useRef(false);
  const goalRef = useRef<Camera | null>(null);
  const followRef = useRef<string | null>(null);
  const tourRef = useRef({
    index: 0,
    start: -1,
    agent: null as { id: string; until: number } | null,
  });
  const changesRef = useRef<{ id: string; at: number }[]>([]);
  const statusesRef = useRef(new Map<string, string>());
  const drag = useRef<{
    x: number;
    y: number;
    moved: boolean;
    pointers: Map<number, { x: number; y: number }>;
    pinch: number;
  } | null>(null);

  const [zone, setZone] = useState<ZoneKey | null>("overview");
  const [followId, setFollowId] = useState<string | null>(null);
  const [compact, setCompact] = useState(true);
  const [bubbles, setBubbles] = useState<Map<string, Bubble>>(new Map());
  const [modes, setModes] = useState<Map<string, Mode>>(new Map());

  const pods = useMemo(() => layoutPods(agents.length), [agents.length]);
  const idsKey = agents.map((a) => a.id).join("|");
  const sim = useMemo(() => new CrowdSim(pods, idsKey.split("|").filter(Boolean)), [pods, idsKey]);
  sim.sync(agents);
  const agentsRef = useRef(agents);
  agentsRef.current = agents;
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const tvRef = useRef(tv);
  tvRef.current = tv;

  useEffect(() => {
    const previous = statusesRef.current;
    const next = new Map<string, string>();
    for (const a of agents) {
      next.set(a.id, a.status);
      const was = previous.get(a.id);
      if (was !== undefined && was !== a.status)
        changesRef.current.push({ id: a.id, at: performance.now() / 1000 });
    }
    statusesRef.current = next;
  }, [agents]);

  const zoneCamera = useCallback((key: ZoneKey): Camera => {
    const v = ZONE_VIEWS[key];
    const fit = fitZoomRef.current;
    return key === "overview"
      ? fitCamera(bounds, sizeRef.current.w, sizeRef.current.h)
      : { cx: v.cx, cz: v.cz, zoom: fit * v.k };
  }, []);

  const jump = (key: ZoneKey) => {
    followRef.current = null;
    setFollowId(null);
    goalRef.current = zoneCamera(key);
    setZone(key);
  };

  const select = useCallback(
    (id: string) => {
      onSelect(id);
      followRef.current = id;
      setFollowId(id);
      setZone(null);
      const pose = sim.pose(id);
      if (pose)
        goalRef.current = {
          cx: pose.x,
          cz: pose.z,
          zoom: Math.max(camRef.current.zoom, fitZoomRef.current * 2.1),
        };
    },
    [onSelect, sim],
  );

  useEffect(() => {
    if (!selectedId) {
      followRef.current = null;
      setFollowId(null);
    }
  }, [selectedId]);

  useEffect(() => {
    if (tv) {
      followRef.current = null;
      setFollowId(null);
      tourRef.current = { index: 0, start: -1, agent: null };
    }
  }, [tv]);

  // Canvas sizing
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    rendererRef.current = new IsoRenderer(canvas);
    const update = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      sizeRef.current = { w, h, dpr };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      rendererRef.current?.resize(w, h, dpr);
      const fit = fitCamera(bounds, w, h);
      fitZoomRef.current = fit.zoom;
      if (!fittedRef.current) {
        camRef.current = fit;
        fittedRef.current = true;
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  // Main loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastBubbleKey = "";
    let lastModeKey = "";
    const tick = (nowMs: number) => {
      raf = window.requestAnimationFrame(tick);
      const now = nowMs / 1000;
      const dt = Math.min(0.1, (nowMs - last) / 1000);
      last = nowMs;
      const { w, h } = sizeRef.current;
      const red = reducedRef.current;
      sim.step(dt, now);

      // camera
      const cam = camRef.current;
      if (tvRef.current) {
        runTour(now, dt);
      } else {
        const goal = goalRef.current;
        const follow = followRef.current ? sim.pose(followRef.current) : undefined;
        if (follow && goal) {
          goal.cx = follow.x;
          goal.cz = follow.z;
        }
        if (goal) {
          if (red) {
            cam.cx = goal.cx;
            cam.cz = goal.cz;
            cam.zoom = goal.zoom;
            goalRef.current = null;
          } else {
            cam.cx = damp(cam.cx, goal.cx, 0.3, dt);
            cam.cz = damp(cam.cz, goal.cz, 0.3, dt);
            cam.zoom = damp(cam.zoom, goal.zoom, 0.3, dt);
            if (
              Math.abs(cam.cx - goal.cx) < 0.01 &&
              Math.abs(cam.cz - goal.cz) < 0.01 &&
              Math.abs(cam.zoom - goal.zoom) < 0.002
            ) {
              goalRef.current = null;
            }
          }
        } else if (follow) {
          if (red) {
            cam.cx = follow.x;
            cam.cz = follow.z;
          } else {
            cam.cx = damp(cam.cx, follow.x, 0.25, dt);
            cam.cz = damp(cam.cz, follow.z, 0.25, dt);
          }
        }
      }
      camRef.current = clampCamera(cam, bounds, fitZoomRef.current * 0.6, fitZoomRef.current * 5);

      rendererRef.current?.render(camRef.current, {
        agents: agentsRef.current,
        poses: sim.poses,
        pods,
        waitPairs: sim.waitPairs(),
        selectedId: selectedRef.current,
        time: now,
        reduced: red,
      });

      // overlay positions
      const overlay = overlayRef.current;
      if (overlay) {
        const c = camRef.current;
        const tagScale = Math.min(1.25, Math.max(0.7, c.zoom * 0.9));
        for (const el of overlay.querySelectorAll<HTMLElement>("[data-iso-agent]")) {
          const id = el.dataset.isoAgent ?? "";
          const pose = sim.pose(id);
          if (!pose) continue;
          const kind = el.dataset.isoKind;
          const hip = 0.92 - 0.42 * pose.seated;
          const y = kind === "bubble" ? hip + 1.35 : hip + 1.7;
          const s = toScreen(
            c,
            w,
            h,
            pose.x + (kind === "bubble" ? 0.35 : 0),
            y + pose.bob,
            pose.z + (kind === "bubble" ? -0.35 : 0),
          );
          el.style.transform = `translate(${s.sx.toFixed(1)}px, ${s.sy.toFixed(1)}px) translate(${kind === "bubble" ? "4px" : "-50%"}, -100%) scale(${tagScale.toFixed(3)})`;
        }
        for (const el of overlay.querySelectorAll<HTMLElement>("[data-iso-fixed]")) {
          const [x, y, z] = (el.dataset.isoFixed ?? "0,0,0").split(",").map(Number);
          const s = toScreen(c, w, h, x ?? 0, y ?? 0, z ?? 0);
          const panel = el.dataset.isoScale === "panel";
          const scale = panel ? c.zoom * 0.48 : Math.min(1.1, Math.max(0.55, c.zoom * 0.8));
          el.style.transform = `translate(${s.sx.toFixed(1)}px, ${s.sy.toFixed(1)}px) translate(-50%, -50%) scale(${scale.toFixed(3)})`;
          el.style.visibility =
            c.zoom < (panel ? fitZoomRef.current * 1.6 : 0.8) ? "hidden" : "visible";
        }
      }

      // rare React updates: compact tags, bubbles, modes, panel scale
      const nextCompact = camRef.current.zoom < fitZoomRef.current * 1.5;
      setCompact((prev) => (prev === nextCompact ? prev : nextCompact));
      const bubbleKey = [...sim.brains.values()]
        .map((b) => `${b.id}:${b.pose.bubble?.id ?? 0}`)
        .join("|");
      if (bubbleKey !== lastBubbleKey) {
        lastBubbleKey = bubbleKey;
        const next = new Map<string, Bubble>();
        for (const b of sim.brains.values()) if (b.pose.bubble) next.set(b.id, b.pose.bubble);
        setBubbles(next);
      }
      const modeKey = [...sim.brains.values()].map((b) => `${b.id}:${b.mode}`).join("|");
      if (modeKey !== lastModeKey) {
        lastModeKey = modeKey;
        setModes(new Map([...sim.brains.values()].map((b) => [b.id, b.mode])));
      }
    };

    const runTour = (now: number, dt: number) => {
      const t = tourRef.current;
      const cam = camRef.current;
      const red = reducedRef.current;
      if (t.start < 0) t.start = now;
      if (t.agent) {
        const pose = sim.pose(t.agent.id);
        if (!pose || now > t.agent.until) {
          t.agent = null;
          t.start = now;
        } else {
          const target = { cx: pose.x, cz: pose.z, zoom: fitZoomRef.current * 2.3 };
          if (red) Object.assign(cam, target);
          else {
            cam.cx = damp(cam.cx, target.cx, 0.6, dt);
            cam.cz = damp(cam.cz, target.cz, 0.6, dt);
            cam.zoom = damp(cam.zoom, target.zoom, 0.6, dt);
          }
          return;
        }
      }
      const shot = TOUR[t.index % TOUR.length] ?? TOUR[0];
      if (!shot) return;
      const u = (now - t.start) / shot.seconds;
      if (u >= 1) {
        t.index = (t.index + 1) % TOUR.length;
        t.start = now;
      }
      if (u > 0.35) {
        const list = changesRef.current;
        while (list.length > 0 && (list[0]?.at ?? 0) < now - 25) list.shift();
        const change = list.find((ch) => sim.pose(ch.id));
        if (change) {
          list.splice(list.indexOf(change), 1);
          t.agent = { id: change.id, until: now + 8 };
          return;
        }
      }
      const base = zoneCamera(shot.key);
      const drift = red ? 0 : Math.min(1, Math.max(0, u)) * 2.4 - 1.2;
      const target = { cx: base.cx + drift, cz: base.cz + drift * 0.5, zoom: base.zoom };
      if (red) Object.assign(cam, target);
      else {
        cam.cx = damp(cam.cx, target.cx, 0.9, dt);
        cam.cz = damp(cam.cz, target.cz, 0.9, dt);
        cam.zoom = damp(cam.zoom, target.zoom, 0.9, dt);
      }
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [sim, pods, zoneCamera]);

  // Pointer interaction: drag to pan, wheel/pinch to zoom, click to select.
  const onPointerDown = (e: React.PointerEvent) => {
    if (tv) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const d = drag.current ?? {
      x: e.clientX,
      y: e.clientY,
      moved: false,
      pointers: new Map(),
      pinch: 0,
    };
    d.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (d.pointers.size === 2) {
      const [a, b] = [...d.pointers.values()];
      d.pinch = a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    }
    drag.current = d;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || tv) return;
    const prev = d.pointers.get(e.pointerId);
    if (!prev) return;
    d.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const cam = camRef.current;
    if (d.pointers.size >= 2) {
      const [a, b] = [...d.pointers.values()];
      if (a && b) {
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (d.pinch > 0) cam.zoom *= dist / d.pinch;
        d.pinch = dist;
        d.moved = true;
      }
      return;
    }
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) return;
    d.moved = true;
    followRef.current = null;
    setFollowId(null);
    goalRef.current = null;
    setZone(null);
    const a = -dx / cam.zoom / ISO_X;
    const b = -dy / cam.zoom / ISO_Y;
    cam.cx += (a + b) / 2;
    cam.cz += (b - a) / 2;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    d.pointers.delete(e.pointerId);
    if (d.pointers.size > 0) return;
    drag.current = null;
    if (d.moved || tv) return;
    // click: hit test robots first, then desks
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { w, h } = sizeRef.current;
    const cam = camRef.current;
    let best: { id: string; d: number } | null = null;
    for (const [id, pose] of sim.poses) {
      const s = toScreen(cam, w, h, pose.x, 0.9, pose.z);
      const dist = Math.hypot(s.sx - sx, s.sy - sy);
      if (dist < 34 * cam.zoom && (!best || dist < best.d)) best = { id, d: dist };
    }
    if (best) {
      select(best.id);
      return;
    }
    const floor = fromScreen(cam, w, h, sx, sy);
    for (let i = 0; i < pods.length; i += 1) {
      const pod = pods[i];
      const agent = agentsRef.current[i];
      if (!pod || !agent) continue;
      const [px, , pz] = pod.position;
      if (floor.x > px - 1.5 && floor.x < px + 2.1 && floor.z > pz - 1.5 && floor.z < pz + 2.0) {
        select(agent.id);
        return;
      }
    }
    followRef.current = null;
    setFollowId(null);
    onSelect(null);
  };

  const onWheel = (e: React.WheelEvent) => {
    if (tv) return;
    const cam = camRef.current;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { w, h } = sizeRef.current;
    const before = fromScreen(cam, w, h, sx, sy);
    const factor = Math.exp(-e.deltaY * 0.0012);
    const next = clampCamera(
      { ...cam, zoom: cam.zoom * factor },
      bounds,
      fitZoomRef.current * 0.6,
      fitZoomRef.current * 5,
    );
    const after = fromScreen(next, w, h, sx, sy);
    next.cx += before.x - after.x;
    next.cz += before.z - after.z;
    camRef.current = next;
    goalRef.current = null;
    setZone(null);
  };

  const panelAnchor = (angle: number) => {
    const p = arcPoint(angle, ARC.r - 0.3);
    return `${p.x},3.2,${p.z}`;
  };

  return (
    <div className="iso">
      <div
        ref={wrapRef}
        className="iso-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        role="application"
        aria-label="Isometric office"
      >
        <canvas ref={canvasRef} className="iso-canvas" />
        <div ref={overlayRef} className="iso-overlay" aria-hidden="true">
          {PANEL_ANGLES.map((p) => (
            <div
              key={p.key}
              className={p.wide ? "iso-panel iso-panel--wide" : "iso-panel"}
              data-iso-fixed={panelAnchor(p.angle)}
              data-iso-scale="panel"
            >
              {p.key === "feed" && <FeedPanel agents={agents} className="panel panel3d" />}
              {p.key === "overview" && (
                <OverviewPanel project={project} agents={agents} className="panel panel3d" />
              )}
              {p.key === "stats" && <StatsPanel agents={agents} className="panel panel3d" />}
            </div>
          ))}
          <div className="iso-sign" data-iso-fixed="15.1,3.6,-4.2" data-iso-scale="sign">
            <span className="neon-sign neon-sign--iso">CAFÉ</span>
          </div>
          {pods.map((pod, i) => {
            const agent = agents[i];
            if (!agent) return null;
            return (
              <div
                key={agent.id}
                className="iso-plate"
                data-iso-fixed={`${pod.position[0] + 1.1},0.95,${pod.position[2] + 1.72}`}
              >
                <div className="plate" style={{ "--accent": agent.color } as CSSProperties}>
                  {agent.name}
                  <small>{agent.role}</small>
                </div>
              </div>
            );
          })}
          {agents.map((agent) => (
            <div
              key={agent.id}
              className={compact ? "iso-tag iso-tag--dot" : "iso-tag"}
              data-iso-agent={agent.id}
              data-iso-kind="tag"
              data-agent={agent.id}
              data-mode={modes.get(agent.id) ?? ""}
              style={{ "--accent": agent.color } as CSSProperties}
            >
              {compact ? <div className="tag-dot" /> : <AgentTag agent={agent} />}
            </div>
          ))}
          {[...bubbles].map(([id, bubble]) => (
            <div
              key={`${id}-${bubble.id}`}
              className="iso-bubble"
              data-iso-agent={id}
              data-iso-kind="bubble"
            >
              <div className={`bubble bubble--${bubble.kind}`}>{bubble.text}</div>
            </div>
          ))}
        </div>
      </div>
      {!tv && (
        <div className="zone-bar">
          <fieldset className="zone-group">
            <legend className="sr-only">Jump the view to</legend>
            {ZONES.map((z) => (
              <button
                key={z.key}
                type="button"
                aria-pressed={zone === z.key}
                onClick={() => jump(z.key)}
              >
                {z.label}
              </button>
            ))}
          </fieldset>
          {followId && (
            <span className="zone-note zone-note--follow">following · click away to stop</span>
          )}
        </div>
      )}
      {!tv && !isPhone && (
        <div className="view3d-hint">drag to pan · scroll to zoom · click an agent to follow</div>
      )}
    </div>
  );
}
