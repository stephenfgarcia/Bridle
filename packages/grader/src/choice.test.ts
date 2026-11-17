import { parseModel, serializeModel } from "@bridle/model";
import {
  CHOICE_SECTIONS,
  chooseTheBeamTask,
  evaluateSectionChoices,
  genericSection,
  portalFrameTask,
  simplySupportedBeamTask,
  type Task,
} from "@bridle/tasks";
import { describe, expect, test } from "vitest";
import { matchModels } from "./matching";
import { examineModel } from "./modelState";
import { evaluateRequirements } from "./requirements";
import { chosenSection, sectionChoiceEvidence, sectionOptions } from "./sectionChoice";
import { copy, redrawMember } from "./testSupport";

const choice = chooseTheBeamTask();
const portal = portalFrameTask();

function withSections(first: string, second = first) {
  const model = copy(choice.referenceModel);
  (model.members[0] as { sectionId: string }).sectionId = first;
  (model.members[1] as { sectionId: string }).sectionId = second;
  return model;
}

function requirementsOf(task: Task, model: typeof task.referenceModel) {
  const examined = examineModel(task, parseModel(serializeModel(model)));
  const match = examined.model === null ? null : matchModels(task.referenceModel, examined.model);
  return evaluateRequirements(task, match, examined);
}

function judge(model: typeof choice.referenceModel) {
  const chosen = chosenSection(choice, matchModels(choice.referenceModel, model));
  if (chosen === undefined) {
    throw new Error("the task has a section choice");
  }
  return sectionChoiceEvidence(choice, chosen);
}

describe("evaluateRequirements", () => {
  test("the portal's sway against height/300, in mm", () => {
    const [drift] = requirementsOf(portal, portal.referenceModel);
    expect(drift).toMatchObject({
      requirementId: "drift-limit",
      quantity: "drift",
      referenceNodeId: "B",
      learnerNodeId: "B",
      component: "ux",
      status: "computed",
      unit: "mm",
      satisfied: true,
    });
    expect(drift?.allowable).toBeCloseTo(16.6667, 4); // 5000 mm / 300
    expect(drift?.value).toBeCloseTo(7.783, 3);
    expect(drift?.ratio).toBeCloseTo(0.467, 3);
  });

  test("a requirement that is not met", () => {
    // I 330x160 on the 7 m beam under 25 kN/m: 5wL⁴/(384·E·Iy), against 7000 mm / 360.
    const [deflection] = requirementsOf(choice, withSections("I 330x160"));
    const iy =
      choice.referenceModel.sections.find((section) => section.id === "I 330x160")?.Iy ?? 0;
    const expected = ((5 * 25 * 7 ** 4) / (384 * 2.1e8 * iy)) * 1000;
    expect(deflection?.value).toBeCloseTo(expected, 6);
    expect(deflection?.allowable).toBeCloseTo(7000 / 360, 9);
    expect(deflection?.ratio).toBeCloseTo(expected / (7000 / 360), 8);
    expect(deflection?.satisfied).toBe(false);
  });

  test("why a requirement has no value", () => {
    const unstable = { ...copy(portal.referenceModel), supports: [] };
    expect(requirementsOf(portal, unstable)[0]).toMatchObject({
      learnerNodeId: "B",
      status: "not-solved",
      value: null,
      ratio: null,
      satisfied: null,
    });
    expect(requirementsOf(portal, unstable)[0]?.allowable).toBeCloseTo(16.6667, 4);

    const moved = copy(portal.referenceModel);
    (moved.nodes[1] as { z: number }).z = 4;
    expect(requirementsOf(portal, moved)[0]).toMatchObject({
      learnerNodeId: null,
      status: "node-not-found",
      value: null,
    });

    const examined = examineModel(portal, parseModel("{}"));
    expect(evaluateRequirements(portal, null, examined)[0]?.status).toBe("model-not-read");
    expect(
      requirementsOf(simplySupportedBeamTask(), simplySupportedBeamTask().referenceModel),
    ).toEqual([]);
  });
});

