"use client";

import { Line } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  BoxGeometry,
  BufferGeometry,
  type Camera,
  ConeGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Float32BufferAttribute,
  type Group,
  type InstancedMesh,
  Matrix4,
  type Mesh,
  OctahedronGeometry,
  type OrthographicCamera,
  type PerspectiveCamera,
  Vector3,
} from "three";
import {
  type DrawnMember,
  type DrawnNode,
  type DrawnSupport,
  type GridSpec,
  gridLines,
  type Point3,
  type SceneDescription,
  type SupportGlyph,
} from "./scene";
import { useViewportStore } from "./viewportStore";

/** The colours of the canvas, read from the `--canvas-*` custom properties (ViewportCanvas.tsx). */
export interface CanvasColors {
  gridMajor: string;
  gridMinor: string;
  member: string;
  node: string;
  /** The outline of a support glyph, and the wire of a generic one. */
  support: string;
  /** The faces of a support glyph. */
  supportFill: string;
  selection: string;
  hover: string;
}

// Sizes on screen, in CSS pixels. Members are drawn as lines of a fixed width; node markers and support glyphs
// are rescaled on every drawn frame so that they keep these sizes at any zoom.
const MEMBER_PX = 2.5;
const MEMBER_HIGHLIGHT_PX = 5;
const NODE_PX = 10;
const NODE_HIGHLIGHT_PX = 15;
const GLYPH_PX = 34;
// A click is a press and a release at most this many pixels apart; a longer one was a drag of the camera.
const CLICK_SLOP_PX = 2;

const scratchPoint = new Vector3();
const scratchMatrix = new Matrix4();

function noRaycast(): null {
  return null;
}

function mutable(point: Point3): [number, number, number] {
  return [point[0], point[1], point[2]];
}

/** The length in the scene, in m, that one CSS pixel covers at `point` (the camera's matrices must be current). */
function metresPerPixel(camera: Camera, viewportHeight: number, point: Point3): number {
  const perspective = camera as PerspectiveCamera;
  if (perspective.isPerspectiveCamera) {
    scratchPoint.set(point[0], point[1], point[2]).applyMatrix4(camera.matrixWorldInverse);
    const depth = Math.max(-scratchPoint.z, 1e-6);
    return (
      (2 * depth * Math.tan((perspective.fov * Math.PI) / 360)) /
      (viewportHeight * perspective.zoom)
    );
  }
  const orthographic = camera as OrthographicCamera;
  return (orthographic.top - orthographic.bottom) / (viewportHeight * orthographic.zoom);
}

function clearHover(kind: "node" | "member") {
  const { hover, setHover } = useViewportStore.getState();
  if (hover?.kind === kind) {
    setHover(null);
  }
}

/** The ground grid on the plane Z = 0. It writes no depth, so a member lying on the ground is drawn over it. */
function Grid({ grid, colors }: { grid: GridSpec; colors: CanvasColors }) {
  const geometries = useMemo(() => {
    const lines = gridLines(grid);
    const make = (positions: number[]) => {
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
      return geometry;
    };
    return { minor: make(lines.minor), major: make(lines.major) };
  }, [grid]);
  useEffect(
    () => () => {
      geometries.minor.dispose();
      geometries.major.dispose();
    },
    [geometries],
  );
  return (
    <>
      <lineSegments geometry={geometries.minor} raycast={noRaycast} renderOrder={-2}>
        <lineBasicMaterial color={colors.gridMinor} depthWrite={false} />
      </lineSegments>
      <lineSegments geometry={geometries.major} raycast={noRaycast} renderOrder={-1}>
        <lineBasicMaterial color={colors.gridMajor} depthWrite={false} />
      </lineSegments>
    </>
  );
}

function MemberHighlight({ member, color }: { member: DrawnMember; color: string }) {
  return (
    <Line
      color={color}
      depthTest={false}
      lineWidth={MEMBER_HIGHLIGHT_PX}
      points={[mutable(member.start), mutable(member.end)]}
      raycast={noRaycast}
      renderOrder={1}
    />
  );
}

