import Parser from "rss-parser";
import { Effect, Context, Layer, pipe } from "effect";
import { pipe as pipeR, project, map, filter } from "ramda";
import { HTTPError } from "cli/errors/index.ts";

const MAX_TITLE_LENGTH = 65;
const MAX_AUTHOR_LENGTH = 25;

interface RedditPost {
    title: string;
    link: string;
    date: string;
    author: string;
}

/**
 * Pluck relevant data from feed and transform it into something nice to display.
 */
const generateRedditDataFromFeed = pipeR(
  project(["pubDate", "title", "link", "author"]),
  filter((r: any) => r.author),
  map((r: any) => {
    return {
      date: new Date(r.pubDate).toLocaleString(),
      author: r.author.replace("/u/", "").slice(0, MAX_AUTHOR_LENGTH),
      title: r.title.slice(0, MAX_TITLE_LENGTH),
      link: r.link
    }
  })
);

export interface RedditModelPort {
  get: (subreddit: string, limit?: number) => Effect.Effect<RedditPost[], HTTPError>;
  search: (query: string, limit?: number) => Effect.Effect<RedditPost[], HTTPError>;
}

export class RedditModel extends Context.Tag("hyperfin.news.RedditModel")<
  RedditModel,
  RedditModelPort
>() {}

export const RedditModelLive = Layer.succeed(RedditModel, {
  get: (subreddit: string, limit: number = 20) => {
    const url = `https://www.reddit.com/r/${subreddit}/hot/.rss?limit=${limit}`;
    const parser = new Parser();
    return pipe(
      Effect.tryPromise(() => parser.parseURL(url)),
      Effect.map((response: any) => generateRedditDataFromFeed(response.items)),
      Effect.catchAll((err) => Effect.gen(function* () {
        yield* Effect.logError(err);
        return yield* new HTTPError({ message: "Failed to fetch Reddit RSS feed." });
      })),
    );
  },
  search: (query: string, limit: number = 20) => {
    const url = `https://www.reddit.com/search/.rss?q=${query}&type=posts&sort=top&t=week&limit=${limit}`;
    const parser = new Parser();
    return pipe(
      Effect.tryPromise(() => parser.parseURL(url)),
      Effect.map((response: any) => generateRedditDataFromFeed(response.items)),
      Effect.catchAll((err) => Effect.gen(function* () {
        yield* Effect.logError(err);
        return yield* new HTTPError({ message: "Failed to fetch Reddit RSS feed." });
      })),
    );
  },
});
