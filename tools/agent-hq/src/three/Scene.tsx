import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { type MutableRefObject, useEffect, useState } from "react";
import type { Agent, Project } from "../data/types";
import { Cafeteria } from "./Cafeteria";
import { CommandWall } from "./CommandWall";
import { Crowd } from "./Crowd";
import { Haze } from "./Haze";
import type { Pod } from "./layout";
import { Pods } from "./Pods";
import { C } from "./palette";
import { useQuality } from "./QualityContext";
import { Room } from "./Room";
import { Skyline } from "./Skyline";
import type { RobotPose } from "./sim/brain";

interface Props {
  project: Project;
  agents: Agent[];
  pods: Pod[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  posesRef: MutableRefObject<Map<string, RobotPose>>;
}

/**
 * drei's Html loses the content of whichever instance mounts in the very first frame of a canvas
 * (and then throws on unmount), so everything that carries HTML waits one frame.
 */
function useNextFrame(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(id);
  }, []);
  return ready;
}

/** Lights are deliberately few: glowing materials plus bloom carry the room. */
export function Scene({ project, agents, pods, selectedId, onSelect, posesRef }: Props) {
  const ready = useNextFrame();
  const { quality, reduced } = useQuality();
  return (
    <>
      <color attach="background" args={[C.bg]} />
      <fog attach="fog" args={[C.bg, 28, 95]} />
      <ambientLight intensity={0.42} />
      <hemisphereLight args={["#4b3b8f", "#07060f", 0.8]} />
      <pointLight position={[-12, 5, 0]} color={C.violet} intensity={45} distance={20} decay={2} />
      <pointLight position={[0, 7, 12]} color="#5b4b9a" intensity={34} distance={34} decay={2} />

      <Room />
      <Skyline />
      <Haze />
      {ready && <CommandWall project={project} agents={agents} />}
      {ready && <Cafeteria />}
      {ready && <Pods agents={agents} pods={pods} onSelect={onSelect} />}
      {ready && (
        <Crowd
          agents={agents}
          pods={pods}
          selectedId={selectedId}
          reduced={reduced}
          onSelect={onSelect}
          posesRef={posesRef}
        />
      )}

      {quality === "high" && (
        <EffectComposer multisampling={4}>
          <Bloom
            luminanceThreshold={0.7}
            luminanceSmoothing={0.25}
            intensity={0.7}
            mipmapBlur
            radius={0.55}
          />
        </EffectComposer>
      )}
    </>
  );
}
