import { registerTerminalApplication } from "../utils/program_loader.ts";
import { Menu, MenuOption, TerminalUserStateConfig } from "../types.ts";
import { menuGlobals } from "../utils/menu_globals.ts";
import { optionsChainHandler } from "./actions/cboe.ts";

const optionsMenuOptions = (state: TerminalUserStateConfig): MenuOption[] => [
    {
        name: "chain",
        command: "chain [symbol]",
        description: "Fetch options chain for the given symbol",
        action: optionsChainHandler,
    },
    ...menuGlobals(state),
]

const optionsMenu: Menu = {
    name: "Options Menu",
    description: "Options Menu",
    messagePrompt: "Select an option:",
    options: optionsMenuOptions,
}

export const optionsTerminal = registerTerminalApplication(optionsMenu);

export default optionsTerminal;
