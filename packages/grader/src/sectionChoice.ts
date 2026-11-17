/** Part (g) of the evidence: the learner's choice of a section. */
import { evaluateSectionChoices, type Task } from "@bridle/tasks";
import type { ModelMatch } from "./matching";
import { allInRange } from "./range";
import { MM_PER_M } from "./requirements";
import type { SectionChoiceEvidence, SectionOptionEvidence } from "./types";

/** The sections of the learner's members that the task's `sectionChoice` names, and the one they share. */
export type ChosenSection = Pick<SectionChoiceEvidence, "members" | "status" | "chosenSectionId">;

/**
 * Reads the learner's choice: the section of the learner's member matched to each member of
 * `sectionChoice.memberIds` (`match`: between the same two nodes, whatever its id).
 *
 * @param match - the matching of the learner's model to the reference, or `null` when the model
 *   does not parse
 * @returns `undefined` for a task without a section choice
 */
export function chosenSection(task: Task, match: ModelMatch | null): ChosenSection | undefined {
  const choice = task.sectionChoice;
  if (choice === undefined) {
    return undefined;
  }
  const members = choice.memberIds.map((referenceMemberId) => {
    const member = match?.members.get(referenceMemberId)?.member;
    return {
      referenceMemberId,
      learnerMemberId: member?.id ?? null,
      sectionId: member?.sectionId ?? null,
    };
  });
  if (match === null) {
    return { members, status: "model-not-read", chosenSectionId: null };
  }
  const first = members[0]?.sectionId ?? null;
  if (first === null || members.some((member) => member.sectionId === null)) {
    return { members, status: "member-missing", chosenSectionId: null };
  }
  if (members.some((member) => member.sectionId !== first)) {
    return { members, status: "mixed", chosenSectionId: null };
  }
  return { members, status: "chosen", chosenSectionId: first };
}

/**
 * Each allowed section tried on the reference model by `evaluateSectionChoices`, with its area. A
 * requirement check whose numbers are not `inRange` is left out of `requirements`.
 */
export function sectionOptions(task: Task): SectionOptionEvidence[] {
  return evaluateSectionChoices(task).map((option): SectionOptionEvidence => {
    const section = task.referenceModel.sections.find((item) => item.id === option.sectionId);
    return {
      sectionId: option.sectionId,
      area: section?.A ?? null,
      massPerMetre: option.massPerMetre,
      requirements: option.requirements.flatMap((check) =>
        check.status === "computed" &&
        allInRange([check.value * MM_PER_M, check.allowable * MM_PER_M, check.ratio])
          ? [
              {
                requirementId: check.requirementId,
                unit: "mm" as const,
                value: check.value * MM_PER_M,
                allowable: check.allowable * MM_PER_M,
                ratio: check.ratio,
                satisfied: check.satisfied,
              },
            ]
          : [],
      ),
      meetsRequirements: option.satisfied,
    };
  });
}

/**
 * Judges the chosen section with `evaluateSectionChoices` of `@bridle/tasks`, which tries every
 * allowed section on the task's reference model.
 *
 * - `allowed`: the chosen section is one of `sectionChoice.sectionIds`.
 * - `meetsRequirements`: that section's entry is satisfied.
 * - `lighterAllowedSectionMeets`: an allowed section whose area (in the reference model) is smaller
 *   than the chosen section's is satisfied.
 * - `lightestMeetingSectionId`: the satisfied section of least area (the first in the list among
 *   equal areas).
 * `allowed` is `null` when no one section is chosen. The other two flags are `null` then, and when
 * the chosen section is not an allowed one; `lighterAllowedSectionMeets` is also `null` when the
 * reference model lacks the chosen section, so that it has no area.
 */
export function sectionChoiceEvidence(task: Task, chosen: ChosenSection): SectionChoiceEvidence {
  const options = sectionOptions(task);
  const option = options.find((item) => item.sectionId === chosen.chosenSectionId);
  const chosenArea = option?.area ?? null;
  let lightest: SectionOptionEvidence | undefined;
  for (const item of options) {
    if (
      item.meetsRequirements &&
      item.area !== null &&
      (lightest === undefined || item.area < (lightest.area ?? Number.POSITIVE_INFINITY))
    ) {
      lightest = item;
    }
  }
  const named = new Set(task.sectionChoice?.memberIds ?? []);
  const referenceSections = new Set(
    task.referenceModel.members
      .filter((member) => named.has(member.id))
      .map((member) => member.sectionId),
  );
  const [referenceSectionId] = referenceSections.size === 1 ? [...referenceSections] : [];
  return {
    members: chosen.members,
    status: chosen.status,
    chosenSectionId: chosen.chosenSectionId,
    allowed: chosen.chosenSectionId === null ? null : option !== undefined,
    chosenArea,
    meetsRequirements: option?.meetsRequirements ?? null,
    lighterAllowedSectionMeets:
      option === undefined || chosenArea === null
        ? null
        : options.some(
            (item) => item.area !== null && item.area < chosenArea && item.meetsRequirements,
          ),
    lightestMeetingSectionId: lightest?.sectionId ?? null,
    referenceSectionId: referenceSectionId ?? null,
    options,
  };
}
