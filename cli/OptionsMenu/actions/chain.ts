import chalk from "chalk";
import { YahooFinanceOptions } from "../services/YahooFinanceOptionsService.ts";
import type { OptionsChain, OptionContract } from "../types.ts";
import { DataSourceType, TerminalUserStateConfigContext } from "../../types.ts";
import { CommandResultType } from "../../types.ts";
import { Effect } from "effect";
import terminalKit from "terminal-kit";
const { terminal } = terminalKit;

const getLoadedToken = (st: any): string | undefined =>
  st?.loadedContext?.token?.symbol;

const toTableRow = (c: OptionContract) => [
  c.contractSymbol.slice(-15),
  c.inTheMoney ? chalk.green("ITM") : chalk.red("OTM"),
  c.strike.toFixed(1),
  c.lastPrice.toFixed(2),
  c.bid.toFixed(2),
  c.ask.toFixed(2),
  c.volume.toLocaleString(),
  c.openInterest.toLocaleString(),
  (c.impliedVolatility * 100).toFixed(1) + "%",
];

export const chainHandler = (symbolStr: string) =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    const symbol = symbolStr || getLoadedToken(st);

    if (!symbol) {
      console.log(chalk.red("No symbol provided"));
      return { result: { type: CommandResultType.Error }, state: st };
    }

    const symbolObj = {
      name: symbol.toUpperCase(),
      id: symbol.toUpperCase(),
      _type: DataSourceType.YahooFinance,
    };

    const yf = yield* YahooFinanceOptions;

    yield* Effect.logInfo(`Fetching options chain for ${symbol.toUpperCase()}`);
    const expirations = yield* yf.getExpirations(symbolObj);

    if (expirations.length === 0) {
      console.log(chalk.red("No options expirations found"));
      return { result: { type: CommandResultType.Error }, state: st };
    }

    const nearestExp = expirations[0];
    const chain: OptionsChain = yield* yf.getChain(symbolObj, nearestExp);

    console.log(chalk.bold(`\n${chain.ticker} Options — ${chain.expirationDate}`));
    console.log(chalk.dim(`Underlying: $${chain.underlyingPrice.toFixed(2)}  ·  ${chain.calls.length + chain.puts.length} contracts across ${expirations.length} expirations`));
    console.log("");

    const header = ["Contract", "", "Strike", "Last", "Bid", "Ask", "Vol", "OI", "IV"];

    if (chain.calls.length > 0) {
      console.log(chalk.bold.green(`CALLS (${chain.calls.length})`));
      terminal.table(
        [header, ...chain.calls.map(toTableRow)],
        {
          hasBorder: true,
          contentHasMarkup: true,
          borderChars: "lightRounded",
          borderAttr: { color: "green" },
          textAttr: { bgColor: "default" },
          firstRowTextAttr: { bgColor: "green" },
          width: 120,
          fit: true,
        },
      );
      console.log("");
    }

    if (chain.puts.length > 0) {
      console.log(chalk.bold.red(`PUTS (${chain.puts.length})`));
      terminal.table(
        [header, ...chain.puts.map(toTableRow)],
        {
          hasBorder: true,
          contentHasMarkup: true,
          borderChars: "lightRounded",
          borderAttr: { color: "red" },
          textAttr: { bgColor: "default" },
          firstRowTextAttr: { bgColor: "red" },
          width: 120,
          fit: true,
        },
      );
      console.log("");
    }

    return { result: { type: CommandResultType.Success }, state: st };
  });
