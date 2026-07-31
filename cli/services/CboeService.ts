import { Effect, Context, Layer } from "effect";
import { FetchService } from "./FetchService.ts";
import { HTTPError, LocalProcessingError } from "cli/errors/index.ts";

/**
 * CBOE delayed quote response for a single ticker.
 */
export interface CboeQuote {
  ticker: string;
  companyName: string;
  lastPrice: number;
  change: number;
  changePercent: number;
  volume: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  timestamp: string;
}

/**
 * CBOE historical price data point.
 */
export interface CboeHistoricalPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * CBOE options contract.
 */
export interface CboeOptionContract {
  symbol: string;
  description: string;
  expiration: string;
  strike: number;
  type: "call" | "put";
  bid: number;
  ask: number;
  lastPrice: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
}

/**
 * CBOE options chain response.
 */
export interface CboeOptionsChain {
  ticker: string;
  underlyingPrice: number;
  contracts: CboeOptionContract[];
}

export interface CboeServicePort {
  getSpotPrice: (symbol: string) => Effect.Effect<CboeQuote, HTTPError | LocalProcessingError>;
  getHistoricalPrices: (symbol: string) => Effect.Effect<CboeHistoricalPrice[], HTTPError | LocalProcessingError>;
  getOptionsChain: (symbol: string) => Effect.Effect<CboeOptionsChain, HTTPError | LocalProcessingError>;
}

export class CboeService extends Context.Tag("hyperfin.services.CboeService")<
  CboeService,
  CboeServicePort
>() {}

const CBOE_BASE = "https://www.cboe.com/json/bzx/data";

/**
 * Parse a CBOE quote response into a typed CboeQuote.
 */
const parseQuoteResponse = (raw: Record<string, unknown>): CboeQuote => {
  const data = (raw?.data ?? raw) as Record<string, unknown>;
  return {
    ticker: String(data?.ticker ?? ""),
    companyName: String(data?.companyName ?? ""),
    lastPrice: Number(data?.lastPrice ?? 0),
    change: Number(data?.change ?? 0),
    changePercent: Number(data?.changePercent ?? 0),
    volume: Number(data?.volume ?? 0),
    open: Number(data?.open ?? 0),
    high: Number(data?.high ?? 0),
    low: Number(data?.low ?? 0),
    previousClose: Number(data?.previousClose ?? 0),
    timestamp: String(data?.timestamp ?? new Date().toISOString()),
  };
};

/**
 * Parse a CBOE historical prices response.
 */
const parseHistoricalResponse = (raw: Record<string, unknown>): CboeHistoricalPrice[] => {
  const data = (raw?.data ?? raw) as Record<string, unknown>;
  const prices = (data?.prices ?? []) as Record<string, unknown>[];
  return prices.map((p) => ({
    date: String(p?.date ?? ""),
    open: Number(p?.open ?? 0),
    high: Number(p?.high ?? 0),
    low: Number(p?.low ?? 0),
    close: Number(p?.close ?? 0),
    volume: Number(p?.volume ?? 0),
  }));
};

/**
 * Parse a CBOE options chain response.
 */
const parseOptionsResponse = (raw: Record<string, unknown>): CboeOptionsChain => {
  const data = (raw?.data ?? raw) as Record<string, unknown>;
  const contracts = (data?.options ?? []) as Record<string, unknown>[];
  return {
    ticker: String(data?.ticker ?? ""),
    underlyingPrice: Number(data?.underlyingPrice ?? 0),
    contracts: contracts.map((c) => ({
      symbol: String(c?.symbol ?? ""),
      description: String(c?.description ?? ""),
      expiration: String(c?.expiration ?? ""),
      strike: Number(c?.strike ?? 0),
      type: (String(c?.type ?? "") === "call" ? "call" : "put") as "call" | "put",
      bid: Number(c?.bid ?? 0),
      ask: Number(c?.ask ?? 0),
      lastPrice: Number(c?.lastPrice ?? 0),
      volume: Number(c?.volume ?? 0),
      openInterest: Number(c?.openInterest ?? 0),
      impliedVolatility: Number(c?.impliedVolatility ?? 0),
    })),
  };
};

export const CboeServiceLive = Layer.effect(
  CboeService,
  Effect.gen(function* () {
    const fs = yield* FetchService;

    const getSpotPrice = (symbol: string): Effect.Effect<CboeQuote, HTTPError | LocalProcessingError> =>
      Effect.gen(function* () {
        const params = new URLSearchParams();
        const raw = yield* fs.fetchJson(`${CBOE_BASE}/quote/${symbol.toUpperCase()}`, params);
        return parseQuoteResponse(raw);
      });

    const getHistoricalPrices = (symbol: string): Effect.Effect<CboeHistoricalPrice[], HTTPError | LocalProcessingError> =>
      Effect.gen(function* () {
        const params = new URLSearchParams();
        const raw = yield* fs.fetchJson(`${CBOE_BASE}/history/${symbol.toUpperCase()}`, params);
        return parseHistoricalResponse(raw);
      });

    const getOptionsChain = (symbol: string): Effect.Effect<CboeOptionsChain, HTTPError | LocalProcessingError> =>
      Effect.gen(function* () {
        const params = new URLSearchParams();
        const raw = yield* fs.fetchJson(`${CBOE_BASE}/options/${symbol.toUpperCase()}`, params);
        return parseOptionsResponse(raw);
      });

    return { getSpotPrice, getHistoricalPrices, getOptionsChain };
  }),
);
