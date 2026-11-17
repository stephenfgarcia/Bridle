/**
 * The text of the owner's document about the seeded tasks, `docs/content/tasks.md`, built from the
 * task data and the reference answers. `renderTasksDocument` is a pure function of its input: no
 * date, no clock, no file access. `scripts/write-document.ts` writes the file
 * (`pnpm --filter @bridle/tasks run docs`) and a test compares the file with this text.
 */
import type { Model } from "@bridle/model";
import {
  allowableValue,
  type ComputedAnswer,
  evaluateSectionChoices,
  type RequirementCheck,
  referenceAnswers,
} from "./reference";
import { GENERIC_I_SECTION_DIMENSIONS, genericSection, massPerMetre } from "./sections";
import {
  type DisplayUnit,
  type ModelListName,
  type RequiredAnswer,
  RUBRIC_LEVEL_LABEL,
  RUBRIC_LEVELS,
  type Task,
} from "./types";

/** The document's path from the repository root. */
export const TASKS_DOCUMENT_PATH = "docs/content/tasks.md";

/** The decimals a reference value is written with in the document, by display unit. */
const DECIMALS: Readonly<Record<DisplayUnit, number>> = {
  kN: 2,
  kN·m: 2,
  mm: 2,
  MPa: 1,
  "-": 3,
};

const LEVEL_LABEL = { introductory: "Introductory", intermediate: "Intermediate" } as const;

const LIST_LABEL: Readonly<Record<ModelListName, string>> = {
  nodes: "nodes",
  members: "members",
  sections: "sections",
  materials: "material",
  supports: "supports at",
  loadCases: "load case",
  nodalLoads: "nodal loads",
  memberUniformLoads: "uniform loads",
  memberPointLoads: "point loads",
};

/**
 * `value` with a fixed number of decimals; a value that rounds to zero is written without a sign.
 * The value is first rounded to 12 significant digits, so that a result such as 153.125 that the
 * solver returns with rounding noise in its last digits is always written the same way (153.13).
 */
function fixed(value: number, decimals: number): string {
  const text = Number(value.toPrecision(12)).toFixed(decimals);
  return Number(text) === 0 ? (0).toFixed(decimals) : text;
}

/** A number without trailing zeros, at most four decimals. */
function plain(value: number): string {
  return String(Number(value.toFixed(4)));
}

function unitText(unit: DisplayUnit): string {
  return unit === "-" ? "none (a ratio)" : unit;
}

function table(header: string[], rows: string[][]): string[] {
  return [
    `| ${header.join(" | ")} |`,
    `|${header.map(() => " --- ").join("|")}|`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ];
}

function toleranceText(answer: RequiredAnswer): string {
  const unit = answer.unit === "-" ? "" : ` ${answer.unit}`;
  return `${plain(answer.tolerance.relative * 100)} % or ${plain(answer.tolerance.absolute)}${unit}, whichever is larger`;
}

