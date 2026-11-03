import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { damp3 } from "maath/easing";
import { type ComponentRef, type MutableRefObject, useEffect, useRef } from "react";
import { MathUtils, Vector3 } from "three";
import { CAMERA_PRESETS, type CameraPreset, ROOM } from "./layout";
import type { RobotPose } from "./sim/brain";

type Controls = ComponentRef<typeof OrbitControls>;

export interface StatusChange {
  id: string;
  /** Seconds, from Date.now()/1000. */
  at: number;
}

interface Props {
  goal: CameraPreset | null;
  followId: string | null;
  posesRef: MutableRefObject<Map<string, RobotPose>>;
  changesRef: MutableRefObject<StatusChange[]>;
  tv: boolean;
  reduced: boolean;
}

interface Shot {
  from: CameraPreset;
  to: CameraPreset;
  seconds: number;
}

/** The cinematic tour: slow glides over each zone, in a loop. */
const TOUR: Shot[] = [
  {
    from: { position: [-13, 9, 14], target: [-7, 0.6, 0] },
    to: { position: [3, 9, 14], target: [0, 0.6, 0] },
    seconds: 16,
  },
  {
    from: { position: [-6, 4.2, -1], target: [0, 3, -13] },
    to: { position: [6, 4.8, -2], target: [0, 3, -13] },
    seconds: 14,
  },
  {
    from: { position: [8, 7, 13], target: [12, 0.6, 2] },
    to: { position: [14.5, 6, 11], target: [12, 0.6, -2] },
    seconds: 14,
  },
  {
    from: { position: [-2, 23, 31], target: [-1, 0, 0] },
    to: { position: [6, 20, 26], target: [-1, 0, 2] },
    seconds: 16,
  },
];

const AGENT_SHOT_SECONDS = 8;
const CHANGE_MAX_AGE = 25;
const tmpA = new Vector3();
const tmpB = new Vector3();
const offset = new Vector3();

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

/**
 * Orbit, zoom and pan inside the room; smooth flights to presets; follow mode that tracks a
 * walking robot; and the TV tour that glides between zones and pauses on agents whose status
 * just changed.
 */
