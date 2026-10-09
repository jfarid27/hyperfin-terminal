import chalk from "chalk";
import { AlpacaService, type FixedIncomeQuote } from "src/services/AlpacaService/index.ts";
import { CommandResultType, TerminalUserStateConfigContext } from "../../types.ts";
import { Effect } from "effect";
import terminalKit from "terminal-kit";
import { boldCell, escapeTableMarkup } from "../../utils/table_markup.ts";
const { terminal } = terminalKit;

/** ISIN: 2-letter country + 9 alphanumeric + 1 check digit (12 chars total). */
export const isIsin = (value: string): boolean => /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(value);

const fmtPct = (v: number | undefined): string =>
  v === undefined ? "n/a" : `${v.toFixed(3)}%`;

/**
 * Latest fixed-income price/yield for an ISIN via Alpaca.
 *
 * Alpaca quotes fixed income by ISIN and only exposes *latest* prices — there
 * is no historical endpoint — so this prints a single spot row rather than a
 * chart. Historical yield charts remain available from Yahoo Finance.
 */
export const bondSpotHandler = (code: string) =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;

    const isin = (code || "").trim().toUpperCase();
    if (!isin) {
      console.log(chalk.red("No ISIN provided. Usage: yields <isin> (e.g. yields US912797KJ59)"));
      return { result: { type: CommandResultType.Error }, state: st };
    }

    if (!isIsin(isin)) {
      console.log(chalk.red(`"${code}" is not a valid ISIN.`));
      console.log(chalk.dim("Alpaca fixed income is quoted by ISIN, e.g. US912797KJ59."));
      console.log(chalk.dim("For historical yield charts use the Yahoo Finance source: source yahoofinance"));
      return { result: { type: CommandResultType.Error }, state: st };
    }

    const alpaca = yield* AlpacaService;
    yield* Effect.logInfo(`Fetching Alpaca fixed-income price for ${isin}`);

    const quotes: FixedIncomeQuote[] = yield* alpaca.getFixedIncomeLatestPrices([isin]);
    const quote = quotes.find((q) => q.isin === isin) ?? quotes[0];

    if (!quote) {
      console.log(chalk.yellow(`No Alpaca fixed-income price returned for ${isin}.`));
      return { result: { type: CommandResultType.Error }, state: st };
    }

    console.log(chalk.bold(`\n${quote.isin} — Fixed Income (Alpaca)`));
    console.log("");

    terminal.table(
      [
        ["ISIN", "Price", "YTM", "YTW", "As of"],
        [
          boldCell(quote.isin),
          boldCell(quote.price.toFixed(4)),
          fmtPct(quote.yieldToMaturity),
          fmtPct(quote.yieldToWorst),
          escapeTableMarkup(quote.asOf),
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

    return { result: { type: CommandResultType.Success }, state: st };
  });
