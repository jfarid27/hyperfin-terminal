import { CryptoSymbolType } from "../types.ts";
import { Effect, pipe } from 'effect';

const URL = "https://api.freecryptoapi.com/v1"

export function fetchChartFreeCryptoAPI(symbol: CryptoSymbolType, API_KEY: string) {
    const symbolId = symbol.id;
    return pipe(
        Effect.tryPromise(async () => {
            const params = new URLSearchParams({
                symbol: symbolId,
                days: "14"
            });
            const response = await fetch(`${URL}/getHistory?${params}`, {
                headers: {
                    Authorization: `Bearer ${API_KEY}`,
                    "Accept": "application/json"
                },
            });
            return response.json();
        }),
        Effect.map((response) => response),
    );
}
