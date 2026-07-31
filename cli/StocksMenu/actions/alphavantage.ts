import chalk from "chalk";
import { AlphaVantageModel } from "./../model/alphavantage.ts";
import { ActionHandler, DataSourceType, TerminalUserStateConfigContext } from "./../../types.ts";
import {
    CommandResultType
} from "./../../types.ts";
import { showLineChart } from "./../../components/charting.ts";
import {
  lensPath, pipe, view, values,
  prop, mapObjIndexed, sortBy
} from "ramda";
import { Effect } from "effect";
import { ConfigService } from "cli/services/ConfigService.ts";
import { Option } from "effect";

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

  const av = yield* AlphaVantageModel;
  const result = yield* av.chart.get(symbolObj, ALPHAVANTAGE_API_KEY);

  yield* Effect.logDebug(result);

  const sorted = processDailyData(result) as Record<string, string | number>[];
  yield* showLineChart(sorted, "timestamp", "close", "Price Chart");

  return {
    result: { type: CommandResultType.Success },
    state: st,
  };
});
