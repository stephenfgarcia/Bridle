"use client";

import type { MessageId } from "@bridle/i18n";
import type { Model } from "@bridle/model";
import { t } from "../../i18n";
import { useToolStore } from "../tools/toolStore";
import { type LabelLinks, putLabel } from "../viewport/LoadGlyphs";
import { activeLoadCaseId } from "../viewport/loads";
import { aimReadout, READOUT_KEY } from "../viewport/ResultGlyphs";
import { readoutNodeId } from "../viewport/selection";
import viewportStyles from "../viewport/Viewport.module.css";
import { useViewportStore } from "../viewport/viewportStore";
import styles from "./Analysis.module.css";
import { shownResults } from "./analysisState";
import { useAnalysisStore } from "./analysisStore";
import { type DisplacementComponent, displacementCells, type ResultUnit } from "./results";

const COMPONENT_NAME: Record<DisplacementComponent, MessageId> = {
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

/**
 * The displacement of one node in a small card beside it in the viewport (card PX-02.9): the node under the
 * pointer, or else the one node that is selected (`readoutNodeId`). Three translations in mm and three
 * rotations in rad, in global axes, for the active load case, with the numbers of the Results section
 * (`displacementCells`). Nothing while there are no results to show beside `model`, or none for that node;
 * half faded while the results are stale.
 *
 * It is HTML over the canvas that the pointer does not pick. `Results` of ../viewport/ResultGlyphs.tsx holds
 * its place in the scene (the node, where the model of the results has it) and moves it on every drawn frame;
 * the card goes from the node towards the middle of the viewport (`aimReadout`).
 */
export function NodeReadout({ model, links }: { model: Model; links: LabelLinks }) {
  const analysis = useAnalysisStore((state) => state.analysis);
  const chosenLoadCase = useToolStore((state) => state.loadCaseId);
  const hover = useViewportStore((state) => state.hover);
  const selection = useViewportStore((state) => state.selection);
  const nodeId = readoutNodeId(hover, selection);
  const shown = shownResults(analysis, model);
  const loadCaseId = activeLoadCaseId(model, chosenLoadCase);
  if (nodeId === null || shown === null || loadCaseId === null) {
    return null;
  }
  const { result } = shown;
  const loadCase = Object.hasOwn(result.loadCases, loadCaseId)
    ? result.loadCases[loadCaseId]
    : undefined;
  const cells = loadCase ? displacementCells(loadCase, nodeId) : null;
  if (cells === null) {
    return null;
  }
  return (
    <div className={viewportStyles.loadLabels}>
      <div
        className={`${viewportStyles.loadLabel} ${styles.readoutAt}`}
        ref={(element) => {
          if (element) {
            links.elements.set(READOUT_KEY, element);
            // The canvas may have drawn this frame before the element was there.
            const place = links.places.get(READOUT_KEY);
            putLabel(element, place);
            aimReadout(element, place);
          } else {
            links.elements.delete(READOUT_KEY);
          }
        }}
      >
        <div
          className={shown.stale ? `${styles.readout} ${styles.readoutStale}` : styles.readout}
          data-node={nodeId}
          data-source={hover?.kind === "node" ? "hover" : "selection"}
          data-testid="node-readout"
        >
          <p className={styles.readoutTitle}>
            {t("workspace.results.displacement", { id: nodeId })}
          </p>
          <dl className={styles.readoutCells}>
            {cells.map((cell) => (
              <div className={styles.readoutCell} key={cell.component}>
                <dt>{t(COMPONENT_NAME[cell.component])}</dt>
                <dd data-component={cell.component} data-testid="readout-value">
                  {t(UNIT_MESSAGE[cell.unit], { value: cell.text })}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
