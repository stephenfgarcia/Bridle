"use client";

import type { MessageId } from "@bridle/i18n";
import type { Model } from "@bridle/model";
import { t } from "../../i18n";
import { useToolStore } from "../tools/toolStore";
import { activeLoadCaseId } from "../viewport/loads";
import { singleItem } from "../viewport/selection";
import { useViewportStore } from "../viewport/viewportStore";
import panelStyles from "../workspace/Panels.module.css";
import workspaceStyles from "../workspace/WorkspaceView.module.css";
import styles from "./Analysis.module.css";
import { shownResults } from "./analysisState";
import { useAnalysisStore } from "./analysisStore";
import {
  type DisplacementComponent,
  displacementCells,
  type ForceComponent,
  memberEndCells,
  type ResultCell,
  type ResultUnit,
  reactionForceSums,
  reactionRows,
} from "./results";

type Component = ForceComponent | DisplacementComponent;

const COMPONENT_NAME: Record<Component, MessageId> = {
  fx: "workspace.results.fx",
  fy: "workspace.results.fy",
  fz: "workspace.results.fz",
  mx: "workspace.results.mx",
  my: "workspace.results.my",
  mz: "workspace.results.mz",
  ux: "workspace.support.ux",
  uy: "workspace.support.uy",
  uz: "workspace.support.uz",
  rx: "workspace.support.rx",
  ry: "workspace.support.ry",
  rz: "workspace.support.rz",
};

const UNIT_MESSAGE: Record<ResultUnit, MessageId> = {
  kN: "workspace.loads.valueKN",
  kNm: "workspace.loads.valueKNm",
  mm: "workspace.results.valueMm",
  rad: "workspace.results.valueRad",
};

/** Values in three columns: a component's name above its value with the unit. */
function Cells({ cells }: { cells: ResultCell<Component>[] }) {
  return (
    <dl className={styles.cells}>
      {cells.map((cell) => (
        <div className={styles.cell} key={cell.component}>
          <dt>{t(COMPONENT_NAME[cell.component])}</dt>
          <dd data-component={cell.component} data-testid="result-value">
            {t(UNIT_MESSAGE[cell.unit], { value: cell.text })}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The Results section of the side panel (card PX-02.8), for the active load case: the reactions at every
 * support with the sums of their forces, the displacement of the selected node, and the end forces of the
 * selected member (when exactly one item is selected; else a line that says what to select). It renders nothing while there is no result to show beside `model` (`shownResults`:
 * results of an earlier model are shown only while the answer for `model` is awaited, and then marked as
 * stale).
 */
export function ResultsPanel({ model }: { model: Model }) {
  const analysis = useAnalysisStore((state) => state.analysis);
  const chosenLoadCase = useToolStore((state) => state.loadCaseId);
  const selected = useViewportStore((state) => state.selection);
  // The displacement and the end forces are those of the one selected item; with several items selected the
  // section shows the reactions and says to select one (card PX-02.6).
  const selection = singleItem(selected);
  const shown = shownResults(analysis, model);
  if (shown === null) {
    return null;
  }
  const { result, stale } = shown;
  const loadCaseId = activeLoadCaseId(model, chosenLoadCase);
  const loadCase =
    loadCaseId !== null && Object.hasOwn(result.loadCases, loadCaseId)
      ? result.loadCases[loadCaseId]
      : undefined;
  const loadCaseName = model.loadCases.find((candidate) => candidate.id === loadCaseId)?.name;
  const nodeId = selection?.kind === "node" ? selection.id : null;
  const memberId = selection?.kind === "member" ? selection.id : null;
  const member =
    memberId === null ? undefined : shown.model.members.find((entry) => entry.id === memberId);
  const displacement = loadCase && nodeId !== null ? displacementCells(loadCase, nodeId) : null;
  const endForces = loadCase && member ? memberEndCells(loadCase, member.id) : null;
  return (
    <section
      aria-labelledby="workspace-results-title"
      className={workspaceStyles.block}
      data-load-case={loadCaseId ?? ""}
      data-stale={stale ? "true" : "false"}
      data-testid="results"
    >
      <h2 className={workspaceStyles.blockTitle} id="workspace-results-title">
        {t("workspace.results.title")}
      </h2>
      {stale ? (
        <p className={styles.staleNote} data-testid="results-stale">
          {t("workspace.results.stale")}
        </p>
      ) : null}
      {loadCaseId === null ? (
        <p className={panelStyles.help}>{t("workspace.results.noLoadCase")}</p>
      ) : loadCase === undefined ? (
        <p className={panelStyles.help} data-testid="results-none">
          {t("workspace.results.noCaseResult")}
        </p>
      ) : (
        <div className={stale ? styles.stale : styles.fresh}>
          <p className={styles.caseName}>
            {t("workspace.results.loadCase", { name: loadCaseName ?? loadCaseId })}
          </p>
          <div className={styles.part} data-testid="reactions">
            <h3 className={panelStyles.legend}>{t("workspace.results.reactions")}</h3>
            <p className={panelStyles.help}>{t("workspace.results.reactionsHelp")}</p>
            {reactionRows(loadCase, result.nodeIds).map((row) => (
              <div
                className={styles.card}
                data-node={row.nodeId}
                data-testid="reaction"
                key={row.nodeId}
              >
                <p className={styles.cardTitle}>
                  {t("workspace.results.node", { id: row.nodeId })}
                </p>
                <Cells cells={row.cells} />
              </div>
            ))}
            <div className={styles.card} data-testid="reaction-sum">
              <p className={styles.cardTitle}>{t("workspace.results.sum")}</p>
              <Cells cells={reactionForceSums(loadCase)} />
            </div>
          </div>
          {nodeId !== null ? (
            <div className={styles.part} data-node={nodeId} data-testid="node-displacement">
              <h3 className={panelStyles.legend}>
                {t("workspace.results.displacement", { id: nodeId })}
              </h3>
              {displacement ? (
                <>
                  <p className={panelStyles.help}>{t("workspace.results.displacementHelp")}</p>
                  <div className={styles.card}>
                    <Cells cells={displacement} />
                  </div>
                </>
              ) : (
                <p className={panelStyles.help}>{t("workspace.results.noNodeResult")}</p>
              )}
            </div>
          ) : null}
          {memberId !== null ? (
            <div className={styles.part} data-member={memberId} data-testid="member-end-forces">
              <h3 className={panelStyles.legend}>
                {t("workspace.results.endForces", { id: memberId })}
              </h3>
              {member && endForces ? (
                <>
                  <p className={panelStyles.help}>{t("workspace.results.endForcesHelp")}</p>
                  <div className={styles.card} data-end="start" data-testid="member-end">
                    <p className={styles.cardTitle}>
                      {t("workspace.results.start", { node: member.startNodeId })}
                    </p>
                    <Cells cells={endForces.start} />
                  </div>
                  <div className={styles.card} data-end="end" data-testid="member-end">
                    <p className={styles.cardTitle}>
                      {t("workspace.results.end", { node: member.endNodeId })}
                    </p>
                    <Cells cells={endForces.end} />
                  </div>
                </>
              ) : (
                <p className={panelStyles.help}>{t("workspace.results.noMemberResult")}</p>
              )}
            </div>
          ) : null}
          {nodeId === null && memberId === null ? (
            <p className={panelStyles.help} data-testid="results-hint">
              {selected.length > 1
                ? t("workspace.results.selectOne")
                : t("workspace.results.selectHint")}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
