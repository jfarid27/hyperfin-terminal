/**
 * CoinMarketCap DEX model — prices on-chain tokens by chain + address.
 *
 * The coin-registry endpoints (`/coins/{id}/market_chart`, `/simple/price`)
 * cannot serve these tokens at all: a token only traded on a DEX has no
 * CoinGecko/CoinMarketCap coin id, so there is no id to pass. The DEX API is
 * keyed by `platform` + `address` instead, which is exactly the identity an
 * on-chain token has.
 *
 * Endpoints used:
 *   GET /v1/dex/token        — token detail: name, symbol, price, 24h stats
 *   GET /v1/k-line/candles   — OHLCV candles, `[open, high, low, close, volume, ts, traders]`
 *
 * Gotchas this file encodes (each one cost a probe to find):
 *  - **Do not send `from`/`to`.** They are a paid capability: a plan without
 *    DEX historical access answers 403 `1013`, and `to` alone answers a
 *    misleading 500. Without them the endpoint returns the whole series, and
 *    `limit` is ignored at daily resolution.
 *  - **An unknown or malformed address is not an error**: CoinMarketCap
 *    answers 200 with `data: {}` (or `data: []` for candles). A missing token
 *    therefore has to be detected from the payload, not the status code.
 *  - **The auth header is `X-CMC_PRO_API_KEY`** (hyphens). Underscore header
 *    names are silently dropped by some proxies.
 *  - Candle timestamps are **Unix seconds**; everything downstream (Plot,
 *    `new Date(ms)`) expects milliseconds.
 */

import { Effect, Context, Layer, Schema } from "effect";
import { FetchService } from "src/cli/services/FetchService.ts";
import { ConfigError, HTTPError, LocalProcessingError } from "src/cli/errors/index.ts";
import { DataSourceType } from "../../types.ts";
import type { ChartData, ChartPoint, CryptoSymbolType } from "src/services/CryptoService/types.ts";
import {
  type DexInterval,
  type DexSpotPoint,
  type DexTokenType,
  DEFAULT_DEX_INTERVAL,
} from "../DexMenu/types.ts";

const CMC_API_BASE = "https://pro-api.coinmarketcap.com";
const CMC_KEY_HEADER = "X-CMC_PRO_API_KEY";

/** Candle rows returned per request. Ignored at daily resolution. */
const DEFAULT_CANDLE_LIMIT = 400;

/** Per-period activity CoinMarketCap reports for a token (`sts`). */
const DexTokenStatRaw = Schema.Struct({
  /** Period: `5m`, `1h`, `4h`, `24h`. */
  tp: Schema.String,
  /** Volume in USD, as a string. */
  vu: Schema.optional(Schema.String),
  /** Price change over the period, as a ratio (0.1472 == +14.72%). */
  pc: Schema.optional(Schema.Number),
});

/**
 * A DEX token detail payload.
 *
 * Every field is optional on purpose: CoinMarketCap answers an unknown token
 * with `data: {}`, so requiring fields here would surface a not-found token as
 * a schema failure. Absence is decided in {@link toDexSpot} instead, while a
 * genuinely different payload shape still fails the decode.
 */
const DexTokenRaw = Schema.Struct({
  n: Schema.optional(Schema.String),
  sym: Schema.optional(Schema.String),
  addr: Schema.optional(Schema.String),
  plt: Schema.optional(Schema.String),
  dec: Schema.optional(Schema.Number),
  mcap: Schema.optional(Schema.String),
  liqUsd: Schema.optional(Schema.String),
  p: Schema.optional(Schema.String),
  ph24h: Schema.optional(Schema.String),
  pl24h: Schema.optional(Schema.String),
  sts: Schema.optional(Schema.Array(DexTokenStatRaw)),
});

const DexTokenEnvelope = Schema.Struct({ data: Schema.optional(DexTokenRaw) });

/** A candle row: numbers and nulls, positionally `[o,h,l,c,v,ts,traders]`. */
const CandleRowRaw = Schema.Array(Schema.Union(Schema.Number, Schema.Null));

