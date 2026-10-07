import { registerTerminalApplication } from "../utils/program_loader.ts";
import { Menu, MenuOption, TerminalUserStateConfig } from "../types.ts";
import { menuGlobals } from "../utils/menu_globals.ts";
import { fredHandler, fredSearchHandler } from "./actions/fred.ts";

const governmentMenuOptions = (state: TerminalUserStateConfig): MenuOption[] => [
    {
        name: "fred",
        command: "fred [seriesId] [startDate] [endDate]",
        description: "Fetch and chart FRED economic data series (dates in YYYY-MM-DD format)",
        action: fredHandler,
    },
    {
        name: "fredsearch",
        command: "fredsearch [term...]",
        description: "Search FRED for series by term (returns series ID, title, and description)",
        action: fredSearchHandler,
    },
    ...menuGlobals(state),
]

const governmentMenu: Menu = {
    name: "Government Menu",
    description: "Government economic data and statistics",
    messagePrompt: "Select an option:",
    options: governmentMenuOptions,
}

export const governmentTerminal = registerTerminalApplication(governmentMenu);

export default governmentTerminal;
