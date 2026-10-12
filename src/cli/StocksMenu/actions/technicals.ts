/**
 * Technical-analysis actions for the stocks menu.
 *
 * Same shape as the crypto equivalents: resolve the symbol, pull its daily
 * bars, compute one indicator, chart it, and print a small read-out table. The
 * indicator math lives in `src/technicals/` and the Plot marks in
 * `src/technicals/overlays.ts` — this file is only the plumbing.
 *
 * Unlike crypto (one data source), stocks can be backed by AlphaVantage,
 * Massive or Alpaca, so the shared series fetch branches on
 * `st.loadedContext.stocks.datasource` with Massive's `/v2/aggs` daily bars.
 * Handlers declare dependencies but do NOT provide layers; the menu index
 * supplies `StocksServiceLive`.
 */

import chalk from "chalk";
import { Effect, Option, Schema } from "effect";
import terminalKit from "terminal-kit";
import { AlphaVantageService, type ChartPoint } from "src/services/AlphaVantageService/index.ts";
import { AlpacaService } from "src/services/AlpacaService/index.ts";
import { ConfigService } from "src/cli/services/ConfigService.ts";
import { FetchService } from "src/cli/services/FetchService.ts";
import { HTTPError, HTTPErrorTag, type ProgramError } from "src/cli/errors/index.ts";
import { ChartRenderer } from "../services/ChartRenderer.ts";
import { CommandResultType, DataSourceType, TerminalUserStateConfigContext } from "../../types.ts";
import { boldCell, escapeTableMarkup, greenCell, redCell } from "../../utils/table_markup.ts";
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

const { terminal } = terminalKit;

/** The last bar of a Massive aggregate response. */
const MassiveAggRaw = Schema.Struct({
  t: Schema.Number,
  c: Schema.Number,
});
const MassiveAggsRaw = Schema.Struct({
  results: Schema.Array(MassiveAggRaw),
});

const MASSIVE_AGGS_URL = "https://api.massive.com/v2/aggs/ticker/{ticker}/range/1/day";

/** The number of indicator rows echoed back to the terminal after a chart. */
const SUMMARY_ROWS = 5;
/** Daily bars fetched when the datasource is Massive. */
const MASSIVE_LOOKBACK_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

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

