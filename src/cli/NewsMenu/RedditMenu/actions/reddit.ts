import { CommandResultType, TerminalUserStateConfigContext } from "../../../types.ts";
import { RedditService, type RedditPost } from "src/services/RedditService/types.ts";
import { HTTPError, HTTPErrorTag } from "src/cli/errors/index.ts";
import chalk from "chalk";
import { Effect } from "effect";

/**
 * A feed request's outcome, flattened so the handler can print the reason.
 *
 * The handler has to do the reporting itself: a command that fails produces no
 * output of its own, and the front ends only add a generic "Invalid command"
 * on top of that, which makes a rate-limited feed indistinguishable from a
 * typo. See the runner's `CommandResultType.Error` branch.
 */
type FeedOutcome =
  | { readonly ok: true; readonly posts: RedditPost[] }
  | { readonly ok: false; readonly error: HTTPError };

const toFeedOutcome = (
  posts: Effect.Effect<RedditPost[], HTTPError>,
): Effect.Effect<FeedOutcome> =>
  posts.pipe(
    Effect.map((loaded) => ({ ok: true as const, posts: loaded })),
    Effect.catchTag(HTTPErrorTag, (error: HTTPError) => Effect.succeed({ ok: false as const, error })),
  );

/** Print the loaded posts, under a heading when there is one. */
const printPosts = (posts: RedditPost[], heading?: string): void => {
  if (heading) console.log(chalk.blue.bold(heading));

  for (const item of posts) {
    console.log(chalk.green(item.title))
    console.log(chalk.blue(item.date) + " | " + chalk.green(item.author))
    console.log(chalk.red(item.link) + "\n")
  }
};

/**
 * Return top posts from the given search term
 */
export const redditSearchTopHandler = (query: string | undefined, limit?: number) =>
    Effect.gen(function*() {
        const st = yield* TerminalUserStateConfigContext;
        const reddit = yield* RedditService;

        if (!query) {
            console.log(chalk.red("No query term supplied."))
            return {
                result: { type: CommandResultType.Error },
                state: st,
            };
        }

        const outcome = yield* toFeedOutcome(reddit.search(query, limit || 20));

        if (!outcome.ok) {
            console.log(chalk.red(`Could not search Reddit for "${query}": ${outcome.error.message}`));
            return {
                result: { type: CommandResultType.Error },
                state: st,
            };
        }

        printPosts(outcome.posts);

        return {
            result: { type: CommandResultType.Success },
            state: st,
        };
    });

/**
 * Return top posts from the given subreddit
 */
export const redditTopHandler = (subreddit: string | undefined, limit: number = 20) =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    const reddit = yield* RedditService;

    const _subreddit = subreddit ?? "ethereum";

    const outcome = yield* toFeedOutcome(reddit.get(_subreddit, limit));

    if (!outcome.ok) {
      console.log(chalk.red(`Could not load r/${_subreddit}: ${outcome.error.message}`));
      return {
        result: { type: CommandResultType.Error },
        state: st,
      };
    }

    printPosts(outcome.posts, `Best posts from r/${_subreddit} \n`);

    return {
      result: { type: CommandResultType.Success },
      state: st,
    };
  });
