import { registerTerminalApplication } from "../utils/program_loader.ts";
import { Menu, MenuOption, TerminalUserStateConfig, DataSourceType, TerminalUserStateConfigContext, CommandResultType } from "cli/types.ts";
import { menuGlobals } from "../utils/menu_globals.ts";
import { chartPriceHandler } from "./actions/alphavantage.ts";
import { cboeSpotPriceHandler, cboeHistoryHandler } from "./actions/cboe.ts";
import { massiveSpotPriceHandler } from "./actions/massive.ts";
import { Effect } from "effect";
import { lensPath, view } from "ramda";
import { StocksServiceLive } from "./services/index.ts";

const tokenLens = lensPath(["loadedContext", "token", "symbol"]);
const getLoadedToken = view(tokenLens);

const spotPriceHandler = (symbolStr: string) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;
  const symbol = symbolStr || getLoadedToken(st);
  if (!symbol) {
    console.log("No symbol provided");
    return { result: { type: CommandResultType.Error }, state: st };
  }

  if (st.loadedContext.stocks.datasource === DataSourceType.Massive) {
    return yield* massiveSpotPriceHandler(symbol);
  }

  return yield* cboeSpotPriceHandler(symbol);
}).pipe(
  Effect.provide(StocksServiceLive)
);

const stocksMenuOptions = (state: TerminalUserStateConfig): MenuOption[] => [
  {
    name: "chart",
    command: "chart [symbol]",
    description: "Fetch chart data for the given symbol",
    action: chartPriceHandler,
  },
  {
    name: "spot",
    command: "spot [symbol]",
    description: "Fetch spot prices for the given symbol",
    action: spotPriceHandler,
  },
  {
    name: "history",
    command: "history [symbol]",
    description: "Fetch historical prices from CBOE for the given symbol",
    action: cboeHistoryHandler,
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
