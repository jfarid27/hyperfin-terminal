import { pathToFileURL } from "node:url";
import { sep } from "node:path";
import type { Effect } from "effect";
import type { Menu, TerminalUserStateConfig } from "../types.ts";
import { type DiscoveredPackage, type PackageLoadResult, type PackageSkip } from "./types.ts";

/**
 * A menu function produced by `registerTerminalApplication` — the shape a
 * package normally exports. It takes the current state and returns the
 * state at the point the user leaves the menu.
 */
export type TerminalApplication = (
    st: TerminalUserStateConfig,
) => Effect.Effect<TerminalUserStateConfig>;

/**
 * What a package entry module is allowed to export: either a registered
 * terminal application, or a plain `Menu` object. Both are treated as a
 * runnable menu (see `menu.ts`).
 */
export type PackageEntry = TerminalApplication | Menu;

/**
 * Structural check for a `Menu`. Used when a package exports a raw `Menu`
 * object instead of a registered application.
 */
export function isMenu(value: unknown): value is Menu {
    if (typeof value !== "object" || value === null) return false;
    const candidate = value as Record<string, unknown>;
    return typeof candidate.name === "string" &&
        typeof candidate.description === "string" &&
        typeof candidate.messagePrompt === "string" &&
        typeof candidate.options === "function";
}

/**
 * Whether an entry module's export is usable — a menu function or a
 * `Menu` object. Validated structurally so a bad package is skipped
 * instead of crashing the terminal on a malformed menu.
 */
export function isPackageEntry(value: unknown): value is PackageEntry {
    return typeof value === "function" || isMenu(value);
}

/**
 * Import a package entry module and return its export.
 *
 * Prefers the named `menu` export (what the template uses) and falls back
 * to the default export so an existing submodule with `export default`
 * works unchanged.
 */
export async function importPackageEntry(entryPath: string): Promise<unknown> {
    const module = await import(pathToFileURL(entryPath).href);
    const namespace = module as { menu?: unknown; default?: unknown };
    return namespace.menu ?? namespace.default;
}

/**
 * Import every discovered package, isolating failures: a package that
 * throws on import or exports something that is not a menu is reported as
 * a skip and does not take the terminal down with it.
 */
export async function loadPackages(
    packages: DiscoveredPackage[],
): Promise<PackageLoadResult> {
    const loaded: PackageLoadResult["packages"] = [];
    const skipped: PackageSkip[] = [];

    for (const pkg of packages) {
        try {
            const exported = await importPackageEntry(pkg.entryPath);
            if (!isPackageEntry(exported)) {
                skipped.push({
                    dirName: pkg.dirName,
                    reason:
                        `entry "${pkg.entryPath}" must export a Menu (a \`menu\`/default export of registerTerminalApplication)`,
                });
                continue;
            }
            loaded.push({ pkg, entry: exported });
        } catch (error) {
            skipped.push({
                dirName: pkg.dirName,
                reason: `failed to import entry: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            });
        }
    }

    return { packages: loaded, skipped };
}

/**
 * A package's entry path relative to the packages folder, for display.
 * Falls back to the absolute path when the entry is not inside the folder.
 */
export function relativeEntryPath(pkg: DiscoveredPackage, rootDir: string): string {
    const prefix = rootDir.endsWith(sep) ? rootDir : rootDir + sep;
    return pkg.entryPath.startsWith(prefix)
        ? pkg.entryPath.slice(prefix.length)
        : pkg.entryPath;
}
