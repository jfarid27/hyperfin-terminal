import { CryptoSymbolType } from "../types.ts";
import axios from "axios";
import { Effect, pipe } from 'effect';

const URL = "https://api.freecryptoapi.com/v1"

export function fetchChartFreeCryptoAPI(symbol: CryptoSymbolType, API_KEY: string) {
    const symbolId = symbol.id;
    return pipe(
        Effect.tryPromise(() => axios.get(`${URL}/getHistory`, {
            headers: {
                Authorization: `Bearer ${API_KEY}`,
                "Accept": "application/json"
            },
            params: {
                symbol: symbolId,
                days: "14"
            },
        })),
        Effect.map((response) => response.data),
    );
}