import { Effect } from "effect";
import { InvalidStateError } from "src/cli/errors/index.ts";
import {
    CommandResultType, TerminalUserStateConfigContext
} from "src/cli/types.ts";
import terminalKit from "terminal-kit";
import { PolymarketModel } from "../../model/index.ts";
const { terminal } = terminalKit;
import { showMultiLineChart, TimeSeriesData } from "src/cli/components/charting.ts";
import chalk from "chalk";
import { zip, pipe, props, map, prop } from "ramda";
import { PolymarketServiceLive } from "../../services/index.ts";

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
    } catch (_error) {
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
    } catch (_error) {
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
 */
export const marketChartHandler = (slug: string, startTs?: string, endTs?: string) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;
  const polymarket = yield* PolymarketModel;
  yield* Effect.logInfo(`Fetching chart for ${slug}`);

  const start = startTs ? Number(startTs) : undefined;
  const end = endTs ? Number(endTs) : undefined;

  if (startTs && (Number.isNaN(Number(startTs)) || Number(startTs) !== Math.floor(Number(startTs)))) {
    console.log(chalk.red("Invalid start timestamp. Use Unix seconds (e.g. 1700000000)"));
    return {
      result: { type: CommandResultType.Error },
      state: st,
    };
  }
  if (endTs && (Number.isNaN(Number(endTs)) || Number(endTs) !== Math.floor(Number(endTs)))) {
    console.log(chalk.red("Invalid end timestamp. Use Unix seconds (e.g. 1700086400)"));
    return {
      result: { type: CommandResultType.Error },
      state: st,
    };
  }

  const response = yield* polymarket.market.getBySlug(slug);
  yield* Effect.logDebug(response);
  const clobIds = splitClobIds(response);
  yield* Effect.logDebug(clobIds);

  if (clobIds.length !== 2) {
    console.log(chalk.red("Invalid clob ids"));
    return yield* Effect.fail(new InvalidStateError({ message: "Invalid clob ids"}))
  }

  const yesPrices = yield* polymarket.market.prices(clobIds[0], start, end);
  const noPrices = yield* polymarket.market.prices(clobIds[1], start, end);
  yield* Effect.logDebug(yesPrices);
  yield* Effect.logDebug(noPrices);
  const yesPricesProcessed = processMarketPriceHistory(yesPrices);
  const noPricesProcessed = processMarketPriceHistory(noPrices);

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

  return {
    result: { type: CommandResultType.Success },
    state: st,
  };

}).pipe(
  Effect.provide(PolymarketServiceLive)
);

/**
 * Fetches market for the given market id.
 */
export const predictionMarketViewHandler = (slug?: string, type?: string, startTs?: string, endTs?: string) => Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    const polymarket = yield* PolymarketModel;

    if (!slug) {
        console.log("No slug provided");
        return {
            result: { type: CommandResultType.Success },
            state: st,
        };
    }

    if (type && type === "chart") {
        return yield* marketChartHandler(slug, startTs, endTs);
    }

    const response = yield* polymarket.market.getBySlug(slug);
    const { marketData, outcomeData } = processMarketSlugDataResponse(response);
    yield* Effect.logDebug(marketData);
    yield* Effect.logDebug(outcomeData);

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
}).pipe(
  Effect.provide(PolymarketServiceLive)
);
