import { StockSymbolType } from "../types.ts";
import { Effect } from "effect";
import {
  ConfigError
} from "cli/errors/index.ts";

import { FetchService } from "cli/services/FetchService.ts";

const MASSIVE_BASE_URL = "https://api.massive.com/v2";

/**
 * Fetches the current snapshot (spot price) for a stock ticker from the Massive API.
 *
 * @param symbol The symbol to fetch the snapshot for.
 * @param apiKey The Massive API key.
 * @returns The snapshot data for the specified ticker.
 * @see https://massive.com/docs/rest/stocks/snapshots/single-ticker-snapshot
 */
export const fetchSpotPriceMassive = (symbol: StockSymbolType, apiKey: string) => Effect.gen(function* () {
  const fs = yield* FetchService;
  if (!apiKey) return yield* new ConfigError({ message: "Missing Massive API Key."})
  const params = new URLSearchParams({
    apiKey: apiKey,
  });

  const url = `${MASSIVE_BASE_URL}/snapshot/locale/us/markets/stocks/tickers/${symbol.id}`
  return yield* fs.fetchJson(url, params);

});
