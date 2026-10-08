import { isAbsolute, join } from "node:path";
import { applyReservedCommands, manifestPathFor, parsePackageManifest } from "./manifest.ts";
import {
    FALLBACK_MANIFEST_FILENAME,
    MANIFEST_FILENAME,
    type DiscoveredPackage,
    type PackageDiscoveryResult,
    type PackageSkip,
} from "./types.ts";

/**
 * Directory, relative to the process working directory, that the terminal
 * scans at startup for user-installed package menus.
 */
export const PACKAGES_DIR_NAME = "hyperfin-packages";

/** Candidate manifest filenames in lookup order. */
const MANIFEST_CANDIDATES = [MANIFEST_FILENAME, FALLBACK_MANIFEST_FILENAME];

/** Entry names that are never treated as packages. */
const isIgnoredDirName = (name: string): boolean => name.startsWith(".");

/**
 * Scan a packages folder and validate every direct subdirectory that
 * declares a Hyperfin package manifest.
 *
 * Reads the filesystem but never imports anything — a directory with a
 * broken manifest is skipped with a reason instead of failing startup.
 * A missing folder is not an error: the feature is opt-in.
 */
export function discoverPackages(
    rootDir: string,
    reserved: Iterable<string> = [],
): PackageDiscoveryResult {
    const skipped: PackageSkip[] = [];
    const candidates: DiscoveredPackage[] = [];

    let entries: Deno.DirEntry[];
    try {
        entries = [...Deno.readDirSync(rootDir)];
    } catch {
        // Feature is opt-in: no packages folder means no package menus.
        return { root: rootDir, packages: [], skipped: [] };
    }

    for (const entry of entries) {
        const dirPath = join(rootDir, entry.name);
        if (!isDirectoryEntry(dirPath, entry)) continue;
        if (isIgnoredDirName(entry.name)) continue;

        const found = findManifest(dirPath);
        if (!found) {
            skipped.push({
                dirName: entry.name,
                reason:
                    `no ${MANIFEST_FILENAME} or ${FALLBACK_MANIFEST_FILENAME} found (see ${PACKAGES_DIR_NAME}/README.md)`,
            });
            continue;
        }

        let raw: unknown;
        try {
            raw = JSON.parse(Deno.readTextFileSync(found.path));
        } catch (error) {
            skipped.push({
                dirName: entry.name,
                reason: `could not read ${found.filename}: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            });
            continue;
        }

        const parsed = parsePackageManifest(raw, entry.name, dirPath, found.path);
        if (!parsed.ok) {
            skipped.push({ dirName: entry.name, reason: parsed.reason });
            continue;
        }

        candidates.push(parsed.pkg);
    }

    const deduped = applyReservedCommands(candidates, reserved);

    return {
        root: rootDir,
        packages: deduped.packages,
        skipped: [...skipped, ...deduped.skipped],
    };
}

/**
 * The absolute packages folder for a working directory. Kept explicit so
 * tests can point discovery at a scratch directory.
 */
export function packagesDirFor(cwd: string): string {
    return isAbsolute(PACKAGES_DIR_NAME) ? PACKAGES_DIR_NAME : join(cwd, PACKAGES_DIR_NAME);
}

/** A directory entry, following symlinks so linked packages are picked up. */
function isDirectoryEntry(dirPath: string, entry: Deno.DirEntry): boolean {
    if (entry.isDirectory) return true;
    if (!entry.isSymlink) return false;
    try {
        return Deno.statSync(dirPath).isDirectory;
    } catch {
        return false;
    }
}

/** First manifest filename present in a package directory. */
function findManifest(
    dirPath: string,
): { path: string; filename: string } | null {
    for (const filename of MANIFEST_CANDIDATES) {
        const path = manifestPathFor(dirPath, filename);
        try {
            if (Deno.statSync(path).isFile) return { path, filename };
        } catch {
            // Missing candidate — try the next one.
        }
    }
    return null;
}
