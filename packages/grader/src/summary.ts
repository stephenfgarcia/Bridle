/** `summarizeEvidence`: counts and flags of an evidence. */
import type { AnswerVerdict, Evidence, EvidenceSummary } from "./types";

/**
 * Counts what the evidence holds, without prose: the answers by verdict, the state of the model,
 * the numbers of differences in members, fixed parts, supports and loads, and whether the
 * requirements are met. Every number is a count of entries of `evidence`; `EvidenceSummary` in
 * ./types.ts says which. A part that is `null` in the evidence (the model does not parse) counts
 * as zero entries.
 */
export function summarizeEvidence(evidence: Evidence): EvidenceSummary {
  const verdicts = (verdict: AnswerVerdict) =>
    evidence.answers.filter((answer) => answer.verdict === verdict).length;
  const members = evidence.matching?.members ?? [];
  const fixed = evidence.fixedParts?.differences ?? [];
  const supportNodes = evidence.supports?.nodes ?? [];
  const comparisons = evidence.loads?.comparisons ?? [];
  const satisfied = evidence.requirements.filter((item) => item.satisfied === true).length;
  const notSatisfied = evidence.requirements.filter((item) => item.satisfied === false).length;
  const total = evidence.requirements.length;
  const choice = evidence.sectionChoice;
  return {
    taskId: evidence.taskId,
    submissionValid: evidence.submission.issues.length === 0,
    justificationPresent: evidence.submission.justificationPresent,
    modelParses: evidence.model.parses,
    modelValid: evidence.model.valid,
    modelSolved: evidence.model.solve === "solved",
    solveStatus: evidence.model.solve,
    answers: {
      total: evidence.answers.length,
      correct: verdicts("correct"),
      consistentWithOwnModel: verdicts("consistent-with-own-model"),
      incorrect: verdicts("incorrect"),
      missing: verdicts("missing"),
      pending: verdicts("pending"),
    },
    members: {
      missing: members.filter((member) => member.learnerMemberId === null).length,
      different: members.filter((member) => member.differences.length > 0).length,
      extra: evidence.matching?.extraMemberIds.length ?? 0,
      extraNodes: evidence.matching?.extraNodeIds.length ?? 0,
    },
    fixedParts: {
      checked: evidence.fixedParts?.checked ?? 0,
      missing: fixed.filter((part) => part.status === "missing").length,
      changed: fixed.filter((part) => part.status === "changed").length,
    },
    supports: {
      differing: supportNodes.filter((node) => !node.agrees).length,
      outOfPlaneDiffering: supportNodes.filter((node) => !node.outOfPlaneAgrees).length,
    },
    loads: {
      resultantAgrees: evidence.loads?.resultant.agrees ?? null,
      differing: comparisons.filter((item) => item.status === "differs").length,
      missing: comparisons.filter((item) => item.status === "missing").length,
      extra: evidence.loads?.extra.length ?? 0,
    },
    requirements: {
      total,
      satisfied,
      notSatisfied,
      notComputed: total - satisfied - notSatisfied,
    },
    requirementsMet:
      total === 0 ? null : notSatisfied > 0 ? false : satisfied === total ? true : null,
    sectionChoice:
      choice === null
        ? null
        : {
            status: choice.status,
            chosenSectionId: choice.chosenSectionId,
            allowed: choice.allowed,
            meetsRequirements: choice.meetsRequirements,
            lighterAllowedSectionMeets: choice.lighterAllowedSectionMeets,
          },
  };
}
