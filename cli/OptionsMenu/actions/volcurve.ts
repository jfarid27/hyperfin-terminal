import { Effect } from "effect";
import { YahooFinanceOptions } from "../services/YahooFinanceOptionsService.ts";
import type { OptionContract } from "../types.ts";
import { DataSourceType, TerminalUserStateConfigContext } from "../../types.ts";
import { CommandResultType } from "../../types.ts";
import { showNumericLineChart } from "../../components/charting.ts";
import chalk from "chalk";

const getLoadedToken = (st: any): string | undefined =>
  st?.loadedContext?.token?.symbol;

/**
 * Resolve an expiration from a date string or index against the expirations list.
 * Returns the Unix timestamp for the matched expiration, or undefined on failure.
 */
const resolveExpiration = (
  dateStr: string | undefined,
  expirations: readonly number[],
): number | undefined => {
  if (!dateStr) return expirations[0];

  const idx = parseInt(dateStr);
  if (!Number.isNaN(idx) && idx >= 1 && idx <= expirations.length) {
    return expirations[idx - 1];
  }

  const targetDate = new Date(dateStr);
  if (!Number.isNaN(targetDate.getTime())) {
    const match = expirations.find((e) => {
      const expDate = new Date(e * 1000).toISOString().slice(0, 10);
      return expDate === dateStr;
    });
    return match;
  }

  return undefined;
};

export const volcurveHandler = (symbolStr: string, typeStr?: string, dateStr?: string) =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    const symbol = symbolStr || getLoadedToken(st);

    if (!symbol) {
      console.log(chalk.red("No symbol provided"));
      return { result: { type: CommandResultType.Error }, state: st };
    }

    const optionType = typeStr?.toLowerCase() === "put" ? "put" : "call";

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

    const targetExp = resolveExpiration(dateStr, expirations);
    if (targetExp === undefined) {
      const available = expirations.map((e) => new Date(e * 1000).toISOString().slice(0, 10)).join(", ");
      console.log(chalk.red(`Expiration not found. Available: ${available}`));
      return { result: { type: CommandResultType.Error }, state: st };
    }

    const chain = yield* yf.getChain(symbolObj, targetExp);
    const expDate = new Date(targetExp * 1000).toISOString().slice(0, 10);
    const contracts = optionType === "call" ? chain.calls : chain.puts;

    if (contracts.length === 0) {
      console.log(chalk.red(`No ${optionType}s found for this expiration`));
      return { result: { type: CommandResultType.Error }, state: st };
    }

    // Build data points: { strike, iv } — filter out zero/trivial IV
    const points = contracts
      .filter((c) => c.impliedVolatility > 0.001)
      .map((c) => ({
        strike: c.strike,
        iv: c.impliedVolatility * 100, // convert to percentage
      }))
      .sort((a, b) => a.strike - b.strike);

    console.log(chalk.bold(`\n${symbol.toUpperCase()} ${optionType.toUpperCase()} Volatility Curve — ${expDate}`));
    console.log(chalk.dim(`Underlying: $${chain.underlyingPrice.toFixed(2)}  ·  ${points.length} contracts`));
    console.log("");

    yield* showNumericLineChart(
      points,
      "strike",
      "iv",
      `${symbol.toUpperCase()} ${optionType.toUpperCase()} IV Curve — ${expDate}`,
    );

    return { result: { type: CommandResultType.Success }, state: st };
  });
