import { registerTerminalApplication } from "./../../utils/program_loader.ts";
import { Menu, MenuOption, TerminalUserStateConfig } from "./../../types.ts";
import { menuGlobals } from "./../../utils/menu_globals.ts";
import { redditTopHandler, redditSearchTopHandler } from "./actions/reddit.ts";

const newsMenuOptions = (state: TerminalUserStateConfig): MenuOption[] => [
    {
        name: "subreddit",
        command: "subreddit [subreddit] [limit]",
        description: "Fetch top posts from the given subreddit",
        action: redditTopHandler,
    },
    {
        name: "search",
        command: "search [query] [limit]",
        description: "Search for posts from the given query",
        action: redditSearchTopHandler,
    },
    ...menuGlobals(state),
]

const newsMenu: Menu = {
    name: "Reddit Menu",
    description: "Source news from Reddit",
    messagePrompt: "Select an option:",
    options: newsMenuOptions,
}

export const redditTerminal = registerTerminalApplication(newsMenu);

export default redditTerminal;
