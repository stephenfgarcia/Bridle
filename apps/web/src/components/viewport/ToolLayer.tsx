"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  DoubleSide,
  type Group,
  type InterleavedBufferAttribute,
  Raycaster,
  Vector2,
  Vector3,
} from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { selectModel, useModelStore } from "../model/modelStore";
import { toolPreview } from "../tools/drawTools";
import { moveNodeAction, toolClick, toolDoubleClick } from "../tools/toolActions";
import { type CursorProblem, useToolStore } from "../tools/toolStore";
import {
  cursorFor,
  pickNodeOnScreen,
  planeThrough,
  rayToPlane,
  type ScreenNode,
  snapToPlane,
  type ToolCursor,
  type WorkPlane,
} from "../tools/workPlane";
import { type CanvasColors, CLICK_SLOP_PX, metresPerPixel, noRaycast } from "./ModelScene";
import type { Point3 } from "./scene";
import { useViewportStore } from "./viewportStore";

// Sizes on screen, in CSS pixels.
const MARKER_PX = 22;
const PREVIEW_LINE_PX = 3;

/** A place in the canvas, in CSS pixels from its top left corner, with the canvas's size. */
interface CanvasPlace {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A press of the main button that began on the canvas. */
interface Press {
  x: number;
  y: number;
  pointerId: number;
  /** Set when the press began on the selected node with the Select tool: that node is being dragged. */
  drag: { nodeId: string; plane: WorkPlane; moved: boolean } | null;
}

/**
 * Gives a set of line segments new coordinates (six numbers per segment). The numbers are written into the
 * geometry's buffer when the number of segments is the one it has; otherwise the geometry is replaced, because
 * the renderer keeps the instance count a geometry was first drawn with.
 */
function setSegments(line: LineSegments2, positions: number[]) {
  const start = line.geometry.getAttribute("instanceStart") as
    | InterleavedBufferAttribute
    | undefined;
  if (start !== undefined && start.data.array.length === positions.length) {
    start.data.set(positions);
    start.data.needsUpdate = true;
    return;
  }
  line.geometry.dispose();
  line.geometry = new LineSegmentsGeometry();
  line.geometry.setPositions(positions);
}

/**
 * The pointer side of the tools (card PX-02.4), inside the canvas: it turns pointer events into the tool
 * store's cursor, into clicks of the active tool and into the drag of the selected node, and draws the marker
 * and the preview lines. The geometry and the tools' rules are pure functions of ../tools; this file gives
 * them the camera's ray and the nodes' places on screen.
 *
 * - Every tool but Select (Node, Member, Support, Load): the cursor follows the pointer (a node within
 *   reach of the pointer, else the snapped point of the work plane); a press and release at most `CLICK_SLOP_PX` apart is a click of the tool, and
 *   a longer one is left to the orbit controls.
 * - Select tool: a press on the selected node (without Shift, Ctrl or the Command key) switches the orbit
 *   controls off until the release; once the pointer has moved more than `CLICK_SLOP_PX`, the node follows
 *   it on the work plane through the node's place, snapped, and the release moves it as one undo step.
 *
 * The marker and the lines are moved through refs when the tool store or the model store changes; no React
 * state is set on a pointer move, and the cursor in the store changes only when the snapped point does.
 */
export function ToolLayer({ colors }: { colors: CanvasColors }) {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const get = useThree((state) => state.get);
  const invalidate = useThree((state) => state.invalidate);
  const marker = useRef<Group>(null);
  const markerPoint = useRef<Point3 | null>(null);

  const line = useMemo(() => {
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions([0, 0, 0, 0, 0, 0]);
    const material = new LineMaterial({
      color: colors.selection,
      linewidth: PREVIEW_LINE_PX,
      depthTest: false,
      transparent: true,
      opacity: 0.8,
    });
    const segments = new LineSegments2(geometry, material);
    segments.raycast = noRaycast;
    segments.frustumCulled = false;
    segments.renderOrder = 4;
    segments.visible = false;
    return segments;
  }, [colors.selection]);
  useEffect(
    () => () => {
      line.geometry.dispose();
      line.material.dispose();
    },
    [line],
  );

  // The marker and the lines follow the two stores.
  useEffect(() => {
    const refresh = () => {
      const preview = toolPreview(useToolStore.getState(), selectModel(useModelStore.getState()));
      markerPoint.current = preview.marker;
      if (marker.current) {
        marker.current.visible = preview.marker !== null;
        if (preview.marker !== null) {
          marker.current.position.set(preview.marker[0], preview.marker[1], preview.marker[2]);
        }
      }
      line.visible = preview.segments.length > 0;
      if (line.visible) {
        setSegments(line, preview.segments);
      }
      invalidate();
    };
    refresh();
    const stopTools = useToolStore.subscribe(refresh);
    const stopModel = useModelStore.subscribe(refresh);
    return () => {
      stopTools();
      stopModel();
    };
  }, [line, invalidate]);

  // The marker faces the camera and keeps its size on screen.
  useFrame(({ camera: current, size }) => {
    const group = marker.current;
    const point = markerPoint.current;
    if (!group || point === null) {
      return;
    }
    current.updateMatrixWorld();
    group.quaternion.copy(current.quaternion);
    group.scale.setScalar(metresPerPixel(current, size.height, point) * MARKER_PX);
  });

  useEffect(() => {
    const canvas = gl.domElement;
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    const scratch = new Vector3();
    let press: Press | null = null;

    const placeOf = (event: MouseEvent): CanvasPlace => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        width: Math.max(rect.width, 1),
        height: Math.max(rect.height, 1),
      };
    };

    /** The point of a plane under a place of the canvas. */
    const planePoint = (at: CanvasPlace, plane: WorkPlane): Point3 | null => {
      camera.updateMatrixWorld();
      ndc.set((at.x / at.width) * 2 - 1, 1 - (at.y / at.height) * 2);
      raycaster.setFromCamera(ndc, camera);
      const { origin, direction } = raycaster.ray;
      return rayToPlane(
        [origin.x, origin.y, origin.z],
        [direction.x, direction.y, direction.z],
        plane,
      );
    };

    /** The node within reach of a place of the canvas; a node behind the camera is not picked. */
    const pickNode = (at: CanvasPlace): string | null => {
      camera.updateMatrixWorld();
      const onScreen: ScreenNode[] = [];
      for (const node of selectModel(useModelStore.getState()).nodes) {
        scratch.set(node.x, node.y, node.z).applyMatrix4(camera.matrixWorldInverse);
        if (!(scratch.z < 0)) {
          continue;
        }
        scratch.applyMatrix4(camera.projectionMatrix);
        onScreen.push({
          id: node.id,
          x: ((scratch.x + 1) / 2) * at.width,
          y: ((1 - scratch.y) / 2) * at.height,
        });
      }
      return pickNodeOnScreen(onScreen, at);
    };

    const cursorAt = (event: MouseEvent): { cursor: ToolCursor | null; problem: CursorProblem } => {
      const tools = useToolStore.getState();
      const at = placeOf(event);
      const cursor = cursorFor({
        model: selectModel(useModelStore.getState()),
        plane: tools.plane,
        step: tools.snapStep,
        hit: planePoint(at, tools.plane),
        pickedNodeId: pickNode(at),
      });
      return { cursor, problem: cursor === null ? "off-plane" : null };
    };

    /** With a drawing tool: the cursor of the store, and the node it is on as the hovered item. */
    const updateCursor = (event: MouseEvent) => {
      const tools = useToolStore.getState();
      if (tools.tool === "select") {
        tools.setCursor(null);
        return;
      }
      const { cursor, problem } = cursorAt(event);
      tools.setCursor(cursor, problem);
      useViewportStore
        .getState()
        .setHover(cursor?.nodeId ? { kind: "node", id: cursor.nodeId } : null);
    };

    const setOrbit = (enabled: boolean) => {
      const controls = get().controls as { enabled: boolean } | null;
      if (controls) {
        controls.enabled = enabled;
      }
    };

    const far = (event: MouseEvent, from: Press) =>
      Math.hypot(event.clientX - from.x, event.clientY - from.y) > CLICK_SLOP_PX;

    // In the capture phase on the window, so it runs before the orbit controls see the press.
    const onDown = (event: PointerEvent) => {
      press = null;
      if (event.target !== canvas || event.button !== 0) {
        return;
      }
      press = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, drag: null };
      const tools = useToolStore.getState();
      const { selection } = useViewportStore.getState();
      if (
        tools.tool !== "select" ||
        selection?.kind !== "node" ||
        event.shiftKey ||
        event.ctrlKey ||
        event.metaKey ||
        pickNode(placeOf(event)) !== selection.id
      ) {
        return;
      }
      const node = selectModel(useModelStore.getState()).nodes.find(
        (candidate) => candidate.id === selection.id,
      );
      if (!node) {
        return;
      }
      press.drag = {
        nodeId: node.id,
        plane: planeThrough(tools.plane, [node.x, node.y, node.z]),
        moved: false,
      };
      setOrbit(false);
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // The pointer is gone already; the window's listeners still end the drag.
      }
    };

    const onMove = (event: PointerEvent) => {
      const drag = press !== null && event.pointerId === press.pointerId ? press.drag : null;
      if (press !== null && drag !== null) {
        if (!drag.moved && !far(event, press)) {
          return;
        }
        drag.moved = true;
        const hit = planePoint(placeOf(event), drag.plane);
        if (hit !== null) {
          const tools = useToolStore.getState();
          tools.setDrag({
            nodeId: drag.nodeId,
            point: snapToPlane(hit, drag.plane, tools.snapStep),
          });
        }
        return;
      }
      if (event.target === canvas) {
        updateCursor(event);
      }
    };

    const endDrag = (event: PointerEvent, commit: boolean) => {
      setOrbit(true);
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      const tools = useToolStore.getState();
      const landed = tools.drag;
      tools.setDrag(null);
      if (commit && landed !== null) {
        moveNodeAction(landed.nodeId, landed.point);
      }
    };

    const onUp = (event: PointerEvent) => {
      const current = press;
      if (current === null || event.pointerId !== current.pointerId) {
        return;
      }
      press = null;
      if (current.drag !== null) {
        endDrag(event, current.drag.moved);
        return;
      }
      if (far(event, current) || useToolStore.getState().tool === "select") {
        return;
      }
      const { cursor, problem } = cursorAt(event);
      useToolStore.getState().setCursor(cursor, problem);
      if (cursor !== null) {
        toolClick(cursor);
        // The model may have a node at the cursor now.
        updateCursor(event);
      }
    };

    const onCancel = (event: PointerEvent) => {
      const current = press;
      if (current === null || event.pointerId !== current.pointerId) {
        return;
      }
      press = null;
      if (current.drag !== null) {
        endDrag(event, false);
      }
    };

    const onLeave = () => {
      const tools = useToolStore.getState();
      tools.setCursor(null);
      if (tools.tool !== "select") {
        useViewportStore.getState().setHover(null);
      }
    };

    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("dblclick", toolDoubleClick);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("dblclick", toolDoubleClick);
      if (press?.drag) {
        setOrbit(true);
        useToolStore.getState().setDrag(null);
      }
    };
  }, [camera, gl, get]);

  return (
    <>
      <group ref={marker}>
        <mesh raycast={noRaycast} renderOrder={5}>
          <ringGeometry args={[0.36, 0.5, 40]} />
          <meshBasicMaterial color={colors.selection} depthTest={false} side={DoubleSide} />
        </mesh>
        <mesh raycast={noRaycast} renderOrder={5}>
          <circleGeometry args={[0.16, 24]} />
          <meshBasicMaterial color={colors.selection} depthTest={false} side={DoubleSide} />
        </mesh>
      </group>
      <primitive object={line} />
    </>
  );
}
