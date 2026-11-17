"use client";

import type { Model } from "@bridle/model";
import type { ReactNode } from "react";
import { t } from "../../i18n";
import { type ItemRef, useViewportStore } from "../viewport/viewportStore";
import styles from "./WorkspaceView.module.css";

/** A coordinate as text: at most four decimals, no trailing zeros. */
function formatNumber(value: number): string {
  return String(Number(value.toFixed(4)));
}

/** The rows of the selected item, as label and value; `undefined` when the model does not hold it. */
function selectionRows(model: Model, selection: ItemRef | null): [string, string][] | undefined {
  if (selection?.kind === "node") {
    const node = model.nodes.find((candidate) => candidate.id === selection.id);
    return (
      node && [
        [t("workspace.selection.kind"), t("workspace.selection.kindNode")],
        [t("workspace.selection.id"), node.id],
        [t("workspace.selection.x"), formatNumber(node.x)],
        [t("workspace.selection.y"), formatNumber(node.y)],
        [t("workspace.selection.z"), formatNumber(node.z)],
      ]
    );
  }
  if (selection?.kind === "member") {
    const member = model.members.find((candidate) => candidate.id === selection.id);
    if (!member) {
      return undefined;
    }
    const named = (list: { id: string; name: string }[], id: string) => {
      const found = list.find((candidate) => candidate.id === id);
      return found ? t("workspace.selection.named", { name: found.name, id }) : id;
    };
    return [
      [t("workspace.selection.kind"), t("workspace.selection.kindMember")],
      [t("workspace.selection.id"), member.id],
      [t("workspace.selection.start"), member.startNodeId],
      [t("workspace.selection.end"), member.endNodeId],
      [t("workspace.selection.section"), named(model.sections, member.sectionId)],
      [t("workspace.selection.material"), named(model.materials, member.materialId)],
    ];
  }
  return undefined;
}

/**
 * The side panel of the workspace: the model on screen (the fixture switch and the counts of its nodes, members
 * and supports) and, read-only, the item selected in the viewport.
 */
export function SidePanel({ model, fixtureSwitch }: { model: Model; fixtureSwitch: ReactNode }) {
  const selection = useViewportStore((state) => state.selection);
  const rows = selectionRows(model, selection);
  const counts: [string, string, number][] = [
    ["count-nodes", t("workspace.counts.nodes"), model.nodes.length],
    ["count-members", t("workspace.counts.members"), model.members.length],
    ["count-supports", t("workspace.counts.supports"), model.supports.length],
  ];
  return (
    <aside
      aria-label={t("workspace.panel.label")}
      className={styles.panel}
      data-testid="side-panel"
    >
      <section aria-labelledby="workspace-model-title" className={styles.block}>
        <h2 className={styles.blockTitle} id="workspace-model-title">
          {t("workspace.model.title")}
        </h2>
        {fixtureSwitch}
        <dl className={styles.counts}>
          {counts.map(([testId, label, count]) => (
            <div className={styles.count} key={testId}>
              <dt>{label}</dt>
              <dd data-testid={testId}>{count}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-labelledby="workspace-panel-title" aria-live="polite" className={styles.block}>
        <h2 className={styles.blockTitle} id="workspace-panel-title">
          {t("workspace.panel.title")}
        </h2>
        {rows ? (
          <dl className={styles.rows} data-testid="selection">
            {rows.map(([label, value]) => (
              <div className={styles.row} key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className={styles.empty} data-testid="selection-empty">
            {t("workspace.panel.empty")}
          </p>
        )}
      </section>
    </aside>
  );
}
