"use client";

import type { MessageId } from "@bridle/i18n";
import type { Model } from "@bridle/model";
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { type BufferGeometry, ConeGeometry, type Group, type Mesh, TorusGeometry } from "three";
import { t } from "../../i18n";
import {
  Anchor,
  type ArrowGeometry,
  arrow,
  type LabelLinks,
  putLabel,
  towards,
  usePlacedLabels,
} from "./LoadGlyphs";
import { metresPerPixel, noRaycast } from "./ModelScene";
import {
  formatMm,
  type ReactionForceGlyph,
  type ReactionLabel,
  type ReactionMomentGlyph,
} from "./resultDrawing";
import type { Point3 } from "./scene";
import { readoutNodeId } from "./selection";
import type { ResultDrawing } from "./useResultDrawing";
import styles from "./Viewport.module.css";
import { useViewportStore } from "./viewportStore";

// Sizes on screen, in CSS pixels, kept at every zoom as the load symbols are. The deflected curve is wider
// than a member (2.5 px, and 1.5 px while the curve is drawn). An arrow of a reaction is `REACTION_FORCE_PX`
// long; the arc of a reaction moment has the diameter `REACTION_MOMENT_PX`, larger than the arc of a load
// moment (46 px), so that the two can be told apart at one node.
const DEFLECTED_PX = 3;
export const REACTION_FORCE_PX = 52;
export const REACTION_MOMENT_PX = 64;
const LARGEST_MARK_PX = 9;
// How far beyond the far end of an arrow the centre of its label is, in the arrow's own length: more for an
// arrow that lies across the screen in the Front view, whose label is wider than it is high.
const LABEL_BEYOND_VERTICAL = 0.3;
const LABEL_BEYOND_HORIZONTAL = 0.75;
// Where the label of a moment is, in the arc's own diameter, along X and against Y of the glyph: beside the
// arrow head, clear of an arrow under the node.
const MOMENT_LABEL_X = 1.02;
const MOMENT_LABEL_Y = 0.62;
// Results that belong to the model before the last change are drawn faded until the new ones arrive.
const STALE_OPACITY = 0.35;

/** The key of the label of the largest displacement in the label links; a reaction's is its own key. */
export const LARGEST_LABEL_KEY = "largest";
/** The key of the readout of a node's displacement (../analysis/NodeReadout.tsx) in the label links. */
export const READOUT_KEY = "readout";

/**
 * Says on the readout's element which way its card goes from the node, by where the node is in the viewport:
 * towards the middle, so that the card stays in the picture (`data-h`: `left` or `right`; `data-v`: `above` or
 * `below`). The style sheet does the rest.
 */
export function aimReadout(
  element: HTMLElement,
  place: { x: number; y: number } | null | undefined,
) {
  const area = element.parentElement;
  if (!place || !area) {
    return;
  }
  element.dataset.h = place.x > area.clientWidth / 2 ? "left" : "right";
  element.dataset.v = place.y > area.clientHeight / 2 ? "above" : "below";
}

/**
 * The place of the readout in the scene: the node under the pointer, or else the one selected node, where the
 * model of the results has it. It reads the hover and the selection itself, so that the pointer moving over
 * the nodes does not render the rest of the canvas again.
 */
function ReadoutAnchor({ model, links }: { model: Model; links: LabelLinks }) {
  const hover = useViewportStore((state) => state.hover);
  const selection = useViewportStore((state) => state.selection);
  const nodeId = readoutNodeId(hover, selection);
  const node = nodeId === null ? undefined : model.nodes.find((entry) => entry.id === nodeId);
  if (node === undefined) {
    return null;
  }
  return <Anchor anchorKey={READOUT_KEY} links={links} position={[node.x, node.y, node.z]} />;
}

const UNIT_MESSAGE: Record<ReactionLabel["unit"], MessageId> = {
  kN: "workspace.loads.valueKN",
  kNm: "workspace.loads.valueKNm",
};

/** The colours of the results, read from the tokens (ViewportCanvas.tsx). */
export interface ResultColors {
  deflection: string;
  reaction: string;
}

interface ResultGeometries {
  force: ArrowGeometry;
  arc: BufferGeometry;
  arcHead: BufferGeometry;
}

const ARC_RADIUS = 0.5;
const ARC_HEAD_LENGTH = 0.25;

// The arc of a moment runs counter-clockwise about the glyph's +Z from `ARC_FROM` to `ARC_TO`, measured from
// the glyph's +X axis.
const ARC_FROM = Math.PI / 4;
const ARC_TO = (Math.PI * 5) / 3;

