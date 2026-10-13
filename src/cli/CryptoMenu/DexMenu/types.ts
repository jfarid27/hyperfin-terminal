/**
 * Types for the DEX submenu.
 *
 * The DEX submenu prices on-chain tokens by contract address rather than by a
 * ticker, which is the one thing the ticker-based crypto menu cannot do: a
 * token that no exchange lists has no ticker to look up. CoinMarketCap's DEX
 * endpoints are keyed by `platform` + `address`, so address is the token's
 * identity here and `platform` is the chain it lives on.
 */

import { Schema } from "effect";
import { DataSourceType } from "../../types.ts";

/**
 * The data sources a DEX token can be priced from. CoinMarketCap is the only
 * one wired up, and its DEX API requires an API key.
 */
export const DexDataSourceTypeSchema = Schema.Literal(
  DataSourceType.CoinMarketCap,
);
export type DexDataSourceType = typeof DexDataSourceTypeSchema.Type;

/** The chain the `ethereum` submenu prices on. */
export const ETHEREUM_PLATFORM = "ethereum";

/** An on-chain token, identified by the chain it lives on and its address. */
export interface DexTokenType {
  /** Chain key accepted by CoinMarketCap, e.g. `ethereum`. */
  platform: string;
  /** Contract address of the token (not of a pool). */
  address: string;
  /** Display name, when the source reports one. */
  name?: string;
  /** Display symbol, when the source reports one. */
  symbol?: string;
  _type: DataSourceType;
}

/** A DEX token's current price and the day's activity around it. */
export interface DexSpotPoint {
  token: DexTokenType;
  price: number;
  /** 24-hour price change, as a percentage (already ×100). */
  change24hPct?: number;
  /** 24-hour traded volume in USD. */
  volume24hUsd?: number;
  /** Market capitalisation in USD, when the source computes one. */
  marketCapUsd?: number;
  /** Pool liquidity in USD. */
  liquidityUsd?: number;
  /** 24-hour high. */
  high24h?: number;
  /** 24-hour low. */
  low24h?: number;
  /** Token decimals, as reported by the chain. */
  decimals?: number;
}

/**
 * Candlestick intervals CoinMarketCap accepts for DEX K-line data.
 *
 * Validated before the request: the API answers an unsupported interval with a
 * generic 500 "system is busy", which reads like an outage rather than a typo.
 */
export const DEX_INTERVALS = [
  "1s",
  "5s",
  "30s",
  "1min",
  "3min",
  "5min",
  "15min",
  "30min",
  "1h",
  "2h",
  "4h",
  "6h",
  "8h",
  "12h",
  "1d",
  "3d",
  "1w",
  "1m",
] as const;

export type DexInterval = typeof DEX_INTERVALS[number];

/** Daily candles: the series technical indicators are computed over. */
export const DEFAULT_DEX_INTERVAL: DexInterval = "1d";

/** Narrow a user-supplied string to a supported interval. */
export const isDexInterval = (value: string): value is DexInterval =>
  (DEX_INTERVALS as readonly string[]).includes(value);

/** The intervals offered in the `chart` description, most useful first. */
export const DEX_INTERVAL_HINT = "1d, 4h, 1h, 15min, 5min, 1min";

/** The `interval` every indicator is computed on. */
export const ANALYSIS_DEX_INTERVAL: DexInterval = "1d";

/** Abbreviate an address for display: `0x49b5a6…f69786`. */
export const shortAddress = (address: string): string =>
  address.length <= 14 ? address : `${address.slice(0, 8)}…${address.slice(-6)}`;

/**
 * How a DEX token is labelled in tables and chart titles.
 *
 * The symbol is what a trader recognises, so it wins; the address is the
 * fallback for a token whose metadata has not been fetched.
 */
export const dexTokenLabel = (token: DexTokenType): string =>
  token.symbol ?? token.name ?? shortAddress(token.address);
