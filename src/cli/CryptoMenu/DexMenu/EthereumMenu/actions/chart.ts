/**
 * Price chart for an Ethereum token, drawn from CoinMarketCap K-line candles.
 *
 * The series is the candle close, oldest first — the same shape the rest of the
 * crypto menu charts, so the shared renderer draws it unchanged. The only DEX
 * specific parameter is the candle interval, because CoinMarketCap serves the
 * whole series in whatever resolution is asked for.
 */

import chalk from "chalk";
import { Effect } from "effect";
import { CoinMarketCapDexModel } from "../../../model/index.ts";
import { ChartRenderer } from "../../../../StocksMenu/services/ChartRenderer.ts";
import {
  CommandResultType,
  type CommandState,
  TerminalUserStateConfigContext,
} from "../../../../types.ts";
import type { ProgramError } from "../../../../errors/index.ts";
import { formatUsd } from "../../../../utils/format.ts";
import {
  DEFAULT_DEX_INTERVAL,
  type DexInterval,
  DEX_INTERVAL_HINT,
  isDexInterval,
} from "../../types.ts";
import { ADDRESS_USAGE, addressProblem, resolveEthereumToken } from "./token.ts";
import { resolveDexSeries } from "./series.ts";

/**
 * Narrow the interval argument to a supported candle interval, falling back to
 * daily. Returns `null` for a value CoinMarketCap does not accept — sending it
 * anyway would earn a generic 500 that reads like an outage.
 */
export const resolveDexInterval = (intervalStr?: string): DexInterval | null => {
  const raw = (intervalStr ?? "").trim();
  if (raw === "") return DEFAULT_DEX_INTERVAL;
  return isDexInterval(raw) ? raw : null;
};

/** Render the token's candle closes as a line chart. */
export const dexChartHandler = (
  addressStr?: string,
  intervalStr?: string,
): Effect.Effect<
  CommandState,
  ProgramError,
  CoinMarketCapDexModel | ChartRenderer | TerminalUserStateConfigContext
> =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;

    const token = resolveEthereumToken(st, addressStr);
    if (!token) {
      console.log(chalk.red(addressProblem(addressStr)));
      console.log(chalk.dim(ADDRESS_USAGE));
      return { result: { type: CommandResultType.Error }, state: st };
    }

    const interval = resolveDexInterval(intervalStr);
    if (interval === null) {
      console.log(
        chalk.red(`Unsupported interval "${intervalStr}". Supported: ${DEX_INTERVAL_HINT}.`),
      );
      return { result: { type: CommandResultType.Error }, state: st };
    }

    yield* Effect.logInfo(`Fetching DEX chart for ${token.address} at ${interval}`);

    const { label, chart: chartData } = yield* resolveDexSeries(
      token,
      st.apiKeys.coinmarketcap,
      interval,
    );

    const chart = yield* ChartRenderer;
    yield* chart.render(
      chartData.prices,
      "timestamp",
      "price",
      `${label.toUpperCase()} Price (${interval})`,
    );

    const prices = chartData.prices;
    const first = prices[0];
    const last = prices[prices.length - 1];
    const span = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 16).replace("T", " ");

    yield* Effect.logDebug(`Fetched ${prices.length} ${interval} candles for ${label}`);

    console.log(
      chalk.dim(
        `\n${prices.length} candle(s) · ${span(first.timestamp)} to ${span(last.timestamp)} UTC · ` +
          `${formatUsd(first.price)} to ${formatUsd(last.price)}`,
      ),
    );
    console.log("");

    return { result: { type: CommandResultType.Success }, state: st };
  });
