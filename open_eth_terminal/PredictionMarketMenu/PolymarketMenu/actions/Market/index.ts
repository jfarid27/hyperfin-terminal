import { Effect } from "effect";
import {
    ActionHandler, CommandResultType, CommandState, TerminalUserStateConfigContext,
    LogLevel
} from "./../../../../types.ts";
import terminalKit from "terminal-kit";
import PredictionMarketsData from "./../../model/index.ts";
const { terminal } = terminalKit;
import { inspectLogger } from "./../../../../utils/logging.ts";
import { showLineChart, showMultiLineChart, TimeSeriesData } from "./../../../../components/charting.ts";
import chalk from "chalk";
import { zip, pipe, props, map, prop } from "ramda";

export const xPolymarketMarketData = props([
    "active",
    "liquidityNum",
    "volumeNum",
]);

/**
 * Maps the polymarket event data for outcomes and outcome prices to a string array.
 */
export const outcomePricesMapper = (r: string): string[] => {
    try {
        const parsed = JSON.parse(r);
        return parsed as string[];
    } catch (error) {
        return ["NA"];
    }
}

/**
 * Zips the polymarket event data for outcomes and outcome prices.
 */
export const zipEventOutcomePrices = (r: any) => {
    return zip(
        outcomePricesMapper(r.outcomes),
        outcomePricesMapper(r.outcomePrices)
    );
}

/**
 * Processes the outcome data for the given list of markets.
 * 
 * @param markets List of markets to process.
 * @returns Array of [question, outcomes] pairs.
 */
export const processOutcomeData = pipe(
    map((r:any) => {
        return [r.question, zipEventOutcomePrices(r)];
    }),
)

export const processMarketSlugDataResponse = pipe(
    (r: any) => ({
        marketData: xPolymarketMarketData(r) as string[],
        outcomeData: processOutcomeData([r]),
    }),
);

const splitClobIds = (marketResponseData: any) => {
    try {
        return JSON.parse(marketResponseData.clobTokenIds);
    } catch (error) {
        return [];
    }
}

export const processMarketPriceHistory = pipe(
    prop("history"),
    map((r:any) => {
        return {timestamp: r.t, price: r.p};
    }),
)

/*
 * Prints a market chart for the given market slug.
 * 
 * @param st Terminal User State 
 * @param slug Polymarket Defined Market Slug. 
 * @returns CommandState 
 */
export const marketChartHandler: ActionHandler = (slug: string):
Effect.Effect<CommandState, Error, TerminalUserStateConfigContext> => Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    const applicationLogging = inspectLogger(st);
    applicationLogging(LogLevel.Info)(`Fetching chart for ${slug}`);
    
    try {
        const response = yield* PredictionMarketsData.polyMarketData.market.getBySlug(slug);
        applicationLogging(LogLevel.Debug)(response);
        const clobIds = splitClobIds(response);
        applicationLogging(LogLevel.Debug)(clobIds);
        
        if (clobIds.length !== 2) {
            console.log(chalk.red("Invalid clob ids"));
            return {
                result: { type: CommandResultType.Error },
                state: st,
            };
        }

        const yesPrices = yield* PredictionMarketsData.polyMarketData.market.prices(clobIds[0]);
        const noPrices = yield* PredictionMarketsData.polyMarketData.market.prices(clobIds[1]);
        applicationLogging(LogLevel.Debug)(yesPrices);
        applicationLogging(LogLevel.Debug)(noPrices);
        
        const yesPricesProcessed = processMarketPriceHistory(yesPrices);
        const noPricesProcessed = processMarketPriceHistory(noPrices);
        
        // Create time series data for the multi-line chart
        const timeSeries: TimeSeriesData[] = [
            {
                label: "Yes",
                data: yesPricesProcessed,
                options: { color: "red" }
            },
            {
                label: "No",
                data: noPricesProcessed,
                options: { color: "blue" }
            }
        ];
        
        yield* showMultiLineChart(
            timeSeries,
            "timestamp",
            "price",
            "Date",
            "Price",
            response.question
        );
    } catch (error) {
        applicationLogging(LogLevel.Error)(error);
        console.log(chalk.red("Network Error"));
        return {
            result: { type: CommandResultType.Error },
            state: st,
        };
    }
    
    return {
        result: { type: CommandResultType.Success },
        state: st,
    };
    
});

/**
 * Fetches market for the given market id.
 * @param st Terminal User State 
 * @param tag Polymarket Defined Market ID. 
 * @returns CommandState 
 */
export const predictionMarketViewHandler: ActionHandler = (slug?: string, type?: string):
Effect.Effect<CommandState, Error, TerminalUserStateConfigContext> => Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    const applicationLogging = inspectLogger(st);
    
    if (!slug) {
        console.log("No slug provided");
        return {
            result: { type: CommandResultType.Success },
            state: st,
        };
    }
    
    if (type && type === "chart") {
        return yield* marketChartHandler(slug);
    }

    const response = yield* PredictionMarketsData.polyMarketData.market.getBySlug(slug);
    const { marketData, outcomeData } = processMarketSlugDataResponse(response);
    applicationLogging(LogLevel.Debug)(response);
    
    console.log(chalk.blue.bold("Market Data"))
    console.log(chalk.blue("Question: " + response.question))
    console.log(chalk.blue("Slug: " + response.slug))
    console.log(chalk.yellow("Description: " + response.description))
    
    terminal.table([
        ['Active', 'Liquidity', 'Volume'],
        marketData,
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

    for (const [question, outcomePrices] of outcomeData) {
        terminal.table([
            [question, ""],
            ['Outcome', 'Price'],
            ...outcomePrices,
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