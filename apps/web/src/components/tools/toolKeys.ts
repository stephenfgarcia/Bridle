/**
 * The keys of the tools (card PX-02.4), as a pure function of the fields of a keyboard event
 * (./toolKeys.test.ts). The workspace attaches it to the window beside the undo and redo shortcuts
 * (../model/shortcuts.ts).
 */
import { isTextField, type KeyLike } from "../model/shortcuts";
import type { Tool } from "./toolStore";

/** The one-key shortcut of each tool, as shown in its tooltip. */
export const TOOL_KEYS: Record<Tool, string> = { select: "V", node: "N", member: "M" };

export type ToolKeyAction = { type: "tool"; tool: Tool } | { type: "escape" } | { type: "delete" };

/**
 * What a key press asks of the tools:
 * - Escape: back to the Select tool, ending a member in progress (also from a text field);
 * - V, N, M, in either case: the Select, Node and Member tool;
 * - Delete, Backspace: delete what is selected.
 * `null` for any other key, for any key with Ctrl, Cmd or Alt, for a letter, Delete or Backspace pressed in
 * a text field, and for a letter pressed on a `<select>` (where it picks an option).
 */
export function toolKeyAction(
  event: Pick<KeyLike, "key" | "ctrlKey" | "metaKey" | "altKey" | "target">,
): ToolKeyAction | null {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return null;
  }
  if (event.key === "Escape") {
    return { type: "escape" };
  }
  if (isTextField(event.target)) {
    return null;
  }
  if (event.key === "Delete" || event.key === "Backspace") {
    return { type: "delete" };
  }
  const tag = (event.target as { tagName?: unknown } | null)?.tagName;
  if (typeof tag === "string" && tag.toLowerCase() === "select") {
    return null;
  }
  const key = event.key.toUpperCase();
  const tool = (Object.keys(TOOL_KEYS) as Tool[]).find((candidate) => TOOL_KEYS[candidate] === key);
  return tool ? { type: "tool", tool } : null;
}
