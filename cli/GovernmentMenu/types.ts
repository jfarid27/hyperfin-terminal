import { DataSourceType } from "../types.ts";

export interface FredSeriesType {
    seriesId: string;
    _type: DataSourceType.Fred;
}
