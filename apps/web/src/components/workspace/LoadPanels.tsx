"use client";

import type { MessageId } from "@bridle/i18n";
import type {
  LoadAxes,
  LoadDirection,
  MemberPointLoad,
  MemberUniformLoad,
  Model,
  NodalLoad,
} from "@bridle/model";
import { type ReactNode, useState } from "react";
import { t } from "../../i18n";
import { NumberField } from "../tools/NumberField";
import {
  isMoment,
  NODAL_COMPONENTS,
  type NodalComponent,
  nodalLoadEdit,
  nodalLoadRows,
} from "../tools/supportLoadTools";
import { COMPONENT_NAME } from "../tools/ToolPalette";
import { addLoadCaseAction, editLoad } from "../tools/toolActions";
import { useToolStore } from "../tools/toolStore";
import { formatCoordinate } from "../tools/workPlane";
import { activeLoadCaseId, loadCount } from "../viewport/loads";
import styles from "./Panels.module.css";
import workspaceStyles from "./WorkspaceView.module.css";

type Unit = "kN" | "kNm" | "kNPerM";

const UNIT_NAME: Record<Unit, MessageId> = {
  kN: "workspace.loads.unit.kN",
  kNm: "workspace.loads.unit.kNm",
  kNPerM: "workspace.loads.unit.kNPerM",
};

const VALUE_LABEL: Record<Unit, MessageId> = {
  kN: "workspace.loads.field.kN",
  kNm: "workspace.loads.field.kNm",
  kNPerM: "workspace.loads.field.kNPerM",
};

const AXES: readonly LoadAxes[] = ["global", "local"];

const AXES_NAME: Record<LoadAxes, MessageId> = {
  global: "workspace.loads.axes.global",
  local: "workspace.loads.axes.local",
};

const DIRECTIONS: readonly LoadDirection[] = ["x", "y", "z"];

const DIRECTION_NAME: Record<LoadDirection, MessageId> = {
  x: "workspace.loads.direction.x",
  y: "workspace.loads.direction.y",
  z: "workspace.loads.direction.z",
};

/** The active load case of the model: the one chosen in the tool store, else the model's first. */
function useActiveLoadCase(model: Model): string | null {
  const wanted = useToolStore((state) => state.loadCaseId);
  return activeLoadCaseId(model, wanted);
}

/**
 * The Loads section of the side panel: the load cases of the model, each with the number of its loads, as
 * radio buttons that choose the active one (the one the viewport shows and new loads go into), and a button
 * that adds a load case named "Load case N" and makes it the active one.
 */
