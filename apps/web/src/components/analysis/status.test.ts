// Unit tests of ./status.ts (card PX-02.8): from a state of the live analysis, with the answers of the real
// solver, to the status shown; the wording for each degree of freedom; the members a refusal names.
import { createTranslator } from "@bridle/i18n";
import { type Model, planarTruss, portalFrame, simplySupportedBeam } from "@bridle/model";
import { DOFS, type SolveResult, solve } from "@bridle/solver";
import { describe, expect, it } from "vitest";
import { removeSupport, setSupport } from "../model/commands";
import { restrainOutOfPlane } from "../tools/supportLoadTools";
import { type AnalysisState, INITIAL_ANALYSIS, reduceAnalysis } from "./analysisState";
import {
  analysisStatus,
  FAILURE_MESSAGE,
  failureDetail,
  MEMBER_LIST_LIMIT,
  memberList,
  PIVOT_WARNING,
  STATUS_TITLE,
  UNSTABLE_WHERE,
  UNSUPPORTED_MESSAGE,
  unsupportedGroups,
} from "./status";

const t = createTranslator("en");

function answered(model: Model, result: SolveResult, ms = 5): AnalysisState {
  return [
    { type: "requested", model } as const,
    { type: "solved", model, result, ms } as const,
  ].reduce(reduceAnalysis, INITIAL_ANALYSIS);
}

/** The portal frame with both bases pinned: free to turn about the line through its bases. */
function pinnedPortal(): Model {
  const pinned = { ux: true, uy: true, uz: true, rx: false, ry: false, rz: false };
  return setSupport(setSupport(portalFrame(), { nodeId: "n1", ...pinned }), {
    nodeId: "n4",
    ...pinned,
  });
}

