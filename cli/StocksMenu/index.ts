import { registerTerminalApplication } from "../utils/program_loader.ts";
import { Menu, MenuOption, TerminalUserStateConfig } from "../types.ts";
import { menuGlobals } from "../utils/menu_globals.ts";
import { chartPriceHandler, spotPriceHandler } from "./actions/alphavantage.ts";

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
    ...menuGlobals(state),
]

const stocksMenu: Menu = {
    name: "Stocks Menu",
    description: "Stocks Menu",
    messagePrompt: "Select an option:",
    options: stocksMenuOptions,
}

export const stocksTerminal = registerTerminalApplication(stocksMenu);

export default stocksTerminal;
