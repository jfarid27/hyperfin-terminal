import { StockSymbolType } from "../types.ts";
import { fetchChartAlphaVantage, fetchSpotPriceAlphaVantage } from "./alphavantage.ts";
import { fetchSpotPriceMassive } from "./massive.ts";

const stocks = {
    chart: {
        get: (symbol: StockSymbolType, apiKey: string) => fetchChartAlphaVantage(symbol, apiKey),
    },
    spot: {
        get: (symbol: StockSymbolType, apiKey: string) => fetchSpotPriceAlphaVantage(symbol, apiKey),
    },
    massive: {
        spot: {
            get: (symbol: StockSymbolType, apiKey: string) => fetchSpotPriceMassive(symbol, apiKey),
        }
    }
}

export default stocks;
