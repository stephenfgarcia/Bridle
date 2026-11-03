import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type ComponentRef, type MutableRefObject, useMemo, useRef } from "react";
import type { Agent } from "../data/types";
import type { Pod } from "./layout";
import { Robot3D } from "./Robot3D";
import type { RobotPose } from "./sim/brain";
import { CrowdSim } from "./sim/crowd";

interface Props {
  agents: Agent[];
  pods: Pod[];
  selectedId: string | null;
  reduced: boolean;
  onSelect: (id: string) => void;
  posesRef: MutableRefObject<Map<string, RobotPose>>;
}

function WaitLine({ from, to }: { from: RobotPose; to: RobotPose }) {
  const ref = useRef<ComponentRef<typeof Line>>(null);
  useFrame(() => {
    const line = ref.current;
    if (!line) return;
    line.geometry.setPositions([from.x, 1.5, from.z, to.x, 1.5, to.z]);
    line.computeLineDistances();
  });
  return (
    <Line
      ref={ref}
      points={[
        [from.x, 1.5, from.z],
        [to.x, 1.5, to.z],
      ]}
      color="#ffb020"
      dashed
      dashSize={0.3}
      gapSize={0.22}
      lineWidth={1.4}
      transparent
      opacity={0.55}
    />
  );
}

/** Steps the shared CrowdSim each frame and renders the robots and waiting lines. */
export function Crowd({ agents, pods, selectedId, reduced, onSelect, posesRef }: Props) {
  const idsKey = agents.map((a) => a.id).join("|");
  const sim = useMemo(() => new CrowdSim(pods, idsKey.split("|").filter(Boolean)), [pods, idsKey]);
  sim.sync(agents);
  posesRef.current = sim.poses;

  useFrame((state, dt) => {
    sim.step(dt, state.clock.elapsedTime);
  });

  return (
    <>
      {agents.map((agent) => {
        const pose = sim.pose(agent.id);
        return pose ? (
          <Robot3D
            key={agent.id}
            agent={agent}
            pose={pose}
            selected={agent.id === selectedId}
            reduced={reduced}
            onSelect={onSelect}
          />
        ) : null;
      })}
      {sim.waitPairs().map((pair) => (
        <WaitLine key={pair.id} from={pair.from} to={pair.to} />
      ))}
    </>
  );
}
