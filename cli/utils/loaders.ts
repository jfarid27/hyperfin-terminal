/**
 * @file Loaders
 * @description Loader functions for loading data from files.
 * @note Loader functions are functions that take a TerminalUserStateConfig and return a Promise<T>
 * @see {@link Loader}
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { defaultTo, map, pipe as pipeR, split, trim } from "ramda";
import { Effect, pipe } from "effect";
import { LocalProcessingError } from "cli/errors/index.ts";

/**
 * Splits a file string by lines, then by commas and trims whitespace.
 * 
 * @param file_content 
 * @returns List of a list of strings 
 */
const processCSV = pipeR(
    split("\n"),
    map(
        pipeR(
            split(","),
            map(trim),
            defaultTo(""),
        )
    ),
    defaultTo([]),
);

/**
 * Reads a CSV file from the portfolios directory.
 * 
 * Assumes all values are separated by commas.
 * @param filename 
 * @returns List of a list of strings 
 */
export const loadCSVPortfolio = (filename: string) => {
    return pipe(
        Effect.tryPromise({
            try: () => {
                const file_path = join(process.cwd(), "portfolios", filename);
                return readFile(file_path, "utf-8");
            },
            catch: (err) => new LocalProcessingError({
                message: err instanceof Error ? err.message : `Failed to load portfolio: ${filename}`,
            }),
        }),
        Effect.map((file_content) => processCSV(file_content))
    )
};