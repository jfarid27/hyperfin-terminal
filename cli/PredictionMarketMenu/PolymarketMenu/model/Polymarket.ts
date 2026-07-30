import { Effect, pipe } from "effect";
import { HTTPError } from "cli/errors/index.ts";

export function fetchMarketPriceHistoryByClobId(
    clobId: string,
    startTs?: number,
    endTs?: number,
    interval?: string,
) {
    return pipe(
        Effect.tryPromise(async () => {
            const start = startTs ?? (Date.now() / 1000 - 60 * 60 * 24 * 7);
            const end = endTs ?? (Date.now() / 1000);
            const inter = interval ?? "6h";

            const params = new URLSearchParams({
                market: clobId,
                startTs: String(start),
                endTs: String(end),
                interval: inter,
            });
            const response = await fetch(
                `https://clob.polymarket.com/prices-history?${params}`
            );
            return response.json();
        }),
        Effect.flatMap((data) => Effect.succeed(data)),
        Effect.catchAll((err) => Effect.gen(function* () {
          yield * Effect.logError(err);
          return yield* new HTTPError({ message: "Failed to fetch Polymarket prices." })
        }))
    );
}

/**
 * Fetches the list of available topic tags from Polymarket.
 * @link https://docs.polymarket.com/api-reference/
 */
export function fetchTopicsPolymarket() {
    return pipe(
        Effect.tryPromise(async () => {
            const params = new URLSearchParams({
                limit: "1000",
            });
            const response = await fetch(`https://gamma-api.polymarket.com/tags?${params}`);
            return response.json();
        }),
        Effect.flatMap((data) => Effect.succeed(data)),
        Effect.catchAll((err) => Effect.gen(function* () {
          yield * Effect.logError(err);
          return yield* new HTTPError({ message: "Failed to fetch polymarket tags." })
        }))
    );
}

/**
 * Fetches the event data for a given slug from Polymarket.
 * @param slug The slug of the event to fetch events for.
 * @link https://docs.polymarket.com/api-reference/
 */
export function fetchEventDataBySlug(slug: string) {
    return pipe(
        Effect.tryPromise(async () => {
            const response = await fetch(
                `https://gamma-api.polymarket.com/events/slug/${slug}`
            );
            return response.json();
        }),
        Effect.flatMap((data) => Effect.succeed(data)),
        Effect.catchAll((err) => Effect.gen(function* () {
          yield * Effect.logError(err);
          return yield* new HTTPError({ message: "Failed to fetch polymarket slug." })
        }))
    );
}

/**
 * Fetches the market data for a given slug from Polymarket.
 * @param slug The slug of the market to fetch data for.
 * @link https://docs.polymarket.com/api-reference/
 */
export function fetchMarketDataBySlug(slug: string) {
    return pipe(
        Effect.tryPromise(async () => {
            const response = await fetch(
                `https://gamma-api.polymarket.com/markets/slug/${slug}`
            );
            return response.json();
        }),
        Effect.flatMap((data) => Effect.succeed(data)),
        Effect.catchAll((err) => Effect.gen(function* () {
          yield * Effect.logError(err);
          return yield* new HTTPError({ message: "Failed to fetch polymarket slug." })
        }))
    );
}

/**
 * Fetches the list of available events from Polymarket.
 * @param tagId The ID of the tag to fetch events for.
 * @link https://docs.polymarket.com/api-reference/
 */
export function fetchEventDataByTagId(tagId: string) {
    return pipe(
        Effect.tryPromise(async () => {
            const params = new URLSearchParams({
                tag_id: tagId,
            });
            const response = await fetch(
                `https://gamma-api.polymarket.com/events?${params}`
            );
            return response.json();
        }),
        Effect.flatMap((data) => Effect.succeed(data)),
        Effect.catchAll((err) => Effect.gen(function* () {
          yield * Effect.logError(err);
          return yield* new HTTPError({ message: "Failed to fetch polymarket data." })
        }))
    )
}

/**
 * Fetches the list of available markets from Polymarket.
 * @param tagId The ID of the tag to fetch markets for.
 * @link https://docs.polymarket.com/api-reference/
 */
