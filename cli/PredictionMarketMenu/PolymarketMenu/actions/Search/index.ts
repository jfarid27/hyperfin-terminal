import { Effect } from "effect";
import {
    ActionHandler, CommandResultType, TerminalUserStateConfigContext,

} from "./../../../../types.ts";
import terminalKit from "terminal-kit";
import PredictionMarketsData from "./../../model/index.ts";
const { terminal } = terminalKit;
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

export const polymarketMarketsSearchHandler: ActionHandler = (query?: string) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;
  if (!query) {
    return {
      result: { type: CommandResultType.Success },
      state: st,
    };
  }
  console.log(`Fetching markets for query: ${query}`);
  const response = yield* PredictionMarketsData.polyMarketData.search.get(query);

  const eventData = processEventsFromResponse(response);

  yield* Effect.logDebug(eventData);

  yield* Effect.logInfo(`Found ${eventData.length} events`);

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
        ['Question', 'Slug'],
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
});
