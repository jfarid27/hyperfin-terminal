/**
 * Bollinger Bands — a simple moving average with an envelope of ±k standard
 * deviations around it.
 *
 * The bands widen when the series is volatile and contract when it is quiet,
 * so they are normally read as a volatility regime (and as dynamic
 * support/resistance), not as a directional signal.
 *
 * This module is deliberately free of Effect and Plot imports so the math can
 * be unit-tested in isolation.
 */

/**
 * A single observation of the series an indicator is computed over.
 *
 * Declared as a type alias (not an interface) on purpose: Observable Plot's
 * data channel wants a `Record<string, any>[]`, and only object *type aliases*
 * get an implicit index signature in TypeScript — interfaces are rejected with
 * "Index signature for type 'string' is missing".
 */
export type SeriesPoint = {
  /** Unix epoch timestamp in **milliseconds**. */
  readonly timestamp: number;
  /** The observed value (e.g. a closing price). */
  readonly value: number;
};

/** The three band values, plus the deviation they were derived from, at one time. */
export type BollingerPoint = {
  readonly timestamp: number;
  /** The basis: the simple moving average over `period`. */
  readonly mid: number;
  /** `mid + k * sd`. */
  readonly upper: number;
  /** `mid - k * sd`. */
  readonly lower: number;
  /** The population standard deviation of the window. */
  readonly sd: number;
};

export const DEFAULT_BOLLINGER_PERIOD = 20;
export const DEFAULT_BOLLINGER_STDDEV = 2;

/**
 * Compute Bollinger Bands over `points`.
 *
 * A band value is only emitted once a full window is available, so the result
 * is `points.length - period + 1` long — and empty when the series is shorter
 * than `period`. The deviation is the *population* standard deviation (divide
 * by `period`), which is what TradingView and most charting packages use.
 *
 * The window mean and sum of squares are carried forward incrementally, so the
 * whole series is one pass rather than one pass per bar.
 */
export function bollingerBands(
  points: readonly SeriesPoint[],
  period: number = DEFAULT_BOLLINGER_PERIOD,
  stddev: number = DEFAULT_BOLLINGER_STDDEV,
): BollingerPoint[] {
  if (!Number.isInteger(period) || period < 1) return [];
  if (!Number.isFinite(stddev) || stddev < 0) return [];
  if (points.length < period) return [];

  const out: BollingerPoint[] = [];
  let sum = 0;
  let sumSquares = 0;

  for (let i = 0; i < points.length; i++) {
    const value = points[i].value;
    sum += value;
    sumSquares += value * value;

    // Drop the observation that just fell out of the trailing window.
    if (i >= period) {
      const dropped = points[i - period].value;
      sum -= dropped;
      sumSquares -= dropped * dropped;
    }

    if (i >= period - 1) {
      const mean = sum / period;
      // Population variance. Clamped at zero because the incremental
      // sum-of-squares can land a hair below zero on a near-constant series.
      const variance = Math.max(0, sumSquares / period - mean * mean);
      const sd = Math.sqrt(variance);
      out.push({
        timestamp: points[i].timestamp,
        mid: mean,
        upper: mean + stddev * sd,
        lower: mean - stddev * sd,
        sd,
      });
    }
  }

  return out;
}
