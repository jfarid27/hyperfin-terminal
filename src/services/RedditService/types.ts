import Parser from "rss-parser";
import { Effect, Context, Layer } from "effect";
import { pipe as pipeR, project, map, filter } from "ramda";
import { HTTPError } from "src/cli/errors/index.ts";
import { FetchService, type FetchServicePort } from "src/cli/services/FetchService.ts";

const MAX_TITLE_LENGTH = 65;
const MAX_AUTHOR_LENGTH = 25;

/** How many times one feed request is tried, the first attempt included. */
export const FEED_ATTEMPTS = 3;
/** First backoff step; it doubles per retry (500ms, then 1s). */
export const FEED_BACKOFF_MS = 500;
/**
 * Longest wait a server's own hint can ask for.
 *
 * Reddit answers a rate-limited request with `x-ratelimit-reset`, which is the
 * seconds left in its window and is measured in tens of seconds — 47s and 58s
 * in a live probe. Waiting that out is the difference between a news command
 * and a hang, so the hint is honoured only up to here.
 */
export const MAX_HONOURED_WAIT_MS = 5_000;

/**
 * Headers for a feed request.
 *
 * Reddit's anonymous `.rss` endpoints are rate-limited hard, and this keeps the
 * exact request shape `rss-parser` used to send on our behalf — a named
 * `User-Agent` plus a feed `Accept` — now that the request goes through
 * `FetchService` instead.
 */
export const FEED_HEADERS: HeadersInit = {
  "User-Agent": "rss-parser",
  Accept: "application/rss+xml",
};

export interface RedditPost {
  title: string;
  link: string;
  date: string;
  author: string;
}

/**
 * Pluck relevant data from feed and transform it into something nice to display.
 */
