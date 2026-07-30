import { StockSymbolType } from "../types.ts";
import { fetchChartAlphaVantage, fetchSpotPriceAlphaVantage } from "./alphavantage.ts";
import { fetchSpotPriceMassive } from "./massive.ts";

const stocks = {
    chart: {
        get: fetchChartAlphaVantage
    },
    spot: {
        get: fetchSpotPriceAlphaVantage
    },
    massive: {
        spot: {
            get: fetchSpotPriceMassive
        }
    }
}

export default stocks;