/** The parts of a model in words, one bullet per list that has entries. */
function describeModel(model: Model): string[] {
  const lines: string[] = [];
  if (model.nodes.length > 0) {
    const nodes = model.nodes.map(
      (node) => `${node.id} (${plain(node.x)}, ${plain(node.y)}, ${plain(node.z)})`,
    );
    lines.push(`- Nodes (x, y, z in m): ${nodes.join(", ")}.`);
  }
  if (model.members.length > 0) {
    const members = model.members.map(
      (member) =>
        `${member.id} from ${member.startNodeId} to ${member.endNodeId} (${member.kind}, ${member.sectionId})`,
    );
    lines.push(`- Members: ${members.join("; ")}.`);
  }
  if (model.supports.length > 0) {
    const supports = model.supports.map((support) => {
      const held = (["ux", "uy", "uz", "rx", "ry", "rz"] as const).filter((key) => support[key]);
      return `${support.nodeId} holds ${held.length === 6 ? "all six (ux, uy, uz, rx, ry, rz)" : held.join(", ")}`;
    });
    lines.push(`- Supports: ${supports.join("; ")}.`);
  }
  const loads: string[] = [];
  for (const load of model.memberUniformLoads) {
    loads.push(
      `${plain(Math.abs(load.value))} kN/m on member ${load.memberId} along ${load.axes} ${load.value < 0 ? "−" : "+"}${load.direction.toUpperCase()} (${load.loadCaseId})`,
    );
  }
  for (const load of model.memberPointLoads) {
    loads.push(
      `${plain(Math.abs(load.value))} kN on member ${load.memberId} at ${plain(load.position)} m from its start, along ${load.axes} ${load.value < 0 ? "−" : "+"}${load.direction.toUpperCase()} (${load.loadCaseId})`,
    );
  }
  for (const load of model.nodalLoads) {
    const parts = (["fx", "fy", "fz", "mx", "my", "mz"] as const)
      .filter((key) => load[key] !== 0)
      .map((key) => `${key} = ${plain(load[key])} ${key.startsWith("f") ? "kN" : "kN·m"}`);
    loads.push(`on node ${load.nodeId}: ${parts.join(", ")} (${load.loadCaseId})`);
  }
  if (loads.length > 0) {
    lines.push(`- Loads: ${loads.join("; ")}.`);
  }
  return lines;
}

function startingText(task: Task): string[] {
  const model = task.startingModel;
  const has: string[] = [];
  const lacks: string[] = [];
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  (model.nodes.length > 0 ? has : lacks).push(count(model.nodes.length, "node", "nodes"));
  (model.members.length > 0 ? has : lacks).push(count(model.members.length, "member", "members"));
  (model.supports.length > 0 ? has : lacks).push(
    count(model.supports.length, "support", "supports"),
  );
  const loadCount =
    model.nodalLoads.length + model.memberUniformLoads.length + model.memberPointLoads.length;
  (loadCount > 0 ? has : lacks).push(count(loadCount, "load", "loads"));
  has.push(count(model.sections.length, "section", "sections"));
  has.push(`the material ${model.materials.map((material) => material.name).join(", ")}`);
  has.push(`the load case ${model.loadCases.map((loadCase) => loadCase.id).join(", ")}`);
  const lines = [
    `The starting model has ${has.join(", ")}.${lacks.length > 0 ? ` It has ${lacks.map((item) => item.replace(/^0 /, "no ")).join(", ")}: the learner adds them.` : ""}`,
    "",
    ...describeModel(model),
  ];
  const byList = new Map<ModelListName, string[]>();
  for (const part of task.fixed) {
    byList.set(part.list, [...(byList.get(part.list) ?? []), part.id]);
  }
  const fixedText = [...byList].map(([list, ids]) => `${LIST_LABEL[list]} ${ids.join(", ")}`);
  lines.push(
    "",
    task.fixed.length > 0
      ? `Fixed (the learner cannot change or delete them): ${fixedText.join("; ")}.`
      : "Nothing is fixed.",
  );
  if (task.sectionChoice !== undefined) {
    lines.push(
      "",
      `The learner's choice: one section for the members ${task.sectionChoice.memberIds.join(" and ")}, from ${task.sectionChoice.sectionIds.join(", ")}.`,
    );
  }
  return lines;
}

function referenceValueText(answer: ComputedAnswer | undefined): string {
  if (answer === undefined) {
    return "not computed";
  }
  switch (answer.status) {
    case "computed":
      return fixed(answer.display, DECIMALS[answer.unit]);
    case "pending":
      return `PENDING: no reference value yet (waits for pitch cards ${answer.waitsFor.join(" and ")})`;
    case "missing":
      return `not computed: the reference model has no result for ${answer.missingId}`;
  }
}

function requirementText(check: RequirementCheck | undefined): string[] {
  if (check === undefined || check.status !== "computed") {
    return ["not computed", "not computed"];
  }
  return [
    `${fixed(check.value * 1000, 2)} mm against ${fixed(check.allowable * 1000, 2)} mm (ratio ${fixed(check.ratio, 3)})`,
    check.satisfied ? "met" : "NOT met",
  ];
}

