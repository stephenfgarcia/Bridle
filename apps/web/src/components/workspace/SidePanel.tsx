"use client";

import type { Model, ModelIssue, Node as ModelNode } from "@bridle/model";
import { type ReactNode, useId } from "react";
import { t } from "../../i18n";
import { ISSUE_MESSAGE } from "../model/issueMessages";
import { NumberField } from "../tools/NumberField";
import { deleteSelection, moveNodeAction } from "../tools/toolActions";
import { type ItemRef, useViewportStore } from "../viewport/viewportStore";
import styles from "./WorkspaceView.module.css";

/**
 * The read-only rows of the selected item, as label and value; `undefined` when the model does not hold it.
 * A node's coordinates are not among them: they are the fields of `NodeCoordinates`.
 */
function selectionRows(model: Model, selection: ItemRef | null): [string, string][] | undefined {
  if (selection?.kind === "node") {
    const node = model.nodes.find((candidate) => candidate.id === selection.id);
    return (
      node && [
        [t("workspace.selection.kind"), t("workspace.selection.kindNode")],
        [t("workspace.selection.id"), node.id],
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

const AXES = [
  ["x", "workspace.selection.x"],
  ["y", "workspace.selection.y"],
  ["z", "workspace.selection.z"],
] as const;

/**
 * The X, Y and Z of the selected node as fields. A value typed in one is applied on Enter or on leaving the
 * field, as one undo step (`moveNodeAction`: the place of another node is refused with a notice in the
 * viewport); a text that is not a number is dropped.
 */
function NodeCoordinates({ node }: { node: ModelNode }) {
  const baseId = useId();
  return (
    <div className={styles.coordinates} data-testid="node-coordinates">
      {AXES.map(([axis, label]) => (
        <div className={styles.coordinate} key={axis}>
          <label className={styles.fieldLabel} htmlFor={`${baseId}-${axis}`}>
            {t(label)}
          </label>
          <NumberField
            className={styles.input}
            id={`${baseId}-${axis}`}
            onCommit={(value) =>
              moveNodeAction(node.id, [
                axis === "x" ? value : node.x,
                axis === "y" ? value : node.y,
                axis === "z" ? value : node.z,
              ])
            }
            testId={`node-${axis}`}
            value={node[axis]}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * The issues of the model, under the counts: "No issues", or their number and one entry per issue with its
 * message from the catalog, the ids it concerns and, where the issue has one, its place in the model.
 */
function Issues({ issues }: { issues: ModelIssue[] }) {
  return (
    <div className={styles.issues}>
      <h3 className={styles.blockTitle}>{t("workspace.issues.title")}</h3>
      <p
        className={issues.length === 0 ? styles.issuesNone : styles.issuesSome}
        data-testid="issues-status"
      >
        {issues.length === 0
          ? t("workspace.issues.none")
          : t("workspace.issues.count", { count: issues.length })}
      </p>
      {issues.length > 0 ? (
        <ul className={styles.issueList} data-testid="issues">
          {issues.map((issue) => (
            <li
              className={styles.issue}
              data-code={issue.code}
              key={`${issue.code} ${issue.path ?? ""} ${issue.ids.join(" ")}`}
            >
              <span>{t(ISSUE_MESSAGE[issue.code])}</span>
              {issue.ids.length > 0 ? (
                <span className={styles.issueIds}>{issue.ids.join(", ")}</span>
              ) : null}
              {issue.path ? <span className={styles.issuePath}>{issue.path}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * The side panel of the workspace: the model on screen (the "New model" button and the example switch, the
 * counts of its nodes, members and supports, and its issues) and the item selected in the viewport: its
 * read-only rows, for a node the fields of its X, Y and Z, and a Delete button that removes the node or the
 * member with what depends on it as one undo step.
 */
export function SidePanel({
  model,
  issues,
  fixtureSwitch,
}: {
  model: Model;
  issues: ModelIssue[];
  fixtureSwitch: ReactNode;
}) {
  const selection = useViewportStore((state) => state.selection);
  const rows = selectionRows(model, selection);
  const selectedNode =
    selection?.kind === "node"
      ? model.nodes.find((candidate) => candidate.id === selection.id)
      : undefined;
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
        <Issues issues={issues} />
      </section>
      <section aria-labelledby="workspace-panel-title" aria-live="polite" className={styles.block}>
        <h2 className={styles.blockTitle} id="workspace-panel-title">
          {t("workspace.panel.title")}
        </h2>
        {rows ? (
          <>
            <dl className={styles.rows} data-testid="selection">
              {rows.map(([label, value]) => (
                <div className={styles.row} key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {selectedNode ? <NodeCoordinates node={selectedNode} /> : null}
            <button
              className={styles.danger}
              data-testid="delete-selection"
              onClick={() => deleteSelection()}
              type="button"
            >
              {t("workspace.selection.delete")}
            </button>
          </>
        ) : (
          <p className={styles.empty} data-testid="selection-empty">
            {t("workspace.panel.empty")}
          </p>
        )}
      </section>
    </aside>
  );
}
