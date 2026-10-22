/**
 * Technical-analysis actions for the forex menu.
 *
 * A forex "symbol" is a currency pair, so every command starts with the pair
 * (`bbands EUR USD 20 2`). The daily rate series is resolved from whichever
 * source the forex menu is pointed at — AlphaVantage's `FX_DAILY` (full history)
 * or Alpaca's `/v1beta1/forex/rates` (trailing year, mid rate).
 *
 * The measuring and charting is deliberately *not* reimplemented here: the
 * resolved series is handed to the shared `run*` steps in
 * `../../CryptoMenu/actions/technicals.ts`, which the crypto, DEX and stocks
 * menus already use, so the menus cannot drift apart. Handlers declare their
 * dependencies but do NOT provide layers; `TechnicalsMenu/menu.ts` supplies
 * `ForexServiceMenuLive`.
 *
 * Everything is measured over the **trailing year** of daily rates. `FX_DAILY`
 * carries two decades of history while Alpaca reaches only a year, so without a
 * common window the same command would chart a different span per source — and
 * 5,000 daily bars do not fit a 640px chart. See `trailingYear`.
 */

import chalk from "chalk";
import { Effect } from "effect";
import { AlpacaService } from "src/services/AlpacaService/index.ts";
import { ForexService } from "src/services/ForexService/index.ts";
import type { ForexChartPoint } from "src/services/ForexService/types.ts";
import {
  type CommandState,
  CommandResultType,
  DataSourceType,
  TerminalUserStateConfigContext,
  type TerminalUserStateConfig,
} from "../../types.ts";
import type { ProgramError } from "../../errors/index.ts";
import {
  DEFAULT_BOLLINGER_PERIOD,
  DEFAULT_BOLLINGER_STDDEV,
  type SeriesPoint,
} from "../../../technicals/index.ts";
import {
  parseNonNegative,
  parseOptionalPositiveInt,
  parsePositiveInt,
  type ResolvedSeries,
  runBollinger,
  runFibonacci,
  runReturns,
} from "../../CryptoMenu/actions/technicals.ts";
import { parsePair, formatRate } from "./alphavantage.ts";

/**
 * FX rate formatting for the indicator read-outs and level labels.
 *
 * `formatLevelValue` (the shared default) renders anything at or above 1 with two
 * decimals, which is right for an equity price but wrong for a rate: a EUR/USD
 * Fibonacci level at 1.0867 and the next at 1.0853 both print as `1.09`/`1.09`, and
 * a Bollinger basis at 1.08654 prints as `1.09`. FX rates need ~4 significant
 * digits, which is what `formatRate` gives (4 dp for a major, 7 for a JPY cross).
 */
export const fxLevelLabel = (value: number): string => formatRate(value);

/** Error shape for a command that cannot proceed. */
const errorState = (st: TerminalUserStateConfig): CommandState => ({
  result: { type: CommandResultType.Error },
  state: st,
});

/**
 * Coerce cleaned daily FX bars into the indicator's series shape.
 *
 * The indicators want one value per bar, so the daily close is the series — for
 * Alpaca that is already the mid rate, since its historical endpoint carries no
 * OHLC.
 */