const KLineEnvelope = Schema.Struct({ data: Schema.optional(Schema.Array(CandleRowRaw)) });

/** Indexes into a candle row. */
const CANDLE_CLOSE = 3;
const CANDLE_TIMESTAMP = 5;

/**
 * Any timestamp above this is already in milliseconds.
 *
 * CoinMarketCap's documentation describes K-line timestamps as seconds, but the
 * `/v1/k-line/candles` rows come back in **milliseconds** (13 digits). Trusting
 * the docs multiplies every date by 1000 and renders the chart at year 58751.
 * Real values sit far from the pivot either way: seconds for 2026 are ~1.8e9,
 * milliseconds ~1.8e12.
 */
const MILLIS_PIVOT = 1e11;

/** Normalise a candle timestamp to milliseconds. */
export const toEpochMillis = (value: number): number =>
  value >= MILLIS_PIVOT ? value : value * 1000;

/** The period CoinMarketCap reports day statistics under. */
const H24 = "24h";

/** Parse a numeric string, `undefined` when absent or not a finite number. */
const toNumber = (raw: string | undefined): number | undefined => {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Build the spot point from a token detail payload.
 *
 * Returns `null` when the payload carries no price — which is how
 * CoinMarketCap reports a token it does not track, rather than with an error.
 */
export const toDexSpot = (
  raw: Schema.Schema.Type<typeof DexTokenRaw> | undefined,
  token: DexTokenType,
): DexSpotPoint | null => {
  const price = toNumber(raw?.p);
  if (price === undefined) return null;

  const dayStats = raw?.sts?.find((stat) => stat.tp === H24);
  // `pc` is a ratio (0.1472); the menu reports percentages.
  const changeRatio = dayStats?.pc;

  return {
    token: {
      ...token,
      name: raw?.n ?? token.name,
      symbol: raw?.sym ?? token.symbol,
    },
    price,
    change24hPct: changeRatio === undefined ? undefined : changeRatio * 100,
    volume24hUsd: toNumber(dayStats?.vu),
    marketCapUsd: toNumber(raw?.mcap),
    liquidityUsd: toNumber(raw?.liqUsd),
    high24h: toNumber(raw?.ph24h),
    low24h: toNumber(raw?.pl24h),
    decimals: raw?.dec,
  };
};

/**
 * Convert candle rows into a price series, oldest first.
 *
 * CoinMarketCap returns candles newest first and stamps them in seconds; the
 * charting layer and the indicator math both read milliseconds oldest-first.
 *
 * A row whose close or timestamp is `null` is dropped rather than coerced:
 * `Number(null)` is `0`, which would plant a fake zero-price point and flatten
 * the chart's y-axis.
 */
export const toChartPoints = (
  rows: readonly (readonly (number | null)[])[],
): ChartPoint[] =>
  rows
    .filter((row) => row.length > CANDLE_TIMESTAMP)
    .map((row) => ({
      timestamp: row[CANDLE_TIMESTAMP] as number | null,
      price: row[CANDLE_CLOSE] as number | null,
    }))
    .filter(
      (point): point is ChartPoint =>
        typeof point.timestamp === "number" &&
        typeof point.price === "number" &&
        Number.isFinite(point.timestamp) &&
        Number.isFinite(point.price),
    )
    .map((point) => ({
      // Normalised to milliseconds: Plot and `new Date()` both read ms.
      timestamp: toEpochMillis(point.timestamp),
      price: point.price,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

/** The chart series a DEX token's candles represent, tagged with its source. */
export const toChartData = (
  points: ChartPoint[],
  token: DexTokenType,
): ChartData => {
  const symbol: CryptoSymbolType = {
    name: token.symbol ?? token.name ?? token.address,
    id: token.address,
    _type: DataSourceType.CoinMarketCap,
  };
  return { symbol, prices: points };
};

// ── Decode helpers ──

const decodeToken = (raw: unknown) =>
  Schema.decodeUnknown(DexTokenEnvelope)(raw).pipe(
    Effect.catchTag("ParseError", (e) =>
      Effect.logDebug(`CoinMarketCap DEX token response shape changed: ${e.message}`).pipe(
        Effect.andThen(
          Effect.fail(
            new HTTPError({ message: `Invalid CoinMarketCap token response shape: ${e.message}` }),
          ),
        ),
      ),
    ),
  );

const decodeCandles = (raw: unknown) =>
  Schema.decodeUnknown(KLineEnvelope)(raw).pipe(
    Effect.catchTag("ParseError", (e) =>
      Effect.logDebug(`CoinMarketCap K-line response shape changed: ${e.message}`).pipe(
        Effect.andThen(
          Effect.fail(
            new HTTPError({ message: `Invalid CoinMarketCap candle response shape: ${e.message}` }),
          ),
        ),
      ),
    ),
  );

/** The message shown when a chain + address pair has no DEX token behind it. */
export const tokenNotFoundMessage = (token: DexTokenType): string =>
  `No DEX token at ${token.address} on ${token.platform}. ` +
  `Check the address, and that the token is traded on a DEX.`;

/** The message shown when the API key is absent. */
export const missingKeyMessage =
  "Missing CoinMarketCap API key. Set CMC_API_KEY in .env, or `keys coinmarketcap <key>`.";

// ── Service port ──

export interface CoinMarketCapDexModelPort {
  token: {
    get: (
      token: DexTokenType,
      apiKey?: string,
    ) => Effect.Effect<DexSpotPoint, ConfigError | HTTPError | LocalProcessingError>;
  };
  candles: {
    get: (
      token: DexTokenType,
      apiKey?: string,
      interval?: DexInterval,
      limit?: number,
    ) => Effect.Effect<ChartData, ConfigError | HTTPError | LocalProcessingError>;
  };
}

export class CoinMarketCapDexModel extends Context.Tag(
  "hyperfin.crypto.CoinMarketCapDexModel",
)<CoinMarketCapDexModel, CoinMarketCapDexModelPort>() {}

export const CoinMarketCapDexModelLive = Layer.effect(
  CoinMarketCapDexModel,
  Effect.gen(function* () {
    const fs = yield* FetchService;
    return {
      token: {
        get: (token: DexTokenType, apiKey?: string) =>
          Effect.gen(function* () {
            if (!apiKey) {
              return yield* new ConfigError({ message: missingKeyMessage });
            }
            const data = yield* fs.fetchJson(
              `${CMC_API_BASE}/v1/dex/token`,
              new URLSearchParams({ platform: token.platform, address: token.address }),
              { headers: { [CMC_KEY_HEADER]: apiKey, Accept: "application/json" } },
            );
            const decoded = yield* decodeToken(data);
            const spot = toDexSpot(decoded.data, token);
            if (!spot) {
              return yield* new HTTPError({ message: tokenNotFoundMessage(token) });
            }
            return spot;
          }),
      },
      candles: {
        get: (token: DexTokenType, apiKey?: string, interval = DEFAULT_DEX_INTERVAL, limit = DEFAULT_CANDLE_LIMIT) =>
          Effect.gen(function* () {
            if (!apiKey) {
              return yield* new ConfigError({ message: missingKeyMessage });
            }
            // No `from`/`to`: on a plan without DEX history access they are a
            // 403, and the endpoint already returns the full series without them.
            const data = yield* fs.fetchJson(
              `${CMC_API_BASE}/v1/k-line/candles`,
              new URLSearchParams({
                platform: token.platform,
                address: token.address,
                interval,
                unit: "usd",
                limit: String(limit),
              }),
              { headers: { [CMC_KEY_HEADER]: apiKey, Accept: "application/json" } },
            );
            const decoded = yield* decodeCandles(data);
            const points = toChartPoints(decoded.data ?? []);
            if (points.length === 0) {
              return yield* new HTTPError({ message: tokenNotFoundMessage(token) });
            }
            return toChartData(points, token);
          }),
      },
    } satisfies CoinMarketCapDexModelPort;
  }),
);
