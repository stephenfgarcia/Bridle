// Unit tests of the tools' keys (card PX-02.4, ./toolKeys.ts).
import { describe, expect, it } from "vitest";
import { TOOL_KEYS, toolKeyAction } from "./toolKeys";

const key = (k: string, extra: Record<string, unknown> = {}) => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  target: { tagName: "BODY" },
  ...extra,
});

describe("toolKeyAction", () => {
  it("has one key per tool: V, N, M, S and L, in either case", () => {
    expect(TOOL_KEYS).toEqual({ select: "V", node: "N", member: "M", support: "S", load: "L" });
    expect(toolKeyAction(key("s"))).toEqual({ type: "tool", tool: "support" });
    expect(toolKeyAction(key("L"))).toEqual({ type: "tool", tool: "load" });
    expect(toolKeyAction(key("v"))).toEqual({ type: "tool", tool: "select" });
    expect(toolKeyAction(key("V"))).toEqual({ type: "tool", tool: "select" });
    expect(toolKeyAction(key("n"))).toEqual({ type: "tool", tool: "node" });
    expect(toolKeyAction(key("M"))).toEqual({ type: "tool", tool: "member" });
    expect(toolKeyAction(key("x"))).toBeNull();
    expect(toolKeyAction(key("Enter"))).toBeNull();
  });

  it("Escape, Delete and Backspace", () => {
    expect(toolKeyAction(key("Escape"))).toEqual({ type: "escape" });
    expect(toolKeyAction(key("Delete"))).toEqual({ type: "delete" });
    expect(toolKeyAction(key("Backspace"))).toEqual({ type: "delete" });
  });

  it("nothing with Ctrl, Cmd or Alt", () => {
    for (const modifier of ["ctrlKey", "metaKey", "altKey"]) {
      expect(toolKeyAction(key("n", { [modifier]: true }))).toBeNull();
      expect(toolKeyAction(key("Delete", { [modifier]: true }))).toBeNull();
      expect(toolKeyAction(key("Escape", { [modifier]: true }))).toBeNull();
    }
  });

  it("in a text field only Escape acts", () => {
    for (const target of [
      { tagName: "INPUT", type: "text" },
      { tagName: "TEXTAREA" },
      { tagName: "DIV", isContentEditable: true },
    ]) {
      expect(toolKeyAction(key("n", { target }))).toBeNull();
      expect(toolKeyAction(key("Delete", { target }))).toBeNull();
      expect(toolKeyAction(key("Backspace", { target }))).toBeNull();
      expect(toolKeyAction(key("Escape", { target }))).toEqual({ type: "escape" });
    }
  });

  it("on a select a letter picks an option, and Delete still acts; a button takes every key", () => {
    const select = { tagName: "SELECT" };
    expect(toolKeyAction(key("m", { target: select }))).toBeNull();
    expect(toolKeyAction(key("Delete", { target: select }))).toEqual({ type: "delete" });
    const button = { tagName: "BUTTON", type: "button" };
    expect(toolKeyAction(key("m", { target: button }))).toEqual({ type: "tool", tool: "member" });
    expect(toolKeyAction(key("Delete", { target: button }))).toEqual({ type: "delete" });
    expect(toolKeyAction(key("n", { target: null }))).toEqual({ type: "tool", tool: "node" });
  });
});
