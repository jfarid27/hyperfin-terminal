import { StockSymbolType } from "../types.ts";
import { Effect } from "effect";
import {
  TerminalUserStateConfigContext
} from "cli/types.ts";
import {
  ConfigError, HTTPError, LocalProcessingError
} from "cli/errors/index.ts";

const MASSIVE_BASE_URL = "https://api.massive.com/v2";

/**
 * Fetches the current snapshot (spot price) for a stock ticker from the Massive API.
 *
 * @param symbol The symbol to fetch the snapshot for.
 * @param MASSIVE_API_KEY The Massive API key.
 * @returns The snapshot data for the specified ticker.
 * @see https://massive.com/docs/rest/stocks/snapshots/single-ticker-snapshot
 */
export const fetchSpotPriceMassive = (symbol: StockSymbolType) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;
  if (!st.apiKeys.massive) return yield* new ConfigError({ message: "Missing Alphavantage API Key."})
  const params = new URLSearchParams({
    apiKey: st.apiKeys.massive,
  });

  const response = yield* Effect.tryPromise({
    try: () => fetch(
        `${MASSIVE_BASE_URL}/snapshot/locale/us/markets/stocks/tickers/${symbol.id}?${params}`
      ),
    catch: () => new HTTPError({ message: "Failed to fetch Alphavantage query."})
  });
  return yield* Effect.tryPromise({
    try: () => response.json(),
    catch: () => new LocalProcessingError({ message: "Failed to parse Alphavantage response."})
  });
});
