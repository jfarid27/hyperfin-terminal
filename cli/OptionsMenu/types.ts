import { DataSourceType } from "../types.ts";
import { Schema } from "effect";

export const OptionsDataSourceTypeSchema = Schema.Literal(
  DataSourceType.YahooFinance,
);

export type OptionsDataSourceType = typeof OptionsDataSourceTypeSchema.Type;

export interface OptionSymbolType {
  name: string;
  id: string;
  _type: DataSourceType;
}

/** A single option contract from the Yahoo Finance options chain. */
export interface OptionContract {
  contractSymbol: string;
  strike: number;
  lastPrice: number;
  change: number;
  percentChange: number;
  volume: number;
  openInterest: number;
  bid: number;
  ask: number;
  impliedVolatility: number;
  inTheMoney: boolean;
  expiration: number;
  lastTradeDate: number;
  currency: string;
  contractSize: string;
}

/** The full options chain for a ticker at a given expiration. */
export interface OptionsChain {
  ticker: string;
  expiration: number;
  expirationDate: string;
  underlyingPrice: number;
  calls: OptionContract[];
  puts: OptionContract[];
}
