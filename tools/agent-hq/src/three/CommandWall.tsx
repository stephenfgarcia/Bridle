import { Html, Instance, Instances } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { DoubleSide, type Group, type Mesh } from "three";
import { FeedPanel, OverviewPanel, StatsPanel } from "../components/ScreenWall";
import type { Agent, Project } from "../data/types";
import type { Vec3 } from "./layout";
import { useOccluder } from "./occluders";
import { C } from "./palette";

const ARC_CENTER: Vec3 = [0, 0, -5.2];
const ARC_RADIUS = 9;
const ARC_SPAN = (2 * Math.PI) / 3;
const MINI_COUNT = 18;
const MINI = Array.from({ length: MINI_COUNT }, (_, i) => i);
const MINI_COLORS = [C.magenta, C.violet, C.emerald];

/** Position and facing for something on the inside of the arc at angle `a` from straight back. */
function onArc(a: number, y: number, radius = ARC_RADIUS): { position: Vec3; rotationY: number } {
  return {
    position: [ARC_CENTER[0] + Math.sin(a) * radius, y, ARC_CENTER[2] - Math.cos(a) * radius],
    rotationY: -a,
  };
}

function Panel({
  angle,
  wide,
  children,
}: {
  angle: number;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const { position, rotationY } = onArc(angle, 3.2, ARC_RADIUS - 0.25);
  return (
    <Html
      transform
      position={position}
      rotation={[0, rotationY, 0]}
      distanceFactor={4.2}
      zIndexRange={[30, 0]}
      pointerEvents="none"
    >
      <div className={wide ? "wall3d wall3d--wide" : "wall3d"}>{children}</div>
    </Html>
  );
}

function Globe() {
  const globe = useRef<Group>(null);
  const orbit = useRef<Group>(null);
  useFrame((_, dt) => {
    if (globe.current) globe.current.rotation.y += dt * 0.25;
    if (orbit.current) orbit.current.rotation.y -= dt * 0.6;
  });
  return (
    <group position={[0, 0, -9.6]}>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[1.35, 1.5, 0.4, 32]} />
        <meshStandardMaterial color="#1a1728" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.42, 0]} rotation-x={-Math.PI / 2}>
        <torusGeometry args={[1.12, 0.04, 8, 48]} />
        <meshStandardMaterial
          color={C.magenta}
          emissive={C.magenta}
          emissiveIntensity={2.5}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 1.0, 0]}>
        <cylinderGeometry args={[0.28, 0.4, 1.2, 16]} />
        <meshStandardMaterial color="#201c33" />
      </mesh>
      <mesh position={[0, 1.7, 0]}>
        <coneGeometry args={[0.9, 1.4, 24, 1, true]} />
        <meshBasicMaterial color={C.violet} transparent opacity={0.08} side={DoubleSide} />
      </mesh>
      <group ref={globe} position={[0, 2.9, 0]}>
        <mesh>
          <sphereGeometry args={[1.05, 24, 16]} />
          <meshBasicMaterial
            color="#c4b5fd"
            wireframe
            transparent
            opacity={0.4}
            toneMapped={false}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[1.0, 24, 24]} />
          <meshStandardMaterial
            color={C.violet}
            transparent
            opacity={0.2}
            emissive={C.violet}
            emissiveIntensity={0.5}
          />
        </mesh>
      </group>
      <group ref={orbit} position={[0, 2.9, 0]}>
        <mesh position={[1.25, 0.2, 0]}>
          <sphereGeometry args={[0.06, 10, 10]} />
          <meshBasicMaterial color={C.emerald} toneMapped={false} />
        </mesh>
        <mesh position={[-1.2, -0.3, 0.3]}>
          <sphereGeometry args={[0.05, 10, 10]} />
          <meshBasicMaterial color={C.magenta} toneMapped={false} />
        </mesh>
      </group>
      <pointLight position={[0, 2.9, 0]} color={C.violet} intensity={30} distance={10} decay={2} />
    </group>
  );
}

/** The curved command wall with three crisp HTML panels, mini screens, neon rims and the globe. */
export function CommandWall({ project, agents }: { project: Project; agents: Agent[] }) {
  const wall = useRef<Mesh>(null);
  useOccluder(wall);
  const thetaStart = Math.PI - ARC_SPAN / 2;
  return (
    <group>
      <mesh ref={wall} position={[ARC_CENTER[0], 3, ARC_CENTER[2]]}>
        <cylinderGeometry args={[ARC_RADIUS, ARC_RADIUS, 6, 48, 1, true, thetaStart, ARC_SPAN]} />
        <meshStandardMaterial
          color={C.darker}
          emissive="#130f26"
          emissiveIntensity={0.8}
          side={DoubleSide}
          roughness={0.7}
        />
      </mesh>
      {[0.9, 5.7].map((y, i) => (
        <mesh
          key={y}
          position={[ARC_CENTER[0], y, ARC_CENTER[2]]}
          rotation={[-Math.PI / 2, 0, Math.PI / 2 - ARC_SPAN / 2]}
        >
          <torusGeometry args={[ARC_RADIUS - 0.05, 0.05, 8, 72, ARC_SPAN]} />
          <meshStandardMaterial
            color={i === 0 ? C.magenta : C.violet}
            emissive={i === 0 ? C.magenta : C.violet}
            emissiveIntensity={2.4}
            toneMapped={false}
          />
        </mesh>
      ))}
      <Instances limit={MINI_COUNT} range={MINI_COUNT}>
        <planeGeometry args={[0.78, 0.5]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
        {MINI.map((i) => {
          const a = -ARC_SPAN / 2 + 0.08 + (i / (MINI_COUNT - 1)) * (ARC_SPAN - 0.16);
          const { position, rotationY } = onArc(a, 5.15, ARC_RADIUS - 0.12);
          const color = MINI_COLORS[i % MINI_COLORS.length] ?? C.violet;
          return (
            <Instance key={i} position={position} rotation={[0, rotationY, 0]} color={color} />
          );
        })}
      </Instances>
      <Panel angle={-0.72}>
        <FeedPanel agents={agents} className="panel panel3d" />
      </Panel>
      <Panel angle={0} wide>
        <OverviewPanel project={project} agents={agents} className="panel panel3d" />
      </Panel>
      <Panel angle={0.72}>
        <StatsPanel agents={agents} className="panel panel3d" />
      </Panel>
      <Globe />
    </group>
  );
}
