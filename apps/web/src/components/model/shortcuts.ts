/**
 * The keyboard shortcuts of undo and redo (card PX-02.3), as pure functions of the fields of a keyboard event,
 * so they are tested without a browser. No React import; the workspace attaches `handleHistoryKey` to the
 * window (../workspace/WorkspaceView.tsx).
 */

/** The fields of a `KeyboardEvent` this file reads. */
export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  target: unknown;
  preventDefault: () => void;
}

export type HistoryAction = "undo" | "redo";

/**
 * What a key press asks for: Ctrl or Cmd with Z is undo; Ctrl or Cmd with Shift and Z, or Ctrl with Y, is
 * redo; anything else, and anything with Alt, is `null`. The letter may be in either case.
 */
export function historyShortcut(
  event: Pick<KeyLike, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">,
): HistoryAction | null {
  if (event.altKey || !(event.ctrlKey || event.metaKey)) {
    return null;
  }
  const key = event.key.toLowerCase();
  if (key === "z") {
    return event.shiftKey ? "redo" : "undo";
  }
  if (key === "y" && event.ctrlKey && !event.metaKey && !event.shiftKey) {
    return "redo";
  }
  return null;
}

// The types of <input> that hold no text: a shortcut pressed on one of them still acts on the model.
const NOT_TEXT_INPUTS = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

/**
 * Whether an event target is a text field: a `<textarea>`, an `<input>` of a type that holds text, or an
 * element whose content is editable. There the browser's own undo of the text applies.
 */
export function isTextField(target: unknown): boolean {
  if (typeof target !== "object" || target === null) {
    return false;
  }
  const element = target as { tagName?: unknown; type?: unknown; isContentEditable?: unknown };
  if (element.isContentEditable === true) {
    return true;
  }
  const tag = typeof element.tagName === "string" ? element.tagName.toLowerCase() : "";
  if (tag === "textarea") {
    return true;
  }
  if (tag === "input") {
    const type = typeof element.type === "string" ? element.type.toLowerCase() : "text";
    return !NOT_TEXT_INPUTS.has(type);
  }
  return false;
}

/**
 * Runs undo or redo for a key press and stops the browser's own action for it. Does nothing, and returns
 * `false`, when the keys are not a shortcut or the target is a text field.
 */
export function handleHistoryKey(
  event: KeyLike,
  actions: { undo: () => void; redo: () => void },
): boolean {
  const action = historyShortcut(event);
  if (action === null || isTextField(event.target)) {
    return false;
  }
  event.preventDefault();
  actions[action]();
  return true;
}
