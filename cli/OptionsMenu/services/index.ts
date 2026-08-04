import { Layer } from "effect";
import { YahooFinanceOptionsLive } from "./YahooFinanceOptionsService.ts";

export const OptionsServiceLive = Layer.mergeAll(
  YahooFinanceOptionsLive,
);
