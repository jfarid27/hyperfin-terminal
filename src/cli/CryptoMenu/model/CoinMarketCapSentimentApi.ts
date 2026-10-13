/**
 * CoinMarketCap sentiment model — market-wide mood gauges for the crypto menu.
 *
 * Endpoints used:
 *   GET /v3/fear-and-greed/latest        — Fear & Greed index (0-100)
 *   GET /v1/altcoin-season-index/latest  — Altcoin Season index (0-100)
 *
 * Both are keyed endpoints (a request without a key is a 401 `1002`), and
 * neither depends on a symbol or address — they describe the whole market, so
 * the crypto menu's `fg` and `altcoin` actions take no arguments.
 */

import { Effect, Context, Layer, Schema } from "effect";
import { FetchService } from "src/cli/services/FetchService.ts";
import { ConfigError, HTTPError, LocalProcessingError } from "src/cli/errors/index.ts";

const CMC_API_BASE = "https://pro-api.coinmarketcap.com";
const CMC_KEY_HEADER = "X-CMC_PRO_API_KEY";

/** CoinMarketCap's Fear & Greed reading. */
export interface FearGreedIndex {
  /** 0-100, where lower is fear and higher is greed. */
  value: number;
  /** CoinMarketCap's own label for the band, e.g. `Neutral`. */
  classification: string;
  /** When the reading was taken (ISO-8601), as reported by the source. */
  updatedAt?: string;
}

/** CoinMarketCap's Altcoin Season reading. */
export interface AltcoinSeasonIndex {
  /** 0-100 index of altcoin performance against Bitcoin. */
  index: number;
  /** Combined altcoin market capitalisation in USD. */
  marketCapUsd?: number;
  /** When the snapshot was taken (ISO-8601), as reported by the source. */
  snapshotTime?: string;
  /** Highest index value over the trailing year. */
  yearlyHigh?: number;
  /** Date of {@link yearlyHigh} (`YYYY-MM-DD`). */
  yearlyHighDate?: string;
  /** Lowest index value over the trailing year. */
  yearlyLow?: number;
  /** Date of {@link yearlyLow} (`YYYY-MM-DD`). */
  yearlyLowDate?: string;
}

// ── Raw response shapes ──

const FearGreedRaw = Schema.Struct({
  value: Schema.optional(Schema.Number),
  update_time: Schema.optional(Schema.String),
  value_classification: Schema.optional(Schema.String),
});

const FearGreedEnvelope = Schema.Struct({ data: Schema.optional(FearGreedRaw) });

const AltcoinSeasonRaw = Schema.Struct({
  altcoin_index: Schema.optional(Schema.Number),
  altcoin_marketcap: Schema.optional(Schema.Number),
  snapshot_time: Schema.optional(Schema.String),
  yearly_high: Schema.optional(Schema.Number),
  yearly_high_date: Schema.optional(Schema.String),
  yearly_low: Schema.optional(Schema.Number),
  yearly_low_date: Schema.optional(Schema.String),
});

const AltcoinSeasonEnvelope = Schema.Struct({ data: Schema.optional(AltcoinSeasonRaw) });

// ── Extractors ──

/**
 * Build the Fear & Greed reading, or `null` when the payload carries no value
 * (the endpoint is latest-only, so a missing value means no data, not a gap).
 */
export const toFearGreedIndex = (
  raw: Schema.Schema.Type<typeof FearGreedRaw> | undefined,
): FearGreedIndex | null => {
  if (raw?.value === undefined) return null;
  return {
    value: raw.value,
    classification: raw.value_classification ?? "Unclassified",
    updatedAt: raw.update_time,
  };
};

/** Build the Altcoin Season reading, or `null` when the payload carries no index. */
export const toAltcoinSeasonIndex = (
  raw: Schema.Schema.Type<typeof AltcoinSeasonRaw> | undefined,
): AltcoinSeasonIndex | null => {
  if (raw?.altcoin_index === undefined) return null;
  return {
    index: raw.altcoin_index,
    marketCapUsd: raw.altcoin_marketcap,
    snapshotTime: raw.snapshot_time,
    yearlyHigh: raw.yearly_high,
    yearlyHighDate: raw.yearly_high_date,
    yearlyLow: raw.yearly_low,
    yearlyLowDate: raw.yearly_low_date,
  };
};