describe("the section choice", () => {
  test("the options are evaluateSectionChoices, with each section's area", () => {
    const expected = evaluateSectionChoices(choice);
    const options = sectionOptions(choice);
    expect(options.map((option) => option.sectionId)).toEqual([...CHOICE_SECTIONS]);
    expect(options.map((option) => option.meetsRequirements)).toEqual(
      expected.map((option) => option.satisfied),
    );
    expect(options.map((option) => option.meetsRequirements)).toEqual([
      false,
      false,
      false,
      true,
      true,
      true,
    ]);
    options.forEach((option, index) => {
      const section = choice.referenceModel.sections[index];
      expect(option.area).toBe(section?.A);
      expect(option.massPerMetre).toBe(expected[index]?.massPerMetre);
      expect(option.requirements).toHaveLength(1);
      expect(option.requirements[0]?.unit).toBe("mm");
      expect(option.requirements[0]?.allowable).toBeCloseTo(7000 / 360, 9);
    });
    // Areas rise along the list, so "lighter" is "earlier in the list" here.
    const areas = options.map((option) => option.area ?? 0);
    expect([...areas].sort((a, b) => a - b)).toEqual(areas);
  });

  test("a section that fails the limit", () => {
    expect(judge(withSections("I 330x160"))).toMatchObject({
      status: "chosen",
      chosenSectionId: "I 330x160",
      allowed: true,
      chosenArea: 0.006288,
      meetsRequirements: false,
      lighterAllowedSectionMeets: false,
      lightestMeetingSectionId: "I 400x180",
      referenceSectionId: "I 400x180",
    });
  });

  test("the lightest that passes", () => {
    expect(judge(withSections("I 400x180"))).toMatchObject({
      status: "chosen",
      chosenSectionId: "I 400x180",
      allowed: true,
      meetsRequirements: true,
      lighterAllowedSectionMeets: false,
      lightestMeetingSectionId: "I 400x180",
    });
  });

  test("a heavier one than needed", () => {
    for (const sectionId of ["I 450x190", "I 500x200"]) {
      expect(judge(withSections(sectionId))).toMatchObject({
        chosenSectionId: sectionId,
        allowed: true,
        meetsRequirements: true,
        lighterAllowedSectionMeets: true,
        lightestMeetingSectionId: "I 400x180",
      });
    }
  });

  test("two different sections are no choice", () => {
    expect(judge(withSections("I 400x180", "I 450x190"))).toMatchObject({
      members: [
        { referenceMemberId: "AC", learnerMemberId: "AC", sectionId: "I 400x180" },
        { referenceMemberId: "CB", learnerMemberId: "CB", sectionId: "I 450x190" },
      ],
      status: "mixed",
      chosenSectionId: null,
      allowed: null,
      chosenArea: null,
      meetsRequirements: null,
      lighterAllowedSectionMeets: null,
      lightestMeetingSectionId: "I 400x180",
    });
  });

  test("a section that is not in the list is not allowed and is not judged further", () => {
    const model = withSections("I 600x220");
    const dimensions = { name: "I 600x220", h: 600, b: 220, tw: 12, tf: 19 };
    model.sections.push(genericSection(dimensions));
    expect(judge(model)).toMatchObject({
      status: "chosen",
      chosenSectionId: "I 600x220",
      allowed: false,
      chosenArea: null,
      meetsRequirements: null,
      lighterAllowedSectionMeets: null,
    });
  });

  test("the members are found between their nodes, whatever their ids; a missing one is reported", () => {
    let model = redrawMember(withSections("I 450x190"), "AC", "left", true);
    expect(judge(model)).toMatchObject({
      members: [
        { referenceMemberId: "AC", learnerMemberId: "left", sectionId: "I 450x190" },
        { referenceMemberId: "CB", learnerMemberId: "CB", sectionId: "I 450x190" },
      ],
      status: "chosen",
      chosenSectionId: "I 450x190",
    });
    model = { ...model, members: model.members.slice(1) };
    expect(judge(model)).toMatchObject({
      members: [
        { referenceMemberId: "AC", learnerMemberId: null, sectionId: null },
        { referenceMemberId: "CB", learnerMemberId: "CB", sectionId: "I 450x190" },
      ],
      status: "member-missing",
      chosenSectionId: null,
      allowed: null,
    });
  });

  test("a task without a choice has none; a model that does not parse is said so", () => {
    expect(
      chosenSection(portal, matchModels(portal.referenceModel, portal.referenceModel)),
    ).toBeUndefined();
    expect(chosenSection(choice, null)).toEqual({
      members: [
        { referenceMemberId: "AC", learnerMemberId: null, sectionId: null },
        { referenceMemberId: "CB", learnerMemberId: null, sectionId: null },
      ],
      status: "model-not-read",
      chosenSectionId: null,
    });
  });
});