function makeGeometries(): ResultGeometries {
  // Part of a circle in the glyph's X-Y plane, counter-clockwise about +Z (the sense of a moment about +Z by
  // the right-hand rule), from 45 degrees to 300 degrees. The arrow head goes on from there and ends short of
  // the +X axis: the gap is around that axis, where a horizontal arrow at the node lies, and the head is on
  // the diagonal, clear of an arrow under the node.
  const arc = new TorusGeometry(ARC_RADIUS, 0.022, 8, 40, ARC_TO - ARC_FROM);
  arc.rotateZ(ARC_FROM);
  // A cone's apex is at +Y: turned to the direction the arc goes on in at its end, its base on that end.
  const along = [-Math.sin(ARC_TO), Math.cos(ARC_TO)] as const;
  const arcHead = new ConeGeometry(0.09, ARC_HEAD_LENGTH, 16);
  arcHead.rotateZ(ARC_TO);
  arcHead.translate(
    ARC_RADIUS * Math.cos(ARC_TO) + (along[0] * ARC_HEAD_LENGTH) / 2,
    ARC_RADIUS * Math.sin(ARC_TO) + (along[1] * ARC_HEAD_LENGTH) / 2,
    0,
  );
  return { force: arrow(0.28, 0.1, 0.024), arc, arcHead };
}

function disposeGeometries(geometries: ResultGeometries) {
  for (const geometry of [
    geometries.force.shaft,
    geometries.force.head,
    geometries.arc,
    geometries.arcHead,
  ]) {
    geometry.dispose();
  }
}

interface Look {
  color: string;
  opacity: number;
}

function Solid({ geometry, look }: { geometry: BufferGeometry; look: Look }) {
  return (
    <mesh geometry={geometry} raycast={noRaycast}>
      <meshBasicMaterial color={look.color} opacity={look.opacity} transparent={look.opacity < 1} />
    </mesh>
  );
}

/**
 * One component of a reaction force: an arrow that points the way the support pushes the structure, on the
 * side of the node the glyph names, clear of the support symbol, with its value beyond its far end.
 */
function ReactionForce({
  glyph,
  geometry,
  look,
  links,
}: {
  glyph: ReactionForceGlyph;
  geometry: ArrowGeometry;
  look: Look;
  links: LabelLinks;
}) {
  const group = useRef<Group>(null);
  const quaternion = useMemo(() => towards(glyph.direction), [glyph.direction]);
  // The arrow's own frame has its tip at the origin and its tail at Z = -1: the tip is `clearancePx` from
  // the node when the head is the near end, and a whole arrow further when the tail is.
  const tipPx = glyph.clearancePx + (glyph.nearEnd === "head" ? 0 : REACTION_FORCE_PX);
  const beyond = glyph.component === "fz" ? LABEL_BEYOND_VERTICAL : LABEL_BEYOND_HORIZONTAL;
  useFrame(({ camera, size }) => {
    camera.updateMatrixWorld();
    const perPixel = metresPerPixel(camera, size.height, glyph.point);
    const out = perPixel * tipPx;
    group.current?.position.set(
      glyph.point[0] + glyph.side[0] * out,
      glyph.point[1] + glyph.side[1] * out,
      glyph.point[2] + glyph.side[2] * out,
    );
    group.current?.scale.setScalar(perPixel * REACTION_FORCE_PX);
  }, -1);
  return (
    <group quaternion={quaternion} ref={group}>
      <Solid geometry={geometry.shaft} look={look} />
      <Solid geometry={geometry.head} look={look} />
      <Anchor
        anchorKey={glyph.key}
        links={links}
        position={[0, 0, glyph.nearEnd === "head" ? -1 - beyond : beyond]}
      />
    </group>
  );
}

/**
 * One component of a reaction moment: three quarters of a circle around the node, in the plane the moment
 * turns in, with an arrow head at its end. The sense is the right-hand rule about the glyph's axis: seen with
 * the axis pointing at the eye, the arrow runs counter-clockwise.
 */
function ReactionMoment({
  glyph,
  geometries,
  look,
  links,
}: {
  glyph: ReactionMomentGlyph;
  geometries: ResultGeometries;
  look: Look;
  links: LabelLinks;
}) {
  const group = useRef<Group>(null);
  const quaternion = useMemo(() => towards(glyph.axis), [glyph.axis]);
  useFrame(({ camera, size }) => {
    camera.updateMatrixWorld();
    group.current?.scale.setScalar(
      metresPerPixel(camera, size.height, glyph.point) * REACTION_MOMENT_PX,
    );
  }, -1);
  return (
    <group
      position={[glyph.point[0], glyph.point[1], glyph.point[2]]}
      quaternion={quaternion}
      ref={group}
    >
      <Solid geometry={geometries.arc} look={look} />
      <Solid geometry={geometries.arcHead} look={look} />
      <Anchor anchorKey={glyph.key} links={links} position={[MOMENT_LABEL_X, -MOMENT_LABEL_Y, 0]} />
    </group>
  );
}

