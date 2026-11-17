"use client";

import { Canvas } from "@react-three/fiber";
import { useState } from "react";

const GRID_SIZE = 20;
const GRID_DIVISIONS = 20;

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * One static grid on the ground plane, drawn once (`frameloop="demand"`) in the grid colours of the canvas
 * tokens. No interaction: the canvas takes no pointer events. Only ever rendered in the browser (StaticGrid.tsx).
 */
export default function StaticGridCanvas() {
  const [colors] = useState(() => ({
    major: token("--canvas-grid-major"),
    minor: token("--canvas-grid-minor"),
  }));
  return (
    <Canvas
      aria-hidden="true"
      camera={{ position: [14, 10, 18], fov: 40 }}
      data-testid="static-grid"
      frameloop="demand"
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <gridHelper args={[GRID_SIZE, GRID_DIVISIONS, colors.major, colors.minor]} />
    </Canvas>
  );
}
