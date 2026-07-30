import { ActionOptions, CommandResultType, TerminalUserStateConfig, EnvironmentType, MenuOption, CommandState, TerminalUserStateConfigContext } from "../types.ts";
import { Effect } from "effect";

const menu_back: MenuOption = {
    name: "back",
    command: "back",
    description: "Go back to the main menu",
    action: (ops?: ActionOptions): Effect.Effect<CommandState, unknown, TerminalUserStateConfigContext> => Effect.gen(function*() {
        const st = yield* TerminalUserStateConfigContext;
        return {
            result: { type: CommandResultType.Back },
            state: st,
        };
    }),
};

const menu_top: MenuOption = {
    name: "exit",
    command: "exit",
    description: "Exit the application",
    action: (ops?: ActionOptions): Effect.Effect<CommandState, unknown, TerminalUserStateConfigContext> => Effect.gen(function*() {
        const st = yield* TerminalUserStateConfigContext;
        return {
            result: { type: CommandResultType.Exit },
            state: st,
        };
    }),
};

const menu_showconfig: MenuOption = {
    name: "showconfig",
    command: "showconfig",
    description: "Show the current configuration",
    action: (ops?: ActionOptions): Effect.Effect<CommandState, unknown, TerminalUserStateConfigContext> => Effect.gen(function*() {
        const st = yield* TerminalUserStateConfigContext;
        console.log(st);
        return {
            result: { type: CommandResultType.Success },
            state: st,
        };
    }),
};

/**
 * Function to add the options for the submenus in the application,
 * with the back menu. Adds development options if the environment
 * is in development mode.
 * @param st The current state of the application.
 * @returns The menu for the submenus in the application.
 */
export const menuGlobals = (st: TerminalUserStateConfig): MenuOption[] => {
    if (st.environment === EnvironmentType.Development) {
        return [menu_top, menu_back, menu_showconfig];
    }
    return [menu_top, menu_back];
}

/**
 * Function to add the options for the top level of the application,
 * without the back menu. Adds development options if the environment
 * is in development mode.
 * @param st The current state of the application.
 * @returns The menu for the top level of the application.
 */
export const menuGlobalsTop = (st: TerminalUserStateConfig): MenuOption[] => {
    if (st.environment === EnvironmentType.Development) {
        return [menu_top, menu_showconfig];
    }
    return [menu_top, menu_back];
}
