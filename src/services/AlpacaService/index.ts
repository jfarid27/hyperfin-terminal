import { Effect, Context, Layer, Option, Schema } from "effect";
import { FetchService, type FetchServicePort } from "src/cli/services/FetchService.ts";
import { ConfigError, HTTPError, LocalProcessingError, ProgramError } from "src/cli/errors/index.ts";
import { ApplicationLayerLive } from "src/cli/services/index.ts";
import { ConfigService } from "src/cli/services/ConfigService.ts";
import type { StockSymbolType } from "src/cli/StocksMenu/types.ts";
import type { SpotQuote, ChartPoint } from "src/services/AlphaVantageService/index.ts";
import type { OptionContract, OptionsChain, OptionSymbolType } from "src/services/OptionsService/types.ts";
import type { ForexChartPoint, ForexPairType, ForexQuote } from "src/services/ForexService/types.ts";

/**
 * Alpaca Market Data API.
 *
 * Auth is a key/secret header pair (`APCA-API-KEY-ID` / `APCA-API-SECRET-KEY`),
 * taken from the `ALPACA_API_KEY` / `ALPACA_API_SECRET` environment variables.
 * All endpoints live on the market-data host, `https://data.alpaca.markets`.
 *
 * Coverage and entitlements are account-dependent:
 *   - Stocks  : `/v2/stocks/*`   (snapshots + historical bars) — IEX feed on the free plan.
 *   - Options : `/v1beta1/options/*` (chain snapshots + historical bars) — indicative feed.
 *   - Forex   : `/v1beta1/forex/*` (latest + historical rates) — requires a forex entitlement.
 *   - Fixed income: `/v1beta1/fixed_income/latest/prices` (latest prices/yields by ISIN) —
 *     requires a fixed-income entitlement and has **no historical** endpoint.
 *
 * A key that lacks an entitlement receives a 403 with a JSON `message`; that is
 * surfaced verbatim so the user understands it is an account limitation, not a bug.
 */

const ALPACA_DATA_BASE = "https://data.alpaca.markets";

/** Bound multi-page fetches so a huge chain can never loop unbounded. */
const MAX_PAGES = 20;

// ── Clean output types ──

/** A latest price + yield for a fixed-income security (Alpaca quotes by ISIN). */
export interface FixedIncomeQuote {
  readonly isin: string;
  /** Clean price as a percentage of par, e.g. 99.6459. */
  readonly price: number;
  /** ISO timestamp of the quote. */
  readonly asOf: string;
  /** Yield to maturity, when the feed provides it. */
  readonly yieldToMaturity?: number;
  /** Yield to worst, when the feed provides it. */
  readonly yieldToWorst?: number;
}

// ── Raw response schemas (match Alpaca's exact JSON shape) ──

const BarRaw = Schema.Struct({
  t: Schema.String,
  o: Schema.Number,
  h: Schema.Number,
  l: Schema.Number,
  c: Schema.Number,
  v: Schema.Number,
});

const TradeRaw = Schema.Struct({
  p: Schema.Number,
  t: Schema.String,
});

const QuoteRaw = Schema.Struct({
  ap: Schema.Number,
  bp: Schema.Number,
});

export const StockSnapshotRaw = Schema.Struct({
  latestTrade: Schema.optional(TradeRaw),
  latestQuote: Schema.optional(QuoteRaw),
  minuteBar: Schema.optional(BarRaw),
  dailyBar: Schema.optional(BarRaw),
  prevDailyBar: Schema.optional(BarRaw),
});

export const StockBarsRaw = Schema.Struct({
  bars: Schema.optional(Schema.Array(BarRaw)),
  next_page_token: Schema.optional(Schema.NullishOr(Schema.String)),
});

export const OptionSnapshotRaw = Schema.Struct({
  impliedVolatility: Schema.optional(Schema.Number),
  latestTrade: Schema.optional(TradeRaw),
  latestQuote: Schema.optional(QuoteRaw),
  dailyBar: Schema.optional(BarRaw),
  prevDailyBar: Schema.optional(BarRaw),
});

