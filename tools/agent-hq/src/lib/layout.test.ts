import { describe, expect, it } from "vitest";
import { DESK_UNIT, layoutDesks, STAGE_H, STAGE_W } from "./layout";

describe("layoutDesks", () => {
  it("places every desk inside the stage for 1 to 24 agents", () => {
    for (let n = 1; n <= 24; n += 1) {
      const slots = layoutDesks(n);
      expect(slots).toHaveLength(n);
      for (const s of slots) {
        const half = (DESK_UNIT * s.scale) / 2;
        expect(s.x - half).toBeGreaterThanOrEqual(0);
        expect(s.x + half).toBeLessThanOrEqual(STAGE_W);
        expect(s.y).toBeLessThanOrEqual(STAGE_H);
        expect(s.y - DESK_UNIT * s.scale).toBeGreaterThan(0);
      }
    }
  });

  it("puts the front row first and makes back rows smaller", () => {
    const slots = layoutDesks(8);
    expect(slots.slice(0, 4).every((s) => s.row === 0)).toBe(true);
    expect(slots.slice(4).every((s) => s.row === 1)).toBe(true);
    const front = slots[0];
    const back = slots[4];
    expect(front && back && back.scale < front.scale).toBe(true);
    expect(front && back && back.y < front.y).toBe(true);
    expect(front && back && back.z < front.z).toBe(true);
  });

  it("leaves a centre aisle in every row", () => {
    for (const n of [4, 8, 12, 18]) {
      for (const s of layoutDesks(n)) {
        expect(Math.abs(s.x - STAGE_W / 2)).toBeGreaterThan(100);
      }
    }
  });

  it("returns nothing for zero agents", () => {
    expect(layoutDesks(0)).toEqual([]);
  });
});
