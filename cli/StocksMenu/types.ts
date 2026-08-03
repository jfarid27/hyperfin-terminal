import { DataSourceType } from "../types.ts";
import { Schema } from "effect";

export const StocksDataSourceTypeSchema = Schema.Literal(
  DataSourceType.AlphaVantage,
  DataSourceType.Massive
);

export type StocksDataSourceType = typeof StocksDataSourceTypeSchema.Type;

export interface StockSymbolType {
    name: string;
    id: string;
    _type: DataSourceType;
}
