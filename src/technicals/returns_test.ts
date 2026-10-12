import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { dailyReturns, returnStats } from "./returns.ts";
import type { SeriesPoint } from "./bollinger.ts";

const series = (...values: number[]): SeriesPoint[] =>
  values.map((value, i) => ({ timestamp: Date.UTC(2026, 0, 1 + i), value }));

describe("dailyReturns", () => {
  it("measures each observation against the one before it", () => {
    const returns = dailyReturns(series(100, 110, 99));

    expect(returns.length, "one fewer return than observations").toBe(2);
    expect(returns[0].value).toBeCloseTo(10, 10);
    expect(returns[1].value).toBeCloseTo(-10, 10);
    // The return is attributed to the day it happened on, not the prior day.
    expect(returns[0].timestamp).toBe(Date.UTC(2026, 0, 2));
    expect(returns[1].timestamp).toBe(Date.UTC(2026, 0, 3));
  });

  it("carries the sign through: down days are negative", () => {
    const returns = dailyReturns(series(50, 40));
    expect(returns[0].value).toBeLessThan(0);
  });

  it("produces no return for a single observation or an empty series", () => {
    expect(dailyReturns(series(100)).length).toBe(0);
    expect(dailyReturns([]).length).toBe(0);
  });

  it("skips a change that cannot be measured", () => {
    // A zero base and a non-finite close both yield a meaningless percentage,
    // so those bars are dropped rather than emitting NaN/Infinity points.
    expect(dailyReturns(series(100, 0, 50)).length, "zero base is skipped").toBe(1);
    expect(dailyReturns(series(100, Number.NaN, 100)).length).toBe(0);
    expect(dailyReturns(series(Number.NaN, 100)).length).toBe(0);
  });

  it("agrees with a naive percent-change reimplementation", () => {
    const values = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 3) * 10 + i * 0.5);
    const returns = dailyReturns(series(...values));

    expect(returns.length).toBe(values.length - 1);
    values.slice(1).forEach((v, i) => {
      const naive = (v / values[i] - 1) * 100;
      expect(returns[i].value).toBeCloseTo(naive, 10);
    });
  });
});

describe("returnStats", () => {
  it("summarises mean, population sd, range and the latest return", () => {
    const stats = returnStats(dailyReturns(series(100, 110, 99)));

    expect(stats).not.toBeNull();
    expect(stats!.count).toBe(2);
    expect(stats!.mean).toBeCloseTo(0, 10);
    expect(stats!.sd, "the two returns are +10 and -10, so sd is 10").toBeCloseTo(10, 10);
    expect(stats!.min).toBeCloseTo(-10, 10);
    expect(stats!.max).toBeCloseTo(10, 10);
    expect(stats!.latest).toBeCloseTo(-10, 10);
  });

  it("returns null for an empty series", () => {
    expect(returnStats([])).toBeNull();
  });

  it("clamps a flat series to zero deviation rather than NaN", () => {
    const stats = returnStats(dailyReturns(series(100, 100, 100, 100)));

    expect(stats!.sd).toBe(0);
    expect(stats!.mean).toBe(0);
  });
});
