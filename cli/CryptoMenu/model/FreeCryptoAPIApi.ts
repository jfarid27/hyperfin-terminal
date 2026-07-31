import { CryptoSymbolType } from "../types.ts";
import { Effect } from 'effect';
import { FetchService } from "cli/services/FetchService.ts";
import { HTTPError, LocalProcessingError } from "cli/errors/index.ts";

const URL = "https://api.freecryptoapi.com/v1"

export function fetchChartFreeCryptoAPI(symbol: CryptoSymbolType, API_KEY: string): Effect.Effect<any, HTTPError | LocalProcessingError, FetchService> {
    const symbolId = symbol.id;
    return Effect.gen(function* () {
      const fs = yield* FetchService;
      const params = new URLSearchParams({
          symbol: symbolId,
          days: "14"
      });
      return yield* fs.fetchJson(`${URL}/getHistory`, params, {
          headers: {
              Authorization: `Bearer ${API_KEY}`,
              "Accept": "application/json"
          },
      });
    });
}
