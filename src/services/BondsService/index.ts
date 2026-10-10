import { Layer } from "effect";
import { YahooFinanceBondsLive } from "./YahooFinanceBondsService.ts";
import { AlpacaServiceLive } from "src/services/AlpacaService/index.ts";
import { ChartRendererLive } from "../../cli/StocksMenu/services/ChartRenderer.ts";

export const BondsServiceLive = Layer.mergeAll(
  YahooFinanceBondsLive,
  AlpacaServiceLive,
  ChartRendererLive,
);
