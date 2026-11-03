import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import type { Vec3 } from "./layout";
import { C } from "./palette";

const CODE_ROWS = [0, 1, 2, 3, 4, 5];
const CODE_WIDTHS = [0.42, 0.26, 0.5, 0.34, 0.2, 0.46];

/** Scrolling code lines on a monitor face (panel space: screen faces -z at z=-0.03). */
export function CodeLines({ color, active }: { color: string; active: boolean }) {
  const group = useRef<Group>(null);
  const offset = useRef(0);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    if (active) offset.current = (offset.current + dt * 0.18) % 0.45;
    g.children.forEach((child, i) => {
      child.position.y = ((i * 0.075 + offset.current) % 0.45) - 0.21;
      child.visible = active;
    });
  });
  return (
    <group ref={group} position={[0, 0, -0.032]} rotation-y={Math.PI}>
      {CODE_ROWS.map((i) => (
        <mesh key={i} position={[-0.4 + (CODE_WIDTHS[i] ?? 0.3) / 2 + (i % 2) * 0.04, 0, 0]}>
          <planeGeometry args={[CODE_WIDTHS[i] ?? 0.3, 0.028]} />
          <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.85} />
        </mesh>
      ))}
    </group>
  );
}

interface MonitorProps {
  position: Vec3;
  rotationY?: number;
  screen: string;
  accent: string;
  dim?: boolean;
}

/** A standalone slim monitor (used for personal items; the main monitors are instanced). */
export function Monitor({ position, rotationY = 0, screen, accent, dim }: MonitorProps) {
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 0.05, 16]} />
        <meshStandardMaterial color={C.steelDark} metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[0.06, 0.34, 0.05]} />
        <meshStandardMaterial color={C.steelDark} />
      </mesh>
      <group position={[0, 0.58, 0]} rotation-x={-0.12}>
        <mesh>
          <boxGeometry args={[0.96, 0.58, 0.05]} />
          <meshStandardMaterial color="#0b0b14" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, -0.028]} rotation-y={Math.PI}>
          <planeGeometry args={[0.88, 0.5]} />
          <meshBasicMaterial
            color={screen}
            toneMapped={false}
            transparent
            opacity={dim ? 0.35 : 1}
          />
        </mesh>
        <mesh position={[0, 0, 0.028]}>
          <planeGeometry args={[0.5, 0.05]} />
          <meshBasicMaterial
            color={accent}
            toneMapped={false}
            transparent
            opacity={dim ? 0.4 : 1}
          />
        </mesh>
      </group>
    </group>
  );
}

function Mug({ position }: { position: Vec3 }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.07, 0.06, 0.14, 12]} />
        <meshStandardMaterial color="#2e2e40" />
      </mesh>
      <mesh position={[0.08, 0.07, 0]} rotation-y={Math.PI / 2}>
        <torusGeometry args={[0.04, 0.012, 6, 12]} />
        <meshStandardMaterial color="#4a4a66" />
      </mesh>
    </group>
  );
}

const BOOK_COLORS = [C.violet, C.magenta, C.emerald];

