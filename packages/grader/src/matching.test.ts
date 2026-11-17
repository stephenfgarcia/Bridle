import { chooseTheBeamTask, portalFrameTask, simplySupportedBeamTask } from "@bridle/tasks";
import { describe, expect, test } from "vitest";
import { matchingEvidence, matchModels } from "./matching";
import { copy, redrawMember, renameNodes } from "./testSupport";
import { NODE_MATCH_TOLERANCE } from "./types";

const beam = simplySupportedBeamTask();
const portal = portalFrameTask();

describe("matchModels", () => {
  test("the reference matches itself, node for node and member for member", () => {
    const match = matchModels(portal.referenceModel, copy(portal.referenceModel));
    expect([...match.nodes].map(([id, node]) => [id, node.id])).toEqual([
      ["A", "A"],
      ["B", "B"],
      ["C", "C"],
      ["D", "D"],
    ]);
    expect([...match.members].map(([id, m]) => [id, m.member.id, m.reversed])).toEqual([
      ["AB", "AB", false],
      ["BC", "BC", false],
      ["DC", "DC", false],
    ]);
  });

  test("nodes and members with other ids, in another order and direction, are matched by position", () => {
    let learner = renameNodes(portal.referenceModel);
    learner = redrawMember(learner, "AB", "left", true);
    learner = redrawMember(learner, "BC", "top", false);
    learner = redrawMember(learner, "DC", "right", true);
    learner.nodes.reverse();
    learner.members.reverse();
    const match = matchModels(portal.referenceModel, learner);
    expect([...match.nodes].map(([id, node]) => [id, node.id])).toEqual([
      ["A", "n1"],
      ["B", "n2"],
      ["C", "n3"],
      ["D", "n4"],
    ]);
    expect([...match.members].map(([id, m]) => [id, m.member.id, m.reversed])).toEqual([
      ["AB", "left", true],
      ["BC", "top", false],
      ["DC", "right", true],
    ]);
    expect(match.otherNodeIdOf.get("n3")).toBe("C");
    expect(match.otherMemberIdOf.get("right")).toBe("DC");
  });

  test("an id of the reference on another node does not match: the position decides", () => {
    const learner = copy(beam.referenceModel);
    // The learner's "A" is at B's place and the learner's "B" is at A's place.
    const [a, , b] = learner.nodes;
    if (a === undefined || b === undefined) {
      throw new Error("the beam has three nodes");
    }
    a.x = 6;
    b.x = 0;
    const match = matchModels(beam.referenceModel, learner);
    expect(match.nodes.get("A")?.id).toBe("B");
    expect(match.nodes.get("B")?.id).toBe("A");
    // The learner's member "AC" runs from x = 6 to x = 3: it is the reference's C-B, reversed.
    expect(match.members.get("CB")).toMatchObject({ member: { id: "AC" }, reversed: true });
    expect(match.members.get("AC")).toMatchObject({ member: { id: "CB" }, reversed: true });
  });

  test("the tolerance: a node within it matches, a node beyond it does not", () => {
    const near = copy(beam.referenceModel);
    const far = copy(beam.referenceModel);
    (near.nodes[1] as { z: number }).z = NODE_MATCH_TOLERANCE * 0.5;
    (far.nodes[1] as { z: number }).z = NODE_MATCH_TOLERANCE * 2;
    expect(matchModels(beam.referenceModel, near).nodes.get("C")?.id).toBe("C");
    const match = matchModels(beam.referenceModel, far);
    expect(match.nodes.has("C")).toBe(false);
    expect(match.members.size).toBe(0);
  });

  test("of two nodes at one place the nearer is matched, and of equally near ones the first", () => {
    const learner = copy(beam.referenceModel);
    learner.nodes.unshift(
      { id: "A-near", x: 0, y: 0, z: 2e-7 },
      { id: "A-far", x: 0, y: 0, z: 4e-7 },
    );
    (learner.nodes[2] as { z: number }).z = 2e-7; // the learner's "A", as near as "A-near"
    expect(matchModels(beam.referenceModel, learner).nodes.get("A")?.id).toBe("A-near");
  });

  test("a second member between the same two nodes is not matched", () => {
    const learner = copy(beam.referenceModel);
    const [first] = learner.members;
    if (first === undefined) {
      throw new Error("the beam has members");
    }
    learner.members.push({ ...first, id: "again" });
    const match = matchModels(beam.referenceModel, learner);
    expect(match.members.get("AC")?.member.id).toBe("AC");
    expect(match.otherMemberIdOf.has("again")).toBe(false);
  });

  test("a member that names a node the model lacks is not matched and nothing throws", () => {
    const learner = copy(beam.referenceModel);
    (learner.members[0] as { endNodeId: string }).endNodeId = "nowhere";
    const match = matchModels(beam.referenceModel, learner);
    expect(match.members.has("AC")).toBe(false);
    expect(match.members.get("CB")?.member.id).toBe("CB");
  });
});

