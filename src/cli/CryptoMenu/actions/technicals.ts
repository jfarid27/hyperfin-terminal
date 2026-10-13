/**
 * Technical-analysis actions for the crypto menu.
 *
 * Both actions share the same shape: resolve the symbol, pull its trailing
 * price series from the active model, compute one indicator over that series,
 * render it as a chart, and print a small read-out table. The indicator math
 * lives in `src/technicals/` and the Plot marks in
 * `src/technicals/overlays.ts` — this file is only the plumbing.
 *
 * Handlers declare their dependencies but do NOT provide layers; the menu index
 * supplies `Layer.mergeAll(CryptoServiceLive, ChartRendererLive)` so tests can
 * swap in mocks.
 *
 * Each indicator is split in two: a `resolveSeries*` step that turns a symbol
 * into a price series, and a `run*` step that measures and charts an
 * already-resolved series. The `run*` steps are the shared half — the DEX
 * submenu resolves its series from an on-chain address and then routes through
 * the very same Bollinger / Fibonacci / returns logic, so the two menus cannot
 * drift apart.
 */

import chalk from "chalk";
import { Effect } from "effect";
import { CoinGeckoModel } from "../model/index.ts";
import { ChartRenderer } from "../../StocksMenu/services/ChartRenderer.ts";
import {
  CommandResultType,
  DataSourceType,
  TerminalUserStateConfigContext,
} from "../../types.ts";
import type { CommandResult } from "../../types.ts";
import type { ProgramError } from "../../errors/index.ts";
import { getLoadedToken } from "../../utils/index.ts";
import { boldCell, greenCell, redCell } from "../../utils/table_markup.ts";
import {
  bollingerBands,
  type BollingerPoint,
  dailyReturns,
  DEFAULT_BOLLINGER_PERIOD,
  DEFAULT_BOLLINGER_STDDEV,
  fibonacciRetracement,
  type FibonacciRetracement,
  type ReturnPoint,
  returnStats,
  type ReturnStats,
  type SeriesPoint,
} from "../../../technicals/index.ts";
import {
  bollingerBandsFor,
  fibonacciFor,
  formatLevelValue,
  RETURN_SIGMA_MULTIPLE,
  returnsBars,
  sigmaBandsOverlay,
  zeroLineOverlay,
} from "../../../technicals/overlays.ts";
import { table } from "../../utils/table.ts";

/** The number of indicator rows echoed back to the terminal after a chart. */
const SUMMARY_ROWS = 5;
/** Default daily history length requested for technicals. */
const DEFAULT_LOOKBACK_DAYS = 180;
/** CoinGecko caps `days` at 365 for daily data on the free tier. */
const MAX_LOOKBACK_DAYS = 365;

/**
 * How many days of daily history to request for an indicator needing `bars`
 * observations. The plain `chart` command asks for a fixed 14 days, which is
 * not enough to fill even a 20-bar Bollinger window — so technicals request a
 * longer series, with headroom over the requested lookback.
 */
export const lookbackDaysFor = (bars: number): string =>
  String(Math.min(MAX_LOOKBACK_DAYS, Math.max(DEFAULT_LOOKBACK_DAYS, bars * 3)));

