import { pipe, map, props } from "ramda";
import { Effect } from "effect";
import terminalKit from "terminal-kit";
const { terminal } = terminalKit;
import {
    CommandResultType,
    LogLevel, TerminalUserStateConfigContext 
} from "./../../../../types.ts";
import type { ActionHandler,} from "./../../../../types.ts";
import chalk from "chalk";
import { inspectLogger } from "./../../../../utils/logging.ts";
import PredictionMarketsData from "./../../model/index.ts";

/**
 * Extract market summary data for display
 */
const extractMarketSummary = (market: any) => {
    return {
        title: market.title,
        subtitle: market.subtitle,
        volume: market.volume,
        volume_24h: market.volume_24h,
        liquidity: market.liquidity,
        liquidity_dollars: market.liquidity_dollars,
    };
};

/**
 * Extract bid/ask data with computed spreads for yes/no options
 */
const extractBidAskData = (market: any) => {
    // Parse bid/ask values, will be NaN if invalid
    const yesBid = parseFloat(market.yes_bid_dollars);
    const yesAsk = parseFloat(market.yes_ask_dollars);
    const noBid = parseFloat(market.no_bid_dollars);
    const noAsk = parseFloat(market.no_ask_dollars);
    
    // Validate that all values are valid numbers before computing spreads
    const yesSpread = (!isNaN(yesBid) && !isNaN(yesAsk)) 
        ? (yesAsk - yesBid).toFixed(4) 
        : "N/A";
    const noSpread = (!isNaN(noBid) && !isNaN(noAsk)) 
        ? (noAsk - noBid).toFixed(4) 
        : "N/A";
    
    return {
        yes: {
            bid: market.yes_bid_dollars || "N/A",
            ask: market.yes_ask_dollars || "N/A",
            spread: yesSpread,
        },
        no: {
            bid: market.no_bid_dollars || "N/A",
            ask: market.no_ask_dollars || "N/A",
            spread: noSpread,
        }
    };
};

/**
 * Extract price range information
 */
const extractPriceRange = (market: any) => {
    if (market.price_ranges && market.price_ranges.length > 0) {
        return {
            start: market.price_ranges[0].start,
            end: market.price_ranges[0].end,
        };
    }
    return {
        start: "N/A",
        end: "N/A",
    };
};

/**
 * Process all markets data for display
 */
export const processMarketsData = (markets: any[]) => {
    return markets.map((market: any) => ({
        summary: extractMarketSummary(market),
        bidAsk: extractBidAskData(market),
        priceRange: extractPriceRange(market),
    }));
};

/**
 * Fetches markets for the given event ticker from Kalshi.
 * @param st Terminal User State 
 * @param eventTicker Kalshi Event Ticker (e.g., "KXHIGHNY-26JAN10")
 * @returns CommandState 
 */
export const kalshiEventViewHandler: ActionHandler = (eventTicker?: string) => Effect.gen(function*() {
    const st = yield* TerminalUserStateConfigContext;
    const applicationLogging = inspectLogger(st);
    
    if (!eventTicker) {
        console.log("No event ticker provided");
        return {
            result: { type: CommandResultType.Success },
            state: st,
        };
    }
    
    const response = yield* PredictionMarketsData.kalshiData.markets.getByEventTicker(eventTicker);
    applicationLogging(LogLevel.Debug)(response);
    
    if (!response.markets || response.markets.length === 0) {
        console.log(chalk.yellow("No markets found for this event ticker"));
        return {
            result: { type: CommandResultType.Success },
            state: st,
        };
    }
    
    const processedMarkets = processMarketsData(response.markets);
    
    // Display each market
    for (let i = 0; i < response.markets.length; i++) {
        const market = response.markets[i];
        const processed = processedMarkets[i];
        
        console.log(chalk.blue.bold(`\nMarket ${i + 1}: ${processed.summary.title}`))
        console.log(chalk.blue("Subtitle: ") + processed.summary.subtitle)
        
        // Volume and Liquidity table
        terminal.table([
            ['Volume', 'Volume 24h', 'Liquidity', 'Liquidity (USD)'],
            [
                processed.summary.volume.toString(),
                processed.summary.volume_24h.toString(),
                processed.summary.liquidity.toString(),
                processed.summary.liquidity_dollars,
            ],
        ], {
            hasBorder: true,
            contentHasMarkup: true,
            borderChars: 'lightRounded',
            borderAttr: { color: 'green' },
            textAttr: { bgColor: 'default' },
            firstRowTextAttr: { bgColor: 'green' },
            width: 120,
            fit: true
        });
        
        console.log(chalk.blue.bold("Bid/Ask Prices and Spreads"))
        
        // Bid/Ask table for Yes/No options
        terminal.table([
            ['Option', 'Bid', 'Ask', 'Spread'],
            ['Yes', processed.bidAsk.yes.bid, processed.bidAsk.yes.ask, processed.bidAsk.yes.spread],
            ['No', processed.bidAsk.no.bid, processed.bidAsk.no.ask, processed.bidAsk.no.spread],
        ], {
            hasBorder: true,
            contentHasMarkup: true,
            borderChars: 'lightRounded',
            borderAttr: { color: 'green' },
            textAttr: { bgColor: 'default' },
            firstRowTextAttr: { bgColor: 'blue' },
            width: 120,
            fit: true
        });
        
        console.log(chalk.blue.bold("Price Range"))
        
        // Price range table
        terminal.table([
            ['Start', 'End'],
            [processed.priceRange.start, processed.priceRange.end],
        ], {
            hasBorder: true,
            contentHasMarkup: true,
            borderChars: 'lightRounded',
            borderAttr: { color: 'green' },
            textAttr: { bgColor: 'default' },
            firstRowTextAttr: { bgColor: 'blue' },
            width: 120,
            fit: true
        });
    }
    
    return {
        result: { type: CommandResultType.Success },
        state: st,
    };
});