// ── Decode helpers ──

const decodeFearGreed = (raw: unknown) =>
  Schema.decodeUnknown(FearGreedEnvelope)(raw).pipe(
    Effect.catchTag("ParseError", (e) =>
      Effect.logDebug(`CoinMarketCap fear-and-greed shape changed: ${e.message}`).pipe(
        Effect.andThen(
          Effect.fail(
            new HTTPError({
              message: `Invalid CoinMarketCap fear-and-greed response shape: ${e.message}`,
            }),
          ),
        ),
      ),
    ),
  );

const decodeAltcoinSeason = (raw: unknown) =>
  Schema.decodeUnknown(AltcoinSeasonEnvelope)(raw).pipe(
    Effect.catchTag("ParseError", (e) =>
      Effect.logDebug(`CoinMarketCap altcoin-season shape changed: ${e.message}`).pipe(
        Effect.andThen(
          Effect.fail(
            new HTTPError({
              message: `Invalid CoinMarketCap altcoin-season response shape: ${e.message}`,
            }),
          ),
        ),
      ),
    ),
  );

/** The message shown when the API key is absent. */
export const missingKeyMessage =
  "Missing CoinMarketCap API key. Set CMC_API_KEY in .env, or `keys coinmarketcap <key>`.";

const noDataMessage = "CoinMarketCap returned no reading for this index.";

// ── Service port ──

export interface CoinMarketCapSentimentModelPort {
  fearGreed: {
    get: (
      apiKey?: string,
    ) => Effect.Effect<FearGreedIndex, ConfigError | HTTPError | LocalProcessingError>;
  };
  altcoinSeason: {
    get: (
      apiKey?: string,
    ) => Effect.Effect<AltcoinSeasonIndex, ConfigError | HTTPError | LocalProcessingError>;
  };
}

export class CoinMarketCapSentimentModel extends Context.Tag(
  "hyperfin.crypto.CoinMarketCapSentimentModel",
)<CoinMarketCapSentimentModel, CoinMarketCapSentimentModelPort>() {}

export const CoinMarketCapSentimentModelLive = Layer.effect(
  CoinMarketCapSentimentModel,
  Effect.gen(function* () {
    const fs = yield* FetchService;

    /** GET a CoinMarketCap path with the API key, or fail when it is missing. */
    const getJson = (
      path: string,
      apiKey: string | undefined,
    ): Effect.Effect<
      unknown,
      ConfigError | HTTPError | LocalProcessingError
    > =>
      Effect.gen(function* () {
        if (!apiKey) {
          return yield* new ConfigError({ message: missingKeyMessage });
        }
        return yield* fs.fetchJson(
          `${CMC_API_BASE}${path}`,
          undefined,
          { headers: { [CMC_KEY_HEADER]: apiKey, Accept: "application/json" } },
        );
      });

    return {
      fearGreed: {
        get: (apiKey?: string) =>
          Effect.gen(function* () {
            const data = yield* getJson("/v3/fear-and-greed/latest", apiKey);
            const decoded = yield* decodeFearGreed(data);
            const index = toFearGreedIndex(decoded.data);
            if (!index) {
              return yield* new HTTPError({ message: noDataMessage });
            }
            return index;
          }),
      },
      altcoinSeason: {
        get: (apiKey?: string) =>
          Effect.gen(function* () {
            const data = yield* getJson("/v1/altcoin-season-index/latest", apiKey);
            const decoded = yield* decodeAltcoinSeason(data);
            const index = toAltcoinSeasonIndex(decoded.data);
            if (!index) {
              return yield* new HTTPError({ message: noDataMessage });
            }
            return index;
          }),
      },
    } satisfies CoinMarketCapSentimentModelPort;
  }),
);
