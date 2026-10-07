import { Effect, Context, Layer, Option, Schema } from "effect";
import { FetchService } from "src/cli/services/FetchService.ts";
import { ConfigError, HTTPError, ProgramError } from "src/cli/errors/index.ts";
import { ApplicationLayerLive } from "src/cli/services/index.ts";
import { ConfigService } from "src/cli/services/ConfigService.ts";
import type { ForexChartPoint, ForexPairType, ForexQuote } from "./types.ts";

const AV_QUERY_URL = "https://www.alphavantage.co/query";

// ── Raw response schemas (match AlphaVantage's exact JSON shape) ──

/** The inner payload of a CURRENCY_EXCHANGE_RATE response. */
export const RealtimeRateRaw = Schema.Struct({
  "1. From_Currency Code": Schema.String,
  "2. From_Currency Name": Schema.String,
  "3. To_Currency Code": Schema.String,
  "4. To_Currency Name": Schema.String,
  "5. Exchange Rate": Schema.String,
  "6. Last Refreshed": Schema.String,
  "7. Time Zone": Schema.String,
  "8. Bid Price": Schema.String,
  "9. Ask Price": Schema.String,
});

/**
 * Shape of a CURRENCY_EXCHANGE_RATE response.
 *
 * On success the payload sits under `Realtime Currency Exchange Rate`. When the
 * request is malformed or the free-tier rate limit is hit, AlphaVantage instead
 * returns a bare `Information`/`Note` string — that must surface as an error
 * rather than a missing-field ParseError.
 */
export const ForexQuoteRaw = Schema.Struct({
  "Realtime Currency Exchange Rate": Schema.optional(RealtimeRateRaw),
  Information: Schema.optional(Schema.String),
  Note: Schema.optional(Schema.String),
});

export const FxDailyEntryRaw = Schema.Struct({
  "1. open": Schema.String,
  "2. high": Schema.String,
  "3. low": Schema.String,
  "4. close": Schema.String,
});

/**
 * Shape of an FX_DAILY response. Like the quote response, a throttled request
 * omits `Time Series FX (Daily)` and returns a notice string instead.
 */
export const FxDailyRaw = Schema.Struct({
  "Meta Data": Schema.optional(
    Schema.Struct({
      "1. Information": Schema.optional(Schema.String),
      "2. From Symbol": Schema.optional(Schema.String),
      "3. To Symbol": Schema.optional(Schema.String),
      "5. Last Refreshed": Schema.optional(Schema.String),
      "6. Time Zone": Schema.optional(Schema.String),
    }),
  ),
  "Time Series FX (Daily)": Schema.optional(
    Schema.Record({ key: Schema.String, value: FxDailyEntryRaw }),
  ),
  Information: Schema.optional(Schema.String),
  Note: Schema.optional(Schema.String),
});

// ── Transformations: raw → clean ──

export const toForexQuote = (
  raw: Schema.Schema.Type<typeof RealtimeRateRaw>,
): ForexQuote => ({
  from: raw["1. From_Currency Code"],
  to: raw["3. To_Currency Code"],
  fromName: raw["2. From_Currency Name"],
  toName: raw["4. To_Currency Name"],
  rate: Number(raw["5. Exchange Rate"]),
  bid: Number(raw["8. Bid Price"]),
  ask: Number(raw["9. Ask Price"]),
  lastRefreshed: raw["6. Last Refreshed"],
  timeZone: raw["7. Time Zone"],
});

