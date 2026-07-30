import { registerTerminalApplication } from "cli/utils/program_loader.ts";
import { Menu, MenuOption, TerminalUserStateConfig } from "cli/types.ts";
import { menuGlobals } from "cli/utils/menu_globals.ts";
import { mockHandler } from "./actions/mock.ts";

const mockMenuOptions = (state: TerminalUserStateConfig): MenuOption[] => [
    {
        name: "mock",
        command: "mock [param1]",
        description: "Mock action",
        action: mockHandler,
    },
    ...menuGlobals(state),
]

const mockMenu: Menu = {
    name: "Mock Menu",
    description: "Mock menu for testing",
    messagePrompt: "Select an option:",
    options: mockMenuOptions,
}

export const mockTerminal = registerTerminalApplication(mockMenu);

export default mockTerminal;
