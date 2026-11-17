"use client";

import type { MessageId } from "@bridle/i18n";
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  type BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  type Group,
  type Object3D,
  Quaternion,
  TorusGeometry,
  Vector3,
} from "three";
import { t } from "../../i18n";
import type { DrawnForce, DrawnLoad, DrawnMoment, DrawnUniformLoad, LoadLabel } from "./loads";
import { metresPerPixel, noRaycast } from "./ModelScene";
import type { Point3 } from "./scene";
import styles from "./Viewport.module.css";

// Sizes on screen, in CSS pixels, kept at every zoom: the groups are rescaled on every drawn frame, as the
// node markers and the support glyphs are. A force arrow is `FORCE_PX` long from tail to head; the arrows of
// a uniform load are shorter, so that a row of them reads as one load; a moment's arc has the diameter
// `MOMENT_PX`.
export const FORCE_PX = 56;
export const UNIFORM_PX = 34;
export const MOMENT_PX = 46;
// How far beyond the tail of an arrow the centre of its label is, in the arrow's own length.
const FORCE_LABEL_AT = 1.5;
const UNIFORM_LABEL_AT = 1.6;
const UNIFORM_RAIL_PX = 1.5;
// Where the label of a moment is, in the arc's own diameter, along X and against Y of the glyph.
const MOMENT_LABEL_AT = 0.85;

const LABEL_MESSAGE: Record<LoadLabel["unit"], MessageId> = {
  kN: "workspace.loads.valueKN",
  kNm: "workspace.loads.valueKNm",
  kNPerM: "workspace.loads.valueKNPerM",
};

const UNIT_Z = new Vector3(0, 0, 1);

function mutable(point: Point3): [number, number, number] {
  return [point[0], point[1], point[2]];
}

/** The rotation that turns the Z axis of a glyph onto a unit vector of the scene. */
function towards(direction: Point3): Quaternion {
  return new Quaternion().setFromUnitVectors(
    UNIT_Z,
    new Vector3(direction[0], direction[1], direction[2]),
  );
}

interface ArrowGeometry {
  shaft: BufferGeometry;
  head: BufferGeometry;
}

interface LoadGeometries {
  force: ArrowGeometry;
  uniform: ArrowGeometry;
  arc: BufferGeometry;
  arcHead: BufferGeometry;
}

/**
 * A straight arrow one unit long: its head's tip at the origin, pointing along +Z, its tail at Z = -1. Drawn
 * with the head at the loaded point, the arrow stands on the side the force comes from.
 */
function arrow(headLength: number, headRadius: number, shaftRadius: number): ArrowGeometry {
  const shaft = new CylinderGeometry(shaftRadius, shaftRadius, 1 - headLength, 8);
  shaft.rotateX(Math.PI / 2);
  shaft.translate(0, 0, -headLength - (1 - headLength) / 2);
  // A cone's apex is at +Y: turned to +Z and moved back by half its height, the apex is the origin.
  const head = new ConeGeometry(headRadius, headLength, 16);
  head.rotateX(Math.PI / 2);
  head.translate(0, 0, -headLength / 2);
  return { shaft, head };
}

const ARC_RADIUS = 0.5;
const ARC_HEAD_LENGTH = 0.32;

function makeGeometries(): LoadGeometries {
  // Three quarters of a circle in the glyph's X-Y plane, from the +X axis counter-clockwise about +Z: the
  // sense of a moment about +Z by the right-hand rule. It ends at (0, -radius), going towards +X.
  const arc = new TorusGeometry(ARC_RADIUS, 0.028, 8, 40, Math.PI * 1.5);
  const arcHead = new ConeGeometry(0.12, ARC_HEAD_LENGTH, 16);
  arcHead.rotateZ(-Math.PI / 2);
  arcHead.translate(ARC_HEAD_LENGTH / 2, -ARC_RADIUS, 0);
  return {
    force: arrow(0.3, 0.1, 0.024),
    uniform: arrow(0.36, 0.13, 0.03),
    arc,
    arcHead,
  };
}

function disposeGeometries(geometries: LoadGeometries) {
  for (const geometry of [
    geometries.force.shaft,
    geometries.force.head,
    geometries.uniform.shaft,
    geometries.uniform.head,
    geometries.arc,
    geometries.arcHead,
  ]) {
    geometry.dispose();
  }
}

