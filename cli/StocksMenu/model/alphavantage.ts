import { StockSymbolType } from "../types.ts";
import { Effect, Context, Layer } from "effect";
import { FetchService } from "cli/services/FetchService.ts";
import { ConfigError, HTTPError, LocalProcessingError } from "cli/errors/index.ts";

export interface AlphaVantageModelPort {
  chart: {
    get: (symbol: StockSymbolType, apiKey: string) => Effect.Effect<unknown, ConfigError | HTTPError | LocalProcessingError>;
  };
  spot: {
    get: (symbol: StockSymbolType, apiKey: string) => Effect.Effect<unknown, ConfigError | HTTPError | LocalProcessingError>;
  };
}

export class AlphaVantageModel extends Context.Tag("hyperfin.stocks.AlphaVantageModel")<
  AlphaVantageModel,
  AlphaVantageModelPort
>() {}

export const AlphaVantageModelLive = Layer.effect(
  AlphaVantageModel,
  Effect.gen(function* () {
    const fs = yield* FetchService;
    return {
      chart: {
        get: (symbol: StockSymbolType, apiKey: string) =>
          Effect.gen(function* () {
            if (!apiKey) return yield* new ConfigError({ message: "Missing Alphavantage API Key." });
            const params = new URLSearchParams({
              function: "TIME_SERIES_DAILY",
              outputsize: "compact",
              symbol: symbol.id,
              apikey: apiKey,
            });
            return yield* fs.fetchJson("https://www.alphavantage.co/query", params);
          }).pipe(Effect.delay("1 seconds")),
      },
      spot: {
        get: (symbol: StockSymbolType, apiKey: string) =>
          Effect.gen(function* () {
            if (!apiKey) return yield* new ConfigError({ message: "Missing Alphavantage API Key." });
            const params = new URLSearchParams({
              function: "GLOBAL_QUOTE",
              symbol: symbol.id,
              apikey: apiKey,
            });
            return yield* fs.fetchJson("https://www.alphavantage.co/query", params);
          }),
      },
    } satisfies AlphaVantageModelPort;
  }),
);
