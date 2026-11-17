import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type Model, validateModel } from "@bridle/model";
import { solve } from "@bridle/solver";
import { describe, expect, test } from "vitest";
import {
  type AnswersResult,
  allowableValue,
  BEAM_LOAD,
  BEAM_SECTION,
  BEAM_SPAN,
  CHOICE_DEFLECTION_DIVISOR,
  CHOICE_LOAD,
  CHOICE_REFERENCE_SECTION,
  CHOICE_SECTIONS,
  CHOICE_SPAN,
  CHOICE_STARTING_SECTION,
  chooseTheBeamTask,
  computeAnswers,
  DISPLAY_PER_MODEL_UNIT,
  evaluateSectionChoices,
  GENERIC_I_SECTION_DIMENSIONS,
  genericSection,
  genericSections,
  LOAD_CASE_ID,
  massPerMetre,
  PORTAL_BEAM_LOAD,
  PORTAL_BEAM_SECTION,
  PORTAL_COLUMN_SECTION,
  PORTAL_DRIFT_DIVISOR,
  PORTAL_HEIGHT,
  PORTAL_WIDTH,
  PORTAL_WIND_LOAD,
  portalFrameTask,
  RUBRIC_LEVELS,
  referenceAnswers,
  renderTasksDocument,
  seededTasks,
  simplySupportedBeamTask,
  TASK_ISSUE_CODES,
  TASKS_DOCUMENT_PATH,
  type Task,
  type TaskIssueCode,
  UNIT_OF_KIND,
  validateTask,
} from "./index";

/** Modulus of elasticity of the tasks' steel in kN/m², written here independently of the package. */
const E = 2.1e8;

function section(name: string) {
  const found = genericSections().find((item) => item.name === name);
  if (found === undefined) {
    throw new Error(`no generic section ${name}`);
  }
  return found;
}

/** The computed answers of a result as a record of values in model units; fails on anything else. */
function values(result: AnswersResult): Record<string, number> {
  if (!result.ok) {
    throw new Error(`not solved: ${result.reason}`);
  }
  const record: Record<string, number> = {};
  for (const answer of result.answers) {
    if (answer.status === "computed") {
      record[answer.answerId] = answer.value;
    }
  }
  return record;
}

function value(record: Record<string, number>, id: string): number {
  const found = record[id];
  if (found === undefined) {
    throw new Error(`no computed answer ${id}`);
  }
  return found;
}

/** |a − b| ≤ relative × |b|. */
function expectRelative(actual: number, expected: number, relative: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(relative * Math.abs(expected));
}

function codes(task: Task): TaskIssueCode[] {
  return validateTask(task).map((found) => found.code);
}

describe("generic I-sections", () => {
  test("the properties follow the formulas, checked by the parallel-axis theorem", () => {
    for (const dimensions of GENERIC_I_SECTION_DIMENSIONS) {
      const h = dimensions.h / 1000;
      const b = dimensions.b / 1000;
      const tw = dimensions.tw / 1000;
      const tf = dimensions.tf / 1000;
      const web = h - 2 * tf;
      const lever = h / 2 - tf / 2;
      const computed = genericSection(dimensions);
      expectRelative(computed.A, 2 * b * tf + web * tw, 1e-12);
      // Two flanges about the centroid (own inertia plus area times lever squared) and the web.
      const Iy = 2 * ((b * tf ** 3) / 12 + b * tf * lever ** 2) + (tw * web ** 3) / 12;
      expectRelative(computed.Iy, Iy, 1e-12);
      expectRelative(computed.Iz, (2 * tf * b ** 3) / 12 + (web * tw ** 3) / 12, 1e-12);
      expectRelative(computed.J, (2 * b * tf ** 3 + (h - tf) * tw ** 3) / 3, 1e-12);
      expect(computed.depthZ).toBe(h);
      expect(computed.depthY).toBe(b);
      expect(computed.name).toBe(`I ${dimensions.h}x${dimensions.b}`);
      expect(computed.id).toBe(computed.name);
    }
  });

  test("I 300x150 by hand: A = 5246 mm², Iy = 81.47e6 mm⁴, Iz = 6.20e6 mm⁴, J = 166.1e3 mm⁴", () => {
    const s = section("I 300x150");
    // A = 2·150·11 + 278·7 = 3300 + 1946
    expect(s.A * 1e6).toBeCloseTo(5246, 6);
    // Iy = (150·300³ − 143·278³)/12 = (4 050 000 000 − 3 072 348 136)/12
    expect(s.Iy * 1e12).toBeCloseTo((4050000000 - 143 * 21484952) / 12, 0);
    expectRelative(s.Iy, 8.147e-5, 1e-4);
    // Iz = (2·11·150³ + 278·7³)/12 = (74 250 000 + 95 354)/12
    expect(s.Iz * 1e12).toBeCloseTo((74250000 + 95354) / 12, 0);
    // J = (2·150·11³ + 289·7³)/3 = (399 300 + 99 127)/3
    expect(s.J * 1e12).toBeCloseTo((399300 + 99127) / 3, 0);
  });

  test("the list is ordered from the lightest to the heaviest and every name is unique", () => {
    const masses = genericSections().map(massPerMetre);
    for (let index = 1; index < masses.length; index++) {
      expect(masses[index]).toBeGreaterThan(masses[index - 1] ?? Number.POSITIVE_INFINITY);
    }
    const names = GENERIC_I_SECTION_DIMENSIONS.map((dimensions) => dimensions.name);
    expect(new Set(names).size).toBe(names.length);
    // 5246 mm² × 7850 kg/m³
    expect(massPerMetre(section("I 300x150"))).toBeCloseTo(41.1811, 4);
  });
});

