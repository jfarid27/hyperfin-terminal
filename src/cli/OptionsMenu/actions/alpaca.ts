import chalk from "chalk";
import { AlpacaService } from "src/services/AlpacaService/index.ts";
import type { OptionContract, OptionsChain } from "src/services/OptionsService/types.ts";
import { showNumericLineChart } from "../../components/charting.ts";
import { CommandResultType, DataSourceType, TerminalUserStateConfigContext } from "../../types.ts";
import { Effect } from "effect";
import terminalKit from "terminal-kit";
import { greenCell, redCell } from "../../utils/table_markup.ts";
const { terminal } = terminalKit;

const getLoadedToken = (st: unknown): string | undefined =>
  (st as { loadedContext?: { token?: { symbol?: string } } })?.loadedContext?.token?.symbol;

/** The indicative feed carries no open interest, and no IV without OPRA. */
const toTableRow = (c: OptionContract) => [
  c.contractSymbol.slice(-15),
  c.inTheMoney ? greenCell("ITM") : redCell("OTM"),
  c.strike.toFixed(1),
  c.lastPrice.toFixed(2),
  c.bid.toFixed(2),
  c.ask.toFixed(2),
  c.volume.toLocaleString(),
  c.openInterest > 0 ? c.openInterest.toLocaleString() : "n/a",
  c.impliedVolatility > 0 ? (c.impliedVolatility * 100).toFixed(1) + "%" : "n/a",
];

/**
 * Resolve a target expiration (Unix seconds) from the Alpaca expiration list,
 * accepting a 1-based index ("1" = nearest) or a `YYYY-MM-DD` date.
 * Returns null when the selector does not match.
 */
export const resolveExpiration = (
  selector: string | undefined,
  expirations: readonly number[],
): number | null => {
  if (expirations.length === 0) return null;
  if (!selector) return expirations[0];

  const idx = parseInt(selector);
  if (!Number.isNaN(idx) && idx >= 1 && idx <= expirations.length) {
    return expirations[idx - 1];
  }

  const target = new Date(selector);
  if (!Number.isNaN(target.getTime())) {
    const targetUnix = target.getTime() / 1000;
    const match = expirations.find((e) => {
      const expDate = new Date(e * 1000).toISOString().slice(0, 10);
      return expDate === selector || Math.abs(e - targetUnix) < 86400;
    });
    return match ?? null;
  }

  return null;
};

const printChain = (chain: OptionsChain, expirationCount: number) => {
  console.log(chalk.bold(`\n${chain.ticker} Options — ${chain.expirationDate} (Alpaca)`));
  console.log(chalk.dim(`Underlying: $${chain.underlyingPrice.toFixed(2)}  ·  ${chain.calls.length + chain.puts.length} contracts across ${expirationCount} expirations`));
  console.log("");

  const header = ["Contract", "", "Strike", "Last", "Bid", "Ask", "Vol", "OI", "IV"];

  if (chain.calls.length > 0) {
    console.log(chalk.bold.green(`CALLS (${chain.calls.length})`));
    terminal.table([header, ...chain.calls.map(toTableRow)], {
      hasBorder: true,
      contentHasMarkup: true,
      borderChars: "lightRounded",
      borderAttr: { color: "green" },
      textAttr: { bgColor: "default" },
      firstRowTextAttr: { bgColor: "green" },
      width: 120,
      fit: true,
    });
    console.log("");
  }

  if (chain.puts.length > 0) {
    console.log(chalk.bold.red(`PUTS (${chain.puts.length})`));
    terminal.table([header, ...chain.puts.map(toTableRow)], {
      hasBorder: true,
      contentHasMarkup: true,
      borderChars: "lightRounded",
      borderAttr: { color: "red" },
      textAttr: { bgColor: "default" },
      firstRowTextAttr: { bgColor: "red" },
      width: 120,
      fit: true,
    });
    console.log("");
  }
};

