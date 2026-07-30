import { Effect } from "effect";
import { StockSymbolType } from "../types.ts";
import { ConfigError } from "cli/errors/index.ts";
import { FetchService } from "cli/services/FetchService.ts";

/**
 * Fetches the chart data for a specified symbol from the AlphaVantage API.
 *
 * @param symbol The symbol to fetch the chart data for.
 * @param apiKey The AlphaVantage API key.
 */
export const fetchChartAlphaVantage = (symbol: StockSymbolType, apiKey: string) => Effect.gen(function* () {
  if (!apiKey) return yield* new ConfigError({ message: "Missing Alphavantage API Key."})

  const params = new URLSearchParams({
    function: "TIME_SERIES_DAILY",
    outputsize: "compact",
    symbol: symbol.id,
    apikey: apiKey,
  });
  const fs = yield* FetchService;
  return yield* fs.fetchJson("https://www.alphavantage.co/query", params);
}).pipe(Effect.delay("1 seconds"));

/**
 * Fetches the spot price for a specified symbol from the AlphaVantage API.
 *
 * @param symbol The symbol to fetch the spot price for.
 * @param apiKey The AlphaVantage API key.
 * @returns The spot price for the specified symbol.
 * @see https://www.alphavantage.co/documentation/
 */
export const fetchSpotPriceAlphaVantage = (symbol: StockSymbolType, apiKey: string) => Effect.gen(function* () {
  if (!apiKey) return yield* new ConfigError({ message: "Missing Alphavantage API Key." });

  const params = new URLSearchParams({
    function: "GLOBAL_QUOTE",
    symbol: symbol.id,
    apikey: apiKey,
  });
  const fs = yield* FetchService;
  return yield* fs.fetchJson("https://www.alphavantage.co/query", params);
});