describe("the three seeded tasks", () => {
  test("there are three, with the titles and levels of the card", () => {
    expect(seededTasks().map((task) => [task.id, task.title, task.level])).toEqual([
      ["simply-supported-beam", "Simply supported beam", "introductory"],
      ["portal-frame-wind-gravity", "Portal frame under wind and gravity", "intermediate"],
      ["choose-the-beam", "Choose the beam", "intermediate"],
    ]);
  });

  test("each is valid by validateTask", () => {
    for (const task of seededTasks()) {
      expect(validateTask(task)).toEqual([]);
    }
  });

  test("each has three to five criteria of four levels whose weights sum to 1", () => {
    for (const task of seededTasks()) {
      const criteria = task.rubric.criteria;
      expect(criteria.length).toBeGreaterThanOrEqual(3);
      expect(criteria.length).toBeLessThanOrEqual(5);
      expect(criteria.reduce((sum, criterion) => sum + criterion.weight, 0)).toBeCloseTo(1, 12);
      for (const criterion of criteria) {
        expect(criterion.levels.map((entry) => entry.level)).toEqual([...RUBRIC_LEVELS]);
      }
    }
  });

  test("each is plain data and each call returns new objects", () => {
    for (const [index, task] of seededTasks().entries()) {
      expect(JSON.parse(JSON.stringify(task))).toEqual(task);
      expect(structuredClone(task)).toEqual(task);
      const again = seededTasks()[index];
      expect(again).toEqual(task);
      expect(again).not.toBe(task);
      expect(again?.referenceModel).not.toBe(task.referenceModel);
      expect(again?.referenceModel.nodes).not.toBe(task.referenceModel.nodes);
    }
  });

  test("the reference models are valid models; the starting models lack at most a support", () => {
    const [beam, portal, choice] = seededTasks();
    for (const task of seededTasks()) {
      expect(validateModel(task.referenceModel)).toEqual([]);
    }
    expect(validateModel(beam?.startingModel as Model).map((found) => found.code)).toEqual([
      "no-support",
    ]);
    expect(validateModel(portal?.startingModel as Model).map((found) => found.code)).toEqual([
      "no-support",
    ]);
    expect(validateModel(choice?.startingModel as Model)).toEqual([]);
  });

  test("the tolerances: 1 percent for forces and moments, 2 percent for displacements and their ratios", () => {
    for (const task of seededTasks()) {
      for (const answer of task.answers) {
        const relative = answer.kind === "displacement" || answer.kind === "ratio" ? 0.02 : 0.01;
        expect(answer.tolerance.relative).toBe(relative);
        expect(answer.tolerance.absolute).toBeGreaterThan(0);
        expect(answer.unit).toBe(UNIT_OF_KIND[answer.kind]);
      }
    }
  });

  test("the models hold the numbers the briefs state", () => {
    const beam = simplySupportedBeamTask();
    expect(beam.brief.join(" ")).toContain(`spans ${BEAM_SPAN} m`);
    expect(beam.brief.join(" ")).toContain(`${BEAM_LOAD} kN/m`);
    expect(beam.referenceModel.nodes.map((node) => node.x)).toEqual([0, BEAM_SPAN / 2, BEAM_SPAN]);
    expect(beam.referenceModel.memberUniformLoads.map((load) => load.value)).toEqual([
      -BEAM_LOAD,
      -BEAM_LOAD,
    ]);
    expect([BEAM_SPAN, BEAM_LOAD, BEAM_SECTION]).toEqual([6, 15, "I 300x150"]);

    const portal = portalFrameTask();
    expect(portal.brief.join(" ")).toContain(`${PORTAL_WIDTH} m wide and ${PORTAL_HEIGHT} m high`);
    expect(portal.brief.join(" ")).toContain(`${PORTAL_BEAM_LOAD} kN/m`);
    expect(portal.brief.join(" ")).toContain(`force of ${PORTAL_WIND_LOAD} kN`);
    expect(portal.referenceModel.nodalLoads.map((load) => [load.nodeId, load.fx])).toEqual([
      ["B", PORTAL_WIND_LOAD],
    ]);
    expect(portal.referenceModel.memberUniformLoads.map((load) => load.value)).toEqual([
      -PORTAL_BEAM_LOAD,
    ]);
    expect([PORTAL_WIDTH, PORTAL_HEIGHT, PORTAL_BEAM_LOAD, PORTAL_WIND_LOAD]).toEqual([
      8, 5, 30, 20,
    ]);
    expect(portal.referenceModel.members.map((member) => member.sectionId)).toEqual([
      PORTAL_COLUMN_SECTION,
      PORTAL_BEAM_SECTION,
      PORTAL_COLUMN_SECTION,
    ]);

    const choice = chooseTheBeamTask();
    expect(choice.brief.join(" ")).toContain(`spans ${CHOICE_SPAN} m`);
    expect(choice.brief.join(" ")).toContain(`${CHOICE_LOAD} kN/m`);
    expect([CHOICE_SPAN, CHOICE_LOAD, CHOICE_DEFLECTION_DIVISOR]).toEqual([7, 25, 360]);
    expect(choice.startingModel.members.map((member) => member.sectionId)).toEqual([
      CHOICE_STARTING_SECTION,
      CHOICE_STARTING_SECTION,
    ]);
  });
});

