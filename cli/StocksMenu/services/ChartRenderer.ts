import { Effect, Context, Layer } from "effect";
import { LocalProcessingError } from "cli/errors/index.ts";
import { showLineChart } from "cli/components/charting.ts";

export interface ChartRendererPort {
  readonly render: (
    // deno-lint-ignore no-explicit-any
    data: Record<string, any>[],
    x: string,
    y: string,
    title?: string,
  ) => Effect.Effect<void, LocalProcessingError>;
}

export class ChartRenderer extends Context.Tag("hyperfin.stocks.services.ChartRenderer")<
  ChartRenderer,
  ChartRendererPort
>() {}

export const ChartRendererLive = Layer.succeed(ChartRenderer, {
  render: (data, x, y, title) => showLineChart(data, x, y, title),
});
