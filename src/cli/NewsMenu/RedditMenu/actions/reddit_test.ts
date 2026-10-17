import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect, Layer, LogLevel } from "effect";
import {
  CommandResultType,
  DataSourceType,
  EnvironmentType,
  TerminalUserStateConfigContext,
  type TerminalUserStateConfig,
} from "../../../types.ts";
import { HTTPError } from "src/cli/errors/index.ts";
import {
  RedditService,
  type RedditModelPort,
  type RedditPost,
} from "src/services/RedditService/types.ts";
import { redditSearchTopHandler, redditTopHandler } from "./reddit.ts";

const state: TerminalUserStateConfig = {
  environment: EnvironmentType.Development,
  logLevel: LogLevel.None,
  sessionPath: "sessions/reddit_actions_test.jsonl",
  apiKeys: {
    coingecko: undefined,
    alphavantage: undefined,
    blockchaincom: undefined,
    freecryptoapi: undefined,
    fred: undefined,
    massive: undefined,
    yahoofinance: undefined,
    alpaca: undefined,
    coinmarketcap: undefined,
  },
  loadedContext: {
    stocks: { datasource: DataSourceType.AlphaVantage },
    options: { datasource: DataSourceType.YahooFinance },
  },
  scriptContext: {},
};

const POST: RedditPost = {
  title: "IEA agrees to release oil barrels",
  link: "https://www.reddit.com/r/oil/comments/1x6sxuo/iea_agrees/",
  date: "10/15/2026, 2:06:39 PM",
  author: "GovernmentGoblin",
};

/** The menu provides the real layer; these handlers take whatever one is given. */
interface RedditMock {
  get?: RedditModelPort["get"];
  search?: RedditModelPort["search"];
}

const mockReddit = (port: RedditMock) =>
  Layer.succeed(RedditService, {
    get: port.get ?? (() => Effect.succeed([])),
    search: port.search ?? (() => Effect.succeed([])),
  } satisfies RedditModelPort);

const captureLog = () => {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  return {
    lines,
    text: () => lines.join("\n"),
    restore: () => {
      console.log = original;
    },
  };
};

const run = <A, E>(
  handler: Effect.Effect<A, E, RedditService | TerminalUserStateConfigContext>,
  port: RedditMock,
) =>
  Effect.runPromise(
    handler.pipe(
      Effect.provide(mockReddit(port)),
      Effect.provide(Layer.succeed(TerminalUserStateConfigContext, state)),
    ),
  );

describe("reddit subreddit handler", () => {
  it("prints the reason the feed failed instead of failing silently", async () => {
    // The regression: a command that returns an error without printing leaves
    // the front ends showing a bare "Invalid command", so a rate-limited feed
    // reads like a typo.
    const logged = captureLog();
    const result = await run(
      redditTopHandler("oil"),
      {
        get: () =>
          Effect.fail(new HTTPError({
            message: "Reddit rate-limited the request (HTTP 429)",
          })),
      },
    );
    logged.restore();

    expect(result.result.type).toBe(CommandResultType.Error);
    expect(logged.text()).toContain("r/oil");
    expect(logged.text()).toContain("Reddit rate-limited the request (HTTP 429)");
  });

  it("prints the posts it loaded", async () => {
    const logged = captureLog();
    const result = await run(redditTopHandler("oil"), {
      get: () => Effect.succeed([POST]),
    });
    logged.restore();

    expect(result.result.type).toBe(CommandResultType.Success);
    expect(logged.text()).toContain("Best posts from r/oil");
    expect(logged.text()).toContain(POST.title);
    expect(logged.text()).toContain(POST.link);
  });

  it("falls back to r/ethereum when no subreddit is given", async () => {
    const logged = captureLog();
    const seen: (string | undefined)[] = [];
    await run(redditTopHandler(undefined), {
      get: (subreddit) => {
        seen.push(subreddit);
        return Effect.succeed([]);
      },
    });
    logged.restore();

    expect(seen).toEqual(["ethereum"]);
    expect(logged.text()).toContain("Best posts from r/ethereum");
  });
});

describe("reddit search handler", () => {
  it("asks for a query before spending a request", async () => {
    const logged = captureLog();
    const result = await run(
      redditSearchTopHandler(undefined),
      {
        search: () => Effect.die("the network must not be called without a query"),
      },
    );
    logged.restore();

    expect(result.result.type).toBe(CommandResultType.Error);
    expect(logged.text()).toContain("No query term supplied.");
  });

  it("prints the reason a search failed", async () => {
    const logged = captureLog();
    const result = await run(
      redditSearchTopHandler("oil"),
      {
        search: () =>
          Effect.fail(new HTTPError({
            message: "Reddit rate-limited the request (HTTP 429)",
          })),
      },
    );
    logged.restore();

    expect(result.result.type).toBe(CommandResultType.Error);
    expect(logged.text()).toContain('Could not search Reddit for "oil"');
    expect(logged.text()).toContain("429");
  });

  it("prints the posts it found", async () => {
    const logged = captureLog();
    const result = await run(redditSearchTopHandler("oil"), {
      search: () => Effect.succeed([POST]),
    });
    logged.restore();

    expect(result.result.type).toBe(CommandResultType.Success);
    expect(logged.text()).toContain(POST.title);
  });
});