/**
 * What joins the labels of the loads, which are HTML elements over the canvas, to their places in the scene:
 * the three.js objects that mark those places and the elements, both by the load's key, and where each label
 * was last put. One per viewport (`createLabelLinks`), shared by `Loads` inside the canvas and `LoadLabels`
 * outside it.
 */
export interface LabelLinks {
  anchors: Map<string, Object3D>;
  elements: Map<string, HTMLElement>;
  /** The last place of each label in CSS pixels from the canvas's top left corner; `null` when not in view. */
  places: Map<string, { x: number; y: number } | null>;
}

export function createLabelLinks(): LabelLinks {
  return { anchors: new Map(), elements: new Map(), places: new Map() };
}

function putLabel(element: HTMLElement, place: { x: number; y: number } | null | undefined) {
  if (place) {
    element.style.visibility = "visible";
    element.style.transform = `translate(${place.x}px, ${place.y}px) translate(-50%, -50%)`;
  } else {
    element.style.visibility = "hidden";
  }
}

/**
 * The values of the loads with their units, as HTML over the canvas: text of a fixed size on screen at every
 * zoom, which the pointer does not pick. Rendered beside the canvas, not in it; `Loads` moves each label to its
 * place on every drawn frame.
 */
export function LoadLabels({ loads, links }: { loads: DrawnLoad[]; links: LabelLinks }) {
  return (
    <div className={styles.loadLabels} data-testid="load-labels">
      {loads.map((load) => (
        <span
          className={
            load.kind === "uniform" && load.alongMember
              ? `${styles.loadLabel} ${styles.loadLabelLifted}`
              : styles.loadLabel
          }
          data-load={load.key}
          data-testid="load-label"
          key={load.key}
          ref={(element) => {
            if (element) {
              links.elements.set(load.key, element);
              // The canvas may have drawn this load's frame before the element was there.
              putLabel(element, links.places.get(load.key));
            } else {
              links.elements.delete(load.key);
            }
          }}
        >
          <span className={styles.loadLabelText}>
            {t(LABEL_MESSAGE[load.label.unit], { value: load.label.value })}
          </span>
        </span>
      ))}
    </div>
  );
}

const scratch = new Vector3();

/** The place in the scene where the label of a load is centred: an empty object the frame loop reads. */
function Anchor({
  load,
  links,
  position,
}: {
  load: DrawnLoad;
  links: LabelLinks;
  position: [number, number, number];
}) {
  return (
    <group
      position={position}
      ref={(group) => {
        if (group) {
          links.anchors.set(load.key, group);
        } else {
          links.anchors.delete(load.key);
          links.places.delete(load.key);
        }
      }}
    />
  );
}

function Arrow({ geometry, color }: { geometry: ArrowGeometry; color: string }) {
  return (
    <>
      <mesh geometry={geometry.shaft} raycast={noRaycast}>
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh geometry={geometry.head} raycast={noRaycast}>
        <meshBasicMaterial color={color} />
      </mesh>
    </>
  );
}

/** One arrow with its head at the loaded point, pointing the way the force acts, and its value at its tail. */
function Force({
  load,
  geometries,
  color,
  links,
}: {
  load: DrawnForce;
  geometries: LoadGeometries;
  color: string;
  links: LabelLinks;
}) {
  const group = useRef<Group>(null);
  const quaternion = useMemo(() => towards(load.direction), [load.direction]);
  // Before `Loads` reads the place of the label in the same frame (priority -1; rendering stays automatic).
  useFrame(({ camera, size }) => {
    camera.updateMatrixWorld();
    group.current?.scale.setScalar(metresPerPixel(camera, size.height, load.point) * FORCE_PX);
  }, -1);
  return (
    <group position={mutable(load.point)} quaternion={quaternion} ref={group}>
      <Arrow color={color} geometry={geometries.force} />
      <Anchor links={links} load={load} position={[0, 0, -FORCE_LABEL_AT]} />
    </group>
  );
}

/**
 * A moment as three quarters of a circle around the node, in the plane the moment turns in, with an arrow head
 * at its end: the sense is the right-hand rule about the moment's axis.
 */
