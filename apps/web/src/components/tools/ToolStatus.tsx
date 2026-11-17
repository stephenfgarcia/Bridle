"use client";

import type { MessageId } from "@bridle/i18n";
import { t } from "../../i18n";
import type { ToolNotice } from "./drawTools";
import styles from "./Tools.module.css";
import { type Tool, useToolStore } from "./toolStore";
import { formatCoordinate } from "./workPlane";

const HINT: Record<Tool, MessageId> = {
  select: "workspace.viewport.help",
  node: "workspace.tools.hintNode",
  member: "workspace.tools.hintMember",
};

export const NOTICE_MESSAGE: Record<ToolNotice, MessageId> = {
  "same-node": "workspace.notice.sameNode",
  "duplicate-member": "workspace.notice.duplicateMember",
  "no-section": "workspace.notice.noSection",
  occupied: "workspace.notice.occupied",
  refused: "workspace.notice.refused",
};

/**
 * The lines in the bottom left corner of the viewport (card PX-02.4): the last notice of a tool (why the model
 * was left unchanged), the X, Y, Z of the marker in metres while there is one (or that the pointer is not over
 * the work plane in this view), and what the active tool does. The last line is a status region, so a change
 * of tool is announced.
 */
export function ToolStatus() {
  const tool = useToolStore((state) => state.tool);
  const cursor = useToolStore((state) => state.cursor);
  const problem = useToolStore((state) => state.cursorProblem);
  const drag = useToolStore((state) => state.drag);
  const notice = useToolStore((state) => state.notice);
  const point = drag?.point ?? cursor?.point ?? null;
  return (
    <div className={styles.status}>
      {notice ? (
        <p className={styles.notice} data-notice={notice} data-testid="tool-notice" role="alert">
          {t(NOTICE_MESSAGE[notice])}
        </p>
      ) : null}
      {point ? (
        <p className={styles.readout} data-testid="cursor-readout">
          {t("workspace.cursor.readout", {
            x: formatCoordinate(point[0]),
            y: formatCoordinate(point[1]),
            z: formatCoordinate(point[2]),
          })}
        </p>
      ) : problem ? (
        <p className={styles.problem} data-testid="cursor-problem">
          {t("workspace.cursor.offPlane")}
        </p>
      ) : null}
      <p className={styles.hint} data-testid="tool-hint" role="status">
        {t(HINT[tool])}
      </p>
    </div>
  );
}
