/**
 * Observable Plot marks for technical overlays.
 *
 * Kept separate from `src/cli/components/charting.ts` (which owns the plot
 * *frame*) and from the indicator math in `./bollinger.ts` / `./fibonacci.ts`:
 * these functions only translate a computed indicator into drawable marks, so
 * they can be rendered to SVG and asserted on in isolation.
 */

import * as Plot from "@observablehq/plot";
import type { BollingerPoint, FibonacciRetracement, SeriesPoint } from "./index.ts";
import { bollingerBands, DEFAULT_BOLLINGER_PERIOD, DEFAULT_BOLLINGER_STDDEV, fibonacciRetracement } from "./index.ts";

/** Envelope colour — distinct from the white price line and the orange levels. */
const BAND_STROKE = "#4fc3f7";
/** Retracement-level colour. */
const LEVEL_STROKE = "#ffb74d";

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
