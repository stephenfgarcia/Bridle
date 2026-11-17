import { distance, ZERO_LENGTH_TOLERANCE } from "./geometry";
import { issue, type ModelIssue } from "./issues";
import type { Model, Node } from "./types";

/** The slack, in m, allowed past either end of a member for a point load's `position`. */
export const POSITION_TOLERANCE = 1e-9;

function byId<T extends { id: string }>(list: readonly T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of list) {
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  }
  return map;
}

function duplicateIds(
  list: readonly { id: string }[],
  listName: string,
  issues: ModelIssue[],
): void {
  const seen = new Set<string>();
  list.forEach((item, index) => {
    if (seen.has(item.id)) {
      issues.push(issue("duplicate-id", [item.id], `${listName}[${index}].id`));
    }
    seen.add(item.id);
  });
}

/**
 * Reports each of `fields` of `item` that is not a finite number (NaN, Infinity or -Infinity) as
 * `non-finite-value`, with the path `at.field`.
 */
function finiteFields<K extends string>(
  item: { id: string } & Record<K, number>,
  fields: readonly K[],
  at: string,
  issues: ModelIssue[],
): void {
  for (const field of fields) {
    if (!Number.isFinite(item[field])) {
      issues.push(issue("non-finite-value", [item.id], `${at}.${field}`));
    }
  }
}

function finitePoint(node: Node): boolean {
  return Number.isFinite(node.x) && Number.isFinite(node.y) && Number.isFinite(node.z);
}

/**
 * Checks a model whose shape is already right (a `Model` value, or the output of `parseModel`).
 *
 * @returns the issues found, in the order of the lists of `Model`; an empty list for a valid model.
 *
 * Reported, with the `ids` of each issue:
 * - `duplicate-id`: an id used a second time in one list (`[id]`, once per repeat).
 * - `duplicate-support`: a second support on one node (`[nodeId]`).
 * - `missing-node`: a member, support or nodal load names a node that is not in `nodes`
 *   (`[memberId or loadId, nodeId]`; for a support `[nodeId]`).
 * - `missing-section`, `missing-material`: a member names one that is not there (`[memberId, id]`).
 * - `missing-member`: a member load names a member that is not in `members` (`[loadId, memberId]`).
 * - `missing-load-case`: a load names a load case that is not in `loadCases` (`[loadId, loadCaseId]`).
 * - `non-finite-value`: a number is NaN, Infinity or -Infinity (`[id]` of the entry, with the field
 *   in `path`). Checked: a node's `x`, `y`, `z`; a member's `rollAngleDeg`; a section's `A`, `Iy`,
 *   `Iz`, `J`, `depthY`, `depthZ`; a material's `E`, `G`, `fy`, `density`; a nodal load's `fx`,
 *   `fy`, `fz`, `mx`, `my`, `mz`; a uniform load's `value`; a point load's `value` and `position`.
 *   Also a member whose length is not finite although the coordinates of its two nodes are (their
 *   difference overflows): `[memberId]`, with the member in `path`.
 * - `zero-length-member`: both ends are the same node, or the two nodes are closer than
 *   `ZERO_LENGTH_TOLERANCE` (`[memberId]`). Not checked when a coordinate of one of the two nodes
 *   is not finite.
 * - `non-positive-value`: a section's `A`, `Iy`, `Iz`, `J`, `depthY` or `depthZ`, or a material's
 *   `E`, `G` or `fy`, is a finite number that is not greater than zero (`[id]`, with the field in
 *   `path`).
 * - `load-position-outside-member`: a point load's `position` is a finite number below 0 or beyond
 *   the member's length, by more than `POSITION_TOLERANCE` (`[loadId, memberId]`). Not checked when
 *   the member or one of its nodes is missing, or the member has zero length or no finite length.
 * - `no-support`: no support restrains anything (`[]`).
 *
 * It does not decide whether the structure is stable; that is the solver's job.
 */
