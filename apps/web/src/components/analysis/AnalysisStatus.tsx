"use client";

import { t } from "../../i18n";
import { selectModel, useModelStore } from "../model/modelStore";
import { restrainOutOfPlaneAction } from "../tools/toolActions";
import panelStyles from "../workspace/Panels.module.css";
import styles from "./Analysis.module.css";
import { useAnalysisStore } from "./analysisStore";
import { formatMs, formatRatio } from "./format";
import {
  analysisStatus,
  FAILURE_MESSAGE,
  failureDetail,
  memberList,
  STATUS_TITLE,
  type AnalysisStatus as Status,
  UNSTABLE_WHERE,
  UNSUPPORTED_MESSAGE,
} from "./status";

/** The lines under the title, for the statuses that have any. */
function Details({ status }: { status: Status }) {
  const retry = useAnalysisStore((state) => state.retry);
  switch (status.kind) {
    case "analysing":
      return status.stale ? (
        <p className={styles.line}>{t("workspace.analysis.analysingStale")}</p>
      ) : null;
    case "analysed":
      return status.lostAccuracy ? (
        <p className={styles.warning} data-testid="analysis-warning">
          {t("workspace.analysis.lostAccuracy", {
            ratio: formatRatio(status.smallestPivotRatio),
          })}
        </p>
      ) : null;
    case "issues":
      return (
        <p className={styles.line}>
          {t("workspace.analysis.issuesCount", { count: status.count })}
        </p>
      );
    case "unstable":
      return (
        <>
          <p className={styles.line} data-testid="analysis-where">
            {t(UNSTABLE_WHERE[status.dof], { node: status.nodeId })}
          </p>
          <p className={styles.hint}>{t("workspace.analysis.unstableHint")}</p>
          {status.canRestrain ? (
            <>
              <p className={styles.hint}>{t("workspace.analysis.unstablePlanar")}</p>
              <button
                className={panelStyles.small}
                data-testid="analysis-restrain"
                onClick={() => restrainOutOfPlaneAction()}
                type="button"
              >
                {t("workspace.planar.button")}
              </button>
            </>
          ) : null}
        </>
      );
    case "unsupported":
      return (
        <>
          {status.groups.map((group) => (
            <p className={styles.line} data-feature={group.feature} key={group.feature}>
              {t(UNSUPPORTED_MESSAGE[group.feature], memberList(group.memberIds))}
            </p>
          ))}
        </>
      );
    case "overflow":
      return <p className={styles.line}>{t("workspace.analysis.overflow")}</p>;
    case "failed": {
      const detail = failureDetail(status.failure);
      return (
        <>
          <p className={styles.line}>{t(FAILURE_MESSAGE[status.failure.kind])}</p>
          {detail ? <p className={styles.detail}>{detail}</p> : null}
          <button
            className={panelStyles.small}
            data-testid="analysis-retry"
            onClick={retry}
            type="button"
          >
            {t("workspace.analysis.retry")}
          </button>
        </>
      );
    }
  }
}

/**
 * The status area of the live analysis (card PX-02.8), at the top of the side panel, where it stays while the
 * panel scrolls: what `analysisStatus` says about the model of the model store. One line while the model is
 * being analysed or was analysed (with the time in ms); below that line, for the other statuses, what is wrong
 * and what can be done. It is a status region, so a change is announced.
 */
export function AnalysisStatus() {
  const model = useModelStore(selectModel);
  const analysis = useAnalysisStore((state) => state.analysis);
  const status = analysisStatus(analysis, model);
  return (
    <div
      aria-label={t("workspace.analysis.label")}
      className={styles.status}
      data-stale={status.kind === "analysing" && status.stale ? "true" : "false"}
      data-status={status.kind}
      data-testid="analysis-status"
      role="status"
    >
      <p className={styles.head}>
        <span aria-hidden="true" className={styles.dot} />
        <span className={styles.title} data-testid="analysis-title">
          {t(STATUS_TITLE[status.kind])}
        </span>
        {status.kind === "analysed" ? (
          <span
            className={styles.time}
            data-testid="analysis-time"
            title={t("workspace.analysis.analysedHelp")}
          >
            {t("workspace.analysis.analysedIn", { ms: formatMs(status.ms) })}
          </span>
        ) : null}
      </p>
      <Details status={status} />
    </div>
  );
}
