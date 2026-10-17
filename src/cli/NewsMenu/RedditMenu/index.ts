import { registerTerminalApplication } from "../../utils/program_loader.ts";
import { Menu, MenuOption, TerminalUserStateConfig } from "../../types.ts";
import { menuGlobals } from "../../utils/menu_globals.ts";
import { redditTopHandler, redditSearchTopHandler } from "./actions/reddit.ts";
import { RedditServiceLive } from "src/services/RedditService/index.ts";
import { Effect } from "effect";

/**
 * The menu's options, with the Reddit service provided here rather than inside
 * the handlers: the handlers declare the dependency, the menu wires it, and a
 * test can run a handler against a mock without fighting a baked-in layer
 * (see `actions/reddit_test.ts`).
 */
const newsMenuOptions = (state: TerminalUserStateConfig): MenuOption[] => [
    {
        name: "subreddit",
        command: "subreddit [subreddit] [limit]",
        description: "Fetch top posts from the given subreddit",
        action: (subreddit?: string, limit?: number) =>
            redditTopHandler(subreddit, limit).pipe(Effect.provide(RedditServiceLive)),
    },
    {
        name: "search",
        command: "search [query] [limit]",
        description: "Search for posts from the given query",
        action: (query?: string, limit?: number) =>
            redditSearchTopHandler(query, limit).pipe(Effect.provide(RedditServiceLive)),
    },
    ...menuGlobals(state),
]

export const redditMenu: Menu = {
    name: "Reddit Menu",
    description: "Source news from Reddit",
    messagePrompt: "Select an option:",
    options: newsMenuOptions,
}

export const redditTerminal = registerTerminalApplication(redditMenu);

export default redditTerminal;