describe("validateTask: one failing task per issue", () => {
  /** Each entry changes a valid task so that exactly the named code is reported. */
  const cases: Record<TaskIssueCode, (task: Task) => void> = {
    "empty-text": (task) => {
      task.title = "  ";
    },
    "duplicate-id": (task) => {
      const first = task.answers[0];
      if (first) {
        task.answers.push({ ...first });
      }
    },
    "missing-fixed-part": (task) => {
      task.fixed.push({ list: "nodes", id: "Z" });
    },
    "missing-section-choice-part": (task) => {
      task.sectionChoice?.sectionIds.push("I 999x999");
    },
    "invalid-starting-model": (task) => {
      const first = task.startingModel.nodes[0];
      if (first) {
        task.startingModel.nodes.push({ ...first });
      }
    },
    "invalid-reference-model": (task) => {
      task.referenceModel.supports = [];
    },
    "missing-reference-part": (task) => {
      const first = task.answers[0];
      if (first) {
        first.source = { kind: "displacement", nodeId: "Z", component: "uz" };
      }
    },
    "missing-requirement": (task) => {
      const first = task.answers[0];
      if (first) {
        first.source = { kind: "limit-ratio", requirementId: "no-such-requirement" };
      }
    },
    "unit-kind-mismatch": (task) => {
      const first = task.answers[0];
      if (first) {
        first.kind = "moment";
        first.unit = "mm";
      }
    },
    "non-positive-tolerance": (task) => {
      const first = task.answers[0];
      if (first) {
        first.tolerance = { relative: 0, absolute: 0.05 };
      }
    },
    "non-positive-limit": (task) => {
      const first = task.requirements?.[0];
      if (first) {
        first.limit.divisor = 0;
      }
    },
    "rubric-criteria-count": (task) => {
      // Two criteria whose weights still sum to 1.
      const [first, second] = task.rubric.criteria;
      if (first && second) {
        first.weight = 0.5;
        second.weight = 0.5;
        task.rubric.criteria = [first, second];
      }
    },
    "non-positive-weight": (task) => {
      // One weight is zero and the others still sum to 1.
      const [first, second] = task.rubric.criteria;
      if (first && second) {
        second.weight += first.weight;
        first.weight = 0;
      }
    },
    "rubric-weight-sum": (task) => {
      const first = task.rubric.criteria[0];
      if (first) {
        first.weight += 0.1;
      }
    },
    "invalid-rubric-levels": (task) => {
      task.rubric.criteria[0]?.levels.reverse();
    },
  };

  test("the cases cover every code", () => {
    expect(Object.keys(cases).sort()).toEqual([...TASK_ISSUE_CODES].sort());
  });

  for (const code of TASK_ISSUE_CODES) {
    test(code, () => {
      // "Choose the beam" has every optional part: requirements, a section choice, a justification.
      const task = chooseTheBeamTask();
      cases[code](task);
      const found = validateTask(task);
      expect(found.map((item) => item.code)).toEqual([code]);
      expect(found[0]?.messageKey).toBe(`task.issue.${code}`);
    });
  }

  test("the ids and the path say where the issue is", () => {
    const task = chooseTheBeamTask();
    const second = task.answers[1];
    if (second) {
      second.tolerance = { relative: 0.02, absolute: -1 };
    }
    task.fixed.push({ list: "members", id: "XY" });
    expect(validateTask(task)).toEqual([
      {
        code: "missing-fixed-part",
        messageKey: "task.issue.missing-fixed-part",
        ids: ["members", "XY"],
        path: `fixed[${task.fixed.length - 1}].id`,
      },
      {
        code: "non-positive-tolerance",
        messageKey: "task.issue.non-positive-tolerance",
        ids: ["midspan-deflection"],
        path: "answers[1].tolerance.absolute",
      },
    ]);
  });

  test("a tolerance that is NaN, a weight that is NaN and a limit that is Infinity are reported", () => {
    const task = chooseTheBeamTask();
    const answer = task.answers[0];
    const criterion = task.rubric.criteria[0];
    const requirement = task.requirements?.[0];
    if (answer && criterion && requirement) {
      answer.tolerance = { relative: Number.NaN, absolute: 0.05 };
      criterion.weight = Number.NaN;
      requirement.limit.length = Number.POSITIVE_INFINITY;
    }
    expect(codes(task)).toEqual([
      "non-positive-tolerance",
      "non-positive-limit",
      "non-positive-weight",
      "rubric-weight-sum",
    ]);
  });

  test("duplicate ids are reported among requirements, criteria and fixed parts too", () => {
    const task = chooseTheBeamTask();
    const requirement = task.requirements?.[0];
    const fixedPart = task.fixed[0];
    if (requirement && fixedPart) {
      task.requirements?.push(structuredClone(requirement));
      task.fixed.push({ ...fixedPart });
    }
    expect(validateTask(task).map((found) => [found.code, found.path])).toEqual([
      ["duplicate-id", `fixed[${task.fixed.length - 1}].id`],
      ["duplicate-id", "requirements[1].id"],
    ]);
    const other = chooseTheBeamTask();
    const [first, second] = other.rubric.criteria;
    if (first && second) {
      second.id = first.id;
    }
    expect(validateTask(other).map((found) => [found.code, found.path])).toEqual([
      ["duplicate-id", "rubric.criteria[1].id"],
    ]);
  });

  test("a starting model with no support is accepted; a reference model with none is not", () => {
    const task = portalFrameTask();
    expect(task.startingModel.supports).toEqual([]);
    expect(validateTask(task)).toEqual([]);
    task.referenceModel.supports = [];
    // The six reaction answers lose their supported node too; the model issue comes last.
    const found = validateTask(task);
    expect(found.map((item) => item.code)).toEqual([
      ...Array(6).fill("missing-reference-part"),
      "invalid-reference-model",
    ]);
    expect(found[6]).toEqual({
      code: "invalid-reference-model",
      messageKey: "task.issue.invalid-reference-model",
      ids: ["no-support"],
      path: "referenceModel",
    });
  });

  test("an issue of the starting model carries the model issue's code, ids and path", () => {
    const task = simplySupportedBeamTask();
    const first = task.startingModel.sections[0];
    if (first) {
      first.Iy = 0;
    }
    expect(validateTask(task)).toEqual([
      {
        code: "invalid-starting-model",
        messageKey: "task.issue.invalid-starting-model",
        ids: ["non-positive-value", "I 300x150"],
        path: "startingModel.sections[0].Iy",
      },
    ]);
  });

  test("levels: three in order are accepted; two, a repeat or a wrong first level are not", () => {
    const three = chooseTheBeamTask();
    three.rubric.criteria[0]?.levels.splice(1, 1);
    expect(three.rubric.criteria[0]?.levels.map((entry) => entry.level)).toEqual([
      "not-shown",
      "proficient",
      "exemplary",
    ]);
    expect(validateTask(three)).toEqual([]);

    const two = chooseTheBeamTask();
    two.rubric.criteria[0]?.levels.splice(1, 2);
    expect(codes(two)).toEqual(["invalid-rubric-levels"]);

    const repeat = chooseTheBeamTask();
    const levels = repeat.rubric.criteria[0]?.levels;
    if (levels?.[1] && levels[2]) {
      levels[2].level = levels[1].level;
    }
    expect(codes(repeat)).toEqual(["invalid-rubric-levels"]);

    const wrongFirst = chooseTheBeamTask();
    wrongFirst.rubric.criteria[0]?.levels.shift();
    expect(codes(wrongFirst)).toEqual(["invalid-rubric-levels"]);
  });

  test("it does not change the task", () => {
    const task = chooseTheBeamTask();
    const copy = structuredClone(task);
    validateTask(task);
    expect(task).toEqual(copy);
  });
});

