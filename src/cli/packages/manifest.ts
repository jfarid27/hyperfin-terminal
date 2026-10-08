import { Schema } from "effect";
import { extname, isAbsolute, join, resolve, sep } from "node:path";
import {
    ENTRY_EXTENSIONS,
    MANIFEST_FILENAME,
    type DiscoveredPackage,
    type PackageSkip,
} from "./types.ts";

/**
 * Shape of a `hyperfin-package.json` (or `package.json`) manifest.
 *
 * Extra keys are ignored so an existing `package.json` can be reused
 * verbatim.
 */
export const HyperfinPackageManifestSchema = Schema.Struct({
    name: Schema.optional(Schema.String),
    description: Schema.optional(Schema.String),
    command: Schema.optional(Schema.String),
    entry: Schema.String,
});

export type HyperfinPackageManifest = Schema.Schema.Type<
    typeof HyperfinPackageManifestSchema
>;

/** A manifest that parsed and validated into a registrable package. */
export type PackageManifestResult =
    | { readonly ok: true; readonly pkg: DiscoveredPackage }
    | { readonly ok: false; readonly reason: string };

/** Command tokens must be a single word so commander can dispatch them. */
const COMMAND_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

/**
 * Derive a command token from a package name: lowercased, with runs of
 * non-alphanumeric characters collapsed to a dash.
 */
export function slugifyPackageCommand(name: string): string {
    return name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/**
 * Resolve a manifest `entry` against its package directory.
 *
 * Rejects absolute paths, `..` traversal outside the package directory and
 * unrecognised extensions — a package may only load code it ships itself.
 */
export function resolvePackageEntry(
    dirPath: string,
    entry: string,
): { readonly ok: true; readonly path: string } | {
    readonly ok: false;
    readonly reason: string;
} {
    const trimmed = entry.trim();
    if (!trimmed) {
        return { ok: false, reason: "manifest `entry` is empty" };
    }
    if (isAbsolute(trimmed) || /^[A-Za-z]:[\\/]/.test(trimmed)) {
        return {
            ok: false,
            reason: `manifest \`entry\` must be relative to the package directory, got "${entry}"`,
        };
    }

    const root = resolve(dirPath);
    const candidate = resolve(root, trimmed);
    if (candidate !== root && !candidate.startsWith(root + sep)) {
        return {
            ok: false,
            reason: `manifest \`entry\` escapes the package directory: "${entry}"`,
        };
    }

    const extension = extname(candidate).toLowerCase();
    if (!ENTRY_EXTENSIONS.includes(extension as typeof ENTRY_EXTENSIONS[number])) {
        return {
            ok: false,
            reason:
                `manifest \`entry\` must end in ${ENTRY_EXTENSIONS.join(", ")}: "${entry}"`,
        };
    }

    return { ok: true, path: candidate };
}

/**
 * Validate raw manifest JSON for a single package directory.
 *
 * Pure: takes the already-parsed JSON so discovery can be unit-tested
 * without touching the filesystem.
 */
export function parsePackageManifest(
    raw: unknown,
    dirName: string,
    dirPath: string,
    manifestPath: string,
): PackageManifestResult {
    const decoded = Schema.decodeUnknownEither(HyperfinPackageManifestSchema)(raw);

    if (decoded._tag === "Left") {
        return {
            ok: false,
            reason: `manifest must declare a string \`entry\` (${MANIFEST_FILENAME})`,
        };
    }

    const manifest = decoded.right;
    const name = manifest.name?.trim() || dirName;
    const description = manifest.description?.trim() ||
        `${name} (hyperfin package)`;

    const entry = resolvePackageEntry(dirPath, manifest.entry);
    if (!entry.ok) return { ok: false, reason: entry.reason };

    const command = manifest.command?.trim() || slugifyPackageCommand(name);
    if (!COMMAND_PATTERN.test(command)) {
        return {
            ok: false,
            reason:
                `command "${command}" must be a single word of letters, digits, dashes or underscores`,
        };
    }

    return {
        ok: true,
        pkg: {
            dirName,
            dirPath,
            manifestPath,
            entryPath: entry.path,
            name,
            description,
            command,
        },
    };
}

/**
 * Drop packages whose command is already taken (built-in menus and
 * top-level globals win) or duplicated by an earlier package.
 */
export function applyReservedCommands(
    packages: DiscoveredPackage[],
    reserved: Iterable<string>,
): { packages: DiscoveredPackage[]; skipped: PackageSkip[] } {
    const taken = new Set<string>(reserved);
    const accepted: DiscoveredPackage[] = [];
    const skipped: PackageSkip[] = [];

    for (const pkg of packages) {
        if (taken.has(pkg.command)) {
            skipped.push({
                dirName: pkg.dirName,
                reason:
                    `command "${pkg.command}" is already registered; rename it with the manifest (or command) field`,
            });
            continue;
        }
        taken.add(pkg.command);
        accepted.push(pkg);
    }

    return { packages: accepted, skipped };
}

/**
 * Join a package directory to a manifest filename. Exported so discovery
 * and tests agree on the lookup order.
 */
export function manifestPathFor(dirPath: string, filename: string): string {
    return join(dirPath, filename);
}
