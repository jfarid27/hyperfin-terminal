import { Layer, } from "effect";
import { ApplicationLayerLive } from "src/cli/services/index.ts";
import { AlphaVantageServiceLive } from "src/services/AlphaVantageService/index.ts";
import { MassiveServiceLive } from "src/services/MassiveService/index.ts";
import { ChartRendererLive } from "./ChartRenderer.ts";

const StocksServices = Layer.mergeAll(
  AlphaVantageServiceLive,
  MassiveServiceLive,
  ChartRendererLive,
);

export const StocksServiceLive = Layer.merge(
  StocksServices,
  ApplicationLayerLive,
);