describe("reference answers, task (a): simply supported beam", () => {
  const w = 15;
  const L = 6;
  const Iy = section("I 300x150").Iy;

  test("the reactions, the maximum moment and the mid-span deflection equal wL/2, wL²/8, 5wL⁴/(384EI)", () => {
    const answers = values(referenceAnswers(simplySupportedBeamTask()));
    expect(Object.keys(answers)).toEqual([
      "reaction-a",
      "reaction-b",
      "max-moment",
      "midspan-deflection",
    ]);
    expectRelative(value(answers, "reaction-a"), (w * L) / 2, 1e-10);
    expectRelative(value(answers, "reaction-b"), (w * L) / 2, 1e-10);
    expectRelative(value(answers, "max-moment"), (w * L * L) / 8, 1e-10);
    expectRelative(value(answers, "midspan-deflection"), (5 * w * L ** 4) / (384 * E * Iy), 1e-10);
    // The round values: 45 kN, 67.5 kN·m, and 14.79 mm.
    expect(value(answers, "reaction-a")).toBeCloseTo(45, 9);
    expect(value(answers, "max-moment")).toBeCloseTo(67.5, 9);
    expect(value(answers, "midspan-deflection") * 1000).toBeCloseTo(14.795, 3);
  });

  test("the display value is the model value in the display unit", () => {
    const result = referenceAnswers(simplySupportedBeamTask());
    if (!result.ok) {
      throw new Error("not solved");
    }
    const deflection = result.answers.find((answer) => answer.answerId === "midspan-deflection");
    expect(deflection?.status).toBe("computed");
    if (deflection?.status === "computed") {
      expect(deflection.unit).toBe("mm");
      expect(deflection.display).toBe(deflection.value * 1000);
      expect(deflection.value).toBeGreaterThan(0);
    }
    expect(DISPLAY_PER_MODEL_UNIT).toEqual({ kN: 1, kN·m: 1, mm: 1000, MPa: 0.001, "-": 1 });
    expect(result.requirements).toEqual([]);
  });

  test("the reference design is sensible: the deflection is between span/500 and span/300", () => {
    const answers = values(referenceAnswers(simplySupportedBeamTask()));
    const deflection = value(answers, "midspan-deflection");
    expect(deflection).toBeLessThan(L / 300);
    expect(deflection).toBeGreaterThan(L / 500);
  });
});

