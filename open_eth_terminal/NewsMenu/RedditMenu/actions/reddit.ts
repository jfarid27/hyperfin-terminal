import { CommandResultType, CommandState, TerminalUserStateConfigContext, LogLevel } from "./../../../types.ts";
import news from "../model/index.ts";
import { inspectLogger } from "./../../../utils/logging.ts";
import chalk from "chalk";
import { Effect } from "effect";

/**
 * Return top posts from the given search term
 * @param {TerminalUserStateConfig} st Terminal user state 
 * @param {string} query Query term to fetch posts from 
 * @param {number} limit Number of posts to fetch 
 * @returns {CommandState} 
 */
export const redditSearchTopHandler = 
    (query: string, limit: number): Effect.Effect<CommandState, Error, TerminalUserStateConfigContext> => Effect.gen(function*() {
        const st = yield* TerminalUserStateConfigContext;
        const applicationLogging = inspectLogger(st);

        let _query = query;
        if (!_query) {
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
})

/**
 * Return top posts from the given subreddit
 * @param {TerminalUserStateConfig} st Terminal user state 
 * @param {string} subreddit Subreddit to fetch posts from 
 * @param {number} limit Number of posts to fetch 
 * @returns {CommandState} 
 */
export const redditTopHandler = (subreddit: string, limit: number):
    Effect.Effect<CommandState, Error, TerminalUserStateConfigContext> => Effect.gen(function*() {
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