/** Every member in one set of line segments (one draw call); the hovered and the selected one are drawn over it. */
function Members({ members, colors }: { members: DrawnMember[]; colors: CanvasColors }) {
  const hover = useViewportStore((state) => state.hover);
  const selection = useViewportStore((state) => state.selection);
  const points = useMemo(
    () => members.flatMap((member) => [mutable(member.start), mutable(member.end)]),
    [members],
  );
  if (members.length === 0) {
    return null;
  }
  // The index of the segment under the pointer is the index of its member.
  const memberAt = (event: ThreeEvent<MouseEvent>) =>
    typeof event.faceIndex === "number" ? members[event.faceIndex] : undefined;
  const find = (id: string | undefined) => members.find((member) => member.id === id);
  const selected = selection?.kind === "member" ? find(selection.id) : undefined;
  const hovered =
    hover?.kind === "member" && hover.id !== selected?.id ? find(hover.id) : undefined;
  return (
    <>
      <Line
        color={colors.member}
        lineWidth={MEMBER_PX}
        onClick={(event) => {
          const member = memberAt(event);
          if (member === undefined || event.delta > CLICK_SLOP_PX) {
            return;
          }
          event.stopPropagation();
          useViewportStore.getState().select({ kind: "member", id: member.id });
        }}
        onPointerMove={(event) => {
          const member = memberAt(event);
          if (member === undefined) {
            return;
          }
          event.stopPropagation();
          useViewportStore.getState().setHover({ kind: "member", id: member.id });
        }}
        onPointerOut={() => clearHover("member")}
        points={points}
        segments
      />
      {hovered ? <MemberHighlight color={colors.hover} member={hovered} /> : null}
      {selected ? <MemberHighlight color={colors.selection} member={selected} /> : null}
    </>
  );
}

/** A flat disc over one node, in the hover or the selection colour, drawn over everything else. */
function NodeHighlight({ node, color }: { node: DrawnNode; color: string }) {
  const mesh = useRef<Mesh>(null);
  useFrame(({ camera, size }) => {
    camera.updateMatrixWorld();
    mesh.current?.scale.setScalar(
      metresPerPixel(camera, size.height, node.position) * NODE_HIGHLIGHT_PX,
    );
  });
  return (
    <mesh position={mutable(node.position)} raycast={noRaycast} ref={mesh} renderOrder={3}>
      <sphereGeometry args={[0.5, 24, 16]} />
      <meshBasicMaterial color={color} depthTest={false} />
    </mesh>
  );
}

