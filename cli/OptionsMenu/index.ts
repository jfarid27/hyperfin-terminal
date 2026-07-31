import { registerTerminalApplication } from "../utils/program_loader.ts";
import { Menu, MenuOption, TerminalUserStateConfig, DataSourceType, TerminalUserStateConfigContext, CommandResultType, ActionHandler } from "../types.ts";
import { menuGlobals } from "../utils/menu_globals.ts";
import { cboeOptionsChainHandler } from "../StocksMenu/actions/cboe.ts";
import { Effect } from "effect";
import chalk from "chalk";

const optionsChainHandler: ActionHandler = (symbolStr: string) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;
  const datasource = st.loadedContext.options.datasource;

  if (datasource !== DataSourceType.CBOE) {
    console.log(chalk.yellow("Massive options not yet implemented, falling back to CBOE."));
  }

  return yield* cboeOptionsChainHandler(symbolStr);
});

const optionsMenuOptions = (state: TerminalUserStateConfig): MenuOption[] => [
  {
    name: "chain",
    command: "chain [symbol]",
    description: "Fetch options chain for the given symbol",
    action: optionsChainHandler,
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
