// Unit tests of the undo history (card PX-02.3, ./history.ts).
import { describe, expect, it } from "vitest";
import {
  canRedo,
  canUndo,
  createHistory,
  HISTORY_LIMIT,
  type History,
  record,
  redo,
  undo,
} from "./history";

function recordAll<T>(history: History<T>, values: T[], limit?: number): History<T> {
  return values.reduce((current, value) => record(current, value, limit), history);
}

describe("history", () => {
  it("starts with one value and no step", () => {
    const history = createHistory("a");
    expect(history).toEqual({ past: [], present: "a", future: [] });
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
    expect(undo(history)).toBe(history);
    expect(redo(history)).toBe(history);
  });

  it("records a new value as one undo step and the present value as nothing", () => {
    const start = createHistory("a");
    const next = record(start, "b");
    expect(next).toEqual({ past: ["a"], present: "b", future: [] });
    expect(start).toEqual({ past: [], present: "a", future: [] });
    expect(record(next, "b")).toBe(next);
  });

  it("walks back and forward", () => {
    const end = recordAll(createHistory("a"), ["b", "c"]);
    const one = undo(end);
    expect(one).toEqual({ past: ["a"], present: "b", future: ["c"] });
    const two = undo(one);
    expect(two).toEqual({ past: [], present: "a", future: ["b", "c"] });
    expect(canUndo(two)).toBe(false);
    expect(canRedo(two)).toBe(true);
    expect(undo(two)).toBe(two);
    expect(redo(two)).toEqual(one);
    expect(redo(redo(two))).toEqual(end);
    expect(redo(end)).toBe(end);
  });

  it("drops the redo steps when a value is recorded after an undo", () => {
    const back = undo(recordAll(createHistory("a"), ["b", "c"]));
    const branched = record(back, "d");
    expect(branched).toEqual({ past: ["a", "b"], present: "d", future: [] });
    expect(canRedo(branched)).toBe(false);
    // Recording the present value again keeps the redo steps: nothing changed.
    expect(record(back, "b")).toBe(back);
  });

  it("keeps HISTORY_LIMIT undo steps, at least 100, and drops the oldest", () => {
    expect(HISTORY_LIMIT).toBeGreaterThanOrEqual(100);
    const values = Array.from({ length: HISTORY_LIMIT + 5 }, (_, index) => index + 1);
    let history = recordAll(createHistory(0), values);
    expect(history.past).toHaveLength(HISTORY_LIMIT);
    expect(history.present).toBe(HISTORY_LIMIT + 5);
    // The values 0 to 4 are gone: the oldest step left is 5.
    expect(history.past[0]).toBe(5);
    let steps = 0;
    while (canUndo(history)) {
      history = undo(history);
      steps += 1;
    }
    expect(steps).toBe(HISTORY_LIMIT);
    expect(history.present).toBe(5);
    expect(history.future).toHaveLength(HISTORY_LIMIT);
  });

  it("takes another limit", () => {
    const history = recordAll(createHistory(0), [1, 2, 3, 4], 2);
    expect(history).toEqual({ past: [2, 3], present: 4, future: [] });
    expect(recordAll(createHistory(0), [1, 2], 0)).toEqual({ past: [1], present: 2, future: [] });
  });
});
