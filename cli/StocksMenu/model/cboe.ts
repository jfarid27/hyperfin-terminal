import { StockSymbolType } from "../types.ts";
import { Effect } from "effect";
import { CboeService } from "cli/services/CboeService.ts";
import { HTTPError, LocalProcessingError } from "cli/errors/index.ts";

/**
 * Fetch spot price for a stock symbol from CBOE.
 */
export const fetchSpotPriceCboe = (
  symbol: StockSymbolType,
): Effect.Effect<unknown, HTTPError | LocalProcessingError, CboeService> =>
  Effect.gen(function* () {
    const cboe = yield* CboeService;
    return yield* cboe.getSpotPrice(symbol.id);
  });

/**
 * Fetch historical prices for a stock symbol from CBOE.
 */
export const fetchHistoricalPricesCboe = (
  symbol: StockSymbolType,
): Effect.Effect<unknown, HTTPError | LocalProcessingError, CboeService> =>
  Effect.gen(function* () {
    const cboe = yield* CboeService;
    return yield* cboe.getHistoricalPrices(symbol.id);
  });
