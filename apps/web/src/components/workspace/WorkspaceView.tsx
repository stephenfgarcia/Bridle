"use client";

import type { MessageId } from "@bridle/i18n";
import { type Model, planarTruss, portalFrame, simplySupportedBeam } from "@bridle/model";
import { useEffect, useId } from "react";
import { t } from "../../i18n";
import { selectFrameKey, selectIssues, selectModel, useModelStore } from "../model/modelStore";
import { handleHistoryKey } from "../model/shortcuts";
import { NEW_MODEL_SOURCE } from "../tools/newModel";
import { loadModel, runToolKey, startNewModel } from "../tools/toolActions";
import { toolKeyAction } from "../tools/toolKeys";
import { Viewport } from "../viewport/Viewport";
import { HistoryControls } from "./HistoryControls";
import { SidePanel } from "./SidePanel";
import styles from "./WorkspaceView.module.css";

// The example models the switch of the side panel loads into the model store: the three fixtures of
// @bridle/model. The store starts with the portal frame (`INITIAL_SOURCE` in ../model/modelStore.ts).
const FIXTURES = {
  beam: { build: simplySupportedBeam, name: "workspace.fixture.beam" },
  portal: { build: portalFrame, name: "workspace.fixture.portal" },
  truss: { build: planarTruss, name: "workspace.fixture.truss" },
} as const satisfies Record<string, { build: () => Model; name: MessageId }>;

type FixtureId = keyof typeof FIXTURES;

const FIXTURE_IDS = Object.keys(FIXTURES) as FixtureId[];

function isFixtureId(value: string): value is FixtureId {
  return value in FIXTURES;
}

/**
 * The two areas of the workspace: the viewport of the model in the model store, with the Undo and Redo buttons,
 * and the side panel about it. While it is mounted, the undo and redo shortcuts act on the store (Ctrl or Cmd
 * with Z; Ctrl or Cmd with Shift and Z, or Ctrl with Y), except when the key is pressed in a text field, and so
 * do the keys of the tools (../tools/toolKeys.ts: V, N, M, Escape, Delete and Backspace).
 */
export function WorkspaceView() {
  const model = useModelStore(selectModel);
  const issues = useModelStore(selectIssues);
  const frameKey = useModelStore(selectFrameKey);
  const source = useModelStore((state) => state.source);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (handleHistoryKey(event, useModelStore.getState())) {
        return;
      }
      const action = toolKeyAction(event);
      if (action !== null) {
        if (action.type !== "escape") {
          event.preventDefault();
        }
        runToolKey(action);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  const switchId = useId();
  return (
    <>
      <section
        aria-label={t("workspace.viewport.label")}
        className={styles.viewport}
        data-testid="viewport"
      >
        <Viewport frameKey={frameKey} model={model} />
        <HistoryControls />
      </section>
      <SidePanel
        fixtureSwitch={
          <div className={styles.field}>
            <button
              className={styles.action}
              data-testid="new-model"
              onClick={() => startNewModel(() => window.confirm(t("workspace.model.newConfirm")))}
              type="button"
            >
              {t("workspace.model.new")}
            </button>
            <label className={styles.fieldLabel} htmlFor={switchId}>
              {t("workspace.fixture.label")}
            </label>
            <select
              className={styles.select}
              data-testid="fixture-switch"
              id={switchId}
              onChange={(event) => {
                if (isFixtureId(event.target.value)) {
                  // Loading a model drops the selection (the ids of one model mean nothing in another)
                  // and the undo steps, and frames the new model.
                  loadModel(FIXTURES[event.target.value].build(), event.target.value);
                }
              }}
              value={source}
            >
              {source === NEW_MODEL_SOURCE ? (
                <option disabled value={NEW_MODEL_SOURCE}>
                  {t("workspace.fixture.none")}
                </option>
              ) : null}
              {FIXTURE_IDS.map((id) => (
                <option key={id} value={id}>
                  {t(FIXTURES[id].name)}
                </option>
              ))}
            </select>
          </div>
        }
        issues={issues}
        model={model}
      />
    </>
  );
}