/** Coerce cleaned daily bars into the indicator's series shape. */
export const toSeriesPoints = (bars: readonly ChartPoint[]): SeriesPoint[] =>
  bars
    .map((b) => ({ timestamp: b.timestamp, value: b.close }))
    .filter((p) => Number.isFinite(p.value) && Number.isFinite(p.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);

/**
 * Fetch a year of daily bars from Massive (`/v2/aggs`).
 *
 * Massive exposes only a spot quote on the plan in use, so the technicals need
 * the aggregate-bars endpoint directly. Fails with `HTTPError` when the key is
 * missing or the response is not the expected shape.
 */
export const fetchMassiveDailyBars = (
  symbol: string,
): Effect.Effect<SeriesPoint[], ProgramError, FetchService | ConfigService> =>
  Effect.gen(function* () {
    const config = yield* ConfigService;
    const apiKey = Option.getOrUndefined(config.MASSIVE_API_KEY);
    if (!apiKey) {
      return yield* new HTTPError({ message: "Missing Massive API Key." });
    }

    const fs = yield* FetchService;
    const to = new Date();
    const from = new Date(to.getTime() - MASSIVE_LOOKBACK_DAYS * DAY_MS);
    const params = new URLSearchParams({
      adjusted: "true",
      sort: "asc",
      limit: "50000",
      apiKey,
    });

    const url = `${MASSIVE_AGGS_URL.replace("{ticker}", symbol.toUpperCase())}/` +
      `${toDateLabel(from.getTime())}/${toDateLabel(to.getTime())}`;

    const raw = yield* fs.fetchJson(url, params);
    const validated = yield* Schema.decodeUnknown(MassiveAggsRaw)(raw).pipe(
      Effect.catchTag("ParseError", (e) =>
        Effect.fail(new HTTPError({ message: `Invalid Massive bars response shape: ${e.message}` }))),
    );

    return toSeriesPoints(
      validated.results.map((r) => ({
        date: toDateLabel(r.t),
        open: r.c,
        high: r.c,
        low: r.c,
        close: r.c,
        volume: 0,
        timestamp: r.t,
      })),
    );
  });

/**
 * Fetch a year of daily bars from Alpaca (`/v2/stocks/{symbol}/bars`).
 *
 * The Alpaca service owns the auth headers and pagination; this wrapper only
 * shapes the request symbol and logs the source. A missing credential surfaces
 * as a `ConfigError` from the service.
 */
export const fetchAlpacaDailyBars = (
  symbol: string,
): Effect.Effect<ChartPoint[], ProgramError, AlpacaService> =>
  Effect.gen(function* () {
    const alpaca = yield* AlpacaService;
    yield* Effect.logInfo(`Fetching Alpaca daily bars for ${symbol}`);
    return yield* alpaca.getStockChart({
      name: symbol.toUpperCase(),
      id: symbol.toLowerCase(),
      _type: DataSourceType.Alpaca,
    });
  });

/** Resolve the symbol and fetch its daily series from the active datasource. */
const resolveSeries = (
  symbolStr?: string,
): Effect.Effect<
  { symbol: string; points: SeriesPoint[] } | null,
  ProgramError,
  AlphaVantageService | AlpacaService | FetchService | ConfigService | TerminalUserStateConfigContext
> =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    const symbol = symbolStr ||
      (st.loadedContext as { token?: { symbol?: string } })?.token?.symbol;

    if (!symbol) {
      console.log(chalk.red("No symbol provided"));
      return null;
    }

    const datasource = st.loadedContext.stocks.datasource;

    if (datasource === DataSourceType.Massive) {
      const points = yield* fetchMassiveDailyBars(symbol);
      return { symbol, points };
    }

    if (datasource === DataSourceType.Alpaca) {
      // Alpaca's account-level failures (403 entitlement, 400 bad symbol) would
      // otherwise be reduced to a bare "Invalid command" by the runner, so
      // surface the API's own message and stop instead.
      const bars = yield* fetchAlpacaDailyBars(symbol).pipe(
        Effect.catchTag(HTTPErrorTag, (e: { message: string }) =>
          Effect.sync(() => {
            console.log(
              chalk.red(`Alpaca daily-bars request failed for ${symbol.toUpperCase()}.`),
            );
            console.log(chalk.dim(e.message));
            return null;
          })),
      );
      if (bars === null) return null;
      return { symbol, points: toSeriesPoints(bars) };
    }

    const av = yield* AlphaVantageService;
    yield* Effect.logInfo(`Fetching daily bars for ${symbol}`);
    const bars = yield* av.getChart({
      name: symbol.toUpperCase(),
      id: symbol.toLowerCase(),
      _type: DataSourceType.AlphaVantage,
    });
    return { symbol, points: toSeriesPoints(bars) };
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
 * Chart the daily bars with a Bollinger envelope over `period` bars at
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

    const resolved = yield* resolveSeries(symbolStr);
    if (!resolved) {
      return { result: { type: CommandResultType.Error }, state: st };
    }

    const bands = bollingerBands(resolved.points, period, stddev);
    if (bands.length === 0) {
      console.log(
        chalk.yellow(
          `Not enough data for ${period}-bar Bollinger Bands: ` +
            `${resolved.symbol.toUpperCase()} returned ${resolved.points.length} bar(s).`,
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
 * Chart the daily bars with Fibonacci retracement levels over the most recent
 * swing (the whole series unless `lookbackStr` narrows the window).
 */
export const fibonacciHandler = (
  symbolStr?: string,
  lookbackStr?: string,
) =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;

    const lookback = parseOptionalPositiveInt(lookbackStr);

    const resolved = yield* resolveSeries(symbolStr);
    if (!resolved) {
      return { result: { type: CommandResultType.Error }, state: st };
    }

    const retracement = fibonacciRetracement(resolved.points, lookback);
    if (!retracement) {
      console.log(
        chalk.yellow(
          `No swing to retrace for ${resolved.symbol.toUpperCase()}: ` +
            `needs at least two bars at different prices.`,
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

/** Format a signed return: `+1.23%` / `-0.45%`. */
const formatReturn = (value: number): string =>
  `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

/** Colour a return by sign, as a terminal-kit markup cell. */
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

  terminal.table(
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
 * Chart the daily percent returns of the series: each close measured against
 * the previous close, drawn as bars coloured by sign (blue up, red down) with
 * a zero baseline and dotted guide lines at ±2 daily standard deviations.
 * Uses the active datasource (AlphaVantage, Massive or Alpaca).
 */
export const returnsHandler = (
  symbolStr?: string,
) =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;

    const resolved = yield* resolveSeries(symbolStr);
    if (!resolved) {
      return { result: { type: CommandResultType.Error }, state: st };
    }

    const returns = dailyReturns(resolved.points);
    // Computed before the render call so the same deviation both sizes the
    // guide bands and is reported in the read-out below the chart.
    const stats = returnStats(returns);

    if (!stats) {
      console.log(
        chalk.yellow(
          `Not enough data for daily returns: ` +
            `${resolved.symbol.toUpperCase()} returned ${resolved.points.length} bar(s).`,
        ),
      );
      return { result: { type: CommandResultType.Error }, state: st };
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

    return { result: { type: CommandResultType.Success }, state: st };
  });
