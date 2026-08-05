import chalk from "chalk";
import { YahooFinanceOptions } from "../../../services/OptionsService/YahooFinanceOptionsService.ts";
import type { OptionsChain, OptionContract } from "../../../services/OptionsService/types.ts";
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

export const chainHandler = (symbolStr: string, dateStr?: string) =>
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

    // Resolve the target expiration
    let targetExp: number;
    if (dateStr) {
      // Try parsing as an index (1-based, "1" = nearest)
      const idx = parseInt(dateStr);
      if (!Number.isNaN(idx) && idx >= 1 && idx <= expirations.length) {
        targetExp = expirations[idx - 1];
      } else {
        // Try parsing as a date string (YYYY-MM-DD)
        const targetDate = new Date(dateStr);
        if (!Number.isNaN(targetDate.getTime())) {
          const targetUnix = targetDate.getTime() / 1000;
          const match = expirations.find((e) => {
            const expDate = new Date(e * 1000).toISOString().slice(0, 10);
            return expDate === dateStr || Math.abs(e - targetUnix) < 86400;
          });
          if (match) {
            targetExp = match;
          } else {
            console.log(chalk.red(`Expiration ${dateStr} not found. Available: ${expirations.map((e) => new Date(e * 1000).toISOString().slice(0, 10)).join(", ")}`));
            return { result: { type: CommandResultType.Error }, state: st };
          }
        } else {
          console.log(chalk.red(`Invalid date or index: ${dateStr}. Use YYYY-MM-DD or a 1-based index.`));
          return { result: { type: CommandResultType.Error }, state: st };
        }
      }
    } else {
      targetExp = expirations[0];
    }

    const chain: OptionsChain = yield* yf.getChain(symbolObj, targetExp);
    const expDate = new Date(targetExp * 1000).toISOString().slice(0, 10);

    console.log(chalk.bold(`\n${chain.ticker} Options — ${expDate}`));
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
