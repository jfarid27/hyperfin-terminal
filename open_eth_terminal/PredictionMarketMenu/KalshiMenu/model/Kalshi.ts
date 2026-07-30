import axios from "axios";
import { pause } from "./../../../utils/timing.ts";
import { Effect, pipe } from "effect";

/**
 * Fetches market data for a given event ticker from Kalshi.
 * @param eventTicker The event ticker to fetch markets for (e.g., "KXHIGHNY-26JAN10").
 * @param limit The maximum number of markets to fetch (optional).
 * @link https://docs.kalshi.com/getting_started/quick_start_market_data
 */
export function fetchMarketsByEventTicker(eventTicker: string, limit?: number): Effect.Effect<any, Error> {
    return pipe(
        Effect.tryPromise(() => axios.get(
            `https://api.elections.kalshi.com/trade-api/v2/markets`,
            {
                params: {
                    event_ticker: eventTicker,
                    ...(limit && { limit }),
                },
            }
        )),
        Effect.flatMap((response: unknown) => Effect.succeed(response as any)),
        Effect.tap(() => Effect.sleep(3000)),
    )
}
