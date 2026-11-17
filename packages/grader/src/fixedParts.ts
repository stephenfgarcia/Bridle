/**
 * Part (b) of the evidence: the parts the task fixes, compared field by field with the starting
 * model.
 *
 * A fixed part is an entry of the starting model, which the workspace keeps under its id, so it is
 * looked up in the learner's model by its list and id (for a support, by its node id). Numbers are
 * compared exactly. The ids a part names (a member's nodes, a load's member) are compared as ids.
 */
import type { Model } from "@bridle/model";
import type { FixedPart, ModelListName, Task } from "@bridle/tasks";
import { matchModels } from "./matching";
import type { ChangedField, FieldValue, FixedPartDifference, FixedPartsEvidence } from "./types";

type Fields = [string, FieldValue][];

/**
 * The entry `id` of `list` as its fields in the order of its type, without the id; `undefined`
 * when the model has no such entry. `withSection: false` leaves a member's `sectionId` out.
 */
function fieldsOf(
  model: Model,
  list: ModelListName,
  id: string,
  withSection: boolean,
): Fields | undefined {
  switch (list) {
    case "nodes": {
      const node = model.nodes.find((item) => item.id === id);
      return (
        node && [
          ["x", node.x],
          ["y", node.y],
          ["z", node.z],
        ]
      );
    }
    case "members": {
      const member = model.members.find((item) => item.id === id);
      if (member === undefined) {
        return undefined;
      }
      const section: Fields = withSection ? [["sectionId", member.sectionId]] : [];
      return [
        ["startNodeId", member.startNodeId],
        ["endNodeId", member.endNodeId],
        ...section,
        ["materialId", member.materialId],
        ["kind", member.kind],
        ["rollAngleDeg", member.rollAngleDeg],
        ["releases.start.rx", member.releases.start.rx],
        ["releases.start.ry", member.releases.start.ry],
        ["releases.start.rz", member.releases.start.rz],
        ["releases.end.rx", member.releases.end.rx],
        ["releases.end.ry", member.releases.end.ry],
        ["releases.end.rz", member.releases.end.rz],
      ];
    }
    case "sections": {
      const section = model.sections.find((item) => item.id === id);
      return (
        section && [
          ["name", section.name],
          ["A", section.A],
          ["Iy", section.Iy],
          ["Iz", section.Iz],
          ["J", section.J],
          ["depthY", section.depthY],
          ["depthZ", section.depthZ],
        ]
      );
    }
    case "materials": {
      const material = model.materials.find((item) => item.id === id);
      return (
        material && [
          ["name", material.name],
          ["E", material.E],
          ["G", material.G],
          ["fy", material.fy],
          ["density", material.density],
        ]
      );
    }
    case "supports": {
      const support = model.supports.find((item) => item.nodeId === id);
      return (
        support && [
          ["ux", support.ux],
          ["uy", support.uy],
          ["uz", support.uz],
          ["rx", support.rx],
          ["ry", support.ry],
          ["rz", support.rz],
        ]
      );
    }
    case "loadCases": {
      const loadCase = model.loadCases.find((item) => item.id === id);
      return loadCase && [["name", loadCase.name]];
    }
    case "nodalLoads": {
      const load = model.nodalLoads.find((item) => item.id === id);
      return (
        load && [
          ["loadCaseId", load.loadCaseId],
          ["nodeId", load.nodeId],
          ["fx", load.fx],
          ["fy", load.fy],
          ["fz", load.fz],
          ["mx", load.mx],
          ["my", load.my],
          ["mz", load.mz],
        ]
      );
    }
    case "memberUniformLoads": {
      const load = model.memberUniformLoads.find((item) => item.id === id);
      return (
        load && [
          ["loadCaseId", load.loadCaseId],
          ["memberId", load.memberId],
          ["axes", load.axes],
          ["direction", load.direction],
          ["value", load.value],
        ]
      );
    }
    case "memberPointLoads": {
      const load = model.memberPointLoads.find((item) => item.id === id);
      return (
        load && [
          ["loadCaseId", load.loadCaseId],
          ["memberId", load.memberId],
          ["axes", load.axes],
          ["direction", load.direction],
          ["value", load.value],
          ["position", load.position],
        ]
      );
    }
  }
}

/**
 * Compares each fixed part of the task in the learner's model with the starting model.
 *
 * - A part the learner's model has no entry for (same list, same id) is `missing`. For a node or a
 *   member, `counterpartId` is then the learner's node at the same position or the learner's member
 *   between the same two positions, if there is one.
 * - A part with a field that differs is `changed`, with each such field and its two values. The
 *   section of a member named by the task's `sectionChoice` is not compared.
 * - A part the starting model itself lacks (which `validateTask` reports) is skipped.
 * - With a repeated id in a list, the first entry is the one compared.
 */
export function compareFixedParts(task: Task, learner: Model): FixedPartsEvidence {
  const chosen = new Set(task.sectionChoice?.memberIds ?? []);
  const match = matchModels(task.startingModel, learner);
  const differences: FixedPartDifference[] = [];
  for (const part of task.fixed) {
    const withSection = !(part.list === "members" && chosen.has(part.id));
    const expected = fieldsOf(task.startingModel, part.list, part.id, withSection);
    if (expected === undefined) {
      continue;
    }
    const actual = fieldsOf(learner, part.list, part.id, withSection);
    if (actual === undefined) {
      differences.push({
        list: part.list,
        id: part.id,
        status: "missing",
        counterpartId: counterpart(part, match),
        changedFields: [],
      });
      continue;
    }
    const changedFields: ChangedField[] = [];
    expected.forEach(([field, value], index) => {
      const found = actual[index]?.[1];
      if (found !== undefined && found !== value) {
        changedFields.push({ field, expected: value, actual: found });
      }
    });
    if (changedFields.length > 0) {
      differences.push({
        list: part.list,
        id: part.id,
        status: "changed",
        counterpartId: null,
        changedFields,
      });
    }
  }
  return { checked: task.fixed.length, differences };
}

function counterpart(part: FixedPart, match: ReturnType<typeof matchModels>): string | null {
  if (part.list === "nodes") {
    return match.nodes.get(part.id)?.id ?? null;
  }
  if (part.list === "members") {
    return match.members.get(part.id)?.member.id ?? null;
  }
  return null;
}
