import chalk from "chalk";
import { AlphaVantageService, type SpotQuote, type ChartPoint, type SymbolMatch } from "src/services/AlphaVantageService/index.ts";
import { ChartRenderer } from "../services/ChartRenderer.ts";
import { DataSourceType, TerminalUserStateConfigContext } from "../../types.ts";
import { CommandResultType } from "../../types.ts";
import { Effect } from "effect";
import terminalKit from "terminal-kit";
import { boldCell, escapeTableMarkup } from "../../utils/table_markup.ts";
const { terminal } = terminalKit;

const getLoadedToken = (st: any): string | undefined =>
  st?.loadedContext?.token?.symbol;

/** Row for the symbol-search results table. */
const toSearchTableRow = (m: SymbolMatch) => [
  boldCell(m.symbol),
  escapeTableMarkup(m.name),
  m.type,
  m.region,
  m.currency,
  (m.matchScore * 100).toFixed(0) + "%",
];

/**
 * Search AlphaVantage for tickers matching a free-text term and list the
 * matching symbols with their name, instrument type, and exchange region.
 *
 * Commander delivers a variadic `<term...>` as a single array argument, so
 * the handler accepts either an array of words or a single word plus extras.
 */
export const searchSymbolsHandler = (
  termStr: string | string[],
  extraTerms: string[] = [],
) =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    const words = Array.isArray(termStr)
      ? termStr
      : [termStr, ...extraTerms];
    const query = words.filter(Boolean).join(" ").trim();

    if (!query) {
      console.log(chalk.red("No search term provided"));
      return { result: { type: CommandResultType.Error }, state: st };
    }

    const av = yield* AlphaVantageService;

    yield* Effect.logInfo(`Searching AlphaVantage for "${query}"`);
    const matches: SymbolMatch[] = yield* av.searchSymbols(query);

    if (matches.length === 0) {
      console.log(chalk.yellow(`No symbols found for "${query}"`));
      return { result: { type: CommandResultType.Success }, state: st };
    }

    console.log(chalk.bold(`\nSymbols matching "${query}" (${matches.length})`));
    console.log("");

    terminal.table(
      [
        ["Symbol", "Name", "Type", "Region", "Cur", "Match"],
        ...matches.map(toSearchTableRow),
      ],
      {
        hasBorder: true,
        contentHasMarkup: true,
        borderChars: "lightRounded",
        borderAttr: { color: "cyan" },
        textAttr: { bgColor: "default" },
        firstRowTextAttr: { bgColor: "cyan" },
        width: 120,
        fit: true,
      },
    );
    console.log("");

    return { result: { type: CommandResultType.Success }, state: st };
  });

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
