import { DataSourceType } from "../types.ts";

export interface CryptoSymbolType {
    name: string;
    id: string;
    _type: DataSourceType;
}

export type SpotPoint= {
    symbol: CryptoSymbolType;
    price: number;
};

export type ChartPoint= {
    timestamp: number;
    price: number;
};

export type ChartData= {
    symbol: CryptoSymbolType;
    prices: ChartPoint[];
};
