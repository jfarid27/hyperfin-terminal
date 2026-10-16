import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Cause, Effect, Exit, Option } from "effect";
import { FetchService, FetchServiceLive } from "src/cli/services/FetchService.ts";
import { HTTPError } from "src/cli/errors/index.ts";
import {
  FEED_BACKOFF_MS,
  generateRedditDataFromFeed,
  feedFailureReason,
  fetchFeedXml,
  isRetryableStatus,
  MAX_HONOURED_WAIT_MS,
  parseSecondsHeaderMs,
  retryWaitMs,
  searchFeedUrl,
  subredditFeedUrl,
} from "./types.ts";

// ── A stub feed server ───────────────────────────────────────────────────────

/** Enough of a feed for the transport tests, which never parse it. */
const FEED_XML = `<?xml version="1.0"?><feed><title>r/oil</title></feed>`;

interface StubFeed {
  /** Resolves with the stub's URL once it is listening. */
  readonly url: Promise<string>;
  /** How many requests the stub has answered. */
  requests: () => number;
  shutdown: () => Promise<void>;
}

/**
 * Answer with `responses` in order, repeating the last one once they run out.
 *
 * Port 0 lets the OS pick a free port; `onListen` is what tells us it is up,
 * because `Deno.serve` returns before the socket is bound.
 */
const startStubFeed = (responses: Response[]): StubFeed => {
  let requests = 0;
  let announce: (url: string) => void = () => {};
  const url = new Promise<string>((resolve) => {
    announce = resolve;
  });

  const server = Deno.serve(
    {
      port: 0,
      onListen: (addr) => announce(`http://localhost:${addr.port}/feed`),
    },
    () => {
      const response = responses[Math.min(requests, responses.length - 1)];
      requests++;
      return response.clone();
    },
  );

  return {
    url,
    requests: () => requests,
    shutdown: () => server.shutdown(),
  };
};

const fetchXml = async (
  url: string,
  options?: { attempts?: number; backoffMs?: number },
) => {
  // The real FetchService implementation, injected — the retry loop is what is
  // under test here, not the fetch itself.
  const fetchImpl = await Effect.runPromise(
    Effect.map(FetchService, (fs) => fs.fetch).pipe(Effect.provide(FetchServiceLive)),
  );
  return Effect.runPromiseExit(fetchFeedXml(fetchImpl, url, options));
};

const failureMessage = (exit: Exit.Exit<string, HTTPError>): string => {
  if (Exit.isSuccess(exit)) throw new Error("expected the fetch to fail");
  const failure = Cause.failureOption(exit.cause);
  return Option.isSome(failure) ? failure.value.message : Cause.pretty(exit.cause);
};

// ── Pure helpers ─────────────────────────────────────────────────────────────

describe("isRetryableStatus", () => {
  it("retries the transient statuses", () => {
    // 429 is the one Reddit actually sends for anonymous RSS.
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(408)).toBe(true);
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
  });

  it("does not retry an answer that will not change", () => {
    expect(isRetryableStatus(200)).toBe(false);
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(403)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
  });
});

describe("parseSecondsHeaderMs", () => {
  it("reads a header spelled in seconds, decimal point included", () => {
    expect(parseSecondsHeaderMs("2")).toBe(2000);
    expect(parseSecondsHeaderMs("0.0")).toBe(0);
    expect(parseSecondsHeaderMs("47")).toBe(47000);
    expect(parseSecondsHeaderMs(" 3 ")).toBe(3000);
  });

  it("ignores a missing or unusable header", () => {
    expect(parseSecondsHeaderMs(null)).toBeUndefined();
    expect(parseSecondsHeaderMs("")).toBeUndefined();
    expect(parseSecondsHeaderMs("Wed, 21 Oct 2026 07:28:00 GMT")).toBeUndefined();
    expect(parseSecondsHeaderMs("-1")).toBeUndefined();
  });
});

describe("retryWaitMs", () => {
  it("doubles the backoff when the server offers no hint", () => {
    expect(retryWaitMs(undefined, FEED_BACKOFF_MS, 1)).toBe(500);
    expect(retryWaitMs(undefined, FEED_BACKOFF_MS, 2)).toBe(1000);
    expect(retryWaitMs(undefined, FEED_BACKOFF_MS, 3)).toBe(2000);
  });

  it("uses the server's own number when it gives one", () => {
    expect(retryWaitMs(2000, FEED_BACKOFF_MS, 1)).toBe(2000);
  });

  it("keeps a pause even when the server says its window is over", () => {
    // `x-ratelimit-reset: 0` arrives with a 429, so an instant retry just
    // spends an attempt on the same answer.
    expect(retryWaitMs(0, FEED_BACKOFF_MS, 1)).toBe(FEED_BACKOFF_MS);
  });

  it("caps a hint that would outlast the command", () => {
    // Reddit's window is measured in tens of seconds; the command waits for
    // five and then reports, rather than sitting on the prompt.
    expect(retryWaitMs(58_000, FEED_BACKOFF_MS, 1)).toBe(MAX_HONOURED_WAIT_MS);
    expect(MAX_HONOURED_WAIT_MS).toBe(5000);
  });
});

