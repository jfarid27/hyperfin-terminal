import * as Plot from "@observablehq/plot";
import { JSDOM } from "npm:jsdom";
import open from "npm:open";
import { Effect } from "effect";
import { LocalProcessingError } from "cli/errors/index.ts";

/**
 * Options for configuring a time series in a multi-line chart
 */
export interface TimeSeriesOptions {
    color: string;
}

/**
 * Represents a single time series to be plotted
 */
export interface TimeSeriesData {
    label: string;
    data: Record<string, any>[];
    options?: TimeSeriesOptions;
}

/**
 * A reusable function to display an Observable Plot or SVG string
 * in the system's default viewer.
 */
export async function show(content: Element | string) {
  let svgString = "";
  if (typeof content === "string") {
    svgString = content;
  } else {
    let element = content;

    // If the element is a wrapper (e.g. figure), extract the svg
    if (element.tagName.toLowerCase() !== "svg") {
        const nested = element.querySelector("svg");
        if (nested) element = nested;
    }

    if (!element.getAttribute("xmlns")) {
      element.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns", "http://www.w3.org/2000/svg");
    }
    if (!element.getAttribute("xmlns:xlink")) {
      element.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", "http://www.w3.org/1999/xlink");
    }
    svgString = element.outerHTML;
  }

  try {
      const tempFile = await Deno.makeTempFile({ dir: "./tmp", suffix: ".svg" });

      await Deno.writeTextFile(tempFile, svgString);
      console.log(`Saved chart to: ${tempFile}`);
      await open(tempFile, { wait: false });
  } catch (err) {
      console.error(err);
  }
}

export function lineChart(data: any[], x: string, y: string) {
    return Plot.line(data, {
        x: (d: any) => new Date(d[x]),
        y: (d: any) => Number(d[y]),
        stroke: "dodgerblue"
    });
}

/**
 * Display a basic single line chart from the given data.
 * @param data The data to be displayed.
 * @param x The x axis label.
 * @param y The y axis label.
 * @param title The title of the chart.
 */
export function showLineChart(
    data: Record<string, any>[],
    x: string,
    y: string,
    title: string = "Chart"
): Effect.Effect<void, LocalProcessingError> {
    // specific setup for jsdom to match what Plot expects
    const jsdom = new JSDOM("");
    const document = jsdom.window.document;

    // We render the plot using the passing document
    const plot = Plot.plot({
        document: document,
        title,
        style: {
            background: "black",
            color: "white",
        },
        grid: true,
        x: { label: x, ticks: 5 },
        y: { label: y },
        marks: [
            lineChart(data, x, y)
        ]
    });

    // Ensure the SVG element itself has the background style,
    // so it persists when 'show' extracts it from the figure wrapper.
    const svg = plot.tagName.toLowerCase() === "svg" ? plot : plot.querySelector("svg");
    if (svg) {
        svg.setAttribute("style", "background-color: black; color: white;");

        // Explicitly format the background with a rect, as some viewers ignore the style attribute
        const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        bg.setAttribute("width", "100%");
        bg.setAttribute("height", "100%");
        bg.setAttribute("fill", "black");

        if (svg.firstChild) {
            svg.insertBefore(bg, svg.firstChild);
        } else {
            svg.appendChild(bg);
        }
    }

    return Effect.tryPromise({
      try: () => show(plot),
      catch: () => new LocalProcessingError({ message: "Failed to show plot." })
    });
}

/**
 * Display multiple time series on a single chart.
 * Timestamps are expected to be in Unix time (seconds) and will be converted to YYYY-MM-DD format.
 *
 * @param series Array of time series data with labels and optional styling options
 * @param x The x axis field name (expected to contain Unix timestamps)
 * @param y The y axis field name
 * @param xLabel The x axis label
 * @param yLabel The y axis label
 * @param title The title of the chart
 */
export function showMultiLineChart(
    series: TimeSeriesData[],
    x: string,
    y: string,
    xLabel: string = "Date",
    yLabel: string = "Value",
    title: string = "Multi-Line Chart"
): Effect.Effect<void, LocalProcessingError> {
    // specific setup for jsdom to match what Plot expects
    const jsdom = new JSDOM("");
    const document = jsdom.window.document;

    // Create a line mark for each series
    const lineMarks = series.map((s) => {
        return Plot.line(s.data, {
            x: (d: any) => new Date(d[x] * 1000), // Convert Unix timestamp to Date
            y: (d: any) => Number(d[y]),
            stroke: s.options?.color || "steelblue",
            strokeWidth: 2,
            tip: true,
        });
    });

    // We render the plot using the passing document
    const plot = Plot.plot({
        document: document,
        title,
        subtitle: series.map((s) => `${s.label} (${s.options?.color || 'steelblue'})`).join('  •  '),
        style: {
            background: "black",
            color: "white",
        },
        grid: true,
        x: {
            label: xLabel,
            type: "time",
            tickFormat: "%Y-%m-%d",
        },
        y: { label: yLabel },
        marks: lineMarks
    });

    // Ensure the SVG element itself has the background style,
    // so it persists when 'show' extracts it from the figure wrapper.
    const svg = plot && plot.tagName && plot.tagName.toLowerCase() === "svg" ? plot : plot.querySelector("svg");
    if (svg) {
        svg.setAttribute("style", "background-color: black; color: white;");

        // Explicitly format the background with a rect, as some viewers ignore the style attribute
        const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        bg.setAttribute("width", "100%");
        bg.setAttribute("height", "100%");
        bg.setAttribute("fill", "black");

        if (svg.firstChild) {
            svg.insertBefore(bg, svg.firstChild);
        } else {
            svg.appendChild(bg);
        }
    }

  return Effect.tryPromise({
    try: () => show(plot),
    catch: () => new LocalProcessingError({ message: "Failed to show plot." })
  });
}
