import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, type Group } from "three";
import { useQuality } from "./QualityContext";
import { glowTexture } from "./textures";

const PUFFS = [
  { id: "h1", p: [-6, 3, -4], s: [20, 10], c: "#5b4b9a", phase: 0 },
  { id: "h2", p: [5, 2.6, 4], s: [18, 9], c: "#6b2d7a", phase: 1.7 },
  { id: "h3", p: [-10, 3.4, 9], s: [16, 8], c: "#3b3a8a", phase: 3.1 },
  { id: "h4", p: [10, 3, -8], s: [14, 8], c: "#5b4b9a", phase: 4.4 },
  { id: "h5", p: [0, 4, -11], s: [22, 7], c: "#7a2d6a", phase: 5.6 },
] as const;

/** Gently drifting haze: a handful of additive sprites, nearly free to render. */
export function Haze() {
  const { reduced } = useQuality();
  const group = useRef<Group>(null);
  const map = useMemo(glowTexture, []);
  useFrame((state) => {
    const g = group.current;
    if (!g || reduced) return;
    const t = state.clock.elapsedTime;
    g.children.forEach((child, i) => {
      const puff = PUFFS[i];
      if (!puff) return;
      child.position.x = puff.p[0] + Math.sin(t * 0.05 + puff.phase) * 2.2;
      child.position.y = puff.p[1] + Math.sin(t * 0.08 + puff.phase * 1.3) * 0.35;
      child.position.z = puff.p[2] + Math.cos(t * 0.04 + puff.phase) * 1.6;
    });
  });
  return (
    <group ref={group}>
      {PUFFS.map((puff) => (
        <sprite
          key={puff.id}
          position={[puff.p[0], puff.p[1], puff.p[2]]}
          scale={[puff.s[0], puff.s[1], 1]}
        >
          <spriteMaterial
            map={map}
            color={puff.c}
            transparent
            opacity={0.06}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </sprite>
      ))}
    </group>
  );
}
