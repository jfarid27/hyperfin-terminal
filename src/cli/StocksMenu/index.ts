import { registerTerminalApplication } from "../utils/program_loader.ts";
import { Menu, MenuOption, TerminalUserStateConfig, TerminalUserStateConfigContext, CommandResultType } from "src/cli/types.ts";
import { StocksDataSourceTypeSchema, StocksDataSourceType } from "./types.ts";
import { menuGlobals } from "../utils/menu_globals.ts";
import { chartPriceHandler, spotPriceHandler as alphaVantageSpotPriceHandler } from "./actions/alphavantage.ts";
import { spotPriceHandler as massiveSpotPriceHandler } from "./actions/Massive.ts";
import { Effect, Schema } from "effect";
import { lensPath, set, view } from "ramda";
import { DataSourceType } from "src/cli/types.ts";
import { StocksServiceLive } from "./services/index.ts";
import chalk from "chalk";

const tokenLens = lensPath(["loadedContext", "token", "symbol"]);
const datasourceTypeLens = lensPath(["loadedContext", "stocks", "datasource"]);
const getLoadedToken = view(tokenLens);

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

  return yield* alphaVantageSpotPriceHandler(symbol);
}).pipe(Effect.provide(StocksServiceLive));

const chartHandler = (symbolStr: string) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;
  const symbol = symbolStr || getLoadedToken(st);
  if (!symbol) {
    console.log("No symbol provided");
    return { result: { type: CommandResultType.Error }, state: st };
  }

  return yield* chartPriceHandler(symbol);
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
    name: "spot",
    command: "spot [symbol]",
    description: "Fetch spot price for the given symbol",
    action: spotHandler,
  },
  {
    name: "source",
    command: "source [datatypeSource]",
    description: "Switch the source of data between various available types.",
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
