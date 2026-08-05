import chalk from "chalk";
import { AlphaVantageService, type SpotQuote, type ChartPoint } from "src/services/AlphaVantageService/index.ts";
import { ChartRenderer } from "../services/ChartRenderer.ts";
import { DataSourceType, TerminalUserStateConfigContext } from "../../types.ts";
import { CommandResultType } from "../../types.ts";
import { Effect } from "effect";

const getLoadedToken = (st: any): string | undefined =>
  st?.loadedContext?.token?.symbol;

export const spotPriceHandler = (symbolStr: string) =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    const symbol = symbolStr || getLoadedToken(st);

    if (!symbol) {
      console.log(chalk.red("No symbol provided"));
      return { result: { type: CommandResultType.Error }, state: st };
    }

    const symbolObj = {
      name: symbol.toUpperCase(),
      id: symbol.toLowerCase(),
      _type: DataSourceType.AlphaVantage,
    };

    const av = yield* AlphaVantageService;
    const quote: SpotQuote = yield* av.getSpot(symbolObj);

    const direction = quote.change >= 0 ? chalk.green("▲") : chalk.red("▼");
    const changeColor = quote.change >= 0 ? chalk.green : chalk.red;

    console.log(chalk.bold(`\n${quote.symbol} — ${quote.latestTradingDay}`));
    console.log(`Price:  ${chalk.bold.white(`$${quote.price.toFixed(2)}`)}  ${direction} ${changeColor(`${quote.change.toFixed(2)} (${quote.changePercent})`)}`);
    console.log(`Open:   $${quote.open.toFixed(2)}`);
    console.log(`High:   $${quote.high.toFixed(2)}`);
    console.log(`Low:    $${quote.low.toFixed(2)}`);
    console.log(`Prev:   $${quote.previousClose.toFixed(2)}`);
    console.log(`Volume: ${quote.volume.toLocaleString()}\n`);

    return { result: { type: CommandResultType.Success }, state: st };
  });

export const chartPriceHandler = (symbolStr: string) =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    const symbol = symbolStr || getLoadedToken(st);

    if (!symbol) {
      console.log(chalk.red("No symbol provided"));
      return { result: { type: CommandResultType.Error }, state: st };
    }

    const symbolObj = {
      name: symbol.toUpperCase(),
      id: symbol.toLowerCase(),
      _type: DataSourceType.AlphaVantage,
    };

    const av = yield* AlphaVantageService;
    const points: ChartPoint[] = yield* av.getChart(symbolObj);

    yield* Effect.logDebug(`Fetched ${points.length} chart points`);

    const chart = yield* ChartRenderer;
    yield* chart.render(points, "timestamp", "close", `${symbol.toUpperCase()} Price Chart`);

    return { result: { type: CommandResultType.Success }, state: st };
  });
