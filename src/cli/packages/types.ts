import type { Effect } from "effect";
import type { Menu, TerminalUserStateConfig } from "../types.ts";

/**
 * Names of the manifest files that mark a directory under the packages
 * folder as a Hyperfin package.
 *
 * {@link MANIFEST_FILENAME} is the explicit, preferred manifest. The
 * fallback lets a user drop a repository that already carries a
 * `package.json` without adding a second file, as long as it declares an
 * `entry`.
 */
export const MANIFEST_FILENAME = "hyperfin-package.json";
export const FALLBACK_MANIFEST_FILENAME = "package.json";

/**
 * Module extensions accepted for a package entrypoint. Anything else is
 * rejected at discovery time so a stray data file can never be imported
 * as code.
 */
export const ENTRY_EXTENSIONS = [".ts", ".js", ".mjs"] as const;

/**
 * A directory under the packages folder that passed manifest validation
 * and is ready to be imported.
 */
export interface DiscoveredPackage {
    /** Directory name under the packages folder — also the dedupe key. */
    readonly dirName: string;
    /** Absolute path to the package directory. */
    readonly dirPath: string;
    /** Absolute path to the manifest that described this package. */
    readonly manifestPath: string;
    /** Absolute path to the entry module. */
    readonly entryPath: string;
    /** Display name for the menu table. Defaults to the directory name. */
    readonly name: string;
    /** Description for the menu table. */
    readonly description: string;
    /** Command the user types to enter the package's menu. */
    readonly command: string;
}

/**
 * A candidate that was found but deliberately not registered, with the
 * reason shown to the user at startup.
 */
export interface PackageSkip {
    readonly dirName: string;
    readonly reason: string;
}

/**
 * Result of scanning the packages folder.
 */
export interface PackageDiscoveryResult {
    readonly root: string;
    readonly packages: DiscoveredPackage[];
    readonly skipped: PackageSkip[];
}

/**
 * A menu function produced by `registerTerminalApplication` — the shape a
 * package normally exports. It takes the current state and returns the
 * state at the point the user leaves the menu.
 */
export type TerminalApplication = (
    st: TerminalUserStateConfig,
) => Effect.Effect<TerminalUserStateConfig>;

/**
 * What a package entry module is allowed to export: a registered terminal
 * application, or a plain `Menu` object. Both are normalised to a runnable
 * menu by the package menu builder.
 */
export type PackageEntry = TerminalApplication | Menu;

/**
 * A package whose entry module was imported, paired with the menu it
 * exports.
 */
export interface LoadedPackage {
    readonly pkg: DiscoveredPackage;
    readonly entry: PackageEntry;
}

/**
 * Result of importing and validating discovered packages.
 */
export interface PackageLoadResult {
    readonly packages: LoadedPackage[];
    readonly skipped: PackageSkip[];
}
