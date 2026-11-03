import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type CSSProperties, useRef, useState } from "react";
import { type Group, Vector3 } from "three";
import { AgentTag } from "../components/AgentTag";
import type { Agent } from "../data/types";
import type { Vec3 } from "./layout";
import { occluderRefs } from "./occluders";

interface Props {
  agent: Agent;
  position: Vec3;
  compactBeyond?: number;
  /** The robot's simulation mode, exposed as a data attribute for tooling and tests. */
  mode?: string;
}

const tmp = new Vector3();

/** A camera-facing HTML tag above a robot. Becomes a dot when far away; hides behind walls. */
export function AgentTag3D({ agent, position, compactBeyond = 27, mode }: Props) {
  const group = useRef<Group>(null);
  const [compact, setCompact] = useState(false);

  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    const d = camera.position.distanceTo(g.getWorldPosition(tmp));
    const next = compact ? d > compactBeyond - 3 : d > compactBeyond;
    if (next !== compact) setCompact(next);
  });

  return (
    <group ref={group} position={position}>
      <Html
        center
        occlude={occluderRefs()}
        distanceFactor={11}
        zIndexRange={[40, 0]}
        style={{ pointerEvents: "none" }}
      >
        {compact ? (
          <div
            className="tag-dot"
            data-agent={agent.id}
            data-mode={mode}
            style={{ "--accent": agent.color } as CSSProperties}
          />
        ) : (
          <div className="tag3d" data-agent={agent.id} data-mode={mode}>
            <AgentTag agent={agent} />
          </div>
        )}
      </Html>
    </group>
  );
}
