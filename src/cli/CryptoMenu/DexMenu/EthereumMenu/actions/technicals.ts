/**
 * Technical indicators for an Ethereum token.
 *
 * Only the series resolution is DEX specific: the token is looked up by
 * contract address and its daily candles become the series. The measuring and
 * charting is the crypto menu's own `runBollinger` / `runFibonacci` /
 * `runReturns`, so an indicator behaves identically whether the symbol came
 * from a ticker or from an address.
 *
 * The candle history is requested whole rather than by a lookback window:
 * CoinMarketCap serves the full series in one call, so there is no `days`
 * parameter to widen and the indicator's own lookback does the narrowing.
 */

import chalk from "chalk";
import { Effect } from "effect";
import { CoinMarketCapDexModel } from "../../../model/index.ts";
import { ChartRenderer } from "../../../../StocksMenu/services/ChartRenderer.ts";
import {
  CommandResultType,
  type CommandState,
  TerminalUserStateConfigContext,
  type TerminalUserStateConfig,
} from "../../../../types.ts";
import type { ProgramError } from "../../../../errors/index.ts";
import {
  parseNonNegative,
  parseOptionalPositiveInt,
  parsePositiveInt,
  type ResolvedSeries,
  runBollinger,
  runFibonacci,
  runReturns,
} from "../../../actions/technicals.ts";
import {
  DEFAULT_BOLLINGER_PERIOD,
  DEFAULT_BOLLINGER_STDDEV,
  type SeriesPoint,
} from "src/technicals/index.ts";
import { ANALYSIS_DEX_INTERVAL } from "../../types.ts";
import { ADDRESS_USAGE, addressProblem, resolveEthereumToken } from "./token.ts";
import { resolveDexSeries } from "./series.ts";

/**
 * Resolve the token (address argument, else the loaded DEX address) into the
 * price series an indicator measures. Returns `null` after printing why when
 * there is nothing to measure.
 */
export const resolveDexResolvedSeries = (
  st: TerminalUserStateConfig,
  addressStr?: string,
): Effect.Effect<ResolvedSeries | null, ProgramError, CoinMarketCapDexModel> =>
  Effect.gen(function* () {
    const token = resolveEthereumToken(st, addressStr);
    if (!token) {
      console.log(chalk.red(addressProblem(addressStr)));
      console.log(chalk.dim(ADDRESS_USAGE));
      return null;
    }

    yield* Effect.logInfo(`Fetching ${ANALYSIS_DEX_INTERVAL} candles for ${token.address}`);

    const { label, chart } = yield* resolveDexSeries(
      token,
      st.apiKeys.coinmarketcap,
      ANALYSIS_DEX_INTERVAL,
    );

    const points: SeriesPoint[] = chart.prices
      .map((point) => ({ timestamp: point.timestamp, value: point.price }))
      .sort((a, b) => a.timestamp - b.timestamp);

    return { symbol: label, points };
  });

/** Chart a token's Bollinger envelope. */
export const dexBollingerHandler = (
  addressStr?: string,
  periodStr?: string,
  stddevStr?: string,
): Effect.Effect<
  CommandState,
  ProgramError,
  CoinMarketCapDexModel | ChartRenderer | TerminalUserStateConfigContext
> =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;

    const period = parsePositiveInt(periodStr, DEFAULT_BOLLINGER_PERIOD);
    const stddev = parseNonNegative(stddevStr, DEFAULT_BOLLINGER_STDDEV);

    const resolved = yield* resolveDexResolvedSeries(st, addressStr);
    if (!resolved) {
      return { result: { type: CommandResultType.Error }, state: st };
    }

    const result = yield* runBollinger(resolved, period, stddev);
    return { result, state: st };
  });

/** Chart a token's Fibonacci retracement levels. */
export const dexFibonacciHandler = (
  addressStr?: string,
  lookbackStr?: string,
): Effect.Effect<
  CommandState,
  ProgramError,
  CoinMarketCapDexModel | ChartRenderer | TerminalUserStateConfigContext
> =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;

    const lookback = parseOptionalPositiveInt(lookbackStr);

    const resolved = yield* resolveDexResolvedSeries(st, addressStr);
    if (!resolved) {
      return { result: { type: CommandResultType.Error }, state: st };
    }

    const result = yield* runFibonacci(resolved, lookback);
    return { result, state: st };
  });

/** Chart a token's daily percent returns. */
export const dexReturnsHandler = (
  addressStr?: string,
): Effect.Effect<
  CommandState,
  ProgramError,
  CoinMarketCapDexModel | ChartRenderer | TerminalUserStateConfigContext
> =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;

    const resolved = yield* resolveDexResolvedSeries(st, addressStr);
    if (!resolved) {
      return { result: { type: CommandResultType.Error }, state: st };
    }

    const result = yield* runReturns(resolved);
    return { result, state: st };
  });