/** One desk item per role, built from primitives. Glowing parts use emissive-looking basics. */
export function PersonalItem({
  role,
  position,
  accent,
  screen,
}: {
  role: string;
  position: Vec3;
  accent: string;
  screen: string;
}) {
  switch (role) {
    case "Researcher":
      return (
        <group position={position}>
          {BOOK_COLORS.map((color, i) => (
            <mesh key={color} position={[0, 0.03 + i * 0.06, 0]} rotation-y={(i - 1) * 0.15}>
              <boxGeometry args={[0.34, 0.055, 0.24]} />
              <meshStandardMaterial color={color} roughness={0.8} />
            </mesh>
          ))}
        </group>
      );
    case "Designer":
      return (
        <group position={position}>
          <mesh position={[0, 0.015, 0]} rotation-x={-0.1}>
            <boxGeometry args={[0.5, 0.03, 0.36]} />
            <meshStandardMaterial color="#1b1b28" />
          </mesh>
          <mesh position={[0, 0.035, 0]} rotation-x={-Math.PI / 2 - 0.1}>
            <planeGeometry args={[0.42, 0.28]} />
            <meshBasicMaterial color={C.lavender} toneMapped={false} transparent opacity={0.7} />
          </mesh>
          <mesh position={[0.3, 0.03, 0.1]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.012, 0.012, 0.22, 8]} />
            <meshStandardMaterial color="#e5e7eb" />
          </mesh>
        </group>
      );
    case "Developer":
      return (
        <Monitor position={position} rotationY={-Math.PI / 2} screen={screen} accent={accent} />
      );
    case "Copywriter":
      return (
        <group position={position}>
          <mesh position={[0, 0.02, 0]}>
            <boxGeometry args={[0.3, 0.04, 0.4]} />
            <meshStandardMaterial color="#f4f2ff" roughness={0.9} />
          </mesh>
          <mesh position={[0.22, 0.02, 0]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.012, 0.012, 0.3, 8]} />
            <meshStandardMaterial color={accent} />
          </mesh>
          <Mug position={[-0.3, 0, 0.1]} />
        </group>
      );
    case "Orchestrator":
      return (
        <group position={position}>
          <mesh position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.12, 0.14, 0.05, 12]} />
            <meshStandardMaterial color="#2a2a3a" metalness={0.6} />
          </mesh>
          <mesh position={[0.1, 0.3, 0]} rotation-z={-0.4}>
            <cylinderGeometry args={[0.015, 0.015, 0.55, 8]} />
            <meshStandardMaterial color="#3a3a54" />
          </mesh>
          <mesh position={[0.24, 0.52, 0]} rotation-z={0.4}>
            <coneGeometry args={[0.13, 0.16, 16, 1, true]} />
            <meshStandardMaterial color="#2a2a3a" side={2} />
          </mesh>
          <mesh position={[0.24, 0.47, 0]}>
            <sphereGeometry args={[0.045, 10, 10]} />
            <meshBasicMaterial color={C.amber} toneMapped={false} />
          </mesh>
        </group>
      );
    case "Social Media":
      return (
        <group position={position}>
          <mesh position={[0, 0.03, 0]}>
            <boxGeometry args={[0.14, 0.06, 0.12]} />
            <meshStandardMaterial color="#1b1b28" />
          </mesh>
          <group position={[0, 0.17, -0.02]} rotation-x={-0.35}>
            <mesh>
              <boxGeometry args={[0.14, 0.26, 0.015]} />
              <meshStandardMaterial color="#0b0b14" />
            </mesh>
            <mesh position={[0, 0, 0.009]}>
              <planeGeometry args={[0.12, 0.22]} />
              <meshBasicMaterial color={accent} toneMapped={false} />
            </mesh>
          </group>
        </group>
      );
    case "QA Tester":
      return (
        <group position={position}>
          <mesh position={[0, 0.06, 0]}>
            <boxGeometry args={[0.22, 0.12, 0.16]} />
            <meshStandardMaterial color="#1b1b28" />
          </mesh>
          <mesh position={[0, 0.125, 0]}>
            <boxGeometry args={[0.18, 0.005, 0.12]} />
            <meshBasicMaterial color={C.emerald} toneMapped={false} />
          </mesh>
          <mesh position={[0.28, 0.03, 0.08]} rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.09, 0.018, 8, 20]} />
            <meshStandardMaterial color="#9aa3b5" metalness={0.7} />
          </mesh>
          <mesh position={[0.42, 0.03, 0.18]} rotation-y={-0.6} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.015, 0.015, 0.2, 8]} />
            <meshStandardMaterial color="#3a3a54" />
          </mesh>
        </group>
      );
    case "Analyst":
      return (
        <group position={position}>
          {[0.14, 0.26, 0.2, 0.32].map((h, i) => (
            <mesh key={h} position={[-0.15 + i * 0.1, h / 2, 0]}>
              <boxGeometry args={[0.07, h, 0.07]} />
              <meshBasicMaterial color={i % 2 ? C.violet : C.emerald} toneMapped={false} />
            </mesh>
          ))}
        </group>
      );
    default:
      return <Mug position={position} />;
  }
}