/** Every node as one instanced mesh (one draw call): an unlit sphere, so it reads as a round marker. */
function Nodes({ nodes, colors }: { nodes: DrawnNode[]; colors: CanvasColors }) {
  const mesh = useRef<InstancedMesh>(null);
  const hover = useViewportStore((state) => state.hover);
  const selection = useViewportStore((state) => state.selection);
  useFrame(({ camera, size }) => {
    const instances = mesh.current;
    if (!instances) {
      return;
    }
    camera.updateMatrixWorld();
    nodes.forEach((node, index) => {
      const scale = metresPerPixel(camera, size.height, node.position) * NODE_PX;
      scratchMatrix.makeScale(scale, scale, scale);
      scratchMatrix.setPosition(node.position[0], node.position[1], node.position[2]);
      instances.setMatrixAt(index, scratchMatrix);
    });
    instances.instanceMatrix.needsUpdate = true;
    // The pointer's ray is tested against this sphere first, and the markers have just changed size.
    instances.computeBoundingSphere();
  });
  if (nodes.length === 0) {
    return null;
  }
  const nodeAt = (event: ThreeEvent<MouseEvent>) =>
    typeof event.instanceId === "number" ? nodes[event.instanceId] : undefined;
  const find = (id: string | undefined) => nodes.find((node) => node.id === id);
  const selected = selection?.kind === "node" ? find(selection.id) : undefined;
  const hovered = hover?.kind === "node" && hover.id !== selected?.id ? find(hover.id) : undefined;
  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: a three.js object in the canvas, not an HTML element */}
      <instancedMesh
        args={[undefined, undefined, nodes.length]}
        frustumCulled={false}
        onClick={(event) => {
          const node = nodeAt(event);
          if (node === undefined || event.delta > CLICK_SLOP_PX) {
            return;
          }
          event.stopPropagation();
          useViewportStore.getState().select({ kind: "node", id: node.id });
        }}
        onPointerMove={(event) => {
          const node = nodeAt(event);
          if (node === undefined) {
            return;
          }
          event.stopPropagation();
          useViewportStore.getState().setHover({ kind: "node", id: node.id });
        }}
        onPointerOut={() => clearHover("node")}
        ref={mesh}
        renderOrder={2}
      >
        <sphereGeometry args={[0.5, 20, 14]} />
        <meshBasicMaterial color={colors.node} />
      </instancedMesh>
      {hovered ? <NodeHighlight color={colors.hover} node={hovered} /> : null}
      {selected ? <NodeHighlight color={colors.selection} node={selected} /> : null}
    </>
  );
}

// The support glyphs are modelled in a unit that is drawn `GLYPH_PX` pixels long, with the node at the origin and
// the glyph below it (towards minus Z). Each part is drawn twice: its faces, filled, and its edges, as lines.
type GlyphPart = "pinnedPyramid" | "rollerPyramid" | "plate" | "block" | "roller";

interface GlyphGeometries {
  faces: Record<GlyphPart, BufferGeometry>;
  edges: Record<GlyphPart, BufferGeometry>;
  generic: BufferGeometry;
}

const PINNED_HEIGHT = 0.78;
const ROLLER_HEIGHT = 0.58;
const ROLLER_RADIUS = 0.12;
const PLATE_THICKNESS = 0.08;
const BLOCK_HEIGHT = 0.4;
// An edge is drawn where two faces meet at more than this angle, in degrees: the rim of a roller, not its side.
const EDGE_ANGLE_DEG = 30;

/** A square pyramid with its apex at the origin, its axis along minus Z and its sides facing X and Y. */
function pyramid(height: number, halfBase: number): ConeGeometry {
  const geometry = new ConeGeometry(halfBase * Math.SQRT2, height, 4);
  geometry.rotateY(Math.PI / 4);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, 0, -height / 2);
  return geometry;
}

function makeGlyphGeometries(): GlyphGeometries {
  const faces: Record<GlyphPart, BufferGeometry> = {
    pinnedPyramid: pyramid(PINNED_HEIGHT, 0.45),
    rollerPyramid: pyramid(ROLLER_HEIGHT, 0.45),
    plate: new BoxGeometry(1.3, 1.3, PLATE_THICKNESS),
    block: new BoxGeometry(1.25, 1.25, BLOCK_HEIGHT),
    // A cylinder's axis is Y: the two rollers lie across the X axis.
    roller: new CylinderGeometry(ROLLER_RADIUS, ROLLER_RADIUS, 0.9, 20),
  };
  const edgesOf = (geometry: BufferGeometry) => new EdgesGeometry(geometry, EDGE_ANGLE_DEG);
  const octahedron = new OctahedronGeometry(0.55);
  const generic = edgesOf(octahedron);
  octahedron.dispose();
  return {
    faces,
    edges: {
      pinnedPyramid: edgesOf(faces.pinnedPyramid),
      rollerPyramid: edgesOf(faces.rollerPyramid),
      plate: edgesOf(faces.plate),
      block: edgesOf(faces.block),
      roller: edgesOf(faces.roller),
    },
    generic,
  };
}

