import { DataSourceType } from "../../cli/types.ts";
import { Schema } from "effect";

/**
 * Data sources the Forex menu can chart/quote: AlphaVantage and Alpaca.
 */
export const ForexDataSourceTypeSchema = Schema.Literal(
  DataSourceType.AlphaVantage,
  DataSourceType.Alpaca,
);

export type ForexDataSourceType = typeof ForexDataSourceTypeSchema.Type;

/**
 * A currency pair, e.g. from=EUR, to=USD.
 *
 * The pair is stored as its two ISO 4217 currency codes rather than a single
 * concatenated symbol, because AlphaVantage's forex endpoints take separate
 * `from_symbol` / `to_symbol` parameters.
 */
export interface ForexPairType {
  /** Base (from) currency code, e.g. "EUR". */
  from: string;
  /** Quote (to) currency code, e.g. "USD". */
  to: string;
  /** The data source backing this pair. */
  _type: DataSourceType;
}

/** A validated, cleaned-up realtime currency exchange rate. */
export interface ForexQuote {
  readonly from: string;
  readonly to: string;
  readonly fromName: string;
  readonly toName: string;
  readonly rate: number;
  readonly bid: number;
  readonly ask: number;
  readonly lastRefreshed: string;
  readonly timeZone: string;
}

/** A single daily FX OHLC bar, cleaned and timestamped. */
export interface ForexChartPoint {
  readonly date: string;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly timestamp: number;
}