describe("reference answers, task (b): portal frame", () => {
  const L = 8;
  const H = 5;
  const w = 30;
  const P = 20;

  test("the reactions are in equilibrium with the loads", () => {
    const task = portalFrameTask();
    const solved = solve(task.referenceModel);
    if (!solved.ok) {
      throw new Error("not solved");
    }
    const a = solved.loadCases[LOAD_CASE_ID]?.reactions.A;
    const d = solved.loadCases[LOAD_CASE_ID]?.reactions.D;
    if (!a || !d) {
      throw new Error("no reactions");
    }
    // Horizontal: the reactions balance the wind force.
    expect(a.fx + d.fx + P).toBeCloseTo(0, 9);
    // Vertical: the reactions carry the whole beam load.
    expect(a.fz + d.fz - w * L).toBeCloseTo(0, 9);
    // Moments about global Y through A (a force (Fx, Fz) at (x, z) gives z·Fx − x·Fz): the two base
    // moments, the vertical reaction at D, the wind force at height H, the beam load at x = L/2.
    expect(a.my + d.my - L * d.fz + H * P + (w * L * L) / 2).toBeCloseTo(0, 8);
    // Nothing acts out of the plane.
    for (const reaction of [a, d]) {
      expect(reaction.fy).toBe(0);
      expect(reaction.mx).toBe(0);
      expect(reaction.mz).toBe(0);
    }
  });

  /** The closed-form values for a fixed-base portal whose members do not change length. */
  function closedForm() {
    const Ic = section("I 300x150").Iy;
    const Ib = section("I 400x180").Iy;
    const k = (Ib * H) / (Ic * L);
    const thrust = (w * L * L) / (4 * H * (k + 2));
    const gravityMoment = (w * L * L) / (12 * (k + 2));
    const windMoment = (P * H * (3 * k + 1)) / (2 * (6 * k + 1));
    const windVertical = (3 * P * H * k) / (L * (6 * k + 1));
    return {
      "reaction-ax": thrust - P / 2,
      "reaction-dx": -thrust - P / 2,
      "reaction-az": (w * L) / 2 - windVertical,
      "reaction-dz": (w * L) / 2 + windVertical,
      // At A the wind and gravity moments oppose each other; at D they add.
      "moment-a": Math.abs(gravityMoment - windMoment),
      "moment-d": gravityMoment + windMoment,
      "sway-b": (P * H ** 3 * (3 * k + 2)) / (12 * E * Ic * (6 * k + 1)),
      "drift-ratio": (P * H ** 3 * (3 * k + 2)) / (12 * E * Ic * (6 * k + 1)) / (H / 300),
    };
  }

  test("the answers agree with the closed-form values within 2 percent (the solver has axial deformation)", () => {
    const answers = values(referenceAnswers(portalFrameTask()));
    const expected = closedForm();
    expect(Object.keys(answers)).toEqual(Object.keys(expected));
    for (const [id, closed] of Object.entries(expected)) {
      expectRelative(value(answers, id), closed, 0.02);
    }
  });

  test("with the areas multiplied by 1000 the answers agree with the closed-form values within 1e-4", () => {
    const task = portalFrameTask();
    const stiff: Model = {
      ...task.referenceModel,
      sections: task.referenceModel.sections.map((item) => ({ ...item, A: item.A * 1000 })),
    };
    const answers = values(computeAnswers(task, stiff));
    for (const [id, closed] of Object.entries(closedForm())) {
      expectRelative(value(answers, id), closed, 1e-4);
    }
  });

  test("the values frozen from the solver on 2026-11-18", () => {
    const answers = values(referenceAnswers(portalFrameTask()));
    const frozen: Record<string, number> = {
      "reaction-ax": 15.609433751647,
      "reaction-dx": -35.609433751647,
      "reaction-az": 114.302230936255,
      "reaction-dz": 125.697769063745,
      "moment-a": 15.362788272202,
      "moment-d": 69.780635762246,
      "sway-b": 0.00778317856684538,
      "drift-ratio": 0.466990714010723,
    };
    expect(Object.keys(answers)).toEqual(Object.keys(frozen));
    for (const [id, expected] of Object.entries(frozen)) {
      expectRelative(value(answers, id), expected, 1e-9);
    }
  });

  test("what the brief and the rubric say about the reference frame is true", () => {
    const task = portalFrameTask();
    const result = referenceAnswers(task);
    if (!result.ok) {
      throw new Error("not solved");
    }
    const answers = values(result);
    // The horizontal reaction at A is along +X and the one at D along −X.
    expect(value(answers, "reaction-ax")).toBeGreaterThan(0);
    expect(value(answers, "reaction-dx")).toBeLessThan(0);
    // The base moment at D is larger than the one at A.
    expect(value(answers, "moment-d")).toBeGreaterThan(value(answers, "moment-a"));
    // No answer is so small that its 1 percent tolerance is below the absolute part.
    expect(value(answers, "reaction-ax")).toBeGreaterThan(10);
    expect(value(answers, "moment-a")).toBeGreaterThan(10);
    // The frame meets the sway limit of height/300, and the sway is millimetres.
    expect(result.requirements).toHaveLength(1);
    const check = result.requirements[0];
    expect(check?.status).toBe("computed");
    if (check?.status === "computed") {
      expect(check.allowable).toBeCloseTo(PORTAL_HEIGHT / PORTAL_DRIFT_DIVISOR, 12);
      expect(check.satisfied).toBe(true);
      expect(check.value).toBe(value(answers, "sway-b"));
      expect(check.ratio).toBe(value(answers, "drift-ratio"));
      expect(check.value * 1000).toBeGreaterThan(5);
      expect(check.value * 1000).toBeLessThan(10);
    }
    const requirement = task.requirements?.[0];
    expect(requirement && allowableValue(requirement) * 1000).toBeCloseTo(16.667, 3);
    expect(requirement?.statement).toContain("5 m / 300 = 16.7 mm");
  });
});

