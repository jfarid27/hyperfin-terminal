import { CryptoSymbolType, ChartData, SpotPoint } from "../types.ts";
import { DataSourceType } from "../../types.ts";
import { fetchSpotCoingecko, fetchChartCoingecko } from "./CoinGeckoApi.ts";
import { fetchChartFreeCryptoAPI } from "./FreeCryptoAPIApi.ts";
import { Effect } from 'effect/Effect';
import { fail } from 'effect/Effect';
import { FetchService } from "cli/services/FetchService.ts";
import { HTTPError } from "cli/errors/index.ts";

/**
 * Fetches the current price for a specified symbol.
 * @param symbol Specified symbol to fetch current price for.
 * @param API_KEY API key to use for the request.
 */
export function spot(symbol: CryptoSymbolType, API_KEY: string): Effect<SpotPoint, HTTPError | Error, FetchService> {
    switch (symbol._type) {
        case DataSourceType.CoinGecko:
            return fetchSpotCoingecko(symbol, API_KEY);
        default:
            return fail(new Error(`Unsupported symbol type: ${symbol._type}`));
    }
}

/**
 * Fetches the chart for a specified symbol.
 * @param symbol Specified symbol to fetch chart for.
 * @param API_KEY API key to use for the request.
 */
export function chart(symbol: CryptoSymbolType, API_KEY: string): Effect<ChartData, HTTPError | Error, FetchService> {
    switch (symbol._type) {
        case DataSourceType.FreeCryptoAPI:
            return fetchChartFreeCryptoAPI(symbol, API_KEY);
        case DataSourceType.CoinGecko:
            return fetchChartCoingecko(symbol, API_KEY);
        default:
            return fail(new Error(`Unsupported symbol type: ${symbol._type}`));
    }
}

export default { spot, chart };
