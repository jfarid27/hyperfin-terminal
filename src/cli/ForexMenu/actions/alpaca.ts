import chalk from "chalk";
import { Effect } from "effect";
import type { ForexChartPoint, ForexQuote } from "src/services/ForexService/types.ts";
import { AlpacaService } from "src/services/AlpacaService/index.ts";
import { filterPointsByRange, resolveDateRange } from "src/services/ForexService/index.ts";
import { CommandResultType, DataSourceType, TerminalUserStateConfigContext } from "../../types.ts";
import type { TerminalUserStateConfig } from "../../types.ts";
import { ChartRenderer } from "../../StocksMenu/services/ChartRenderer.ts";
import { forexChartTitle, parsePair } from "./alphavantage.ts";
import terminalKit from "terminal-kit";
import { boldCell, escapeTableMarkup } from "../../utils/table_markup.ts";
const { terminal } = terminalKit;

const errorState = (st: TerminalUserStateConfig) => ({
  result: { type: CommandResultType.Error },
  state: st,
});

const successState = (st: TerminalUserStateConfig) => ({
  result: { type: CommandResultType.Success },
  state: st,
});

/** Latest forex rate for a currency pair via Alpaca. */
export const forexSpotHandler = (fromStr?: string, toStr?: string) =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;

    const pair = parsePair(fromStr, toStr);
    if (!pair) {
      console.log(chalk.red("Invalid or missing currency pair. Usage: spot <from> <to> (e.g. spot EUR USD)"));
      console.log(chalk.dim("Both currencies must be 3-letter ISO codes and must differ."));
      return errorState(st);
    }

    const alpaca = yield* AlpacaService;
    yield* Effect.logInfo(`Fetching Alpaca ${pair.from}/${pair.to} spot rate`);

    const quote: ForexQuote = yield* alpaca.getForexSpot({
      from: pair.from,
      to: pair.to,
      _type: DataSourceType.Alpaca,
    });

    console.log(chalk.bold(`\n${quote.from}/${quote.to} — Alpaca`));
    console.log("");

    terminal.table(
      [
        ["Pair", "Rate", "Bid", "Ask", "Refreshed"],
        [
          boldCell(`${quote.from}/${quote.to}`),
          boldCell(quote.rate.toFixed(4)),
          quote.bid.toFixed(4),
          quote.ask.toFixed(4),
          escapeTableMarkup(`${quote.lastRefreshed} ${quote.timeZone}`),
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
 * Daily FX rate chart for a currency pair via Alpaca over a resolved date range.
 *
 * Alpaca's historical-rates endpoint carries bid/mid/ask only (no OHLC), so the
 * chart plots the mid price.
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

    const alpaca = yield* AlpacaService;
    yield* Effect.logInfo(`Fetching Alpaca ${pairLabel} FX daily data`);

    const allPoints: ForexChartPoint[] = yield* alpaca.getForexDaily({
      from: pair.from,
      to: pair.to,
      _type: DataSourceType.Alpaca,
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

    console.log(chalk.bold(`\n${pairLabel} — ${startDate} to ${endDate} (Alpaca)`));
    console.log(
      `Latest: ${chalk.bold.white(latest.close.toFixed(4))}  ${direction} ${changeColor(`${change.toFixed(4)}`)}`,
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
