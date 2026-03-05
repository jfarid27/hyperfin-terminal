import Parser from "rss-parser";
import { Effect, pipe } from 'effect';
import { pipe as pipeR, project, map, filter } from 'ramda';

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
 * @param {any} feed Feed to generate data from 
 * @returns {any} Generated data 
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

/**
 * Fetch best posts from the given subreddit
 * @param subreddit Subreddit to fetch posts from
 * @param limit Number of posts to fetch
 * @returns Feed object
 */
export function getRedditBest(subreddit: string, limit: number=20): Effect.Effect<RedditPost[], Error> {
    const url = `https://www.reddit.com/r/${subreddit}/hot/.rss?limit=${limit}`;
    const parser = new Parser();
    return pipe(
        Effect.tryPromise(() => parser.parseURL(url)),
        Effect.map((response: any) => {
            return generateRedditDataFromFeed(response.items)
        })
    );
}

/**
 * Fetch top posts from the given query
 * @param query Query to fetch posts from
 * @param limit Number of posts to fetch
 * @returns Feed object
 */
export function getRedditSearchTop(query: string, limit: number=20): Effect.Effect<RedditPost[], Error> {
    const url = `https://www.reddit.com/search/.rss?q=${query}&type=posts&sort=top&t=week&limit=${limit}`;
    const parser = new Parser();
    return pipe(
        Effect.tryPromise(() => parser.parseURL(url)),
        Effect.map((response: any) => {
            return generateRedditDataFromFeed(response.items)
        })
    );
}