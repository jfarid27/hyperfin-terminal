import { Layer, Effect } from "effect";
import { ApplicationLayerLive } from "cli/services/index.ts";
import { AlphaVantageServiceLive } from "./AlphaVantageService.ts";
import { ChartRendererLive } from "./ChartRenderer.ts";

const StocksServices = Layer.mergeAll(
  AlphaVantageServiceLive,
  ChartRendererLive,
);

export const StocksServiceLive = Layer.merge(
  StocksServices,
  ApplicationLayerLive,
);
