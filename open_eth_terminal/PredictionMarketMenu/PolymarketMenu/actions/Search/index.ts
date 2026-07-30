import { Effect } from "effect";
import {
    ActionHandler, CommandResultType, CommandState, TerminalUserStateConfigContext,
    LogLevel
} from "./../../../../types.ts";
import terminalKit from "terminal-kit";
import PredictionMarketsData from "./../../model/index.ts";
const { terminal } = terminalKit;
import { inspectLogger } from "./../../../../utils/logging.ts";
import chalk from "chalk";
import { pipe, map, filter } from "ramda";
import { processOutcomeData } from "./../../utils.ts";

export const processEventsFromResponse = pipe(
    (r: any) => r.events,
    filter((r: any) => r.active && !r.closed),
    map((r: any) => ({
        tableRow:[
            r.title,
            r.slug,
            r.active
        ],
        markets: processMarketsFromResponse(r.markets),
    })),
);
    
export const processMarketsFromResponse = pipe(
    filter((r: any) => r.active && !r.closed),
    map((r: any) => ({
        tableRow: [
            r.question,
            r.slug,
        ],
        outcomeData: processOutcomeData([r]),
    })),
);

export const polymarketMarketsSearchHandler: ActionHandler = (query?: string):
Effect.Effect<CommandState, unknown, TerminalUserStateConfigContext> => Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    const applicationLogging = inspectLogger(st);
    if (!query) {
        return {
            result: { type: CommandResultType.Success },
            state: st,
        };
    }
    try {
        console.log(`Fetching markets for query: ${query}`);
        const response = yield* PredictionMarketsData.polyMarketData.search.get(query);
        
        const eventData = processEventsFromResponse(response);
        
        applicationLogging(LogLevel.Debug)(eventData);

        applicationLogging(LogLevel.Info)(`Found ${eventData.length} events`);
        
        for (const event of eventData) {
            terminal.table([
                ['Event', 'Slug', 'Active'],
                event.tableRow,
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

            for (const market of event.markets) {
                terminal.table([
                    ['Question', 'Slug' ],
                    market.tableRow,
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
                
                for (const [question, outcomePrices] of market.outcomeData) {
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
            }
        }
        
        return {
            result: { type: CommandResultType.Success },
            state: st,
        };
    } catch (error) {
        applicationLogging(LogLevel.Debug)(error);
        applicationLogging(LogLevel.Info)("Failed to fetch markets for query: " + query);
        console.log(chalk.red("A network error occurred. Please try again."));
        return {
            result: { type: CommandResultType.Error, message: "Failed to fetch markets" },
            state: st,
        };
    }
});