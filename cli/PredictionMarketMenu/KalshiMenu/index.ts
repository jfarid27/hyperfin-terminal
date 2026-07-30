import { Menu, MenuOption, TerminalUserStateConfig } from "./../../types.ts";
import { registerTerminalApplication } from "./../../utils/program_loader.ts";
import { menuGlobals } from "./../../utils/menu_globals.ts";
import { kalshiEventViewHandler } from './actions/Event/index.ts';

/**
 *  Kalshi Menu Options.
 */
const kalshiMenuOptions = (state: TerminalUserStateConfig): MenuOption[] => [
    {
        name: "event",
        command: "event [ticker]",
        description: "Fetch markets for a specific event by ticker (e.g., KXHIGHNY-26JAN10).",
        action: kalshiEventViewHandler,
    },
    ...menuGlobals(state),
]

/**
 *  Kalshi Menu Definitions.
 */
const kalshiMenu: Menu = {
    name: "Kalshi Menu",
    description: "Kalshi Menu",
    messagePrompt: "Select an option:",
    options: kalshiMenuOptions,
}


export const kalshiTerminal = registerTerminalApplication(kalshiMenu);

export default kalshiTerminal;
