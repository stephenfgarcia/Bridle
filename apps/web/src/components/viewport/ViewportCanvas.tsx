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
import { NodeReadout } from "../analysis/NodeReadout";
import { ToolPalette } from "../tools/ToolPalette";
import { ToolStatus } from "../tools/ToolStatus";
import { useToolStore } from "../tools/toolStore";
import { drawingBounds, emptyModelBounds, pointText, workPlaneGrid } from "../tools/workPlane";
import { placeCamera, SCENE_UP, VIEW_DIRECTIONS, VIEW_FOV_DEG, type ViewPreset } from "./camera";
import { createLabelLinks, LoadLabels, Loads } from "./LoadGlyphs";
import { type CanvasColors, ModelScene } from "./ModelScene";
import { ResultLabels, Results } from "./ResultGlyphs";
import { ResultsDisplay } from "./ResultsDisplay";
import { SectionLegend } from "./SectionLegend";
import { buildScene, gridFor, type Point3, roomForLoads, type SceneBounds } from "./scene";
import { SECTION_COLOR_TOKENS, sectionColors } from "./sectionColors";
import { ToolLayer } from "./ToolLayer";
import { type ResultDrawing, useResultDrawing } from "./useResultDrawing";
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
    // A colour of the data palette that neither the members, the supports nor the selection use.
    load: token("--viz-case-E"),
    // The deflected shape has no token of its own yet (`--plum-600` is a colour of the base palette that
    // nothing else in the canvas uses); the reactions have one.
    deflection: token("--plum-600"),
    reaction: token("--canvas-reaction"),
    sections: SECTION_COLOR_TOKENS.map(token),
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
 * The element around the canvas. It shows a pointing hand over a node or a member and a crosshair with every
 * tool but Select, and it says, for a test or a script, what the pointer and the tools are at:
 * - `data-hover`: the item under the pointer, as `member:b1` or `node:n2`, or empty;
 * - `data-tool`: the active tool, `select`, `node`, `member`, `support` or `load`;
 * - `data-cursor`: where a tool other than Select would act, or where a dragged node would land, as `x,y,z` in
 *   metres (`pointText`), or empty;
 * - `data-member-start`: the id of the node the Member tool's next member starts at, or empty;
 * - `data-dragging`: the id of the node being dragged, or empty;
 * - `data-loads`: how many load symbols the scene draws (one per force, moment and uniform load of the active
 *   load case);
 * - `data-results`: `none` while no results are drawn beside the model, `stale` while those drawn belong to
 *   the model before the last change, `fresh` otherwise;
 * - `data-deflected`: how many members the deflected shape draws (0 while it is off or there are no results);
 * - `data-reactions`: how many reaction symbols are drawn (one per force or moment component that is not
 *   negligible; 0 while they are off or there are no results).
 */
