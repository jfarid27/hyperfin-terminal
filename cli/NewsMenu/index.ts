import { registerTerminalApplication } from "../utils/program_loader.ts";
import { Menu, MenuOption, TerminalUserStateConfig, CommandResultType, TerminalUserStateConfigContext, CommandState } from "../types.ts";
import { menuGlobals } from "../utils/menu_globals.ts";
import { redditTerminal } from "./RedditMenu/index.ts";
import { Effect } from "effect";

const newsMenuOptions = (state: TerminalUserStateConfig): MenuOption[] => [
    {
        name: "reddit",
        command: "reddit",
        description: "Navigate to the reddit menu",
        action: (): Effect.Effect<CommandState, unknown, TerminalUserStateConfigContext> => Effect.gen(function*() {
            const st = yield* TerminalUserStateConfigContext;
            const newState = yield* Effect.promise(async () => redditTerminal(st));
            return {
                result: { type: CommandResultType.Success },
                state: newState,
            };
        }),
    },
    ...menuGlobals(state),
]

const newsMenu: Menu = {
    name: "News Menu",
    description: "Source news from various sources",
    messagePrompt: "Select an option:",
    options: newsMenuOptions,
}

export const newsTerminal = registerTerminalApplication(newsMenu);

export default newsTerminal;
