import { registerTerminalApplication } from "../utils/program_loader.ts";
import {
  CommandResultType,
  Menu,
  MenuOption,
  TerminalUserStateConfig,
  TerminalUserStateConfigContext,
} from "src/cli/types.ts";
import { menuGlobals } from "../utils/menu_globals.ts";
import { forexChartHandler, forexSpotHandler } from "./actions/alphavantage.ts";
import {
  forexChartHandler as alpacaForexChartHandler,
  forexSpotHandler as alpacaForexSpotHandler,
} from "./actions/alpaca.ts";
import { Effect, Schema } from "effect";
import { lensPath, set } from "ramda";
import { DataSourceType } from "src/cli/types.ts";
import { ForexDataSourceTypeSchema, type ForexDataSourceType } from "../../services/ForexService/types.ts";
import { ForexServiceMenuLive } from "./services/index.ts";
import { catchAlpaca } from "../utils/alpaca_errors.ts";
import chalk from "chalk";

const datasourceTypeLens = lensPath(["loadedContext", "forex", "datasource"]);

/**
 * Latest spot exchange rate for a currency pair, dispatched to the active source.
 * Falls back to a usage message when the pair is not fully specified.
 */
const spotHandler = (fromStr?: string, toStr?: string) =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    const datasource = st.loadedContext.forex?.datasource ?? DataSourceType.AlphaVantage;
    yield* Effect.logInfo(`Fetching data from ${datasource}`);

    if (datasource === DataSourceType.Alpaca) {
      return yield* catchAlpaca(alpacaForexSpotHandler(fromStr, toStr), "Alpaca forex spot request failed.");
    }

    return yield* forexSpotHandler(fromStr, toStr);
  }).pipe(Effect.provide(ForexServiceMenuLive));

/** Daily FX chart for a currency pair over an optional date range. */
const chartHandler = (
  fromStr?: string,
  toStr?: string,
  dateFrom?: string,
  dateTo?: string,
) =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    const datasource = st.loadedContext.forex?.datasource ?? DataSourceType.AlphaVantage;
    yield* Effect.logInfo(`Fetching data from ${datasource}`);

    if (datasource === DataSourceType.Alpaca) {
      return yield* catchAlpaca(alpacaForexChartHandler(fromStr, toStr, dateFrom, dateTo), "Alpaca forex chart request failed.");
    }

    return yield* forexChartHandler(fromStr, toStr, dateFrom, dateTo);
  }).pipe(Effect.provide(ForexServiceMenuLive));

/** Switch the source of forex data. */
const datasourceSwapHandler = (datatypeStr: string) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;
  if (!datatypeStr) {
    console.log(chalk.red("No source provided."));
    return { result: { type: CommandResultType.Error }, state: st };
  }
  yield* Effect.logDebug(`Swapping datasource to ${datatypeStr}`);

  const updatedE = Schema.decodeUnknownEither(ForexDataSourceTypeSchema)(datatypeStr);
  const val = yield* updatedE;

  const updatedSt = set<TerminalUserStateConfig, ForexDataSourceType>(datasourceTypeLens, val, st);
  console.log(chalk.green(`Swapped datasource to ${val}`));
  return { result: { type: CommandResultType.Success }, state: updatedSt };
}).pipe(
  Effect.catchTag("ParseError", (_err) => Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    console.log(chalk.red("Invalid source provided."));
    return { result: { type: CommandResultType.Error }, state: st };
  })),
);

const forexMenuOptions = (state: TerminalUserStateConfig): MenuOption[] => [
  {
    name: "spot",
    command: "spot [from] [to]",
    description: "Fetch the current spot exchange rate for a currency pair (e.g. spot EUR USD)",
    action: spotHandler,
  },
  {
    name: "chart",
    command: "chart [from] [to] [fromDate] [toDate]",
    description: "Chart daily FX prices for a currency pair (dates YYYY-MM-DD; default last 1 year)",
    action: chartHandler,
  },
  {
    name: "source",
    command: "source [datatypeSource]",
    description: "Switch the source of data between: alphavantage, alpaca.",
    action: datasourceSwapHandler,
  },
  ...menuGlobals(state),
];

const forexMenu: Menu = {
  name: "Forex Menu",
  description: "Foreign exchange rates and charts",
  messagePrompt: "Select an option:",
  options: forexMenuOptions,
};

export const forexTerminal = registerTerminalApplication(forexMenu);
export default forexTerminal;