function HoverSurface({
  children,
  loads,
  drawing,
}: {
  children: ReactNode;
  loads: number;
  drawing: ResultDrawing | null;
}) {
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
      data-deflected={drawing?.deflected?.memberIds.length ?? 0}
      data-dragging={drag ? drag.nodeId : ""}
      data-hover={hover ? `${hover.kind}:${hover.id}` : ""}
      data-loads={loads}
      data-member-start={memberStart ?? ""}
      data-reactions={drawing?.reactions.length ?? 0}
      data-results={drawing === null ? "none" : drawing.stale ? "stale" : "fresh"}
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
 * The 3D canvas of the viewport (the model, the loads of the active load case and, while the analysis has
 * results for it, the deflected shape and the reactions of that load case: ./useResultDrawing.ts), the "Colour
 * by section" control with its legend (./SectionLegend.tsx) and its toolbar (the tool
 * palette with the active tool's options, the work plane and the snap step, Fit and the three view presets, and the "Results display" group of ./ResultsDisplay.tsx), with the tools' status lines in the bottom left corner. Only ever rendered in the
 * browser (Viewport.tsx). The canvas draws a frame when something changed (`frameloop="demand"`): the camera
 * moved, or React committed a change to the scene.
 */
export default function ViewportCanvas({ model, frameKey }: { model: Model; frameKey: string }) {
  // The loads drawn are those of the load case chosen in the side panel (the model's first by default).
  const loadCaseId = useToolStore((state) => state.loadCaseId);
  const built = useMemo(() => buildScene(model, loadCaseId), [model, loadCaseId]);
  const drawing = useResultDrawing(model, frameKey);
  // The camera leaves room around the model for the load symbols, and for the reactions under the supports.
  const reactionsOn = useViewportStore((state) => state.showReactions);
  const plane = useToolStore((state) => state.plane);
  // The grids cover the model and the drawing area of an empty model; the camera frames the model (with room
  // around it for the load symbols when the scene has any), or that drawing area while the model has no node.
  const { scene, planeGrid, frameBounds } = useMemo(() => {
    const hasNodes = built.nodes.length > 0;
    const covered = drawingBounds(built.bounds, hasNodes, plane);
    return {
      scene: { ...built, grid: gridFor(covered) },
      planeGrid: workPlaneGrid(plane, covered),
      frameBounds: !hasNodes
        ? emptyModelBounds(plane)
        : built.loads.length > 0 || (reactionsOn && built.supports.length > 0)
          ? roomForLoads(built.bounds)
          : built.bounds,
    };
  }, [built, plane, reactionsOn]);
  const [palette] = useState(readPalette);
  // "Colour by section": the colour of each drawn member, or `null` while the control is off.
  const colorBySection = useViewportStore((state) => state.colorBySection);
  const bySection = useMemo(() => sectionColors(model), [model]);
  const memberColors = useMemo(
    () =>
      colorBySection
        ? scene.members.map((member) => {
            const index = bySection.byMember.get(member.id);
            return (index == null ? undefined : palette.sections[index]) ?? palette.member;
          })
        : null,
    [colorBySection, scene.members, bySection, palette],
  );
  const rig = useRef<CameraRigHandle>(null);
  const [labelLinks] = useState(createLabelLinks);
  const [resultLinks] = useState(createLabelLinks);
  return (
    <>
      <HoverSurface drawing={drawing} loads={scene.loads.length}>
        <Canvas
          // `SCENE_UP` makes the model's Z axis the screen's up for the camera and, through it, the controls.
          camera={{ fov: VIEW_FOV_DEG["3d"], up: [SCENE_UP[0], SCENE_UP[1], SCENE_UP[2]] }}
          dpr={[1, 2]}
          frameloop="demand"
          onCreated={({ raycaster }) => {
            raycaster.params.Line2 = { threshold: MEMBER_PICK_PX };
          }}
          // A click on nothing clears the selection with the Select tool, unless Shift is held (a Shift-click
          // that misses a member keeps the selection); the other tools act on it (ToolLayer).
          onPointerMissed={(event) => {
            if (useToolStore.getState().tool === "select" && !event.shiftKey) {
              useViewportStore.getState().select(null);
            }
          }}
          style={{ position: "absolute", inset: 0 }}
        >
          <ambientLight intensity={1.4} />
          <directionalLight intensity={2.2} position={[6, -10, 14]} />
          <CameraRig bounds={frameBounds} frameKey={frameKey} ref={rig} />
          <ModelScene
            colors={palette}
            memberColors={memberColors}
            // The undeformed members step back while the deflected shape is drawn over them.
            quietMembers={drawing !== null && drawing.deflected !== null}
            scene={scene}
            workPlane={planeGrid}
          />
          <Loads color={palette.load} links={labelLinks} loads={scene.loads} />
          <Results colors={palette} drawing={drawing} links={resultLinks} />
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
        <LoadLabels links={labelLinks} loads={scene.loads} />
        <ResultLabels drawing={drawing} links={resultLinks} />
        <NodeReadout links={resultLinks} model={model} />
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
        <ResultsDisplay drawing={drawing} />
      </div>
      <SectionLegend legend={bySection.legend} />
      <ToolStatus />
    </>
  );
}
