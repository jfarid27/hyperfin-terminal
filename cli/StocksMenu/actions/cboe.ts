import chalk from "chalk";
import stocks from "./../model/index.ts";
import { ActionHandler, DataSourceType, TerminalUserStateConfigContext } from "./../../types.ts";
import {
    CommandResultType,
} from "./../../types.ts";
import { showLineChart } from "./../../components/charting.ts";
import {
  lensPath, pipe, view, values,
  prop, mapObjIndexed, sortBy,
} from "ramda";
import terminalKit from "terminal-kit";
const { terminal } = terminalKit;
import { Effect } from "effect";
import { ConfigService } from "cli/services/ConfigService.ts";
import { CboeService } from "cli/services/CboeService.ts";
import { Option } from "effect";

// Lens for the loaded token on the user state config.
const tokenLens = lensPath(["loadedContext", "token", "symbol"]);

// View the loaded token on the user state config.
const getLoadedToken = view(tokenLens);
const timeSeriesDailyP = prop("Time Series (Daily)");

/**
 * Process the daily data from AlphaVantage by projecting the nested object into
 * an array of objects with date, close, timestamp
 * @param data raw object data from AlphaVantage
 * @returns object array with date, close, timestamp
 */
const processDailyData = pipe(
      timeSeriesDailyP,
      mapObjIndexed((value: Record<string, string>, key: string) => {
       return {
         date: key,
         close: Number(value["4. close"]),
         timestamp: new Date(key).getTime(),
       };
      }),
      values,
      sortBy(prop("timestamp")),
);

export const chartPriceHandler: ActionHandler = (symbolStr: string) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;
  const config = yield* ConfigService;
  const ALPHAVANTAGE_API_KEY = Option.getOrUndefined(config.ALPHAVANTAGE_API_KEY);
  if (!ALPHAVANTAGE_API_KEY) {
    console.log(chalk.red("No AlphaVantage API key found"));
    return {
      result: { type: CommandResultType.Error },
      state: st,
    };
  }

  const loadedTokenSymbol: string | undefined = symbolStr || getLoadedToken(st);

  if (!loadedTokenSymbol) {
    console.log("No symbol provided");
    return {
      result: { type: CommandResultType.Error },
      state: st,
    };
  }

  const symbolObj = {
    name: loadedTokenSymbol,
    id: loadedTokenSymbol.toLowerCase(),
    _type: DataSourceType.AlphaVantage,
  };

  const result = yield* stocks.chart.get(symbolObj, ALPHAVANTAGE_API_KEY);

  yield* Effect.logDebug(result);

  const sorted = processDailyData(result) as Record<string, string | number>[];
  yield* showLineChart(sorted, "timestamp", "close", "Price Chart");

  return {
    result: { type: CommandResultType.Success },
    state: st,
  };
});

/**
 * Display a CBOE quote in a terminal table.
 */
const displayCboeQuote = (quote: any) => {
  terminal.table([
    ["Symbol", "Price", "Change", "Change %", "Volume", "Open", "High", "Low", "Prev Close"],
    [
      quote.ticker,
      `$${quote.lastPrice.toFixed(2)}`,
      quote.change.toFixed(2),
      quote.changePercent.toFixed(2) + "%",
      quote.volume.toLocaleString(),
      quote.open.toFixed(2),
      quote.high.toFixed(2),
      quote.low.toFixed(2),
      quote.previousClose.toFixed(2),
    ],
  ], {
    hasBorder: true,
    contentHasMarkup: true,
    borderChars: "lightRounded",
    borderAttr: { color: "green" },
    textAttr: { bgColor: "default" },
    firstRowTextAttr: { bgColor: "green" },
    width: 140,
    fit: true,
  });
};

export const spotPriceHandler: ActionHandler = (symbolStr: string) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;
  const config = yield* ConfigService;
  const MASSIVE_API_KEY = Option.getOrUndefined(config.MASSIVE_API_KEY);

  const loadedTokenSymbol: string | undefined = symbolStr || getLoadedToken(st);

  if (!loadedTokenSymbol) {
    console.log("No symbol provided");
    return {
      result: { type: CommandResultType.Error },
      state: st,
    };
  }

  // Determine datasource from context, default to CBOE
  const datasource = st.loadedContext?.stocks?.datasource ?? DataSourceType.CBOE;

  if (datasource === DataSourceType.Massive) {
    // Massive path
    const symbolObj = {
      name: loadedTokenSymbol,
      id: loadedTokenSymbol.toUpperCase(),
      _type: DataSourceType.Massive,
    };

    const result = yield* stocks.massive.spot.get(symbolObj, MASSIVE_API_KEY || "");
    const ticker = result?.ticker;
    const day = result?.day;
    const prevDay = result?.prevDay;

    if (!ticker) {
      console.log(chalk.red("No data returned from Massive API"));
      return {
        result: { type: CommandResultType.Error },
        state: st,
      };
    }

    const price = ticker.price || ticker.lastTrade?.p || "N/A";
    const change = day?.c != null ? day.c.toFixed(2) : "N/A";
    const changePercent = day?.cp != null ? day.cp.toFixed(2) + "%" : "N/A";
    const volume = day?.v != null ? day.v.toLocaleString() : "N/A";
    const prevClose = prevDay?.c != null ? prevDay.c.toFixed(2) : "N/A";
    const high = day?.h != null ? day.h.toFixed(2) : "N/A";
    const low = day?.l != null ? day.l.toFixed(2) : "N/A";

    terminal.table([
      ["Symbol", "Price", "Change", "Change %", "Volume", "Prev Close", "High", "Low"],
      [ticker.ticker, `$${price}`, change, changePercent, volume, prevClose, high, low],
    ], {
      hasBorder: true,
      contentHasMarkup: true,
      borderChars: "lightRounded",
      borderAttr: { color: "green" },
      textAttr: { bgColor: "default" },
      firstRowTextAttr: { bgColor: "green" },
      width: 120,
      fit: true,
    });
  } else {
    // CBOE path (default)
    const cboe = yield* CboeService;
    const result = yield* cboe.getSpotPrice(loadedTokenSymbol.toUpperCase());
    displayCboeQuote(result);
  }

  return {
    result: { type: CommandResultType.Success },
    state: st,
  };
});

/**
 * Fetch and display historical prices from CBOE.
 */
export const historyPriceHandler: ActionHandler = (symbolStr: string) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;

  const loadedTokenSymbol: string | undefined = symbolStr || getLoadedToken(st);

  if (!loadedTokenSymbol) {
    console.log("No symbol provided");
    return {
      result: { type: CommandResultType.Error },
      state: st,
    };
  }

  const cboe = yield* CboeService;
  const result = yield* cboe.getHistoricalPrices(loadedTokenSymbol.toUpperCase());

  yield* showLineChart(result as Record<string, any>[], "date", "close", `${loadedTokenSymbol} Historical Prices`);

  return {
    result: { type: CommandResultType.Success },
    state: st,
  };
});
