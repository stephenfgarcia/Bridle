/**
 * The commands that edit a model (card PX-02.3): pure functions of `(model, arguments)` that return a model.
 * This file imports neither React nor zustand; ./modelStore.ts wires the commands to the undo history.
 *
 * Rules every command follows:
 * - It never changes the model it is given. A command that changes something returns a new `Model` object in
 *   which only the lists that changed are new arrays, and only the changed entries new objects: the other
 *   lists and entries are the same objects as before.
 * - A command that changes nothing returns the model object it was given. That is also how a command refuses
 *   arguments it cannot apply (a missing id, a member from a node to itself, a number that is not finite):
 *   it does not throw. The refusals of each command are listed on it.
 * - A new node, member or load, section, material or load case gets the next free id of its list
 *   (`nextNodeId` and the functions beside it).
 *
 * Where a model already holds one id twice in a list (a model that `validateModel` reports), an update
 * changes the first entry with that id and a delete removes every entry with it.
 */
import {
  distance,
  type LoadAxes,
  type LoadCase,
  type LoadDirection,
  type Material,
  type Member,
  type MemberEndRelease,
  type MemberKind,
  type MemberPointLoad,
  type MemberUniformLoad,
  type Model,
  type NodalLoad,
  type Node,
  POSITION_TOLERANCE,
  type Section,
  type Support,
  ZERO_LENGTH_TOLERANCE,
} from "@bridle/model";

// ---------------------------------------------------------------------------------------------------------
// Ids
// ---------------------------------------------------------------------------------------------------------

/** The prefix of the ids the commands give, by list. A support has no id: its node identifies it. */
export const ID_PREFIX = {
  nodes: "n",
  members: "m",
  sections: "s",
  materials: "mat",
  loadCases: "lc",
  nodalLoads: "nl",
  memberUniformLoads: "ul",
  memberPointLoads: "pl",
} as const;

/**
 * The next free id with a prefix: the prefix and one more than the largest number that follows it among
 * the ids of the list (`n5` when the list holds `n4`; `n1` when no id is the prefix and digits). The result
 * is never an id of the list.
 */
export function nextId(list: readonly { id: string }[], prefix: string): string {
  const used = new Set<string>();
  let largest = 0;
  for (const { id } of list) {
    used.add(id);
    if (id.startsWith(prefix)) {
      const digits = id.slice(prefix.length);
      // Up to 15 digits: such a number is exact as a JavaScript number.
      if (/^\d{1,15}$/.test(digits)) {
        largest = Math.max(largest, Number(digits));
      }
    }
  }
  let number = largest + 1;
  while (used.has(`${prefix}${number}`)) {
    number += 1;
  }
  return `${prefix}${number}`;
}

/** The id `addNode` would give now. */
export const nextNodeId = (model: Model): string => nextId(model.nodes, ID_PREFIX.nodes);
/** The id `addMember` would give now. */
export const nextMemberId = (model: Model): string => nextId(model.members, ID_PREFIX.members);
/** The id `addSection` would give now. */
export const nextSectionId = (model: Model): string => nextId(model.sections, ID_PREFIX.sections);
/** The id `addMaterial` would give now. */
export const nextMaterialId = (model: Model): string =>
  nextId(model.materials, ID_PREFIX.materials);
/** The id `addLoadCase` would give now. */
export const nextLoadCaseId = (model: Model): string =>
  nextId(model.loadCases, ID_PREFIX.loadCases);
/** The id `addNodalLoad` would give now. */
export const nextNodalLoadId = (model: Model): string =>
  nextId(model.nodalLoads, ID_PREFIX.nodalLoads);
/** The id `addMemberUniformLoad` would give now. */
export const nextMemberUniformLoadId = (model: Model): string =>
  nextId(model.memberUniformLoads, ID_PREFIX.memberUniformLoads);
/** The id `addMemberPointLoad` would give now. */
export const nextMemberPointLoadId = (model: Model): string =>
  nextId(model.memberPointLoads, ID_PREFIX.memberPointLoads);

