/**
 * Daily returns — the percent change of each observation against the previous
 * one.
 *
 * A return is attributed to the *day it happened on*: the value carried at a
 * bar's timestamp is that bar's close measured against the close of the bar
 * before it. The first bar therefore has no return (there is nothing to measure
 * it against), so a series of `n` closes yields `n - 1` returns.
 *
 * Returns are signed — a red day is negative and a green day is positive — and
 * are read relative to a zero baseline, not to an absolute price level.
 *
 * This module is deliberately free of Effect and Plot imports so the math can
 * be unit-tested in isolation.
 */

import type { SeriesPoint } from "./bollinger.ts";

/** One daily return: the percent change at a timestamp. */
export type ReturnPoint = {
  /** Unix epoch timestamp in **milliseconds** of the bar the return belongs to. */
  readonly timestamp: number;
  /** Percent change against the previous bar, e.g. `1.23` is +1.23%. */
  readonly value: number;
};

/** A compact summary of a daily-return series. */
export type ReturnStats = {
  /** How many returns the series holds (one fewer than the underlying bars). */
  readonly count: number;
  /** Mean return, in percent. */
  readonly mean: number;
  /** Population standard deviation of the returns, in percent (the daily vol). */
  readonly sd: number;
  readonly min: number;
  readonly max: number;
  /** The most recent return, in percent. */
  readonly latest: number;
};

/**
 * Percent change from `previous` to `current`.
 *
 * Returns `null` instead of a number when either side is not finite or the base
 * is zero — a percentage against a zero (or missing) close is meaningless.
 */
const percentChange = (current: number, previous: number): number | null =>
  Number.isFinite(current) && Number.isFinite(previous) && previous !== 0
    ? ((current - previous) / previous) * 100
    : null;

/**
 * Compute the daily percent returns of a series.
 *
 * The series is expected oldest-first (the same assumption the other
 * indicators make). Observations whose percent change cannot be computed — a
 * non-finite close, or a zero previous close — are skipped rather than
 * emitting a `NaN`/`Infinity` point onto the chart.
 */
export function dailyReturns(points: readonly SeriesPoint[]): ReturnPoint[] {
  const out: ReturnPoint[] = [];

  for (let i = 1; i < points.length; i++) {
    const change = percentChange(points[i].value, points[i - 1].value);
    if (change === null) continue;
    out.push({ timestamp: points[i].timestamp, value: change });
  }

  return out;
}

/**
 * Summarise a daily-return series: mean, population standard deviation (the
 * daily volatility), range, and the latest observation.
 *
 * Returns `null` for an empty series so a caller can skip the read-out instead
 * of printing `NaN`s.
 */
export function returnStats(returns: readonly ReturnPoint[]): ReturnStats | null {
  const count = returns.length;
  if (count === 0) return null;

  const values = returns.map((r) => r.value);
  const mean = values.reduce((acc, v) => acc + v, 0) / count;
  // Clamped at zero: the two-pass formula can land a hair below zero on a
  // near-constant series, and `Math.sqrt` of a negative yields NaN.
  const variance = Math.max(
    0,
    values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / count,
  );

  return {
    count,
    mean,
    sd: Math.sqrt(variance),
    min: Math.min(...values),
    max: Math.max(...values),
    latest: values[count - 1],
  };
}
