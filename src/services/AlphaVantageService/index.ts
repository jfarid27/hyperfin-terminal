import { Effect, Context, Layer, Option, Schema } from "effect";
import { FetchService } from "src/cli/services/FetchService.ts";
import { ConfigError, HTTPError, ProgramError } from "src/cli/errors/index.ts";
import { ApplicationLayerLive } from "src/cli/services/index.ts";
import { ConfigService } from "src/cli/services/ConfigService.ts";
import { StockSymbolType } from "../../cli/StocksMenu/types.ts";

// ── Clean output types ──

/** A validated, cleaned-up spot quote from AlphaVantage. */
export interface SpotQuote {
  readonly symbol: string;
  readonly price: number;
  readonly change: number;
  readonly changePercent: string;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly previousClose: number;
  readonly volume: number;
  readonly latestTradingDay: string;
}

/** A single daily bar, cleaned and timestamped. */
export interface ChartPoint {
  readonly date: string;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
  readonly timestamp: number;
}

/** A ticker returned by an AlphaVantage symbol search, cleaned up. */
export interface SymbolMatch {
  readonly symbol: string;
  readonly name: string;
  /** Instrument type, e.g. "Equity", "ETF". */
  readonly type: string;
  /** Exchange region, e.g. "United States". */
  readonly region: string;
  readonly currency: string;
  /** AlphaVantage relevance score (0–1); higher is a closer match. */
  readonly matchScore: number;
}

// ── Raw response schemas (match AlphaVantage's exact JSON shape) ──

export const GlobalQuoteRaw = Schema.Struct({
  "Global Quote": Schema.Struct({
    "01. symbol": Schema.String,
    "02. open": Schema.String,
    "03. high": Schema.String,
    "04. low": Schema.String,
    "05. price": Schema.String,
    "06. volume": Schema.String,
    "07. latest trading day": Schema.String,
    "08. previous close": Schema.String,
    "09. change": Schema.String,
    "10. change percent": Schema.String,
  }),
});

export const DailyEntryRaw = Schema.Struct({
  "1. open": Schema.String,
  "2. high": Schema.String,
  "3. low": Schema.String,
  "4. close": Schema.String,
  "5. volume": Schema.String,
});

export const TimeSeriesDailyRaw = Schema.Struct({
  "Meta Data": Schema.Struct({
    "2. Symbol": Schema.String,
    "3. Last Refreshed": Schema.String,
  }),
  "Time Series (Daily)": Schema.Record({ key: Schema.String, value: DailyEntryRaw }),
});

const SymbolMatchRaw = Schema.Struct({
  "1. symbol": Schema.String,
  "2. name": Schema.String,
  "3. type": Schema.String,
  "4. region": Schema.String,
  "8. currency": Schema.String,
  "9. matchScore": Schema.String,
});

/**
 * Shape of a SYMBOL_SEARCH response.
 *
 * A successful search always carries `bestMatches` (empty array when nothing
 * matched). When the free-tier limit is hit or the request is malformed,
 * AlphaVantage instead returns a bare `Information`/`Note` string with no
 * `bestMatches` — that must surface as an error rather than an empty result.
 */
export const SymbolSearchRaw = Schema.Struct({
  bestMatches: Schema.optionalWith(Schema.Array(SymbolMatchRaw), {
    default: () => [],
  }),
  Information: Schema.optional(Schema.String),
  Note: Schema.optional(Schema.String),
});

// ── Transformations: raw → clean ──

export const toSpotQuote = (raw: Schema.Schema.Type<typeof GlobalQuoteRaw>): SpotQuote => {
  const q = raw["Global Quote"];
  return {
    symbol: q["01. symbol"],
    price: Number(q["05. price"]),
    change: Number(q["09. change"]),
    changePercent: q["10. change percent"],
    open: Number(q["02. open"]),
    high: Number(q["03. high"]),
    low: Number(q["04. low"]),
    previousClose: Number(q["08. previous close"]),
    volume: Number(q["06. volume"]),
    latestTradingDay: q["07. latest trading day"],
  };
};