/** Parse a strictly positive integer, falling back when absent or malformed. */
export const parsePositiveInt = (raw: string | undefined, fallback: number): number => {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

/** Parse an optional strictly positive integer; `undefined` when absent or malformed. */
export const parseOptionalPositiveInt = (raw?: string): number | undefined => {
  if (raw === undefined || raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

/** Parse a non-negative number, falling back when absent or malformed. */
export const parseNonNegative = (raw: string | undefined, fallback: number): number => {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

/** Render a millisecond timestamp as `YYYY-MM-DD`. */
const toDateLabel = (timestamp: number): string =>
  new Date(timestamp).toISOString().slice(0, 10);

/** A symbol's trailing price series, cleaned and sorted oldest-first. */
export interface ResolvedSeries {
  symbol: string;
  points: SeriesPoint[];
}

/**
 * Resolve the symbol (argument, else the loaded crypto token) and fetch its
 * price series. Returns `null` and prints a message when there is nothing to
 * measure — the caller turns that into an Error result.
 */
const resolveSeries = (
  symbolStr?: string,
  days?: string,
): Effect.Effect<ResolvedSeries | null, ProgramError, CoinGeckoModel | TerminalUserStateConfigContext> =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    const symbol = symbolStr || getLoadedToken(st);

    if (!symbol) {
      console.log(chalk.red("No symbol provided"));
      return null;
    }

    const symbolObj = {
      name: symbol,
      id: symbol.toLowerCase(),
      _type: DataSourceType.CoinGecko,
    };

    const coingecko = yield* CoinGeckoModel;
    yield* Effect.logInfo(`Fetching chart for ${symbol}`);
    const chartData = yield* coingecko.chart.get(symbolObj, days);

    const points: SeriesPoint[] = chartData.prices
      .map((p) => ({ timestamp: p.timestamp, value: p.price }))
      .filter((p) => Number.isFinite(p.value) && Number.isFinite(p.timestamp))
      .sort((a, b) => a.timestamp - b.timestamp);

    return { symbol, points };
  });

/** Echo the most recent bands so the numbers are visible without opening the chart. */
const logBollingerSummary = (
  symbol: string,
  period: number,
  stddev: number,
  bands: readonly BollingerPoint[],
): void => {
  const rows = bands.slice(-SUMMARY_ROWS);

  console.log("");
  console.log(
    chalk.bold(
      `${symbol.toUpperCase()} — Bollinger Bands (${period}, ${stddev}) over ${bands.length} bars`,
    ),
  );
  console.log("");

  table(
    [
      ["Date", "Lower", "Basis", "Upper", "StDev"],
      ...rows.map((b) => [
        boldCell(toDateLabel(b.timestamp)),
        formatLevelValue(b.lower),
        formatLevelValue(b.mid),
        formatLevelValue(b.upper),
        formatLevelValue(b.sd),
      ]),
    ],
    {
      hasBorder: true,
      contentHasMarkup: true,
      borderChars: "lightRounded",
      borderAttr: { color: "cyan" },
      textAttr: { bgColor: "default" },
      firstRowTextAttr: { bgColor: "cyan" },
      width: 120,
      fit: true,
    },
  );
  console.log(chalk.dim(`\nBands widen with volatility; price riding an edge is a stretch, not a signal.`));
  console.log("");
};

/** Echo the retracement levels so they can be read off without the chart. */
const logFibonacciSummary = (
  symbol: string,
  retracement: FibonacciRetracement,
): void => {
  const label = retracement.direction === "up"
    ? `retracing down from the ${formatLevelValue(retracement.swingHigh)} high`
    : `retracing up from the ${formatLevelValue(retracement.swingLow)} low`;

  console.log("");
  console.log(
    chalk.bold(
      `${symbol.toUpperCase()} — Fibonacci Retracement (${retracement.windowSize} bars, ${label})`,
    ),
  );
  console.log("");

  table(
    [
      ["Level", "Price"],
      ...retracement.levels.map((l) => [
        boldCell(l.label),
        formatLevelValue(l.value),
      ]),
    ],
    {
      hasBorder: true,
      contentHasMarkup: true,
      borderChars: "lightRounded",
      borderAttr: { color: "cyan" },
      textAttr: { bgColor: "default" },
      firstRowTextAttr: { bgColor: "cyan" },
      width: 60,
      fit: true,
    },
  );
  console.log(chalk.dim(`\n0% sits at the end of the swing, 100% at its start.`));
  console.log("");
};

/**
 * Chart an already-resolved price series with a Bollinger envelope over
 * `period` bars at `stddev` standard deviations (defaults: 20, 2).
 *
 * The shared half of the indicator: any menu able to produce a
 * `ResolvedSeries` draws its bands through here.
 */
export const runBollinger = (
  resolved: ResolvedSeries,
  period: number = DEFAULT_BOLLINGER_PERIOD,
  stddev: number = DEFAULT_BOLLINGER_STDDEV,
): Effect.Effect<CommandResult, ProgramError, ChartRenderer> =>
  Effect.gen(function* () {
    const bands = bollingerBands(resolved.points, period, stddev);
    if (bands.length === 0) {
      console.log(
        chalk.yellow(
          `Not enough data for ${period}-bar Bollinger Bands: ` +
            `${resolved.symbol.toUpperCase()} returned ${resolved.points.length} point(s).`,
        ),
      );
      return { type: CommandResultType.Error };
    }

    const chart = yield* ChartRenderer;
    yield* chart.renderTechnical(
      resolved.points,
      "timestamp",
      "value",
      bollingerBandsFor(resolved.points, period, stddev),
      `${resolved.symbol.toUpperCase()} Bollinger Bands (${period}, ${stddev})`,
    );

    yield* Effect.logDebug(`Computed ${bands.length} Bollinger bands`);
    logBollingerSummary(resolved.symbol, period, stddev, bands);

    return { type: CommandResultType.Success };
  });

/**
 * Resolve the symbol (argument, else the loaded crypto token) and chart its
 * Bollinger envelope.
 */
export const bollingerHandler = (
  symbolStr?: string,
  periodStr?: string,
  stddevStr?: string,
) =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;

    const period = parsePositiveInt(periodStr, DEFAULT_BOLLINGER_PERIOD);
    const stddev = parseNonNegative(stddevStr, DEFAULT_BOLLINGER_STDDEV);

    const resolved = yield* resolveSeries(symbolStr, lookbackDaysFor(period));
    if (!resolved) {
      return { result: { type: CommandResultType.Error }, state: st };
    }

    const result = yield* runBollinger(resolved, period, stddev);
    return { result, state: st };
  });

/**
 * Chart an already-resolved series with Fibonacci retracement levels drawn
 * over the most recent swing (the whole series unless `lookback` narrows it).
 */