describe("analysisStatus", () => {
  it("analysed: the portal frame, with the time and no warning", () => {
    const model = portalFrame();
    const status = analysisStatus(answered(model, solve(model), 12.5), model);
    expect(status.kind).toBe("analysed");
    if (status.kind === "analysed") {
      expect(status.ms).toBe(12.5);
      expect(status.lostAccuracy).toBe(false);
      expect(status.smallestPivotRatio).toBeGreaterThan(PIVOT_WARNING);
    }
  });

  it("analysed: the simply supported beam", () => {
    const model = simplySupportedBeam();
    expect(analysisStatus(answered(model, solve(model)), model).kind).toBe("analysed");
  });

  it("warns when the smallest pivot ratio is below 1e-9, and not at 1e-9", () => {
    expect(PIVOT_WARNING).toBe(1e-9);
    const model = portalFrame();
    const result = solve(model);
    if (!result.ok) {
      throw new Error("the portal frame did not solve");
    }
    const low = analysisStatus(answered(model, { ...result, smallestPivotRatio: 9.9e-10 }), model);
    expect(low).toMatchObject({
      kind: "analysed",
      lostAccuracy: true,
      smallestPivotRatio: 9.9e-10,
    });
    const at = analysisStatus(answered(model, { ...result, smallestPivotRatio: 1e-9 }), model);
    expect(at).toMatchObject({ kind: "analysed", lostAccuracy: false });
  });

  it("warns for a model the solver accepts close to its threshold", () => {
    // The 10 m by 10 m portal frame with its area multiplied by 1e9 (packages/solver/README.md).
    const model = portalFrame();
    for (const node of model.nodes) {
      node.x = node.x === 0 ? 0 : 10;
      node.z = node.z === 0 ? 0 : 10;
    }
    for (const section of model.sections) {
      section.A *= 1e9;
    }
    const result = solve(model);
    expect(result.ok).toBe(true);
    const status = analysisStatus(answered(model, result), model);
    expect(status).toMatchObject({ kind: "analysed", lostAccuracy: true });
  });

  it("analysing: nothing answered yet, a pending model, and a state about another model", () => {
    const model = portalFrame();
    expect(analysisStatus(INITIAL_ANALYSIS, model)).toEqual({ kind: "analysing", stale: false });
    const pending = reduceAnalysis(INITIAL_ANALYSIS, { type: "requested", model });
    expect(analysisStatus(pending, model)).toEqual({ kind: "analysing", stale: false });
    // An earlier model was analysed and the next one is pending: its results are still shown, as stale.
    const next = portalFrame();
    const done = answered(model, solve(model));
    expect(analysisStatus(reduceAnalysis(done, { type: "requested", model: next }), next)).toEqual({
      kind: "analysing",
      stale: true,
    });
    // The state has not heard of the model on screen: never "Analysed" for another model object.
    expect(analysisStatus(done, next)).toEqual({ kind: "analysing", stale: true });
    // The same holds for an unstable answer of the other model, with nothing stale to show.
    const unstable = pinnedPortal();
    expect(analysisStatus(answered(unstable, solve(unstable)), next)).toEqual({
      kind: "analysing",
      stale: false,
    });
  });

  it("issues: a model that was not sent, with the number of its issues", () => {
    const model = removeSupport(removeSupport(portalFrame(), { nodeId: "n1" }), { nodeId: "n4" });
    const blocked = reduceAnalysis(INITIAL_ANALYSIS, { type: "blocked", model, issueCount: 3 });
    expect(analysisStatus(blocked, model)).toEqual({ kind: "issues", count: 3 });
  });

  it("issues: the solver's own refusal of an invalid model", () => {
    const model = removeSupport(removeSupport(portalFrame(), { nodeId: "n1" }), { nodeId: "n4" });
    const result = solve(model);
    expect(result).toMatchObject({ ok: false, reason: "invalid-model" });
    const status = analysisStatus(answered(model, result), model);
    expect(status.kind).toBe("issues");
    if (status.kind === "issues" && !result.ok && result.reason === "invalid-model") {
      expect(status.count).toBe(result.issues.length);
      expect(status.count).toBeGreaterThan(0);
    }
  });

  it("unstable: the node and the degree of freedom the solver names, and the out-of-plane offer", () => {
    const model = pinnedPortal();
    const result = solve(model);
    if (result.ok || result.reason !== "unstable") {
      throw new Error("the portal frame on two pinned bases is not reported as unstable");
    }
    const status = analysisStatus(answered(model, result), model);
    expect(status).toEqual({
      kind: "unstable",
      nodeId: result.nodeId,
      dof: result.dof,
      canRestrain: true,
    });
    // After "Restrain out of plane" the same frame is analysed.
    const restrained = restrainOutOfPlane(model).model;
    expect(analysisStatus(answered(restrained, solve(restrained)), restrained).kind).toBe(
      "analysed",
    );
  });

  it("unstable without the offer: every node already has uy, rx and rz", () => {
    // One base pinned in the plane and nothing else that holds the frame's rotation about Y there.
    const base = removeSupport(portalFrame(), { nodeId: "n4" });
    const model = restrainOutOfPlane(
      setSupport(base, {
        nodeId: "n1",
        ux: true,
        uy: true,
        uz: true,
        rx: true,
        ry: false,
        rz: true,
      }),
    ).model;
    const result = solve(model);
    expect(result).toMatchObject({ ok: false, reason: "unstable" });
    expect(analysisStatus(answered(model, result), model)).toMatchObject({
      kind: "unstable",
      canRestrain: false,
    });
  });

  it("unstable without the offer: the nodes are not in one X-Z plane", () => {
    const model = pinnedPortal();
    const node = model.nodes[1];
    if (node) {
      node.y = 1;
    }
    const result = solve(model);
    expect(result).toMatchObject({ ok: false, reason: "unstable" });
    expect(analysisStatus(answered(model, result), model)).toMatchObject({
      kind: "unstable",
      canRestrain: false,
    });
  });

  it("unsupported: the truss fixture names its seven truss members", () => {
    const model = planarTruss();
    const status = analysisStatus(answered(model, solve(model)), model);
    expect(status).toEqual({
      kind: "unsupported",
      groups: [{ feature: "truss-member", memberIds: ["t1", "t2", "t3", "t4", "t5", "t6", "t7"] }],
    });
  });

  it("unsupported: a member with an end release", () => {
    const model = portalFrame();
    const beam = model.members.find((member) => member.id === "b1");
    if (beam) {
      beam.releases.start.ry = true;
    }
    const status = analysisStatus(answered(model, solve(model)), model);
    expect(status).toEqual({
      kind: "unsupported",
      groups: [{ feature: "end-release", memberIds: ["b1"] }],
    });
  });

  it("overflow: the solver's refusal for numbers that are not finite", () => {
    const model = portalFrame();
    expect(
      analysisStatus(
        answered(model, { ok: false, reason: "non-finite", where: "stiffness" }),
        model,
      ),
    ).toEqual({ kind: "overflow", loadCaseId: null });
    expect(
      analysisStatus(
        answered(model, {
          ok: false,
          reason: "non-finite",
          where: "load-case",
          loadCaseId: "lc1",
        }),
        model,
      ),
    ).toEqual({ kind: "overflow", loadCaseId: "lc1" });
  });

  it("failed: the failure of the call", () => {
    const model = portalFrame();
    const failure = { kind: "worker-error", message: "The worker stopped" } as const;
    const failed = [
      { type: "requested", model } as const,
      { type: "failed", model, failure } as const,
    ].reduce(reduceAnalysis, INITIAL_ANALYSIS);
    expect(analysisStatus(failed, model)).toEqual({ kind: "failed", failure });
  });
});