describe("reference answers, task (c): choose the beam", () => {
  const w = 25;
  const L = 7;

  test("the moment and the deflection of the reference section equal wL²/8 and 5wL⁴/(384EI)", () => {
    const result = referenceAnswers(chooseTheBeamTask());
    const answers = values(result);
    const Iy = section("I 400x180").Iy;
    const deflection = (5 * w * L ** 4) / (384 * E * Iy);
    expect(Object.keys(answers)).toEqual(["max-moment", "midspan-deflection", "deflection-ratio"]);
    expectRelative(value(answers, "max-moment"), (w * L * L) / 8, 1e-10);
    expectRelative(value(answers, "midspan-deflection"), deflection, 1e-10);
    expectRelative(value(answers, "deflection-ratio"), deflection / (L / 360), 1e-10);
    expect(value(answers, "max-moment")).toBeCloseTo(153.125, 9);
    expect(value(answers, "midspan-deflection") * 1000).toBeCloseTo(16.437, 3);
  });

  test("the stress answer is the pending marker, not a number", () => {
    const task = chooseTheBeamTask();
    const result = referenceAnswers(task);
    if (!result.ok) {
      throw new Error("not solved");
    }
    expect(result.answers.find((answer) => answer.answerId === "max-bending-stress")).toEqual({
      answerId: "max-bending-stress",
      status: "pending",
      unit: "MPa",
      waitsFor: ["S8", "T6"],
      reason:
        "The illustrative stress check is defined by pitch card S8 and the evidence for it by pitch card T6; until then there is no reference value for this answer.",
    });
    const pending = seededTasks().flatMap((item) =>
      item.answers.filter((answer) => answer.source.kind === "pending").map((answer) => answer.id),
    );
    expect(pending).toEqual(["max-bending-stress"]);
  });

  test("three listed sections fail span/360 and three pass; the reference is the lightest that passes", () => {
    const task = chooseTheBeamTask();
    const choices = evaluateSectionChoices(task);
    expect(choices.map((choice) => choice.sectionId)).toEqual([...CHOICE_SECTIONS]);
    expect(choices.map((choice) => choice.satisfied)).toEqual([
      false,
      false,
      false,
      true,
      true,
      true,
    ]);
    const passing = choices.filter((choice) => choice.satisfied);
    const lightest = passing.reduce((best, choice) =>
      choice.massPerMetre < best.massPerMetre ? choice : best,
    );
    expect(lightest.sectionId).toBe(CHOICE_REFERENCE_SECTION);
    expect(choices.filter((choice) => choice.reference).map((choice) => choice.sectionId)).toEqual([
      CHOICE_REFERENCE_SECTION,
    ]);
    expect(task.referenceModel.members.map((member) => member.sectionId)).toEqual([
      CHOICE_REFERENCE_SECTION,
      CHOICE_REFERENCE_SECTION,
    ]);
    // Each deflection is the closed-form value for that section, and the mass is area × 7850.
    for (const choice of choices) {
      const s = section(choice.sectionId);
      const check = choice.requirements[0];
      expect(check?.status).toBe("computed");
      if (check?.status === "computed") {
        expectRelative(check.value, (5 * w * L ** 4) / (384 * E * s.Iy), 1e-10);
        expect(check.allowable).toBeCloseTo(L / 360, 12);
      }
      expect(choice.massPerMetre).toBeCloseTo(s.A * 7850, 9);
    }
    // The rubric names the sections of each level: they are the ones the solver finds.
    const levels = task.rubric.criteria.find(
      (criterion) => criterion.id === "section-choice",
    )?.levels;
    const failing = choices.filter((choice) => !choice.satisfied).map((choice) => choice.sectionId);
    expect(failing).toEqual([CHOICE_STARTING_SECTION, "I 330x160", "I 360x170"]);
    expect(levels?.[1]?.description).toContain("(I 330x160 or I 360x170)");
    expect(passing.map((choice) => choice.sectionId)).toEqual([
      CHOICE_REFERENCE_SECTION,
      "I 450x190",
      "I 500x200",
    ]);
    expect(levels?.[2]?.description).toContain("(I 450x190 or I 500x200)");
    expect(levels?.[3]?.description).toContain(CHOICE_REFERENCE_SECTION);
  });

  test("a task without a section choice has no choices to evaluate", () => {
    expect(evaluateSectionChoices(simplySupportedBeamTask())).toEqual([]);
  });
});