export const runFibonacci = (
  resolved: ResolvedSeries,
  lookback?: number,
): Effect.Effect<CommandResult, ProgramError, ChartRenderer> =>
  Effect.gen(function* () {
    const retracement = fibonacciRetracement(resolved.points, lookback);
    if (!retracement) {
      console.log(
        chalk.yellow(
          `No swing to retrace for ${resolved.symbol.toUpperCase()}: ` +
            `needs at least two points at different prices.`,
        ),
      );
      return { type: CommandResultType.Error };
    }

    const chart = yield* ChartRenderer;
    yield* chart.renderTechnical(
      resolved.points,
      "timestamp",
      "value",
      fibonacciFor(resolved.points, lookback),
      `${resolved.symbol.toUpperCase()} Fibonacci Retracement (${retracement.windowSize} bars)`,
    );

    yield* Effect.logDebug(`Computed ${retracement.levels.length} retracement levels`);
    logFibonacciSummary(resolved.symbol, retracement);

    return { type: CommandResultType.Success };
  });

/**
 * Resolve the symbol (argument, else the loaded crypto token) and chart its
 * Fibonacci retracement levels.
 */
export const fibonacciHandler = (
  symbolStr?: string,
  lookbackStr?: string,
) =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;

    const lookback = parseOptionalPositiveInt(lookbackStr);

    const resolved = yield* resolveSeries(symbolStr, lookbackDaysFor(lookback ?? 0));
    if (!resolved) {
      return { result: { type: CommandResultType.Error }, state: st };
    }

    const result = yield* runFibonacci(resolved, lookback);
    return { result, state: st };
  });

/** Format a signed return: `+1.23%` / `-0.45%`. */
const formatReturn = (value: number): string =>
  `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

/** Colour a return by sign, as a table cell. */
const returnCell = (value: number): string =>
  value >= 0 ? greenCell(formatReturn(value)) : redCell(formatReturn(value));

/**
 * Echo the newest daily returns so the numbers are visible without the chart.
 *
 * Takes the already-computed `stats` so the deviation that sized the chart's
 * guide bands is the same number reported here.
 */
const logReturnsSummary = (
  symbol: string,
  returns: readonly ReturnPoint[],
  stats: ReturnStats,
): void => {
  const rows = returns.slice(-SUMMARY_ROWS);
  const band = RETURN_SIGMA_MULTIPLE * stats.sd;

  console.log("");
  console.log(
    chalk.bold(`${symbol.toUpperCase()} — Daily Returns (${stats.count} session(s))`),
  );
  console.log("");

  table(
    [
      ["Date", "Return"],
      ...rows.map((r) => [boldCell(toDateLabel(r.timestamp)), returnCell(r.value)]),
    ],
    {
      hasBorder: true,
      contentHasMarkup: true,
      borderChars: "lightRounded",
      borderAttr: { color: "cyan" },
      textAttr: { bgColor: "default" },
      firstRowTextAttr: { bgColor: "cyan" },
      width: 60,
      fit: true,
    },
  );
  console.log(
    chalk.dim(
      `\nMean ${formatReturn(stats.mean)} · daily sd ${stats.sd.toFixed(2)}% ` +
        `(${RETURN_SIGMA_MULTIPLE}σ ±${band.toFixed(2)}%) · ` +
        `range ${formatReturn(stats.min)} to ${formatReturn(stats.max)}`,
    ),
  );
  console.log("");
};

/**
 * Chart the daily percent returns of an already-resolved series: each price
 * measured against the previous price, drawn as bars coloured by sign (blue up,
 * red down) with a zero baseline and dotted guide lines at ±2 daily standard
 * deviations.
 */
export const runReturns = (
  resolved: ResolvedSeries,
): Effect.Effect<CommandResult, ProgramError, ChartRenderer> =>
  Effect.gen(function* () {
    const returns = dailyReturns(resolved.points);
    // Computed before the render call so the same deviation both sizes the
    // guide bands and is reported in the read-out below the chart.
    const stats = returnStats(returns);

    if (!stats) {
      console.log(
        chalk.yellow(
          `Not enough data for daily returns: ` +
            `${resolved.symbol.toUpperCase()} returned ${resolved.points.length} point(s).`,
        ),
      );
      return { type: CommandResultType.Error };
    }

    const chart = yield* ChartRenderer;
    yield* chart.renderTechnical(
      returns,
      "timestamp",
      "value",
      [...zeroLineOverlay(), ...sigmaBandsOverlay(stats.sd)],
      `${resolved.symbol.toUpperCase()} Daily Returns`,
      "Return (%)",
      returnsBars(returns),
    );

    yield* Effect.logDebug(`Computed ${returns.length} daily returns`);
    logReturnsSummary(resolved.symbol, returns, stats);

    return { type: CommandResultType.Success };
  });

/**
 * Resolve the symbol (argument, else the loaded crypto token) and chart its
 * daily percent returns.
 */
export const returnsHandler = (
  symbolStr?: string,
) =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;

    const resolved = yield* resolveSeries(symbolStr, lookbackDaysFor(0));
    if (!resolved) {
      return { result: { type: CommandResultType.Error }, state: st };
    }

    const result = yield* runReturns(resolved);
    return { result, state: st };
  });