export function CameraRig({ goal, followId, posesRef, changesRef, tv, reduced }: Props) {
  const controls = useRef<Controls>(null);
  const camera = useThree((s) => s.camera);
  const flight = useRef<CameraPreset | null>(null);
  const flightStart = useRef(0);
  const followOffset = useRef(new Vector3());
  const tour = useRef({
    index: 0,
    start: -1,
    agent: null as { id: string; until: number } | null,
    angle: 0,
  });

  useEffect(() => {
    if (!goal) return;
    flight.current = goal;
    flightStart.current = Date.now() / 1000;
    followOffset.current.set(
      goal.position[0] - goal.target[0],
      goal.position[1] - goal.target[1],
      goal.position[2] - goal.target[2],
    );
  }, [goal]);

  useEffect(() => {
    if (!tv) tour.current = { index: 0, start: -1, agent: null, angle: 0 };
  }, [tv]);

  useFrame((_, dt) => {
    const c = controls.current;
    if (!c) return;
    const now = Date.now() / 1000;
    const followPose = followId ? posesRef.current.get(followId) : undefined;

    if (tv) {
      runTour(now, dt, c);
    } else {
      const f = flight.current;
      if (f && followPose) {
        // Approach a moving robot with the offset chosen at click time, so turns do not swing us.
        const o = followOffset.current;
        f.target = [followPose.x, 1.2, followPose.z];
        f.position = [followPose.x + o.x, 1.2 + o.y, followPose.z + o.z];
      }
      if (f) {
        tmpA.set(...f.position);
        tmpB.set(...f.target);
        const timedOut = now - flightStart.current > 2.5;
        if (reduced) {
          camera.position.copy(tmpA);
          c.target.copy(tmpB);
          flight.current = null;
        } else {
          damp3(camera.position, tmpA, 0.35, dt);
          damp3(c.target, tmpB, 0.35, dt);
          const arrived =
            camera.position.distanceTo(tmpA) < 0.04 && c.target.distanceTo(tmpB) < 0.04;
          if (arrived || timedOut) flight.current = null;
        }
      } else if (followPose) {
        // Keep the user's orbit offset while the target tracks the robot.
        offset.copy(camera.position).sub(c.target);
        tmpB.set(followPose.x, 1.2, followPose.z);
        if (reduced) c.target.copy(tmpB);
        else damp3(c.target, tmpB, 0.2, dt);
        camera.position.copy(c.target).add(offset);
      }
    }

    c.target.x = MathUtils.clamp(c.target.x, ROOM.minX + 1, ROOM.maxX - 1);
    c.target.y = MathUtils.clamp(c.target.y, 0, ROOM.height);
    c.target.z = MathUtils.clamp(c.target.z, ROOM.minZ + 1, ROOM.maxZ - 1);
    camera.position.x = MathUtils.clamp(camera.position.x, ROOM.minX + 0.5, ROOM.maxX - 0.5);
    camera.position.y = Math.max(camera.position.y, 1.2);
    camera.position.z = MathUtils.clamp(camera.position.z, ROOM.minZ + 0.5, 44);
    c.update();
  });

  function pendingChange(now: number): StatusChange | null {
    const list = changesRef.current;
    while (list.length > 0 && (list[0]?.at ?? 0) < now - CHANGE_MAX_AGE) list.shift();
    for (let i = 0; i < list.length; i += 1) {
      const change = list[i];
      if (change && posesRef.current.has(change.id)) {
        list.splice(i, 1);
        return change;
      }
    }
    return null;
  }

  function runTour(now: number, dt: number, c: Controls): void {
    const t = tour.current;
    if (t.start < 0) t.start = now;
    const smooth = reduced ? 0 : 0.7;

    if (t.agent) {
      const pose = posesRef.current.get(t.agent.id);
      if (!pose || now > t.agent.until) {
        t.agent = null;
        t.start = now;
      } else {
        if (!reduced) t.angle += dt * 0.25;
        const angle = reduced ? pose.heading : t.angle;
        tmpB.set(pose.x, 1.2, pose.z);
        tmpA.set(pose.x + Math.sin(angle) * 5.5, 4.2, pose.z + Math.cos(angle) * 5.5);
        if (smooth === 0) {
          camera.position.copy(tmpA);
          c.target.copy(tmpB);
        } else {
          damp3(camera.position, tmpA, smooth, dt);
          damp3(c.target, tmpB, smooth, dt);
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
      const change = pendingChange(now);
      if (change) {
        const pose = posesRef.current.get(change.id);
        t.agent = { id: change.id, until: now + AGENT_SHOT_SECONDS };
        t.angle = pose ? pose.heading : 0;
        return;
      }
    }
    const k = reduced ? 0 : smoothstep(Math.min(1, Math.max(0, u)));
    tmpA.set(
      shot.from.position[0] + (shot.to.position[0] - shot.from.position[0]) * k,
      shot.from.position[1] + (shot.to.position[1] - shot.from.position[1]) * k,
      shot.from.position[2] + (shot.to.position[2] - shot.from.position[2]) * k,
    );
    tmpB.set(
      shot.from.target[0] + (shot.to.target[0] - shot.from.target[0]) * k,
      shot.from.target[1] + (shot.to.target[1] - shot.from.target[1]) * k,
      shot.from.target[2] + (shot.to.target[2] - shot.from.target[2]) * k,
    );
    if (smooth === 0) {
      camera.position.copy(tmpA);
      c.target.copy(tmpB);
    } else {
      damp3(camera.position, tmpA, smooth, dt);
      damp3(c.target, tmpB, smooth, dt);
    }
  }

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enabled={!tv}
      target={CAMERA_PRESETS.overview.target}
      enableDamping={!reduced}
      dampingFactor={0.09}
      minDistance={3}
      maxDistance={50}
      minPolarAngle={0.12}
      maxPolarAngle={1.32}
      onStart={() => {
        flight.current = null;
      }}
    />
  );
}
