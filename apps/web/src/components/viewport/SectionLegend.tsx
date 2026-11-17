"use client";

import { useId } from "react";
import { t } from "../../i18n";
import { SECTION_COLOR_TOKENS, type SectionLegendEntry } from "./sectionColors";
import styles from "./Viewport.module.css";
import { useViewportStore } from "./viewportStore";

/**
 * The "Colour by section" control in the viewport, under the Undo and Redo buttons (card PX-02.6): a checkbox
 * (off when the page opens) and, while it is on, the legend: one line per section in use with its colour, its
 * name and the number of its members. The sections beyond the palette's six colours share one line, "Other
 * sections", in the plain member colour.
 */
export function SectionLegend({ legend }: { legend: SectionLegendEntry[] }) {
  const on = useViewportStore((state) => state.colorBySection);
  const setOn = useViewportStore((state) => state.setColorBySection);
  const id = useId();
  const colored = legend.filter((entry) => entry.color !== null);
  const others = legend
    .filter((entry) => entry.color === null)
    .reduce((sum, entry) => sum + entry.members, 0);
  return (
    <div className={styles.legend} data-on={on ? "true" : "false"} data-testid="section-colors">
      <label className={styles.legendToggle} htmlFor={id}>
        <input
          checked={on}
          data-testid="color-by-section"
          id={id}
          onChange={(event) => setOn(event.target.checked)}
          type="checkbox"
        />
        {t("workspace.sectionColors.toggle")}
      </label>
      {on ? (
        legend.length === 0 ? (
          <p className={styles.legendEmpty}>{t("workspace.sectionColors.none")}</p>
        ) : (
          <ul className={styles.legendList} data-testid="section-legend">
            {colored.map((entry) => (
              <li
                className={styles.legendEntry}
                data-color={SECTION_COLOR_TOKENS[entry.color ?? 0]}
                data-section={entry.sectionId}
                key={entry.sectionId}
              >
                <span
                  aria-hidden="true"
                  className={styles.legendSwatch}
                  style={{ background: `var(${SECTION_COLOR_TOKENS[entry.color ?? 0]})` }}
                />
                <span className={styles.legendName}>{entry.name}</span>
                <span className={styles.legendCount}>
                  {t("workspace.sectionColors.members", { count: entry.members })}
                </span>
              </li>
            ))}
            {others > 0 ? (
              <li className={styles.legendEntry} data-section="">
                <span aria-hidden="true" className={styles.legendSwatch} />
                <span className={styles.legendName}>{t("workspace.sectionColors.other")}</span>
                <span className={styles.legendCount}>
                  {t("workspace.sectionColors.members", { count: others })}
                </span>
              </li>
            ) : null}
          </ul>
        )
      ) : null}
    </div>
  );
}
