import chalk from "chalk";
import { Effect } from "effect";
import {
    type ActionHandler,
    type Menu,
    type MenuOption,
    type TerminalUserStateConfig,
    CommandResultType,
    TerminalUserStateConfigContext,
} from "../types.ts";
import { isMenu, relativeEntryPath, type PackageEntry } from "./loader.ts";
import type { LoadedPackage } from "./types.ts";

/**
 * Turn a package entry export into a runnable menu.
 *
 * A package normally exports the result of `registerTerminalApplication`
 * (a `(state) => Effect<state>` function) and is used directly. Exporting
 * a raw `Menu` object is also supported; it is wrapped in
 * `registerTerminalApplication` when first used.
 */
export function asMenuRunner(
    entry: PackageEntry,
    register: (
        menu: Menu,
    ) => (st: TerminalUserStateConfig) => Effect.Effect<TerminalUserStateConfig>,
): (st: TerminalUserStateConfig) => Effect.Effect<TerminalUserStateConfig> {
    if (typeof entry === "function") return entry;
    if (isMenu(entry)) return register(entry);
    throw new Error("entry did not export a Menu");
}

/**
 * Build a top-level menu option that enters a package's own menu.
 *
 * A package that exports a raw `Menu` needs `registerTerminalApplication`,
 * which is imported here rather than at module scope: importing
 * `program_loader` pulls in the terminal input machinery, and package menus
 * are a leaf of the app graph. The result is cached per option, so entering
 * a raw-`Menu` package repeatedly pays for the import only once.
 */
export function packageMenuOption(
    loaded: LoadedPackage,
    rootDir: string,
): MenuOption {
    const { pkg, entry } = loaded;

    let runner: ReturnType<typeof asMenuRunner> | undefined;

    const action: ActionHandler = () =>
        Effect.gen(function* () {
            const st = yield* TerminalUserStateConfigContext;

            if (!runner) {
                const { registerTerminalApplication } = yield* Effect.tryPromise({
                    try: () => import("../utils/program_loader.ts"),
                    catch: (error) =>
                        error instanceof Error ? error : new Error(String(error)),
                });
                runner = asMenuRunner(entry, registerTerminalApplication);
            }

            const newState = yield* runner(st);
            return {
                result: { type: CommandResultType.Success },
                state: newState,
            };
        }).pipe(
            // A package that blows up on entry is reported and isolated;
            // the main menu keeps running.
            Effect.catchAll((error) =>
                Effect.gen(function* () {
                    const st = yield* TerminalUserStateConfigContext;
                    console.log(
                        chalk.red(
                            `Failed to open package "${pkg.name}": ${
                                error instanceof Error ? error.message : String(error)
                            }`,
                        ),
                    );
                    return {
                        result: { type: CommandResultType.Error },
                        state: st,
                    };
                })
            ),
        );

    return {
        name: pkg.name,
        command: pkg.command,
        description: `${pkg.description} [package: ${relativeEntryPath(pkg, rootDir)}]`,
        action,
    };
}

/**
 * Map every loaded package onto a top-level menu option.
 */
export function packageMenuOptions(
    packages: LoadedPackage[],
    rootDir: string,
): MenuOption[] {
    return packages.map((loaded) => packageMenuOption(loaded, rootDir));
}
