import chalk from "chalk";
import { CoinGeckoModel } from "../model/index.ts";
import {
    TerminalUserStateConfigContext,
    CommandResultType, DataSourceType,
} from "../../types.ts";
import { getLoadedToken } from "./../../utils/index.ts";
import { showLineChart } from "../../components/charting.ts";
import { Effect } from 'effect';
import { CryptoServiceLive } from "../services/index.ts";

/**
 * Handler for the chart price command.
 *
 * Uses the free CoinGecko API for chart data (no API key required).
 */
export const chartPriceHandler = (symbolStr: string) => Effect.gen(function*() {
    const st = yield* TerminalUserStateConfigContext;

    const loadedTokenSymbol: string | undefined = symbolStr || getLoadedToken(st);

    if (!loadedTokenSymbol) {
        console.log("No symbol provided");
        return {
            result: { type: CommandResultType.Error },
            state: st,
        };
    }

    yield* Effect.logInfo(`Fetching chart for ${loadedTokenSymbol}`);

    const symbolObj = {
        name: loadedTokenSymbol,
        id: loadedTokenSymbol.toLowerCase(),
        _type: DataSourceType.CoinGecko,
    };

    const coingecko = yield* CoinGeckoModel;
    const chartData = yield* coingecko.chart.get(symbolObj);

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
