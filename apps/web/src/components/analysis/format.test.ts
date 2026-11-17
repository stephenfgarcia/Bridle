// Unit tests of ./format.ts (card PX-02.8): how the numbers of the results are written.
import { describe, expect, it } from "vitest";
import { formatMs, formatNumber, formatRatio, largestOf, NEGLIGIBLE } from "./format";

describe("formatNumber", () => {
  it("writes four significant digits in plain decimals", () => {
    expect(formatNumber(20)).toBe("20.00");
    expect(formatNumber(-13.3333)).toBe("-13.33");
    expect(formatNumber(5.32608)).toBe("5.326");
    expect(formatNumber(0.5)).toBe("0.5000");
    expect(formatNumber(0.00123456)).toBe("0.001235");
    expect(formatNumber(123.456)).toBe("123.5");
    expect(formatNumber(999.96)).toBe("1000");
    expect(formatNumber(1234.56)).toBe("1235");
    expect(formatNumber(12345.6)).toBe("12350");
    expect(formatNumber(-999999)).toBe("-1.000e+6");
  });

  it("writes an exponent below 0.001 and from 1 000 000", () => {
    expect(formatNumber(0.0005)).toBe("5.000e-4");
    expect(formatNumber(-1.23456e-7)).toBe("-1.235e-7");
    expect(formatNumber(0.00099996)).toBe("0.001000");
    expect(formatNumber(1e6)).toBe("1.000e+6");
    expect(formatNumber(999999.9)).toBe("1.000e+6");
    expect(formatNumber(999900)).toBe("999900");
    expect(formatNumber(2.5e9)).toBe("2.500e+9");
  });

  it("writes 0 for zero, for minus zero and for a value negligible beside the largest of its group", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(-0)).toBe("0");
    expect(formatNumber(3e-15, 20)).toBe("0");
    expect(formatNumber(-3e-15, 20)).toBe("0");
    expect(formatNumber(20 * NEGLIGIBLE, 20)).toBe("0");
    // Just above the threshold the value is printed.
    expect(formatNumber(20 * NEGLIGIBLE * 2, 20)).toBe("4.000e-8");
    // Without a group only an exact zero is "0".
    expect(formatNumber(3e-15)).toBe("3.000e-15");
    // A group whose largest value is 0 holds only zeros.
    expect(formatNumber(0, 0)).toBe("0");
  });

  it("never writes a signed zero", () => {
    for (const value of [-1e-20, -4.9e-12, -0.00049]) {
      expect(formatNumber(value, 1)).not.toMatch(/^-0(\.0+)?$/);
    }
  });

  it("writes a value that is not finite as JavaScript names it", () => {
    expect(formatNumber(Number.NaN)).toBe("NaN");
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe("Infinity");
    expect(formatNumber(Number.NEGATIVE_INFINITY, 5)).toBe("-Infinity");
  });
});

describe("largestOf", () => {
  it("is the largest absolute value, 0 for none, and leaves out what is not finite", () => {
    expect(largestOf([1, -7, 3])).toBe(7);
    expect(largestOf([])).toBe(0);
    expect(largestOf([Number.NaN, 2, Number.POSITIVE_INFINITY])).toBe(2);
  });
});

describe("formatMs and formatRatio", () => {
  it("writes one decimal below 10 ms and whole milliseconds from there", () => {
    expect(formatMs(3.44)).toBe("3.4");
    expect(formatMs(0.04)).toBe("0.0");
    expect(formatMs(9.96)).toBe("10");
    expect(formatMs(27.4)).toBe("27");
    expect(formatMs(1234.5)).toBe("1235");
    expect(formatMs(-1)).toBe("0");
    expect(formatMs(Number.NaN)).toBe("0");
  });

  it("writes a ratio with two significant digits and an exponent", () => {
    expect(formatRatio(3.14e-10)).toBe("3.1e-10");
    expect(formatRatio(0.25)).toBe("2.5e-1");
  });
});
