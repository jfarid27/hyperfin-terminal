import { Layer } from "effect";
import { ApplicationLayerLive } from "src/cli/services/index.ts";
import { ForexServiceLive } from "src/services/ForexService/index.ts";
import { AlpacaServiceLive } from "src/services/AlpacaService/index.ts";
import { ChartRendererLive } from "../../StocksMenu/services/ChartRenderer.ts";

const ForexServices = Layer.mergeAll(
  ForexServiceLive,
  AlpacaServiceLive,
  ChartRendererLive,
);

export const ForexServiceMenuLive = Layer.merge(
  ForexServices,
  ApplicationLayerLive,
);
