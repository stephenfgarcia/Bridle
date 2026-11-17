"use client";

import { useState } from "react";
import { formatCoordinate, parseCoordinate } from "./workPlane";

/**
 * A text field for one number (a coordinate in m). It shows `value` until the person types; what was typed is
 * applied on Enter and on leaving the field, through `onCommit`, when it is a finite number other than
 * `value`; otherwise the field goes back to `value`. Escape drops what was typed.
 */
export function NumberField({
  value,
  onCommit,
  id,
  className,
  label,
  testId,
}: {
  value: number;
  onCommit: (value: number) => void;
  id?: string;
  className?: string;
  /** The accessible name, for a field without a `<label>`. */
  label?: string;
  testId?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) {
      return;
    }
    const parsed = parseCoordinate(draft);
    setDraft(null);
    if (parsed !== null && parsed !== value) {
      onCommit(parsed);
    }
  };
  return (
    <input
      aria-label={label}
      autoComplete="off"
      className={className}
      data-testid={testId}
      id={id}
      inputMode="decimal"
      onBlur={commit}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          commit();
        } else if (event.key === "Escape" && draft !== null) {
          // The key drops the edit only; it does not reach the workspace's own Escape.
          event.stopPropagation();
          setDraft(null);
        }
      }}
      type="text"
      value={draft ?? formatCoordinate(value)}
    />
  );
}
