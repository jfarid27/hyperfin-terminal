import { Effect, pipe } from "effect";
import { HTTPError } from "cli/errors/index.ts";

/**
 * Fetches market data for a given event ticker from Kalshi.
 * @param eventTicker The event ticker to fetch markets for (e.g., "KXHIGHNY-26JAN10").
 * @param limit The maximum number of markets to fetch (optional).
 * @link https://docs.kalshi.com/getting_started/quick_start_market_data
 */
export function fetchMarketsByEventTicker(eventTicker: string, limit?: number): Effect.Effect<any, HTTPError> {
    return pipe(
        Effect.tryPromise(async () => {
            const params = new URLSearchParams({
                event_ticker: eventTicker,
                ...(limit ? { limit: String(limit) } : {}),
            });
            const response = await fetch(
                `https://api.elections.kalshi.com/trade-api/v2/markets?${params}`
            );
            return response.json();
        }),
        Effect.flatMap((data) => Effect.succeed(data)),
        Effect.tap(() => Effect.sleep(3000)),
        Effect.catchAll((err) => Effect.gen(function* () {
          yield * Effect.logError(err);
          return yield* new HTTPError({ message: "Failed to fetch Reddit RSS feed." })
        }))
    )
}