function Moment({
  load,
  geometries,
  color,
  links,
}: {
  load: DrawnMoment;
  geometries: LoadGeometries;
  color: string;
  links: LabelLinks;
}) {
  const group = useRef<Group>(null);
  const quaternion = useMemo(() => towards(load.axis), [load.axis]);
  useFrame(({ camera, size }) => {
    camera.updateMatrixWorld();
    group.current?.scale.setScalar(metresPerPixel(camera, size.height, load.point) * MOMENT_PX);
  }, -1);
  return (
    <group position={mutable(load.point)} quaternion={quaternion} ref={group}>
      <mesh geometry={geometries.arc} raycast={noRaycast}>
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh geometry={geometries.arcHead} raycast={noRaycast}>
        <meshBasicMaterial color={color} />
      </mesh>
      {/* Beyond the open quarter of the arc, past the arrow head. */}
      <Anchor links={links} load={load} position={[MOMENT_LABEL_AT, -MOMENT_LABEL_AT, 0]} />
    </group>
  );
}

/**
 * A uniform load: a row of arrows with their heads on the member and a line through their tails, with the
 * value beyond the middle of that line. A load along the member itself is a row of arrows lying on the member,
 * without the line, and its value is shown above the member's middle.
 */
function Uniform({
  load,
  geometries,
  color,
  links,
}: {
  load: DrawnUniformLoad;
  geometries: LoadGeometries;
  color: string;
  links: LabelLinks;
}) {
  const arrows = useRef<(Group | null)[]>([]);
  const rail = useRef<Group>(null);
  const label = useRef<Group>(null);
  const quaternion = useMemo(() => towards(load.direction), [load.direction]);
  const middle = useMemo<Point3>(
    () => [
      (load.start[0] + load.end[0]) / 2,
      (load.start[1] + load.end[1]) / 2,
      (load.start[2] + load.end[2]) / 2,
    ],
    [load.start, load.end],
  );
  useFrame(({ camera, size }) => {
    camera.updateMatrixWorld();
    // One length for the whole row, measured at the member's middle, so the tails are on one straight line.
    const length = metresPerPixel(camera, size.height, middle) * UNIFORM_PX;
    for (const group of arrows.current) {
      group?.scale.setScalar(length);
    }
    const [dx, dy, dz] = load.direction;
    rail.current?.position.set(-dx * length, -dy * length, -dz * length);
    const out = load.alongMember ? 0 : length * UNIFORM_LABEL_AT;
    label.current?.position.set(middle[0] - dx * out, middle[1] - dy * out, middle[2] - dz * out);
  }, -1);
  return (
    <>
      {load.arrows.map((point, index) => (
        <group
          key={`${point[0]} ${point[1]} ${point[2]}`}
          position={mutable(point)}
          quaternion={quaternion}
          ref={(group) => {
            arrows.current[index] = group;
          }}
        >
          <Arrow color={color} geometry={geometries.uniform} />
        </group>
      ))}
      {load.alongMember ? null : (
        <group ref={rail}>
          <Line
            color={color}
            lineWidth={UNIFORM_RAIL_PX}
            points={[mutable(load.start), mutable(load.end)]}
            raycast={noRaycast}
          />
        </group>
      )}
      <group ref={label}>
        <Anchor links={links} load={load} position={[0, 0, 0]} />
      </group>
    </>
  );
}

/**
 * The loads of one scene description (card PX-02.5), in the load colour: an arrow per force, an arc per
 * moment, a row of arrows per uniform load. Nothing here is picked by the pointer, and no React state changes
 * per frame: the sizes are set on the three.js objects, and the labels of `LoadLabels` are moved by their
 * `style` to where their anchors are on screen (hidden while an anchor is behind the camera).
 */
export function Loads({
  loads,
  color,
  links,
}: {
  loads: DrawnLoad[];
  color: string;
  links: LabelLinks;
}) {
  const geometries = useMemo(makeGeometries, []);
  useEffect(() => () => disposeGeometries(geometries), [geometries]);
  useFrame(({ camera, size }) => {
    for (const [key, anchor] of links.anchors) {
      anchor.updateWorldMatrix(true, false);
      scratch.setFromMatrixPosition(anchor.matrixWorld).project(camera);
      const place =
        scratch.z > -1 && scratch.z < 1
          ? { x: ((scratch.x + 1) / 2) * size.width, y: ((1 - scratch.y) / 2) * size.height }
          : null;
      links.places.set(key, place);
      const element = links.elements.get(key);
      if (element) {
        putLabel(element, place);
      }
    }
  });
  return (
    <>
      {loads.map((load) =>
        load.kind === "force" ? (
          <Force color={color} geometries={geometries} key={load.key} links={links} load={load} />
        ) : load.kind === "moment" ? (
          <Moment color={color} geometries={geometries} key={load.key} links={links} load={load} />
        ) : (
          <Uniform color={color} geometries={geometries} key={load.key} links={links} load={load} />
        ),
      )}
    </>
  );
}
