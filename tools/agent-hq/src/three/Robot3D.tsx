import { Html } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { type Group, MathUtils, type Mesh, type MeshBasicMaterial } from "three";
import type { Agent } from "../data/types";
import { AgentTag3D } from "./AgentTag3D";
import { C, setCursor } from "./palette";
import type { ArmPose, Bubble, RobotPose } from "./sim/brain";
import type { ItemKind } from "./sim/world";
import { blobTexture } from "./textures";

interface Props {
  agent: Agent;
  pose: RobotPose;
  selected: boolean;
  reduced: boolean;
  onSelect: (id: string) => void;
}

const STAND_HIP = 0.92;
const SIT_HIP = 0.5;
const SPARKS = [0, 1, 2, 3, 4, 5, 6, 7];

interface ArmTarget {
  x: number;
  z: number;
}

function armTarget(pose: ArmPose, side: "left" | "right", walk: number, speed: number): ArmTarget {
  const swing = speed > 0.05 ? Math.sin(walk + (side === "left" ? 0 : Math.PI)) * 0.45 : 0;
  switch (pose) {
    case "type":
      return { x: -1.05, z: side === "left" ? 0.08 : -0.08 };
    case "lean":
      return { x: -0.3, z: side === "left" ? 0.2 : -0.2 };
    case "headhand":
      return side === "right" ? { x: -2.55, z: -0.55 } : { x: swing, z: 0.12 };
    case "hold":
      return side === "right" ? { x: -1.25, z: -0.1 } : { x: swing, z: 0.1 };
    case "sip":
      return side === "right" ? { x: -2.25, z: -0.35 } : { x: 0, z: 0.1 };
    case "up":
      return { x: -2.7, z: side === "left" ? 0.35 : -0.35 };
    default:
      return { x: swing, z: side === "left" ? 0.1 : -0.1 };
  }
}

function HeldItem({ kind }: { kind: ItemKind }) {
  switch (kind) {
    case "donut":
      return (
        <mesh position={[0, -0.5, 0.08]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.1, 0.045, 10, 20]} />
          <meshStandardMaterial color="#f472b6" />
        </mesh>
      );
    case "sandwich":
      return (
        <group position={[0, -0.5, 0.08]} rotation-y={0.4}>
          <mesh>
            <boxGeometry args={[0.22, 0.09, 0.14]} />
            <meshStandardMaterial color="#e3b97a" />
          </mesh>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.23, 0.03, 0.15]} />
            <meshStandardMaterial color="#19f5a1" />
          </mesh>
        </group>
      );
    case "juice":
      return (
        <group position={[0, -0.5, 0.06]}>
          <mesh>
            <cylinderGeometry args={[0.05, 0.045, 0.2, 10]} />
            <meshStandardMaterial color="#fb923c" emissive="#fb923c" emissiveIntensity={0.3} />
          </mesh>
          <mesh position={[0.02, 0.13, 0]} rotation-z={0.2}>
            <cylinderGeometry args={[0.008, 0.008, 0.16, 6]} />
            <meshStandardMaterial color="#f4f2ff" />
          </mesh>
        </group>
      );
    default:
      return (
        <group position={[0, -0.5, 0.06]}>
          <mesh>
            <cylinderGeometry args={[0.07, 0.06, 0.15, 12]} />
            <meshStandardMaterial color="#2e2e40" />
          </mesh>
          <mesh position={[0.08, 0, 0]} rotation-y={Math.PI / 2}>
            <torusGeometry args={[0.04, 0.012, 6, 12]} />
            <meshStandardMaterial color="#4a4a66" />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.01, 12]} />
            <meshStandardMaterial color="#6b4a2a" />
          </mesh>
        </group>
      );
  }
}

