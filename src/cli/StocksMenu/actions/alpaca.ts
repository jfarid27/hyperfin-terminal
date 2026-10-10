import chalk from "chalk";
import { AlpacaService } from "src/services/AlpacaService/index.ts";
import type { ChartPoint, SpotQuote } from "src/services/AlphaVantageService/index.ts";
import { ChartRenderer } from "../services/ChartRenderer.ts";
import { CommandResultType, DataSourceType, TerminalUserStateConfigContext } from "../../types.ts";
import { Effect } from "effect";

const getLoadedToken = (st: unknown): string | undefined =>
  (st as { loadedContext?: { token?: { symbol?: string } } })?.loadedContext?.token?.symbol;

/** Latest Alpaca stock snapshot, rendered like the AlphaVantage spot table. */
export const spotPriceHandler = (symbolStr: string) =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    const symbol = symbolStr || getLoadedToken(st);

    if (!symbol) {
      console.log(chalk.red("No symbol provided"));
      return { result: { type: CommandResultType.Error }, state: st };
    }

    const alpaca = yield* AlpacaService;
    const quote: SpotQuote = yield* alpaca.getStockSpot({
      name: symbol.toUpperCase(),
      id: symbol.toLowerCase(),
      _type: DataSourceType.Alpaca,
    });

    const direction = quote.change >= 0 ? chalk.green("▲") : chalk.red("▼");
    const changeColor = quote.change >= 0 ? chalk.green : chalk.red;

    console.log(chalk.bold(`\n${quote.symbol} — ${quote.latestTradingDay} (Alpaca)`));
    console.log(`Price:  ${chalk.bold.white(`$${quote.price.toFixed(2)}`)}  ${direction} ${changeColor(`${quote.change.toFixed(2)} (${quote.changePercent})`)}`);
    console.log(`Open:   $${quote.open.toFixed(2)}`);
    console.log(`High:   $${quote.high.toFixed(2)}`);
    console.log(`Low:    $${quote.low.toFixed(2)}`);
    console.log(`Prev:   $${quote.previousClose.toFixed(2)}`);
    console.log(`Volume: ${quote.volume.toLocaleString()}\n`);

    return { result: { type: CommandResultType.Success }, state: st };
  });

/** Daily close chart from Alpaca daily bars (trailing year). */
export const chartPriceHandler = (symbolStr: string) =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    const symbol = symbolStr || getLoadedToken(st);

    if (!symbol) {
      console.log(chalk.red("No symbol provided"));
      return { result: { type: CommandResultType.Error }, state: st };
    }

    const alpaca = yield* AlpacaService;
    const points: ChartPoint[] = yield* alpaca.getStockChart({
      name: symbol.toUpperCase(),
      id: symbol.toLowerCase(),
      _type: DataSourceType.Alpaca,
    });

    yield* Effect.logDebug(`Fetched ${points.length} Alpaca chart points`);

    if (points.length === 0) {
      console.log(chalk.red("No chart data returned from Alpaca."));
      return { result: { type: CommandResultType.Error }, state: st };
    }

    const chart = yield* ChartRenderer;
    yield* chart.render(points, "timestamp", "close", `${symbol.toUpperCase()} Price Chart`);

    return { result: { type: CommandResultType.Success }, state: st };
  });
