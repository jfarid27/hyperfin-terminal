import { Effect } from "effect";
import {
    CommandResultType, TerminalUserStateConfigContext,
} from "../../../../types.ts";
import { PolymarketModel } from "../../../../../services/PolymarketService/index.ts";
import { pipe, map, filter } from "ramda";
import { processOutcomeData } from "../../utils.ts";
import { PolymarketServiceLive } from "../../../../../services/PolymarketService/service.ts";
import { table } from "../../../../utils/table.ts";
import { hyperlink } from "../../../../utils/links.ts";
import { eventSlugOf, marketUrlOf, polymarketEventUrl, polymarketMarketUrl } from "../../links.ts";

export const processEventsFromResponse = pipe(
    (r: any) => r.events,
    filter((r: any) => r.active && !r.closed),
    map((r: any) => ({
        tableRow:[
            r.title,
            r.slug,
            r.active
        ],
        /** The event's own page on polymarket.com. */
        url: polymarketEventUrl(r.slug),
        markets: processMarketsFromResponse(r.markets, r.slug),
    })),
);

/**
 * The active markets of a search result, each with its canonical link.
 *
 * The event slug is passed down rather than read off the market: a market
 * nested in a search result does not always carry the `events` array that
 * `eventSlugOf` reads, and the enclosing event is the answer we already know.
 */
export const processMarketsFromResponse = (markets: any[], eventSlug?: string) =>
  pipe(
    filter((r: any) => r.active && !r.closed),
    map((r: any) => ({
        tableRow: [
            r.question,
            r.slug,
        ],
        /** The market's page on polymarket.com. */
        url: polymarketMarketUrl(r.slug, eventSlug ?? eventSlugOf(r)),
        outcomeData: processOutcomeData([r]),
    })),
)(markets);

export const polymarketMarketsSearchHandler = (query?: string) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;
  const polymarket = yield* PolymarketModel;
  if (!query) {
    return {
      result: { type: CommandResultType.Success },
      state: st,
    };
  }
  console.log(`Fetching markets for query: ${query}`);
  const response = yield* polymarket.search.get(query);

  const eventData = processEventsFromResponse(response);

  yield* Effect.logInfo(`Found ${eventData.length} events`);

  for (const event of eventData) {
    table([
      ['Event', 'Slug', 'Active', 'Link'],
      [...event.tableRow, hyperlink(event.url)],
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
      table([
        ['Question', 'Slug', 'Link'],
        [...market.tableRow, hyperlink(market.url)],
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
    }
  }

  return {
    result: { type: CommandResultType.Success },
    state: st,
  };
}).pipe(
  Effect.provide(PolymarketServiceLive)
);
