import chalk from "chalk";
import { CoinGeckoModel } from "../model/index.ts";
import {
    CommandResultType, DataSourceType,
    TerminalUserStateConfigContext
} from "../../types.ts";
import { getLoadedToken } from "../../utils/index.ts";
import { Effect } from 'effect';
import { CryptoServiceLive } from "../services/index.ts";

/**
 * Handler for the spot price command.
 *
 * Uses the free CoinGecko API for spot prices (no API key required).
 */
export const spotPriceHandler = (symbolStr: string) => Effect.gen(function*() {
    const st = yield* TerminalUserStateConfigContext;

    const loadedTokenSymbol: string | undefined = symbolStr || getLoadedToken(st);

    if (!loadedTokenSymbol) {
        console.log("No symbol provided");
        return {
            result: { type: CommandResultType.Error },
            state: st,
        };
    }

    yield* Effect.logInfo(`Fetching spot price for ${loadedTokenSymbol}`);

    const symbolObj = {
      name: loadedTokenSymbol,
      id: loadedTokenSymbol.toLowerCase(),
      _type: DataSourceType.CoinGecko,
    };

    const coingecko = yield* CoinGeckoModel;
    const result = yield* coingecko.spot.get(symbolObj);

    yield* Effect.logDebug("Result: ");
    yield* Effect.logDebug(result);

    console.log(chalk.yellow(`Symbol: ${result.symbol.name}`));
    console.log(chalk.green(`Price: $${result.price}`));

    return {
        result: { type: CommandResultType.Success },
        state: st,
    };
}).pipe(
  Effect.provide(CryptoServiceLive)
);
