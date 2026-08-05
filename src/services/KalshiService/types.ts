import { Effect, Context, Layer } from "effect";
import { HTTPError, LocalProcessingError } from "src/cli/errors/index.ts";
import { FetchService } from "src/cli/services/FetchService.ts";

export interface KalshiModelPort {
  markets: {
    getByEventTicker: (
      eventTicker: string,
      limit?: number,
    ) => Effect.Effect<any, HTTPError | LocalProcessingError>;
  };
}

export class KalshiModel extends Context.Tag("hyperfin.predictions.KalshiModel")<
  KalshiModel,
  KalshiModelPort
>() {}

export const KalshiModelLive = Layer.effect(
  KalshiModel,
  Effect.gen(function* () {
    const fs = yield* FetchService;
    return {
      markets: {
        getByEventTicker: (eventTicker: string, limit?: number) =>
          Effect.gen(function* () {
            const params = new URLSearchParams({
              event_ticker: eventTicker,
              ...(limit ? { limit: String(limit) } : {}),
            });
            const data = yield* fs.fetchJson(
              "https://api.elections.kalshi.com/trade-api/v2/markets",
              params,
            );
            yield* Effect.sleep(3000);
            return data;
          }),
      },
    } satisfies KalshiModelPort;
  }),
);
