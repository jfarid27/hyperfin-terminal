import { registerTerminalApplication } from "../utils/program_loader.ts";
import { Menu, MenuOption, TerminalUserStateConfig, TerminalUserStateConfigContext, CommandResultType } from "cli/types.ts";
import { menuGlobals } from "../utils/menu_globals.ts";
import { chartPriceHandler, spotPriceHandler } from "./actions/alphavantage.ts";
import { Effect } from "effect";
import { lensPath, view } from "ramda";
import { StocksServiceLive } from "./services/index.ts";

const tokenLens = lensPath(["loadedContext", "token", "symbol"]);
const getLoadedToken = view(tokenLens);

const spotHandler = (symbolStr: string) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;
  const symbol = symbolStr || getLoadedToken(st);
  if (!symbol) {
    console.log("No symbol provided");
    return { result: { type: CommandResultType.Error }, state: st };
  }

  return yield* spotPriceHandler(symbol);
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
