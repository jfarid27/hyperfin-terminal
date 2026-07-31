import { registerTerminalApplication } from "../utils/program_loader.ts";
import { Menu, MenuOption, TerminalUserStateConfig, DataSourceType, TerminalUserStateConfigContext, CommandResultType, ActionHandler } from "../types.ts";
import { menuGlobals } from "../utils/menu_globals.ts";
import { chartPriceHandler } from "./actions/alphavantage.ts";
import { cboeSpotPriceHandler, cboeHistoryHandler } from "./actions/cboe.ts";
import { Effect } from "effect";
import { lensPath, view } from "ramda";
import chalk from "chalk";
import stocks from "./model/index.ts";
import { ConfigService } from "cli/services/ConfigService.ts";
import { Option } from "effect";
import terminalKit from "terminal-kit";
const { terminal } = terminalKit;

const tokenLens = lensPath(["loadedContext", "token", "symbol"]);
const getLoadedToken = view(tokenLens);

const spotPriceHandler: ActionHandler = (symbolStr: string) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;
  const symbol = symbolStr || getLoadedToken(st);
  if (!symbol) {
    console.log("No symbol provided");
    return { result: { type: CommandResultType.Error }, state: st };
  }

  const datasource = st.loadedContext?.stocks?.datasource ?? DataSourceType.CBOE;

  if (datasource === DataSourceType.Massive) {
    const config = yield* ConfigService;
    const key = Option.getOrUndefined(config.MASSIVE_API_KEY) || "";
    const result = yield* stocks.massive.spot.get(
      { name: symbol, id: symbol.toUpperCase(), _type: DataSourceType.Massive },
      key,
    );
    const ticker = result?.ticker;
    if (!ticker) {
      console.log(chalk.red("No data returned from Massive API"));
      return { result: { type: CommandResultType.Error }, state: st };
    }
    const day = result?.day;
    const prevDay = result?.prevDay;
    terminal.table([
      ["Symbol", "Price", "Change", "Change %", "Volume", "Prev Close", "High", "Low"],
      [ticker.ticker, `$${ticker.price || ticker.lastTrade?.p || "N/A"}`,
        day?.c?.toFixed(2) ?? "N/A", day?.cp != null ? day.cp.toFixed(2) + "%" : "N/A",
        day?.v?.toLocaleString() ?? "N/A", prevDay?.c?.toFixed(2) ?? "N/A",
        day?.h?.toFixed(2) ?? "N/A", day?.l?.toFixed(2) ?? "N/A"],
    ], {
      hasBorder: true, contentHasMarkup: true, borderChars: "lightRounded",
      borderAttr: { color: "green" }, textAttr: { bgColor: "default" },
      firstRowTextAttr: { bgColor: "green" }, width: 120, fit: true,
    });
    return { result: { type: CommandResultType.Success }, state: st };
  }

  // CBOE (default)
  return yield* cboeSpotPriceHandler(symbol);
});

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