export function LoadCases({ model }: { model: Model }) {
  const active = useActiveLoadCase(model);
  return (
    <>
      {model.loadCases.length === 0 ? (
        <p className={workspaceStyles.empty}>{t("workspace.loadCases.none")}</p>
      ) : (
        <fieldset className={styles.group} data-testid="load-cases">
          <legend className={styles.legend}>{t("workspace.loadCases.legend")}</legend>
          {model.loadCases.map((loadCase) => (
            <label
              className={styles.loadCase}
              data-active={loadCase.id === active}
              data-case={loadCase.id}
              data-testid="load-case"
              key={loadCase.id}
            >
              <input
                checked={loadCase.id === active}
                name="active-load-case"
                onChange={() => useToolStore.getState().setLoadCaseId(loadCase.id)}
                type="radio"
              />
              <span className={styles.loadCaseName}>{loadCase.name}</span>
              <span className={styles.loadCaseCount} data-testid="load-case-count">
                {t("workspace.loadCases.count", { count: loadCount(model, loadCase.id) })}
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <button
        className={styles.small}
        data-testid="add-load-case"
        onClick={() =>
          addLoadCaseAction({
            name: t("workspace.loadCases.defaultName", { number: model.loadCases.length + 1 }),
          })
        }
        type="button"
      >
        {t("workspace.loadCases.add")}
      </button>
    </>
  );
}

/** One load of a list: its kind and id, a Remove button, and its fields below. */
function LoadCard({
  kind,
  id,
  onRemove,
  children,
}: {
  kind: MessageId;
  id: string;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <li className={styles.load} data-load={id} data-testid="load-row">
      <div className={styles.loadHead}>
        <span className={styles.loadName}>
          {t(kind)} <span className={styles.loadId}>{id}</span>
        </span>
        <button
          aria-label={t("workspace.loads.removeNamed", { id })}
          className={styles.remove}
          data-testid="load-remove"
          onClick={onRemove}
          type="button"
        >
          {t("workspace.loads.remove")}
        </button>
      </div>
      {children}
    </li>
  );
}

/** The heading of a list of loads ("Loads in <load case>") and, when there are none, a line that says so. */
function ListHead({
  model,
  loadCaseId,
  count,
}: {
  model: Model;
  loadCaseId: string;
  count: number;
}) {
  const name = model.loadCases.find((loadCase) => loadCase.id === loadCaseId)?.name ?? loadCaseId;
  return (
    <>
      <h3 className={styles.legend}>{t("workspace.loads.listTitle", { case: name })}</h3>
      {count === 0 ? (
        <p className={styles.help} data-testid="load-list-empty">
          {t("workspace.loads.none")}
        </p>
      ) : null}
    </>
  );
}

/** A line that says how many loads of the item are in other load cases; nothing when there are none. */
function Elsewhere({ count }: { count: number }) {
  return count > 0 ? (
    <p className={styles.help} data-testid="loads-elsewhere">
      {t("workspace.loads.elsewhere", { count })}
    </p>
  ) : null;
}

function isComponent(value: string): value is NodalComponent {
  return (NODAL_COMPONENTS as readonly string[]).includes(value);
}

/**
 * The nodal loads of the selected node in the active load case. Each load shows one line per component that
 * is not zero: the component (a force along or a moment about a global axis) and its signed value, both
 * editable; Remove removes the whole load. Every edit is one undo step.
 */
export function NodeLoads({ model, nodeId }: { model: Model; nodeId: string }) {
  const active = useActiveLoadCase(model);
  if (active === null) {
    return null;
  }
  const onNode = model.nodalLoads.filter((load) => load.nodeId === nodeId);
  const loads = onNode.filter((load) => load.loadCaseId === active);
  return (
    <div className={styles.loads} data-testid="node-loads">
      <ListHead count={loads.length} loadCaseId={active} model={model} />
      <ul className={styles.loadList}>
        {loads.map((load) => (
          <NodalLoadCard key={load.id} load={load} />
        ))}
      </ul>
      <Elsewhere count={onNode.length - loads.length} />
    </div>
  );
}

function NodalLoadCard({ load }: { load: NodalLoad }) {
  return (
    <LoadCard
      id={load.id}
      kind="workspace.loads.nodal"
      onRemove={() => editLoad((store) => store.removeNodalLoad({ id: load.id }))}
    >
      {nodalLoadRows(load).map((row) => {
        const unit: Unit = isMoment(row.component) ? "kNm" : "kN";
        return (
          <div className={styles.fields} key={row.component}>
            <select
              aria-label={t("workspace.loads.componentLabel")}
              className={styles.control}
              data-testid="load-component"
              onChange={(event) => {
                const to = event.target.value;
                if (isComponent(to)) {
                  editLoad((store) =>
                    store.updateNodalLoad(nodalLoadEdit(load, row.component, to, row.value)),
                  );
                }
              }}
              value={row.component}
            >
              {NODAL_COMPONENTS.map((component) => (
                <option key={component} value={component}>
                  {t(COMPONENT_NAME[component])}
                </option>
              ))}
            </select>
            <NumberField
              className={`${styles.control} ${styles.number}`}
              label={t(VALUE_LABEL[unit])}
              onCommit={(value) =>
                editLoad((store) =>
                  store.updateNodalLoad(nodalLoadEdit(load, row.component, row.component, value)),
                )
              }
              testId="load-value"
              value={row.value}
            />
            <span className={styles.unit}>{t(UNIT_NAME[unit])}</span>
          </div>
        );
      })}
    </LoadCard>
  );
}

interface MemberLoadValues {
  axes: LoadAxes;
  direction: LoadDirection;
  value: number;
  /** m from the start node; a point load only. */
  position?: number;
}

/**
 * The fields of a member load: global or local axes, the direction X, Y or Z, the signed value with its unit
 * and, for a point load, the position in m from the start node. Each change is reported through `onChange`.
 */
function MemberLoadFields({
  values,
  unit,
  onChange,
  prefix,
}: {
  values: MemberLoadValues;
  unit: Unit;
  onChange: (patch: Partial<MemberLoadValues>) => void;
  /** The start of the fields' test ids: `load` for a load of the list, `new-load` for the form. */
  prefix: string;
}) {
  return (
    <div className={styles.fields}>
      <select
        aria-label={t("workspace.loads.axes.label")}
        className={styles.control}
        data-testid={`${prefix}-axes`}
        onChange={(event) => {
          const axes = AXES.find((candidate) => candidate === event.target.value);
          if (axes) {
            onChange({ axes });
          }
        }}
        value={values.axes}
      >
        {AXES.map((axes) => (
          <option key={axes} value={axes}>
            {t(AXES_NAME[axes])}
          </option>
        ))}
      </select>
      <select
        aria-label={t("workspace.loads.direction.label")}
        className={styles.control}
        data-testid={`${prefix}-direction`}
        onChange={(event) => {
          const direction = DIRECTIONS.find((candidate) => candidate === event.target.value);
          if (direction) {
            onChange({ direction });
          }
        }}
        value={values.direction}
      >
        {DIRECTIONS.map((direction) => (
          <option key={direction} value={direction}>
            {t(DIRECTION_NAME[direction])}
          </option>
        ))}
      </select>
      <NumberField
        className={`${styles.control} ${styles.number}`}
        label={t(VALUE_LABEL[unit])}
        onCommit={(value) => onChange({ value })}
        testId={`${prefix}-value`}
        value={values.value}
      />
      <span className={styles.unit}>{t(UNIT_NAME[unit])}</span>
      {values.position === undefined ? null : (
        <>
          <span className={styles.unit}>{t("workspace.loads.at")}</span>
          <NumberField
            className={`${styles.control} ${styles.number}`}
            label={t("workspace.loads.field.position")}
            onCommit={(position) => onChange({ position })}
            testId={`${prefix}-position`}
            value={values.position}
          />
          <span className={styles.unit}>{t("workspace.loads.unit.m")}</span>
        </>
      )}
    </div>
  );
}

function UniformLoadCard({ load }: { load: MemberUniformLoad }) {
  return (
    <LoadCard
      id={load.id}
      kind="workspace.loads.uniform"
      onRemove={() => editLoad((store) => store.removeMemberUniformLoad({ id: load.id }))}
    >
      <MemberLoadFields
        onChange={(patch) =>
          editLoad((store) => store.updateMemberUniformLoad({ id: load.id, ...patch }))
        }
        prefix="load"
        unit="kNPerM"
        values={{ axes: load.axes, direction: load.direction, value: load.value }}
      />
    </LoadCard>
  );
}

function PointLoadCard({ load }: { load: MemberPointLoad }) {
  return (
    <LoadCard
      id={load.id}
      kind="workspace.loads.point"
      onRemove={() => editLoad((store) => store.removeMemberPointLoad({ id: load.id }))}
    >
      <MemberLoadFields
        onChange={(patch) =>
          editLoad(
            (store) => store.updateMemberPointLoad({ id: load.id, ...patch }),
            patch.position === undefined ? "refused" : "position-outside",
          )
        }
        prefix="load"
        unit="kN"
        values={{
          axes: load.axes,
          direction: load.direction,
          value: load.value,
          position: load.position,
        }}
      />
    </LoadCard>
  );
}

const NEW_LOAD: MemberLoadValues = { axes: "global", direction: "z", value: -10 };

/**
 * The loads of the selected member in the active load case, uniform loads first, each editable and removable
 * (one undo step per edit), and the two buttons "Add uniform load" and "Add point load". A button opens its
 * form (axes, direction, value; for a point load the position, which starts at the middle of the member);
 * "Add" adds the load to the active load case and closes the form. A position outside the member is refused
 * with a notice in the viewport.
 */
export function MemberLoads({
  model,
  memberId,
  length,
}: {
  model: Model;
  memberId: string;
  /** The member's length in m; `undefined` when a node of it is missing. */
  length: number | undefined;
}) {
  const active = useActiveLoadCase(model);
  const [form, setForm] = useState<"uniform" | "point" | null>(null);
  const [draft, setDraft] = useState<MemberLoadValues>(NEW_LOAD);
  if (active === null) {
    return null;
  }
  const onMember = [...model.memberUniformLoads, ...model.memberPointLoads].filter(
    (load) => load.memberId === memberId,
  );
  const uniform = model.memberUniformLoads.filter(
    (load) => load.memberId === memberId && load.loadCaseId === active,
  );
  const point = model.memberPointLoads.filter(
    (load) => load.memberId === memberId && load.loadCaseId === active,
  );
  const open = (kind: "uniform" | "point") => {
    setDraft(
      kind === "point"
        ? { ...NEW_LOAD, position: Number(formatCoordinate((length ?? 0) / 2)) }
        : NEW_LOAD,
    );
    setForm(kind);
  };
  const add = () => {
    const { axes, direction, value, position } = draft;
    const added =
      form === "point"
        ? editLoad(
            (store) =>
              store.addMemberPointLoad({
                memberId,
                loadCaseId: active,
                axes,
                direction,
                value,
                position: position ?? 0,
              }),
            "position-outside",
          )
        : editLoad((store) =>
            store.addMemberUniformLoad({ memberId, loadCaseId: active, axes, direction, value }),
          );
    if (added) {
      setForm(null);
    }
  };
  return (
    <div className={styles.loads} data-testid="member-loads">
      <ListHead count={uniform.length + point.length} loadCaseId={active} model={model} />
      <ul className={styles.loadList}>
        {uniform.map((load) => (
          <UniformLoadCard key={load.id} load={load} />
        ))}
        {point.map((load) => (
          <PointLoadCard key={load.id} load={load} />
        ))}
      </ul>
      <Elsewhere count={onMember.length - uniform.length - point.length} />
      {form === null ? (
        <div className={styles.buttons}>
          <button
            className={styles.small}
            data-testid="add-uniform-load"
            onClick={() => open("uniform")}
            type="button"
          >
            {t("workspace.loads.addUniform")}
          </button>
          <button
            className={styles.small}
            data-testid="add-point-load"
            onClick={() => open("point")}
            type="button"
          >
            {t("workspace.loads.addPoint")}
          </button>
        </div>
      ) : (
        <div className={styles.form} data-form={form} data-testid="new-load">
          <span className={styles.loadName}>
            {t(form === "point" ? "workspace.loads.newPoint" : "workspace.loads.newUniform")}
          </span>
          <MemberLoadFields
            onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
            prefix="new-load"
            unit={form === "point" ? "kN" : "kNPerM"}
            values={draft}
          />
          {form === "point" && length !== undefined ? (
            <p className={styles.help} data-testid="new-load-length">
              {t("workspace.loads.memberLength", { length: formatCoordinate(length) })}
            </p>
          ) : null}
          <div className={styles.buttons}>
            <button
              className={styles.primary}
              data-testid="new-load-add"
              onClick={add}
              type="button"
            >
              {t("workspace.loads.add")}
            </button>
            <button
              className={styles.small}
              data-testid="new-load-cancel"
              onClick={() => setForm(null)}
              type="button"
            >
              {t("workspace.loads.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