describe("computeAnswers on a model that is not the reference", () => {
  test("the starting model of task (a) cannot be solved: it has no support", () => {
    const task = simplySupportedBeamTask();
    const result = computeAnswers(task, task.startingModel);
    expect(result.ok).toBe(false);
    if (!result.ok && result.reason === "not-solved") {
      expect(result.solve.reason).toBe("invalid-model");
    } else {
      throw new Error("expected not-solved");
    }
  });

  test("a model without the task's load case", () => {
    const task = simplySupportedBeamTask();
    const model: Model = {
      ...task.referenceModel,
      loadCases: [],
      memberUniformLoads: [],
    };
    expect(computeAnswers(task, model)).toEqual({
      ok: false,
      reason: "missing-load-case",
      loadCaseId: "LC1",
    });
  });

  test("an answer whose member the model names differently is reported as missing, the others are computed", () => {
    const task = simplySupportedBeamTask();
    const model = structuredClone(task.referenceModel);
    const first = model.members[0];
    const load = model.memberUniformLoads[0];
    if (first && load) {
      first.id = "left-half";
      load.memberId = "left-half";
    }
    const result = computeAnswers(task, model);
    if (!result.ok) {
      throw new Error("not solved");
    }
    expect(result.answers.map((answer) => [answer.answerId, answer.status])).toEqual([
      ["reaction-a", "computed"],
      ["reaction-b", "computed"],
      ["max-moment", "missing"],
      ["midspan-deflection", "computed"],
    ]);
    expect(result.answers[2]).toEqual({
      answerId: "max-moment",
      status: "missing",
      unit: "kN·m",
      missingId: "AC",
    });
  });

  test("it does not change the task or the model", () => {
    const task = chooseTheBeamTask();
    const copy = structuredClone(task);
    referenceAnswers(task);
    evaluateSectionChoices(task);
    expect(task).toEqual(copy);
  });
});