export const toForexChartPoints = (
  raw: Schema.Schema.Type<typeof FxDailyRaw>,
): ForexChartPoint[] => {
  const series = raw["Time Series FX (Daily)"] ?? {};
  return Object.entries(series)
    .map(([date, entry]) => ({
      date,
      open: Number(entry["1. open"]),
      high: Number(entry["2. high"]),
      low: Number(entry["3. low"]),
      close: Number(entry["4. close"]),
      timestamp: new Date(date).getTime(),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
};

// ── Date-range resolution ──

/**
 * Resolve the optional `from`/`to` chart arguments into an inclusive
 * `[start, end]` millisecond range.
 *
 * - neither date  → the trailing year ending today
 * - `from` only   → `from` through today
 * - both dates    → exactly `from` through `to`
 *
 * Dates are `YYYY-MM-DD`. Returns `null` when a supplied date is not a valid
 * calendar date, or when `from` is after `to`, so the caller can report a
 * helpful error instead of charting an empty range.
 */
export const resolveDateRange = (
  from?: string,
  to?: string,
  now: Date = new Date(),
): { start: number; end: number } | null => {
  const parse = (value: string): number | null => {
    const trimmed = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
    const parsed = new Date(`${trimmed}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return null;
    // Reject rollovers (e.g. 2026-02-31 → Mar 3) so malformed dates fail loudly.
    if (parsed.toISOString().slice(0, 10) !== trimmed) return null;
    return parsed.getTime();
  };

  const defaultEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).getTime();

  let start: number;
  if (from === undefined || from.trim() === "") {
    const oneYearAgo = new Date(defaultEnd);
    oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1);
    start = oneYearAgo.getTime();
  } else {
    const parsedFrom = parse(from);
    if (parsedFrom === null) return null;
    start = parsedFrom;
  }

  let end: number;
  if (to === undefined || to.trim() === "") {
    end = defaultEnd;
  } else {
    const parsedTo = parse(to);
    if (parsedTo === null) return null;
    // Include the whole end day rather than just its 00:00 instant.
    end = parsedTo + 24 * 60 * 60 * 1000 - 1;
  }

  if (start > end) return null;
  return { start, end };
};

/** Keep only the chart points that fall inside `[start, end]` (inclusive). */
export const filterPointsByRange = (
  points: readonly ForexChartPoint[],
  range: { start: number; end: number },
): ForexChartPoint[] =>
  points.filter((p) => p.timestamp >= range.start && p.timestamp <= range.end);

// ── Service port ──

export interface ForexServicePort {
  /** Latest realtime exchange rate for a pair (CURRENCY_EXCHANGE_RATE). */
  readonly getSpot: (pair: ForexPairType) => Effect.Effect<ForexQuote, ProgramError>;
  /** Full daily OHLC history for a pair (FX_DAILY, outputsize=full). */
  readonly getDaily: (pair: ForexPairType) => Effect.Effect<ForexChartPoint[], ProgramError>;
}

export class ForexService extends Context.Tag("hyperfin.forex.services.ForexService")<
  ForexService,
  ForexServicePort
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

/** A throttled/notice response carries a message but no payload. */
const noticeError = (
  validated: { Information?: string; Note?: string },
  subject: string,
): HTTPError | null => {
  const notice = validated.Information ?? validated.Note;
  if (notice !== undefined) {
    return new HTTPError({ message: `AlphaVantage ${subject} unavailable: ${notice}` });
  }
  return null;
};

// ── Live implementation ──

export const ForexServiceLive = Layer.effect(
  ForexService,
  Effect.gen(function* () {
    const fs = yield* FetchService;
    const apiKey = yield* getAVAPIKey;

    return {
      getSpot: (pair: ForexPairType) =>
        Effect.gen(function* () {
          const params = new URLSearchParams({
            function: "CURRENCY_EXCHANGE_RATE",
            from_currency: pair.from,
            to_currency: pair.to,
            apikey: apiKey,
          });
          const raw = yield* fs.fetchJson(AV_QUERY_URL, params);
          const validated = yield* Schema.decodeUnknown(ForexQuoteRaw)(raw).pipe(
            Effect.catchTag("ParseError", (e) =>
              Effect.fail(
                new HTTPError({ message: `Invalid AlphaVantage forex quote response shape: ${e.message}` }),
              ),
            ),
          );

          const rate = validated["Realtime Currency Exchange Rate"];
          if (rate === undefined) {
            const notice = noticeError(validated, "forex quote");
            return yield* notice ??
              new HTTPError({
                message: `AlphaVantage returned no exchange rate for ${pair.from}/${pair.to}`,
              });
          }

          return toForexQuote(rate);
        }).pipe(Effect.delay("1 seconds")),

      getDaily: (pair: ForexPairType) =>
        Effect.gen(function* () {
          const params = new URLSearchParams({
            function: "FX_DAILY",
            from_symbol: pair.from,
            to_symbol: pair.to,
            // `full` returns the entire daily history (back to ~2007), which the
            // chart action narrows to the requested date range client-side.
            outputsize: "full",
            apikey: apiKey,
          });
          const raw = yield* fs.fetchJson(AV_QUERY_URL, params);
          const validated = yield* Schema.decodeUnknown(FxDailyRaw)(raw).pipe(
            Effect.catchTag("ParseError", (e) =>
              Effect.fail(
                new HTTPError({ message: `Invalid AlphaVantage forex chart response shape: ${e.message}` }),
              ),
            ),
          );

          if (validated["Time Series FX (Daily)"] === undefined) {
            const notice = noticeError(validated, "forex chart");
            return yield* notice ??
              new HTTPError({
                message: `AlphaVantage returned no daily FX data for ${pair.from}/${pair.to}`,
              });
          }

          return toForexChartPoints(validated);
        }).pipe(Effect.delay("1 seconds")),
    } satisfies ForexServicePort;
  }),
).pipe(Layer.provide(ApplicationLayerLive));
