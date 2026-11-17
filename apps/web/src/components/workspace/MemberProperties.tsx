"use client";

import type { MessageId } from "@bridle/i18n";
import type { Member, MemberKind, Model } from "@bridle/model";
import { useId } from "react";
import { t } from "../../i18n";
import { NumberField } from "../tools/NumberField";
import { editProperties } from "../tools/toolActions";
import {
  type Common,
  type ReleasedRotation,
  type ReleasesSummary,
  summarizeMembers,
} from "./memberSummary";
import panelStyles from "./Panels.module.css";
import styles from "./WorkspaceView.module.css";

const KIND_NAME: Record<MemberKind, MessageId> = {
  frame: "workspace.member.kindFrame",
  truss: "workspace.member.kindTruss",
};

const ROTATION_NAME: Record<ReleasedRotation, MessageId> = {
  rx: "workspace.support.rx",
  ry: "workspace.support.ry",
  rz: "workspace.support.rz",
};

function releasesText(releases: ReleasesSummary): string {
  if (releases.start.length === 0 && releases.end.length === 0) {
    return t("workspace.member.releasesNone");
  }
  const end = (rotations: ReleasedRotation[]) =>
    rotations.length === 0
      ? t("workspace.member.releasesFixed")
      : rotations.map((rotation) => t(ROTATION_NAME[rotation])).join(", ");
  return t("workspace.member.releasesValue", {
    start: end(releases.start),
    end: end(releases.end),
  });
}

/** A value the members share as text, "mixed" when they differ. */
function shared<T>(common: Common<T>, text: (value: T) => string): string {
  return common.state === "same" ? text(common.value) : t("workspace.member.mixed");
}

/**
 * A select of the model's sections or materials for the selected members. It shows the entry they share; when
 * they differ, a "mixed" entry that cannot be chosen. Choosing an entry gives it to every selected member.
 */
function EntrySelect({
  id,
  testId,
  common,
  entries,
  onChoose,
}: {
  id: string;
  testId: string;
  common: Common<string>;
  entries: { id: string; name: string }[];
  onChoose: (id: string) => void;
}) {
  const value = common.state === "same" ? common.value : "";
  const known = entries.some((entry) => entry.id === value);
  return (
    <select
      className={`${panelStyles.control} ${panelStyles.fill}`}
      data-mixed={common.state === "mixed" ? "true" : "false"}
      data-testid={testId}
      id={id}
      onChange={(event) => {
        if (event.target.value !== value) {
          onChoose(event.target.value);
        }
      }}
      value={value}
    >
      {common.state === "same" ? null : (
        <option disabled value="">
          {t("workspace.member.mixed")}
        </option>
      )}
      {/* A member that names an entry the model does not hold (an issue of the model): its id, as it is. */}
      {common.state === "same" && !known ? (
        <option disabled value={value}>
          {value}
        </option>
      ) : null}
      {entries.map((entry, index) => (
        // The index is part of the key: a model with an issue may hold one id twice.
        // biome-ignore lint/suspicious/noArrayIndexKey: the list is the model's own, in its order
        <option key={`${entry.id} ${index}`} value={entry.id}>
          {t("workspace.selection.named", { name: entry.name, id: entry.id })}
        </option>
      ))}
    </select>
  );
}

/**
 * The fields of the selected member or members in the Properties section (card PX-02.6): the section and the
 * material (selects of the model's own), the roll angle in degrees, and read-only the length, the member type
 * and the end releases, with a note that those two cannot be changed yet. A field shows the value the members
 * share, or "mixed"; a change is given to every selected member as one undo step (`updateMembers`).
 */
export function MemberProperties({ model, members }: { model: Model; members: Member[] }) {
  const summary = summarizeMembers(model, members);
  const { ids } = summary;
  const baseId = useId();
  return (
    <>
      <dl className={styles.rows} data-testid="member-properties">
        <div className={`${styles.row} ${panelStyles.fieldRow}`}>
          <dt>
            <label htmlFor={`${baseId}-section`}>{t("workspace.selection.section")}</label>
          </dt>
          <dd>
            <EntrySelect
              common={summary.sectionId}
              entries={model.sections}
              id={`${baseId}-section`}
              onChoose={(sectionId) =>
                editProperties((store) => store.updateMembers({ ids, sectionId }))
              }
              testId="member-section"
            />
          </dd>
        </div>
        <div className={`${styles.row} ${panelStyles.fieldRow}`}>
          <dt>
            <label htmlFor={`${baseId}-material`}>{t("workspace.selection.material")}</label>
          </dt>
          <dd>
            <EntrySelect
              common={summary.materialId}
              entries={model.materials}
              id={`${baseId}-material`}
              onChoose={(materialId) =>
                editProperties((store) => store.updateMembers({ ids, materialId }))
              }
              testId="member-material"
            />
          </dd>
        </div>
        <div className={`${styles.row} ${panelStyles.fieldRow}`}>
          <dt>
            <label htmlFor={`${baseId}-roll`}>{t("workspace.member.roll")}</label>
          </dt>
          <dd>
            <NumberField
              className={`${panelStyles.control} ${panelStyles.number} ${panelStyles.fill}`}
              id={`${baseId}-roll`}
              onCommit={(rollAngleDeg) =>
                editProperties((store) => store.updateMembers({ ids, rollAngleDeg }))
              }
              placeholder={t("workspace.member.mixed")}
              testId="member-roll"
              value={summary.rollAngleDeg.state === "same" ? summary.rollAngleDeg.value : null}
            />
          </dd>
        </div>
        <div className={styles.row}>
          <dt>{t("workspace.selection.length")}</dt>
          <dd data-testid="member-length">{shared(summary.length, (text) => text ?? "—")}</dd>
        </div>
        <div className={styles.row}>
          <dt>{t("workspace.member.kind")}</dt>
          <dd data-testid="member-kind">{shared(summary.kind, (kind) => t(KIND_NAME[kind]))}</dd>
        </div>
        <div className={styles.row}>
          <dt>{t("workspace.member.releases")}</dt>
          <dd data-testid="member-releases">{shared(summary.releases, releasesText)}</dd>
        </div>
      </dl>
      <p className={panelStyles.help} data-testid="member-unsupported">
        {t("workspace.member.unsupported")}
      </p>
    </>
  );
}
