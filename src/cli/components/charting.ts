import * as Plot from "@observablehq/plot";
import { JSDOM } from "npm:jsdom";
import { Effect } from "effect";
import { LocalProcessingError } from "src/cli/errors/index.ts";

/**
 * Open a file with the platform's default viewer, without blocking.
 *
 * Deliberately uses `Deno.Command` rather than `npm:open`. The `open` package
 * statically pulls in `is-wsl` / `is-docker`, which probe Deno *special paths*
 * (`/proc/version`, `/proc/sys/fs/binfmt_misc/WSLInterop`, `/proc/self/cgroup`)
 * at module load. Deno refuses to grant granular access to special paths, so a
 * static `import open from "npm:open"` made *every* CLI launch fail with
 * NotCapable unless the process ran with `--allow-all`.
 */
function launchViewer(path: string): void {
  const [cmd, args] = Deno.build.os === "windows"
    ? ["cmd", ["/c", "start", "", path]]
    : Deno.build.os === "darwin"
    ? ["open", [path]]
    : ["xdg-open", [path]];

  try {
    // .unref() so the CLI isn't held open by the viewer, and so we don't wait
    // on a viewer that stays in the foreground (some xdg-open handlers do).
    new Deno.Command(cmd as string, { args: args as string[] }).spawn().unref();
  } catch (err) {
    console.error(`Could not launch a viewer for ${path}: ${err}`);
  }
}

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
 * A rendered chart together with the title that belongs on it.
 *
 * Observable Plot renders `title` as an `<h2>` *sibling* of the `<svg>` inside
 * a `<figure>` wrapper — it is not part of the SVG. Serializing only the inner
 * `<svg>` therefore silently drops the title from every saved chart, so the
 * title has to be carried alongside the SVG and drawn into it.
 */
export interface RenderedChart {
  /** The `<svg>` element to save. */
  svg: Element;
  /** The chart title, if one was requested. */
  title?: string;
}

const SVG_NS = "http://www.w3.org/2000/svg";
const TITLE_FONT_SIZE = 16;
const TITLE_BASELINE = 20;

/** Vertical room (in user units) a chart title takes up on the canvas. */
export const CHART_TITLE_HEIGHT = 28;

/**
 * Draw `title` as text at the top of `svg`, growing the canvas so the title
 * sits above the plot instead of overlapping it.
 */
function drawSvgTitle(svg: Element, title: string, plotHeight: number): void {
  const document = svg.ownerDocument;
  if (!document) return;

  const viewBox = svg.getAttribute("viewBox");
  const [, , w, h] = (viewBox ?? "").split(/\s+/).map(Number);
  const width = w > 0 ? w : Number(svg.getAttribute("width")) || 640;
  const baseHeight = h > 0 ? h : plotHeight;

  // Move the viewBox origin *up* by the height of the title band rather than
  // stretching the canvas: the plot is drawn at 1:1 and simply starts lower,
  // so gridlines, ticks, and axis labels keep their exact proportions.
  const nextHeight = baseHeight + CHART_TITLE_HEIGHT;
  const top = -CHART_TITLE_HEIGHT;
  svg.setAttribute("viewBox", `0 ${top} ${width} ${nextHeight}`);
  svg.setAttribute("height", String(nextHeight));
  if (svg.getAttribute("width")) {
    svg.setAttribute("width", String(width));
  }

  const text = document.createElementNS(SVG_NS, "text");
  text.setAttribute("x", String(width / 2));
  text.setAttribute("y", String(top + TITLE_BASELINE));
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("fill", "white");
  text.setAttribute("font-size", String(TITLE_FONT_SIZE));
  text.setAttribute("font-family", "system-ui, sans-serif");
  text.textContent = title;
  svg.appendChild(text);
}

/** Resolve the `<svg>` element from a chart, unwrapping Plot's `<figure>`. */
function toSvgElement(content: Element | RenderedChart): Element {
  let element = "svg" in content ? content.svg : content;

  // If the element is a wrapper (e.g. figure), extract the svg
  if (element.tagName.toLowerCase() !== "svg") {
    const nested = element.querySelector("svg");
    if (nested) element = nested;
  }

  return element;
}

/**
 * Serialize a chart to a standalone SVG string, drawing the chart's title into
 * the SVG so it survives the trip to the viewer.
 */
export function serializeChart(content: Element | string | RenderedChart): string {
  if (typeof content === "string") return content;

  const title = "svg" in content ? content.title : undefined;
  const element = toSvgElement(content);

  if (title) {
    drawSvgTitle(element, title, Number(element.getAttribute("height")) || 400);
  }

  if (!element.getAttribute("xmlns")) {
    element.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns", "http://www.w3.org/2000/svg");
  }
  if (!element.getAttribute("xmlns:xlink")) {
    element.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", "http://www.w3.org/1999/xlink");
  }

  return element.outerHTML;
}

/**
 * A reusable function to display an Observable Plot or SVG string
 * in the system's default viewer.
 */
export async function show(content: Element | string | RenderedChart) {
  const svgString = serializeChart(content);

  try {
      const tempFile = await Deno.makeTempFile({ dir: "./tmp", suffix: ".svg" });

      await Deno.writeTextFile(tempFile, svgString);
      console.log(`Saved chart to: ${tempFile}`);
      launchViewer(tempFile);
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
 * Display a basic single line chart from the given data, treating x as a
 * numeric axis (not a date). Used for scatter/curve plots like vol curves.
 */
export function showNumericLineChart(
    data: Record<string, any>[],
    x: string,
    y: string,
    title: string = "Chart"
): Effect.Effect<void, LocalProcessingError> {
    const jsdom = new JSDOM("");
    const document = jsdom.window.document;

    const plot = Plot.plot({
        document: document,
        title,
        style: {
            background: "black",
            color: "white",
        },
        grid: true,
        x: { label: x, ticks: 10, tickFormat: (d: number) => d.toFixed(0) },
        y: { label: y },
        marks: [
            Plot.line(data, {
                x: (d: any) => Number(d[x]),
                y: (d: any) => Number(d[y]),
                stroke: "dodgerblue",
            }),
            Plot.dot(data, {
                x: (d: any) => Number(d[x]),
                y: (d: any) => Number(d[y]),
                stroke: "dodgerblue",
                r: 2,
            }),
        ]
    });

    const svg = plot.tagName.toLowerCase() === "svg" ? plot : plot.querySelector("svg");
    if (svg) {
        svg.setAttribute("style", "background-color: black; color: white;");
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
      try: () => show({ svg: plot, title }),
      catch: () => new LocalProcessingError({ message: "Failed to show plot." })
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
      try: () => show({ svg: plot, title }),
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
    try: () => show({ svg: plot, title }),
    catch: () => new LocalProcessingError({ message: "Failed to show plot." })
  });
}
