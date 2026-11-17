import { type Model, parseModel, serializeModel } from "@bridle/model";
import { solve } from "@bridle/solver";
import { portalFrameTask, seededTasks, simplySupportedBeamTask } from "@bridle/tasks";
import { describe, expect, test } from "vitest";
import { examineModel } from "./modelState";
import { copy, renameNodes, supportOn } from "./testSupport";

const beam = simplySupportedBeamTask();
const portal = portalFrameTask();

const examine = (task: typeof beam, model: Model) =>
  examineModel(task, parseModel(serializeModel(model)));

describe("examineModel", () => {
  test("the reference model of each task parses, is valid and solves", () => {
    for (const task of seededTasks()) {
      const examined = examine(task, task.referenceModel);
      expect(examined.evidence).toEqual({
        parses: true,
        parseIssues: [],
        valid: true,
        issues: [],
        solve: "solved",
        unstable: null,
        unsupported: [],
        hasLoadCase: true,
      });
      expect(examined.resultsStatus).toBe("computed");
      expect(examined.results?.loadCaseId).toBe("LC1");
    }
  });

  test("a model that does not parse: the issues of parseModel, and nothing is solved", () => {
    const examined = examineModel(
      beam,
      parseModel('{"version":1,"units":{"force":"kN","length":"m"}}'),
    );
    expect(examined.evidence.parses).toBe(false);
    expect(examined.evidence.parseIssues[0]).toEqual({
      code: "invalid-shape",
      ids: [],
      path: "nodes",
    });
    expect(examined.evidence.parseIssues).toHaveLength(9);
    expect(examined.evidence).toMatchObject({
      valid: false,
      issues: [],
      solve: "not-run",
      hasLoadCase: false,
    });
    expect(examined.model).toBeNull();
    expect(examined.resultsStatus).toBe("model-not-read");
    expect(examineModel(beam, parseModel("not json")).evidence.parseIssues).toEqual([
      { code: "invalid-json", ids: [], path: null },
    ]);
  });

  test("the starting model of task (a) has no support: not valid, and solve refuses it as invalid", () => {
    const examined = examine(beam, beam.startingModel);
    expect(examined.evidence).toMatchObject({
      parses: true,
      valid: false,
      issues: [{ code: "no-support", ids: [], path: null }],
      solve: "invalid-model",
      unstable: null,
    });
    expect(examined.resultsStatus).toBe("not-solved");
  });

  test("the issues of validateModel keep their ids and paths", () => {
    const model = copy(beam.referenceModel);
    (model.members[0] as { sectionId: string }).sectionId = "none";
    expect(examine(beam, model).evidence.issues).toEqual([
      { code: "missing-section", ids: ["AC", "none"], path: "members[0].sectionId" },
    ]);
  });

  test("an unstable model: the node and the degree of freedom the solver names", () => {
    const model = copy(beam.referenceModel);
    model.supports = [supportOn("A", ["ux", "uy", "uz"]), supportOn("B", ["uy", "uz"])];
    const solved = solve(model);
    if (solved.ok || solved.reason !== "unstable") {
      throw new Error("the beam without a twist restraint is unstable");
    }
    // Nothing holds the beam against spinning about its own axis.
    expect(solved.dof).toBe("rx");
    expect(examine(beam, model).evidence).toMatchObject({
      valid: true,
      solve: "unstable",
      unstable: {
        nodeId: solved.nodeId,
        dof: "rx",
        remaining: solved.remaining,
        referenceNodeId: solved.nodeId,
      },
    });
  });

  test("the unstable node is also named by the reference node at its position", () => {
    const model = renameNodes(portal.referenceModel);
    model.supports = [supportOn("n1", ["ux", "uy", "uz"]), supportOn("n4", ["ux", "uy", "uz"])];
    const { unstable } = examine(portal, model).evidence;
    expect(unstable?.nodeId).toMatch(/^n[1-4]$/);
    const index = Number(unstable?.nodeId.slice(1)) - 1;
    expect(unstable?.referenceNodeId).toBe(portal.referenceModel.nodes[index]?.id);
  });

  test("a truss member or an end release is refused as not supported", () => {
    const model = copy(portal.referenceModel);
    (model.members[0] as { kind: string }).kind = "truss";
    (model.members[1] as { releases: { start: { ry: boolean } } }).releases.start.ry = true;
    expect(examine(portal, model).evidence).toMatchObject({
      valid: true,
      solve: "not-supported",
      unsupported: [
        { memberId: "AB", feature: "truss-member" },
        { memberId: "BC", feature: "end-release" },
      ],
    });
  });

  test("a model without the task's load case solves and has no results for it", () => {
    const model = copy(beam.referenceModel);
    model.loadCases = [{ id: "LC9", name: "Other" }];
    for (const load of model.memberUniformLoads) {
      load.loadCaseId = "LC9";
    }
    const examined = examine(beam, model);
    expect(examined.evidence).toMatchObject({ solve: "solved", hasLoadCase: false });
    expect(examined.results).toBeNull();
    expect(examined.resultsStatus).toBe("no-load-case");
  });
});
