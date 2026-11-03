import { Grid, Instance, Instances, MeshReflectorMaterial } from "@react-three/drei";
import { useRef } from "react";
import { DoubleSide, type Mesh } from "three";
import { PLANTS, ROOM, type Vec3, WATER_COOLER } from "./layout";
import { useOccluder } from "./occluders";
import { C } from "./palette";
import { useQuality } from "./QualityContext";

const WALL_H = ROOM.height;

function Wall({
  position,
  rotationY = 0,
  width,
}: {
  position: Vec3;
  rotationY?: number;
  width: number;
}) {
  const ref = useRef<Mesh>(null);
  useOccluder(ref);
  return (
    <mesh ref={ref} position={position} rotation-y={rotationY}>
      <boxGeometry args={[width, WALL_H, 0.3]} />
      <meshStandardMaterial color={C.wall} roughness={0.9} />
    </mesh>
  );
}

const MULLION_STEP = 3;

/** Floor-to-ceiling glass with slim mullions; the skyline sits outside. */
function Windows({
  position,
  rotationY = 0,
  width,
}: {
  position: Vec3;
  rotationY?: number;
  width: number;
}) {
  const count = Math.floor(width / MULLION_STEP);
  const mullions = Array.from({ length: count + 1 }, (_, i) => -width / 2 + i * (width / count));
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh position={[0, WALL_H / 2, 0]}>
        <planeGeometry args={[width, WALL_H]} />
        <meshPhysicalMaterial
          color="#6d5bd0"
          transparent
          opacity={0.14}
          roughness={0.05}
          metalness={0.3}
          side={DoubleSide}
        />
      </mesh>
      <Instances limit={mullions.length} range={mullions.length}>
        <boxGeometry args={[0.08, WALL_H, 0.12]} />
        <meshStandardMaterial color="#1c1930" />
        {mullions.map((x) => (
          <Instance key={x} position={[x, WALL_H / 2, 0]} />
        ))}
      </Instances>
      <mesh position={[0, WALL_H - 0.08, 0]}>
        <boxGeometry args={[width, 0.16, 0.14]} />
        <meshStandardMaterial color="#1c1930" />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[width, 0.2, 0.16]} />
        <meshStandardMaterial color="#1c1930" />
      </mesh>
      <mesh position={[0, WALL_H - 0.02, 0.09]}>
        <boxGeometry args={[width, 0.04, 0.04]} />
        <meshStandardMaterial
          color={C.violet}
          emissive={C.violet}
          emissiveIntensity={1.6}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function Strip({ from, to, color }: { from: Vec3; to: Vec3; color: string }) {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const length = Math.hypot(dx, dz);
  const mid: Vec3 = [(from[0] + to[0]) / 2, from[1], (from[2] + to[2]) / 2];
  const rotationY = Math.atan2(dx, dz);
  return (
    <mesh position={mid} rotation-y={rotationY}>
      <boxGeometry args={[0.08, 0.06, length]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={2.2}
        toneMapped={false}
      />
    </mesh>
  );
}

function Walkway({ from, to, width = 1.4 }: { from: Vec3; to: Vec3; width?: number }) {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const length = Math.hypot(dx, dz);
  const mid: Vec3 = [(from[0] + to[0]) / 2, 0.012, (from[2] + to[2]) / 2];
  const rotationY = Math.atan2(dx, dz);
  return (
    <group position={mid} rotation-y={rotationY}>
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial color="#171330" roughness={0.6} metalness={0.2} />
      </mesh>
      {[-width / 2, width / 2].map((x) => (
        <mesh key={x} position={[x, 0.01, 0]}>
          <boxGeometry args={[0.04, 0.02, length]} />
          <meshStandardMaterial
            color={C.violet}
            emissive={C.violet}
            emissiveIntensity={0.9}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

const LEAVES = [0, 1, 2, 3, 4, 5];

export function Plant({ position, scale = 1 }: { position: Vec3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.28, 0.22, 0.5, 12]} />
        <meshStandardMaterial color="#2a2638" />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.05, 12]} />
        <meshStandardMaterial color="#3b3650" />
      </mesh>
      {LEAVES.map((i) => {
        const a = (i / LEAVES.length) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.18, 0.95, Math.sin(a) * 0.18]}
            rotation={[Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5]}
            scale={[0.35, 0.9, 0.18]}
          >
            <sphereGeometry args={[0.5, 10, 10]} />
            <meshStandardMaterial color="#1f6b48" emissive="#19f5a1" emissiveIntensity={0.08} />
          </mesh>
        );
      })}
      <mesh position={[0, 1.2, 0]} scale={[0.3, 0.7, 0.3]}>
        <sphereGeometry args={[0.5, 10, 10]} />
        <meshStandardMaterial color="#2f8a5a" />
      </mesh>
    </group>
  );
}

