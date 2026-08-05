import { MassiveService } from "../services/MassiveService.ts";
import type { SpotQuote } from "../services/AlphaVantageService.ts";
import { DataSourceType, TerminalUserStateConfigContext } from "../../types.ts";
import { CommandResultType } from "../../types.ts";
import { Effect } from "effect";
import chalk from "chalk";

export const spotPriceHandler = (symbolStr: string) =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    const symbol = symbolStr.toUpperCase();

    if (!symbol) {
      console.log(chalk.red("No symbol provided"));
      return { result: { type: CommandResultType.Error }, state: st };
    }

    const symbolObj = {
      name: symbol,
      id: symbol.toLowerCase(),
      _type: DataSourceType.Massive,
    };

    const massive = yield* MassiveService;
    const quote: SpotQuote = yield* massive.getSpot(symbolObj);

    const direction = quote.change >= 0 ? chalk.green("▲") : chalk.red("▼");
    const changeColor = quote.change >= 0 ? chalk.green : chalk.red;

    console.log(chalk.bold(`\n${quote.symbol} — ${quote.latestTradingDay}`));
    console.log(
      `Price:  ${chalk.bold.white(`$${quote.price.toFixed(2)}`)}  ${direction} ${changeColor(`${quote.change.toFixed(2)} (${quote.changePercent})`)}`,
    );
    console.log(`Open:   $${quote.open.toFixed(2)}`);
    console.log(`High:   $${quote.high.toFixed(2)}`);
    console.log(`Low:    $${quote.low.toFixed(2)}`);
    console.log(`Prev:   $${quote.previousClose.toFixed(2)}`);
    console.log(`Volume: ${quote.volume.toLocaleString()}\n`);

    return { result: { type: CommandResultType.Success }, state: st };
  });
