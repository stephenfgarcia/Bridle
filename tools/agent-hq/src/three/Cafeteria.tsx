import { Html, Instance, Instances } from "@react-three/drei";
import { DoubleSide } from "three";
import { CAFE, CAFE_SEATS, CAFE_TABLES, ROOM, SOFA_CORNER, type Vec3 } from "./layout";
import { C, mulberry32 } from "./palette";

const SNACK_COLORS = ["#f472b6", "#ffb020", "#fde047", "#19f5a1", "#fb923c", "#a78bfa"];
const BOTTLE_COLORS = ["#22d3ee", "#19f5a1", "#ff2bd6", "#ffb020", "#8b5cf6", "#f472b6"];
const rng = mulberry32(9);
const SNACKS = SNACK_COLORS.map((color, i) => ({
  id: `s${i}`,
  color,
  x: -0.32 + (i % 3) * 0.32,
  z: i < 3 ? -0.1 : 0.12,
  donut: rng() < 0.5,
}));
const BOTTLES = BOTTLE_COLORS.map((color, i) => ({
  id: `b${i}`,
  color,
  x: -0.22 + (i % 3) * 0.22,
  y: i < 3 ? 1.35 : 0.75,
}));

function Counter() {
  return (
    <group position={[15, 0, -4.2]}>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[1.0, 1.0, 6.2]} />
        <meshStandardMaterial color="#1a1728" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.03, 0]}>
        <boxGeometry args={[1.14, 0.06, 6.4]} />
        <meshStandardMaterial color={C.steel} metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[-0.56, 0.14, 0]}>
        <boxGeometry args={[0.03, 0.04, 6.2]} />
        <meshStandardMaterial
          color={C.magenta}
          emissive={C.magenta}
          emissiveIntensity={2.2}
          toneMapped={false}
        />
      </mesh>

      <group position={[0, 1.06, -2.4]}>
        <mesh position={[0, 0.32, 0]}>
          <boxGeometry args={[0.55, 0.64, 0.5]} />
          <meshStandardMaterial color="#1d1b2a" metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh position={[-0.2, 0.42, 0.26]}>
          <boxGeometry args={[0.1, 0.06, 0.03]} />
          <meshStandardMaterial
            color={C.emerald}
            emissive={C.emerald}
            emissiveIntensity={2}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[0, 0.38, 0.2]}>
          <cylinderGeometry args={[0.03, 0.03, 0.14, 8]} />
          <meshStandardMaterial color="#3a3a54" metalness={0.8} />
        </mesh>
        <mesh position={[0, 0.07, 0.2]}>
          <cylinderGeometry args={[0.06, 0.05, 0.12, 12]} />
          <meshStandardMaterial color="#f4f2ff" />
        </mesh>
      </group>

      <group position={[0, 1.06, -0.3]}>
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[1.0, 0.04, 0.6]} />
          <meshStandardMaterial color="#2a2638" />
        </mesh>
        <mesh position={[0, 0.3, 0]}>
          <boxGeometry args={[1.0, 0.52, 0.6]} />
          <meshPhysicalMaterial
            color="#c4b5fd"
            transparent
            opacity={0.16}
            roughness={0.05}
            side={DoubleSide}
          />
        </mesh>
        {SNACKS.map((s) =>
          s.donut ? (
            <mesh key={s.id} position={[s.x, 0.09, s.z]} rotation-x={Math.PI / 2}>
              <torusGeometry args={[0.07, 0.035, 8, 16]} />
              <meshStandardMaterial color={s.color} />
            </mesh>
          ) : (
            <mesh key={s.id} position={[s.x, 0.09, s.z]}>
              <boxGeometry args={[0.14, 0.1, 0.1]} />
              <meshStandardMaterial color={s.color} />
            </mesh>
          ),
        )}
      </group>

      <group position={[0, 1.06, 1.9]}>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 1, 8]} />
          <meshStandardMaterial color="#2a2a3a" />
        </mesh>
        <mesh position={[0, 1.0, 0]}>
          <coneGeometry args={[0.25, 0.22, 16, 1, true]} />
          <meshStandardMaterial color="#2a2a3a" side={DoubleSide} />
        </mesh>
        <mesh position={[0, 0.94, 0]}>
          <sphereGeometry args={[0.06, 10, 10]} />
          <meshStandardMaterial
            color={C.amber}
            emissive={C.amber}
            emissiveIntensity={2.5}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}

