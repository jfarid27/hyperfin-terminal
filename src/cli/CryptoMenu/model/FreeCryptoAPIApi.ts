import { CryptoSymbolType } from "../types.ts";
import { Effect, Context, Layer } from "effect";
import { FetchService } from "src/cli/services/FetchService.ts";
import { ConfigError, HTTPError, LocalProcessingError } from "src/cli/errors/index.ts";

const URL = "https://api.freecryptoapi.com/v1";

export interface FreeCryptoAPIModelPort {
  chart: {
    get: (symbol: CryptoSymbolType, apiKey: string) => Effect.Effect<unknown, ConfigError | HTTPError | LocalProcessingError>;
  };
}

export class FreeCryptoAPIModel extends Context.Tag("hyperfin.crypto.FreeCryptoAPIModel")<
  FreeCryptoAPIModel,
  FreeCryptoAPIModelPort
>() {}

export const FreeCryptoAPIModelLive = Layer.effect(
  FreeCryptoAPIModel,
  Effect.gen(function* () {
    const fs = yield* FetchService;
    return {
      chart: {
        get: (symbol: CryptoSymbolType, apiKey: string) =>
          Effect.gen(function* () {
            if (!apiKey) {
              return yield* new ConfigError({ message: "Missing FreeCryptoAPI API Key." });
            }
            const params = new URLSearchParams({
              symbol: symbol.id,
              days: "14",
            });
            return yield* fs.fetchJson(`${URL}/getHistory`, params, {
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Accept": "application/json",
              },
            });
          }),
      },
    } satisfies FreeCryptoAPIModelPort;
  }),
);
