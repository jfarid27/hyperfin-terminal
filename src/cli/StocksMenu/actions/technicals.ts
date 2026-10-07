/**
 * Technical-analysis actions for the stocks menu.
 *
 * Same shape as the crypto equivalents: resolve the symbol, pull its daily
 * bars, compute one indicator, chart it, and print a small read-out table. The
 * indicator math lives in `src/technicals/` and the Plot marks in
 * `src/technicals/overlays.ts` — this file is only the plumbing.
 *
 * Unlike crypto (one data source), stocks can be backed by AlphaVantage or
 * Massive, so the shared series fetch branches on `st.loadedContext.stocks.datasource`
 * with Massive's `/v2/aggs` daily bars. Handlers declare dependencies but do
 * NOT provide layers; the menu index supplies `StocksServiceLive`.
 */

import chalk from "chalk";
import { Effect, Option, Schema } from "effect";
import terminalKit from "terminal-kit";
import { AlphaVantageService, type ChartPoint } from "src/services/AlphaVantageService/index.ts";
import { ConfigService } from "src/cli/services/ConfigService.ts";
import { FetchService } from "src/cli/services/FetchService.ts";
import { HTTPError, type ProgramError } from "src/cli/errors/index.ts";
import { ChartRenderer } from "../services/ChartRenderer.ts";
import { CommandResultType, DataSourceType, TerminalUserStateConfigContext } from "../../types.ts";
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

/** Resolve the symbol and fetch its daily series from the active datasource. */
const resolveSeries = (
  symbolStr?: string,
): Effect.Effect<
  { symbol: string; points: SeriesPoint[] } | null,
  ProgramError,
  AlphaVantageService | FetchService | ConfigService | TerminalUserStateConfigContext
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
