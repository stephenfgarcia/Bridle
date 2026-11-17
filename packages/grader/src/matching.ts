/**
 * Matching the learner's model to another model (the reference, or the starting model) by position
 * and connectivity, never by the ids of nodes and members.
 *
 * - A node of the learner is matched to a node of the other model when the distance between them is
 *   at most `NODE_MATCH_TOLERANCE`. Each node is matched at most once: the other model's nodes are
 *   taken in their order, and each takes the nearest learner's node not yet taken (the first in the
 *   learner's order among equally near ones).
 * - A member of the learner is matched to a member of the other model when its two end nodes are
 *   the nodes matched to that member's two end nodes, in either direction. Each member is matched
 *   at most once, the first in the learner's order first.
 * - Sections, materials and load cases have no position; they are compared by id.
 */
import {
  distance,
  type Member,
  type Model,
  memberLocalAxes,
  type Node,
  type Vec3,
} from "@bridle/model";
import type { Task } from "@bridle/tasks";
import {
  type MatchingEvidence,
  type MemberDifference,
  type MemberMatchEvidence,
  NODE_MATCH_TOLERANCE,
  PARALLEL_TOLERANCE,
} from "./types";
import { compareIds, dot, firstById } from "./vec";

/** A member of the learner matched to a member of the other model. */
export interface MatchedMember {
  member: Member;
  /** The learner's member runs from the other member's end node to its start node. */
  reversed: boolean;
}

/** The result of `matchModels(other, learner)`. Ids of `other` are the keys of `nodes` and `members`. */
export interface ModelMatch {
  /** The other model's node id to the learner's node. */
  nodes: Map<string, Node>;
  /** The other model's member id to the learner's member. */
  members: Map<string, MatchedMember>;
  /** The learner's node id to the other model's node id. */
  otherNodeIdOf: Map<string, string>;
  /** The learner's member id to the other model's member id. */
  otherMemberIdOf: Map<string, string>;
}

/** Matches the nodes and members of `learner` to those of `other`, by the rules at the top of this file. */
export function matchModels(other: Model, learner: Model): ModelMatch {
  const nodes = new Map<string, Node>();
  const otherNodeIdOf = new Map<string, string>();
  const learnerNodes = [...firstById(learner.nodes).values()];
  for (const node of firstById(other.nodes).values()) {
    let best: Node | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of learnerNodes) {
      if (otherNodeIdOf.has(candidate.id)) {
        continue;
      }
      const d = distance(node, candidate);
      if (d <= NODE_MATCH_TOLERANCE && d < bestDistance) {
        best = candidate;
        bestDistance = d;
      }
    }
    if (best !== undefined) {
      nodes.set(node.id, best);
      otherNodeIdOf.set(best.id, node.id);
    }
  }

  const members = new Map<string, MatchedMember>();
  const otherMemberIdOf = new Map<string, string>();
  const learnerMembers = [...firstById(learner.members).values()];
  for (const member of firstById(other.members).values()) {
    const start = nodes.get(member.startNodeId);
    const end = nodes.get(member.endNodeId);
    if (start === undefined || end === undefined) {
      continue;
    }
    for (const candidate of learnerMembers) {
      if (otherMemberIdOf.has(candidate.id)) {
        continue;
      }
      const same = candidate.startNodeId === start.id && candidate.endNodeId === end.id;
      const reversed = candidate.startNodeId === end.id && candidate.endNodeId === start.id;
      if (same || reversed) {
        members.set(member.id, { member: candidate, reversed: !same });
        otherMemberIdOf.set(candidate.id, member.id);
        break;
      }
    }
  }
  return { nodes, members, otherNodeIdOf, otherMemberIdOf };
}

/** The positions of a member's two end nodes, or `undefined` when the model lacks one of them. */
export function memberEnds(model: Model, member: Member): { start: Vec3; end: Vec3 } | undefined {
  const nodes = firstById(model.nodes);
  const start = nodes.get(member.startNodeId);
  const end = nodes.get(member.endNodeId);
  return start === undefined || end === undefined ? undefined : { start, end };
}

