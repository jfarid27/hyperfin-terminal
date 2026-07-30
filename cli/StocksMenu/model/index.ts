import { StockSymbolType } from "../types.ts";
import { fetchChartAlphaVantage, fetchSpotPriceAlphaVantage } from "./alphavantage.ts";
import { fetchSpotPriceMassive } from "./massive.ts";

const stocks = {
    chart: {
        get: (symbol: StockSymbolType, ALPHAVANTAGE_API_KEY: string) => {
            return fetchChartAlphaVantage(symbol, ALPHAVANTAGE_API_KEY);
        }
    },
    spot: {
        get: (symbol: StockSymbolType, ALPHAVANTAGE_API_KEY: string) => {
            return fetchSpotPriceAlphaVantage(symbol, ALPHAVANTAGE_API_KEY);
        }
    },
    massive: {
        spot: {
            get: (symbol: StockSymbolType, MASSIVE_API_KEY: string) => {
                return fetchSpotPriceMassive(symbol, MASSIVE_API_KEY);
            }
        }
    }
}

export default stocks;
