/**
 * Observable Plot marks for technical overlays.
 *
 * Kept separate from `src/cli/components/charting.ts` (which owns the plot
 * *frame*) and from the indicator math in `./bollinger.ts` / `./fibonacci.ts`:
 * these functions only translate a computed indicator into drawable marks, so
 * they can be rendered to SVG and asserted on in isolation.
 */

import * as Plot from "@observablehq/plot";
import type { BollingerPoint, FibonacciRetracement, ReturnPoint, SeriesPoint } from "./index.ts";
import { bollingerBands, DEFAULT_BOLLINGER_PERIOD, DEFAULT_BOLLINGER_STDDEV, fibonacciRetracement } from "./index.ts";

/** Envelope colour — distinct from the white price line and the orange levels. */
const BAND_STROKE = "#4fc3f7";
/** Retracement-level colour. */
const LEVEL_STROKE = "#ffb74d";
/** Baseline colour — muted, since it is a reference line rather than a signal. */
const BASELINE_STROKE = "#9e9e9e";
/** Return-bar colours: blue for an up day, red for a down day. */
export const RETURN_UP_FILL = "#42a5f5";
export const RETURN_DOWN_FILL = "#ef5350";
/** Guide-line blue for the ±kσ bands — lighter than a bar so it reads as a guide. */
export const RETURN_SIGMA_STROKE = "#90caf9";
/** How many daily deviations the returns guide bands sit at. */
export const RETURN_SIGMA_MULTIPLE = 2;
/** Half a day in ms — each daily return bar spans one day, centred on its point. */
const HALF_DAY_MS = 12 * 60 * 60 * 1000;

/**
 * Format a price for a level label.
 *
 * The scale has to hold for both a four-figure equity price and a
 * sub-cent token, so the precision tracks magnitude rather than being fixed.
 */
export function formatLevelValue(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  const abs = Math.abs(value);
  if (abs === 0) return "0";
  if (abs >= 1) return value.toFixed(2);
  if (abs >= 0.01) return value.toFixed(4);
  return value.toPrecision(4);
}

/** Plot marks drawing the Bollinger envelope: a shaded band plus mid/edge lines. */
export function bollingerBandsOverlay(
  bands: readonly BollingerPoint[],
): Plot.Markish[] {
  if (bands.length === 0) return [];

  // Plot wants a plain mutable array; the indicator returns a readonly one.
  const rows = bands.map((b) => ({ ...b }));
  const at = (d: BollingerPoint) => new Date(d.timestamp);

  return [
    // The shaded envelope between the two outer bands.
    Plot.areaY(rows, {
      x: at,
      y1: (d) => d.lower,
      y2: (d) => d.upper,
      fill: BAND_STROKE,
      fillOpacity: 0.12,
    }),
    Plot.line(rows, {
      x: at,
      y: (d) => d.upper,
      stroke: BAND_STROKE,
      strokeWidth: 1,
      strokeDasharray: "4,3",
    }),
    Plot.line(rows, {
      x: at,
      y: (d) => d.mid,
      stroke: BAND_STROKE,
      strokeWidth: 1.2,
    }),
    Plot.line(rows, {
      x: at,
      y: (d) => d.lower,
      stroke: BAND_STROKE,
      strokeWidth: 1,
      strokeDasharray: "4,3",
    }),
  ];
}

/** Plot marks drawing a Fibonacci retracement: a labelled horizontal rule per level. */
export function fibonacciOverlay(
  retracement: FibonacciRetracement | null,
): Plot.Markish[] {
  if (!retracement) return [];

  const levels = retracement.levels.map((l) => ({ ...l }));

  // The black stroke plus `paintOrder: "stroke"` haloes each glyph so the price
  // line passing behind a label stays legible.
  const halo = {
    fill: LEVEL_STROKE,
    stroke: "black",
    strokeWidth: 3,
    paintOrder: "stroke",
    fontSize: 10,
  } as const;

  return [
    Plot.ruleY(levels, {
      y: (d) => d.value,
      stroke: LEVEL_STROKE,
      strokeWidth: 1,
      strokeDasharray: "5,4",
    }),
    // The ratio and the price are labelled on *opposite* edges. Stacked on one
    // edge the two would collide whenever the swing is small relative to the
    // y-range — which is the common case — so each gets its own side.
    Plot.text(levels, {
      y: (d) => d.value,
      text: (d) => d.label,
      frameAnchor: "right",
      dx: -6,
      ...halo,
    }),
    Plot.text(levels, {
      y: (d) => d.value,
      text: (d) => formatLevelValue(d.value),
      frameAnchor: "left",
      dx: 6,
      textAnchor: "start",
      ...halo,
    }),
  ];
}

