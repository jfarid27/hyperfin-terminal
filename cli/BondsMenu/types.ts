import { DataSourceType } from "../types.ts";
import { Schema } from "effect";

export const BondsDataSourceTypeSchema = Schema.Literal(
  DataSourceType.YahooFinance,
);

export type BondsDataSourceType = typeof BondsDataSourceTypeSchema.Type;

export interface BondSymbolType {
  name: string;
  id: string;
  _type: DataSourceType;
}

/**
 * Mapping from user-facing bond codes (e.g. "US2", "US10") to
 * Yahoo Finance ticker symbols.
 *
 * Uses CBOE Interest Rate indexes available on Yahoo Finance:
 *   ^IRX = 13-Week Treasury Bill (closest short-term proxy)
 *   ^FVX = 5-Year Treasury Note
 *   ^TNX = 10-Year Treasury Note
 *   ^TYX = 30-Year Treasury Bond
 *
 * Note: Yahoo Finance does not have a dedicated 2-year or 20-year
 * CBOE yield index. ^IRX (13-week T-bill) is used as the closest
 * short-term proxy for US2. US20 is omitted until a suitable data
 * source is available.
 */
export const BOND_TICKER_MAP: Record<string, { ticker: string; label: string }> = {
  US2:  { ticker: "^IRX",  label: "US 2-Year (13W proxy)" },
  US5:  { ticker: "^FVX",  label: "US 5-Year" },
  US10: { ticker: "^TNX",  label: "US 10-Year" },
  US30: { ticker: "^TYX",  label: "US 30-Year" },
};

/** A single yield data point from the chart API. */
export interface YieldPoint {
  timestamp: number;
  date: string;
  close: number;
}
