"use client";

import type { MessageId } from "@bridle/i18n";
import { type Model, planarTruss, portalFrame, simplySupportedBeam } from "@bridle/model";
import { useEffect, useId } from "react";
import { t } from "../../i18n";
import { selectFrameKey, selectIssues, selectModel, useModelStore } from "../model/modelStore";
import { handleHistoryKey } from "../model/shortcuts";
import { Viewport } from "../viewport/Viewport";
import { useViewportStore } from "../viewport/viewportStore";
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
 * with Z; Ctrl or Cmd with Shift and Z, or Ctrl with Y), except when the key is pressed in a text field.
 */
export function WorkspaceView() {
  const model = useModelStore(selectModel);
  const issues = useModelStore(selectIssues);
  const frameKey = useModelStore(selectFrameKey);
  const source = useModelStore((state) => state.source);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      handleHistoryKey(event, useModelStore.getState());
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
            <label className={styles.fieldLabel} htmlFor={switchId}>
              {t("workspace.fixture.label")}
            </label>
            <select
              className={styles.select}
              data-testid="fixture-switch"
              id={switchId}
              onChange={(event) => {
                if (isFixtureId(event.target.value)) {
                  // The ids of one fixture mean nothing in another.
                  useViewportStore.getState().select(null);
                  useViewportStore.getState().setHover(null);
                  // Loading a model drops the undo steps and frames the new model.
                  useModelStore
                    .getState()
                    .replaceModel(FIXTURES[event.target.value].build(), event.target.value);
                }
              }}
              value={source}
            >
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
