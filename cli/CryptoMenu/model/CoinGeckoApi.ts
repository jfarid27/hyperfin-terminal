import { lensProp, lensPath, view, defaultTo, pipe as pipeR, map } from "ramda";
import { DataSourceType } from "./../../types.ts";
import { SpotPoint, ChartData, ChartPoint, CryptoSymbolType } from "./../types.ts";
import { Effect, Context, Layer } from "effect";
import { FetchService } from "cli/services/FetchService.ts";
import { ConfigError, HTTPError, LocalProcessingError } from "cli/errors/index.ts";

type CoinGeckoChartResponse = {
    prices: number[][];
}

/**
 * Converts a CoinGecko chart response to chart points.
 */
const convertCoinGeckoChartResponseToChartData = pipeR(
  view(lensProp<CoinGeckoChartResponse, "prices">("prices")),
  defaultTo([]),
  map((p): ChartPoint => ({
    timestamp: p[0],
    price: p[1],
  }))
);

/**
 * Gets the price from the CoinGecko API response.
 */
const getPrice = (symbol: CryptoSymbolType) => pipeR(
    view(lensPath(["data", symbol.id, "usd"])),
    defaultTo(0)
);

export interface CoinGeckoModelPort {
  spot: {
    get: (symbol: CryptoSymbolType, apiKey: string) => Effect.Effect<SpotPoint, ConfigError | HTTPError | LocalProcessingError>;
  };
  chart: {
    get: (symbol: CryptoSymbolType, apiKey: string) => Effect.Effect<ChartData, ConfigError | HTTPError | LocalProcessingError>;
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
        get: (symbol: CryptoSymbolType, apiKey: string) =>
          Effect.gen(function* () {
            if (symbol._type !== DataSourceType.CoinGecko) {
              return yield* new ConfigError({ message: "Invalid data source type for CoinGecko." });
            }
            if (!apiKey) {
              return yield* new ConfigError({ message: "Missing CoinGecko API Key." });
            }
            const COINGECKO_PRICE_API = "https://pro-api.coingecko.com/api/v3/simple/price";
            const params = new URLSearchParams({
              vs_currencies: "usd",
              ids: symbol.id,
            });
            const data = yield* fs.fetchJson(COINGECKO_PRICE_API, params, {
              headers: {
                "x_cg_pro_api_key": apiKey,
              },
            });
            const price = getPrice(symbol)(data);
            return { symbol, price };
          }),
      },
      chart: {
        get: (symbol: CryptoSymbolType, apiKey: string) =>
          Effect.gen(function* () {
            if (symbol._type !== DataSourceType.CoinGecko) {
              return yield* new ConfigError({ message: "Invalid data source type for CoinGecko." });
            }
            if (!apiKey) {
              return yield* new ConfigError({ message: "Missing CoinGecko API Key." });
            }
            const COINGECKO_CHART_API = "https://pro-api.coingecko.com/api/v3/coins/{id}/market_chart";
            const params = new URLSearchParams({
              vs_currencies: "usd",
              days: "14",
              interval: "daily",
              id: symbol.id,
            });
            const res = yield* fs.fetchJson(COINGECKO_CHART_API, params, {
              headers: {
                "x_cg_pro_api_key": apiKey,
              },
            });
            const prices = convertCoinGeckoChartResponseToChartData(res);
            return { symbol, prices };
          }),
      },
    } satisfies CoinGeckoModelPort;
  }),
);
