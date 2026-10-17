/**
 * Polymarket User Actions. General actions for fetching and displaying polymarket user data.
 */

import { Effect } from "effect";
import { project, pipe, prop, reduce } from "ramda";
import { PolymarketModel } from "../../../../../services/PolymarketService/index.ts";
import {
    CommandResultType
} from "src/cli/types.ts";
import { TerminalUserStateConfigContext } from "src/cli/types.ts";
import chalk from "chalk";
import { PolymarketServiceLive } from "../../../../../services/PolymarketService/service.ts";
import { table } from "../../../../utils/table.ts";
import { hyperlink } from "../../../../utils/links.ts";
import { polymarketMarketUrl } from "../../links.ts";

/**
 * Pick the title, size, currentValue, slug, and event slug from the response.
 *
 * `eventSlug` comes along because a position's canonical link is the event page
 * (`/event/<eventSlug>/<marketSlug>`), which the positions feed names directly.
 */
export const processUserData = pipe(
    project(['title', 'size', 'currentValue', 'slug', 'eventSlug']),
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

  console.log(chalk.blue("User Address: ") + address)
  console.log(chalk.blue.bold("User Positions"))

  const userData = processUserData(response);
  const accountData = processUserAccountData(response);

  table([
    ["Title", "Size", "Current Value", "Slug", "Link"],
    ...userData.map((item: any) => [
      item.title,
      item.size,
      item.currentValue,
      item.slug,
      hyperlink(polymarketMarketUrl(item.slug, item.eventSlug)),
    ])
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

  table([
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
