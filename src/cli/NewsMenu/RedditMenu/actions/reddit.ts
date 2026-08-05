import { CommandResultType, TerminalUserStateConfigContext } from "../../../types.ts";
import { RedditModel } from "../model/index.ts";
import chalk from "chalk";
import { Effect } from "effect";
import { NewsServiceLive } from "../services/index.ts";

/**
 * Return top posts from the given search term
 */
export const redditSearchTopHandler =
    (query: string, limit: number) => Effect.gen(function*() {
        const st = yield* TerminalUserStateConfigContext;
        const reddit = yield* RedditModel;

        if (!query) {
            console.log(chalk.red("No query term supplied."))
            return {
                result: { type: CommandResultType.Error },
                state: st,
            };
        }

        const redditData = yield* reddit.search(query, limit || 20);
        yield* Effect.logInfo(`Found ${redditData.length} results for "${query}"`)

        for (const item of redditData) {
            console.log(chalk.green(item.title))
            console.log(chalk.blue(item.date) + " | " + chalk.green(item.author))
            console.log(chalk.red(item.link) + "\n")
        }

        return {
            result: { type: CommandResultType.Success },
            state: st,
        };
    }).pipe(
      Effect.provide(NewsServiceLive)
    );

/**
 * Return top posts from the given subreddit
 */
export const redditTopHandler = (subreddit: string | undefined, limit: number = 20) =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    const reddit = yield* RedditModel;

    const _subreddit = subreddit ?? "ethereum";

    const redditData = yield* reddit.get(_subreddit, limit);
    yield* Effect.logInfo(`Found ${redditData.length} results for "${_subreddit}"`)

    console.log(chalk.blue.bold(`Best posts from r/${_subreddit} \n`))

    for (const item of redditData) {
      console.log(chalk.green(item.title))
      console.log(chalk.blue(item.date) + " | " + chalk.green(item.author))
      console.log(chalk.red(item.link) + "\n")
    }

    return {
      result: { type: CommandResultType.Success },
      state: st,
    };
  }).pipe(
    Effect.provide(NewsServiceLive)
  );
