import chalk from "chalk";
import stocks from "./../model/index.ts";
import { DataSourceType, TerminalUserStateConfigContext } from "./../../types.ts";
import {
    CommandState, CommandResultType, LogLevel
} from "./../../types.ts";
import { inspectLogger } from "./../../utils/logging.ts";
import { showLineChart } from "./../../components/charting.ts";
import { lensPath, lensProp, pipe, view, values, tap,
    prop, mapObjIndexed, sortBy, props, 
    project} from "ramda";
import terminalKit from "terminal-kit";
const { terminal } = terminalKit;
import { Effect } from "effect";

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
      mapObjIndexed((value: Record<string, string>, key:string) => {
       return {
         date: key,
         close: Number(value["4. close"]),
         timestamp: new Date(key).getTime()
       } 
      }),
      values,
      sortBy(prop("timestamp"))
);

export const chartPriceHandler = (symbolStr: string) => Effect.gen(function*() {
    const st = yield* TerminalUserStateConfigContext;
    const applicationLogging = inspectLogger(st);
    const ALPHAVANTAGE_API_KEY = st.apiKeys.alphavantage;
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

    const result = yield* Effect.promise(() => stocks.chart.get(symbolObj, ALPHAVANTAGE_API_KEY));
    
    applicationLogging(LogLevel.Debug)(result);

    const sorted = processDailyData(result) as Record<string, string | number>[];
    yield* showLineChart(sorted, "timestamp", "close", "Price Chart"); 

    return {
        result: { type: CommandResultType.Success },
        state: st,
    };
});

export const spotPriceHandler = (symbolStr: string) => Effect.gen(function*() {
    const st = yield* TerminalUserStateConfigContext;
    const applicationLogging = inspectLogger(st);
    const MASSIVE_API_KEY = st.apiKeys.massive;
    if (!MASSIVE_API_KEY) {
        console.log(chalk.red("No Massive API key found. Add MASSIVE_API_KEY to your .env file."));
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

    try {
      const symbolObj = {
        name: loadedTokenSymbol,
        id: loadedTokenSymbol.toUpperCase(),
        _type: DataSourceType.Massive,
      };
  
      const result: any = yield* stocks.massive.spot.get(symbolObj, MASSIVE_API_KEY);
      
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
          ['Symbol', 'Price', 'Change', 'Change %', 'Volume', 'Prev Close', 'High', 'Low'],
          [ticker.ticker, `$${price}`, change, changePercent, volume, prevClose, high, low]
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
      
    } catch (error) {
        applicationLogging(LogLevel.Error)(error);

        console.log(chalk.red("Network Error fetching from Massive API"));
        return {
            result: { type: CommandResultType.Error },
            state: st,
        };
    }
    
    return {
        result: { type: CommandResultType.Success },
        state: st,
    };
    
});
