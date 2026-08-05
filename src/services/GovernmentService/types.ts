import { DataSourceType } from "../../cli/types.ts";

export interface FredSeriesType {
    seriesId: string;
    _type: DataSourceType.Fred;
}
