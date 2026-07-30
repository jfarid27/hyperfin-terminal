import chalk from "chalk";
import { spot } from "../model/index.ts";
import {
    CommandResultType, DataSourceType,
    LogLevel,
    TerminalUserStateConfigContext
} from "../../types.ts";
import { inspectLogger } from "./../../utils/logging.ts"
import { getLoadedToken } from "./../../utils/index.ts";
import { Effect } from 'effect';
import { ConfigErrorTag, HTTPErrorTag, TimeoutErrorTag, UnknownError, UnknownErrorTag, type ProgramError } from "../../errors/index.ts";
import { ActionHandler } from "../../types.ts";
import { ConfigService } from "cli/services/ConfigService.ts";
import { Option } from "effect";

/**
 * Handler for the spot price command.
 * 
 * At the moment, all handing is done by the Coingecko API for spot.
 * The function will error if no CoinGecko API key is provided on
 * the {@link TerminalUserStateConfig}.
 * 
 * @param symbolStr The symbol to get the spot price for 
 * @returns {@link CommandState} 
 * @note The function is intended to expand to support multiple data sources.
 */
export const spotPriceHandler: ActionHandler = (symbolStr: string) => Effect.gen(function*() {
    
    const st = yield* TerminalUserStateConfigContext;
    const config = yield* ConfigService;
    const applicationLogging = inspectLogger(st);
    const API_KEY = Option.getOrUndefined(config.COINGECKO_API_KEY);
    
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
    
    applicationLogging(LogLevel.Info)(`Fetching spot price for ${loadedTokenSymbol}`);
    applicationLogging(LogLevel.Info)(`Using CoinGecko API key.`);

    const symbolObj = {
    name: loadedTokenSymbol,
    id: loadedTokenSymbol.toLowerCase(),
    _type: DataSourceType.CoinGecko,
    };

    const result = yield* spot(symbolObj, API_KEY);

    applicationLogging(LogLevel.Debug)("Result: ");
    applicationLogging(LogLevel.Debug)(result);

    console.log(chalk.yellow(`Symbol: ${result.symbol.name}`));
    console.log(chalk.green(`Price: $${result.price}`));
        
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
