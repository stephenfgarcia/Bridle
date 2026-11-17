"use client";

import type { MessageId } from "@bridle/i18n";
import type { Model } from "@bridle/model";
import { useEffect, useId, useRef, useState } from "react";
import { t } from "../../i18n";
import { editProperties } from "../tools/toolActions";
import styles from "./Library.module.css";
import {
  builtInMaterialArgs,
  type Choice,
  genericSectionArgs,
  type MaterialRow,
  materialChoices,
  materialRows,
  type SectionRow,
  sectionChoices,
  sectionRows,
} from "./library";
import panelStyles from "./Panels.module.css";
import workspaceStyles from "./WorkspaceView.module.css";

// The columns of the two tables: the key of the row and the header, which names the unit.
const SECTION_COLUMNS = [
  ["A", "workspace.library.area"],
  ["Iy", "workspace.library.iy"],
  ["Iz", "workspace.library.iz"],
  ["J", "workspace.library.j"],
  ["depthZ", "workspace.library.depthZ"],
  ["depthY", "workspace.library.depthY"],
] as const satisfies readonly (readonly [keyof SectionRow, MessageId])[];

const MATERIAL_COLUMNS = [
  ["E", "workspace.library.e"],
  ["G", "workspace.library.g"],
  ["fy", "workspace.library.fy"],
  ["density", "workspace.library.density"],
] as const satisfies readonly (readonly [keyof MaterialRow, MessageId])[];

/**
 * An I-section drawn upright with its local axes, as seen with local x pointing at the viewer: z upward in the
 * plane of the web, y to the right along the flanges (`packages/model/src/geometry.ts`: x = y × z).
 */
function AxesDiagram() {
  return (
    <svg
      aria-label={t("workspace.library.axesDiagram")}
      className={styles.diagram}
      role="img"
      viewBox="0 0 120 120"
    >
      <path
        className={styles.shape}
        d="M38 24h44v8H64v56h18v8H38v-8h18V32H38z"
        strokeLinejoin="round"
      />
      {/* y: from the centroid to the right. z: from the centroid upward. */}
      <path className={styles.axis} d="M60 60H108M102 55l7 5-7 5" />
      <path className={styles.axis} d="M60 60V10M55 16l5-7 5 7" />
      <text className={styles.axisName} x="104" y="78">
        {t("workspace.library.axisY")}
      </text>
      <text className={styles.axisName} x="70" y="16">
        {t("workspace.library.axisZ")}
      </text>
    </svg>
  );
}

/** A select of what can be added and its button; an entry the model already has by name cannot be chosen. */
function AddRow({
  label,
  button,
  choices,
  testId,
  onAdd,
}: {
  label: string;
  button: string;
  choices: Choice[];
  testId: string;
  onAdd: (name: string) => void;
}) {
  const id = useId();
  const [chosen, setChosen] = useState("");
  // The entry in the select: the one chosen while it can still be added, else the first that can.
  const name =
    choices.find((choice) => choice.available && choice.name === chosen)?.name ??
    choices.find((choice) => choice.available)?.name ??
    "";
  return (
    <div className={styles.add}>
      <label className={workspaceStyles.fieldLabel} htmlFor={id}>
        {label}
      </label>
      <select
        className={panelStyles.control}
        data-testid={`${testId}-choice`}
        disabled={name === ""}
        id={id}
        onChange={(event) => setChosen(event.target.value)}
        value={name}
      >
        {choices.map((choice) => (
          <option disabled={!choice.available} key={choice.name} value={choice.name}>
            {choice.available ? choice.name : t("workspace.library.inModel", { name: choice.name })}
          </option>
        ))}
      </select>
      <button
        className={panelStyles.small}
        data-testid={`${testId}-add`}
        disabled={name === ""}
        onClick={() => onAdd(name)}
        type="button"
      >
        {button}
      </button>
    </div>
  );
}

/** The cell with the Remove button of a row; the button is off, and says why, while a member uses the entry. */
function RemoveCell({
  row,
  named,
  onRemove,
}: {
  row: { id: string; name: string; members: number; removable: boolean };
  /** The message of the button's accessible name, with `{name}` and `{id}`. */
  named: MessageId;
  onRemove: () => void;
}) {
  return (
    <td className={styles.action}>
      <button
        aria-label={t(named, { name: row.name, id: row.id })}
        className={panelStyles.remove}
        data-testid="library-remove"
        disabled={!row.removable}
        onClick={onRemove}
        title={row.removable ? undefined : t("workspace.library.inUse", { count: row.members })}
        type="button"
      >
        {t("workspace.loads.remove")}
      </button>
    </td>
  );
}

