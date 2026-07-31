/**
 * @file Polymarket Actions
 * @description ActionHandlers for fetching and displaying polymarket data.
 */

import { Effect } from "effect";
import { project, pipe as pipeR, set, filter, toLower, lensProp, map,
    lensPath, view, defaultTo, zip, find,
    props,
    reduce
} from "ramda";
import terminalKit from "terminal-kit";
const { terminal } = terminalKit;
import { PolymarketModel } from "./../model/index.ts";
import {CommandResultType, PredictionMarketsType, LogLevel } from "./../../../types.ts";
import { TerminalUserStateConfigContext } from "./../../../types.ts";
import chalk from "chalk";
import { inspectLogger } from "./../../../utils/logging.ts";
import { loadCSVPortfolio } from "./../../../utils/loaders.ts";
import { PolymarketPortfolio, PolymarketPosition, PortfolioAnalysisType } from "./types.ts";
import { PolymarketServiceLive } from "../services/index.ts";

/**
 * Lens path for predictions markets data on the User State.
 */
const xPolymarketTagData = lensPath(["loadedContext", "predictionMarkets", "data"]);

/**
 * Lens path for prediction market type stored on the User State.
 */
const xPredictionMarketType = lensPath(["loadedContext", "predictionMarkets", "type"]);

/**
 * Lens path for polymarket prediction market properties returned by the polymarket API.
 */
const xPolymarketMarketsData = project(["slug", "question", "outcomes", "outcomePrices", "volume", "liquidity"])


/**
 * Formats the markets data for display in a terminal table.
 */
const formatMarketsDataForTable = pipeR(
    map((r: any) => {

        const outcomes = JSON.parse(r.outcomes);
        const outcomePrices = JSON.parse(r.outcomePrices);
        const volume = r.volume;
        const liquidity = r.liquidity;
        const outcomesText = zip(outcomes, outcomePrices).map((o) => `${o[0]}: ${o[1]}`).join(", ");

        return [
            r.slug,
            r.question,
            `${outcomesText}\nVolume: ${volume}\nLiquidity: ${liquidity}`
        ]
    })
)

/**
 * Projects the tag properties from the polymarket API response.
 */
const getTagProps = project(["id", "label", "slug"]);

/**
 * Lens path for tag label returned by the polymarket API..
 */
const xLabel = lensProp<any>('label');

/**
 * Returns a function that is truthy if the label of the tag includes the target string.
 */
const stringLabelIncludes = (target: string) => pipeR(
    view(xLabel),
    defaultTo(""),
    toLower,
    (val) => val.includes(target.toLowerCase())
);

/**
 * Projects the tag properties from the polymarket API response.
 */
const processTags = pipeR(
    getTagProps
);

/**
 * Filters the tags by the target string.
 */
const filterTags = (target: string) => pipeR(
    processTags,
    filter(stringLabelIncludes(target))
);

/**
 * Maps the polymarket event data for outcomes and outcome prices to a string array.
 */
const outcomePricesMapper = (r: string): string[] => {
    try {
        const parsed = JSON.parse(r);
        return parsed as string[];
    } catch (_error) {
        return ["NA"];
    }
}

/**
 * Processes the outcome data for the given list of markets.
 */
export const processOutcomeData = pipeR(
    map((r:any) => {
        return [r.question, zipEventOutcomePrices(r)];
    }),
)

/**
 * Zips the polymarket event data for outcomes and outcome prices.
 */
const zipEventOutcomePrices = (r: any) => {
    return zip(
        outcomePricesMapper(r.outcomes),
        outcomePricesMapper(r.outcomePrices)
    );
}


const xPolymarketMarketData = props([
    "active",
    "liquidityNum",
    "volumeNum",
]);

/**
 * Fetches markets linked to the given tag (default: all)
 */
export const predictionMarketsViewHandler = (tag?: string) => Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    const applicationLogging = inspectLogger(st);
    const polymarket = yield* PolymarketModel;

    if (!tag) {
        console.log("No tag provided");
        return {
            result: { type: CommandResultType.Success },
            state: st,
        };
    }

    const markets = yield* polymarket.markets.getByTagId(tag);

    applicationLogging(LogLevel.Debug)(markets);

    const marketsData = pipeR(
        xPolymarketMarketsData,
        formatMarketsDataForTable
    )(markets);

    terminal.table([
        ['ID', 'Question', 'Information'],
        ...marketsData,
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

    return {
        result: { type: CommandResultType.Success },
        state: st,
    };
}).pipe(
  Effect.provide(PolymarketServiceLive)
);

