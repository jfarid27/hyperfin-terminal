import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import * as Plot from "@observablehq/plot";
import { JSDOM } from "npm:jsdom";
import { CHART_TITLE_HEIGHT, serializeChart } from "./charting.ts";

const sampleData = [
  { date: "2026-01-01", close: 4.1 },
  { date: "2026-02-01", close: 4.3 },
];

/** Build the same figure/svg pair Plot.plot produces in the real charts. */
const renderPlot = (title: string) => {
  const jsdom = new JSDOM("");
  const document = jsdom.window.document;
  const plot = Plot.plot({
    document,
    title,
    style: { background: "black", color: "white" },
    grid: true,
    x: { label: "date", ticks: 5 },
    y: { label: "close" },
    marks: [
      Plot.line(sampleData, {
        x: (d: { date: string }) => new Date(d.date),
        y: (d: { close: number }) => Number(d.close),
      }),
    ],
  });
  return { plot, document };
};

/** Pull the <svg> out of the figure Plot returns. */
const toSvg = (plot: ReturnType<typeof Plot.plot>): Element => {
  if (plot.tagName.toLowerCase() === "svg") return plot;
  const svg = plot.querySelector("svg");
  if (!svg) throw new Error("Plot output had no <svg>");
  return svg;
};

describe("Chart title serialization", () => {
  it("draws the chart title into the saved SVG", () => {
    // Plot puts `title` in an <h2> sibling of the <svg>, so serializing the
    // bare <svg> used to drop the title from every saved chart.
    const title = "Bond Yields - 10-Year - 2026-10-05";
    const { plot } = renderPlot(title);
    const bareSvg = toSvg(plot);

    expect(bareSvg.outerHTML.includes(title),
      "Precondition: the bare svg does not contain the title"
    ).toBe(false);

    const svg = serializeChart({ svg: plot, title });

    expect(svg.includes(title),
      "Saved SVG should contain the chart title"
    ).toBe(true);
    expect(svg.includes(`>${title}</text>`),
      "Title should be rendered as an SVG text node"
    ).toBe(true);
  });

  it("keeps the plot below the title without rescaling it", () => {
    const title = "Bond Yields - 30-Year - 2026-10-05";
    const { plot } = renderPlot(title);
    const original = toSvg(plot).getAttribute("viewBox");

    const svg = serializeChart({ svg: plot, title });

    const viewBox = svg.match(/ viewBox="([^"]+)"/)?.[1];
    const [, top, width, height] = viewBox!.split(/\s+/).map(Number);
    const [, , origWidth, origHeight] = original!.split(/\s+/).map(Number);

    expect(top,
      "The origin should shift up by the title band, leaving the plot un-rescaled"
    ).toBe(-CHART_TITLE_HEIGHT);
    expect(height,
      `Canvas should grow by the title band (${CHART_TITLE_HEIGHT})`
    ).toBe(origHeight + CHART_TITLE_HEIGHT);
    expect(width,
      "Plot width (and therefore its scale) must not change"
    ).toBe(origWidth);
    expect(svg.match(/ height="([\d.]+)"/)?.[1],
      "Rendered height should match the viewBox"
    ).toBe(String(origHeight + CHART_TITLE_HEIGHT));
  });

  it("leaves an untitled chart unchanged", () => {
    const { plot } = renderPlot("ignored");
    const before = toSvg(plot).getAttribute("height");

    const svg = serializeChart({ svg: plot });

    expect(svg.includes(">ignored</text>"),
      "The Plot title should not leak into an untitled serialization"
    ).toBe(false);
    expect(Number(svg.match(/ height="([\d.]+)"/)?.[1]),
      "Canvas height should be untouched"
    ).toBe(Number(before));
  });

  it("passes a plain SVG string through untouched", () => {
    const raw = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    expect(serializeChart(raw),
      "Raw SVG strings are written as-is"
    ).toBe(raw);
  });

  it("accepts a bare Element", () => {
    const { document } = renderPlot("ignored");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 640 400");
    svg.setAttribute("height", "400");

    const out = serializeChart(svg);

    expect(out.includes('xmlns="http://www.w3.org/2000/svg"'),
      "xmlns should be ensured"
    ).toBe(true);
  });

  describe("canvas background", () => {
    /** The black background rect, if any. */
    const backgroundRect = (svg: string): string | undefined =>
      svg.match(/<rect[^>]*fill="black"[^>]*>/)?.[0];

    /** The (x, y, width, height) of the background rect, in user units. */
    const backgroundBox = (svg: string): number[] => {
      const rect = backgroundRect(svg);
      if (!rect) throw new Error("No black background rect was serialized");
      const num = (attr: string, fallback = 0) =>
        Number(rect.match(new RegExp(`${attr}="([-\\d.]+)"`))?.[1] ?? fallback);
      return [num("x"), num("y"), num("width"), num("height")];
    };

    it("covers the title band, not just the plot area", () => {
      // The viewBox is shifted up by CHART_TITLE_HEIGHT to make room for the
      // title, so a background sized to the *viewport* (width="100%") would
      // leave the title band unpainted — the "title has no background" bug.
      const title = "Bond Yields - 10-Year - 2026-10-05";
      const { plot } = renderPlot(title);

      const svg = serializeChart({ svg: plot, title });

      const [x, y, width, height] = backgroundBox(svg);
      expect(x, "Background should start at the left viewBox edge").toBe(0);
      expect(y,
        "Background should start at the top of the title band"
      ).toBe(-CHART_TITLE_HEIGHT);
      expect(height,
        `Background should span the plot plus the title band (+${CHART_TITLE_HEIGHT})`
      ).toBeGreaterThan(CHART_TITLE_HEIGHT);
      expect(width, "Background should span the full plot width").toBe(640);

      // Every corner of the shifted viewBox must be inside the background.
      const viewBox = svg.match(/ viewBox="([^"]+)"/)![1].split(/\s+/).map(Number);
      expect(y, "Top edge of the viewBox is covered").toBeLessThanOrEqual(viewBox[1]);
      expect(y + height,
        "Bottom edge of the viewBox is covered"
      ).toBeGreaterThanOrEqual(viewBox[1] + viewBox[3]);
    });

    it("sizes the background in user units, not viewport percentages", () => {
      const { plot } = renderPlot("ignored");
      const svg = serializeChart({ svg: plot });

      const rect = backgroundRect(svg);
      expect(rect, "A background rect should be painted").toBeTruthy();
      expect(rect!.includes("%"),
        "Percentage sizing is relative to the viewport and would miss the title band"
      ).toBe(false);
    });

    it("is idempotent when the same chart is serialized twice", () => {
      const title = "Bond Yields - 10-Year - 2026-10-05";
      const { plot } = renderPlot(title);

      serializeChart({ svg: plot, title });
      const svg = serializeChart({ svg: plot, title });

      const rects = (svg.match(/<rect[^>]*fill="black"[^>]*>/g) ?? []).length;
      const titles = (svg.match(new RegExp(`>${title}</text>`, "g")) ?? []).length;
      expect(rects, "Background should not stack on re-serialization").toBe(1);
      expect(titles, "Title should not stack on re-serialization").toBe(1);
    });
  });
});