function WaterCooler({ position }: { position: Vec3 }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.5, 1.0, 0.5]} />
        <meshStandardMaterial color="#1d1b2a" />
      </mesh>
      <mesh position={[0, 1.02, 0]}>
        <boxGeometry args={[0.54, 0.05, 0.54]} />
        <meshStandardMaterial color="#3b3650" />
      </mesh>
      <mesh position={[0, 1.4, 0]}>
        <cylinderGeometry args={[0.2, 0.22, 0.7, 14]} />
        <meshPhysicalMaterial color="#22d3ee" transparent opacity={0.45} roughness={0.1} />
      </mesh>
      <mesh position={[0, 0.78, 0.26]}>
        <boxGeometry args={[0.08, 0.06, 0.04]} />
        <meshStandardMaterial
          color={C.emerald}
          emissive={C.emerald}
          emissiveIntensity={2}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/** Floor, walls, windows, neon strips, walkways, plants and the water cooler. */
export function Room() {
  const { quality } = useQuality();
  const floorCenterZ = (ROOM.minZ + ROOM.maxZ) / 2;
  const depth = ROOM.maxZ - ROOM.minZ;
  const width = ROOM.maxX - ROOM.minX;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, floorCenterZ]}>
        <planeGeometry args={[width + 4, depth + 4]} />
        {quality === "high" ? (
          <MeshReflectorMaterial
            blur={[280, 90]}
            resolution={768}
            mixBlur={1}
            mixStrength={5}
            roughness={0.85}
            depthScale={1.1}
            minDepthThreshold={0.35}
            maxDepthThreshold={1.3}
            color="#0c0a19"
            metalness={0.35}
            mirror={0.4}
          />
        ) : (
          <meshStandardMaterial color="#0d0b1b" roughness={0.55} metalness={0.3} />
        )}
      </mesh>
      <Grid
        position={[0, 0.02, floorCenterZ]}
        args={[width, depth]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#221c3c"
        sectionSize={4}
        sectionThickness={1}
        sectionColor="#352a5e"
        fadeDistance={60}
        fadeStrength={1.2}
      />

      <Wall
        position={[ROOM.maxX, WALL_H / 2, floorCenterZ]}
        rotationY={Math.PI / 2}
        width={depth}
      />
      <Wall position={[-12.5, WALL_H / 2, ROOM.minZ]} width={7} />
      <Wall position={[12.5, WALL_H / 2, ROOM.minZ]} width={7} />
      <Windows position={[ROOM.minX, 0, floorCenterZ]} rotationY={Math.PI / 2} width={depth} />

      <Strip from={[-14, 5.9, -11.5]} to={[14, 5.9, -11.5]} color={C.magenta} />
      <Strip from={[-14, 5.9, -2.5]} to={[8, 5.9, -2.5]} color={C.violet} />
      <Strip from={[-14, 5.9, 5.5]} to={[8, 5.9, 5.5]} color={C.emerald} />
      <Strip from={[-14, 5.9, 13.5]} to={[8, 5.9, 13.5]} color={C.magenta} />
      <Strip from={[8.9, 5.9, -11.5]} to={[8.9, 5.9, 15]} color={C.violet} />
      <Strip from={[15.7, 5.6, -11]} to={[15.7, 5.6, 15]} color={C.magenta} />

      <Walkway from={[-15, 0, -8.6]} to={[15.5, 0, -8.6]} />
      <Walkway from={[8.9, 0, -8.6]} to={[8.9, 0, 15.5]} />
      <Walkway from={[-15, 0, 15]} to={[8.9, 0, 15]} width={1.2} />

      {PLANTS.map((p) => (
        <Plant key={p.position.join(",")} position={p.position} scale={p.scale} />
      ))}
      <WaterCooler position={WATER_COOLER} />
    </group>
  );
}
