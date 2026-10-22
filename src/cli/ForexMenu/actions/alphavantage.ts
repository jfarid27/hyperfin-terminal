import chalk from "chalk";
import { Effect } from "effect";
import type { ForexChartPoint, ForexQuote } from "src/services/ForexService/types.ts";
import { ForexService, filterPointsByRange, resolveDateRange } from "src/services/ForexService/index.ts";
import { DataSourceType, TerminalUserStateConfigContext } from "../../types.ts";
import { CommandResultType } from "../../types.ts";
import type { TerminalUserStateConfig } from "../../types.ts";
import { ChartRenderer } from "../../StocksMenu/services/ChartRenderer.ts";
import { boldCell } from "../../utils/table_markup.ts";
import { table } from "../../utils/table.ts";

/** Error shape for a command that cannot proceed. */
const errorState = (st: TerminalUserStateConfig) => ({
  result: { type: CommandResultType.Error },
  state: st,
});

const successState = (st: TerminalUserStateConfig) => ({
  result: { type: CommandResultType.Success },
  state: st,
});

/**
 * Normalise two user-supplied currency codes into an AlphaVantage forex pair.
 * Codes are trimmed and upper-cased; anything that is not exactly three
 * letters, or a pair of identical currencies, is rejected.
 */
export const parsePair = (
  fromStr: string | undefined,
  toStr: string | undefined,
): { from: string; to: string } | null => {
  const clean = (value: string | undefined): string | null => {
    const code = (value ?? "").trim().toUpperCase();
    return /^[A-Z]{3}$/.test(code) ? code : null;
  };

  const from = clean(fromStr);
  const to = clean(toStr);
  if (!from || !to) return null;
  if (from === to) return null;
  return { from, to };
};

/**
 * Title shown on a forex chart, e.g. "EUR/USD FX - 2025-10-07 to 2026-10-07".
 * Labels the pair along with the resolved (inclusive) date range.
 */
export const forexChartTitle = (pair: string, startDate: string, endDate: string): string =>
  `${pair} FX - ${startDate} to ${endDate}`;

/** Widest rate precision shown — enough for a sub-0.001 rate like KRW/USD. */
const MAX_RATE_DECIMALS = 8;

/**
 * Decimals needed to show roughly four significant digits of an FX rate.
 *
 * A fixed four decimals is wrong for a JPY cross: `JPY/USD` trades near 0.0065,
 * where `toFixed(4)` renders 0.0065 and throws away most of the price. Majors
 * (`EUR/USD` ≈ 1.0854, `USD/JPY` ≈ 152.34) keep the familiar four decimals.
 */
export const rateDecimals = (value: number): number => {
  if (!Number.isFinite(value) || value === 0) return 4;
  return Math.min(
    MAX_RATE_DECIMALS,
    Math.max(4, 4 - Math.floor(Math.log10(Math.abs(value)))),
  );
};

/** Format an FX rate, defaulting to the precision its magnitude calls for. */
export const formatRate = (value: number, decimals: number = rateDecimals(value)): string =>
  Number.isFinite(value) ? value.toFixed(decimals) : "n/a";

/**
 * Latest realtime exchange rate for a currency pair.
 *
 * Usage: `spot <from> <to>` (e.g. `spot EUR USD`).
 */
