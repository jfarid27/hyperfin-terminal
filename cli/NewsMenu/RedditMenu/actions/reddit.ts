import { CommandResultType, ActionHandler, TerminalUserStateConfigContext } from "./../../../types.ts";
import news from "../model/index.ts";
import chalk from "chalk";
import { Effect } from "effect";

/**
 * Return top posts from the given search term
 */
export const redditSearchTopHandler: ActionHandler =
    (query: string, limit: number) => Effect.gen(function*() {
        const st = yield* TerminalUserStateConfigContext;

        if (!query) {
            console.log(chalk.red("No query term supplied."))
            return {
                result: { type: CommandResultType.Error },
                state: st,
            };
        }

        const redditData = yield* news.reddit.search(query, limit || 20);

        for (const item of redditData) {
            console.log(chalk.green(item.title))
            console.log(chalk.blue(item.date) + " | " + chalk.green(item.author))
            console.log(chalk.red(item.link) + "\n")
        }

        return {
            result: { type: CommandResultType.Success },
            state: st,
        };
    });

/**
 * Return top posts from the given subreddit
 */
export const redditTopHandler: ActionHandler = (subreddit: string, limit: number) =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;

    let _subreddit = subreddit;
    if (!_subreddit) {
      _subreddit = "ethereum"
    }

    const redditData = yield* news.reddit.get(_subreddit, limit || 20);

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
  });
