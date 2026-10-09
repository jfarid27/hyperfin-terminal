import { registerTerminalApplication } from "../utils/program_loader.ts";
import { Menu, MenuOption, TerminalUserStateConfig, TerminalUserStateConfigContext, CommandResultType } from "src/cli/types.ts";
import { StocksDataSourceTypeSchema, StocksDataSourceType } from "./types.ts";
import { menuGlobals } from "../utils/menu_globals.ts";
import { chartPriceHandler, spotPriceHandler as alphaVantageSpotPriceHandler, searchSymbolsHandler } from "./actions/alphavantage.ts";
import { spotPriceHandler as massiveSpotPriceHandler } from "./actions/Massive.ts";
import {
  chartPriceHandler as alpacaChartPriceHandler,
  spotPriceHandler as alpacaSpotPriceHandler,
} from "./actions/alpaca.ts";
import { bollingerHandler, fibonacciHandler } from "./actions/technicals.ts";
import { technicalsTerminal } from "./TechnicalsMenu/index.ts";
import { Effect, Schema } from "effect";
import { lensPath, set, view } from "ramda";
import { DataSourceType } from "src/cli/types.ts";
import { StocksServiceLive } from "./services/index.ts";
import { catchAlpaca } from "../utils/alpaca_errors.ts";
import chalk from "chalk";

const tokenLens = lensPath(["loadedContext", "token", "symbol"]);
const datasourceTypeLens = lensPath(["loadedContext", "stocks", "datasource"]);
const getLoadedToken = (st: TerminalUserStateConfig): string | undefined =>
  (st.loadedContext as { token?: { symbol?: string } }).token?.symbol;

const spotHandler = (symbolStr: string) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;
  const symbol = symbolStr || getLoadedToken(st);
  if (!symbol) {
    console.log("No symbol provided");
    return { result: { type: CommandResultType.Error }, state: st };
  }

  const datasource = st.loadedContext.stocks.datasource;
  yield* Effect.logInfo(`Fetching data from ${datasource}`);
  if (datasource === DataSourceType.Massive) {
    return yield* massiveSpotPriceHandler(symbol);
  }
  if (datasource === DataSourceType.Alpaca) {
    return yield* catchAlpaca(alpacaSpotPriceHandler(symbol), "Alpaca spot request failed.");
  }

  return yield* alphaVantageSpotPriceHandler(symbol);
}).pipe(Effect.provide(StocksServiceLive));

const chartHandler = (symbolStr: string) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;
  const symbol = symbolStr || getLoadedToken(st);
  if (!symbol) {
    console.log("No symbol provided");
    return { result: { type: CommandResultType.Error }, state: st };
  }

  const datasource = st.loadedContext.stocks.datasource;
  yield* Effect.logInfo(`Fetching data from ${datasource}`);
  if (datasource === DataSourceType.Alpaca) {
    return yield* catchAlpaca(alpacaChartPriceHandler(symbol), "Alpaca chart request failed.");
  }

  return yield* chartPriceHandler(symbol);
}).pipe(Effect.provide(StocksServiceLive));

/**
 * Enter the technicals submenu, which lists one option per indicator
 * (bbands, fibonacci).
 */
const technicalsHandler = () => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;
  const newState = yield* technicalsTerminal(st);
  return { result: { type: CommandResultType.Success }, state: newState };
});

/**
 * Search AlphaVantage for tickers matching a term. Search is a
 * symbol-discovery tool and is only offered by AlphaVantage, so it does not
 * branch on the loaded datasource.
 */
const searchHandler = (term: string | string[], extraTerms: string[] = []) =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    return yield* searchSymbolsHandler(term, extraTerms);
  }).pipe(Effect.provide(StocksServiceLive));

/**
 * Switch the datasource for actions in the stocks menu using available
 * APIs.
 */
const datasourceSwapHandler = (datatypeStr: string) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;
  if (!datatypeStr) {
    console.log(chalk.red("No source provided."));
    return { result: { type: CommandResultType.Error }, state: st };
  }
  yield* Effect.logDebug(`Swapping datasource to ${datatypeStr}`);

  const updatedE = Schema.decodeUnknownEither(StocksDataSourceTypeSchema)(datatypeStr);
  const val = yield* updatedE;

  const updatedSt = set<TerminalUserStateConfig, StocksDataSourceType>(datasourceTypeLens, val, st);
  yield* Effect.logDebug(updatedSt.loadedContext.stocks);
  console.log(chalk.green(`Swapped datasource to ${val}`));
  return { result: { type: CommandResultType.Success }, state: updatedSt };

}).pipe(
  Effect.catchTag("ParseError", (_err) => Effect.gen(function* (){
    const st = yield* TerminalUserStateConfigContext;
    console.log(chalk.red("Invalid source provided."));
    return { result: { type: CommandResultType.Error }, state: st };
  }))
);

const stocksMenuOptions = (state: TerminalUserStateConfig): MenuOption[] => [
  {
    name: "chart",
    command: "chart [symbol]",
    description: "Fetch chart data for the given symbol",
    action: chartHandler,
  },
  {
    name: "technicals",
    command: "technicals",
    description: "Technical analysis indicators: bbands, fibonacci",
    action: technicalsHandler,
  },
  {
    name: "spot",
    command: "spot [symbol]",
    description: "Fetch spot price for the given symbol",
    action: spotHandler,
  },
  {
    name: "search",
    command: "search [term...]",
    description: "Search AlphaVantage for tickers matching a term (symbol, name, type, region)",
    action: searchHandler,
  },
  {
    name: "source",
    command: "source [datatypeSource]",
    description: "Switch the source of data between: alphavantage, massive, alpaca.",
    action: datasourceSwapHandler
  },
  ...menuGlobals(state),
];

const stocksMenu: Menu = {
  name: "Stocks Menu",
  description: "Stocks Menu",
  messagePrompt: "Select an option:",
  options: stocksMenuOptions,
};

export const stocksTerminal = registerTerminalApplication(stocksMenu);
export default stocksTerminal;
