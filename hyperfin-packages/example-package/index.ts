import { Effect } from "effect";
import chalk from "chalk";
import { registerTerminalApplication } from "../../src/cli/utils/program_loader.ts";
import {
    CommandResultType,
    type Menu,
    type MenuOption,
    type TerminalUserStateConfig,
    TerminalUserStateConfigContext,
} from "../../src/cli/types.ts";
import { menuGlobals } from "../../src/cli/utils/menu_globals.ts";

/**
 * A minimal Hyperfin package.
 *
 * A package is just a menu: it implements the same `Menu` contract the
 * built-in menus use and reaches for the same context service, so it has
 * access to the loaded state, API keys, logging and the shared chart
 * renderer without any extra plumbing.
 */
const helloMenuOptions = (state: TerminalUserStateConfig): MenuOption[] => [
    {
        name: "greet",
        command: "greet [name]",
        description: "Print a greeting, proving the package menu ran",
        action: (name?: string) =>
            Effect.gen(function* () {
                const st = yield* TerminalUserStateConfigContext;
                const who = name || "world";
                console.log(chalk.green(`Hello, ${who} — from a hyperfin package!`));
                console.log(
                    chalk.gray(
                        `(state loaded: ${st.environment}, session ${st.sessionPath})`,
                    ),
                );
                return {
                    result: { type: CommandResultType.Success },
                    state: st,
                };
            }),
    },
    ...menuGlobals(state),
];

const helloMenu: Menu = {
    name: "Hello Package",
    description: "Example package menu registered from hyperfin-packages/",
    messagePrompt: "Select an option:",
    options: helloMenuOptions,
};

/**
 * Export the menu as `menu` (preferred) or as the default export — both
 * are recognised by the package loader.
 */
export const menu = registerTerminalApplication(helloMenu);
export default menu;
