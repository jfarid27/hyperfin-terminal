/**
 * Polymarket User Actions. General actions for fetching and displaying polymarket user data.
 * 
 * @file Polymarket User Actions
 * @description ActionHandlers for fetching and displaying polymarket data.
 * @note ActionHandlers are functions that take a TerminalUserStateConfig and return a Promise<CommandState>
 * @see {@link ActionHandler}
 */

import { Effect } from "effect";
import { project, pipe, set, filter, toLower, lensProp, map,
    lensPath, view, defaultTo, zip, tap, find,
    props, prop,
    reduce
} from "ramda";
import terminalKit from "terminal-kit";
const { terminal } = terminalKit;
import PredictionMarketsData from "../../model/index.ts";
import {
    CommandResultType,
    CommandState,
    LogLevel
} from "../../../../types.ts";
import { TerminalUserStateConfigContext } from "../../../../types.ts";
import { ActionHandler } from "../../../../types.ts";
import chalk from "chalk";
import { inspectLogger } from "../../../../utils/logging.ts"

/**
 * Pick the title, size, currentValue, and slug from the response.
 */
export const processUserData = pipe(
    project(['title', 'size', 'currentValue', 'slug']),
);

const currentValueProp = prop('currentValue');
const realizedPnlProp = prop('realizedPnl');

/**
 * Processes user account data from response, aggregating their net values and pnls..
 * @param data User account data.
 * @returns Processed user account data.
 */
export const processUserAccountData = pipe(
    reduce((acc, val: any) => {
        return {
            currentValue: acc.currentValue + currentValueProp(val),
            realizedPnl: acc.realizedPnl + realizedPnlProp(val),
        };
    }, { currentValue: 0, realizedPnl: 0 }),
);

/**
 * Fetches user positions for the given user address.
 * @param st Terminal User State 
 * @param address Polymarket User Address. 
 * @returns CommandState 
 */
export const predictionUserPositionsHandler: ActionHandler = (address?: string):
Effect.Effect<CommandState, Error, TerminalUserStateConfigContext> => Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    const applicationLogging = inspectLogger(st);
    
    if (!address) {
        console.log("No address provided");
        return {
            result: { type: CommandResultType.Success },
            state: st,
        };
    }
    
    const response  = yield* PredictionMarketsData.polyMarketData.user.getPositions(address);
    applicationLogging(LogLevel.Info)("Fetched Data for user address: " + address);
    applicationLogging(LogLevel.Debug)(response);
    
    console.log(chalk.blue("User Address: ") + address)
    console.log(chalk.blue.bold("User Positions"))
    
    const userData = processUserData(response);
    const accountData = processUserAccountData(response);

    terminal.table([
        ["Title", "Size", "Current Value", "Slug"],
        ...userData.map((item: any) => [item.title, item.size, item.currentValue, item.slug])
    ], {
        hasBorder: true,
        contentHasMarkup: true,
        borderChars: 'lightRounded',
        borderAttr: { color: 'green' },
        textAttr: { bgColor: 'default' },
        firstRowTextAttr: { bgColor: 'green' },
        width: 180,
        fit: true
    });

    console.log(chalk.blue.bold("Account Data"))

    terminal.table([
        ["Current Value", "Realized PnL"],
        [accountData.currentValue, accountData.realizedPnl]
    ], {
        hasBorder: true,
        contentHasMarkup: true,
        borderChars: 'lightRounded',
        borderAttr: { color: 'blue' },
        textAttr: { bgColor: 'default' },
        firstRowTextAttr: { bgColor: 'green' },
        width: 180,
        fit: true
    });
    
    return {
        result: { type: CommandResultType.Success },
        state: st,
    };
});