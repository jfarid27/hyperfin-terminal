import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import * as Plot from "@observablehq/plot";
import { JSDOM } from "npm:jsdom";
import { serializeChart } from "./charting.ts";
import type { SeriesPoint } from "../../technicals/index.ts";
import { dailyReturns, returnStats } from "../../technicals/index.ts";
import {
  bollingerBandsFor,
  fibonacciFor,
  formatLevelValue,
  RETURN_DOWN_FILL,
  RETURN_SIGMA_STROKE,
  RETURN_UP_FILL,
  returnsBars,
  sigmaBandLevels,
  sigmaBandsOverlay,
  zeroLineOverlay,
} from "../../technicals/overlays.ts";

const series = (...values: number[]): SeriesPoint[] =>
  values.map((value, i) => ({ timestamp: Date.UTC(2026, 0, 1 + i), value }));

/** A 40-bar series with a clear up move, long enough for a 20-bar band window. */
const price = Array.from({ length: 40 }, (_, i) => ({
  timestamp: Date.UTC(2026, 0, 1 + i),
  value: 100 + Math.sin(i / 3) * 12 + i * 0.5,
}));

describe("formatLevelValue", () => {
  it("uses two decimals for prices at or above one", () => {
    expect(formatLevelValue(123.456)).toBe("123.46");
    expect(formatLevelValue(1)).toBe("1.00");
  });

  it("keeps four decimals for sub-dollar prices", () => {
    expect(formatLevelValue(0.5)).toBe("0.5000");
  });

  it("switches to significant digits for sub-cent prices", () => {
    expect(formatLevelValue(0.00012345)).toBe("0.0001234");
  });

  it("handles zero and non-finite values without throwing", () => {
    expect(formatLevelValue(0)).toBe("0");
    expect(formatLevelValue(Number.NaN)).toBe("n/a");
    expect(formatLevelValue(Infinity)).toBe("n/a");
  });
});

describe("bollingerBandsFor", () => {
  it("builds a shaded envelope plus upper, mid and lower lines", () => {
    const marks = bollingerBandsFor(series(...Array.from({ length: 30 }, (_, i) => i + 1)), 20, 2);

    // areaY + 3 lines
    expect(marks.length).toBe(4);
  });

  it("draws nothing when the series is too short for a window", () => {
    expect(bollingerBandsFor(series(1, 2, 3), 20).length).toBe(0);
  });
});

describe("fibonacciFor", () => {
  it("emits a rule and a label mark on each edge when a swing exists", () => {
    const marks = fibonacciFor(series(10, 12, 15, 13, 20));

    // ruleY + a right-edge ratio label + a left-edge price label
    expect(marks.length).toBe(3);
  });

  it("draws nothing when there is no swing to measure", () => {
    expect(fibonacciFor(series(5, 5, 5)).length).toBe(0);
    expect(fibonacciFor([]).length).toBe(0);
  });
});

// ── End-to-end into SVG ──
//
// The pure mark counts above prove the right *number* of marks is built; these
// render them through the real Plot + serializeChart pipeline so a bad channel
// binding (an undefined accessor, a mistyped scale) cannot pass unnoticed.

/**
 * Render a series under the given overlays and return the serialized SVG.
 *
 * `primary`, when supplied, replaces the default line as the main series mark —
 * mirroring how `showTechnicalChart` treats it.
 */
const renderSvg = (
  points: SeriesPoint[],
  overlays: Plot.Markish[],
  yLabel: string = "Price",
  primary: Plot.Markish[] = [],
): string => {
  const jsdom = new JSDOM("");
  const document = jsdom.window.document;

  const plot = Plot.plot({
    document,
    title: "Test",
    style: { background: "black", color: "white" },
    grid: true,
    x: { label: "Date", ticks: 5, type: "time" },
    y: { label: yLabel },
    marks: [
      ...overlays,
      ...(primary.length > 0 ? primary : [
        Plot.line(points, {
          x: (d) => new Date(d.timestamp),
          y: (d) => d.value,
          stroke: "dodgerblue",
        }),
      ]),
    ],
  });

  return serializeChart({ svg: plot, title: "Test" });
};

