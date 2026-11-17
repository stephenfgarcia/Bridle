"use client";

import type { MessageId } from "@bridle/i18n";
import { type Model, planarTruss, portalFrame, simplySupportedBeam } from "@bridle/model";
import { useId, useMemo, useState } from "react";
import { t } from "../../i18n";
import { Viewport } from "../viewport/Viewport";
import { useViewportStore } from "../viewport/viewportStore";
import { SidePanel } from "./SidePanel";
import styles from "./WorkspaceView.module.css";

// Until the model store exists (card W3), the workspace shows one of the three fixtures of @bridle/model.
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

/** The two areas of the workspace: the viewport of the model on screen and the side panel about it. */
export function WorkspaceView() {
  const [fixture, setFixture] = useState<FixtureId>("portal");
  const model = useMemo(() => FIXTURES[fixture].build(), [fixture]);
  const switchId = useId();
  return (
    <>
      <section
        aria-label={t("workspace.viewport.label")}
        className={styles.viewport}
        data-testid="viewport"
      >
        <Viewport frameKey={fixture} model={model} />
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
                  setFixture(event.target.value);
                }
              }}
              value={fixture}
            >
              {FIXTURE_IDS.map((id) => (
                <option key={id} value={id}>
                  {t(FIXTURES[id].name)}
                </option>
              ))}
            </select>
          </div>
        }
        model={model}
      />
    </>
  );
}
