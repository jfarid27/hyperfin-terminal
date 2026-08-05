import { Effect, Context, Layer, Schema } from "effect";
import { ConfigError, HTTPError, ProgramError } from "src/cli/errors/index.ts";
import { BondSymbolType, YieldPoint } from "../types.ts";

// ── Yahoo Finance API constants ──

const YAHOO_BASE = "https://query2.finance.yahoo.com";
const YAHOO_FC = "https://fc.yahoo.com";

// ── Raw response schemas ──

const ChartMetaRaw = Schema.Struct({
  currency: Schema.optional(Schema.String),
  symbol: Schema.String,
  regularMarketPrice: Schema.optional(Schema.Number),
  chartPreviousClose: Schema.optional(Schema.Number),
  validRanges: Schema.Array(Schema.String),
});

const ChartResultRaw = Schema.Struct({
  meta: ChartMetaRaw,
  timestamp: Schema.optional(Schema.Array(Schema.Number)),
  indicators: Schema.Struct({
    quote: Schema.Array(
      Schema.Struct({
        close: Schema.optional(Schema.Array(Schema.NullishOr(Schema.Number))),
      }),
    ),
  }),
});

const ChartResponseRaw = Schema.Struct({
  chart: Schema.Struct({
    result: Schema.Array(ChartResultRaw),
    error: Schema.NullishOr(
      Schema.Struct({
        code: Schema.String,
        description: Schema.String,
      }),
    ),
  }),
});

// ── Decode helpers ──

const decodeChartResponse = (raw: unknown) =>
  Schema.decodeUnknown(ChartResponseRaw)(raw).pipe(
    Effect.catchTag("ParseError", (e) =>
      Effect.logDebug(`Yahoo Finance chart response shape changed: ${e.message}`).pipe(
        Effect.andThen(
          Effect.fail(
            new HTTPError({ message: `Invalid Yahoo Finance chart response: ${e.message}` }),
          ),
        ),
      ),
    ),
  );

// ── Cookie-aware fetch helper ──
// Reuses the same pattern from YahooFinanceOptionsService.

let _cookieHeader: string | null = null;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const yahooFetch = (url: string): Effect.Effect<Response, HTTPError> =>
  Effect.tryPromise({
    try: () =>
      fetch(url, {
        headers: {
          "User-Agent": UA,
          ...(_cookieHeader ? { Cookie: _cookieHeader } : {}),
        },
        redirect: "manual",
      }),
    catch: () => new HTTPError({ message: `Failed to fetch: ${url}` }),
  });

const saveCookies = (response: Response) => {
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    const match = setCookie.match(/A3=[^;]+/);
    if (match) {
      _cookieHeader = match[0];
    }
  }
};

const getCrumb = Effect.gen(function* () {
  const fcResp = yield* yahooFetch(YAHOO_FC);
  saveCookies(fcResp);

  if (!_cookieHeader) {
    return yield* new HTTPError({ message: "Failed to get Yahoo Finance cookie" });
  }

  const crumbResp = yield* yahooFetch(`${YAHOO_BASE}/v1/test/getcrumb`);
  const crumb = yield* Effect.tryPromise({
    try: () => crumbResp.text(),
    catch: () => new HTTPError({ message: "Failed to read Yahoo crumb response" }),
  });

  if (crumb.includes("<html>") || crumb.includes("Too Many Requests") || crumb === "") {
    return yield* new HTTPError({ message: "Yahoo Finance rate limited or unavailable" });
  }

  return crumb;
});

// ── Service port ──

export interface YahooFinanceBondsPort {
  readonly getYields: (
    symbol: BondSymbolType,
    range?: string,
  ) => Effect.Effect<readonly YieldPoint[], ProgramError>;
}

export class YahooFinanceBonds extends Context.Tag("hyperfin.bonds.services.YahooFinance")<
  YahooFinanceBonds,
  YahooFinanceBondsPort
>() {}

// ── Live implementation ──

export const YahooFinanceBondsLive = Layer.effect(
  YahooFinanceBonds,
  Effect.succeed({
    getYields: (symbol: BondSymbolType, range = "1y") =>
      Effect.gen(function* () {
        const crumb = yield* getCrumb;
        const url =
          `${YAHOO_BASE}/v8/finance/chart/${symbol.id}?range=${range}&interval=1d&includePrePost=false&crumb=${crumb}`;
        const resp = yield* yahooFetch(url);
        const text = yield* Effect.tryPromise({
          try: () => resp.json(),
          catch: () => new HTTPError({ message: "Failed to parse Yahoo chart response" }),
        });
        const validated = yield* decodeChartResponse(text);

        const result = validated.chart.result[0];
        if (!result) {
          return yield* new HTTPError({ message: "No chart data returned from Yahoo Finance" });
        }

        const timestamps = result.timestamp ?? [];
        const closes = result.indicators.quote[0]?.close ?? [];

        const points: YieldPoint[] = [];
        for (let i = 0; i < timestamps.length; i++) {
          const close = closes[i];
          if (close != null && !isNaN(close)) {
            points.push({
              timestamp: timestamps[i],
              date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
              close,
            });
          }
        }

        return points;
      }),
  } satisfies YahooFinanceBondsPort),
);