export const OptionChainRaw = Schema.Struct({
  snapshots: Schema.Record({ key: Schema.String, value: OptionSnapshotRaw }),
  next_page_token: Schema.optional(Schema.NullishOr(Schema.String)),
});

export const ForexRateRaw = Schema.Struct({
  bp: Schema.Number,
  mp: Schema.Number,
  ap: Schema.Number,
  t: Schema.String,
});

export const ForexLatestRatesRaw = Schema.Struct({
  rates: Schema.Record({ key: Schema.String, value: ForexRateRaw }),
});

export const ForexHistoricalRatesRaw = Schema.Struct({
  rates: Schema.Record({ key: Schema.String, value: Schema.Array(ForexRateRaw) }),
  next_page_token: Schema.optional(Schema.NullishOr(Schema.String)),
});

export const FixedIncomePricesRaw = Schema.Struct({
  prices: Schema.Record({
    key: Schema.String,
    value: Schema.Struct({
      p: Schema.Number,
      t: Schema.String,
      ytm: Schema.optional(Schema.Number),
      ytw: Schema.optional(Schema.Number),
    }),
  }),
});

// ── Transformations: raw → clean ──

/**
 * Parse an OCC option contract symbol (e.g. `AAPL261009C00110000`) into its
 * parts. The trailing 15 characters are fixed-width (YYMMDD + C/P + strike*1000),
 * so the root is everything before them regardless of digits in the root.
 * Returns null when the symbol does not match the expected layout.
 */
export const parseOccSymbol = (
  symbol: string,
): { root: string; expiration: number; type: "call" | "put"; strike: number } | null => {
  if (symbol.length <= 15) return null;
  const tail = symbol.slice(-15);
  const datePart = tail.slice(0, 6);
  const cp = tail[6];
  const strikePart = tail.slice(7);
  if (!/^\d{6}$/.test(datePart)) return null;
  if (cp !== "C" && cp !== "P") return null;
  if (!/^\d{8}$/.test(strikePart)) return null;

  const yy = Number(datePart.slice(0, 2));
  const mm = Number(datePart.slice(2, 4));
  const dd = Number(datePart.slice(4, 6));
  const expirationMs = Date.UTC(2000 + yy, mm - 1, dd);
  if (Number.isNaN(expirationMs)) return null;

  return {
    root: symbol.slice(0, symbol.length - 15),
    expiration: Math.floor(expirationMs / 1000),
    type: cp === "C" ? "call" : "put",
    strike: Number(strikePart) / 1000,
  };
};

const pct = (change: number, base: number): string =>
  base === 0 ? "0%" : `${((change / base) * 100).toFixed(4)}%`;

/** Map an Alpaca stock snapshot to the shared `SpotQuote` shape. */
export const toSpotQuoteFromSnapshot = (
  symbol: string,
  raw: Schema.Schema.Type<typeof StockSnapshotRaw>,
): SpotQuote => {
  const price = raw.latestTrade?.p ?? raw.dailyBar?.c ?? 0;
  const previousClose = raw.prevDailyBar?.c ?? raw.dailyBar?.o ?? price;
  const change = price - previousClose;
  return {
    symbol,
    price,
    change,
    changePercent: pct(change, previousClose),
    open: raw.dailyBar?.o ?? 0,
    high: raw.dailyBar?.h ?? 0,
    low: raw.dailyBar?.l ?? 0,
    previousClose,
    volume: raw.dailyBar?.v ?? 0,
    latestTradingDay: (raw.dailyBar?.t ?? raw.latestTrade?.t ?? "").slice(0, 10),
  };
};

