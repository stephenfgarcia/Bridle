"use client";

import type { MessageId } from "@bridle/i18n";
import { useId } from "react";
import { t } from "../../i18n";
import viewportStyles from "../viewport/Viewport.module.css";
import { NumberField } from "./NumberField";
import styles from "./Tools.module.css";
import { chooseTool } from "./toolActions";
import { TOOL_KEYS } from "./toolKeys";
import { TOOLS, type Tool, useToolStore } from "./toolStore";
import { isSnapStep, SNAP_STEPS, WORK_PLANE_KINDS, type WorkPlaneKind } from "./workPlane";

export const TOOL_NAME: Record<Tool, MessageId> = {
  select: "workspace.tools.select",
  node: "workspace.tools.node",
  member: "workspace.tools.member",
};

const PLANE_NAME: Record<WorkPlaneKind, MessageId> = {
  xz: "workspace.plane.xz",
  xy: "workspace.plane.xy",
};

const PLANE_OFFSET: Record<WorkPlaneKind, MessageId> = {
  xz: "workspace.plane.offsetY",
  xy: "workspace.plane.offsetZ",
};

/**
 * The tool palette of the viewport (card PX-02.4): the tools Select, Node and Member, the active one pressed
 * (`aria-pressed`) and filled; then the work plane (its kind, a select named "Work plane" for assistive
 * technology and by its tooltip, and its position along the axis it is normal to) and the snap step. A tool's
 * tooltip names its key. Choosing another kind of plane puts the plane at 0.
 */
export function ToolPalette() {
  const tool = useToolStore((state) => state.tool);
  const plane = useToolStore((state) => state.plane);
  const snapStep = useToolStore((state) => state.snapStep);
  const offsetId = useId();
  const snapId = useId();
  return (
    <>
      <div
        aria-label={t("workspace.tools.label")}
        className={viewportStyles.group}
        data-testid="tool-palette"
        role="toolbar"
      >
        {TOOLS.map((id) => (
          <button
            aria-keyshortcuts={TOOL_KEYS[id]}
            aria-pressed={tool === id}
            className={
              tool === id ? `${viewportStyles.button} ${styles.active}` : viewportStyles.button
            }
            data-tool={id}
            key={id}
            onClick={() => chooseTool(id)}
            title={t("workspace.tools.tooltip", { tool: t(TOOL_NAME[id]), key: TOOL_KEYS[id] })}
            type="button"
          >
            {t(TOOL_NAME[id])}
          </button>
        ))}
      </div>
      <div className={styles.settings}>
        <select
          aria-label={t("workspace.plane.label")}
          className={styles.setting}
          data-testid="work-plane"
          title={t("workspace.plane.label")}
          onChange={(event) => {
            const kind = WORK_PLANE_KINDS.find((candidate) => candidate === event.target.value);
            if (kind) {
              useToolStore.getState().setPlane({ kind, offset: 0 });
            }
          }}
          value={plane.kind}
        >
          {WORK_PLANE_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(PLANE_NAME[kind])}
            </option>
          ))}
        </select>
        <label className={styles.settingLabel} htmlFor={offsetId}>
          {t(PLANE_OFFSET[plane.kind])}
        </label>
        <NumberField
          className={`${styles.setting} ${styles.offset}`}
          id={offsetId}
          onCommit={(offset) => useToolStore.getState().setPlane({ kind: plane.kind, offset })}
          testId="work-plane-offset"
          value={plane.offset}
        />
        <label className={styles.settingLabel} htmlFor={snapId}>
          {t("workspace.snap.label")}
        </label>
        <select
          className={styles.setting}
          data-testid="snap-step"
          id={snapId}
          onChange={(event) => {
            const step = Number(event.target.value);
            if (isSnapStep(step)) {
              useToolStore.getState().setSnapStep(step);
            }
          }}
          value={snapStep}
        >
          {SNAP_STEPS.map((step) => (
            <option key={step} value={step}>
              {t("workspace.snap.step", { step: String(step) })}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