function Fridge() {
  return (
    <group position={[15.1, 0, 0.9]}>
      <mesh position={[0, 1.0, 0]}>
        <boxGeometry args={[0.8, 2.0, 0.8]} />
        <meshStandardMaterial color="#1b1a2a" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[-0.41, 1.05, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[0.7, 1.75]} />
        <meshStandardMaterial
          color="#22d3ee"
          emissive="#22d3ee"
          emissiveIntensity={0.35}
          transparent
          opacity={0.9}
        />
      </mesh>
      {BOTTLES.map((b) => (
        <mesh key={b.id} position={[-0.3, b.y, b.x]}>
          <cylinderGeometry args={[0.05, 0.05, 0.3, 10]} />
          <meshStandardMaterial
            color={b.color}
            emissive={b.color}
            emissiveIntensity={0.8}
            toneMapped={false}
          />
        </mesh>
      ))}
      <mesh position={[-0.42, 1.05, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[0.72, 1.8]} />
        <meshPhysicalMaterial color="#9fe8ff" transparent opacity={0.12} roughness={0} />
      </mesh>
    </group>
  );
}

function Table({ position }: { position: Vec3 }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.76, 0]}>
        <cylinderGeometry args={[0.72, 0.72, 0.06, 28]} />
        <meshStandardMaterial color="#2a2638" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.79, 0]}>
        <cylinderGeometry args={[0.66, 0.66, 0.01, 28]} />
        <meshStandardMaterial color="#4a4466" />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.72, 10]} />
        <meshStandardMaterial color="#2a2a3a" metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.4, 0.45, 0.06, 20]} />
        <meshStandardMaterial color="#1a1a26" metalness={0.6} />
      </mesh>
    </group>
  );
}

const STOOL_PARTS: { y: number; s: [number, number, number]; c: string }[] = [
  { y: 0.47, s: [0.24, 0.07, 0.24], c: "#1b1a28" },
  { y: 0.22, s: [0.04, 0.44, 0.04], c: "#2a2a3a" },
  { y: 0.02, s: [0.21, 0.04, 0.21], c: "#1a1a26" },
];

/** All stools in one instanced mesh per part. */
function Stools() {
  const n = CAFE_SEATS.length * STOOL_PARTS.length;
  return (
    <Instances limit={n} range={n}>
      <cylinderGeometry args={[1, 1, 1, 16]} />
      <meshStandardMaterial color="#ffffff" metalness={0.5} roughness={0.7} />
      {CAFE_SEATS.map((seat) =>
        STOOL_PARTS.map((part) => (
          <Instance
            key={`${seat.position.join(",")}-${part.y}`}
            position={[seat.position[0], part.y, seat.position[2]]}
            scale={part.s}
            color={part.c}
          />
        )),
      )}
    </Instances>
  );
}

function SofaCorner() {
  const [x, , z] = SOFA_CORNER;
  return (
    <group position={[x, 0, z]}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, -0.6]}>
        <planeGeometry args={[4.6, 3.6]} />
        <meshStandardMaterial color="#120f24" emissive={C.violet} emissiveIntensity={0.08} />
      </mesh>
      <group position={[0, 0, 1.0]}>
        <mesh position={[0, 0.25, 0]}>
          <boxGeometry args={[2.6, 0.5, 0.95]} />
          <meshStandardMaterial color="#3b2a6b" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.78, -0.36]} rotation-x={0.1}>
          <boxGeometry args={[2.6, 0.62, 0.24]} />
          <meshStandardMaterial color="#3b2a6b" roughness={0.9} />
        </mesh>
        {[-0.85, 0, 0.85].map((cx) => (
          <mesh key={cx} position={[cx, 0.55, 0.05]}>
            <boxGeometry args={[0.78, 0.12, 0.8]} />
            <meshStandardMaterial color="#4c3a85" roughness={0.9} />
          </mesh>
        ))}
        {[-1.4, 1.4].map((cx) => (
          <mesh key={cx} position={[cx, 0.4, 0]}>
            <boxGeometry args={[0.2, 0.8, 0.95]} />
            <meshStandardMaterial color="#2f2258" roughness={0.9} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 0.42, -1.2]}>
        <cylinderGeometry args={[0.5, 0.5, 0.05, 20]} />
        <meshStandardMaterial color="#2a2638" />
      </mesh>
      <mesh position={[0, 0.2, -1.2]}>
        <cylinderGeometry args={[0.05, 0.05, 0.4, 8]} />
        <meshStandardMaterial color="#2a2a3a" metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.48, -1.2]}>
        <cylinderGeometry args={[0.07, 0.06, 0.12, 12]} />
        <meshStandardMaterial color="#f4f2ff" />
      </mesh>
    </group>
  );
}

/** The cafeteria: counter, coffee machine, snacks, fridge, round tables with stools, sofa corner. */
export function Cafeteria() {
  const cx = (CAFE.minX + CAFE.maxX) / 2;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[cx, 0.005, (ROOM.minZ + 6 + ROOM.maxZ) / 2]}>
        <planeGeometry args={[CAFE.maxX - CAFE.minX, ROOM.maxZ - ROOM.minZ - 6]} />
        <meshStandardMaterial color="#161231" roughness={0.9} />
      </mesh>
      <Counter />
      <Fridge />
      {CAFE_TABLES.map((t) => (
        <Table key={t.join(",")} position={t} />
      ))}
      <Stools />
      <SofaCorner />
      <pointLight
        position={[12.5, 4.5, -1]}
        color={C.amber}
        intensity={60}
        distance={18}
        decay={2}
      />
      <Html
        transform
        position={[15.7, 4.2, -4.2]}
        rotation={[0, -Math.PI / 2, 0]}
        distanceFactor={5}
        zIndexRange={[20, 0]}
        pointerEvents="none"
      >
        <div className="neon-sign">CAFÉ</div>
      </Html>
    </group>
  );
}