describe("technical overlays render to SVG", () => {
  it("paints a Bollinger envelope into the chart", () => {
    const svg = renderSvg(price, bollingerBandsFor(price, 20, 2));

    expect(svg.includes("<path"), "the price line and band lines are paths").toBe(true);
    expect(svg.includes("#4fc3f7"), "the envelope colour is present").toBe(true);
    // A dashed upper/lower band line renders as a stroke-dasharray attribute.
    expect(svg.includes("stroke-dasharray"), "the outer bands are dashed").toBe(true);
  });

  it("paints the Fibonacci rules and level labels into the chart", () => {
    const svg = renderSvg(price, fibonacciFor(price));

    // Every label carries its ratio.
    for (const label of ["23.6%", "38.2%", "50%", "61.8%", "78.6%"]) {
      expect(svg.includes(label), `the ${label} level is labelled`).toBe(true);
    }
    expect(svg.includes("#ffb74d"), "the level colour is present").toBe(true);
  });

  it("still renders a valid chart when no overlays are supplied", () => {
    const svg = renderSvg(price, []);

    expect(svg.startsWith("<svg"), "a valid SVG is produced").toBe(true);
    expect(svg.includes("<path"), "the bare price line is still drawn").toBe(true);
  });
});

describe("zeroLineOverlay", () => {
  it("emits a single dashed baseline rule", () => {
    expect(zeroLineOverlay().length).toBe(1);
  });
});

describe("sigmaBandLevels", () => {
  it("places the bands at ±k deviations", () => {
    expect(sigmaBandLevels(1.5)).toEqual([3, -3]);
    expect(sigmaBandLevels(1.5, 1)).toEqual([1.5, -1.5]);
  });

  it("emits nothing for a flat or unusable deviation", () => {
    expect(sigmaBandLevels(0), "a flat series has no band").toEqual([]);
    expect(sigmaBandLevels(Number.NaN)).toEqual([]);
    expect(sigmaBandLevels(Number.POSITIVE_INFINITY)).toEqual([]);
    expect(sigmaBandLevels(-1)).toEqual([]);
    expect(sigmaBandLevels(1.5, 0)).toEqual([]);
  });
});

describe("sigmaBandsOverlay", () => {
  it("emits one rule mark holding both bands", () => {
    expect(sigmaBandsOverlay(1.5).length).toBe(1);
  });

  it("draws no band on top of the baseline for a flat series", () => {
    expect(sigmaBandsOverlay(0).length).toBe(0);
    expect(sigmaBandsOverlay(Number.NaN).length).toBe(0);
  });
});

describe("returnsBars", () => {
  it("splits the series into one up-bar and one down-bar mark", () => {
    const returns = dailyReturns(price);

    expect(returns.length).toBe(price.length - 1);
    // One mark for the non-negative bars, one for the negative bars.
    expect(returnsBars(returns).length).toBe(2);
    expect(returnsBars([]).length, "nothing to draw for an empty series").toBe(0);
  });
});

describe("returns chart assembly", () => {
  it("paints blue up bars, red down bars and both σ bands", () => {
    const returns = dailyReturns(price);
    const stats = returnStats(returns);
    if (!stats) throw new Error("expected stats for a non-empty series");

    const svg = renderSvg(
      returns,
      [...zeroLineOverlay(), ...sigmaBandsOverlay(stats.sd)],
      "Return (%)",
      returnsBars(returns),
    );

    expect(svg.includes("<rect"), "bars render as rects").toBe(true);
    expect(svg.includes(RETURN_UP_FILL), "the up-day blue is present").toBe(true);
    expect(svg.includes(RETURN_DOWN_FILL), "the down-day red is present").toBe(true);
    expect(svg.includes("#9e9e9e"), "the zero baseline is present").toBe(true);
    expect(svg.includes(RETURN_SIGMA_STROKE), "the dotted σ bands are present").toBe(true);
    // Plot prefixes a vertical axis label with an arrow glyph, so match the text.
    expect(svg.includes("Return (%)"), "the y axis is labelled as returns").toBe(true);
  });
});
