/**
 * Fibonacci retracement levels.
 *
 * A retracement is measured over one swing: from a swing low up to a swing
 * high (an up move), or from a swing high down to a swing low (a down move).
 * The 0% level sits at the **end** of the swing and 100% at its **start**, and
 * the intermediate ratios are read as candidate support levels inside the
 * swing — the price is expected to pause at one of them before resuming.
 *
 * This module is deliberately free of Effect and Plot imports so the math can
 * be unit-tested in isolation.
 */

import type { SeriesPoint } from "./bollinger.ts";

/** The canonical retracement ratios, ascending from the swing end. */
export const FIBONACCI_RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const;

/** One retracement level placed on the price axis. */
export type FibonacciLevel = {
  /** Fraction of the swing, e.g. `0.618`. */
  readonly ratio: number;
  /** The ratio as display text, e.g. `"61.8%"`. */
  readonly label: string;
  /** The price this level maps to. */
  readonly value: number;
};

/** A retracement over the most recent swing of the series. */
export type FibonacciRetracement = {
  /** `"up"` when the swing rose (low before high); `"down"` when it fell. */
  readonly direction: "up" | "down";
  readonly swingHigh: number;
  readonly swingLow: number;
  readonly highTimestamp: number;
  readonly lowTimestamp: number;
  /** How many observations the swing was measured over. */
  readonly windowSize: number;
  /**
   * The levels ordered by ascending ratio, so the list starts at the end of
   * the swing (0%) and walks back to its start (100%).
   */
  readonly levels: FibonacciLevel[];
};

/** Render a ratio as a percentage, dropping a trailing `.0` (50% not 50.0%). */
const formatRatio = (ratio: number): string =>
  `${parseFloat((ratio * 100).toFixed(1))}%`;

/**
 * Find the retracement levels for the most recent swing in `points`.
 *
 * The swing is the maximum and minimum of a trailing window of `lookback`
 * observations (the whole series when `lookback` is omitted or invalid). Which
 * extreme came first decides the direction: a low before a high is an up move,
 * so the levels are counted *down* from the high; a high before a low is a down
 * move, so they are counted *up* from the low.
 *
 * Returns `null` when nothing can be measured — fewer than two observations, or
 * a window that never moves (a flat series has no swing to retrace).
 */
export function fibonacciRetracement(
  points: readonly SeriesPoint[],
  lookback?: number,
): FibonacciRetracement | null {
  if (points.length < 2) return null;

  const hasLookback = typeof lookback === "number" &&
    Number.isInteger(lookback) &&
    lookback >= 2 &&
    lookback < points.length;
  const windowSize = hasLookback ? (lookback as number) : points.length;
  const window = points.slice(points.length - windowSize);

  let high = window[0];
  let low = window[0];
  for (const p of window) {
    if (p.value > high.value) high = p;
    if (p.value < low.value) low = p;
  }

  const range = high.value - low.value;
  if (!(range > 0)) return null;

  const direction = low.timestamp < high.timestamp ? "up" : "down";

  const levels = FIBONACCI_RATIOS.map((ratio): FibonacciLevel => ({
    ratio,
    label: formatRatio(ratio),
    value: direction === "up"
      // Up move: 0% at the high, 100% at the low, retracing down.
      ? high.value - range * ratio
      : low.value + range * ratio,
  }));

  return {
    direction,
    swingHigh: high.value,
    swingLow: low.value,
    highTimestamp: high.timestamp,
    lowTimestamp: low.timestamp,
    windowSize,
    levels,
  };
}
