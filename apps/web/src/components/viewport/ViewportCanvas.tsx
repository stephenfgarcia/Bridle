"use client";

import type { Model } from "@bridle/model";
import { GizmoHelper, GizmoViewport, OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import {
  type ReactNode,
  type Ref,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PerspectiveCamera } from "three";
import { t } from "../../i18n";
import { ToolPalette } from "../tools/ToolPalette";
import { ToolStatus } from "../tools/ToolStatus";
import { useToolStore } from "../tools/toolStore";
import { drawingBounds, emptyModelBounds, pointText, workPlaneGrid } from "../tools/workPlane";
import { placeCamera, SCENE_UP, VIEW_DIRECTIONS, VIEW_FOV_DEG, type ViewPreset } from "./camera";
import { type CanvasColors, ModelScene } from "./ModelScene";
import { buildScene, gridFor, type Point3, type SceneBounds } from "./scene";
import { ToolLayer } from "./ToolLayer";
import styles from "./Viewport.module.css";
import { useViewportStore } from "./viewportStore";

// How far from a member's centre line, in pixels, the pointer still picks it.
const MEMBER_PICK_PX = 6;

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

interface Palette extends CanvasColors {
  axes: [string, string, string];
}

function readPalette(): Palette {
  return {
    gridMajor: token("--canvas-grid-major"),
    gridMinor: token("--canvas-grid-minor"),
    member: token("--canvas-member"),
    node: token("--canvas-node"),
    support: token("--canvas-support"),
    supportFill: token("--canvas-grid-major"),
    selection: token("--canvas-selection"),
    hover: token("--canvas-hover"),
    axes: [token("--viz-axis-x"), token("--viz-axis-y"), token("--viz-axis-z")],
  };
}

interface CameraRigHandle {
  /** Frames the whole model without changing the direction of view. */
  fit: () => void;
  /** Frames the whole model from the direction of a preset. */
  view: (preset: ViewPreset) => void;
}

/** What `OrbitControls` hands to a ref, as far as this file uses it. */
interface Controls {
  target: { x: number; y: number; z: number; set: (x: number, y: number, z: number) => void };
  minDistance: number;
  maxDistance: number;
  update: () => void;
}

/**
 * The orbit controls (drag to orbit; right-drag, or drag with Shift, Ctrl or the Command key, to pan; the wheel
 * or a pinch to zoom) and the camera moves of the toolbar. It frames the model in the 3D preset when it mounts,
 * and again, from the direction and with the field of view the camera then has, when `frameKey` changes. A
 * change of the bounds alone does not move the camera. The camera jumps to its new place; the move is not
 * animated.
 */
function CameraRig({
  bounds,
  frameKey,
  ref,
}: {
  bounds: SceneBounds;
  frameKey: string;
  ref: Ref<CameraRigHandle>;
}) {
  const camera = useThree((state) => state.camera);
  const get = useThree((state) => state.get);
  const invalidate = useThree((state) => state.invalidate);
  const controls = useRef<Controls>(null);
  const mounted = useRef(false);
  // The bounds of the last render, for the camera moves below: they read it when they run.
  const latestBounds = useRef(bounds);
  latestBounds.current = bounds;

  const place = useCallback(
    (direction: Point3, fovDeg: number) => {
      const { width, height } = get().size;
      const { position, target, distance } = placeCamera(
        latestBounds.current,
        direction,
        fovDeg,
        width / Math.max(height, 1),
      );
      const perspective = camera as PerspectiveCamera;
      perspective.fov = fovDeg;
      perspective.position.set(position[0], position[1], position[2]);
      perspective.near = distance / 100;
      perspective.far = distance * 100;
      perspective.updateProjectionMatrix();
      if (controls.current) {
        controls.current.target.set(target[0], target[1], target[2]);
        controls.current.minDistance = distance / 40;
        controls.current.maxDistance = distance * 20;
        controls.current.update();
      } else {
        perspective.lookAt(target[0], target[1], target[2]);
      }
      invalidate();
    },
    [camera, get, invalidate],
  );

  const currentDirection = useCallback((): Point3 => {
    const target = controls.current?.target ?? { x: 0, y: 0, z: 0 };
    const direction: Point3 = [
      camera.position.x - target.x,
      camera.position.y - target.y,
      camera.position.z - target.z,
    ];
    return Math.hypot(direction[0], direction[1], direction[2]) > 1e-9
      ? direction
      : VIEW_DIRECTIONS["3d"];
  }, [camera]);

  useImperativeHandle(
    ref,
    () => ({
      fit: () => place(currentDirection(), (camera as PerspectiveCamera).fov),
      view: (preset) => place(VIEW_DIRECTIONS[preset], VIEW_FOV_DEG[preset]),
    }),
    [place, currentDirection, camera],
  );

  // Runs when the rig mounts and when `frameKey` changes; the effect does not read the key itself.
  // biome-ignore lint/correctness/useExhaustiveDependencies: frameKey is the trigger
  useLayoutEffect(() => {
    if (mounted.current) {
      place(currentDirection(), (camera as PerspectiveCamera).fov);
    } else {
      place(VIEW_DIRECTIONS["3d"], VIEW_FOV_DEG["3d"]);
    }
    mounted.current = true;
  }, [place, currentDirection, camera, frameKey]);

  return <OrbitControls enableDamping={false} makeDefault ref={controls as Ref<never>} />;
}

/**
 * The element around the canvas. It shows a pointing hand over a node or a member and a crosshair with the Node
 * and the Member tool, and it says, for a test or a script, what the pointer and the tools are at:
 * - `data-hover`: the item under the pointer, as `member:b1` or `node:n2`, or empty;
 * - `data-tool`: the active tool, `select`, `node` or `member`;
 * - `data-cursor`: where the Node or Member tool would act, or where a dragged node would land, as `x,y,z` in
 *   metres (`pointText`), or empty;
 * - `data-member-start`: the id of the node the Member tool's next member starts at, or empty;
 * - `data-dragging`: the id of the node being dragged, or empty.
 */
function HoverSurface({ children }: { children: ReactNode }) {
  const hover = useViewportStore((state) => state.hover);
  const tool = useToolStore((state) => state.tool);
  const cursor = useToolStore((state) => state.cursor);
  const drag = useToolStore((state) => state.drag);
  const memberStart = useToolStore((state) => state.memberStart);
  const point = drag?.point ?? cursor?.point ?? null;
  const look = tool !== "select" ? styles.surfaceDraw : hover ? styles.surfaceHover : "";
  return (
    <div
      className={`${styles.surface} ${look}`}
      data-cursor={point ? pointText(point) : ""}
      data-dragging={drag ? drag.nodeId : ""}
      data-hover={hover ? `${hover.kind}:${hover.id}` : ""}
      data-member-start={memberStart ?? ""}
      data-testid="viewport-surface"
      data-tool={tool}
    >
      {children}
    </div>
  );
}

const PRESETS: { preset: ViewPreset; label: string }[] = [
  { preset: "3d", label: t("workspace.viewport.view3d") },
  { preset: "front", label: t("workspace.viewport.viewFront") },
  { preset: "top", label: t("workspace.viewport.viewTop") },
];

/**
 * The 3D canvas of the viewport and its toolbar (the tool palette with the work plane and the snap step, Fit
 * and the three view presets), with the tools' status lines in the bottom left corner. Only ever rendered in the
 * browser (Viewport.tsx). The canvas draws a frame when something changed (`frameloop="demand"`): the camera
 * moved, or React committed a change to the scene.
 */
export default function ViewportCanvas({ model, frameKey }: { model: Model; frameKey: string }) {
  const built = useMemo(() => buildScene(model), [model]);
  const plane = useToolStore((state) => state.plane);
  // The grids cover the model and the drawing area of an empty model; the camera frames the model, or that
  // drawing area while the model has no node.
  const { scene, planeGrid, frameBounds } = useMemo(() => {
    const hasNodes = built.nodes.length > 0;
    const covered = drawingBounds(built.bounds, hasNodes, plane);
    return {
      scene: { ...built, grid: gridFor(covered) },
      planeGrid: workPlaneGrid(plane, covered),
      frameBounds: hasNodes ? built.bounds : emptyModelBounds(plane),
    };
  }, [built, plane]);
  const [palette] = useState(readPalette);
  const rig = useRef<CameraRigHandle>(null);
  return (
    <>
      <HoverSurface>
        <Canvas
          // `SCENE_UP` makes the model's Z axis the screen's up for the camera and, through it, the controls.
          camera={{ fov: VIEW_FOV_DEG["3d"], up: [SCENE_UP[0], SCENE_UP[1], SCENE_UP[2]] }}
          dpr={[1, 2]}
          frameloop="demand"
          onCreated={({ raycaster }) => {
            raycaster.params.Line2 = { threshold: MEMBER_PICK_PX };
          }}
          // A click on nothing clears the selection with the Select tool; the other tools act on it (ToolLayer).
          onPointerMissed={() => {
            if (useToolStore.getState().tool === "select") {
              useViewportStore.getState().select(null);
            }
          }}
          style={{ position: "absolute", inset: 0 }}
        >
          <ambientLight intensity={1.4} />
          <directionalLight intensity={2.2} position={[6, -10, 14]} />
          <CameraRig bounds={frameBounds} frameKey={frameKey} ref={rig} />
          <ModelScene colors={palette} scene={scene} workPlane={planeGrid} />
          <ToolLayer colors={palette} />
          <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
            <GizmoViewport
              axisColors={palette.axes}
              disabled
              hideNegativeAxes
              labelColor="#ffffff"
            />
          </GizmoHelper>
        </Canvas>
      </HoverSurface>
      <div className={styles.toolbar}>
        <ToolPalette />
        <div className={styles.camera}>
          <button className={styles.button} onClick={() => rig.current?.fit()} type="button">
            {t("workspace.viewport.fit")}
          </button>
          {/* biome-ignore lint/a11y/useSemanticElements: a group of buttons, not a form's fieldset */}
          <div aria-label={t("workspace.viewport.views")} className={styles.group} role="group">
            {PRESETS.map(({ preset, label }) => (
              <button
                className={styles.button}
                key={preset}
                onClick={() => rig.current?.view(preset)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <ToolStatus />
    </>
  );
}
