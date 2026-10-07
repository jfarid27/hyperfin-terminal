import { DataSourceType } from "../../cli/types.ts";

export interface FredSeriesType {
    seriesId: string;
    _type: DataSourceType.Fred;
}

/** A cleaned FRED series-search hit. */
export interface FredSeriesSummary {
    /** Series ID, e.g. "DGS10" — pass to the `fred` command to chart it. */
    id: string;
    title: string;
    /** The series' "notes" field, HTML stripped; may be empty. */
    description: string;
    /** Human-readable frequency, e.g. "Daily". */
    frequency: string;
    /** Units, e.g. "Percent". */
    units: string;
    observationStart: string;
    observationEnd: string;
}