function disposeGlyphGeometries(geometries: GlyphGeometries) {
  for (const geometry of [...Object.values(geometries.faces), ...Object.values(geometries.edges)]) {
    geometry.dispose();
  }
  geometries.generic.dispose();
}

interface GlyphStyle {
  geometries: GlyphGeometries;
  colors: CanvasColors;
}

/** One part of a glyph, `z` below the node (and `x` beside it): filled faces under outlined edges. */
function Part({
  part,
  style,
  x = 0,
  z = 0,
}: {
  part: GlyphPart;
  style: GlyphStyle;
  x?: number;
  z?: number;
}) {
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={style.geometries.faces[part]} raycast={noRaycast}>
        {/* The offset pushes the faces back, so the edges on them are not hidden by them. */}
        <meshLambertMaterial
          color={style.colors.supportFill}
          flatShading
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      <lineSegments geometry={style.geometries.edges[part]} raycast={noRaycast}>
        <lineBasicMaterial color={style.colors.support} />
      </lineSegments>
    </group>
  );
}

/**
 * The symbol of one support: a block for `fixed`, a pyramid on a plate for `pinned` (a triangle on a line, seen
 * from the front), a pyramid on two rollers on a plate for `roller`, the edges of an octahedron around the node
 * for `generic`. The symbol always points down; it does not show which direction a roller leaves free.
 */
function Glyph({ kind, style }: { kind: SupportGlyph; style: GlyphStyle }) {
  if (kind === "fixed") {
    return <Part part="block" style={style} z={-BLOCK_HEIGHT / 2} />;
  }
  if (kind === "pinned") {
    return (
      <>
        <Part part="pinnedPyramid" style={style} />
        <Part part="plate" style={style} z={-PINNED_HEIGHT - PLATE_THICKNESS / 2} />
      </>
    );
  }
  if (kind === "roller") {
    return (
      <>
        <Part part="rollerPyramid" style={style} />
        <Part part="roller" style={style} x={-0.27} z={-ROLLER_HEIGHT - ROLLER_RADIUS} />
        <Part part="roller" style={style} x={0.27} z={-ROLLER_HEIGHT - ROLLER_RADIUS} />
        <Part
          part="plate"
          style={style}
          z={-ROLLER_HEIGHT - 2 * ROLLER_RADIUS - PLATE_THICKNESS / 2}
        />
      </>
    );
  }
  return (
    <lineSegments geometry={style.geometries.generic} raycast={noRaycast}>
      <lineBasicMaterial color={style.colors.support} />
    </lineSegments>
  );
}

/** One glyph per support, kept at `GLYPH_PX` on screen. The pointer does not pick a glyph. */
function Supports({ supports, colors }: { supports: DrawnSupport[]; colors: CanvasColors }) {
  const groups = useRef<(Group | null)[]>([]);
  const geometries = useMemo(makeGlyphGeometries, []);
  useEffect(() => () => disposeGlyphGeometries(geometries), [geometries]);
  useFrame(({ camera, size }) => {
    camera.updateMatrixWorld();
    supports.forEach((support, index) => {
      groups.current[index]?.scale.setScalar(
        metresPerPixel(camera, size.height, support.position) * GLYPH_PX,
      );
    });
  });
  return (
    <>
      {supports.map((support, index) => (
        <group
          key={support.nodeId}
          position={mutable(support.position)}
          ref={(group) => {
            groups.current[index] = group;
          }}
        >
          <Glyph kind={support.glyph} style={{ geometries, colors }} />
        </group>
      ))}
    </>
  );
}

/** The grid, the members, the nodes and the supports of one scene description. Rendered inside the canvas. */
export function ModelScene({ scene, colors }: { scene: SceneDescription; colors: CanvasColors }) {
  return (
    <>
      <Grid colors={colors} grid={scene.grid} />
      <Supports colors={colors} supports={scene.supports} />
      <Members colors={colors} members={scene.members} />
      <Nodes colors={colors} nodes={scene.nodes} />
    </>
  );
}
