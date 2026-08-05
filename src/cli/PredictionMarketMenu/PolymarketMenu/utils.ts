import { pipe, map, zip } from "ramda";

/**
 * Maps the polymarket event data for outcomes and outcome prices to a string array.
 * 
 * @note sometimes the response is a string array, sometimes it is a JSON string of arrays
 *       so we need to handle both cases. Please ignore type inconsistency here since this
 *       works across multiple API responses in polymarket, and their API just returns
 *       different types of responses.
 */
export const outcomePricesMapper = (r: any): string[] => {
    if (r.length === 2) {
        return r as string[];
    }
    try {
        const parsed = JSON.parse(r);
        return parsed as string[];
    } catch (error) {
        return ["NA"];
    }
}

/**
 * Zips the polymarket event data for outcomes and outcome prices.
 */
export const zipEventOutcomePrices = (r: any) => {
    return zip(
        outcomePricesMapper(r.outcomes),
        outcomePricesMapper(r.outcomePrices)
    );
}

/**
 * Processes the outcome data for the given list of markets.
 * 
 * @param markets List of markets to process.
 * @returns Array of [question, outcomes] pairs.
 */
export const processOutcomeData = pipe(
    map((r:any) => {
        return [r.question, zipEventOutcomePrices(r)];
    }),
)