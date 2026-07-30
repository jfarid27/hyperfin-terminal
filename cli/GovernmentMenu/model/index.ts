import { FredSeriesType } from "../types.ts";
import { fetchFredSeries, fetchFredSeriesMetadata } from "./fred.ts";

const government = {
    fred: {
        get: (series: FredSeriesType, startDate: string, endDate: string, FRED_API_KEY: string) => {
            return fetchFredSeries(series, startDate, endDate, FRED_API_KEY);
        },
        getMetadata: (series: FredSeriesType, FRED_API_KEY: string) => {
            return fetchFredSeriesMetadata(series, FRED_API_KEY);
        }
    }
}

export default government;
