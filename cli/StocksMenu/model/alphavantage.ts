import { StockSymbolType } from "../types.ts";

/**
 * Fetches the chart data for a specified symbol from the AlphaVantage API.
 * 
 * @note Adds 1 second delay to stop hitting network rate limits.
 * @param symbol The symbol to fetch the chart data for.
 * @param ALPHAVANTAGE_API_KEY The AlphaVantage API key.
 * @returns The chart data for the specified symbol.
 * @see https://www.alphavantage.co/documentation/
 */
export async function fetchChartAlphaVantage(symbol: StockSymbolType, ALPHAVANTAGE_API_KEY: string) {
    
    const fullfillTimeout = new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve({});
        }, 3000);
    });

    await fullfillTimeout;
    const params = new URLSearchParams({
        function: "TIME_SERIES_DAILY",
        outputsize: "compact",
        symbol: symbol.id,
        apikey: ALPHAVANTAGE_API_KEY,
    });
    const response = await fetch(`https://www.alphavantage.co/query?${params}`);
    return response.json();
}

/**
 * Fetches the spot price for a specified symbol from the AlphaVantage API.
 * 
 * @param symbol The symbol to fetch the spot price for.
 * @param ALPHAVANTAGE_API_KEY The AlphaVantage API key.
 * @returns The spot price for the specified symbol.
 * @see https://www.alphavantage.co/documentation/
 */
export async function fetchSpotPriceAlphaVantage(symbol: StockSymbolType, ALPHAVANTAGE_API_KEY: string) {
    
    const params = new URLSearchParams({
        function: "GLOBAL_QUOTE",
        symbol: symbol.id,
        apikey: ALPHAVANTAGE_API_KEY,
    });
    const response = await fetch(`https://www.alphavantage.co/query?${params}`);
    return response.json();
}
