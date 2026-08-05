import { Effect, Context, Layer, Option, Schema } from "effect";
import { FetchService } from "src/cli/services/FetchService.ts";
import { ConfigError, HTTPError, ProgramError } from "src/cli/errors/index.ts";
import { ApplicationLayerLive } from "src/cli/services/index.ts";
import { ConfigService } from "src/cli/services/ConfigService.ts";
import { StockSymbolType } from "src/cli/StocksMenu/types.ts";
import type { SpotQuote } from "src/services/AlphaVantageService/index.ts";

const MASSIVE_API_BASE = "https://api.massive.com";

export const AggregateBarRaw = Schema.Struct({
  T: Schema.optional(Schema.String),
  c: Schema.Number,
  h: Schema.Number,
  l: Schema.Number,
  o: Schema.Number,
  t: Schema.Number,
  v: Schema.Number,
  vw: Schema.optional(Schema.Number),
  n: Schema.optional(Schema.Number),
});

export const PreviousDayBarRaw = Schema.Struct({
  status: Schema.String,
  ticker: Schema.String,
  results: Schema.Array(AggregateBarRaw),
  resultsCount: Schema.optional(Schema.Number),
});

export const toSpotQuoteFromBars = (
  ticker: string,
  bars: ReadonlyArray<Schema.Schema.Type<typeof AggregateBarRaw>>,
): SpotQuote => {
  const latest = bars[0];
  const previous = bars[1];

  const latestDay = new Date(latest.t).toISOString().slice(0, 10);
  const previousClose = previous?.c ?? latest.o;
  const change = latest.c - previousClose;
  const changePercent = previousClose === 0
    ? "0%"
    : `${((change / previousClose) * 100).toFixed(4)}%`;

  return {
    symbol: latest.T ?? ticker,
    price: latest.c,
    change,
    changePercent,
    open: latest.o,
    high: latest.h,
    low: latest.l,
    previousClose,
    volume: latest.v,
    latestTradingDay: latestDay,
  };
};

export interface MassiveServicePort {
  readonly getSpot: (symbol: StockSymbolType) => Effect.Effect<SpotQuote, ProgramError>;
}

export class MassiveService extends Context.Tag("hyperfin.stocks.services.Massive")<
  MassiveService,
  MassiveServicePort
>() {}

const getMassiveAPIKey = Effect.gen(function* () {
  const config = yield* ConfigService;
  const apiKeyO = config.MASSIVE_API_KEY;
  if (Option.isNone(apiKeyO)) {
    return yield* new ConfigError({ message: "Missing Massive API Key." });
  }
  return apiKeyO.value;
});

const massiveAuthHeaders = (apiKey: string): RequestInit => ({
  headers: { Authorization: `Bearer ${apiKey}` },
});

const decodePreviousDayBar = (raw: unknown) =>
  Schema.decodeUnknown(PreviousDayBarRaw)(raw).pipe(
    Effect.catchTag("ParseError", (e) =>
      Effect.fail(
        new HTTPError({ message: `Invalid Massive spot response shape: ${e.message}` }),
      ),
    ),
  );

const recentRangeDates = () => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 10);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
};

export const MassiveServiceLive = Layer.effect(
  MassiveService,
  Effect.gen(function* () {
    const fs = yield* FetchService;
    const apiKey = yield* getMassiveAPIKey;

    return {
      getSpot: (symbol: StockSymbolType) =>
        Effect.gen(function* () {
          const ticker = symbol.name.toUpperCase();
          const params = new URLSearchParams({
            adjusted: "true",
            sort: "desc",
            limit: "2",
          });
          const { from, to } = recentRangeDates();
          const rangeUrl =
            `${MASSIVE_API_BASE}/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}`;
          yield* Effect.logDebug(`Fetching range data from ${rangeUrl}`);

          const rangeRaw = yield* fs.fetchJson(rangeUrl, params, massiveAuthHeaders(apiKey));
          yield* Effect.logDebug(`Fetched range data:`)
          yield* Effect.logDebug(`${rangeRaw}`);
          const rangeValidated = yield* decodePreviousDayBar(rangeRaw);

          if (rangeValidated.status !== "OK" && rangeValidated.status !== "DELAYED") {
            return yield* new HTTPError({ message: `Massive spot request failed: ${rangeValidated.status}` })
          }

          if (rangeValidated.results.length > 0) {
            return toSpotQuoteFromBars(ticker, rangeValidated.results);
          }

          const prevUrl = `${MASSIVE_API_BASE}/v2/aggs/ticker/${ticker}/prev`;
          const prevRaw = yield* fs.fetchJson(
            prevUrl,
            new URLSearchParams({ adjusted: "true" }),
            massiveAuthHeaders(apiKey),
          );
          const prevValidated = yield* decodePreviousDayBar(prevRaw);

          if (prevValidated.status !== "OK" && prevValidated.status !== "DELAYED") {
            return yield* new HTTPError({ message: `Massive spot request failed: ${prevValidated.status}` })
          }

          if (prevValidated.results.length === 0) {
            return yield* new HTTPError({ message: `No Massive spot data for ${ticker}.` })
          }

          return toSpotQuoteFromBars(ticker, prevValidated.results);
        }),
    } satisfies MassiveServicePort;
  }),
).pipe(Layer.provide(ApplicationLayerLive));