export const toChartPoints = (raw: Schema.Schema.Type<typeof TimeSeriesDailyRaw>): ChartPoint[] => {
  const series = raw["Time Series (Daily)"];
  return Object.entries(series)
    .map(([date, entry]) => ({
      date,
      open: Number(entry["1. open"]),
      high: Number(entry["2. high"]),
      low: Number(entry["3. low"]),
      close: Number(entry["4. close"]),
      volume: Number(entry["5. volume"]),
      timestamp: new Date(date).getTime(),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
};

export const toSymbolMatches = (
  raw: Schema.Schema.Type<typeof SymbolSearchRaw>,
): SymbolMatch[] =>
  raw.bestMatches.map((m) => ({
    symbol: m["1. symbol"],
    name: m["2. name"],
    type: m["3. type"],
    region: m["4. region"],
    currency: m["8. currency"],
    matchScore: Number(m["9. matchScore"]),
  })).sort((a, b) => b.matchScore - a.matchScore);

// ── Service port ──

export interface AlphaVantageServicePort {
  readonly getChart: (symbol: StockSymbolType) => Effect.Effect<ChartPoint[], ProgramError>;
  readonly getSpot: (symbol: StockSymbolType) => Effect.Effect<SpotQuote, ProgramError>;
  readonly searchSymbols: (query: string) => Effect.Effect<SymbolMatch[], ProgramError>;
}

export class AlphaVantageService extends Context.Tag("hyperfin.stocks.services.AlphaVantage")<
  AlphaVantageService,
  AlphaVantageServicePort
>() {}

// ── API key helper ──

const getAVAPIKey = Effect.gen(function* () {
  const config = yield* ConfigService;
  const apiKeyO = config.ALPHAVANTAGE_API_KEY;
  if (Option.isNone(apiKeyO)) {
    return yield* new ConfigError({ message: "Missing Alphavantage API Key." });
  }
  return apiKeyO.value;
});

// ── Live implementation ──

export const AlphaVantageServiceLive = Layer.effect(
  AlphaVantageService,
  Effect.gen(function* () {
    const fs = yield* FetchService;
    const apiKey = yield* getAVAPIKey;

    return {
      getSpot: (symbol: StockSymbolType) =>
        Effect.gen(function* () {
          const params = new URLSearchParams({
            function: "GLOBAL_QUOTE",
            symbol: symbol.id,
            apikey: apiKey,
          });
          const raw = yield* fs.fetchJson("https://www.alphavantage.co/query", params);
          const validated = yield* Schema.decodeUnknown(GlobalQuoteRaw)(raw).pipe(
            Effect.catchTag("ParseError", (e) =>
              Effect.fail(
                new HTTPError({ message: `Invalid AlphaVantage spot response shape: ${e.message}` }),
              ),
            ),
          );
          return toSpotQuote(validated);
        }).pipe(Effect.delay("1 seconds")),

      getChart: (symbol: StockSymbolType) =>
        Effect.gen(function* () {
          const params = new URLSearchParams({
            function: "TIME_SERIES_DAILY",
            outputsize: "compact",
            symbol: symbol.id,
            apikey: apiKey,
          });
          const raw = yield* fs.fetchJson("https://www.alphavantage.co/query", params);
          const validated = yield* Schema.decodeUnknown(TimeSeriesDailyRaw)(raw).pipe(
            Effect.catchTag("ParseError", (e) =>
              Effect.fail(
                new HTTPError({ message: `Invalid AlphaVantage chart response shape: ${e.message}` }),
              ),
            ),
          );
          return toChartPoints(validated);
        }).pipe(Effect.delay("1 seconds")),

      searchSymbols: (query: string) =>
        Effect.gen(function* () {
          const params = new URLSearchParams({
            function: "SYMBOL_SEARCH",
            keywords: query,
            apikey: apiKey
          });
          const raw = yield* fs.fetchJson("https://www.alphavantage.co/query", params);
          const validated = yield* Schema.decodeUnknown(SymbolSearchRaw)(raw).pipe(
            Effect.catchTag("ParseError", (e) =>
              Effect.fail(
                new HTTPError({ message: `Invalid AlphaVantage symbol search response shape: ${e.message}` }),
              ),
            ),
          );
          // A rate-limit/notice response arrives as a bare Information/Note
          // string with no `bestMatches`, which decodes to an empty list —
          // surface it as an error so it isn't mistaken for "no results".
          const notice = validated.Information ?? validated.Note;
          if (notice !== undefined && validated.bestMatches.length === 0) {
            return yield* new HTTPError({ message: `AlphaVantage symbol search unavailable: ${notice}` });
          }
          return toSymbolMatches(validated);
        }).pipe(Effect.delay("1 seconds")),
    } satisfies AlphaVantageServicePort;
  }),
).pipe(Layer.provide(ApplicationLayerLive));
