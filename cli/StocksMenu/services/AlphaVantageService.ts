import { Effect, Context, Layer, Option } from "effect";
import { FetchService } from "cli/services/FetchService.ts";
import { ConfigError, HTTPError, LocalProcessingError, ProgramError } from "cli/errors/index.ts";
import { ApplicationLayerLive } from "cli/services/index.ts";
import { ConfigService } from "cli/services/ConfigService.ts";
import { StockSymbolType } from "../types.ts";

export interface AlphaVantageServicePort {
  readonly getChart: (symbol: StockSymbolType) => Effect.Effect<any, ProgramError>,
  readonly getSpot: (symbol: StockSymbolType) => Effect.Effect<any, ProgramError>,
}

export class AlphaVantageService extends Context.Tag("hyperfin.stocks.services.AlphaVantage")<
  AlphaVantageService,
  AlphaVantageServicePort
>() {}

// Fetch the Alphavantage API key from the config service.
const getAVAPIKey = Effect.gen(function* () {
  const config = yield* ConfigService;
  const apiKeyO = config.ALPHAVANTAGE_API_KEY;
  if (Option.isNone(apiKeyO)) return yield* new ConfigError({ message: "Missing Alphavantage API Key." });
  return yield* apiKeyO;
}).pipe(Effect.catchTag(
  "NoSuchElementException",
  () => Effect.fail(new ConfigError({ message: "Missing Alphavantage API Key." })),
));

export const AlphaVantageServiceLive = Layer.effect(
  AlphaVantageService, Effect.gen(function* () {
    const fs = yield* FetchService;
    const apiKey = yield* getAVAPIKey;

    return {
      getChart: (symbol: StockSymbolType) => Effect.gen(function* () {
        const params = new URLSearchParams({
          "function": "TIME_SERIES_DAILY",
          "outputsize": "compact",
          "symbol": symbol.id,
          "apikey": apiKey,
        });
        const response = yield* fs.fetchJson("https://www.alphavantage.co/query", params);
        return response;
      }).pipe(
        Effect.delay("1 seconds"),
      ),
      getSpot: (symbol: StockSymbolType) => Effect.gen(function* () {
        const params = new URLSearchParams({
          function: "GLOBAL_QUOTE",
          symbol: symbol.id,
          apikey: apiKey,
        });
        return yield* fs.fetchJson("https://www.alphavantage.co/query", params);
      }).pipe(
        Effect.delay("1 seconds"),
      )
    }
  })
).pipe(Layer.provide(ApplicationLayerLive));
