import chalk from "chalk";
import { FredModel } from "../model/index.ts";
import { DataSourceType, TerminalUserStateConfigContext } from "../../types.ts";
import {
    CommandResultType,
} from "../../types.ts";
import { showLineChart } from "../../components/charting.ts";
import { pipe as pipeR, prop, map, sortBy } from "ramda";
import { Effect, Option } from "effect";
import { ConfigService } from "src/cli/services/ConfigService.ts";
import { GovernmentServiceLive } from "../../../services/GovernmentService/index.ts";
import type { FredSeriesSummary } from "../../../services/GovernmentService/types.ts";
import terminalKit from "terminal-kit";
import { boldCell, escapeTableMarkup } from "../../utils/table_markup.ts";
const { terminal } = terminalKit;

/** Strip HTML tags/entities from FRED's `notes` field. */
export const stripHtml = (html: string): string =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

/** Turn a raw FRED series/search response into cleaned summaries. */
export const toSeriesSummaries = (raw: unknown): FredSeriesSummary[] => {
    const seriess = (raw as { seriess?: any[] })?.seriess ?? [];
    return seriess.map((s) => ({
        id: String(s.id ?? ""),
        title: String(s.title ?? ""),
        description: stripHtml(String(s.notes ?? "")),
        frequency: String(s.frequency ?? ""),
        units: String(s.units ?? ""),
        observationStart: String(s.observation_start ?? ""),
        observationEnd: String(s.observation_end ?? ""),
    }));
};

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

export const fredHandler = (
    seriesId: string,
    startDate: string,
    endDate: string
) => Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    const config = yield* ConfigService;
    const FRED_API_KEY = Option.getOrUndefined(config.FRED_API_KEY);

    if (!FRED_API_KEY) {
        console.log(chalk.red("No FRED API key found. Use 'keys fred <api_key>' to set it."));
        return {
            result: { type: CommandResultType.Error },
            state: st,
        };
    }

    if (!seriesId) {
        console.log(chalk.red("No series ID provided"));
        return {
            result: { type: CommandResultType.Error },
            state: st,
        };
    }

    if (!startDate || !endDate) {
        console.log(chalk.red("Both start date and end date are required (format: YYYY-MM-DD)"));
        return {
            result: { type: CommandResultType.Error },
            state: st,
        };
    }

    const seriesObj = {
        seriesId: seriesId,
        _type: DataSourceType.Fred as DataSourceType.Fred,
    };

    const fred = yield* FredModel;

    // Fetch series metadata to get the title; fall back to series ID on failure
    let seriesTitle = seriesId;
    const metadataResult = yield* fred.getMetadata(seriesObj, FRED_API_KEY).pipe(
      Effect.option,
    );
    if (Option.isSome(metadataResult)) {
      const metadata: any = metadataResult.value;
      seriesTitle = metadata?.seriess?.[0]?.title || seriesId;
      yield* Effect.logDebug(`Series title: ${seriesTitle}`);
    } else {
      yield* Effect.logWarning(`Failed to fetch series metadata`);
      console.log(chalk.yellow(`Warning: Using series ID as title`));
    }

    const result: any = yield* fred.get(seriesObj, startDate, endDate, FRED_API_KEY);

    yield* Effect.logDebug(result);

    const processed = processFredData(result);

    // Filter out non-numeric values (FRED returns "." for missing data)
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
}).pipe(
  Effect.provide(GovernmentServiceLive)
);

/** Truncate a description to a short, single-line snippet for the table. */
const snippet = (text: string, max = 80): string =>
    text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;

/** Truncate a title so the table's columns stay legible. */
const truncate = (text: string, max = 60): string =>
    text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;

/**
 * Search FRED for series matching a free-text term and list the matching
 * series IDs with their title, frequency, units, and a description snippet.
 *
 * The series IDs are directly usable with the `fred` command to chart.
 */
export const fredSearchHandler = (
    term: string | string[],
    extraTerms: string[] = [],
) => Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    const config = yield* ConfigService;
    const FRED_API_KEY = Option.getOrUndefined(config.FRED_API_KEY);

    if (!FRED_API_KEY) {
        console.log(chalk.red("No FRED API key found. Use 'keys fred <api_key>' to set it."));
        return { result: { type: CommandResultType.Error }, state: st };
    }

    const words = Array.isArray(term) ? term : [term, ...extraTerms];
    const query = words.filter(Boolean).join(" ").trim();

    if (!query) {
        console.log(chalk.red("No search term provided"));
        return { result: { type: CommandResultType.Error }, state: st };
    }

    const fred = yield* FredModel;
    yield* Effect.logInfo(`Searching FRED for "${query}"`);

    const raw = yield* fred.search(query, FRED_API_KEY, 20);
    const summaries = toSeriesSummaries(raw);

    if (summaries.length === 0) {
        console.log(chalk.yellow(`No FRED series found for "${query}"`));
        return { result: { type: CommandResultType.Success }, state: st };
    }

    console.log(chalk.bold(`\nFRED series matching "${query}" (${summaries.length})`));
    console.log("");

    terminal.table(
        [
            ["Series ID", "Title", "Freq", "Units", "Description"],
            ...summaries.map((s) => [
                boldCell(s.id),
                escapeTableMarkup(truncate(s.title)),
                s.frequency,
                s.units,
                escapeTableMarkup(snippet(s.description)),
            ]),
        ],
        {
            hasBorder: true,
            contentHasMarkup: true,
            borderChars: "lightRounded",
            borderAttr: { color: "cyan" },
            textAttr: { bgColor: "default" },
            firstRowTextAttr: { bgColor: "cyan" },
            width: 140,
            fit: true,
        },
    );
    console.log(chalk.dim(`\nChart one with: fred <seriesId> <startDate> <endDate>`));
    console.log("");

    return { result: { type: CommandResultType.Success }, state: st };
}).pipe(
  Effect.provide(GovernmentServiceLive)
);
