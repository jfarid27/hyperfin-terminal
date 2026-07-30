import { Effect } from "effect";
import { StockSymbolType } from "../types.ts";
import {
    ActionHandler, TerminalUserStateConfigContext
} from "cli/types.ts";
import { HTTPError, LocalProcessingError, ConfigError } from "cli/errors/index.ts";

/**
 * Fetches the chart data for a specified symbol from the AlphaVantage API.
 *
 * @param symbol The symbol to fetch the chart data for.
 */
export const fetchChartAlphaVantage: ActionHandler = (symbol: StockSymbolType) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;
  if (!st.apiKeys.alphavantage) return yield* new ConfigError({ message: "Missing Alphavantage API Key."})

  const params = new URLSearchParams({
    function: "TIME_SERIES_DAILY",
    outputsize: "compact",
    symbol: symbol.id,
    apikey: st.apiKeys.alphavantage,
  });
  const response = yield* Effect.tryPromise({
    try: () => fetch(`https://www.alphavantage.co/query?${params}`),
    catch: () => new HTTPError({ message: "Failed to fetch Alphavantage query."})
  });
  return yield* Effect.tryPromise({
    try: () => response.json(),
    catch: () => new LocalProcessingError({ message: "Failed to parse Alphavantage response."})
  });
}).pipe(Effect.delay("1 seconds"));

/**
 * Fetches the spot price for a specified symbol from the AlphaVantage API.
 *
 * @param symbol The symbol to fetch the spot price for.
 * @param ALPHAVANTAGE_API_KEY The AlphaVantage API key.
 * @returns The spot price for the specified symbol.
 * @see https://www.alphavantage.co/documentation/
 */
export const fetchSpotPriceAlphaVantage: ActionHandler = (symbol: StockSymbolType) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;
  if (!st.apiKeys.alphavantage) return yield* new ConfigError({ message: "Missing Alphavantage API Key." });

  const params = new URLSearchParams({
    function: "GLOBAL_QUOTE",
    symbol: symbol.id,
    apikey: st.apiKeys.alphavantage,
  });
  const response = yield* Effect.tryPromise({
    try: () => fetch(`https://www.alphavantage.co/query?${params}`),
    catch: () => new HTTPError({ message: "Failed to fetch Alphavantage query." })
  });
  return yield* Effect.tryPromise({
    try: () => response.json(),
    catch: () => new LocalProcessingError({ message: "Failed to parse Alphavantage response." })
  });
});
