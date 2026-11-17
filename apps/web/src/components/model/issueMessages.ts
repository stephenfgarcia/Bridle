// The catalog message of each issue code of @bridle/model (card PX-02.3). The package names its messages
// `model.issue.<code>`, and a code has hyphens, which an id of the catalog may not have
// (docs/ops/i18n.md): the catalog holds them as `model.issue.<the code in camel case>`.
// The record is total over `IssueCode`, so a code added to the package does not compile until it is here.
import type { MessageId } from "@bridle/i18n";
import type { IssueCode } from "@bridle/model";

export const ISSUE_MESSAGE: Record<IssueCode, MessageId> = {
  "duplicate-id": "model.issue.duplicateId",
  "duplicate-support": "model.issue.duplicateSupport",
  "missing-node": "model.issue.missingNode",
  "missing-section": "model.issue.missingSection",
  "missing-material": "model.issue.missingMaterial",
  "missing-member": "model.issue.missingMember",
  "missing-load-case": "model.issue.missingLoadCase",
  "zero-length-member": "model.issue.zeroLengthMember",
  "non-positive-value": "model.issue.nonPositiveValue",
  "load-position-outside-member": "model.issue.loadPositionOutsideMember",
  "no-support": "model.issue.noSupport",
  "invalid-json": "model.issue.invalidJson",
  "invalid-shape": "model.issue.invalidShape",
  "unsupported-version": "model.issue.unsupportedVersion",
  "unsupported-units": "model.issue.unsupportedUnits",
};
