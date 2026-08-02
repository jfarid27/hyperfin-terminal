import chalk from "chalk";
import { AlphaVantageService } from "./../services/AlphaVantageService.ts";
import { DataSourceType, TerminalUserStateConfigContext } from "./../../types.ts";
import {
    CommandResultType
} from "./../../types.ts";
import { showLineChart } from "./../../components/charting.ts";
import {
  lensPath, pipe, view, values,
  prop, mapObjIndexed, sortBy
} from "ramda";
import { Effect } from "effect";
import { StocksServiceLive } from "../services/index.ts";

const tokenLens = lensPath(["loadedContext", "token", "symbol"]);
const getLoadedToken = view(tokenLens);
const timeSeriesDailyP = prop("Time Series (Daily)");

const processDailyData = pipe(
      timeSeriesDailyP,
      mapObjIndexed((value: Record<string, string>, key: string) => {
       return {
         date: key,
         close: Number(value["4. close"]),
         timestamp: new Date(key).getTime()
       };
      }),
      values,
      sortBy(prop("timestamp"))
);

export const spotPriceHandler = (symbolStr: string) => Effect.gen(function* () {
  // TODO: Fetch spot price and show formatted output with chalk.
});

export const chartPriceHandler = (symbolStr: string) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;

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

  const av = yield* AlphaVantageService;
  const result = yield* av.getChart(symbolObj);

  yield* Effect.logDebug(result);

  const sorted = processDailyData(result) as Record<string, string | number>[];
  yield* showLineChart(sorted, "timestamp", "close", "Price Chart");

  return {
    result: { type: CommandResultType.Success },
    state: st,
  };
}).pipe(
  Effect.provide(StocksServiceLive)
);