describe("feedFailureReason", () => {
  it("names rate limiting as rate limiting", () => {
    expect(feedFailureReason(429, "Too Many Requests")).toBe(
      "Reddit rate-limited the request (HTTP 429 Too Many Requests)",
    );
  });

  it("repeats how long the server said its window has left", () => {
    expect(feedFailureReason(429, "", 47)).toContain("resets in 47s");
    expect(feedFailureReason(429, "", 3.5)).toContain("resets in 4s");
  });

  it("reports any other status plainly, with its reason phrase", () => {
    expect(feedFailureReason(403, "Forbidden")).toBe("Reddit answered HTTP 403 Forbidden");
    expect(feedFailureReason(404, "")).toBe("Reddit answered HTTP 404");
  });
});

describe("feed URLs", () => {
  it("points a subreddit at its RSS feed", () => {
    expect(subredditFeedUrl("oil", 20)).toBe(
      "https://www.reddit.com/r/oil/hot/.rss?limit=20",
    );
  });

  it("escapes the search query", () => {
    expect(searchFeedUrl("oil", 20)).toBe(
      "https://www.reddit.com/search/.rss?q=oil&type=posts&sort=top&t=week&limit=20",
    );
    expect(searchFeedUrl("oil & gas", 5)).toContain("q=oil+%26+gas");
  });
});

describe("generateRedditDataFromFeed", () => {
  it("drops items without an author and trims what is left", () => {
    const posts = generateRedditDataFromFeed([
      {
        title: "A".repeat(80),
        link: "https://www.reddit.com/r/oil/comments/1",
        pubDate: "2026-10-15T21:00:00+00:00",
        author: "/u/oilwatcher",
      },
      { title: "No author", link: "https://www.reddit.com/r/oil/comments/2" },
    ]);

    expect(posts.length).toBe(1);
    expect(posts[0].title.length).toBe(65);
    expect(posts[0].author).toBe("oilwatcher");
    expect(posts[0].link).toBe("https://www.reddit.com/r/oil/comments/1");
  });
});

// ── The transport ────────────────────────────────────────────────────────────

describe("fetchFeedXml", () => {
  it("returns the feed", async () => {
    const stub = startStubFeed([new Response(FEED_XML, { status: 200 })]);
    const exit = await fetchXml(await stub.url);
    await stub.shutdown();

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) expect(exit.value).toBe(FEED_XML);
    expect(stub.requests()).toBe(1);
  });

  it("retries a rate-limited request and succeeds", async () => {
    const stub = startStubFeed([
      new Response("", { status: 429 }),
      new Response("", { status: 429 }),
      new Response(FEED_XML, { status: 200 }),
    ]);
    const exit = await fetchXml(await stub.url, { attempts: 4, backoffMs: 1 });
    await stub.shutdown();

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(stub.requests()).toBe(3);
  });

  it("gives up after its attempts, naming the status", async () => {
    const stub = startStubFeed([new Response("", { status: 429 })]);
    const exit = await fetchXml(await stub.url, { attempts: 3, backoffMs: 1 });
    await stub.shutdown();

    expect(Exit.isFailure(exit)).toBe(true);
    expect(stub.requests()).toBe(3);
    expect(failureMessage(exit)).toContain("429");
  });

  it("does not retry a status that will not change", async () => {
    const stub = startStubFeed([new Response("blocked", { status: 403 })]);
    const exit = await fetchXml(await stub.url, { attempts: 4, backoffMs: 1 });
    await stub.shutdown();

    expect(Exit.isFailure(exit)).toBe(true);
    // One request: a blocked or missing subreddit will not answer differently.
    expect(stub.requests()).toBe(1);
    expect(failureMessage(exit)).toContain("403");
  });

  it("waits as long as the server asked", async () => {
    const stub = startStubFeed([
      new Response("", { status: 429, headers: { "retry-after": "1" } }),
      new Response(FEED_XML, { status: 200 }),
    ]);
    const url = await stub.url;

    const started = Date.now();
    // backoffMs of 1ms means anything close to a second came from Retry-After.
    const exit = await fetchXml(url, { attempts: 2, backoffMs: 1 });
    const elapsed = Date.now() - started;
    await stub.shutdown();

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(elapsed).toBeGreaterThanOrEqual(900);
  });

  it("carries Reddit's rate-limit window into the failure it reports", async () => {
    const stub = startStubFeed([
      new Response("", { status: 429, headers: { "x-ratelimit-reset": "47" } }),
    ]);
    const exit = await fetchXml(await stub.url, { attempts: 1 });
    await stub.shutdown();

    expect(Exit.isFailure(exit)).toBe(true);
    expect(failureMessage(exit)).toContain("resets in 47s");
  });

  it("hands back the body as sent — parsing is a separate step", async () => {
    const stub = startStubFeed([new Response("<not-a-feed", { status: 200 })]);
    const exit = await fetchXml(await stub.url);
    await stub.shutdown();

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) expect(exit.value).toBe("<not-a-feed");
  });
});