describe("matchingEvidence", () => {
  test("lists the reference's nodes and members in its order, and the learner's extras sorted by id", () => {
    let learner = redrawMember(beam.referenceModel, "AC", "m1", true);
    learner.nodes.push({ id: "zz", x: 1, y: 0, z: 1 }, { id: "aa", x: 2, y: 0, z: 1 });
    learner = { ...learner, members: [...learner.members] };
    const [first] = learner.members;
    if (first === undefined) {
      throw new Error("the beam has members");
    }
    learner.members.push(
      { ...first, id: "y", startNodeId: "zz", endNodeId: "aa" },
      { ...first, id: "x", startNodeId: "A", endNodeId: "zz" },
    );
    const evidence = matchingEvidence(beam, learner, matchModels(beam.referenceModel, learner));
    expect(evidence).toEqual({
      nodeTolerance: 1e-6,
      nodes: [
        { referenceNodeId: "A", learnerNodeId: "A" },
        { referenceNodeId: "C", learnerNodeId: "C" },
        { referenceNodeId: "B", learnerNodeId: "B" },
      ],
      members: [
        {
          referenceMemberId: "AC",
          learnerMemberId: "m1",
          reversed: true,
          referenceSectionId: "I 300x150",
          learnerSectionId: "I 300x150",
          differences: [],
        },
        {
          referenceMemberId: "CB",
          learnerMemberId: "CB",
          reversed: false,
          referenceSectionId: "I 300x150",
          learnerSectionId: "I 300x150",
          differences: [],
        },
      ],
      extraNodeIds: ["aa", "zz"],
      extraMemberIds: ["x", "y"],
    });
  });

  test("names what differs in a matched member", () => {
    const learner = copy(portal.referenceModel);
    const [ab, bc, dc] = learner.members;
    if (ab === undefined || bc === undefined || dc === undefined) {
      throw new Error("the portal has three members");
    }
    ab.sectionId = "I 400x180";
    ab.materialId = "other";
    ab.kind = "truss";
    bc.rollAngleDeg = 90;
    bc.releases.start.ry = true;
    dc.rollAngleDeg = 180; // the same section orientation for a doubly symmetric shape
    const evidence = matchingEvidence(portal, learner, matchModels(portal.referenceModel, learner));
    expect(evidence.members.map((member) => member.differences)).toEqual([
      ["sectionId", "materialId", "kind"],
      ["orientation", "releases"],
      [],
    ]);
    expect(evidence.members[0]?.learnerSectionId).toBe("I 400x180");
  });

  test("the releases of a reversed member are compared at the node, not by the member's own ends", () => {
    const released = copy(portal.referenceModel);
    (released.members[0] as { releases: { end: { ry: boolean } } }).releases.end.ry = true; // at B
    const task = { ...portal, referenceModel: released };
    const same = redrawMember(released, "AB", "BA", true);
    const [ba] = same.members;
    if (ba === undefined) {
      throw new Error("the portal has members");
    }
    // Drawn from B to A, the release at B is at the member's start.
    ba.releases = {
      start: { rx: false, ry: true, rz: false },
      end: { rx: false, ry: false, rz: false },
    };
    expect(
      matchingEvidence(task, same, matchModels(released, same)).members[0]?.differences,
    ).toEqual([]);
    ba.releases = {
      start: { rx: false, ry: false, rz: false },
      end: { rx: false, ry: true, rz: false },
    };
    expect(
      matchingEvidence(task, same, matchModels(released, same)).members[0]?.differences,
    ).toEqual(["releases"]);
  });

  test("the section of a member of the section choice is not a difference", () => {
    const task = chooseTheBeamTask();
    const learner = copy(task.referenceModel);
    for (const member of learner.members) {
      member.sectionId = "I 500x200";
    }
    const evidence = matchingEvidence(task, learner, matchModels(task.referenceModel, learner));
    expect(evidence.members.map((member) => member.differences)).toEqual([[], []]);
    expect(evidence.members.map((member) => member.learnerSectionId)).toEqual([
      "I 500x200",
      "I 500x200",
    ]);
  });
});