/** Draw a price line with a Bollinger envelope. */
export function bollingerBandsFor(
  points: readonly SeriesPoint[],
  period: number = DEFAULT_BOLLINGER_PERIOD,
  stddev: number = DEFAULT_BOLLINGER_STDDEV,
): Plot.Markish[] {
  return bollingerBandsOverlay(bollingerBands(points, period, stddev));
}

/** Draw the retracement levels for the most recent swing. */
export function fibonacciFor(
  points: readonly SeriesPoint[],
  lookback?: number,
): Plot.Markish[] {
  return fibonacciOverlay(fibonacciRetracement(points, lookback));
}

/**
 * The zero baseline for a returns chart.
 *
 * A return series is read as above-or-below zero rather than against an
 * absolute level, so the zero line is what makes a chart of percent changes
 * legible: crossings are the up/down days. Emitted as a single dashed rule.
 */
export function zeroLineOverlay(): Plot.Markish[] {
  return [
    Plot.ruleY([0], {
      stroke: BASELINE_STROKE,
      strokeWidth: 1,
      strokeDasharray: "2,3",
    }),
  ];
}

/**
 * The signed levels of the ±`k`-deviation returns bands: `[+kσ, -kσ]`.
 *
 * `σ` is the daily standard deviation of the returns, so the bands mark the
 * "normal" daily range — a bar inside them is an ordinary day, one breaking
 * them is an outlier. Returns an empty list (rather than a pair of zeroes) when
 * `σ` is not a usable positive number, so a flat series draws no bands on top
 * of its baseline.
 */
export function sigmaBandLevels(
  sd: number,
  k: number = RETURN_SIGMA_MULTIPLE,
): number[] {
  if (!Number.isFinite(sd) || sd <= 0) return [];
  if (!Number.isFinite(k) || k <= 0) return [];
  return [k * sd, -k * sd];
}

/**
 * Draw the ±`k`-deviation bands as dotted blue guide lines.
 *
 * Deliberately unlabelled: the levels sit close together whenever the returns
 * are tight, and a text label per line would crowd the chart — the exact value
 * is in the read-out under the chart instead.
 */
export function sigmaBandsOverlay(
  sd: number,
  k: number = RETURN_SIGMA_MULTIPLE,
): Plot.Markish[] {
  const levels = sigmaBandLevels(sd, k);
  if (levels.length === 0) return [];

  return [
    Plot.ruleY(levels, {
      stroke: RETURN_SIGMA_STROKE,
      strokeWidth: 1,
      // Short round-capped dashes read as dots at this stroke width.
      strokeDasharray: "2,4",
      strokeLinecap: "round",
    }),
  ];
}

/**
 * Draw a returns series as bars coloured by sign: an up day is blue, a down
 * day red.
 *
 * This is the chart's *primary* series (the returns bars), not an overlay, so
 * the caller hands it to the renderer in place of the default line.
 *
 * Two deliberate choices, both forced by the chart's shared time axis:
 *
 * - **`rectY`, not `barY`.** `barY` requires a *band* x scale and rejects the
 *   frame's date scale outright ("scale incompatible with channel: time !==
 *   band"), and a band scale would drop the weekend gaps and crowd the axis
 *   with one label per session on a year of bars.
 * - **Explicit ±half-day edges, not an interval.** A `"day"` interval floors in
 *   the *local* day, which shifts a UTC-anchored bar (Alpaca stamps 04:00Z,
 *   AlphaVantage 00:00Z) back onto the previous day and misaligns it with the
 *   axis. Centring a fixed one-day width on each observation keeps every bar on
 *   its own point, so consecutive sessions touch and gaps stay gaps.
 *
 * The bars are split into two constant-fill marks rather than one sign-binned
 * channel: a constant `fill` is a literal colour, so the blue/red pairing is
 * fixed regardless of the data's value range and never falls back to a
 * generated colour scale.
 */
export function returnsBars(returns: readonly ReturnPoint[]): Plot.Markish[] {
  if (returns.length === 0) return [];

  // Plot wants plain mutable arrays; the indicator returns readonly ones.
  const rows = returns.map((r) => ({ ...r }));
  const up = rows.filter((r) => r.value >= 0);
  const down = rows.filter((r) => r.value < 0);

  const bar = (data: ReturnPoint[], fill: string) =>
    Plot.rectY(data, {
      x1: (d) => new Date(d.timestamp - HALF_DAY_MS),
      x2: (d) => new Date(d.timestamp + HALF_DAY_MS),
      y1: 0,
      y2: (d) => d.value,
      fill,
    });

  return [bar(up, RETURN_UP_FILL), bar(down, RETURN_DOWN_FILL)];
}
