import chalk from "chalk";
import government from "./../model/index.ts";
import { DataSourceType, TerminalUserStateConfigContext } from "./../../types.ts";
import {
    CommandState, CommandResultType, LogLevel
} from "./../../types.ts";
import { inspectLogger } from "./../../utils/logging.ts";
import { showLineChart } from "./../../components/charting.ts";
import { pipe as pipeR, prop, map, sortBy } from "ramda";
import { Effect } from "effect";
import { ConfigErrorTag, HTTPErrorTag, TimeoutErrorTag, UnknownError, UnknownErrorTag, type ProgramError } from "../../errors/index.ts";
import { ActionHandler } from "./../../types.ts";

/**
 * Processed FRED observation data point
 */
interface ProcessedFredObservation {
    date: string;
    value: number;
    timestamp: number;
}

/**
 * Raw FRED API response structure
 */
interface FredApiResponse {
    observations: Array<{ date: string; value: string }>;
}

/**
 * Process the FRED series data by transforming observations into
 * an array of objects with date, value, timestamp
 * @param data raw object data from FRED API 
 * @returns object array with date, value, timestamp
 */
export const processFredData = (data: FredApiResponse): ProcessedFredObservation[] => {
    return pipeR(
        prop("observations"),
        map((obs: any) => {
            return {
                date: obs.date,
                value: parseFloat(obs.value),
                timestamp: new Date(obs.date).getTime()
            };
        }),
        sortBy(prop("timestamp"))
    )(data) as ProcessedFredObservation[];
};

export const fredHandler: ActionHandler = (
    seriesId: string,
    startDate: string,
    endDate: string
) => Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    const applicationLogging = inspectLogger(st);
    const FRED_API_KEY = st.apiKeys.fred;
    
    if (!FRED_API_KEY) {
        console.log(chalk.red("No FRED API key found. Use 'keys fred <api_key>' to set it."));
        yield* Effect.fail(new Error("No Fred API Key"));
        return {
            result: { type: CommandResultType.Error },
            state: st,
        };
    }

    if (!seriesId) {
        console.log(chalk.red("No series ID provided"));
        yield* Effect.fail(new Error("No Series ID provided"));
        return {
            result: { type: CommandResultType.Error },
            state: st,
        };
    }

    if (!startDate || !endDate) {
        console.log(chalk.red("Both start date and end date are required (format: YYYY-MM-DD)"));
        yield* Effect.fail(new Error("No Start Date or End Date provided"));
        return {
            result: { type: CommandResultType.Error },
            state: st,
        };
    }

    try {
        const seriesObj = {
            seriesId: seriesId,
            _type: DataSourceType.Fred as DataSourceType.Fred,
        };

        // Fetch series metadata to get the title
        let seriesTitle = seriesId; // Default to series ID if metadata fetch fails
        try {
            const metadata: any = yield* government.fred.getMetadata(seriesObj, FRED_API_KEY);
            seriesTitle = metadata?.seriess?.[0]?.title || seriesId;
            applicationLogging(LogLevel.Debug)(`Series title: ${seriesTitle}`);
        } catch (metadataError) {
            applicationLogging(LogLevel.Warning)(`Failed to fetch series metadata: ${metadataError}`);
            console.log(chalk.yellow(`Warning: Using series ID as title`));
        }

        // Fetch series observations data
        const result: any = yield* government.fred.get(seriesObj, startDate, endDate, FRED_API_KEY);
        
        applicationLogging(LogLevel.Debug)(result);

        const processed = processFredData(result);
        
        // Filter out non-numeric values (FRED returns "." for missing data and other invalid values)
        const validData = processed.filter(d => {
            const val = d.value;
            return typeof val === 'number' && !isNaN(val) && isFinite(val);
        });
        
        if (validData.length === 0) {
            console.log(chalk.yellow("No valid data found for the specified series and date range"));
            return {
                result: { type: CommandResultType.Error },
                state: st,
            };
        }

        yield* showLineChart(validData, "timestamp", "value", seriesTitle);

        return {
            result: { type: CommandResultType.Success },
            state: st,
        };
    } catch (error) {
        applicationLogging(LogLevel.Error)(error);
        console.log(chalk.red("Error fetching FRED data. Please check your series ID and date range."));
        return {
            result: { type: CommandResultType.Error },
            state: st,
        };
    }
}).pipe(
  Effect.catchAll((error) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "_tag" in error
    ) {
      const tag = (error as { _tag: string })._tag;
      if (
        tag === HTTPErrorTag ||
        tag === ConfigErrorTag ||
        tag === TimeoutErrorTag ||
        tag === UnknownErrorTag
      ) {
        return Effect.fail(error as unknown as ProgramError);
      }
    }
    return Effect.gen(function* () {
      yield* Effect.logError(error);
      const err = error as unknown;
      return yield* Effect.fail(new UnknownError({
        message: err instanceof Error ? err.message : "Action handler failed",
      }));
    });
  }),
);


