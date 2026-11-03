import { useLayoutEffect, useMemo, useRef } from "react";
import { Color, type InstancedMesh, Object3D } from "three";
import { C, mulberry32, WINDOW_LIGHTS } from "./palette";

interface Building {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  /** Which face looks at the office: +x for the left field, +z for the back field. */
  face: "x" | "z";
  near: boolean;
}

interface Light {
  x: number;
  y: number;
  z: number;
  face: "x" | "z";
  color: string;
}

function generate(): { buildings: Building[]; lights: Light[] } {
  const rng = mulberry32(2026);
  const buildings: Building[] = [];
  // Left field: outside the window wall (x < -18), stretching back.
  for (let col = 0; col < 9; col += 1) {
    for (let row = 0; row < 16; row += 1) {
      const x = -20 - col * 4.2 - rng() * 1.2;
      const z = -46 + row * 4.3 + rng() * 1.2;
      const h = 4 + rng() * 12 + col * 1.4;
      buildings.push({
        x,
        z,
        w: 2.2 + rng() * 1.4,
        d: 2.2 + rng() * 1.4,
        h,
        face: "x",
        near: col < 2,
      });
    }
  }
  // Back field: behind the command wall (z < -18).
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 16; col += 1) {
      const x = -32 + col * 4.3 + rng() * 1.2;
      const z = -20 - row * 4.2 - rng() * 1.2;
      const h = 5 + rng() * 14 + row * 1.2;
      buildings.push({
        x,
        z,
        w: 2.2 + rng() * 1.4,
        d: 2.2 + rng() * 1.4,
        h,
        face: "z",
        near: row < 2,
      });
    }
  }
  const lights: Light[] = [];
  for (const b of buildings) {
    if (!b.near) continue;
    const rows = Math.floor(b.h / 1.5);
    const cols = Math.floor((b.face === "x" ? b.d : b.w) / 0.8);
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (rng() < 0.45) continue;
        const color = WINDOW_LIGHTS[Math.floor(rng() * WINDOW_LIGHTS.length)] ?? WINDOW_LIGHTS[0];
        const y = 0.9 + r * 1.5;
        if (b.face === "x") {
          lights.push({
            x: b.x + b.w / 2 + 0.02,
            y,
            z: b.z - b.d / 2 + 0.5 + c * 0.8,
            face: "x",
            color,
          });
        } else {
          lights.push({
            x: b.x - b.w / 2 + 0.5 + c * 0.8,
            y,
            z: b.z + b.d / 2 + 0.02,
            face: "z",
            color,
          });
        }
      }
    }
  }
  return { buildings, lights };
}

/** A glowing night city outside the windows, built from instanced boxes and window planes. */
export function Skyline() {
  const data = useMemo(generate, []);
  const buildings = useRef<InstancedMesh>(null);
  const lights = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const dummy = new Object3D();
    const b = buildings.current;
    if (b) {
      data.buildings.forEach((it, i) => {
        dummy.position.set(it.x, it.h / 2, it.z);
        dummy.scale.set(it.w, it.h, it.d);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        b.setMatrixAt(i, dummy.matrix);
      });
      b.instanceMatrix.needsUpdate = true;
    }
    const l = lights.current;
    if (l) {
      const color = new Color();
      data.lights.forEach((it, i) => {
        dummy.position.set(it.x, it.y, it.z);
        dummy.scale.set(1, 1, 1);
        dummy.rotation.set(0, it.face === "x" ? Math.PI / 2 : 0, 0);
        dummy.updateMatrix();
        l.setMatrixAt(i, dummy.matrix);
        l.setColorAt(i, color.set(it.color).multiplyScalar(1.6));
      });
      l.instanceMatrix.needsUpdate = true;
      if (l.instanceColor) l.instanceColor.needsUpdate = true;
    }
  }, [data]);

  return (
    <group>
      <instancedMesh ref={buildings} args={[undefined, undefined, data.buildings.length]}>
        <boxGeometry />
        <meshStandardMaterial color="#0c0a18" emissive="#120c26" emissiveIntensity={0.7} />
      </instancedMesh>
      <instancedMesh ref={lights} args={[undefined, undefined, data.lights.length]}>
        <planeGeometry args={[0.4, 0.55]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <mesh position={[-30, 22, -34]}>
        <sphereGeometry args={[2.4, 24, 24]} />
        <meshBasicMaterial color="#efe6ff" toneMapped={false} />
      </mesh>
      <mesh position={[-30, 22, -34]}>
        <sphereGeometry args={[4.5, 24, 24]} />
        <meshBasicMaterial color="#a78bfa" transparent opacity={0.12} />
      </mesh>
      <mesh position={[-10, 3, -52]}>
        <planeGeometry args={[120, 8]} />
        <meshBasicMaterial color={C.magenta} transparent opacity={0.08} />
      </mesh>
      <mesh position={[-52, 3, -10]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[100, 8]} />
        <meshBasicMaterial color={C.violet} transparent opacity={0.08} />
      </mesh>
    </group>
  );
}