function ThoughtBubble({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[-0.2, -0.3, 0]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color={C.lavender} emissive={C.lavender} emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[-0.08, -0.16, 0]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color={C.lavender} emissive={C.lavender} emissiveIntensity={0.8} />
      </mesh>
      {[-0.18, 0, 0.18].map((x) => (
        <mesh key={x} position={[x, 0, 0]}>
          <sphereGeometry args={[x === 0 ? 0.26 : 0.2, 12, 12]} />
          <meshStandardMaterial
            color={C.lavender}
            emissive={C.lavender}
            emissiveIntensity={0.5}
            transparent
            opacity={0.75}
          />
        </mesh>
      ))}
      {[-0.12, 0, 0.12].map((x) => (
        <mesh key={x} position={[x, 0, 0.24]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshStandardMaterial
            color="#fff"
            emissive="#fff"
            emissiveIntensity={2}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/** A low-poly robot driven entirely by its RobotPose, updated each frame by the crowd. */
export function Robot3D({ agent, pose, selected, reduced, onSelect }: Props) {
  const group = useRef<Group>(null);
  const lift = useRef<Group>(null);
  const body = useRef<Group>(null);
  const blob = useMemo(blobTexture, []);
  const upper = useRef<Group>(null);
  const head = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const leftThigh = useRef<Group>(null);
  const rightThigh = useRef<Group>(null);
  const leftShin = useRef<Group>(null);
  const rightShin = useRef<Group>(null);
  const fx = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const sparks = useRef<Group>(null);
  const sparkMat = useRef<MeshBasicMaterial>(null);
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [carrying, setCarrying] = useState<ItemKind | null>(pose.carrying);
  const [thinkingSeated, setThinkingSeated] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [mode, setMode] = useState(pose.mode);
  const lastBubble = useRef<number>(-1);

  const { status, color } = agent;
  const visor = status === "done" ? C.white : color;
  const hasBeacon = status === "blocked" || status === "waiting";

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const animate = !reduced;
    const bob =
      pose.bob +
      (animate ? pose.laugh + (pose.speed > 0.05 ? Math.abs(Math.sin(pose.walk)) * 0.035 : 0) : 0);
    g.position.set(pose.x, 0, pose.z);
    g.rotation.y = pose.heading + pose.swivel;
    if (lift.current) lift.current.position.y = bob;

    const hip = STAND_HIP + (SIT_HIP - STAND_HIP) * pose.seated;
    if (body.current) body.current.position.y = hip;
    const swing = pose.speed > 0.05 ? Math.sin(pose.walk) * 0.55 : 0;
    const seated = pose.seated;
    const lt = leftThigh.current;
    const rt = rightThigh.current;
    const ls = leftShin.current;
    const rs = rightShin.current;
    if (lt && rt && ls && rs) {
      lt.rotation.x = -(Math.PI / 2) * seated + swing * (1 - seated);
      rt.rotation.x = -(Math.PI / 2) * seated - swing * (1 - seated);
      ls.rotation.x = (Math.PI / 2) * seated + Math.max(0, -swing) * 0.9 * (1 - seated);
      rs.rotation.x = (Math.PI / 2) * seated + Math.max(0, swing) * 0.9 * (1 - seated);
    }
    if (upper.current) {
      const lean = pose.arms === "lean" ? -0.24 : 0;
      upper.current.rotation.x = MathUtils.damp(upper.current.rotation.x, lean, 6, dt);
    }
    const la = leftArm.current;
    const ra = rightArm.current;
    if (la && ra) {
      const tl = armTarget(pose.arms, "left", pose.walk, pose.speed);
      const tr = armTarget(pose.arms, "right", pose.walk, pose.speed);
      const wobble = animate && pose.arms === "type" ? Math.sin(t * 14) * 0.12 : 0;
      la.rotation.x = MathUtils.damp(la.rotation.x, tl.x + wobble, 10, dt);
      la.rotation.z = MathUtils.damp(la.rotation.z, tl.z, 8, dt);
      ra.rotation.x = MathUtils.damp(ra.rotation.x, tr.x - wobble, 10, dt);
      ra.rotation.z = MathUtils.damp(ra.rotation.z, tr.z, 8, dt);
    }
    if (head.current) {
      head.current.rotation.z = animate && pose.arms === "lean" ? Math.sin(t * 0.9) * 0.14 : 0;
      head.current.rotation.x = pose.nod;
    }
    if (fx.current && animate) {
      fx.current.rotation.y = t * 1.6;
      fx.current.scale.setScalar(1 + Math.sin(t * 4) * 0.08);
    }
    if (ring.current) ring.current.rotation.z = t * 0.8;
    if (sparks.current && sparkMat.current) {
      const k = pose.celebrate;
      sparks.current.scale.setScalar(0.3 + k * 2.2);
      sparkMat.current.opacity = k > 0 ? Math.max(0, 1 - k) : 0;
    }

    // Rare React updates for HTML and conditional meshes.
    const bubbleId = pose.bubble?.id ?? -1;
    if (bubbleId !== lastBubble.current) {
      lastBubble.current = bubbleId;
      setBubble(pose.bubble);
    }
    if (pose.carrying !== carrying) setCarrying(pose.carrying);
    const think = status === "thinking" && pose.seated > 0.9;
    if (think !== thinkingSeated) setThinkingSeated(think);
    const cel = pose.mode === "celebrate";
    if (cel !== celebrating) setCelebrating(cel);
    if (pose.mode !== mode) setMode(pose.mode);
  });

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(agent.id);
  };

  return (
    <group
      ref={group}
      onClick={click}
      onPointerOver={(e) => {
        e.stopPropagation();
        setCursor(true);
      }}
      onPointerOut={() => setCursor(false)}
    >
      {selected && (
        <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.03}>
          <ringGeometry args={[0.55, 0.72, 40, 1, 0, Math.PI * 1.6]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      )}
      <mesh rotation-x={-Math.PI / 2} position-y={0.018}>
        <planeGeometry args={[1.3, 1.3]} />
        <meshBasicMaterial map={blob} transparent opacity={0.5} depthWrite={false} />
      </mesh>

      <group ref={lift}>
        <group ref={body}>
          {/* legs: thigh pivots at the hip, shin pivots at the knee */}
          {[
            { x: -0.16, thigh: leftThigh, shin: leftShin },
            { x: 0.16, thigh: rightThigh, shin: rightShin },
          ].map((leg) => (
            <group key={leg.x} ref={leg.thigh} position={[leg.x, 0, 0]}>
              <mesh position={[0, -0.2, 0]}>
                <capsuleGeometry args={[0.1, 0.28, 4, 8]} />
                <meshStandardMaterial color={C.limb} />
              </mesh>
              <group ref={leg.shin} position={[0, -0.4, 0]}>
                <mesh position={[0, -0.2, 0]}>
                  <capsuleGeometry args={[0.09, 0.3, 4, 8]} />
                  <meshStandardMaterial color={C.limb} />
                </mesh>
                <mesh position={[0, -0.42, 0.05]}>
                  <boxGeometry args={[0.16, 0.08, 0.26]} />
                  <meshStandardMaterial color={C.joint} />
                </mesh>
              </group>
            </group>
          ))}

          <group ref={upper}>
            <mesh position={[0, 0.42, 0]}>
              <capsuleGeometry args={[0.3, 0.5, 6, 14]} />
              <meshStandardMaterial color={C.robot} metalness={0.35} roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.5, 0.29]}>
              <boxGeometry args={[0.16, 0.08, 0.03]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={1.6}
                toneMapped={false}
              />
            </mesh>
            {[-0.4, 0.4].map((x) => (
              <mesh key={x} position={[x, 0.72, 0]}>
                <sphereGeometry args={[0.11, 12, 12]} />
                <meshStandardMaterial color={C.joint} />
              </mesh>
            ))}
            <group ref={leftArm} position={[-0.42, 0.72, 0]}>
              <mesh position={[0, -0.22, 0]}>
                <capsuleGeometry args={[0.08, 0.36, 4, 8]} />
                <meshStandardMaterial color={C.limb} />
              </mesh>
              <mesh position={[0, -0.46, 0]}>
                <sphereGeometry args={[0.09, 10, 10]} />
                <meshStandardMaterial color={C.joint} />
              </mesh>
            </group>
            <group ref={rightArm} position={[0.42, 0.72, 0]}>
              <mesh position={[0, -0.22, 0]}>
                <capsuleGeometry args={[0.08, 0.36, 4, 8]} />
                <meshStandardMaterial color={C.limb} />
              </mesh>
              <mesh position={[0, -0.46, 0]}>
                <sphereGeometry args={[0.09, 10, 10]} />
                <meshStandardMaterial color={C.joint} />
              </mesh>
              {carrying && <HeldItem kind={carrying} />}
            </group>
            <mesh position={[0, 0.84, 0]}>
              <cylinderGeometry args={[0.08, 0.08, 0.14, 10]} />
              <meshStandardMaterial color="#22222f" />
            </mesh>
            <group ref={head} position={[0, 1.18, 0]}>
              <mesh scale={[1, 0.9, 0.95]}>
                <sphereGeometry args={[0.32, 20, 16]} />
                <meshStandardMaterial color={C.robotHead} metalness={0.25} roughness={0.5} />
              </mesh>
              <mesh position={[0, 0.02, 0.27]}>
                <boxGeometry args={[0.42, 0.15, 0.06]} />
                <meshStandardMaterial
                  color={visor}
                  emissive={visor}
                  emissiveIntensity={2.4}
                  toneMapped={false}
                />
              </mesh>
              {[-0.09, 0.09].map((x) => (
                <mesh key={x} position={[x, 0.03, 0.305]}>
                  <boxGeometry args={[0.08, 0.06, 0.01]} />
                  <meshStandardMaterial
                    color="#fff"
                    emissive="#fff"
                    emissiveIntensity={2}
                    toneMapped={false}
                  />
                </mesh>
              ))}
              {[-0.31, 0.31].map((x) => (
                <mesh key={x} position={[x, 0, 0]}>
                  <boxGeometry args={[0.06, 0.16, 0.12]} />
                  <meshStandardMaterial color="#1a1a28" />
                </mesh>
              ))}
              <mesh position={[0, 0.38, 0]}>
                <cylinderGeometry args={[0.015, 0.015, 0.18, 6]} />
                <meshStandardMaterial color={C.joint} />
              </mesh>
              <mesh position={[0, 0.5, 0]}>
                <sphereGeometry args={[0.045, 10, 10]} />
                <meshStandardMaterial
                  color={color}
                  emissive={color}
                  emissiveIntensity={2}
                  toneMapped={false}
                />
              </mesh>
            </group>

            {thinkingSeated && <ThoughtBubble position={[0.5, 1.9, 0.1]} />}

            <group ref={fx} position={[0, 1.95, 0]}>
              {status === "blocked" && (
                <group>
                  <mesh>
                    <octahedronGeometry args={[0.18, 0]} />
                    <meshStandardMaterial
                      color={C.red}
                      emissive={C.red}
                      emissiveIntensity={3}
                      toneMapped={false}
                    />
                  </mesh>
                  <pointLight color={C.red} intensity={8} distance={3.5} />
                </group>
              )}
              {status === "waiting" && (
                <group>
                  <mesh position={[0, 0.1, 0]} rotation-x={Math.PI}>
                    <coneGeometry args={[0.14, 0.2, 12]} />
                    <meshStandardMaterial
                      color={C.amber}
                      emissive={C.amber}
                      emissiveIntensity={2.2}
                      toneMapped={false}
                    />
                  </mesh>
                  <mesh position={[0, -0.1, 0]}>
                    <coneGeometry args={[0.14, 0.2, 12]} />
                    <meshStandardMaterial
                      color={C.amber}
                      emissive={C.amber}
                      emissiveIntensity={2.2}
                      toneMapped={false}
                    />
                  </mesh>
                  {[0.2, -0.2].map((y) => (
                    <mesh key={y} position={[0, y, 0]}>
                      <cylinderGeometry args={[0.16, 0.16, 0.02, 12]} />
                      <meshStandardMaterial color="#3a3a54" />
                    </mesh>
                  ))}
                </group>
              )}
            </group>

            {celebrating && (
              <group ref={sparks} position={[0, 1.6, 0]}>
                {SPARKS.map((i) => {
                  const a = (i / SPARKS.length) * Math.PI * 2;
                  return (
                    <mesh
                      key={i}
                      position={[Math.cos(a) * 0.5, Math.sin(a * 1.7) * 0.3, Math.sin(a) * 0.5]}
                    >
                      <sphereGeometry args={[0.06, 8, 8]} />
                      <meshBasicMaterial
                        ref={i === 0 ? sparkMat : undefined}
                        color={C.emerald}
                        toneMapped={false}
                        transparent
                      />
                    </mesh>
                  );
                })}
              </group>
            )}

            {bubble && (
              <Html
                position={[1.15, 1.25, 0.1]}
                center
                distanceFactor={11}
                zIndexRange={[36, 0]}
                style={{ pointerEvents: "none" }}
              >
                <div key={bubble.id} className={`bubble bubble--${bubble.kind}`}>
                  {bubble.text}
                </div>
              </Html>
            )}

            <AgentTag3D agent={agent} position={[0, hasBeacon ? 2.55 : 2.1, 0]} mode={mode} />
          </group>
        </group>
      </group>
    </group>
  );
}
