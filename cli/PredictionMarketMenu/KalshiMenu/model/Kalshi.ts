import { Effect } from "effect";
import { HTTPError, LocalProcessingError } from "cli/errors/index.ts";
import { FetchService } from "cli/services/FetchService.ts";

/**
 * Fetches market data for a given event ticker from Kalshi.
 * @param eventTicker The event ticker to fetch markets for (e.g., "KXHIGHNY-26JAN10").
 * @param limit The maximum number of markets to fetch (optional).
 * @link https://docs.kalshi.com/getting_started/quick_start_market_data
 */
export function fetchMarketsByEventTicker(eventTicker: string, limit?: number): Effect.Effect<any, HTTPError | LocalProcessingError, FetchService> {
    return Effect.gen(function* () {
      const fs = yield* FetchService;
      const params = new URLSearchParams({
          event_ticker: eventTicker,
          ...(limit ? { limit: String(limit) } : {}),
      });
      const data = yield* fs.fetchJson(
        "https://api.elections.kalshi.com/trade-api/v2/markets",
        params
      );
      yield* Effect.sleep(3000);
      return data;
    });
}