export function fetchMarketDataByTagId(tagId: string) {
    return pipe(
        Effect.tryPromise(async () => {
            const params = new URLSearchParams({
                tag_id: tagId,
                closed: "false",
                order: "liquidityNum",
                ascending: "false",
            });
            const response = await fetch(
                `https://gamma-api.polymarket.com/markets?${params}`
            );
            return response.json();
        }),
        Effect.flatMap((data) => Effect.succeed(data)),
        Effect.catchAll((err) => Effect.gen(function* () {
          yield * Effect.logError(err);
          return yield* new HTTPError({ message: "Failed to fetch polymarket data." })
        }))
    );
}

/**
 * Fetches the list of available events from Polymarket.
 * @param limit The number of events to fetch.
 * @link https://docs.polymarket.com/api-reference/
 */
export function fetchTopEventData(limit: number = 10) {
    return pipe(
        Effect.tryPromise(async () => {
            const params = new URLSearchParams({
                order: "liquidityNum",
                ascending: "false",
                closed: "false",
                limit: String(limit),
                volume_num_min: "100000",
            });
            const response = await fetch(
                `https://gamma-api.polymarket.com/events?${params}`
            );
            return response.json();
        }),
        Effect.flatMap((data) => Effect.succeed(data)),
        Effect.tap(() => Effect.sleep(3000)),
        Effect.catchAll((err) => Effect.gen(function* () {
          yield * Effect.logError(err);
          return yield* new HTTPError({ message: "Failed to fetch polymarket events." })
        }))
    );
}

/**
 * Fetches the list of available markets from Polymarket.
 * @param limit The number of markets to fetch.
 * @link https://docs.polymarket.com/api-reference/
 */
export function fetchTopMarketData(limit: number = 10) {
    return pipe(
        Effect.tryPromise(async () => {
            const params = new URLSearchParams({
                order: "liquidityNum",
                ascending: "false",
                closed: "false",
                limit: String(limit),
                volume_num_min: "100000",
            });
            const response = await fetch(
                `https://gamma-api.polymarket.com/markets?${params}`
            );
            return response.json();
        }),
        Effect.flatMap((data) => Effect.succeed(data)),
        Effect.tap(() => Effect.sleep(3000)),
        Effect.catchAll((err) => Effect.gen(function* () {
          yield * Effect.logError(err);
          return yield* new HTTPError({ message: "Failed to fetch polymarket markets." })
        }))
    );
}

/**
 * Fetches the list of available positions from Polymarket.
 * @param address The address of the user to fetch positions for.
 * @link https://docs.polymarket.com/api-reference/
 */
export function fetchUserPositions(address: string) {
    return pipe(
        Effect.tryPromise(async () => {
            const params = new URLSearchParams({
                user: address,
            });
            const response = await fetch(
                `https://data-api.polymarket.com/positions/?${params}`
            );
            return response.json();
        }),
        Effect.flatMap((data) => Effect.succeed(data)),
        Effect.tap(() => Effect.sleep(3000)),
        Effect.catchAll((err) => Effect.gen(function* () {
          yield * Effect.logError(err);
          return yield* new HTTPError({ message: "Failed to fetch polymarket positions." })
        }))
    );
}

/**
 * Fetches the list of available positions from Polymarket.
 * @param query The query to search for.
 * @link https://docs.polymarket.com/api-reference/
 */
export function fetchSearchPolymarket(query: string) {
    return pipe(
        Effect.tryPromise(async () => {
            const params = new URLSearchParams({
                q: query,
                limit_per_type: "5",
                ascending: "false",
                event_status: "open",
                sort: "liquidity",
                optimized: "true",
            });
            const response = await fetch(
                `https://gamma-api.polymarket.com/public-search?${params}`,
                {
                    headers: {
                        'content-type': 'application/json',
                    },
                }
            );
            return response.json();
        }),
        Effect.flatMap((data) => Effect.succeed(data)),
        Effect.tap(() => Effect.sleep(3000)),
        Effect.catchAll((err) => Effect.gen(function* () {
          yield * Effect.logError(err);
          return yield* new HTTPError({ message: "Failed to fetch polymarket search objects." })
        }))
    );
}
