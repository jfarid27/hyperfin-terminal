import { Effect, Context, Layer } from "effect";
import { FetchService } from "cli/services/FetchService.ts";
import { HTTPError, LocalProcessingError } from "cli/errors/index.ts";

export interface PolymarketModelPort {
  tags: {
    get: () => Effect.Effect<unknown, HTTPError | LocalProcessingError>;
  };
  events: {
    getByTagId: (tagId: string) => Effect.Effect<unknown, HTTPError | LocalProcessingError>;
    top: (limit?: number) => Effect.Effect<unknown, HTTPError | LocalProcessingError>;
  };
  event: {
    getBySlug: (slug: string) => Effect.Effect<any, HTTPError | LocalProcessingError>;
  };
  markets: {
    getByTagId: (tagId: string) => Effect.Effect<any, HTTPError | LocalProcessingError>;
    top: (limit?: number) => Effect.Effect<any, HTTPError | LocalProcessingError>;
  };
  market: {
    getBySlug: (slug: string) => Effect.Effect<any, HTTPError | LocalProcessingError>;
    prices: (
      clobId: string,
      startTs?: number,
      endTs?: number,
      interval?: string,
    ) => Effect.Effect<any, HTTPError | LocalProcessingError>;
  };
  user: {
    getPositions: (address: string) => Effect.Effect<any, HTTPError | LocalProcessingError>;
  };
  search: {
    get: (query: string) => Effect.Effect<any, HTTPError | LocalProcessingError>;
  };
}

export class PolymarketModel extends Context.Tag("hyperfin.predictions.PolymarketModel")<
  PolymarketModel,
  PolymarketModelPort
>() {}

export const PolymarketModelLive = Layer.effect(
  PolymarketModel,
  Effect.gen(function* () {
    const fs = yield* FetchService;
    return {
      tags: {
        get: () =>
          Effect.gen(function* () {
            const params = new URLSearchParams({ limit: "1000" });
            return yield* fs.fetchJson("https://gamma-api.polymarket.com/tags", params);
          }),
      },
      events: {
        getByTagId: (tagId: string) =>
          Effect.gen(function* () {
            const params = new URLSearchParams({ tag_id: tagId });
            return yield* fs.fetchJson("https://gamma-api.polymarket.com/events", params);
          }),
        top: (limit: number = 10) =>
          Effect.gen(function* () {
            const params = new URLSearchParams({
              order: "liquidityNum",
              ascending: "false",
              closed: "false",
              limit: String(limit),
              volume_num_min: "100000",
            });
            const data = yield* fs.fetchJson("https://gamma-api.polymarket.com/events", params);
            yield* Effect.sleep(3000);
            return data;
          }),
      },
      event: {
        getBySlug: (slug: string) =>
          Effect.gen(function* () {
            return yield* fs.fetchJson(`https://gamma-api.polymarket.com/events/slug/${slug}`);
          }),
      },
      markets: {
        getByTagId: (tagId: string) =>
          Effect.gen(function* () {
            const params = new URLSearchParams({
              tag_id: tagId,
              closed: "false",
              order: "liquidityNum",
              ascending: "false",
            });
            return yield* fs.fetchJson("https://gamma-api.polymarket.com/markets", params);
          }),
        top: (limit: number = 10) =>
          Effect.gen(function* () {
            const params = new URLSearchParams({
              order: "liquidityNum",
              ascending: "false",
              closed: "false",
              limit: String(limit),
              volume_num_min: "100000",
            });
            const data = yield* fs.fetchJson("https://gamma-api.polymarket.com/markets", params);
            yield* Effect.sleep(3000);
            return data;
          }),
      },
      market: {
        getBySlug: (slug: string) =>
          Effect.gen(function* () {
            return yield* fs.fetchJson(`https://gamma-api.polymarket.com/markets/slug/${slug}`);
          }),
        prices: (clobId: string, startTs?: number, endTs?: number, interval?: string) =>
          Effect.gen(function* () {
            const start = startTs ?? (Date.now() / 1000 - 60 * 60 * 24 * 7);
            const end = endTs ?? (Date.now() / 1000);
            const inter = interval ?? "6h";
            const params = new URLSearchParams({
              market: clobId,
              startTs: String(start),
              endTs: String(end),
              interval: inter,
            });
            return yield* fs.fetchJson("https://clob.polymarket.com/prices-history", params);
          }),
      },
      user: {
        getPositions: (address: string) =>
          Effect.gen(function* () {
            const params = new URLSearchParams({ user: address });
            const data = yield* fs.fetchJson("https://data-api.polymarket.com/positions/", params);
            yield* Effect.sleep(3000);
            return data;
          }),
      },
      search: {
        get: (query: string) =>
          Effect.gen(function* () {
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
              { headers: { "content-type": "application/json" } },
            );
            yield* Effect.sleep(3000);
            return data;
          }),
      },
    } satisfies PolymarketModelPort;
  }),
);
