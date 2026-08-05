import { registerTerminalApplication } from "../utils/program_loader.ts";
import { Menu, MenuOption, TerminalUserStateConfig, TerminalUserStateConfigContext, CommandResultType } from "src/cli/types.ts";
import { OptionsDataSourceTypeSchema, OptionsDataSourceType } from "./types.ts";
import { menuGlobals } from "../utils/menu_globals.ts";
import { chainHandler } from "./actions/chain.ts";
import { volcurveHandler } from "./actions/volcurve.ts";
import { Effect, Schema } from "effect";
import { lensPath, set, view } from "ramda";
import { DataSourceType } from "src/cli/types.ts";
import { OptionsServiceLive } from "./services/index.ts";
import chalk from "chalk";

const tokenLens = lensPath(["loadedContext", "token", "symbol"]);
const datasourceTypeLens = lensPath(["loadedContext", "options", "datasource"]);
const getLoadedToken = view(tokenLens);

const optionsChainHandler = (symbolStr: string, dateStr?: string) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;
  const symbol = symbolStr || getLoadedToken(st);
  if (!symbol) {
    console.log("No symbol provided");
    return { result: { type: CommandResultType.Error }, state: st };
  }

  return yield* chainHandler(symbol, dateStr);
}).pipe(Effect.provide(OptionsServiceLive));

const optionsVolcurveHandler = (symbolStr: string, typeStr?: string, dateStr?: string) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;
  const symbol = symbolStr || getLoadedToken(st);
  if (!symbol) {
    console.log("No symbol provided");
    return { result: { type: CommandResultType.Error }, state: st };
  }

  return yield* volcurveHandler(symbol, typeStr, dateStr);
}).pipe(Effect.provide(OptionsServiceLive));

/**
 * Switch the datasource for actions in the options menu.
 */
const datasourceSwapHandler = (datatypeStr: string) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;
  if (!datatypeStr) {
    console.log(chalk.red("No source provided."));
    return { result: { type: CommandResultType.Error }, state: st };
  }
  yield* Effect.logDebug(`Swapping datasource to ${datatypeStr}`);

  const updatedE = Schema.decodeUnknownEither(OptionsDataSourceTypeSchema)(datatypeStr);
  const val = yield* updatedE;

  const updatedSt = set<TerminalUserStateConfig, OptionsDataSourceType>(datasourceTypeLens, val, st);
  yield* Effect.logDebug(updatedSt.loadedContext.options);
  console.log(chalk.green(`Swapped datasource to ${val}`));
  return { result: { type: CommandResultType.Success }, state: updatedSt };
}).pipe(
  Effect.catchTag("ParseError", (_err) => Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    console.log(chalk.red("Invalid source provided."));
    return { result: { type: CommandResultType.Error }, state: st };
  })),
);

const optionsMenuOptions = (state: TerminalUserStateConfig): MenuOption[] => [
  {
    name: "chain",
    command: "chain [symbol] [date]",
    description: "Fetch options chain for the given symbol (Yahoo Finance)",
    action: optionsChainHandler,
  },
  {
    name: "volcurve",
    command: "volcurve [symbol] [type] [date]",
    description: "Plot implied volatility curve across strikes (call/put, default call)",
    action: optionsVolcurveHandler,
  },
  {
    name: "source",
    command: "source [datatypeSource]",
    description: "Switch the source of data between various available types.",
    action: datasourceSwapHandler,
  },
  ...menuGlobals(state),
];

const optionsMenu: Menu = {
  name: "Options Menu",
  description: "Options Menu",
  messagePrompt: "Select an option:",
  options: optionsMenuOptions,
};

export const optionsTerminal = registerTerminalApplication(optionsMenu);
export default optionsTerminal;