export const toSeriesPoints = (points: readonly ForexChartPoint[]): SeriesPoint[] =>
  points
    .map((p) => ({ timestamp: p.timestamp, value: p.close }))
    .filter((p) => Number.isFinite(p.value) && Number.isFinite(p.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);

/** A day in ms — the width of the default measurement window. */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The bars the indicators measure by default: the trailing year.
 *
 * `FX_DAILY` returns the whole history (~5,000 bars back to 2006) while Alpaca's
 * historical endpoint can only reach a year. Measuring everything would make the
 * same command chart two decades on one source and one year on the other, and
 * 5,000 daily bars do not fit a 640px chart — the returns bars would be
 * sub-pixel. A trailing year matches the menu's `chart` default and makes both
 * sources comparable.
 *
 * Anchored to the **last bar**, not to `now`, so a series that ends weeks ago
 * still yields a full window instead of an empty one.
 */
export const trailingYear = (points: readonly SeriesPoint[]): SeriesPoint[] => {
  if (points.length === 0) return [];
  const cutoff = points[points.length - 1].timestamp - 365 * DAY_MS;
  return points.filter((p) => p.timestamp >= cutoff);
};

/**
 * Resolve the pair arguments and fetch its daily rate series from the active
 * source.
 *
 * Prints the reason and returns `null` when there is nothing to measure — an
 * invalid/missing pair, or a source that returned no bars — so the caller can
 * turn that into an `Error` result without inverting the flow.
 */
const resolveForexSeries = (
  fromStr: string | undefined,
  toStr: string | undefined,
  usage: string,
): Effect.Effect<
  ResolvedSeries | null,
  ProgramError,
  ForexService | AlpacaService | TerminalUserStateConfigContext
> =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;

    const pair = parsePair(fromStr, toStr);
    if (!pair) {
      console.log(chalk.red(`Invalid or missing currency pair. Usage: ${usage}`));
      console.log(chalk.dim("Both currencies must be 3-letter ISO codes and must differ."));
      return null;
    }

    const datasource = st.loadedContext.forex?.datasource ?? DataSourceType.AlphaVantage;
    const pairLabel = `${pair.from}/${pair.to}`;

    // Yield the service first, then the request: a nested `yield*` inside the
    // call expression reads as one step but types poorly under Effect's
    // generators.
    let bars: ForexChartPoint[];
    if (datasource === DataSourceType.Alpaca) {
      const alpaca = yield* AlpacaService;
      yield* Effect.logInfo(`Fetching Alpaca ${pairLabel} daily FX data`);
      bars = yield* alpaca.getForexDaily({
        from: pair.from,
        to: pair.to,
        _type: DataSourceType.Alpaca,
      });
    } else {
      const forex = yield* ForexService;
      yield* Effect.logInfo(`Fetching ${pairLabel} FX daily data`);
      bars = yield* forex.getDaily({
        from: pair.from,
        to: pair.to,
        _type: DataSourceType.AlphaVantage,
      });
    }

    const points = trailingYear(toSeriesPoints(bars));
    if (points.length === 0) {
      console.log(chalk.yellow(`No daily FX data returned for ${pairLabel} (${datasource}).`));
      console.log(chalk.dim("Try the inverse pair, or `source` to switch the forex source first."));
      return null;
    }

    return { symbol: pairLabel, points };
  });

/**
 * Chart the pair's daily rate with a Bollinger envelope over `period` bars at
 * `stddev` standard deviations (defaults: 20, 2).
 */
export const bollingerHandler = (
  fromStr?: string,
  toStr?: string,
  periodStr?: string,
  stddevStr?: string,
) =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;

    const period = parsePositiveInt(periodStr, DEFAULT_BOLLINGER_PERIOD);
    const stddev = parseNonNegative(stddevStr, DEFAULT_BOLLINGER_STDDEV);

    const resolved = yield* resolveForexSeries(
      fromStr,
      toStr,
      "bbands <from> <to> [period] [stddev]",
    );
    if (!resolved) return errorState(st);

    const result = yield* runBollinger(resolved, period, stddev, fxLevelLabel);
    return { result, state: st };
  });

/**
 * Chart the pair's daily rate with Fibonacci retracement levels over the most
 * recent swing (the trailing-year window unless `lookbackStr` narrows it).
 */
export const fibonacciHandler = (
  fromStr?: string,
  toStr?: string,
  lookbackStr?: string,
) =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;

    const lookback = parseOptionalPositiveInt(lookbackStr);

    const resolved = yield* resolveForexSeries(
      fromStr,
      toStr,
      "fibonacci <from> <to> [lookback]",
    );
    if (!resolved) return errorState(st);

    const result = yield* runFibonacci(resolved, lookback, fxLevelLabel);
    return { result, state: st };
  });

/**
 * Chart the pair's daily percent returns: each close measured against the
 * previous close, as sign-coloured bars with ±2σ guide bands.
 */
export const returnsHandler = (
  fromStr?: string,
  toStr?: string,
) =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;

    const resolved = yield* resolveForexSeries(fromStr, toStr, "returns <from> <to>");
    if (!resolved) return errorState(st);

    const result = yield* runReturns(resolved);
    return { result, state: st };
  });
