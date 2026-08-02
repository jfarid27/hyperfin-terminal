import { Layer, Effect } from "effect";
import { ApplicationLayerLive } from "cli/services/index.ts";
import { AlphaVantageServiceLive } from "./AlphaVantageService.ts";

const StocksServices = Layer.mergeAll(
  AlphaVantageServiceLive
)

export const StocksServiceLive = Layer.merge(
  StocksServices,
  ApplicationLayerLive
)
