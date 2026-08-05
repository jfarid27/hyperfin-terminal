import { FredSeriesType } from "../../../services/GovernmentService/types.ts";
import { Effect, Context, Layer } from "effect";
import { FetchService } from "src/cli/services/FetchService.ts";
import { ConfigError, HTTPError, LocalProcessingError } from "src/cli/errors/index.ts";

export interface FredModelPort {
  get: (
    series: FredSeriesType,
    startDate: string,
    endDate: string,
    apiKey: string,
  ) => Effect.Effect<unknown, ConfigError | HTTPError | LocalProcessingError>;
  getMetadata: (
    series: FredSeriesType,
    apiKey: string,
  ) => Effect.Effect<unknown, ConfigError | HTTPError | LocalProcessingError>;
}

export class FredModel extends Context.Tag("hyperfin.government.FredModel")<
  FredModel,
  FredModelPort
>() {}

export const FredModelLive = Layer.effect(
  FredModel,
  Effect.gen(function* () {
    const fs = yield* FetchService;
    return {
      getMetadata: (series: FredSeriesType, apiKey: string) =>
        Effect.gen(function* () {
          if (!apiKey) {
            return yield* new ConfigError({ message: "Missing FRED API Key." });
          }
          const params = new URLSearchParams({
            series_id: series.seriesId,
            api_key: apiKey,
            file_type: "json",
          });
          return yield* fs.fetchJson("https://api.stlouisfed.org/fred/series", params);
        }),
      get: (series: FredSeriesType, startDate: string, endDate: string, apiKey: string) =>
        Effect.gen(function* () {
          if (!apiKey) {
            return yield* new ConfigError({ message: "Missing FRED API Key." });
          }
          const params = new URLSearchParams({
            series_id: series.seriesId,
            api_key: apiKey,
            file_type: "json",
            observation_start: startDate,
            observation_end: endDate,
          });
          return yield* fs.fetchJson(
            "https://api.stlouisfed.org/fred/series/observations",
            params,
          );
        }),
    } satisfies FredModelPort;
  }),
);
