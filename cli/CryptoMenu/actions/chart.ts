import chalk from "chalk";
import { CoinGeckoModel } from "../model/index.ts";
import {
    TerminalUserStateConfigContext,
    CommandResultType, DataSourceType,
} from "../../types.ts";
import { getLoadedToken } from "./../../utils/index.ts";
import { showLineChart } from "../../components/charting.ts";
import { Effect, Option } from 'effect';
import { ConfigService } from "cli/services/ConfigService.ts";
import { CryptoServiceLive } from "../services/index.ts";

/**
 * Handler for the chart price command.
 *
 * At the moment, all handing is done by CoinGeckoAPI for chart.
 * The function will error if no CoinGecko API key is provided on
 * the {@link TerminalUserStateConfig}.
 */
export const chartPriceHandler = (symbolStr: string) => Effect.gen(function*() {
    const st = yield* TerminalUserStateConfigContext;
    const config = yield* ConfigService;
    const API_KEY = Option.getOrUndefined(config.COINGECKO_API_KEY);

    if (!API_KEY) {
        console.log(chalk.red("No CoinGecko API key provided"));
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

    yield* Effect.logInfo(`Fetching chart for ${loadedTokenSymbol}`);
    yield* Effect.logInfo(`Using CoinGecko API key.`);

    const symbolObj = {
        name: loadedTokenSymbol,
        id: loadedTokenSymbol.toLowerCase(),
        _type: DataSourceType.CoinGecko,
    };

    const coingecko = yield* CoinGeckoModel;
    const chartData = yield* coingecko.chart.get(symbolObj, API_KEY);

    yield* showLineChart(chartData.prices, "timestamp", "price", `${loadedTokenSymbol} Price`);

    yield* Effect.logDebug("Result: ");
    yield* Effect.logDebug(chartData);

    return {
        result: { type: CommandResultType.Success },
        state: st,
    };
}).pipe(
  Effect.provide(CryptoServiceLive)
);
