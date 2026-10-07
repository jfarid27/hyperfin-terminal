import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { bollingerBands, type SeriesPoint } from "./bollinger.ts";

/** Build a series from bare values, one observation per day from an epoch. */
const series = (...values: number[]): SeriesPoint[] =>
  values.map((value, i) => ({ timestamp: Date.UTC(2026, 0, 1 + i), value }));

/** Assert `actual` is within `tolerance` of `expected`. */
const near = (actual: number, expected: number, tolerance = 1e-9) =>
  Math.abs(actual - expected) <= tolerance;

/** Recompute the bands the slow, obvious way — one full pass per window. */
const naiveBands = (values: number[], period: number, stddev: number) => {
  const out: { mid: number; upper: number; lower: number; sd: number }[] = [];
  for (let i = period - 1; i < values.length; i++) {
    const window = values.slice(i - period + 1, i + 1);
    const mean = window.reduce((a, b) => a + b, 0) / period;
    const variance = window.reduce((a, v) => a + (v - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    out.push({ mid: mean, upper: mean + stddev * sd, lower: mean - stddev * sd, sd });
  }
  return out;
};

describe("bollingerBands", () => {
  it("computes the mid as the window mean and the bands at k standard deviations", () => {
    const bands = bollingerBands(series(1, 2, 3, 4, 5), 3, 2);

    expect(bands.length, "one band per completed window").toBe(3);

    // First window is [1, 2, 3]: mean 2, population sd sqrt(2/3).
    const sd = Math.sqrt(2 / 3);
    expect(near(bands[0].mid, 2), "mid is the window mean").toBe(true);
    expect(near(bands[0].sd, sd), "sd is the population deviation").toBe(true);
    expect(near(bands[0].upper, 2 + 2 * sd), "upper band").toBe(true);
    expect(near(bands[0].lower, 2 - 2 * sd), "lower band").toBe(true);
  });

  it("carries the timestamp of the newest observation in each window", () => {
    const points = series(1, 2, 3, 4, 5);
    const bands = bollingerBands(points, 3);

    expect(bands.map((b) => b.timestamp)).toEqual([
      points[2].timestamp,
      points[3].timestamp,
      points[4].timestamp,
    ]);
  });

  it("uses a trailing window that drops the oldest observation", () => {
    const bands = bollingerBands(series(1, 2, 3, 4, 5), 3);

    expect(near(bands[1].mid, 3), "second window is [2, 3, 4]").toBe(true);
    expect(near(bands[2].mid, 4), "third window is [3, 4, 5]").toBe(true);
  });

  it("emits nothing when the series is shorter than the period", () => {
    expect(bollingerBands(series(1, 2), 3).length).toBe(0);
    expect(bollingerBands([], 3).length).toBe(0);
  });

  it("collapses to the price when the period is 1", () => {
    const bands = bollingerBands(series(4, 5, 6), 1, 2);

    expect(bands.length).toBe(3);
    for (const [i, band] of bands.entries()) {
      expect(near(band.sd, 0), "a one-bar window has no deviation").toBe(true);
      expect(near(band.mid, [4, 5, 6][i]), "mid is the bar itself").toBe(true);
      expect(near(band.upper, band.mid), "bands meet the price").toBe(true);
      expect(near(band.lower, band.mid), "bands meet the price").toBe(true);
    }
  });

  it("reports zero deviation on a flat series", () => {
    const bands = bollingerBands(series(7, 7, 7, 7), 3);

    expect(bands.length).toBe(2);
    for (const band of bands) {
      expect(near(band.sd, 0), "a flat window has no deviation").toBe(true);
      expect(near(band.upper, 7) && near(band.lower, 7), "bands sit on the price").toBe(true);
    }
  });

  it("never reports a negative deviation on a near-constant series", () => {
    // The incremental sum-of-squares can dip below the mean-squared term and
    // would otherwise produce NaN through Math.sqrt of a negative variance.
    const bands = bollingerBands(series(1e8, 1e8 + 1e-6, 1e8, 1e8 - 1e-6), 3);

    for (const band of bands) {
      expect(band.sd >= 0, "deviation is clamped at zero").toBe(true);
      expect(Number.isNaN(band.upper), "no NaN leaks into the bands").toBe(false);
    }
  });

  it("agrees with a naive window-by-window recalculation", () => {
    // A deterministic, non-monotonic series that exercises the incremental
    // window updates rather than a single tidy ramp.
    const values = Array.from({ length: 60 }, (_, i) =>
      100 + Math.sin(i / 3) * 10 + Math.cos(i / 7) * 4);

    const fast = bollingerBands(series(...values), 20, 2);
    const slow = naiveBands(values, 20, 2);

    expect(fast.length).toBe(slow.length);
    for (let i = 0; i < slow.length; i++) {
      expect(near(fast[i].mid, slow[i].mid, 1e-9), `mid at ${i}`).toBe(true);
      expect(near(fast[i].sd, slow[i].sd, 1e-9), `sd at ${i}`).toBe(true);
      expect(near(fast[i].upper, slow[i].upper, 1e-9), `upper at ${i}`).toBe(true);
      expect(near(fast[i].lower, slow[i].lower, 1e-9), `lower at ${i}`).toBe(true);
    }
  });

  it("defaults to a 20-period, 2-deviation envelope", () => {
    const values = Array.from({ length: 25 }, (_, i) => i + 1);
    const bands = bollingerBands(series(...values));
    const slow = naiveBands(values, 20, 2);

    expect(bands.length, "25 points yield 6 completed 20-bar windows").toBe(6);
    expect(near(bands[0].upper, slow[0].upper)).toBe(true);
  });

  it("rejects nonsense parameters instead of returning junk", () => {
    expect(bollingerBands(series(1, 2, 3), 0).length).toBe(0);
    expect(bollingerBands(series(1, 2, 3), -3).length).toBe(0);
    expect(bollingerBands(series(1, 2, 3), 2.5).length).toBe(0);
    expect(bollingerBands(series(1, 2, 3), 2, -1).length).toBe(0);
    expect(bollingerBands(series(1, 2, 3), 2, Number.NaN).length).toBe(0);
  });
});
