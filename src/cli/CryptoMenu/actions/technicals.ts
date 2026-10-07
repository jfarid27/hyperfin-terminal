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
 */

import chalk from "chalk";
import { Effect } from "effect";
import terminalKit from "terminal-kit";
import { CoinGeckoModel } from "../model/index.ts";
import { ChartRenderer } from "../../StocksMenu/services/ChartRenderer.ts";
import {
  CommandResultType,
  DataSourceType,
  TerminalUserStateConfigContext,
} from "../../types.ts";
import type { ProgramError } from "../../errors/index.ts";
import { getLoadedToken } from "../../utils/index.ts";
import { boldCell, escapeTableMarkup } from "../../utils/table_markup.ts";
import {
  bollingerBands,
  type BollingerPoint,
  DEFAULT_BOLLINGER_PERIOD,
  DEFAULT_BOLLINGER_STDDEV,
  fibonacciRetracement,
  type FibonacciRetracement,
  type SeriesPoint,
} from "../../../technicals/index.ts";
import { bollingerBandsFor, fibonacciFor, formatLevelValue } from "../../../technicals/overlays.ts";

const { terminal } = terminalKit;

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
interface ResolvedSeries {
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

  terminal.table(
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

  terminal.table(
    [
      ["Level", "Price"],
      ...retracement.levels.map((l) => [
        boldCell(escapeTableMarkup(l.label)),
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
 * Chart the price series with a Bollinger envelope over `period` bars at
 * `stddev` standard deviations (defaults: 20, 2).
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

    const bands = bollingerBands(resolved.points, period, stddev);
    if (bands.length === 0) {
      console.log(
        chalk.yellow(
          `Not enough data for ${period}-bar Bollinger Bands: ` +
            `${resolved.symbol.toUpperCase()} returned ${resolved.points.length} point(s).`,
        ),
      );
      return { result: { type: CommandResultType.Error }, state: st };
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

    return { result: { type: CommandResultType.Success }, state: st };
  });

/**
 * Chart the price series with Fibonacci retracement levels drawn over the most
 * recent swing (the whole series unless `lookbackStr` narrows the window).
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

    const retracement = fibonacciRetracement(resolved.points, lookback);
    if (!retracement) {
      console.log(
        chalk.yellow(
          `No swing to retrace for ${resolved.symbol.toUpperCase()}: ` +
            `needs at least two points at different prices.`,
        ),
      );
      return { result: { type: CommandResultType.Error }, state: st };
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

    return { result: { type: CommandResultType.Success }, state: st };
  });