// ---------------------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------------------

function allFinite(...values: number[]): boolean {
  return values.every((value) => Number.isFinite(value));
}

function allPositive(...values: number[]): boolean {
  return values.every((value) => Number.isFinite(value) && value > 0);
}

function hasId(list: readonly { id: string }[], id: string): boolean {
  return list.some((item) => item.id === id);
}

/** The list without the entries `remove` names; the same array when it names none. */
function without<T>(list: T[], remove: (item: T) => boolean): T[] {
  const kept = list.filter((item) => !remove(item));
  return kept.length === list.length ? list : kept;
}

/**
 * The item with the defined values of `patch`; the same object when none of them differs. A key whose value
 * is `undefined` is left as it is.
 */
function patched<T extends object>(item: T, patch: Partial<T>): T {
  let next: T | undefined;
  for (const key of Object.keys(patch) as (keyof T)[]) {
    const value = patch[key];
    if (value !== undefined && value !== item[key]) {
      next ??= { ...item };
      next[key] = value as T[keyof T];
    }
  }
  return next ?? item;
}

/** The list with `change` applied to its first entry with the id; the same array when nothing changed. */
function updated<T extends { id: string }>(list: T[], id: string, change: (item: T) => T): T[] {
  const index = list.findIndex((item) => item.id === id);
  const item = list[index];
  if (item === undefined) {
    return list;
  }
  const next = change(item);
  if (next === item) {
    return list;
  }
  const copy = list.slice();
  copy[index] = next;
  return copy;
}

function isKind(value: unknown): value is MemberKind {
  return value === "frame" || value === "truss";
}

function isAxes(value: unknown): value is LoadAxes {
  return value === "global" || value === "local";
}

function isDirection(value: unknown): value is LoadDirection {
  return value === "x" || value === "y" || value === "z";
}

/** The length of the first member with the id, in m; `undefined` when it or one of its nodes is missing. */
function memberLength(model: Model, memberId: string): number | undefined {
  const member = model.members.find((candidate) => candidate.id === memberId);
  const start = member && model.nodes.find((node) => node.id === member.startNodeId);
  const end = member && model.nodes.find((node) => node.id === member.endNodeId);
  return start && end ? distance(start, end) : undefined;
}

/** Whether a point load may stand at `position` on the member: within its length, when that is known. */
function positionFits(model: Model, memberId: string, position: number): boolean {
  const length = memberLength(model, memberId);
  return (
    length === undefined ||
    (position >= -POSITION_TOLERANCE && position <= length + POSITION_TOLERANCE)
  );
}

// ---------------------------------------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------------------------------------

export interface AddNodeArgs {
  x: number;
  y: number;
  z: number;
}

/**
 * Adds a node at global coordinates in m, with the id `nextNodeId(model)`.
 * Refuses: a coordinate that is not finite. A node at the place of another node is not refused.
 */
export function addNode(model: Model, { x, y, z }: AddNodeArgs): Model {
  if (!allFinite(x, y, z)) {
    return model;
  }
  const node: Node = { id: nextNodeId(model), x, y, z };
  return { ...model, nodes: [...model.nodes, node] };
}

export interface MoveNodeArgs {
  id: string;
  x: number;
  y: number;
  z: number;
}

/**
 * Moves a node to global coordinates in m.
 * Refuses: an id that is not a node; a coordinate that is not finite. The place the node already has changes
 * nothing. A move that gives a member zero length, or leaves a point load beyond its member, is not refused:
 * `validateModel` reports it.
 */
export function moveNode(model: Model, { id, x, y, z }: MoveNodeArgs): Model {
  if (!allFinite(x, y, z)) {
    return model;
  }
  const nodes = updated(model.nodes, id, (node) => patched(node, { x, y, z }));
  return nodes === model.nodes ? model : { ...model, nodes };
}

export interface DeleteNodeArgs {
  id: string;
}

