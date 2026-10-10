import { Layer } from "effect";
import { YahooFinanceOptionsLive } from "./YahooFinanceOptionsService.ts";
import { AlpacaServiceLive } from "src/services/AlpacaService/index.ts";

export const OptionsServiceLive = Layer.mergeAll(
  YahooFinanceOptionsLive,
  AlpacaServiceLive,
);