export const generateRedditDataFromFeed = pipeR(
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

/** One attempt at a feed URL: the XML, or why it failed. */
type FeedAttempt =
  | { readonly ok: true; readonly xml: string }
  | {
    readonly ok: false;
    readonly reason: string;
    readonly retryable: boolean;
    readonly waitHintMs?: number;
  };

/**
 * Whether a status is worth another try.
 *
 * `429` is the one that actually happens: Reddit rate-limits anonymous `.rss`
 * traffic, so a failure is usually "come back in a moment" rather than a bad
 * subreddit. `408` and the `5xx` family are the usual transient siblings; any
 * other `4xx` (403 blocked, 404 no such subreddit) is a real answer, and
 * retrying it only makes the user wait for the same message.
 */
export const isRetryableStatus = (status: number): boolean =>
  status === 429 || status === 408 || status >= 500;

/**
 * Why a feed request failed, told the way a user needs to hear it.
 *
 * A rate limit says so, and repeats how long the server said its window has
 * left: that is the difference between "try again in a minute" and re-running
 * the command straight into the same 429.
 */
export const feedFailureReason = (
  status: number,
  statusText: string,
  resetSeconds?: number,
): string => {
  const label = `HTTP ${status}${statusText ? ` ${statusText}` : ""}`;
  if (status !== 429) return `Reddit answered ${label}`;
  const resets = resetSeconds === undefined ? "" : `; resets in ${Math.ceil(resetSeconds)}s`;
  return `Reddit rate-limited the request (${label}${resets})`;
};

/**
 * The milliseconds in a rate-limit header.
 *
 * Reddit spells both of its hints in seconds — `Retry-After: 2` and
 * `x-ratelimit-reset: 47`, the latter with a decimal point — so one reader
 * covers both. `undefined` means "no usable hint", never "wait zero".
 */
export const parseSecondsHeaderMs = (header: string | null): number | undefined => {
  if (!header) return undefined;
  const seconds = Number(header.trim());
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined;
};

/**
 * How long to wait before the next try.
 *
 * The server's own number wins when it gives one, capped by
 * {@link MAX_HONOURED_WAIT_MS} and floored by the backoff — a hint of `0s`
 * means "the window is over", yet that same response just refused us, so
 * retrying instantly only burns an attempt. With no hint the backoff doubles.
 */
export const retryWaitMs = (
  hintMs: number | undefined,
  backoffMs: number,
  attempt: number,
): number => {
  const backoff = backoffMs * 2 ** (attempt - 1);
  if (hintMs === undefined) return backoff;
  return Math.min(Math.max(hintMs, backoff), MAX_HONOURED_WAIT_MS);
};

/**
 * The URL of a subreddit's hot posts, as a feed.
 */
export const subredditFeedUrl = (subreddit: string, limit: number): string =>
  `https://www.reddit.com/r/${subreddit}/hot/.rss?limit=${limit}`;

/**
 * The URL of a top-posts search, as a feed.
 *
 * `URLSearchParams` rather than interpolation: the query is user input, and
 * escaping it is what keeps a stray `&` from truncating the URL.
 */
export const searchFeedUrl = (query: string, limit: number): string => {
  const params = new URLSearchParams({
    q: query,
    type: "posts",
    sort: "top",
    t: "week",
    limit: String(limit),
  });
  return `https://www.reddit.com/search/.rss?${params}`;
};

/** Read a response into an attempt. Never fails — the failure is the attempt. */
const toFeedAttempt = (response: Response, url: string): Effect.Effect<FeedAttempt> =>
  Effect.gen(function* () {
    if (response.ok) {
      const xml = yield* Effect.tryPromise(() => response.text()).pipe(
        Effect.orElseSucceed(() => null),
      );
      return xml === null
        ? { ok: false, reason: `Could not read the Reddit feed at ${url}`, retryable: true }
        : { ok: true, xml };
    }

    // Release the error body we are not going to read, so the connection is
    // not left hanging for the next attempt.
    const body = response.body;
    if (body) yield* Effect.promise(() => body.cancel().then(() => undefined));

    const resetMs = parseSecondsHeaderMs(response.headers.get("x-ratelimit-reset"));

    return {
      ok: false,
      reason: feedFailureReason(
        response.status,
        response.statusText,
        resetMs === undefined ? undefined : resetMs / 1000,
      ),
      retryable: isRetryableStatus(response.status),
      waitHintMs: parseSecondsHeaderMs(response.headers.get("retry-after")) ?? resetMs,
    };
  });

/** One request for a feed. */
const fetchFeedOnce = (fetchImpl: FeedFetch, url: string): Effect.Effect<FeedAttempt> =>
  Effect.gen(function* () {
    return yield* fetchImpl(url, undefined, { headers: FEED_HEADERS }).pipe(
      Effect.flatMap((response) => toFeedAttempt(response, url)),
      // A request that never reached Reddit (DNS, TLS, offline) is worth
      // another try as well.
      Effect.catchAll((error: unknown): Effect.Effect<FeedAttempt> =>
        Effect.succeed({
          ok: false,
          reason: error instanceof Error ? error.message : String(error),
          retryable: true,
        })
      ),
    );
  });

/**
 * The one thing this module needs from `FetchService`: its `fetch`.
 *
 * Passed in rather than required in the effect's context so the service's own
 * port stays context-free (the layer captures it once), and so the retry loop
 * can be exercised against a stub fetch.
 */
export type FeedFetch = FetchServicePort["fetch"];

/**
 * Fetch a Reddit feed as XML, with a bounded retry.
 *
 * Reddit rate-limits anonymous `.rss` traffic hard, so one `429` is not an
 * answer: a short retry rides out the momentary case. It cannot ride out the
 * long one — Reddit's window runs to tens of seconds — so what matters is that
 * the user is told, in the message the handler prints, that they were
 * rate-limited rather than handed a bare "Invalid command".
 */
export const fetchFeedXml = (
  fetchImpl: FeedFetch,
  url: string,
  options: { attempts?: number; backoffMs?: number } = {},
): Effect.Effect<string, HTTPError> =>
  Effect.gen(function* () {
    const attempts = Math.max(1, options.attempts ?? FEED_ATTEMPTS);
    const backoffMs = options.backoffMs ?? FEED_BACKOFF_MS;
    let lastFailure = `No request was made for ${url}`;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      const outcome = yield* fetchFeedOnce(fetchImpl, url);
      if (outcome.ok) return outcome.xml;

      lastFailure = outcome.reason;
      if (!outcome.retryable || attempt === attempts) break;

      const waitMs = retryWaitMs(outcome.waitHintMs, backoffMs, attempt);
      yield* Effect.logDebug(
        `Reddit feed request failed (${outcome.reason}); retrying in ${waitMs}ms (attempt ${attempt + 1}/${attempts})`,
      );
      yield* Effect.sleep(waitMs);
    }

    return yield* Effect.fail(new HTTPError({ message: lastFailure }));
  });

/** Parse a feed's XML into its items. */
const parseFeedItems = (xml: string): Effect.Effect<any[], HTTPError> =>
  Effect.tryPromise({
    try: () => new Parser().parseString(xml),
    catch: () => new HTTPError({ message: "Reddit returned a feed that could not be parsed." }),
  }).pipe(Effect.map((feed) => feed.items ?? []));

export interface RedditModelPort {
  get: (subreddit: string, limit?: number) => Effect.Effect<RedditPost[], HTTPError>;
  search: (query: string, limit?: number) => Effect.Effect<RedditPost[], HTTPError>;
}

export class RedditService extends Context.Tag("hyperfin.news.RedditService")<
  RedditService,
  RedditModelPort
>() {}

export const RedditLayer = Layer.effect(
  RedditService,
  Effect.gen(function* () {
    // Captured once, at layer construction: the methods below stay
    // context-free, which is what keeps `RedditModelPort` a plain data port.
    const fs = yield* FetchService;

    /** Fetch a feed, parse it, and report what came back. */
    const load = (url: string, label: string): Effect.Effect<RedditPost[], HTTPError> =>
      Effect.gen(function* () {
        const xml = yield* fetchFeedXml(fs.fetch, url);
        const items = yield* parseFeedItems(xml);
        const posts = generateRedditDataFromFeed(items);
        yield* Effect.logInfo(`Found ${posts.length} results for "${label}"`);
        return posts;
      });

    return {
      get: (subreddit: string, limit: number = 20) =>
        load(subredditFeedUrl(subreddit, limit), subreddit),
      search: (query: string, limit: number = 20) =>
        load(searchFeedUrl(query, limit), query),
    } satisfies RedditModelPort;
  }),
);
