import axios, { AxiosResponse } from "axios";
import { Effect, pipe } from "effect";

export function fetchMarketPriceHistoryByClobId(clobId: string) {
    
    return pipe(
        Effect.tryPromise(() => {
            const OneWeekAgoUnixTimestamp = Date.now() / 1000 - 60 * 60 * 24 * 7;
            const CurrentUnixTimestamp = Date.now() / 1000;
            
            return axios.get(
                `https://clob.polymarket.com/prices-history`,
                {
                    params: {
                        market: clobId,
                    startTs: OneWeekAgoUnixTimestamp,
                    endTs: CurrentUnixTimestamp,
                    interval: "6h"
                },
            });
        }),
        Effect.flatMap((response: AxiosResponse) => Effect.succeed(response.data))
    );
}

/**
 * Fetches the list of available topic tags from Polymarket.
 * @link https://docs.polymarket.com/api-reference/
 */
export function fetchTopicsPolymarket() {
    return pipe(
        Effect.tryPromise(() => {
            return axios.get("https://gamma-api.polymarket.com/tags", {
                params: {
                    limit: 1000,
                },
            });
        }),
        Effect.flatMap((response: AxiosResponse) => Effect.succeed(response.data))
    );
}

/**
 * Fetches the event data for a given slug from Polymarket.
 * @param slug The slug of the event to fetch events for.
 * @link https://docs.polymarket.com/api-reference/
 */
export function fetchEventDataBySlug(slug: string) {
    return pipe( 
        Effect.tryPromise(() => {
            return axios.get(
                `https://gamma-api.polymarket.com/events/slug/${slug}`
            );
        }),
        Effect.flatMap((response: AxiosResponse) => Effect.succeed(response.data))
    );
}

/**
 * Fetches the market data for a given slug from Polymarket.
 * @param slug The slug of the market to fetch data for.
 * @link https://docs.polymarket.com/api-reference/
 */
export function fetchMarketDataBySlug(slug: string) {
    return pipe( 
        Effect.tryPromise(() => {
            return axios.get(
                `https://gamma-api.polymarket.com/markets/slug/${slug}`
            );
        }),
        Effect.flatMap((response: AxiosResponse) => Effect.succeed(response.data))
    );
}

/**
 * Fetches the list of available events from Polymarket.
 * @param tagId The ID of the tag to fetch events for.
 * @link https://docs.polymarket.com/api-reference/
 */
export function fetchEventDataByTagId(tagId: string) {
    return pipe( 
        Effect.tryPromise(() => {
            return axios.get(
                `https://gamma-api.polymarket.com/events`,
                {
                    params: {
                        tag_id: tagId,
                    },
                }
            );
        }),
        Effect.flatMap((response: AxiosResponse) => Effect.succeed(response.data))
    );
}

/**
 * Fetches the list of available markets from Polymarket.
 * @param tagId The ID of the tag to fetch markets for.
 * @link https://docs.polymarket.com/api-reference/
 */
export function fetchMarketDataByTagId(tagId: string) {
    return pipe( 
        Effect.tryPromise(() => {
            return axios.get(
                `https://gamma-api.polymarket.com/markets`,
                {
                    params: {
                        tag_id: tagId,
                        closed: false,
                        order: 'liquidityNum',
                        ascending: false,
                    },
                }
            );
        }),
        Effect.flatMap((response: AxiosResponse) => Effect.succeed(response.data))
    );
}

/**
 * Fetches the list of available events from Polymarket.
 * @param limit The number of events to fetch.
 * @link https://docs.polymarket.com/api-reference/
 */
export function fetchTopEventData(limit: number = 10) {
    return pipe( 
        Effect.tryPromise(() => {
            return axios.get(
                'https://gamma-api.polymarket.com/events',
                {
                    params: {
                        order: 'liquidityNum',
                        ascending: false,
                        closed: false,
                        limit,
                        volume_num_min: 100000
                    },
                }
            );
        }),
        Effect.flatMap((response: AxiosResponse) => Effect.succeed(response.data)),
        Effect.tap(() => Effect.sleep(3000))
    );
}

/**
 * Fetches the list of available markets from Polymarket.
 * @param limit The number of markets to fetch.
 * @link https://docs.polymarket.com/api-reference/
 */
export function fetchTopMarketData(limit: number = 10) {
    return pipe( 
        Effect.tryPromise(() => {
            return axios.get(
                'https://gamma-api.polymarket.com/markets',
                {
                    params: {
                        order: 'liquidityNum',
                        ascending: false,
                        closed: false,
                        limit,
                        volume_num_min: 100000
                    },
                }
            );
        }),
        Effect.flatMap((response: AxiosResponse) => Effect.succeed(response.data)),
        Effect.tap(() => Effect.sleep(3000))
    );
}

/**
 * Fetches the list of available positions from Polymarket.
 * @param address The address of the user to fetch positions for.
 * @link https://docs.polymarket.com/api-reference/
 */
export function fetchUserPositions(address: string) {
    return pipe( 
        Effect.tryPromise(() => {
            return axios.get(
                `https://data-api.polymarket.com/positions/`,
                {
                    params: {
                        user: address,
                    },
                }
            );
        }),
        Effect.flatMap((response: AxiosResponse) => Effect.succeed(response.data)),
        Effect.tap(() => Effect.sleep(3000))
    );
}

/**
 * Fetches the list of available positions from Polymarket.
 * @param query The query to search for.
 * @link https://docs.polymarket.com/api-reference/
 */
export function fetchSearchPolymarket(query: string) {
    return pipe( 
        Effect.tryPromise(() => {
            return axios.get(
                `https://gamma-api.polymarket.com/public-search`,
                {
                    headers: {
                        'content-type': 'application/json',
                        'transfer-encoding': 'chunked',
                    },
                    params: {
                        q: query,
                        limit_per_type: 5,
                        ascending: false,
                        event_status: 'open',
                        sort: 'liquidity',
                        optimized: true,
                    },
                }
            );
        }),
        Effect.flatMap((response: AxiosResponse) => Effect.succeed(response.data)),
        Effect.tap(() => Effect.sleep(3000))
    );
}