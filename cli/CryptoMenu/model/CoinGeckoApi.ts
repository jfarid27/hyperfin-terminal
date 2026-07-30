import { lensProp, lensPath, view, defaultTo, pipe as pipeR, map } from "ramda";
import { DataSourceType } from "./../../types.ts";
import { SpotPoint, ChartData, ChartPoint, CryptoSymbolType } from "./../types.ts";
import { Effect, pipe } from 'effect';
import { FetchService } from "cli/services/FetchService.ts";
import { HTTPError, LocalProcessingError } from "cli/errors/index.ts";

type CoinGeckoChartResponse = {
    prices: number[][];
}

/**
 * Converts a CoinGecko chart response to chart points.
 * 
 * @param response The CoinGecko chart response.
 * @returns The ChartData object.
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
 * 
 * @param symbol The symbol to get the price for.
 * @returns The price for the specified symbol.
 */
const getPrice = (symbol: CryptoSymbolType) => pipeR(
    view(lensPath(["data", symbol.id, "usd"])),
    defaultTo(0)
);

/**
 * Fetches the current price for a specified symbol from the CoinGecko API.
 * 
 * @param symbol The symbol to fetch the price for.
 * @param COINGECKO_API_KEY The CoinGecko API key.
 * @returns The current price for the specified symbol.
 */
export function fetchSpotCoingecko(symbol: CryptoSymbolType, COINGECKO_API_KEY: string): Effect.Effect<SpotPoint, HTTPError | LocalProcessingError | Error, FetchService> {
    return Effect.gen(function* () {
      if (symbol._type !== DataSourceType.CoinGecko) {
        return yield* Effect.fail(new Error("Invalid data source type"));
      }
      const COINGECKO_PRICE_API = "https://pro-api.coingecko.com/api/v3/simple/price";
      const fs = yield* FetchService;
      const params = new URLSearchParams({
          vs_currencies: "usd",
          ids: symbol.id,
      });
      const data = yield* fs.fetchJson(COINGECKO_PRICE_API, params, {
          headers: {
              "x_cg_pro_api_key": COINGECKO_API_KEY,
          },
      });
      const price = getPrice(symbol)(data);
      return { symbol, price };
    });
}


export function fetchChartCoingecko(symbol: CryptoSymbolType, COINGECKO_API_KEY: string): Effect.Effect<ChartData, HTTPError | LocalProcessingError | Error, FetchService> {
    return Effect.gen(function* () {
      if (symbol._type !== DataSourceType.CoinGecko) {
        return yield* Effect.fail(new Error("Invalid data source type"));
      }
      const COINGECKO_CHART_API = "https://pro-api.coingecko.com/api/v3/coins/{id}/market_chart";
      const fs = yield* FetchService;
      const params = new URLSearchParams({
          vs_currencies: "usd",
          days: "14",
          interval: "daily",
          id: symbol.id,
      });
      const res = yield* fs.fetchJson(COINGECKO_CHART_API, params, {
          headers: {
              "x_cg_pro_api_key": COINGECKO_API_KEY,
          },
      });
      const prices = convertCoinGeckoChartResponseToChartData(res);
      return { symbol, prices };
    });
}