/**
 * Deletes a node and what stands on it: the members that start or end at it (with their uniform and point
 * loads), its support and its nodal loads.
 * Refuses: an id that is not a node.
 */
export function deleteNode(model: Model, { id }: DeleteNodeArgs): Model {
  if (!hasId(model.nodes, id)) {
    return model;
  }
  const gone = new Set(
    model.members
      .filter((member) => member.startNodeId === id || member.endNodeId === id)
      .map((member) => member.id),
  );
  return {
    ...model,
    nodes: without(model.nodes, (node) => node.id === id),
    members: without(model.members, (member) => gone.has(member.id)),
    supports: without(model.supports, (support) => support.nodeId === id),
    nodalLoads: without(model.nodalLoads, (load) => load.nodeId === id),
    memberUniformLoads: without(model.memberUniformLoads, (load) => gone.has(load.memberId)),
    memberPointLoads: without(model.memberPointLoads, (load) => gone.has(load.memberId)),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------------------------------------

/** The releases of a member, in part: an end or a flag that is left out keeps its value. */
export interface MemberReleasesPatch {
  start?: Partial<MemberEndRelease>;
  end?: Partial<MemberEndRelease>;
}

export interface AddMemberArgs {
  startNodeId: string;
  endNodeId: string;
  /** Default: the first section of the model. */
  sectionId?: string;
  /** Default: the first material of the model. */
  materialId?: string;
  /** Default: `frame`. */
  kind?: MemberKind;
  /** Degrees. Default: 0. */
  rollAngleDeg?: number;
  /** Default: nothing released. */
  releases?: MemberReleasesPatch;
}

const NO_RELEASE: MemberEndRelease = { rx: false, ry: false, rz: false };

/**
 * Adds a member between two nodes, with the id `nextMemberId(model)`.
 * Refuses: the same node at both ends; an end that is not a node; two nodes closer than
 * `ZERO_LENGTH_TOLERANCE`; a member that already joins the two nodes, in either direction; a section or a
 * material that is not in the model, or left out while the model has none; a kind other than `frame` and
 * `truss`; a roll angle that is not finite.
 */
export function addMember(model: Model, args: AddMemberArgs): Model {
  const { startNodeId, endNodeId, kind = "frame", rollAngleDeg = 0, releases = {} } = args;
  const sectionId = args.sectionId ?? model.sections[0]?.id;
  const materialId = args.materialId ?? model.materials[0]?.id;
  const start = model.nodes.find((node) => node.id === startNodeId);
  const end = model.nodes.find((node) => node.id === endNodeId);
  if (
    startNodeId === endNodeId ||
    start === undefined ||
    end === undefined ||
    distance(start, end) < ZERO_LENGTH_TOLERANCE ||
    sectionId === undefined ||
    materialId === undefined ||
    !hasId(model.sections, sectionId) ||
    !hasId(model.materials, materialId) ||
    !isKind(kind) ||
    !allFinite(rollAngleDeg)
  ) {
    return model;
  }
  const joined = model.members.some(
    (member) =>
      (member.startNodeId === startNodeId && member.endNodeId === endNodeId) ||
      (member.startNodeId === endNodeId && member.endNodeId === startNodeId),
  );
  if (joined) {
    return model;
  }
  const member: Member = {
    id: nextMemberId(model),
    startNodeId,
    endNodeId,
    sectionId,
    materialId,
    kind,
    rollAngleDeg,
    releases: {
      start: { ...NO_RELEASE, ...patched(NO_RELEASE, releases.start ?? {}) },
      end: { ...NO_RELEASE, ...patched(NO_RELEASE, releases.end ?? {}) },
    },
  };
  return { ...model, members: [...model.members, member] };
}

export interface DeleteMemberArgs {
  id: string;
}

/**
 * Deletes a member and its uniform and point loads. Its nodes stay.
 * Refuses: an id that is not a member.
 */
export function deleteMember(model: Model, { id }: DeleteMemberArgs): Model {
  if (!hasId(model.members, id)) {
    return model;
  }
  return {
    ...model,
    members: without(model.members, (member) => member.id === id),
    memberUniformLoads: without(model.memberUniformLoads, (load) => load.memberId === id),
    memberPointLoads: without(model.memberPointLoads, (load) => load.memberId === id),
  };
}

export interface UpdateMemberArgs {
  id: string;
  sectionId?: string;
  materialId?: string;
  kind?: MemberKind;
  /** Degrees. */
  rollAngleDeg?: number;
  releases?: MemberReleasesPatch;
}

/**
 * Changes a member's section, material, kind, roll angle and end releases; what is left out keeps its value.
 * Refuses (the whole update, also its valid parts): an id that is not a member; a section or a material that
 * is not in the model; a kind other than `frame` and `truss`; a roll angle that is not finite.
 */
export function updateMember(model: Model, args: UpdateMemberArgs): Model {
  const { id, sectionId, materialId, kind, rollAngleDeg, releases } = args;
  if (
    (sectionId !== undefined && !hasId(model.sections, sectionId)) ||
    (materialId !== undefined && !hasId(model.materials, materialId)) ||
    (kind !== undefined && !isKind(kind)) ||
    (rollAngleDeg !== undefined && !allFinite(rollAngleDeg))
  ) {
    return model;
  }
  const members = updated(model.members, id, (member) => {
    const start = patched(member.releases.start, releases?.start ?? {});
    const end = patched(member.releases.end, releases?.end ?? {});
    const sameReleases = start === member.releases.start && end === member.releases.end;
    return patched(member, {
      sectionId,
      materialId,
      kind,
      rollAngleDeg,
      releases: sameReleases ? undefined : { start, end },
    });
  });
  return members === model.members ? model : { ...model, members };
}

// ---------------------------------------------------------------------------------------------------------
// Supports
// ---------------------------------------------------------------------------------------------------------

/** The six restraints of a node: `true` is restrained. */
export type SetSupportArgs = Support;

export interface RemoveSupportArgs {
  nodeId: string;
}

/**
 * Removes the support of a node.
 * Refuses: a node id that has no support.
 */
export function removeSupport(model: Model, { nodeId }: RemoveSupportArgs): Model {
  const supports = without(model.supports, (support) => support.nodeId === nodeId);
  return supports === model.supports ? model : { ...model, supports };
}

/**
 * Sets the support of a node to the six restraints given: it adds the support, or replaces the one the node
 * has. Six restraints that are all `false` remove the support, as `removeSupport` does. Afterwards the node
 * has at most one support.
 * Refuses: a node id that is not a node. The restraints the node already has change nothing.
 */
export function setSupport(model: Model, args: SetSupportArgs): Model {
  const { nodeId, ux, uy, uz, rx, ry, rz } = args;
  if (!hasId(model.nodes, nodeId)) {
    return model;
  }
  if (!(ux || uy || uz || rx || ry || rz)) {
    return removeSupport(model, { nodeId });
  }
  const support: Support = { nodeId, ux, uy, uz, rx, ry, rz };
  const index = model.supports.findIndex((candidate) => candidate.nodeId === nodeId);
  const current = model.supports[index];
  if (current === undefined) {
    return { ...model, supports: [...model.supports, support] };
  }
  const onNode = model.supports.filter((candidate) => candidate.nodeId === nodeId).length;
  if (onNode === 1 && patched(current, support) === current) {
    return model;
  }
  // The first support of the node takes the new values; a second one (a model that was not valid) goes.
  const supports = model.supports.filter(
    (candidate, at) => candidate.nodeId !== nodeId || at === index,
  );
  supports[supports.indexOf(current)] = support;
  return { ...model, supports };
}

// ---------------------------------------------------------------------------------------------------------
// Nodal loads
// ---------------------------------------------------------------------------------------------------------

export interface AddNodalLoadArgs {
  nodeId: string;
  /** Default: the first load case of the model. */
  loadCaseId?: string;
  /** Forces in kN along global X, Y, Z and moments in kN·m about them. Default: 0 each. */
  fx?: number;
  fy?: number;
  fz?: number;
  mx?: number;
  my?: number;
  mz?: number;
}

/**
 * Adds a load on a node, with the id `nextNodalLoadId(model)`.
 * Refuses: a node id that is not a node; a load case that is not in the model, or left out while the model
 * has none; a component that is not finite. A load whose six components are 0 is not refused.
 */
export function addNodalLoad(model: Model, args: AddNodalLoadArgs): Model {
  const { nodeId, fx = 0, fy = 0, fz = 0, mx = 0, my = 0, mz = 0 } = args;
  const loadCaseId = args.loadCaseId ?? model.loadCases[0]?.id;
  if (
    !hasId(model.nodes, nodeId) ||
    loadCaseId === undefined ||
    !hasId(model.loadCases, loadCaseId) ||
    !allFinite(fx, fy, fz, mx, my, mz)
  ) {
    return model;
  }
  const load: NodalLoad = {
    id: nextNodalLoadId(model),
    loadCaseId,
    nodeId,
    fx,
    fy,
    fz,
    mx,
    my,
    mz,
  };
  return { ...model, nodalLoads: [...model.nodalLoads, load] };
}

export type UpdateNodalLoadArgs = { id: string } & Partial<Omit<NodalLoad, "id">>;

/**
 * Changes a nodal load; what is left out keeps its value.
 * Refuses (the whole update): an id that is not a nodal load; a node or a load case given that is not in the
 * model; a component given that is not finite.
 */
export function updateNodalLoad(model: Model, { id, ...patch }: UpdateNodalLoadArgs): Model {
  const { nodeId, loadCaseId, fx = 0, fy = 0, fz = 0, mx = 0, my = 0, mz = 0 } = patch;
  if (
    (nodeId !== undefined && !hasId(model.nodes, nodeId)) ||
    (loadCaseId !== undefined && !hasId(model.loadCases, loadCaseId)) ||
    !allFinite(fx, fy, fz, mx, my, mz)
  ) {
    return model;
  }
  const nodalLoads = updated(model.nodalLoads, id, (load) => patched(load, patch));
  return nodalLoads === model.nodalLoads ? model : { ...model, nodalLoads };
}

export interface RemoveLoadArgs {
  id: string;
}

/**
 * Removes a nodal load.
 * Refuses: an id that is not a nodal load.
 */
export function removeNodalLoad(model: Model, { id }: RemoveLoadArgs): Model {
  const nodalLoads = without(model.nodalLoads, (load) => load.id === id);
  return nodalLoads === model.nodalLoads ? model : { ...model, nodalLoads };
}

// ---------------------------------------------------------------------------------------------------------
// Member uniform loads
// ---------------------------------------------------------------------------------------------------------

export interface AddMemberUniformLoadArgs {
  memberId: string;
  /** kN/m, signed along the axis. */
  value: number;
  /** Default: the first load case of the model. */
  loadCaseId?: string;
  /** Default: `global`. */
  axes?: LoadAxes;
  /** Default: `z` (with `global` and a negative value: gravity). */
  direction?: LoadDirection;
}

/**
 * Adds a uniform load over a whole member, with the id `nextMemberUniformLoadId(model)`.
 * Refuses: a member id that is not a member; a load case that is not in the model, or left out while the
 * model has none; axes other than `global` and `local`; a direction other than `x`, `y`, `z`; a value that is
 * not finite.
 */
export function addMemberUniformLoad(model: Model, args: AddMemberUniformLoadArgs): Model {
  const { memberId, value, axes = "global", direction = "z" } = args;
  const loadCaseId = args.loadCaseId ?? model.loadCases[0]?.id;
  if (
    !hasId(model.members, memberId) ||
    loadCaseId === undefined ||
    !hasId(model.loadCases, loadCaseId) ||
    !isAxes(axes) ||
    !isDirection(direction) ||
    !allFinite(value)
  ) {
    return model;
  }
  const load: MemberUniformLoad = {
    id: nextMemberUniformLoadId(model),
    loadCaseId,
    memberId,
    axes,
    direction,
    value,
  };
  return { ...model, memberUniformLoads: [...model.memberUniformLoads, load] };
}

export type UpdateMemberUniformLoadArgs = { id: string } & Partial<Omit<MemberUniformLoad, "id">>;

/**
 * Changes a member uniform load; what is left out keeps its value.
 * Refuses (the whole update): an id that is not a member uniform load; a member or a load case given that is
 * not in the model; axes or a direction given that the format does not have; a value given that is not finite.
 */
export function updateMemberUniformLoad(
  model: Model,
  { id, ...patch }: UpdateMemberUniformLoadArgs,
): Model {
  const { memberId, loadCaseId, axes, direction, value = 0 } = patch;
  if (
    (memberId !== undefined && !hasId(model.members, memberId)) ||
    (loadCaseId !== undefined && !hasId(model.loadCases, loadCaseId)) ||
    (axes !== undefined && !isAxes(axes)) ||
    (direction !== undefined && !isDirection(direction)) ||
    !allFinite(value)
  ) {
    return model;
  }
  const memberUniformLoads = updated(model.memberUniformLoads, id, (load) => patched(load, patch));
  return memberUniformLoads === model.memberUniformLoads ? model : { ...model, memberUniformLoads };
}

/**
 * Removes a member uniform load.
 * Refuses: an id that is not a member uniform load.
 */
export function removeMemberUniformLoad(model: Model, { id }: RemoveLoadArgs): Model {
  const memberUniformLoads = without(model.memberUniformLoads, (load) => load.id === id);
  return memberUniformLoads === model.memberUniformLoads ? model : { ...model, memberUniformLoads };
}

// ---------------------------------------------------------------------------------------------------------
// Member point loads
// ---------------------------------------------------------------------------------------------------------

export interface AddMemberPointLoadArgs {
  memberId: string;
  /** kN, signed along the axis. */
  value: number;
  /** m from the start node along the member. */
  position: number;
  /** Default: the first load case of the model. */
  loadCaseId?: string;
  /** Default: `global`. */
  axes?: LoadAxes;
  /** Default: `z`. */
  direction?: LoadDirection;
}

/**
 * Adds a point load on a member, with the id `nextMemberPointLoadId(model)`.
 * Refuses: a member id that is not a member; a load case that is not in the model, or left out while the
 * model has none; axes other than `global` and `local`; a direction other than `x`, `y`, `z`; a value or a
 * position that is not finite; a position below 0 or beyond the member's length (by more than
 * `POSITION_TOLERANCE`; not checked when a node of the member is missing).
 */
export function addMemberPointLoad(model: Model, args: AddMemberPointLoadArgs): Model {
  const { memberId, value, position, axes = "global", direction = "z" } = args;
  const loadCaseId = args.loadCaseId ?? model.loadCases[0]?.id;
  if (
    !hasId(model.members, memberId) ||
    loadCaseId === undefined ||
    !hasId(model.loadCases, loadCaseId) ||
    !isAxes(axes) ||
    !isDirection(direction) ||
    !allFinite(value, position) ||
    !positionFits(model, memberId, position)
  ) {
    return model;
  }
  const load: MemberPointLoad = {
    id: nextMemberPointLoadId(model),
    loadCaseId,
    memberId,
    axes,
    direction,
    value,
    position,
  };
  return { ...model, memberPointLoads: [...model.memberPointLoads, load] };
}

export type UpdateMemberPointLoadArgs = { id: string } & Partial<Omit<MemberPointLoad, "id">>;

/**
 * Changes a member point load; what is left out keeps its value.
 * Refuses (the whole update): an id that is not a member point load; a member or a load case given that is not
 * in the model; axes or a direction given that the format does not have; a value or a position given that is
 * not finite; when the member or the position is given, a position that would then be below 0 or beyond the
 * member's length (as `addMemberPointLoad` checks it).
 */
export function updateMemberPointLoad(
  model: Model,
  { id, ...patch }: UpdateMemberPointLoadArgs,
): Model {
  const { memberId, loadCaseId, axes, direction, value = 0, position } = patch;
  const current = model.memberPointLoads.find((load) => load.id === id);
  if (
    current === undefined ||
    (memberId !== undefined && !hasId(model.members, memberId)) ||
    (loadCaseId !== undefined && !hasId(model.loadCases, loadCaseId)) ||
    (axes !== undefined && !isAxes(axes)) ||
    (direction !== undefined && !isDirection(direction)) ||
    !allFinite(value, position ?? 0)
  ) {
    return model;
  }
  if (
    (memberId !== undefined || position !== undefined) &&
    !positionFits(model, memberId ?? current.memberId, position ?? current.position)
  ) {
    return model;
  }
  const memberPointLoads = updated(model.memberPointLoads, id, (load) => patched(load, patch));
  return memberPointLoads === model.memberPointLoads ? model : { ...model, memberPointLoads };
}

/**
 * Removes a member point load.
 * Refuses: an id that is not a member point load.
 */
export function removeMemberPointLoad(model: Model, { id }: RemoveLoadArgs): Model {
  const memberPointLoads = without(model.memberPointLoads, (load) => load.id === id);
  return memberPointLoads === model.memberPointLoads ? model : { ...model, memberPointLoads };
}

// ---------------------------------------------------------------------------------------------------------
// Sections, materials, load cases
// ---------------------------------------------------------------------------------------------------------

export type AddSectionArgs = Omit<Section, "id">;

/**
 * Adds a section, with the id `nextSectionId(model)`. Units as in `Section`: m², m⁴, m.
 * Refuses: `A`, `Iy`, `Iz`, `J`, `depthY` or `depthZ` that is not a finite number greater than zero.
 */
export function addSection(model: Model, args: AddSectionArgs): Model {
  const { name, A, Iy, Iz, J, depthY, depthZ } = args;
  if (!allPositive(A, Iy, Iz, J, depthY, depthZ)) {
    return model;
  }
  const section: Section = { id: nextSectionId(model), name, A, Iy, Iz, J, depthY, depthZ };
  return { ...model, sections: [...model.sections, section] };
}

export type AddMaterialArgs = Omit<Material, "id">;

/**
 * Adds a material, with the id `nextMaterialId(model)`. Units as in `Material`: kN/m², kg/m³.
 * Refuses: `E`, `G` or `fy` that is not a finite number greater than zero; a density that is not finite or
 * is below zero.
 */
export function addMaterial(model: Model, args: AddMaterialArgs): Model {
  const { name, E, G, fy, density } = args;
  if (!allPositive(E, G, fy) || !allFinite(density) || density < 0) {
    return model;
  }
  const material: Material = { id: nextMaterialId(model), name, E, G, fy, density };
  return { ...model, materials: [...model.materials, material] };
}

export type AddLoadCaseArgs = Omit<LoadCase, "id">;

/** Adds a load case, with the id `nextLoadCaseId(model)`. Refuses nothing. */
export function addLoadCase(model: Model, { name }: AddLoadCaseArgs): Model {
  const loadCase: LoadCase = { id: nextLoadCaseId(model), name };
  return { ...model, loadCases: [...model.loadCases, loadCase] };
}

// ---------------------------------------------------------------------------------------------------------
// The whole model
// ---------------------------------------------------------------------------------------------------------

export interface ReplaceModelArgs {
  model: Model;
}

/**
 * Replaces the whole model: returns the model given, the same object, whatever the present one is. It checks
 * nothing; the store clears the undo history when it runs it (./modelStore.ts, `replaceModel`).
 */
export function replaceModel(_model: Model, { model }: ReplaceModelArgs): Model {
  return model;
}
