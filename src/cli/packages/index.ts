import chalk from "chalk";
import {
    type PackageDiscoveryResult,
    type PackageLoadResult,
    type PackageSkip,
} from "./types.ts";
import { discoverPackages, packagesDirFor } from "./discovery.ts";
import { loadPackages } from "./loader.ts";

/**
 * Resolve the packages folder for the running process.
 *
 * Scans the current working directory: `deno task cli` is invoked from the
 * repository root and `index.ts` also resolves `sessions` and `scripts`
 * relative to the process directory, so packages follow the same
 * convention.
 */
export function resolvePackagesDir(cwd: string = process.cwd()): string {
    return packagesDirFor(cwd);
}

/**
 * Build the note lines shown for packages that were found but not
 * registered. Every entry is a skip reason — nothing here is fatal.
 */
export function packageNotes(skips: PackageSkip[], dir: string): string[] {
    if (skips.length === 0) return [];

    const notes = [
        chalk.yellow(
            `hyperfin-packages: skipped ${skips.length} entr${
                skips.length === 1 ? "y" : "ies"
            } in ${dir}`,
        ),
    ];
    for (const skip of skips) {
        notes.push(chalk.yellow(`  - ${skip.dirName}: ${skip.reason}`));
    }
    return notes;
}

/**
 * Discover the packages folder and import every package entry. Never
 * throws: a missing folder yields an empty result and every failure is
 * reported as a skip note.
 */
export async function preparePackages(
    reserved: Iterable<string>,
    cwd: string = process.cwd(),
): Promise<{
    discovery: PackageDiscoveryResult;
    loaded: PackageLoadResult;
    notes: string[];
}> {
    const discovery = discoverPackages(resolvePackagesDir(cwd), reserved);
    const loaded = await loadPackages(discovery.packages);
    const notes = packageNotes(
        [...discovery.skipped, ...loaded.skipped],
        discovery.root,
    );
    return { discovery, loaded, notes };
}

/**
 * Print package discovery results. Plain `console.log` lines rather than a
 * terminal-kit table, so the output cannot fight the menu table for the
 * terminal and stays readable in scripted runs.
 */
export function reportPackages(
    discovery: PackageDiscoveryResult,
    loaded: PackageLoadResult,
    notes: string[],
): void {
    if (discovery.packages.length === 0 && notes.length === 0) return;

    if (loaded.packages.length > 0) {
        const names = loaded.packages.map(({ pkg }) => pkg.command).join(", ");
        console.log(
            chalk.green(
                `Loaded ${loaded.packages.length} hyperfin package${
                    loaded.packages.length === 1 ? "" : "s"
                }: ${names}`,
            ),
        );
    }
    for (const note of notes) console.log(note);
}