/** Map Alpaca daily bars to the shared `ChartPoint` shape, oldest first. */
export const toChartPointsFromBars = (
  bars: ReadonlyArray<Schema.Schema.Type<typeof BarRaw>>,
): ChartPoint[] =>
  bars
    .map((b) => ({
      date: b.t.slice(0, 10),
      open: b.o,
      high: b.h,
      low: b.l,
      close: b.c,
      volume: b.v,
      timestamp: new Date(b.t).getTime(),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

/** Map an Alpaca option-chain snapshot into a shared `OptionContract`. */
export const toOptionContract = (
  contractSymbol: string,
  underlyingPrice: number,
  parsed: { expiration: number; type: "call" | "put"; strike: number },
  raw: Schema.Schema.Type<typeof OptionSnapshotRaw>,
): OptionContract => {
  const lastPrice = raw.latestTrade?.p ?? raw.dailyBar?.c ?? 0;
  const previousClose = raw.prevDailyBar?.c ?? lastPrice;
  const change = lastPrice - previousClose;
  const inTheMoney = parsed.type === "call"
    ? underlyingPrice > 0 && parsed.strike < underlyingPrice
    : underlyingPrice > 0 && parsed.strike > underlyingPrice;

  return {
    contractSymbol,
    strike: parsed.strike,
    lastPrice,
    change,
    percentChange: previousClose === 0 ? 0 : (change / previousClose) * 100,
    volume: raw.dailyBar?.v ?? 0,
    // Open interest is not carried by the snapshot endpoints.
    openInterest: 0,
    bid: raw.latestQuote?.bp ?? 0,
    ask: raw.latestQuote?.ap ?? 0,
    // Implied volatility is only populated on the paid OPRA feed.
    impliedVolatility: raw.impliedVolatility ?? 0,
    inTheMoney,
    expiration: parsed.expiration,
    lastTradeDate: raw.latestTrade ? new Date(raw.latestTrade.t).getTime() : 0,
    currency: "USD",
    contractSize: "REGULAR",
  };
};

/** Build an `OptionsChain` from a `symbol -> snapshot` map + parsed strikes. */
export const toOptionsChain = (
  underlying: string,
  underlyingPrice: number,
  expiration: number,
  snapshots: Record<string, Schema.Schema.Type<typeof OptionSnapshotRaw>>,
): OptionsChain => {
  const calls: OptionContract[] = [];
  const puts: OptionContract[] = [];

  for (const [contractSymbol, raw] of Object.entries(snapshots)) {
    const parsed = parseOccSymbol(contractSymbol);
    if (!parsed || parsed.expiration !== expiration) continue;
    const contract = toOptionContract(contractSymbol, underlyingPrice, parsed, raw);
    (parsed.type === "call" ? calls : puts).push(contract);
  }

  calls.sort((a, b) => a.strike - b.strike);
  puts.sort((a, b) => a.strike - b.strike);

  return {
    ticker: underlying.toUpperCase(),
    expiration,
    expirationDate: new Date(expiration * 1000).toISOString().slice(0, 10),
    underlyingPrice,
    calls,
    puts,
  };
};

/** Map an Alpaca latest forex rate to the shared `ForexQuote` shape. */
export const toForexQuote = (
  pair: ForexPairType,
  raw: Schema.Schema.Type<typeof ForexRateRaw>,
): ForexQuote => ({
  from: pair.from,
  to: pair.to,
  fromName: pair.from,
  toName: pair.to,
  rate: raw.mp,
  bid: raw.bp,
  ask: raw.ap,
  lastRefreshed: raw.t,
  timeZone: "UTC",
});

/**
 * Map Alpaca historical forex rates to `ForexChartPoint[]`.
 *
 * The historical-rates endpoint only carries bid/mid/ask (no OHLC), so the
 * mid price is used for every price field; the chart plots `close`.
 */
export const toForexChartPoints = (
  raw: ReadonlyArray<Schema.Schema.Type<typeof ForexRateRaw>>,
): ForexChartPoint[] =>
  raw
    .map((p) => ({
      date: p.t.slice(0, 10),
      open: p.mp,
      high: p.mp,
      low: p.mp,
      close: p.mp,
      timestamp: new Date(p.t).getTime(),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

/** Map fixed-income latest prices keyed by ISIN into clean quotes. */
export const toFixedIncomeQuotes = (
  raw: Schema.Schema.Type<typeof FixedIncomePricesRaw>,
): FixedIncomeQuote[] =>
  Object.entries(raw.prices).map(([isin, p]) => ({
    isin,
    price: p.p,
    asOf: p.t,
    yieldToMaturity: p.ytm,
    yieldToWorst: p.ytw,
  }));

// ── Request plumbing ──

interface AlpacaCredentials {
  readonly key: string;
  readonly secret: string;
}

const getAlpacaCredentials = Effect.gen(function* () {
  const config = yield* ConfigService;
  const key = config.ALPACA_API_KEY;
  const secret = config.ALPACA_API_SECRET;
  if (Option.isNone(key) || Option.isNone(secret)) {
    return yield* new ConfigError({
      message: "Missing Alpaca credentials (set ALPACA_API_KEY and ALPACA_API_SECRET).",
    });
  }
  return { key: key.value, secret: secret.value } satisfies AlpacaCredentials;
});

const authHeaders = (creds: AlpacaCredentials): HeadersInit => ({
  "APCA-API-KEY-ID": creds.key,
  "APCA-API-SECRET-KEY": creds.secret,
  "accept": "application/json",
});

/** Pull the human-readable detail out of an Alpaca error body. */
const errorDetail = (body: string): string => {
  const trimmed = body.trim();
  try {
    const parsed = JSON.parse(trimmed) as { message?: unknown };
    if (typeof parsed?.message === "string") return parsed.message;
  } catch {
    // Not JSON — fall through to the raw body.
  }
  return trimmed.length > 0 ? trimmed.slice(0, 300) : "no response body";
};

/**
 * GET an Alpaca endpoint. Unlike `FetchService.fetchJson`, this checks the HTTP
 * status so an entitlement/permission failure (403) or bad request (400) is
 * reported with Alpaca's own message instead of a confusing schema error.
 */
const alpacaGet = (
  fs: FetchServicePort,
  creds: AlpacaCredentials,
  path: string,
  params?: URLSearchParams,
): Effect.Effect<unknown, ProgramError> =>
  Effect.gen(function* () {
    const resp = yield* fs.fetch(`${ALPACA_DATA_BASE}${path}`, params, { headers: authHeaders(creds) });
    if (!resp.ok) {
      const body = yield* Effect.tryPromise({
        try: () => resp.text(),
        catch: () => new HTTPError({ message: `Alpaca request failed (${resp.status})` }),
      });
      return yield* new HTTPError({
        message: `Alpaca (${resp.status}) ${errorDetail(body)}`,
      });
    }
    return yield* Effect.tryPromise({
      try: () => resp.json(),
      catch: () => new LocalProcessingError({ message: "Failed to parse Alpaca response." }),
    });
  });

const decode = <A, I>(schema: Schema.Schema<A, I>, raw: unknown, what: string): Effect.Effect<A, HTTPError> =>
  Schema.decodeUnknown(schema)(raw).pipe(
    Effect.catchTag("ParseError", (e) =>
      Effect.fail(new HTTPError({ message: `Invalid Alpaca ${what} response shape: ${e.message}` })),
    ),
  );

/**
 * Walk every page of a paginated Alpaca endpoint, calling `fetchPage` with the
 * previous page's token. The callback owns the accumulation; it returns the
 * next page token (or null/undefined to stop). Bounded by {@link MAX_PAGES}.
 */
const forEachPage = (
  fetchPage: (pageToken?: string) => Effect.Effect<string | null | undefined, ProgramError>,
): Effect.Effect<void, ProgramError> =>
  Effect.gen(function* () {
    let token: string | undefined = undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const nextPageToken: string | null | undefined = yield* fetchPage(token);
      if (!nextPageToken) break;
      token = nextPageToken;
    }
  });

// ── Service port ──

export interface AlpacaServicePort {
  /** Latest stock snapshot, shaped as a `SpotQuote`. */
  readonly getStockSpot: (symbol: StockSymbolType) => Effect.Effect<SpotQuote, ProgramError>;
  /** Daily-stock-bar history (trailing year), shaped as `ChartPoint[]`. */
  readonly getStockChart: (symbol: StockSymbolType) => Effect.Effect<ChartPoint[], ProgramError>;
  /** Distinct expiration dates (Unix seconds) available for an underlying. */
  readonly getOptionExpirations: (underlying: string) => Effect.Effect<number[], ProgramError>;
  /** Option chain for one expiration of an underlying. */
  readonly getOptionChain: (symbol: OptionSymbolType, expiration: number) => Effect.Effect<OptionsChain, ProgramError>;
  /** Latest forex rate for a pair. */
  readonly getForexSpot: (pair: ForexPairType) => Effect.Effect<ForexQuote, ProgramError>;
  /** Daily forex rate history (trailing year), shaped as `ForexChartPoint[]`. */
  readonly getForexDaily: (pair: ForexPairType) => Effect.Effect<ForexChartPoint[], ProgramError>;
  /** Latest fixed-income prices/yields for a set of ISINs. */
  readonly getFixedIncomeLatestPrices: (isins: readonly string[]) => Effect.Effect<FixedIncomeQuote[], ProgramError>;
}

export class AlpacaService extends Context.Tag("hyperfin.services.Alpaca")<
  AlpacaService,
  AlpacaServicePort
>() {}

// ── Date helpers ──

const trailingYearStartIso = (now: Date = new Date()): string => {
  const start = new Date(now.getTime());
  start.setUTCFullYear(start.getUTCFullYear() - 1);
  return start.toISOString().slice(0, 10);
};

const todayIso = (now: Date = new Date()): string => now.toISOString().slice(0, 10);

// ── Live implementation ──

export const AlpacaServiceLive = Layer.effect(
  AlpacaService,
  Effect.gen(function* () {
    const fs = yield* FetchService;
    const creds = yield* getAlpacaCredentials;

    return {
      getStockSpot: (symbol: StockSymbolType) =>
        Effect.gen(function* () {
          const ticker = symbol.id.toUpperCase();
          const params = new URLSearchParams({ feed: "iex" });
          const raw = yield* alpacaGet(fs, creds, `/v2/stocks/${ticker}/snapshot`, params);
          const validated = yield* decode(StockSnapshotRaw, raw, "stock snapshot");
          return toSpotQuoteFromSnapshot(ticker, validated);
        }),

      getStockChart: (symbol: StockSymbolType) =>
        Effect.gen(function* () {
          const ticker = symbol.id.toUpperCase();
          const bars: Schema.Schema.Type<typeof BarRaw>[] = [];
          yield* forEachPage((pageToken) =>
            Effect.gen(function* () {
              const params = new URLSearchParams({
                timeframe: "1Day",
                start: trailingYearStartIso(),
                end: todayIso(),
                adjustment: "all",
                feed: "iex",
                limit: "1000",
                sort: "asc",
              });
              if (pageToken) params.set("page_token", pageToken);
              const raw = yield* alpacaGet(fs, creds, `/v2/stocks/${ticker}/bars`, params);
              const validated = yield* decode(StockBarsRaw, raw, "stock bars");
              if (validated.bars) bars.push(...validated.bars);
              return validated.next_page_token;
            }),
          );
          return toChartPointsFromBars(bars);
        }),

      getOptionExpirations: (underlying: string) =>
        Effect.gen(function* () {
          const ticker = underlying.toUpperCase();
          const expirations = new Set<number>();
          yield* forEachPage((pageToken) =>
            Effect.gen(function* () {
              const params = new URLSearchParams({ feed: "indicative", limit: "1000" });
              if (pageToken) params.set("page_token", pageToken);
              const raw = yield* alpacaGet(fs, creds, `/v1beta1/options/snapshots/${ticker}`, params);
              const validated = yield* decode(OptionChainRaw, raw, "option chain");
              for (const contractSymbol of Object.keys(validated.snapshots)) {
                const parsed = parseOccSymbol(contractSymbol);
                if (parsed) expirations.add(parsed.expiration);
              }
              return validated.next_page_token;
            }),
          );
          return [...expirations].sort((a, b) => a - b);
        }),

      getOptionChain: (symbol: OptionSymbolType, expiration: number) =>
        Effect.gen(function* () {
          const ticker = symbol.id.toUpperCase();
          const expirationDate = new Date(expiration * 1000).toISOString().slice(0, 10);

          // Underlying price drives ITM/OTM and the header.
          const snapshotRaw = yield* alpacaGet(
            fs,
            creds,
            `/v2/stocks/${ticker}/snapshot`,
            new URLSearchParams({ feed: "iex" }),
          );
          const snapshot = yield* decode(StockSnapshotRaw, snapshotRaw, "stock snapshot");
          const underlyingPrice = toSpotQuoteFromSnapshot(ticker, snapshot).price;

          const merged: Record<string, Schema.Schema.Type<typeof OptionSnapshotRaw>> = {};
          yield* forEachPage((pageToken) =>
            Effect.gen(function* () {
              const params = new URLSearchParams({
                feed: "indicative",
                expiration_date: expirationDate,
                limit: "1000",
              });
              if (pageToken) params.set("page_token", pageToken);
              const raw = yield* alpacaGet(fs, creds, `/v1beta1/options/snapshots/${ticker}`, params);
              const validated = yield* decode(OptionChainRaw, raw, "option chain");
              Object.assign(merged, validated.snapshots);
              return validated.next_page_token;
            }),
          );

          return toOptionsChain(ticker, underlyingPrice, expiration, merged);
        }),

      getForexSpot: (pair: ForexPairType) =>
        Effect.gen(function* () {
          const symbol = `${pair.from}/${pair.to}`;
          const params = new URLSearchParams({ currency_pairs: symbol });
          const raw = yield* alpacaGet(fs, creds, "/v1beta1/forex/latest/rates", params);
          const validated = yield* decode(ForexLatestRatesRaw, raw, "forex rates");
          const rate = validated.rates[symbol] ?? Object.values(validated.rates)[0];
          if (!rate) {
            return yield* new HTTPError({ message: `No Alpaca forex rate returned for ${symbol}.` });
          }
          return toForexQuote(pair, rate);
        }),

      getForexDaily: (pair: ForexPairType) =>
        Effect.gen(function* () {
          const symbol = `${pair.from}/${pair.to}`;
          const points: Schema.Schema.Type<typeof ForexRateRaw>[] = [];
          yield* forEachPage((pageToken) =>
            Effect.gen(function* () {
              const params = new URLSearchParams({
                currency_pairs: symbol,
                timeframe: "1Day",
                start: trailingYearStartIso(),
                end: todayIso(),
              });
              if (pageToken) params.set("page_token", pageToken);
              const raw = yield* alpacaGet(fs, creds, "/v1beta1/forex/rates", params);
              const validated = yield* decode(ForexHistoricalRatesRaw, raw, "forex history");
              const series = validated.rates[symbol] ?? Object.values(validated.rates)[0] ?? [];
              points.push(...series);
              return validated.next_page_token;
            }),
          );
          return toForexChartPoints(points);
        }),

      getFixedIncomeLatestPrices: (isins: readonly string[]) =>
        Effect.gen(function* () {
          if (isins.length === 0) return [];
          const params = new URLSearchParams({ isins: isins.join(",") });
          const raw = yield* alpacaGet(fs, creds, "/v1beta1/fixed_income/latest/prices", params);
          const validated = yield* decode(FixedIncomePricesRaw, raw, "fixed income prices");
          return toFixedIncomeQuotes(validated);
        }),
    } satisfies AlpacaServicePort;
  }),
).pipe(Layer.provide(ApplicationLayerLive));
