/** Part (c) of the evidence: the supports of the reference and of the learner's model, node by node. */
import type { Model, Support } from "@bridle/model";
import { DOFS, type Dof } from "@bridle/solver";
import type { ModelMatch } from "./matching";
import {
  NODE_MATCH_TOLERANCE,
  type Restraints,
  type SupportNodeEvidence,
  type SupportsEvidence,
} from "./types";
import { compareIds, firstById } from "./vec";

/** The restraints that hold a model lying in an X-Z plane in that plane, and no more. */
export const OUT_OF_PLANE_DOFS: readonly Dof[] = ["uy", "rx", "rz"];

/**
 * `"xz"` when the model has a node and the y coordinates of all its nodes are within
 * `NODE_MATCH_TOLERANCE` of the first node's; otherwise `null`.
 */
export function modelPlane(model: Model): "xz" | null {
  const first = model.nodes[0];
  if (first === undefined) {
    return null;
  }
  return model.nodes.every((node) => Math.abs(node.y - first.y) <= NODE_MATCH_TOLERANCE)
    ? "xz"
    : null;
}

function restraints(support: Support | undefined): Restraints | null {
  return support === undefined
    ? null
    : {
        ux: support.ux,
        uy: support.uy,
        uz: support.uz,
        rx: support.rx,
        ry: support.ry,
        rz: support.rz,
      };
}

/** The first support of each node; a second support on a node is ignored. */
function supportsByNode(model: Model): Map<string, Support> {
  const map = new Map<string, Support>();
  for (const support of model.supports) {
    if (!map.has(support.nodeId)) {
      map.set(support.nodeId, support);
    }
  }
  return map;
}

/** The degrees of freedom of `dofs` in which the two supports differ; no support is all free. */
function differing(a: Restraints | null, b: Restraints | null, dofs: readonly Dof[]): Dof[] {
  return dofs.filter((dof) => (a?.[dof] ?? false) !== (b?.[dof] ?? false));
}

/**
 * Compares the supports of the two models at every node that has a support in either.
 *
 * The learner's support on the node matched to a reference node (`match`, by position) is compared
 * with the reference's support on that node. When the reference model lies in an X-Z plane, ux, uz
 * and ry are the support conditions the task asks for (`agrees`, `differing`) and uy, rx and rz,
 * which only hold the model in its plane, are compared separately (`outOfPlaneAgrees`,
 * `outOfPlaneDiffering`). Otherwise all six are compared together. A support of the learner on a
 * node the learner's model lacks is listed under that node id with nothing to compare it with.
 */
export function compareSupports(
  reference: Model,
  learner: Model,
  match: ModelMatch,
): SupportsEvidence {
  const plane = modelPlane(reference);
  const outOfPlane: Dof[] = plane === "xz" ? [...OUT_OF_PLANE_DOFS] : [];
  const compared: Dof[] = DOFS.filter((dof) => !outOfPlane.includes(dof));
  const referenceSupports = supportsByNode(reference);
  const learnerSupports = supportsByNode(learner);
  const referenceNodes = firstById(reference.nodes);

  const entry = (
    referenceNodeId: string | null,
    learnerNodeId: string | null,
    ofReference: Restraints | null,
    ofLearner: Restraints | null,
  ): SupportNodeEvidence => {
    const inPlane = differing(ofReference, ofLearner, compared);
    const out = differing(ofReference, ofLearner, outOfPlane);
    return {
      referenceNodeId,
      learnerNodeId,
      reference: ofReference,
      learner: ofLearner,
      agrees: inPlane.length === 0,
      differing: inPlane,
      outOfPlaneAgrees: out.length === 0,
      outOfPlaneDiffering: out,
    };
  };

  const nodes: SupportNodeEvidence[] = [];
  const listed = new Set<string>();
  for (const [nodeId, support] of referenceSupports) {
    if (!referenceNodes.has(nodeId)) {
      continue;
    }
    const learnerNodeId = match.nodes.get(nodeId)?.id ?? null;
    if (learnerNodeId !== null) {
      listed.add(learnerNodeId);
    }
    const ofLearner = learnerNodeId === null ? undefined : learnerSupports.get(learnerNodeId);
    nodes.push(entry(nodeId, learnerNodeId, restraints(support), restraints(ofLearner)));
  }
  const others = [...learnerSupports.keys()].filter((id) => !listed.has(id)).sort(compareIds);
  for (const nodeId of others) {
    nodes.push(
      entry(
        match.otherNodeIdOf.get(nodeId) ?? null,
        nodeId,
        null,
        restraints(learnerSupports.get(nodeId)),
      ),
    );
  }
  return { plane, compared, outOfPlane, nodes };
}
