import axios from "axios";
import { prop, lensPath, view, defaultTo, pipe, map } from "ramda";
import { DataSourceType } from "./../../types.ts";
import { SpotPoint, ChartData, ChartPoint, CryptoSymbolType } from "./../types.ts";
import { Effect } from 'effect';


/**
 * Converts a CoinGecko chart response to chart points.
 * 
 * @param response The CoinGecko chart response.
 * @returns The ChartData object.
 */
const convertCoinGeckoChartResponseToChartData = pipe(
  prop("prices"),
  map((p: any[]): ChartPoint => ({
    timestamp: p[0],
    price: p[1],
  }))
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
    
    return Effect.tryPromise(() =>
        axios.get(COINGECKO_PRICE_API, {
            headers: {
                "x_cg_pro_api_key": COINGECKO_API_KEY,
            },
            params: {
                vs_currencies: "usd",
                ids: symbol.id,
            },
        })
    ).pipe(
       (response: any) => {
            const price = pipe(
                view(lensPath([symbol.id, "usd"])),
                defaultTo(0)
            )(response.data);
            return Effect.succeed({ symbol, price });
       }
    );
}


export async function fetchChartCoingecko(symbol: CryptoSymbolType, COINGECKO_API_KEY: string): Promise<ChartData> {
    if (symbol._type !== DataSourceType.CoinGecko) {
        throw new Error("Invalid data source type");
    }
    const COINGECKO_CHART_API = "https://pro-api.coingecko.com/api/v3/coins/{id}/market_chart";
    const response = await axios.get(COINGECKO_CHART_API, {
        headers: {
            "x_cg_pro_api_key": COINGECKO_API_KEY,
        },
        params: {
            vs_currencies: "usd",
            days: "14",
            interval: "daily",
            id: symbol.id,
        },
    });
    
    const chartData: ChartData = {
      symbol,
      prices: convertCoinGeckoChartResponseToChartData(response.data)
    }; 
    return await Promise.resolve(chartData);
}