"use client";

import { t } from "../../i18n";
import { selectCanRedo, selectCanUndo, useModelStore } from "../model/modelStore";
import viewportStyles from "../viewport/Viewport.module.css";
import styles from "./WorkspaceView.module.css";

/**
 * The Undo and Redo buttons of the workspace (card PX-02.3), in the top right corner of the viewport area.
 * Each is disabled while the model store has no step for it. The keyboard shortcuts are attached by
 * ./WorkspaceView.tsx.
 */
export function HistoryControls() {
  const canUndo = useModelStore(selectCanUndo);
  const canRedo = useModelStore(selectCanRedo);
  const undo = useModelStore((state) => state.undo);
  const redo = useModelStore((state) => state.redo);
  return (
    // biome-ignore lint/a11y/useSemanticElements: a group of buttons, not a form's fieldset
    <div
      aria-label={t("workspace.history.label")}
      className={`${viewportStyles.group} ${styles.history}`}
      role="group"
    >
      <button
        className={viewportStyles.button}
        data-testid="undo"
        disabled={!canUndo}
        onClick={undo}
        type="button"
      >
        {t("workspace.history.undo")}
      </button>
      <button
        className={viewportStyles.button}
        data-testid="redo"
        disabled={!canRedo}
        onClick={redo}
        type="button"
      >
        {t("workspace.history.redo")}
      </button>
    </div>
  );
}
