"use client";

import type { MessageId } from "@bridle/i18n";
import type { Model } from "@bridle/model";
import { useState } from "react";
import { t } from "../../i18n";
import {
  type OutOfPlaneOutcome,
  type OutOfPlaneResult,
  RESTRAINT_KEYS,
  type RestraintKey,
  restraintsOf,
} from "../tools/supportLoadTools";
import { restrainOutOfPlaneAction, setRestraintAction } from "../tools/toolActions";
import styles from "./Panels.module.css";
import workspaceStyles from "./WorkspaceView.module.css";

const RESTRAINT_NAME: Record<RestraintKey, MessageId> = {
  ux: "workspace.support.ux",
  uy: "workspace.support.uy",
  uz: "workspace.support.uz",
  rx: "workspace.support.rx",
  ry: "workspace.support.ry",
  rz: "workspace.support.rz",
};

/**
 * The support of the selected node as six checkboxes, `ux`, `uy`, `uz` (translations along the global axes)
 * and `rx`, `ry`, `rz` (rotations about them); checked is restrained. A change is applied at once as one undo
 * step; clearing the last one removes the support.
 */
export function NodeSupport({ model, nodeId }: { model: Model; nodeId: string }) {
  const restraints = restraintsOf(model, nodeId);
  return (
    <fieldset className={styles.group} data-testid="node-support">
      <legend className={styles.legend}>{t("workspace.support.legend")}</legend>
      <div className={styles.restraints}>
        {RESTRAINT_KEYS.map((key) => (
          <label className={styles.check} key={key}>
            <input
              checked={restraints[key]}
              data-testid={`restraint-${key}`}
              onChange={(event) => setRestraintAction(nodeId, key, event.target.checked)}
              type="checkbox"
            />
            <span>{t(RESTRAINT_NAME[key])}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const OUTCOME_MESSAGE: Record<Exclude<OutOfPlaneOutcome, "done">, MessageId> = {
  already: "workspace.planar.already",
  "no-nodes": "workspace.planar.noNodes",
  "not-planar": "workspace.planar.notPlanar",
};

/**
 * "Restrain out of plane": the button, a line that says what it does, and, after a press, what it did (how
 * many nodes got a restraint) or why it did nothing. That last line goes when the model changes again, also
 * by an undo.
 */
export function PlanarHelper({ model }: { model: Model }) {
  const [last, setLast] = useState<OutOfPlaneResult | null>(null);
  const shown = last !== null && last.model === model ? last : null;
  return (
    <div className={styles.helper}>
      <button
        className={workspaceStyles.action}
        data-testid="restrain-out-of-plane"
        onClick={() => setLast(restrainOutOfPlaneAction())}
        type="button"
      >
        {t("workspace.planar.button")}
      </button>
      <p className={styles.help}>{t("workspace.planar.help")}</p>
      {shown ? (
        <p
          className={shown.outcome === "done" ? styles.result : styles.refusal}
          data-outcome={shown.outcome}
          data-testid="restrain-result"
          role="status"
        >
          {shown.outcome === "done"
            ? t("workspace.planar.done", { count: shown.changed })
            : t(OUTCOME_MESSAGE[shown.outcome])}
        </p>
      ) : null}
    </div>
  );
}