describe("the document for the owner", () => {
  const path = fileURLToPath(new URL(`../../../${TASKS_DOCUMENT_PATH}`, import.meta.url));
  const text = renderTasksDocument(seededTasks());

  test(`${TASKS_DOCUMENT_PATH} is current (regenerate with: pnpm --filter @bridle/tasks run docs)`, () => {
    expect(readFileSync(path, "utf8")).toBe(text);
  });

  test("it is deterministic and carries no date", () => {
    expect(renderTasksDocument(seededTasks())).toBe(text);
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(text.endsWith("\n")).toBe(true);
    expect(text.endsWith("\n\n")).toBe(false);
  });

  test("it starts with the note that it is generated and how to regenerate it", () => {
    const lines = text.split("\n");
    expect(lines[0]).toBe("# Bridle tasks: briefs, rubrics and reference answers");
    expect(lines[2]).toContain("generated from the task data of `packages/tasks`");
    expect(lines[2]).toContain("`pnpm --filter @bridle/tasks run docs`");
  });

  test("it shows, for each task, the title, level, brief, answers, requirements, rubric and reference answers", () => {
    for (const [index, task] of seededTasks().entries()) {
      expect(text).toContain(`## Task ${index + 1}. ${task.title}`);
      for (const paragraph of task.brief) {
        expect(text).toContain(paragraph);
      }
      for (const answer of task.answers) {
        expect(text).toContain(
          `| ${answer.prompt} | ${answer.unit === "-" ? "none (a ratio)" : answer.unit} |`,
        );
      }
      for (const requirement of task.requirements ?? []) {
        expect(text).toContain(`| ${requirement.statement} |`);
      }
      for (const criterion of task.rubric.criteria) {
        expect(text).toContain(`| ${criterion.name} | ${Math.round(criterion.weight * 100)} % |`);
        for (const level of criterion.levels) {
          expect(text).toContain(level.description);
        }
      }
    }
    expect(text).toContain("Level: Introductory. Task id: `simply-supported-beam`.");
    expect(text).toContain("Level: Intermediate. Task id: `choose-the-beam`.");
    expect(text.match(/^### Reference answers$/gm)).toHaveLength(3);
  });

  test("the reference values are written with their units", () => {
    expect(text).toContain("| Vertical reaction at support A (magnitude) | 45.00 | kN |");
    expect(text).toContain(
      "| Maximum bending moment in the beam, at mid-span (magnitude) | 67.50 | kN·m |",
    );
    expect(text).toContain("| Deflection at mid-span, node C (magnitude, downward) | 14.79 | mm |");
    expect(text).toContain(
      "| Horizontal reaction at base D (signed, positive along +X) | -35.61 | kN |",
    );
    expect(text).toContain("| Sway: horizontal displacement of node B (magnitude) | 7.78 | mm |");
    // 153.125 kN·m: written the same way whatever rounding noise the solver's value carries.
    expect(text).toContain(
      "| Maximum bending moment in the beam, at mid-span (magnitude) | 153.13 | kN·m |",
    );
    expect(text).toContain("PENDING: no reference value yet (waits for pitch cards S8 and T6)");
    expect(text).toContain(
      "| I 400x180 | 65.8 | 16.44 mm against 19.44 mm (ratio 0.845) | meets the requirement | yes |",
    );
    expect(text).toContain(
      "| I 360x170 | 55.7 | 23.56 mm against 19.44 mm (ratio 1.212) | does NOT meet the requirement |  |",
    );
  });

  test("no design code is named and no clause is cited, in the tasks or the document", () => {
    const all = `${text}\n${JSON.stringify(seededTasks())}`;
    expect(all).not.toMatch(/\b(AISC|ASCE|ACI|Eurocode|NSCP|BS ?\d|EN ?1\d{3}|clause|§)/i);
    expect(text).toContain("no design code is applied");
  });
});
