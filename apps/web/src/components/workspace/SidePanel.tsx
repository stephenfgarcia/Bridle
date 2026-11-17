"use client";

import { distance, type Model, type ModelIssue, type Node as ModelNode } from "@bridle/model";
import { type ReactNode, useId } from "react";
import { t } from "../../i18n";
import { ISSUE_MESSAGE } from "../model/issueMessages";
import { NumberField } from "../tools/NumberField";
import { deleteSelection, moveNodeAction } from "../tools/toolActions";
import { formatCoordinate } from "../tools/workPlane";
import { type ItemRef, useViewportStore } from "../viewport/viewportStore";
import { LoadCases, MemberLoads, NodeLoads } from "./LoadPanels";
import { NodeSupport, PlanarHelper } from "./SupportPanels";
import styles from "./WorkspaceView.module.css";

/** The length of a member in m; `undefined` when the model does not hold it or one of its nodes. */
function memberLength(model: Model, memberId: string): number | undefined {
  const member = model.members.find((candidate) => candidate.id === memberId);
  const start = member && model.nodes.find((node) => node.id === member.startNodeId);
  const end = member && model.nodes.find((node) => node.id === member.endNodeId);
  return start && end ? distance(start, end) : undefined;
}

/**
 * The read-only rows of the selected item, as label and value; `undefined` when the model does not hold it.
 * A node's coordinates are not among them: they are the fields of `NodeCoordinates`. A member's rows include
 * its length when both of its nodes are in the model.
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
    const length = memberLength(model, member.id);
    const rows: [string, string][] = [
      [t("workspace.selection.kind"), t("workspace.selection.kindMember")],
      [t("workspace.selection.id"), member.id],
      [t("workspace.selection.start"), member.startNodeId],
      [t("workspace.selection.end"), member.endNodeId],
      [t("workspace.selection.section"), named(model.sections, member.sectionId)],
      [t("workspace.selection.material"), named(model.materials, member.materialId)],
    ];
    if (length !== undefined) {
      rows.splice(4, 0, [t("workspace.selection.length"), formatCoordinate(length)]);
    }
    return rows;
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
 * The Issues section: "No issues", or their number and one entry per issue with its message from the catalog,
 * the ids it concerns and, where the issue has one, its place in the model.
 */
function Issues({ issues }: { issues: ModelIssue[] }) {
  return (
    <div className={styles.issues}>
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
 * The side panel of the workspace, in four sections:
 * - Model: the "New model" button and the example switch, the counts of the nodes, members and supports, and
 *   "Restrain out of plane";
 * - Loads: the load cases with the number of their loads, the choice of the active one, "Add load case";
 * - Issues: what `validateModel` reports;
 * - Properties: the item selected in the viewport. Its read-only rows; for a node the fields of its X, Y and
 *   Z, the six checkboxes of its support and its nodal loads; for a member its loads and the two buttons that
 *   open the forms of a new uniform or point load; and a Delete button that removes the node or the member
 *   with what depends on it as one undo step. The lists show the loads of the active load case.
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
  const selectedMember =
    selection?.kind === "member"
      ? model.members.find((candidate) => candidate.id === selection.id)
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
        <PlanarHelper model={model} />
      </section>
      <section
        aria-labelledby="workspace-loads-title"
        className={styles.block}
        data-testid="loads-section"
      >
        <h2 className={styles.blockTitle} id="workspace-loads-title">
          {t("workspace.loadCases.title")}
        </h2>
        <LoadCases model={model} />
      </section>
      <section aria-labelledby="workspace-issues-title" className={styles.block}>
        <h2 className={styles.blockTitle} id="workspace-issues-title">
          {t("workspace.issues.title")}
        </h2>
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
            {selectedNode ? (
              <>
                <NodeCoordinates node={selectedNode} />
                <NodeSupport model={model} nodeId={selectedNode.id} />
                <NodeLoads model={model} nodeId={selectedNode.id} />
              </>
            ) : null}
            {selectedMember ? (
              <MemberLoads
                key={selectedMember.id}
                length={memberLength(model, selectedMember.id)}
                memberId={selectedMember.id}
                model={model}
              />
            ) : null}
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
