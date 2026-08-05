/**
 * Polymarket User Actions. General actions for fetching and displaying polymarket user data.
 */

import { Effect } from "effect";
import { project, pipe, prop, reduce } from "ramda";
import terminalKit from "terminal-kit";
const { terminal } = terminalKit;
import { PolymarketModel } from "../../model/index.ts";
import {
    CommandResultType
} from "src/cli/types.ts";
import { TerminalUserStateConfigContext } from "src/cli/types.ts";
import chalk from "chalk";
import { PolymarketServiceLive } from "../../services/index.ts";

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
 */
export const predictionUserPositionsHandler = (address?: string) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;
  const polymarket = yield* PolymarketModel;

  if (!address) {
    console.log("No address provided");
    return {
      result: { type: CommandResultType.Success },
      state: st,
    };
  }

  const response = yield* polymarket.user.getPositions(address);
  yield* Effect.logInfo("Fetched Data for user address: " + address);
  yield* Effect.logDebug(response);

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
}).pipe(
  Effect.provide(PolymarketServiceLive)
);
