// Unit tests of the undo and redo shortcuts (card PX-02.3, ./shortcuts.ts), with plain objects for the events.
import { describe, expect, it } from "vitest";
import { handleHistoryKey, historyShortcut, isTextField, type KeyLike } from "./shortcuts";

function key(key: string, modifiers: Partial<KeyLike> = {}): KeyLike & { prevented: number } {
  const event = {
    key,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    target: { tagName: "BODY" },
    prevented: 0,
    preventDefault: () => {
      event.prevented += 1;
    },
    ...modifiers,
  };
  return event;
}

describe("historyShortcut", () => {
  it("reads Ctrl or Cmd with Z as undo", () => {
    expect(historyShortcut(key("z", { ctrlKey: true }))).toBe("undo");
    expect(historyShortcut(key("z", { metaKey: true }))).toBe("undo");
    expect(historyShortcut(key("Z", { ctrlKey: true }))).toBe("undo");
  });

  it("reads Ctrl or Cmd with Shift and Z, and Ctrl with Y, as redo", () => {
    expect(historyShortcut(key("Z", { ctrlKey: true, shiftKey: true }))).toBe("redo");
    expect(historyShortcut(key("z", { metaKey: true, shiftKey: true }))).toBe("redo");
    expect(historyShortcut(key("y", { ctrlKey: true }))).toBe("redo");
  });

  it("reads nothing else", () => {
    expect(historyShortcut(key("z"))).toBeNull();
    expect(historyShortcut(key("z", { shiftKey: true }))).toBeNull();
    expect(historyShortcut(key("z", { ctrlKey: true, altKey: true }))).toBeNull();
    expect(historyShortcut(key("y", { metaKey: true }))).toBeNull();
    expect(historyShortcut(key("y", { ctrlKey: true, shiftKey: true }))).toBeNull();
    expect(historyShortcut(key("x", { ctrlKey: true }))).toBeNull();
  });
});

describe("isTextField", () => {
  it("is true for a textarea, a text input and an editable element", () => {
    expect(isTextField({ tagName: "TEXTAREA" })).toBe(true);
    expect(isTextField({ tagName: "INPUT", type: "text" })).toBe(true);
    expect(isTextField({ tagName: "INPUT", type: "number" })).toBe(true);
    expect(isTextField({ tagName: "INPUT" })).toBe(true);
    expect(isTextField({ tagName: "DIV", isContentEditable: true })).toBe(true);
  });

  it("is false for anything else", () => {
    expect(isTextField(null)).toBe(false);
    expect(isTextField({ tagName: "BODY" })).toBe(false);
    expect(isTextField({ tagName: "BUTTON" })).toBe(false);
    expect(isTextField({ tagName: "SELECT" })).toBe(false);
    expect(isTextField({ tagName: "CANVAS" })).toBe(false);
    expect(isTextField({ tagName: "INPUT", type: "checkbox" })).toBe(false);
    expect(isTextField({ tagName: "DIV", isContentEditable: false })).toBe(false);
  });
});

describe("handleHistoryKey", () => {
  function counter() {
    const calls: string[] = [];
    return { calls, undo: () => calls.push("undo"), redo: () => calls.push("redo") };
  }

  it("runs undo and redo and stops the browser's own action", () => {
    const actions = counter();
    const undoKey = key("z", { metaKey: true });
    expect(handleHistoryKey(undoKey, actions)).toBe(true);
    const redoKey = key("y", { ctrlKey: true });
    expect(handleHistoryKey(redoKey, actions)).toBe(true);
    expect(actions.calls).toEqual(["undo", "redo"]);
    expect(undoKey.prevented).toBe(1);
    expect(redoKey.prevented).toBe(1);
  });

  it("does nothing in a text field or for another key", () => {
    const actions = counter();
    const inField = key("z", { ctrlKey: true, target: { tagName: "INPUT", type: "text" } });
    expect(handleHistoryKey(inField, actions)).toBe(false);
    const other = key("a", { ctrlKey: true });
    expect(handleHistoryKey(other, actions)).toBe(false);
    expect(actions.calls).toEqual([]);
    expect(inField.prevented).toBe(0);
    expect(other.prevented).toBe(0);
  });
});
