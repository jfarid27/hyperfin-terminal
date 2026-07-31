import { StockSymbolType } from "../types.ts";
import { Effect, Context, Layer } from "effect";
import { FetchService } from "cli/services/FetchService.ts";
import { ConfigError, HTTPError, LocalProcessingError } from "cli/errors/index.ts";

export interface MassiveModelPort {
  spot: {
    get: (symbol: StockSymbolType, apiKey: string) => Effect.Effect<unknown, ConfigError | HTTPError | LocalProcessingError>;
  };
}

export class MassiveModel extends Context.Tag("hyperfin.stocks.MassiveModel")<
  MassiveModel,
  MassiveModelPort
>() {}

const MASSIVE_BASE_URL = "https://api.massive.com/v2";

export const MassiveModelLive = Layer.effect(
  MassiveModel,
  Effect.gen(function* () {
    const fs = yield* FetchService;
    return {
      spot: {
        get: (symbol: StockSymbolType, apiKey: string) =>
          Effect.gen(function* () {
            if (!apiKey) return yield* new ConfigError({ message: "Missing Massive API Key." });
            const params = new URLSearchParams({ apiKey });
            return yield* fs.fetchJson(
              `${MASSIVE_BASE_URL}/snapshot/locale/us/markets/stocks/tickers/${symbol.id}`,
              params,
            );
          }),
      },
    } satisfies MassiveModelPort;
  }),
);