function Tables({ model }: { model: Model }) {
  const sections = sectionRows(model);
  const materials = materialRows(model);
  return (
    <>
      <section aria-labelledby="library-sections-title" className={styles.part}>
        <h3 className={styles.partTitle} id="library-sections-title">
          {t("workspace.library.sections")}
        </h3>
        <div className={styles.scroll}>
          <table className={styles.table} data-testid="library-sections">
            <thead>
              <tr>
                <th scope="col">{t("workspace.library.name")}</th>
                {SECTION_COLUMNS.map(([key, header]) => (
                  <th className={styles.numeric} key={key} scope="col">
                    {t(header)}
                  </th>
                ))}
                <th className={styles.numeric} scope="col">
                  {t("workspace.counts.members")}
                </th>
                <td />
              </tr>
            </thead>
            <tbody>
              {sections.map((row) => (
                <tr data-id={row.id} key={row.id}>
                  <th scope="row">
                    {row.name} <span className={styles.id}>{row.id}</span>
                  </th>
                  {SECTION_COLUMNS.map(([key]) => (
                    <td className={styles.numeric} data-column={key} key={key}>
                      {row[key]}
                    </td>
                  ))}
                  <td className={styles.numeric} data-column="members">
                    {row.members}
                  </td>
                  <RemoveCell
                    named="workspace.library.removeSection"
                    onRemove={() => editProperties((store) => store.removeSection({ id: row.id }))}
                    row={row}
                  />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sections.length === 0 ? (
          <p className={panelStyles.help}>{t("workspace.library.noSections")}</p>
        ) : null}
        <div className={styles.axes} data-testid="library-axes">
          <AxesDiagram />
          <div className={styles.axesText}>
            <p>{t("workspace.library.axesIy")}</p>
            <p>{t("workspace.library.axesIz")}</p>
            <p className={panelStyles.help}>{t("workspace.library.axesView")}</p>
          </div>
        </div>
        <AddRow
          button={t("workspace.library.addSection")}
          choices={sectionChoices(model)}
          label={t("workspace.library.addSectionLabel")}
          onAdd={(name) => {
            const args = genericSectionArgs(name);
            if (args) {
              editProperties((store) => store.addSection(args));
            }
          }}
          testId="library-section"
        />
        <p className={panelStyles.help}>{t("workspace.library.sectionsHelp")}</p>
      </section>
      <section aria-labelledby="library-materials-title" className={styles.part}>
        <h3 className={styles.partTitle} id="library-materials-title">
          {t("workspace.library.materials")}
        </h3>
        <div className={styles.scroll}>
          <table className={styles.table} data-testid="library-materials">
            <thead>
              <tr>
                <th scope="col">{t("workspace.library.name")}</th>
                {MATERIAL_COLUMNS.map(([key, header]) => (
                  <th className={styles.numeric} key={key} scope="col">
                    {t(header)}
                  </th>
                ))}
                <th className={styles.numeric} scope="col">
                  {t("workspace.counts.members")}
                </th>
                <td />
              </tr>
            </thead>
            <tbody>
              {materials.map((row) => (
                <tr data-id={row.id} key={row.id}>
                  <th scope="row">
                    {row.name} <span className={styles.id}>{row.id}</span>
                  </th>
                  {MATERIAL_COLUMNS.map(([key]) => (
                    <td className={styles.numeric} data-column={key} key={key}>
                      {row[key]}
                    </td>
                  ))}
                  <td className={styles.numeric} data-column="members">
                    {row.members}
                  </td>
                  <RemoveCell
                    named="workspace.library.removeMaterial"
                    onRemove={() => editProperties((store) => store.removeMaterial({ id: row.id }))}
                    row={row}
                  />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {materials.length === 0 ? (
          <p className={panelStyles.help}>{t("workspace.library.noMaterials")}</p>
        ) : null}
        <AddRow
          button={t("workspace.library.addMaterial")}
          choices={materialChoices(model)}
          label={t("workspace.library.addMaterialLabel")}
          onAdd={(name) => {
            const args = builtInMaterialArgs(name);
            if (args) {
              editProperties((store) => store.addMaterial(args));
            }
          }}
          testId="library-material"
        />
      </section>
    </>
  );
}

/**
 * "Sections and materials" (card PX-02.6): a button of the Model section, with the number of each beside it,
 * that opens a dialog over the workspace. The dialog lists the model's sections (A in cm², Iy, Iz and J in
 * cm⁴, the two overall dimensions in mm) and materials (E and G in GPa, fy in MPa, the density in kg/m³) with
 * the number of members that use each, says which axis Iy and Iz belong to, adds a generic I-section of
 * `@bridle/tasks` or a built-in material, and removes an entry that no member uses. Each addition and removal
 * is one undo step. Escape, the Close button and a click beside the dialog close it.
 */
export function LibraryDialog({ model }: { model: Model }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) {
      dialog.current.showModal();
    }
  }, [open]);
  return (
    <div className={styles.entry}>
      <button
        className={workspaceStyles.action}
        data-testid="library-open"
        onClick={() => setOpen(true)}
        type="button"
      >
        {t("workspace.library.title")}
      </button>
      <span className={panelStyles.help} data-testid="library-summary">
        {t("workspace.library.summary", {
          sections: model.sections.length,
          materials: model.materials.length,
        })}
      </span>
      {open ? (
        // biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes a modal dialog by itself
        <dialog
          aria-labelledby="library-title"
          className={styles.dialog}
          data-testid="library"
          onClick={(event) => {
            // A click on the backdrop lands on the dialog element itself, not on its content.
            if (event.target === event.currentTarget) {
              event.currentTarget.close();
            }
          }}
          onClose={() => setOpen(false)}
          ref={dialog}
        >
          <div className={styles.content}>
            <header className={styles.head}>
              <h2 className={styles.title} id="library-title">
                {t("workspace.library.title")}
              </h2>
              <button
                className={panelStyles.small}
                data-testid="library-close"
                onClick={() => dialog.current?.close()}
                type="button"
              >
                {t("workspace.library.close")}
              </button>
            </header>
            <Tables model={model} />
          </div>
        </dialog>
      ) : null}
    </div>
  );
}