export const forexSpotHandler = (fromStr?: string, toStr?: string) =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;

    const pair = parsePair(fromStr, toStr);
    if (!pair) {
      console.log(chalk.red("Invalid or missing currency pair. Usage: spot <from> <to> (e.g. spot EUR USD)"));
      console.log(chalk.dim("Both currencies must be 3-letter ISO codes and must differ."));
      return errorState(st);
    }

    const forex = yield* ForexService;
    yield* Effect.logInfo(`Fetching ${pair.from}/${pair.to} spot rate`);

    const quote: ForexQuote = yield* forex.getSpot({
      from: pair.from,
      to: pair.to,
      _type: DataSourceType.AlphaVantage,
    });

    console.log(chalk.bold(`\n${quote.from}/${quote.to} — ${quote.fromName} / ${quote.toName}`));
    console.log("");

    table(
      [
        ["Pair", "Rate", "Bid", "Ask", "Refreshed"],
        [
          boldCell(`${quote.from}/${quote.to}`),
          boldCell(formatRate(quote.rate)),
          formatRate(quote.bid),
          formatRate(quote.ask),
          `${quote.lastRefreshed} ${quote.timeZone}`,
        ],
      ],
      {
        hasBorder: true,
        contentHasMarkup: true,
        borderChars: "lightRounded",
        borderAttr: { color: "cyan" },
        textAttr: { bgColor: "default" },
        firstRowTextAttr: { bgColor: "cyan" },
        width: 100,
        fit: true,
      },
    );
    console.log("");

    return successState(st);
  });

/**
 * Daily FX OHLC chart for a currency pair over a resolved date range.
 *
 * Usage: `chart <from> <to> [fromDate] [toDate]` (dates in YYYY-MM-DD).
 *   - no dates      → trailing 1 year
 *   - fromDate only → fromDate through today
 *   - both dates    → exactly fromDate through toDate
 */
export const forexChartHandler = (
  fromStr?: string,
  toStr?: string,
  dateFrom?: string,
  dateTo?: string,
) =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;

    const pair = parsePair(fromStr, toStr);
    if (!pair) {
      console.log(chalk.red("Invalid or missing currency pair. Usage: chart <from> <to> [fromDate] [toDate]"));
      console.log(chalk.dim("Both currencies must be 3-letter ISO codes and must differ."));
      return errorState(st);
    }

    const range = resolveDateRange(dateFrom, dateTo);
    if (!range) {
      console.log(chalk.red("Invalid date range. Use YYYY-MM-DD dates with <from> on or before <to>."));
      console.log(chalk.dim("Examples: chart EUR USD · chart EUR USD 2026-01-01 · chart EUR USD 2026-01-01 2026-06-30"));
      return errorState(st);
    }

    const startDate = new Date(range.start).toISOString().slice(0, 10);
    const endDate = new Date(range.end).toISOString().slice(0, 10);
    const pairLabel = `${pair.from}/${pair.to}`;

    const forex = yield* ForexService;
    yield* Effect.logInfo(`Fetching ${pairLabel} FX daily data`);

    const allPoints: ForexChartPoint[] = yield* forex.getDaily({
      from: pair.from,
      to: pair.to,
      _type: DataSourceType.AlphaVantage,
    });

    const points = filterPointsByRange(allPoints, range);
    yield* Effect.logDebug(`Filtered ${points.length} of ${allPoints.length} daily FX points`);

    if (points.length === 0) {
      console.log(chalk.yellow(`No ${pairLabel} data between ${startDate} and ${endDate}.`));
      console.log(chalk.dim(`Available history: ${allPoints[0]?.date ?? "none"} → ${allPoints[allPoints.length - 1]?.date ?? "none"}`));
      return errorState(st);
    }

    const first = points[0];
    const latest = points[points.length - 1];
    const change = latest.close - first.close;
    const direction = change >= 0 ? chalk.green("▲") : chalk.red("▼");
    const changeColor = change >= 0 ? chalk.green : chalk.red;

    console.log(chalk.bold(`\n${pairLabel} — ${startDate} to ${endDate}`));
    // Quote the delta at the price's own precision so the two read together.
    const decimals = rateDecimals(latest.close);
    console.log(
      `Latest: ${chalk.bold.white(formatRate(latest.close, decimals))}  ${direction} ${
        changeColor(formatRate(change, decimals))
      }`,
    );
    console.log(chalk.dim(`${points.length} data points · ${first.date} → ${latest.date}\n`));

    const chart = yield* ChartRenderer;
    yield* chart.render(
      points as unknown as Record<string, unknown>[],
      "timestamp",
      "close",
      forexChartTitle(pairLabel, startDate, endDate),
    );

    return successState(st);
  });
