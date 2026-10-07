import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import type { SeriesPoint } from "./bollinger.ts";
import { FIBONACCI_RATIOS, fibonacciRetracement } from "./fibonacci.ts";

/** Build a series from bare values, one observation per day from an epoch. */
const series = (...values: number[]): SeriesPoint[] =>
  values.map((value, i) => ({ timestamp: Date.UTC(2026, 0, 1 + i), value }));

/** The level for a given ratio, if present. */
const level = (out: ReturnType<typeof fibonacciRetracement>, ratio: number) =>
  out?.levels.find((l) => l.ratio === ratio);

describe("fibonacciRetracement", () => {
  it("labels an up move from the swing high, retracing down to the low", () => {
    // Low (10) precedes high (20): an up move, so 0% sits at the high.
    const out = fibonacciRetracement(series(10, 12, 14, 13, 20));

    expect(out?.direction).toBe("up");
    expect(out?.swingHigh).toBe(20);
    expect(out?.swingLow).toBe(10);
    expect(level(out, 0)?.value, "0% is the swing high").toBe(20);
    expect(level(out, 0.5)?.value, "50% is the midpoint").toBe(15);
    expect(level(out, 0.618)?.value, "61.8% retraces to the low side").toBeCloseTo(13.82, 6);
    expect(level(out, 1)?.value, "100% is the swing low").toBe(10);
  });

  it("labels a down move from the swing low, retracing up to the high", () => {
    // High (20) precedes low (10): a down move, so 0% sits at the low.
    const out = fibonacciRetracement(series(20, 18, 16, 17, 10));

    expect(out?.direction).toBe("down");
    expect(level(out, 0)?.value, "0% is the swing low").toBe(10);
    expect(level(out, 0.5)?.value, "50% is the midpoint").toBe(15);
    expect(level(out, 0.618)?.value, "61.8% retraces back up").toBeCloseTo(16.18, 6);
    expect(level(out, 1)?.value, "100% is the swing high").toBe(20);
  });

  it("emits the canonical ratios as display labels", () => {
    const out = fibonacciRetracement(series(10, 20));

    expect(out?.levels.map((l) => l.ratio)).toEqual([...FIBONACCI_RATIOS]);
    expect(out?.levels.map((l) => l.label)).toEqual([
      "0%",
      "23.6%",
      "38.2%",
      "50%",
      "61.8%",
      "78.6%",
      "100%",
    ]);
  });

  it("measures the swing over only the trailing lookback window", () => {
    // Over all 5 points the swing is 10..20; over the last 3 it is 13..20.
    const out = fibonacciRetracement(series(10, 12, 14, 13, 20), 3);

    expect(out?.windowSize).toBe(3);
    expect(out?.swingHigh).toBe(20);
    expect(out?.swingLow, "the earlier low falls outside the window").toBe(13);
    expect(level(out, 0)?.value).toBe(20);
    expect(level(out, 1)?.value).toBe(13);
  });

  it("ignores a lookback that would not change the window", () => {
    const points = series(10, 12, 14, 13, 20);

    expect(fibonacciRetracement(points, 99)?.windowSize, "longer than the series").toBe(5);
    expect(fibonacciRetracement(points, 1)?.windowSize, "below two points").toBe(5);
    expect(fibonacciRetracement(points, 2.5)?.windowSize, "not an integer").toBe(5);
  });

  it("returns null when there is no swing to measure", () => {
    expect(fibonacciRetracement([]), "empty series").toBe(null);
    expect(fibonacciRetracement(series(42)), "single point").toBe(null);
    expect(fibonacciRetracement(series(5, 5, 5)), "flat series").toBe(null);
  });

  it("breaks ties on a single-point window without throwing", () => {
    const out = fibonacciRetracement(series(5, 8));

    expect(out?.windowSize).toBe(2);
    expect(out?.direction, "the high comes last, so it is an up move").toBe("up");
  });
});
