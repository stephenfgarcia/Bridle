import { Html, Instance, Instances } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { type CSSProperties, useMemo } from "react";
import { Color } from "three";
import type { Agent } from "../data/types";
import { STATUS_META } from "../lib/status";
import type { Pod, Vec3 } from "./layout";
import { CodeLines, PersonalItem } from "./PodParts";
import { C, setCursor } from "./palette";
import { blobTexture } from "./textures";

interface Props {
  agents: Agent[];
  pods: Pod[];
  onSelect: (id: string) => void;
}

interface Part {
  id: string;
  /** Local offset from the pod centre. */
  p: Vec3;
  /** Box/cylinder/plane scale. */
  s: Vec3;
  r?: Vec3;
  c?: string;
}

const STEEL: Part[] = [
  { id: "desk", p: [0, 0.74, 0], s: [2.6, 0.08, 0.9] },
  { id: "return", p: [1.1, 0.74, 0.95], s: [0.8, 0.08, 1.5] },
];

const MON: Vec3 = [-0.35, 0.78, -0.08];
const PANEL: Vec3 = [MON[0], MON[1] + 0.58, MON[2]];
const CHAIR: Vec3 = [0, 0, -0.95];
const BACK: Vec3 = [CHAIR[0], 1.05, CHAIR[2] - 0.3];

const DARK: Part[] = [
  { id: "ped-a", p: [-1.05, 0.36, 0], s: [0.42, 0.72, 0.8], c: C.steelDark },
  { id: "ped-b", p: [1.1, 0.36, 1.35], s: [0.6, 0.72, 0.5], c: C.steelDark },
  { id: "keys", p: [0, 0.8, 0.25], s: [0.7, 0.03, 0.22], c: "#15151f" },
  { id: "neck", p: [MON[0], MON[1] + 0.2, MON[2]], s: [0.06, 0.34, 0.05], c: C.steelDark },
  { id: "frame", p: PANEL, s: [0.96, 0.58, 0.05], r: [-0.12, 0, 0], c: "#0b0b14" },
  { id: "seat", p: [CHAIR[0], 0.5, CHAIR[2]], s: [0.62, 0.12, 0.6], c: "#15151f" },
  { id: "back", p: BACK, s: [0.64, 1.15, 0.14], r: [0.12, 0, 0], c: "#15151f" },
  {
    id: "wing-l",
    p: [BACK[0] - 0.33, BACK[1] + 0.444, BACK[2] + 0.074],
    s: [0.08, 0.3, 0.16],
    r: [0.12, 0, 0],
    c: "#1c1c28",
  },
  {
    id: "wing-r",
    p: [BACK[0] + 0.33, BACK[1] + 0.444, BACK[2] + 0.074],
    s: [0.08, 0.3, 0.16],
    r: [0.12, 0, 0],
    c: "#1c1c28",
  },
  { id: "arm-l", p: [CHAIR[0] - 0.36, 0.72, CHAIR[2]], s: [0.06, 0.05, 0.4], c: "#1c1c28" },
  { id: "arm-r", p: [CHAIR[0] + 0.36, 0.72, CHAIR[2]], s: [0.06, 0.05, 0.4], c: "#1c1c28" },
];

const CYL: Part[] = [
  { id: "mon-base", p: [MON[0], MON[1] + 0.03, MON[2]], s: [0.18, 0.05, 0.18], c: C.steelDark },
  { id: "chair-base", p: [CHAIR[0], 0.12, CHAIR[2]], s: [0.32, 0.05, 0.32], c: "#1a1a26" },
  { id: "chair-col", p: [CHAIR[0], 0.3, CHAIR[2]], s: [0.05, 0.35, 0.05], c: "#2a2a3a" },
];

/** Glowing accent parts: LED strip, chair piping, monitor logo strip. */
const ACCENT: Part[] = [
  { id: "led", p: [0, 0.71, 0.46], s: [2.6, 0.03, 0.03] },
  {
    id: "pipe-l",
    p: [BACK[0] - 0.22, BACK[1] - 0.009, BACK[2] + 0.0745],
    s: [0.025, 0.95, 0.01],
    r: [0.12, 0, 0],
  },
  {
    id: "pipe-r",
    p: [BACK[0] + 0.22, BACK[1] - 0.009, BACK[2] + 0.0745],
    s: [0.025, 0.95, 0.01],
    r: [0.12, 0, 0],
  },
  { id: "logo", p: [PANEL[0], PANEL[1], PANEL[2] + 0.03], s: [0.5, 0.05, 0.01], r: [-0.12, 0, 0] },
];

const SHADOWS: Part[] = [
  { id: "desk-shadow", p: [0.15, 0.014, 0.35], s: [3.6, 2.4, 1], r: [-Math.PI / 2, 0, 0] },
  { id: "chair-shadow", p: [CHAIR[0], 0.016, CHAIR[2]], s: [1.4, 1.4, 1], r: [-Math.PI / 2, 0, 0] },
];

const tmp = new Color();
const tmp2 = new Color();
function tint(base: string, accent: string, k: number): string {
  return `#${tmp.set(base).lerp(tmp2.set(accent), k).getHexString()}`;
}
function scaleColor(hex: string, k: number): string {
  return `#${tmp.set(hex).multiplyScalar(k).getHexString()}`;
}

