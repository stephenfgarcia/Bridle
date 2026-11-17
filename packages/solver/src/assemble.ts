/**
 * Assembly of the global stiffness matrix of a model from its members (direct stiffness method).
 * Supports and loads are not applied here: the matrix is that of the free structure, so it is
 * singular (it has the six rigid-body motions). `solve` (./solve.ts) applies the supports and solves.
 */
import {
  distance,
  type LocalAxes,
  type Member,
  type Model,
  type ModelIssue,
  memberLocalAxes,
  validateModel,
} from "@bridle/model";
import { buildDofMap, type DofMap, memberDofIndices } from "./dof";
import { elementStiffnessGlobal, elementStiffnessLocal, elementTransformation } from "./element";
import { addAt, at, type Matrix, zeros } from "./matrix";

/** One member as the solver sees it. Later cards read member results from these. */
export interface MemberElement {
  memberId: string;
  /** Length, m. */
  length: number;
  /** The local axes as unit vectors in global coordinates (`memberLocalAxes`). */
  axes: LocalAxes;
  /** The 12 by 12 stiffness matrix in local axes (`elementStiffnessLocal`). */
  kLocal: Matrix;
  /** The 12 by 12 transformation from global to local axes (`elementTransformation`). */
  transformation: Matrix;
  /** The twelve rows of the global matrix this member adds to: start node, then end node. */
  dofIndices: number[];
}

/** Why a member cannot be assembled yet. Both are the work of card S5. */
export type UnsupportedFeature = "truss-member" | "end-release";

export interface UnsupportedMember {
  memberId: string;
  feature: UnsupportedFeature;
}

export type AssembleResult =
  | {
      ok: true;
      /** The global stiffness matrix, `dofMap.size` square, without supports. */
      stiffness: Matrix;
      /** The map from a node and a degree of freedom to a row of `stiffness`. */
      dofMap: DofMap;
      /** One entry per member, in the model's order. */
      elements: MemberElement[];
    }
  | {
      ok: false;
      /** `validateModel` reported issues; nothing was assembled. */
      reason: "invalid-model";
      issues: ModelIssue[];
    }
  | {
      ok: false;
      /** The model is valid but has members this card does not assemble (see `UnsupportedFeature`). */
      reason: "not-supported-yet";
      unsupported: UnsupportedMember[];
    };

function hasRelease(member: Member): boolean {
  const { start, end } = member.releases;
  return start.rx || start.ry || start.rz || end.rx || end.ry || end.rz;
}

/**
 * The members of a model that `assemble` refuses: one entry per truss member and one per member with
 * any end release (a truss member with a release gets both), in the model's order.
 */
export function unsupportedMembers(model: Model): UnsupportedMember[] {
  const unsupported: UnsupportedMember[] = [];
  for (const member of model.members) {
    if (member.kind === "truss") {
      unsupported.push({ memberId: member.id, feature: "truss-member" });
    }
    if (hasRelease(member)) {
      unsupported.push({ memberId: member.id, feature: "end-release" });
    }
  }
  return unsupported;
}

/**
 * Assembles the global stiffness matrix of a model.
 *
 * The matrix is dense and square, of size six times the number of nodes; node number `n` (from 0, in
 * the model's order) owns rows `6n` to `6n + 5` in the order ux, uy, uz, rx, ry, rz, all in global
 * axes. Each member adds its global element matrix (`elementStiffnessGlobal`) at the rows of its two
 * nodes. A node that no member touches keeps zero rows.
 *
 * Refusals, in this order:
 * - `validateModel` reports issues: `{ ok: false, reason: "invalid-model", issues }`.
 * - A member is of kind `truss` or has an end release:
 *   `{ ok: false, reason: "not-supported-yet", unsupported }` (until card S5).
 *
 * The function does not change the model and keeps no state between calls. `validateModel` reports
 * every number of the model that is not finite, so such a model is refused as `invalid-model`. The
 * entries of the matrix are not checked: finite numbers whose products overflow a double (E times A,
 * for example) give a matrix with entries that are not finite; `solve` checks for that.
 */
export function assemble(model: Model): AssembleResult {
  const issues = validateModel(model);
  if (issues.length > 0) {
    return { ok: false, reason: "invalid-model", issues };
  }
  const unsupported = unsupportedMembers(model);
  if (unsupported.length > 0) {
    return { ok: false, reason: "not-supported-yet", unsupported };
  }

  const dofMap = buildDofMap(model.nodes);
  const nodes = new Map(model.nodes.map((node) => [node.id, node]));
  const sections = new Map(model.sections.map((section) => [section.id, section]));
  const materials = new Map(model.materials.map((material) => [material.id, material]));
  const stiffness = zeros(dofMap.size, dofMap.size);
  const elements: MemberElement[] = [];

  for (const member of model.members) {
    const start = nodes.get(member.startNodeId);
    const end = nodes.get(member.endNodeId);
    const section = sections.get(member.sectionId);
    const material = materials.get(member.materialId);
    const axes = start && end ? memberLocalAxes(start, end, member.rollAngleDeg) : undefined;
    const dofIndices = memberDofIndices(dofMap, member.startNodeId, member.endNodeId);
    if (!start || !end || !section || !material || !axes || !dofIndices) {
      // validateModel reports a missing node, section or material, a zero-length member and a
      // coordinate or length that is not finite, so a model it accepts does not come here. The
      // check is kept so that a later change to the validation cannot pass `undefined` on silently.
      throw new Error(`assemble: member ${member.id} could not be resolved`);
    }

    const length = distance(start, end);
    const kLocal = elementStiffnessLocal({
      E: material.E,
      G: material.G,
      A: section.A,
      Iy: section.Iy,
      Iz: section.Iz,
      J: section.J,
      length,
    });
    const transformation = elementTransformation(axes);
    const kGlobal = elementStiffnessGlobal(kLocal, transformation);

    dofIndices.forEach((row, i) => {
      dofIndices.forEach((col, j) => {
        addAt(stiffness, row, col, at(kGlobal, i, j));
      });
    });
    elements.push({ memberId: member.id, length, axes, kLocal, transformation, dofIndices });
  }

  return { ok: true, stiffness, dofMap, elements };
}
