import { pipe, props } from "ramda";
import { Effect } from "effect";
import {
    CommandResultType,
    TerminalUserStateConfigContext
} from "../../../../types.ts";
import chalk from "chalk";
import { PolymarketModel } from "../../../../../services/PolymarketService/index.ts";
import { processOutcomeData } from "../../utils.ts";
import { PolymarketServiceLive } from "../../../../../services/PolymarketService/service.ts";
import { table } from "../../../../utils/table.ts";
import { clampText, DESCRIPTION_LIMIT, outputWidth, wrapText } from "../../../../utils/text.ts";
import { linkLines, polymarketEventUrl, polymarketMarketUrl } from "../../links.ts";

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
 */
export const predictionEventViewHandler = (slug?: string) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;
  const polymarket = yield* PolymarketModel;

  if (!slug) {
    console.log("No slug provided");
    return {
      result: { type: CommandResultType.Success },
      state: st,
    };
  }

  const response = yield* polymarket.event.getBySlug(slug);
  const { marketData, outcomeData } = processEventDataBySlug(response);
  // The event page, and — per market below — the market's own page.
  const markets: any[] = Array.isArray(response.markets) ? response.markets : [];

  console.log(chalk.blue.bold("Market Data"))
  console.log(chalk.blue("Title: ") + response.title)
  for (const line of linkLines(polymarketEventUrl(response.slug))) {
    console.log(chalk.cyan(line));
  }
  // Clamped for the same reason as the market view: resolution rules run long.
  for (
    const line of wrapText(
      "Description: " + clampText(response.description, DESCRIPTION_LIMIT),
      outputWidth(),
    )
  ) {
    console.log(chalk.blue(line));
  }

  table([
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

  for (const [index, [question, outcomePrices]] of outcomeData.entries()) {
    // The market's own page, above the outcomes it belongs to. Gamma's event
    // payload does not carry an `events` back-reference on its markets, so the
    // event slug we are viewing is what makes the link canonical.
    for (const line of linkLines(polymarketMarketUrl(markets[index]?.slug, response.slug))) {
      console.log(chalk.cyan(line));
    }
    table([
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
}).pipe(
  Effect.provide(PolymarketServiceLive)
);
