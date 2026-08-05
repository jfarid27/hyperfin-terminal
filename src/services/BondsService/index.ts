import { Layer } from "effect";
import { YahooFinanceBondsLive } from "./YahooFinanceBondsService.ts";
import { ChartRendererLive } from "../../cli/StocksMenu/services/ChartRenderer.ts";

export const BondsServiceLive = Layer.mergeAll(
  YahooFinanceBondsLive,
  ChartRendererLive,
);
