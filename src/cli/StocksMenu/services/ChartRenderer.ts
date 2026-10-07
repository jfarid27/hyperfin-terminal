import { Effect, Context, Layer } from "effect";
import type { Markish } from "@observablehq/plot";
import { LocalProcessingError } from "src/cli/errors/index.ts";
import { showLineChart, showTechnicalChart } from "src/cli/components/charting.ts";

export interface ChartRendererPort {
  readonly render: (
    // deno-lint-ignore no-explicit-any
    data: Record<string, any>[],
    x: string,
    y: string,
    title?: string,
  ) => Effect.Effect<void, LocalProcessingError>;

  /**
   * Render a series with technical overlays (Bollinger envelope, Fibonacci
   * levels, ...) drawn beneath the price line. The overlays are pre-built Plot
   * marks supplied by the caller.
   */
  readonly renderTechnical: (
    // deno-lint-ignore no-explicit-any
    data: Record<string, any>[],
    x: string,
    y: string,
    overlays: Markish[],
    title?: string,
  ) => Effect.Effect<void, LocalProcessingError>;
}

export class ChartRenderer extends Context.Tag("hyperfin.stocks.services.ChartRenderer")<
  ChartRenderer,
  ChartRendererPort
>() {}

export const ChartRendererLive = Layer.succeed(ChartRenderer, {
  render: (data, x, y, title) => showLineChart(data, x, y, title),
  renderTechnical: (data, x, y, overlays, title) =>
    showTechnicalChart(data, x, y, overlays, "Date", "Price", title),
});