export function validateModel(model: Model): ModelIssue[] {
  const issues: ModelIssue[] = [];
  const nodes = byId(model.nodes);
  const members = byId(model.members);
  const sections = byId(model.sections);
  const materials = byId(model.materials);
  const loadCases = byId(model.loadCases);

  duplicateIds(model.nodes, "nodes", issues);
  model.nodes.forEach((node, index) => {
    finiteFields(node, ["x", "y", "z"], `nodes[${index}]`, issues);
  });

  duplicateIds(model.members, "members", issues);
  const lengths = new Map<string, number>();
  model.members.forEach((member, index) => {
    const at = `members[${index}]`;
    const start: Node | undefined = nodes.get(member.startNodeId);
    const end: Node | undefined = nodes.get(member.endNodeId);
    if (start === undefined) {
      issues.push(issue("missing-node", [member.id, member.startNodeId], `${at}.startNodeId`));
    }
    if (end === undefined) {
      issues.push(issue("missing-node", [member.id, member.endNodeId], `${at}.endNodeId`));
    }
    if (!sections.has(member.sectionId)) {
      issues.push(issue("missing-section", [member.id, member.sectionId], `${at}.sectionId`));
    }
    if (!materials.has(member.materialId)) {
      issues.push(issue("missing-material", [member.id, member.materialId], `${at}.materialId`));
    }
    finiteFields(member, ["rollAngleDeg"], at, issues);
    // A coordinate that is not finite is reported at its node; the length is then not checked.
    if (start !== undefined && end !== undefined && finitePoint(start) && finitePoint(end)) {
      const length = distance(start, end);
      if (!Number.isFinite(length)) {
        issues.push(issue("non-finite-value", [member.id], at));
      } else if (length >= ZERO_LENGTH_TOLERANCE) {
        if (members.get(member.id) === member) {
          lengths.set(member.id, length);
        }
      } else {
        issues.push(issue("zero-length-member", [member.id], at));
      }
    }
  });

  duplicateIds(model.sections, "sections", issues);
  model.sections.forEach((section, index) => {
    finiteFields(section, ["A", "Iy", "Iz", "J", "depthY", "depthZ"], `sections[${index}]`, issues);
    for (const field of ["A", "Iy", "Iz", "J", "depthY", "depthZ"] as const) {
      if (Number.isFinite(section[field]) && !(section[field] > 0)) {
        issues.push(issue("non-positive-value", [section.id], `sections[${index}].${field}`));
      }
    }
  });

  duplicateIds(model.materials, "materials", issues);
  model.materials.forEach((material, index) => {
    finiteFields(material, ["E", "G", "fy", "density"], `materials[${index}]`, issues);
    for (const field of ["E", "G", "fy"] as const) {
      if (Number.isFinite(material[field]) && !(material[field] > 0)) {
        issues.push(issue("non-positive-value", [material.id], `materials[${index}].${field}`));
      }
    }
  });

  const supported = new Set<string>();
  let restrained = false;
  model.supports.forEach((support, index) => {
    const at = `supports[${index}]`;
    if (!nodes.has(support.nodeId)) {
      issues.push(issue("missing-node", [support.nodeId], `${at}.nodeId`));
    } else if (support.ux || support.uy || support.uz || support.rx || support.ry || support.rz) {
      restrained = true;
    }
    if (supported.has(support.nodeId)) {
      issues.push(issue("duplicate-support", [support.nodeId], `${at}.nodeId`));
    }
    supported.add(support.nodeId);
  });

  duplicateIds(model.loadCases, "loadCases", issues);

  const loadCase = (load: { id: string; loadCaseId: string }, at: string): void => {
    if (!loadCases.has(load.loadCaseId)) {
      issues.push(issue("missing-load-case", [load.id, load.loadCaseId], `${at}.loadCaseId`));
    }
  };
  const loadMember = (load: { id: string; memberId: string }, at: string): void => {
    if (!members.has(load.memberId)) {
      issues.push(issue("missing-member", [load.id, load.memberId], `${at}.memberId`));
    }
  };

  duplicateIds(model.nodalLoads, "nodalLoads", issues);
  model.nodalLoads.forEach((load, index) => {
    const at = `nodalLoads[${index}]`;
    loadCase(load, at);
    if (!nodes.has(load.nodeId)) {
      issues.push(issue("missing-node", [load.id, load.nodeId], `${at}.nodeId`));
    }
    finiteFields(load, ["fx", "fy", "fz", "mx", "my", "mz"], at, issues);
  });

  duplicateIds(model.memberUniformLoads, "memberUniformLoads", issues);
  model.memberUniformLoads.forEach((load, index) => {
    const at = `memberUniformLoads[${index}]`;
    loadCase(load, at);
    loadMember(load, at);
    finiteFields(load, ["value"], at, issues);
  });

  duplicateIds(model.memberPointLoads, "memberPointLoads", issues);
  model.memberPointLoads.forEach((load, index) => {
    const at = `memberPointLoads[${index}]`;
    loadCase(load, at);
    loadMember(load, at);
    finiteFields(load, ["value", "position"], at, issues);
    const length = lengths.get(load.memberId);
    if (
      length !== undefined &&
      Number.isFinite(load.position) &&
      !(load.position >= -POSITION_TOLERANCE && load.position <= length + POSITION_TOLERANCE)
    ) {
      issues.push(
        issue("load-position-outside-member", [load.id, load.memberId], `${at}.position`),
      );
    }
  });

  if (!restrained) {
    issues.push(issue("no-support", []));
  }
  return issues;
}
