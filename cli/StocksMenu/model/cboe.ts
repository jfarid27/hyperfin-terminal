import { StockSymbolType } from "../types.ts";
import { Effect, Context, Layer } from "effect";
import { CboeService } from "cli/StocksMenu/services/CboeService.ts";
import { HTTPError, LocalProcessingError } from "cli/errors/index.ts";

export interface CboeModelPort {
  spot: {
    get: (symbol: StockSymbolType) => Effect.Effect<unknown, HTTPError | LocalProcessingError>;
  };
  history: {
    get: (symbol: StockSymbolType) => Effect.Effect<unknown, HTTPError | LocalProcessingError>;
  };
  options: {
    chain: (symbol: StockSymbolType) => Effect.Effect<unknown, HTTPError | LocalProcessingError>;
  };
}

export class CboeModel extends Context.Tag("hyperfin.stocks.CboeModel")<
  CboeModel,
  CboeModelPort
>() {}

export const CboeModelLive = Layer.effect(
  CboeModel,
  Effect.gen(function* () {
    const cboe = yield* CboeService;
    return {
      spot: {
        get: (symbol: StockSymbolType) => cboe.getSpotPrice(symbol.id),
      },
      history: {
        get: (symbol: StockSymbolType) => cboe.getHistoricalPrices(symbol.id),
      },
      options: {
        chain: (symbol: StockSymbolType) => cboe.getOptionsChain(symbol.id),
      },
    } satisfies CboeModelPort;
  }),
);
