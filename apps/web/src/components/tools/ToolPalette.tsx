"use client";

import type { MessageId } from "@bridle/i18n";
import { useId } from "react";
import { t } from "../../i18n";
import { selectModel, useModelStore } from "../model/modelStore";
import { activeLoadCaseId } from "../viewport/loads";
import viewportStyles from "../viewport/Viewport.module.css";
import { NumberField } from "./NumberField";
import {
  formComponent,
  isMoment,
  NODAL_COMPONENTS,
  type NodalComponent,
  SUPPORT_CHOICES,
  type SupportChoice,
} from "./supportLoadTools";
import styles from "./Tools.module.css";
import { chooseTool } from "./toolActions";
import { TOOL_KEYS } from "./toolKeys";
import { TOOLS, type Tool, useToolStore } from "./toolStore";
import { isSnapStep, SNAP_STEPS, WORK_PLANE_KINDS, type WorkPlaneKind } from "./workPlane";

export const TOOL_NAME: Record<Tool, MessageId> = {
  select: "workspace.tools.select",
  node: "workspace.tools.node",
  member: "workspace.tools.member",
  support: "workspace.tools.support",
  load: "workspace.tools.load",
};

/** The name of each choice of the Support tool; it says what the choice restrains. */
export const SUPPORT_NAME: Record<SupportChoice, MessageId> = {
  fixed: "workspace.support.fixed",
  pinned: "workspace.support.pinned",
  roller: "workspace.support.roller",
};

/** The name of each component of a nodal load: a force along, or a moment about, a global axis. */
export const COMPONENT_NAME: Record<NodalComponent, MessageId> = {
  fx: "workspace.loads.component.fx",
  fy: "workspace.loads.component.fy",
  fz: "workspace.loads.component.fz",
  mx: "workspace.loads.component.mx",
  my: "workspace.loads.component.my",
  mz: "workspace.loads.component.mz",
};

function isComponent(value: string): value is NodalComponent {
  return (NODAL_COMPONENTS as readonly string[]).includes(value);
}

/**
 * The options of the active tool, beside the palette (card PX-02.5). Support tool: which support a click
 * places. Load tool: the load case the load goes into (the active one, as in the side panel's Loads section),
 * the component (a force along X, Y or Z or a moment about one of them, in global axes) and the signed value
 * with its unit. The other tools have no options.
 */
function ToolOptions() {
  const tool = useToolStore((state) => state.tool);
  const supportChoice = useToolStore((state) => state.supportChoice);
  const loadForm = useToolStore((state) => state.loadForm);
  const wantedCase = useToolStore((state) => state.loadCaseId);
  const model = useModelStore(selectModel);
  const choiceId = useId();
  const caseId = useId();
  const valueId = useId();
  if (tool === "support") {
    return (
      <div className={styles.settings} data-testid="tool-options">
        <label className={styles.settingLabel} htmlFor={choiceId}>
          {t("workspace.support.choice")}
        </label>
        <select
          className={styles.setting}
          data-testid="support-choice"
          id={choiceId}
          onChange={(event) => {
            const choice = SUPPORT_CHOICES.find((candidate) => candidate === event.target.value);
            if (choice) {
              useToolStore.getState().setSupportChoice(choice);
            }
          }}
          value={supportChoice}
        >
          {SUPPORT_CHOICES.map((choice) => (
            <option key={choice} value={choice}>
              {t(SUPPORT_NAME[choice])}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (tool !== "load") {
    return null;
  }
  const component = formComponent(loadForm);
  return (
    <div className={styles.settings} data-testid="tool-options">
      <label className={styles.settingLabel} htmlFor={caseId}>
        {t("workspace.loads.case")}
      </label>
      <select
        className={styles.setting}
        data-testid="load-tool-case"
        id={caseId}
        onChange={(event) => useToolStore.getState().setLoadCaseId(event.target.value)}
        value={activeLoadCaseId(model, wantedCase) ?? ""}
      >
        {model.loadCases.map((loadCase) => (
          <option key={loadCase.id} value={loadCase.id}>
            {loadCase.name}
          </option>
        ))}
      </select>
      <select
        aria-label={t("workspace.loads.componentLabel")}
        className={styles.setting}
        data-testid="load-tool-component"
        onChange={(event) => {
          const next = event.target.value;
          if (isComponent(next)) {
            useToolStore.getState().setLoadForm({
              kind: isMoment(next) ? "moment" : "force",
              direction: next.slice(1) as "x" | "y" | "z",
            });
          }
        }}
        title={t("workspace.loads.componentLabel")}
        value={component}
      >
        {NODAL_COMPONENTS.map((id) => (
          <option key={id} value={id}>
            {t(COMPONENT_NAME[id])}
          </option>
        ))}
      </select>
      <label className={styles.settingLabel} htmlFor={valueId}>
        {t(isMoment(component) ? "workspace.loads.field.kNm" : "workspace.loads.field.kN")}
      </label>
      <NumberField
        className={`${styles.setting} ${styles.offset}`}
        id={valueId}
        onCommit={(value) => useToolStore.getState().setLoadForm({ value })}
        testId="load-tool-value"
        value={loadForm.value}
      />
    </div>
  );
}

const PLANE_NAME: Record<WorkPlaneKind, MessageId> = {
  xz: "workspace.plane.xz",
  xy: "workspace.plane.xy",
};

const PLANE_OFFSET: Record<WorkPlaneKind, MessageId> = {
  xz: "workspace.plane.offsetY",
  xy: "workspace.plane.offsetZ",
};

/**
 * The tool palette of the viewport (card PX-02.4; Support and Load since card PX-02.5): the tools Select, Node,
 * Member, Support and Load, the active one pressed (`aria-pressed`) and filled; then the active tool's options,
 * if it has any; then the work plane (its kind, a select named "Work plane" for assistive
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
      <ToolOptions />
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
