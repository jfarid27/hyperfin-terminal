import { Effect } from "effect";
import { FetchService } from "cli/services/FetchService.ts";

export function fetchMarketPriceHistoryByClobId(
    clobId: string,
    startTs?: number,
    endTs?: number,
    interval?: string,
) {
    return Effect.gen(function* () {
      const fs = yield* FetchService;
      const start = startTs ?? (Date.now() / 1000 - 60 * 60 * 24 * 7);
      const end = endTs ?? (Date.now() / 1000);
      const inter = interval ?? "6h";

      const params = new URLSearchParams({
          market: clobId,
          startTs: String(start),
          endTs: String(end),
          interval: inter,
      });
      return yield* fs.fetchJson(
        "https://clob.polymarket.com/prices-history",
        params
      );
    });
}

/**
 * Fetches the list of available topic tags from Polymarket.
 * @link https://docs.polymarket.com/api-reference/
 */
export function fetchTopicsPolymarket() {
    return Effect.gen(function* () {
      const fs = yield* FetchService;
      const params = new URLSearchParams({
          limit: "1000",
      });
      return yield* fs.fetchJson("https://gamma-api.polymarket.com/tags", params);
    });
}

/**
 * Fetches the event data for a given slug from Polymarket.
 * @param slug The slug of the event to fetch events for.
 * @link https://docs.polymarket.com/api-reference/
 */
export function fetchEventDataBySlug(slug: string) {
    return Effect.gen(function* () {
      const fs = yield* FetchService;
      return yield* fs.fetchJson(
        `https://gamma-api.polymarket.com/events/slug/${slug}`
      );
    });
}

/**
 * Fetches the market data for a given slug from Polymarket.
 * @param slug The slug of the market to fetch data for.
 * @link https://docs.polymarket.com/api-reference/
 */
export function fetchMarketDataBySlug(slug: string) {
    return Effect.gen(function* () {
      const fs = yield* FetchService;
      return yield* fs.fetchJson(
        `https://gamma-api.polymarket.com/markets/slug/${slug}`
      );
    });
}

/**
 * Fetches the list of available events from Polymarket.
 * @param tagId The ID of the tag to fetch events for.
 * @link https://docs.polymarket.com/api-reference/
 */
export function fetchEventDataByTagId(tagId: string) {
    return Effect.gen(function* () {
      const fs = yield* FetchService;
      const params = new URLSearchParams({
          tag_id: tagId,
      });
      return yield* fs.fetchJson(
        "https://gamma-api.polymarket.com/events",
        params
      );
    });
}

/**
 * Fetches the list of available markets from Polymarket.
 * @param tagId The ID of the tag to fetch markets for.
 * @link https://docs.polymarket.com/api-reference/
 */
export function fetchMarketDataByTagId(tagId: string) {
    return Effect.gen(function* () {
      const fs = yield* FetchService;
      const params = new URLSearchParams({
          tag_id: tagId,
          closed: "false",
          order: "liquidityNum",
          ascending: "false",
      });
      return yield* fs.fetchJson(
        "https://gamma-api.polymarket.com/markets",
        params
      );
    });
}

/**
 * Fetches the list of available events from Polymarket.
 * @param limit The number of events to fetch.
 * @link https://docs.polymarket.com/api-reference/
 */
export function fetchTopEventData(limit: number = 10) {
    return Effect.gen(function* () {
      const fs = yield* FetchService;
      const params = new URLSearchParams({
          order: "liquidityNum",
          ascending: "false",
          closed: "false",
          limit: String(limit),
          volume_num_min: "100000",
      });
      const data = yield* fs.fetchJson(
        "https://gamma-api.polymarket.com/events",
        params
      );
      yield* Effect.sleep(3000);
      return data;
    });
}

/**
 * Fetches the list of available markets from Polymarket.
 * @param limit The number of markets to fetch.
 * @link https://docs.polymarket.com/api-reference/
 */
export function fetchTopMarketData(limit: number = 10) {
    return Effect.gen(function* () {
      const fs = yield* FetchService;
      const params = new URLSearchParams({
          order: "liquidityNum",
          ascending: "false",
          closed: "false",
          limit: String(limit),
          volume_num_min: "100000",
      });
      const data = yield* fs.fetchJson(
        "https://gamma-api.polymarket.com/markets",
        params
      );
      yield* Effect.sleep(3000);
      return data;
    });
}

/**
 * Fetches the list of available positions from Polymarket.
 * @param address The address of the user to fetch positions for.
 * @link https://docs.polymarket.com/api-reference/
 */
export function fetchUserPositions(address: string) {
    return Effect.gen(function* () {
      const fs = yield* FetchService;
      const params = new URLSearchParams({
          user: address,
      });
      const data = yield* fs.fetchJson(
        "https://data-api.polymarket.com/positions/",
        params
      );
      yield* Effect.sleep(3000);
      return data;
    });
}

/**
 * Fetches the list of available positions from Polymarket.
 * @param query The query to search for.
 * @link https://docs.polymarket.com/api-reference/
 */
export function fetchSearchPolymarket(query: string) {
    return Effect.gen(function* () {
      const fs = yield* FetchService;
      const params = new URLSearchParams({
          q: query,
          limit_per_type: "5",
          ascending: "false",
          event_status: "open",
          sort: "liquidity",
          optimized: "true",
      });
      const data = yield* fs.fetchJson(
        "https://gamma-api.polymarket.com/public-search",
        params,
        {
            headers: {
                'content-type': 'application/json',
            },
        }
      );
      yield* Effect.sleep(3000);
      return data;
    });
}