/** A dot of a fixed size on the deflected curve where the displacement is largest, and its label's place. */
function LargestMark({ point, look, links }: { point: Point3; look: Look; links: LabelLinks }) {
  const mesh = useRef<Mesh>(null);
  useFrame(({ camera, size }) => {
    camera.updateMatrixWorld();
    mesh.current?.scale.setScalar(metresPerPixel(camera, size.height, point) * LARGEST_MARK_PX);
  }, -1);
  return (
    <group position={[point[0], point[1], point[2]]}>
      <mesh raycast={noRaycast} ref={mesh} renderOrder={2}>
        <sphereGeometry args={[0.5, 16, 12]} />
        <meshBasicMaterial
          color={look.color}
          depthTest={false}
          opacity={look.opacity}
          transparent={look.opacity < 1}
        />
      </mesh>
      <Anchor anchorKey={LARGEST_LABEL_KEY} links={links} position={[0, 0, 0]} />
    </group>
  );
}

/**
 * The results of one drawing (card PX-02.9, ./useResultDrawing.ts), inside the canvas: the deflected shape as
 * one set of line segments in the deflection colour, a dot where the displacement is largest (only while the
 * deflected shape is drawn), and an arrow or an arc per reaction component in the reaction colour. All of it
 * is faded while the drawing is stale. Nothing here is picked by the pointer, and no React state changes per
 * frame; the labels of `ResultLabels` are moved as the labels of the loads are. It also holds the place of the
 * readout of a node's displacement (../analysis/NodeReadout.tsx).
 */
export function Results({
  drawing,
  colors,
  links,
}: {
  drawing: ResultDrawing | null;
  colors: ResultColors;
  links: LabelLinks;
}) {
  const geometries = useMemo(makeGeometries, []);
  useEffect(() => () => disposeGeometries(geometries), [geometries]);
  usePlacedLabels(links);
  // After the labels were placed: the readout's card is turned towards the middle of the viewport.
  useFrame(() => {
    const element = links.elements.get(READOUT_KEY);
    if (element) {
      aimReadout(element, links.places.get(READOUT_KEY));
    }
  });
  if (drawing === null) {
    return null;
  }
  const opacity = drawing.stale ? STALE_OPACITY : 1;
  const deflection: Look = { color: colors.deflection, opacity };
  const reaction: Look = { color: colors.reaction, opacity };
  const { deflected, largest, reactions } = drawing;
  return (
    <>
      <ReadoutAnchor links={links} model={drawing.model} />
      {deflected !== null && deflected.positions.length > 0 ? (
        <Line
          color={colors.deflection}
          lineWidth={DEFLECTED_PX}
          opacity={opacity}
          points={deflected.positions}
          raycast={noRaycast}
          renderOrder={1}
          segments
          transparent={opacity < 1}
        />
      ) : null}
      {deflected !== null && largest !== null ? (
        <LargestMark links={links} look={deflection} point={largest.labelPoint} />
      ) : null}
      {reactions.map((glyph) =>
        glyph.kind === "force" ? (
          <ReactionForce
            geometry={geometries.force}
            glyph={glyph}
            key={glyph.key}
            links={links}
            look={reaction}
          />
        ) : (
          <ReactionMoment
            geometries={geometries}
            glyph={glyph}
            key={glyph.key}
            links={links}
            look={reaction}
          />
        ),
      )}
    </>
  );
}

function Label({
  labelKey,
  links,
  className,
  testId,
  text,
}: {
  labelKey: string;
  links: LabelLinks;
  className: string | undefined;
  testId: string;
  text: string;
}) {
  return (
    <span
      className={styles.loadLabel}
      data-result={labelKey}
      data-testid={testId}
      ref={(element) => {
        if (element) {
          links.elements.set(labelKey, element);
          // The canvas may have drawn this frame before the element was there.
          putLabel(element, links.places.get(labelKey));
        } else {
          links.elements.delete(labelKey);
        }
      }}
    >
      <span className={className}>{text}</span>
    </span>
  );
}

/**
 * The values of the results as HTML over the canvas, text of a fixed size at every zoom that the pointer does
 * not pick: the magnitude of each reaction component drawn, with its unit, and the largest displacement in mm
 * (only while the deflected shape is drawn). Rendered beside the canvas; `Results` moves each label to its
 * place on every drawn frame.
 */
export function ResultLabels({
  drawing,
  links,
}: {
  drawing: ResultDrawing | null;
  links: LabelLinks;
}) {
  if (drawing === null) {
    return null;
  }
  const { deflected, largest, reactions } = drawing;
  return (
    <div
      className={
        drawing.stale ? `${styles.loadLabels} ${styles.resultLabelsStale}` : styles.loadLabels
      }
      data-testid="result-labels"
    >
      {reactions.map((glyph) => (
        <Label
          className={styles.reactionLabelText}
          key={glyph.key}
          labelKey={glyph.key}
          links={links}
          testId="reaction-label"
          text={t(UNIT_MESSAGE[glyph.label.unit], { value: glyph.label.value })}
        />
      ))}
      {deflected !== null && largest !== null ? (
        <Label
          className={styles.deflectionLabelText}
          labelKey={LARGEST_LABEL_KEY}
          links={links}
          testId="largest-label"
          text={t("workspace.display.largestLabel", {
            value: t("workspace.results.valueMm", { value: formatMm(largest.found.value) }),
          })}
        />
      ) : null}
    </div>
  );
}
