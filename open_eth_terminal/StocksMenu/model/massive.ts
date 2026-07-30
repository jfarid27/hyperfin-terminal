import { StockSymbolType } from "../types.ts";
import { Effect, pipe } from "effect";

const MASSIVE_BASE_URL = "https://api.massive.com/v2";

/**
 * Fetches the current snapshot (spot price) for a stock ticker from the Massive API.
 * 
 * @param symbol The symbol to fetch the snapshot for.
 * @param MASSIVE_API_KEY The Massive API key.
 * @returns The snapshot data for the specified ticker.
 * @see https://massive.com/docs/rest/stocks/snapshots/single-ticker-snapshot
 */
export function fetchSpotPriceMassive(symbol: StockSymbolType, MASSIVE_API_KEY: string): Effect.Effect<any, Error> {
    return pipe(
        Effect.tryPromise(async () => {
            const params = new URLSearchParams({
                apiKey: MASSIVE_API_KEY,
            });
            const response = await fetch(
                `${MASSIVE_BASE_URL}/snapshot/locale/us/markets/stocks/tickers/${symbol.id}?${params}`
            );
            if (!response.ok) {
                throw new Error(`Massive API error: ${response.status} ${response.statusText}`);
            }
            return response.json();
        }),
        Effect.map((data) => data),
    );
}