describe("the wording", () => {
  it("has a title for every status", () => {
    expect(t(STATUS_TITLE.analysed)).toBe("Analysed");
    expect(t(STATUS_TITLE.analysing)).toBe("Analysing…");
    expect(t(STATUS_TITLE.issues)).toBe("Fix the issues first");
    expect(t(STATUS_TITLE.unstable)).toBe("Unstable");
    expect(t(STATUS_TITLE.unsupported)).toBe("Not supported yet");
    expect(t(STATUS_TITLE.failed)).toBe("Analysis failed");
    expect(t(STATUS_TITLE.overflow)).toBe("Not analysed");
  });

  it("says in words where the analysis stopped, for each degree of freedom", () => {
    const motion = {
      ux: "free to move along X at node n3",
      uy: "free to move along Y at node n3",
      uz: "free to move along Z at node n3",
      rx: "free to rotate about X at node n3",
      ry: "free to rotate about Y at node n3",
      rz: "free to rotate about Z at node n3",
    };
    expect(Object.keys(UNSTABLE_WHERE).sort()).toEqual([...DOFS].sort());
    for (const dof of DOFS) {
      const text = t(UNSTABLE_WHERE[dof], { node: "n3" });
      expect(text).toContain(motion[dof]);
      expect(text).toContain("The structure is unstable.");
      expect(text).toContain("The analysis stopped where");
      // The sentence names where the check stopped; it does not call the node the cause.
      expect(text).not.toMatch(/cause|because/i);
    }
  });

  it("counts the issues in the singular and the plural", () => {
    expect(t("workspace.analysis.issuesCount", { count: 1 })).toContain("has 1 issue and");
    expect(t("workspace.analysis.issuesCount", { count: 3 })).toContain("has 3 issues and");
  });

  it("names the members of a refusal, and says how many more there are", () => {
    expect(unsupportedGroups([])).toEqual([]);
    expect(
      unsupportedGroups([
        { memberId: "m2", feature: "end-release" },
        { memberId: "t1", feature: "truss-member" },
        { memberId: "m2", feature: "end-release" },
        { memberId: "m5", feature: "end-release" },
      ]),
    ).toEqual([
      { feature: "truss-member", memberIds: ["t1"] },
      { feature: "end-release", memberIds: ["m2", "m5"] },
    ]);
    expect(memberList(["t1", "t2"])).toEqual({ members: "t1, t2", more: 0 });
    expect(t(UNSUPPORTED_MESSAGE["truss-member"], memberList(["t1", "t2"]))).toBe(
      "Truss members are not analysed yet: t1, t2.",
    );
    expect(t(UNSUPPORTED_MESSAGE["end-release"], memberList(["b1"]))).toBe(
      "Members with end releases are not analysed yet: b1.",
    );
    const many = Array.from({ length: MEMBER_LIST_LIMIT + 3 }, (_, index) => `t${index + 1}`);
    expect(memberList(many)).toEqual({ members: "t1, t2, t3, t4, t5, t6, t7, t8", more: 3 });
    expect(t(UNSUPPORTED_MESSAGE["truss-member"], memberList(many))).toBe(
      "Truss members are not analysed yet: t1, t2, t3, t4, t5, t6, t7, t8 and 3 more.",
    );
  });

  it("has a sentence and the technical text for every kind of failure", () => {
    expect(t(FAILURE_MESSAGE["worker-error"])).toContain("worker");
    expect(t(FAILURE_MESSAGE["solve-threw"])).toContain("solver");
    expect(t(FAILURE_MESSAGE["not-sent"])).toContain("could not be sent");
    expect(failureDetail({ kind: "worker-error", message: "no worker" })).toBe("no worker");
    expect(failureDetail({ kind: "not-sent", message: "could not be cloned" })).toBe(
      "could not be cloned",
    );
    expect(
      failureDetail({
        kind: "solve-threw",
        error: { name: "TypeError", message: "x is undefined" },
      }),
    ).toBe("x is undefined");
  });
});
