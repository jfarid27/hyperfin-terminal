import chalk from "chalk";
import { chart } from "../model/index.ts";
import {
    TerminalUserStateConfigContext,
    CommandState, CommandResultType, DataSourceType,
    LogLevel
} from "../../types.ts";
import { inspectLogger } from "./../../utils/logging.ts"
import { getLoadedToken, getCoinGeckoApiKey } from "./../../utils/index.ts";
import { showLineChart } from "../../components/charting.ts";
import { Effect } from 'effect';
import { ConfigErrorTag, HTTPErrorTag, TimeoutErrorTag, UnknownError, UnknownErrorTag, type ProgramError } from "../../errors/index.ts";
import { ActionHandler } from "../../types.ts";

/**
 * Handler for the chart price command.
 * 
 * At the moment, all handing is done by CoinGeckoAPI for chart.
 * The function will error if no CoinGecko API key is provided on
 * the {@link TerminalUserStateConfig}.
 * 
 * @param st The {@link TerminalUserStateConfig} 
 * @param symbolStr The symbol to get the chart for 
 * @returns {@link CommandState} 
 * @note The function is intended to expand to support multiple data sources.
 */
export const chartPriceHandler: ActionHandler = (symbolStr: string) => Effect.gen(function*() {
    const st = yield* TerminalUserStateConfigContext;
    const applicationLogging = inspectLogger(st);
    const API_KEY = getCoinGeckoApiKey(st);

    if (!API_KEY) {
        yield* Effect.fail(new Error("No CoinGecko API key provided"));
        return {
            result: { type: CommandResultType.Error },
            state: st,
        };
    }

    const loadedTokenSymbol: string | undefined = symbolStr || getLoadedToken(st); 

    if (!loadedTokenSymbol) {
        yield* Effect.fail(new Error("No symbol provided"));
        return {
            result: { type: CommandResultType.Error },
            state: st,
        };
    }
    
    applicationLogging(LogLevel.Info)(`Fetching chart for ${loadedTokenSymbol}`);
    applicationLogging(LogLevel.Info)(`Using CoinGecko API key.`);

    const symbolObj = {
        name: loadedTokenSymbol,
        id: loadedTokenSymbol.toLowerCase(),
        _type: DataSourceType.CoinGecko,
    };
    
    const chartData = yield* chart(symbolObj, API_KEY);
      
    yield* showLineChart(chartData.prices, "timestamp", "price", `${loadedTokenSymbol} Price`);
 
    applicationLogging(LogLevel.Debug)("Result: ");
    applicationLogging(LogLevel.Debug)(chartData);

    return {
        result: { type: CommandResultType.Success },
        state: st,
    };
    
}).pipe(
  Effect.catchAll((error) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "_tag" in error
    ) {
      const tag = (error as { _tag: string })._tag;
      if (
        tag === HTTPErrorTag ||
        tag === ConfigErrorTag ||
        tag === TimeoutErrorTag ||
        tag === UnknownErrorTag
      ) {
        return Effect.fail(error as unknown as ProgramError);
      }
    }
    return Effect.gen(function* () {
      yield* Effect.logError(error);
      const err = error as unknown;
      return yield* Effect.fail(new UnknownError({
        message: err instanceof Error ? err.message : "Action handler failed",
      }));
    });
  }),
);