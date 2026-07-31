import { pipe, map, zip, props } from "ramda";
import { Effect } from "effect";
import { ConfigErrorTag, HTTPErrorTag, TimeoutErrorTag, UnknownError, UnknownErrorTag, type ProgramError } from "../../../../errors/index.ts";
import terminalKit from "terminal-kit";
const { terminal } = terminalKit;
import {
    CommandResultType, CommandState,
    LogLevel,
    TerminalUserStateConfigContext
} from "./../../../../types.ts";
import { ActionHandler } from "./../../../../types.ts";
import chalk from "chalk";
import { inspectLogger } from "./../../../../utils/logging.ts";
import PredictionMarketsData from "./../../model/index.ts";
import { processOutcomeData } from "./../../utils.ts";

/**
 * Pull relevant market data from the polymarket API response for given slug.
 */
const xPolymarketEventData = props([
    "slug",
    "active",
    "liquidity",
    "volume",
    "competitive"
]);

/**
 * Processes the event data for the given market by slug.
 */
export const processEventDataBySlug = pipe(
    (r: any) => ({
        response: r,
        marketData: xPolymarketEventData(r) as string[],
        outcomeData: processOutcomeData(r.markets),
    }),
);

/**
 * Fetches event for the given event slug. Note events have multiple markets.
 * @param st Terminal User State
 * @param slug Polymarket Defined Event Slug.
 * @returns CommandState
 */
export const predictionEventViewHandler = (slug?: string) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;

  if (!slug) {
    console.log("No slug provided");
    return {
      result: { type: CommandResultType.Success },
      state: st,
    };
  }

  const response = yield* PredictionMarketsData.polyMarketData.event.getBySlug(slug);
  const { marketData, outcomeData } = processEventDataBySlug(response);
  yield* Effect.logDebug(marketData);
  yield* Effect.logDebug(outcomeData);

  console.log(chalk.blue.bold("Market Data"))
  console.log(chalk.blue("Title: ") + response.title)
  console.log(chalk.blue("Description: ") + response.description)

  terminal.table([
    ['Slug', 'Active', 'Liquidity', 'Volume', 'Competitive'],
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

  console.log(chalk.blue.bold("Outcome Data"))

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