/**
 * Fetches the top active markets on polymarket by liquidity
 */
export const polymarketMarketsTopFetchHandler = (n?: string, term?: string) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;
  const polymarket = yield* PolymarketModel;

  const limit = n ? Number(n) : 10;
  const markets = yield* polymarket.markets.top(limit);

  yield* Effect.logDebug(markets);

  const marketsData = pipeR(
    xPolymarketMarketsData,
    formatMarketsDataForTable,
    filter((market: any) => term ? market[1].toLowerCase().includes(term.toLowerCase()) : true),
    map((market: any) => {
      return [market[1] + "\nSlug: " + market[0], market[2]];
    })
  )(markets);

  terminal.table([
    ['Question', 'Information'],
    ...marketsData,
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

  console.log(`${markets.length} markets fetched`);

  return {
    result: { type: CommandResultType.Success },
    state: st,
  };
}).pipe(
  Effect.provide(PolymarketServiceLive)
);

/**
 * Fetches the list of available tags on polymarket. Stores the tags in the terminal user state.
 */
export const polymarketMarketsTagsFetchHandler = (_search?: string) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;
  const polymarket = yield* PolymarketModel;

  const tags = yield* polymarket.tags.get();

  yield* Effect.logDebug("Tags fetched");
  yield* Effect.logDebug(tags);

  const formattedTags = processTags(tags as readonly unknown[]);

  const newSt1 = set(xPolymarketTagData, formattedTags, st);
  const newSt2 = set(xPredictionMarketType, PredictionMarketsType.Polymarket, newSt1);

  console.log("Tags added to storage. Search with 'search <term>'")
  return {
    result: { type: CommandResultType.Success },
    state: newSt2,
  };
}).pipe(
  Effect.provide(PolymarketServiceLive)
);


/**
 * Searches for tags on polymarket. If there is a cached list of tags, it will search those.
 */
export const polymarketMarketsTagsSearchHandler = (search?: string) => Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;

    if (!search) {
        console.log("No search term provided");
        return {
            result: { type: CommandResultType.Success },
            state: st,
        };
    }

    const tags = view(xPolymarketTagData, st);

    yield* Effect.logDebug("Stored Tags");
    yield* Effect.logDebug(tags);

    if (tags) {
        const filteredTags = filterTags(search)(tags);

        yield* Effect.logDebug("Filtered Tags");
        yield* Effect.logDebug(filteredTags);

        const tableFilteredObjects = filteredTags
            .map((tag: any) => [tag.label, tag.slug, tag.id]);

        terminal.table([
            ['Label', 'Slug', 'ID'],
            ...tableFilteredObjects,
        ], {
            hasBorder: true,
            contentHasMarkup: true,
            borderChars: 'lightRounded',
            borderAttr: { color: 'green' },
            textAttr: { bgColor: 'default' },
            firstRowTextAttr: { bgColor: 'green' },
            width: 60,
            fit: true
        });

        return {
            result: { type: CommandResultType.Success },
            state: st,
        };
    }

    console.log("No tags found");
    return {
        result: { type: CommandResultType.Success },
        state: st,
    };

})

const  formatPortfolioToPolymarketPortfolio = pipeR(
    map((position: string[]): PolymarketPosition => {
        return {
            slug: position[0],
            outcome: position[1],
            amount: Number(position[2]),
        };
    }),
    (positions: PolymarketPosition[]) => {
        const polymarketPositions: PolymarketPortfolio = {
            positions: positions,
        }
        return polymarketPositions;
    }
)

export const portfolioAnalysisHandler = (type?: string, filename?: string) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;

  const applicationLogging = inspectLogger(st);

  if (!type || !filename) {
    console.log("No type or filename provided");
    return {
      result: { type: CommandResultType.Success },
      state: st,
    };
  }

  applicationLogging(LogLevel.Info)(`Loading portfolio at file ./portfolios/${filename}`);

  const loaded_portfolio = yield* loadCSVPortfolio(filename);
  const portfolio = formatPortfolioToPolymarketPortfolio(loaded_portfolio);

  applicationLogging(LogLevel.Info)(portfolio);

  applicationLogging(LogLevel.Info)(`Fetching portfolio analysis for ${type} at file ./portfolios/${filename}`);

  if (type == PortfolioAnalysisType.Spot) {
    return yield* portfolioAnalysisSpotHandler(portfolio);
  }

  return {
    result: { type: CommandResultType.Error },
    state: st,
  };
}).pipe(
  Effect.provide(PolymarketServiceLive)
);