function taskSection(task: Task, number: number): string[] {
  const lines: string[] = [];
  const result = referenceAnswers(task);
  lines.push(`## Task ${number}. ${task.title}`, "");
  lines.push(`Level: ${LEVEL_LABEL[task.level]}. Task id: \`${task.id}\`.`, "");

  lines.push("### Brief", "");
  for (const paragraph of task.brief) {
    lines.push(paragraph, "");
  }
  lines.push("### Given", "");
  lines.push(
    ...table(
      ["Quantity", "Value"],
      task.givens.map((given) => [given.label, given.value]),
    ),
    "",
  );

  lines.push("### Learning outcomes", "");
  lines.push(...task.learningOutcomes.map((outcome) => `- ${outcome}`), "");

  lines.push("### What the learner starts with", "");
  lines.push(...startingText(task), "");

  lines.push("### What the learner must report", "");
  lines.push(
    ...table(
      ["No.", "Answer", "Unit", "Sign", "Accepted within"],
      task.answers.map((answer, index) => [
        String(index + 1),
        answer.prompt,
        unitText(answer.unit),
        answer.signed ? "signed" : "magnitude",
        toleranceText(answer),
      ]),
    ),
    "",
  );
  if (task.justification !== undefined) {
    lines.push(`Written justification: ${task.justification.prompt}`, "");
  }

  lines.push("### Design requirements", "");
  const requirements = task.requirements ?? [];
  if (requirements.length === 0) {
    lines.push("This task sets no design requirement.", "");
  } else {
    lines.push(
      ...table(
        ["Requirement", "Limit as data", "Reference design", "Verdict"],
        requirements.map((requirement) => {
          const check = result.ok
            ? result.requirements.find((item) => item.requirementId === requirement.id)
            : undefined;
          const limit = requirement.limit;
          return [
            requirement.statement,
            `${limit.quantity} ${limit.component} at node ${limit.nodeId} ≤ ${plain(limit.length)} m / ${plain(limit.divisor)} = ${fixed(allowableValue(requirement) * 1000, 2)} mm`,
            ...requirementText(check),
          ];
        }),
      ),
      "",
    );
  }

  lines.push("### Rubric", "");
  lines.push(
    ...table(
      [
        "Criterion",
        "Weight",
        "Assessed from",
        ...RUBRIC_LEVELS.map((level) => RUBRIC_LEVEL_LABEL[level]),
      ],
      task.rubric.criteria.map((criterion) => [
        criterion.name,
        `${plain(criterion.weight * 100)} %`,
        criterion.basis.join(", "),
        ...RUBRIC_LEVELS.map(
          (level) =>
            criterion.levels.find((entry) => entry.level === level)?.description ??
            "(no such level)",
        ),
      ]),
    ),
    "",
  );

  lines.push("### Reference answers", "");
  lines.push(
    "Computed by the solver from the reference model below; none of these numbers is typed in.",
    "",
    ...describeModel(task.referenceModel),
    "",
  );
  if (!result.ok) {
    lines.push(`The reference answers could not be computed: ${result.reason}.`, "");
  } else {
    lines.push(
      ...table(
        ["No.", "Answer", "Reference value", "Unit"],
        task.answers.map((answer, index) => [
          String(index + 1),
          answer.prompt,
          referenceValueText(result.answers.find((item) => item.answerId === answer.id)),
          unitText(answer.unit),
        ]),
      ),
      "",
    );
  }

  const choices = evaluateSectionChoices(task);
  if (choices.length > 0) {
    lines.push(
      "Each section of the list, tried on the reference model:",
      "",
      ...table(
        ["Section", "Mass, kg/m", "Design requirement", "Verdict", "Reference choice"],
        choices.map((choice) => [
          choice.sectionId,
          fixed(choice.massPerMetre, 1),
          choice.requirements.map((check) => requirementText(check)[0]).join("; ") ||
            "not computed",
          choice.satisfied ? "meets the requirement" : "does NOT meet the requirement",
          choice.reference ? "yes" : "",
        ]),
      ),
      "",
    );
  }
  return lines;
}

