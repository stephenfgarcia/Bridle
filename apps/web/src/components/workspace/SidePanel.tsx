"use client";

import {
  distance,
  type Member,
  type Model,
  type ModelIssue,
  type Node as ModelNode,
} from "@bridle/model";
import { type ReactNode, useId } from "react";
import { t } from "../../i18n";
import { AnalysisStatus } from "../analysis/AnalysisStatus";
import { ResultsPanel } from "../analysis/ResultsPanel";
import { ISSUE_MESSAGE } from "../model/issueMessages";
import { NumberField } from "../tools/NumberField";
import { deleteSelection, moveNodeAction } from "../tools/toolActions";
import { selectedItems } from "../viewport/selection";
import { useViewportStore } from "../viewport/viewportStore";
import { LibraryDialog } from "./LibraryDialog";
import { LoadCases, MemberLoads, NodeLoads } from "./LoadPanels";
import { MemberProperties } from "./MemberProperties";
import panelStyles from "./Panels.module.css";
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
 * The read-only rows of the one selected item, as label and value: its kind and its id, and for a member its
 * two nodes. A node's coordinates are the fields of `NodeCoordinates`; a member's section, material, roll
 * angle, length, type and releases are the rows of `MemberProperties`.
 */
function identityRows(node: ModelNode | undefined, member: Member | undefined): [string, string][] {
  if (node) {
    return [
      [t("workspace.selection.kind"), t("workspace.selection.kindNode")],
      [t("workspace.selection.id"), node.id],
    ];
  }
  if (member) {
    return [
      [t("workspace.selection.kind"), t("workspace.selection.kindMember")],
      [t("workspace.selection.id"), member.id],
      [t("workspace.selection.start"), member.startNodeId],
      [t("workspace.selection.end"), member.endNodeId],
    ];
  }
  return [];
}

/** How many nodes and members are selected, as text: "2 members", "1 node, 2 members". */
function selectionCount(nodes: number, members: number): string {
  if (members === 0) {
    return t("workspace.selection.countNodes", { nodes });
  }
  if (nodes === 0) {
    return t("workspace.selection.countMembers", { members });
  }
  return t("workspace.selection.countBoth", { nodes, members });
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
 * The side panel of the workspace: at its top the status of the live analysis (../analysis/AnalysisStatus.tsx,
 * card PX-02.8), which stays there while the rest scrolls, then four sections, and a fifth while there are
 * results:
 * - Model: the "New model" button and the example switch, the counts of the nodes, members and supports, and
 *   "Restrain out of plane";
 * - Loads: the load cases with the number of their loads, the choice of the active one, "Add load case";
 * - Results, only while the analysis has results to show (../analysis/ResultsPanel.tsx, card PX-02.8): the
 *   reactions of the active load case, the displacement of the selected node, the end forces of the selected
 *   member;
 * - Issues: what `validateModel` reports;
 * - Properties: what is selected in the viewport (card PX-02.6: one item or several, `selectedItems`).
 *   - One node: its kind and id, the fields of its X, Y and Z, the six checkboxes of its support and its nodal
 *     loads.
 *   - One member: its kind, id and nodes, the member fields (./MemberProperties.tsx), its loads and the two
 *     buttons that open the forms of a new uniform or point load.
 *   - Several items: how many nodes and members, the member fields for the selected members together when
 *     there is at least one, and a line that says what a single selection shows. No coordinates, support or
 *     loads.
 *   In each case a Delete button removes everything selected, with what depends on it, as one undo step. The
 *   lists show the loads of the active load case.
 * The Model section also has the "Sections and materials" button (./LibraryDialog.tsx).
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
  const selected = selectedItems(model, selection);
  const total = selected.nodes.length + selected.members.length;
  // The fields of a single item are shown when exactly one item is selected.
  const selectedNode = total === 1 ? selected.nodes[0] : undefined;
  const selectedMember = total === 1 ? selected.members[0] : undefined;
  const rows = identityRows(selectedNode, selectedMember);
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
      <AnalysisStatus />
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
        <LibraryDialog model={model} />
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
      <ResultsPanel model={model} />
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
        {total > 0 ? (
          <>
            <div
              className={panelStyles.loads}
              data-members={selected.members.length}
              data-nodes={selected.nodes.length}
              data-testid="selection"
            >
              <dl className={styles.rows}>
                {total > 1 ? (
                  <div className={styles.row}>
                    <dt>{t("workspace.selection.selected")}</dt>
                    <dd data-testid="selection-count">
                      {selectionCount(selected.nodes.length, selected.members.length)}
                    </dd>
                  </div>
                ) : null}
                {rows.map(([label, value]) => (
                  <div className={styles.row} key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              {selected.members.length > 0 ? (
                <MemberProperties members={selected.members} model={model} />
              ) : null}
              {total > 1 ? (
                <p className={panelStyles.help} data-testid="selection-multi-hint">
                  {t("workspace.selection.multiHint")}
                </p>
              ) : null}
            </div>
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
              {total > 1
                ? t("workspace.selection.deleteMany", { count: total })
                : t("workspace.selection.delete")}
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
