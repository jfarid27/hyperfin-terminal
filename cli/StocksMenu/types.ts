import { DataSourceType } from "../types.ts";

export interface StockSymbolType {
    name: string;
    id: string;
    _type: DataSourceType;
}