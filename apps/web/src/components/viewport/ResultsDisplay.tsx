"use client";

import { useId } from "react";
import { t } from "../../i18n";
import { NumberField } from "../tools/NumberField";
import { formatScale, manualScale } from "./resultDrawing";
import type { ResultDrawing } from "./useResultDrawing";
import styles from "./Viewport.module.css";
import { useViewportStore } from "./viewportStore";

/**
 * The "Results display" group of the viewport's toolbar (card PX-02.9), one strip after the view buttons: the
 * switches "Deflected shape" and "Reactions" (both on when the page opens) and, while a deflected shape is
 * drawn, its scale: the text "Scale ×N", a field to type another scale, "Auto" (pressed while the scale is the
 * automatic one) and "True scale ×1". A typed scale that is not a positive number is dropped, and so is the
 * number the field already shows. While there are no results to draw beside the model, the strip says so and
 * the switches keep their state. The group's name is its accessible name and its tooltip; it is not printed.
 */
export function ResultsDisplay({ drawing }: { drawing: ResultDrawing | null }) {
  const showDeflected = useViewportStore((state) => state.showDeflected);
  const showReactions = useViewportStore((state) => state.showReactions);
  const setShowDeflected = useViewportStore((state) => state.setShowDeflected);
  const setShowReactions = useViewportStore((state) => state.setShowReactions);
  const setScale = useViewportStore((state) => state.setScale);
  const id = useId();
  const scaled = drawing !== null && drawing.deflected !== null;
  return (
    // biome-ignore lint/a11y/useSemanticElements: a strip of the toolbar, not a form's fieldset
    <div
      aria-label={t("workspace.display.title")}
      className={styles.display}
      data-available={drawing === null ? "false" : "true"}
      data-testid="results-display"
      role="group"
      title={t("workspace.display.title")}
    >
      <label className={styles.displayToggle} htmlFor={`${id}-deflected`}>
        <input
          checked={showDeflected}
          data-testid="show-deflected"
          id={`${id}-deflected`}
          onChange={(event) => setShowDeflected(event.target.checked)}
          type="checkbox"
        />
        <span aria-hidden="true" className={`${styles.legendSwatch} ${styles.swatchDeflection}`} />
        {t("workspace.display.deflected")}
      </label>
      {scaled ? (
        <>
          <span
            className={styles.scaleText}
            data-mode={drawing.automatic ? "auto" : "manual"}
            data-scale={drawing.scale}
            data-testid="deflection-scale"
          >
            {t("workspace.display.scale", { value: formatScale(drawing.scale) })}
          </span>
          <NumberField
            className={styles.scaleField}
            label={t("workspace.display.scaleField")}
            onCommit={(value) => {
              const scale = manualScale(value);
              if (scale !== null) {
                setScale(scale);
              }
            }}
            testId="scale-field"
            value={Number(formatScale(drawing.scale))}
          />
          <button
            aria-pressed={drawing.automatic}
            className={styles.scaleButton}
            data-testid="scale-auto"
            onClick={() => setScale(null)}
            type="button"
          >
            {t("workspace.display.scaleAuto")}
          </button>
          <button
            aria-pressed={!drawing.automatic && drawing.scale === 1}
            className={styles.scaleButton}
            data-testid="scale-true"
            onClick={() => setScale(1)}
            type="button"
          >
            {t("workspace.display.scaleTrue")}
          </button>
        </>
      ) : null}
      <label className={styles.displayToggle} htmlFor={`${id}-reactions`}>
        <input
          checked={showReactions}
          data-testid="show-reactions"
          id={`${id}-reactions`}
          onChange={(event) => setShowReactions(event.target.checked)}
          type="checkbox"
        />
        <span aria-hidden="true" className={`${styles.legendSwatch} ${styles.swatchReaction}`} />
        {t("workspace.display.reactions")}
      </label>
      {drawing === null ? (
        <span className={styles.displayNone} data-testid="results-display-none">
          {t("workspace.display.none")}
        </span>
      ) : null}
    </div>
  );
}