/** Options chain for a symbol via Alpaca (indicative or OPRA feed). */
export const chainHandler = (symbolStr: string, selector?: string) =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    const symbol = symbolStr || getLoadedToken(st);

    if (!symbol) {
      console.log(chalk.red("No symbol provided"));
      return { result: { type: CommandResultType.Error }, state: st };
    }

    const ticker = symbol.toUpperCase();
    const alpaca = yield* AlpacaService;

    yield* Effect.logInfo(`Fetching Alpaca options chain for ${ticker}`);
    const expirations = yield* alpaca.getOptionExpirations(ticker);

    if (expirations.length === 0) {
      console.log(chalk.red("No options expirations found"));
      return { result: { type: CommandResultType.Error }, state: st };
    }

    const targetExp = resolveExpiration(selector, expirations);
    if (targetExp === null) {
      const available = expirations.map((e) => new Date(e * 1000).toISOString().slice(0, 10)).join(", ");
      console.log(chalk.red(`Expiration ${selector} not found. Available: ${available}`));
      return { result: { type: CommandResultType.Error }, state: st };
    }

    const chain = yield* alpaca.getOptionChain(
      { name: ticker, id: ticker, _type: DataSourceType.Alpaca },
      targetExp,
    );

    printChain(chain, expirations.length);
    return { result: { type: CommandResultType.Success }, state: st };
  });

/** Implied-volatility curve across strikes for one expiration via Alpaca. */
export const volcurveHandler = (symbolStr: string, typeStr?: string, selector?: string) =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    const symbol = symbolStr || getLoadedToken(st);

    if (!symbol) {
      console.log(chalk.red("No symbol provided"));
      return { result: { type: CommandResultType.Error }, state: st };
    }

    const ticker = symbol.toUpperCase();
    const optionType = typeStr?.toLowerCase() === "put" ? "put" : "call";
    const alpaca = yield* AlpacaService;

    const expirations = yield* alpaca.getOptionExpirations(ticker);
    if (expirations.length === 0) {
      console.log(chalk.red("No options expirations found"));
      return { result: { type: CommandResultType.Error }, state: st };
    }

    const targetExp = resolveExpiration(selector, expirations);
    if (targetExp === null) {
      const available = expirations.map((e) => new Date(e * 1000).toISOString().slice(0, 10)).join(", ");
      console.log(chalk.red(`Expiration not found. Available: ${available}`));
      return { result: { type: CommandResultType.Error }, state: st };
    }

    const chain = yield* alpaca.getOptionChain(
      { name: ticker, id: ticker, _type: DataSourceType.Alpaca },
      targetExp,
    );
    const contracts = optionType === "call" ? chain.calls : chain.puts;

    const points = contracts
      .filter((c) => c.impliedVolatility > 0.001)
      .map((c) => ({ strike: c.strike, iv: c.impliedVolatility * 100 }))
      .sort((a, b) => a.strike - b.strike);

    if (points.length === 0) {
      console.log(chalk.yellow(
        `No implied volatility available for ${ticker} ${optionType.toUpperCase()} ${chain.expirationDate}.`,
      ));
      console.log(chalk.dim(
        "Alpaca only provides IV/greeks on the paid OPRA feed; the free indicative feed omits them.",
      ));
      return { result: { type: CommandResultType.Error }, state: st };
    }

    console.log(chalk.bold(`\n${ticker} ${optionType.toUpperCase()} Volatility Curve — ${chain.expirationDate} (Alpaca)`));
    console.log(chalk.dim(`Underlying: $${chain.underlyingPrice.toFixed(2)}  ·  ${points.length} contracts`));
    console.log("");

    yield* showNumericLineChart(
      points,
      "strike",
      "iv",
      `${ticker} ${optionType.toUpperCase()} IV Curve — ${chain.expirationDate}`,
    );

    return { result: { type: CommandResultType.Success }, state: st };
  });