/** Every agent's desk pod, instanced per part so the whole work floor is a few draw calls. */
export function Pods({ agents, pods, onSelect }: Props) {
  const items = useMemo(
    () =>
      agents.flatMap((agent, i) => {
        const pod = pods[i];
        if (!pod) return [];
        const [x, , z] = pod.position;
        const dim = agent.status === "idle";
        const screen = agent.status === "done" ? C.white : STATUS_META[agent.status].color;
        return [{ agent, x, z, dim, screen: dim ? scaleColor(screen, 0.35) : screen }];
      }),
    [agents, pods],
  );
  const n = items.length;
  const blob = useMemo(blobTexture, []);
  const pick = (id: string) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(id);
  };
  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setCursor(true);
  };
  const out = () => setCursor(false);
  if (n === 0) return null;

  return (
    <group>
      <Instances key={`steel-${n}`} limit={n * STEEL.length} range={n * STEEL.length}>
        <boxGeometry />
        <meshStandardMaterial color={C.steel} metalness={0.85} roughness={0.3} />
        {items.map((it) =>
          STEEL.map((part) => (
            <Instance
              key={`${it.agent.id}-${part.id}`}
              position={[it.x + part.p[0], part.p[1], it.z + part.p[2]]}
              scale={part.s}
              onClick={pick(it.agent.id)}
              onPointerOver={over}
              onPointerOut={out}
            />
          )),
        )}
      </Instances>

      <Instances key={`dark-${n}`} limit={n * DARK.length} range={n * DARK.length}>
        <boxGeometry />
        <meshStandardMaterial color="#ffffff" metalness={0.5} roughness={0.6} />
        {items.map((it) =>
          DARK.map((part) => (
            <Instance
              key={`${it.agent.id}-${part.id}`}
              position={[it.x + part.p[0], part.p[1], it.z + part.p[2]]}
              rotation={part.r ?? [0, 0, 0]}
              scale={part.s}
              color={part.c ?? "#ffffff"}
            />
          )),
        )}
      </Instances>

      <Instances key={`cyl-${n}`} limit={n * CYL.length} range={n * CYL.length}>
        <cylinderGeometry args={[1, 1, 1, 16]} />
        <meshStandardMaterial color="#ffffff" metalness={0.6} roughness={0.4} />
        {items.map((it) =>
          CYL.map((part) => (
            <Instance
              key={`${it.agent.id}-${part.id}`}
              position={[it.x + part.p[0], part.p[1], it.z + part.p[2]]}
              scale={part.s}
              color={part.c ?? "#ffffff"}
            />
          )),
        )}
      </Instances>

      <Instances key={`accent-${n}`} limit={n * ACCENT.length} range={n * ACCENT.length}>
        <boxGeometry />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
        {items.map((it) =>
          ACCENT.map((part) => (
            <Instance
              key={`${it.agent.id}-${part.id}`}
              position={[it.x + part.p[0], part.p[1], it.z + part.p[2]]}
              rotation={part.r ?? [0, 0, 0]}
              scale={part.s}
              color={it.agent.color}
            />
          )),
        )}
      </Instances>

      <Instances key={`screen-${n}`} limit={n} range={n}>
        <planeGeometry args={[0.88, 0.5]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
        {items.map((it) => (
          <Instance
            key={it.agent.id}
            position={[it.x + PANEL[0], PANEL[1] - 0.003, it.z + PANEL[2] - 0.028]}
            rotation={[-0.12, Math.PI, 0]}
            color={it.screen}
          />
        ))}
      </Instances>

      <Instances key={`rug-${n}`} limit={n} range={n}>
        <planeGeometry args={[3.5, 3.4]} />
        <meshStandardMaterial color="#ffffff" roughness={1} />
        {items.map((it) => (
          <Instance
            key={it.agent.id}
            position={[it.x + 0.3, 0.008, it.z + 0.25]}
            rotation={[-Math.PI / 2, 0, 0]}
            color={tint("#0e0c1c", it.agent.color, 0.22)}
            onClick={pick(it.agent.id)}
            onPointerOver={over}
            onPointerOut={out}
          />
        ))}
      </Instances>

      <Instances key={`shadow-${n}`} limit={n * SHADOWS.length} range={n * SHADOWS.length}>
        <planeGeometry />
        <meshBasicMaterial map={blob} transparent opacity={0.55} depthWrite={false} />
        {items.map((it) =>
          SHADOWS.map((part) => (
            <Instance
              key={`${it.agent.id}-${part.id}`}
              position={[it.x + part.p[0], part.p[1], it.z + part.p[2]]}
              rotation={part.r ?? [0, 0, 0]}
              scale={part.s}
            />
          )),
        )}
      </Instances>

      {items.map((it) => (
        <group key={it.agent.id} position={[it.x, 0, it.z]}>
          {it.agent.status === "working" && (
            <group position={PANEL} rotation-x={-0.12}>
              <CodeLines color={it.agent.color} active />
            </group>
          )}
          <PersonalItem
            role={it.agent.role}
            position={[1.1, 0.78, 0.75]}
            accent={it.agent.color}
            screen={it.screen}
          />
          <Html
            transform
            position={[1.1, 0.92, 1.72]}
            distanceFactor={3.4}
            zIndexRange={[20, 0]}
            pointerEvents="none"
          >
            <div className="plate" style={{ "--accent": it.agent.color } as CSSProperties}>
              {it.agent.name}
              <small>{it.agent.role}</small>
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}