function sectionsAppendix(): string[] {
  return [
    "## Appendix. The generic I-sections",
    "",
    "The sections are generic shapes defined for these tasks: two flanges and a web as three rectangles, with no root fillets. They are not taken from any manufacturer's or standard's table, and a name such as I 300x150 only says that the shape is 300 mm deep and 150 mm wide. With h the depth, b the flange width, tw the web thickness and tf the flange thickness:",
    "",
    "- A = 2·b·tf + (h − 2·tf)·tw",
    "- Iy = [b·h³ − (b − tw)·(h − 2·tf)³] / 12 (strong axis)",
    "- Iz = [2·tf·b³ + (h − 2·tf)·tw³] / 12 (weak axis)",
    "- J = [2·b·tf³ + (h − tf)·tw³] / 3 (thin-walled approximation, the web taken between the flange centre lines)",
    "- Mass per metre = A × 7850 kg/m³",
    "",
    ...table(
      [
        "Section",
        "h, mm",
        "b, mm",
        "tw, mm",
        "tf, mm",
        "A, mm²",
        "Iy, 10⁶ mm⁴",
        "Iz, 10⁶ mm⁴",
        "J, 10³ mm⁴",
        "Mass, kg/m",
      ],
      GENERIC_I_SECTION_DIMENSIONS.map((dimensions) => {
        const section = genericSection(dimensions);
        return [
          dimensions.name,
          plain(dimensions.h),
          plain(dimensions.b),
          plain(dimensions.tw),
          plain(dimensions.tf),
          fixed(section.A * 1e6, 0),
          fixed(section.Iy * 1e6, 2),
          fixed(section.Iz * 1e6, 2),
          fixed(section.J * 1e9, 1),
          fixed(massPerMetre(section), 1),
        ];
      }),
    ),
    "",
  ];
}

/**
 * The whole document as Markdown, ending with one newline.
 *
 * @param tasks the tasks to show, in order (the caller passes `seededTasks()`).
 */
export function renderTasksDocument(tasks: readonly Task[]): string {
  const lines: string[] = [
    "# Bridle tasks: briefs, rubrics and reference answers",
    "",
    "> This file is generated from the task data of `packages/tasks` by `pnpm --filter @bridle/tasks run docs`. Do not edit it by hand: correct the task in `packages/tasks/src/tasks/` and run that command again. A test of the package fails while this file differs from what the command writes.",
    "",
    `This document shows the ${tasks.length} seeded tasks of the showcase as a learner and an instructor meet them: the brief, what the learner must report, the design requirements, the rubric, and the reference answers.`,
    "",
    "How to read it:",
    "",
    "- Units: forces in kN, lengths in m, moments in kN·m, stresses in MPa, deflections in mm. Global axes are right-handed with Z up; gravity acts along −Z. A frame drawn in a plane lies in the X-Z plane.",
    "- Loads are service (unfactored) values. The limits on deflection and sway are requirements of the tasks themselves; no design code is applied, and the analysis is linear-elastic.",
    "- A reference answer is computed: the solver (`packages/solver`) analyses the task's reference model and the value is read from its results. An answer marked PENDING has no reference value yet.",
    "- An answer is accepted within a tolerance with a relative and an absolute part: the difference from the reference value may be up to the larger of the two. A signed answer follows the global axes; a magnitude has no sign.",
    "- Every rubric criterion has a weight (the weights of a task sum to 100 %) and says what it is assessed from: the learner's model, the solver's results for that model, the typed answers, or the written justification.",
    "",
  ];
  tasks.forEach((task, index) => {
    lines.push(...taskSection(task, index + 1));
  });
  lines.push(...sectionsAppendix());
  while (lines[lines.length - 1] === "") {
    lines.pop();
  }
  return `${lines.join("\n")}\n`;
}
