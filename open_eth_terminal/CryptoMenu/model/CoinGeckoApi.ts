import axios from "axios";
import { lensProp, lensPath, view, defaultTo, pipe as pipeR, map } from "ramda";
import { DataSourceType } from "./../../types.ts";
import { SpotPoint, ChartData, ChartPoint, CryptoSymbolType } from "./../types.ts";
import { Effect, pipe } from 'effect';

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
export function fetchSpotCoingecko(symbol: CryptoSymbolType, COINGECKO_API_KEY: string): Effect.Effect<SpotPoint, Error> {
    if (symbol._type !== DataSourceType.CoinGecko) {
        return Effect.fail(new Error("Invalid data source type"));
    }
    const COINGECKO_PRICE_API = "https://pro-api.coingecko.com/api/v3/simple/price";
    
    return pipe(
        Effect.tryPromise(() =>
            axios.get(COINGECKO_PRICE_API, {
                headers: {
                    "x_cg_pro_api_key": COINGECKO_API_KEY,
                },
                params: {
                    vs_currencies: "usd",
                    ids: symbol.id,
                },
            })
        ),
        Effect.map(getPrice(symbol)),
        Effect.map((price) => ({ symbol, price })),
    );
}


export function fetchChartCoingecko(symbol: CryptoSymbolType, COINGECKO_API_KEY: string): Effect.Effect<ChartData, Error> {
    if (symbol._type !== DataSourceType.CoinGecko) {
        return Effect.fail(new Error("Invalid data source type"));
    }
    const COINGECKO_CHART_API = "https://pro-api.coingecko.com/api/v3/coins/{id}/market_chart";
    return pipe(
        Effect.tryPromise(() => axios.get(COINGECKO_CHART_API, {
            headers: {
                "x_cg_pro_api_key": COINGECKO_API_KEY,
            },
            params: {
                vs_currencies: "usd",
                days: "14",
                interval: "daily",
                id: symbol.id,
            },
        })),
        Effect.map((res) => {
            const prices = convertCoinGeckoChartResponseToChartData(res.data);
            return { symbol, prices };
        })
    );
}