/**
 * What differs between a reference member and the learner's member matched to it.
 *
 * - `sectionId`, `materialId`, `kind`: the values differ. `sectionId` is not reported when
 *   `sectionIsChoice` (the member's section is the learner's to choose).
 * - `orientation`: the local y axes of the two members are not parallel (in either sense), so the
 *   section is turned about the member's axis. A reversed member with roll 0 is parallel.
 * - `releases`: the releases at a node differ from the reference member's at the matched node; the
 *   learner's start is compared with the reference's end when the member is reversed.
 */
export function memberDifferences(
  reference: Model,
  referenceMember: Member,
  learner: Model,
  matched: MatchedMember,
  sectionIsChoice: boolean,
): MemberDifference[] {
  const differences: MemberDifference[] = [];
  const member = matched.member;
  if (!sectionIsChoice && member.sectionId !== referenceMember.sectionId) {
    differences.push("sectionId");
  }
  if (member.materialId !== referenceMember.materialId) {
    differences.push("materialId");
  }
  if (member.kind !== referenceMember.kind) {
    differences.push("kind");
  }
  const referenceEnds = memberEnds(reference, referenceMember);
  const learnerEnds = memberEnds(learner, member);
  const referenceAxes =
    referenceEnds &&
    memberLocalAxes(referenceEnds.start, referenceEnds.end, referenceMember.rollAngleDeg);
  const learnerAxes =
    learnerEnds && memberLocalAxes(learnerEnds.start, learnerEnds.end, member.rollAngleDeg);
  if (
    referenceAxes !== undefined &&
    learnerAxes !== undefined &&
    Math.abs(dot(referenceAxes.y, learnerAxes.y)) < 1 - PARALLEL_TOLERANCE
  ) {
    differences.push("orientation");
  }
  const atStart = matched.reversed ? member.releases.end : member.releases.start;
  const atEnd = matched.reversed ? member.releases.start : member.releases.end;
  const sameRelease = (a: typeof atStart, b: typeof atStart) =>
    a.rx === b.rx && a.ry === b.ry && a.rz === b.rz;
  if (
    !sameRelease(atStart, referenceMember.releases.start) ||
    !sameRelease(atEnd, referenceMember.releases.end)
  ) {
    differences.push("releases");
  }
  return differences;
}

/** The matching of the learner's model to the task's reference model, as evidence. */
export function matchingEvidence(task: Task, learner: Model, match: ModelMatch): MatchingEvidence {
  const reference = task.referenceModel;
  const chosen = new Set(task.sectionChoice?.memberIds ?? []);
  const members = [...firstById(reference.members).values()].map(
    (referenceMember): MemberMatchEvidence => {
      const matched = match.members.get(referenceMember.id);
      return {
        referenceMemberId: referenceMember.id,
        learnerMemberId: matched?.member.id ?? null,
        reversed: matched?.reversed ?? false,
        referenceSectionId: referenceMember.sectionId,
        learnerSectionId: matched?.member.sectionId ?? null,
        differences:
          matched === undefined
            ? []
            : memberDifferences(
                reference,
                referenceMember,
                learner,
                matched,
                chosen.has(referenceMember.id),
              ),
      };
    },
  );
  return {
    nodeTolerance: NODE_MATCH_TOLERANCE,
    nodes: [...firstById(reference.nodes).values()].map((node) => ({
      referenceNodeId: node.id,
      learnerNodeId: match.nodes.get(node.id)?.id ?? null,
    })),
    members,
    extraNodeIds: [...firstById(learner.nodes).keys()]
      .filter((id) => !match.otherNodeIdOf.has(id))
      .sort(compareIds),
    extraMemberIds: [...firstById(learner.members).keys()]
      .filter((id) => !match.otherMemberIdOf.has(id))
      .sort(compareIds),
  };
}
