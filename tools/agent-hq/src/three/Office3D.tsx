import { Canvas, useFrame } from "@react-three/fiber";
import { useReducedMotion } from "motion/react";
import {
  Component,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Agent, Project } from "../data/types";
import { useMediaQuery } from "../lib/hooks";
import { CameraRig, type StatusChange } from "./CameraRig";
import { CAMERA_PRESETS, type CameraPreset, cameraForPose, layoutPods } from "./layout";
import { loadQuality, type Quality, QualityContext, saveQuality } from "./QualityContext";
import { Scene } from "./Scene";
import type { RobotPose } from "./sim/brain";

type ZoneKey = keyof typeof CAMERA_PRESETS;

const ZONES: { key: ZoneKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "work", label: "Work floor" },
  { key: "cafeteria", label: "Cafeteria" },
  { key: "wall", label: "Command wall" },
];

interface Props {
  project: Project;
  agents: Agent[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onFallback: () => void;
  tv: boolean;
}

interface BoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

class WebGLBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const LOW_FPS = 28;

/** Watches the frame rate after a warm-up and asks for Low quality when it stays low. */
function FpsGuard({ enabled, onDrop }: { enabled: boolean; onDrop: () => void }) {
  const times = useRef<number[]>([]);
  const start = useRef(-1);
  useFrame((state) => {
    if (!enabled) return;
    const t = state.clock.elapsedTime;
    if (start.current < 0) start.current = t;
    if (t - start.current < 5) return;
    const list = times.current;
    list.push(t);
    while (list.length > 0 && (list[0] ?? 0) < t - 3) list.shift();
    if (t - start.current > 9 && list.length < LOW_FPS * 3) {
      times.current = [];
      onDrop();
    }
  });
  return null;
}

/** The 3D office view: canvas, zone and quality controls, camera flights, follow mode, fallback. */
export default function Office3D({ project, agents, selectedId, onSelect, onFallback, tv }: Props) {
  const reduced = useReducedMotion() === true;
  const isPhone = useMediaQuery("(max-width: 720px)");
  const [quality, setQualityState] = useState<Quality>(
    () => loadQuality() ?? (isPhone ? "low" : "high"),
  );
  const [autoLow, setAutoLow] = useState(false);
  const [goal, setGoal] = useState<CameraPreset | null>(null);
  const [zone, setZone] = useState<ZoneKey | null>("overview");
  const [followId, setFollowId] = useState<string | null>(null);
  const pods = useMemo(() => layoutPods(agents.length), [agents.length]);
  const posesRef = useRef(new Map<string, RobotPose>());
  const changesRef = useRef<StatusChange[]>([]);
  const statusesRef = useRef(new Map<string, string>());

  useEffect(() => {
    const previous = statusesRef.current;
    const next = new Map<string, string>();
    for (const a of agents) {
      next.set(a.id, a.status);
      const was = previous.get(a.id);
      if (was !== undefined && was !== a.status)
        changesRef.current.push({ id: a.id, at: Date.now() / 1000 });
    }
    statusesRef.current = next;
  }, [agents]);

  const setQuality = (q: Quality) => {
    setQualityState(q);
    setAutoLow(false);
    saveQuality(q);
  };

  const flyToAgent = useCallback((id: string) => {
    const pose = posesRef.current.get(id);
    if (!pose) return;
    setGoal(cameraForPose(pose.x, pose.z, pose.heading));
    setZone(null);
  }, []);

  const select = (id: string) => {
    onSelect(id);
    setFollowId(id);
    flyToAgent(id);
  };

  const clickAway = () => {
    setFollowId(null);
    onSelect(null);
  };

  const jump = (key: ZoneKey) => {
    setFollowId(null);
    setGoal({ ...CAMERA_PRESETS[key] });
    setZone(key);
  };

  useEffect(() => {
    if (tv) setFollowId(null);
  }, [tv]);

  useEffect(() => {
    if (!selectedId) setFollowId(null);
  }, [selectedId]);

  const settings = useMemo(() => ({ quality, reduced }), [quality, reduced]);

  return (
    <div className="view3d">
      <WebGLBoundary
        fallback={
          <div className="webgl-fallback">
            <div>
              <b>3D view unavailable</b>
              WebGL could not start in this browser.
              <div style={{ marginTop: 12 }}>
                <button type="button" className="btn" onClick={onFallback}>
                  Open the 2D office
                </button>
              </div>
            </div>
          </div>
        }
      >
        <Canvas
          dpr={quality === "high" ? [1, 1.75] : 0.75}
          camera={{ position: CAMERA_PRESETS.overview.position, fov: 45, near: 0.1, far: 160 }}
          gl={{ antialias: quality === "high", powerPreference: "high-performance" }}
          onPointerMissed={clickAway}
        >
          <QualityContext.Provider value={settings}>
            <Scene
              project={project}
              agents={agents}
              pods={pods}
              selectedId={selectedId}
              onSelect={select}
              posesRef={posesRef}
            />
            <CameraRig
              goal={goal}
              followId={followId}
              posesRef={posesRef}
              changesRef={changesRef}
              tv={tv}
              reduced={reduced}
            />
            <FpsGuard
              enabled={quality === "high" && !autoLow}
              onDrop={() => {
                setQualityState("low");
                setAutoLow(true);
              }}
            />
          </QualityContext.Provider>
        </Canvas>
      </WebGLBoundary>
      {!tv && (
        <div className="zone-bar">
          <fieldset className="zone-group">
            <legend className="sr-only">Jump the camera to</legend>
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
          <span className="zone-sep" aria-hidden="true" />
          <fieldset className="zone-group">
            <legend className="zone-label">Quality</legend>
            <button
              type="button"
              aria-pressed={quality === "high"}
              onClick={() => setQuality("high")}
            >
              High
            </button>
            <button
              type="button"
              aria-pressed={quality === "low"}
              onClick={() => setQuality("low")}
            >
              Low
            </button>
          </fieldset>
          {autoLow && <span className="zone-note">switched to Low: frame rate dropped</span>}
          {followId && (
            <span className="zone-note zone-note--follow">following · click away to stop</span>
          )}
        </div>
      )}
      {!tv && !isPhone && (
        <div className="view3d-hint">drag to orbit · scroll to zoom · right-drag to pan</div>
      )}
    </div>
  );
}
