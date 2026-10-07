import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import * as Plot from "@observablehq/plot";
import { JSDOM } from "npm:jsdom";
import { serializeChart } from "./charting.ts";
import type { SeriesPoint } from "../../technicals/index.ts";
import {
  bollingerBandsFor,
  fibonacciFor,
  formatLevelValue,
} from "../../technicals/overlays.ts";

const series = (...values: number[]): SeriesPoint[] =>
  values.map((value, i) => ({ timestamp: Date.UTC(2026, 0, 1 + i), value }));

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

/** Render a price line under the given overlays and return the serialized SVG. */
const renderSvg = (points: SeriesPoint[], overlays: Plot.Markish[]): string => {
  const jsdom = new JSDOM("");
  const document = jsdom.window.document;

  const plot = Plot.plot({
    document,
    title: "Test",
    style: { background: "black", color: "white" },
    grid: true,
    x: { label: "Date", ticks: 5, type: "time" },
    y: { label: "Price" },
    marks: [
      ...overlays,
      Plot.line(points, {
        x: (d) => new Date(d.timestamp),
        y: (d) => d.value,
        stroke: "dodgerblue",
      }),
    ],
  });

  return serializeChart({ svg: plot, title: "Test" });
};

describe("technical overlays render to SVG", () => {
  const price = Array.from({ length: 40 }, (_, i) => ({
    timestamp: Date.UTC(2026, 0, 1 + i),
    value: 100 + Math.sin(i / 3) * 12 + i * 0.5,
  }));

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
