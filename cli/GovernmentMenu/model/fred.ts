import { FredSeriesType } from "../types.ts";
import { Effect } from 'effect';
import { FetchService } from "cli/services/FetchService.ts";
import { HTTPError, LocalProcessingError } from "cli/errors/index.ts";

/**
 * Fetches the series metadata for a specified series ID from the FRED API.
 * This includes information like the series title, description, units, etc.
 * 
 * @param series The series to fetch the metadata for.
 * @param FRED_API_KEY The FRED API key.
 * @returns The series metadata.
 * @see https://fred.stlouisfed.org/docs/api/fred/series.html
 */
export function fetchFredSeriesMetadata(
    series: FredSeriesType,
    FRED_API_KEY: string
): Effect.Effect<unknown, HTTPError | LocalProcessingError, FetchService> {
    return Effect.gen(function* () {
      const fs = yield* FetchService;
      const params = new URLSearchParams({
          series_id: series.seriesId,
          api_key: FRED_API_KEY,
          file_type: "json",
      });
      return yield* fs.fetchJson("https://api.stlouisfed.org/fred/series", params);
    });
}

/**
 * Fetches the series data for a specified series ID from the FRED API.
 * 
 * @param series The series to fetch the data for.
 * @param startDate The start date for the series data (YYYY-MM-DD).
 * @param endDate The end date for the series data (YYYY-MM-DD).
 * @param FRED_API_KEY The FRED API key.
 * @returns The series data for the specified series.
 * @see https://fred.stlouisfed.org/docs/api/fred/
 */
export function fetchFredSeries(
    series: FredSeriesType, 
    startDate: string, 
    endDate: string, 
    FRED_API_KEY: string
): Effect.Effect<unknown, HTTPError | LocalProcessingError, FetchService> {
    return Effect.gen(function* () {
      const fs = yield* FetchService;
      const params = new URLSearchParams({
          series_id: series.seriesId,
          api_key: FRED_API_KEY,
          file_type: "json",
          observation_start: startDate,
          observation_end: endDate,
      });
      return yield* fs.fetchJson("https://api.stlouisfed.org/fred/series/observations", params);
    });
}
