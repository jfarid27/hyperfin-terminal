import { DataSourceType } from "./../../types.ts";
import { SpotPoint, ChartData, ChartPoint, CryptoSymbolType } from "./../types.ts";
import { Effect, Context, Layer, Schema } from "effect";
import { FetchService } from "cli/services/FetchService.ts";
import { ConfigError, HTTPError, LocalProcessingError } from "cli/errors/index.ts";

// ── Raw response schemas (match CoinGecko's exact JSON shape) ──

const CoinGeckoPriceRaw = Schema.Record({
  key: Schema.String,
  value: Schema.Record({ key: Schema.String, value: Schema.Number }),
});

const CoinGeckoChartRaw = Schema.Struct({
  prices: Schema.Array(Schema.Tuple(Schema.Number, Schema.Number)),
});

// ── Decode helpers ──

const decodePriceResponse = (raw: unknown) =>
  Schema.decodeUnknown(CoinGeckoPriceRaw)(raw).pipe(
    Effect.catchTag("ParseError", (e) =>
      Effect.logDebug(`CoinGecko price response shape changed: ${e.message}`).pipe(
        Effect.andThen(
          Effect.fail(
            new HTTPError({ message: `Invalid CoinGecko price response shape: ${e.message}` }),
          ),
        ),
      ),
    ),
  );

const decodeChartResponse = (raw: unknown) =>
  Schema.decodeUnknown(CoinGeckoChartRaw)(raw).pipe(
    Effect.catchTag("ParseError", (e) =>
      Effect.logDebug(`CoinGecko chart response shape changed: ${e.message}`).pipe(
        Effect.andThen(
          Effect.fail(
            new HTTPError({ message: `Invalid CoinGecko chart response shape: ${e.message}` }),
          ),
        ),
      ),
    ),
  );

// ── Extractors ──

const extractPrice = (symbol: CryptoSymbolType) =>
  (raw: Schema.Schema.Type<typeof CoinGeckoPriceRaw>): number =>
    raw[symbol.id]?.["usd"] ?? 0;

const extractChartData = (raw: Schema.Schema.Type<typeof CoinGeckoChartRaw>): ChartPoint[] =>
  raw.prices.map(([timestamp, price]) => ({ timestamp, price }));

// ── Service port ──

export interface CoinGeckoModelPort {
  spot: {
    get: (symbol: CryptoSymbolType) => Effect.Effect<SpotPoint, ConfigError | HTTPError | LocalProcessingError>;
  };
  chart: {
    get: (symbol: CryptoSymbolType) => Effect.Effect<ChartData, ConfigError | HTTPError | LocalProcessingError>;
  };
}

export class CoinGeckoModel extends Context.Tag("hyperfin.crypto.CoinGeckoModel")<
  CoinGeckoModel,
  CoinGeckoModelPort
>() {}

export const CoinGeckoModelLive = Layer.effect(
  CoinGeckoModel,
  Effect.gen(function* () {
    const fs = yield* FetchService;
    return {
      spot: {
        get: (symbol: CryptoSymbolType) =>
          Effect.gen(function* () {
            if (symbol._type !== DataSourceType.CoinGecko) {
              return yield* new ConfigError({ message: "Invalid data source type for CoinGecko." });
            }
            const COINGECKO_PRICE_API = "https://api.coingecko.com/api/v3/simple/price";
            const params = new URLSearchParams({
              vs_currencies: "usd",
              ids: symbol.id,
            });
            const data = yield* fs.fetchJson(COINGECKO_PRICE_API, params);
            const validated = yield* decodePriceResponse(data);
            const price = extractPrice(symbol)(validated);
            return { symbol, price };
          }),
      },
      chart: {
        get: (symbol: CryptoSymbolType) =>
          Effect.gen(function* () {
            if (symbol._type !== DataSourceType.CoinGecko) {
              return yield* new ConfigError({ message: "Invalid data source type for CoinGecko." });
            }
            const COINGECKO_CHART_API = `https://api.coingecko.com/api/v3/coins/${symbol.id}/market_chart`;
            const params = new URLSearchParams({
              vs_currency: "usd",
              days: "14",
              interval: "daily",
            });
            const res = yield* fs.fetchJson(COINGECKO_CHART_API, params);
            const validated = yield* decodeChartResponse(res);
            const prices = extractChartData(validated);
            return { symbol, prices };
          }),
      },
    } satisfies CoinGeckoModelPort;
  }),
);