interface PositionPoint {
    outcome: string;
    price: number;
    amount: number;
    value: number;
}

enum PolymarketPositionType {
    Error = "Error",
    Success = "Success",
}

interface PolymarketSpotPositionError {
    _type: PolymarketPositionType.Error;
    slug: string;
    error: string;
}

interface PolymarketSpotPosition {
    _type: PolymarketPositionType.Success;
    slug: string,
    question: string,
    positionPoint: PositionPoint
}

type PolymarketSpotPositionResult = PolymarketSpotPosition | PolymarketSpotPositionError;

/**
 * Processes the outcome price from the response data given a structured outcome array from the Polymarket API.
 */
const processOutcomePriceFromResponseData = (outcome_name: any) => pipeR(
    (data: any) => data[0][1],
    find((outcome: any[]) => outcome[0] === outcome_name),
    defaultTo([0, "0"]),
    (data: any) => Number(data[1])
);

/**
 * Processes the portfolio analysis for the given portfolio.
 */
const portfolioAnalysisSpotHandler = (portfolio: PolymarketPortfolio) => Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    const polymarket = yield* PolymarketModel;
    yield* Effect.logDebug(`Running Portfolio SpotHandler`);

    const portfolioData: PolymarketSpotPositionResult[] = yield* Effect.forEach(
        portfolio.positions,
        (position: PolymarketPosition) => Effect.gen(function* () {
            yield* Effect.logInfo("Processing MarketData for slug: " + position.slug);
            const response = yield* polymarket.market.getBySlug(position.slug);
            const outcomeData = processOutcomeData([response]);
            yield* Effect.logDebug("Processed OutcomeData");
            yield* Effect.logDebug(outcomeData);
            const position_outcome = position.outcome;
            const outcomePrice = processOutcomePriceFromResponseData(position_outcome)(outcomeData);

            yield* Effect.logInfo("Question: ");
            yield* Effect.logInfo(response.question);
            yield* Effect.logInfo("Outcome: ");
            yield* Effect.logInfo(position_outcome);
            yield* Effect.logInfo("OutcomePrice: ");
            yield* Effect.logInfo(outcomePrice);


            const resolvedPosition: PolymarketSpotPosition = {
                _type: PolymarketPositionType.Success,
                slug: position.slug,
                question: response.question,
                positionPoint: {
                    outcome: position.outcome,
                    amount: position.amount,
                    price: outcomePrice,
                    value: position.amount * outcomePrice,
                }
            };
            return resolvedPosition as PolymarketSpotPositionResult;
        }),
        { concurrency: 10 },
    );
    const processTablePortfolioData = map((r: PolymarketSpotPositionResult) => {

        switch (r._type) {
            case PolymarketPositionType.Success:
                return [
                    r.question,
                    r.slug,
                    r.positionPoint.amount.toString(),
                    r.positionPoint.price.toString(),
                    r.positionPoint.value.toString(),
                ];
            case PolymarketPositionType.Error:
                return [
                    "N/A: An error occurred fetching market data for this position",
                    r.slug,
                    "0",
                    "0",
                    "0",
                ];
        }
    });

    const totalValue = reduce((acc: number, r: PolymarketSpotPositionResult) => {
        switch (r._type) {
            case PolymarketPositionType.Success:
                return acc + r.positionPoint.value;
            case PolymarketPositionType.Error:
                return acc;
        }
    }, 0)(portfolioData);

    yield* Effect.logDebug(portfolioData);
    const tablePortfolioData = processTablePortfolioData(portfolioData)

    terminal.table([
        ['Question', 'Slug', 'Amount', 'Price', 'Value'],
        ...tablePortfolioData
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

    console.log(chalk.blue(`Portfolio Total Value: ${totalValue}`));

    return {
        result: { type: CommandResultType.Success},
        state: st,
    };

})
