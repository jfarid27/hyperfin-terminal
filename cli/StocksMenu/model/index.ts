import { StockSymbolType } from "../types.ts";
import { fetchSpotPriceMassive } from "./massive.ts";
import { fetchSpotPriceCboe, fetchHistoricalPricesCboe } from "./cboe.ts";
import { fetchChartAlphaVantage, fetchSpotPriceAlphaVantage } from "./alphavantage.ts";
import { DataSourceType } from "cli/types.ts";

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
    },
  },
  cboe: {
    spot: {
      get: (symbol: StockSymbolType) => fetchSpotPriceCboe(symbol),
    },
    history: {
      get: (symbol: StockSymbolType) => fetchHistoricalPricesCboe(symbol),
    },
  },
};

export default stocks;
